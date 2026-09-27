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
  signal_type TEXT NOT NULL,
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
$$;

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


-- >>> SECTION 2: CONTRIBUTION INGESTION & RPC <<<
-- =====================================================================
-- METFA V2 — CONTRIBUTION SYSTEM FOUNDATION & INGEST RPC
-- Migration: 20260925_v2_contribution_ingest_foundation.sql
-- =====================================================================

-- Step 1: Ensure public.v2_contribution_ledger has required first-class columns
-- and foreign key constraints updated to ON DELETE RESTRICT
DO $$
BEGIN
  -- Add entry_type column if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'v2_contribution_ledger'
      AND column_name = 'entry_type'
  ) THEN
    ALTER TABLE public.v2_contribution_ledger
      ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'AWARD'
      CHECK (entry_type IN ('AWARD', 'REVERSAL', 'ADJUSTMENT'));
  END IF;

  -- Add original_entry_id column if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'v2_contribution_ledger'
      AND column_name = 'original_entry_id'
  ) THEN
    ALTER TABLE public.v2_contribution_ledger
      ADD COLUMN original_entry_id UUID NULL
      REFERENCES public.v2_contribution_ledger(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Index for original_entry_id self-reference
CREATE INDEX IF NOT EXISTS idx_v2_contribution_original_entry
ON public.v2_contribution_ledger(original_entry_id);

-- Enforce ON DELETE RESTRICT on user_id foreign key (replacing CASCADE)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'v2_contribution_ledger_user_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'v2_contribution_ledger'
  ) THEN
    ALTER TABLE public.v2_contribution_ledger
      DROP CONSTRAINT v2_contribution_ledger_user_id_fkey;
  END IF;

  ALTER TABLE public.v2_contribution_ledger
    ADD CONSTRAINT v2_contribution_ledger_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE RESTRICT;
EXCEPTION
  WHEN OTHERS THEN
    -- If profiles table or constraint is not yet available, pass gracefully
    NULL;
END $$;

-- Step 2: Replace blanket immutable trigger with field-level dual-layer trigger
DROP TRIGGER IF EXISTS trg_v2_contribution_ledger_immutable ON public.v2_contribution_ledger;
DROP TRIGGER IF EXISTS trg_v2_contribution_ledger_protect ON public.v2_contribution_ledger;

CREATE OR REPLACE FUNCTION public.v2_protect_contribution_ledger_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Unconditionally block any physical DELETE operation
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Deleting records from public.v2_contribution_ledger is strictly forbidden';
  END IF;

  -- 2. On UPDATE, verify immutable fields have not been altered
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'Field id in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Field user_id in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.action <> OLD.action THEN
      RAISE EXCEPTION 'Field action in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.policy_id IS DISTINCT FROM OLD.policy_id THEN
      RAISE EXCEPTION 'Field policy_id in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.base_points <> OLD.base_points THEN
      RAISE EXCEPTION 'Field base_points in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.quality_multiplier <> OLD.quality_multiplier THEN
      RAISE EXCEPTION 'Field quality_multiplier in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.final_points <> OLD.final_points THEN
      RAISE EXCEPTION 'Field final_points in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.source_ref IS DISTINCT FROM OLD.source_ref THEN
      RAISE EXCEPTION 'Field source_ref in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Field created_at in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.entry_type <> OLD.entry_type THEN
      RAISE EXCEPTION 'Field entry_type in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.original_entry_id IS DISTINCT FROM OLD.original_entry_id THEN
      RAISE EXCEPTION 'Field original_entry_id in public.v2_contribution_ledger is immutable';
    END IF;

    -- 3. Write-once rule for revenue_period_id: once set, it can never be changed or cleared
    IF OLD.revenue_period_id IS NOT NULL AND (NEW.revenue_period_id IS DISTINCT FROM OLD.revenue_period_id) THEN
      RAISE EXCEPTION 'Field revenue_period_id is write-once and cannot be updated once bound';
    END IF;

    -- 4. Terminal states check
    IF OLD.status = 'SETTLED' AND NEW.status <> 'SETTLED' THEN
      RAISE EXCEPTION 'Settled contribution records cannot transition out of SETTLED status';
    END IF;

    IF OLD.status = 'DISCARDED' AND NEW.status <> 'DISCARDED' THEN
      RAISE EXCEPTION 'Discarded contribution records cannot transition out of DISCARDED status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_v2_contribution_ledger_protect
