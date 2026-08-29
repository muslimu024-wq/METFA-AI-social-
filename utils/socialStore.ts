import { SocialPage, SocialGroup, PostingIdentity, ReelHighlight, LiveStream, UserProfile } from '../types/community';
import { addNotification } from './notificationStore';
import { saveUserProfile, getUserProfile } from './communityStore';
import { safeSetItem, safeGetItem } from './storageUtils';
import {
  AuthUser,
  getActiveSSOUser,
  persistSSOSession,
  ssoLoginWithPhone,
  ssoLoginWithGmail,
  ssoLogout,
  generateUniqueUsername,
  generateUnifiedMetfaId
} from '../services/authService';

export type { AuthUser };

const AUTH_USER_KEY = 'metfa_auth_user_v2';
const PAGES_STORAGE_KEY = 'metfa_social_pages_v1';
const GROUPS_STORAGE_KEY = 'metfa_social_groups_v1';
const ACTIVE_IDENTITY_KEY = 'metfa_active_identity_v1';
const REELS_STORAGE_KEY = 'metfa_reels_v1';
const LIVE_STREAMS_KEY = 'metfa_live_streams_v1';

export const INITIAL_AUTH_USER: AuthUser = {
  id: 'usr_metfa_9281',
  metfaId: 'MID-9281-ALEX',
  name: 'Alex Rivera',
  username: 'alex.rivera',
  authType: 'gmail',
  phoneOrEmail: 'alex.rivera.ai@gmail.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  sessionToken: '',
  tokenExpiry: 0,
  createdAt: '2026-01-10',
  isVerified: true,
};

export const INITIAL_PAGES: SocialPage[] = [
  {
    id: 'page_gemini_creators',
    ownerId: 'usr_metfa_9281',
    name: 'Gemini AI Vision Lab',
    username: 'gemini.lab',
    handle: '@gemini.lab',
    description: 'Official Metfa community page highlighting cutting-edge Gemini Vision breakthroughs, prompt engineering secrets, and neural inpainting.',
    category: 'Technology & AI',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1000&auto=format&fit=crop&q=80',
    isVerified: true,
    followersCount: 4280,
    followingCount: 12,
    isFollowing: true,
    createdAt: '2026-01-15',
    tags: ['AI', 'Gemini', 'GenerativeVision', 'Inpainting'],
  },
  {
    id: 'page_cyberpunk_art',
    ownerId: 'usr_metfa_9281',
    name: 'Neo Tokyo Cyber Aesthetics',
    username: 'neotokyo.art',
    handle: '@neotokyo.art',
    description: 'Cyberpunk, synthwave, futuristic UI designs, and neon-lit cityscape concept art rendered through Metfa Social.',
    category: 'Digital Art & Design',
    avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1000&auto=format&fit=crop&q=80',
    isVerified: true,
    followersCount: 8940,
    followingCount: 45,
    isFollowing: false,
    createdAt: '2026-02-01',
    tags: ['Cyberpunk', 'DigitalArt', 'ConceptArt', 'Neon'],
  },
];

export const INITIAL_GROUPS: SocialGroup[] = [
  {
    id: 'group_scene_inpainting',
    name: 'Neural Scene Inpainters & Remakers',
    handle: '@scene.inpainters',
    description: 'Collaborative group for sharing before/after AI transformations, prompt recipes, and high-resolution photo restoration tips.',
    category: 'Creative Hub',
    privacy: 'public',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1000&auto=format&fit=crop&q=80',
    membersCount: 1530,
    postsCount: 384,
    isJoined: true,
    ownerId: 'usr_metfa_9281',
    members: ['usr_metfa_9281', 'user_elena', 'user_marcus'],
    rules: [
      'Share positive creative feedback',
      'Always share prompts or style presets when requested',
      'Keep content respectful and safe',
    ],
    createdAt: '2026-01-20',
  },
  {
    id: 'group_bengali_prompters',
    name: 'বাংলা AI প্রম্পট ও ক্রিয়েটিভ ক্লাব',
    handle: '@bangla.ai.creators',
    description: 'বাংলা ভাষায় প্রম্পট লিখে বিশ্বমানের আর্ট ও কোড তৈরি করার সবচেয়ে বড় কমিউনিটি।',
    category: 'Language & Culture',
    privacy: 'public',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1000&auto=format&fit=crop&q=80',
    membersCount: 3420,
    postsCount: 912,
    isJoined: false,
    ownerId: 'user_elena',
    members: ['user_elena', 'user_marcus'],
    rules: ['বাংলা বা ইংরেজি উভয় ভাষায় আলোচনা করা যাবে', 'স্প্যামিং সম্পূর্ণ নিষেধ'],
    createdAt: '2026-02-10',
  },
];

