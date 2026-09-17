-- =====================================================================
-- METFA V2: DATA MODEL & DATABASE FOUNDATION
-- Migration: 20260912_v2_master_foundation.sql
-- =====================================================================
-- STRICT SAFETY RULES:
-- 1. All V2 foundation migrations are designed for safe rerunnability (IF NOT EXISTS, safe drop triggers/policies on V2 objects).
-- 2. Zero modifications, drops, or alterations to existing public.profiles,
--    public.posts, public.conversations, public.messages, or storage.buckets.
-- 3. All V2 tables follow the prefix convention: public.v2_<module>_<entity>.
-- 4. Financial ledger uses integer minor units (amount_cents BIGINT) - NO floats.
-- 5. RLS is enabled on ALL V2 tables with granular security policies.
-- 6. Voice Post remains strictly in METFA Social; V2 audio tracks are economy/licensing only.
-- =====================================================================

-- =====================================================================
-- 1. ROLE-BASED ACCESS CONTROL (RBAC) & ADMIN ROLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'SUPER_ADMIN',
    'ADMIN',
    'FINANCE_ADMIN',
    'ADS_MANAGER',
    'CONTENT_MANAGER',
    'OPERATOR',
    'DEVELOPER',
    'FREELANCER',
    'REVIEWER',
    'SUPPORT',
    'ANALYST'
  )),
  granted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_v2_user_roles_user_id ON public.v2_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_user_roles_role ON public.v2_user_roles(role);

ALTER TABLE public.v2_user_roles ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if current authenticated user has an administrative role
CREATE OR REPLACE FUNCTION public.v2_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.v2_user_roles
    WHERE user_id = auth.uid()
      AND (role = required_role OR role = 'SUPER_ADMIN')
  );
END;
$$;

-- Helper security function: Check if current user has any admin/operator role
CREATE OR REPLACE FUNCTION public.v2_is_admin_or_operator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.v2_user_roles
    WHERE user_id = auth.uid()
      AND role IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'OPERATOR')
  );
END;
$$;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.v2_user_roles;
CREATE POLICY "Users can view their own roles"
ON public.v2_user_roles FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Only super admins can modify roles" ON public.v2_user_roles;
CREATE POLICY "Only super admins can modify roles"
ON public.v2_user_roles FOR ALL
USING (public.v2_has_role('SUPER_ADMIN'));

-- =====================================================================
-- 2. CENTRALIZED ADMIN POLICIES & FEATURE FLAGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_admin_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_key, version)
);

CREATE INDEX IF NOT EXISTS idx_v2_admin_policies_key_status ON public.v2_admin_policies(policy_key, status);

ALTER TABLE public.v2_admin_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for active policies" ON public.v2_admin_policies;
DROP POLICY IF EXISTS "Authenticated read access for active policies" ON public.v2_admin_policies;
CREATE POLICY "Authenticated read access for active policies"
ON public.v2_admin_policies FOR SELECT
TO authenticated
USING (status = 'ACTIVE' OR public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Only admins can modify policies" ON public.v2_admin_policies;
CREATE POLICY "Only admins can modify policies"
ON public.v2_admin_policies FOR ALL
USING (public.v2_is_admin_or_operator());

-- Configurable Feature Flags
CREATE TABLE IF NOT EXISTS public.v2_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.v2_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read feature flags" ON public.v2_feature_flags;
CREATE POLICY "Anyone can read feature flags"
ON public.v2_feature_flags FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can update feature flags" ON public.v2_feature_flags;
CREATE POLICY "Admins can update feature flags"
ON public.v2_feature_flags FOR ALL
USING (public.v2_is_admin_or_operator());

-- Safe baseline feature flags initialization (all non-disruptive defaults)
INSERT INTO public.v2_feature_flags (key, enabled, description)
VALUES
  ('ads_enabled', false, 'Master toggle for sponsored ad delivery'),
  ('sponsored_feed_enabled', false, 'In-feed native sponsored placements'),
  ('reels_ads_enabled', false, 'Reels interstitial sponsored placements'),
  ('external_ad_providers_enabled', false, 'Permit third-party ad network adapters'),
  ('contribution_enabled', false, 'Qualified contribution scoring pipeline'),
  ('reward_enabled', false, 'Reward pool distribution calculations'),
  ('payout_enabled', false, 'Creator and contributor cash disbursement'),
  ('ai_monetization_enabled', false, 'Commercial AI tooling tiers')
ON CONFLICT (key) DO NOTHING;

-- Canonical 6 Emergency Kill Switches
CREATE TABLE IF NOT EXISTS public.v2_kill_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL CHECK (key IN (
    'ads_paused',
    'rewards_paused',
    'payouts_paused',
    'contribution_paused',
    'external_providers_paused',
    'ai_actions_paused'
  )),
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  target_module TEXT NOT NULL,
  paused_by UUID REFERENCES public.profiles(id),
  paused_role TEXT,
  paused_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_kill_switches_key ON public.v2_kill_switches(key);
ALTER TABLE public.v2_kill_switches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read kill switches" ON public.v2_kill_switches;
CREATE POLICY "Anyone can read kill switches"
ON public.v2_kill_switches FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can update kill switches" ON public.v2_kill_switches;
CREATE POLICY "Admins can update kill switches"
ON public.v2_kill_switches FOR ALL
USING (public.v2_is_admin_or_operator());

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

-- =====================================================================
-- 7. PAYOUT REQUESTS & PAYOUT LEDGER
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payout_method TEXT NOT NULL CHECK (payout_method IN (
    'BANK_TRANSFER', 'BKASH', 'NAGAD', 'STRIPE_CONNECT', 'WISE', 'OTHER'
  )),
  account_details_masked TEXT NOT NULL, -- Never store raw plain-text banking credentials
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
    'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED'
  )),
  kyc_status_ref TEXT NOT NULL DEFAULT 'VERIFIED',
  risk_score INTEGER NOT NULL DEFAULT 0,
  admin_notes TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  transaction_ref TEXT,
  failure_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_payout_requests_user ON public.v2_payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_payout_requests_status ON public.v2_payout_requests(status);

