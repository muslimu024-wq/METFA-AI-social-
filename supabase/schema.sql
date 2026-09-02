-- =====================================================================
-- METFA SOCIAL: SUPABASE PROFILES TABLE & ROW LEVEL SECURITY (RLS)
-- =====================================================================

-- 1. Create public profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  metfa_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT 'AI Creator & Visual Explorer on Metfa Social.',
  location TEXT DEFAULT 'Global Creator',
  website TEXT,
  is_verified BOOLEAN DEFAULT true,
  stats JSONB DEFAULT '{"postsCount": 0, "followersCount": 142, "followingCount": 68, "totalLikes": 1240, "reelsCount": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public profiles are viewable by everyone
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);

-- 4. Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 5. Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- 6. Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 7. Trigger to automatically create a profile entry when a new user signs up via OAuth/Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_name TEXT;
  raw_username TEXT;
  raw_avatar TEXT;
  new_metfa_id TEXT;
BEGIN
  raw_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1),
    'Metfa Creator'
  );
  
  raw_username := COALESCE(
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'username',
    LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')),
    'creator_' || SUBSTRING(NEW.id::text FROM 1 FOR 6)
  );

  raw_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || raw_username
  );

  new_metfa_id := 'MID-' || UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 4));

  INSERT INTO public.profiles (
    id,
    metfa_id,
    display_name,
    username,
    email,
    phone,
    avatar_url
  )
  VALUES (
    NEW.id,
    new_metfa_id,
    raw_name,
    raw_username,
    NEW.email,
    NEW.phone,
    raw_avatar
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    email = COALESCE(profiles.email, EXCLUDED.email),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 8. CREATE PUBLIC POSTS TABLE & ROW LEVEL SECURITY (RLS)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  caption TEXT,
  style_preset TEXT,
  image_src TEXT,
  image_gallery JSONB DEFAULT '[]'::jsonb,
  video_src TEXT,
  original_image_src TEXT,
  text_background_preset TEXT,
  post_type TEXT DEFAULT 'text',
  likes_count INTEGER DEFAULT 0,
  remix_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  feed_type TEXT DEFAULT 'for_you',
  page_id TEXT,
  page_name TEXT,
  page_category TEXT,
  group_id TEXT,
  group_name TEXT,
  posting_identity JSONB,
  audio_track JSONB,
  visibility TEXT DEFAULT 'public',
  is_pinned BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  prompt_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast feed retrieval ordered by creation time
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Policy: Public posts are viewable by everyone
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON public.posts;
CREATE POLICY "Public posts are viewable by everyone"
ON public.posts
FOR SELECT
USING (true);

-- Policy: Authenticated users can insert their own posts
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts"
ON public.posts
FOR INSERT
WITH CHECK (auth.uid() = author_id);

-- Policy: Users can update their own posts
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
ON public.posts
FOR UPDATE
USING (auth.uid() = author_id);

-- Policy: Users can delete their own posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
ON public.posts
FOR DELETE
USING (auth.uid() = author_id);

-- Trigger to automatically update updated_at on post modification
DROP TRIGGER IF EXISTS on_posts_updated ON public.posts;
CREATE TRIGGER on_posts_updated
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

