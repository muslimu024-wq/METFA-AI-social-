import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  FollowRequestRecord,
  FollowRequestStatus,
  ProfilePrivacy,
  normalizeProfilePrivacy,
} from '../utils/privacyPolicy';
import { GUEST_AVATAR, sanitizeAvatarUrl } from './authService';

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
  profilePrivacy?: ProfilePrivacy;
}

export interface FollowOperationResult {
  success: boolean;
  isFollowing: boolean;
  alreadyFollowing?: boolean;
  requestStatus?: FollowRequestStatus | 'none';
  isPrivateAccount?: boolean;
  requiresMigration?: boolean;
  error?: string;
}

export interface FollowStatusResult {
  isFollowing: boolean;
  requestStatus?: FollowRequestStatus | 'none';
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidProfileUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

function isMissingColumnError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || msg.includes('profile_privacy');
}

function isMissingTableOrRpcError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('follow_requests') ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

/**
 * Batch-fetches `profile_privacy` for a list of user IDs.
 * Falls back gracefully when pre-migration DB lacks `profile_privacy`.
 */
export async function fetchProfilesPrivacyBatch(
  userIds: string[]
): Promise<Map<string, ProfilePrivacy>> {
  const result = new Map<string, ProfilePrivacy>();
  const validIds = Array.from(new Set(userIds.filter((id) => isValidProfileUuid(id))));
  if (validIds.length === 0 || !isSupabaseConfigured()) {
    return result;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, profile_privacy')
      .in('id', validIds);

    if (!error && Array.isArray(data)) {
      for (const row of data as any[]) {
        if (row?.id) {
          result.set(row.id, normalizeProfilePrivacy(row.profile_privacy));
        }
      }
      return result;
    }

    if (error && isMissingColumnError(error)) {
      // Pre-migration fallback: query /api/authors/:id for user metadata if needed (capped)
      const capped = validIds.slice(0, 12);
      await Promise.all(
        capped.map(async (uid) => {
          try {
            const res = await fetch(`/api/authors/${encodeURIComponent(uid)}`);
            if (res.ok) {
              const json = await res.json();
              if (json?.success && json?.profile?.profilePrivacy) {
                result.set(uid, normalizeProfilePrivacy(json.profile.profilePrivacy));
              }
            }
          } catch {}
        })
      );
    }
  } catch (err) {
    console.warn('[FollowService] Error fetching batch profile privacy:', err);
  }
  return result;
}

