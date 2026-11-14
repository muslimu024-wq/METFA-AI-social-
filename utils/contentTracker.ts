/**
 * METFA SOCIAL — Client-Side Multi-Content Telemetry & Analytics API Client
 *
 * Browser-safe telemetry client supporting ALL 5 content types:
 * - reel
 * - video
 * - image
 * - carousel
 * - text
 *
 * Uses type-only imports from contentAnalyticsEngine so Node built-ins are never bundled.
 */

import React, { useEffect, useRef } from 'react';
import type {
  AIInsightItem,
  AnalyticsDateRange,
  ContentAnalyticsType,
  ContentCatalogDescriptor,
  ContentFilterType,
  CreatorStudioAnalyticsSummary,
  FollowAttributionMethod,
  IngestContentEventRequest,
  TrafficSourceType,
  UnifiedContentAnalytics,
} from '../services/contentAnalyticsEngine';
import type { CommunityPost, ReelHighlight } from '../types/community';
import { getClientAuthToken } from '../services/supabaseClient';
import { detectDeviceType } from './videoTracker';

export type {
  AIInsightItem,
  AnalyticsDateRange,
  ContentAnalyticsType,
  ContentCatalogDescriptor,
  ContentFilterType,
  CreatorStudioAnalyticsSummary,
  FollowAttributionMethod,
  TrafficSourceType,
  UnifiedContentAnalytics,
};

const ATTRIBUTION_STORAGE_KEY = 'metfa_follow_attribution_history_v1';
const ATTRIBUTION_WINDOW_MS = 15 * 60 * 1000;

// In-memory client dedup cache to avoid duplicate network chatter across React re-renders
const sentClientDedupKeys = new Map<string, number>();

export function clientResolveContentType(item: {
  contentType?: ContentAnalyticsType;
  postType?: string;
  feedType?: string;
  videoSrc?: string;
  imageSrc?: string;
  imageGallery?: string[];
}): ContentAnalyticsType {
  if (item.contentType && ['reel', 'video', 'image', 'carousel', 'text'].includes(item.contentType)) {
    return item.contentType;
  }
  if (item.postType === 'reel' || item.feedType === 'reels') {
    return 'reel';
  }
  if (item.videoSrc) {
    return 'video';
  }
  if (Array.isArray(item.imageGallery) && item.imageGallery.length > 1) {
    return 'carousel';
  }
  if (item.imageSrc || (Array.isArray(item.imageGallery) && item.imageGallery.length === 1)) {
    return 'image';
  }
  return 'text';
}

export function postToContentDescriptor(post: CommunityPost): ContentCatalogDescriptor {
  const ct = clientResolveContentType({
    postType: post.postType,
    feedType: post.feedType,
    videoSrc: post.videoSrc,
    imageSrc: post.imageSrc,
    imageGallery: post.imageGallery,
  });
  return {
    id: post.id,
    contentType: ct,
    postType: post.postType,
    feedType: post.feedType,
    videoSrc: post.videoSrc,
    imageSrc: post.imageSrc,
    imageGallery: post.imageGallery,
    textBackgroundPreset: post.textBackgroundPreset,
    title: post.videoTitle || post.caption || post.prompt || `${ct.toUpperCase()} Post`,
    caption: post.caption,
    prompt: post.prompt,
    thumbnailUrl: post.videoThumbnail || post.imageSrc || post.imageGallery?.[0],
    videoThumbnail: post.videoThumbnail,
    creatorId: post.author?.id || '',
    createdAtLabel: post.createdAt || 'Recently',
    createdAtIso: post.createdAtIso,
    likesCount: post.likesCount || 0,
    commentsCount: post.commentsCount || post.comments?.length || 0,
    sharesCount: post.sharesCount || 0,
    savesCount: post.isBookmarked ? 1 : 0,
    isBookmarked: Boolean(post.isBookmarked),
    reactionCounts: post.reactionCounts,
  };
}

