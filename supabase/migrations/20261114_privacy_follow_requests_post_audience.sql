-- ============================================================================
-- METFA SOCIAL — PHASE 1 REVIEWABLE PRIVACY MIGRATION (DO NOT AUTO-EXECUTE)
-- File: supabase/migrations/20261114_privacy_follow_requests_post_audience.sql
--
-- Scope:
--   1. Follow-based Profile Privacy ('public' | 'private') & Default Post Audience
--   2. Zero placeholder counters for new profiles (existing rows untouched)
--   3. Post Audience ('public' | 'followers' | 'only_me' | legacy 'private')
--      - Existing posts with visibility IS NULL are NEVER overwritten or guessed;
--        fail-closed RLS limits them strictly to their owner until explicitly updated.
--   4. Follow Requests lifecycle ('pending' | 'approved' | 'declined' | 'cancelled')
--   5. Hardened SECURITY DEFINER RPCs (SET search_path = public, pg_temp)
--   6. Fail-closed RLS for posts, comments, reactions, user_follows, follow_requests
--   7. Proposed private Storage 'posts' bucket policy (clearly marked for DBA review)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PROFILES: privacy columns & clean zero-count default
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_privacy TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS default_post_audience TEXT NOT NULL DEFAULT 'public';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_privacy_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_privacy_check
  CHECK (profile_privacy IN ('public', 'private'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_post_audience_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_post_audience_check
  CHECK (default_post_audience IN ('public', 'followers', 'only_me'));

-- Remove hardcoded placeholder starter counts on future inserts without mutating existing rows
ALTER TABLE public.profiles
  ALTER COLUMN stats SET DEFAULT '{"postsCount": 0, "followersCount": 0, "followingCount": 0, "totalLikes": 0, "reelsCount": 0}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. POSTS: audience constraint supporting 'public', 'followers', 'only_me'
--    (Preserves legacy 'private' and NEVER touches existing NULL values)
-- ----------------------------------------------------------------------------
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_visibility_check
  CHECK (visibility IS NULL OR visibility IN ('public', 'followers', 'only_me', 'private'));

CREATE INDEX IF NOT EXISTS idx_posts_author_visibility
  ON public.posts (author_id, visibility, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. FOLLOW REQUESTS TABLE (Follow-based privacy ONLY — no Friend requests)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT follow_requests_no_self CHECK (requester_id <> target_id),
  CONSTRAINT follow_requests_status_check CHECK (status IN ('pending', 'approved', 'declined', 'cancelled'))
);

-- Only one active pending request between a requester and target at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_requests_unique_pending
  ON public.follow_requests (requester_id, target_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_follow_requests_target_status
  ON public.follow_requests (target_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_requests_requester_status
  ON public.follow_requests (requester_id, status, created_at DESC);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. CENTRAL AUTHORIZATION HELPER (FAIL-CLOSED ON NULL / UNKNOWN VISIBILITY)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_post(
  p_author_id UUID,
  p_visibility TEXT,
  p_viewer_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_privacy TEXT;
  v_is_follower BOOLEAN := FALSE;
BEGIN
  -- 1. Owner always has full access (including NULL / only_me / private)
  IF p_viewer_id IS NOT NULL AND p_viewer_id = p_author_id THEN
    RETURN TRUE;
  END IF;

  -- 2. Legacy NULL or unknown visibility -> fail-closed (owner-only)
  IF p_visibility IS NULL OR p_visibility NOT IN ('public', 'followers', 'only_me', 'private') THEN
    RETURN FALSE;
  END IF;

  -- 3. Only Me (and legacy private alias) -> strictly owner-only
  IF p_visibility IN ('only_me', 'private') THEN
    RETURN FALSE;
  END IF;

  -- Look up target author's profile privacy (fail closed to 'public' if profile row missing unless restricted post)
  SELECT pr.profile_privacy
  INTO v_profile_privacy
  FROM public.profiles pr
  WHERE pr.id = p_author_id;

  -- Check approved follow relationship when viewer is authenticated
  IF p_viewer_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_follows uf
      WHERE uf.follower_id = p_viewer_id
        AND uf.following_id = p_author_id
    ) INTO v_is_follower;
  END IF;

  -- 4. Private Profile gates ALL non-owner content (even 'public') behind approved follow
  IF COALESCE(v_profile_privacy, 'public') = 'private' THEN
    RETURN v_is_follower;
  END IF;

  -- 5. Followers-only audience
  IF p_visibility = 'followers' THEN
    RETURN v_is_follower;
  END IF;

  -- 6. Public post on a Public profile
  IF p_visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_post(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_post(UUID, TEXT, UUID) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. SECURITY DEFINER RPCs FOR FOLLOW & FOLLOW REQUEST LIFECYCLE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_or_follow_user(p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target_privacy TEXT := 'public';
  v_already_following BOOLEAN := FALSE;
  v_request_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_target_id IS NULL OR v_caller_id = p_target_id THEN
    RAISE EXCEPTION 'Self-follow is not permitted';
  END IF;

  -- Prevent race conditions between duplicate follow/request submissions
  PERFORM pg_advisory_xact_lock(hashtext(v_caller_id::TEXT || ':' || p_target_id::TEXT));

  SELECT EXISTS (
    SELECT 1 FROM public.user_follows
    WHERE follower_id = v_caller_id AND following_id = p_target_id
  ) INTO v_already_following;

  IF v_already_following THEN
    RETURN jsonb_build_object('status', 'following', 'created', FALSE);
  END IF;

  SELECT COALESCE(profile_privacy, 'public')
  INTO v_target_privacy
  FROM public.profiles
  WHERE id = p_target_id;

  IF v_target_privacy = 'private' THEN
    SELECT id INTO v_request_id
    FROM public.follow_requests
    WHERE requester_id = v_caller_id
      AND target_id = p_target_id
      AND status = 'pending'
    LIMIT 1;

    IF v_request_id IS NULL THEN
      INSERT INTO public.follow_requests (requester_id, target_id, status)
      VALUES (v_caller_id, p_target_id, 'pending')
      RETURNING id INTO v_request_id;
    END IF;

    RETURN jsonb_build_object('status', 'pending', 'request_id', v_request_id);
  END IF;

  INSERT INTO public.user_follows (follower_id, following_id)
  VALUES (v_caller_id, p_target_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('status', 'following', 'created', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.request_or_follow_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_or_follow_user(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_follow_request(p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_updated_count INT := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.follow_requests
  SET status = 'cancelled',
      updated_at = now(),
      responded_at = now()
  WHERE requester_id = v_caller_id
    AND target_id = p_target_id
    AND status = 'pending';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object('status', 'cancelled', 'updated', v_updated_count > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_follow_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_follow_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_follow_request(
  p_request_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_action NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'Invalid action: must be approved or declined';
  END IF;

  SELECT * INTO v_req
  FROM public.follow_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow request not found';
  END IF;

  IF v_req.target_id <> v_caller_id THEN
    RAISE EXCEPTION 'Forbidden: only the target profile owner can respond to this request';
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('status', v_req.status, 'changed', FALSE);
  END IF;

  UPDATE public.follow_requests
  SET status = p_action,
      updated_at = now(),
      responded_at = now()
  WHERE id = p_request_id;

  IF p_action = 'approved' THEN
    INSERT INTO public.user_follows (follower_id, following_id)
    VALUES (v_req.requester_id, v_req.target_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'status', p_action,
    'changed', TRUE,
    'requester_id', v_req.requester_id,
    'target_id', v_req.target_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_follow_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_follow_request(UUID, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. HARDENED ROW-LEVEL SECURITY POLICIES
-- ----------------------------------------------------------------------------

-- 6A. user_follows: block direct client bypass into private profiles
DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
DROP POLICY IF EXISTS "Authenticated users can follow public profiles" ON public.user_follows;
CREATE POLICY "Authenticated users can follow public profiles"
  ON public.user_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND follower_id <> following_id
    AND COALESCE(
      (SELECT pr.profile_privacy FROM public.profiles pr WHERE pr.id = following_id),
      'public'
    ) = 'public'
  );

-- 6B. follow_requests RLS
DROP POLICY IF EXISTS "View own incoming or outgoing follow requests" ON public.follow_requests;
CREATE POLICY "View own incoming or outgoing follow requests"
  ON public.follow_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "Requester can create pending follow request" ON public.follow_requests;
CREATE POLICY "Requester can create pending follow request"
  ON public.follow_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND requester_id <> target_id
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Participants can update follow request status" ON public.follow_requests;
CREATE POLICY "Participants can update follow request status"
  ON public.follow_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id)
  WITH CHECK (
    (auth.uid() = requester_id AND status = 'cancelled')
    OR (auth.uid() = target_id AND status IN ('approved', 'declined'))
  );

-- 6C. posts RLS: strictly enforce can_view_post() fail-closed policy
DROP POLICY IF EXISTS "Posts are readable according to audience and profile privacy" ON public.posts;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.posts;
CREATE POLICY "Posts are readable according to audience and profile privacy"
  ON public.posts
  FOR SELECT
  USING (public.can_view_post(author_id, visibility, auth.uid()));

-- 6D. post_comments & post_reactions inherit parent post access via can_view_post()
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'post_comments') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Comments viewable when parent post is accessible" ON public.post_comments';
    EXECUTE 'DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.post_comments';
    EXECUTE $p$
      CREATE POLICY "Comments viewable when parent post is accessible"
        ON public.post_comments
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.posts p
            WHERE p.id = post_comments.post_id
              AND public.can_view_post(p.author_id, p.visibility, auth.uid())
          )
        )
    $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'post_reactions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Reactions viewable when parent post is accessible" ON public.post_reactions';
    EXECUTE 'DROP POLICY IF EXISTS "Reactions are viewable by everyone" ON public.post_reactions';
    EXECUTE $p$
      CREATE POLICY "Reactions viewable when parent post is accessible"
        ON public.post_reactions
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.posts p
            WHERE p.id = post_reactions.post_id
              AND public.can_view_post(p.author_id, p.visibility, auth.uid())
          )
        )
    $p$;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. PROPOSED STORAGE BUCKET HARDENING (DBA REVIEW REQUIRED BEFORE EXECUTION)
-- NOTE: Turning off public=true requires updating client public-URL references
--       to signed URLs (createSignedUrl) once approved and deployed.
-- ----------------------------------------------------------------------------
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('posts', 'posts', false)
-- ON CONFLICT (id) DO UPDATE SET public = false;
--
-- DROP POLICY IF EXISTS "Post media objects require post visibility access" ON storage.objects;
-- CREATE POLICY "Post media objects require post visibility access"
--   ON storage.objects
--   FOR SELECT
--   USING (
--     bucket_id = 'posts'
--     AND (
--       auth.uid() = owner
--       OR EXISTS (
--         SELECT 1 FROM public.posts p
--         WHERE (p.media_url LIKE '%' || storage.objects.name OR p.video_thumbnail LIKE '%' || storage.objects.name)
--           AND public.can_view_post(p.author_id, p.visibility, auth.uid())
--       )
--     )
--   );

COMMIT;
