import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  TrendingUp,
  Clock,
  Eye,
  CheckCircle2,
  DollarSign,
  Smartphone,
  Monitor,
  Tablet,
  ShieldCheck,
  RefreshCw,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Info,
  Sparkles,
  Users,
  Film,
  Image as ImageIcon,
  Layers,
  FileText,
  ArrowUpRight,
  Compass,
} from 'lucide-react';
import type {
  AnalyticsDateRange,
  ContentAnalyticsType,
  ContentCatalogDescriptor,
  UnifiedContentAnalytics,
  AIInsightItem,
} from '../services/contentAnalyticsEngine';
import {
  clientResolveContentType,
  fetchUnifiedContentAnalytics,
  generateContentAIInsights,
} from '../utils/contentTracker';

export interface ContentAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content?: ContentCatalogDescriptor;
  // Backward-compatible legacy VideoAnalyticsModal props
  videoId?: string;
  videoTitle?: string;
  videoThumbnail?: string;
  videoType?: 'reel' | 'post_video' | 'premium_content';
  creatorId?: string;
  initialLikes?: number;
  initialComments?: number;
  initialShares?: number;
  initialSaves?: number;
}

const CONTENT_BADGE_MAP: Record<
  ContentAnalyticsType,
  { label: string; badgeClass: string; Icon: React.FC<{ className?: string }> }
> = {
  reel: {
    label: 'Reel',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    Icon: Film,
  },
  video: {
    label: 'Video Post',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    Icon: Film,
  },
  image: {
    label: 'Single Image',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    Icon: ImageIcon,
  },
  carousel: {
    label: 'Carousel',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Layers,
  },
  text: {
    label: 'Text Post',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    Icon: FileText,
  },
};

