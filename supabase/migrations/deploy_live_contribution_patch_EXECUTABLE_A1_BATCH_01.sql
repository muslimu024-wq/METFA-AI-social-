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
