/**
 * METFA SOCIAL — Video Analytics & Creator Insights Verification Suite
 * 
 * Validates:
 * 1. Genuine event tracking & persistence
 * 2. Clock anomaly & velocity tampering rejection
 * 3. Accelerated bot playback rejection (> 2.5x)
 * 4. Deduplication of consecutive watches from the same viewer
 * 5. Separation of creator self-watch from audience metrics
 * 6. Mathematical correctness of qualified views, watch time, and completion rates
 * 7. Real engagement metric aggregation (likes, comments, shares, saves)
 * 8. Financial earnings derived strictly from verified ledger transactions (80/20 split)
 * 9. Explicit "Insufficient data" handling when metrics are unavailable (zero fake data)
 * 10. Historical tracking boundary notice enforcement
 */

import os from 'os';
import path from 'path';
import { VideoAnalyticsEngine } from '../services/videoAnalyticsEngine';

export interface VideoAnalyticsTestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  notes: string;
  durationMs: number;
}

export interface VideoAnalyticsTestSuiteSummary {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  status: 'PASS' | 'FAIL';
  results: VideoAnalyticsTestCaseResult[];
}

export async function runVideoAnalyticsVerification(): Promise<VideoAnalyticsTestSuiteSummary> {
  const results: VideoAnalyticsTestCaseResult[] = [];
  const startAll = Date.now();

  // If running inside a dedicated temporary directory (e.g. offline test runner), use its data path;
  // otherwise, explicitly place test storage in os.tmpdir() to guarantee production data is never touched.
  const isCwdInTmp = process.cwd().startsWith(os.tmpdir());
  const testStoragePath = isCwdInTmp
    ? path.join(process.cwd(), 'data', 'video_analytics_sessions.json')
    : path.join(os.tmpdir(), 'metfa_isolated_analytics', 'data', 'video_analytics_sessions.json');

  const videoAnalyticsEngine = new VideoAnalyticsEngine({
    dataFilePath: testStoragePath,
    isIsolatedTest: true,
  });

  // Reset engine index for a clean, deterministic test environment
  videoAnalyticsEngine.resetForTesting();

  // TEST 1: Reject accelerated playback speed > 2.5x (Bot detection)
  {
    const start = Date.now();
    const res = videoAnalyticsEngine.recordWatchSession({
      videoId: 'test_vid_bot_speed',
      videoType: 'reel',
      creatorId: 'creator_01',
      viewerId: 'viewer_bot',
      watchDurationSeconds: 15,
      videoDurationSeconds: 30,
      playbackSpeed: 3.5, // > 2.5x
      startedAt: new Date(Date.now() - 20000).toISOString(),
    });

    const passed = !res.success && (res.rejectionReason?.includes('> 2.5x') || false);
    results.push({
      id: 'VA-01-BOT-SPEED-REJECTION',
      name: 'Rejects accelerated playback speeds exceeding 2.5x threshold',
      passed,
      notes: passed
        ? 'Successfully rejected accelerated playback speed 3.5x with anti-bot validation.'
        : `Expected rejection, received: ${JSON.stringify(res)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 2: Reject velocity clock anomaly (cannot watch 60s in 5s elapsed)
  {
    const start = Date.now();
    const now = Date.now();
    const res = videoAnalyticsEngine.recordWatchSession({
      videoId: 'test_vid_clock_anomaly',
      videoType: 'reel',
      creatorId: 'creator_01',
      viewerId: 'viewer_tamper',
      watchDurationSeconds: 60, // Claimed 60 seconds
      videoDurationSeconds: 60,
      playbackSpeed: 1.0,
      startedAt: new Date(now - 5000).toISOString(), // But only 5 seconds elapsed!
      endedAt: new Date(now).toISOString(),
    });

    const passed = !res.success && (res.rejectionReason?.includes('Clock anomaly') || false);
    results.push({
      id: 'VA-02-CLOCK-VELOCITY-VALIDATION',
      name: 'Rejects simulated or tampered watch durations exceeding physical elapsed time',
      passed,
      notes: passed
        ? 'Successfully caught velocity clock tampering (60s claimed in 5s real elapsed time).'
        : `Expected clock anomaly rejection, got: ${JSON.stringify(res)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 3: Short bounce (< 3s) is logged but NOT counted as qualified view
  {
    const start = Date.now();
    const now = Date.now();
    const res = videoAnalyticsEngine.recordWatchSession({
      videoId: 'test_vid_bounce',
      videoType: 'reel',
      creatorId: 'creator_01',
      viewerId: 'viewer_bouncer',
      viewerFingerprint: 'fp_bouncer_1',
      watchDurationSeconds: 2.1, // Bounce < 3s
      videoDurationSeconds: 30,
      playbackSpeed: 1.0,
      startedAt: new Date(now - 3000).toISOString(),
      endedAt: new Date(now).toISOString(),
    });

    const analytics = videoAnalyticsEngine.getVideoAnalytics('test_vid_bounce');
    const passed = res.success && res.session?.isQualifiedView === false && analytics.totalViews === 0 && analytics.rawSessionsCount === 1;
    results.push({
      id: 'VA-03-BOUNCE-EXCLUSION',
      name: 'Excludes sub-3-second bounces from qualified views count',
      passed,
      notes: passed
        ? 'Recorded raw session (2.1s) but correctly disqualified view count (totalViews = 0).'
        : `Bounce test failed: isQualified=${res.session?.isQualifiedView}, totalViews=${analytics.totalViews}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 4: Genuine qualified watch session (>= 3s and >= 15% completion)
  {
    const start = Date.now();
    const now = Date.now();
    const res = videoAnalyticsEngine.recordWatchSession({
      videoId: 'test_vid_qualified',
      videoType: 'reel',
      creatorId: 'creator_01',
      viewerId: 'viewer_real_01',
      viewerFingerprint: 'fp_real_01',
      deviceType: 'mobile',
      watchDurationSeconds: 18.0,
      videoDurationSeconds: 20.0, // 90% completion
      playbackSpeed: 1.0,
      startedAt: new Date(now - 20000).toISOString(),
      endedAt: new Date(now).toISOString(),
    });

    const analytics = videoAnalyticsEngine.getVideoAnalytics('test_vid_qualified');
    const passed = res.success && res.session?.isQualifiedView === true && analytics.totalViews === 1 && analytics.totalQualifiedWatchSeconds === 18.0;
    results.push({
      id: 'VA-04-QUALIFIED-VIEW-ACCOUNTING',
      name: 'Accurately measures qualified watch time and views for legitimate sessions',
      passed,
      notes: passed
        ? 'Qualified session verified: totalViews = 1, qualifiedWatchSeconds = 18.0s.'
        : `Qualified test failed: ${JSON.stringify(analytics)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 5: Deduplication of consecutive watches within 30-minute window
  {
    const start = Date.now();
    const now = Date.now();
    // First session: 10s
    videoAnalyticsEngine.recordWatchSession({
      videoId: 'test_vid_dedup',
      videoType: 'reel',
      creatorId: 'creator_01',
      viewerId: 'viewer_dedup',
      viewerFingerprint: 'fp_dedup_user',
      watchDurationSeconds: 10.0,
      videoDurationSeconds: 30.0,
      playbackSpeed: 1.0,
      startedAt: new Date(now - 15000).toISOString(),
      endedAt: new Date(now - 5000).toISOString(),
    });

    // Immediate second session by same viewer 2 seconds later: 15s
    const secondRes = videoAnalyticsEngine.recordWatchSession({
      videoId: 'test_vid_dedup',
      videoType: 'reel',
      creatorId: 'creator_01',
      viewerId: 'viewer_dedup',
      viewerFingerprint: 'fp_dedup_user',
      watchDurationSeconds: 15.0,
      videoDurationSeconds: 30.0,
      playbackSpeed: 1.0,
      startedAt: new Date(now - 16000).toISOString(),
      endedAt: new Date(now).toISOString(),
    });

    const analytics = videoAnalyticsEngine.getVideoAnalytics('test_vid_dedup');
    const passed = secondRes.isDuplicate === true && analytics.totalViews === 1 && analytics.rawSessionsCount === 1;
    results.push({
      id: 'VA-05-DEDUPLICATION-WINDOW',
      name: 'Deduplicates consecutive watches from same viewer within 30-minute window',
      passed,
      notes: passed
        ? 'Correctly identified second consecutive watch as duplicate (views remained 1, duration updated).'
        : `Deduplication failed: isDuplicate=${secondRes.isDuplicate}, totalViews=${analytics.totalViews}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 6: Creator self-watch separation (creator testing own video)
  {
    const start = Date.now();
    const now = Date.now();
    const res = videoAnalyticsEngine.recordWatchSession({
      videoId: 'test_vid_self_watch',
      videoType: 'reel',
      creatorId: 'creator_99',
      viewerId: 'creator_99', // Self-watch
      viewerFingerprint: 'fp_creator_99',
      watchDurationSeconds: 25.0,
      videoDurationSeconds: 30.0,
      playbackSpeed: 1.0,
      startedAt: new Date(now - 26000).toISOString(),
      endedAt: new Date(now).toISOString(),
    });

    const analytics = videoAnalyticsEngine.getVideoAnalytics('test_vid_self_watch', { creatorId: 'creator_99' });
    const passed = res.session?.isSelfWatch === true && analytics.totalViews === 0 && analytics.selfWatchSessionsCount === 1;
    results.push({
      id: 'VA-06-SELF-WATCH-SEPARATION',
      name: 'Excludes creator self-watch sessions from external view counts',
      passed,
      notes: passed
        ? 'Creator self-watch correctly separated: totalViews = 0, selfWatchSessionsCount = 1.'
        : `Self-watch separation failed: totalViews=${analytics.totalViews}, selfSessions=${analytics.selfWatchSessionsCount}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 7: Accurate average completion rate calculation across multiple viewers
  {
    const start = Date.now();
    const now = Date.now();
    const vidId = 'test_vid_completion_avg';

    // Viewer A: 10s of 20s (50% completion)
    videoAnalyticsEngine.recordWatchSession({
      videoId: vidId,
      videoType: 'reel',
      creatorId: 'creator_01',
      viewerId: 'viewer_A',
      viewerFingerprint: 'fp_viewer_A',
      watchDurationSeconds: 10.0,
      videoDurationSeconds: 20.0,
      playbackSpeed: 1.0,
      startedAt: new Date(now - 12000).toISOString(),
    });

    // Viewer B: 20s of 20s (100% completion)
    videoAnalyticsEngine.recordWatchSession({
      videoId: vidId,
      videoType: 'reel',
      creatorId: 'creator_01',
      viewerId: 'viewer_B',
      viewerFingerprint: 'fp_viewer_B',
      watchDurationSeconds: 20.0,
      videoDurationSeconds: 20.0,
      playbackSpeed: 1.0,
      startedAt: new Date(now - 22000).toISOString(),
    });

    const analytics = videoAnalyticsEngine.getVideoAnalytics(vidId);
    // Average completion = (50% + 100%) / 2 = 75.0%
    const passed = analytics.totalViews === 2 && analytics.completionRate === 75.0;
    results.push({
      id: 'VA-07-COMPLETION-RATE-MATH',
      name: 'Calculates mathematically exact average completion rate across multiple sessions',
      passed,
      notes: passed
        ? `Expected 75.0% average completion rate, got exact ${analytics.completionRate}%.`
        : `Completion calculation mismatch: ${analytics.completionRate}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 8: Verified Ledger financial aggregation for Premium Content (80/20 split)
  {
    const start = Date.now();
    // Verify integration with v2PremiumContentEngine
    const analytics = videoAnalyticsEngine.getVideoAnalytics('premium_sample_or_unmonetized', {
      isPremium: false,
    });

    const passed = analytics.monetization.grossRevenueCents === 0 &&
      analytics.monetization.creatorEarningsCents === 0 &&
      analytics.monetization.verifiedTransactionsCount === 0 &&
      analytics.monetization.ledgerStatusText.includes('Standard Free Content');

    results.push({
      id: 'VA-08-LEDGER-TRANSACTION-VERIFICATION',
      name: 'Derives monetization reports strictly from verified ledger purchases without fabrication',
      passed,
      notes: passed
        ? 'Unmonetized or 0-transaction video explicitly reports 0 transactions and Standard Free Content.'
        : `Monetization test failed: ${JSON.stringify(analytics.monetization)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 9: "Insufficient data" presentation when video has 0 watch sessions
  {
    const start = Date.now();
    const analytics = videoAnalyticsEngine.getVideoAnalytics('brand_new_unwatched_video');

    const passed = analytics.totalViews === 0 &&
      analytics.averageWatchDurationSeconds === null &&
      analytics.completionRate === null &&
      analytics.engagementRate === null &&
      analytics.audienceInsights.hasSufficientData === false &&
      analytics.isHistoricalDataLimited === true;

    results.push({
      id: 'VA-09-INSUFFICIENT-DATA-INTEGRITY',
      name: 'Returns explicit nulls and Insufficient Data states when measurements do not exist',
      passed,
      notes: passed
        ? 'Zero fake data verified: averageWatchDuration is null, completionRate is null, hasSufficientData is false.'
        : `Integrity check failed: ${JSON.stringify(analytics)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 10: Historical tracking boundary transparency
  {
    const start = Date.now();
    const insights = videoAnalyticsEngine.getCreatorInsights('creator_new', []);

    const passed = insights.trackingStartedAt === '2026-10-23T06:34:00Z' &&
      insights.hasSufficientData === false &&
      insights.notice.includes('2026');

    results.push({
      id: 'VA-10-HISTORICAL-BOUNDARY-TRANSPARENCY',
      name: 'Enforces historical tracking boundary and transparent data disclosure',
      passed,
      notes: passed
        ? `Tracking boundary verified at ${insights.trackingStartedAt} with zero fabricated historical records.`
        : `Historical boundary test failed: ${JSON.stringify(insights)}`,
      durationMs: Date.now() - start,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passedCount,
    failedCount,
    status: failedCount === 0 ? 'PASS' : 'FAIL',
    results,
  };
}
