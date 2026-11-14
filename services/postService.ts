import { supabase, isSupabaseConfigured } from './supabaseClient';
import { CommunityPost, PostingIdentity, ProfilePrivacy } from '../types/community';
import { AudioTrack } from '../types/audio';
import { getDefaultAvatar } from './authService';
import { batchFetchEngagement } from './engagementService';
import { fetchProfilesPrivacyBatch } from './followService';
import { normalizeProfilePrivacy } from '../utils/privacyPolicy';

export interface SupabasePostRow {
  id: string;
  author_id: string;
  prompt: string;
  caption?: string | null;
  style_preset?: string | null;
  image_src?: string | null;
  image_gallery?: string[] | null;
  video_src?: string | null;
  video_title?: string | null;
  video_thumbnail?: string | null;
  original_image_src?: string | null;
  text_background_preset?: string | null;
  post_type?: 'text' | 'media' | 'ai_art' | null;
  likes_count: number;
  remix_count: number;
  comments_count: number;
  shares_count: number;
  tags?: string[] | null;
  feed_type?: 'for_you' | 'following' | 'trending' | 'page' | 'group' | null;
  page_id?: string | null;
  page_name?: string | null;
  page_category?: string | null;
  group_id?: string | null;
  group_name?: string | null;
  posting_identity?: PostingIdentity | null;
  audio_track?: AudioTrack | null;
  visibility?: 'public' | 'followers' | 'only_me' | 'private' | null;
  is_pinned?: boolean | null;
  is_edited?: boolean | null;
  is_ai_generated?: boolean | null;
  prompt_used?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  author?: {
    id: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    is_verified?: boolean | null;
    profile_privacy?: string | null;
  } | null;
}

export const authorProfileCache = new Map<
  string,
  {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string;
    is_verified: boolean;
    profile_privacy?: ProfilePrivacy;
  }
>();

function isMissingPrivacyColumnError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || msg.includes('profile_privacy');
}

function isVisibilityConstraintError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return code === '23514' || msg.includes('posts_visibility_check') || msg.includes('check constraint');
}

