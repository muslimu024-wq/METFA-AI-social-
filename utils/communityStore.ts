import { CommunityPost, UserProfile, PostComment, VoiceComment } from '../types/community';
import { addNotification } from './notificationStore';

const POSTS_STORAGE_KEY = 'metfa_community_posts_v2';
const USER_PROFILE_KEY = 'metfa_user_profile_v2';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: 'user_default',
  name: 'Alex Rivera',
  username: 'alex.rivera',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  bio: 'Visual Concept Designer & AI Artist. Creating futuristic architectures, fantasy landscapes, and cinematic lighting studies.',
  location: 'Tokyo / Remote',
  website: 'https://metfa.ai/@alex.rivera',
  isVerified: true,
  joinDate: 'Joined January 2026',
  stats: {
    postsCount: 14,
    followersCount: 3840,
    followingCount: 420,
    totalLikes: 19200,
    reelsCount: 6,
  },
};

export const INITIAL_POSTS: CommunityPost[] = [
  {
    id: 'post_1',
    author: {
      id: 'user_elena',
      name: 'Elena Rostova',
      username: 'elena_ai',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    postingIdentity: {
      type: 'page',
      id: 'page_gemini_creators',
      name: 'Gemini AI Vision Lab',
      username: 'gemini.lab',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
      badge: 'Official Page',
    },
    pageId: 'page_gemini_creators',
    pageName: 'Gemini AI Vision Lab',
    pageCategory: 'Technology & AI',
    prompt: 'Hyper-realistic neon cyberpunk city at night with flying vehicles and glowing holographic signs, rain reflection on streets, 8k resolution, cinematic lighting',
    caption: 'Explored multi-layered neural inpainting with Gemini 3.7 Flash. The volumetric fog and wet pavement reflections are unreal! ✨ #MetfaAI #Cyberpunk #Inpainting',
    stylePreset: 'Cyberpunk 2088',
    imageSrc: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1000&auto=format&fit=crop&q=80',
    originalImageSrc: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1000&auto=format&fit=crop&q=80',
    likesCount: 542,
    remixCount: 128,
    commentsCount: 34,
    sharesCount: 89,
    isLiked: false,
    isBookmarked: false,
    comments: [
      {
        id: 'c_1',
        author: {
          id: 'user_marcus',
          name: 'Marcus Vance',
          username: 'marcus_vfx',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          isVerified: true,
        },
        text: 'The wet asphalt specular reflection is immaculate! Did you use the prompt enhancer tool?',
        timestamp: '1h ago',
        likesCount: 12,
      },
    ],
    voiceComments: [
      {
        id: 'vc_1',
        author: {
          id: 'user_alexa',
          name: 'Alexa Chen',
          username: 'alexa_design',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
          isVerified: false,
        },
        audioUrl: 'https://actions.google.com/sounds/v1/water/rain_heavy.ogg',
        duration: 8,
        timestamp: '45m ago',
        likesCount: 5,
        waveform: [20, 45, 80, 60, 90, 75, 40, 60, 85, 30],
      },
    ],
    createdAt: '2 hours ago',
    tags: ['Cyberpunk', 'GeminiVision', 'DigitalArt', '4K'],
    feedType: 'for_you',
  },
  {
    id: 'post_2',
    author: {
      id: 'user_marcus',
      name: 'Marcus Vance',
      username: 'marcus_vfx',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    postingIdentity: {
      type: 'group',
      id: 'group_scene_inpainting',
      name: 'Neural Scene Inpainters & Remakers',
      username: 'scene.inpainters',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
      badge: 'Community Group',
    },
    groupId: 'group_scene_inpainting',
    groupName: 'Neural Scene Inpainters & Remakers',
    prompt: 'Enchanted mossy ancient temple ruins submerged in crystal emerald waters, sunbeams piercing through jungle canopy, floating bioluminescent flora',
    caption: 'Experimented with prompt restructuring to achieve volumetric underwater lighting. What do you guys think? 🌿🏛️ #NatureArt #MetfaCreative',
    stylePreset: 'Fantasy Realm',
    imageSrc: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&auto=format&fit=crop&q=80',
    likesCount: 820,
    remixCount: 215,
    commentsCount: 58,
    sharesCount: 142,
    isLiked: true,
    isBookmarked: true,
    comments: [],
    createdAt: '4 hours ago',
    tags: ['Fantasy', 'ConceptArt', 'Photorealism', 'Nature'],
    feedType: 'trending',
  },
];

export const getCommunityPosts = (): CommunityPost[] => {
  try {
    const raw = localStorage.getItem(POSTS_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.error('Error loading community posts:', err);
  }
  return INITIAL_POSTS;
};

export const saveCommunityPosts = (posts: CommunityPost[]): void => {
  localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('metfa_posts_updated', { detail: posts }));
};

export const saveCommunityPost = (post: Omit<CommunityPost, 'id' | 'likesCount' | 'remixCount' | 'commentsCount' | 'sharesCount' | 'createdAt' | 'comments'>): CommunityPost => {
  const current = getCommunityPosts();
  const newPost: CommunityPost = {
    ...post,
    id: `post_${Date.now()}`,
    likesCount: 1,
    remixCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    isLiked: false,
    comments: [],
    voiceComments: [],
    createdAt: 'Just now',
  };

  const updated = [newPost, ...current];
  saveCommunityPosts(updated);

  addNotification({
    type: 'like',
    title: 'Post Published Successfully',
    message: `Your creation "${newPost.prompt.substring(0, 35)}..." was shared to the Metfa community feed!`,
    actor: {
      name: newPost.author.name,
      username: newPost.author.username,
      avatar: newPost.author.avatar,
    },
    linkTab: 'feed',
    thumbnail: newPost.imageSrc,
  });

  return newPost;
};

export const toggleLikePost = (postId: string): CommunityPost[] => {
  const current = getCommunityPosts();
  const updated = current.map((p) => {
    if (p.id === postId) {
      const isLiked = !p.isLiked;
      return {
        ...p,
        isLiked,
        likesCount: isLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
      };
    }
    return p;
  });
  saveCommunityPosts(updated);
  return updated;
};

export const getUserProfile = (): UserProfile => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.name && data.username) return data;
    }
  } catch (err) {
    console.error('Error loading user profile:', err);
  }
  return INITIAL_USER_PROFILE;
};

export const saveUserProfile = (profile: UserProfile): void => {
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent('metfa_profile_updated', { detail: profile }));
};
