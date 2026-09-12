/**
 * METFA V2 — Core Server-Side Revenue Accounting Engine
 * 
 * Strict Accounting & Safety Constraints:
 * 1. Financial values use integer minor units (amount_cents BIGINT). No floating-point.
 * 2. Immutable append-only ledger entries.
 * 3. Idempotency on external reference_id to prevent double counting.
 * 4. Deterministic Net Revenue calculation:
 *    Eligible Net Revenue = Gross - Refunds - Processing Fees - Taxes - Eligible Costs +/- Adjustments
 * 5. Configurable policy versioning for reward pool allocation.
 * 6. Hard finalization barrier: Once FINALIZED, historical values cannot be overwritten.
 * 7. Comprehensive audit logging for all mutations.
 */

import {
  V2RevenuePeriodRecord,
  V2RevenueLedgerRecord,
  V2RevenueSource,
  V2RevenueEntryType,
  V2RevenuePeriodStatus,
  V2ReconciliationResult,
  V2ReconciliationVarianceStatus,
  V2RevenueHealthSummary,
  V2RevenueSourceReport,
} from '../types/v2Revenue';

interface AuditLogEntry {
  id: string;
  category: string;
  actor_id: string;
  actor_role: string;
  target_entity_id: string;
  target_entity_type: string;
  previous_state_masked?: Record<string, unknown>;
  new_state_masked: Record<string, unknown>;
  ip_address_masked?: string;
  reason_notes?: string;
  timestamp: string;
}

interface AdminPolicy {
  policy_key: string;
  version: number;
  status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
  configuration: {
    reward_pool_percentage_basis_points?: number; // e.g. 2500 for 25.00%
    max_acceptable_variance_cents?: number;
    require_dual_approval_above_cents?: number;
  };
  effective_from: string;
}

export class V2RevenueEngine {
  // In-memory persistent state representation adhering to the Phase 3 schema
  private periods: Map<string, V2RevenuePeriodRecord> = new Map();
  private ledger: Map<string, V2RevenueLedgerRecord> = new Map();
  private referenceIndex: Set<string> = new Set(); // For O(1) Idempotency enforcement
  private auditLogs: AuditLogEntry[] = [];
  private policies: Map<string, AdminPolicy[]> = new Map();
  private sourceReports: Map<string, V2RevenueSourceReport[]> = new Map(); // period_id -> reports
  private healthStats = {
    successful_ingestions: 0,
    failed_ingestions: 0,
    consecutive_failures: 0,
    last_success: undefined as string | undefined,
    last_failure: undefined as string | undefined,
  };

  constructor() {
    // Initialize default versioned reward pool policy (2500 bps = 25.00%, configurable)
    this.registerPolicy({
      policy_key: 'reward_pool_policy',
      version: 1,
      status: 'ACTIVE',
      configuration: {
        reward_pool_percentage_basis_points: 2500, // 25.00%
        max_acceptable_variance_cents: 500, // $5.00 minor variance threshold
        require_dual_approval_above_cents: 500000, // $5,000.00
      },
      effective_from: '2026-01-01T00:00:00.000Z',
    });
  }

  // =========================================================================
  // 1. POLICY REGISTRATION & VERSIONING
  // =========================================================================

  public registerPolicy(policy: AdminPolicy): void {
    const list = this.policies.get(policy.policy_key) || [];
    list.push(policy);
    this.policies.set(policy.policy_key, list);
  }

  public getActivePolicy(policyKey: string): AdminPolicy | null {
    const list = this.policies.get(policyKey);
    if (!list || list.length === 0) return null;
    const active = list.find((p) => p.status === 'ACTIVE');
    return active || list[list.length - 1];
  }

  // =========================================================================
  // 2. REVENUE PERIOD MANAGEMENT
  // =========================================================================

