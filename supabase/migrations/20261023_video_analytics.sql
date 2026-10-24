-- =====================================================================
-- METFA SOCIAL: VIDEO ANALYTICS & WATCH SESSIONS MIGRATION
-- Migration: 20261023_video_analytics.sql
-- =====================================================================

-- 1. Create video_watch_sessions table for genuine, server-validated watch events
CREATE TABLE IF NOT EXISTS public.video_watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL,
  video_type TEXT NOT NULL CHECK (video_type IN ('reel', 'post_video', 'premium_content')),
  creator_id UUID,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_fingerprint TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'desktop' CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  watch_duration_seconds NUMERIC(10, 2) NOT NULL CHECK (watch_duration_seconds >= 0),
  video_duration_seconds NUMERIC(10, 2) NOT NULL CHECK (video_duration_seconds > 0),
  completion_rate NUMERIC(5, 4) NOT NULL CHECK (completion_rate >= 0 AND completion_rate <= 1.0),
  playback_speed NUMERIC(4, 2) NOT NULL DEFAULT 1.0 CHECK (playback_speed > 0 AND playback_speed <= 2.5),
  is_qualified_view BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_self_watch BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.video_watch_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Creators can view watch sessions for their own videos
CREATE POLICY "Creators can view analytics for their own videos"
ON public.video_watch_sessions
FOR SELECT
USING (
  auth.uid() = creator_id
  OR EXISTS (
    SELECT 1 FROM public.v2_user_roles
    WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN', 'ANALYST')
  )
);

-- 4. Policy: Anyone authenticated can insert a verified watch session for themselves
CREATE POLICY "Viewers can record their own watch sessions"
ON public.video_watch_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = viewer_id OR viewer_id IS NULL
);

-- 5. Indexes for performant analytics aggregation
CREATE INDEX IF NOT EXISTS idx_video_watch_video_id ON public.video_watch_sessions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_watch_creator_id ON public.video_watch_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_video_watch_qualified ON public.video_watch_sessions(video_id, is_qualified_view) WHERE is_qualified_view = true;
CREATE INDEX IF NOT EXISTS idx_video_watch_fingerprint_time ON public.video_watch_sessions(video_id, viewer_fingerprint, created_at);
