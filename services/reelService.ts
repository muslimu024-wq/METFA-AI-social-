import { supabase, isSupabaseConfigured, getClientAuthToken } from './supabaseClient';
import { CommunityPost, PostAudience, ProfilePrivacy, ReelHighlight, VideoSeriesMeta } from '../types/community';
import { AudioTrack, ReelAudioConfig } from '../types/audio';
import { uploadMediaItem, UploadProgressInfo } from './storageService';
import { getDefaultAvatar, sanitizeAvatarUrl } from './authService';
import { fetchAuthorProfileById } from './postService';
import { fetchProfilesPrivacyBatch } from './followService';
import { normalizeProfilePrivacy } from '../utils/privacyPolicy';
import {
  packAudioTrackWithConfig,
  unpackStoredAudioTrack,
  verifyTrackSelectionAllowed,
} from '../utils/audioStore';
import { applySeriesRegistryHydrationToReel, attachVideoToSeries } from './seriesService';
import {
  getReelHighlights,
  saveReelHighlight,
  deleteReelHighlight,
  editReelHighlight,
  isRealReel,
} from '../utils/socialStore';

export interface CreateReelParams {
  title: string;
  caption: string;
  promptUsed?: string;
  videoSource: File | Blob | string;
  thumbnailSource?: string;
  duration: number;
  audioTrack?: AudioTrack;
  audioConfig?: ReelAudioConfig;
  musicTrack?: string;
  visibility?: PostAudience | 'private';
  series?: VideoSeriesMeta;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
    profilePrivacy?: ProfilePrivacy;
  };
}

