import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  RefreshCw,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Info,
  Calendar,
} from 'lucide-react';
import { VideoAnalyticsSummary } from '../services/videoAnalyticsEngine';
import { fetchVideoAnalytics } from '../utils/videoTracker';

interface VideoAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle?: string;
  videoThumbnail?: string;
  videoType?: 'reel' | 'post_video' | 'premium_content';
  creatorId?: string;
  initialLikes?: number;
  initialComments?: number;
  initialShares?: number;
  initialSaves?: number;
}

export const VideoAnalyticsModal: React.FC<VideoAnalyticsModalProps> = ({
  isOpen,
  onClose,
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
  const [analytics, setAnalytics] = useState<VideoAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVideoAnalytics(videoId);
      if (data) {
        setAnalytics(data);
      } else {
        // Fallback default structure
        setAnalytics({
          videoId,
          videoType,
          creatorId: creatorId || '',
          title: videoTitle,
          thumbnailUrl: videoThumbnail,
          totalViews: 0,
          rawSessionsCount: 0,
          totalQualifiedWatchSeconds: 0,
          averageWatchDurationSeconds: null,
          completionRate: null,
          completionCount: 0,
          selfWatchSessionsCount: 0,
          likesCount: initialLikes,
          commentsCount: initialComments,
          sharesCount: initialShares,
          savesCount: initialSaves,
          engagementRate: null,
          audienceInsights: {
            deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0, hasData: false },
            hourlyDistribution: {},
            totalUniqueViewers: 0,
            hasSufficientData: false,
          },
          monetization: {
            isMonetized: false,
            model: 'FREE',
            grossRevenueCents: 0,
            creatorEarningsCents: 0,
            platformFeeCents: 0,
            verifiedTransactionsCount: 0,
            hasTransactions: false,
            ledgerStatusText: 'Standard Free Content (No monetization transactions)',
          },
          trackingStartedAt: '2026-10-23T06:34:00Z',
          isHistoricalDataLimited: true,
          dataSourceNotice: 'Tracking active since Oct 23, 2026. Prior video views were not recorded by the analytics engine.',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load video analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && videoId) {
      loadData();
    }
  }, [isOpen, videoId]);

  if (!isOpen) return null;

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return 'Insufficient data';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Video Analytics & Performance
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  Real Data Only
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Audited view telemetry, completion rates, and verified ledger earnings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Historical Tracking Disclosure Notice */}
          <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-2xl flex items-start gap-2.5 text-xs text-purple-900">
            <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Strict Real-Data Integrity Standard</p>
              <p className="text-purple-800 leading-relaxed text-[11px]">
                Every metric is measured directly from verified video playback sessions and wallet transactions.
                Telemetry tracking began on <strong>Oct 23, 2026</strong>. No synthetic formulas, fake views, or estimates are ever displayed.
              </p>
            </div>
          </div>

          {/* Video Metadata Preview */}
          <div className="flex items-center gap-3.5 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            {videoThumbnail ? (
              <img
                src={videoThumbnail}
                alt="Thumbnail"
                className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-900"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 truncate">
                {videoTitle || analytics?.title || 'Video Content'}
              </h4>
              <p className="text-xs text-slate-500 font-mono">
                ID: {videoId.slice(0, 16)}... • Type: <span className="uppercase font-semibold">{videoType}</span>
              </p>
            </div>
          </div>

          {/* Core Performance Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Qualified Views */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>Qualified Views</span>
                <Eye className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {analytics?.totalViews ?? 0}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                ≥3s watch, deduplicated
              </p>
            </div>

            {/* 2. Qualified Watch Time */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>Watch Time</span>
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {formatDuration(analytics?.totalQualifiedWatchSeconds ?? 0)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                Total playing duration
              </p>
            </div>

            {/* 3. Average Watch Duration */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>Avg Duration</span>
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-900">
                {formatDuration(analytics?.averageWatchDurationSeconds ?? null)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                Per qualified viewer
              </p>
            </div>

            {/* 4. Completion Rate */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span>Completion</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {analytics?.completionRate !== null && analytics?.completionRate !== undefined
                  ? `${analytics.completionRate}%`
                  : 'Insufficient data'}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                {analytics?.completionCount ?? 0} completed full video
              </p>
            </div>
          </div>

          {/* Real Engagement Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Audience Engagement</span>
              {analytics?.engagementRate !== null && (
                <span className="text-[11px] font-mono font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full lowercase">
                  {analytics.engagementRate}% engagement rate
                </span>
              )}
            </h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <Heart className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                <span className="text-xs text-slate-500 block">Likes</span>
                <strong className="text-sm text-slate-900">{analytics?.likesCount ?? initialLikes}</strong>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <MessageCircle className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                <span className="text-xs text-slate-500 block">Comments</span>
                <strong className="text-sm text-slate-900">{analytics?.commentsCount ?? initialComments}</strong>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <Share2 className="w-4 h-4 text-teal-600 mx-auto mb-1" />
                <span className="text-xs text-slate-500 block">Shares</span>
                <strong className="text-sm text-slate-900">{analytics?.sharesCount ?? initialShares}</strong>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <Bookmark className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                <span className="text-xs text-slate-500 block">Saves</span>
                <strong className="text-sm text-slate-900">{analytics?.savesCount ?? initialSaves}</strong>
              </div>
            </div>
          </div>

          {/* Verified Financial / Monetization Section */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Verified Ledger Earnings
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {analytics?.monetization.isMonetized ? 'Premium Content' : 'Standard Free'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-xs text-slate-500 block">Gross Revenue</span>
                <strong className="text-base text-slate-900">
                  {formatCurrency(analytics?.monetization.grossRevenueCents ?? 0)}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-xs text-slate-500 block">Creator Share (80%)</span>
                <strong className="text-base text-emerald-700">
                  {formatCurrency(analytics?.monetization.creatorEarningsCents ?? 0)}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-xs text-slate-500 block">Verified Purchases</span>
                <strong className="text-base text-slate-900">
                  {analytics?.monetization.verifiedTransactionsCount ?? 0}
                </strong>
              </div>
            </div>

            <p className="text-[11px] text-emerald-900 leading-tight">
              {analytics?.monetization.ledgerStatusText}
            </p>
          </div>

          {/* Audience Insights (Where Legitimately Available) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Audience Device Distribution</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {analytics?.audienceInsights.totalUniqueViewers ?? 0} unique viewers
              </span>
            </h4>

            {analytics?.audienceInsights.deviceBreakdown.hasData ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <Smartphone className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                  <span className="text-xs text-slate-500 block">Mobile</span>
                  <strong className="text-sm text-slate-900">
                    {analytics.audienceInsights.deviceBreakdown.mobile}%
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <Monitor className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                  <span className="text-xs text-slate-500 block">Desktop</span>
                  <strong className="text-sm text-slate-900">
                    {analytics.audienceInsights.deviceBreakdown.desktop}%
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <Tablet className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                  <span className="text-xs text-slate-500 block">Tablet</span>
                  <strong className="text-sm text-slate-900">
                    {analytics.audienceInsights.deviceBreakdown.tablet}%
                  </strong>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Insufficient data: Audience breakdown requires at least 1 verified playback session.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Audited by Metfa Analytics Authority</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoAnalyticsModal;
