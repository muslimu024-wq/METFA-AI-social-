/**
 * METFA SOCIAL — Engagement Service (Comments & Reactions)
 * Authoritative Supabase persistence layer for Comments and Reactions
 * 
 * Cryptographic identity boundary:
 * - All mutations strictly derive user identity from `supabase.auth.getUser()`
 * - Client-supplied user IDs are NEVER trusted as authority
 * - Strictly guarded by Database RLS & PostgreSQL triggers
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { PostComment } from '../types/community';
import { getDefaultAvatar } from './authService';

export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'fire';

export const VALID_REACTION_TYPES: readonly ReactionType[] = [
  'like',
  'love',
  'haha',
  'wow',
  'sad',
  'fire',
] as const;

export interface PostReactionBreakdown {
  totalCount: number;
  breakdown: { [k in ReactionType]?: number };
  userReaction: ReactionType | null;
}

export interface EngagementSummary {
  postId: string;
  commentsCount: number;
  likesCount: number;
  userReaction: ReactionType | null;
  reactionCounts: { [k in ReactionType]?: number };
  commentsPreview: PostComment[];
}

/**
 * Maps a raw Supabase post_comments database row (joined with profiles) to PostComment
 */
export function mapRowToPostComment(row: any): PostComment {
  const profile = row.author || row.profiles || {};
  const authorName = profile.display_name || profile.username || 'Metfa User';
  const authorUsername = profile.username || 'user';
  const authorAvatar = profile.avatar_url?.trim() || getDefaultAvatar(authorUsername);

  let timestamp = 'Just now';
  if (row.created_at) {
    try {
      const createdDate = new Date(row.created_at);
      const diffMs = Date.now() - createdDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        timestamp = 'Just now';
      } else if (diffMins < 60) {
        timestamp = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        timestamp = `${diffHours}h ago`;
      } else if (diffDays < 7) {
        timestamp = `${diffDays}d ago`;
      } else {
        timestamp = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      timestamp = 'Recently';
    }
  }

  return {
    id: row.id,
    author: {
      id: row.user_id,
      name: authorName,
      username: authorUsername,
      avatar: authorAvatar,
      isVerified: profile.is_verified ?? true,
    },
    text: row.content,
    timestamp,
    likesCount: 0,
    isLiked: false,
  };
}

// ============================================================================
// 1. COMMENTS API
// ============================================================================

/**
 * Fetches all persistent comments for a specific post in chronological order.
 */
