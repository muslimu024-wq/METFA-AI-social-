import { CommunityPost, UserProfile, PostComment, VoiceComment } from '../types/community';
import { addNotification } from './notificationStore';
import { safeSetItem, safeGetItem, safeRemoveItem, compressImageDataUrl } from './storageUtils';
import {
  fetchSupabasePosts,
  fetchSupabasePostById,
  createSupabasePost,
  updateSupabasePost as doUpdateSupabasePost,
  deleteSupabasePost as doDeleteSupabasePost,
} from '../services/postService';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { uploadMediaItem } from '../services/storageService';
import { GUEST_AVATAR, sanitizeAvatarUrl } from '../services/authService';

const POSTS_STORAGE_KEY = 'metfa_community_posts_v2';
const USER_PROFILE_KEY = 'metfa_user_profile_v2';

export const isUuid = (id?: string | null): boolean => {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

export const INITIAL_USER_PROFILE: UserProfile = {
  id: '',
  name: 'Guest',
  username: 'guest',
  avatar: GUEST_AVATAR,
  bio: '',
  location: '',
  website: '',
  isVerified: false,
  joinDate: '',
  stats: {
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    totalLikes: 0,
    reelsCount: 0,
  },
};

/**
 * Known legacy dummy/seed post IDs and author names to purge from feed
 */
const DUMMY_POST_IDS = new Set([
  'post_1',
  'post_2',
  'post_3',
  'post_4',
  'post_mateo_1',
  'user_elena',
  'user_marcus',
  'user_mateo',
]);

const DUMMY_AUTHOR_NAMES = new Set([
  'Elena Rostova',
  'Marcus Vance',
  'Mateo Silva',
  'Alexa Chen',
  'Alex Rivera',
]);

/**
 * Filter helper to ensure no dummy/demo posts contaminate the feed
 */
export const isRealPost = (p: CommunityPost): boolean => {
  if (!p || !p.id) return false;
  if (DUMMY_POST_IDS.has(p.id)) return false;
  if (p.author?.name && DUMMY_AUTHOR_NAMES.has(p.author.name)) return false;
  if (p.author?.id && DUMMY_POST_IDS.has(p.author.id)) return false;
  return true;
};

/**
 * Production empty initial posts array. Real posts MUST be loaded from Supabase.
 */
export const INITIAL_POSTS: CommunityPost[] = [];

/**
 * Extracts a target postId from a URL hash string.
 * Supports: #post-post_1788406851913, #post-uuid, #post_1788406851913, #post/123
 */
export const extractPostIdFromHash = (rawHash?: string | null): string | null => {
  if (!rawHash) return null;
  const cleaned = rawHash.replace(/^#\/?/, '').trim();
  if (!cleaned) return null;

  if (cleaned.startsWith('post-')) {
    return cleaned.substring(5).trim();
  }
  if (cleaned.startsWith('post_')) {
    return cleaned.trim();
  }
  return null;
};

/**
 * Matches a post against a target ID extracted from hash or URL, accounting for "post-" prefixes.
 */
export const matchesPostId = (post: CommunityPost, targetId: string): boolean => {
  if (!post || !targetId) return false;
  const t = targetId.toLowerCase().trim();
  const pid = (post.id || '').toLowerCase().trim();
  return (
    pid === t ||
    pid === `post-${t}` ||
    `post-${pid}` === t ||
    `post-${pid}` === `post-${t}`
  );
};

export const getCommunityPosts = (): CommunityPost[] => {
  try {
    const raw = safeGetItem(POSTS_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        const sanitized = data.filter(isRealPost);
        return sanitized;
      }
    }
  } catch (err) {
    console.error('Error loading community posts:', err);
  }
  return [];
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

const OWNED_POSTS_STORAGE_KEY = 'metfa_my_owned_post_ids';
const IDB_COMMUNITY_DB = 'metfa_community_posts_db';
const IDB_COMMUNITY_STORE = 'posts';

function openCommunityIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(IDB_COMMUNITY_DB, 1);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(IDB_COMMUNITY_STORE)) {
        db.createObjectStore(IDB_COMMUNITY_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePostsToIDB(posts: CommunityPost[]): Promise<void> {
  try {
    const db = await openCommunityIDB();
    const tx = db.transaction(IDB_COMMUNITY_STORE, 'readwrite');
    const store = tx.objectStore(IDB_COMMUNITY_STORE);
    for (const p of posts) {
      if (isRealPost(p)) {
        store.put(p);
      }
    }
  } catch (err) {
    console.warn('[CommunityStore] IDB write error:', err);
  }
}

export async function getPostsFromIDB(): Promise<CommunityPost[]> {
  try {
    const db = await openCommunityIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_COMMUNITY_STORE, 'readonly');
      const store = tx.objectStore(IDB_COMMUNITY_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as CommunityPost[]) || [];
        resolve(list.filter(isRealPost));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deletePostFromIDB(postId: string): Promise<void> {
  try {
    const db = await openCommunityIDB();
    const tx = db.transaction(IDB_COMMUNITY_STORE, 'readwrite');
    tx.objectStore(IDB_COMMUNITY_STORE).delete(postId);
  } catch {}
}

export async function fetchServerPosts(): Promise<CommunityPost[]> {
  try {
    const res = await fetch('/api/posts');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.posts)) {
        return data.posts.filter(isRealPost);
      }
    }
  } catch (err) {
    console.warn('[CommunityStore] Error fetching from /api/posts:', err);
  }
  return [];
}

export async function saveServerPost(post: CommunityPost): Promise<void> {
  try {
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    });
  } catch (err) {
    console.warn('[CommunityStore] Error saving post to /api/posts:', err);
  }
}

