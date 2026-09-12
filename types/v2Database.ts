/**
 * METFA V2 — Supabase Service Contract Interfaces
 *
 * Types and query helper signatures matching the database foundation:
 * - v2_revenue_periods & v2_revenue_ledger
 * - v2_contribution_policies & v2_contribution_ledger
 * - v2_reward_allocations
 * - v2_wallet_accounts & v2_wallet_ledger
 * - v2_payout_requests
 * - v2_ads_campaigns, creatives, events
 * - v2_verification_requests
 * - v2_risk_signals
 * - v2_ai_health_events
 * - v2_signals, v2_projects, v2_tasks
 * - v2_audio_economy_tracks
 * - v2_audit_logs & v2_feature_flags
 *
 * All financial fields map to BIGINT integer cents (amount_cents).
 * No business logic is implemented in this contract layer.
 */

import {
  V2ModuleId,
  AiHealthState,
  SignalSeverity,
  SignalStatus,
  TaskPriority,
  TaskStatus,
  VerificationTier,
  PayoutStatus,
} from './v2';

export interface V2DbAdminPolicy {
  id: string;
  policy_key: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
  configuration: Record<string, unknown>;
  description?: string;
  effective_from: string;
  effective_until?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface V2DbFeatureFlag {
  key: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  description?: string;
  effective_from: string;
  effective_until?: string;
  updated_by?: string;
  updated_at: string;
}

export interface V2DbRevenuePeriod {
  id: string;
  period_name: string;
  period_start: string;
  period_end: string;
  gross_revenue_cents: number;
  refunds_cents: number;
  payment_fees_cents: number;
  taxes_cents: number;
  eligible_costs_cents: number;
  eligible_net_revenue_cents: number;
  applied_policy_version?: number;
  reward_pool_cents: number;
  currency: string;
  status: 'OPEN' | 'CALCULATING' | 'AUDIT_REVIEW' | 'FINALIZED' | 'DISBURSED';
  finalized_at?: string;
  finalized_by?: string;
  created_at: string;
  updated_at: string;
}

export interface V2DbRevenueLedgerEntry {
  id: string;
  period_id?: string;
  source: 'ADS' | 'AI' | 'MARKETPLACE' | 'SUBSCRIPTION' | 'GIFTS' | 'PROMOTION' | 'BUSINESS_SERVICES' | 'AUDIO_LICENSE' | 'OTHER';
  entry_type: 'GROSS_INCOME' | 'REFUND' | 'PROCESSING_FEE' | 'TAX_WITHHOLDING' | 'COST_DEDUCTION' | 'SETTLEMENT_ALLOCATION';
  amount_cents: number;
  currency: string;
  reference_id?: string;
  metadata: Record<string, unknown>;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
}

export interface V2DbContributionPolicy {
  id: string;
  action: string;
  base_points: number;
  quality_multiplier_max: number;
  daily_limit_points: number;
  cooldown_seconds: number;
  eligibility_tier_required: string;
  fraud_weight: number;
  configuration: Record<string, unknown>;
  status: 'ACTIVE' | 'PAUSED' | 'DEPRECATED';
  effective_from: string;
  effective_until?: string;
  created_at: string;
}

export interface V2DbContributionLedgerEntry {
  id: string;
  user_id: string;
  action: string;
  policy_id?: string;
  base_points: number;
  quality_multiplier: number;
  final_points: number;
  source_ref?: string;
  risk_score: number;
  status: 'RECORDED' | 'QUALIFIED' | 'FLAGGED_RISK' | 'SETTLED' | 'DISCARDED';
  period_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface V2DbRewardAllocation {
  id: string;
  period_id: string;
  user_id: string;
  qualified_points: number;
  estimated_reward_cents: number;
  pending_reward_cents: number;
  approved_reward_cents: number;
  withdrawable_balance_cents: number;
  deductions_cents: number;
  deduction_reason?: string;
  currency: string;
  status: 'ESTIMATED' | 'PENDING' | 'APPROVED' | 'WITHDRAWABLE' | 'PAID' | 'REVOKED';
  risk_review_status: 'CLEAN' | 'FLAGGED' | 'CLEARED' | 'REJECTED';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface V2DbWalletAccount {
  id: string;
  user_id: string;
  currency: string;
  available_balance_cents: number;
  pending_balance_cents: number;
  locked_balance_cents: number;
  lifetime_earnings_cents: number;
  lifetime_payouts_cents: number;
  is_locked_for_audit: boolean;
  lock_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface V2DbWalletLedgerEntry {
  id: string;
  wallet_id: string;
  user_id: string;
  entry_type: 'REWARD_CREDIT' | 'PAYOUT_DEBIT' | 'AUDIT_ADJUSTMENT' | 'BONUS_CREDIT' | 'REVERSAL_DEBIT';
  amount_cents: number;
  currency: string;
  balance_after_cents: number;
  reference_id?: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface V2DbPayoutRequest {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  payout_method: 'BANK_TRANSFER' | 'BKASH' | 'NAGAD' | 'STRIPE_CONNECT' | 'WISE' | 'OTHER';
  account_details_masked: string;
  status: PayoutStatus;
  kyc_status_ref: string;
  risk_score: number;
  admin_notes?: string;
  approved_by?: string;
  approved_at?: string;
  transaction_ref?: string;
  failure_reason?: string;
  requested_at: string;
  processed_at?: string;
  updated_at: string;
}

export interface V2DbVerificationRequest {
  id: string;
  user_id: string;
  requested_tier: VerificationTier | string;
  legal_full_name: string;
  country: string;
  id_document_type: string;
  id_document_secure_ref: string;
  portfolio_links: string[];
  status: string;
  ai_pre_review_notes?: string;
  risk_review_notes?: string;
  admin_decision_notes?: string;
  reviewed_by?: string;
  submitted_at: string;
  reviewed_at?: string;
  updated_at: string;
}

export interface V2DbRiskSignal {
  id: string;
  user_id?: string;
  signal_type: string;
  severity: SignalSeverity;
  risk_score: number;
  affected_module: string;
  evidence: Record<string, unknown>;
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

export interface V2DbAiHealthEvent {
  id: string;
  provider: string;
  model: string;
  health_state: AiHealthState;
  latency_ms: number;
  is_fallback: boolean;
  error_category?: string;
  consecutive_failures: number;
  recorded_at: string;
}

export interface V2DbSignal {
  id: string;
  title: string;
  why_detected: string;
  severity: SignalSeverity;
  affected_module: V2ModuleId | string;
  evidence: Record<string, unknown>;
  ai_analysis?: Record<string, unknown>;
  recommended_action?: string;
  required_approval: 'none' | 'operator' | 'admin' | 'superadmin';
  status: SignalStatus;
  linked_task_id?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export interface V2DbTask {
  id: string;
  project_id?: string;
  source_signal_id?: string;
  affected_module: string;
  title: string;
  description: string;
  ai_brief?: Record<string, unknown>;
  requirements: string[];
  do_not_change_constraints: string[];
  deliverables: unknown[];
  acceptance_criteria: string[];
  test_requirements: string[];
  priority: TaskPriority;
  deadline?: string;
  assigned_to?: string;
  created_by?: string;
  status: TaskStatus;
  ai_review?: Record<string, unknown>;
  admin_approval?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface V2DbAuditLog {
  id: string;
  category: string;
  actor_id?: string;
  actor_role: string;
  target_entity_id: string;
  target_entity_type: string;
  previous_state_masked?: Record<string, unknown>;
  new_state_masked: Record<string, unknown>;
  ip_address_masked?: string;
  reason_notes?: string;
  timestamp: string;
}
