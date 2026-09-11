import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Conversation, Message, MessageType, MessageMediaMetadata, ConversationMember } from '../types/messaging';
import { UserProfile } from '../types/community';
import { uploadMediaItem } from './storageService';

// In-memory cache for temporary signed URLs (expires in 45 minutes)
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Resolves a private storage media path or URL to a secure temporary signed URL (valid for 1 hour).
 * Verifies that the authenticated caller has access under Storage RLS policies.
 */
export async function resolveSignedMediaUrl(
  mediaUrlOrPath: string | undefined,
  conversationId?: string
): Promise<string> {
  if (!mediaUrlOrPath) return '';
  // Data URLs, Blobs, or already signed URLs with token parameter are directly viewable
  if (
    mediaUrlOrPath.startsWith('data:') ||
    mediaUrlOrPath.startsWith('blob:') ||
    mediaUrlOrPath.includes('token=')
  ) {
    return mediaUrlOrPath;
  }

  if (!isSupabaseConfigured()) {
    return mediaUrlOrPath;
  }

  // Extract clean relative path inside 'messages' bucket
  let cleanPath = mediaUrlOrPath;
  if (cleanPath.includes('/messages/')) {
    cleanPath = cleanPath.split('/messages/')[1];
  } else if (cleanPath.startsWith('messages/')) {
    cleanPath = cleanPath.replace(/^messages\//, '');
  }

  // If it's a full http(s) URL pointing to our Supabase Storage messages bucket, extract object path
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    if (!cleanPath.includes('/storage/v1/object/')) {
      return mediaUrlOrPath;
    }
    const match = cleanPath.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/messages\/(.+?)(?:\?|$)/);
    if (match && match[1]) {
      cleanPath = decodeURIComponent(match[1]);
    } else {
      return mediaUrlOrPath;
    }
  }

  // Check in-memory cache
  const cached = signedUrlCache.get(cleanPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    // Generate secure signed URL with 3600 seconds (1 hour) TTL
    const { data, error } = await supabase.storage
      .from('messages')
      .createSignedUrl(cleanPath, 3600);

    if (!error && data?.signedUrl) {
      signedUrlCache.set(cleanPath, {
        url: data.signedUrl,
        expiresAt: Date.now() + 45 * 60 * 1000, // 45 minutes cache
      });
      return data.signedUrl;
    } else if (error) {
      console.warn('[MessagingService] createSignedUrl notice:', error.message);
    }
  } catch (e) {
    console.warn('[MessagingService] Failed to create signed URL:', e);
  }

  return mediaUrlOrPath;
}

/**
 * Maps Supabase raw database row to our strongly typed Message object
 */
function mapSupabaseRowToMessage(row: any, senderProfile?: UserProfile): Message {
  const profile = senderProfile || (row.sender ? {
    id: row.sender.id,
    name: row.sender.display_name || row.sender.name || 'Metfa Creator',
    username: row.sender.username || 'creator',
    avatar: row.sender.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
    bio: row.sender.bio || '',
    isVerified: Boolean(row.sender.is_verified),
    joinDate: row.sender.created_at || 'Recently',
    stats: row.sender.stats || { postsCount: 0, followersCount: 0, followingCount: 0, totalLikes: 0, reelsCount: 0 },
  } : undefined);

  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    content: row.content || '',
    messageType: (row.message_type as MessageType) || 'text',
    mediaUrl: row.media_url || undefined,
    mediaMetadata: row.media_metadata || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
    isRead: Boolean(row.is_read),
    senderProfile: profile,
  };
}

/**
 * Finds an existing direct 1-to-1 conversation between current user and partner,
 * or creates a new one atomically.
 */
