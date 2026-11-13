/**
 * METFA SOCIAL — Unified Multi-Content Creator Studio Analytics Verification Suite
 *
 * Validates ALL 5 content formats & invariants:
 * 1. Classification of all 5 content types (reel, video, image, carousel, text)
 * 2. Shared metrics (impressions, reach, self-view exclusion, 15m dedup, engagement rate, traffic sources, device breakdown)
 * 3. Video & Reel total/unique views, watch time, completion rate, and 10-bucket retention drop-off timeline
 * 4. Single-Image engagement & save rate
 * 5. Carousel slide progression, drop-off analysis, last-slide completion rate, and null when unswiped
 * 6. Text-only Read More expansion clicks & >= 3s dwell validation (rejecting < 3s bounces)
 * 7. Follower attribution (direct_content_follow, assisted_profile_follow, net reversal preventing toggle inflation)
 * 8. Date-range comparisons (7d vs prior 7d, 30d, all)
 * 9. Zero cross-type AI insight leakage (image/carousel/text insights never mention video-only metrics)
 */

import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  ContentAnalyticsEngine,
  ContentCatalogDescriptor,
  resolveContentType,
  generateContentSpecificInsights,
  generateAccountAIInsights,
} from '../services/contentAnalyticsEngine';
import { VideoAnalyticsEngine } from '../services/videoAnalyticsEngine';

export interface CreatorStudioTestResult {
  id: string;
  name: string;
  passed: boolean;
  notes: string;
  durationMs: number;
}

export interface CreatorStudioTestSummary {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  status: 'PASS' | 'FAIL';
  results: CreatorStudioTestResult[];
}

