import {
  CommunityPost,
  PostAudience,
  ReelHighlight,
  SeriesContentType,
  TextReadingProgress,
  VideoSeriesMeta,
  VideoWatchProgress,
} from '../types/community';
import { safeGetItem, safeSetItem } from './storageUtils';

const SERIES_REGISTRY_KEY = 'metfa_video_series_registry_v1';
const SERIES_VIDEO_LINKS_KEY = 'metfa_video_series_links_v1';
const WATCH_PROGRESS_KEY = 'metfa_video_watch_progress_v1';
const TEXT_READING_PROGRESS_KEY = 'metfa_text_reading_progress_v1';

export interface VideoSeriesDefinition {
  seriesId: string;
  title: string;
  description?: string;
  creatorId: string;
  firstPartId?: string;
  totalParts?: number;
  visibility?: PostAudience | 'private' | null;
  isPublished: boolean;
  seriesType: SeriesContentType;
  isOngoing?: boolean;
  createdAt: string;
}

export type ContentSeriesDefinition = VideoSeriesDefinition;

export interface SeriesNavigationContext {
  seriesId: string;
  seriesTitle: string;
  seriesDescription?: string;
  creatorId: string;
  currentPartNumber: number;
  /** Only reflects accessible parts or declared total when safe */
  totalDisplayParts?: number;
  accessibleParts: ReelHighlight[];
  currentIndex: number;
  previousPart: ReelHighlight | null;
  nextPart: ReelHighlight | null;
  firstPart: ReelHighlight | null;
  isOngoing?: boolean;
}

export interface TextSeriesNavigationContext {
  seriesId: string;
  seriesTitle: string;
  seriesDescription?: string;
  creatorId: string;
  creatorName: string;
  currentPartNumber: number;
  totalDisplayParts?: number;
  isOngoing: boolean;
  accessibleParts: CommunityPost[];
  currentIndex: number;
  previousPart: CommunityPost | null;
  nextPart: CommunityPost | null;
  firstPart: CommunityPost | null;
  continueReadingPart: CommunityPost | null;
}

export interface CreatorSeriesGroup {
  seriesId: string;
  seriesTitle: string;
  seriesDescription?: string;
  creatorId: string;
  parts: ReelHighlight[];
  latestCreatedAtMs: number;
}

export interface CreatorTextSeriesGroup {
  seriesId: string;
  seriesTitle: string;
  seriesDescription?: string;
  creatorId: string;
  isOngoing: boolean;
  totalParts?: number;
  parts: CommunityPost[];
  latestCreatedAtMs: number;
}

function parseJsonObject<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getStoredSeriesDefinitions(): VideoSeriesDefinition[] {
  const list = parseJsonObject<VideoSeriesDefinition[]>(safeGetItem(SERIES_REGISTRY_KEY), []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => Boolean(s?.seriesId && s?.title && s?.creatorId))
    .map((s) => ({
      ...s,
      seriesType: s.seriesType === 'text' ? 'text' : 'video',
      isOngoing: Boolean(s.isOngoing),
    }));
}

export function getCreatorSeriesDefinitions(
  creatorId?: string | null,
  seriesType?: SeriesContentType
): VideoSeriesDefinition[] {
  if (!creatorId) return [];
  const cleanId = creatorId.trim();
  return getStoredSeriesDefinitions().filter((s) => {
    if (s.creatorId !== cleanId) return false;
    if (seriesType && s.seriesType !== seriesType) return false;
    return true;
  });
}

export function upsertSeriesDefinition(def: VideoSeriesDefinition): VideoSeriesDefinition[] {
  const normalizedDef: VideoSeriesDefinition = {
    ...def,
    seriesType: def.seriesType === 'text' ? 'text' : 'video',
    isOngoing: Boolean(def.isOngoing),
  };
  const current = getStoredSeriesDefinitions();
  const next = [normalizedDef, ...current.filter((s) => s.seriesId !== normalizedDef.seriesId)];
  safeSetItem(SERIES_REGISTRY_KEY, JSON.stringify(next));
  return next;
}