export async function updateServerPost(postId: string, updates: Partial<CommunityPost>): Promise<void> {
  try {
    await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch (err) {
    console.warn('[CommunityStore] Error updating post on /api/posts:', err);
  }
}

export async function deleteServerPost(postId: string): Promise<void> {
  try {
    await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[CommunityStore] Error deleting post on /api/posts:', err);
  }
}

export const recordOwnedPostId = (postId: string): void => {
  if (typeof window === 'undefined' || !postId) return;
  try {
    const raw = localStorage.getItem(OWNED_POSTS_STORAGE_KEY);
    const set = new Set(raw ? JSON.parse(raw) : []);
    set.add(postId);
    localStorage.setItem(OWNED_POSTS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('[CommunityStore] Error saving owned post id:', err);
  }
};

export const isLocallyOwnedPost = (postId?: string): boolean => {
  if (typeof window === 'undefined' || !postId) return false;
  try {
    const raw = localStorage.getItem(OWNED_POSTS_STORAGE_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(postId);
  } catch {
    return false;
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

  recordOwnedPostId(newPost.id);
  const updated = [newPost, ...current];
  saveCommunityPosts(updated);
  savePostsToIDB(updated);
  saveServerPost(newPost);

  addNotification({
    type: 'like',
    title: 'Post Published Successfully',
    message: `Your creation "${(newPost.videoTitle || newPost.prompt).substring(0, 35)}..." was shared to the Metfa community feed!`,
    actor: {
      name: newPost.author.name,
      username: newPost.author.username,
      avatar: newPost.author.avatar,
    },
    linkTab: 'feed',
    thumbnail: newPost.imageSrc || newPost.videoThumbnail,
  });

  return newPost;
};

/**
 * Asynchronously loads posts from Supabase, Server Disk API, and IndexedDB,
 * ensuring posts survive browser refresh, reopening the website, and navigating away.
 */
export const fetchAndSyncCommunityPosts = async (): Promise<CommunityPost[]> => {
  let dbPosts: CommunityPost[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { posts, error } = await fetchSupabasePosts();
      if (!error && posts) {
        dbPosts = posts.filter(isRealPost);
      }
    } catch (err) {
      console.warn('[CommunityStore] Error during fetchSupabasePosts:', err);
    }
  }

  // Also fetch from server persistent disk database
  const serverPosts = await fetchServerPosts();

  // Also load from IndexedDB
  const idbPosts = await getPostsFromIDB();

  // Local storage posts
  const localPosts = getCommunityPosts();

  // Merge sources: Supabase > Server API > IndexedDB > LocalStorage
  const postMap = new Map<string, CommunityPost>();
  for (const p of localPosts) postMap.set(p.id, p);
  for (const p of idbPosts) postMap.set(p.id, p);
  for (const p of serverPosts) postMap.set(p.id, p);
  for (const p of dbPosts) postMap.set(p.id, p);

  const authoritativePosts = Array.from(postMap.values()).filter(isRealPost);

  // Sort newest first
  authoritativePosts.sort((a, b) => {
    const timeA = (a as any).created_at ? new Date((a as any).created_at).getTime() : (parseInt(a.id.replace(/\D/g, '')) || 0);
    const timeB = (b as any).created_at ? new Date((b as any).created_at).getTime() : (parseInt(b.id.replace(/\D/g, '')) || 0);
    return timeB - timeA;
  });

  saveCommunityPosts(authoritativePosts);
  savePostsToIDB(authoritativePosts);

  return authoritativePosts;
};

/**
 * Asynchronously creates a post with guaranteed persistence:
 * 1. Uploads any Base64 media to Supabase Storage or server disk
 * 2. If Supabase is configured and authorId is valid, inserts into Supabase public.posts
 * 3. Persists to server disk (/api/posts)
 * 4. Saves to IndexedDB and local storage
 */
export const createPostAsync = async (
  post: Omit<CommunityPost, 'id' | 'likesCount' | 'remixCount' | 'commentsCount' | 'sharesCount' | 'createdAt' | 'comments'>,
  authorId?: string
): Promise<CommunityPost> => {
  let resolvedAuthorId = authorId;
  const postToSave = { ...post };

  // 1. Upload Base64 video if present to get permanent HTTP URL
  if (postToSave.videoSrc && postToSave.videoSrc.startsWith('data:')) {
    try {
      const upload = await uploadMediaItem(postToSave.videoSrc, {
        userId: resolvedAuthorId,
        type: 'video',
        fileName: `${postToSave.videoTitle || 'video'}.mp4`,
      });
      if (upload?.url) {
        postToSave.videoSrc = upload.url;
      }
    } catch (e) {
      console.warn('[CommunityStore] Error uploading video:', e);
    }
  }

  // 2. Upload Base64 image if present
  if (postToSave.imageSrc && postToSave.imageSrc.startsWith('data:')) {
    try {
      const upload = await uploadMediaItem(postToSave.imageSrc, {
        userId: resolvedAuthorId,
        type: 'image',
        fileName: 'cover_image.jpg',
      });
      if (upload?.url) {
        postToSave.imageSrc = upload.url;
      }
    } catch (e) {
      console.warn('[CommunityStore] Error uploading image:', e);
    }
  }

  // 3. Upload video thumbnail if present
  if (postToSave.videoThumbnail && postToSave.videoThumbnail.startsWith('data:')) {
    try {
      const upload = await uploadMediaItem(postToSave.videoThumbnail, {
        userId: resolvedAuthorId,
        type: 'image',
        fileName: 'video_thumbnail.jpg',
      });
      if (upload?.url) {
        postToSave.videoThumbnail = upload.url;
      }
    } catch (e) {
      console.warn('[CommunityStore] Error uploading video thumbnail:', e);
    }
  }

  // 3b. Upload Base64 image gallery items if present
  if (Array.isArray(postToSave.imageGallery) && postToSave.imageGallery.length > 0) {
    const uploadedGallery: string[] = [];
    for (let i = 0; i < postToSave.imageGallery.length; i++) {
      const item = postToSave.imageGallery[i];
      if (item && item.startsWith('data:')) {
        try {
          const upload = await uploadMediaItem(item, {
            userId: resolvedAuthorId,
            type: 'image',
            fileName: `gallery_${i}_${Date.now()}.jpg`,
          });
          uploadedGallery.push(upload?.url || item);
        } catch {
          uploadedGallery.push(item);
        }
      } else if (item) {
        uploadedGallery.push(item);
      }
    }
    postToSave.imageGallery = uploadedGallery;
    if (!postToSave.imageSrc && uploadedGallery.length > 0) {
      postToSave.imageSrc = uploadedGallery[0];
    }
  }

  // 4. Resolve author ID for Supabase
  if (isSupabaseConfigured() && (!resolvedAuthorId || !isUuid(resolvedAuthorId))) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id && isUuid(data.session.user.id)) {
        resolvedAuthorId = data.session.user.id;
      }
    } catch {}
  }

  if (isSupabaseConfigured() && resolvedAuthorId && isUuid(resolvedAuthorId)) {
    try {
      const { post: dbPost, error } = await createSupabasePost(postToSave, resolvedAuthorId);
      if (dbPost && !error) {
        recordOwnedPostId(dbPost.id);
        const current = getCommunityPosts();
        const updated = [dbPost, ...current.filter((p) => p.id !== dbPost.id)];
        saveCommunityPosts(updated);
        savePostsToIDB(updated);
        saveServerPost(dbPost);

        addNotification({
          type: 'like',
          title: 'Post Published Globally',
          message: `Your creation "${(dbPost.videoTitle || dbPost.prompt).substring(0, 35)}..." was published!`,
          actor: {
            name: dbPost.author.name,
            username: dbPost.author.username,
            avatar: dbPost.author.avatar,
          },
          linkTab: 'feed',
          thumbnail: dbPost.imageSrc || dbPost.videoThumbnail,
        });

        return dbPost;
      }
      console.warn('[CommunityStore] Supabase post creation failed, falling back to server disk:', error);
    } catch (err) {
      console.warn('[CommunityStore] Exception during createPostAsync, falling back to server disk:', err);
    }
  }

  // 5. Persistent fallback: save to local store, IndexedDB, and server disk
  return saveCommunityPost(postToSave);
};