BEFORE UPDATE OR DELETE ON public.v2_contribution_ledger
FOR EACH ROW
EXECUTE FUNCTION public.v2_protect_contribution_ledger_fields();

-- Enforce strict RLS boundaries: clients have SELECT only; direct INSERT/UPDATE/DELETE are blocked
ALTER TABLE public.v2_contribution_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Disallow client direct insert on contribution ledger" ON public.v2_contribution_ledger;
CREATE POLICY "Disallow client direct insert on contribution ledger"
ON public.v2_contribution_ledger FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Disallow client direct update on contribution ledger" ON public.v2_contribution_ledger;
CREATE POLICY "Disallow client direct update on contribution ledger"
ON public.v2_contribution_ledger FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "Disallow client direct delete on contribution ledger" ON public.v2_contribution_ledger;
CREATE POLICY "Disallow client direct delete on contribution ledger"
ON public.v2_contribution_ledger FOR DELETE
USING (false);

-- Step 3: Event Idempotency Constraint
-- Unique canonical identity (user_id + action + source_ref) when source_ref is present
CREATE UNIQUE INDEX IF NOT EXISTS uq_v2_contribution_idempotency
ON public.v2_contribution_ledger (user_id, action, source_ref)
WHERE (source_ref IS NOT NULL);

-- Step 4: Seed Canonical Versioned Policies if not present
INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'ORIGINAL_CONTENT', 25, 2.00, 150, 300, 'STANDARD', 0.80, '{"min_content_length": 20}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'ORIGINAL_CONTENT');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'QUALIFIED_VIEW', 1, 1.00, 50, 15, 'STANDARD', 0.50, '{"min_view_duration_seconds": 5}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'QUALIFIED_VIEW');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'QUALIFIED_WATCH', 5, 2.00, 100, 30, 'STANDARD', 0.60, '{"min_watch_duration_seconds": 15, "min_completion_ratio": 0.60}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'QUALIFIED_WATCH');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'MEANINGFUL_ENGAGEMENT', 3, 1.50, 60, 20, 'STANDARD', 0.70, '{"min_content_length": 5}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'MEANINGFUL_ENGAGEMENT');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'COMMUNITY_CONTRIBUTION', 20, 2.00, 100, 180, 'STANDARD', 0.50, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'COMMUNITY_CONTRIBUTION');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'VERIFIED_ACTIVITY', 15, 1.50, 75, 60, 'VERIFIED', 0.30, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'VERIFIED_ACTIVITY');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'MARKETPLACE_CONTRIBUTION', 50, 1.50, 250, 300, 'STANDARD', 0.90, '{"require_verified_transaction": true}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'MARKETPLACE_CONTRIBUTION');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'BUSINESS_ACTIVITY', 40, 1.50, 200, 300, 'BUSINESS', 0.60, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'BUSINESS_ACTIVITY');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'AUDIO_USAGE', 10, 1.50, 50, 120, 'STANDARD', 0.50, '{"require_audio_license_verified": true}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'AUDIO_USAGE');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'AUDIO_ATTRIBUTION', 10, 1.20, 50, 120, 'STANDARD', 0.40, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'AUDIO_ATTRIBUTION');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'VOICE_POST_LISTEN', 4, 1.50, 40, 60, 'STANDARD', 0.50, '{"min_watch_duration_seconds": 10, "min_completion_ratio": 0.50}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'VOICE_POST_LISTEN');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'CREATOR_ACTIVITY', 30, 2.00, 150, 300, 'CREATOR_PRO', 0.40, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'CREATOR_ACTIVITY');

