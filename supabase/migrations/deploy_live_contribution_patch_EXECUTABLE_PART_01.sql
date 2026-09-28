-- =====================================================================
-- METFA SOCIAL: LIVE CONSOLIDATED DEPLOYMENT SCRIPT
-- Target Project: vrkyqbjlyjjdydxrjskh
-- Contains:
-- 1. 20260912 Master Foundation (Remainder: lines 204 to 1037)
-- 2. 20260925 Contribution Ingest Foundation & v2_ingest_contribution RPC
-- =====================================================================

-- >>> SECTION 1: MASTER FOUNDATION (REMAINDER) <<<
-- Canonical Multi-Party Approval Items
CREATE TABLE IF NOT EXISTS public.v2_approval_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'PAYOUT_REQUEST',
    'FINANCIAL_RECONCILIATION',
    'RISK_APPEAL',
    'KYC_TIER2',
    'HIGH_VALUE_TRANSACTION',
    'POLICY_MODIFICATION',
    'KILL_SWITCH_OVERRIDE'
  )),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  requester_id UUID REFERENCES public.profiles(id),
  affected_entity_id TEXT NOT NULL,
  amount_cents BIGINT,
  currency TEXT DEFAULT 'USD',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  required_roles TEXT[] NOT NULL DEFAULT '{}'::text[],
  ai_analysis JSONB,
  decision_notes TEXT,
  decided_by UUID REFERENCES public.profiles(id),
  decided_by_role TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_approval_items_status ON public.v2_approval_items(status);
CREATE INDEX IF NOT EXISTS idx_v2_approval_items_category ON public.v2_approval_items(category);
ALTER TABLE public.v2_approval_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators can view approval items" ON public.v2_approval_items;
CREATE POLICY "Operators can view approval items"
ON public.v2_approval_items FOR SELECT
USING (public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Operators can update approval items" ON public.v2_approval_items;
CREATE POLICY "Operators can update approval items"
ON public.v2_approval_items FOR UPDATE
USING (public.v2_is_admin_or_operator());

-- =====================================================================
-- 3. REVENUE FOUNDATION & IMMUTABLE REVENUE LEDGER
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_revenue_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL, -- e.g. '2026-Q3', '2026-09'
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  gross_revenue_cents BIGINT NOT NULL DEFAULT 0,
  refunds_cents BIGINT NOT NULL DEFAULT 0,
  payment_fees_cents BIGINT NOT NULL DEFAULT 0,
  taxes_cents BIGINT NOT NULL DEFAULT 0,
  eligible_costs_cents BIGINT NOT NULL DEFAULT 0,
  eligible_net_revenue_cents BIGINT NOT NULL DEFAULT 0,
  applied_policy_version INTEGER,
  reward_pool_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CALCULATING', 'AUDIT_REVIEW', 'FINALIZED', 'DISBURSED')),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_revenue_periods_dates ON public.v2_revenue_periods(period_start, period_end);

ALTER TABLE public.v2_revenue_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Revenue periods viewable by authorized operators" ON public.v2_revenue_periods;
CREATE POLICY "Revenue periods viewable by authorized operators"
ON public.v2_revenue_periods FOR SELECT
USING (public.v2_is_admin_or_operator());

-- Append-Only Immutable Revenue Ledger
CREATE TABLE IF NOT EXISTS public.v2_revenue_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES public.v2_revenue_periods(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN (
    'ADS', 'AI', 'MARKETPLACE', 'SUBSCRIPTION', 'GIFTS', 'PROMOTION', 'BUSINESS_SERVICES', 'AUDIO_LICENSE', 'OTHER'
  )),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'GROSS_INCOME', 'REFUND', 'PROCESSING_FEE', 'TAX_WITHHOLDING', 'COST_DEDUCTION', 'SETTLEMENT_ALLOCATION'
  )),
  amount_cents BIGINT NOT NULL, -- Positive for gross, negative/deduction for fees/refunds
  currency TEXT NOT NULL DEFAULT 'USD',
  reference_id TEXT, -- External invoice/transaction ID
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_revenue_ledger_period ON public.v2_revenue_ledger(period_id);
CREATE INDEX IF NOT EXISTS idx_v2_revenue_ledger_source ON public.v2_revenue_ledger(source);

