-- =========================================================================
-- METFA SOCIAL: MESSAGING SECURITY HARDENING MIGRATION
-- Migration Date: 2026-09-08
-- Purpose:
-- 1. Private message storage bucket & member-scoped Storage RLS
-- 2. Lockdown conversation_members INSERT against arbitrary client insertion
-- 3. Concurrency-safe, duplicate-proof direct 1-to-1 conversation creation
-- 4. Authoritative per-user last_read_at state verification
-- =========================================================================

-- 1. Add direct_pair_key column and unique index for duplicate conversation prevention
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS direct_pair_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_pair_key 
ON public.conversations(direct_pair_key) 
WHERE direct_pair_key IS NOT NULL;

-- Safely backfill direct_pair_key for existing 1-to-1 direct conversations without destroying data
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT c.id, 
           LEAST(cm1.user_id::text, cm2.user_id::text) || ':' || GREATEST(cm1.user_id::text, cm2.user_id::text) AS pair_key
    FROM public.conversations c
    JOIN public.conversation_members cm1 ON cm1.conversation_id = c.id
    JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id AND cm1.user_id < cm2.user_id
    WHERE c.type = 'direct' AND c.direct_pair_key IS NULL
  LOOP
    BEGIN
      UPDATE public.conversations SET direct_pair_key = r.pair_key WHERE id = r.id;
    EXCEPTION WHEN unique_violation THEN
      NULL; -- Ignore legacy duplicate if one already existed
    END;
  END LOOP;
END $$;

-- 2. Lock down conversation_members INSERT
DROP POLICY IF EXISTS "Authenticated users can add conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Disallow arbitrary membership insertion" ON public.conversation_members;

-- Direct client inserts are strictly disallowed; memberships are created only via SECURITY DEFINER functions
CREATE POLICY "Disallow arbitrary membership insertion"
ON public.conversation_members
FOR INSERT
WITH CHECK (false);

-- Ensure users can only update their own membership last_read_at
DROP POLICY IF EXISTS "Users can update their own membership status" ON public.conversation_members;
CREATE POLICY "Users can update their own membership status"
ON public.conversation_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Upgrade atomic get_or_create_direct_conversation with transaction advisory locking & uniqueness
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
  -- Serializes concurrent creation requests between the same two users.
  v_lock_key := ('x' || SUBSTRING(md5(v_pair_key), 1, 15))::BIT(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 1. Check by direct_pair_key (fast unique index lookup)
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

-- 4. Private messages storage bucket configuration
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