export interface ReelOperationResult {
  success: boolean;
  reel?: ReelHighlight;
  error?: string;
  aborted?: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

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

/**
 * Maps a Supabase row (with joined profiles author) to a strongly typed ReelHighlight.
 * Preserves `row.visibility ?? null` cleanly (never guessing NULL as `'public'`).
 */
export function mapSupabaseRowToReel(row: any): ReelHighlight {
  const authorName =
    row.author?.display_name || row.author?.username || 'Metfa Creator';
  const authorUsername = row.author?.username || 'creator';
  const authorAvatar =
    row.author?.avatar_url?.trim() || getDefaultAvatar(authorUsername);
  const authorProfilePrivacy = normalizeProfilePrivacy(row.author?.profile_privacy ?? null);

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

  const { audioTrack: unpackedAudioTrack, audioConfig: unpackedAudioConfig } =
    unpackStoredAudioTrack(row.audio_track);

  const reel: ReelHighlight = {
    id: String(row.id),
    title: row.video_title || row.prompt || 'Metfa Reel',
    caption: row.caption || '',
    author: {
      id: row.author_id,
      name: authorName,
      username: authorUsername,
      avatar: sanitizeAvatarUrl(authorAvatar, authorUsername),
      isVerified: Boolean(row.author?.is_verified),
      profilePrivacy: authorProfilePrivacy,
    },
    authorProfilePrivacy,
    visibility: row.visibility !== undefined ? row.visibility : null,
    sourcePostType: row.post_type === 'reel' ? 'reel' : 'media',
    videoSrc: row.video_src || '',
    thumbnailSrc: row.video_thumbnail || undefined,
    duration: typeof row.duration === 'number' ? row.duration : 15,
    likesCount: Number(row.likes_count) || 0,
    commentsCount: Number(row.comments_count) || 0,
    sharesCount: Number(row.shares_count) || 0,
    createdAt: relativeTime,
    createdAtIso: row.created_at || undefined,
    promptUsed: row.prompt_used || row.prompt || undefined,
    musicTrack: unpackedAudioTrack
      ? `${unpackedAudioTrack.title} • ${unpackedAudioTrack.artist}`
      : undefined,
    audioTrack: unpackedAudioTrack,
    audioConfig: unpackedAudioConfig,
  };
  return applySeriesRegistryHydrationToReel(reel);
}

/**
 * Converts any eligible published video-bearing CommunityPost into a canonical ReelHighlight
 * WITHOUT mutating the underlying post_type in storage or database.
 */
export function convertCommunityPostToReel(post: CommunityPost): ReelHighlight | null {
  if (!post?.id || !post?.videoSrc || !String(post.videoSrc).trim()) return null;
  const authorPrivacy = normalizeProfilePrivacy(post.authorProfilePrivacy || post.author?.profilePrivacy);
  const candidate: ReelHighlight = {
    id: String(post.id),
    title: post.videoTitle || post.prompt || 'Metfa Video',
    caption: post.caption || '',
    author: {
      id: post.author?.id || 'creator',
      name: post.postingIdentity?.name || post.author?.name || 'Metfa Creator',
      username: post.postingIdentity?.username || post.author?.username || 'creator',
      avatar:
        post.postingIdentity?.avatar ||
        post.author?.avatar ||
        getDefaultAvatar(post.author?.username || 'creator'),
      isVerified: Boolean(post.author?.isVerified ?? true),
      profilePrivacy: authorPrivacy,
    },
    authorProfilePrivacy: authorPrivacy,
    visibility: post.visibility !== undefined ? post.visibility : null,
    sourcePostType: post.postType === 'reel' ? 'reel' : 'media',
    videoSrc: post.videoSrc,
    thumbnailSrc: post.videoThumbnail || post.imageSrc || undefined,
    duration: 15,
    likesCount: Number(post.likesCount) || 0,
    commentsCount: Number(post.commentsCount) || 0,
    sharesCount: Number(post.sharesCount) || 0,
    viewsCount: post.viewsCount,
    isLiked: post.isLiked,
    isSaved: post.isBookmarked,
    createdAt: post.createdAt || 'Recently',
    createdAtIso: post.createdAtIso,
    promptUsed: post.prompt,
    musicTrack: post.audioTrack ? `${post.audioTrack.title} • ${post.audioTrack.artist}` : undefined,
    audioTrack: post.audioTrack,
    audioConfig: post.audioConfig,
    series: post.series,
  };
  const hydrated = applySeriesRegistryHydrationToReel(candidate);
  return isRealReel(hydrated) ? hydrated : null;
}

async function resolveMissingReelAuthors(rows: any[]): Promise<void> {
  const missingAuthorIds = Array.from(
    new Set(
      rows
        .filter((row: any) => (!row.author || !row.author.display_name) && row.author_id)
        .map((row: any) => row.author_id as string)
    )
  );
  if (missingAuthorIds.length > 0) {
    await Promise.all(
      missingAuthorIds.map(async (authorId) => {
        const resolved = await fetchAuthorProfileById(authorId);
        if (resolved) {
          for (const row of rows) {
            if (row.author_id === authorId && (!row.author || !row.author.display_name)) {
              row.author = resolved;
            }
          }
        }
      })
    );
  }

  const missingPrivacyIds = Array.from(
    new Set(
      rows
        .filter((row: any) => row.author_id && !row.author?.profile_privacy)
        .map((row: any) => row.author_id as string)
    )
  );
  if (missingPrivacyIds.length > 0) {
    const privMap = await fetchProfilesPrivacyBatch(missingPrivacyIds);
    for (const row of rows) {
      if (row.author_id && privMap.has(row.author_id)) {
        row.author = row.author || { id: row.author_id };
        row.author.profile_privacy = privMap.get(row.author_id);
      }
    }
  }
}

async function fetchServerPersistentReels(): Promise<ReelHighlight[]> {
  if (typeof fetch === 'undefined') return [];
  try {
    const token = await getClientAuthToken().catch(() => null);
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch('/api/posts', { headers });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.posts)) return [];
    return data.posts
      .filter(
        (p: any) =>
          Boolean(p.videoSrc || p.video_src) &&
          String(p.videoSrc || p.video_src).trim().length > 0
      )
      .map((p: any) => {
        const authorPrivacy = normalizeProfilePrivacy(
          p.authorProfilePrivacy || p.author?.profilePrivacy || p.author?.profile_privacy
        );
        const mapped: ReelHighlight = {
          id: String(p.id),
          title: p.videoTitle || p.video_title || p.prompt || 'Metfa Reel',
          caption: p.caption || '',
          author: {
            id: p.author?.id || p.author_id || 'creator',
            name: p.author?.name || p.author?.display_name || 'Metfa Creator',
            username: p.author?.username || 'creator',
            avatar: p.author?.avatar || p.author?.avatar_url || getDefaultAvatar(p.author?.username || 'creator'),
            isVerified: Boolean(p.author?.isVerified ?? p.author?.is_verified ?? true),
            profilePrivacy: authorPrivacy,
          },
          authorProfilePrivacy: authorPrivacy,
          visibility: p.visibility !== undefined ? p.visibility : null,
          sourcePostType: (p.postType === 'reel' || p.post_type === 'reel') ? 'reel' : 'media',
          videoSrc: p.videoSrc || p.video_src,
          thumbnailSrc: p.videoThumbnail || p.video_thumbnail || p.imageSrc || undefined,
          duration: typeof p.duration === 'number' ? p.duration : 15,
          likesCount: Number(p.likesCount ?? p.likes_count) || 0,
          commentsCount: Number(p.commentsCount ?? p.comments_count) || 0,
          sharesCount: Number(p.sharesCount ?? p.shares_count) || 0,
          createdAt: p.createdAt || 'Recently',
          createdAtIso: p.createdAtIso || p.created_at || undefined,
          promptUsed: p.promptUsed || p.prompt_used || p.prompt || undefined,
          ...(() => {
            const unpacked = unpackStoredAudioTrack(p.audioTrack || p.audio_track);
            return {
              musicTrack:
                p.musicTrack ||
                (unpacked.audioTrack
                  ? `${unpacked.audioTrack.title} • ${unpacked.audioTrack.artist}`
                  : undefined),
              audioTrack: unpacked.audioTrack || p.audioTrack,
              audioConfig: p.audioConfig || unpacked.audioConfig,
            };
          })(),
          series: p.series,
        };
        return applySeriesRegistryHydrationToReel(mapped);
      })
      .filter(isRealReel);
  } catch {
    return [];
  }
}