ALTER TABLE public.v2_revenue_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only finance admins can view revenue ledger" ON public.v2_revenue_ledger;
CREATE POLICY "Only finance admins can view revenue ledger"
ON public.v2_revenue_ledger FOR SELECT
USING (public.v2_has_role('FINANCE_ADMIN') OR public.v2_has_role('SUPER_ADMIN'));

-- =====================================================================
-- 4. CONTRIBUTION POLICIES & CONTRIBUTION LEDGER
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_contribution_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  base_points INTEGER NOT NULL DEFAULT 10,
  quality_multiplier_max NUMERIC(3,2) NOT NULL DEFAULT 2.00,
  daily_limit_points INTEGER NOT NULL DEFAULT 500,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  eligibility_tier_required TEXT NOT NULL DEFAULT 'STANDARD',
  fraud_weight NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'DEPRECATED')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.v2_contribution_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read of active contribution policies" ON public.v2_contribution_policies;
CREATE POLICY "Public read of active contribution policies"
ON public.v2_contribution_policies FOR SELECT
USING (true);

-- Immutable Append-Only Contribution Ledger
CREATE TABLE IF NOT EXISTS public.v2_contribution_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  policy_id UUID REFERENCES public.v2_contribution_policies(id),
  base_points INTEGER NOT NULL,
  quality_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  final_points INTEGER NOT NULL,
  source_ref TEXT, -- e.g. 'post:uuid', 'reel:uuid', 'audio_listen:uuid'
  risk_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RECORDED' CHECK (status IN ('RECORDED', 'QUALIFIED', 'FLAGGED_RISK', 'SETTLED', 'DISCARDED')),
  revenue_period_id UUID REFERENCES public.v2_revenue_periods(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_contribution_user ON public.v2_contribution_ledger(user_id);
DROP INDEX IF EXISTS public.idx_v2_contribution_period;
CREATE INDEX IF NOT EXISTS idx_v2_contribution_revenue_period ON public.v2_contribution_ledger(revenue_period_id);
CREATE INDEX IF NOT EXISTS idx_v2_contribution_status ON public.v2_contribution_ledger(status);

ALTER TABLE public.v2_contribution_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own contributions" ON public.v2_contribution_ledger;
CREATE POLICY "Users can view their own contributions"
ON public.v2_contribution_ledger FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

-- =====================================================================
-- 5. REWARD SETTLEMENTS & REWARD ALLOCATIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_reward_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL,
  revenue_period_id UUID NOT NULL REFERENCES public.v2_revenue_periods(id) ON DELETE RESTRICT,
  contribution_period_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'CALCULATING', 'SETTLED', 'FINALIZED', 'CANCELLED'
  )),
  applied_policy_id UUID REFERENCES public.v2_admin_policies(id),
  applied_policy_version INTEGER NOT NULL DEFAULT 1,
  reward_pool_percentage_basis_points INTEGER NOT NULL DEFAULT 0,
  verified_eligible_net_revenue_cents BIGINT NOT NULL DEFAULT 0,
  total_reward_pool_cents BIGINT NOT NULL DEFAULT 0,
  total_allocated_reward_cents BIGINT NOT NULL DEFAULT 0,
  undistributed_remainder_cents BIGINT NOT NULL DEFAULT 0,
  total_network_eligible_cp BIGINT NOT NULL DEFAULT 0,
  total_eligible_participants INTEGER NOT NULL DEFAULT 0,
  revenue_locked_at TIMESTAMPTZ,
  contribution_locked_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES public.profiles(id),
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_reward_settlements_rev_period ON public.v2_reward_settlements(revenue_period_id);
CREATE INDEX IF NOT EXISTS idx_v2_reward_settlements_status ON public.v2_reward_settlements(status);

