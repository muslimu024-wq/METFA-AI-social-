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
