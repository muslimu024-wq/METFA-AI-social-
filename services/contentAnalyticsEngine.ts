/**
 * METFA SOCIAL — Unified Multi-Content Creator Studio Analytics Engine
 *
 * Supports ALL 5 canonical content types:
 * 1. reel      (90s Reels & short-form vertical reels)
 * 2. video     (Standard feed/profile video posts)
 * 3. image     (Single-image posts & AI artwork)
 * 4. carousel  (Multi-image carousel posts, imageGallery length > 1)
 * 5. text      (Text-only posts & gradient text canvas posts)
 *
 * STRICT REAL-DATA INVARIANTS:
 * - Zero fake, seeded, hardcoded, or synthetic metrics.
 * - Zero cross-type leakage (no video watch time/retention applied to image/carousel/text).
 * - Metrics with 0 recorded events return `null` with explicit "Insufficient data" indicators.
 * - Excludes creator self-views from public impressions and reach.
 * - Net follower attribution prevents follow/unfollow toggle inflation.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { videoAnalyticsEngine, VideoAnalyticsSummary } from './videoAnalyticsEngine';

export type ContentAnalyticsType = 'reel' | 'video' | 'image' | 'carousel' | 'text';
export type ContentFilterType = 'all' | ContentAnalyticsType;
export type AnalyticsDateRange = '7d' | '30d' | '90d' | 'all';
export type TrafficSourceType = 'feed' | 'reels' | 'profile' | 'page' | 'group' | 'search' | 'direct';
export type FollowAttributionMethod = 'direct_content_follow' | 'assisted_profile_follow' | 'direct_profile_follow';

export type ContentEventKind =
  | 'impression'
  | 'video_retention'
  | 'carousel_slide_view'
  | 'text_expand'
  | 'text_read_engagement'
  | 'follow_attribution'
  | 'engagement_action';

export interface ContentAnalyticsEvent {
  eventId: string;
  kind: ContentEventKind;
  contentId: string;
  contentType: ContentAnalyticsType;
  creatorId: string;
  viewerId: string | null;
  viewerFingerprint: string;
  trafficSource: TrafficSourceType;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  isSelfView: boolean;
  // Content-specific optional telemetry
  slideIndex?: number;
  totalSlides?: number;
  bucketIndex?: number; // 0..9 (10% deciles) for video retention
  dwellSeconds?: number;
  attributionMethod?: FollowAttributionMethod;
  followDelta?: 1 | -1;
  engagementAction?: 'like' | 'comment' | 'share' | 'save';
  createdAt: string;
}

export interface IngestContentEventRequest {
  kind: ContentEventKind;
  contentId: string;
  contentType: ContentAnalyticsType;
  creatorId: string;
  viewerId?: string | null;
  viewerFingerprint?: string;
  trafficSource?: TrafficSourceType;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  slideIndex?: number;
  totalSlides?: number;
  bucketIndex?: number;
  dwellSeconds?: number;
  attributionMethod?: FollowAttributionMethod;
  followDelta?: 1 | -1;
  engagementAction?: 'like' | 'comment' | 'share' | 'save';
  createdAt?: string;
}

export interface ContentCatalogDescriptor {
  id: string;
  contentType?: ContentAnalyticsType;
  postType?: string;
  feedType?: string;
  videoSrc?: string;
  imageSrc?: string;
  imageGallery?: string[];
  textBackgroundPreset?: string;
  title?: string;
  caption?: string;
  prompt?: string;
  thumbnailUrl?: string;
  videoThumbnail?: string;
  creatorId: string;
  createdAtLabel?: string;
  createdAtIso?: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  savesCount?: number;
  isBookmarked?: boolean;
  isSaved?: boolean;
  reactionCounts?: Record<string, number>;
  isPremium?: boolean;
}

export interface TrafficSourceEntry {
  source: TrafficSourceType;
  label: string;
  count: number;
  percentage: number;
}

export interface RetentionBucketEntry {
  bucketIndex: number;
  rangeLabel: string;
  viewers: number;
  retentionPercent: number;
  dropOffFromPreviousPercent: number | null;
}

export interface CarouselSlideEntry {
  slideIndex: number;
  label: string;
  views: number;
  uniqueViewers: number;
  retentionFromSlide1Percent: number | null;
  dropOffFromPreviousPercent: number | null;
}

export interface AIInsightItem {
  id: string;
  contentTypeScope: ContentFilterType;
  priority: 'high' | 'medium' | 'info';
  category: string;
  title: string;
  detail: string;
  actionableStep: string;
  basedOnMetric: string;
}

export interface UnifiedContentAnalytics {
  contentId: string;
  contentType: ContentAnalyticsType;
  creatorId: string;
  title: string;
  thumbnailUrl?: string;
  createdAtLabel: string;
  createdAtIso?: string;
  dateRange: AnalyticsDateRange;

  // Shared Metrics
  impressions: number;
  reach: number; // Unique external viewers
  selfViewsExcluded: number;
  likesAndReactions: number;
  reactionBreakdown: Record<string, number>;
  comments: number;
  shares: number;
  saves: number;
  totalEngagements: number;
  engagementRate: number | null; // (totalEngagements / impressions) * 100

  trafficSources: {
    entries: TrafficSourceEntry[];
    totalAttributedImpressions: number;
    hasData: boolean;
  };

  audienceBreakdown: {
    deviceBreakdown: {
      mobile: number;
      desktop: number;
      tablet: number;
      hasData: boolean;
    };
    uniqueViewers: number;
    hourlyDistribution: { [hour: number]: number };
    hasSufficientData: boolean;
  };

  followersGained: {
    netGained: number;
    directContentFollows: number;
    assistedProfileFollows: number;
    hasData: boolean;
    attributionRule: string;
  };

  // Period Comparison (based on dated event logs inside range vs previous range)
  periodComparison: {
    hasPreviousPeriodData: boolean;
    impressionsDeltaPercent: number | null;
    reachDeltaPercent: number | null;
    engagementsDeltaPercent: number | null;
    followersDeltaPercent: number | null;
  };

  // Content-Specific Metrics (strictly non-overlapping!)
  videoMetrics: {
    totalViews: number;
    uniqueViewers: number;
    totalPlayTimeSeconds: number;
    averageWatchTimeSeconds: number | null;
    completionRate: number | null;
    completionCount: number;
    retentionTimeline: {
      buckets: RetentionBucketEntry[];
      hasData: boolean;
      highestDropOffBucketLabel: string | null;
    };
    monetization: VideoAnalyticsSummary['monetization'];
  } | null;

  imageMetrics: {
    impressions: number;
    reach: number;
    imageEngagement: number;
    saves: number;
    shares: number;
    comments: number;
    likesAndReactions: number;
    engagementRate: number | null;
    saveRate: number | null;
  } | null;

  carouselMetrics: {
    impressions: number;
    reach: number;
    slideCount: number;
    totalSlideViews: number;
    slideProgression: CarouselSlideEntry[];
    lastSlideCompletionRate: number | null;
    highestDropOffSlideLabel: string | null;
    hasSlideProgressionData: boolean;
  } | null;

  textMetrics: {
    impressions: number;
    reach: number;
    characterCount: number;
    isExpandable: boolean;
    expandClicks: number;
    expandRate: number | null;
    readingEngagementEvents: number;
    readingEngagementRate: number | null;
    reactions: number;
    comments: number;
    shares: number;
    saves: number;
  } | null;

  aiInsights: AIInsightItem[];
  trackingStartedAt: string;
  hasEventTelemetry: boolean;
  dataIntegrityNotice: string;
}

export interface ContentFormatPerformanceRow {
  contentType: ContentAnalyticsType;
  label: string;
  itemsCount: number;
  impressions: number;
  reach: number;
  totalEngagements: number;
  likesAndReactions: number;
  comments: number;
  shares: number;
  saves: number;
  followersGained: number;
  engagementRate: number | null;
  specificHighlightLabel: string;
  specificHighlightValue: string;
}

export interface CreatorStudioAnalyticsSummary {
  creatorId: string;
  dateRange: AnalyticsDateRange;
  contentFilter: ContentFilterType;
  totalItems: number;
  filteredItemsCount: number;

  // Overall Account Summary Metrics
  impressions: number;
  reach: number;
  likesAndReactions: number;
  comments: number;
  shares: number;
  saves: number;
  totalEngagements: number;
  engagementRate: number | null;
  followersGained: {
    netGained: number;
    directContentFollows: number;
    assistedProfileFollows: number;
    directProfileFollows: number;
    hasData: boolean;
    attributionRule: string;
  };

  periodComparison: {
    hasPreviousPeriodData: boolean;
    impressionsDeltaPercent: number | null;
    reachDeltaPercent: number | null;
    engagementsDeltaPercent: number | null;
    followersDeltaPercent: number | null;
    note: string;
  };

  trafficSources: {
    entries: TrafficSourceEntry[];
    totalAttributedImpressions: number;
    hasData: boolean;
  };

  audienceBreakdown: {
    deviceBreakdown: {
      mobile: number;
      desktop: number;
      tablet: number;
      hasData: boolean;
    };
    uniqueViewers: number;
    hasSufficientData: boolean;
  };

  formatBreakdown: ContentFormatPerformanceRow[];
  topContent: UnifiedContentAnalytics[];
  aiInsights: AIInsightItem[];

  // Video/Reel account rollups (shown only when video/reel or 'all' is active)
  videoRollup: {
    totalVideosAndReels: number;
    totalViews: number;
    totalPlayTimeSeconds: number;
    averageCompletionRate: number | null;
    totalCreatorEarningsCents: number;
  } | null;

  trackingStartedAt: string;
  hasSufficientData: boolean;
  dataIntegrityNotice: string;
}

export const FOLLOWER_ATTRIBUTION_RULE =
  'Direct follows on a post or Reel are attributed immediately to that item. Follows on your Profile within 15 minutes of viewing an item are credited as assisted attribution to the last viewed item; unfollows reverse prior attribution to prevent duplicate counting.';

const TRAFFIC_SOURCE_LABELS: Record<TrafficSourceType, string> = {
  feed: 'Community Feed',
  reels: '90s Reels Feed',
  profile: 'Creator Profile',
  page: 'Creator Pages',
  group: 'Community Groups',
  search: 'Global Search',
  direct: 'Direct / Shared Link',
};

const CONTENT_TYPE_LABELS: Record<ContentAnalyticsType, string> = {
  reel: 'Reels',
  video: 'Video Posts',
  image: 'Single Image',
  carousel: 'Carousel Posts',
  text: 'Text Posts',
};

const RETENTION_BUCKET_LABELS = [
  '0–10%',
  '10–20%',
  '20–30%',
  '30–40%',
  '40–50%',
  '50–60%',
  '60–70%',
  '70–80%',
  '80–90%',
  '90–100%',
];

/**
 * Deterministically classifies any METFA Social post or reel into one of the 5 canonical types.
 */
