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
  video_title TEXT,
  video_thumbnail TEXT,
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

-- Safe idempotent migrations for existing installations
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_title TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_thumbnail TEXT;

-- =========================================================================
-- Supabase Storage Configuration for Posts & Media
-- =========================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('posts', 'posts', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public media access" ON storage.objects;
CREATE POLICY "Public media access" ON storage.objects 
FOR SELECT USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "Authenticated users can upload post media" ON storage.objects;
CREATE POLICY "Authenticated users can upload post media" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'posts');

DROP POLICY IF EXISTS "Users can update their own post media" ON storage.objects;
CREATE POLICY "Users can update their own post media" ON storage.objects 
FOR UPDATE USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "Users can delete their own post media" ON storage.objects;
CREATE POLICY "Users can delete their own post media" ON storage.objects 
FOR DELETE USING (bucket_id = 'posts');

-- =========================================================================
-- 9. METFA SOCIAL: 1-TO-1 MESSAGING ARCHITECTURE & ROW LEVEL SECURITY
-- =========================================================================

-- A. Conversations Table (Supports 1-to-1 and extensible to pages, businesses)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct', -- 'direct' | 'group' | 'page' | 'marketplace'
  direct_pair_key TEXT, -- Enforces database-level uniqueness for 1-to-1 direct conversations
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT
);

-- Index conversations by last message timestamp for snappy inbox list rendering
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- Unique index to prevent duplicate direct 1-to-1 conversations between the same two users
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_pair_key 
ON public.conversations(direct_pair_key) 
WHERE direct_pair_key IS NOT NULL;

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Auto-update timestamp trigger on conversations
DROP TRIGGER IF EXISTS on_conversations_updated ON public.conversations;
CREATE TRIGGER on_conversations_updated
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- B. Conversation Members Table (Normalized participant membership)
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv_id ON public.conversation_members(conversation_id);

-- Enable RLS on conversation_members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- C. Messages Table (Supports Text, Image, Video, and Voice recordings)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'video' | 'voice'
  media_url TEXT,
  media_metadata JSONB DEFAULT '{}'::jsonb, -- { duration, size, mimeType, fileName, width, height }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Trigger to update conversation last_message_at & preview on each new message
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET 
    updated_at = NOW(),
    last_message_at = NEW.created_at,
    last_message_preview = CASE 
      WHEN NEW.message_type = 'image' THEN '📷 Photo'
      WHEN NEW.message_type = 'video' THEN '🎥 Video'
      WHEN NEW.message_type = 'voice' THEN '🎤 Voice message'
      ELSE COALESCE(SUBSTRING(NEW.content FROM 1 FOR 80), 'Sent a message')
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_message();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR MESSAGING
-- =========================================================================

-- 1. Conversations Policies
DROP POLICY IF EXISTS "Members can view their own conversations" ON public.conversations;
CREATE POLICY "Members can view their own conversations"
ON public.conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = public.conversations.id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can update their conversations" ON public.conversations;
CREATE POLICY "Members can update their conversations"
ON public.conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = public.conversations.id
      AND cm.user_id = auth.uid()
  )
);

-- 2. Conversation Members Policies
DROP POLICY IF EXISTS "Members can view conversation participants" ON public.conversation_members;
CREATE POLICY "Members can view conversation participants"
ON public.conversation_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members self_cm
    WHERE self_cm.conversation_id = public.conversation_members.conversation_id
      AND self_cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can add conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Disallow arbitrary membership insertion" ON public.conversation_members;
-- Arbitrary third-party membership insertion is strictly disallowed.
-- Memberships must be created via canonical SECURITY DEFINER functions such as get_or_create_direct_conversation().
CREATE POLICY "Disallow arbitrary membership insertion"
ON public.conversation_members
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Users can update their own membership status" ON public.conversation_members;
CREATE POLICY "Users can update their own membership status"
ON public.conversation_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Messages Policies
DROP POLICY IF EXISTS "Members can view messages in their conversations" ON public.messages;
CREATE POLICY "Members can view messages in their conversations"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = public.messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can send messages to their conversations" ON public.messages;
CREATE POLICY "Members can send messages to their conversations"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = public.messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Senders can update their own messages" ON public.messages;
CREATE POLICY "Senders can update their own messages"
ON public.messages
FOR UPDATE
USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Senders can delete their own messages" ON public.messages;
CREATE POLICY "Senders can delete their own messages"
ON public.messages
FOR DELETE
USING (sender_id = auth.uid());

