import { GUEST_AVATAR, sanitizeAvatarUrl } from '../services/authService';

export interface FollowedUser {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  followedAt: string;
}

const FOLLOW_STORAGE_KEY = 'metfa_followed_users';

/**
 * Retrieves the list of followed users from localStorage.
 */
export const getFollowedUsers = (): FollowedUser[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FOLLOW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[FollowStore] Error reading followed users:', err);
    return [];
  }
};

/**
 * Returns an array of IDs and usernames for quick lookup.
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
 * Checks if a specific user/author is currently followed.
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
 * Toggles follow/unfollow for a given user or post author.
 * Updates localStorage, broadcasts an event, and returns the new follow state.
 */
export const toggleFollowUser = (user: {
  id?: string;
  name?: string;
  username?: string;
  avatar?: string;
}): { isFollowing: boolean; followedCount: number } => {
  if (typeof window === 'undefined') return { isFollowing: false, followedCount: 0 };

  const current = getFollowedUsers();
  const targetId = (user.id || '').trim();
  const targetUsername = (user.username || '').replace(/^@/, '').toLowerCase().trim();

  if (!targetId && !targetUsername) {
    return { isFollowing: false, followedCount: current.length };
  }

  const existingIndex = current.findIndex((u) => {
    if (targetId && u.id && u.id === targetId) return true;
    if (targetUsername && u.username && u.username.toLowerCase().replace(/^@/, '') === targetUsername) {
      return true;
    }
    return false;
  });

  let updated: FollowedUser[];
  let isNowFollowing = false;

  if (existingIndex >= 0) {
    // Unfollow
    updated = current.filter((_, idx) => idx !== existingIndex);
    isNowFollowing = false;
  } else {
    // Follow
    const newFollowed: FollowedUser = {
      id: targetId || `usr_${Date.now()}`,
      name: user.name || (targetUsername ? `@${targetUsername}` : 'Creator'),
      username: targetUsername || (targetId ? targetId : 'user'),
      avatar: sanitizeAvatarUrl(user.avatar) || GUEST_AVATAR,
      followedAt: new Date().toISOString(),
    };
    updated = [newFollowed, ...current];
    isNowFollowing = true;
  }

  try {
    localStorage.setItem(FOLLOW_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[FollowStore] Error saving followed users:', err);
  }

  // Notify listeners (feeds, profile stats, etc.)
  window.dispatchEvent(
    new CustomEvent('metfa_following_updated', {
      detail: {
        followedUsers: updated,
        isFollowing: isNowFollowing,
        targetUser: user,
      },
    })
  );

  return { isFollowing: isNowFollowing, followedCount: updated.length };
};