/**
 * Asynchronously updates a community post's text, caption, prompt, tags, or styling presets.
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
  updateServerPost(postId, updates);
  const updatedList = updateCommunityPost(postId, updates);
  savePostsToIDB(updatedList);
  return updatedList;
};

/**
 * Asynchronously deletes a community post by ID across Supabase, server disk, and IDB.
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
  deleteServerPost(postId);
  deletePostFromIDB(postId);
  const updatedList = deleteCommunityPost(postId);
  savePostsToIDB(updatedList);
  return updatedList;
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
      if (data && data.name && data.username) {
        if (isSupabaseConfigured()) {
          const isStale =
            data.id === 'user_default' ||
            data.id === 'usr_metfa_9281' ||
            data.username === 'alex.rivera' ||
            data.id?.startsWith('usr_') ||
            data.id?.startsWith('usr_google_');
          if (isStale) {
            safeRemoveItem(USER_PROFILE_KEY);
            return INITIAL_USER_PROFILE;
          }
        }
        return {
          ...data,
          avatar: sanitizeAvatarUrl(data.avatar, data.username),
        };
      }
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
 * Accepts either full author/user objects or string IDs, plus optional postId.
 */
export const isContentOwner = (
  author: { id?: string; username?: string } | string | undefined | null,
  userProfile?: { id?: string; username?: string } | string | null,
  authUser?: { id?: string; username?: string } | string | null,
  postingIdentity?: { id?: string; username?: string } | string | null,
  postId?: string
): boolean => {
  // If this post was created locally on this browser, the user is the owner
  if (postId && isLocallyOwnedPost(postId)) {
    return true;
  }

  if (!author) return false;

  const authorId = typeof author === 'string' ? author : author.id;
  const authorUsername = typeof author === 'string' ? undefined : author.username;

  const getId = (item?: { id?: string; username?: string } | string | null) =>
    typeof item === 'string' ? item : item?.id;
  const getUsername = (item?: { id?: string; username?: string } | string | null) =>
    typeof item === 'string' ? undefined : item?.username;

  const userProfileId = getId(userProfile);
  const authUserId = getId(authUser);

  const validIds = [userProfileId, authUserId].filter(Boolean) as string[];

  const validUsernames = [
    getUsername(userProfile)?.toLowerCase(),
    getUsername(authUser)?.toLowerCase(),
  ].filter(Boolean) as string[];

  if (authorId && validIds.includes(authorId)) return true;
  if (authorUsername && validUsernames.includes(authorUsername.toLowerCase())) return true;
  
  const postIdentityId = getId(postingIdentity);
  if (postIdentityId && validIds.includes(postIdentityId)) return true;
  const postIdentityUsername = getUsername(postingIdentity);
  if (postIdentityUsername && validUsernames.includes(postIdentityUsername.toLowerCase())) return true;

  // If authorId matches userProfileId directly even if empty or guest
  if (authorId && userProfileId && authorId === userProfileId) return true;

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

