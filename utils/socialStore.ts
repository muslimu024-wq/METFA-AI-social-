import { SocialPage, SocialGroup, PostingIdentity, ReelHighlight, LiveStream, UserProfile } from '../types/community';
import { addNotification } from './notificationStore';
import { saveUserProfile, getUserProfile } from './communityStore';
import { safeSetItem, safeGetItem, safeRemoveItem } from './storageUtils';
import {
  AuthUser,
  getActiveSSOUser,
  persistSSOSession,
  ssoLoginWithPhone,
  ssoLoginWithGmail,
  ssoLogout,
  generateUniqueUsername,
  generateUnifiedMetfaId,
  GUEST_USER,
} from '../services/authService';
import { isSupabaseConfigured } from '../services/supabaseClient';

export type { AuthUser };

const AUTH_USER_KEY = 'metfa_auth_user_v2';
const PAGES_STORAGE_KEY = 'metfa_social_pages_v1';
const GROUPS_STORAGE_KEY = 'metfa_social_groups_v1';
const ACTIVE_IDENTITY_KEY = 'metfa_active_identity_v1';
const REELS_STORAGE_KEY = 'metfa_reels_v1';
const LIVE_STREAMS_KEY = 'metfa_live_streams_v1';

export const INITIAL_AUTH_USER: AuthUser = GUEST_USER;

export const INITIAL_PAGES: SocialPage[] = [];

export const isRealPage = (p: SocialPage): boolean => {
  if (!p || !p.id) return false;
  if (p.id === 'page_gemini_creators' || p.id === 'page_cyberpunk_art') return false;
  if (p.ownerId === 'creator_system_metfa') return false;
  return true;
};

export const INITIAL_GROUPS: SocialGroup[] = [];

export const isRealGroup = (g: SocialGroup): boolean => {
  if (!g || !g.id) return false;
  if (g.id === 'group_scene_inpainting' || g.id === 'group_bengali_prompters') return false;
  if (g.ownerId === 'creator_scene_lead' || g.ownerId === 'user_elena') return false;
  return true;
};

export const INITIAL_REELS: ReelHighlight[] = [];

export const isRealReel = (r: ReelHighlight): boolean => {
  if (!r || !r.id) return false;
  if (r.id === 'reel_1' || r.id === 'reel_2' || r.id === 'reel_kaito_1') return false;
  if (
    r.author?.name &&
    (r.author.name === 'Elena Rostova' ||
      r.author.name === 'Marcus Vance' ||
      r.author.name === 'Kaito Tanaka')
  ) {
    return false;
  }
  if (r.videoSrc && r.videoSrc.includes('gtv-videos-bucket/sample/')) return false;
  return true;
};

export const INITIAL_LIVE_STREAMS: LiveStream[] = [];

export const isRealLiveStream = (l: LiveStream): boolean => {
  if (!l || !l.id) return false;
  if (l.id === 'live_1') return false;
  if (l.host?.name === 'Elena Rostova' || l.host?.id === 'user_elena') return false;
  return true;
};

export { generateUniqueUsername, generateUnifiedMetfaId };

/**
 * Authentication management
 */
export const getAuthUser = (): AuthUser => {
  return getActiveSSOUser();
};

export const saveAuthUser = (user: AuthUser): void => {
  persistSSOSession(user);
};

export const loginWithPhone = async (phoneNumber: string, name: string): Promise<AuthUser> => {
  const res = await ssoLoginWithPhone(phoneNumber, name);
  const user = res.user;

  addNotification({
    type: 'system',
    title: 'Welcome to Metfa Social',
    message: `Logged in successfully with phone ${phoneNumber}. Unified Metfa ID: ${user.metfaId}.`,
    actor: {
      name: user.name,
      username: user.username,
      avatar: user.avatar,
    },
    linkTab: 'profile',
  });

  return user;
};

export const loginWithGmail = async (email: string, name: string, customAvatar?: string): Promise<AuthUser> => {
  const res = await ssoLoginWithGmail(email, name, customAvatar);
  const user = res.user;

  addNotification({
    type: 'system',
    title: 'Metfa Unified ID Connected',
    message: `Signed in as ${user.name} (${email}). Unified Metfa ID: ${user.metfaId}.`,
    actor: {
      name: user.name,
      username: user.username,
      avatar: user.avatar,
    },
    linkTab: 'profile',
  });

  return user;
};

export const logoutAuthUser = (): void => {
  ssoLogout();
};

export const getPages = (): SocialPage[] => {
  try {
    const raw = safeGetItem(PAGES_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.filter(isRealPage);
    }
  } catch (err) {
    console.error('Error loading pages:', err);
  }
  return [];
};

