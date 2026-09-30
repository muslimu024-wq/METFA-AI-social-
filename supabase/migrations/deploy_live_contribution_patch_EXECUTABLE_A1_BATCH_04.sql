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