export async function fetchComments(
  postId: string
): Promise<{ comments: PostComment[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { comments: [] };
  }

  if (!postId) {
    return { comments: [], error: 'Post ID is required' };
  }

  try {
    const { data, error } = await supabase
      .from('post_comments')
      .select(`
        id,
        post_id,
        user_id,
        content,
        audio_url,
        audio_duration,
        created_at,
        updated_at,
        author:profiles (
          id,
          display_name,
          username,
          avatar_url,
          is_verified
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[EngagementService] Error fetching comments:', error.message);
      return { comments: [], error: error.message };
    }

    if (!data || !Array.isArray(data)) {
      return { comments: [] };
    }

    const comments = data.map(mapRowToPostComment);
    return { comments };
  } catch (err: any) {
    console.warn('[EngagementService] Unexpected error in fetchComments:', err);
    return { comments: [], error: err?.message || 'Network error fetching comments' };
  }
}

/**
 * Creates an authoritative comment in Supabase.
 * Strictly derives author user ID from authenticated session.
 */
export async function createComment(
  postId: string,
  content: string,
  audioMetadata?: { audioUrl?: string; duration?: number }
): Promise<{ comment: PostComment | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { comment: null, error: 'Database is not configured' };
  }

  const cleanContent = content?.trim() || '';
  if (!cleanContent) {
    return { comment: null, error: 'Comment content cannot be empty' };
  }

  if (cleanContent.length > 3000) {
    return { comment: null, error: 'Comment exceeds maximum allowed length of 3000 characters' };
  }

  try {
    // Cryptographically resolve author identity from Supabase session
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return { comment: null, error: 'Authentication required to post a comment' };
    }

    const userId = authData.user.id;

    const insertPayload = {
      post_id: postId,
      user_id: userId,
      content: cleanContent,
      audio_url: audioMetadata?.audioUrl || null,
      audio_duration: audioMetadata?.duration || null,
    };

    const { data, error } = await supabase
      .from('post_comments')
      .insert(insertPayload)
      .select(`
        id,
        post_id,
        user_id,
        content,
        audio_url,
        audio_duration,
        created_at,
        updated_at,
        author:profiles (
          id,
          display_name,
          username,
          avatar_url,
          is_verified
        )
      `)
      .single();

    if (error) {
      console.warn('[EngagementService] Error creating comment:', error.message);
      return { comment: null, error: error.message };
    }

    if (!data) {
      return { comment: null, error: 'No data returned after comment creation' };
    }

    const comment = mapRowToPostComment(data);
    return { comment };
  } catch (err: any) {
    console.warn('[EngagementService] Unexpected error in createComment:', err);
    return { comment: null, error: err?.message || 'Failed to create comment' };
  }
}

/**
 * Updates an authoritative comment in Supabase.
 * Guarded by RLS (only comment owner can update).
 */
export async function updateComment(
  commentId: string,
  content: string
): Promise<{ comment: PostComment | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { comment: null, error: 'Database is not configured' };
  }

  const cleanContent = content?.trim() || '';
  if (!cleanContent) {
    return { comment: null, error: 'Comment content cannot be empty' };
  }

  if (cleanContent.length > 3000) {
    return { comment: null, error: 'Comment exceeds maximum allowed length of 3000 characters' };
  }

  try {
    const { data, error } = await supabase
      .from('post_comments')
      .update({ content: cleanContent })
      .eq('id', commentId)
      .select(`
        id,
        post_id,
        user_id,
        content,
        audio_url,
        audio_duration,
        created_at,
        updated_at,
        author:profiles (
          id,
          display_name,
          username,
          avatar_url,
          is_verified
        )
      `)
      .single();

    if (error) {
      console.warn('[EngagementService] Error updating comment:', error.message);
      return { comment: null, error: error.message };
    }

    if (!data) {
      return { comment: null, error: 'Comment not found or permission denied' };
    }

    const comment = mapRowToPostComment(data);
    return { comment };
  } catch (err: any) {
    console.warn('[EngagementService] Unexpected error in updateComment:', err);
    return { comment: null, error: err?.message || 'Failed to update comment' };
  }
}

/**
 * Deletes an authoritative comment from Supabase.
 * Guarded by RLS (only comment owner or post author can delete).
 */
export async function deleteComment(
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database is not configured' };
  }

  if (!commentId) {
    return { success: false, error: 'Comment ID is required' };
  }

  try {
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.warn('[EngagementService] Error deleting comment:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[EngagementService] Unexpected error in deleteComment:', err);
    return { success: false, error: err?.message || 'Failed to delete comment' };
  }
}

// ============================================================================
// 2. REACTIONS API
// ============================================================================

/**
 * Fetches all persistent reactions for a specific post and summarizes breakdown.
 */
export async function fetchPostReactions(
  postId: string
): Promise<{ breakdown: PostReactionBreakdown; error?: string }> {
  const empty: PostReactionBreakdown = {
    totalCount: 0,
    breakdown: {},
    userReaction: null,
  };

  if (!isSupabaseConfigured() || !postId) {
    return { breakdown: empty };
  }

  try {
    // Current authenticated user if available
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;

    const { data, error } = await supabase
      .from('post_reactions')
      .select('user_id, reaction_type')
      .eq('post_id', postId);

    if (error) {
      console.warn('[EngagementService] Error fetching reactions:', error.message);
      return { breakdown: empty, error: error.message };
    }

    if (!data || !Array.isArray(data)) {
      return { breakdown: empty };
    }

    const counts: { [k in ReactionType]?: number } = {};
    let currentUserReaction: ReactionType | null = null;

    for (const row of data) {
      const type = row.reaction_type as ReactionType;
      counts[type] = (counts[type] || 0) + 1;
      if (currentUserId && row.user_id === currentUserId) {
        currentUserReaction = type;
      }
    }

    return {
      breakdown: {
        totalCount: data.length,
        breakdown: counts,
        userReaction: currentUserReaction,
      },
    };
  } catch (err: any) {
    console.warn('[EngagementService] Unexpected error in fetchPostReactions:', err);
    return { breakdown: empty, error: err?.message };
  }
}

/**
 * Fetches the current authenticated user's reaction for a specific post.
 */
export async function getUserReactionForPost(
  postId: string
): Promise<{ reaction: ReactionType | null; error?: string }> {
  if (!isSupabaseConfigured() || !postId) {
    return { reaction: null };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return { reaction: null };
    }

    const { data, error } = await supabase
      .from('post_reactions')
      .select('reaction_type')
      .eq('post_id', postId)
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (error) {
      return { reaction: null, error: error.message };
    }

    return { reaction: (data?.reaction_type as ReactionType) || null };
  } catch (err: any) {
    return { reaction: null, error: err?.message };
  }
}

/**
 * Sets or toggles a reaction on a post:
 * - If user has no reaction -> creates reaction
 * - If user clicks the exact same reaction -> removes reaction (toggle off)
 * - If user clicks a different reaction -> updates existing reaction type (no count change)
 * 
 * Returns the resulting action: 'added' | 'removed' | 'updated'
 */
export async function toggleReaction(
  postId: string,
  reactionType: ReactionType = 'like'
): Promise<{
  action: 'added' | 'removed' | 'updated';
  reaction: ReactionType | null;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { action: 'removed', reaction: null, error: 'Database is not configured' };
  }

  if (!VALID_REACTION_TYPES.includes(reactionType)) {
    return { action: 'removed', reaction: null, error: `Invalid reaction type: ${reactionType}` };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return { action: 'removed', reaction: null, error: 'Authentication required to react to a post' };
    }

    const userId = authData.user.id;

    // 1. Check existing reaction
    const { data: existing, error: fetchErr } = await supabase
      .from('post_reactions')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.warn('[EngagementService] Error checking existing reaction:', fetchErr.message);
      return { action: 'removed', reaction: null, error: fetchErr.message };
    }

    // 2A. If same reaction already active -> REMOVE (toggle off)
    if (existing && existing.reaction_type === reactionType) {
      const { error: delErr } = await supabase
        .from('post_reactions')
        .delete()
        .eq('id', existing.id);

      if (delErr) {
        return { action: 'removed', reaction: reactionType, error: delErr.message };
      }
      return { action: 'removed', reaction: null };
    }

    // 2B. If different reaction already active -> UPDATE type
    if (existing && existing.reaction_type !== reactionType) {
      const { error: updateErr } = await supabase
        .from('post_reactions')
        .update({ reaction_type: reactionType })
        .eq('id', existing.id);

      if (updateErr) {
        return { action: 'updated', reaction: existing.reaction_type as ReactionType, error: updateErr.message };
      }
      return { action: 'updated', reaction: reactionType };
    }

    // 2C. No existing reaction -> INSERT new reaction
    const { error: insertErr } = await supabase
      .from('post_reactions')
      .insert({
        post_id: postId,
        user_id: userId,
        reaction_type: reactionType,
      });

    if (insertErr) {
      console.warn('[EngagementService] Error inserting reaction:', insertErr.message);
      return { action: 'added', reaction: null, error: insertErr.message };
    }

    return { action: 'added', reaction: reactionType };
  } catch (err: any) {
    console.warn('[EngagementService] Unexpected error in toggleReaction:', err);
    return { action: 'removed', reaction: null, error: err?.message || 'Failed to update reaction' };
  }
}

/**
 * Removes any active reaction the authenticated user has on a post.
 */
export async function removeReaction(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !postId) {
    return { success: false, error: 'Invalid configuration or post ID' };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return { success: false, error: 'Authentication required' };
    }

    const { error } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', authData.user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// ============================================================================
// 3. EFFICIENT BATCH FETCHING FOR FEEDS
// ============================================================================

/**
 * Batches engagement data (reactions and preview comments) for multiple posts in single queries.
 * Prevents N+1 database queries on feed rendering.
 */
export async function batchFetchEngagement(
  postIds: string[]
): Promise<Map<string, EngagementSummary>> {
  const result = new Map<string, EngagementSummary>();
  if (!isSupabaseConfigured() || !postIds || postIds.length === 0) {
    return result;
  }

  // Filter to valid UUIDs
  const validUuids = postIds.filter(
    (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );

  if (validUuids.length === 0) {
    return result;
  }

  try {
    // Resolve current user for active reaction tracking
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;

    // Parallel fetch: reactions and recent comments for all posts in set
    const [reactionsRes, commentsRes] = await Promise.all([
      supabase
        .from('post_reactions')
        .select('post_id, user_id, reaction_type')
        .in('post_id', validUuids),
      supabase
        .from('post_comments')
        .select(`
          id,
          post_id,
          user_id,
          content,
          audio_url,
          audio_duration,
          created_at,
          updated_at,
          author:profiles (
            id,
            display_name,
            username,
            avatar_url,
            is_verified
          )
        `)
        .in('post_id', validUuids)
        .order('created_at', { ascending: true }),
    ]);

    // Initialize summary map
    for (const pid of validUuids) {
      result.set(pid, {
        postId: pid,
        commentsCount: 0,
        likesCount: 0,
        userReaction: null,
        reactionCounts: {},
        commentsPreview: [],
      });
    }

    // Aggregate reactions
    if (reactionsRes.data && Array.isArray(reactionsRes.data)) {
      for (const row of reactionsRes.data) {
        const item = result.get(row.post_id);
        if (item) {
          const type = row.reaction_type as ReactionType;
          item.reactionCounts[type] = (item.reactionCounts[type] || 0) + 1;
          item.likesCount += 1;
          if (currentUserId && row.user_id === currentUserId) {
            item.userReaction = type;
          }
        }
      }
    }

    // Aggregate comments
    if (commentsRes.data && Array.isArray(commentsRes.data)) {
      for (const row of commentsRes.data) {
        const item = result.get(row.post_id);
        if (item) {
          item.commentsCount += 1;
          item.commentsPreview.push(mapRowToPostComment(row));
        }
      }
    }

    return result;
  } catch (err) {
    console.warn('[EngagementService] Error in batchFetchEngagement:', err);
    return result;
  }
}