export function resolveContentType(item: Partial<ContentCatalogDescriptor>): ContentAnalyticsType {
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

function getDateWindowBounds(range: AnalyticsDateRange, referenceNowMs = Date.now()): {
  currentStartMs: number;
  currentEndMs: number;
  previousStartMs: number | null;
  previousEndMs: number | null;
} {
  const daysMap: Record<Exclude<AnalyticsDateRange, 'all'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };
  if (range === 'all') {
    return {
      currentStartMs: 0,
      currentEndMs: referenceNowMs,
      previousStartMs: null,
      previousEndMs: null,
    };
  }
  const windowMs = daysMap[range] * 24 * 60 * 60 * 1000;
  return {
    currentStartMs: referenceNowMs - windowMs,
    currentEndMs: referenceNowMs,
    previousStartMs: referenceNowMs - 2 * windowMs,
    previousEndMs: referenceNowMs - windowMs,
  };
}

function computeDeltaPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Generates strict, zero-hallucination, content-type-specific AI insights.
 * Enforces strict separation so video watch-time/retention NEVER appears for image, carousel, or text.
 */
export function generateContentSpecificInsights(analytics: UnifiedContentAnalytics): AIInsightItem[] {
  const { contentType, impressions, engagementRate, saves, shares, comments, likesAndReactions, trafficSources } = analytics;
  const insights: AIInsightItem[] = [];

  if (contentType === 'reel' || contentType === 'video') {
    const vm = analytics.videoMetrics;
    if (!vm || (vm.totalViews === 0 && impressions === 0)) {
      insights.push({
        id: `${analytics.contentId}_video_insufficient`,
        contentTypeScope: contentType,
        priority: 'info',
        category: 'Telemetry Baseline',
        title: `Awaiting ${contentType === 'reel' ? 'Reel' : 'Video'} Watch Telemetry`,
        detail: 'No qualified playback sessions (>= 3 seconds) or deduplicated impressions have been recorded yet for this video.',
        actionableStep: 'Share the video into relevant feed topics or Reels to capture initial hook retention and completion checkpoints.',
        basedOnMetric: 'Qualified Views = 0',
      });
      return insights;
    }

    const bucket0 = vm.retentionTimeline.buckets[0];
    const bucket1 = vm.retentionTimeline.buckets[1];
    if (vm.retentionTimeline.hasData && bucket0 && bucket1 && bucket0.viewers > 0) {
      const earlyDrop = Math.max(0, Math.round((1 - bucket1.viewers / bucket0.viewers) * 100));
      if (earlyDrop >= 35) {
        insights.push({
          id: `${analytics.contentId}_video_hook`,
          contentTypeScope: contentType,
          priority: 'high',
          category: 'Opening Hook Retention',
          title: `${earlyDrop}% Viewer Drop-Off After First 10%`,
          detail: `Audience dropped steeply between ${bucket0.rangeLabel} and ${bucket1.rangeLabel} (${vm.retentionTimeline.highestDropOffBucketLabel || '10–20%'}).`,
          actionableStep: 'Tighten the opening visual motion or headline in the first 2 seconds before introducing slower context.',
          basedOnMetric: `Retention drop: ${earlyDrop}%`,
        });
      }
    }

    if (vm.completionRate !== null) {
      insights.push({
        id: `${analytics.contentId}_video_completion`,
        contentTypeScope: contentType,
        priority: vm.completionRate < 40 ? 'high' : 'medium',
        category: 'Playback Completion',
        title:
          vm.completionRate >= 65
            ? `Strong ${vm.completionRate}% Completion Rate`
            : `${vm.completionRate}% Average Completion Rate`,
        detail: `Viewers watched an average of ${vm.averageWatchTimeSeconds ?? 0}s across ${vm.totalViews} qualified view${vm.totalViews === 1 ? '' : 's'}.`,
        actionableStep:
          vm.completionRate >= 65
            ? 'Replicate this pacing and duration structure for follow-up clips.'
            : `Trim mid-section pauses around ${vm.retentionTimeline.highestDropOffBucketLabel || 'the midpoint'} to push completion above 55%.`,
        basedOnMetric: `Completion: ${vm.completionRate}% • Avg Watch: ${vm.averageWatchTimeSeconds ?? 0}s`,
      });
    }

    if (shares > 0 || saves > 0) {
      insights.push({
        id: `${analytics.contentId}_video_distribution`,
        contentTypeScope: contentType,
        priority: 'medium',
        category: 'Share & Save Velocity',
        title: `${saves} Saves & ${shares} Shares Recorded`,
        detail: `High bookmark and share signals extend organic discovery across Reels and Community Feeds.`,
        actionableStep: 'Pin a concise call-to-action comment or prompt recipe to convert repeat savers into followers.',
        basedOnMetric: `Saves: ${saves}, Shares: ${shares}`,
      });
    }
    return insights;
  }

  if (contentType === 'image') {
    if (impressions === 0 && analytics.totalEngagements === 0) {
      insights.push({
        id: `${analytics.contentId}_image_insufficient`,
        contentTypeScope: 'image',
        priority: 'info',
        category: 'Visual Telemetry',
        title: 'Awaiting Single-Image Impressions',
        detail: 'No deduplicated viewport impressions or interactions have been recorded for this image post yet.',
        actionableStep: 'Include descriptive style tags or AI recipe context so viewers exploring the feed stop to inspect and save the artwork.',
        basedOnMetric: 'Impressions = 0',
      });
      return insights;
    }

    const saveRate = analytics.imageMetrics?.saveRate;
    if (saveRate !== null && saveRate !== undefined) {
      insights.push({
        id: `${analytics.contentId}_image_saves`,
        contentTypeScope: 'image',
        priority: saveRate >= 5 ? 'medium' : 'high',
        category: 'Visual Bookmark Resonance',
        title:
          saveRate >= 5
            ? `High Reference Value (${saveRate}% Save Rate)`
            : `${saveRate}% Image Save-to-Impression Ratio`,
        detail: `This single image generated ${saves} saves and ${shares} shares across ${impressions} impressions.`,
        actionableStep:
          saveRate >= 5
            ? 'Consider turning this visual concept into a multi-slide step-by-step carousel or remixable style prompt.'
            : 'Add clearer focal contrast or a compelling first-line caption framing the visual story to boost saves and shares.',
        basedOnMetric: `Save rate: ${saveRate}% (${saves}/${impressions})`,
      });
    }

    if (likesAndReactions > 0 || comments > 0) {
      insights.push({
        id: `${analytics.contentId}_image_reactions`,
        contentTypeScope: 'image',
        priority: 'medium',
        category: 'Community Conversation',
        title: `${likesAndReactions} Reactions & ${comments} Comments`,
        detail:
          engagementRate !== null
            ? `Achieved a ${engagementRate}% engagement rate on ${analytics.reach} unique viewers reached.`
            : `Recorded ${likesAndReactions} reactions and ${comments} comments so far.`,
        actionableStep:
          comments === 0
            ? 'Ask a specific visual feedback question in your caption to turn passive likes into discussion threads.'
            : 'Reply quickly to top comments to sustain visual feed momentum.',
        basedOnMetric: `Engagements: ${analytics.totalEngagements}`,
      });
    }
    return insights;
  }

  if (contentType === 'carousel') {
    const cm = analytics.carouselMetrics;
    if (!cm || (impressions === 0 && cm.totalSlideViews === 0)) {
      insights.push({
        id: `${analytics.contentId}_carousel_insufficient`,
        contentTypeScope: 'carousel',
        priority: 'info',
        category: 'Carousel Telemetry',
        title: 'Awaiting Carousel Slide Progression Events',
        detail: `This ${cm?.slideCount ?? 2}-slide carousel does not have recorded slide swipe or impression events yet.`,
        actionableStep: 'Ensure Slide 1 teases the outcome on later slides so feed readers swipe past the cover frame.',
        basedOnMetric: 'Slide views = 0',
      });
      return insights;
    }

    if (cm.hasSlideProgressionData && cm.lastSlideCompletionRate !== null) {
      insights.push({
        id: `${analytics.contentId}_carousel_completion`,
        contentTypeScope: 'carousel',
        priority: cm.lastSlideCompletionRate < 35 ? 'high' : 'medium',
        category: 'Slide Completion Depth',
        title: `${cm.lastSlideCompletionRate}% Reached Final Slide (${cm.slideCount} Slides)`,
        detail: cm.highestDropOffSlideLabel
          ? `Steepest swipe drop-off occurred entering ${cm.highestDropOffSlideLabel}.`
          : `Measured across ${cm.totalSlideViews} tracked slide view events.`,
        actionableStep:
          cm.lastSlideCompletionRate < 35
            ? `Audit ${cm.highestDropOffSlideLabel || 'Slide 2'} to tighten the visual transition and add a clearer swipe cue on the preceding slide.`
            : 'Readers are swiping all the way through—add a bookmark or follow prompt on the final slide.',
        basedOnMetric: `Last-slide completion: ${cm.lastSlideCompletionRate}%`,
      });
    } else {
      insights.push({
        id: `${analytics.contentId}_carousel_slides_needed`,
        contentTypeScope: 'carousel',
        priority: 'info',
        category: 'Slide Tracking Status',
        title: 'Insufficient Multi-Slide Navigation Events',
        detail: `Recorded ${impressions} carousel impression${impressions === 1 ? '' : 's'}, awaiting multi-slide swipe events beyond Slide 1.`,
        actionableStep: 'Lead Slide 1 with an intriguing numbered hook (e.g. Slide 1 of ' + cm.slideCount + ') to encourage swiping.',
        basedOnMetric: `Slide views logged: ${cm.totalSlideViews}`,
      });
    }

    if (saves > 0 || shares > 0) {
      insights.push({
        id: `${analytics.contentId}_carousel_saves`,
        contentTypeScope: 'carousel',
        priority: 'medium',
        category: 'Multi-Frame Utility',
        title: `${saves} Saves & ${shares} Shares Across Carousel`,
        detail: `Multi-image breakdowns frequently earn repeat bookmarks when each slide teaches or reveals one clear idea.`,
        actionableStep: 'Keep text overlay concise per slide so mobile users can scan without zooming.',
        basedOnMetric: `Saves: ${saves}, Shares: ${shares}`,
      });
    }
    return insights;
  }

  // TEXT POSTS
  const tm = analytics.textMetrics;
  if (!tm || (impressions === 0 && analytics.totalEngagements === 0)) {
    insights.push({
      id: `${analytics.contentId}_text_insufficient`,
      contentTypeScope: 'text',
      priority: 'info',
      category: 'Text Engagement Telemetry',
      title: 'Awaiting Text Read & Expansion Events',
      detail: 'No deduplicated text impressions, Read More clicks, or dwell reads have been recorded yet.',
      actionableStep: 'Lead with a bold opening sentence within the first 180 characters so readers pause or tap "See More".',
      basedOnMetric: 'Impressions = 0',
    });
    return insights;
  }

  if (tm.isExpandable && tm.expandRate !== null) {
    insights.push({
      id: `${analytics.contentId}_text_expand`,
      contentTypeScope: 'text',
      priority: tm.expandRate < 15 ? 'high' : 'medium',
      category: 'Read More Expansion',
      title: `${tm.expandRate}% Clicked "See More" (${tm.expandClicks} Expands)`,
      detail: `Measured from ${tm.expandClicks} expansion taps out of ${impressions} impressions on this ${tm.characterCount}-character post.`,
      actionableStep:
        tm.expandRate < 15
          ? 'Sharpen the opening two lines before the truncation cutoff to create stronger curiosity to expand.'
          : 'Your opening hook is converting readers cleanly into full post reads.',
      basedOnMetric: `Expand rate: ${tm.expandRate}%`,
    });
  }

  if (tm.readingEngagementRate !== null) {
    insights.push({
      id: `${analytics.contentId}_text_reading`,
      contentTypeScope: 'text',
      priority: tm.readingEngagementRate >= 40 ? 'medium' : 'high',
      category: 'Focused Reading Dwell',
      title: `${tm.readingEngagementRate}% Deep Reading Engagement Rate`,
      detail: `${tm.readingEngagementEvents} audience dwell sessions lasted 3+ seconds while reading this text post.`,
      actionableStep:
        tm.readingEngagementRate >= 40
          ? 'Break long takeaways into short paragraphs and end with an open question to lift comments.'
          : 'Use cleaner line spacing or high-contrast formatting on key statements so scrollers stop to read.',
      basedOnMetric: `Read events: ${tm.readingEngagementEvents} / ${impressions}`,
    });
  }

  if (comments > 0 || shares > 0) {
    insights.push({
      id: `${analytics.contentId}_text_discussion`,
      contentTypeScope: 'text',
      priority: 'medium',
      category: 'Discussion & Share Pull',
      title: `${comments} Comments • ${shares} Shares • ${saves} Saves`,
      detail: `Text discussions drive organic conversation threads${trafficSources.hasData ? ` led by ${trafficSources.entries[0]?.label || 'Feed'}` : ''}.`,
      actionableStep: 'Respond directly to nuanced replies to multiply follow-on comment depth.',
      basedOnMetric: `Comments: ${comments}, Shares: ${shares}`,
    });
  }

  return insights;
}

