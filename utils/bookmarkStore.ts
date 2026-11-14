import { CommunityPost, ProfilePrivacy, ReelHighlight } from '../types/community';
import { getCommunityPosts, saveCommunityPosts } from './communityStore';
import { getReelHighlights, saveReelHighlights } from './socialStore';
import { canViewerAccessPost, resolveViewerIsOwner } from './privacyPolicy';
import { safeGetItem, safeSetItem, safeRemoveItem } from './storageUtils';

const SAVED_POSTS_KEY = 'metfa_saved_posts_ids_v2';
const SAVED_REELS_KEY = 'metfa_saved_reels_ids_v2';

const DEFAULT_SAVED_POST_IDS: string[] = [];
const DEFAULT_SAVED_REEL_IDS: string[] = [];

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

export const saveSavedPostIds = (ids: string[]): void => {
  safeSetItem(SAVED_POSTS_KEY, JSON.stringify(ids));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_saved_items_updated', { detail: { type: 'posts', ids } }));
  }
};

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

export const saveSavedReelIds = (ids: string[]): void => {
  safeSetItem(SAVED_REELS_KEY, JSON.stringify(ids));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_saved_items_updated', { detail: { type: 'reels', ids } }));
  }
};

export const isPostSaved = (postId: string): boolean => {
  const savedIds = getSavedPostIds();
  return savedIds.includes(postId);
};

export const isReelSaved = (reelId: string): boolean => {
  const savedIds = getSavedReelIds();
  return savedIds.includes(reelId);
};

export const toggleSavePost = (
  postId: string
): { isSaved: boolean; updatedPosts: CommunityPost[]; post?: CommunityPost } => {
  const currentSavedIds = getSavedPostIds();
  const alreadySaved = currentSavedIds.includes(postId);
  const nextSaved = !alreadySaved;

  const nextSavedIds = nextSaved
    ? [postId, ...currentSavedIds.filter((id) => id !== postId)]
    : currentSavedIds.filter((id) => id !== postId);

  saveSavedPostIds(nextSavedIds);

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

export const toggleSaveReel = (
  reelId: string
): { isSaved: boolean; updatedReels: ReelHighlight[]; reel?: ReelHighlight } => {
  const currentSavedIds = getSavedReelIds();
  const alreadySaved = currentSavedIds.includes(reelId);
  const nextSaved = !alreadySaved;

  const nextSavedIds = nextSaved
    ? [reelId, ...currentSavedIds.filter((id) => id !== reelId)]
    : currentSavedIds.filter((id) => id !== reelId);

  saveSavedReelIds(nextSavedIds);

  const reels = getReelHighlights();
  let targetReel: ReelHighlight | undefined;
  const updatedReels = reels.map((r) => {
    if (r.id === reelId) {
      const currentSaves = r.savesCount ?? 0;
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

export const getSavedPostsList = (allPosts?: CommunityPost[]): CommunityPost[] => {
  const savedIds = getSavedPostIds();
  const source = allPosts && allPosts.length > 0 ? allPosts : getCommunityPosts();
  return source.filter((p) => savedIds.includes(p.id) || p.isBookmarked);
};

export const getSavedReelsList = (allReels?: ReelHighlight[]): ReelHighlight[] => {
  const savedIds = getSavedReelIds();
  const source = allReels && allReels.length > 0 ? allReels : getReelHighlights();
  return source.filter((r) => savedIds.includes(r.id) || r.isSaved);
};

export interface SavedVisibilityContext {
  viewerId?: string | null;
  followedUserIds?: Set<string>;
  profilesPrivacyMap?: Map<string, ProfilePrivacy>;
}

/**
 * Filters bookmarked posts by live viewer access rules so previously saved items
 * that became private, only_me, or unfollowed are never revealed to unauthorized viewers.
 */
export const filterVisibleSavedPosts = (
  posts: CommunityPost[],
  viewerCtx: SavedVisibilityContext
): CommunityPost[] => {
  const viewerId = viewerCtx.viewerId || null;
  return posts.filter((post) => {
    const authorId = post.author?.id || null;
    const authorProfilePrivacy =
      (authorId ? viewerCtx.profilesPrivacyMap?.get(authorId) : undefined) ||
      post.authorProfilePrivacy ||
      post.author?.profilePrivacy ||
      'public';
    const viewerFollowsAuthor = Boolean(authorId && viewerCtx.followedUserIds?.has(authorId));
    const viewerIsOwner = resolveViewerIsOwner(
      { authorId, postingIdentityId: post.postingIdentity?.id, postId: post.id },
      viewerId
    );
    return canViewerAccessPost({
      visibility: post.visibility ?? null,
      authorId,
      authorProfilePrivacy,
      viewerId,
      viewerFollowsAuthor,
      viewerIsOwner,
    });
  });
};

export const filterVisibleSavedReels = (
  reels: ReelHighlight[],
  viewerCtx: SavedVisibilityContext
): ReelHighlight[] => {
  const viewerId = viewerCtx.viewerId || null;
  return reels.filter((reel) => {
    const authorId = reel.author?.id || null;
    const authorProfilePrivacy =
      (authorId ? viewerCtx.profilesPrivacyMap?.get(authorId) : undefined) ||
      reel.authorProfilePrivacy ||
      reel.author?.profilePrivacy ||
      'public';
    const viewerFollowsAuthor = Boolean(authorId && viewerCtx.followedUserIds?.has(authorId));
    const viewerIsOwner = resolveViewerIsOwner({ authorId, postId: reel.id }, viewerId);
    return canViewerAccessPost({
      visibility: reel.visibility ?? null,
      authorId,
      authorProfilePrivacy,
      viewerId,
      viewerFollowsAuthor,
      viewerIsOwner,
    });
  });
};

export const clearBookmarkCache = (): void => {
  safeRemoveItem(SAVED_POSTS_KEY);
  safeRemoveItem(SAVED_REELS_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_saved_items_updated', { detail: { type: 'posts', ids: [] } }));
    window.dispatchEvent(new CustomEvent('metfa_saved_items_updated', { detail: { type: 'reels', ids: [] } }));
  }
};

export const getTotalSavedCount = (): number => {
  const postCount = getSavedPostIds().length;
  const reelCount = getSavedReelIds().length;
  return postCount + reelCount;
};
