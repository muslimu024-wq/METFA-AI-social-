-- ============================================================================
-- METFA SOCIAL — MULTI-PART VIDEO SERIES SCHEMA PROPOSAL (DO NOT AUTO-EXECUTE)
-- File: supabase/migrations/20261115_video_series_proposal.sql
--
-- IMPORTANT:
--   This is a reviewable SQL migration proposal ONLY.
--   It has NOT been executed against Production Supabase.
--
-- Scope:
--   1. Explicit creator-linked public.video_series table (never auto-grouped)
--   2. Optional series_id / series_part_number / series_total_parts columns on public.posts
--   3. Strict follow/audience privacy RLS aligned with public.can_view_post(...)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXPLICIT VIDEO SERIES REGISTRY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 140),
  description TEXT,
  first_part_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  total_parts INTEGER CHECK (total_parts IS NULL OR total_parts >= 1),
  visibility TEXT NOT NULL DEFAULT 'public',
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT video_series_visibility_check
    CHECK (visibility IN ('public', 'followers', 'only_me', 'private'))
);

CREATE INDEX IF NOT EXISTS idx_video_series_creator_created
  ON public.video_series (creator_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. EXPLICIT SERIES LINKING COLUMNS ON PUBLIC.POSTS
--    (Standalone videos keep series_id IS NULL)
-- ----------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.video_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_part_number INTEGER CHECK (series_part_number IS NULL OR series_part_number >= 1),
  ADD COLUMN IF NOT EXISTS series_total_parts INTEGER CHECK (series_total_parts IS NULL OR series_total_parts >= 1);

-- Prevent duplicate part numbers within the same series when explicitly assigned
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_unique_series_part
  ON public.posts (series_id, series_part_number)
  WHERE series_id IS NOT NULL AND series_part_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_series_order
  ON public.posts (series_id, series_part_number ASC, created_at ASC)
  WHERE series_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. UPDATED_AT TRIGGER FOR VIDEO_SERIES
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_video_series_updated ON public.video_series;
CREATE TRIGGER on_video_series_updated
  BEFORE UPDATE ON public.video_series
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) FOR VIDEO_SERIES
--    Mirrors public.can_view_post(creator_id, visibility, auth.uid())
-- ----------------------------------------------------------------------------
ALTER TABLE public.video_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Viewable video series" ON public.video_series;
CREATE POLICY "Viewable video series"
  ON public.video_series
  FOR SELECT
  USING (
    (is_published = true AND public.can_view_post(creator_id, visibility, auth.uid()))
    OR auth.uid() = creator_id
  );

DROP POLICY IF EXISTS "Creators can insert their own video series" ON public.video_series;
CREATE POLICY "Creators can insert their own video series"
  ON public.video_series
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update their own video series" ON public.video_series;
CREATE POLICY "Creators can update their own video series"
  ON public.video_series
  FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can delete their own video series" ON public.video_series;
CREATE POLICY "Creators can delete their own video series"
  ON public.video_series
  FOR DELETE
  USING (auth.uid() = creator_id);

COMMIT;
