/**
 * METFA V2 — Core Revenue Types & Accounting Specifications
 * 
 * Strict Accounting Mandates:
 * 1. Financial amounts MUST use integer minor units (BIGINT amount_cents).
 * 2. Zero floating-point arithmetic for authoritative balances.
 * 3. Immutable append-only ledger architecture.
 * 4. Reconciliation compares external source totals with internal verified ledger.
 * 5. Lifecycle: DRAFT -> OPEN -> REPORTING -> RECONCILIATION -> VERIFIED -> LOCKED -> FINALIZED
 */

export type V2RevenuePeriodStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'REPORTING'
  | 'RECONCILIATION'
  | 'VERIFIED'
  | 'LOCKED'
  | 'FINALIZED'
  | 'DISPUTED'
  | 'VOIDED';

export type V2RevenueSource =
  | 'ADS'
  | 'AI'
  | 'MARKETPLACE'
  | 'SUBSCRIPTION'
  | 'GIFTS'
  | 'PROMOTION'
  | 'BUSINESS_SERVICES'
  | 'AUDIO_LICENSE'
  | 'OTHER';

export type V2RevenueEntryType =
  | 'GROSS_INCOME'
  | 'REFUND'
  | 'PROCESSING_FEE'
  | 'TAX_WITHHOLDING'
  | 'COST_DEDUCTION'
  | 'ADJUSTMENT'
  | 'REVERSAL'
  | 'SETTLEMENT_ALLOCATION';

export type V2ReconciliationVarianceStatus =
  | 'MATCHED'
  | 'MINOR_VARIANCE'
  | 'MATERIAL_VARIANCE'
  | 'UNRESOLVED'
  | 'APPROVED_ADJUSTMENT';

export interface V2RevenuePeriodRecord {
  id: string;
  period_name: string;
  period_start: string;
  period_end: string;
  currency: string;
  status: V2RevenuePeriodStatus;
  gross_revenue_cents: number;
  refunds_cents: number;
  payment_fees_cents: number;
  taxes_cents: number;
  eligible_costs_cents: number;
  eligible_net_revenue_cents: number;
  applied_policy_version?: number;
  reward_pool_percentage_basis_points?: number; // e.g. 2500 for 25.00%
  reward_pool_cents: number;
  locked_at?: string;
  finalized_at?: string;
  finalized_by?: string;
  created_at: string;
  updated_at: string;
}

export interface V2RevenueLedgerRecord {
  id: string;
  period_id: string;
  source: V2RevenueSource;
  entry_type: V2RevenueEntryType;
  amount_cents: number; // Integer minor units (positive for income, positive or negative depending on entry_type logic)
  currency: string;
  reference_id: string; // Idempotency key / external reference
  description: string;
  metadata: Record<string, unknown>;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_by: string;
  created_at: string;
}

export interface V2RevenueSourceReport {
  source: V2RevenueSource;
  provider_id: string;
  period_id: string;
  reported_gross_cents: number;
  reported_refunds_cents: number;
  reported_fees_cents: number;
  currency: string;
  external_batch_id: string;
  report_timestamp: string;
}

export interface V2ReconciliationResult {
  period_id: string;
  source_reports_total_cents: number;
  internal_ledger_gross_cents: number;
  variance_cents: number;
  variance_status: V2ReconciliationVarianceStatus;
  reconciliation_notes: string;
  verified_at: string;
  verified_by: string;
  is_approved: boolean;
}

export interface V2RevenueHealthSummary {
  status: 'HEALTHY' | 'DEGRADED' | 'ATTENTION_REQUIRED';
  active_periods_count: number;
  total_unverified_entries: number;
  unresolved_variances: number;
  last_successful_ingestion?: string;
  last_failure?: string;
  consecutive_failures: number;
}