export async function getOrCreateDirectConversation(
  partnerId: string,
  currentUserId: string,
  partnerProfile?: UserProfile
): Promise<{ conversationId: string | null; error?: string }> {
  if (!partnerId || !currentUserId) {
    return { conversationId: null, error: 'Both participants are required' };
  }

  if (partnerId === currentUserId) {
    return { conversationId: null, error: 'Cannot start conversation with yourself' };
  }

  // 1. If Supabase is configured, use Supabase as the authoritative source of truth
  if (isSupabaseConfigured()) {
    try {
      // Use canonical SECURITY DEFINER stored procedure.
      // This enforces: caller = auth.uid(), caller != partner, exactly 2 members created,
      // and guarantees duplicate-prevention via pg_advisory_xact_lock & direct_pair_key unique index.
      let { data: rpcConvId, error: rpcError } = await supabase.rpc(
        'get_or_create_direct_conversation',
        { partner_id: partnerId }
      );

      if (
        rpcError &&
        (rpcError.message?.includes('partner_id') ||
          rpcError.message?.includes('target_user_id') ||
          rpcError.code === '42883')
      ) {
        const altRes = await supabase.rpc('get_or_create_direct_conversation', {
          target_user_id: partnerId,
        });
        if (!altRes.error && altRes.data) {
          rpcConvId = altRes.data;
          rpcError = null;
        }
      }

      if (!rpcError && rpcConvId) {
        return { conversationId: String(rpcConvId) };
      }

      if (rpcError) {
        console.warn('[MessagingService] Stored procedure notice:', rpcError.message);
      }

      // Read-only search: check if conversation already exists between both participants
      const { data: myMemberships, error: myError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId);

      if (!myError && myMemberships && myMemberships.length > 0) {
        const convIds = myMemberships.map((m: any) => m.conversation_id);

        const { data: shared, error: sharedError } = await supabase
          .from('conversation_members')
          .select('conversation_id, conversations!inner(type)')
          .eq('user_id', partnerId)
          .in('conversation_id', convIds)
          .eq('conversations.type', 'direct')
          .limit(1);

        if (!sharedError && shared && shared.length > 0) {
          return { conversationId: String(shared[0].conversation_id) };
        }
      }
    } catch (err: any) {
      console.warn('[MessagingService] Supabase getOrCreateDirectConversation error:', err);
    }
  }

  // 2. Server API fallback (for local development before cloud Supabase keys are configured)
  try {
    const res = await fetch('/api/conversations/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentUserId,
        partnerId,
        partnerProfile,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.conversationId) {
        return { conversationId: data.conversationId };
      }
    }
    return { conversationId: null, error: 'Could not create conversation' };
  } catch (err: any) {
    return { conversationId: null, error: err?.message || 'Network error' };
  }
}

/**
 * Fetches all conversations for the given user, populated with partner profile,
 * last message, and unread counts.
 */
export async function fetchUserConversations(currentUserId: string): Promise<{
  conversations: Conversation[];
  error?: string;
}> {
  if (!currentUserId) return { conversations: [] };

  if (isSupabaseConfigured()) {
    try {
      // 1. Get all conversations current user is a member of
      const { data: memberRows, error: memberErr } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', currentUserId);

      if (memberErr || !memberRows || memberRows.length === 0) {
        return { conversations: [] };
      }

      const convIds = memberRows.map((r: any) => r.conversation_id);
      const readMap = new Map<string, string>();
      memberRows.forEach((r: any) => readMap.set(r.conversation_id, r.last_read_at));

      // 2. Fetch conversation records
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('last_message_at', { ascending: false });

      if (convErr || !convData) {
        return { conversations: [] };
      }

      // 3. Fetch all members and their profiles for these conversations
      const { data: allMembers, error: membersErr } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          user_id,
          joined_at,
          last_read_at,
          profile:profiles (
            id,
            display_name,
            username,
            avatar_url,
            is_verified,
            bio
          )
        `)
        .in('conversation_id', convIds);

      if (membersErr) {
        console.warn('[MessagingService] Error fetching member profiles:', membersErr.message);
      }

      // Group members by conversation
      const membersByConv = new Map<string, ConversationMember[]>();
      (allMembers || []).forEach((m: any) => {
        const list = membersByConv.get(m.conversation_id) || [];
        const prof = m.profile ? {
          id: m.profile.id,
          name: m.profile.display_name || 'Creator',
          username: m.profile.username || 'creator',
          avatar: m.profile.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + m.user_id,
          bio: m.profile.bio || '',
          isVerified: Boolean(m.profile.is_verified),
          joinDate: 'Joined recently',
          stats: { postsCount: 0, followersCount: 0, followingCount: 0, totalLikes: 0, reelsCount: 0 },
        } : undefined;

        list.push({
          conversationId: m.conversation_id,
          userId: m.user_id,
          joinedAt: m.joined_at,
          lastReadAt: m.last_read_at,
          profile: prof,
        });
        membersByConv.set(m.conversation_id, list);
      });

      // 4. Calculate unread counts
      const conversations: Conversation[] = [];

      for (const c of convData) {
        const members = membersByConv.get(c.id) || [];
        const partner = members.find((m) => m.userId !== currentUserId);
        const myLastRead = readMap.get(c.id) || c.created_at;

        // Count unread messages
        let unreadCount = 0;
        try {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .neq('sender_id', currentUserId)
            .gt('created_at', myLastRead);
          unreadCount = count || 0;
        } catch {}

        conversations.push({
          id: c.id,
          type: c.type || 'direct',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          lastMessageAt: c.last_message_at,
          lastMessagePreview: c.last_message_preview || '',
          members,
          unreadCount,
          partnerProfile: partner?.profile,
          partnerId: partner?.userId,
        });
      }

      return { conversations };
    } catch (err: any) {
      console.warn('[MessagingService] Error loading Supabase conversations:', err);
    }
  }

  // Fallback to Server API
  try {
    const res = await fetch(`/api/conversations?userId=${encodeURIComponent(currentUserId)}`);
    if (res.ok) {
      const data = await res.json();
      return { conversations: Array.isArray(data.conversations) ? data.conversations : [] };
    }
  } catch (err) {
    console.warn('[MessagingService] Server API error:', err);
  }

  return { conversations: [] };
}

/**
 * Fetches all chronological messages for a conversation
 */
export async function fetchConversationMessages(
  conversationId: string
): Promise<{ messages: Message[]; error?: string }> {
  if (!conversationId) return { messages: [] };

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          message_type,
          media_url,
          media_metadata,
          created_at,
          updated_at,
          is_read,
          sender:profiles (
            id,
            display_name,
            username,
            avatar_url,
            is_verified
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[MessagingService] Error fetching messages:', error.message);
        return { messages: [], error: error.message };
      }

      const mapped = (data || []).map((row: any) => mapSupabaseRowToMessage(row));

      // Resolve secure signed URLs for private message attachments
      const signedMessages = await Promise.all(
        mapped.map(async (msg) => {
          if (msg.mediaUrl && !msg.mediaUrl.startsWith('data:') && !msg.mediaUrl.startsWith('blob:')) {
            const signed = await resolveSignedMediaUrl(msg.mediaUrl, conversationId);
            return { ...msg, mediaUrl: signed };
          }
          return msg;
        })
      );

      return { messages: signedMessages };
    } catch (err: any) {
      console.warn('[MessagingService] Exception in fetchConversationMessages:', err);
    }
  }

  // Fallback to Server API
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`);
    if (res.ok) {
      const data = await res.json();
      return { messages: Array.isArray(data.messages) ? data.messages : [] };
    }
  } catch (err: any) {
    console.warn('[MessagingService] Server API messages error:', err);
  }

  return { messages: [] };
}

