import { supabase, isSupabaseConfigured } from './supabaseClient';
import { CommunityPost, PostingIdentity, VoiceComment, PostComment } from '../types/community';
import { AudioTrack } from '../types/audio';

export interface SupabasePostRow {
  id: string;
  author_id: string;
  prompt: string;
  caption?: string | null;
  style_preset?: string | null;
  image_src?: string | null;
  image_gallery?: string[] | null;
  video_src?: string | null;
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
  visibility?: 'public' | 'followers' | 'private' | null;
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
  } | null;
}

/**
 * Maps a database post row (with joined profiles author) to the client CommunityPost model
 */
export function mapSupabaseRowToCommunityPost(row: SupabasePostRow): CommunityPost {
  const authorName = row.author?.display_name || row.author?.username || 'Metfa Creator';
  const authorUsername = row.author?.username || 'creator';
  const authorAvatar =
    row.author?.avatar_url?.trim() ||
    `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80`;

  // Compute a human-readable relative time or formatted date string
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
    },
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
    tags: Array.isArray(row.tags) ? row.tags : ['MetfaAI', 'SocialFirst'],
    feedType: (row.feed_type as any) || 'for_you',
    audioTrack: row.audio_track || undefined,
  };
}

/**
 * Fetches all persistent posts from the Supabase `public.posts` table joined with `public.profiles`.
 */
export async function fetchSupabasePosts(): Promise<{ posts: CommunityPost[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { posts: [], error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        author_id,
        prompt,
        caption,
        style_preset,
        image_src,
        image_gallery,
        video_src,
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
        updated_at,
        author:profiles (
          id,
          display_name,
          username,
          avatar_url,
          is_verified
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[PostService] Error fetching posts from Supabase:', error.message);
      return { posts: [], error: error.message };
    }

    if (!data || !Array.isArray(data)) {
      return { posts: [] };
    }

    const mappedPosts: CommunityPost[] = data.map((row: any) =>
      mapSupabaseRowToCommunityPost(row as SupabasePostRow)
    );

    return { posts: mappedPosts };
  } catch (err: any) {
    console.warn('[PostService] Unexpected error during fetchSupabasePosts:', err);
    return { posts: [], error: err?.message || 'Network error fetching posts' };
  }
}

/**
 * Creates a new persistent post in the Supabase `public.posts` table.
 */
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

  try {
    const insertPayload = {
      author_id: authorId,
      prompt: post.prompt,
      caption: post.caption || null,
      style_preset: post.stylePreset || null,
      image_src: post.imageSrc || null,
      image_gallery: post.imageGallery || [],
      video_src: post.videoSrc || null,
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
      visibility: 'public',
      is_pinned: false,
      is_edited: false,
      is_ai_generated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('posts')
      .insert(insertPayload)
      .select(`
        *,
        author:profiles (
          id,
          display_name,
          username,
          avatar_url,
          is_verified
        )
      `)
      .single();

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

/**
 * Updates an existing post in the Supabase `public.posts` table.
 * Enforces ownership via matching author_id.
 */
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

    const { error } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', postId)
      .eq('author_id', authorId);

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

/**
 * Deletes a post from the Supabase `public.posts` table.
 * Enforces ownership via matching author_id.
 */
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
