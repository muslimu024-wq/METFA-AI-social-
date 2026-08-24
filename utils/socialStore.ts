import { SocialPage, SocialGroup, PostingIdentity, ReelHighlight, LiveStream } from '../types/community';
import { addNotification } from './notificationStore';

const PAGES_STORAGE_KEY = 'metfa_social_pages_v1';
const GROUPS_STORAGE_KEY = 'metfa_social_groups_v1';
const ACTIVE_IDENTITY_KEY = 'metfa_active_identity_v1';
const REELS_STORAGE_KEY = 'metfa_reels_v1';
const LIVE_STREAMS_KEY = 'metfa_live_streams_v1';

export const INITIAL_PAGES: SocialPage[] = [
  {
    id: 'page_gemini_creators',
    ownerId: 'user_default',
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
    ownerId: 'user_default',
    name: 'Neo Tokyo Cyber Aesthetics',
    username: 'neotokyo.art',
    handle: '@neotokyo.art',
    description: 'Cyberpunk, synthwave, futuristic UI designs, and neon-lit cityscape concept art rendered through Metfa AI.',
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
    ownerId: 'user_default',
    members: ['user_default', 'user_elena', 'user_marcus'],
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
    isLiked: false,
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
    isLiked: true,
    createdAt: '5h ago',
    promptUsed: 'A colossal emerald forest dragon resting on mossy ancient boulders, cinematic rim lighting',
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

export const getPages = (): SocialPage[] => {
  try {
    const raw = localStorage.getItem(PAGES_STORAGE_KEY);
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
  localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
  window.dispatchEvent(new CustomEvent('metfa_pages_updated', { detail: pages }));
};

export const createSocialPage = (page: Omit<SocialPage, 'id' | 'createdAt' | 'followersCount' | 'followingCount' | 'isFollowing'>): SocialPage => {
  const current = getPages();
  const newPage: SocialPage = {
    ...page,
    id: `page_${Date.now()}`,
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
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
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
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  window.dispatchEvent(new CustomEvent('metfa_groups_updated', { detail: groups }));
};

export const createSocialGroup = (group: Omit<SocialGroup, 'id' | 'createdAt' | 'membersCount' | 'postsCount' | 'isJoined' | 'members'>): SocialGroup => {
  const current = getGroups();
  const newGroup: SocialGroup = {
    ...group,
    id: `group_${Date.now()}`,
    membersCount: 1,
    postsCount: 0,
    isJoined: true,
    members: ['user_default'],
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
    const raw = localStorage.getItem(ACTIVE_IDENTITY_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.name && data.username) return data;
    }
  } catch (err) {
    console.error('Error getting active identity:', err);
  }

  return {
    type: 'personal',
    id: 'user_default',
    name: 'You (Creator)',
    username: 'metfa.creator',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    badge: 'Pro Artist',
  };
};

export const setActiveIdentity = (identity: PostingIdentity): void => {
  localStorage.setItem(ACTIVE_IDENTITY_KEY, JSON.stringify(identity));
  window.dispatchEvent(new CustomEvent('metfa_identity_changed', { detail: identity }));
};

export const getReelHighlights = (): ReelHighlight[] => {
  try {
    const raw = localStorage.getItem(REELS_STORAGE_KEY);
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
  localStorage.setItem(REELS_STORAGE_KEY, JSON.stringify(reels));
  window.dispatchEvent(new CustomEvent('metfa_reels_updated', { detail: reels }));
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
    const raw = localStorage.getItem(LIVE_STREAMS_KEY);
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
  localStorage.setItem(LIVE_STREAMS_KEY, JSON.stringify(streams));
  window.dispatchEvent(new CustomEvent('metfa_livestreams_updated', { detail: streams }));
};