export function createSeriesDefinition(params: {
  title: string;
  description?: string;
  creatorId: string;
  totalParts?: number;
  visibility?: PostAudience | 'private' | null;
  seriesType?: SeriesContentType;
  isOngoing?: boolean;
}): VideoSeriesDefinition {
  const def: VideoSeriesDefinition = {
    seriesId: `series_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: params.title.trim(),
    description: params.description?.trim() || undefined,
    creatorId: params.creatorId,
    totalParts: params.totalParts && params.totalParts > 0 ? Math.floor(params.totalParts) : undefined,
    visibility: params.visibility ?? 'public',
    isPublished: true,
    seriesType: params.seriesType === 'text' ? 'text' : 'video',
    isOngoing: Boolean(params.isOngoing),
    createdAt: new Date().toISOString(),
  };
  upsertSeriesDefinition(def);
  return def;
}

export function getStoredVideoSeriesLinks(): Record<string, VideoSeriesMeta> {
  const map = parseJsonObject<Record<string, VideoSeriesMeta>>(safeGetItem(SERIES_VIDEO_LINKS_KEY), {});
  return map && typeof map === 'object' ? map : {};
}

export function linkVideoToSeriesRegistry(contentId: string, meta: VideoSeriesMeta): void {
  if (!contentId || !meta?.seriesId || !meta?.creatorId || !meta?.seriesTitle) return;
  const links = getStoredVideoSeriesLinks();
  const defs = getStoredSeriesDefinitions();
  const existingDef = defs.find((d) => d.seriesId === meta.seriesId);
  const firstPartId =
    meta.firstPartId ||
    existingDef?.firstPartId ||
    (meta.partNumber === 1 ? contentId : undefined);
  const resolvedSeriesType: SeriesContentType =
    meta.seriesType === 'text' || existingDef?.seriesType === 'text' ? 'text' : 'video';
  const resolvedIsOngoing =
    typeof meta.isOngoing === 'boolean' ? meta.isOngoing : Boolean(existingDef?.isOngoing);

  const normalized: VideoSeriesMeta = {
    ...meta,
    seriesType: resolvedSeriesType,
    isOngoing: resolvedIsOngoing,
    partNumber: Math.max(1, Math.floor(Number(meta.partNumber) || 1)),
    totalParts:
      meta.totalParts && meta.totalParts > 0
        ? Math.floor(meta.totalParts)
        : existingDef?.totalParts,
    firstPartId,
    isPublished: meta.isPublished !== false,
  };

  links[contentId] = normalized;
  safeSetItem(SERIES_VIDEO_LINKS_KEY, JSON.stringify(links));

  upsertSeriesDefinition({
    seriesId: normalized.seriesId,
    title: normalized.seriesTitle,
    description: normalized.seriesDescription ?? existingDef?.description,
    creatorId: normalized.creatorId,
    firstPartId,
    totalParts: normalized.totalParts,
    visibility: normalized.visibility ?? existingDef?.visibility ?? 'public',
    isPublished: normalized.isPublished !== false,
    seriesType: resolvedSeriesType,
    isOngoing: resolvedIsOngoing,
    createdAt: existingDef?.createdAt || new Date().toISOString(),
  });
}

export const linkContentToSeriesRegistry = linkVideoToSeriesRegistry;

export function getVideoSeriesLink(contentId: string): VideoSeriesMeta | undefined {
  if (!contentId) return undefined;
  const links = getStoredVideoSeriesLinks();
  return links[contentId];
}

export function hydrateSeriesMetaForItem<T extends { id: string; author?: { id?: string }; series?: VideoSeriesMeta; videoSrc?: string }>(
  item: T
): T {
  const linked = getVideoSeriesLink(item.id);
  if (item.series?.seriesId) {
    // Enforce explicit creator match (never allow cross-creator hijacking)
    if (item.author?.id && item.series.creatorId && item.author.id !== item.series.creatorId) {
      return { ...item, series: undefined };
    }
    const defs = getStoredSeriesDefinitions();
    const def = defs.find((d) => d.seriesId === item.series!.seriesId);
    const mergedSeries: VideoSeriesMeta = {
      ...item.series,
      seriesType:
        item.series.seriesType ||
        linked?.seriesType ||
        def?.seriesType ||
        (item.videoSrc ? 'video' : 'text'),
      isOngoing:
        typeof item.series.isOngoing === 'boolean'
          ? item.series.isOngoing
          : typeof linked?.isOngoing === 'boolean'
          ? linked.isOngoing
          : Boolean(def?.isOngoing),
    };
    return {
      ...item,
      series: mergedSeries,
    };
  }
  if (!linked) return item;
  if (item.author?.id && linked.creatorId && item.author.id !== linked.creatorId) {
    return item;
  }
  return {
    ...item,
    series: {
      ...linked,
      seriesType: linked.seriesType || (item.videoSrc ? 'video' : 'text'),
    },
  };
}

/**
 * Watch progress persistence (for Continue Watching on Creator Profile & Series playback)
 */
export function getAllVideoWatchProgress(): Record<string, VideoWatchProgress> {
  const map = parseJsonObject<Record<string, VideoWatchProgress>>(safeGetItem(WATCH_PROGRESS_KEY), {});
  return map && typeof map === 'object' ? map : {};
}

export function recordVideoWatchProgress(progress: Omit<VideoWatchProgress, 'updatedAt'>): void {
  if (!progress.videoId || !Number.isFinite(progress.positionSeconds) || progress.positionSeconds < 0) return;
  const all = getAllVideoWatchProgress();
  all[progress.videoId] = {
    ...progress,
    positionSeconds: Math.max(0, Math.floor(progress.positionSeconds)),
    updatedAt: new Date().toISOString(),
  };
  safeSetItem(WATCH_PROGRESS_KEY, JSON.stringify(all));
}

export function getVideoWatchProgress(videoId?: string | null): VideoWatchProgress | null {
  if (!videoId) return null;
  const all = getAllVideoWatchProgress();
  return all[videoId] || null;
}

export function getContinueWatchingForCreator(
  accessibleVideos: ReelHighlight[]
): { video: ReelHighlight; progress: VideoWatchProgress } | null {
  if (!accessibleVideos.length) return null;
  const all = getAllVideoWatchProgress();
  let bestMatch: { video: ReelHighlight; progress: VideoWatchProgress; ts: number } | null = null;

  for (const video of accessibleVideos) {
    const p = all[video.id];
    if (!p || p.positionSeconds < 2) continue;
    // Skip effectively finished standalone clips (>95% watched) unless it has a next series part
    const dur = p.durationSeconds || video.duration || 0;
    if (dur > 0 && p.positionSeconds >= dur * 0.95) continue;
    const ts = Date.parse(p.updatedAt) || 0;
    if (!bestMatch || ts > bestMatch.ts) {
      bestMatch = { video, progress: p, ts };
    }
  }
  return bestMatch ? { video: bestMatch.video, progress: bestMatch.progress } : null;
}

/**
 * Text reading progress persistence (for Continue Reading on Text Series / Serial Stories)
 */
export function getAllTextReadingProgress(): Record<string, TextReadingProgress> {
  const map = parseJsonObject<Record<string, TextReadingProgress>>(
    safeGetItem(TEXT_READING_PROGRESS_KEY),
    {}
  );
  return map && typeof map === 'object' ? map : {};
}

export function recordTextReadingProgress(
  progress: Omit<TextReadingProgress, 'updatedAt'>
): void {
  if (!progress.seriesId || !progress.postId || !progress.creatorId) return;
  const all = getAllTextReadingProgress();
  all[progress.seriesId] = {
    ...progress,
    partNumber: Math.max(1, Math.floor(Number(progress.partNumber) || 1)),
    updatedAt: new Date().toISOString(),
  };
  safeSetItem(TEXT_READING_PROGRESS_KEY, JSON.stringify(all));
}

export function getTextReadingProgressForSeries(seriesId?: string | null): TextReadingProgress | null {
  if (!seriesId) return null;
  const all = getAllTextReadingProgress();
  return all[seriesId] || null;
}

export function getContinueReadingForCreator(
  accessiblePosts: CommunityPost[],
  creatorId?: string | null
): { post: CommunityPost; progress: TextReadingProgress } | null {
  if (!accessiblePosts.length) return null;
  const all = getAllTextReadingProgress();
  const postById = new Map<string, CommunityPost>();
  for (const raw of accessiblePosts) {
    const hydrated = hydrateSeriesMetaForItem(raw);
    if (!isExplicitTextSeriesPost(hydrated)) continue;
    if (creatorId && hydrated.series.creatorId !== creatorId) continue;
    postById.set(hydrated.id, hydrated);
  }

  let best: { post: CommunityPost; progress: TextReadingProgress; ts: number } | null = null;
  for (const progress of Object.values(all)) {
    if (!progress?.postId) continue;
    if (creatorId && progress.creatorId !== creatorId) continue;
    const matchedPost = postById.get(progress.postId);
    if (!matchedPost) continue;
    const ts = Date.parse(progress.updatedAt) || 0;
    if (!best || ts > best.ts) {
      best = { post: matchedPost, progress, ts };
    }
  }
  return best ? { post: best.post, progress: best.progress } : null;
}

/**
 * STRICT EXPLICIT-SERIES CHECK (VIDEO):
 * Never auto-groups unrelated videos from the same creator.
 * Never mixes Text Series into Video Series.
 */
export function isExplicitSeriesItem(reel?: ReelHighlight | null): reel is ReelHighlight & { series: VideoSeriesMeta } {
  if (!reel?.series?.seriesId || !reel.series.creatorId) return false;
  if (reel.series.isPublished === false) return false;
  if (reel.series.seriesType === 'text') return false;
  if (reel.author?.id && reel.author.id !== reel.series.creatorId) return false;
  return Boolean(reel.videoSrc);
}

/**
 * STRICT EXPLICIT-SERIES CHECK (TEXT / SERIAL STORIES):
 * Never auto-groups unrelated text posts from the same creator.
 * Never mixes Video Series into Text Series.
 */
export function isExplicitTextSeriesPost(
  post?: CommunityPost | null
): post is CommunityPost & { series: VideoSeriesMeta } {
  if (!post?.series?.seriesId || !post.series.creatorId) return false;
  if (post.series.isPublished === false) return false;
  if (post.series.seriesType === 'video') return false;
  if (post.videoSrc) return false;
  if (post.author?.id && post.author.id !== post.series.creatorId) return false;
  return true;
}

/**
 * Privacy-enforcing Video Series Resolver
 */
export function resolveSeriesNavigationContext(
  currentReel: ReelHighlight,
  allVideos: ReelHighlight[],
  canViewerAccessItem: (item: ReelHighlight) => boolean
): SeriesNavigationContext | null {
  const hydratedCurrent = hydrateSeriesMetaForItem(currentReel);
  if (!isExplicitSeriesItem(hydratedCurrent)) {
    return null;
  }
  if (!canViewerAccessItem(hydratedCurrent)) {
    return null;
  }

  const seriesId = hydratedCurrent.series.seriesId;
  const creatorId = hydratedCurrent.series.creatorId;

  const accessibleMap = new Map<string, ReelHighlight>();
  for (const rawItem of allVideos) {
    const item = hydrateSeriesMetaForItem(rawItem);
    if (!isExplicitSeriesItem(item)) continue;
    if (item.series.seriesId !== seriesId) continue;
    if (item.series.creatorId !== creatorId) continue;
    if (!canViewerAccessItem(item)) continue;
    if (!accessibleMap.has(item.id)) {
      accessibleMap.set(item.id, item);
    }
  }
  if (!accessibleMap.has(hydratedCurrent.id)) {
    accessibleMap.set(hydratedCurrent.id, hydratedCurrent);
  }

  const accessibleParts = Array.from(accessibleMap.values()).sort((a, b) => {
    const pa = a.series?.partNumber || 1;
    const pb = b.series?.partNumber || 1;
    if (pa !== pb) return pa - pb;
    const ta = a.createdAtIso ? Date.parse(a.createdAtIso) : 0;
    const tb = b.createdAtIso ? Date.parse(b.createdAtIso) : 0;
    return ta - tb;
  });

  const currentIndex = accessibleParts.findIndex((p) => p.id === hydratedCurrent.id);
  const previousPart = currentIndex > 0 ? accessibleParts[currentIndex - 1] : null;
  const nextPart =
    currentIndex >= 0 && currentIndex < accessibleParts.length - 1
      ? accessibleParts[currentIndex + 1]
      : null;

  const explicitFirstId = hydratedCurrent.series.firstPartId;
  const firstPart =
    (explicitFirstId && accessibleParts.find((p) => p.id === explicitFirstId)) ||
    accessibleParts[0] ||
    null;

  const totalDisplayParts =
    accessibleParts.length > 1
      ? accessibleParts.length
      : hydratedCurrent.series.totalParts && hydratedCurrent.series.totalParts >= accessibleParts.length
      ? hydratedCurrent.series.totalParts
      : accessibleParts.length > 0
      ? accessibleParts.length
      : undefined;

  return {
    seriesId,
    seriesTitle: hydratedCurrent.series.seriesTitle,
    seriesDescription: hydratedCurrent.series.seriesDescription,
    creatorId,
    currentPartNumber: hydratedCurrent.series.partNumber || Math.max(1, currentIndex + 1),
    totalDisplayParts,
    accessibleParts,
    currentIndex,
    previousPart,
    nextPart,
    firstPart: firstPart && firstPart.id !== hydratedCurrent.id ? firstPart : null,
    isOngoing: Boolean(hydratedCurrent.series.isOngoing),
  };
}

/**
 * Privacy-enforcing Text Series Resolver:
 * Filters parts through `canViewerAccessPost` BEFORE exposing titles, excerpts,
 * part counts, or navigation links. Never leaks restricted/private parts.
 */
export function resolveTextSeriesNavigationContext(
  currentPost: CommunityPost,
  allPosts: CommunityPost[],
  canViewerAccessPost: (post: CommunityPost) => boolean
): TextSeriesNavigationContext | null {
  const hydratedCurrent = hydrateSeriesMetaForItem(currentPost);
  if (!isExplicitTextSeriesPost(hydratedCurrent)) {
    return null;
  }
  if (!canViewerAccessPost(hydratedCurrent)) {
    return null;
  }

  const seriesId = hydratedCurrent.series.seriesId;
  const creatorId = hydratedCurrent.series.creatorId;

  const accessibleMap = new Map<string, CommunityPost>();
  for (const rawItem of allPosts) {
    const item = hydrateSeriesMetaForItem(rawItem);
    if (!isExplicitTextSeriesPost(item)) continue;
    if (item.series.seriesId !== seriesId) continue;
    if (item.series.creatorId !== creatorId) continue;
    if (!canViewerAccessPost(item)) continue;
    if (!accessibleMap.has(item.id)) {
      accessibleMap.set(item.id, item);
    }
  }
  if (!accessibleMap.has(hydratedCurrent.id)) {
    accessibleMap.set(hydratedCurrent.id, hydratedCurrent);
  }

  const accessibleParts = Array.from(accessibleMap.values()).sort((a, b) => {
    const pa = a.series?.partNumber || 1;
    const pb = b.series?.partNumber || 1;
    if (pa !== pb) return pa - pb;
    const ta = a.createdAtIso ? Date.parse(a.createdAtIso) : 0;
    const tb = b.createdAtIso ? Date.parse(b.createdAtIso) : 0;
    return ta - tb;
  });

  const currentIndex = accessibleParts.findIndex((p) => p.id === hydratedCurrent.id);
  const previousPart = currentIndex > 0 ? accessibleParts[currentIndex - 1] : null;
  const nextPart =
    currentIndex >= 0 && currentIndex < accessibleParts.length - 1
      ? accessibleParts[currentIndex + 1]
      : null;

  const explicitFirstId = hydratedCurrent.series.firstPartId;
  const firstPart =
    (explicitFirstId && accessibleParts.find((p) => p.id === explicitFirstId)) ||
    accessibleParts[0] ||
    null;

  // Determine planned/accessible total honestly without guessing or exposing restricted counts
  const declaredTotal =
    hydratedCurrent.series.totalParts && hydratedCurrent.series.totalParts >= accessibleParts.length
      ? hydratedCurrent.series.totalParts
      : undefined;
  const totalDisplayParts =
    declaredTotal ?? (accessibleParts.length > 1 ? accessibleParts.length : undefined);

  // Saved Continue Reading pointer to a different accessible part in this series
  const savedReading = getTextReadingProgressForSeries(seriesId);
  let continueReadingPart: CommunityPost | null = null;
  if (savedReading?.postId && savedReading.postId !== hydratedCurrent.id) {
    continueReadingPart = accessibleParts.find((p) => p.id === savedReading.postId) || null;
  }

  const creatorName =
    hydratedCurrent.author?.name ||
    hydratedCurrent.author?.username ||
    'Creator';

  return {
    seriesId,
    seriesTitle: hydratedCurrent.series.seriesTitle,
    seriesDescription: hydratedCurrent.series.seriesDescription,
    creatorId,
    creatorName,
    currentPartNumber: hydratedCurrent.series.partNumber || Math.max(1, currentIndex + 1),
    totalDisplayParts,
    isOngoing: Boolean(hydratedCurrent.series.isOngoing),
    accessibleParts,
    currentIndex,
    previousPart,
    nextPart,
    firstPart: firstPart && firstPart.id !== hydratedCurrent.id ? firstPart : null,
    continueReadingPart,
  };
}

export function groupCreatorVideosAndSeries(
  videos: ReelHighlight[],
  options?: {
    filter?: 'all' | 'series' | 'standalone';
    searchQuery?: string;
    sortBy?: 'newest' | 'oldest' | 'series';
  }
): {
  seriesGroups: CreatorSeriesGroup[];
  filteredVideos: ReelHighlight[];
} {
  const filter = options?.filter || 'all';
  const query = (options?.searchQuery || '').trim().toLowerCase();
  const sortBy = options?.sortBy || 'newest';

  const hydrated = videos.map((v) => hydrateSeriesMetaForItem(v));

  let list = hydrated.filter((v) => {
    const isSeries = isExplicitSeriesItem(v);
    if (filter === 'series' && !isSeries) return false;
    if (filter === 'standalone' && isSeries) return false;

    if (query) {
      const partText = v.series?.partNumber ? `part ${v.series.partNumber}` : '';
      const haystack = [
        v.title,
        v.caption,
        v.series?.seriesTitle,
        v.series?.seriesDescription,
        partText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const getTimestamp = (r: ReelHighlight) => (r.createdAtIso ? Date.parse(r.createdAtIso) || 0 : 0);

  if (sortBy === 'oldest') {
    list = [...list].sort((a, b) => getTimestamp(a) - getTimestamp(b));
  } else if (sortBy === 'series') {
    list = [...list].sort((a, b) => {
      const sa = a.series?.seriesTitle || '';
      const sb = b.series?.seriesTitle || '';
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      if (sa !== sb) return sa.localeCompare(sb);
      const pa = a.series?.partNumber || 0;
      const pb = b.series?.partNumber || 0;
      if (pa !== pb) return pa - pb;
      return getTimestamp(b) - getTimestamp(a);
    });
  } else {
    list = [...list].sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }

  const groupMap = new Map<string, CreatorSeriesGroup>();
  for (const v of list) {
    if (!isExplicitSeriesItem(v)) continue;
    const sid = v.series.seriesId;
    const existing = groupMap.get(sid);
    const ts = getTimestamp(v);
    if (!existing) {
      groupMap.set(sid, {
        seriesId: sid,
        seriesTitle: v.series.seriesTitle,
        seriesDescription: v.series.seriesDescription,
        creatorId: v.series.creatorId,
        parts: [v],
        latestCreatedAtMs: ts,
      });
    } else {
      existing.parts.push(v);
      if (ts > existing.latestCreatedAtMs) existing.latestCreatedAtMs = ts;
    }
  }

  const seriesGroups = Array.from(groupMap.values()).map((g) => ({
    ...g,
    parts: g.parts.sort((a, b) => (a.series?.partNumber || 1) - (b.series?.partNumber || 1)),
  }));

  return {
    seriesGroups,
    filteredVideos: list,
  };
}

export function groupCreatorTextSeries(
  posts: CommunityPost[],
  options?: {
    searchQuery?: string;
  }
): {
  textSeriesGroups: CreatorTextSeriesGroup[];
  filteredSeriesPosts: CommunityPost[];
} {
  const query = (options?.searchQuery || '').trim().toLowerCase();
  const hydrated = posts.map((p) => hydrateSeriesMetaForItem(p));

  const seriesPosts = hydrated.filter((p) => {
    if (!isExplicitTextSeriesPost(p)) return false;
    if (!query) return true;
    const partText = p.series?.partNumber ? `part ${p.series.partNumber}` : '';
    const haystack = [
      p.series.seriesTitle,
      p.series.seriesDescription,
      p.caption,
      p.prompt,
      partText,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  const getTimestamp = (p: CommunityPost) => (p.createdAtIso ? Date.parse(p.createdAtIso) || 0 : 0);
  const groupMap = new Map<string, CreatorTextSeriesGroup>();

  for (const p of seriesPosts) {
    const sid = p.series.seriesId;
    const ts = getTimestamp(p);
    const existing = groupMap.get(sid);
    if (!existing) {
      groupMap.set(sid, {
        seriesId: sid,
        seriesTitle: p.series.seriesTitle,
        seriesDescription: p.series.seriesDescription,
        creatorId: p.series.creatorId,
        isOngoing: Boolean(p.series.isOngoing),
        totalParts: p.series.totalParts,
        parts: [p],
        latestCreatedAtMs: ts,
      });
    } else {
      existing.parts.push(p);
      if (p.series.isOngoing) existing.isOngoing = true;
      if (p.series.totalParts && (!existing.totalParts || p.series.totalParts > existing.totalParts)) {
        existing.totalParts = p.series.totalParts;
      }
      if (ts > existing.latestCreatedAtMs) existing.latestCreatedAtMs = ts;
    }
  }

  const textSeriesGroups = Array.from(groupMap.values())
    .map((g) => ({
      ...g,
      parts: g.parts.sort((a, b) => (a.series?.partNumber || 1) - (b.series?.partNumber || 1)),
    }))
    .sort((a, b) => b.latestCreatedAtMs - a.latestCreatedAtMs);

  return {
    textSeriesGroups,
    filteredSeriesPosts: seriesPosts,
  };
}