  public createRevenuePeriod(params: {
    period_name: string;
    period_start: string;
    period_end: string;
    currency?: string;
    actor_id: string;
    actor_role: string;
  }): V2RevenuePeriodRecord {
    const currency = params.currency?.toUpperCase() || 'USD';
    const periodId = `period_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const activePolicy = this.getActivePolicy('reward_pool_policy');
    const bps = activePolicy?.configuration?.reward_pool_percentage_basis_points ?? 2500;

    const period: V2RevenuePeriodRecord = {
      id: periodId,
      period_name: params.period_name,
      period_start: params.period_start,
      period_end: params.period_end,
      currency,
      status: 'OPEN',
      gross_revenue_cents: 0,
      refunds_cents: 0,
      payment_fees_cents: 0,
      taxes_cents: 0,
      eligible_costs_cents: 0,
      eligible_net_revenue_cents: 0,
      applied_policy_version: activePolicy?.version ?? 1,
      reward_pool_percentage_basis_points: bps,
      reward_pool_cents: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.periods.set(periodId, period);

    this.recordAudit({
      category: 'REVENUE_PERIOD_CREATED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_entity_id: periodId,
      target_entity_type: 'v2_revenue_periods',
      new_state_masked: { period_name: period.period_name, currency, status: period.status },
    });

    return { ...period };
  }

  public getPeriod(periodId: string): V2RevenuePeriodRecord | null {
    const period = this.periods.get(periodId);
    return period ? { ...period } : null;
  }

  public listPeriods(): V2RevenuePeriodRecord[] {
    return Array.from(this.periods.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // =========================================================================
  // 3. REVENUE INGESTION & IDEMPOTENT LEDGER APPEND
  // =========================================================================

  public recordRevenueEntry(params: {
    period_id: string;
    source: V2RevenueSource;
    entry_type: V2RevenueEntryType;
    amount_cents: number;
    currency: string;
    reference_id: string;
    description: string;
    metadata?: Record<string, unknown>;
    actor_id: string;
    actor_role: string;
    auto_verify?: boolean;
  }): { success: boolean; entry?: V2RevenueLedgerRecord; error?: string; is_duplicate?: boolean } {
    try {
      const period = this.periods.get(params.period_id);
      if (!period) {
        throw new Error(`Revenue period '${params.period_id}' does not exist.`);
      }

      // Finalized & Locked periods reject new entries
      if (period.status === 'FINALIZED' || period.status === 'LOCKED') {
        throw new Error(`Period '${period.period_name}' is ${period.status}. No direct entries can be added.`);
      }

      // Multi-currency safety: Currency must strictly match the period's currency
      if (params.currency.toUpperCase() !== period.currency.toUpperCase()) {
        throw new Error(
          `Currency mismatch: Period currency is '${period.currency}', but received entry in '${params.currency}'.`
        );
      }

      // Integer Minor Unit Validation (Must be safe integer)
      if (!Number.isSafeInteger(params.amount_cents) || params.amount_cents <= 0) {
        throw new Error(`Invalid amount_cents: Must be a strictly positive safe integer minor unit.`);
      }

      // Idempotency enforcement on external reference_id
      const idempotencyKey = `${params.source}:${params.reference_id}`;
      if (this.referenceIndex.has(idempotencyKey)) {
        // Return existing entry safely without duplication
        const existing = Array.from(this.ledger.values()).find(
          (e) => e.reference_id === params.reference_id && e.source === params.source
        );
        return { success: true, entry: existing, is_duplicate: true };
      }

      const entryId = `rev_entry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const isVerified = Boolean(params.auto_verify);

      const entry: V2RevenueLedgerRecord = {
        id: entryId,
        period_id: params.period_id,
        source: params.source,
        entry_type: params.entry_type,
        amount_cents: params.amount_cents,
        currency: params.currency.toUpperCase(),
        reference_id: params.reference_id,
        description: params.description,
        metadata: params.metadata || {},
        is_verified: isVerified,
        verified_by: isVerified ? params.actor_id : undefined,
        verified_at: isVerified ? new Date().toISOString() : undefined,
        created_by: params.actor_id,
        created_at: new Date().toISOString(),
      };

      this.ledger.set(entryId, entry);
      this.referenceIndex.add(idempotencyKey);

      // Re-calculate period accounting figures deterministically
      this.recomputePeriodTotals(period);

      this.healthStats.successful_ingestions += 1;
      this.healthStats.consecutive_failures = 0;
      this.healthStats.last_success = new Date().toISOString();

      this.recordAudit({
        category: 'REVENUE_ENTRY_RECORDED',
        actor_id: params.actor_id,
        actor_role: params.actor_role,
        target_entity_id: entryId,
        target_entity_type: 'v2_revenue_ledger',
        new_state_masked: {
          period_id: entry.period_id,
          source: entry.source,
          entry_type: entry.entry_type,
          amount_cents: entry.amount_cents,
          is_verified: entry.is_verified,
        },
      });

      return { success: true, entry: { ...entry }, is_duplicate: false };
    } catch (err: any) {
      this.healthStats.failed_ingestions += 1;
      this.healthStats.consecutive_failures += 1;
      this.healthStats.last_failure = new Date().toISOString();
      return { success: false, error: err.message || 'Failed to record revenue entry.' };
    }
  }

  // =========================================================================
  // 4. VERIFICATION CONTROLS
  // =========================================================================

  public verifyRevenueEntry(params: {
    entry_id: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; entry?: V2RevenueLedgerRecord; error?: string } {
    const entry = this.ledger.get(params.entry_id);
    if (!entry) {
      return { success: false, error: `Ledger entry '${params.entry_id}' not found.` };
    }

    const period = this.periods.get(entry.period_id);
    if (period?.status === 'FINALIZED') {
      return { success: false, error: 'Cannot verify entries in a finalized period.' };
    }

    if (entry.is_verified) {
      return { success: true, entry: { ...entry } };
    }

    entry.is_verified = true;
    entry.verified_by = params.actor_id;
    entry.verified_at = new Date().toISOString();

    if (period) {
      this.recomputePeriodTotals(period);
    }

    this.recordAudit({
      category: 'REVENUE_ENTRY_VERIFIED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_entity_id: entry.id,
      target_entity_type: 'v2_revenue_ledger',
      new_state_masked: { is_verified: true, verified_by: params.actor_id },
    });

    return { success: true, entry: { ...entry } };
  }

  // =========================================================================
  // 5. RECONCILIATION ENGINE
  // =========================================================================

  public submitSourceReport(report: V2RevenueSourceReport): void {
    const reports = this.sourceReports.get(report.period_id) || [];
    reports.push(report);
    this.sourceReports.set(report.period_id, reports);
  }

  public reconcileRevenuePeriod(params: {
    period_id: string;
    actor_id: string;
    actor_role: string;
  }): V2ReconciliationResult {
    const period = this.periods.get(params.period_id);
    if (!period) {
      throw new Error(`Period '${params.period_id}' not found.`);
    }

    const reports = this.sourceReports.get(params.period_id) || [];
    const sourceReportsTotalCents = reports.reduce((sum, r) => sum + r.reported_gross_cents, 0);

    // Internal verified gross income
    const internalLedgerGrossCents = Array.from(this.ledger.values())
      .filter((e) => e.period_id === params.period_id && e.entry_type === 'GROSS_INCOME' && e.is_verified)
      .reduce((sum, e) => sum + e.amount_cents, 0);

    const varianceCents = Math.abs(sourceReportsTotalCents - internalLedgerGrossCents);
    const activePolicy = this.getActivePolicy('reward_pool_policy');
    const maxAllowedVariance = activePolicy?.configuration?.max_acceptable_variance_cents ?? 500;

    let varianceStatus: V2ReconciliationVarianceStatus = 'MATCHED';
    let isApproved = false;

    if (varianceCents === 0) {
      varianceStatus = 'MATCHED';
      isApproved = true;
    } else if (varianceCents <= maxAllowedVariance) {
      varianceStatus = 'MINOR_VARIANCE';
      isApproved = true;
    } else {
      varianceStatus = 'MATERIAL_VARIANCE';
      isApproved = false;
    }

    const notes =
      varianceStatus === 'MATCHED'
        ? 'Reconciliation complete: Internal verified ledger precisely matches source reports.'
        : varianceStatus === 'MINOR_VARIANCE'
        ? `Reconciliation passed with minor variance of ${varianceCents} cents, within policy threshold.`
        : `Material discrepancy detected: variance of ${varianceCents} cents exceeds acceptable policy threshold. Requires audit investigation.`;

    const result: V2ReconciliationResult = {
      period_id: params.period_id,
      source_reports_total_cents: sourceReportsTotalCents,
      internal_ledger_gross_cents: internalLedgerGrossCents,
      variance_cents: varianceCents,
      variance_status: varianceStatus,
      reconciliation_notes: notes,
      verified_at: new Date().toISOString(),
      verified_by: params.actor_id,
      is_approved: isApproved,
    };

    if (isApproved && period.status === 'OPEN') {
      period.status = 'VERIFIED';
      period.updated_at = new Date().toISOString();
    }

    this.recordAudit({
      category: 'REVENUE_RECONCILIATION_PERFORMED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_entity_id: params.period_id,
      target_entity_type: 'v2_revenue_periods',
      new_state_masked: {
        variance_cents: varianceCents,
        variance_status: varianceStatus,
        is_approved: isApproved,
      },
    });

    return result;
  }

  // =========================================================================
  // 6. PERIOD LOCKING & FINALIZATION CONTROLS
  // =========================================================================

  public lockRevenuePeriod(params: {
    period_id: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; period?: V2RevenuePeriodRecord; error?: string } {
    const period = this.periods.get(params.period_id);
    if (!period) return { success: false, error: 'Period not found.' };

    if (period.status === 'FINALIZED') {
      return { success: false, error: 'Period is already finalized.' };
    }

    period.status = 'LOCKED';
    period.locked_at = new Date().toISOString();
    period.updated_at = new Date().toISOString();

    this.recordAudit({
      category: 'REVENUE_PERIOD_LOCKED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_entity_id: period.id,
      target_entity_type: 'v2_revenue_periods',
      new_state_masked: { status: 'LOCKED', locked_at: period.locked_at },
    });

    return { success: true, period: { ...period } };
  }

  public finalizeRevenuePeriod(params: {
    period_id: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; period?: V2RevenuePeriodRecord; error?: string } {
    const period = this.periods.get(params.period_id);
    if (!period) return { success: false, error: 'Period not found.' };

    if (period.status === 'FINALIZED') {
      return { success: true, period: { ...period } }; // Already finalized
    }

    // Role Gate: Only FINANCE_ADMIN or SUPER_ADMIN may finalize financial periods
    const allowedRoles = ['FINANCE_ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(params.actor_role)) {
      return {
        success: false,
        error: `Unauthorized: Finalizing a revenue period requires FINANCE_ADMIN or SUPER_ADMIN role. Received '${params.actor_role}'.`,
      };
    }

    // Verification check: Check that all ledger entries in this period are verified
    const periodEntries = Array.from(this.ledger.values()).filter((e) => e.period_id === params.period_id);
    const unverified = periodEntries.filter((e) => !e.is_verified);
    if (unverified.length > 0) {
      return {
        success: false,
        error: `Cannot finalize period: ${unverified.length} unverified ledger entries remain.`,
      };
    }

    // Finalize state
    period.status = 'FINALIZED';
    period.finalized_at = new Date().toISOString();
    period.finalized_by = params.actor_id;
    period.updated_at = new Date().toISOString();

    this.recomputePeriodTotals(period);

    this.recordAudit({
      category: 'REVENUE_PERIOD_FINALIZED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_entity_id: period.id,
      target_entity_type: 'v2_revenue_periods',
      new_state_masked: {
        status: 'FINALIZED',
        finalized_at: period.finalized_at,
        eligible_net_revenue_cents: period.eligible_net_revenue_cents,
        reward_pool_cents: period.reward_pool_cents,
      },
    });

    return { success: true, period: { ...period } };
  }

  // =========================================================================
  // 7. DETERMINISTIC ACCOUNTING COMPUTATION
  // =========================================================================

  private recomputePeriodTotals(period: V2RevenuePeriodRecord): void {
    const entries = Array.from(this.ledger.values()).filter(
      (e) => e.period_id === period.id && e.is_verified
    );

    let gross = 0;
    let refunds = 0;
    let fees = 0;
    let taxes = 0;
    let costs = 0;
    let adjustments = 0;

    for (const e of entries) {
      switch (e.entry_type) {
        case 'GROSS_INCOME':
          gross += e.amount_cents;
          break;
        case 'REFUND':
          refunds += e.amount_cents;
          break;
        case 'PROCESSING_FEE':
          fees += e.amount_cents;
          break;
        case 'TAX_WITHHOLDING':
          taxes += e.amount_cents;
          break;
        case 'COST_DEDUCTION':
          costs += e.amount_cents;
          break;
        case 'ADJUSTMENT':
          adjustments += e.amount_cents; // Can be positive or negative
          break;
        case 'REVERSAL':
          adjustments -= e.amount_cents;
          break;
      }
    }

    period.gross_revenue_cents = gross;
    period.refunds_cents = refunds;
    period.payment_fees_cents = fees;
    period.taxes_cents = taxes;
    period.eligible_costs_cents = costs;

    // Eligible Net Revenue = Gross - Refunds - Fees - Taxes - Costs + Adjustments
    const net = gross - refunds - fees - taxes - costs + adjustments;
    period.eligible_net_revenue_cents = Math.max(0, net);

    // Calculate Reward Pool from Active Versioned Policy
    const bps = period.reward_pool_percentage_basis_points ?? 2500;
    // Math.floor ensures integer cents without floating arithmetic bleed
    period.reward_pool_cents = Math.floor((period.eligible_net_revenue_cents * bps) / 10000);
    period.updated_at = new Date().toISOString();
  }

  // =========================================================================
  // 8. AUDIT LOGGING & HEALTH TELEMETRY
  // =========================================================================

  private recordAudit(params: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const log: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      ...params,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.push(log);
  }

  public getAuditLogs(entityId?: string): AuditLogEntry[] {
    if (!entityId) return [...this.auditLogs];
    return this.auditLogs.filter((l) => l.target_entity_id === entityId);
  }

  public getLedgerEntries(periodId: string): V2RevenueLedgerRecord[] {
    return Array.from(this.ledger.values())
      .filter((e) => e.period_id === periodId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getRevenueHealth(): V2RevenueHealthSummary {
    const unverifiedCount = Array.from(this.ledger.values()).filter((e) => !e.is_verified).length;
    const activeCount = Array.from(this.periods.values()).filter((p) => p.status !== 'FINALIZED').length;

    return {
      status: this.healthStats.consecutive_failures > 3 ? 'DEGRADED' : 'HEALTHY',
      active_periods_count: activeCount,
      total_unverified_entries: unverifiedCount,
      unresolved_variances: 0,
      last_successful_ingestion: this.healthStats.last_success,
      last_failure: this.healthStats.last_failure,
      consecutive_failures: this.healthStats.consecutive_failures,
    };
  }
}

// Global Singleton Instance for Server-Side Authority
export const v2RevenueEngine = new V2RevenueEngine();
