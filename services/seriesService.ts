import {
  CommunityPost,
  PostAudience,
  ReelHighlight,
  SeriesContentType,
  VideoSeriesMeta,
} from '../types/community';
import {
  VideoSeriesDefinition,
  createSeriesDefinition,
  getCreatorSeriesDefinitions,
  hydrateSeriesMetaForItem,
  linkVideoToSeriesRegistry,
  upsertSeriesDefinition,
} from '../utils/videoSeries';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(v?: string | null): boolean {
  return Boolean(v && UUID_REGEX.test(v));
}

function isMissingSeriesRelationError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('video_series') ||
    msg.includes('series_id') ||
    msg.includes('series_part_number') ||
    msg.includes('series_type') ||
    msg.includes('is_ongoing')
  );
}

/**
 * Lists explicit creator-owned series definitions filtered by optional `seriesType` ('video' | 'text')
 * from local registry and forward-compatible Supabase `video_series` table.
 * Never auto-groups unrelated items or mixes Video Series with Text Series.
 */
export async function fetchCreatorVideoSeries(
  creatorId?: string | null,
  seriesType?: SeriesContentType
): Promise<VideoSeriesDefinition[]> {
  const localDefs = getCreatorSeriesDefinitions(creatorId, seriesType);
  if (!creatorId || !isSupabaseConfigured() || !isValidUuid(creatorId)) {
    return localDefs;
  }

  try {
    let query = supabase
      .from('video_series')
      .select(
        'id, creator_id, title, description, first_part_id, total_parts, visibility, is_published, series_type, is_ongoing, created_at'
      )
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (seriesType) {
      query = query.eq('series_type', seriesType);
    }

    let { data, error } = await query;

    // Pre-migration compatibility when series_type / is_ongoing columns are not yet added in DB
    if (error && isMissingSeriesRelationError(error)) {
      const legacyRetry = await supabase
        .from('video_series')
        .select(
          'id, creator_id, title, description, first_part_id, total_parts, visibility, is_published, created_at'
        )
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });
      data = legacyRetry.data as any;
      error = legacyRetry.error;
    }

    if (error) {
      if (!isMissingSeriesRelationError(error)) {
        console.warn('[SeriesService] Query notice:', error.message);
      }
      return localDefs;
    }

    const merged = new Map<string, VideoSeriesDefinition>();
    for (const row of (data as any[]) || []) {
      const rowType: SeriesContentType = row.series_type === 'text' ? 'text' : 'video';
      if (seriesType && rowType !== seriesType) continue;
      merged.set(row.id, {
        seriesId: row.id,
        title: row.title,
        description: row.description || undefined,
        creatorId: row.creator_id,
        firstPartId: row.first_part_id || undefined,
        totalParts: row.total_parts || undefined,
        visibility: row.visibility || 'public',
        isPublished: row.is_published !== false,
        seriesType: rowType,
        isOngoing: Boolean(row.is_ongoing),
        createdAt: row.created_at || new Date().toISOString(),
      });
    }
    for (const def of localDefs) {
      if (!merged.has(def.seriesId)) {
        merged.set(def.seriesId, def);
      }
    }
    return Array.from(merged.values());
  } catch {
    return localDefs;
  }
}

export const fetchCreatorSeries = fetchCreatorVideoSeries;

/**
 * Creates an explicit creator-linked Video or Text Series.
 * Uses Supabase `video_series` if migrated, otherwise local series registry cleanly.
 */
export async function createCreatorVideoSeries(params: {
  title: string;
  description?: string;
  creatorId: string;
  totalParts?: number;
  visibility?: PostAudience | 'private' | null;
  seriesType?: SeriesContentType;
  isOngoing?: boolean;
}): Promise<VideoSeriesDefinition> {
  const resolvedType: SeriesContentType = params.seriesType === 'text' ? 'text' : 'video';
  const resolvedOngoing = Boolean(params.isOngoing);

  if (isSupabaseConfigured() && isValidUuid(params.creatorId)) {
    try {
      const baseInsert = {
        creator_id: params.creatorId,
        title: params.title.trim(),
        description: params.description?.trim() || null,
        total_parts: params.totalParts && params.totalParts > 0 ? Math.floor(params.totalParts) : null,
        visibility: params.visibility || 'public',
        is_published: true,
      };

      let { data, error } = await supabase
        .from('video_series')
        .insert({
          ...baseInsert,
          series_type: resolvedType,
          is_ongoing: resolvedOngoing,
        })
        .select(
          'id, creator_id, title, description, first_part_id, total_parts, visibility, is_published, series_type, is_ongoing, created_at'
        )
        .single();

      if (error && isMissingSeriesRelationError(error)) {
        const retry = await supabase
          .from('video_series')
          .insert(baseInsert)
          .select('id, creator_id, title, description, first_part_id, total_parts, visibility, is_published, created_at')
          .single();
        data = retry.data as any;
        error = retry.error;
      }

      if (!error && data?.id) {
        const def: VideoSeriesDefinition = {
          seriesId: data.id,
          title: data.title,
          description: data.description || undefined,
          creatorId: data.creator_id,
          firstPartId: data.first_part_id || undefined,
          totalParts: data.total_parts || undefined,
          visibility: data.visibility || 'public',
          isPublished: data.is_published !== false,
          seriesType: resolvedType,
          isOngoing: resolvedOngoing,
          createdAt: data.created_at || new Date().toISOString(),
        };
        upsertSeriesDefinition(def);
        return def;
      }
    } catch {
      // Graceful fallback when proposal migration is not yet executed
    }
  }

  return createSeriesDefinition({
    ...params,
    seriesType: resolvedType,
    isOngoing: resolvedOngoing,
  });
}

export const createCreatorSeries = createCreatorVideoSeries;

/**
 * Persists explicit linkage between a published video, reel, or text post ID and a creator's series.
 * Safe when editing existing posts: preserves earlier parts untouched.
 */
export async function attachContentToSeries(contentId: string, meta: VideoSeriesMeta): Promise<void> {
  linkVideoToSeriesRegistry(contentId, meta);

  if (
    isSupabaseConfigured() &&
    isValidUuid(contentId) &&
    isValidUuid(meta.seriesId) &&
    isValidUuid(meta.creatorId)
  ) {
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          series_id: meta.seriesId,
          series_part_number: meta.partNumber,
          series_total_parts: meta.totalParts || null,
        })
        .eq('id', contentId)
        .eq('author_id', meta.creatorId);

      if (error && !isMissingSeriesRelationError(error)) {
        console.warn('[SeriesService] Post series update notice:', error.message);
      }

      if (meta.partNumber === 1) {
        await supabase
          .from('video_series')
          .update({ first_part_id: contentId })
          .eq('id', meta.seriesId)
          .eq('creator_id', meta.creatorId)
          .is('first_part_id', null);
      }
    } catch {
      // Non-fatal while proposal migration is pending
    }
  }
}

export const attachVideoToSeries = attachContentToSeries;

export function applySeriesRegistryHydrationToPost(post: CommunityPost): CommunityPost {
  return hydrateSeriesMetaForItem(post);
}

export function applySeriesRegistryHydrationToReel(reel: ReelHighlight): ReelHighlight {
  return hydrateSeriesMetaForItem(reel);
}