export const savePages = (pages: SocialPage[]): void => {
  safeSetItem(PAGES_STORAGE_KEY, JSON.stringify(pages.filter(isRealPage)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_pages_updated', { detail: pages }));
  }
};

export const createSocialPage = (page: Omit<SocialPage, 'id' | 'createdAt' | 'followersCount' | 'followingCount' | 'isFollowing'>): SocialPage => {
  const current = getPages();
  const auth = getAuthUser();
  const newPage: SocialPage = {
    ...page,
    id: `page_${Date.now()}`,
    ownerId: auth.id,
    followersCount: 1,
    followingCount: 0,
    isFollowing: true,
    createdAt: new Date().toISOString().split('T')[0],
  };
  const updated = [newPage, ...current];
  savePages(updated);

  addNotification({
    type: 'page_created',
    title: 'Creator Page Published',
    message: `Your page "${newPage.name}" is now live and ready to publish posts!`,
    actor: {
      name: newPage.name,
      username: newPage.username,
      avatar: newPage.avatar,
    },
    linkTab: 'pages',
  });

  return newPage;
};

export const toggleFollowPage = (pageId: string): SocialPage[] => {
  const current = getPages();
  const updated = current.map((page) => {
    if (page.id === pageId) {
      const isFollowing = !page.isFollowing;
      return {
        ...page,
        isFollowing,
        followersCount: isFollowing ? page.followersCount + 1 : Math.max(0, page.followersCount - 1),
      };
    }
    return page;
  });
  savePages(updated);
  return updated;
};

export const getGroups = (): SocialGroup[] => {
  try {
    const raw = safeGetItem(GROUPS_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.filter(isRealGroup);
    }
  } catch (err) {
    console.error('Error loading groups:', err);
  }
  return [];
};

export const saveGroups = (groups: SocialGroup[]): void => {
  safeSetItem(GROUPS_STORAGE_KEY, JSON.stringify(groups.filter(isRealGroup)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_groups_updated', { detail: groups }));
  }
};

export const createSocialGroup = (group: Omit<SocialGroup, 'id' | 'createdAt' | 'membersCount' | 'postsCount' | 'isJoined' | 'members'>): SocialGroup => {
  const current = getGroups();
  const auth = getAuthUser();
  const newGroup: SocialGroup = {
    ...group,
    id: `group_${Date.now()}`,
    ownerId: auth.id,
    membersCount: 1,
    postsCount: 0,
    isJoined: true,
    members: [auth.id],
    createdAt: new Date().toISOString().split('T')[0],
  };
  const updated = [newGroup, ...current];
  saveGroups(updated);

  addNotification({
    type: 'group_created',
    title: 'Community Group Created',
    message: `Your group "${newGroup.name}" has been launched!`,
    actor: {
      name: newGroup.name,
      username: newGroup.handle,
      avatar: newGroup.avatar,
    },
    linkTab: 'groups',
  });

  return newGroup;
};

export const toggleJoinGroup = (groupId: string): SocialGroup[] => {
  const current = getGroups();
  const updated = current.map((group) => {
    if (group.id === groupId) {
      const isJoined = !group.isJoined;
      return {
        ...group,
        isJoined,
        membersCount: isJoined ? group.membersCount + 1 : Math.max(1, group.membersCount - 1),
      };
    }
    return group;
  });
  saveGroups(updated);
  return updated;
};

export const getActiveIdentity = (): PostingIdentity => {
  try {
    const raw = safeGetItem(ACTIVE_IDENTITY_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.name && data.username) {
        if (isSupabaseConfigured()) {
          const isStale =
            data.id === 'usr_metfa_9281' ||
            data.id === 'user_default' ||
            data.username === 'alex.rivera' ||
            data.id?.startsWith('usr_') ||
            data.id?.startsWith('usr_google_');
          if (isStale) {
            safeRemoveItem(ACTIVE_IDENTITY_KEY);
            return {
              type: 'personal',
              id: GUEST_USER.id,
              name: GUEST_USER.name,
              username: GUEST_USER.username,
              avatar: GUEST_USER.avatar,
              badge: 'Guest',
            };
          }
        }
        return data;
      }
    }
  } catch (err) {
    console.error('Error getting active identity:', err);
  }

  const auth = getAuthUser();
  return {
    type: 'personal',
    id: auth.id,
    name: auth.name,
    username: auth.username,
    avatar: auth.avatar,
    badge: auth.isVerified ? 'Verified Creator' : (auth.authType === 'guest' ? 'Guest' : 'Creator'),
  };
};

export const setActiveIdentity = (identity: PostingIdentity): void => {
  safeSetItem(ACTIVE_IDENTITY_KEY, JSON.stringify(identity));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_identity_changed', { detail: identity }));
  }
};