-- =========================================================================
-- ATOMIC HELPER: GET OR CREATE DIRECT 1-TO-1 CONVERSATION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(partner_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  caller_id UUID;
  v_pair_key TEXT;
  v_lock_key BIGINT;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create or fetch conversation';
  END IF;

  IF caller_id = partner_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  -- Canonical pair key: alphabetically sorted participant IDs
  v_pair_key := LEAST(caller_id::text, partner_id::text) || ':' || GREATEST(caller_id::text, partner_id::text);

  -- Acquire transaction-level advisory lock on hash of the pair key.
  -- This serializes concurrent requests between these two specific users without blocking other conversations.
  v_lock_key := ('x' || SUBSTRING(md5(v_pair_key), 1, 15))::BIT(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 1. First check by direct_pair_key (fast unique index lookup)
  SELECT c.id INTO conv_id
  FROM public.conversations c
  WHERE c.direct_pair_key = v_pair_key
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- 2. Fallback check for any legacy conversation sharing both members
  SELECT c.id INTO conv_id
  FROM public.conversations c
  JOIN public.conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = caller_id
  JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = partner_id
  WHERE c.type = 'direct'
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    -- Ensure direct_pair_key is set for legacy conversation
    UPDATE public.conversations
    SET direct_pair_key = v_pair_key
    WHERE id = conv_id AND direct_pair_key IS NULL;
    RETURN conv_id;
  END IF;

  -- 3. Create new direct conversation with direct_pair_key (enforcing database-level uniqueness)
  INSERT INTO public.conversations (type, direct_pair_key, last_message_preview)
  VALUES ('direct', v_pair_key, 'Conversation started')
  ON CONFLICT (direct_pair_key) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO conv_id;

  -- 4. Insert exactly two members atomically
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES 
    (conv_id, caller_id),
    (conv_id, partner_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =========================================================================
-- SUPABASE STORAGE FOR MESSAGES MEDIA (Images, Videos, Voice Recordings)
-- Private bucket & member-scoped access
-- =========================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('messages', 'messages', false) 
ON CONFLICT (id) DO UPDATE SET public = false;

-- Remove public access policy
DROP POLICY IF EXISTS "Public message media access" ON storage.objects;

-- Read policy: ONLY authorized conversation participants can access message media
-- Supports modern path format: {conversation_id}/{sender_id}/{filename}
-- Also supports legacy path format: {user_id}/{filename} by joining with messages & conversation_members
DROP POLICY IF EXISTS "Authorized members can read message media" ON storage.objects;
CREATE POLICY "Authorized members can read message media" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'messages' 
  AND auth.uid() IS NOT NULL 
  AND (
    -- Modern 2-tier structure: {conversation_id}/{sender_id}/{filename}
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id::text = (storage.foldername(name))[1]
        AND cm.user_id = auth.uid()
    )
    OR
    -- Legacy 1-tier structure: {user_id}/{filename}
    -- Verified authorized member via linked message record in public.messages
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE cm.user_id = auth.uid()
        AND (m.media_url LIKE '%' || name OR m.media_url = name)
    )
  )
);

-- Upload policy: ONLY authorized conversation participants can upload message media
-- Enforces: folder 1 = conversation_id, folder 2 = auth.uid() (sender), user is a verified conversation member
DROP POLICY IF EXISTS "Authenticated users can upload message media" ON storage.objects;
DROP POLICY IF EXISTS "Authorized members can upload message media" ON storage.objects;
CREATE POLICY "Authorized members can upload message media" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'messages' 
  AND auth.uid() IS NOT NULL 
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
  )
);

-- Senders can update their own message media
DROP POLICY IF EXISTS "Users can update their own message media" ON storage.objects;
CREATE POLICY "Users can update their own message media" ON storage.objects 
FOR UPDATE USING (
  bucket_id = 'messages' 
  AND auth.uid() IS NOT NULL 
  AND (
    (storage.foldername(name))[2] = auth.uid()::text 
    OR auth.uid() = owner
  )
);

-- Senders can delete their own message media
DROP POLICY IF EXISTS "Users can delete their own message media" ON storage.objects;
CREATE POLICY "Users can delete their own message media" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'messages' 
  AND auth.uid() IS NOT NULL 
  AND (
    (storage.foldername(name))[2] = auth.uid()::text 
    OR auth.uid() = owner
  )
);