ALTER TABLE public.v2_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payout requests" ON public.v2_payout_requests;
CREATE POLICY "Users can view their own payout requests"
ON public.v2_payout_requests FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Users can insert their own payout requests" ON public.v2_payout_requests;
CREATE POLICY "Users can insert their own payout requests"
ON public.v2_payout_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 8. UNIVERSAL ADS FOUNDATION (PROVIDER-AGNOSTIC)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'BRAND_AWARENESS' CHECK (objective IN (
    'BRAND_AWARENESS', 'TRAFFIC', 'CONVERSIONS', 'VIDEO_VIEWS', 'APP_INSTALLS'
  )),
  total_budget_cents BIGINT NOT NULL DEFAULT 0,
  daily_budget_cents BIGINT NOT NULL DEFAULT 0,
  spent_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  bid_strategy TEXT NOT NULL DEFAULT 'AUTO_CPM' CHECK (bid_strategy IN ('AUTO_CPM', 'MANUAL_CPC', 'TARGET_CPA')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'REJECTED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_ads_campaigns_adv ON public.v2_ads_campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_v2_ads_campaigns_status ON public.v2_ads_campaigns(status);

ALTER TABLE public.v2_ads_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Advertisers can view their own campaigns" ON public.v2_ads_campaigns;
CREATE POLICY "Advertisers can view their own campaigns"
ON public.v2_ads_campaigns FOR SELECT
USING (auth.uid() = advertiser_id OR public.v2_is_admin_or_operator());

CREATE TABLE IF NOT EXISTS public.v2_ads_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.v2_ads_campaigns(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  description TEXT,
  cta_label TEXT NOT NULL DEFAULT 'Learn More',
  destination_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.v2_ads_creatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Advertisers can view their creatives" ON public.v2_ads_creatives;
CREATE POLICY "Advertisers can view their creatives"
ON public.v2_ads_creatives FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.v2_ads_campaigns c
    WHERE c.id = public.v2_ads_creatives.campaign_id AND (c.advertiser_id = auth.uid() OR public.v2_is_admin_or_operator())
  )
);

-- Targeting specifications
CREATE TABLE IF NOT EXISTS public.v2_ads_targeting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID UNIQUE NOT NULL REFERENCES public.v2_ads_campaigns(id) ON DELETE CASCADE,
  countries TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  device_types TEXT[] DEFAULT '{}',
  content_topics TEXT[] DEFAULT '{}',
  min_age INTEGER DEFAULT 18,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.v2_ads_targeting ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Campaign owners can view targeting" ON public.v2_ads_targeting;
CREATE POLICY "Campaign owners can view targeting"
ON public.v2_ads_targeting FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.v2_ads_campaigns c
    WHERE c.id = public.v2_ads_targeting.campaign_id AND (c.advertiser_id = auth.uid() OR public.v2_is_admin_or_operator())
  )
);