/**
 * Generates account-level Creator Studio AI Insights strictly respecting selected content filter.
 */
export function generateAccountAIInsights(
  contentFilter: ContentFilterType,
  formatBreakdown: ContentFormatPerformanceRow[],
  items: UnifiedContentAnalytics[],
  followersNet: number
): AIInsightItem[] {
  const insights: AIInsightItem[] = [];
  const totalImpressions = items.reduce((s, x) => s + x.impressions, 0);
  const totalEngagements = items.reduce((s, x) => s + x.totalEngagements, 0);

  if (items.length === 0) {
    return [
      {
        id: `acc_empty_${contentFilter}`,
        contentTypeScope: contentFilter,
        priority: 'info',
        category: 'Catalog Coverage',
        title: `No ${contentFilter === 'all' ? 'Content' : CONTENT_TYPE_LABELS[contentFilter]} Published Yet`,
        detail: 'Publish content in this format to begin measuring impressions, reach, and audience engagement.',
        actionableStep: 'Create your first post or Reel in this category to unlock format-specific recommendations.',
        basedOnMetric: 'Published items = 0',
      },
    ];
  }

  if (totalImpressions === 0 && totalEngagements === 0) {
    return [
      {
        id: `acc_nodata_${contentFilter}`,
        contentTypeScope: contentFilter,
        priority: 'info',
        category: 'Real-Data Tracking Active',
        title: 'Insufficient Audience Telemetry Yet',
        detail: `You have ${items.length} item${items.length === 1 ? '' : 's'} in this view, with 0 tracked impressions or interactions inside the selected date window.`,
        actionableStep: 'Keep publishing consistently—real impressions, traffic sources, and engagement metrics populate automatically as viewers interact.',
        basedOnMetric: 'Impressions = 0, Engagements = 0',
      },
    ];
  }

  if (contentFilter === 'all') {
    const activeFormats = formatBreakdown.filter((f) => f.itemsCount > 0 && (f.impressions > 0 || f.totalEngagements > 0));
    const sortedByEng = [...activeFormats].sort((a, b) => (b.engagementRate ?? -1) - (a.engagementRate ?? -1));
    const bestFormat = sortedByEng[0];
    if (bestFormat) {
      insights.push({
        id: 'acc_best_format',
        contentTypeScope: 'all',
        priority: 'high',
        category: 'Cross-Format Leader',
        title: `${bestFormat.label} Leads With ${bestFormat.engagementRate !== null ? `${bestFormat.engagementRate}% Engagement Rate` : `${bestFormat.totalEngagements} Total Engagements`}`,
        detail: `Across ${bestFormat.itemsCount} item${bestFormat.itemsCount === 1 ? '' : 's'}, ${bestFormat.label} generated ${bestFormat.impressions} impressions, ${bestFormat.saves} saves, and ${bestFormat.followersGained} attributed follower gains.`,
        actionableStep: `Allocate more of your weekly publishing cadence toward ${bestFormat.label}, while testing companion posts in complementary formats.`,
        basedOnMetric: `${bestFormat.label}: ${bestFormat.totalEngagements} engagements`,
      });
    }

    if (followersNet > 0) {
      const topConverter = [...items].sort((a, b) => b.followersGained.netGained - a.followersGained.netGained)[0];
      if (topConverter && topConverter.followersGained.netGained > 0) {
        insights.push({
          id: 'acc_follower_converter',
          contentTypeScope: 'all',
          priority: 'medium',
          category: 'Audience Conversion',
          title: `"${topConverter.title.slice(0, 42)}" Converted +${topConverter.followersGained.netGained} Followers`,
          detail: `Top-converting ${CONTENT_TYPE_LABELS[topConverter.contentType].toLowerCase()} item based on direct content follows and 15-minute assisted profile attribution.`,
          actionableStep: 'Pin or reference similar high-converting themes in upcoming posts to compound follower growth.',
          basedOnMetric: `+${topConverter.followersGained.netGained} attributed follows`,
        });
      }
    }
    return insights;
  }

  // Strictly scoped recommendations when filtered to one content type
  if (contentFilter === 'reel' || contentFilter === 'video') {
    const withCompletion = items.filter((i) => i.videoMetrics?.completionRate !== null);
    const avgComp =
      withCompletion.length > 0
        ? Math.round((withCompletion.reduce((s, i) => s + (i.videoMetrics?.completionRate || 0), 0) / withCompletion.length) * 10) / 10
        : null;
    if (avgComp !== null) {
      insights.push({
        id: `acc_video_comp_${contentFilter}`,
        contentTypeScope: contentFilter,
        priority: avgComp < 45 ? 'high' : 'medium',
        category: `${CONTENT_TYPE_LABELS[contentFilter]} Retention`,
        title: `${avgComp}% Average Completion Across ${withCompletion.length} Tracked ${CONTENT_TYPE_LABELS[contentFilter]}`,
        detail: `Total qualified watch time reached ${Math.round(items.reduce((s, i) => s + (i.videoMetrics?.totalPlayTimeSeconds || 0), 0))}s across ${items.reduce((s, i) => s + (i.videoMetrics?.totalViews || 0), 0)} qualified views.`,
        actionableStep:
          avgComp < 45
            ? 'Shorten intros to under 2 seconds and cut narrative plateaus mid-clip to lift completion.'
            : 'Strong retention momentum—experiment with a two-part sequel while keeping pacing tight.',
        basedOnMetric: `Avg completion rate: ${avgComp}%`,
      });
    }
  } else if (contentFilter === 'carousel') {
    const withLastSlide = items.filter((i) => i.carouselMetrics?.lastSlideCompletionRate !== null);
    if (withLastSlide.length > 0) {
      const avgLast = Math.round(
        (withLastSlide.reduce((s, i) => s + (i.carouselMetrics?.lastSlideCompletionRate || 0), 0) / withLastSlide.length) * 10
      ) / 10;
      insights.push({
        id: 'acc_carousel_depth',
        contentTypeScope: 'carousel',
        priority: avgLast < 35 ? 'high' : 'medium',
        category: 'Carousel Swipe Depth',
        title: `${avgLast}% Average Last-Slide Completion Across Carousels`,
        detail: `Measured across ${withLastSlide.length} carousel post${withLastSlide.length === 1 ? '' : 's'} with recorded multi-slide progression events.`,
        actionableStep:
          avgLast < 35
            ? 'Trim redundant middle frames and place your strongest takeaway on the final slide with a visual teaser on Slide 1.'
            : 'High slide-through depth—pair carousels with a save-worthy checklist on the final frame.',
        basedOnMetric: `Avg last-slide completion: ${avgLast}%`,
      });
    } else {
      insights.push({
        id: 'acc_carousel_pending_slides',
        contentTypeScope: 'carousel',
        priority: 'info',
        category: 'Carousel Telemetry',
        title: 'Carousel Slide Progression Awaiting Multi-Slide Swipes',
        detail: `${totalImpressions} carousel impressions and ${totalEngagements} engagements recorded; multi-slide drop-off unlocks once readers swipe beyond Slide 1.`,
        actionableStep: 'Use a "Swipe →" cover cue on Slide 1 of upcoming multi-image posts.',
        basedOnMetric: `Impressions: ${totalImpressions}`,
      });
    }
  } else if (contentFilter === 'text') {
    const totalExpands = items.reduce((s, i) => s + (i.textMetrics?.expandClicks || 0), 0);
    const totalReads = items.reduce((s, i) => s + (i.textMetrics?.readingEngagementEvents || 0), 0);
    insights.push({
      id: 'acc_text_read_summary',
      contentTypeScope: 'text',
      priority: 'medium',
      category: 'Text Reading & Conversation',
      title: `${totalExpands} "See More" Expands & ${totalReads} Focused Read Sessions`,
      detail: `Your ${items.length} text posts generated ${items.reduce((s, i) => s + i.comments, 0)} comments and ${items.reduce((s, i) => s + i.shares, 0)} shares across ${totalImpressions} impressions.`,
      actionableStep:
        totalExpands === 0
          ? 'Write longer, structured stories or tutorials that invite readers to tap "See More" after a crisp 2-line opener.'
          : 'Double down on topics that earn both high "See More" expansion rates and follow-up comments.',
      basedOnMetric: `Expands: ${totalExpands}, Reads: ${totalReads}`,
    });
  } else if (contentFilter === 'image') {
    const totalSaves = items.reduce((s, i) => s + i.saves, 0);
    const totalShares = items.reduce((s, i) => s + i.shares, 0);
    insights.push({
      id: 'acc_image_summary',
      contentTypeScope: 'image',
      priority: 'medium',
      category: 'Single-Image Resonance',
      title: `${totalSaves} Saves & ${totalShares} Shares Across Image Posts`,
      detail: `Single-image posts reached ${items.reduce((s, i) => s + i.reach, 0)} unique viewers with ${totalEngagements} total engagements.`,
      actionableStep: 'Pair high-save visuals with clear creative context in the caption to turn bookmarks into shares and new followers.',
      basedOnMetric: `Saves: ${totalSaves}, Shares: ${totalShares}`,
    });
  }

  // Merge top specific item insight cleanly if list still short
  const topItem = [...items].sort((a, b) => b.impressions + b.totalEngagements - (a.impressions + a.totalEngagements))[0];
  if (topItem) {
    const topItemInsights = generateContentSpecificInsights(topItem);
    for (const ti of topItemInsights) {
      if (insights.length < 4 && !insights.some((existing) => existing.category === ti.category)) {
        insights.push(ti);
      }
    }
  }

  return insights;
}