export const getReelHighlights = (): ReelHighlight[] => {
  try {
    const raw = safeGetItem(REELS_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.filter(isRealReel);
    }
  } catch (err) {
    console.error('Error loading reels:', err);
  }
  return [];
};

export const saveReelHighlights = (reels: ReelHighlight[]): void => {
  // Cap reels to latest 20
  const trimmed = reels.filter(isRealReel).slice(0, 20);
  safeSetItem(REELS_STORAGE_KEY, JSON.stringify(trimmed));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_reels_updated', { detail: reels }));
  }
};

export const saveReelHighlight = (reel: ReelHighlight): void => {
  const current = getReelHighlights();
  const updated = [reel, ...current.filter((r) => r.id !== reel.id)];
  saveReelHighlights(updated);
};

export const incrementReelShares = (reelId: string): ReelHighlight[] => {
  const current = getReelHighlights();
  const updated = current.map((r) => {
    if (r.id === reelId) {
      return {
        ...r,
        sharesCount: (r.sharesCount || 0) + 1,
      };
    }
    return r;
  });
  saveReelHighlights(updated);
  return updated;
};

export const addReelHighlight = (reel: Omit<ReelHighlight, 'id' | 'likesCount' | 'commentsCount' | 'sharesCount' | 'createdAt'>): ReelHighlight => {
  const current = getReelHighlights();
  const newReel: ReelHighlight = {
    ...reel,
    id: `reel_${Date.now()}`,
    likesCount: 1,
    commentsCount: 0,
    sharesCount: 0,
    createdAt: 'Just now',
  };
  const updated = [newReel, ...current];
  saveReelHighlights(updated);
  return newReel;
};

export const getLiveStreams = (): LiveStream[] => {
  try {
    const raw = safeGetItem(LIVE_STREAMS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.filter(isRealLiveStream);
    }
  } catch (err) {
    console.error('Error loading live streams:', err);
  }
  return [];
};

export const saveLiveStreams = (streams: LiveStream[]): void => {
  safeSetItem(LIVE_STREAMS_KEY, JSON.stringify(streams.filter(isRealLiveStream)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_livestreams_updated', { detail: streams }));
  }
};

/**
 * Permanently deletes a reel from storage and broadcasts the update event.
 */
export const deleteReelHighlight = (reelId: string): ReelHighlight[] => {
  const current = getReelHighlights();
  const updated = current.filter((r) => r.id !== reelId);
  saveReelHighlights(updated);
  return updated;
};

/**
 * Updates an existing reel's metadata (title, caption).
 */
export const editReelHighlight = (reelId: string, updates: Partial<ReelHighlight>): ReelHighlight[] => {
  const current = getReelHighlights();
  const updated = current.map((r) => {
    if (r.id === reelId) {
      return {
        ...r,
        ...updates,
      };
    }
    return r;
  });
  saveReelHighlights(updated);
  return updated;
};

import {
  getStoredApiKeys,
  saveStoredApiKeys,
  clearStoredApiKeys,
  DEFAULT_API_KEYS,
  type AppApiKeys,
} from './apiKeysStore';

// =========================================================================
// API KEY & CLOUD ACCELERATION HELPERS
// =========================================================================
export {
  getStoredApiKeys,
  saveStoredApiKeys,
  clearStoredApiKeys,
  DEFAULT_API_KEYS,
  type AppApiKeys,
};

export const getCloudAccelerationStatus = () => {
  try {
    const keys = getStoredApiKeys();
    return {
      hasGemini: Boolean(keys.geminiApiKey && keys.geminiApiKey.trim().length > 3),
      hasOpenAI: Boolean(keys.openaiApiKey && keys.openaiApiKey.trim().length > 3),
      hasGrok: Boolean(keys.grokApiKey && keys.grokApiKey.trim().length > 3),
      hasClaude: Boolean(keys.claudeApiKey && keys.claudeApiKey.trim().length > 3),
      isAccelerated: Boolean(
        (keys.geminiApiKey && keys.geminiApiKey.trim().length > 3) ||
        (keys.openaiApiKey && keys.openaiApiKey.trim().length > 3) ||
        (keys.grokApiKey && keys.grokApiKey.trim().length > 3)
      ),
    };
  } catch {
    return {
      hasGemini: false,
      hasOpenAI: false,
      hasGrok: false,
      hasClaude: false,
      isAccelerated: false,
    };
  }
};


