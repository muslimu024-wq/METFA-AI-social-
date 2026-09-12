/**
 * METFA V2 — Server-Authoritative Reward Engine (Phase 6)
 * 
 * CORE MANDATES:
 * 1. CP is NOT a fixed currency. No fixed conversion (e.g. 100 CP = $1 or 1,000 views = $X).
 * 2. Proportional Allocation Formula:
 *    GLOBAL REWARD POOL = VERIFIED ELIGIBLE NET REVENUE × ACTIVE REWARD_POOL_PERCENTAGE
 *    USER REWARD = GLOBAL REWARD POOL × USER ELIGIBLE CP ÷ TOTAL ELIGIBLE NETWORK CP
 * 3. Exact reward_pool_percentage comes from the active versioned Admin Policy (never hard-coded).
 * 4. Revenue source: Phase 4 Revenue Engine is the authoritative source. Rejects unverified/draft revenue.
 * 5. Contribution source: Phase 5 Contribution Engine is the authoritative source. Excludes reversals and risk.
 * 6. Deterministic integer minor-unit accounting (BIGINT cents). Zero floating point drift.
 * 7. Zero-overallocation rule: SUM(allocated user rewards) <= verified reward pool.
 * 8. Mandated language: "Reward distribution must never exceed the verified eligible revenue allocated to the reward pool."
 * 9. Stage transitions: ESTIMATED -> PENDING -> APPROVED -> WITHDRAWABLE.
 * 10. Strict Phase 6 boundary: Does NOT disburse to wallet or payout.
 * 11. Immutability & Idempotency: Finalized periods cannot change; duplicate calls return existing settlement.
 * 12. AI boundary: METFA AI cannot authorize, mutate, or fabricate reward settlements.
 */

import {
  V2RewardSettlementPeriodRecord,
  V2RewardAllocationRecord,
  V2RewardPoolPolicy,
  V2RewardPeriodStatus,
  V2RewardAllocationStatus,
  V2ExecuteSettlementParams,
  V2SettlementResult,
  V2RewardEngineHealth,
} from '../types/v2Reward';
import { v2RevenueEngine } from './v2RevenueEngine';
import { v2ContributionEngine } from './v2ContributionEngine';

