import { CommunityPost, ReelHighlight } from '../types/community';
import { getCommunityPosts, saveCommunityPosts } from './communityStore';
import { getReelHighlights, saveReelHighlights } from './socialStore';
import { safeGetItem, safeSetItem } from './storageUtils';

const SAVED_POSTS_KEY = 'metfa_saved_posts_ids_v2';
const SAVED_REELS_KEY = 'metfa_saved_reels_ids_v2';

// Seed default saved items if first time
const DEFAULT_SAVED_POST_IDS = ['post_2'];
const DEFAULT_SAVED_REEL_IDS = ['reel_2'];

/**
 * Retrieve saved post IDs array from localStorage
 */
export const getSavedPostIds = (): string[] => {
  try {
    const raw = safeGetItem(SAVED_POSTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading saved post IDs:', err);
  }
  return DEFAULT_SAVED_POST_IDS;
};

/**
 * Save post IDs array to localStorage
 */
export const saveSavedPostIds = (ids: string[]): void => {
  safeSetItem(SAVED_POSTS_KEY, JSON.stringify(ids));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_saved_items_updated', { detail: { type: 'posts', ids } }));
  }
};

/**
 * Retrieve saved reel IDs array from localStorage
 */
export const getSavedReelIds = (): string[] => {
  try {
    const raw = safeGetItem(SAVED_REELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading saved reel IDs:', err);
  }
  return DEFAULT_SAVED_REEL_IDS;
};

/**
 * Save reel IDs array to localStorage
 */
export const saveSavedReelIds = (ids: string[]): void => {
  safeSetItem(SAVED_REELS_KEY, JSON.stringify(ids));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_saved_items_updated', { detail: { type: 'reels', ids } }));
  }
};

/**
 * Check if a post is currently saved
 */
export const isPostSaved = (postId: string): boolean => {
  const savedIds = getSavedPostIds();
  return savedIds.includes(postId);
};

/**
 * Check if a reel is currently saved
 */
export const isReelSaved = (reelId: string): boolean => {
  const savedIds = getSavedReelIds();
  return savedIds.includes(reelId);
};

/**
 * Toggle bookmark/save state for a community post
 * Returns updated status and updates posts in communityStore
 */
export const toggleSavePost = (postId: string): { isSaved: boolean; updatedPosts: CommunityPost[]; post?: CommunityPost } => {
  const currentSavedIds = getSavedPostIds();
  const alreadySaved = currentSavedIds.includes(postId);
  const nextSaved = !alreadySaved;

  const nextSavedIds = nextSaved
    ? [postId, ...currentSavedIds.filter((id) => id !== postId)]
    : currentSavedIds.filter((id) => id !== postId);

  saveSavedPostIds(nextSavedIds);

  // Sync isBookmarked flag on community posts
  const posts = getCommunityPosts();
  let targetPost: CommunityPost | undefined;
  const updatedPosts = posts.map((p) => {
    if (p.id === postId) {
      targetPost = { ...p, isBookmarked: nextSaved };
      return targetPost;
    }
    return p;
  });

  saveCommunityPosts(updatedPosts);

  return { isSaved: nextSaved, updatedPosts, post: targetPost };
};

/**
 * Toggle bookmark/save state for a Reel
 * Returns updated status and updates reels in socialStore
 */
export const toggleSaveReel = (reelId: string): { isSaved: boolean; updatedReels: ReelHighlight[]; reel?: ReelHighlight } => {
  const currentSavedIds = getSavedReelIds();
  const alreadySaved = currentSavedIds.includes(reelId);
  const nextSaved = !alreadySaved;

  const nextSavedIds = nextSaved
    ? [reelId, ...currentSavedIds.filter((id) => id !== reelId)]
    : currentSavedIds.filter((id) => id !== reelId);

  saveSavedReelIds(nextSavedIds);

  // Sync isSaved flag and savesCount on Reels
  const reels = getReelHighlights();
  let targetReel: ReelHighlight | undefined;
  const updatedReels = reels.map((r) => {
    if (r.id === reelId) {
      const currentSaves = r.savesCount ?? (r.id === 'reel_2' ? 245 : 128);
      const nextCount = nextSaved ? currentSaves + 1 : Math.max(0, currentSaves - 1);
      targetReel = {
        ...r,
        isSaved: nextSaved,
        savesCount: nextCount,
      };
      return targetReel;
    }
    return r;
  });

  saveReelHighlights(updatedReels);

  return { isSaved: nextSaved, updatedReels, reel: targetReel };
};

/**
 * Get all full CommunityPost objects that are bookmarked
 */
export const getSavedPostsList = (allPosts?: CommunityPost[]): CommunityPost[] => {
  const savedIds = getSavedPostIds();
  const source = allPosts && allPosts.length > 0 ? allPosts : getCommunityPosts();
  return source.filter((p) => savedIds.includes(p.id) || p.isBookmarked);
};

/**
 * Get all full ReelHighlight objects that are bookmarked
 */
export const getSavedReelsList = (allReels?: ReelHighlight[]): ReelHighlight[] => {
  const savedIds = getSavedReelIds();
  const source = allReels && allReels.length > 0 ? allReels : getReelHighlights();
  return source.filter((r) => savedIds.includes(r.id) || r.isSaved);
};

/**
 * Total count of saved items (posts + reels)
 */
export const getTotalSavedCount = (): number => {
  const postCount = getSavedPostIds().length;
  const reelCount = getSavedReelIds().length;
  return postCount + reelCount;
};