/**
 * Sends a new message (text, photo, video, or voice recording)
 */
export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  content?: string;
  messageType?: MessageType;
  mediaFile?: File | Blob;
  mediaMetadata?: MessageMediaMetadata;
  senderProfile?: UserProfile;
}): Promise<{ message: Message | null; error?: string }> {
  const {
    conversationId,
    senderId,
    content = '',
    messageType = 'text',
    mediaFile,
    mediaMetadata,
    senderProfile,
  } = params;

  if (!conversationId || !senderId) {
    return { message: null, error: 'Conversation ID and Sender ID are required' };
  }

  let finalMediaUrl: string | undefined = undefined;
  let finalMetadata: MessageMediaMetadata | undefined = mediaMetadata;

  // 1. Upload media directly to private 'messages' bucket if present
  if (mediaFile) {
    try {
      if (isSupabaseConfigured()) {
        const fileExt =
          mediaMetadata?.fileName?.split('.').pop() ||
          (messageType === 'video' ? 'mp4' : messageType === 'voice' ? 'webm' : 'jpg');
        const sanitizedFileName = (
          mediaMetadata?.fileName || `media.${fileExt}`
        ).replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Exact target path: ${conversationId}/${senderId}/${messageType}_${Date.now()}_${sanitizedFileName}
        // First folder: conversationId; Second folder: authenticated senderId
        const storagePath = `${conversationId}/${senderId}/${messageType}_${Date.now()}_${sanitizedFileName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('messages')
          .upload(storagePath, mediaFile, {
            contentType:
              mediaMetadata?.mimeType ||
              (mediaFile as any).type ||
              (messageType === 'video'
                ? 'video/mp4'
                : messageType === 'voice'
                ? 'audio/webm'
                : 'image/jpeg'),
            upsert: false,
          });

        if (!uploadErr && uploadData?.path) {
          finalMediaUrl = uploadData.path;
          finalMetadata = {
            ...mediaMetadata,
            size: mediaFile.size,
            mimeType: (mediaFile as any).type || mediaMetadata?.mimeType,
            fileName: sanitizedFileName,
          };
        } else if (uploadErr) {
          console.warn('[MessagingService] Private bucket upload notice:', uploadErr.message);
          // Fallback to storageService if bucket policies are currently updating
          const fallbackRes = await uploadMediaItem(mediaFile, {
            userId: senderId,
            type: messageType === 'video' ? 'video' : 'image',
            fileName: mediaMetadata?.fileName || `msg_${messageType}_${Date.now()}`,
          });
          if (fallbackRes?.url) {
            finalMediaUrl = fallbackRes.url;
            finalMetadata = {
              ...mediaMetadata,
              size: mediaFile.size,
              mimeType: (mediaFile as any).type,
              fileName: fallbackRes.fileName,
            };
          }
        }
      } else {
        // Fallback for non-Supabase local server
        const fallbackRes = await uploadMediaItem(mediaFile, {
          userId: senderId,
          type: messageType === 'video' ? 'video' : 'image',
          fileName: mediaMetadata?.fileName || `msg_${messageType}_${Date.now()}`,
        });
        if (fallbackRes?.url) {
          finalMediaUrl = fallbackRes.url;
          finalMetadata = {
            ...mediaMetadata,
            size: mediaFile.size,
            mimeType: (mediaFile as any).type,
            fileName: fallbackRes.fileName,
          };
        }
      }
    } catch (uploadErr) {
      console.warn('[MessagingService] Media upload error:', uploadErr);
      return { message: null, error: 'Failed to upload media attachment' };
    }
  }

  // 2. Insert into Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const insertPayload = {
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim(),
        message_type: messageType,
        media_url: finalMediaUrl || null,
        media_metadata: finalMetadata || {},
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(insertPayload)
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          message_type,
          media_url,
          media_metadata,
          created_at,
          updated_at,
          is_read
        `)
        .single();

      if (error) {
        console.warn('[MessagingService] Supabase insert message error:', error.message);
        throw error;
      }

      // Explicitly touch conversation last_message_at
      await supabase
        .from('conversations')
        .update({
          last_message_at: data.created_at,
          last_message_preview:
            messageType === 'image'
              ? '📷 Photo'
              : messageType === 'video'
              ? '🎥 Video'
              : messageType === 'voice'
              ? '🎤 Voice message'
              : content.substring(0, 80) || 'Sent a message',
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      const mapped = mapSupabaseRowToMessage(data, senderProfile);

      // Resolve signed URL for the newly created message media so sender sees it immediately
      if (mapped.mediaUrl && !mapped.mediaUrl.startsWith('data:') && !mapped.mediaUrl.startsWith('blob:')) {
        mapped.mediaUrl = await resolveSignedMediaUrl(mapped.mediaUrl, conversationId);
      }

      return { message: mapped };
    } catch (err: any) {
      console.warn('[MessagingService] Supabase error in sendMessage:', err);
    }
  }

  // Fallback to Server API
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        senderId,
        content: content.trim(),
        messageType,
        mediaUrl: finalMediaUrl,
        mediaMetadata: finalMetadata,
        senderProfile,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.message) {
        return { message: data.message };
      }
    }
    return { message: null, error: 'Failed to send message via server' };
  } catch (err: any) {
    return { message: null, error: err?.message || 'Network error' };
  }
}