export async function runCreatorStudioAnalyticsVerification(): Promise<CreatorStudioTestSummary> {
  const results: CreatorStudioTestResult[] = [];
  const tmpDir = path.join(os.tmpdir(), `metfa_creator_studio_test_${Date.now()}`);

  const contentEngine = new ContentAnalyticsEngine({
    dataFilePath: path.join(tmpDir, 'content_analytics_events.json'),
    isIsolatedTest: true,
  });
  const videoEngine = new VideoAnalyticsEngine({
    dataFilePath: path.join(tmpDir, 'video_analytics_sessions.json'),
    isIsolatedTest: true,
  });

  contentEngine.resetForTesting();
  videoEngine.resetForTesting();

  const creatorId = 'creator_unified_01';
  const nowMs = Date.now();

  // TEST 1: All 5 content type classifications
  {
    const start = Date.now();
    const tReel = resolveContentType({ postType: 'reel', videoSrc: 'https://cdn.metfa.ai/r.mp4' });
    const tVideo = resolveContentType({ postType: 'media', videoSrc: 'https://cdn.metfa.ai/v.mp4' });
    const tImage = resolveContentType({ postType: 'media', imageSrc: 'https://cdn.metfa.ai/i.png' });
    const tCarousel = resolveContentType({
      postType: 'media',
      imageGallery: ['https://cdn.metfa.ai/c1.png', 'https://cdn.metfa.ai/c2.png', 'https://cdn.metfa.ai/c3.png'],
    });
    const tText = resolveContentType({ postType: 'text', textBackgroundPreset: 'sunset' });

    const passed =
      tReel === 'reel' &&
      tVideo === 'video' &&
      tImage === 'image' &&
      tCarousel === 'carousel' &&
      tText === 'text';

    results.push({
      id: 'CS-01-CONTENT-TYPE-CLASSIFICATION',
      name: 'Classifies all 5 METFA content types accurately',
      passed,
      notes: passed
        ? 'Verified reel, video, image, carousel, and text resolution.'
        : `Got reel=${tReel}, video=${tVideo}, image=${tImage}, carousel=${tCarousel}, text=${tText}`,
      durationMs: Date.now() - start,
    });
  }

  // Catalog descriptors representing all 5 formats
  const reelDesc: ContentCatalogDescriptor = {
    id: 'item_reel_01',
    contentType: 'reel',
    postType: 'reel',
    feedType: 'reels',
    videoSrc: 'https://cdn.metfa.ai/reel01.mp4',
    title: 'Neon Tokyo AI Reel',
    creatorId,
    likesCount: 24,
    commentsCount: 6,
    sharesCount: 4,
    savesCount: 8,
  };

  const videoDesc: ContentCatalogDescriptor = {
    id: 'item_video_01',
    contentType: 'video',
    postType: 'media',
    videoSrc: 'https://cdn.metfa.ai/video01.mp4',
    title: 'Generative Workflow Tutorial',
    creatorId,
    likesCount: 18,
    commentsCount: 4,
    sharesCount: 3,
    savesCount: 5,
  };

  const imageDesc: ContentCatalogDescriptor = {
    id: 'item_image_01',
    contentType: 'image',
    postType: 'media',
    imageSrc: 'https://cdn.metfa.ai/art01.png',
    title: 'Architectural Glass Concept',
    creatorId,
    likesCount: 30,
    commentsCount: 5,
    sharesCount: 7,
    savesCount: 12,
  };

  const carouselDesc: ContentCatalogDescriptor = {
    id: 'item_carousel_01',
    contentType: 'carousel',
    postType: 'media',
    imageGallery: ['https://cdn.metfa.ai/s1.png', 'https://cdn.metfa.ai/s2.png', 'https://cdn.metfa.ai/s3.png'],
    title: '3-Step Prompt Breakdown',
    creatorId,
    likesCount: 20,
    commentsCount: 4,
    sharesCount: 5,
    savesCount: 11,
  };

  const unswipedCarouselDesc: ContentCatalogDescriptor = {
    id: 'item_carousel_unswiped',
    contentType: 'carousel',
    postType: 'media',
    imageGallery: ['https://cdn.metfa.ai/u1.png', 'https://cdn.metfa.ai/u2.png'],
    title: 'Unswiped 2-Slide Visual',
    creatorId,
    likesCount: 2,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 1,
  };

  const textDesc: ContentCatalogDescriptor = {
    id: 'item_text_01',
    contentType: 'text',
    postType: 'text',
    caption:
      'Long-form creative engineering breakdown: '.padEnd(260, 'A') + ' final notes on lighting consistency.',
    title: 'Lighting Consistency Notes',
    creatorId,
    likesCount: 16,
    commentsCount: 9,
    sharesCount: 4,
    savesCount: 6,
  };

  // TEST 2: Shared metrics, self-view exclusion, 15m dedup, traffic sources & devices
  {
    const start = Date.now();
    // Self-view by creator should be excluded
    contentEngine.recordEvent({
      kind: 'impression',
      contentId: imageDesc.id,
      contentType: 'image',
      creatorId,
      viewerId: creatorId,
      viewerFingerprint: 'fp_creator_self',
      trafficSource: 'feed',
      deviceType: 'desktop',
      createdAt: new Date(nowMs - 60000).toISOString(),
    });

    // External viewers (3 unique, plus 1 duplicate within 15m window)
    contentEngine.recordEvent({
      kind: 'impression',
      contentId: imageDesc.id,
      contentType: 'image',
      creatorId,
      viewerId: 'viewer_1',
      viewerFingerprint: 'fp_v1',
      trafficSource: 'feed',
      deviceType: 'mobile',
      createdAt: new Date(nowMs - 50000).toISOString(),
    });
    const dupRes = contentEngine.recordEvent({
      kind: 'impression',
      contentId: imageDesc.id,
      contentType: 'image',
      creatorId,
      viewerId: 'viewer_1',
      viewerFingerprint: 'fp_v1',
      trafficSource: 'feed',
      deviceType: 'mobile',
      createdAt: new Date(nowMs - 40000).toISOString(),
    });
    contentEngine.recordEvent({
      kind: 'impression',
      contentId: imageDesc.id,
      contentType: 'image',
      creatorId,
      viewerId: 'viewer_2',
      viewerFingerprint: 'fp_v2',
      trafficSource: 'profile',
      deviceType: 'desktop',
      createdAt: new Date(nowMs - 30000).toISOString(),
    });
    contentEngine.recordEvent({
      kind: 'impression',
      contentId: imageDesc.id,
      contentType: 'image',
      creatorId,
      viewerId: 'viewer_3',
      viewerFingerprint: 'fp_v3',
      trafficSource: 'search',
      deviceType: 'tablet',
      createdAt: new Date(nowMs - 20000).toISOString(),
    });

    const analytics = contentEngine.getContentAnalytics(imageDesc, {
      nowMs,
      videoEngineOverride: videoEngine,
    });

    const passed =
      dupRes.deduplicated === true &&
      analytics.impressions === 3 &&
      analytics.reach === 3 &&
      analytics.selfViewsExcluded === 1 &&
      analytics.trafficSources.entries.length === 3 &&
      analytics.audienceBreakdown.deviceBreakdown.hasData === true &&
      analytics.videoMetrics === null &&
      analytics.carouselMetrics === null &&
      analytics.textMetrics === null &&
      analytics.imageMetrics !== null;

    results.push({
      id: 'CS-02-SHARED-METRICS-DEDUP-SELF-EXCLUSION',
      name: 'Enforces self-view exclusion, 15m dedup, traffic sources, and format isolation',
      passed,
      notes: passed
        ? `Impressions=${analytics.impressions}, reach=${analytics.reach}, selfExcluded=${analytics.selfViewsExcluded}, sources=${analytics.trafficSources.entries.length}.`
        : `Failed shared metrics check: ${JSON.stringify({ impressions: analytics.impressions, reach: analytics.reach, selfExcluded: analytics.selfViewsExcluded, dup: dupRes.deduplicated })}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 3: Video / Reel views, watch time, completion rate, and 10-bucket retention drop-off curve
  {
    const start = Date.now();
    // Viewer 1 watches all 20s (100% completion, hits buckets 0..9)
    videoEngine.recordWatchSession({
      videoId: reelDesc.id,
      videoType: 'reel',
      creatorId,
      viewerId: 'viewer_1',
      viewerFingerprint: 'fp_v1',
      deviceType: 'mobile',
      watchDurationSeconds: 20,
      videoDurationSeconds: 20,
      playbackSpeed: 1,
      startedAt: new Date(nowMs - 40000).toISOString(),
      endedAt: new Date(nowMs - 20000).toISOString(),
    });
    for (let b = 0; b <= 9; b++) {
      contentEngine.recordEvent({
        kind: 'video_retention',
        contentId: reelDesc.id,
        contentType: 'reel',
        creatorId,
        viewerId: 'viewer_1',
        viewerFingerprint: 'fp_v1',
        bucketIndex: b,
        trafficSource: 'reels',
        deviceType: 'mobile',
        createdAt: new Date(nowMs - 30000).toISOString(),
      });
    }

    // Viewer 2 watches 8s of 20s (40% completion, hits buckets 0..3 then drops at bucket 4)
    videoEngine.recordWatchSession({
      videoId: reelDesc.id,
      videoType: 'reel',
      creatorId,
      viewerId: 'viewer_2',
      viewerFingerprint: 'fp_v2',
      deviceType: 'desktop',
      watchDurationSeconds: 8,
      videoDurationSeconds: 20,
      playbackSpeed: 1,
      startedAt: new Date(nowMs - 35000).toISOString(),
      endedAt: new Date(nowMs - 27000).toISOString(),
    });
    for (let b = 0; b <= 3; b++) {
      contentEngine.recordEvent({
        kind: 'video_retention',
        contentId: reelDesc.id,
        contentType: 'reel',
        creatorId,
        viewerId: 'viewer_2',
        viewerFingerprint: 'fp_v2',
        bucketIndex: b,
        trafficSource: 'reels',
        deviceType: 'desktop',
        createdAt: new Date(nowMs - 28000).toISOString(),
      });
    }

    // Standard video post session
    videoEngine.recordWatchSession({
      videoId: videoDesc.id,
      videoType: 'post_video',
      creatorId,
      viewerId: 'viewer_1',
      viewerFingerprint: 'fp_v1',
      deviceType: 'desktop',
      watchDurationSeconds: 30,
      videoDurationSeconds: 60,
      playbackSpeed: 1,
      startedAt: new Date(nowMs - 45000).toISOString(),
      endedAt: new Date(nowMs - 15000).toISOString(),
    });

    const reelAnalytics = contentEngine.getContentAnalytics(reelDesc, {
      nowMs,
      videoEngineOverride: videoEngine,
    });

    const passed =
      reelAnalytics.videoMetrics !== null &&
      reelAnalytics.videoMetrics.totalViews === 2 &&
      reelAnalytics.videoMetrics.totalPlayTimeSeconds === 28 &&
      reelAnalytics.videoMetrics.averageWatchTimeSeconds === 14 &&
      reelAnalytics.videoMetrics.completionRate === 70 &&
      reelAnalytics.videoMetrics.retentionTimeline.hasData === true &&
      reelAnalytics.videoMetrics.retentionTimeline.buckets[0].retentionPercent === 100 &&
      reelAnalytics.videoMetrics.retentionTimeline.buckets[4].retentionPercent === 50 &&
      reelAnalytics.videoMetrics.retentionTimeline.highestDropOffBucketLabel === '40–50%';

    results.push({
      id: 'CS-03-VIDEO-REEL-RETENTION-METRICS',
      name: 'Computes video/reel watch time, completion rate, and 10% retention drop-off curve',
      passed,
      notes: passed
        ? `Views=${reelAnalytics.videoMetrics?.totalViews}, avgWatch=${reelAnalytics.videoMetrics?.averageWatchTimeSeconds}s, completion=${reelAnalytics.videoMetrics?.completionRate}%, highestDrop=${reelAnalytics.videoMetrics?.retentionTimeline.highestDropOffBucketLabel}`
        : `Video analytics mismatch: ${JSON.stringify(reelAnalytics.videoMetrics)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 4: Single-Image engagement & save rate
  {
    const start = Date.now();
    const imgAnalytics = contentEngine.getContentAnalytics(imageDesc, {
      nowMs,
      videoEngineOverride: videoEngine,
    });

    // imageDesc: likes(30)+comments(5)+shares(7)+saves(12) = 54, impressions = 3, saveRate = (12/3)*100 = 400%
    const passed =
      imgAnalytics.imageMetrics !== null &&
      imgAnalytics.imageMetrics.imageEngagement === 54 &&
      imgAnalytics.imageMetrics.saves === 12 &&
      imgAnalytics.imageMetrics.saveRate === 400 &&
      imgAnalytics.videoMetrics === null;

    results.push({
      id: 'CS-04-SINGLE-IMAGE-METRICS',
      name: 'Computes single-image impressions, engagement, saves/shares/comments, and save rate',
      passed,
      notes: passed
        ? `Image engagement=${imgAnalytics.imageMetrics?.imageEngagement}, saveRate=${imgAnalytics.imageMetrics?.saveRate}%.`
        : `Image metrics check failed: ${JSON.stringify(imgAnalytics.imageMetrics)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 5: Carousel slide progression, last-slide completion rate, and honest null when unswiped
  {
    const start = Date.now();
    // 2 viewers view Slide 0; 2 view Slide 1; 1 reaches Slide 2 (50% last-slide completion)
    ['fp_v1', 'fp_v2'].forEach((fp, idx) => {
      contentEngine.recordEvent({
        kind: 'impression',
        contentId: carouselDesc.id,
        contentType: 'carousel',
        creatorId,
        viewerId: `v_${idx}`,
        viewerFingerprint: fp,
        trafficSource: 'feed',
        createdAt: new Date(nowMs - 25000).toISOString(),
      });
      contentEngine.recordEvent({
        kind: 'carousel_slide_view',
        contentId: carouselDesc.id,
        contentType: 'carousel',
        creatorId,
        viewerId: `v_${idx}`,
        viewerFingerprint: fp,
        slideIndex: 0,
        totalSlides: 3,
        createdAt: new Date(nowMs - 24000).toISOString(),
      });
      contentEngine.recordEvent({
        kind: 'carousel_slide_view',
        contentId: carouselDesc.id,
        contentType: 'carousel',
        creatorId,
        viewerId: `v_${idx}`,
        viewerFingerprint: fp,
        slideIndex: 1,
        totalSlides: 3,
        createdAt: new Date(nowMs - 23000).toISOString(),
      });
    });
    contentEngine.recordEvent({
      kind: 'carousel_slide_view',
      contentId: carouselDesc.id,
      contentType: 'carousel',
      creatorId,
      viewerId: 'v_0',
      viewerFingerprint: 'fp_v1',
      slideIndex: 2,
      totalSlides: 3,
      createdAt: new Date(nowMs - 22000).toISOString(),
    });

    // Unswiped carousel only has an impression (no slide swipes > 0)
    contentEngine.recordEvent({
      kind: 'impression',
      contentId: unswipedCarouselDesc.id,
      contentType: 'carousel',
      creatorId,
      viewerId: 'v_0',
      viewerFingerprint: 'fp_v1',
      trafficSource: 'feed',
      createdAt: new Date(nowMs - 20000).toISOString(),
    });

    const carAnalytics = contentEngine.getContentAnalytics(carouselDesc, {
      nowMs,
      videoEngineOverride: videoEngine,
    });
    const unswipedAnalytics = contentEngine.getContentAnalytics(unswipedCarouselDesc, {
      nowMs,
      videoEngineOverride: videoEngine,
    });

    const passed =
      carAnalytics.carouselMetrics !== null &&
      carAnalytics.carouselMetrics.lastSlideCompletionRate === 50 &&
      carAnalytics.carouselMetrics.highestDropOffSlideLabel === 'Slide 3' &&
      unswipedAnalytics.carouselMetrics?.lastSlideCompletionRate === null &&
      unswipedAnalytics.carouselMetrics?.hasSlideProgressionData === false;

    results.push({
      id: 'CS-05-CAROUSEL-PROGRESSION-HONESTY',
      name: 'Measures carousel slide progression & returns null lastSlideCompletionRate when unswiped',
      passed,
      notes: passed
        ? `Swiped carousel completion=50%, highestDrop=Slide 3; unswiped returned null cleanly.`
        : `Carousel failed: swiped=${JSON.stringify(carAnalytics.carouselMetrics)}, unswiped=${JSON.stringify(unswipedAnalytics.carouselMetrics)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 6: Text-only expand & >= 3s read engagement validation
  {
    const start = Date.now();
    // Should reject sub-3s read dwell
    const rejectedBounce = contentEngine.recordEvent({
      kind: 'text_read_engagement',
      contentId: textDesc.id,
      contentType: 'text',
      creatorId,
      viewerId: 'v_bounce',
      viewerFingerprint: 'fp_bounce',
      dwellSeconds: 1.8,
      createdAt: new Date(nowMs - 15000).toISOString(),
    });

    // Record 2 impressions, 1 expand, 1 genuine 4.2s read dwell
    ['fp_v1', 'fp_v2'].forEach((fp, idx) => {
      contentEngine.recordEvent({
        kind: 'impression',
        contentId: textDesc.id,
        contentType: 'text',
        creatorId,
        viewerId: `v_${idx}`,
        viewerFingerprint: fp,
        trafficSource: 'feed',
        createdAt: new Date(nowMs - 14000).toISOString(),
      });
    });
    contentEngine.recordEvent({
      kind: 'text_expand',
      contentId: textDesc.id,
      contentType: 'text',
      creatorId,
      viewerId: 'v_0',
      viewerFingerprint: 'fp_v1',
      createdAt: new Date(nowMs - 13000).toISOString(),
    });
    contentEngine.recordEvent({
      kind: 'text_read_engagement',
      contentId: textDesc.id,
      contentType: 'text',
      creatorId,
      viewerId: 'v_0',
      viewerFingerprint: 'fp_v1',
      dwellSeconds: 4.2,
      createdAt: new Date(nowMs - 12000).toISOString(),
    });

    const textAnalytics = contentEngine.getContentAnalytics(textDesc, {
      nowMs,
      videoEngineOverride: videoEngine,
    });

    const passed =
      !rejectedBounce.success &&
      textAnalytics.textMetrics !== null &&
      textAnalytics.textMetrics.isExpandable === true &&
      textAnalytics.textMetrics.expandClicks === 1 &&
      textAnalytics.textMetrics.expandRate === 50 &&
      textAnalytics.textMetrics.readingEngagementEvents === 1 &&
      textAnalytics.textMetrics.readingEngagementRate === 50;

    results.push({
      id: 'CS-06-TEXT-EXPAND-AND-READ-DWELL',
      name: 'Validates text-only Read More clicks & >= 3s continuous reading dwell (rejects bounces)',
      passed,
      notes: passed
        ? 'Rejected 1.8s bounce, counted 1 expand (50%) and 1 genuine read engagement (50%).'
        : `Text validation failed: rejected=${rejectedBounce.success}, textMetrics=${JSON.stringify(textAnalytics.textMetrics)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 7: Follower attribution & net unfollow reversal
  {
    const start = Date.now();
    // Viewer 1 follows directly from reel -> +1, unfollows -> -1, refollows -> +1 (net should be capped at 1, not 2!)
    contentEngine.recordEvent({
      kind: 'follow_attribution',
      contentId: reelDesc.id,
      contentType: 'reel',
      creatorId,
      viewerId: 'v_0',
      viewerFingerprint: 'fp_v1',
      attributionMethod: 'direct_content_follow',
      followDelta: 1,
      trafficSource: 'reels',
      createdAt: new Date(nowMs - 10000).toISOString(),
    });
    contentEngine.recordEvent({
      kind: 'follow_attribution',
      contentId: reelDesc.id,
      contentType: 'reel',
      creatorId,
      viewerId: 'v_0',
      viewerFingerprint: 'fp_v1',
      attributionMethod: 'direct_content_follow',
      followDelta: -1,
      trafficSource: 'reels',
      createdAt: new Date(nowMs - 9000).toISOString(),
    });
    contentEngine.recordEvent({
      kind: 'follow_attribution',
      contentId: reelDesc.id,
      contentType: 'reel',
      creatorId,
      viewerId: 'v_0',
      viewerFingerprint: 'fp_v1',
      attributionMethod: 'direct_content_follow',
      followDelta: 1,
      trafficSource: 'reels',
      createdAt: new Date(nowMs - 8000).toISOString(),
    });

    // Viewer 2 follows via assisted profile attribution from text post
    contentEngine.recordEvent({
      kind: 'follow_attribution',
      contentId: textDesc.id,
      contentType: 'text',
      creatorId,
      viewerId: 'v_1',
      viewerFingerprint: 'fp_v2',
      attributionMethod: 'assisted_profile_follow',
      followDelta: 1,
      trafficSource: 'profile',
      createdAt: new Date(nowMs - 7000).toISOString(),
    });

    // Self-follow rejected
    const selfFollowRes = contentEngine.recordEvent({
      kind: 'follow_attribution',
      contentId: reelDesc.id,
      contentType: 'reel',
      creatorId,
      viewerId: creatorId,
      attributionMethod: 'direct_content_follow',
      followDelta: 1,
    });

    const studioAll = contentEngine.getCreatorStudioAnalytics(
      creatorId,
      [reelDesc, videoDesc, imageDesc, carouselDesc, unswipedCarouselDesc, textDesc],
      { contentFilter: 'all', dateRange: '30d', nowMs, videoEngineOverride: videoEngine }
    );

    const passed =
      !selfFollowRes.success &&
      studioAll.followersGained.netGained === 2 &&
      studioAll.followersGained.directContentFollows === 1 &&
      studioAll.followersGained.assistedProfileFollows === 1;

    results.push({
      id: 'CS-07-FOLLOWER-ATTRIBUTION-NETTING',
      name: 'Enforces net follower attribution (direct + assisted) and prevents toggle inflation',
      passed,
      notes: passed
        ? `Net followers=${studioAll.followersGained.netGained} (direct=1, assisted=1); self-follow blocked.`
        : `Follower attribution mismatch: ${JSON.stringify(studioAll.followersGained)}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 8: Date-range comparisons (7d vs prior 7d)
  {
    const start = Date.now();
    // Record 1 prior-period impression 10 days ago on imageDesc (outside 7d current window, inside prior 7d window)
    const tenDaysAgo = nowMs - 10 * 24 * 60 * 60 * 1000;
    contentEngine.recordEvent({
      kind: 'impression',
      contentId: imageDesc.id,
      contentType: 'image',
      creatorId,
      viewerId: 'viewer_old_period',
      viewerFingerprint: 'fp_old_period',
      trafficSource: 'feed',
      createdAt: new Date(tenDaysAgo).toISOString(),
    });

    const sevenDayAnalytics = contentEngine.getContentAnalytics(imageDesc, {
      dateRange: '7d',
      nowMs,
      videoEngineOverride: videoEngine,
    });
    const thirtyDayAnalytics = contentEngine.getContentAnalytics(imageDesc, {
      dateRange: '30d',
      nowMs,
      videoEngineOverride: videoEngine,
    });

    // Current 7d has 3 impressions, previous 7d has 1 impression -> +200% delta!
    const passed =
      sevenDayAnalytics.impressions === 3 &&
      sevenDayAnalytics.periodComparison.hasPreviousPeriodData === true &&
      sevenDayAnalytics.periodComparison.impressionsDeltaPercent === 200 &&
      thirtyDayAnalytics.impressions === 4;

    results.push({
      id: 'CS-08-DATE-RANGE-COMPARISONS',
      name: 'Computes accurate date-range windows and prior-period comparison deltas',
      passed,
      notes: passed
        ? `7d impressions=${sevenDayAnalytics.impressions} (+${sevenDayAnalytics.periodComparison.impressionsDeltaPercent}% vs prior 7d), 30d impressions=${thirtyDayAnalytics.impressions}.`
        : `Date comparison failed: 7d=${JSON.stringify(sevenDayAnalytics.periodComparison)}, 30dImp=${thirtyDayAnalytics.impressions}`,
      durationMs: Date.now() - start,
    });
  }

  // TEST 9: Zero cross-type AI insight leakage
  {
    const start = Date.now();
    const bannedForNonVideo = [
      'watch time',
      'video completion',
      'retention curve',
      'playback',
      'drop-off timestamp',
      'average watch',
    ];

    const imgSummary = contentEngine.getContentAnalytics(imageDesc, { nowMs, videoEngineOverride: videoEngine });
    const carSummary = contentEngine.getContentAnalytics(carouselDesc, { nowMs, videoEngineOverride: videoEngine });
    const txtSummary = contentEngine.getContentAnalytics(textDesc, { nowMs, videoEngineOverride: videoEngine });

    const imgStudio = contentEngine.getCreatorStudioAnalytics(creatorId, [imageDesc], {
      contentFilter: 'image',
      nowMs,
      videoEngineOverride: videoEngine,
    });
    const carStudio = contentEngine.getCreatorStudioAnalytics(creatorId, [carouselDesc], {
      contentFilter: 'carousel',
      nowMs,
      videoEngineOverride: videoEngine,
    });
    const txtStudio = contentEngine.getCreatorStudioAnalytics(creatorId, [textDesc], {
      contentFilter: 'text',
      nowMs,
      videoEngineOverride: videoEngine,
    });

    const allNonVideoInsights = [
      ...generateContentSpecificInsights(imgSummary),
      ...generateContentSpecificInsights(carSummary),
      ...generateContentSpecificInsights(txtSummary),
      ...generateAccountAIInsights('image', imgStudio.formatBreakdown, [imgSummary], 0),
      ...generateAccountAIInsights('carousel', carStudio.formatBreakdown, [carSummary], 0),
      ...generateAccountAIInsights('text', txtStudio.formatBreakdown, [txtSummary], 0),
    ];

    const leaked = allNonVideoInsights.filter((ins) => {
      const combined = `${ins.category} ${ins.title} ${ins.detail} ${ins.actionableStep} ${ins.basedOnMetric}`.toLowerCase();
      return bannedForNonVideo.some((term) => combined.includes(term));
    });

    const passed = allNonVideoInsights.length >= 6 && leaked.length === 0;

    results.push({
      id: 'CS-09-ZERO-CROSS-TYPE-AI-LEAKAGE',
      name: 'Guarantees zero video watch-time/retention leakage in Image, Carousel, and Text AI insights',
      passed,
      notes: passed
        ? `Inspected ${allNonVideoInsights.length} non-video AI insights across item + studio views: 0 cross-type leaks.`
        : `Found cross-type leakage in: ${JSON.stringify(leaked)}`,
      durationMs: Date.now() - start,
    });
  }

  contentEngine.resetForTesting();
  videoEngine.resetForTesting();

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

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCreatorStudioAnalyticsVerification().then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    if (summary.status !== 'PASS') {
      process.exit(1);
    }
  });
}