-- Provider-Agnostic Ad Event Telemetry
CREATE TABLE IF NOT EXISTS public.v2_ads_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.v2_ads_campaigns(id) ON DELETE SET NULL,
  creative_id UUID REFERENCES public.v2_ads_creatives(id) ON DELETE SET NULL,
  provider_name TEXT NOT NULL DEFAULT 'METFA_INTERNAL',
  event_type TEXT NOT NULL CHECK (event_type IN (
    'REQUEST', 'IMPRESSION', 'VIEW', 'QUALIFIED_VIEW', 'CLICK', 'CONVERSION'
  )),
  placement_type TEXT NOT NULL CHECK (placement_type IN (
    'FEED_NATIVE', 'REEL_INTERSTITIAL', 'BANNER_SLOT', 'REWARDED_VIDEO'
  )),
  revenue_micro_cents BIGINT NOT NULL DEFAULT 0,
  ip_masked TEXT,
  user_agent_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_ads_events_campaign ON public.v2_ads_events(campaign_id, event_type);

ALTER TABLE public.v2_ads_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only authorized operators can read raw ad events" ON public.v2_ads_events;
CREATE POLICY "Only authorized operators can read raw ad events"
ON public.v2_ads_events FOR SELECT
USING (public.v2_is_admin_or_operator());

-- =====================================================================
-- 9. METFA VERIFIED FOUNDATION
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_tier TEXT NOT NULL CHECK (requested_tier IN (
    'INDIVIDUAL_CREATOR', 'BUSINESS', 'PUBLIC_FIGURE', 'BRAND_PAGE', 'ORGANIZATION'
  )),
  legal_full_name TEXT NOT NULL,
  country TEXT NOT NULL,
  id_document_type TEXT NOT NULL CHECK (id_document_type IN (
    'PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', 'BUSINESS_REGISTRATION'
  )),
  id_document_secure_ref TEXT NOT NULL, -- Secure private storage reference (never public)
  portfolio_links TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'NOT_REQUESTED', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED',
    'APPROVED', 'REJECTED', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'APPEAL_REQUESTED'
  )),
  ai_pre_review_notes TEXT,
  risk_review_notes TEXT,
  admin_decision_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_verification_user ON public.v2_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_verification_status ON public.v2_verification_requests(status);

