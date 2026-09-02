import { CommunityPost, UserProfile, PostComment, VoiceComment } from '../types/community';
import { addNotification } from './notificationStore';
import { safeSetItem, safeGetItem, compressImageDataUrl } from './storageUtils';
import {
  fetchSupabasePosts,
  createSupabasePost,
  updateSupabasePost as doUpdateSupabasePost,
  deleteSupabasePost as doDeleteSupabasePost,
} from '../services/postService';
import { isSupabaseConfigured } from '../services/supabaseClient';

const POSTS_STORAGE_KEY = 'metfa_community_posts_v2';
const USER_PROFILE_KEY = 'metfa_user_profile_v2';

export const isUuid = (id?: string | null): boolean => {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

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
      {
        id: 'c_alex_2',
        author: {
          id: 'user_default',
          name: 'Alex Rivera',
          username: 'alex.rivera',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          isVerified: true,
        },
        text: 'The volumetric fog and wet pavement specular highlights look incredible! Great work Elena.',
        timestamp: '35m ago',
        likesCount: 6,
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
  {
    id: 'post_alex_1',
    author: {
      id: 'user_default',
      name: 'Alex Rivera',
      username: 'alex.rivera',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
    },
    prompt: 'Bioluminescent cybernetic jellyfish drifting through deep twilight ocean trench, iridescent volumetric light rays, 8k octane render',
    caption: 'Deep oceanic neural synthesis rendered with Gemini multimodal vision. Notice the subtle light refraction through the water! 🌊✨ #DeepOcean #OctaneRender #MetfaArt',
    stylePreset: 'Photorealistic Studio',
    imageSrc: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1000&auto=format&fit=crop&q=80',
    likesCount: 310,
    remixCount: 45,
    commentsCount: 2,
    sharesCount: 22,
    isLiked: true,
    isBookmarked: false,
    comments: [
      {
        id: 'c_alex_own',
        author: {
          id: 'user_default',
          name: 'Alex Rivera',
          username: 'alex.rivera',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          isVerified: true,
        },
        text: 'Used the custom prompt enhancer for this one, really helped with the bioluminescence balance!',
        timestamp: '30m ago',
        likesCount: 4,
      },
      {
        id: 'c_marcus_reply',
        author: {
          id: 'user_marcus',
          name: 'Marcus Vance',
          username: 'marcus_vfx',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          isVerified: true,
        },
        text: 'The caustic reflections on the tentacles look incredible Alex!',
        timestamp: '20m ago',
        likesCount: 2,
      },
    ],
    createdAt: '1 hour ago',
    tags: ['Underwater', 'Bioluminescence', '8K', 'DigitalArt'],
    feedType: 'for_you',
  },
];

export const getCommunityPosts = (): CommunityPost[] => {
  try {
    const raw = safeGetItem(POSTS_STORAGE_KEY);
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
  try {
    // Keep max 35 posts in storage to prevent quota overflow
    const trimmed = posts.slice(0, 35);
    safeSetItem(POSTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Error saving community posts:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_posts_updated', { detail: posts }));
  }
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

/**
 * Asynchronously loads posts from Supabase (if configured) and synchronizes them with the local cache.
 * Preserves initial seed posts for demo completeness while elevating persistent database posts.
 */
export const fetchAndSyncCommunityPosts = async (): Promise<CommunityPost[]> => {
  if (!isSupabaseConfigured()) {
    return getCommunityPosts();
  }

  try {
    const { posts: dbPosts, error } = await fetchSupabasePosts();
    if (error || !dbPosts) {
      return getCommunityPosts();
    }

    if (dbPosts.length > 0) {
      // Merge dbPosts with existing local/seed posts without duplicate IDs
      const local = getCommunityPosts();
      const dbIds = new Set(dbPosts.map((p) => p.id));
      const filteredLocal = local.filter((p) => !dbIds.has(p.id) && !isUuid(p.id));
      const combined = [...dbPosts, ...filteredLocal];
      saveCommunityPosts(combined);
      return combined;
    }
  } catch (err) {
    console.warn('[CommunityStore] Error during fetchAndSyncCommunityPosts:', err);
  }

  return getCommunityPosts();
};

/**
 * Asynchronously creates a post. If Supabase is configured and authorId is a valid UUID,
 * inserts the record into Supabase public.posts with Row Level Security.
 * Falls back to local persistent storage if Supabase is offline or for guest users.
 */
export const createPostAsync = async (
  post: Omit<CommunityPost, 'id' | 'likesCount' | 'remixCount' | 'commentsCount' | 'sharesCount' | 'createdAt' | 'comments'>,
  authorId?: string
): Promise<CommunityPost> => {
  if (isSupabaseConfigured() && authorId && isUuid(authorId)) {
    try {
      const { post: dbPost, error } = await createSupabasePost(post, authorId);
      if (dbPost && !error) {
        const current = getCommunityPosts();
        const updated = [dbPost, ...current.filter((p) => p.id !== dbPost.id)];
        saveCommunityPosts(updated);

        addNotification({
          type: 'like',
          title: 'Post Published Globally',
          message: `Your creation "${dbPost.prompt.substring(0, 35)}..." was published to Supabase database!`,
          actor: {
            name: dbPost.author.name,
            username: dbPost.author.username,
            avatar: dbPost.author.avatar,
          },
          linkTab: 'feed',
          thumbnail: dbPost.imageSrc,
        });

        return dbPost;
      }
      console.warn('[CommunityStore] Supabase post creation failed, falling back to local:', error);
    } catch (err) {
      console.warn('[CommunityStore] Exception during createPostAsync, falling back to local:', err);
    }
  }

  // Resilient fallback to local storage
  return saveCommunityPost(post);
};

/**
 * Asynchronously updates a community post's text, caption, prompt, tags, or styling presets.
 * If the post was created in Supabase (UUID), updates public.posts in Supabase.
 */
export const updatePostAsync = async (
  postId: string,
  updates: Partial<CommunityPost>,
  authorId?: string
): Promise<CommunityPost[]> => {
  if (isSupabaseConfigured() && isUuid(postId) && authorId && isUuid(authorId)) {
    try {
      await doUpdateSupabasePost(postId, updates, authorId);
    } catch (err) {
      console.warn('[CommunityStore] Error updating post in Supabase:', err);
    }
  }
  return updateCommunityPost(postId, updates);
};

/**
 * Asynchronously deletes a community post by ID.
 * If the post was created in Supabase (UUID), deletes from public.posts in Supabase.
 */
export const deletePostAsync = async (
  postId: string,
  authorId?: string
): Promise<CommunityPost[]> => {
  if (isSupabaseConfigured() && isUuid(postId) && authorId && isUuid(authorId)) {
    try {
      await doDeleteSupabasePost(postId, authorId);
    } catch (err) {
      console.warn('[CommunityStore] Error deleting post from Supabase:', err);
    }
  }
  return deleteCommunityPost(postId);
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

export const incrementPostShares = (postId: string): CommunityPost[] => {
  const current = getCommunityPosts();
  const updated = current.map((p) => {
    if (p.id === postId) {
      return {
        ...p,
        sharesCount: (p.sharesCount || 0) + 1,
      };
    }
    return p;
  });
  saveCommunityPosts(updated);
  return updated;
};

export const getUserProfile = (): UserProfile => {
  try {
    const raw = safeGetItem(USER_PROFILE_KEY);
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
  safeSetItem(USER_PROFILE_KEY, JSON.stringify(profile));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_profile_updated', { detail: profile }));
  }
};

/**
 * Validates whether the active user or profile owns the given post or comment.
 * Accepts either full author/user objects or string IDs.
 */
export const isContentOwner = (
  author: { id?: string; username?: string } | string | undefined | null,
  userProfile?: { id?: string; username?: string } | string | null,
  authUser?: { id?: string; username?: string } | string | null,
  postingIdentity?: { id?: string; username?: string } | string | null
): boolean => {
  if (!author) return false;

  const authorId = typeof author === 'string' ? author : author.id;
  const authorUsername = typeof author === 'string' ? undefined : author.username;

  const getId = (item?: { id?: string; username?: string } | string | null) =>
    typeof item === 'string' ? item : item?.id;
  const getUsername = (item?: { id?: string; username?: string } | string | null) =>
    typeof item === 'string' ? undefined : item?.username;

  const validIds = [
    getId(userProfile),
    getId(authUser),
    'user_default',
    'usr_metfa_9281',
  ].filter(Boolean) as string[];

  const validUsernames = [
    getUsername(userProfile)?.toLowerCase(),
    getUsername(authUser)?.toLowerCase(),
    'alex.rivera',
  ].filter(Boolean) as string[];

  if (authorId && validIds.includes(authorId)) return true;
  if (authorUsername && validUsernames.includes(authorUsername.toLowerCase())) return true;
  
  const postIdentityId = getId(postingIdentity);
  if (postIdentityId && validIds.includes(postIdentityId)) return true;
  const postIdentityUsername = getUsername(postingIdentity);
  if (postIdentityUsername && validUsernames.includes(postIdentityUsername.toLowerCase())) return true;

  return false;
};

/**
 * Updates a community post's text, caption, prompt, tags, or styling presets.
 */
export const updateCommunityPost = (postId: string, updates: Partial<CommunityPost>): CommunityPost[] => {
  const current = getCommunityPosts();
  const updated = current.map((p) => {
    if (p.id === postId) {
      return {
        ...p,
        ...updates,
      };
    }
    return p;
  });
  saveCommunityPosts(updated);
  return updated;
};

/**
 * Permanently removes a community post by ID from storage and dispatches state update.
 */
export const deleteCommunityPost = (postId: string): CommunityPost[] => {
  const current = getCommunityPosts();
  const updated = current.filter((p) => p.id !== postId);
  saveCommunityPosts(updated);
  return updated;
};

/**
 * Updates the text of an existing comment on a post.
 */
export const updateComment = (postId: string, commentId: string, newText: string): CommunityPost[] => {
  const current = getCommunityPosts();
  const updated = current.map((p) => {
    if (p.id === postId) {
      const updatedComments = (p.comments || []).map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            text: newText.trim(),
          };
        }
        return c;
      });
      return {
        ...p,
        comments: updatedComments,
      };
    }
    return p;
  });
  saveCommunityPosts(updated);
  return updated;
};

/**
 * Deletes a comment from a post and decrements commentsCount.
 */
export const deleteComment = (postId: string, commentId: string): CommunityPost[] => {
  const current = getCommunityPosts();
  const updated = current.map((p) => {
    if (p.id === postId) {
      const updatedComments = (p.comments || []).filter((c) => c.id !== commentId);
      return {
        ...p,
        comments: updatedComments,
        commentsCount: Math.max(0, (p.commentsCount || 1) - 1),
      };
    }
    return p;
  });
  saveCommunityPosts(updated);
  return updated;
};

/**
 * Deletes a voice comment from a post and decrements commentsCount.
 */
export const deleteVoiceComment = (postId: string, voiceCommentId: string): CommunityPost[] => {
  const current = getCommunityPosts();
  const updated = current.map((p) => {
    if (p.id === postId) {
      const updatedVoice = (p.voiceComments || []).filter((v) => v.id !== voiceCommentId);
      return {
        ...p,
        voiceComments: updatedVoice,
        commentsCount: Math.max(0, (p.commentsCount || 1) - 1),
      };
    }
    return p;
  });
  saveCommunityPosts(updated);
  return updated;
};

