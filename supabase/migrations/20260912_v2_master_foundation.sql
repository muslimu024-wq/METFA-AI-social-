-- =====================================================================
-- METFA V2: DATA MODEL & DATABASE FOUNDATION
-- Migration: 20260912_v2_master_foundation.sql
-- =====================================================================
-- STRICT SAFETY RULES:
-- 1. All migrations are 100% idempotent (IF NOT EXISTS, safe drop triggers/policies).
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
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper security function: Check if current user has any admin/operator role
CREATE OR REPLACE FUNCTION public.v2_is_admin_or_operator()
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
CREATE POLICY "Public read access for active policies"
ON public.v2_admin_policies FOR SELECT
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
  period_id UUID REFERENCES public.v2_revenue_periods(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_contribution_user ON public.v2_contribution_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_contribution_period ON public.v2_contribution_ledger(period_id);
CREATE INDEX IF NOT EXISTS idx_v2_contribution_status ON public.v2_contribution_ledger(status);

ALTER TABLE public.v2_contribution_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own contributions" ON public.v2_contribution_ledger;
CREATE POLICY "Users can view their own contributions"
ON public.v2_contribution_ledger FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

-- =====================================================================
-- 5. REWARD PERIODS, ALLOCATIONS & REWARD LEDGER
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_reward_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.v2_revenue_periods(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  qualified_points INTEGER NOT NULL DEFAULT 0,
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
  UNIQUE (period_id, user_id)
);

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
-- 12. METFA SIGNAL & WORK / TASK ENGINE
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
  linked_task_id UUID,
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

-- Work Center Projects
CREATE TABLE IF NOT EXISTS public.v2_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lead_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.v2_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized members can view projects" ON public.v2_projects;
CREATE POLICY "Authorized members can view projects"
ON public.v2_projects FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Work Center Tasks
CREATE TABLE IF NOT EXISTS public.v2_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.v2_projects(id) ON DELETE SET NULL,
  source_signal_id UUID REFERENCES public.v2_signals(id) ON DELETE SET NULL,
  affected_module TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ai_brief JSONB,
  requirements TEXT[] DEFAULT '{}',
  do_not_change_constraints TEXT[] DEFAULT '{}',
  deliverables JSONB DEFAULT '[]'::jsonb,
  acceptance_criteria TEXT[] DEFAULT '{}',
  test_requirements TEXT[] DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  deadline TIMESTAMPTZ,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'AI_REVIEWED', 'ADMIN_APPROVED', 'COMPLETED', 'CANCELLED'
  )),
  ai_review JSONB,
  admin_approval JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_tasks_assigned_to ON public.v2_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_v2_tasks_status ON public.v2_tasks(status);

ALTER TABLE public.v2_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assigned users and operators can view tasks" ON public.v2_tasks;
CREATE POLICY "Assigned users and operators can view tasks"
ON public.v2_tasks FOR SELECT
USING (auth.uid() = assigned_to OR public.v2_is_admin_or_operator());

-- Task Deliverables & Attachments
CREATE TABLE IF NOT EXISTS public.v2_task_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.v2_tasks(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  file_url TEXT NOT NULL,
  checksum_hash TEXT,
  notes TEXT,
  review_status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (review_status IN ('SUBMITTED', 'ACCEPTED', 'REVISION_REQUESTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.v2_task_deliverables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task participants can view deliverables" ON public.v2_task_deliverables;
CREATE POLICY "Task participants can view deliverables"
ON public.v2_task_deliverables FOR SELECT
USING (
  submitted_by = auth.uid() OR
  public.v2_is_admin_or_operator() OR
  EXISTS (SELECT 1 FROM public.v2_tasks t WHERE t.id = task_id AND t.assigned_to = auth.uid())
);

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
  creator_revenue_split_percentage NUMERIC(5,2) NOT NULL DEFAULT 70.00,
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
-- 15. PRIVATE STORAGE BUCKETS CONFIGURATION FOR V2
-- =====================================================================

-- Verification documents bucket (Strictly PRIVATE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('v2-verification-private', 'v2-verification-private', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users can upload verification docs" ON storage.objects;
CREATE POLICY "Users can upload verification docs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'v2-verification-private'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users and admins can view verification docs" ON storage.objects;
CREATE POLICY "Users and admins can view verification docs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'v2-verification-private'
  AND auth.uid() IS NOT NULL
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.v2_is_admin_or_operator())
);

-- Work deliverables bucket (Strictly Authenticated)
INSERT INTO storage.buckets (id, name, public)
VALUES ('v2-work-deliverables', 'v2-work-deliverables', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can upload work deliverables" ON storage.objects;
CREATE POLICY "Authenticated users can upload work deliverables" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'v2-work-deliverables'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Authenticated users can read work deliverables" ON storage.objects;
CREATE POLICY "Authenticated users can read work deliverables" ON storage.objects
FOR SELECT USING (
  bucket_id = 'v2-work-deliverables'
  AND auth.uid() IS NOT NULL
);

-- End of METFA V2 Master Database Foundation
