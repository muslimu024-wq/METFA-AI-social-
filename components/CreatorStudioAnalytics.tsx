import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Eye,
  Users,
  Heart,
  TrendingUp,
  UserPlus,
  RefreshCw,
  Sparkles,
  Film,
  Image as ImageIcon,
  Layers,
  FileText,
  Smartphone,
  Monitor,
  Tablet,
  Compass,
  ArrowUpRight,
  Info,
  DollarSign,
} from 'lucide-react';
import type {
  AIInsightItem,
  AnalyticsDateRange,
  ContentAnalyticsType,
  ContentCatalogDescriptor,
  ContentFilterType,
  CreatorStudioAnalyticsSummary,
} from '../services/contentAnalyticsEngine';
import {
  fetchCreatorStudioAnalytics,
  generateContentAIInsights,
} from '../utils/contentTracker';
import { ContentAnalyticsModal } from './ContentAnalyticsModal';

export interface CreatorStudioAnalyticsProps {
  creatorId: string;
  creatorName?: string;
  catalog: ContentCatalogDescriptor[];
}

const FILTER_OPTIONS: Array<{
  id: ContentFilterType;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'all', label: 'All Content', Icon: BarChart3 },
  { id: 'reel', label: 'Reels', Icon: Film },
  { id: 'video', label: 'Video Posts', Icon: Film },
  { id: 'image', label: 'Single Image', Icon: ImageIcon },
  { id: 'carousel', label: 'Carousel', Icon: Layers },
  { id: 'text', label: 'Text Posts', Icon: FileText },
];

const TYPE_LABEL_SHORT: Record<ContentAnalyticsType, string> = {
  reel: 'Reel',
  video: 'Video',
  image: 'Image',
  carousel: 'Carousel',
  text: 'Text',
};

const TYPE_BADGE_STYLE: Record<ContentAnalyticsType, string> = {
  reel: 'bg-purple-50 text-purple-700 border-purple-200',
  video: 'bg-sky-50 text-sky-700 border-sky-200',
  image: 'bg-teal-50 text-teal-700 border-teal-200',
  carousel: 'bg-amber-50 text-amber-700 border-amber-200',
  text: 'bg-slate-100 text-slate-700 border-slate-300',
};

