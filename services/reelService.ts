import { supabase, isSupabaseConfigured, getClientAuthToken } from './supabaseClient';
import { ReelHighlight, UserProfile } from '../types/community';
import { AudioTrack } from '../types/audio';
import { uploadMediaItem } from './storageService';
import { getDefaultAvatar, sanitizeAvatarUrl } from './authService';
import {
  getReelHighlights,
  saveReelHighlights,
  saveReelHighlight,
  deleteReelHighlight,
  editReelHighlight,
} from '../utils/socialStore';

export interface CreateReelParams {
  title: string;
  caption: string;
  promptUsed?: string;
  videoSource: File | Blob | string;
  thumbnailSource?: string;
  duration: number;
  audioTrack?: AudioTrack;
  musicTrack?: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
  };
}

export interface ReelOperationResult {
  success: boolean;
  reel?: ReelHighlight;
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Maps a Supabase row (with joined profiles author) to a strongly typed ReelHighlight
 */
export function mapSupabaseRowToReel(row: any): ReelHighlight {
  const authorName =
    row.author?.display_name || row.author?.username || 'Metfa Creator';
  const authorUsername = row.author?.username || 'creator';
  const authorAvatar =
    row.author?.avatar_url?.trim() || getDefaultAvatar(authorUsername);

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
        relativeTime = createdDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }
    } catch {
      relativeTime = 'Recently';
    }
  }

  return {
    id: String(row.id),
    title: row.video_title || row.prompt || 'Metfa Reel',
    caption: row.caption || '',
    author: {
      id: row.author_id,
      name: authorName,
      username: authorUsername,
      avatar: sanitizeAvatarUrl(authorAvatar, authorUsername),
      isVerified: Boolean(row.author?.is_verified),
    },
    videoSrc: row.video_src || '',
    thumbnailSrc: row.video_thumbnail || undefined,
    duration: typeof row.duration === 'number' ? row.duration : 15,
    likesCount: Number(row.likes_count) || 0,
    commentsCount: Number(row.comments_count) || 0,
    sharesCount: Number(row.shares_count) || 0,
    createdAt: relativeTime,
    promptUsed: row.prompt_used || row.prompt || undefined,
    musicTrack: row.audio_track
      ? `${row.audio_track.title} • ${row.audio_track.artist}`
      : undefined,
    audioTrack: row.audio_track || undefined,
  };
}

/**
 * Fetches persistent reels from Supabase public.posts (post_type = 'reel'),
 * joined with author profiles.
 * Falls back safely to local/server store if Supabase is offline.
 */