export async function fetchPersistentReels(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ reels: ReelHighlight[]; error?: string; source: 'supabase' | 'local' }> {
  const limit = options?.limit || 30;
  const offset = options?.offset || 0;

  let supabaseReels: ReelHighlight[] | null = null;

  const runReelQuery = async (withExplicitFkey: boolean, withPrivacyCol: boolean) => {
    const profileRel = withExplicitFkey ? 'author:profiles!posts_author_id_fkey' : 'author:profiles';
    const profileCols = withPrivacyCol
      ? 'id, display_name, username, avatar_url, is_verified, profile_privacy'
      : 'id, display_name, username, avatar_url, is_verified';
    return supabase
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
        visibility,
        likes_count,
        comments_count,
        shares_count,
        tags,
        audio_track,
        created_at,
        ${profileRel} (${profileCols})
      `)
      .not('video_src', 'is', null)
      .neq('video_src', '')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
  };

  if (isSupabaseConfigured()) {
    try {
      let { data, error } = await runReelQuery(true, true);

      if (error && isMissingPrivacyColumnError(error)) {
        const retryNoPriv = await runReelQuery(true, false);
        data = retryNoPriv.data;
        error = retryNoPriv.error;
      }

      if (error) {
        console.warn('[ReelService] Supabase fetch error, trying without explicit fkey:', error.message);
        let fallbackRes = await runReelQuery(false, true);
        if (fallbackRes.error && isMissingPrivacyColumnError(fallbackRes.error)) {
          fallbackRes = await runReelQuery(false, false);
        }
        if (!fallbackRes.error && fallbackRes.data) {
          const validRows = (fallbackRes.data as any[]).filter((row) => Boolean(row.video_src));
          await resolveMissingReelAuthors(validRows);
          supabaseReels = validRows.map(mapSupabaseRowToReel).filter(isRealReel);
        }
      } else if (data) {
        const validRows = (data as any[]).filter((row) => Boolean(row.video_src));
        await resolveMissingReelAuthors(validRows);
        supabaseReels = validRows.map(mapSupabaseRowToReel).filter(isRealReel);
      }
    } catch (err: any) {
      console.warn('[ReelService] Unexpected error querying Supabase reels:', err);
    }
  }

  const localReels = getReelHighlights().filter(isRealReel);
  const serverReels = await fetchServerPersistentReels();

  if (supabaseReels !== null) {
    const mergedMap = new Map<string, ReelHighlight>();
    for (const r of supabaseReels) {
      mergedMap.set(r.id, r);
    }
    for (const r of serverReels) {
      if (!mergedMap.has(r.id)) {
        mergedMap.set(r.id, r);
      }
    }
    for (const r of localReels) {
      if (!isValidUuid(r.id) && !mergedMap.has(r.id) && r.videoSrc && !r.videoSrc.startsWith('blob:')) {
        mergedMap.set(r.id, r);
      }
    }
    return { reels: Array.from(mergedMap.values()), source: 'supabase' };
  }

  const fallbackMap = new Map<string, ReelHighlight>();
  for (const r of localReels) {
    if (r.videoSrc) fallbackMap.set(r.id, r);
  }
  for (const r of serverReels) {
    if (!fallbackMap.has(r.id)) fallbackMap.set(r.id, r);
  }
  return { reels: Array.from(fallbackMap.values()), source: 'local' };
}

function resolveVideoUploadFileName(videoSource: File | Blob | string): string {
  if (typeof File !== 'undefined' && videoSource instanceof File && videoSource.name) {
    return videoSource.name;
  }
  const mime = typeof videoSource !== 'string' ? (videoSource.type || '').toLowerCase() : '';
  if (mime.includes('webm')) return `reel_${Date.now()}.webm`;
  if (mime.includes('ogg')) return `reel_${Date.now()}.ogv`;
  if (mime.includes('3gpp')) return `reel_${Date.now()}.3gp`;
  return `reel_${Date.now()}.mp4`;
}

export async function createPersistentReel(
  params: CreateReelParams,
  onProgress?: (step: string) => void,
  options?: {
    signal?: AbortSignal;
    onUploadProgress?: (info: UploadProgressInfo) => void;
  }
): Promise<ReelOperationResult> {
  if (options?.signal?.aborted) {
    return { success: false, aborted: true, error: 'Reel publishing cancelled.' };
  }

  if (!params.author?.id) {
    return { success: false, error: 'Author profile ID is required' };
  }

  if (!params.videoSource) {
    return { success: false, error: 'Video file is required to create a reel' };
  }

  if (params.audioTrack) {
    const rightsCheck = verifyTrackSelectionAllowed(params.audioTrack);
    if (!rightsCheck.canSelect) {
      return {
        success: false,
        error:
          rightsCheck.reason ||
          'Selected soundtrack is no longer eligible for reuse under current rights rules.',
      };
    }
  }

  const resolvedVisibility = params.visibility || 'public';

  try {
    const isAlreadyUploadedUrl =
      typeof params.videoSource === 'string' &&
      !params.videoSource.startsWith('blob:') &&
      !params.videoSource.startsWith('data:');

    let permanentVideoUrl: string;
    if (isAlreadyUploadedUrl) {
      permanentVideoUrl = params.videoSource as string;
      onProgress?.('Attaching uploaded video & soundtrack...');
    } else {
      onProgress?.('Uploading video to cloud storage...');
      const videoUpload = await uploadMediaItem(params.videoSource, {
        userId: params.author.id,
        type: 'video',
        fileName: resolveVideoUploadFileName(params.videoSource),
        signal: options?.signal,
        visibility: resolvedVisibility,
        onProgress: options?.onUploadProgress,
      });

      if (!videoUpload?.url) {
        return { success: false, error: 'Failed to upload video media' };
      }

      permanentVideoUrl = videoUpload.url;
    }

    if (options?.signal?.aborted) {
      return { success: false, aborted: true, error: 'Reel publishing cancelled.' };
    }

    let permanentThumbUrl = params.thumbnailSource;
    if (
      params.thumbnailSource &&
      (params.thumbnailSource.startsWith('data:') || params.thumbnailSource.startsWith('blob:'))
    ) {
      try {
        onProgress?.('Processing reel cover thumbnail...');
        const thumbUpload = await uploadMediaItem(params.thumbnailSource, {
          userId: params.author.id,
          type: 'image',
          fileName: `thumb_${Date.now()}.jpg`,
          signal: options?.signal,
          visibility: resolvedVisibility,
        });
        if (thumbUpload?.url) {
          permanentThumbUrl = thumbUpload.url;
        }
      } catch (thumbErr: any) {
        if (thumbErr?.name === 'AbortError' || options?.signal?.aborted) {
          return { success: false, aborted: true, error: 'Reel publishing cancelled.' };
        }
        console.warn('[ReelService] Thumbnail upload warning:', thumbErr);
      }
    }

    if (options?.signal?.aborted) {
      return { success: false, aborted: true, error: 'Reel publishing cancelled.' };
    }

    onProgress?.('Saving reel metadata and attaching soundtrack...');

    const resolvedTitle = params.title.trim() || 'AI Creation Reel';
    const resolvedCaption = params.caption.trim() || 'Created with Metfa Studio #AI';

    if (isSupabaseConfigured() && isValidUuid(params.author.id)) {
      try {
        const insertPayload: Record<string, any> = {
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
          audio_track: packAudioTrackWithConfig(params.audioTrack, params.audioConfig),
          visibility: resolvedVisibility,
          is_pinned: false,
          is_edited: false,
          is_ai_generated: Boolean(params.promptUsed),
          prompt_used: params.promptUsed || null,
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

        if (error && resolvedVisibility === 'only_me' && isVisibilityConstraintError(error)) {
          const retry = await runInsert({ ...insertPayload, visibility: 'private' }, false);
          data = retry.data;
          error = retry.error;
        }

        if (!error && data) {
          const createdReel = mapSupabaseRowToReel(data);
          if (params.author.profilePrivacy) {
            createdReel.authorProfilePrivacy = params.author.profilePrivacy;
            createdReel.author.profilePrivacy = params.author.profilePrivacy;
          }
          if (params.series?.seriesId) {
            const enrichedSeries: VideoSeriesMeta = {
              ...params.series,
              creatorId: params.author.id,
              firstPartId: params.series.firstPartId || (params.series.partNumber === 1 ? createdReel.id : undefined),
            };
            createdReel.series = enrichedSeries;
            attachVideoToSeries(createdReel.id, enrichedSeries).catch(() => {});
          }
          saveReelHighlight(createdReel);
          return { success: true, reel: createdReel };
        } else if (error) {
          console.warn('[ReelService] Supabase insert notice:', error.message);
        }
      } catch (sbErr: any) {
        console.warn('[ReelService] Supabase insert exception:', sbErr);
      }
    }

    const fallbackId = `reel_${Date.now()}`;
    const enrichedFallbackSeries: VideoSeriesMeta | undefined = params.series?.seriesId
      ? {
          ...params.series,
          creatorId: params.author.id,
          firstPartId: params.series.firstPartId || (params.series.partNumber === 1 ? fallbackId : undefined),
        }
      : undefined;

    const fallbackReel: ReelHighlight = {
      id: fallbackId,
      title: resolvedTitle,
      caption: resolvedCaption,
      author: {
        id: params.author.id,
        name: params.author.name,
        username: params.author.username,
        avatar: params.author.avatar,
        isVerified: params.author.isVerified,
        profilePrivacy: params.author.profilePrivacy,
      },
      authorProfilePrivacy: params.author.profilePrivacy,
      visibility: resolvedVisibility,
      sourcePostType: 'reel',
      videoSrc: permanentVideoUrl,
      thumbnailSrc: permanentThumbUrl,
      duration: params.duration || 15,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: 'Just now',
      createdAtIso: new Date().toISOString(),
      promptUsed: params.promptUsed,
      musicTrack: params.musicTrack,
      audioTrack: params.audioTrack,
      audioConfig: params.audioConfig,
      series: enrichedFallbackSeries,
    };

    if (enrichedFallbackSeries) {
      attachVideoToSeries(fallbackReel.id, enrichedFallbackSeries).catch(() => {});
    }
    saveReelHighlight(fallbackReel);
    return { success: true, reel: fallbackReel };
  } catch (err: any) {
    if (err?.name === 'AbortError' || options?.signal?.aborted) {
      return { success: false, aborted: true, error: 'Reel publishing cancelled.' };
    }
    console.error('[ReelService] Error creating persistent reel:', err);
    return { success: false, error: err?.message || 'Failed to create reel' };
  }
}

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

export async function editPersistentReel(
  reelId: string,
  updates: { title?: string; caption?: string; visibility?: PostAudience | 'private' },
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
      if (updates.visibility !== undefined) {
        payload.visibility = updates.visibility;
      }

      let { error } = await supabase
        .from('posts')
        .update(payload)
        .eq('id', reelId)
        .eq('author_id', authorId);

      if (error && updates.visibility === 'only_me' && isVisibilityConstraintError(error)) {
        const retry = await supabase
          .from('posts')
          .update({ ...payload, visibility: 'private' })
          .eq('id', reelId)
          .eq('author_id', authorId);
        error = retry.error;
      }

      if (error) {
        console.warn('[ReelService] Supabase update error:', error.message);
      }
    } catch (err) {
      console.warn('[ReelService] Supabase update exception:', err);
    }
  }

  editReelHighlight(reelId, {
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.caption !== undefined ? { caption: updates.caption } : {}),
    ...(updates.visibility !== undefined ? { visibility: updates.visibility } : {}),
  });
  return true;
}

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
    if (reel.author?.id !== currentUserId) {
      skippedCount++;
      continue;
    }

    if (reel.videoSrc.startsWith('blob:')) {
      skippedCount++;
      continue;
    }

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
        visibility: reel.visibility || 'public',
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('posts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (!error && data?.id) {
        migratedCount++;
        reel.id = data.id;
      } else if (error) {
        errors.push(`Reel "${reel.title}": ${error.message}`);
      }
    } catch (err: any) {
      errors.push(`Reel "${reel.title}": ${err?.message || 'Migration failed'}`);
    }
  }

  if (migratedCount > 0) {
    // Re-save local cache after migration updates
    localReels.forEach((r) => saveReelHighlight(r));
  }

  return {
    totalLocal: localReels.length,
    migratedCount,
    skippedCount,
    errors,
  };
}