export const CreatorStudioAnalytics: React.FC<CreatorStudioAnalyticsProps> = ({
  creatorId,
  creatorName,
  catalog,
}) => {
  const [contentFilter, setContentFilter] = useState<ContentFilterType>('all');
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>('30d');
  const [studio, setStudio] = useState<CreatorStudioAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<AIInsightItem[]>([]);
  const [aiSource, setAiSource] = useState<'deterministic' | 'gemini'>('deterministic');
  const [aiLoading, setAiLoading] = useState(false);

  const [selectedContent, setSelectedContent] = useState<ContentCatalogDescriptor | null>(null);

  const catalogSignature = useMemo(
    () => catalog.map((c) => `${c.id}:${c.likesCount ?? 0}:${c.commentsCount ?? 0}:${c.sharesCount ?? 0}`).join('|'),
    [catalog]
  );

  const loadStudio = useCallback(async () => {
    if (!creatorId) return;
    setLoading(true);
    try {
      const data = await fetchCreatorStudioAnalytics({
        creatorId,
        catalog,
        contentFilter,
        dateRange,
      });
      if (data) {
        setStudio(data);
        setAiInsights(data.aiInsights || []);
        setAiSource('deterministic');
      }
    } finally {
      setLoading(false);
    }
  }, [creatorId, contentFilter, dateRange, catalogSignature]);

  useEffect(() => {
    loadStudio();
  }, [loadStudio]);

  const handleRefreshAIInsights = async () => {
    if (!studio) return;
    setAiLoading(true);
    try {
      const res = await generateContentAIInsights({
        contentFilter,
        summary: studio,
      });
      if (res && res.insights.length > 0) {
        setAiInsights(res.insights);
        setAiSource(res.source);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const formatDelta = (delta: number | null | undefined, fallbackText: string): string => {
    if (delta === null || delta === undefined) return fallbackText;
    return `${delta > 0 ? '+' : ''}${delta}% vs prior period`;
  };

  const formatPlayTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getPrimaryFormatHighlight = (item: CreatorStudioAnalyticsSummary['topContent'][number]): string => {
    if ((item.contentType === 'reel' || item.contentType === 'video') && item.videoMetrics) {
      return item.videoMetrics.completionRate !== null
        ? `${item.videoMetrics.totalViews} views • ${item.videoMetrics.completionRate}% comp`
        : `${item.videoMetrics.totalViews} qualified views`;
    }
    if (item.contentType === 'carousel' && item.carouselMetrics) {
      return item.carouselMetrics.lastSlideCompletionRate !== null
        ? `${item.carouselMetrics.lastSlideCompletionRate}% last-slide (${item.carouselMetrics.slideCount}p)`
        : `${item.carouselMetrics.totalSlideViews} slide views (${item.carouselMetrics.slideCount}p)`;
    }
    if (item.contentType === 'text' && item.textMetrics) {
      return `${item.textMetrics.expandClicks} expands • ${item.textMetrics.readingEngagementEvents} reads`;
    }
    if (item.contentType === 'image' && item.imageMetrics) {
      return item.imageMetrics.saveRate !== null
        ? `${item.imageMetrics.saveRate}% save rate`
        : `${item.saves} saves • ${item.shares} shares`;
    }
    return '—';
  };

  return (
    <div className="space-y-5">
      {/* Studio Control Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-900" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Creator Studio Analytics
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {creatorName ? `${creatorName} • ` : ''}Unified real-data performance across Reels, Video Posts, Single Images, Carousels &amp; Text Posts
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Date Range Comparison Switcher */}
            <div className="inline-flex bg-slate-100 border border-slate-200 rounded-xl p-0.5">
              {(['7d', '30d', '90d', 'all'] as AnalyticsDateRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    dateRange === range
                      ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {range === 'all' ? 'All Time' : range.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadStudio}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Refresh Studio Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content-Type Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          {FILTER_OPTIONS.map(({ id, label, Icon }) => {
            const isActive = contentFilter === id;
            const count =
              id === 'all'
                ? studio?.totalItems ?? catalog.length
                : studio?.formatBreakdown.find((f) => f.contentType === id)?.itemsCount ?? 0;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setContentFilter(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>Impressions</span>
            <Eye className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {studio?.impressions ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {formatDelta(studio?.periodComparison.impressionsDeltaPercent, studio?.periodComparison.note || 'Excludes creator self-views')}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>Reach / Unique Viewers</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {studio?.reach ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {formatDelta(studio?.periodComparison.reachDeltaPercent, 'Deduplicated viewer fingerprints')}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>Total Engagements</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {studio?.totalEngagements ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {studio?.engagementRate !== null && studio?.engagementRate !== undefined
              ? `${studio.engagementRate}% engagement rate`
              : 'Engagement rate: Insufficient impressions'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>Followers Gained</span>
            <UserPlus className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            +{studio?.followersGained.netGained ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {studio?.followersGained.hasData
              ? `${studio.followersGained.directContentFollows} direct • ${studio.followersGained.assistedProfileFollows} assisted`
              : 'Attributed follows across period'}
          </p>
        </div>
      </div>

      {/* Shared Interaction Breakdown Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Likes &amp; Reactions</span>
          <strong className="text-base font-bold text-slate-900 tabular-nums">
            {studio?.likesAndReactions ?? 0}
          </strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Comments</span>
          <strong className="text-base font-bold text-slate-900 tabular-nums">
            {studio?.comments ?? 0}
          </strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Shares</span>
          <strong className="text-base font-bold text-slate-900 tabular-nums">
            {studio?.shares ?? 0}
          </strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Saves / Bookmarks</span>
          <strong className="text-base font-bold text-slate-900 tabular-nums">
            {studio?.saves ?? 0}
          </strong>
        </div>
      </div>

      {/* Video & Reel Rollup — STRICTLY ONLY displayed when 'all', 'reel', or 'video' filter is active */}
      {studio?.videoRollup && (contentFilter === 'all' || contentFilter === 'reel' || contentFilter === 'video') && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Film className="w-4 h-4 text-purple-600" />
              Video &amp; Reels Playback Rollup
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              {studio.videoRollup.totalVideosAndReels} video items
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs text-slate-500 block">Qualified Video Views</span>
              <strong className="text-base text-slate-900 tabular-nums">
                {studio.videoRollup.totalViews}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs text-slate-500 block">Total Watch Time</span>
              <strong className="text-base text-slate-900 tabular-nums">
                {formatPlayTime(studio.videoRollup.totalPlayTimeSeconds)}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs text-slate-500 block">Avg Completion Rate</span>
              <strong className="text-base text-slate-900 tabular-nums">
                {studio.videoRollup.averageCompletionRate !== null
                  ? `${studio.videoRollup.averageCompletionRate}%`
                  : 'Insufficient data'}
              </strong>
            </div>
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
              <span className="text-xs text-emerald-800 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                Verified Earnings
              </span>
              <strong className="text-base text-emerald-700 tabular-nums">
                ${(studio.videoRollup.totalCreatorEarningsCents / 100).toFixed(2)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 5-Format Comparison Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Content Format Comparison (All 5 Types)
          </h3>
          <span className="text-[11px] text-slate-500">Click any format to filter</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/60">
                <th className="py-2.5 px-4 font-semibold">Format</th>
                <th className="py-2.5 px-3 font-semibold text-right">Posts</th>
                <th className="py-2.5 px-3 font-semibold text-right">Impressions</th>
                <th className="py-2.5 px-3 font-semibold text-right">Reach</th>
                <th className="py-2.5 px-3 font-semibold text-right">Engagements</th>
                <th className="py-2.5 px-3 font-semibold text-right">Eng. Rate</th>
                <th className="py-2.5 px-3 font-semibold text-right">Followers</th>
                <th className="py-2.5 px-4 font-semibold text-right">Format-Specific Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(studio?.formatBreakdown || []).map((row) => (
                <tr
                  key={row.contentType}
                  onClick={() => setContentFilter(row.contentType)}
                  className={`cursor-pointer transition ${
                    contentFilter === row.contentType ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-semibold ${
                        TYPE_BADGE_STYLE[row.contentType]
                      }`}
                    >
                      {row.label}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-800 tabular-nums">
                    {row.itemsCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-800 tabular-nums">
                    {row.impressions}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">
                    {row.reach}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                    {row.totalEngagements}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700 tabular-nums">
                    {row.engagementRate !== null ? `${row.engagementRate}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold tabular-nums">
                    +{row.followersGained}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-600 tabular-nums">
                    <span className="text-[11px] text-slate-400 mr-1">{row.specificHighlightLabel}:</span>
                    <span className="font-medium text-slate-800">{row.specificHighlightValue}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Traffic Sources + Audience Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-teal-600" />
              Traffic Sources
            </h3>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {studio?.trafficSources.totalAttributedImpressions ?? 0} attributed views
            </span>
          </div>

          {studio?.trafficSources.hasData ? (
            <div className="space-y-2.5">
              {studio.trafficSources.entries.map((entry) => (
                <div key={entry.source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{entry.label}</span>
                    <span className="text-slate-600 tabular-nums">
                      {entry.count} ({entry.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full"
                      style={{ width: `${entry.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
              Insufficient data: Traffic source attribution records as viewers discover your posts from Feed, Reels, Profile, Pages, Groups, or Search.
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Audience Breakdown &amp; Follower Attribution
            </h3>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {studio?.audienceBreakdown.uniqueViewers ?? 0} unique viewers
            </span>
          </div>

          {studio?.audienceBreakdown.deviceBreakdown.hasData ? (
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <Smartphone className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                <span className="text-xs text-slate-500 block">Mobile</span>
                <strong className="text-sm text-slate-900 tabular-nums">
                  {studio.audienceBreakdown.deviceBreakdown.mobile}%
                </strong>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <Monitor className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                <span className="text-xs text-slate-500 block">Desktop</span>
                <strong className="text-sm text-slate-900 tabular-nums">
                  {studio.audienceBreakdown.deviceBreakdown.desktop}%
                </strong>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <Tablet className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                <span className="text-xs text-slate-500 block">Tablet</span>
                <strong className="text-sm text-slate-900 tabular-nums">
                  {studio.audienceBreakdown.deviceBreakdown.tablet}%
                </strong>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
              Insufficient data: Audience device mix populates after verified external impressions.
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-relaxed">
            <strong className="text-slate-800">Attribution Rule:</strong>{' '}
            {studio?.followersGained.attributionRule}
          </div>
        </div>
      </div>

      {/* Top Performing Content Ranking Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            Top-Performing Content ({studio?.filteredItemsCount ?? 0} items)
          </h3>
          <span className="text-[11px] text-slate-500">Select an item for deep drilldown</span>
        </div>

        {studio && studio.topContent.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {studio.topContent.map((item, idx) => {
              const catalogMatch = catalog.find((c) => c.id === item.contentId) || {
                id: item.contentId,
                contentType: item.contentType,
                creatorId: item.creatorId,
                title: item.title,
                thumbnailUrl: item.thumbnailUrl,
                likesCount: item.likesAndReactions,
                commentsCount: item.comments,
                sharesCount: item.shares,
                savesCount: item.saves,
              };

              return (
                <div
                  key={item.contentId}
                  onClick={() => setSelectedContent(catalogMatch)}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-400 w-5 tabular-nums">
                      #{idx + 1}
                    </span>
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-900"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${
                            TYPE_BADGE_STYLE[item.contentType]
                          }`}
                        >
                          {TYPE_LABEL_SHORT[item.contentType]}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900 truncate">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        {item.createdAtLabel} • {getPrimaryFormatHighlight(item)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div className="hidden sm:block">
                      <span className="text-[10px] text-slate-400 block">Impressions</span>
                      <strong className="text-xs text-slate-900 tabular-nums">
                        {item.impressions}
                      </strong>
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-[10px] text-slate-400 block">Reach</span>
                      <strong className="text-xs text-slate-900 tabular-nums">
                        {item.reach}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Engagements</span>
                      <strong className="text-xs text-slate-900 tabular-nums">
                        {item.totalEngagements}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContent(catalogMatch);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-900 hover:text-white text-xs font-semibold text-slate-700 transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            No content published in this format yet. Publish posts or Reels to begin tracking unified analytics.
          </div>
        )}
      </div>

      {/* Content-Scoped AI Performance Insights */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              AI Performance Insights ({contentFilter === 'all' ? 'All Formats' : FILTER_OPTIONS.find((f) => f.id === contentFilter)?.label})
            </h3>
          </div>
          <button
            type="button"
            onClick={handleRefreshAIInsights}
            disabled={aiLoading || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
            <span>{aiLoading ? 'Generating...' : 'Refresh AI Insights'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {aiInsights.map((ins) => (
            <div key={ins.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-purple-700">
                  {ins.category}
                </span>
                <span className="text-[10px] font-mono text-slate-500">{ins.basedOnMetric}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">{ins.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{ins.detail}</p>
              {ins.actionableStep && (
                <p className="text-xs font-medium text-teal-800 pt-0.5">
                  Action: {ins.actionableStep}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            {studio?.dataIntegrityNotice}
          </span>
          <span>Mode: {aiSource === 'gemini' ? 'Gemini AI' : 'Deterministic Engine'}</span>
        </div>
      </div>

      {/* Individual Content Drilldown Modal */}
      {selectedContent && (
        <ContentAnalyticsModal
          isOpen={Boolean(selectedContent)}
          onClose={() => setSelectedContent(null)}
          content={selectedContent}
        />
      )}
    </div>
  );
};

export default CreatorStudioAnalytics;
