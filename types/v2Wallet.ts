/**
 * METFA V2 — Wallet & Immutable Wallet Ledger Types (Phase 7)
 * 
 * CORE MANDATES:
 * 1. Authoritative source is the append-only immutable wallet ledger.
 *    NEVER use mutable balance-only architecture (e.g. balance = balance + amount).
 * 2. Integer minor-unit accounting only (amount_cents BIGINT). Never floating point.
 * 3. Conceptual states: PENDING, APPROVED, WITHDRAWABLE, LOCKED, PAID/SETTLED.
 * 4. Reward -> Wallet boundary: Credits originate strictly from finalized/approved reward allocations.
 * 5. Reversals create new entries; historical records remain immutable.
 * 6. Idempotency enforced on all operations with deterministic keys.
 * 7. Double-entry / accounting safety: zero negative balances, currency consistency, reconciliation.
 * 8. Payout boundary: Prepares holds/debits for future Payout Engine; no real external transfers.
 * 9. AI barrier: AI may analyze and recommend, but cannot mutate or authorize financial ledger entries.
 */

export type V2WalletFundState =
  | 'PENDING'
  | 'APPROVED'
  | 'WITHDRAWABLE'
  | 'LOCKED'
  | 'PAID'
  | 'SETTLED';

export type V2WalletLedgerEntryType =
  | 'REWARD_CREDIT'
  | 'REWARD_APPROVAL'
  | 'WITHDRAWABLE_RELEASE'
  | 'PAYOUT_HOLD'
  | 'PAYOUT_DEBIT'
  | 'PAYOUT_RELEASE'
  | 'REVERSAL'
  | 'ADJUSTMENT'
  | 'REFUND'
  | 'ADMIN_CORRECTION';

export type V2WalletDirection =
  | 'CREDIT'   // Inflow of funds
  | 'DEBIT'    // Outflow of funds
  | 'HOLD'     // Transfer to restricted/escrow hold
  | 'RELEASE'; // Release of held/approved funds

export type V2WalletSourceType =
  | 'REWARD_ALLOCATION'
  | 'PAYOUT_REQUEST'
  | 'ADMIN_ADJUSTMENT'
  | 'REVERSAL';

/**
 * Wallet Account Model
 * Aligned with public.v2_wallet_accounts database schema.
 * Balances are derived and cached from the ledger.
 */
export interface V2WalletAccount {
  id: string;
  user_id: string;
  currency: string; // Default 'USD'
  available_balance_cents: number;  // Withdrawable balance in integer minor units
  pending_balance_cents: number;    // Unreleased / pending reward funds
  approved_balance_cents: number;   // Approved funds awaiting release window
  locked_balance_cents: number;     // Funds reserved for active payout holds or compliance review
  lifetime_earnings_cents: number;  // Cumulative historical earnings in minor units
  lifetime_payouts_cents: number;   // Cumulative historical debits/payouts in minor units
  is_locked_for_audit: boolean;
  lock_reason?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Immutable Wallet Ledger Entry Model
 * Aligned with public.v2_wallet_ledger database schema.
 * Append-only. Never updated or deleted.
 */
export interface V2WalletLedgerEntry {
  id: string;
  wallet_id: string;
  user_id: string;
  entry_type: V2WalletLedgerEntryType;
  amount_cents: number;            // Strictly positive integer minor units
  currency: string;
  direction: V2WalletDirection;
  source_type: V2WalletSourceType;
  source_id: string;               // e.g. allocation ID or payout request ID
  idempotency_key: string;         // Deterministic idempotency key
  status: 'POSTED' | 'HELD' | 'REVERSED';
  balance_after_cents: number;     // Available balance snapshot after posting
  reference_id?: string;           // Points to original entry for reversals/releases
  description: string;
  actor_id?: string;
  actor_role?: string;
  metadata: {
    origin?: string;
    period_id?: string;
    policy_version?: number;
    reason?: string;
    actor_id?: string;
    actor_role?: string;
    [key: string]: unknown;
  };
  created_by?: string;
  created_by_role?: string;
  created_at: string;
}

/**
 * Parameters for crediting wallet from Reward Engine
 */
export interface V2CreditFromRewardParams {
  allocation_id: string;
  actor_id: string;
  actor_role: string;
  auto_release?: boolean; // If true, releases directly to WITHDRAWABLE
}

/**
 * Parameters for holding funds for Payout Engine compatibility
 */
export interface V2HoldForPayoutParams {
  payout_request_id: string;
  user_id: string;
  amount_cents: number;
  currency?: string;
  actor_id: string;
  actor_role: string;
  description?: string;
}

/**
 * Parameters for debiting held funds upon payout completion
 */
export interface V2DebitPayoutParams {
  payout_request_id: string;
  user_id: string;
  actor_id: string;
  actor_role: string;
}

/**
 * Parameters for releasing a payout hold if cancelled/rejected
 */
export interface V2ReleasePayoutHoldParams {
  payout_request_id: string;
  user_id: string;
  reason: string;
  actor_id: string;
  actor_role: string;
}

/**
 * Parameters for reversing an existing ledger entry
 */
export interface V2ReverseLedgerEntryParams {
  ledger_entry_id: string;
  reason: string;
  actor_id: string;
  actor_role: string;
}

/**
 * Parameters for creating an authorized administrative adjustment
 */
export interface V2AdminCorrectionParams {
  wallet_id: string;
  user_id: string;
  amount_cents: number;
  direction: 'CREDIT' | 'DEBIT';
  reason: string;
  actor_id: string;
  actor_role: string;
}

/**
 * Result of a deterministic wallet reconciliation run
 */
export interface V2WalletReconciliationResult {
  wallet_id: string;
  user_id: string;
  currency: string;
  is_reconciled: boolean;
  replayed_ledger_entries_count: number;
  
  // Ledger-derived calculations
  ledger_total_credits_cents: number;
  ledger_total_debits_cents: number;
  ledger_total_held_cents: number;
  ledger_derived_available_cents: number;
  ledger_derived_pending_cents: number;
  ledger_derived_approved_cents: number;
  ledger_derived_locked_cents: number;
  ledger_derived_lifetime_earnings_cents: number;
  ledger_derived_lifetime_payouts_cents: number;

  // Account table cached snapshots
  account_available_balance_cents: number;
  account_pending_balance_cents: number;
  account_approved_balance_cents: number;
  account_locked_balance_cents: number;

  // Invariant validation
  discrepancies: string[];
  reconciled_at: string;
}

/**
 * Wallet Engine Telemetry & System Health
 */
export interface V2WalletEngineHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'ATTENTION_REQUIRED';
  total_wallets: number;
  total_ledger_entries: number;
  total_withdrawable_cents: number;
  total_pending_cents: number;
  total_locked_cents: number;
  total_lifetime_earnings_cents: number;
  reconciliation_clean_count: number;
  reconciliation_issue_count: number;
  ledger_immutability_verified: boolean;
  zero_negative_balance_verified: boolean;
  double_entry_safety_verified: boolean;
}
