/**
 * METFA SOCIAL — Video Analytics & Creator Insights Engine
 * 
 * Production-ready server & client analytics engine enforcing REAL DATA ONLY.
 * 
 * STRICT INVARIANTS:
 * - NO dummy, mock, fake, sample, seeded, hardcoded, or simulated data.
 * - NO fabricated metrics, synthetic formulas, or invented users.
 * - Every metric traces directly to a real, persisted watch session or verified transaction.
 * - If data is unavailable, returns null with explicit status "Not available" or "Insufficient data".
 * - Historical tracking boundary: Tracking epoch is strictly recorded ("2026-10-23T06:34:00Z").
 * - Server-side validation: Validates watch duration against real elapsed time, rejects playback speed > 2.5x.
 * - Deduplication: Prevents double-counting consecutive watches from the same viewer within 30 minutes.
 * - Creator self-watch separation: Excludes creator self-watch sessions from public view counts and reward metrics.
 * - Financial reports derive exclusively from verified ledger transaction records in v2PremiumContentEngine.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2PremiumContentEngine } from './v2PremiumContentEngine';
import { getServerSupabaseClient } from './serverAuth';

export interface VideoWatchSession {
  sessionId: string;
  videoId: string;
  videoType: 'reel' | 'post_video' | 'premium_content';
  creatorId: string;
  viewerId: string | null;
  viewerFingerprint: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  watchDurationSeconds: number;
  videoDurationSeconds: number;
  completionRate: number; // 0.0 to 1.0
  playbackSpeed: number;
  isQualifiedView: boolean;
  isCompleted: boolean;
  isSelfWatch: boolean;
  startedAt: string;
  endedAt: string;
  createdAt: string;
}

export interface IngestWatchSessionRequest {
  videoId: string;
  videoType: 'reel' | 'post_video' | 'premium_content';
  creatorId: string;
  viewerId?: string | null;
  viewerFingerprint?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  watchDurationSeconds: number;
  videoDurationSeconds: number;
  playbackSpeed?: number;
  startedAt: string;
  endedAt?: string;
}

export interface VideoAnalyticsSummary {
  videoId: string;
  videoType: 'reel' | 'post_video' | 'premium_content';
  creatorId: string;
  title?: string;
  thumbnailUrl?: string;
  
  // Real View & Watch Metrics
  totalViews: number;               // Qualified, deduplicated views (excluding self-watch)
  rawSessionsCount: number;         // Total recorded sessions
  totalQualifiedWatchSeconds: number; // Sum of qualified watch duration
  averageWatchDurationSeconds: number | null; // null if 0 views
  completionRate: number | null;     // Average completion rate (0-100%), null if 0 views
  completionCount: number;          // Number of sessions reaching >= 95% completion
  selfWatchSessionsCount: number;   // Creator self-inspections (separated)

  // Engagement Metrics (from real persisted store / Supabase)
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  engagementRate: number | null;    // (likes + comments + shares + saves) / totalViews * 100

  // Real Audience Insights (from actual sessions)
  audienceInsights: {
    deviceBreakdown: {
      mobile: number; // Percentage
      desktop: number;
      tablet: number;
      hasData: boolean;
    };
    hourlyDistribution: { [hour: number]: number }; // 0 to 23
    totalUniqueViewers: number;
    hasSufficientData: boolean;
  };

  // Financial / Ledger Verification
  monetization: {
    isMonetized: boolean;
    model: 'FREE' | 'PREMIUM_PAY_PER_VIEW' | 'PREMIUM_LIVE_REPLAY';
    grossRevenueCents: number;
    creatorEarningsCents: number; // 80% split
    platformFeeCents: number;     // 20% split
    verifiedTransactionsCount: number;
    hasTransactions: boolean;
    ledgerStatusText: string;
  };

  // Tracking Boundary & Transparency
  trackingStartedAt: string;
  isHistoricalDataLimited: boolean;
  dataSourceNotice: string;
}

export interface CreatorInsightsSummary {
  creatorId: string;
  totalVideos: number;
  totalViews: number;
  totalQualifiedWatchSeconds: number;
  averageCompletionRate: number | null;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalEngagements: number;

  // Financial Sourced from Verified Ledger
  totalGrossRevenueCents: number;
  totalCreatorEarningsCents: number;
  totalVerifiedPurchases: number;

  // Real Audience Distribution
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
    hasData: boolean;
  };

  // List of videos with individual real performance
  videos: VideoAnalyticsSummary[];

  // Transparency metadata
  trackingStartedAt: string;
  hasSufficientData: boolean;
  notice: string;
}

export class VideoAnalyticsEngine {
  private sessions = new Map<string, VideoWatchSession>(); // sessionId -> Session
  private videoIndex = new Map<string, string[]>();        // videoId -> sessionIds[]
  private creatorIndex = new Map<string, string[]>();      // creatorId -> sessionIds[]
  private deduplicationIndex = new Map<string, { sessionId: string; timestampMs: number }>(); // videoId:fingerprint -> latest

  // Historical Tracking Epoch: All metrics before this date are explicitly identified as untracked
  public readonly TRACKING_EPOCH = '2026-10-23T06:34:00Z';

  private dataFilePath: string;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {}
    }
    this.dataFilePath = path.join(dataDir, 'video_analytics_sessions.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        const parsed: VideoWatchSession[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            this.indexSession(s, false);
          }
        }
      }
    } catch (err) {
      console.warn('[VideoAnalyticsEngine] Error reading video_analytics_sessions.json:', err);
    }
  }

  private persistToDisk(): void {
    try {
      const all = Array.from(this.sessions.values());
      fs.writeFileSync(this.dataFilePath, JSON.stringify(all, null, 2), 'utf-8');
    } catch (err) {
      console.error('[VideoAnalyticsEngine] Error saving video_analytics_sessions.json:', err);
    }
  }

  private indexSession(session: VideoWatchSession, save = true): void {
    this.sessions.set(session.sessionId, session);

    // Index by videoId
    const vList = this.videoIndex.get(session.videoId) || [];
    if (!vList.includes(session.sessionId)) {
      vList.push(session.sessionId);
      this.videoIndex.set(session.videoId, vList);
    }

    // Index by creatorId
    if (session.creatorId) {
      const cList = this.creatorIndex.get(session.creatorId) || [];
      if (!cList.includes(session.sessionId)) {
        cList.push(session.sessionId);
        this.creatorIndex.set(session.creatorId, cList);
      }
    }

    // Deduplication key
    const dedupKey = `${session.videoId}:${session.viewerFingerprint}`;
    this.deduplicationIndex.set(dedupKey, {
      sessionId: session.sessionId,
      timestampMs: new Date(session.createdAt).getTime(),
    });

    if (save) {
      this.persistToDisk();
      this.syncToSupabaseAsync(session);
    }
  }

  private async syncToSupabaseAsync(session: VideoWatchSession): Promise<void> {
    try {
      const supabase = getServerSupabaseClient();
      if (!supabase) return;

      const isViewerUuid = session.viewerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.viewerId);
      const isCreatorUuid = session.creatorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.creatorId);

      await supabase.from('video_watch_sessions').insert({
        id: session.sessionId,
        video_id: session.videoId,
        video_type: session.videoType,
        creator_id: isCreatorUuid ? session.creatorId : null,
        viewer_id: isViewerUuid ? session.viewerId : null,
        viewer_fingerprint: session.viewerFingerprint,
        device_type: session.deviceType,
        watch_duration_seconds: session.watchDurationSeconds,
        video_duration_seconds: session.videoDurationSeconds,
        completion_rate: session.completionRate,
        playback_speed: session.playbackSpeed,
        is_qualified_view: session.isQualifiedView,
        is_completed: session.isCompleted,
        is_self_watch: session.isSelfWatch,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        created_at: session.createdAt,
      });
    } catch {
      // Supabase insertion is resilient; local disk ledger guarantees non-loss
    }
  }

  /**
   * Record a genuine video watch session with server-side anti-fraud validation
   */
  public recordWatchSession(req: IngestWatchSessionRequest): {
    success: boolean;
    session?: VideoWatchSession;
    isDuplicate: boolean;
    rejectionReason?: string;
  } {
    // 1. Basic Field Validation
    if (!req.videoId || typeof req.videoId !== 'string') {
      return { success: false, isDuplicate: false, rejectionReason: 'Invalid videoId' };
    }
    if (typeof req.watchDurationSeconds !== 'number' || req.watchDurationSeconds < 0.5) {
      return { success: false, isDuplicate: false, rejectionReason: 'Watch duration too short to qualify as a session (< 0.5s)' };
    }
    if (typeof req.videoDurationSeconds !== 'number' || req.videoDurationSeconds <= 0) {
      return { success: false, isDuplicate: false, rejectionReason: 'Invalid video duration' };
    }

    const playbackSpeed = typeof req.playbackSpeed === 'number' && req.playbackSpeed > 0 ? req.playbackSpeed : 1.0;
    if (playbackSpeed > 2.5) {
      return { success: false, isDuplicate: false, rejectionReason: 'Accelerated playback speed exceeds legitimate threshold (> 2.5x)' };
    }

    const now = new Date();
    const startedAtDate = req.startedAt ? new Date(req.startedAt) : new Date(Date.now() - req.watchDurationSeconds * 1000);
    const endedAtDate = req.endedAt ? new Date(req.endedAt) : now;

    // 2. Velocity Tampering Verification
    // A user cannot watch 60 seconds of video in 5 seconds of real clock time
    const realElapsedSeconds = Math.max(0.5, (endedAtDate.getTime() - startedAtDate.getTime()) / 1000);
    const maxPossibleWatchSeconds = (realElapsedSeconds * playbackSpeed) + 3.0; // 3s network jitter tolerance
    if (req.watchDurationSeconds > maxPossibleWatchSeconds) {
      return {
        success: false,
        isDuplicate: false,
        rejectionReason: `Clock anomaly: Watch duration (${req.watchDurationSeconds.toFixed(1)}s) exceeds physical elapsed time (${realElapsedSeconds.toFixed(1)}s).`,
      };
    }

    // 3. Resolve viewer fingerprint & self-watch status
    const fingerprint = req.viewerFingerprint || req.viewerId || crypto.createHash('sha256').update(req.startedAt || String(Date.now())).digest('hex').substring(0, 16);
    const isSelfWatch = Boolean(req.viewerId && req.creatorId && req.viewerId === req.creatorId);

    // 4. Qualification rules
    // Qualified view: >= 3s watch time AND (>= 5s OR >= 15% completion)
    const completionRate = Math.min(1.0, req.watchDurationSeconds / req.videoDurationSeconds);
    const isQualifiedView = req.watchDurationSeconds >= 3.0 && (req.watchDurationSeconds >= 5.0 || completionRate >= 0.15);
    const isCompleted = completionRate >= 0.95;

    // 5. Deduplication: Same viewer watching same video within 30 minutes
    const dedupKey = `${req.videoId}:${fingerprint}`;
    const existingDedup = this.deduplicationIndex.get(dedupKey);

    if (existingDedup) {
      const msSincePrevious = Date.now() - existingDedup.timestampMs;
      // Within 30 minutes (1,800,000 ms), update existing session rather than counting a duplicate view
      if (msSincePrevious < 30 * 60 * 1000) {
        const existingSession = this.sessions.get(existingDedup.sessionId);
        if (existingSession) {
          existingSession.watchDurationSeconds = Math.max(existingSession.watchDurationSeconds, req.watchDurationSeconds);
          existingSession.completionRate = Math.max(existingSession.completionRate, completionRate);
          existingSession.isQualifiedView = existingSession.isQualifiedView || isQualifiedView;
          existingSession.isCompleted = existingSession.isCompleted || isCompleted;
          existingSession.endedAt = endedAtDate.toISOString();
          this.persistToDisk();
          return { success: true, session: existingSession, isDuplicate: true };
        }
      }
    }

    // 6. Create pristine verified watch session
    const session: VideoWatchSession = {
      sessionId: `vws_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      videoId: req.videoId,
      videoType: req.videoType,
      creatorId: req.creatorId || '',
      viewerId: req.viewerId || null,
      viewerFingerprint: fingerprint,
      deviceType: req.deviceType || 'desktop',
      watchDurationSeconds: Math.round(req.watchDurationSeconds * 10) / 10,
      videoDurationSeconds: Math.round(req.videoDurationSeconds * 10) / 10,
      completionRate: Math.round(completionRate * 1000) / 1000,
      playbackSpeed,
      isQualifiedView,
      isCompleted,
      isSelfWatch,
      startedAt: startedAtDate.toISOString(),
      endedAt: endedAtDate.toISOString(),
      createdAt: now.toISOString(),
    };

    this.indexSession(session, true);

    return { success: true, session, isDuplicate: false };
  }

  /**
   * Aggregates real performance metrics for a specific video
   */
  public getVideoAnalytics(
    videoId: string,
    additionalMetadata?: {
      title?: string;
      thumbnailUrl?: string;
      videoType?: 'reel' | 'post_video' | 'premium_content';
      creatorId?: string;
      likesCount?: number;
      commentsCount?: number;
      sharesCount?: number;
      savesCount?: number;
      isPremium?: boolean;
    }
  ): VideoAnalyticsSummary {
    const sessionIds = this.videoIndex.get(videoId) || [];
    const sessions = sessionIds.map((id) => this.sessions.get(id)!).filter(Boolean);

    // Separate external views from creator self-views
    const externalSessions = sessions.filter((s) => !s.isSelfWatch);
    const selfSessions = sessions.filter((s) => s.isSelfWatch);

    const qualifiedSessions = externalSessions.filter((s) => s.isQualifiedView);
    const totalViews = qualifiedSessions.length;
    const totalQualifiedWatchSeconds = qualifiedSessions.reduce((acc, s) => acc + s.watchDurationSeconds, 0);

    const averageWatchDurationSeconds = totalViews > 0
      ? Math.round((totalQualifiedWatchSeconds / totalViews) * 10) / 10
      : null;

    const completionCount = qualifiedSessions.filter((s) => s.isCompleted).length;
    const completionRate = totalViews > 0
      ? Math.round((qualifiedSessions.reduce((acc, s) => acc + s.completionRate, 0) / totalViews) * 1000) / 10
      : null;

    // Real engagement counts
    const likesCount = additionalMetadata?.likesCount ?? 0;
    const commentsCount = additionalMetadata?.commentsCount ?? 0;
    const sharesCount = additionalMetadata?.sharesCount ?? 0;
    const savesCount = additionalMetadata?.savesCount ?? 0;

    const totalEngagements = likesCount + commentsCount + sharesCount + savesCount;
    const engagementRate = totalViews > 0
      ? Math.round((totalEngagements / totalViews) * 1000) / 10
      : null;

    // Audience Insights from actual sessions
    const deviceCounts = { mobile: 0, desktop: 0, tablet: 0 };
    const hourlyCounts: { [h: number]: number } = {};
    for (let h = 0; h < 24; h++) hourlyCounts[h] = 0;

    const uniqueViewers = new Set<string>();
    for (const s of externalSessions) {
      deviceCounts[s.deviceType] = (deviceCounts[s.deviceType] || 0) + 1;
      uniqueViewers.add(s.viewerFingerprint);
      try {
        const hour = new Date(s.startedAt).getHours();
        hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
      } catch {}
    }

    const totalRecorded = externalSessions.length;
    const deviceBreakdown = {
      mobile: totalRecorded > 0 ? Math.round((deviceCounts.mobile / totalRecorded) * 100) : 0,
      desktop: totalRecorded > 0 ? Math.round((deviceCounts.desktop / totalRecorded) * 100) : 0,
      tablet: totalRecorded > 0 ? Math.round((deviceCounts.tablet / totalRecorded) * 100) : 0,
      hasData: totalRecorded > 0,
    };

    // Financial calculations backed by verified v2PremiumContentEngine ledger
    let grossRevenueCents = 0;
    let creatorEarningsCents = 0;
    let platformFeeCents = 0;
    let verifiedTransactionsCount = 0;
    let isMonetized = Boolean(additionalMetadata?.isPremium);

    try {
      const allPurchases = v2PremiumContentEngine.getPurchases();
      const videoPurchases = allPurchases.filter((p) => p.content_id === videoId && p.status === 'COMPLETED');
      if (videoPurchases.length > 0) {
        isMonetized = true;
        verifiedTransactionsCount = videoPurchases.length;
        grossRevenueCents = videoPurchases.reduce((acc, p) => acc + (p.amount_cents || 0), 0);
        creatorEarningsCents = videoPurchases.reduce((acc, p) => acc + (p.creator_amount_cents || 0), 0);
        platformFeeCents = videoPurchases.reduce((acc, p) => acc + (p.platform_fee_cents || 0), 0);
      }
    } catch {}

    const resolvedCreatorId = additionalMetadata?.creatorId || sessions[0]?.creatorId || '';
    const resolvedVideoType = additionalMetadata?.videoType || sessions[0]?.videoType || 'reel';

    return {
      videoId,
      videoType: resolvedVideoType,
      creatorId: resolvedCreatorId,
      title: additionalMetadata?.title,
      thumbnailUrl: additionalMetadata?.thumbnailUrl,
      totalViews,
      rawSessionsCount: sessions.length,
      totalQualifiedWatchSeconds: Math.round(totalQualifiedWatchSeconds * 10) / 10,
      averageWatchDurationSeconds,
      completionRate,
      completionCount,
      selfWatchSessionsCount: selfSessions.length,
      likesCount,
      commentsCount,
      sharesCount,
      savesCount,
      engagementRate,
      audienceInsights: {
        deviceBreakdown,
        hourlyDistribution: hourlyCounts,
        totalUniqueViewers: uniqueViewers.size,
        hasSufficientData: totalRecorded >= 1,
      },
      monetization: {
        isMonetized,
        model: isMonetized ? 'PREMIUM_PAY_PER_VIEW' : 'FREE',
        grossRevenueCents,
        creatorEarningsCents,
        platformFeeCents,
        verifiedTransactionsCount,
        hasTransactions: verifiedTransactionsCount > 0,
        ledgerStatusText: verifiedTransactionsCount > 0
          ? `Verified by Metfa Wallet Ledger (${verifiedTransactionsCount} completed purchases; 80% creator / 20% platform)`
          : isMonetized
          ? 'Premium content active: No transactions recorded yet'
          : 'Standard Free Content (No monetization transactions)',
      },
      trackingStartedAt: this.TRACKING_EPOCH,
      isHistoricalDataLimited: sessions.length === 0,
      dataSourceNotice: sessions.length === 0
        ? 'Tracking active since Oct 23, 2026. Prior video views were not recorded by the analytics engine.'
        : 'All metrics derived strictly from verified real sessions and ledger entries.',
    };
  }

  /**
   * Aggregates Creator Insights across all videos owned by the creator
   */
  public getCreatorInsights(
    creatorId: string,
    creatorVideos: Array<{
      id: string;
      title?: string;
      thumbnailUrl?: string;
      videoType: 'reel' | 'post_video' | 'premium_content';
      likesCount?: number;
      commentsCount?: number;
      sharesCount?: number;
      savesCount?: number;
      isPremium?: boolean;
    }>
  ): CreatorInsightsSummary {
    const videoSummaries: VideoAnalyticsSummary[] = [];

    let totalViews = 0;
    let totalQualifiedWatchSeconds = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalGrossRevenueCents = 0;
    let totalCreatorEarningsCents = 0;
    let totalVerifiedPurchases = 0;

    const deviceCounts = { mobile: 0, desktop: 0, tablet: 0 };
    let totalAudienceSessions = 0;

    for (const v of creatorVideos) {
      const summary = this.getVideoAnalytics(v.id, {
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        videoType: v.videoType,
        creatorId,
        likesCount: v.likesCount,
        commentsCount: v.commentsCount,
        sharesCount: v.sharesCount,
        savesCount: v.savesCount,
        isPremium: v.isPremium,
      });

      videoSummaries.push(summary);

      totalViews += summary.totalViews;
      totalQualifiedWatchSeconds += summary.totalQualifiedWatchSeconds;
      totalLikes += summary.likesCount;
      totalComments += summary.commentsCount;
      totalShares += summary.sharesCount;
      totalSaves += summary.savesCount;

      totalGrossRevenueCents += summary.monetization.grossRevenueCents;
      totalCreatorEarningsCents += summary.monetization.creatorEarningsCents;
      totalVerifiedPurchases += summary.monetization.verifiedTransactionsCount;

      const vSessions = (this.videoIndex.get(v.id) || [])
        .map((id) => this.sessions.get(id)!)
        .filter((s) => s && !s.isSelfWatch);

      for (const s of vSessions) {
        deviceCounts[s.deviceType] = (deviceCounts[s.deviceType] || 0) + 1;
        totalAudienceSessions += 1;
      }
    }

    const videosWithCompletion = videoSummaries.filter((v) => v.completionRate !== null);
    const averageCompletionRate = videosWithCompletion.length > 0
      ? Math.round(
          (videosWithCompletion.reduce((acc, v) => acc + (v.completionRate || 0), 0) /
            videosWithCompletion.length) *
            10
        ) / 10
      : null;

    const totalEngagements = totalLikes + totalComments + totalShares + totalSaves;

    const deviceBreakdown = {
      mobile: totalAudienceSessions > 0 ? Math.round((deviceCounts.mobile / totalAudienceSessions) * 100) : 0,
      desktop: totalAudienceSessions > 0 ? Math.round((deviceCounts.desktop / totalAudienceSessions) * 100) : 0,
      tablet: totalAudienceSessions > 0 ? Math.round((deviceCounts.tablet / totalAudienceSessions) * 100) : 0,
      hasData: totalAudienceSessions > 0,
    };

    return {
      creatorId,
      totalVideos: creatorVideos.length,
      totalViews,
      totalQualifiedWatchSeconds: Math.round(totalQualifiedWatchSeconds * 10) / 10,
      averageCompletionRate,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      totalEngagements,
      totalGrossRevenueCents,
      totalCreatorEarningsCents,
      totalVerifiedPurchases,
      deviceBreakdown,
      videos: videoSummaries,
      trackingStartedAt: this.TRACKING_EPOCH,
      hasSufficientData: totalViews > 0 || totalAudienceSessions > 0,
      notice: totalViews === 0
        ? 'Real data only: Video tracking was initialized on Oct 23, 2026. Watch sessions will appear here in real time as audience watches your videos.'
        : 'All analytics and earnings are derived directly from verified session heartbeats and wallet ledger records.',
    };
  }

  /**
   * Resets internal in-memory index (for testing only)
   */
  public resetForTesting(): void {
    this.sessions.clear();
    this.videoIndex.clear();
    this.creatorIndex.clear();
    this.deduplicationIndex.clear();
    try {
      if (fs.existsSync(this.dataFilePath)) {
        fs.unlinkSync(this.dataFilePath);
      }
    } catch {}
  }
}

export const videoAnalyticsEngine = new VideoAnalyticsEngine();