export async function fetchPersistentReels(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ reels: ReelHighlight[]; error?: string; source: 'supabase' | 'local' }> {
  const limit = options?.limit || 30;
  const offset = options?.offset || 0;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          author_id,
          prompt,
          caption,
          video_src,
          video_title,
          video_thumbnail,
          post_type,
          likes_count,
          comments_count,
          shares_count,
          tags,
          audio_track,
          created_at,
          author:profiles!posts_author_id_fkey (
            id,
            display_name,
            username,
            avatar_url,
            is_verified
          )
        `)
        .eq('post_type', 'reel')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.warn('[ReelService] Supabase fetch error, trying without explicit fkey:', error.message);
        // Fallback without explicit fkey if foreign key name differs
        const fallbackRes = await supabase
          .from('posts')
          .select(`
            id,
            author_id,
            prompt,
            caption,
            video_src,
            video_title,
            video_thumbnail,
            post_type,
            likes_count,
            comments_count,
            shares_count,
            tags,
            audio_track,
            created_at,
            author:profiles (
              id,
              display_name,
              username,
              avatar_url,
              is_verified
            )
          `)
          .eq('post_type', 'reel')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!fallbackRes.error && fallbackRes.data) {
          const reels = fallbackRes.data
            .filter((row: any) => Boolean(row.video_src))
            .map(mapSupabaseRowToReel);
          return { reels, source: 'supabase' };
        }
      } else if (data) {
        const reels = data
          .filter((row: any) => Boolean(row.video_src))
          .map(mapSupabaseRowToReel);
        return { reels, source: 'supabase' };
      }
    } catch (err: any) {
      console.warn('[ReelService] Unexpected error querying Supabase reels:', err);
    }
  }

  // Fallback to local highlights store
  const localReels = getReelHighlights();
  return { reels: localReels, source: 'local' };
}

/**
 * Creates a persistent Reel:
 * 1. Uploads video file via uploadMediaItem (Supabase Storage 'posts' bucket or server fallback)
 * 2. Uploads thumbnail if provided
 * 3. Persists Reel record to Supabase public.posts with post_type = 'reel'
 * 4. Syncs with local store for offline availability
 */
export async function createPersistentReel(
  params: CreateReelParams,
  onProgress?: (step: string) => void
): Promise<ReelOperationResult> {
  if (!params.author?.id) {
    return { success: false, error: 'Author profile ID is required' };
  }

  if (!params.videoSource) {
    return { success: false, error: 'Video file is required to create a reel' };
  }

  try {
    onProgress?.('Uploading video to cloud storage...');

    // 1. Upload video persistently
    const videoUpload = await uploadMediaItem(params.videoSource, {
      userId: params.author.id,
      type: 'video',
      fileName: `reel_${Date.now()}.mp4`,
    });

    if (!videoUpload?.url) {
      return { success: false, error: 'Failed to upload video media' };
    }

    const permanentVideoUrl = videoUpload.url;

    // 2. Upload thumbnail if provided and not already an HTTP URL
    let permanentThumbUrl = params.thumbnailSource;
    if (params.thumbnailSource && (params.thumbnailSource.startsWith('data:') || params.thumbnailSource.startsWith('blob:'))) {
      try {
        onProgress?.('Processing reel cover thumbnail...');
        const thumbUpload = await uploadMediaItem(params.thumbnailSource, {
          userId: params.author.id,
          type: 'image',
          fileName: `thumb_${Date.now()}.jpg`,
        });
        if (thumbUpload?.url) {
          permanentThumbUrl = thumbUpload.url;
        }
      } catch (thumbErr) {
        console.warn('[ReelService] Thumbnail upload warning:', thumbErr);
      }
    }

    onProgress?.('Saving reel metadata to database...');

    const resolvedTitle = params.title.trim() || 'AI Creation Reel';
    const resolvedCaption = params.caption.trim() || 'Created with Metfa Studio #AI';

    // 3. Persist to Supabase if configured and user is authenticated
    if (isSupabaseConfigured() && isValidUuid(params.author.id)) {
      try {
        const insertPayload = {
          author_id: params.author.id,
          prompt: params.promptUsed || resolvedTitle,
          caption: resolvedCaption,
          video_src: permanentVideoUrl,
          video_title: resolvedTitle,
          video_thumbnail: permanentThumbUrl || null,
          post_type: 'reel',
          likes_count: 0,
          remix_count: 0,
          comments_count: 0,
          shares_count: 0,
          tags: ['reel', 'video'],
          feed_type: 'for_you',
          audio_track: params.audioTrack || null,
          visibility: 'public',
          is_pinned: false,
          is_edited: false,
          is_ai_generated: Boolean(params.promptUsed),
          prompt_used: params.promptUsed || null,
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

        if (!error && data) {
          const createdReel = mapSupabaseRowToReel(data);
          saveReelHighlight(createdReel);
          return { success: true, reel: createdReel };
        } else if (error) {
          console.warn('[ReelService] Supabase insert notice:', error.message);
        }
      } catch (sbErr: any) {
        console.warn('[ReelService] Supabase insert exception:', sbErr);
      }
    }

    // 4. Fallback: Local/Server creation with the permanent media URL
    const fallbackReel: ReelHighlight = {
      id: `reel_${Date.now()}`,
      title: resolvedTitle,
      caption: resolvedCaption,
      author: {
        id: params.author.id,
        name: params.author.name,
        username: params.author.username,
        avatar: params.author.avatar,
        isVerified: params.author.isVerified,
      },
      videoSrc: permanentVideoUrl,
      thumbnailSrc: permanentThumbUrl,
      duration: params.duration || 15,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: 'Just now',
      promptUsed: params.promptUsed,
      musicTrack: params.musicTrack,
      audioTrack: params.audioTrack,
    };

    saveReelHighlight(fallbackReel);
    return { success: true, reel: fallbackReel };
  } catch (err: any) {
    console.error('[ReelService] Error creating persistent reel:', err);
    return { success: false, error: err?.message || 'Failed to create reel' };
  }
}

/**
 * Permanently deletes a reel from Supabase and local store.
 */
export async function deletePersistentReel(reelId: string, authorId: string): Promise<boolean> {
  if (isSupabaseConfigured() && isValidUuid(reelId)) {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', reelId)
        .eq('author_id', authorId);

      if (error) {
        console.warn('[ReelService] Supabase delete error:', error.message);
      }
    } catch (err) {
      console.warn('[ReelService] Supabase delete exception:', err);
    }
  }

  deleteReelHighlight(reelId);
  return true;
}

/**
 * Updates a reel's title or caption in Supabase and local store.
 */
export async function editPersistentReel(
  reelId: string,
  updates: { title?: string; caption?: string },
  authorId: string
): Promise<boolean> {
  if (isSupabaseConfigured() && isValidUuid(reelId)) {
    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) {
        payload.video_title = updates.title;
        payload.prompt = updates.title;
      }
      if (updates.caption !== undefined) {
        payload.caption = updates.caption;
      }

      const { error } = await supabase
        .from('posts')
        .update(payload)
        .eq('id', reelId)
        .eq('author_id', authorId);

      if (error) {
        console.warn('[ReelService] Supabase update error:', error.message);
      }
    } catch (err) {
      console.warn('[ReelService] Supabase update exception:', err);
    }
  }

  editReelHighlight(reelId, {
    title: updates.title,
    caption: updates.caption,
  });
  return true;
}

/**
 * Safe, idempotent migration of legacy LocalStorage reels:
 * - Checks metfa_reels_v1
 * - Skips ephemeral blob: URLs (cannot be migrated across sessions)
 * - Migrates reels with permanent URLs to Supabase if authenticated
 * - Never silently deletes local records
 */
export async function migrateLocalStorageReels(currentUserId: string): Promise<{
  totalLocal: number;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}> {
  const localReels = getReelHighlights();
  if (!localReels.length || !isSupabaseConfigured() || !isValidUuid(currentUserId)) {
    return {
      totalLocal: localReels.length,
      migratedCount: 0,
      skippedCount: localReels.length,
      errors: [],
    };
  }

  let migratedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const reel of localReels) {
    // Only migrate reels belonging to the current user
    if (reel.author?.id !== currentUserId) {
      skippedCount++;
      continue;
    }

    // Skip ephemeral blob: URLs
    if (reel.videoSrc.startsWith('blob:')) {
      skippedCount++;
      continue;
    }

    // If reel already has a valid UUID, it's already in Supabase
    if (isValidUuid(reel.id)) {
      skippedCount++;
      continue;
    }

    try {
      const insertPayload = {
        author_id: currentUserId,
        prompt: reel.promptUsed || reel.title || 'Migrated Reel',
        caption: reel.caption || '',
        video_src: reel.videoSrc,
        video_title: reel.title,
        video_thumbnail: reel.thumbnailSrc || null,
        post_type: 'reel',
        likes_count: reel.likesCount || 0,
        remix_count: 0,
        comments_count: reel.commentsCount || 0,
        shares_count: reel.sharesCount || 0,
        tags: ['reel', 'migrated'],
        feed_type: 'for_you',
        audio_track: reel.audioTrack || null,
        visibility: 'public',
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('posts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (!error && data?.id) {
        migratedCount++;
        // Update local reel ID to the persistent UUID
        reel.id = data.id;
      } else if (error) {
        errors.push(`Reel "${reel.title}": ${error.message}`);
      }
    } catch (err: any) {
      errors.push(`Reel "${reel.title}": ${err?.message || 'Migration failed'}`);
    }
  }

  if (migratedCount > 0) {
    saveReelHighlights(localReels);
  }

  return {
    totalLocal: localReels.length,
    migratedCount,
    skippedCount,
    errors,
  };
}
