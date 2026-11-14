import { GUEST_AVATAR, sanitizeAvatarUrl } from '../services/authService';
import { safeGetItem, safeSetItem } from './storageUtils';

export interface FollowedUser {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  followedAt: string;
}

const FOLLOW_STORAGE_KEY = 'metfa_followed_users';

/**
 * PHASE 2B ARCHITECTURE NOTICE:
 * This store is strictly a client-side offline/UI cache helper.
 * Supabase (`public.user_follows`) is the sole authoritative source of truth for follows.
 * Local storage records are NEVER blindly pushed or migrated to Supabase.
 */

/**
 * Retrieves the list of cached followed users from localStorage.
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

/**
 * Returns an array of IDs and usernames for quick local lookup.
 */
export const getFollowedUserIds = (): string[] => {
  const users = getFollowedUsers();
  const ids: string[] = [];
  users.forEach((u) => {
    if (u.id) ids.push(u.id);
    if (u.username) ids.push(u.username.toLowerCase());
  });
  return ids;
};

/**
 * Non-authoritative synchronous cache check (for offline/initial render only).
 */
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
 * Updates the local cache in response to an authoritative Supabase follow/unfollow action.
 * Does NOT generate fake IDs or write unbacked data.
 */
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
    // Remove from cache
    updated = current.filter((u) => {
      if (targetId && u.id && u.id === targetId) return false;
      if (targetUsername && u.username && u.username.toLowerCase().replace(/^@/, '') === targetUsername) {
        return false;
      }
      return true;
    });
  } else {
    // Add to cache if not already present
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

  // Notify listeners in browser context
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

/**
 * Legacy compatibility wrapper - redirects to syncFollowCache.
 * Marked as legacy compatibility; UI components now invoke followService directly.
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
