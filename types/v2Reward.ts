/**
 * METFA V2 — Reward Engine Types & Settlement Specifications (Phase 6)
 * 
 * CORE ARCHITECTURAL RULES:
 * 1. Contribution Points (CP) are NOT a fixed currency.
 *    No fixed conversion rates (e.g. 100 CP = $1 or 1,000 views = $X).
 * 2. Proportional Allocation Model:
 *    GLOBAL REWARD POOL = VERIFIED ELIGIBLE NET REVENUE × ACTIVE REWARD_POOL_PERCENTAGE
 *    USER REWARD = GLOBAL REWARD POOL × USER ELIGIBLE CP ÷ TOTAL ELIGIBLE NETWORK CP
 * 3. Exact reward_pool_percentage comes from the active versioned Admin Policy (never hard-coded).
 * 4. Consumes authoritative Phase 4 Revenue Engine periods only (verified, finalized).
 * 5. Consumes authoritative Phase 5 Contribution Engine CP only (excludes reversals, risks, duplicates).
 * 6. Deterministic integer minor-unit accounting (cents BIGINT). Never floating point.
 * 7. Zero-overallocation rule: SUM(allocated user rewards) <= verified reward pool.
 * 8. Mandated language: "Reward distribution must never exceed the verified eligible revenue allocated to the reward pool."
 * 9. Lifecycle stages: ESTIMATED -> PENDING -> APPROVED -> WITHDRAWABLE.
 * 10. Strict Phase 6 boundary: Does NOT transfer to wallet or initiate payouts. Ends at finalized allocation.
 */

export type V2RewardPeriodStatus =
  | 'PENDING_REVENUE_CONFIRMATION'
  | 'REVENUE_LOCKED'
  | 'CALCULATING_POOL'
  | 'CONTRIBUTION_LOCKED'
  | 'ALLOCATING'
  | 'SETTLED'
  | 'FINALIZED'
  | 'REVOKED';

export type V2RewardAllocationStatus =
  | 'ESTIMATED'
  | 'PENDING'
  | 'APPROVED'
  | 'WITHDRAWABLE'
  | 'REVOKED';

export type V2RewardRiskStatus =
  | 'CLEAN'
  | 'FLAGGED'
  | 'CLEARED'
  | 'REJECTED';

/**
 * Versioned Reward Pool Admin Policy
 * Controls reward pool percentage dynamically. Never hard-coded.
 */
export interface V2RewardPoolPolicy {
  id: string;
  version: number;
  reward_pool_percentage_basis_points: number; // e.g., 2500 = 25.00%, 3000 = 30.00%
  description?: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
  effective_from: string;
  effective_until?: string;
  approved_by: string;
  approved_at: string;
  created_at: string;
}

/**
 * Authoritative Reward Settlement Period
 */
export interface V2RewardSettlementPeriodRecord {
  id: string;
  period_name: string;
  revenue_period_id: string;      // Authoritative link to Phase 4 V2RevenuePeriodRecord
  contribution_period_id: string;  // Authoritative link to Phase 5 Contribution batch/date range
  currency: string;               // ISO 4217, default 'USD'
  status: V2RewardPeriodStatus;

  // Policy Reference
  applied_policy_id: string;
  applied_policy_version: number;
  reward_pool_percentage_basis_points: number;

  // Authoritative Accounting Totals (Integer minor units / cents)
  verified_eligible_net_revenue_cents: number;
  total_reward_pool_cents: number;
  total_allocated_reward_cents: number;
  undistributed_remainder_cents: number; // Auditable remainder cents (must be >= 0)

  // Network Contribution Metrics
  total_network_eligible_cp: number;
  total_eligible_participants: number;

  // Workflow timestamps
  revenue_locked_at?: string;
  contribution_locked_at?: string;
  settled_at?: string;
  finalized_at?: string;
  finalized_by?: string;

  // Idempotency tracking key
  idempotency_key: string; // ${revenue_period_id}:${contribution_period_id}:v${applied_policy_version}

  created_at: string;
  updated_at: string;
}

/**
 * Individual User Reward Allocation Record
 * Conforms to public.v2_reward_allocations schema
 */
export interface V2RewardAllocationRecord {
  id: string;
  period_id: string;              // References V2RewardSettlementPeriodRecord
  revenue_period_id: string;      // Explicit Phase 4 reference
  user_id: string;
  
  // CP metrics
  qualified_points: number;       // User's eligible CP in this period
  total_network_qualified_points: number;
  user_share_ratio: number;       // qualified_points / total_network_qualified_points
  
  // Financial Accounting (Integer Cents)
  reward_pool_cents: number;      // Pool this share was calculated from
  allocated_cents: number;        // Final calculated reward cents
  estimated_reward_cents: number;
  pending_reward_cents: number;
  approved_reward_cents: number;
  withdrawable_balance_cents: number;
  deductions_cents: number;
  deduction_reason?: string;
  currency: string;

  // Lifecycle Stage
  status: V2RewardAllocationStatus;
  risk_review_status: V2RewardRiskStatus;
  policy_version: number;

  // Deterministic audit metadata
  calculation_metadata: {
    formula: string;
    share_bps: number;
    rounding_cents: number;
    settlement_timestamp: string;
    [key: string]: unknown;
  };

  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Execution parameters for initiating a Reward Settlement
 */
export interface V2ExecuteSettlementParams {
  revenue_period_id: string;
  contribution_period_id?: string;
  policy_version?: number;
  actor_id: string;
  actor_role: string;
  auto_advance_stages?: boolean; // If true, advances from PENDING to APPROVED to WITHDRAWABLE
}

/**
 * Settlement Result Returned by the Engine
 */
export interface V2SettlementResult {
  success: boolean;
  is_cached?: boolean; // True if returned due to idempotency
  period?: V2RewardSettlementPeriodRecord;
  allocations_count?: number;
  total_pool_cents?: number;
  total_allocated_cents?: number;
  undistributed_remainder_cents?: number;
  total_eligible_cp?: number;
  error?: string;
}

/**
 * Reward Engine Telemetry & System Health
 */
export interface V2RewardEngineHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'ATTENTION_REQUIRED';
  active_policy_version: number;
  active_reward_pool_percentage_bps: number;
  total_settlement_periods: number;
  finalized_settlement_periods: number;
  total_allocated_reward_cents: number;
  total_undistributed_remainder_cents: number;
  zero_over_allocation_verified: boolean;
  legal_language_compliant: boolean;
}