export class ContentAnalyticsEngine {
  private events: ContentAnalyticsEvent[] = [];
  private dedupIndex = new Map<string, number>(); // key -> timestampMs
  private dataFilePath: string;
  public readonly isIsolatedTest: boolean;
  public readonly TRACKING_EPOCH = '2026-11-13T00:00:00Z';

  constructor(options?: { dataFilePath?: string; isIsolatedTest?: boolean }) {
    this.isIsolatedTest = options?.isIsolatedTest === true;
    if (options?.dataFilePath) {
      this.dataFilePath = options.dataFilePath;
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {}
      }
    } else {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        try {
          fs.mkdirSync(dataDir, { recursive: true });
        } catch {}
      }
      this.dataFilePath = path.join(dataDir, 'content_analytics_events.json');
    }
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.events = parsed;
          for (const ev of this.events) {
            const key = this.buildDedupKey(ev);
            if (key) {
              const ts = new Date(ev.createdAt).getTime();
              const prev = this.dedupIndex.get(key) || 0;
              if (ts > prev) this.dedupIndex.set(key, ts);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[ContentAnalyticsEngine] Error loading disk events:', err);
    }
  }

  private persistToDisk(): void {
    try {
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.events, null, 2), 'utf-8');
    } catch (err) {
      console.error('[ContentAnalyticsEngine] Error saving disk events:', err);
    }
  }

  private buildDedupKey(ev: {
    kind: ContentEventKind;
    contentId: string;
    viewerFingerprint: string;
    slideIndex?: number;
    bucketIndex?: number;
    creatorId?: string;
  }): string | null {
    switch (ev.kind) {
      case 'impression':
        return `imp:${ev.contentId}:${ev.viewerFingerprint}`;
      case 'video_retention':
        return `ret:${ev.contentId}:${ev.viewerFingerprint}:${ev.bucketIndex ?? 0}`;
      case 'carousel_slide_view':
        return `slide:${ev.contentId}:${ev.viewerFingerprint}:${ev.slideIndex ?? 0}`;
      case 'text_expand':
        return `expand:${ev.contentId}:${ev.viewerFingerprint}`;
      case 'text_read_engagement':
        return `read:${ev.contentId}:${ev.viewerFingerprint}`;
      default:
        return null;
    }
  }

  /**
   * Record a validated content analytics event with anti-spam deduplication and self-view marking.
   */
  public recordEvent(req: IngestContentEventRequest): {
    success: boolean;
    event?: ContentAnalyticsEvent;
    deduplicated: boolean;
    rejectionReason?: string;
  } {
    if (!req.kind) {
      return { success: false, deduplicated: false, rejectionReason: 'Missing event kind' };
    }
    if (!req.contentId && req.attributionMethod !== 'direct_profile_follow') {
      return { success: false, deduplicated: false, rejectionReason: 'Missing contentId' };
    }
    if (!req.creatorId && req.kind === 'follow_attribution') {
      return { success: false, deduplicated: false, rejectionReason: 'Missing creatorId for follow attribution' };
    }

    const contentType = req.contentType || 'text';
    if (req.kind === 'video_retention') {
      if (typeof req.bucketIndex !== 'number' || req.bucketIndex < 0 || req.bucketIndex > 9) {
        return { success: false, deduplicated: false, rejectionReason: 'Invalid retention bucketIndex (must be 0..9)' };
      }
      if (contentType !== 'reel' && contentType !== 'video') {
        return { success: false, deduplicated: false, rejectionReason: 'video_retention only valid for reel/video content' };
      }
    }
    if (req.kind === 'carousel_slide_view') {
      if (typeof req.slideIndex !== 'number' || req.slideIndex < 0) {
        return { success: false, deduplicated: false, rejectionReason: 'Invalid carousel slideIndex' };
      }
    }
    if (req.kind === 'text_read_engagement') {
      if (typeof req.dwellSeconds === 'number' && req.dwellSeconds < 3) {
        return { success: false, deduplicated: false, rejectionReason: 'Text read engagement requires >= 3s dwell time' };
      }
    }

    const eventTimestamp = req.createdAt ? new Date(req.createdAt) : new Date();
    const tsMs = isNaN(eventTimestamp.getTime()) ? Date.now() : eventTimestamp.getTime();
    const fingerprint =
      req.viewerFingerprint ||
      req.viewerId ||
      crypto.createHash('sha256').update(`${req.contentId}:${req.kind}`).digest('hex').slice(0, 16);

    const isSelfView = Boolean(req.viewerId && req.creatorId && req.viewerId === req.creatorId);

    // Reject creator self-follows
    if (req.kind === 'follow_attribution' && isSelfView) {
      return { success: false, deduplicated: false, rejectionReason: 'Creator cannot follow self' };
    }

    const dedupKey = this.buildDedupKey({
      kind: req.kind,
      contentId: req.contentId || 'profile',
      viewerFingerprint: fingerprint,
      slideIndex: req.slideIndex,
      bucketIndex: req.bucketIndex,
      creatorId: req.creatorId,
    });

    const dedupWindowMs = req.kind === 'video_retention' ? 30 * 60 * 1000 : 15 * 60 * 1000;
    if (dedupKey) {
      const prevTs = this.dedupIndex.get(dedupKey);
      if (prevTs && Math.abs(tsMs - prevTs) < dedupWindowMs) {
        return { success: true, deduplicated: true };
      }
      this.dedupIndex.set(dedupKey, tsMs);
    }

    const event: ContentAnalyticsEvent = {
      eventId: `cev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      kind: req.kind,
      contentId: req.contentId || '',
      contentType,
      creatorId: req.creatorId || '',
      viewerId: req.viewerId || null,
      viewerFingerprint: fingerprint,
      trafficSource: req.trafficSource || (contentType === 'reel' ? 'reels' : 'feed'),
      deviceType: req.deviceType || 'desktop',
      isSelfView,
      slideIndex: req.slideIndex,
      totalSlides: req.totalSlides,
      bucketIndex: req.bucketIndex,
      dwellSeconds: req.dwellSeconds,
      attributionMethod: req.attributionMethod,
      followDelta: req.followDelta,
      engagementAction: req.engagementAction,
      createdAt: new Date(tsMs).toISOString(),
    };

    this.events.push(event);
    this.persistToDisk();

    return { success: true, event, deduplicated: false };
  }

  /**
   * Computes complete unified analytics for a single content item across shared + type-specific dimensions.
   */
  public getContentAnalytics(
    descriptor: ContentCatalogDescriptor,
    options?: {
      dateRange?: AnalyticsDateRange;
      nowMs?: number;
      videoEngineOverride?: typeof videoAnalyticsEngine;
    }
  ): UnifiedContentAnalytics {
    const dateRange = options?.dateRange || '30d';
    const nowMs = options?.nowMs ?? Date.now();
    const bounds = getDateWindowBounds(dateRange, nowMs);
    const vEngine = options?.videoEngineOverride || videoAnalyticsEngine;
    const contentType = resolveContentType(descriptor);

    const matchingEvents = this.events.filter((e) => e.contentId === descriptor.id);
    const inCurrentWindow = matchingEvents.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= bounds.currentStartMs && t <= bounds.currentEndMs;
    });
    const inPreviousWindow =
      bounds.previousStartMs !== null && bounds.previousEndMs !== null
        ? matchingEvents.filter((e) => {
            const t = new Date(e.createdAt).getTime();
            return t >= bounds.previousStartMs! && t < bounds.previousEndMs!;
          })
        : [];

    // Exclude creator self-views from public metrics
    const publicCurrent = inCurrentWindow.filter((e) => !e.isSelfView);
    const selfViewsExcluded = inCurrentWindow.filter((e) => e.isSelfView && e.kind === 'impression').length;
    const publicPrevious = inPreviousWindow.filter((e) => !e.isSelfView);

    const impressionsEvents = publicCurrent.filter((e) => e.kind === 'impression');
    const prevImpressionsEvents = publicPrevious.filter((e) => e.kind === 'impression');

    // Traffic Source breakdown
    const sourceCounts = new Map<TrafficSourceType, number>();
    const hourlyCounts: { [hour: number]: number } = {};
    for (let h = 0; h < 24; h++) hourlyCounts[h] = 0;

    const deviceCounts = { mobile: 0, desktop: 0, tablet: 0 };
    const uniqueViewers = new Set<string>();

    for (const imp of impressionsEvents) {
      uniqueViewers.add(imp.viewerFingerprint);
      deviceCounts[imp.deviceType] = (deviceCounts[imp.deviceType] || 0) + 1;
      sourceCounts.set(imp.trafficSource, (sourceCounts.get(imp.trafficSource) || 0) + 1);
      try {
        const h = new Date(imp.createdAt).getHours();
        hourlyCounts[h] = (hourlyCounts[h] || 0) + 1;
      } catch {}
    }

    // Video/Reel data reused cleanly from videoAnalyticsEngine
    let rawVideoSummary: VideoAnalyticsSummary | null = null;
    if (contentType === 'reel' || contentType === 'video') {
      rawVideoSummary = vEngine.getVideoAnalytics(descriptor.id, {
        title: descriptor.title || descriptor.caption || descriptor.prompt,
        thumbnailUrl: descriptor.thumbnailUrl || descriptor.videoThumbnail || descriptor.imageSrc,
        videoType: contentType === 'reel' ? 'reel' : 'post_video',
        creatorId: descriptor.creatorId,
        likesCount: descriptor.likesCount,
        commentsCount: descriptor.commentsCount,
        sharesCount: descriptor.sharesCount,
        savesCount: descriptor.savesCount ?? (descriptor.isBookmarked || descriptor.isSaved ? 1 : 0),
        isPremium: descriptor.isPremium,
      });
    }

    // Also include unique viewers & impressions for video/reel if playback sessions exist without impression pings
    const baseImpressionsCount = impressionsEvents.length;
    const effectiveVideoViews = rawVideoSummary?.totalViews ?? 0;
    const effectiveVideoUnique = rawVideoSummary?.audienceInsights.totalUniqueViewers ?? 0;
    const totalImpressions = Math.max(baseImpressionsCount, effectiveVideoViews);
    const totalReach = Math.max(uniqueViewers.size, effectiveVideoUnique);

    // Engagements (persisted post/reel counters + timestamped delta when filtering periods)
    const reactionBreakdown: Record<string, number> = {};
    if (descriptor.reactionCounts) {
      for (const [k, v] of Object.entries(descriptor.reactionCounts)) {
        if (typeof v === 'number' && v > 0) reactionBreakdown[k] = v;
      }
    }
    const reactionSum = Object.values(reactionBreakdown).reduce((a, b) => a + b, 0);
    const likesAndReactions = Math.max(descriptor.likesCount ?? 0, reactionSum);
    const comments = descriptor.commentsCount ?? 0;
    const shares = descriptor.sharesCount ?? 0;
    const saves = descriptor.savesCount ?? (descriptor.isBookmarked || descriptor.isSaved ? 1 : 0);
    const totalEngagements = likesAndReactions + comments + shares + saves;

    const denominator = totalImpressions > 0 ? totalImpressions : effectiveVideoViews;
    const engagementRate =
      denominator > 0 ? Math.round((totalEngagements / denominator) * 1000) / 10 : null;

    // Traffic Sources Array
    const totalImpForSources = impressionsEvents.length;
    const sourceEntries: TrafficSourceEntry[] = (Object.keys(TRAFFIC_SOURCE_LABELS) as TrafficSourceType[])
      .map((src) => {
        const count = sourceCounts.get(src) || 0;
        return {
          source: src,
          label: TRAFFIC_SOURCE_LABELS[src],
          count,
          percentage: totalImpForSources > 0 ? Math.round((count / totalImpForSources) * 1000) / 10 : 0,
        };
      })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    // Audience Device Breakdown (merge impression device telemetry + video session device telemetry if impressions missing)
    const totalDevicePings = deviceCounts.mobile + deviceCounts.desktop + deviceCounts.tablet;
    const audienceDeviceBreakdown =
      totalDevicePings > 0
        ? {
            mobile: Math.round((deviceCounts.mobile / totalDevicePings) * 100),
            desktop: Math.round((deviceCounts.desktop / totalDevicePings) * 100),
            tablet: Math.round((deviceCounts.tablet / totalDevicePings) * 100),
            hasData: true,
          }
        : rawVideoSummary?.audienceInsights.deviceBreakdown || {
            mobile: 0,
            desktop: 0,
            tablet: 0,
            hasData: false,
          };

    // Followers Gained Attribution
    const followEventsCurrent = publicCurrent.filter((e) => e.kind === 'follow_attribution');
    const netFollowPerViewer = new Map<string, { delta: number; method: FollowAttributionMethod }>();
    for (const fe of followEventsCurrent) {
      const prev = netFollowPerViewer.get(fe.viewerFingerprint);
      const nextDelta = Math.max(0, Math.min(1, (prev?.delta ?? 0) + (fe.followDelta ?? 1)));
      netFollowPerViewer.set(fe.viewerFingerprint, {
        delta: nextDelta,
        method: fe.attributionMethod || prev?.method || 'direct_content_follow',
      });
    }
    let netFollowersGained = 0;
    let directContentFollows = 0;
    let assistedProfileFollows = 0;
    for (const entry of netFollowPerViewer.values()) {
      if (entry.delta > 0) {
        netFollowersGained += entry.delta;
        if (entry.method === 'direct_content_follow') directContentFollows += entry.delta;
        else if (entry.method === 'assisted_profile_follow') assistedProfileFollows += entry.delta;
      }
    }

    // Previous Period Followers & Engagements
    const prevReachSet = new Set(prevImpressionsEvents.map((e) => e.viewerFingerprint));
    const prevFollowNet = Math.max(
      0,
      publicPrevious
        .filter((e) => e.kind === 'follow_attribution')
        .reduce((sum, e) => sum + (e.followDelta ?? 1), 0)
    );
    const currentActionEvents = publicCurrent.filter((e) => e.kind === 'engagement_action').length;
    const prevActionEvents = publicPrevious.filter((e) => e.kind === 'engagement_action').length;
    const hasPreviousPeriodData = prevImpressionsEvents.length > 0 || prevActionEvents > 0 || prevFollowNet > 0;

    // CONTENT-SPECIFIC SECTIONS
    let videoMetrics: UnifiedContentAnalytics['videoMetrics'] = null;
    let imageMetrics: UnifiedContentAnalytics['imageMetrics'] = null;
    let carouselMetrics: UnifiedContentAnalytics['carouselMetrics'] = null;
    let textMetrics: UnifiedContentAnalytics['textMetrics'] = null;

    if ((contentType === 'reel' || contentType === 'video') && rawVideoSummary) {
      const retentionEvents = publicCurrent.filter((e) => e.kind === 'video_retention' && typeof e.bucketIndex === 'number');
      const bucketViewerSets: Set<string>[] = Array.from({ length: 10 }, () => new Set<string>());
      for (const re of retentionEvents) {
        if (re.bucketIndex !== undefined && re.bucketIndex >= 0 && re.bucketIndex <= 9) {
          bucketViewerSets[re.bucketIndex].add(re.viewerFingerprint);
        }
      }
      const baselineBucketViewers = bucketViewerSets[0].size;
      const hasRetentionData = retentionEvents.length > 0 && baselineBucketViewers > 0;

      let highestDropVal = -1;
      let highestDropLabel: string | null = null;

      const retentionBuckets: RetentionBucketEntry[] = RETENTION_BUCKET_LABELS.map((label, idx) => {
        const viewers = bucketViewerSets[idx].size;
        const retentionPercent = baselineBucketViewers > 0 ? Math.min(100, Math.round((viewers / baselineBucketViewers) * 1000) / 10) : 0;
        let dropOffFromPreviousPercent: number | null = null;
        if (idx > 0 && bucketViewerSets[idx - 1].size > 0) {
          const prevCount = bucketViewerSets[idx - 1].size;
          const drop = Math.max(0, Math.round(((prevCount - viewers) / prevCount) * 1000) / 10);
          dropOffFromPreviousPercent = drop;
          if (drop > highestDropVal) {
            highestDropVal = drop;
            highestDropLabel = label;
          }
        }
        return {
          bucketIndex: idx,
          rangeLabel: label,
          viewers,
          retentionPercent,
          dropOffFromPreviousPercent,
        };
      });

      videoMetrics = {
        totalViews: rawVideoSummary.totalViews,
        uniqueViewers: totalReach,
        totalPlayTimeSeconds: rawVideoSummary.totalQualifiedWatchSeconds,
        averageWatchTimeSeconds: rawVideoSummary.averageWatchDurationSeconds,
        completionRate: rawVideoSummary.completionRate,
        completionCount: rawVideoSummary.completionCount,
        retentionTimeline: {
          buckets: retentionBuckets,
          hasData: hasRetentionData,
          highestDropOffBucketLabel: hasRetentionData && highestDropVal > 0 ? highestDropLabel : null,
        },
        monetization: rawVideoSummary.monetization,
      };
    } else if (contentType === 'image') {
      imageMetrics = {
        impressions: totalImpressions,
        reach: totalReach,
        imageEngagement: totalEngagements,
        saves,
        shares,
        comments,
        likesAndReactions,
        engagementRate,
        saveRate: totalImpressions > 0 ? Math.round((saves / totalImpressions) * 1000) / 10 : null,
      };
    } else if (contentType === 'carousel') {
      const slideCount = Array.isArray(descriptor.imageGallery) ? Math.max(2, descriptor.imageGallery.length) : 2;
      const slideEvents = publicCurrent.filter((e) => e.kind === 'carousel_slide_view' && typeof e.slideIndex === 'number');
      const slideViewers: Set<string>[] = Array.from({ length: slideCount }, () => new Set<string>());
      const slideRawViews: number[] = Array.from({ length: slideCount }, () => 0);

      for (const se of slideEvents) {
        const idx = se.slideIndex!;
        if (idx >= 0 && idx < slideCount) {
          slideViewers[idx].add(se.viewerFingerprint);
          slideRawViews[idx] += 1;
        }
      }

      const slide1Viewers = slideViewers[0]?.size || 0;
      const hasMultiSlideSwipes = slideEvents.some((e) => (e.slideIndex ?? 0) > 0);
      const hasSlideProgressionData = slide1Viewers > 0 && (slideCount <= 1 || hasMultiSlideSwipes || slideEvents.length > 0);

      let highestDropVal = -1;
      let highestDropSlide: string | null = null;

      const slideProgression: CarouselSlideEntry[] = Array.from({ length: slideCount }, (_, idx) => {
        const uv = slideViewers[idx].size;
        const retentionFromSlide1Percent =
          slide1Viewers > 0 ? Math.min(100, Math.round((uv / slide1Viewers) * 1000) / 10) : null;
        let dropOffFromPreviousPercent: number | null = null;
        if (idx > 0 && slideViewers[idx - 1].size > 0) {
          const prevUv = slideViewers[idx - 1].size;
          const drop = Math.max(0, Math.round(((prevUv - uv) / prevUv) * 1000) / 10);
          dropOffFromPreviousPercent = drop;
          if (drop > highestDropVal) {
            highestDropVal = drop;
            highestDropSlide = `Slide ${idx + 1}`;
          }
        }
        return {
          slideIndex: idx,
          label: `Slide ${idx + 1}`,
          views: slideRawViews[idx],
          uniqueViewers: uv,
          retentionFromSlide1Percent,
          dropOffFromPreviousPercent,
        };
      });

      const lastSlideViewers = slideViewers[slideCount - 1]?.size || 0;
      const lastSlideCompletionRate =
        slide1Viewers > 0 && hasMultiSlideSwipes
          ? Math.min(100, Math.round((lastSlideViewers / slide1Viewers) * 1000) / 10)
          : null;

      carouselMetrics = {
        impressions: totalImpressions,
        reach: totalReach,
        slideCount,
        totalSlideViews: slideEvents.length,
        slideProgression,
        lastSlideCompletionRate,
        highestDropOffSlideLabel: hasMultiSlideSwipes && highestDropVal > 0 ? highestDropSlide : null,
        hasSlideProgressionData,
      };
    } else {
      const fullText = (descriptor.caption || descriptor.prompt || '').trim();
      const charLimit = descriptor.textBackgroundPreset ? 220 : 180;
      const lineCount = (fullText.match(/\n/g) || []).length + 1;
      const isExpandable = fullText.length > charLimit || lineCount > 3;

      const expandClicks = publicCurrent.filter((e) => e.kind === 'text_expand').length;
      const readingEngagementEvents = publicCurrent.filter((e) => e.kind === 'text_read_engagement').length;

      textMetrics = {
        impressions: totalImpressions,
        reach: totalReach,
        characterCount: fullText.length,
        isExpandable,
        expandClicks,
        expandRate:
          isExpandable && totalImpressions > 0
            ? Math.min(100, Math.round((expandClicks / totalImpressions) * 1000) / 10)
            : null,
        readingEngagementEvents,
        readingEngagementRate:
          totalImpressions > 0
            ? Math.min(100, Math.round((readingEngagementEvents / totalImpressions) * 1000) / 10)
            : null,
        reactions: likesAndReactions,
        comments,
        shares,
        saves,
      };
    }

    const title =
      descriptor.title ||
      (descriptor.caption && descriptor.caption.slice(0, 72)) ||
      (descriptor.prompt && descriptor.prompt.slice(0, 72)) ||
      `${CONTENT_TYPE_LABELS[contentType]} Item`;

    const summary: UnifiedContentAnalytics = {
      contentId: descriptor.id,
      contentType,
      creatorId: descriptor.creatorId,
      title,
      thumbnailUrl: descriptor.thumbnailUrl || descriptor.videoThumbnail || descriptor.imageSrc || descriptor.imageGallery?.[0],
      createdAtLabel: descriptor.createdAtLabel || 'Recently',
      createdAtIso: descriptor.createdAtIso,
      dateRange,
      impressions: totalImpressions,
      reach: totalReach,
      selfViewsExcluded,
      likesAndReactions,
      reactionBreakdown,
      comments,
      shares,
      saves,
      totalEngagements,
      engagementRate,
      trafficSources: {
        entries: sourceEntries,
        totalAttributedImpressions: totalImpForSources,
        hasData: totalImpForSources > 0,
      },
      audienceBreakdown: {
        deviceBreakdown: audienceDeviceBreakdown,
        uniqueViewers: totalReach,
        hourlyDistribution: hourlyCounts,
        hasSufficientData: totalDevicePings > 0 || (rawVideoSummary?.audienceInsights.hasSufficientData ?? false),
      },
      followersGained: {
        netGained: netFollowersGained,
        directContentFollows,
        assistedProfileFollows,
        hasData: followEventsCurrent.length > 0,
        attributionRule: FOLLOWER_ATTRIBUTION_RULE,
      },
      periodComparison: {
        hasPreviousPeriodData,
        impressionsDeltaPercent: hasPreviousPeriodData ? computeDeltaPercent(baseImpressionsCount, prevImpressionsEvents.length) : null,
        reachDeltaPercent: hasPreviousPeriodData ? computeDeltaPercent(uniqueViewers.size, prevReachSet.size) : null,
        engagementsDeltaPercent: hasPreviousPeriodData ? computeDeltaPercent(currentActionEvents, prevActionEvents) : null,
        followersDeltaPercent: hasPreviousPeriodData ? computeDeltaPercent(netFollowersGained, prevFollowNet) : null,
      },
      videoMetrics,
      imageMetrics,
      carouselMetrics,
      textMetrics,
      aiInsights: [],
      trackingStartedAt: this.TRACKING_EPOCH,
      hasEventTelemetry: matchingEvents.length > 0 || (rawVideoSummary?.rawSessionsCount ?? 0) > 0,
      dataIntegrityNotice:
        matchingEvents.length === 0 && (rawVideoSummary?.rawSessionsCount ?? 0) === 0
          ? 'Real data only: Unified telemetry records real impressions, slide swipes, Read More clicks, and retention from Nov 13, 2026 onward. Metrics without recorded events show "Insufficient data".'
          : 'All metrics reflect verified deduplicated telemetry events, excluding creator self-views.',
    };

    summary.aiInsights = generateContentSpecificInsights(summary);
    return summary;
  }

  /**
   * Computes complete Creator Studio Analytics across all content types (or a filtered format + date range).
   */
  public getCreatorStudioAnalytics(
    creatorId: string,
    catalog: ContentCatalogDescriptor[],
    options?: {
      contentFilter?: ContentFilterType;
      dateRange?: AnalyticsDateRange;
      nowMs?: number;
      videoEngineOverride?: typeof videoAnalyticsEngine;
    }
  ): CreatorStudioAnalyticsSummary {
    const contentFilter = options?.contentFilter || 'all';
    const dateRange = options?.dateRange || '30d';
    const nowMs = options?.nowMs ?? Date.now();
    const bounds = getDateWindowBounds(dateRange, nowMs);

    const allItemAnalytics = catalog.map((item) =>
      this.getContentAnalytics(item, {
        dateRange,
        nowMs,
        videoEngineOverride: options?.videoEngineOverride,
      })
    );

    const filteredItems =
      contentFilter === 'all'
        ? allItemAnalytics
        : allItemAnalytics.filter((a) => a.contentType === contentFilter);

    // Format comparison matrix across all 5 content types (computed from all items so creator can compare formats)
    const allTypes: ContentAnalyticsType[] = ['reel', 'video', 'image', 'carousel', 'text'];
    const formatBreakdown: ContentFormatPerformanceRow[] = allTypes.map((ct) => {
      const bucket = allItemAnalytics.filter((i) => i.contentType === ct);
      const imp = bucket.reduce((s, i) => s + i.impressions, 0);
      const reach = bucket.reduce((s, i) => s + i.reach, 0);
      const eng = bucket.reduce((s, i) => s + i.totalEngagements, 0);
      const likes = bucket.reduce((s, i) => s + i.likesAndReactions, 0);
      const comments = bucket.reduce((s, i) => s + i.comments, 0);
      const shares = bucket.reduce((s, i) => s + i.shares, 0);
      const saves = bucket.reduce((s, i) => s + i.saves, 0);
      const followers = bucket.reduce((s, i) => s + i.followersGained.netGained, 0);
      const rate = imp > 0 ? Math.round((eng / imp) * 1000) / 10 : null;

      let specificHighlightLabel = 'Primary Signal';
      let specificHighlightValue = 'Insufficient data';

      if (ct === 'reel' || ct === 'video') {
        specificHighlightLabel = 'Avg Completion';
        const validComp = bucket.filter((i) => i.videoMetrics?.completionRate !== null);
        if (validComp.length > 0) {
          const avg = Math.round((validComp.reduce((s, i) => s + (i.videoMetrics?.completionRate || 0), 0) / validComp.length) * 10) / 10;
          specificHighlightValue = `${avg}%`;
        }
      } else if (ct === 'carousel') {
        specificHighlightLabel = 'Last-Slide Rate';
        const validCar = bucket.filter((i) => i.carouselMetrics?.lastSlideCompletionRate !== null);
        if (validCar.length > 0) {
          const avg = Math.round((validCar.reduce((s, i) => s + (i.carouselMetrics?.lastSlideCompletionRate || 0), 0) / validCar.length) * 10) / 10;
          specificHighlightValue = `${avg}%`;
        }
      } else if (ct === 'text') {
        specificHighlightLabel = 'Read More / Reads';
        const expands = bucket.reduce((s, i) => s + (i.textMetrics?.expandClicks || 0), 0);
        const reads = bucket.reduce((s, i) => s + (i.textMetrics?.readingEngagementEvents || 0), 0);
        if (expands > 0 || reads > 0) {
          specificHighlightValue = `${expands} expands • ${reads} reads`;
        }
      } else if (ct === 'image') {
        specificHighlightLabel = 'Save Rate';
        if (imp > 0) {
          specificHighlightValue = `${Math.round((saves / imp) * 1000) / 10}%`;
        } else if (saves > 0) {
          specificHighlightValue = `${saves} saves`;
        }
      }

      return {
        contentType: ct,
        label: CONTENT_TYPE_LABELS[ct],
        itemsCount: bucket.length,
        impressions: imp,
        reach,
        totalEngagements: eng,
        likesAndReactions: likes,
        comments,
        shares,
        saves,
        followersGained: followers,
        engagementRate: rate,
        specificHighlightLabel,
        specificHighlightValue,
      };
    });

    // Aggregate account totals for active filter
    const filteredIds = new Set(filteredItems.map((i) => i.contentId));
    const creatorEventsCurrent = this.events.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      const inRange = t >= bounds.currentStartMs && t <= bounds.currentEndMs;
      if (!inRange || e.isSelfView) return false;
      const matchesCreator = e.creatorId === creatorId || filteredIds.has(e.contentId);
      if (!matchesCreator) return false;
      if (contentFilter === 'all') return true;
      return e.contentType === contentFilter || filteredIds.has(e.contentId);
    });

    const creatorEventsPrev =
      bounds.previousStartMs !== null && bounds.previousEndMs !== null
        ? this.events.filter((e) => {
            const t = new Date(e.createdAt).getTime();
            const inPrev = t >= bounds.previousStartMs! && t < bounds.previousEndMs!;
            if (!inPrev || e.isSelfView) return false;
            const matchesCreator = e.creatorId === creatorId || filteredIds.has(e.contentId);
            if (!matchesCreator) return false;
            if (contentFilter === 'all') return true;
            return e.contentType === contentFilter || filteredIds.has(e.contentId);
          })
        : [];

    // Deduplicated unique viewers across filtered content
    const accountUniqueViewers = new Set<string>();
    const deviceTotals = { mobile: 0, desktop: 0, tablet: 0 };
    const trafficMap = new Map<TrafficSourceType, number>();

    for (const ev of creatorEventsCurrent) {
      if (ev.kind === 'impression') {
        accountUniqueViewers.add(ev.viewerFingerprint);
        deviceTotals[ev.deviceType] = (deviceTotals[ev.deviceType] || 0) + 1;
        trafficMap.set(ev.trafficSource, (trafficMap.get(ev.trafficSource) || 0) + 1);
      }
    }

    const totalImpressions = filteredItems.reduce((s, i) => s + i.impressions, 0);
    // Account reach is deduplicated unique viewers if telemetry exists, else sum of item unique fallback
    const totalReach =
      accountUniqueViewers.size > 0
        ? Math.max(accountUniqueViewers.size, ...filteredItems.map((i) => i.reach))
        : filteredItems.reduce((s, i) => s + i.reach, 0);

    const likesAndReactions = filteredItems.reduce((s, i) => s + i.likesAndReactions, 0);
    const comments = filteredItems.reduce((s, i) => s + i.comments, 0);
    const shares = filteredItems.reduce((s, i) => s + i.shares, 0);
    const saves = filteredItems.reduce((s, i) => s + i.saves, 0);
    const totalEngagements = likesAndReactions + comments + shares + saves;
    const engagementRate =
      totalImpressions > 0 ? Math.round((totalEngagements / totalImpressions) * 1000) / 10 : null;

    // Followers gained (including direct_profile_follow when contentFilter === 'all')
    const directContentFollows = filteredItems.reduce((s, i) => s + i.followersGained.directContentFollows, 0);
    const assistedProfileFollows = filteredItems.reduce((s, i) => s + i.followersGained.assistedProfileFollows, 0);
    let directProfileFollows = 0;
    if (contentFilter === 'all') {
      const profileFollowPerViewer = new Map<string, number>();
      for (const fe of creatorEventsCurrent) {
        if (fe.kind === 'follow_attribution' && fe.attributionMethod === 'direct_profile_follow') {
          const prev = profileFollowPerViewer.get(fe.viewerFingerprint) || 0;
          profileFollowPerViewer.set(fe.viewerFingerprint, Math.max(0, Math.min(1, prev + (fe.followDelta ?? 1))));
        }
      }
      for (const val of profileFollowPerViewer.values()) {
        directProfileFollows += val;
      }
    }
    const netFollowersGained = directContentFollows + assistedProfileFollows + directProfileFollows;

    // Period Comparison
    const currentImpsCount = creatorEventsCurrent.filter((e) => e.kind === 'impression').length;
    const prevImpsCount = creatorEventsPrev.filter((e) => e.kind === 'impression').length;
    const prevReachSet = new Set(creatorEventsPrev.filter((e) => e.kind === 'impression').map((e) => e.viewerFingerprint));
    const currentActionCount = creatorEventsCurrent.filter((e) => e.kind === 'engagement_action').length;
    const prevActionCount = creatorEventsPrev.filter((e) => e.kind === 'engagement_action').length;
    const prevFollowersNet = Math.max(
      0,
      creatorEventsPrev.filter((e) => e.kind === 'follow_attribution').reduce((s, e) => s + (e.followDelta ?? 1), 0)
    );
    const hasPreviousPeriodData = prevImpsCount > 0 || prevActionCount > 0 || prevFollowersNet > 0;

    // Traffic sources & devices
    const totalAttributedImps = Array.from(trafficMap.values()).reduce((a, b) => a + b, 0);
    const trafficEntries: TrafficSourceEntry[] = (Object.keys(TRAFFIC_SOURCE_LABELS) as TrafficSourceType[])
      .map((src) => {
        const count = trafficMap.get(src) || 0;
        return {
          source: src,
          label: TRAFFIC_SOURCE_LABELS[src],
          count,
          percentage: totalAttributedImps > 0 ? Math.round((count / totalAttributedImps) * 1000) / 10 : 0,
        };
      })
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);

    const totalDeviceCount = deviceTotals.mobile + deviceTotals.desktop + deviceTotals.tablet;
    const deviceBreakdown =
      totalDeviceCount > 0
        ? {
            mobile: Math.round((deviceTotals.mobile / totalDeviceCount) * 100),
            desktop: Math.round((deviceTotals.desktop / totalDeviceCount) * 100),
            tablet: Math.round((deviceTotals.tablet / totalDeviceCount) * 100),
            hasData: true,
          }
        : {
            mobile: 0,
            desktop: 0,
            tablet: 0,
            hasData: false,
          };

    // Video/Reel Rollup when relevant
    let videoRollup: CreatorStudioAnalyticsSummary['videoRollup'] = null;
    if (contentFilter === 'all' || contentFilter === 'reel' || contentFilter === 'video') {
      const vItems = filteredItems.filter((i) => i.contentType === 'reel' || i.contentType === 'video');
      const withComp = vItems.filter((i) => i.videoMetrics?.completionRate !== null);
      videoRollup = {
        totalVideosAndReels: vItems.length,
        totalViews: vItems.reduce((s, i) => s + (i.videoMetrics?.totalViews || 0), 0),
        totalPlayTimeSeconds: Math.round(vItems.reduce((s, i) => s + (i.videoMetrics?.totalPlayTimeSeconds || 0), 0) * 10) / 10,
        averageCompletionRate:
          withComp.length > 0
            ? Math.round((withComp.reduce((s, i) => s + (i.videoMetrics?.completionRate || 0), 0) / withComp.length) * 10) / 10
            : null,
        totalCreatorEarningsCents: vItems.reduce((s, i) => s + (i.videoMetrics?.monetization.creatorEarningsCents || 0), 0),
      };
    }

    // Top-performing content ranked by impressions + totalEngagements * 2
    const topContent = [...filteredItems].sort(
      (a, b) => b.impressions + b.totalEngagements * 2 - (a.impressions + a.totalEngagements * 2)
    );

    const aiInsights = generateAccountAIInsights(contentFilter, formatBreakdown, filteredItems, netFollowersGained);

    return {
      creatorId,
      dateRange,
      contentFilter,
      totalItems: catalog.length,
      filteredItemsCount: filteredItems.length,
      impressions: totalImpressions,
      reach: totalReach,
      likesAndReactions,
      comments,
      shares,
      saves,
      totalEngagements,
      engagementRate,
      followersGained: {
        netGained: netFollowersGained,
        directContentFollows,
        assistedProfileFollows,
        directProfileFollows,
        hasData: netFollowersGained > 0 || creatorEventsCurrent.some((e) => e.kind === 'follow_attribution'),
        attributionRule: FOLLOWER_ATTRIBUTION_RULE,
      },
      periodComparison: {
        hasPreviousPeriodData,
        impressionsDeltaPercent: hasPreviousPeriodData ? computeDeltaPercent(currentImpsCount, prevImpsCount) : null,
        reachDeltaPercent: hasPreviousPeriodData ? computeDeltaPercent(accountUniqueViewers.size, prevReachSet.size) : null,
        engagementsDeltaPercent: hasPreviousPeriodData ? computeDeltaPercent(currentActionCount, prevActionCount) : null,
        followersDeltaPercent: hasPreviousPeriodData ? computeDeltaPercent(netFollowersGained, prevFollowersNet) : null,
        note:
          dateRange === 'all'
            ? 'All-time summary (period delta disabled).'
            : hasPreviousPeriodData
            ? `Comparing timestamped telemetry against prior ${dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : '90 days'}.`
            : 'Insufficient prior-period telemetry to calculate period-over-period % change.',
      },
      trafficSources: {
        entries: trafficEntries,
        totalAttributedImpressions: totalAttributedImps,
        hasData: totalAttributedImps > 0,
      },
      audienceBreakdown: {
        deviceBreakdown,
        uniqueViewers: totalReach,
        hasSufficientData: totalDeviceCount > 0 || totalReach > 0,
      },
      formatBreakdown,
      topContent,
      aiInsights,
      videoRollup,
      trackingStartedAt: this.TRACKING_EPOCH,
      hasSufficientData: totalImpressions > 0 || totalEngagements > 0 || creatorEventsCurrent.length > 0,
      dataIntegrityNotice:
        'Strict Real-Data Standard: Impressions, reach, carousel slide progression, Read More interactions, video retention, and follower attribution are measured exclusively from genuine events.',
    };
  }

  public resetForTesting(): void {
    this.events = [];
    this.dedupIndex.clear();
    try {
      if (this.isIsolatedTest && this.dataFilePath.startsWith(os.tmpdir()) && fs.existsSync(this.dataFilePath)) {
        fs.unlinkSync(this.dataFilePath);
      }
    } catch {}
  }
}

export const contentAnalyticsEngine = new ContentAnalyticsEngine();