ALTER TABLE public.v2_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own verification requests" ON public.v2_verification_requests;
CREATE POLICY "Users can view their own verification requests"
ON public.v2_verification_requests FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Users can submit their own verification request" ON public.v2_verification_requests;
CREATE POLICY "Users can submit their own verification request"
ON public.v2_verification_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 10. RISK & FRAUD SIGNALS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'VELOCITY_ANOMALY', 'ENGAGEMENT_ANOMALY', 'REPEATED_VIEWS', 'CONTENT_SIMILARITY',
    'REFERRAL_ANOMALY', 'TRANSACTION_ANOMALY', 'NETWORK_ANOMALY', 'DEVICE_ANOMALY',
    'AUDIO_ABUSE', 'PAYOUT_ANOMALY'
  )),
  severity TEXT NOT NULL DEFAULT 'NOTICE' CHECK (severity IN ('INFO', 'NOTICE', 'WARNING', 'HIGH', 'CRITICAL')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  affected_module TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_risk_signals_user ON public.v2_risk_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_risk_signals_severity ON public.v2_risk_signals(severity);

ALTER TABLE public.v2_risk_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only operators can view risk signals" ON public.v2_risk_signals;
CREATE POLICY "Only operators can view risk signals"
ON public.v2_risk_signals FOR SELECT
USING (public.v2_is_admin_or_operator());

-- Canonical Option A: Risk Holds Lifecycle
CREATE TABLE IF NOT EXISTS public.v2_risk_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hold_type TEXT NOT NULL CHECK (hold_type IN ('contribution', 'reward', 'payout')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NOT NULL,
  placed_by UUID REFERENCES public.profiles(id),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_by UUID REFERENCES public.profiles(id),
  lifted_at TIMESTAMPTZ,
  lift_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_risk_holds_user_active ON public.v2_risk_holds(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_v2_risk_holds_type ON public.v2_risk_holds(hold_type);

ALTER TABLE public.v2_risk_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own risk holds" ON public.v2_risk_holds;
CREATE POLICY "Users can view their own risk holds"
ON public.v2_risk_holds FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Operators can modify risk holds" ON public.v2_risk_holds;
CREATE POLICY "Operators can modify risk holds"
ON public.v2_risk_holds FOR ALL
USING (public.v2_is_admin_or_operator());

-- =====================================================================
-- 11. AI HEALTH TELEMETRY (ZERO SECRETS STORED)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_ai_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  health_state TEXT NOT NULL CHECK (health_state IN (
    'HEALTHY', 'DEGRADED', 'MISSING', 'INVALID', 'QUOTA_EXCEEDED',
    'RATE_LIMITED', 'UNAVAILABLE', 'TIMEOUT', 'ERROR', 'RECOVERED', 'UNKNOWN'
  )),
  latency_ms INTEGER NOT NULL DEFAULT 0,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  error_category TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_ai_health_provider_time ON public.v2_ai_health_events(provider, recorded_at DESC);

ALTER TABLE public.v2_ai_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators can view AI health telemetry" ON public.v2_ai_health_events;
CREATE POLICY "Operators can view AI health telemetry"
ON public.v2_ai_health_events FOR SELECT
USING (public.v2_is_admin_or_operator());

-- =====================================================================
-- 12. METFA SIGNAL ENGINE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  why_detected TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'NOTICE', 'WARNING', 'HIGH', 'CRITICAL')),
  affected_module TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis JSONB,
  recommended_action TEXT,
  required_approval TEXT NOT NULL DEFAULT 'operator' CHECK (required_approval IN ('none', 'operator', 'admin', 'superadmin')),
  status TEXT NOT NULL DEFAULT 'DETECTED' CHECK (status IN (
    'DETECTED', 'AI_ANALYZED', 'TASK_CREATED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'RESOLVED', 'DISMISSED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_v2_signals_module_status ON public.v2_signals(affected_module, status);

ALTER TABLE public.v2_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators can view all signals" ON public.v2_signals;
CREATE POLICY "Operators can view all signals"
ON public.v2_signals FOR SELECT
USING (public.v2_is_admin_or_operator());

-- =====================================================================
-- 13. AUDIO ECONOMY & LICENSING (NON-SOCIAL VOICE POST)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_audio_economy_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL CHECK (license_type IN (
    'CREATIVE_COMMONS_BY', 'PLATFORM_FREE_USE', 'COMMERCIAL_REV_SHARE', 'EXCLUSIVE_CREATOR'
  )),
  creator_revenue_split_percentage NUMERIC(5,2) NOT NULL CHECK (
    creator_revenue_split_percentage >= 0.00
    AND creator_revenue_split_percentage <= 100.00
  ),
  total_usages_in_reels INTEGER NOT NULL DEFAULT 0,
  total_usages_in_videos INTEGER NOT NULL DEFAULT 0,
  total_qualified_plays BIGINT NOT NULL DEFAULT 0,
  generated_ad_pool_revenue_cents BIGINT NOT NULL DEFAULT 0,
  copyright_claim_status TEXT NOT NULL DEFAULT 'CLEAN' CHECK (copyright_claim_status IN (
    'CLEAN', 'FLAGGED', 'DISPUTED', 'DMCA_TAKEDOWN'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_audio_owner ON public.v2_audio_economy_tracks(owner_user_id);

ALTER TABLE public.v2_audio_economy_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view audio catalog tracks" ON public.v2_audio_economy_tracks;
CREATE POLICY "Public can view audio catalog tracks"
ON public.v2_audio_economy_tracks FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Owners can update their audio tracks" ON public.v2_audio_economy_tracks;
CREATE POLICY "Owners can update their audio tracks"
ON public.v2_audio_economy_tracks FOR UPDATE
USING (auth.uid() = owner_user_id OR public.v2_is_admin_or_operator());

-- Protect financial, accounting, and licensing authority fields on audio tracks
CREATE OR REPLACE FUNCTION public.v2_protect_audio_track_accounting()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Privileged admin or operator can perform administrative updates
  IF public.v2_is_admin_or_operator() THEN
    RETURN NEW;
  END IF;

  -- Client-owner updates cannot modify accounting or licensing authority fields
  IF NEW.creator_revenue_split_percentage IS DISTINCT FROM OLD.creator_revenue_split_percentage
     OR NEW.total_usages_in_reels IS DISTINCT FROM OLD.total_usages_in_reels
     OR NEW.total_usages_in_videos IS DISTINCT FROM OLD.total_usages_in_videos
     OR NEW.total_qualified_plays IS DISTINCT FROM OLD.total_qualified_plays
     OR NEW.generated_ad_pool_revenue_cents IS DISTINCT FROM OLD.generated_ad_pool_revenue_cents
     OR NEW.copyright_claim_status IS DISTINCT FROM OLD.copyright_claim_status
     OR NEW.license_type IS DISTINCT FROM OLD.license_type
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Track owners can only update editable metadata (title, artist_name). Financial and accounting fields are protected.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_v2_protect_audio_track_accounting ON public.v2_audio_economy_tracks;
CREATE TRIGGER trg_v2_protect_audio_track_accounting
BEFORE UPDATE ON public.v2_audio_economy_tracks
FOR EACH ROW
EXECUTE FUNCTION public.v2_protect_audio_track_accounting();

-- =====================================================================
-- 14. IMMUTABLE AUDIT LOG & COMPLIANCE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'FINANCIAL_SETTLEMENT', 'PAYOUT_APPROVAL', 'REWARD_POLICY_CHANGE',
    'VERIFICATION_GRANTED', 'VERIFICATION_REVOKED', 'RISK_RULE_MODIFIED',
    'ADMIN_ACCESS_CHANGED', 'SIGNAL_DISMISSAL', 'SYSTEM_MAINTENANCE'
  )),
  actor_id UUID REFERENCES public.profiles(id),
  actor_role TEXT NOT NULL DEFAULT 'USER',
  target_entity_id TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  previous_state_masked JSONB,
  new_state_masked JSONB NOT NULL,
  ip_address_masked TEXT,
  reason_notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_audit_logs_target ON public.v2_audit_logs(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_v2_audit_logs_timestamp ON public.v2_audit_logs(timestamp DESC);

ALTER TABLE public.v2_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs are append-only. Only admins can read, nobody can update or delete.
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.v2_audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.v2_audit_logs FOR SELECT
USING (public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Disallow audit log update or delete" ON public.v2_audit_logs;
CREATE POLICY "Disallow audit log update or delete"
ON public.v2_audit_logs FOR UPDATE
USING (false);

-- =====================================================================
-- DATABASE-LEVEL LEDGER IMMUTABILITY ENFORCEMENT
-- =====================================================================

CREATE OR REPLACE FUNCTION public.v2_prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger records are strictly immutable and cannot be updated or deleted from %', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_v2_revenue_ledger_immutable ON public.v2_revenue_ledger;
CREATE TRIGGER trg_v2_revenue_ledger_immutable
BEFORE UPDATE OR DELETE ON public.v2_revenue_ledger
FOR EACH ROW
EXECUTE FUNCTION public.v2_prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_v2_contribution_ledger_immutable ON public.v2_contribution_ledger;
CREATE TRIGGER trg_v2_contribution_ledger_immutable
BEFORE UPDATE OR DELETE ON public.v2_contribution_ledger
FOR EACH ROW
EXECUTE FUNCTION public.v2_prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_v2_wallet_ledger_immutable ON public.v2_wallet_ledger;
CREATE TRIGGER trg_v2_wallet_ledger_immutable
BEFORE UPDATE OR DELETE ON public.v2_wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.v2_prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_v2_audit_logs_immutable ON public.v2_audit_logs;
CREATE TRIGGER trg_v2_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.v2_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.v2_prevent_ledger_mutation();

-- =====================================================================
-- 15. PRIVATE STORAGE BUCKETS CONFIGURATION FOR V2
-- =====================================================================

-- Verification documents bucket (Strictly PRIVATE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('v2-verification-private', 'v2-verification-private', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "v2_verification_users_upload" ON storage.objects;
CREATE POLICY "v2_verification_users_upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'v2-verification-private'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "v2_verification_users_and_admins_view" ON storage.objects;
CREATE POLICY "v2_verification_users_and_admins_view" ON storage.objects
FOR SELECT USING (
  bucket_id = 'v2-verification-private'
  AND auth.uid() IS NOT NULL
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.v2_is_admin_or_operator())
);

-- =====================================================================
-- 16. TARGETED SERVICE-ROLE DATABASE PRIVILEGES
-- =====================================================================

GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.v2_user_roles,
  public.v2_admin_policies,
  public.v2_feature_flags,
  public.v2_kill_switches,
  public.v2_approval_items,
  public.v2_audit_logs,
  public.v2_revenue_periods,
  public.v2_revenue_ledger,
  public.v2_contribution_policies,
  public.v2_contribution_ledger,
  public.v2_reward_settlements,
  public.v2_reward_allocations,
  public.v2_wallet_accounts,
  public.v2_wallet_ledger,
  public.v2_payout_requests,
  public.v2_ads_campaigns,
  public.v2_ads_creatives,
  public.v2_ads_targeting,
  public.v2_ads_events,
  public.v2_verification_requests,
  public.v2_risk_signals,
  public.v2_risk_holds,
  public.v2_ai_health_events,
  public.v2_signals,
  public.v2_audio_economy_tracks
TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- End of METFA V2 Master Database Foundation