export async function fetchAuthorProfileById(authorId: string) {
  if (!authorId) return null;
  if (authorProfileCache.has(authorId)) {
    return authorProfileCache.get(authorId)!;
  }
  try {
    const res = await fetch(`/api/authors/${encodeURIComponent(authorId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.profile) {
        const p = {
          id: json.profile.id,
          display_name: json.profile.name,
          username: json.profile.username,
          avatar_url: json.profile.avatar,
          is_verified: json.profile.isVerified ?? true,
          profile_privacy: normalizeProfilePrivacy(json.profile.profilePrivacy),
        };
        authorProfileCache.set(authorId, p);
        return p;
      }
    }
  } catch (e) {
    console.warn('[PostService] Error resolving author profile:', e);
  }
  return null;
}

/**
 * Maps a database post row (with joined profiles author) to the client CommunityPost model.
 * CRITICAL: Preserves `row.visibility ?? null` cleanly without silently converting legacy NULL rows to `'public'`.
 */
export function mapSupabaseRowToCommunityPost(row: SupabasePostRow): CommunityPost {
  const cachedAuthor = row.author_id ? authorProfileCache.get(row.author_id) : null;
  const authorName =
    row.author?.display_name ||
    cachedAuthor?.display_name ||
    row.author?.username ||
    cachedAuthor?.username ||
    'Metfa Creator';
  const authorUsername = row.author?.username || cachedAuthor?.username || 'creator';
  const authorAvatar =
    row.author?.avatar_url?.trim() ||
    cachedAuthor?.avatar_url?.trim() ||
    getDefaultAvatar(authorUsername);
  const authorProfilePrivacy = normalizeProfilePrivacy(
    row.author?.profile_privacy ?? cachedAuthor?.profile_privacy ?? null
  );

  let relativeTime = 'Just now';
  if (row.created_at) {
    try {
      const createdDate = new Date(row.created_at);
      const diffMs = Date.now() - createdDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        relativeTime = 'Just now';
      } else if (diffMins < 60) {
        relativeTime = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        relativeTime = `${diffHours}h ago`;
      } else if (diffDays < 7) {
        relativeTime = `${diffDays}d ago`;
      } else {
        relativeTime = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      relativeTime = 'Recently';
    }
  }

  return {
    id: row.id,
    author: {
      id: row.author_id,
      name: authorName,
      username: authorUsername,
      avatar: authorAvatar,
      isVerified: row.author?.is_verified ?? true,
      profilePrivacy: authorProfilePrivacy,
    },
    authorProfilePrivacy,
    visibility: row.visibility !== undefined ? row.visibility : null,
    postingIdentity: row.posting_identity || undefined,
    pageId: row.page_id || undefined,
    pageName: row.page_name || undefined,
    pageCategory: row.page_category || undefined,
    groupId: row.group_id || undefined,
    groupName: row.group_name || undefined,
    prompt: row.prompt,
    caption: row.caption || undefined,
    stylePreset: row.style_preset || undefined,
    imageSrc: row.image_src || undefined,
    imageGallery: Array.isArray(row.image_gallery) ? row.image_gallery : undefined,
    videoSrc: row.video_src || undefined,
    videoTitle: row.video_title || undefined,
    videoThumbnail: row.video_thumbnail || undefined,
    originalImageSrc: row.original_image_src || undefined,
    textBackgroundPreset: row.text_background_preset || undefined,
    postType: row.post_type || (row.image_src || row.video_src ? 'media' : 'text'),
    likesCount: row.likes_count ?? 0,
    remixCount: row.remix_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    sharesCount: row.shares_count ?? 0,
    isLiked: false,
    isBookmarked: false,
    comments: [],
    voiceComments: [],
    createdAt: relativeTime,
    createdAtIso: row.created_at || undefined,
    tags: Array.isArray(row.tags) ? row.tags : ['MetfaAI', 'SocialFirst'],
    feedType: (row.feed_type as any) || 'for_you',
    audioTrack: row.audio_track || undefined,
  };
}

const POST_BASE_COLUMNS = `
  id,
  author_id,
  prompt,
  caption,
  style_preset,
  image_src,
  image_gallery,
  video_src,
  video_title,
  video_thumbnail,
  original_image_src,
  text_background_preset,
  post_type,
  likes_count,
  remix_count,
  comments_count,
  shares_count,
  tags,
  feed_type,
  page_id,
  page_name,
  page_category,
  group_id,
  group_name,
  posting_identity,
  audio_track,
  visibility,
  is_pinned,
  is_edited,
  is_ai_generated,
  prompt_used,
  created_at,
  updated_at
`;

export async function fetchSupabasePosts(): Promise<{ posts: CommunityPost[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { posts: [], error: 'Supabase is not configured' };
  }

  try {
    let { data, error } = await supabase
      .from('posts')
      .select(`
        ${POST_BASE_COLUMNS},
        author:profiles (
          id,
          display_name,
          username,
          avatar_url,
          is_verified,
          profile_privacy
        )
      `)
      .order('created_at', { ascending: false });

    if (error && isMissingPrivacyColumnError(error)) {
      const retry = await supabase
        .from('posts')
        .select(`
          ${POST_BASE_COLUMNS},
          author:profiles (
            id,
            display_name,
            username,
            avatar_url,
            is_verified
          )
        `)
        .order('created_at', { ascending: false });
      data = retry.data as any;
      error = retry.error;
    }

    if (error) {
      console.warn('[PostService] Error fetching posts from Supabase:', error.message);
      return { posts: [], error: error.message };
    }

    if (!data || !Array.isArray(data)) {
      return { posts: [] };
    }

    const postIds = data.map((row: any) => row.id).filter(Boolean);
    const engagementMap = await batchFetchEngagement(postIds);

    const missingAuthorIds = Array.from(
      new Set(
        data
          .filter((row: any) => (!row.author || !row.author.display_name) && row.author_id)
          .map((row: any) => row.author_id as string)
      )
    );

    if (missingAuthorIds.length > 0) {
      await Promise.all(
        missingAuthorIds.map(async (authorId) => {
          const resolved = await fetchAuthorProfileById(authorId);
          if (resolved) {
            for (const row of data as any[]) {
              if (row.author_id === authorId && (!row.author || !row.author.display_name)) {
                row.author = resolved;
              }
            }
          }
        })
      );
    }

    // Batch-resolve privacy for authors lacking profile_privacy on the join
    const authorsMissingPrivacy = Array.from(
      new Set(
        (data as any[])
          .filter((row) => row.author_id && !row.author?.profile_privacy)
          .map((row) => row.author_id as string)
      )
    );
    const privacyBatch =
      authorsMissingPrivacy.length > 0
        ? await fetchProfilesPrivacyBatch(authorsMissingPrivacy)
        : new Map<string, ProfilePrivacy>();

    const mappedPosts: CommunityPost[] = (data as any[]).map((row) => {
      if (row.author && !row.author.profile_privacy && row.author_id && privacyBatch.has(row.author_id)) {
        row.author.profile_privacy = privacyBatch.get(row.author_id);
      }
      const post = mapSupabaseRowToCommunityPost(row as SupabasePostRow);
      if (row.author_id && privacyBatch.has(row.author_id) && !post.authorProfilePrivacy) {
        const priv = privacyBatch.get(row.author_id)!;
        post.authorProfilePrivacy = priv;
        post.author.profilePrivacy = priv;
      }

      const eng = engagementMap.get(post.id);
      if (eng) {
        post.commentsCount = Math.max(post.commentsCount, eng.commentsCount);
        post.likesCount = Math.max(post.likesCount, eng.likesCount);
        if (eng.userReaction) {
          post.userReaction = eng.userReaction;
          post.isLiked = true;
        }
        if (Object.keys(eng.reactionCounts).length > 0) {
          post.reactionCounts = eng.reactionCounts;
        }
        if (eng.commentsPreview.length > 0) {
          post.comments = eng.commentsPreview;
        }
      }
      return post;
    });

    return { posts: mappedPosts };
  } catch (err: any) {
    console.warn('[PostService] Unexpected error during fetchSupabasePosts:', err);
    return { posts: [], error: err?.message || 'Network error fetching posts' };
  }
}

export async function createSupabasePost(
  post: Omit<CommunityPost, 'id' | 'likesCount' | 'remixCount' | 'commentsCount' | 'sharesCount' | 'createdAt' | 'comments'>,
  authorId: string
): Promise<{ post: CommunityPost | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { post: null, error: 'Supabase is not configured' };
  }

  if (!authorId) {
    return { post: null, error: 'Author ID is required to create a post' };
  }

  const resolvedVisibility = post.visibility ?? 'public';

  try {
    const insertPayload: Record<string, any> = {
      author_id: authorId,
      prompt: post.prompt,
      caption: post.caption || null,
      style_preset: post.stylePreset || null,
      image_src: post.imageSrc || null,
      image_gallery: post.imageGallery || [],
      video_src: post.videoSrc || null,
      video_title: post.videoTitle || null,
      video_thumbnail: post.videoThumbnail || null,
      original_image_src: post.originalImageSrc || null,
      text_background_preset: post.textBackgroundPreset || null,
      post_type: post.postType || 'text',
      likes_count: 0,
      remix_count: 0,
      comments_count: 0,
      shares_count: 0,
      tags: post.tags || [],
      feed_type: post.feedType || 'for_you',
      page_id: post.pageId || null,
      page_name: post.pageName || null,
      page_category: post.pageCategory || null,
      group_id: post.groupId || null,
      group_name: post.groupName || null,
      posting_identity: post.postingIdentity || null,
      audio_track: post.audioTrack || null,
      visibility: resolvedVisibility,
      is_pinned: false,
      is_edited: false,
      is_ai_generated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const runInsert = async (payload: Record<string, any>, includePrivacyCol: boolean) => {
      const profileCols = includePrivacyCol
        ? 'id, display_name, username, avatar_url, is_verified, profile_privacy'
        : 'id, display_name, username, avatar_url, is_verified';
      return supabase
        .from('posts')
        .insert(payload)
        .select(`*, author:profiles (${profileCols})`)
        .single();
    };

    let { data, error } = await runInsert(insertPayload, true);

    if (error && isMissingPrivacyColumnError(error)) {
      const retry = await runInsert(insertPayload, false);
      data = retry.data;
      error = retry.error;
    }

    // Pre-migration DB compatibility: if CHECK constraint rejects 'only_me', store 'private' (both normalize to 'only_me')
    if (error && resolvedVisibility === 'only_me' && isVisibilityConstraintError(error)) {
      const fallbackPayload = { ...insertPayload, visibility: 'private' };
      const retry = await runInsert(fallbackPayload, false);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('[PostService] Error inserting post into Supabase:', error.message);
      return { post: null, error: error.message };
    }

    if (!data) {
      return { post: null, error: 'Failed to retrieve inserted post' };
    }

    const mapped = mapSupabaseRowToCommunityPost(data as SupabasePostRow);
    return { post: mapped };
  } catch (err: any) {
    console.warn('[PostService] Exception creating post in Supabase:', err);
    return { post: null, error: err?.message || 'Failed to create post in Supabase' };
  }
}

export async function updateSupabasePost(
  postId: string,
  updates: Partial<CommunityPost>,
  authorId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      is_edited: true,
    };

    if (updates.prompt !== undefined) updatePayload.prompt = updates.prompt;
    if (updates.caption !== undefined) updatePayload.caption = updates.caption;
    if (updates.tags !== undefined) updatePayload.tags = updates.tags;
    if (updates.stylePreset !== undefined) updatePayload.style_preset = updates.stylePreset;
    if (updates.textBackgroundPreset !== undefined) updatePayload.text_background_preset = updates.textBackgroundPreset;
    if (updates.imageSrc !== undefined) updatePayload.image_src = updates.imageSrc;
    if (updates.videoSrc !== undefined) updatePayload.video_src = updates.videoSrc;
    if (updates.videoTitle !== undefined) updatePayload.video_title = updates.videoTitle;
    if (updates.videoThumbnail !== undefined) updatePayload.video_thumbnail = updates.videoThumbnail;
    if (updates.visibility !== undefined) updatePayload.visibility = updates.visibility;

    let { error } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', postId)
      .eq('author_id', authorId);

    if (error && updates.visibility === 'only_me' && isVisibilityConstraintError(error)) {
      const retry = await supabase
        .from('posts')
        .update({ ...updatePayload, visibility: 'private' })
        .eq('id', postId)
        .eq('author_id', authorId);
      error = retry.error;
    }

    if (error) {
      console.warn('[PostService] Error updating post in Supabase:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[PostService] Exception updating post in Supabase:', err);
    return { success: false, error: err?.message || 'Failed to update post' };
  }
}

export async function deleteSupabasePost(
  postId: string,
  authorId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', authorId);

    if (error) {
      console.warn('[PostService] Error deleting post from Supabase:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[PostService] Exception deleting post from Supabase:', err);
    return { success: false, error: err?.message || 'Failed to delete post' };
  }
}

export async function fetchSupabasePostById(
  postId: string
): Promise<{ post: CommunityPost | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { post: null, error: 'Supabase is not configured' };
  }

  if (!postId || typeof postId !== 'string') {
    return { post: null, error: 'Invalid post ID' };
  }

  const cleanId = postId.trim();

  const queryPostBySelect = async (includePrivacyCol: boolean) => {
    const profileCols = includePrivacyCol
      ? 'id, display_name, username, avatar_url, is_verified, profile_privacy'
      : 'id, display_name, username, avatar_url, is_verified';
    const postSelect = `${POST_BASE_COLUMNS}, author:profiles (${profileCols})`;

    let { data, error } = await supabase
      .from('posts')
      .select(postSelect)
      .eq('id', cleanId)
      .maybeSingle();

    if (!data && cleanId.startsWith('post-')) {
      const res = await supabase
        .from('posts')
        .select(postSelect)
        .eq('id', cleanId.substring(5))
        .maybeSingle();
      if (res.data) {
        data = res.data;
        error = res.error;
      }
    }

    if (!data && !cleanId.startsWith('post-')) {
      const res = await supabase
        .from('posts')
        .select(postSelect)
        .eq('id', `post-${cleanId}`)
        .maybeSingle();
      if (res.data) {
        data = res.data;
        error = res.error;
      }
    }
    return { data, error };
  };

  try {
    let { data, error } = await queryPostBySelect(true);
    if (error && isMissingPrivacyColumnError(error)) {
      const retry = await queryPostBySelect(false);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('[PostService] Error fetching post by id:', error.message);
      return { post: null, error: error.message };
    }

    if (!data) {
      return { post: null };
    }

    const mapped = mapSupabaseRowToCommunityPost(data as any);
    if (mapped.author?.id && !(data as any)?.author?.profile_privacy) {
      const privMap = await fetchProfilesPrivacyBatch([mapped.author.id]);
      if (privMap.has(mapped.author.id)) {
        const priv = privMap.get(mapped.author.id)!;
        mapped.authorProfilePrivacy = priv;
        mapped.author.profilePrivacy = priv;
      }
    }

    const engMap = await batchFetchEngagement([mapped.id]);
    const eng = engMap.get(mapped.id);
    if (eng) {
      mapped.commentsCount = Math.max(mapped.commentsCount, eng.commentsCount);
      mapped.likesCount = Math.max(mapped.likesCount, eng.likesCount);
      if (eng.userReaction) {
        mapped.userReaction = eng.userReaction;
        mapped.isLiked = true;
      }
      if (Object.keys(eng.reactionCounts).length > 0) {
        mapped.reactionCounts = eng.reactionCounts;
      }
      if (eng.commentsPreview.length > 0) {
        mapped.comments = eng.commentsPreview;
      }
    }

    return { post: mapped };
  } catch (err: any) {
    console.warn('[PostService] Exception fetching post by id:', err);
    return { post: null, error: err?.message || 'Error fetching post' };
  }
}
