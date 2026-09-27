-- =====================================================================
-- METFA SOCIAL: Phase 2B Social Graph Migration (User Follows)
-- =====================================================================
-- Creates authoritative public.user_follows relational table,
-- atomic triggers to synchronize JSONB profiles.stats counters (followersCount & followingCount),
-- and strict Row Level Security (RLS) policies.
-- =====================================================================

-- 1. Table: public.user_follows
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_follows_follower_following UNIQUE (follower_id, following_id),
  CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)
);

-- 2. Performance Indexes
-- follower_id is covered by the leading column of uq_user_follows_follower_following,
-- so we create an index on following_id to ensure fast lookup for reverse queries (followers of target user).
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON public.user_follows(follower_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- 3A. SELECT: Follow relationships are viewable by everyone (public profiles architecture)
DROP POLICY IF EXISTS "Follow relationships are viewable by everyone" ON public.user_follows;
CREATE POLICY "Follow relationships are viewable by everyone"
ON public.user_follows FOR SELECT
USING (true);

-- 3B. INSERT: Authenticated users can only follow as themselves (auth.uid() = follower_id)
-- Prohibits self-follow and ensures target profile exists
DROP POLICY IF EXISTS "Authenticated users can create follow relationships" ON public.user_follows;
CREATE POLICY "Authenticated users can create follow relationships"
ON public.user_follows FOR INSERT
WITH CHECK (
  auth.uid() = follower_id
  AND follower_id <> following_id
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = following_id)
);

-- 3C. DELETE: Only the follower can delete the relationship (unfollow)
DROP POLICY IF EXISTS "Users can delete their own follow relationships" ON public.user_follows;
CREATE POLICY "Users can delete their own follow relationships"
ON public.user_follows FOR DELETE
USING (auth.uid() = follower_id);

-- 3D. UPDATE: No UPDATE policy provided. Follow relationships are strictly immutable records (INSERT or DELETE only).

-- 4. Counter Synchronization Trigger
-- Safely modifies JSONB profiles.stats:
-- Increment/decrement followingCount for follower_id
-- Increment/decrement followersCount for following_id
-- Preserves ALL unrelated existing JSONB fields (postsCount, totalLikes, reelsCount, etc.)
-- Clamps counters with GREATEST(0, ...) to prevent negative numbers.

CREATE OR REPLACE FUNCTION public.handle_user_follows_count()
RETURNS TRIGGER AS $$
DECLARE
  current_follower_stats JSONB;
  current_following_stats JSONB;
  follower_cnt INT;
  following_cnt INT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- 1. Update following user's followersCount (+1)
    SELECT COALESCE(stats, '{}'::jsonb) INTO current_following_stats
    FROM public.profiles WHERE id = NEW.following_id;

    follower_cnt := COALESCE((current_following_stats->>'followersCount')::int, 0) + 1;

    UPDATE public.profiles
    SET stats = jsonb_set(
      COALESCE(stats, '{"postsCount":0,"followersCount":0,"followingCount":0,"totalLikes":0,"reelsCount":0}'::jsonb),
      '{followersCount}',
      to_jsonb(follower_cnt)
    )
    WHERE id = NEW.following_id;

    -- 2. Update follower's followingCount (+1)
    SELECT COALESCE(stats, '{}'::jsonb) INTO current_follower_stats
    FROM public.profiles WHERE id = NEW.follower_id;

    following_cnt := COALESCE((current_follower_stats->>'followingCount')::int, 0) + 1;

    UPDATE public.profiles
    SET stats = jsonb_set(
      COALESCE(stats, '{"postsCount":0,"followersCount":0,"followingCount":0,"totalLikes":0,"reelsCount":0}'::jsonb),
      '{followingCount}',
      to_jsonb(following_cnt)
    )
    WHERE id = NEW.follower_id;

    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    -- 1. Update following user's followersCount (-1)
    SELECT COALESCE(stats, '{}'::jsonb) INTO current_following_stats
    FROM public.profiles WHERE id = OLD.following_id;

    follower_cnt := GREATEST(0, COALESCE((current_following_stats->>'followersCount')::int, 1) - 1);

    UPDATE public.profiles
    SET stats = jsonb_set(
      COALESCE(stats, '{"postsCount":0,"followersCount":0,"followingCount":0,"totalLikes":0,"reelsCount":0}'::jsonb),
      '{followersCount}',
      to_jsonb(follower_cnt)
    )
    WHERE id = OLD.following_id;

    -- 2. Update follower's followingCount (-1)
    SELECT COALESCE(stats, '{}'::jsonb) INTO current_follower_stats
    FROM public.profiles WHERE id = OLD.follower_id;

    following_cnt := GREATEST(0, COALESCE((current_follower_stats->>'followingCount')::int, 1) - 1);

    UPDATE public.profiles
    SET stats = jsonb_set(
      COALESCE(stats, '{"postsCount":0,"followersCount":0,"followingCount":0,"totalLikes":0,"reelsCount":0}'::jsonb),
      '{followingCount}',
      to_jsonb(following_cnt)
    )
    WHERE id = OLD.follower_id;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger definition: ONLY on INSERT OR DELETE (never UPDATE)
DROP TRIGGER IF EXISTS on_user_follow_change ON public.user_follows;
CREATE TRIGGER on_user_follow_change
AFTER INSERT OR DELETE ON public.user_follows
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_follows_count();

-- 5. Explicit Least-Privilege Supabase Data API Grants (October 30, 2026 Compliant)
GRANT SELECT ON public.user_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;
GRANT ALL ON public.user_follows TO service_role;