export async function fetchSingleProfilePrivacy(userId: string): Promise<ProfilePrivacy> {
  if (!isValidProfileUuid(userId)) return 'public';
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, profile_privacy')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) {
        return normalizeProfilePrivacy((data as any).profile_privacy);
      }
    } catch {}
  }

  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`/api/authors/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.profile?.profilePrivacy) {
          return normalizeProfilePrivacy(json.profile.profilePrivacy);
        }
      }
    }
  } catch {}

  return 'public';
}

/**
 * Authoritatively follows a target user in Supabase, or creates a Follow Request if the target has a Private Profile.
 * - Authenticated user identity is derived strictly from supabase.auth.getUser().
 * - Rejects self-follow and non-UUID targets.
 * - Handles duplicate follows & duplicate pending requests deterministically.
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

  if (followerId === targetUserId) {
    return { success: false, isFollowing: false, error: 'You cannot follow yourself' };
  }

  try {
    // 1. Prefer atomic SECURITY DEFINER RPC when migration has been applied
    const rpcRes = await supabase.rpc('request_or_follow_user', { p_target_id: targetUserId });
    if (!rpcRes.error && rpcRes.data) {
      const payload = rpcRes.data as any;
      if (payload.success === false) {
        return {
          success: false,
          isFollowing: Boolean(payload.is_following),
          error: payload.error || 'Failed to follow user',
        };
      }
      if (payload.status === 'pending') {
        return {
          success: true,
          isFollowing: false,
          requestStatus: 'pending',
          isPrivateAccount: true,
        };
      }
      return {
        success: true,
        isFollowing: true,
        alreadyFollowing: Boolean(payload.already_following),
        requestStatus: 'none',
        isPrivateAccount: Boolean(payload.is_private),
      };
    }

    // 2. Fallback when RPC does not exist yet
    if (rpcRes.error && !isMissingTableOrRpcError(rpcRes.error)) {
      return { success: false, isFollowing: false, error: rpcRes.error.message };
    }

    // Check if already following first
    const { data: existingFollow } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (existingFollow) {
      return { success: true, isFollowing: true, alreadyFollowing: true, requestStatus: 'none' };
    }

    const targetPrivacy = await fetchSingleProfilePrivacy(targetUserId);
    if (targetPrivacy === 'private') {
      // Never auto-insert into user_follows for a private profile
      const { error: reqError } = await supabase
        .from('follow_requests')
        .insert({
          requester_id: followerId,
          target_id: targetUserId,
          status: 'pending',
        })
        .select('id, status')
        .single();

      if (!reqError) {
        return {
          success: true,
          isFollowing: false,
          requestStatus: 'pending',
          isPrivateAccount: true,
        };
      }

      if (reqError.code === '23505' || reqError.message.toLowerCase().includes('unique')) {
        return {
          success: true,
          isFollowing: false,
          requestStatus: 'pending',
          isPrivateAccount: true,
        };
      }

      if (isMissingTableOrRpcError(reqError)) {
        return {
          success: false,
          isFollowing: false,
          requestStatus: 'none',
          isPrivateAccount: true,
          requiresMigration: true,
          error: 'Private follow requests require running the Phase 1 Privacy SQL migration on Supabase.',
        };
      }

      return { success: false, isFollowing: false, error: reqError.message };
    }

    // Public profile: direct follow insert
    const { error } = await supabase
      .from('user_follows')
      .insert({
        follower_id: followerId,
        following_id: targetUserId,
      })
      .select('id, created_at')
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
        return { success: true, isFollowing: true, alreadyFollowing: true, requestStatus: 'none' };
      }
      return { success: false, isFollowing: false, error: error.message };
    }

    return { success: true, isFollowing: true, requestStatus: 'none', isPrivateAccount: false };
  } catch (err: any) {
    return { success: false, isFollowing: false, error: err?.message || 'Failed to follow user' };
  }
}

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

    return { success: true, isFollowing: false, requestStatus: 'none' };
  } catch (err: any) {
    return { success: false, isFollowing: true, error: err?.message || 'Failed to unfollow user' };
  }
}

export async function cancelFollowRequest(targetUserId: string): Promise<FollowOperationResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, isFollowing: false, error: 'Supabase is not configured' };
  }
  if (!isValidProfileUuid(targetUserId)) {
    return { success: false, isFollowing: false, error: 'Invalid target user profile ID format' };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { success: false, isFollowing: false, error: 'Authentication required' };
  }

  const requesterId = authData.user.id;

  try {
    const rpcRes = await supabase.rpc('cancel_follow_request', { p_target_id: targetUserId });
    if (!rpcRes.error && rpcRes.data) {
      return { success: true, isFollowing: false, requestStatus: 'cancelled' };
    }

    if (rpcRes.error && !isMissingTableOrRpcError(rpcRes.error)) {
      return { success: false, isFollowing: false, error: rpcRes.error.message };
    }

    const { error } = await supabase
      .from('follow_requests')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('requester_id', requesterId)
      .eq('target_id', targetUserId)
      .eq('status', 'pending');

    if (error) {
      if (isMissingTableOrRpcError(error)) {
        return { success: true, isFollowing: false, requestStatus: 'cancelled' };
      }
      return { success: false, isFollowing: false, error: error.message };
    }

    return { success: true, isFollowing: false, requestStatus: 'cancelled' };
  } catch (err: any) {
    return { success: false, isFollowing: false, error: err?.message || 'Failed to cancel follow request' };
  }
}

export async function fetchFollowStatus(targetUserId: string): Promise<FollowStatusResult> {
  if (!isSupabaseConfigured() || !isValidProfileUuid(targetUserId)) {
    return { isFollowing: false, requestStatus: 'none' };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { isFollowing: false, requestStatus: 'none' };
  }

  const followerId = authData.user.id;

  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (!error && data) {
      return { isFollowing: true, requestStatus: 'none' };
    }

    // Check pending follow request
    try {
      const reqRes = await supabase
        .from('follow_requests')
        .select('id, status')
        .eq('requester_id', followerId)
        .eq('target_id', targetUserId)
        .eq('status', 'pending')
        .maybeSingle();

      if (!reqRes.error && reqRes.data) {
        return { isFollowing: false, requestStatus: 'pending' };
      }
    } catch {}

    return { isFollowing: false, requestStatus: 'none', error: error?.message };
  } catch (err: any) {
    return { isFollowing: false, requestStatus: 'none', error: err?.message };
  }
}

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

export async function fetchOutgoingPendingRequests(): Promise<{
  targetIds: Set<string>;
  error?: string;
  tableMissing?: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { targetIds: new Set() };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { targetIds: new Set() };
  }

  try {
    const { data, error } = await supabase
      .from('follow_requests')
      .select('target_id')
      .eq('requester_id', authData.user.id)
      .eq('status', 'pending');

    if (error) {
      if (isMissingTableOrRpcError(error)) {
        return { targetIds: new Set(), tableMissing: true };
      }
      return { targetIds: new Set(), error: error.message };
    }

    const targetIds = new Set<string>();
    for (const row of (data || []) as any[]) {
      if (row.target_id) targetIds.add(row.target_id);
    }
    return { targetIds };
  } catch (err: any) {
    return { targetIds: new Set(), error: err?.message };
  }
}

export async function fetchIncomingFollowRequests(): Promise<{
  requests: FollowRequestRecord[];
  error?: string;
  tableMissing?: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { requests: [] };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { requests: [] };
  }

  try {
    const { data, error } = await supabase
      .from('follow_requests')
      .select(`
        id,
        requester_id,
        target_id,
        status,
        created_at,
        updated_at,
        responded_at,
        requester:profiles!follow_requests_requester_id_fkey (
          id,
          display_name,
          username,
          avatar_url,
          is_verified
        )
      `)
      .eq('target_id', authData.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableOrRpcError(error)) {
        return { requests: [], tableMissing: true };
      }
      // Retry without explicit foreign-key hint if FK name differs
      const retry = await supabase
        .from('follow_requests')
        .select('id, requester_id, target_id, status, created_at, updated_at, responded_at')
        .eq('target_id', authData.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (retry.error) {
        if (isMissingTableOrRpcError(retry.error)) {
          return { requests: [], tableMissing: true };
        }
        return { requests: [], error: retry.error.message };
      }

      const rawList = (retry.data || []) as any[];
      const reqIds = Array.from(new Set(rawList.map((r) => r.requester_id).filter(isValidProfileUuid)));
      const profMap = new Map<string, any>();
      if (reqIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url, is_verified')
          .in('id', reqIds);
        for (const p of (profs || []) as any[]) {
          profMap.set(p.id, p);
        }
      }

      return {
        requests: rawList.map((row) => {
          const p = profMap.get(row.requester_id);
          const uname = p?.username || 'creator';
          return {
            id: row.id,
            requesterId: row.requester_id,
            targetId: row.target_id,
            status: row.status as FollowRequestStatus,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            respondedAt: row.responded_at,
            requesterProfile: {
              id: row.requester_id,
              name: p?.display_name || uname,
              username: uname,
              avatar: sanitizeAvatarUrl(p?.avatar_url, uname) || GUEST_AVATAR,
              isVerified: Boolean(p?.is_verified),
            },
          };
        }),
      };
    }

    const requests: FollowRequestRecord[] = ((data || []) as any[]).map((row) => {
      const p = row.requester;
      const uname = p?.username || 'creator';
      return {
        id: row.id,
        requesterId: row.requester_id,
        targetId: row.target_id,
        status: row.status as FollowRequestStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        respondedAt: row.responded_at,
        requesterProfile: {
          id: row.requester_id,
          name: p?.display_name || uname,
          username: uname,
          avatar: sanitizeAvatarUrl(p?.avatar_url, uname) || GUEST_AVATAR,
          isVerified: Boolean(p?.is_verified),
        },
      };
    });

    return { requests };
  } catch (err: any) {
    return { requests: [], error: err?.message };
  }
}

export async function respondToFollowRequest(
  requestId: string,
  action: 'approve' | 'decline'
): Promise<{
  success: boolean;
  requesterId?: string;
  status?: FollowRequestStatus;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }
  if (!requestId) {
    return { success: false, error: 'Request ID is required' };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { success: false, error: 'Authentication required' };
  }
  const targetId = authData.user.id;

  try {
    const rpcRes = await supabase.rpc('respond_to_follow_request', {
      p_request_id: requestId,
      p_action: action,
    });

    if (!rpcRes.error && rpcRes.data) {
      const payload = rpcRes.data as any;
      if (payload.success === false) {
        return { success: false, error: payload.error || 'Failed to respond to request' };
      }
      return {
        success: true,
        requesterId: payload.requester_id,
        status: payload.status as FollowRequestStatus,
      };
    }

    if (rpcRes.error && !isMissingTableOrRpcError(rpcRes.error)) {
      return { success: false, error: rpcRes.error.message };
    }

    // Fallback when RPC doesn't exist
    const { data: reqRow, error: fetchErr } = await supabase
      .from('follow_requests')
      .select('id, requester_id, target_id, status')
      .eq('id', requestId)
      .eq('target_id', targetId)
      .maybeSingle();

    if (fetchErr || !reqRow) {
      return { success: false, error: fetchErr?.message || 'Follow request not found' };
    }

    const nextStatus: FollowRequestStatus = action === 'approve' ? 'approved' : 'declined';
    const { error: updErr } = await supabase
      .from('follow_requests')
      .update({ status: nextStatus, responded_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('target_id', targetId)
      .eq('status', 'pending');

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    if (action === 'approve') {
      const { error: followErr } = await supabase
        .from('user_follows')
        .insert({
          follower_id: (reqRow as any).requester_id,
          following_id: targetId,
        });
      if (followErr && followErr.code !== '23505') {
        return { success: false, error: followErr.message };
      }
    }

    return {
      success: true,
      requesterId: (reqRow as any).requester_id,
      status: nextStatus,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to respond to follow request' };
  }
}

/**
 * Reconciles authoritative follower & following counts directly from `public.user_follows`.
 */
export async function reconcileProfileFollowCounts(
  userId: string
): Promise<{ followersCount: number; followingCount: number } | null> {
  if (!isSupabaseConfigured() || !isValidProfileUuid(userId)) {
    return null;
  }

  try {
    const [followersRes, followingRes] = await Promise.all([
      supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    if (followersRes.error || followingRes.error) {
      return null;
    }

    return {
      followersCount: typeof followersRes.count === 'number' ? followersRes.count : 0,
      followingCount: typeof followingRes.count === 'number' ? followingRes.count : 0,
    };
  } catch {
    return null;
  }
}

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

    const followers: FollowProfileSummary[] = (data || [])
      .map((row: any) => {
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
      })
      .filter((f) => Boolean(f.id));

    return { followers };
  } catch (err: any) {
    return { followers: [], error: err?.message };
  }
}

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

    const following: FollowProfileSummary[] = (data || [])
      .map((row: any) => {
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
      })
      .filter((f) => Boolean(f.id));

    return { following };
  } catch (err: any) {
    return { following: [], error: err?.message };
  }
}
