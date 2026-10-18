-- METFA SOCIAL — PREMIUM CONTENT + PREMIUM LIVE MVP MIGRATION
-- Migration: 20261014000001_premium_content_mvp.sql

-- 1. Create premium_content table (Uploaded videos with mandatory 3/4/5 min trailer & 80/20 initial split)
CREATE TABLE IF NOT EXISTS public.premium_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  description TEXT,
  preview_video_url TEXT NOT NULL CHECK (char_length(trim(preview_video_url)) > 0),
  full_video_storage_path TEXT NOT NULL CHECK (char_length(trim(full_video_storage_path)) > 0),
  free_preview_duration_seconds INTEGER NOT NULL DEFAULT 180 CHECK (free_preview_duration_seconds IN (180, 240, 300)),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 50),
  currency TEXT NOT NULL DEFAULT 'USD',
  creator_split_bps INTEGER NOT NULL DEFAULT 8000 CHECK (creator_split_bps BETWEEN 5000 AND 9500),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create premium_purchases table (Permanent entitlements for uploaded premium videos)
CREATE TABLE IF NOT EXISTS public.premium_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.premium_content(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('METFA_WALLET', 'EXTERNAL_PAYMENT')),
  wallet_ledger_id UUID,
  creator_wallet_ledger_id UUID,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  creator_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REFUNDED', 'DISPUTED')),
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_premium_content_viewer UNIQUE (content_id, viewer_id)
);

-- 3. Create premium_live_sessions table (Live Only vs Live + Replay Access)
CREATE TABLE IF NOT EXISTS public.premium_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  description TEXT,
  scheduled_start_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED')),
  live_price_cents INTEGER NOT NULL CHECK (live_price_cents >= 50),
  replay_price_cents INTEGER NOT NULL CHECK (replay_price_cents >= live_price_cents),
  currency TEXT NOT NULL DEFAULT 'USD',
  live_channel_id TEXT NOT NULL,
  recording_storage_path TEXT,
  recording_status TEXT NOT NULL DEFAULT 'NONE' CHECK (recording_status IN ('NONE', 'RECORDING', 'FINALIZING', 'PUBLISHED', 'FAILED')),
  recording_failure_reason TEXT,
  published_at TIMESTAMPTZ,
  retention_protected BOOLEAN NOT NULL DEFAULT false,
  creator_split_bps INTEGER NOT NULL DEFAULT 8000 CHECK (creator_split_bps BETWEEN 5000 AND 9500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create premium_live_purchases table (Ticket purchases with Live Only or Live + Replay Tier)
CREATE TABLE IF NOT EXISTS public.premium_live_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.premium_live_sessions(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  access_tier TEXT NOT NULL CHECK (access_tier IN ('LIVE_ONLY', 'LIVE_AND_PERMANENT_REPLAY')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('METFA_WALLET', 'EXTERNAL_PAYMENT')),
  wallet_ledger_id UUID,
  creator_wallet_ledger_id UUID,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  creator_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REFUNDED', 'DISPUTED')),
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_premium_live_viewer_tier UNIQUE (session_id, viewer_id, access_tier)
);

-- 5. Create ordinary_live_videos table (Enforces 30-day retention cleanup)
CREATE TABLE IF NOT EXISTS public.ordinary_live_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  is_purged BOOLEAN NOT NULL DEFAULT false,
  purged_at TIMESTAMPTZ
);

-- 6. Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_premium_content_creator ON public.premium_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_premium_content_active ON public.premium_content(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_premium_purchases_viewer ON public.premium_purchases(viewer_id);
CREATE INDEX IF NOT EXISTS idx_premium_live_sessions_creator ON public.premium_live_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_premium_live_sessions_status ON public.premium_live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_premium_live_purchases_viewer ON public.premium_live_purchases(viewer_id);
CREATE INDEX IF NOT EXISTS idx_ordinary_live_expires ON public.ordinary_live_videos(expires_at) WHERE is_purged = false;

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.premium_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_live_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordinary_live_videos ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
CREATE POLICY "Public viewers can read active premium content"
  ON public.premium_content FOR SELECT USING (is_active = true);

CREATE POLICY "Public viewers can discover scheduled or active live sessions"
  ON public.premium_live_sessions FOR SELECT USING (status IN ('SCHEDULED', 'LIVE', 'ENDED'));

CREATE POLICY "Viewers can view own live purchases"
  ON public.premium_live_purchases FOR SELECT TO authenticated USING (viewer_id = auth.uid());

CREATE POLICY "Creators can view own live purchases"
  ON public.premium_live_purchases FOR SELECT TO authenticated USING (creator_id = auth.uid());

-- Service role administrative policies
CREATE POLICY "Service role full access on premium_content"
  ON public.premium_content FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on premium_purchases"
  ON public.premium_purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on premium_live_sessions"
  ON public.premium_live_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on premium_live_purchases"
  ON public.premium_live_purchases FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on ordinary_live_videos"
  ON public.ordinary_live_videos FOR ALL TO service_role USING (true) WITH CHECK (true);
