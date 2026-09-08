-- =========================================================================
-- METFA SOCIAL: 1-TO-1 MESSAGING MIGRATION
-- Migration Date: 2026-09-08
-- =========================================================================

-- 1. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct', -- 'direct' | 'group' | 'page' | 'marketplace'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS on_conversations_updated ON public.conversations;
CREATE TRIGGER on_conversations_updated
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create Conversation Members Table
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv_id ON public.conversation_members(conversation_id);
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- 3. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'video' | 'voice'
  media_url TEXT,
  media_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Auto-update conversation on message insert
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

-- 5. RLS: Conversations
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

-- 6. RLS: Conversation Members
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
CREATE POLICY "Authenticated users can add conversation members"
ON public.conversation_members
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own membership status" ON public.conversation_members;
CREATE POLICY "Users can update their own membership status"
ON public.conversation_members
FOR UPDATE
USING (user_id = auth.uid());

-- 7. RLS: Messages
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

-- 8. Stored Procedure: Atomic get or create direct 1-to-1 conversation
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(partner_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create or fetch conversation';
  END IF;

  IF caller_id = partner_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  -- 1. Find existing 1-to-1 conversation shared between both participants
  SELECT c.id INTO conv_id
  FROM public.conversations c
  JOIN public.conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = caller_id
  JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = partner_id
  WHERE c.type = 'direct'
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- 2. Create new direct conversation if none exists
  INSERT INTO public.conversations (type)
  VALUES ('direct')
  RETURNING id INTO conv_id;

  -- 3. Insert both members atomically
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES 
    (conv_id, caller_id),
    (conv_id, partner_id);

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Storage Bucket for Messages
INSERT INTO storage.buckets (id, name, public) 
VALUES ('messages', 'messages', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload message media" ON storage.objects;
CREATE POLICY "Authenticated users can upload message media" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'messages' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Public message media access" ON storage.objects;
CREATE POLICY "Public message media access" ON storage.objects 
FOR SELECT USING (bucket_id = 'messages');