-- Step 5: Master Ingest RPC Implementation
CREATE OR REPLACE FUNCTION public.v2_ingest_contribution(
  p_action TEXT,
  p_source_ref TEXT,
  p_client_payload JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_auth_uid UUID;
  v_effective_user_id UUID;
  v_feature_enabled BOOLEAN;
  v_kill_switch_active BOOLEAN;
  v_existing_id UUID;
  v_existing_points INTEGER;
  v_existing_status TEXT;
  v_policy RECORD;
  v_user_tier TEXT := 'STANDARD';
  v_is_verified BOOLEAN := false;
  v_last_action_at TIMESTAMPTZ;
  v_elapsed_seconds NUMERIC;
  v_today_points INTEGER := 0;
  v_quality_multiplier NUMERIC(3,2) := 1.00;
  v_risk_score INTEGER := 0;
  v_qualification_reason TEXT := 'Passed quality verification';
  v_raw_calculated_points INTEGER;
  v_available_points_room INTEGER;
  v_final_points INTEGER;
  v_status TEXT;
  v_new_id UUID;

  -- Payload parsing variables
  v_watch_duration NUMERIC;
  v_min_duration NUMERIC;
  v_completion_ratio NUMERIC;
  v_min_ratio NUMERIC;
  v_content_text TEXT;
  v_min_length INTEGER;
  v_tx_status TEXT;
BEGIN
  -- A. Authentication & User Identity Validation
  v_caller_role := COALESCE(auth.role(), 'anon');
  v_auth_uid := auth.uid();

  IF v_caller_role = 'anon' OR (v_auth_uid IS NULL AND v_caller_role <> 'service_role') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'UNAUTHENTICATED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Authentication required. Anonymous requests are rejected.'
    );
  END IF;

  IF v_caller_role = 'service_role' THEN
    IF p_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'REJECTED',
        'points_awarded', 0,
        'is_duplicate', false,
        'rejection_reason', 'Backend service_role caller must specify p_user_id.'
      );
    END IF;
    v_effective_user_id := p_user_id;
  ELSE
    -- Authenticated client caller
    IF p_user_id IS NOT NULL AND p_user_id <> v_auth_uid THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'UNAUTHORIZED',
        'points_awarded', 0,
        'is_duplicate', false,
        'rejection_reason', 'Unauthorized: Caller cannot submit contribution for another user.'
      );
    END IF;
    v_effective_user_id := v_auth_uid;
  END IF;

  -- Verify user profile exists
  SELECT is_verified INTO v_is_verified
  FROM public.profiles
  WHERE id = v_effective_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'User profile not found in public.profiles.'
    );
  END IF;

  -- Determine user tier from profile verification
  IF v_is_verified IS TRUE THEN
    v_user_tier := 'VERIFIED';
  ELSE
    v_user_tier := 'STANDARD';
  END IF;

  -- B. Feature Flag & Emergency Kill Switch Check
  SELECT enabled INTO v_feature_enabled
  FROM public.v2_feature_flags
  WHERE key = 'contribution_enabled';

  IF v_feature_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'DISABLED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Feature flag contribution_enabled is inactive. Contributions paused.'
    );
  END IF;

  SELECT is_active INTO v_kill_switch_active
  FROM public.v2_kill_switches
  WHERE key = 'contribution_paused';

  IF v_kill_switch_active IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'DISABLED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Emergency kill switch contribution_paused is active. Ingestion paused.'
    );
  END IF;

  -- Basic input sanity
  IF p_action IS NULL OR trim(p_action) = '' OR p_source_ref IS NULL OR trim(p_source_ref) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Missing required activity parameters: action or source_ref.'
    );
  END IF;

  -- C. Self-Farming Protection
  IF COALESCE((p_client_payload->>'is_self_action')::boolean, false) IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Self-farming detected: Users cannot earn contribution points on their own content/actions.'
    );
  END IF;

  -- D. Event Idempotency Check (Primary: user_id + action + source_ref)
  SELECT id, final_points, status INTO v_existing_id, v_existing_points, v_existing_status
  FROM public.v2_contribution_ledger
  WHERE user_id = v_effective_user_id
    AND action = p_action
    AND source_ref = p_source_ref
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'DUPLICATE',
      'contribution_id', v_existing_id,
      'points_awarded', v_existing_points,
      'is_duplicate', true,
      'rejection_reason', NULL
    );
  END IF;

  -- Secondary replay check: explicit idempotency_key in metadata
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id, final_points, status INTO v_existing_id, v_existing_points, v_existing_status
    FROM public.v2_contribution_ledger
    WHERE metadata->>'idempotency_key' = p_idempotency_key
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'DUPLICATE',
        'contribution_id', v_existing_id,
        'points_awarded', v_existing_points,
        'is_duplicate', true,
        'rejection_reason', NULL
      );
    END IF;
  END IF;

  -- E. Policy Resolution
  SELECT * INTO v_policy
  FROM public.v2_contribution_policies
  WHERE action = p_action
    AND status = 'ACTIVE'
    AND effective_from <= NOW()
    AND (effective_until IS NULL OR effective_until >= NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_policy.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', format('No active policy configured for action %s.', p_action)
    );
  END IF;

  -- Tier Requirement Check
  IF v_policy.eligibility_tier_required = 'VERIFIED' AND v_user_tier <> 'VERIFIED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', format('User tier %s does not meet required tier %s.', v_user_tier, v_policy.eligibility_tier_required)
    );
  END IF;

  -- F. Cooldown Verification
  SELECT created_at INTO v_last_action_at
  FROM public.v2_contribution_ledger
  WHERE user_id = v_effective_user_id
    AND action = p_action
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_action_at IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_last_action_at));
    IF v_elapsed_seconds < v_policy.cooldown_seconds THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'COOLDOWN',
        'points_awarded', 0,
        'is_duplicate', false,
        'rejection_reason', format('Cooldown active: Must wait %s seconds before next %s.', ceil(v_policy.cooldown_seconds - v_elapsed_seconds), p_action)
      );
    END IF;
  END IF;

  -- G. Daily Limit Verification
  SELECT COALESCE(SUM(final_points), 0) INTO v_today_points
  FROM public.v2_contribution_ledger
  WHERE user_id = v_effective_user_id
    AND action = p_action
    AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
    AND status IN ('QUALIFIED', 'RECORDED');

  IF v_today_points >= v_policy.daily_limit_points THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'RATE_LIMITED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', format('Daily limit of %s CP reached for %s.', v_policy.daily_limit_points, p_action)
    );
  END IF;

  -- H. Qualification Rules & Quality Multiplier Scaling
  CASE p_action
    WHEN 'QUALIFIED_VIEW' THEN
      v_watch_duration := COALESCE((p_client_payload->>'watch_duration_seconds')::numeric, 0);
      v_min_duration := COALESCE((v_policy.configuration->>'min_view_duration_seconds')::numeric, 5);
      IF v_watch_duration < v_min_duration THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('View duration of %ss below threshold of %ss.', v_watch_duration, v_min_duration)
        );
      END IF;

    WHEN 'QUALIFIED_WATCH', 'VOICE_POST_LISTEN' THEN
      v_watch_duration := COALESCE((p_client_payload->>'watch_duration_seconds')::numeric, 0);
      v_completion_ratio := COALESCE((p_client_payload->>'completion_ratio')::numeric, 0);
      v_min_duration := COALESCE((v_policy.configuration->>'min_watch_duration_seconds')::numeric, 15);
      v_min_ratio := COALESCE((v_policy.configuration->>'min_completion_ratio')::numeric, 0.60);

      IF v_watch_duration < v_min_duration THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('Watch duration (%ss) below minimum policy requirement (%ss).', v_watch_duration, v_min_duration)
        );
      END IF;

      IF v_completion_ratio < v_min_ratio THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('Completion ratio (%s%%) below minimum policy required (%s%%).', (v_completion_ratio * 100)::int, (v_min_ratio * 100)::int)
        );
      END IF;

      IF v_completion_ratio >= 0.90 THEN
        v_quality_multiplier := LEAST(v_policy.quality_multiplier_max, 1.80);
      ELSIF v_completion_ratio >= 0.75 THEN
        v_quality_multiplier := LEAST(v_policy.quality_multiplier_max, 1.40);
      END IF;

    WHEN 'ORIGINAL_CONTENT' THEN
      v_content_text := COALESCE(p_client_payload->>'content_text', '');
      v_min_length := COALESCE((v_policy.configuration->>'min_content_length')::int, 20);

      IF length(v_content_text) < v_min_length THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('Original content length (%s chars) below required threshold (%s chars).', length(v_content_text), v_min_length)
        );
      END IF;

      -- Check for repetitive spam sequences
      IF (v_content_text ~ '(.)\1{6,}') THEN
        v_risk_score := 85;
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', 'Content flagged for repetitive character sequences.'
        );
      END IF;

      IF COALESCE((p_client_payload->>'is_original')::boolean, false) IS TRUE THEN
        v_quality_multiplier := LEAST(v_policy.quality_multiplier_max, 1.50);
      END IF;

    WHEN 'MEANINGFUL_ENGAGEMENT' THEN
      v_content_text := COALESCE(p_client_payload->>'content_text', '');
      v_min_length := COALESCE((v_policy.configuration->>'min_content_length')::int, 5);

      IF length(v_content_text) < v_min_length THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', 'Engagement comment does not meet meaningful length standards.'
        );
      END IF;

    WHEN 'MARKETPLACE_CONTRIBUTION' THEN
      v_tx_status := COALESCE(p_client_payload->>'transaction_status', '');
      IF COALESCE((v_policy.configuration->>'require_verified_transaction')::boolean, false) IS TRUE AND v_tx_status <> 'COMPLETED' THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('Marketplace contribution requires COMPLETED transaction status. Received: %s.', v_tx_status)
        );
      END IF;
      v_quality_multiplier := LEAST(v_policy.quality_multiplier_max, 1.25);

    WHEN 'AUDIO_USAGE', 'AUDIO_ATTRIBUTION' THEN
      IF COALESCE((v_policy.configuration->>'require_audio_license_verified')::boolean, false) IS TRUE
         AND COALESCE((p_client_payload->>'audio_attribution_valid')::boolean, false) IS NOT TRUE THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', 'Audio contribution requires valid attribution and license verification.'
        );
      END IF;

    ELSE
      v_quality_multiplier := 1.00;
  END CASE;

  -- I. Calculate Server-Authoritative Points
  v_raw_calculated_points := FLOOR(v_policy.base_points * v_quality_multiplier);
  v_available_points_room := GREATEST(0, v_policy.daily_limit_points - v_today_points);
  v_final_points := LEAST(v_raw_calculated_points, v_available_points_room);

  IF v_final_points <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'RATE_LIMITED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Available daily points capacity exhausted.'
    );
  END IF;

  -- J. Risk Threshold Evaluation (Risk > 75 -> FLAGGED_RISK)
  IF v_risk_score > 75 THEN
    v_status := 'FLAGGED_RISK';
  ELSE
    v_status := 'QUALIFIED';
  END IF;

  -- K. Database Ledger Insertion (Concurrently safe)
  INSERT INTO public.v2_contribution_ledger (
    user_id,
    action,
    policy_id,
    base_points,
    quality_multiplier,
    final_points,
    source_ref,
    risk_score,
    status,
    revenue_period_id,
    entry_type,
    original_entry_id,
    metadata
  ) VALUES (
    v_effective_user_id,
    p_action,
    v_policy.id,
    v_policy.base_points,
    v_quality_multiplier,
    v_final_points,
    p_source_ref,
    v_risk_score,
    v_status,
    NULL,
    'AWARD',
    NULL,
    jsonb_build_object(
      'payload_summary', p_client_payload,
      'qualification_reason', v_qualification_reason,
      'idempotency_key', p_idempotency_key
    )
  )
  RETURNING id INTO v_new_id;

  -- L. Integrate with Risk Signals if Flagged (Step 6)
  IF v_status = 'FLAGGED_RISK' THEN
    BEGIN
      INSERT INTO public.v2_risk_signals (
        user_id,
        signal_type,
        severity,
        risk_score,
        affected_module,
        evidence,
        status
      ) VALUES (
        v_effective_user_id,
        'CONTRIBUTION_ANOMALY',
        'WARNING',
        v_risk_score,
        'contribution',
        jsonb_build_object(
          'contribution_id', v_new_id,
          'action', p_action,
          'risk_score', v_risk_score,
          'reason', v_qualification_reason
        ),
        'ACTIVE'
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Non-blocking if risk_signals table is not ready
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'contribution_id', v_new_id,
    'points_awarded', v_final_points,
    'is_duplicate', false,
    'rejection_reason', NULL
  );

EXCEPTION
  WHEN unique_violation THEN
    -- In case of concurrent insert race on uq_v2_contribution_idempotency
    SELECT id, final_points, status INTO v_existing_id, v_existing_points, v_existing_status
    FROM public.v2_contribution_ledger
    WHERE user_id = v_effective_user_id
      AND action = p_action
      AND source_ref = p_source_ref
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'DUPLICATE',
      'contribution_id', v_existing_id,
      'points_awarded', v_existing_points,
      'is_duplicate', true,
      'rejection_reason', NULL
    );
END;
$$;

-- Revoke execute from public; grant explicitly to authenticated and service_role
REVOKE ALL ON FUNCTION public.v2_ingest_contribution(TEXT, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_ingest_contribution(TEXT, TEXT, JSONB, TEXT, UUID) TO authenticated, service_role;