ALTER TABLE public.v2_reward_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized operators can view reward settlements" ON public.v2_reward_settlements;
CREATE POLICY "Authorized operators can view reward settlements"
ON public.v2_reward_settlements FOR SELECT
USING (public.v2_is_admin_or_operator());

CREATE TABLE IF NOT EXISTS public.v2_reward_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.v2_reward_settlements(id) ON DELETE CASCADE,
  revenue_period_id UUID NOT NULL REFERENCES public.v2_revenue_periods(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  qualified_points INTEGER NOT NULL DEFAULT 0,
  total_network_qualified_points BIGINT NOT NULL DEFAULT 0,
  user_share_ratio NUMERIC(10,8) NOT NULL DEFAULT 0,
  reward_pool_cents BIGINT NOT NULL DEFAULT 0,
  allocated_cents BIGINT NOT NULL DEFAULT 0,
  estimated_reward_cents BIGINT NOT NULL DEFAULT 0,
  pending_reward_cents BIGINT NOT NULL DEFAULT 0,
  approved_reward_cents BIGINT NOT NULL DEFAULT 0,
  withdrawable_balance_cents BIGINT NOT NULL DEFAULT 0,
  deductions_cents BIGINT NOT NULL DEFAULT 0,
  deduction_reason TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'ESTIMATED' CHECK (status IN (
    'ESTIMATED', 'PENDING', 'APPROVED', 'WITHDRAWABLE', 'PAID', 'REVOKED'
  )),
  risk_review_status TEXT NOT NULL DEFAULT 'CLEAN' CHECK (risk_review_status IN ('CLEAN', 'FLAGGED', 'CLEARED', 'REJECTED')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_v2_reward_allocations_settlement_user UNIQUE (settlement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_v2_reward_allocations_settlement ON public.v2_reward_allocations(settlement_id);
CREATE INDEX IF NOT EXISTS idx_v2_reward_allocations_rev_period ON public.v2_reward_allocations(revenue_period_id);
CREATE INDEX IF NOT EXISTS idx_v2_reward_allocations_user ON public.v2_reward_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_reward_allocations_status ON public.v2_reward_allocations(status);

ALTER TABLE public.v2_reward_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reward allocations" ON public.v2_reward_allocations;
CREATE POLICY "Users can view their own reward allocations"
ON public.v2_reward_allocations FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

-- =====================================================================
-- 6. WALLET ACCOUNTS & WALLET LEDGER
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD',
  available_balance_cents BIGINT NOT NULL DEFAULT 0,
  pending_balance_cents BIGINT NOT NULL DEFAULT 0,
  locked_balance_cents BIGINT NOT NULL DEFAULT 0,
  lifetime_earnings_cents BIGINT NOT NULL DEFAULT 0,
  lifetime_payouts_cents BIGINT NOT NULL DEFAULT 0,
  is_locked_for_audit BOOLEAN NOT NULL DEFAULT false,
  lock_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_wallet_user_id ON public.v2_wallet_accounts(user_id);

ALTER TABLE public.v2_wallet_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wallet account" ON public.v2_wallet_accounts;
CREATE POLICY "Users can view their own wallet account"
ON public.v2_wallet_accounts FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

-- Append-Only Wallet Ledger (Double-entry audit trail)
CREATE TABLE IF NOT EXISTS public.v2_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.v2_wallet_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'REWARD_CREDIT', 'PAYOUT_DEBIT', 'AUDIT_ADJUSTMENT', 'BONUS_CREDIT', 'REVERSAL_DEBIT'
  )),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance_after_cents BIGINT NOT NULL,
  reference_id TEXT, -- e.g. allocation ID or payout request ID
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_wallet_ledger_user ON public.v2_wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_wallet_ledger_wallet ON public.v2_wallet_ledger(wallet_id);

ALTER TABLE public.v2_wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wallet ledger" ON public.v2_wallet_ledger;
CREATE POLICY "Users can view their own wallet ledger"
ON public.v2_wallet_ledger FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());
