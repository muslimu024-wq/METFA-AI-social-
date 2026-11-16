-- PROPOSAL ONLY — DO NOT EXECUTE AUTOMATICALLY ON PRODUCTION DATABASE
-- Extends public.video_series to support both Video Series and Text Series / Serial Stories
-- using one shared creator-linked series architecture.

ALTER TABLE public.video_series
  ADD COLUMN IF NOT EXISTS series_type TEXT NOT NULL DEFAULT 'video'
    CHECK (series_type IN ('video', 'text')),
  ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_video_series_creator_type
  ON public.video_series (creator_id, series_type, created_at DESC);

-- Optional column on posts to cache series_type cleanly (already linked via series_id & series_part_number)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS series_type TEXT DEFAULT NULL
    CHECK (series_type IS NULL OR series_type IN ('video', 'text'));
