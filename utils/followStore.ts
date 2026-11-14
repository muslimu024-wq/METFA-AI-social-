import { GUEST_AVATAR, sanitizeAvatarUrl } from '../services/authService';
import { safeGetItem, safeSetItem, safeRemoveItem } from './storageUtils';

export interface FollowedUser {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  followedAt: string;
}

const FOLLOW_STORAGE_KEY = 'metfa_followed_users';
export const FOLLOW_REQUESTS_KEY = 'metfa_follow_requests_v1';

/**
 * PHASE 2B / PRIVACY ARCHITECTURE NOTICE:
 * This store is strictly a client-side cache helper.
 * Supabase (`public.user_follows` & `public.follow_requests`) is the authoritative source of truth.
 */

export const getFollowedUsers = (): FollowedUser[] => {
  try {
    const raw = safeGetItem(FOLLOW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[FollowStore] Error reading cached followed users:', err);
    return [];
  }
};

export const getFollowedUserIds = (): string[] => {
  const users = getFollowedUsers();
  const ids: string[] = [];
  users.forEach((u) => {
    if (u.id) ids.push(u.id);
    if (u.username) ids.push(u.username.toLowerCase());
  });
  return ids;
};

export const isUserFollowed = (userIdOrUsername?: string | null): boolean => {
  if (!userIdOrUsername) return false;
  const target = userIdOrUsername.toLowerCase().trim();
  const followed = getFollowedUsers();
  return followed.some(
    (u) =>
      (u.id && u.id.toLowerCase() === target) ||
      (u.username && u.username.toLowerCase().replace(/^@/, '') === target.replace(/^@/, ''))
  );
};

/**
 * Authoritatively replaces the cached followed-users list from Supabase,
 * eliminating stale entries removed on another device or session.
 */
export const replaceFollowedUsersCache = (
  followedIds: Iterable<string>,
  profilesMap?: Map<string, { name?: string; username?: string; avatar?: string }>
): void => {
  const existingById = new Map<string, FollowedUser>();
  for (const u of getFollowedUsers()) {
    if (u.id) existingById.set(u.id, u);
  }

  const nowIso = new Date().toISOString();
  const nextList: FollowedUser[] = [];
  const seen = new Set<string>();

  for (const rawId of followedIds) {
    const id = String(rawId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const existing = existingById.get(id);
    const meta = profilesMap?.get(id);
    nextList.push({
      id,
      name: meta?.name || existing?.name || 'Creator',
      username: (meta?.username || existing?.username || id).replace(/^@/, ''),
      avatar: sanitizeAvatarUrl(meta?.avatar || existing?.avatar) || GUEST_AVATAR,
      followedAt: existing?.followedAt || nowIso,
    });
  }

  safeSetItem(FOLLOW_STORAGE_KEY, JSON.stringify(nextList));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('metfa_following_updated', {
        detail: {
          followedUsers: nextList,
          replacedAuthoritatively: true,
        },
      })
    );
  }
};

export const syncFollowCache = (
  user: {
    id?: string;
    name?: string;
    username?: string;
    avatar?: string;
  },
  isNowFollowing: boolean
): void => {
  const current = getFollowedUsers();
  const targetId = (user.id || '').trim();
  const targetUsername = (user.username || '').replace(/^@/, '').toLowerCase().trim();

  if (!targetId && !targetUsername) return;

  let updated: FollowedUser[];

  if (!isNowFollowing) {
    updated = current.filter((u) => {
      if (targetId && u.id && u.id === targetId) return false;
      if (targetUsername && u.username && u.username.toLowerCase().replace(/^@/, '') === targetUsername) {
        return false;
      }
      return true;
    });
  } else {
    const exists = current.some((u) => {
      if (targetId && u.id && u.id === targetId) return true;
      if (targetUsername && u.username && u.username.toLowerCase().replace(/^@/, '') === targetUsername) return true;
      return false;
    });

    if (exists) {
      updated = current;
    } else {
      const newFollowed: FollowedUser = {
        id: targetId,
        name: user.name || (targetUsername ? `@${targetUsername}` : 'Creator'),
        username: targetUsername || (targetId ? targetId : 'user'),
        avatar: sanitizeAvatarUrl(user.avatar) || GUEST_AVATAR,
        followedAt: new Date().toISOString(),
      };
      updated = [newFollowed, ...current];
    }
  }

  safeSetItem(FOLLOW_STORAGE_KEY, JSON.stringify(updated));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('metfa_following_updated', {
        detail: {
          followedUsers: updated,
          isFollowing: isNowFollowing,
          targetUser: user,
        },
      })
    );
  }
};

export const getPendingFollowRequestTargetIds = (): string[] => {
  try {
    const raw = safeGetItem(FOLLOW_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id.trim().length > 0) : [];
  } catch {
    return [];
  }
};

export const isFollowRequestPending = (targetUserId?: string | null): boolean => {
  if (!targetUserId) return false;
  const clean = targetUserId.trim();
  return getPendingFollowRequestTargetIds().includes(clean);
};

export const syncPendingFollowRequestCache = (targetId: string, isPending: boolean): void => {
  const clean = String(targetId || '').trim();
  if (!clean) return;
  const current = new Set(getPendingFollowRequestTargetIds());
  if (isPending) {
    current.add(clean);
  } else {
    current.delete(clean);
  }
  const next = Array.from(current);
  safeSetItem(FOLLOW_REQUESTS_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('metfa_follow_requests_updated', {
        detail: { pendingTargetIds: next, targetId: clean, isPending },
      })
    );
  }
};

export const replacePendingFollowRequestsCache = (targetIds: Iterable<string>): void => {
  const next = Array.from(
    new Set(
      Array.from(targetIds)
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );
  safeSetItem(FOLLOW_REQUESTS_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('metfa_follow_requests_updated', {
        detail: { pendingTargetIds: next, replacedAuthoritatively: true },
      })
    );
  }
};

export const clearFollowCache = (): void => {
  safeRemoveItem(FOLLOW_STORAGE_KEY);
  safeRemoveItem(FOLLOW_REQUESTS_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_following_updated', { detail: { followedUsers: [], isFollowing: false } }));
    window.dispatchEvent(new CustomEvent('metfa_follow_requests_updated', { detail: { pendingTargetIds: [] } }));
  }
};

/**
 * Legacy compatibility wrapper - redirects to syncFollowCache.
 */
export const toggleFollowUser = (user: {
  id?: string;
  name?: string;
  username?: string;
  avatar?: string;
}): { isFollowing: boolean; followedCount: number } => {
  const current = getFollowedUsers();
  const currentlyFollowing = isUserFollowed(user.id || user.username);
  const nextFollowing = !currentlyFollowing;
  syncFollowCache(user, nextFollowing);
  return { isFollowing: nextFollowing, followedCount: current.length + (nextFollowing ? 1 : -1) };
};