export const ContentAnalyticsModal: React.FC<ContentAnalyticsModalProps> = ({
  isOpen,
  onClose,
  content,
  videoId,
  videoTitle,
  videoThumbnail,
  videoType = 'reel',
  creatorId,
  initialLikes = 0,
  initialComments = 0,
  initialShares = 0,
  initialSaves = 0,
}) => {
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>('30d');
  const [analytics, setAnalytics] = useState<UnifiedContentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<AIInsightItem[]>([]);
  const [aiSource, setAiSource] = useState<'deterministic' | 'gemini'>('deterministic');
  const [aiLoading, setAiLoading] = useState(false);

  const resolvedDescriptor: ContentCatalogDescriptor | null = content
    ? content
    : videoId
    ? {
        id: videoId,
        contentType: videoType === 'reel' ? 'reel' : 'video',
        postType: videoType === 'reel' ? 'reel' : 'media',
        videoSrc: 'attached',
        title: videoTitle || 'Video Content',
        thumbnailUrl: videoThumbnail,
        creatorId: creatorId || '',
        likesCount: initialLikes,
        commentsCount: initialComments,
        sharesCount: initialShares,
        savesCount: initialSaves,
        isPremium: videoType === 'premium_content',
      }
    : null;

  const loadAnalytics = useCallback(async () => {
    if (!resolvedDescriptor) return;
    setLoading(true);
    try {
      const data = await fetchUnifiedContentAnalytics(resolvedDescriptor, dateRange);
      if (data) {
        setAnalytics(data);
        setAiInsights(data.aiInsights || []);
        setAiSource('deterministic');
      }
    } finally {
      setLoading(false);
    }
  }, [resolvedDescriptor?.id, dateRange]);

  useEffect(() => {
    if (isOpen && resolvedDescriptor?.id) {
      loadAnalytics();
    }
  }, [isOpen, resolvedDescriptor?.id, dateRange]);

  const handleRefreshAIInsights = async () => {
    if (!analytics) return;
    setAiLoading(true);
    try {
      const res = await generateContentAIInsights({
        contentFilter: analytics.contentType,
        summary: analytics,
        contentId: analytics.contentId,
      });
      if (res && res.insights.length > 0) {
        setAiInsights(res.insights);
        setAiSource(res.source);
      }
    } finally {
      setAiLoading(false);
    }
  };

  if (!isOpen || !resolvedDescriptor) return null;

  const contentType: ContentAnalyticsType =
    analytics?.contentType || clientResolveContentType(resolvedDescriptor);
  const typeMeta = CONTENT_BADGE_MAP[contentType];
  const TypeIcon = typeMeta.Icon;

  const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return 'Insufficient data';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatCurrency = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

  const formatDelta = (delta: number | null | undefined): string | null => {
    if (delta === null || delta === undefined) return null;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta}%`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-slate-900 text-white shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">Content Analytics</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${typeMeta.badgeClass}`}
                >
                  <TypeIcon className="w-3 h-3" />
                  {typeMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                Verified real-data telemetry • Excludes creator self-views
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Date Range Tabs */}
            <div className="inline-flex bg-white border border-slate-200 rounded-lg p-0.5">
              {(['7d', '30d', '90d', 'all'] as AnalyticsDateRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                    dateRange === range
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {range === 'all' ? 'All' : range.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadAnalytics}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Item Preview Bar */}
          <div className="flex items-center gap-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
            {resolvedDescriptor.thumbnailUrl || resolvedDescriptor.imageSrc || resolvedDescriptor.imageGallery?.[0] ? (
              <img
                src={
                  resolvedDescriptor.thumbnailUrl ||
                  resolvedDescriptor.imageSrc ||
                  resolvedDescriptor.imageGallery?.[0]
                }
                alt="Content preview"
                className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-900"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <TypeIcon className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 truncate">
                {analytics?.title || resolvedDescriptor.title || 'METFA Content'}
              </h4>
              <p className="text-xs text-slate-500 font-mono truncate">
                ID: {resolvedDescriptor.id.slice(0, 18)} • Published {analytics?.createdAtLabel || resolvedDescriptor.createdAtLabel || 'Recently'}
              </p>
            </div>
          </div>

          {/* Shared Primary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Impressions</span>
                <Eye className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {analytics?.impressions ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {formatDelta(analytics?.periodComparison.impressionsDeltaPercent) ?? 'Deduplicated views'}
              </p>
            </div>

            <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Reach</span>
                <Users className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {analytics?.reach ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Unique viewers</p>
            </div>

            <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Engagement Rate</span>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                {analytics?.engagementRate !== null && analytics?.engagementRate !== undefined
                  ? `${analytics.engagementRate}%`
                  : 'Insufficient data'}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {analytics?.totalEngagements ?? 0} total interactions
              </p>
            </div>

            <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Followers Gained</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">
                +{analytics?.followersGained.netGained ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {analytics?.followersGained.hasData
                  ? `${analytics.followersGained.directContentFollows} direct • ${analytics.followersGained.assistedProfileFollows} assisted`
                  : 'No attributed follows yet'}
              </p>
            </div>
          </div>

          {/* Shared Engagement Action Breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Likes &amp; Reactions, Comments, Shares &amp; Saves
            </h4>
            <div className="grid grid-cols-4 gap-2.5 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <Heart className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                <span className="text-[11px] text-slate-500 block">Reactions</span>
                <strong className="text-sm text-slate-900 tabular-nums">
                  {analytics?.likesAndReactions ?? initialLikes}
                </strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <MessageCircle className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                <span className="text-[11px] text-slate-500 block">Comments</span>
                <strong className="text-sm text-slate-900 tabular-nums">
                  {analytics?.comments ?? initialComments}
                </strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <Share2 className="w-4 h-4 text-teal-600 mx-auto mb-1" />
                <span className="text-[11px] text-slate-500 block">Shares</span>
                <strong className="text-sm text-slate-900 tabular-nums">
                  {analytics?.shares ?? initialShares}
                </strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <Bookmark className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                <span className="text-[11px] text-slate-500 block">Saves</span>
                <strong className="text-sm text-slate-900 tabular-nums">
                  {analytics?.saves ?? initialSaves}
                </strong>
              </div>
            </div>
          </div>

          {/* CONTENT-TYPE SPECIFIC METRICS — STRICTLY NO CROSS-TYPE LEAKAGE */}
          {(contentType === 'reel' || contentType === 'video') && analytics?.videoMetrics && (
            <div className="space-y-4">
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {contentType === 'reel' ? 'Reel' : 'Video Post'} Playback &amp; Watch Time
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block">Total Views</span>
                    <strong className="text-base text-slate-900 tabular-nums">
                      {analytics.videoMetrics.totalViews}
                    </strong>
                    <span className="block text-[10px] text-slate-400">≥3s qualified sessions</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block">Total Play Time</span>
                    <strong className="text-base text-slate-900 tabular-nums">
                      {formatDuration(analytics.videoMetrics.totalPlayTimeSeconds)}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block">Avg Watch Time</span>
                    <strong className="text-base text-slate-900 tabular-nums">
                      {formatDuration(analytics.videoMetrics.averageWatchTimeSeconds)}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 block">Completion Rate</span>
                    <strong className="text-base text-slate-900 tabular-nums">
                      {analytics.videoMetrics.completionRate !== null
                        ? `${analytics.videoMetrics.completionRate}%`
                        : 'Insufficient data'}
                    </strong>
                    <span className="block text-[10px] text-slate-400 tabular-nums">
                      {analytics.videoMetrics.completionCount} full plays
                    </span>
                  </div>
                </div>

                {/* Audience Retention & Drop-off Timeline */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-800">
                      Audience Retention &amp; Drop-Off Timeline (10% Checkpoints)
                    </span>
                    {analytics.videoMetrics.retentionTimeline.highestDropOffBucketLabel && (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Steepest drop: {analytics.videoMetrics.retentionTimeline.highestDropOffBucketLabel}
                      </span>
                    )}
                  </div>
                  {analytics.videoMetrics.retentionTimeline.hasData ? (
                    <div className="grid grid-cols-10 gap-1.5 items-end h-28 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      {analytics.videoMetrics.retentionTimeline.buckets.map((b) => (
                        <div key={b.bucketIndex} className="flex flex-col items-center h-full justify-end gap-1">
                          <span className="text-[9px] text-slate-500 tabular-nums">
                            {b.retentionPercent}%
                          </span>
                          <div className="w-full bg-slate-200 rounded-t h-16 flex items-end overflow-hidden">
                            <div
                              className="w-full bg-purple-600 rounded-t transition-all"
                              style={{ height: `${Math.max(4, b.retentionPercent)}%` }}
                              title={`${b.rangeLabel}: ${b.viewers} viewers (${b.retentionPercent}%)`}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500 tabular-nums truncate w-full text-center">
                            {b.rangeLabel.split('–')[0]}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
                      Insufficient data: Retention curve populates automatically once viewers play through video checkpoints.
                    </div>
                  )}
                </div>
              </div>

              {/* Verified Ledger Earnings */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-700" />
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      Verified Ledger Earnings
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    {analytics.videoMetrics.monetization.isMonetized ? 'Premium Content' : 'Standard Free'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                    <span className="text-xs text-slate-500 block">Gross Revenue</span>
                    <strong className="text-sm text-slate-900 tabular-nums">
                      {formatCurrency(analytics.videoMetrics.monetization.grossRevenueCents)}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                    <span className="text-xs text-slate-500 block">Creator Share (80%)</span>
                    <strong className="text-sm text-emerald-700 tabular-nums">
                      {formatCurrency(analytics.videoMetrics.monetization.creatorEarningsCents)}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                    <span className="text-xs text-slate-500 block">Verified Purchases</span>
                    <strong className="text-sm text-slate-900 tabular-nums">
                      {analytics.videoMetrics.monetization.verifiedTransactionsCount}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {contentType === 'image' && analytics?.imageMetrics && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Single-Image Performance Metrics
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Image Impressions</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.imageMetrics.impressions}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Image Reach</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.imageMetrics.reach}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Image Engagements</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.imageMetrics.imageEngagement}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Save Rate</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.imageMetrics.saveRate !== null
                      ? `${analytics.imageMetrics.saveRate}%`
                      : 'Insufficient data'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {contentType === 'carousel' && analytics?.carouselMetrics && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Carousel Slide Progression &amp; Drop-Off Analysis ({analytics.carouselMetrics.slideCount} Slides)
                </h4>
                {analytics.carouselMetrics.highestDropOffSlideLabel && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Largest drop: {analytics.carouselMetrics.highestDropOffSlideLabel}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Total Slide Views</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.carouselMetrics.totalSlideViews}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Last-Slide Completion</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.carouselMetrics.lastSlideCompletionRate !== null
                      ? `${analytics.carouselMetrics.lastSlideCompletionRate}%`
                      : 'Insufficient data'}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Carousel Reach</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.carouselMetrics.reach}
                  </strong>
                </div>
              </div>

              {analytics.carouselMetrics.hasSlideProgressionData ? (
                <div className="space-y-2 pt-1">
                  {analytics.carouselMetrics.slideProgression.map((slide) => (
                    <div key={slide.slideIndex} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">{slide.label}</span>
                        <span className="text-slate-600 tabular-nums">
                          {slide.uniqueViewers} unique viewers ({slide.retentionFromSlide1Percent ?? 0}%)
                          {slide.dropOffFromPreviousPercent !== null && slide.dropOffFromPreviousPercent > 0
                            ? ` • −${slide.dropOffFromPreviousPercent}% drop`
                            : ''}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.max(2, slide.retentionFromSlide1Percent ?? 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  Insufficient data: Slide-level drop-off and last-slide completion appear once readers swipe across carousel slides.
                </div>
              )}
            </div>
          )}

          {contentType === 'text' && analytics?.textMetrics && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Text Reading &amp; Expansion Telemetry
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Read More Clicks</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.textMetrics.isExpandable ? analytics.textMetrics.expandClicks : 'N/A'}
                  </strong>
                  <span className="block text-[10px] text-slate-400">
                    {analytics.textMetrics.isExpandable
                      ? analytics.textMetrics.expandRate !== null
                        ? `${analytics.textMetrics.expandRate}% expand rate`
                        : 'Awaiting impressions'
                      : 'Post shown uncollapsed'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Reading Engagements</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.textMetrics.readingEngagementEvents}
                  </strong>
                  <span className="block text-[10px] text-slate-400">≥3s focused dwell</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Deep Read Rate</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.textMetrics.readingEngagementRate !== null
                      ? `${analytics.textMetrics.readingEngagementRate}%`
                      : 'Insufficient data'}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 block">Character Length</span>
                  <strong className="text-base text-slate-900 tabular-nums">
                    {analytics.textMetrics.characterCount}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Traffic Sources & Audience Device Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-teal-600" />
                  Traffic Sources
                </h4>
              </div>
              {analytics?.trafficSources.hasData ? (
                <div className="space-y-2">
                  {analytics.trafficSources.entries.map((entry) => (
                    <div key={entry.source} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium">{entry.label}</span>
                        <span className="text-slate-600 tabular-nums">
                          {entry.count} ({entry.percentage}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600 rounded-full"
                          style={{ width: `${entry.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  Insufficient data: No attributed impressions yet.
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Audience Breakdown
                </h4>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {analytics?.audienceBreakdown.uniqueViewers ?? 0} unique viewers
                </span>
              </div>
              {analytics?.audienceBreakdown.deviceBreakdown.hasData ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <Smartphone className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                    <span className="text-[11px] text-slate-500 block">Mobile</span>
                    <strong className="text-sm text-slate-900 tabular-nums">
                      {analytics.audienceBreakdown.deviceBreakdown.mobile}%
                    </strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <Monitor className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                    <span className="text-[11px] text-slate-500 block">Desktop</span>
                    <strong className="text-sm text-slate-900 tabular-nums">
                      {analytics.audienceBreakdown.deviceBreakdown.desktop}%
                    </strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <Tablet className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                    <span className="text-[11px] text-slate-500 block">Tablet</span>
                    <strong className="text-sm text-slate-900 tabular-nums">
                      {analytics.audienceBreakdown.deviceBreakdown.tablet}%
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  Insufficient data: Requires at least 1 recorded external impression or playback session.
                </div>
              )}
              <p className="text-[11px] text-slate-500 leading-snug pt-1">
                <strong>Follower Rule:</strong> {analytics?.followersGained.attributionRule}
              </p>
            </div>
          </div>

          {/* Content-Type-Scoped AI Insights */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  AI Performance Insights ({typeMeta.label} Scope)
                </h4>
              </div>
              <button
                type="button"
                onClick={handleRefreshAIInsights}
                disabled={aiLoading || loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>{aiLoading ? 'Analyzing...' : 'Generate AI Insights'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {aiInsights.map((ins) => (
                <div key={ins.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-purple-700">
                      {ins.category}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">{ins.basedOnMetric}</span>
                  </div>
                  <h5 className="text-sm font-bold text-slate-900">{ins.title}</h5>
                  <p className="text-xs text-slate-600">{ins.detail}</p>
                  {ins.actionableStep && (
                    <p className="text-xs text-teal-800 font-medium pt-0.5">
                      Next step: {ins.actionableStep}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Engine mode: {aiSource === 'gemini' ? 'Gemini Telemetry Synthesis' : 'Verified Deterministic Analysis'}
            </p>
          </div>

          {/* Data Integrity Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>{analytics?.dataIntegrityNotice}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>METFA Creator Studio Telemetry</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentAnalyticsModal;