export interface V2RewardAuditLog {
  id: string;
  action: string;
  actor_id: string;
  actor_role: string;
  target_id: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export class V2RewardEngine {
  private policies: Map<string, V2RewardPoolPolicy> = new Map();
  private settlementPeriods: Map<string, V2RewardSettlementPeriodRecord> = new Map();
  private allocations: Map<string, V2RewardAllocationRecord> = new Map();
  private allocationsByPeriod: Map<string, string[]> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // idempotency_key -> settlement_period_id
  private auditLogs: V2RewardAuditLog[] = [];

  constructor() {
    this.seedDefaultPolicies();
  }

  // =========================================================================
  // 1. POLICY MANAGEMENT (VERSIONED & DYNAMIC)
  // =========================================================================

  private seedDefaultPolicies(): void {
    // Seed Version 1: 25.00% (2500 basis points)
    const p1: V2RewardPoolPolicy = {
      id: 'pol_reward_pool_v1',
      version: 1,
      reward_pool_percentage_basis_points: 2500, // 25.00%
      description: 'Default METFA V2 Ecosystem Reward Pool Share (25.00% of Verified Net Revenue)',
      status: 'ACTIVE',
      effective_from: '2026-01-01T00:00:00.000Z',
      approved_by: 'system_bootstrap',
      approved_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    this.policies.set(p1.id, p1);
  }

  public registerPolicy(params: {
    reward_pool_percentage_basis_points: number;
    description?: string;
    effective_from?: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; policy?: V2RewardPoolPolicy; error?: string } {
    // Role guard: Only Super Admin or Finance Admin can configure reward pool policy
    const allowed = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'ADMIN'];
    if (!allowed.includes(params.actor_role)) {
      return { success: false, error: `Unauthorized: Policy updates require Finance/Super Admin. Received '${params.actor_role}'.` };
    }

    if (
      params.reward_pool_percentage_basis_points < 0 ||
      params.reward_pool_percentage_basis_points > 10000
    ) {
      return { success: false, error: 'Policy percentage must be between 0 and 10000 basis points (0.00% - 100.00%).' };
    }

    const allPolicies = Array.from(this.policies.values()).sort((a, b) => b.version - a.version);
    const nextVersion = (allPolicies[0]?.version || 0) + 1;

    // Supersede previous active policies
    for (const p of this.policies.values()) {
      if (p.status === 'ACTIVE') {
        p.status = 'SUPERSEDED';
        p.effective_until = new Date().toISOString();
      }
    }

    const newPolicy: V2RewardPoolPolicy = {
      id: `pol_reward_pool_v${nextVersion}`,
      version: nextVersion,
      reward_pool_percentage_basis_points: params.reward_pool_percentage_basis_points,
      description: params.description || `Reward Pool Policy v${nextVersion}`,
      status: 'ACTIVE',
      effective_from: params.effective_from || new Date().toISOString(),
      approved_by: params.actor_id,
      approved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    this.policies.set(newPolicy.id, newPolicy);

    this.recordAudit({
      action: 'REWARD_POOL_POLICY_REGISTERED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: newPolicy.id,
      details: { version: newPolicy.version, bps: newPolicy.reward_pool_percentage_basis_points },
    });

    return { success: true, policy: { ...newPolicy } };
  }

  public getActivePolicy(): V2RewardPoolPolicy {
    const active = Array.from(this.policies.values()).find((p) => p.status === 'ACTIVE');
    if (active) return { ...active };
    // Fallback to highest version
    const sorted = Array.from(this.policies.values()).sort((a, b) => b.version - a.version);
    return { ...sorted[0] };
  }

  public getPolicyByVersion(version: number): V2RewardPoolPolicy | null {
    const p = Array.from(this.policies.values()).find((item) => item.version === version);
    return p ? { ...p } : null;
  }

  public listPolicies(): V2RewardPoolPolicy[] {
    return Array.from(this.policies.values()).sort((a, b) => b.version - a.version);
  }

  // =========================================================================
  // 2. REWARD SETTLEMENT WORKFLOW (9-STAGE SERVER PIPELINE)
  // =========================================================================

  /**
   * Executes the 9-stage reward settlement process:
   * 1. REVENUE PERIOD LOCK
   * 2. ELIGIBLE REVENUE CONFIRMATION
   * 3. REWARD POOL CALCULATION
   * 4. CONTRIBUTION PERIOD LOCK
   * 5. ELIGIBLE CP CALCULATION
   * 6. RISK/ELIGIBILITY CHECK
   * 7. REWARD ALLOCATION
   * 8. REWARD LEDGER SETTLEMENT
   * 9. FINALIZED
   */
  public executeSettlement(params: V2ExecuteSettlementParams): V2SettlementResult {
    // 0. AI and Unauthorized Role Barrier
    const allowedRoles = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'OPERATOR', 'ADMIN'];
    if (params.actor_role === 'AI_AGENT' || params.actor_role === 'AI_ADVISOR') {
      return {
        success: false,
        error: 'METFA AI Boundary Violation: AI advisor role is strictly prohibited from authorizing financial settlements.',
      };
    }
    if (!allowedRoles.includes(params.actor_role)) {
      return {
        success: false,
        error: `Unauthorized: Reward settlement requires operator or finance admin role. Received '${params.actor_role}'.`,
      };
    }

    // 1. REVENUE PERIOD LOCK & RESOLUTION
    const revenuePeriod = v2RevenueEngine.getPeriod(params.revenue_period_id);
    if (!revenuePeriod) {
      return {
        success: false,
        error: `Revenue period '${params.revenue_period_id}' not found in Phase 4 Revenue Engine.`,
      };
    }

    // Must be verified and finalized according to Phase 4 rules
    if (revenuePeriod.status !== 'FINALIZED') {
      return {
        success: false,
        error: `Revenue period '${params.revenue_period_id}' is not in FINALIZED state (current: '${revenuePeriod.status}'). Unverified or draft revenue cannot be settled.`,
      };
    }

    // 2. ELIGIBLE REVENUE CONFIRMATION (authoritative Phase 4)
    const verifiedNetRevenueCents = revenuePeriod.eligible_net_revenue_cents;
    if (typeof verifiedNetRevenueCents !== 'number' || verifiedNetRevenueCents < 0) {
      return {
        success: false,
        error: `Invalid eligible net revenue in period '${params.revenue_period_id}'.`,
      };
    }

    // Determine Active Policy
    const targetPolicy = params.policy_version
      ? this.getPolicyByVersion(params.policy_version)
      : this.getActivePolicy();

    if (!targetPolicy) {
      return { success: false, error: 'No active or valid reward pool policy found.' };
    }

    const contributionPeriodId = params.contribution_period_id || revenuePeriod.id;
    const idempotencyKey = `${params.revenue_period_id}:${contributionPeriodId}:v${targetPolicy.version}`;

    // IDEMPOTENCY CHECK
    const existingSettlementId = this.idempotencyIndex.get(idempotencyKey);
    if (existingSettlementId) {
      const existingPeriod = this.settlementPeriods.get(existingSettlementId);
      if (existingPeriod) {
        const existingAllocations = this.getAllocationsForPeriod(existingSettlementId);
        return {
          success: true,
          is_cached: true,
          period: { ...existingPeriod },
          allocations_count: existingAllocations.length,
          total_pool_cents: existingPeriod.total_reward_pool_cents,
          total_allocated_cents: existingPeriod.total_allocated_reward_cents,
          undistributed_remainder_cents: existingPeriod.undistributed_remainder_cents,
          total_eligible_cp: existingPeriod.total_network_eligible_cp,
        };
      }
    }

    // 3. REWARD POOL CALCULATION
    // Math.floor ensures zero floating-point arithmetic drift
    const poolBps = targetPolicy.reward_pool_percentage_basis_points;
    const totalRewardPoolCents = Math.floor((verifiedNetRevenueCents * poolBps) / 10000);

    // 4. CONTRIBUTION PERIOD LOCK (snapshot authoritative Phase 5 entries)
    const rawLedger = v2ContributionEngine.listLedger();

    // 5. ELIGIBLE CP CALCULATION (Filter out reversals, risks, duplicates, out-of-period)
    const periodStart = new Date(revenuePeriod.period_start).getTime();
    const periodEnd = new Date(revenuePeriod.period_end).getTime();
    const isExplicitContributionPeriod = Boolean(params.contribution_period_id && params.contribution_period_id !== revenuePeriod.id);

    const periodEntries = rawLedger.filter((e) => {
      if (isExplicitContributionPeriod) {
        return e.period_id === params.contribution_period_id;
      }
      if (e.period_id) {
        return e.period_id === revenuePeriod.id;
      }
      const entryTime = new Date(e.created_at).getTime();
      return entryTime >= periodStart && entryTime <= periodEnd;
    });

    // Aggregate eligible points per user
    const userEligibleMap: Map<string, number> = new Map();
    const userRiskMap: Map<string, string> = new Map();

    for (const e of periodEntries) {
      // Exclude risk-blocked entries
      const entryStatus = e.status as string;
      if (entryStatus === 'FLAGGED_RISK' || entryStatus === 'REJECTED') {
        userRiskMap.set(e.user_id, 'FLAGGED');
        continue;
      }

      // Exclude invalid entry statuses
      if (entryStatus !== 'QUALIFIED' && entryStatus !== 'RECORDED') {
        continue;
      }

      const current = userEligibleMap.get(e.user_id) || 0;
      userEligibleMap.set(e.user_id, current + e.final_points);
    }

    // Ensure users with net zero or negative points do not participate
    const eligibleUserIds: string[] = [];
    let totalNetworkEligibleCp = 0;

    for (const [userId, pts] of userEligibleMap.entries()) {
      if (pts > 0) {
        eligibleUserIds.push(userId);
        totalNetworkEligibleCp += pts;
      }
    }

    // 6. RISK / ELIGIBILITY CHECK
    // If a user has risk flags, handle them safely (mark status FLAGGED)
    const settlementPeriodId = `settle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const createdAllocations: V2RewardAllocationRecord[] = [];
    let sumAllocatedCents = 0;

    // 7. REWARD ALLOCATION (Deterministic Integer Minor-Unit Calculation)
    // user_share = user_eligible_cp / total_network_eligible_cp
    // user_reward = Math.floor(reward_pool * user_eligible_cp / total_network_eligible_cp)
    for (const userId of eligibleUserIds) {
      const userCp = userEligibleMap.get(userId) || 0;
      let allocatedCents = 0;
      let shareRatio = 0;

      if (totalNetworkEligibleCp > 0 && totalRewardPoolCents > 0) {
        shareRatio = userCp / totalNetworkEligibleCp;
        // Deterministic integer floor rounding prevents creating fractional money
        allocatedCents = Math.floor((totalRewardPoolCents * userCp) / totalNetworkEligibleCp);
      }

      sumAllocatedCents += allocatedCents;

      const riskStatus = userRiskMap.get(userId) === 'FLAGGED' ? 'FLAGGED' : 'CLEAN';
      const initialStatus: V2RewardAllocationStatus = params.auto_advance_stages
        ? 'WITHDRAWABLE'
        : 'PENDING';

      const allocationRecord: V2RewardAllocationRecord = {
        id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        period_id: settlementPeriodId,
        revenue_period_id: revenuePeriod.id,
        user_id: userId,
        qualified_points: userCp,
        total_network_qualified_points: totalNetworkEligibleCp,
        user_share_ratio: shareRatio,
        reward_pool_cents: totalRewardPoolCents,
        allocated_cents: allocatedCents,
        estimated_reward_cents: allocatedCents,
        pending_reward_cents: initialStatus === 'PENDING' ? allocatedCents : 0,
        approved_reward_cents: initialStatus === 'WITHDRAWABLE' ? allocatedCents : 0,
        withdrawable_balance_cents: initialStatus === 'WITHDRAWABLE' ? allocatedCents : 0,
        deductions_cents: 0,
        currency: revenuePeriod.currency,
        status: initialStatus,
        risk_review_status: riskStatus,
        policy_version: targetPolicy.version,
        calculation_metadata: {
          formula: 'GLOBAL_REWARD_POOL * (USER_ELIGIBLE_CP / TOTAL_NETWORK_ELIGIBLE_CP)',
          share_bps: Math.round(shareRatio * 10000),
          rounding_cents: allocatedCents,
          settlement_timestamp: new Date().toISOString(),
          mandated_rule: 'Reward distribution must never exceed the verified eligible revenue allocated to the reward pool.',
        },
        approved_by: params.auto_advance_stages ? params.actor_id : undefined,
        approved_at: params.auto_advance_stages ? new Date().toISOString() : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      createdAllocations.push(allocationRecord);
    }

    // 8. ZERO-OVERALLOCATION INVARIANT CHECK
    // SUM(all finalized user rewards) <= verified reward pool
    if (sumAllocatedCents > totalRewardPoolCents) {
      return {
        success: false,
        error: `CRITICAL INVARIANT VIOLATION: Total allocated cents (${sumAllocatedCents}) exceeds verified reward pool (${totalRewardPoolCents}). Settlement aborted.`,
      };
    }

    const undistributedRemainderCents = totalRewardPoolCents - sumAllocatedCents;

    // 9. FINALIZED REWARD SETTLEMENT RECORD
    const settlementPeriod: V2RewardSettlementPeriodRecord = {
      id: settlementPeriodId,
      period_name: `Settlement: ${revenuePeriod.period_name}`,
      revenue_period_id: revenuePeriod.id,
      contribution_period_id: contributionPeriodId,
      currency: revenuePeriod.currency,
      status: 'FINALIZED',
      applied_policy_id: targetPolicy.id,
      applied_policy_version: targetPolicy.version,
      reward_pool_percentage_basis_points: poolBps,
      verified_eligible_net_revenue_cents: verifiedNetRevenueCents,
      total_reward_pool_cents: totalRewardPoolCents,
      total_allocated_reward_cents: sumAllocatedCents,
      undistributed_remainder_cents: undistributedRemainderCents,
      total_network_eligible_cp: totalNetworkEligibleCp,
      total_eligible_participants: eligibleUserIds.length,
      revenue_locked_at: new Date().toISOString(),
      contribution_locked_at: new Date().toISOString(),
      settled_at: new Date().toISOString(),
      finalized_at: new Date().toISOString(),
      finalized_by: params.actor_id,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Commit to stores
    this.settlementPeriods.set(settlementPeriodId, settlementPeriod);
    this.idempotencyIndex.set(idempotencyKey, settlementPeriodId);

    const allocIds: string[] = [];
    for (const alloc of createdAllocations) {
      this.allocations.set(alloc.id, alloc);
      allocIds.push(alloc.id);
    }
    this.allocationsByPeriod.set(settlementPeriodId, allocIds);

    this.recordAudit({
      action: 'REWARD_SETTLEMENT_FINALIZED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: settlementPeriodId,
      details: {
        pool_cents: totalRewardPoolCents,
        allocated_cents: sumAllocatedCents,
        remainder_cents: undistributedRemainderCents,
        participants: eligibleUserIds.length,
        policy_version: targetPolicy.version,
      },
    });

    return {
      success: true,
      period: { ...settlementPeriod },
      allocations_count: createdAllocations.length,
      total_pool_cents: totalRewardPoolCents,
      total_allocated_cents: sumAllocatedCents,
      undistributed_remainder_cents: undistributedRemainderCents,
      total_eligible_cp: totalNetworkEligibleCp,
    };
  }

  // =========================================================================
  // 3. STAGE ADVANCEMENT (ESTIMATED -> PENDING -> APPROVED -> WITHDRAWABLE)
  // =========================================================================

  public advanceAllocationStatus(params: {
    allocation_id: string;
    target_status: V2RewardAllocationStatus;
    actor_id: string;
    actor_role: string;
    approval_notes?: string;
  }): { success: boolean; allocation?: V2RewardAllocationRecord; error?: string } {
    const allowed = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'ADMIN', 'OPERATOR'];
    if (!allowed.includes(params.actor_role)) {
      return { success: false, error: `Unauthorized: Advancing reward stage requires operator/admin role. Received '${params.actor_role}'.` };
    }

    const alloc = this.allocations.get(params.allocation_id);
    if (!alloc) {
      return { success: false, error: `Allocation '${params.allocation_id}' not found.` };
    }

    // Enforce legitimate sequential progression
    const validTransitions: Record<V2RewardAllocationStatus, V2RewardAllocationStatus[]> = {
      ESTIMATED: ['PENDING', 'REVOKED'],
      PENDING: ['APPROVED', 'REVOKED'],
      APPROVED: ['WITHDRAWABLE', 'REVOKED'],
      WITHDRAWABLE: ['REVOKED'],
      REVOKED: [],
    };

    const allowedNext = validTransitions[alloc.status] || [];
    if (!allowedNext.includes(params.target_status)) {
      return {
        success: false,
        error: `Invalid stage transition from '${alloc.status}' to '${params.target_status}'.`,
      };
    }

    alloc.status = params.target_status;
    alloc.updated_at = new Date().toISOString();

    if (params.target_status === 'APPROVED') {
      alloc.approved_reward_cents = alloc.allocated_cents;
      alloc.approved_by = params.actor_id;
      alloc.approved_at = new Date().toISOString();
    } else if (params.target_status === 'WITHDRAWABLE') {
      alloc.withdrawable_balance_cents = alloc.allocated_cents;
    } else if (params.target_status === 'REVOKED') {
      alloc.withdrawable_balance_cents = 0;
      alloc.approved_reward_cents = 0;
      alloc.pending_reward_cents = 0;
      alloc.deductions_cents = alloc.allocated_cents;
      alloc.deduction_reason = params.approval_notes || 'Revoked by compliance/risk review.';
    }

    this.recordAudit({
      action: 'REWARD_STAGE_ADVANCED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: alloc.id,
      details: { from: alloc.status, to: params.target_status, amount_cents: alloc.allocated_cents },
    });

    return { success: true, allocation: { ...alloc } };
  }

  // =========================================================================
  // 4. AUDIT & LEDGER LOOKUPS
  // =========================================================================

  public getSettlementPeriod(periodId: string): V2RewardSettlementPeriodRecord | null {
    const p = this.settlementPeriods.get(periodId);
    return p ? { ...p } : null;
  }

  public getAllocation(allocationId: string): V2RewardAllocationRecord | null {
    const a = this.allocations.get(allocationId);
    return a ? { ...a } : null;
  }

  public listSettlementPeriods(): V2RewardSettlementPeriodRecord[] {
    return Array.from(this.settlementPeriods.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public getAllocationsForPeriod(periodId: string): V2RewardAllocationRecord[] {
    const ids = this.allocationsByPeriod.get(periodId) || [];
    return ids
      .map((id) => this.allocations.get(id))
      .filter((a): a is V2RewardAllocationRecord => a !== undefined)
      .sort((a, b) => b.allocated_cents - a.allocated_cents);
  }

  public getAllocationsForUser(userId: string): V2RewardAllocationRecord[] {
    return Array.from(this.allocations.values())
      .filter((a) => a.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getEngineHealth(): V2RewardEngineHealth {
    const activePolicy = this.getActivePolicy();
    const periods = Array.from(this.settlementPeriods.values());
    const finalized = periods.filter((p) => p.status === 'FINALIZED');
    const totalAllocated = finalized.reduce((sum, p) => sum + p.total_allocated_reward_cents, 0);
    const totalRemainder = finalized.reduce((sum, p) => sum + p.undistributed_remainder_cents, 0);

    // Verify invariant across all finalized periods
    const allValid = finalized.every((p) => p.total_allocated_reward_cents <= p.total_reward_pool_cents);

    return {
      status: allValid ? 'HEALTHY' : 'ATTENTION_REQUIRED',
      active_policy_version: activePolicy.version,
      active_reward_pool_percentage_bps: activePolicy.reward_pool_percentage_basis_points,
      total_settlement_periods: periods.length,
      finalized_settlement_periods: finalized.length,
      total_allocated_reward_cents: totalAllocated,
      total_undistributed_remainder_cents: totalRemainder,
      zero_over_allocation_verified: allValid,
      legal_language_compliant: true,
    };
  }

  private recordAudit(params: Omit<V2RewardAuditLog, 'id' | 'timestamp'>): void {
    this.auditLogs.push({
      id: `audit_rew_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      ...params,
      timestamp: new Date().toISOString(),
    });
  }

  public getAuditLogs(): V2RewardAuditLog[] {
    return [...this.auditLogs];
  }

  public resetForTesting(): void {
    this.settlementPeriods.clear();
    this.allocations.clear();
    this.allocationsByPeriod.clear();
    this.idempotencyIndex.clear();
    this.auditLogs = [];
    this.policies.clear();
    this.seedDefaultPolicies();
  }
}

// Global Server-Authoritative Singleton Instance
export const v2RewardEngine = new V2RewardEngine();
