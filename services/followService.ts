import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface FollowRelationship {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface FollowProfileSummary {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isVerified?: boolean;
  bio?: string;
  followedAt: string;
}

export interface FollowOperationResult {
  success: boolean;
  isFollowing: boolean;
  alreadyFollowing?: boolean;
  error?: string;
}

export interface FollowStatusResult {
  isFollowing: boolean;
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that an ID is a valid standard UUID string.
 */
export function isValidProfileUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Authoritatively follows a target user in Supabase.
 * - Authenticated user identity is derived strictly from supabase.auth.getUser().
 * - Caller cannot specify follower_id.
 * - Rejects self-follow and non-UUID targets.
 * - Handles duplicate follows deterministically.
 */
export async function followUser(targetUserId: string): Promise<FollowOperationResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, isFollowing: false, error: 'Supabase is not configured' };
  }

  if (!isValidProfileUuid(targetUserId)) {
    return { success: false, isFollowing: false, error: 'Invalid target user profile ID format' };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { success: false, isFollowing: false, error: 'Authentication required to follow users' };
  }

  const followerId = authData.user.id;

  // Strict invariant: Cannot follow oneself
  if (followerId === targetUserId) {
    return { success: false, isFollowing: false, error: 'You cannot follow yourself' };
  }

  try {
    const { data, error } = await supabase
      .from('user_follows')
      .insert({
        follower_id: followerId,
        following_id: targetUserId,
      })
      .select('id, created_at')
      .single();

    if (error) {
      // Deterministic handling for duplicate follows (23505 unique violation)
      if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
        return { success: true, isFollowing: true, alreadyFollowing: true };
      }
      return { success: false, isFollowing: false, error: error.message };
    }

    return { success: true, isFollowing: true };
  } catch (err: any) {
    return { success: false, isFollowing: false, error: err?.message || 'Failed to follow user' };
  }
}

/**
 * Authoritatively unfollows a target user in Supabase.
 * - Authenticated user identity is derived strictly from supabase.auth.getUser().
 * - Only the follower can delete the relationship.
 */
export async function unfollowUser(targetUserId: string): Promise<FollowOperationResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, isFollowing: true, error: 'Supabase is not configured' };
  }

  if (!isValidProfileUuid(targetUserId)) {
    return { success: false, isFollowing: true, error: 'Invalid target user profile ID format' };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { success: false, isFollowing: true, error: 'Authentication required to unfollow users' };
  }

  const followerId = authData.user.id;

  try {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', targetUserId);

    if (error) {
      return { success: false, isFollowing: true, error: error.message };
    }

    return { success: true, isFollowing: false };
  } catch (err: any) {
    return { success: false, isFollowing: true, error: err?.message || 'Failed to unfollow user' };
  }
}

/**
 * Checks if the authenticated user follows the given target user in Supabase.
 */
export async function fetchFollowStatus(targetUserId: string): Promise<FollowStatusResult> {
  if (!isSupabaseConfigured() || !isValidProfileUuid(targetUserId)) {
    return { isFollowing: false };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { isFollowing: false };
  }

  const followerId = authData.user.id;

  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (error || !data) {
      return { isFollowing: false, error: error?.message };
    }

    return { isFollowing: true };
  } catch (err: any) {
    return { isFollowing: false, error: err?.message };
  }
}

/**
 * Batch-loads all followed profile UUIDs for the authenticated user in a SINGLE query.
 * Eliminates N+1 queries in feeds and component lists.
 * Returns a Set<string> for instant O(1) membership checks.
 */
export async function fetchFollowedUserIds(): Promise<{ followedIds: Set<string>; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { followedIds: new Set() };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { followedIds: new Set() };
  }

  const followerId = authData.user.id;

  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', followerId);

    if (error) {
      return { followedIds: new Set(), error: error.message };
    }

    const ids = new Set<string>();
    if (data && Array.isArray(data)) {
      for (const row of data) {
        if (row.following_id) {
          ids.add(row.following_id);
        }
      }
    }

    return { followedIds: ids };
  } catch (err: any) {
    return { followedIds: new Set(), error: err?.message };
  }
}

/**
 * Authoritatively fetches list of users who follow the target user.
 */
export async function fetchFollowers(targetUserId: string): Promise<{ followers: FollowProfileSummary[]; error?: string }> {
  if (!isSupabaseConfigured() || !isValidProfileUuid(targetUserId)) {
    return { followers: [] };
  }

  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select(`
        created_at,
        follower:profiles!user_follows_follower_id_fkey (
          id,
          display_name,
          username,
          avatar_url,
          is_verified,
          bio
        )
      `)
      .eq('following_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) {
      return { followers: [], error: error.message };
    }

    const followers: FollowProfileSummary[] = (data || []).map((row: any) => {
      const p = row.follower;
      return {
        id: p?.id || '',
        displayName: p?.display_name || p?.username || 'Metfa Creator',
        username: p?.username || 'creator',
        avatarUrl: p?.avatar_url,
        isVerified: !!p?.is_verified,
        bio: p?.bio,
        followedAt: row.created_at,
      };
    }).filter(f => Boolean(f.id));

    return { followers };
  } catch (err: any) {
    return { followers: [], error: err?.message };
  }
}

/**
 * Authoritatively fetches list of users followed by the target user.
 */
export async function fetchFollowing(targetUserId: string): Promise<{ following: FollowProfileSummary[]; error?: string }> {
  if (!isSupabaseConfigured() || !isValidProfileUuid(targetUserId)) {
    return { following: [] };
  }

  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select(`
        created_at,
        following:profiles!user_follows_following_id_fkey (
          id,
          display_name,
          username,
          avatar_url,
          is_verified,
          bio
        )
      `)
      .eq('follower_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) {
      return { following: [], error: error.message };
    }

    const following: FollowProfileSummary[] = (data || []).map((row: any) => {
      const p = row.following;
      return {
        id: p?.id || '',
        displayName: p?.display_name || p?.username || 'Metfa Creator',
        username: p?.username || 'creator',
        avatarUrl: p?.avatar_url,
        isVerified: !!p?.is_verified,
        bio: p?.bio,
        followedAt: row.created_at,
      };
    }).filter(f => Boolean(f.id));

    return { following };
  } catch (err: any) {
    return { following: [], error: err?.message };
  }
}