export function reelToContentDescriptor(reel: ReelHighlight): ContentCatalogDescriptor {
  return {
    id: reel.id,
    contentType: 'reel',
    postType: 'reel',
    feedType: 'reels',
    videoSrc: reel.videoSrc,
    title: reel.title || reel.caption || 'Metfa Reel',
    caption: reel.caption,
    prompt: reel.promptUsed || reel.title,
    thumbnailUrl: reel.thumbnailSrc,
    videoThumbnail: reel.thumbnailSrc,
    creatorId: reel.author?.id || '',
    createdAtLabel: reel.createdAt || 'Recently',
    createdAtIso: reel.createdAtIso,
    likesCount: reel.likesCount || 0,
    commentsCount: reel.commentsCount || 0,
    sharesCount: reel.sharesCount || 0,
    savesCount: reel.isSaved ? 1 : 0,
    isSaved: Boolean(reel.isSaved),
  };
}

function getClientSessionFingerprint(): string {
  if (typeof window === 'undefined') return 'ssr_session';
  try {
    const key = 'metfa_analytics_fp_v1';
    let fp = window.sessionStorage.getItem(key);
    if (!fp) {
      fp = `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(key, fp);
    }
    return fp;
  } catch {
    return 'anon_browser';
  }
}

export function recordViewedCreatorContent(creatorId: string, contentId: string, contentType: ContentAnalyticsType): void {
  if (typeof window === 'undefined' || !creatorId || !contentId) return;
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    const map: Record<string, { contentId: string; contentType: ContentAnalyticsType; viewedAt: number }> = raw
      ? JSON.parse(raw)
      : {};
    map[creatorId] = {
      contentId,
      contentType,
      viewedAt: Date.now(),
    };
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function getRecentAttributedContent(
  creatorId: string
): { contentId: string; contentType: ContentAnalyticsType } | null {
  if (typeof window === 'undefined' || !creatorId) return null;
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, { contentId: string; contentType: ContentAnalyticsType; viewedAt: number }> =
      JSON.parse(raw);
    const entry = map[creatorId];
    if (!entry) return null;
    if (Date.now() - entry.viewedAt <= ATTRIBUTION_WINDOW_MS) {
      return { contentId: entry.contentId, contentType: entry.contentType };
    }
  } catch {}
  return null;
}

async function sendTelemetryPayload(payload: IngestContentEventRequest): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const enriched: IngestContentEventRequest = {
    ...payload,
    viewerFingerprint: payload.viewerFingerprint || getClientSessionFingerprint(),
    deviceType: payload.deviceType || detectDeviceType(),
    createdAt: payload.createdAt || new Date().toISOString(),
  };

  const body = JSON.stringify(enriched);

  // Use authenticated fetch when token exists so viewerId is verified cleanly
  let token: string | null = null;
  try {
    token = await getClientAuthToken();
  } catch {}

  if (!token && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/analytics/content/event', blob)) {
        return true;
      }
    } catch {}
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch('/api/analytics/content/event', {
      method: 'POST',
      headers,
      body,
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function shouldSendWithClientDedup(dedupKey: string, windowMs: number): boolean {
  const prev = sentClientDedupKeys.get(dedupKey);
  const now = Date.now();
  if (prev && now - prev < windowMs) return false;
  sentClientDedupKeys.set(dedupKey, now);
  return true;
}

export function trackContentImpression(params: {
  contentId: string;
  contentType: ContentAnalyticsType;
  creatorId: string;
  viewerId?: string | null;
  trafficSource?: TrafficSourceType;
}): void {
  if (!params.contentId) return;
  const key = `imp:${params.contentId}:${params.trafficSource || 'feed'}`;
  if (!shouldSendWithClientDedup(key, 15 * 60 * 1000)) return;

  recordViewedCreatorContent(params.creatorId, params.contentId, params.contentType);

  void sendTelemetryPayload({
    kind: 'impression',
    contentId: params.contentId,
    contentType: params.contentType,
    creatorId: params.creatorId,
    viewerId: params.viewerId,
    trafficSource: params.trafficSource || (params.contentType === 'reel' ? 'reels' : 'feed'),
  });
}

export function trackCarouselSlideView(params: {
  contentId: string;
  creatorId: string;
  viewerId?: string | null;
  slideIndex: number;
  totalSlides: number;
  trafficSource?: TrafficSourceType;
}): void {
  if (!params.contentId || params.slideIndex < 0) return;
  const key = `slide:${params.contentId}:${params.slideIndex}`;
  if (!shouldSendWithClientDedup(key, 15 * 60 * 1000)) return;

  void sendTelemetryPayload({
    kind: 'carousel_slide_view',
    contentId: params.contentId,
    contentType: 'carousel',
    creatorId: params.creatorId,
    viewerId: params.viewerId,
    slideIndex: params.slideIndex,
    totalSlides: params.totalSlides,
    trafficSource: params.trafficSource || 'feed',
  });
}

export function trackTextExpand(params: {
  contentId: string;
  creatorId: string;
  viewerId?: string | null;
  trafficSource?: TrafficSourceType;
}): void {
  if (!params.contentId) return;
  const key = `expand:${params.contentId}`;
  if (!shouldSendWithClientDedup(key, 15 * 60 * 1000)) return;

  void sendTelemetryPayload({
    kind: 'text_expand',
    contentId: params.contentId,
    contentType: 'text',
    creatorId: params.creatorId,
    viewerId: params.viewerId,
    trafficSource: params.trafficSource || 'feed',
  });
}

export function trackTextReadEngagement(params: {
  contentId: string;
  creatorId: string;
  viewerId?: string | null;
  dwellSeconds: number;
  trafficSource?: TrafficSourceType;
}): void {
  if (!params.contentId || params.dwellSeconds < 3) return;
  const key = `read:${params.contentId}`;
  if (!shouldSendWithClientDedup(key, 15 * 60 * 1000)) return;

  void sendTelemetryPayload({
    kind: 'text_read_engagement',
    contentId: params.contentId,
    contentType: 'text',
    creatorId: params.creatorId,
    viewerId: params.viewerId,
    dwellSeconds: Math.round(params.dwellSeconds * 10) / 10,
    trafficSource: params.trafficSource || 'feed',
  });
}

export function trackVideoRetentionBucket(params: {
  contentId: string;
  contentType: 'reel' | 'video';
  creatorId: string;
  viewerId?: string | null;
  bucketIndex: number;
  trafficSource?: TrafficSourceType;
}): void {
  if (!params.contentId || params.bucketIndex < 0 || params.bucketIndex > 9) return;
  const key = `ret:${params.contentId}:${params.bucketIndex}`;
  if (!shouldSendWithClientDedup(key, 30 * 60 * 1000)) return;

  void sendTelemetryPayload({
    kind: 'video_retention',
    contentId: params.contentId,
    contentType: params.contentType,
    creatorId: params.creatorId,
    viewerId: params.viewerId,
    bucketIndex: params.bucketIndex,
    trafficSource: params.trafficSource || (params.contentType === 'reel' ? 'reels' : 'feed'),
  });
}

export function trackFollowAttribution(params: {
  creatorId: string;
  viewerId?: string | null;
  contentId?: string;
  contentType?: ContentAnalyticsType;
  attributionMethod: FollowAttributionMethod;
  followDelta: 1 | -1;
  trafficSource?: TrafficSourceType;
}): void {
  if (!params.creatorId) return;
  if (params.viewerId && params.viewerId === params.creatorId) return;

  let resolvedContentId = params.contentId || '';
  let resolvedContentType = params.contentType || 'text';
  let method = params.attributionMethod;

  if (!resolvedContentId && method === 'direct_profile_follow') {
    const recent = getRecentAttributedContent(params.creatorId);
    if (recent) {
      resolvedContentId = recent.contentId;
      resolvedContentType = recent.contentType;
      method = 'assisted_profile_follow';
    }
  }

  void sendTelemetryPayload({
    kind: 'follow_attribution',
    contentId: resolvedContentId || 'profile',
    contentType: resolvedContentType,
    creatorId: params.creatorId,
    viewerId: params.viewerId,
    attributionMethod: method,
    followDelta: params.followDelta,
    trafficSource: params.trafficSource || (method === 'direct_content_follow' ? 'feed' : 'profile'),
  });
}

export function trackEngagementAction(params: {
  contentId: string;
  contentType: ContentAnalyticsType;
  creatorId: string;
  viewerId?: string | null;
  action: 'like' | 'comment' | 'share' | 'save';
  trafficSource?: TrafficSourceType;
}): void {
  if (!params.contentId) return;
  void sendTelemetryPayload({
    kind: 'engagement_action',
    contentId: params.contentId,
    contentType: params.contentType,
    creatorId: params.creatorId,
    viewerId: params.viewerId,
    engagementAction: params.action,
    trafficSource: params.trafficSource || (params.contentType === 'reel' ? 'reels' : 'feed'),
  });
}

/**
 * Viewport telemetry wrapper using IntersectionObserver:
 * - Emits deduplicated `impression` after 1s at >= 50% visibility.
 * - For `carousel`, automatically logs Slide 0 impression view cleanly.
 * - For `text`, measures genuine continuous visibility >= 3s to record `text_read_engagement`.
 */
export interface ContentTelemetryObserverProps {
  contentId: string;
  contentType: ContentAnalyticsType;
  creatorId: string;
  viewerId?: string | null;
  trafficSource?: TrafficSourceType;
  totalSlides?: number;
  className?: string;
  children: React.ReactNode;
}

export const ContentTelemetryObserver: React.FC<ContentTelemetryObserverProps> = ({
  contentId,
  contentType,
  creatorId,
  viewerId,
  trafficSource = 'feed',
  totalSlides = 0,
  className,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const impressionTimerRef = useRef<number | null>(null);
  const readTimerRef = useRef<number | null>(null);
  const visibleSinceRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined' || !contentId) return;

    const clearTimers = () => {
      if (impressionTimerRef.current !== null) {
        window.clearTimeout(impressionTimerRef.current);
        impressionTimerRef.current = null;
      }
      if (readTimerRef.current !== null) {
        window.clearTimeout(readTimerRef.current);
        readTimerRef.current = null;
      }
      visibleSinceRef.current = null;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
          if (visibleSinceRef.current === null) {
            visibleSinceRef.current = performance.now();
          }

          if (impressionTimerRef.current === null) {
            impressionTimerRef.current = window.setTimeout(() => {
              trackContentImpression({
                contentId,
                contentType,
                creatorId,
                viewerId,
                trafficSource,
              });
              if (contentType === 'carousel' && totalSlides > 1) {
                trackCarouselSlideView({
                  contentId,
                  creatorId,
                  viewerId,
                  slideIndex: 0,
                  totalSlides,
                  trafficSource,
                });
              }
            }, 900);
          }

          if (contentType === 'text' && readTimerRef.current === null) {
            readTimerRef.current = window.setTimeout(() => {
              const dwellSeconds = visibleSinceRef.current
                ? (performance.now() - visibleSinceRef.current) / 1000
                : 3.1;
              trackTextReadEngagement({
                contentId,
                creatorId,
                viewerId,
                dwellSeconds,
                trafficSource,
              });
            }, 3100);
          }
        } else {
          clearTimers();
        }
      },
      { threshold: [0.45] }
    );

    observer.observe(el);
    return () => {
      clearTimers();
      observer.disconnect();
    };
  }, [contentId, contentType, creatorId, viewerId, trafficSource, totalSlides]);

  return React.createElement(
    'div',
    { ref: containerRef, className },
    children
  );
};

export async function fetchUnifiedContentAnalytics(
  content: ContentCatalogDescriptor,
  dateRange: AnalyticsDateRange = '30d'
): Promise<UnifiedContentAnalytics | null> {
  try {
    const token = await getClientAuthToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/analytics/content/item', {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, dateRange }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.analytics || null;
    }
  } catch (err) {
    console.warn('[ContentTracker] Error fetching unified content analytics:', err);
  }
  return null;
}

export async function fetchCreatorStudioAnalytics(params: {
  creatorId: string;
  catalog: ContentCatalogDescriptor[];
  contentFilter?: ContentFilterType;
  dateRange?: AnalyticsDateRange;
}): Promise<CreatorStudioAnalyticsSummary | null> {
  try {
    const token = await getClientAuthToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/analytics/content/studio', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        creatorId: params.creatorId,
        catalog: params.catalog,
        contentFilter: params.contentFilter || 'all',
        dateRange: params.dateRange || '30d',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.studio || null;
    }
  } catch (err) {
    console.warn('[ContentTracker] Error fetching creator studio analytics:', err);
  }
  return null;
}

export async function generateContentAIInsights(params: {
  contentFilter: ContentFilterType;
  summary: Partial<CreatorStudioAnalyticsSummary> | Partial<UnifiedContentAnalytics>;
  contentId?: string;
}): Promise<{ insights: AIInsightItem[]; source: 'gemini' | 'deterministic' } | null> {
  try {
    const token = await getClientAuthToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/analytics/content/ai-insights', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        insights: Array.isArray(data.insights) ? data.insights : [],
        source: data.source === 'gemini' ? 'gemini' : 'deterministic',
      };
    }
  } catch (err) {
    console.warn('[ContentTracker] Error generating AI insights:', err);
  }
  return null;
}