/**
 * Updates last_read_at timestamp and marks incoming messages as read
 */
export async function markConversationAsRead(
  conversationId: string,
  currentUserId: string
): Promise<void> {
  if (!conversationId || !currentUserId) return;

  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('conversation_members')
        .update({ last_read_at: now })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId);
    } catch (err) {
      console.warn('[MessagingService] markConversationAsRead error:', err);
    }
  }

  try {
    await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentUserId }),
    });
  } catch {}
}

/**
 * Subscribes to Supabase Realtime channel for live messages in a specific conversation
 */
export function subscribeToConversationMessages(
  conversationId: string,
  onNewMessage: (msg: Message) => void
): () => void {
  if (!isSupabaseConfigured() || !conversationId) {
    // Return polling fallback for local development if Supabase Realtime is not active
    const interval = setInterval(async () => {
      try {
        const { messages } = await fetchConversationMessages(conversationId);
        if (messages && messages.length > 0) {
          const last = messages[messages.length - 1];
          onNewMessage(last);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }

  try {
    const channelName = `messages_${conversationId}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          if (payload?.new) {
            const mapped = mapSupabaseRowToMessage(payload.new);
            if (mapped.mediaUrl && !mapped.mediaUrl.startsWith('data:') && !mapped.mediaUrl.startsWith('blob:')) {
              resolveSignedMediaUrl(mapped.mediaUrl, conversationId)
                .then((signed) => onNewMessage({ ...mapped, mediaUrl: signed }))
                .catch(() => onNewMessage(mapped));
            } else {
              onNewMessage(mapped);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[MessagingService] Subscribed to real-time chat: ${conversationId}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[MessagingService] Realtime subscription error:', err);
    return () => {};
  }
}
