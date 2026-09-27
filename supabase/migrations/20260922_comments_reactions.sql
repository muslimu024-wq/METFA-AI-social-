-- =====================================================================
-- METFA SOCIAL — PHASE 2A: COMMENTS & REACTIONS MIGRATION
-- Single Source of Truth on Supabase with RLS & Synchronized Counters
-- =====================================================================

-- 1. POST COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  audio_url TEXT NULL,
  audio_duration NUMERIC NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_post_comments_content CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 3000)
);

-- 2. POST REACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_post_reactions_type CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'fire')),
  CONSTRAINT uq_post_reactions_post_user UNIQUE (post_id, user_id)
);

-- 3. INDEXES
-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON public.post_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);

-- Reactions indexes
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON public.post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_type ON public.post_reactions(post_id, reaction_type);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_post ON public.post_reactions(user_id, post_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- 4A. Comments Policies
DROP POLICY IF EXISTS "Users can view comments on visible posts" ON public.post_comments;
CREATE POLICY "Users can view comments on visible posts"
ON public.post_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND (p.visibility = 'public' OR p.visibility IS NULL OR p.author_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert their own comments" ON public.post_comments;
CREATE POLICY "Authenticated users can insert their own comments"
ON public.post_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND (p.visibility = 'public' OR p.visibility IS NULL OR p.author_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;
CREATE POLICY "Users can update their own comments"
ON public.post_comments FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and post owners can delete comments" ON public.post_comments;
CREATE POLICY "Users and post owners can delete comments"
ON public.post_comments FOR DELETE
USING (
  auth.uid() = user_id
  OR auth.uid() IN (SELECT author_id FROM public.posts WHERE id = post_comments.post_id)
);

-- 4B. Reactions Policies
DROP POLICY IF EXISTS "Users can view reactions on visible posts" ON public.post_reactions;
CREATE POLICY "Users can view reactions on visible posts"
ON public.post_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_reactions.post_id
      AND (p.visibility = 'public' OR p.visibility IS NULL OR p.author_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert their own reactions" ON public.post_reactions;
CREATE POLICY "Authenticated users can insert their own reactions"
ON public.post_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_reactions.post_id
      AND (p.visibility = 'public' OR p.visibility IS NULL OR p.author_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update their own reaction" ON public.post_reactions;
CREATE POLICY "Users can update their own reaction"
ON public.post_reactions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reaction" ON public.post_reactions;
CREATE POLICY "Users can delete their own reaction"
ON public.post_reactions FOR DELETE
USING (auth.uid() = user_id);

-- 5. COUNTER SYNCHRONIZATION TRIGGERS
-- 5A. Comments Count Trigger
CREATE OR REPLACE FUNCTION public.handle_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET comments_count = GREATEST(0, COALESCE(comments_count, 1) - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_comment_count_change ON public.post_comments;
CREATE TRIGGER on_post_comment_count_change
AFTER INSERT OR DELETE ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_post_comments_count();

-- 5B. Reactions (Likes) Count Trigger
CREATE OR REPLACE FUNCTION public.handle_post_reactions_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET likes_count = COALESCE(likes_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET likes_count = GREATEST(0, COALESCE(likes_count, 1) - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_reaction_count_change ON public.post_reactions;
CREATE TRIGGER on_post_reaction_count_change
AFTER INSERT OR DELETE ON public.post_reactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_post_reactions_count();

-- 6. UPDATED_AT TRIGGER FOR COMMENTS
DROP TRIGGER IF EXISTS on_post_comments_updated ON public.post_comments;
CREATE TRIGGER on_post_comments_updated
BEFORE UPDATE ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