export const INITIAL_REELS: ReelHighlight[] = [
  {
    id: 'reel_1',
    title: 'Cyberpunk City Transformation In 10s',
    caption: 'Turned a rainy street snapshot into high-octane 2088 Neo Tokyo using Metfa Studio with gemini-3.7-flash! 🚀✨ #MetfaAI #Reels',
    author: {
      id: 'user_elena',
      name: 'Elena Rostova',
      username: 'elena_ai',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailSrc: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    duration: 15,
    likesCount: 1420,
    commentsCount: 88,
    sharesCount: 154,
    savesCount: 128,
    isLiked: false,
    isSaved: false,
    createdAt: '2h ago',
    promptUsed: 'Hyper-realistic neon cyberpunk city at night with flying vehicles and glowing holographic signs',
  },
  {
    id: 'reel_2',
    title: 'Fantasy Dragon Forest Inpainting',
    caption: 'Watch how subtle brush strokes turned into an epic mythical creature emerging from misty mountain pines. 🔥🐉',
    author: {
      id: 'user_marcus',
      name: 'Marcus Vance',
      username: 'marcus_vfx',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailSrc: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    duration: 22,
    likesCount: 2890,
    commentsCount: 194,
    sharesCount: 310,
    savesCount: 245,
    isLiked: true,
    isSaved: true,
    createdAt: '5h ago',
    promptUsed: 'A colossal emerald forest dragon resting on mossy ancient boulders, cinematic rim lighting',
  },
  {
    id: 'reel_alex_1',
    title: 'Cyberpunk Drone Chase - 4K Inpainted',
    caption: 'Dynamic lighting test rendered using Gemini 3.7 Flash & 4K super-resolution upscaling! 🌆✨ #NeoTokyo #MetfaCreative',
    author: {
      id: 'usr_metfa_9281',
      name: 'Alex Rivera',
      username: 'alex.rivera',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailSrc: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    duration: 18,
    likesCount: 940,
    commentsCount: 42,
    sharesCount: 78,
    savesCount: 86,
    isLiked: true,
    isSaved: false,
    createdAt: '1h ago',
    promptUsed: 'Futuristic police drone flying between neon holographic skyscrapers in torrential rain',
  },
];

export const INITIAL_LIVE_STREAMS: LiveStream[] = [
  {
    id: 'live_1',
    title: '🔴 Live AI Scene Generation & Inpainting Workshop',
    description: 'Live tutorial taking viewer suggestions and transforming them into 4K wallpaper concepts.',
    host: {
      id: 'user_elena',
      name: 'Elena Rostova',
      username: 'elena_ai',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    category: 'Creative Design & AI',
    viewersCount: 248,
    likesCount: 890,
    isLive: true,
    thumbnailUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80',
    tags: ['LiveDesign', 'GeminiVision', 'CreativeStudio'],
    startedAt: '15m ago',
  },
];

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

export const loginWithPhone = (phoneNumber: string, name: string): AuthUser => {
  const user = ssoLoginWithPhone(phoneNumber, name);

  addNotification({
    type: 'login',
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

export const loginWithGmail = (email: string, name: string, customAvatar?: string): AuthUser => {
  const user = ssoLoginWithGmail(email, name, customAvatar);

  addNotification({
    type: 'login',
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
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error loading pages:', err);
  }
  return INITIAL_PAGES;
};

export const savePages = (pages: SocialPage[]): void => {
  safeSetItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
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
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error loading groups:', err);
  }
  return INITIAL_GROUPS;
};

export const saveGroups = (groups: SocialGroup[]): void => {
  safeSetItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
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
      if (data && data.name && data.username) return data;
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
    badge: auth.isVerified ? 'Verified Creator' : 'Creator',
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
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error loading reels:', err);
  }
  return INITIAL_REELS;
};

export const saveReelHighlights = (reels: ReelHighlight[]): void => {
  // Cap reels to latest 20
  const trimmed = reels.slice(0, 20);
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
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error loading live streams:', err);
  }
  return INITIAL_LIVE_STREAMS;
};

export const saveLiveStreams = (streams: LiveStream[]): void => {
  safeSetItem(LIVE_STREAMS_KEY, JSON.stringify(streams));
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

