/**
 * METFA SOCIAL — REELS NAVIGATION, EXPLICIT VIDEO SERIES, READINESS RECOVERY,
 * TABS/EMPTY STATES & MOBILE OVERFLOW VERIFICATION SUITE
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { CommunityPost, ReelHighlight } from '../types/community';
import { convertCommunityPostToReel } from '../services/reelService';
import {
  isExplicitSeriesItem,
  resolveSeriesNavigationContext,
  groupCreatorVideosAndSeries,
} from '../utils/videoSeries';
import {
  SLOW_LOAD_TIMEOUT_MS,
  MAX_AUTO_RETRIES,
  getBackoffDelayMs,
  createInitialReadinessSnapshot,
  reduceVideoReadinessEvent,
} from '../utils/videoReadiness';

interface AssertionResult {
  testId: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

function makeReel(overrides: Partial<ReelHighlight> & { id: string }): ReelHighlight {
  return {
    title: `Reel ${overrides.id}`,
    caption: 'Test caption',
    author: {
      id: 'creator-1',
      name: 'Creator One',
      username: 'creator1',
      avatar: 'https://example.com/a.jpg',
      isVerified: true,
      profilePrivacy: 'public',
    },
    visibility: 'public',
    videoSrc: `https://cdn.example.com/${overrides.id}.mp4`,
    duration: 20,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    createdAt: 'Just now',
    createdAtIso: '2026-11-15T00:00:00.000Z',
    ...overrides,
  };
}

export async function runReelsNavigationSeriesRecoveryVerification(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: AssertionResult[];
}> {
  const results: AssertionResult[] = [];
  const assert = (
    testId: string,
    category: string,
    description: string,
    condition: boolean,
    evidence: string
  ) => {
    results.push({
      testId,
      category,
      description,
      status: condition ? 'PASS' : 'FAIL',
      evidence,
    });
  };

  const reelServiceCode = fs.readFileSync('services/reelService.ts', 'utf-8');
  const socialIndexCode = fs.readFileSync('features/social/index.tsx', 'utf-8');
  const createReelCode = fs.readFileSync('components/CreateReelModal.tsx', 'utf-8');
  const reelsViewCode = fs.readFileSync('components/ReelsFeedView.tsx', 'utf-8');
  const communityFeedCode = fs.readFileSync('components/CommunityFeed.tsx', 'utf-8');
  const headerCode = fs.readFileSync('components/Header.tsx', 'utf-8');
  const profileViewCode = fs.readFileSync('components/ProfileView.tsx', 'utf-8');
  const postCardCode = fs.readFileSync('components/PostCard.tsx', 'utf-8');

  // 1. NAV-PARITY
  {
    const serviceQueriesNonEmptyVideo =
      reelServiceCode.includes(".not('video_src', 'is', null)") &&
      reelServiceCode.includes(".neq('video_src', '')") &&
      reelServiceCode.includes('export function convertCommunityPostToReel');

    const postInput: CommunityPost = {
      id: 'post-vid-1',
      author: {
        id: 'creator-1',
        name: 'Amina',
        username: 'amina',
        avatar: 'https://example.com/av.jpg',
        isVerified: true,
        profilePrivacy: 'public',
      },
      prompt: 'Video prompt title',
      caption: 'Real video post',
      postType: 'media',
      videoSrc: 'https://cdn.example.com/clip.mp4',
      likesCount: 12,
      remixCount: 0,
      commentsCount: 3,
      sharesCount: 1,
      createdAt: '5m ago',
      createdAtIso: '2026-11-15T01:00:00.000Z',
      visibility: 'public',
      tags: ['video'],
      comments: [],
    };
    const converted = convertCommunityPostToReel(postInput);
    const preservesMeta =
      converted !== null &&
      converted.id === 'post-vid-1' &&
      converted.videoSrc === 'https://cdn.example.com/clip.mp4' &&
      converted.sourcePostType === 'media';

    // Dummy/sample sample video URLs must be rejected
    const rejectedDummy = convertCommunityPostToReel({
      ...postInput,
      id: 'dummy-1',
      videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    });

    const noSampleDefaultsInModal =
      !createReelCode.includes('ForBiggerBlazes.mp4') &&
      !createReelCode.includes('photo-1534447677768');

    const indexCanonicalState =
      socialIndexCode.includes('const canonicalReels = useMemo') &&
      socialIndexCode.includes('lastActiveReelId') &&
      socialIndexCode.includes('lastReelsFeedFilter');

    assert(
      'NAV-PARITY',
      'Reels & Home Feed Navigation Parity',
      'Both direct Reels nav and Watch Reel use the canonical video_src dataset, preserve tab state, and reject/remove sample defaults',
      serviceQueriesNonEmptyVideo &&
        preservesMeta &&
        rejectedDummy === null &&
        noSampleDefaultsInModal &&
        indexCanonicalState,
      `serviceQueriesNonEmptyVideo=${serviceQueriesNonEmptyVideo}, preservesMeta=${preservesMeta}, rejectedDummy=${rejectedDummy === null}, noSampleDefaultsInModal=${noSampleDefaultsInModal}, indexCanonicalState=${indexCanonicalState}`
    );
  }

  // 2. SERIES-EXPLICIT-ONLY
  {
    const standaloneA = makeReel({ id: 'vid-a', title: 'Standalone A' });
    const standaloneB = makeReel({ id: 'vid-b', title: 'Standalone B' });
    const unrelatedCtx = resolveSeriesNavigationContext(
      standaloneA,
      [standaloneA, standaloneB],
      () => true
    );

    const p1 = makeReel({
      id: 's1-p1',
      title: 'Episode 1',
      series: {
        seriesId: 'series-1',
        seriesTitle: 'Blender Intro',
        creatorId: 'creator-1',
        partNumber: 1,
        totalParts: 3,
      },
    });
    const p2 = makeReel({
      id: 's1-p2',
      title: 'Episode 2',
      series: {
        seriesId: 'series-1',
        seriesTitle: 'Blender Intro',
        creatorId: 'creator-1',
        partNumber: 2,
        totalParts: 3,
      },
    });
    const p3 = makeReel({
      id: 's1-p3',
      title: 'Episode 3',
      series: {
        seriesId: 'series-1',
        seriesTitle: 'Blender Intro',
        creatorId: 'creator-1',
        partNumber: 3,
        totalParts: 3,
      },
    });
    const ctxP2 = resolveSeriesNavigationContext(p2, [p3, p1, p2, standaloneA], () => true);

    const grouped = groupCreatorVideosAndSeries([standaloneA, p3, p1, p2], {
      filter: 'all',
      sortBy: 'series',
    });

    assert(
      'SERIES-EXPLICIT-ONLY',
      'Explicit Creator-Linked Series Only',
      'Unrelated same-creator videos never auto-group; explicit series parts sort sequentially with Prev/Next/Part 1 links',
      unrelatedCtx === null &&
        !isExplicitSeriesItem(standaloneA) &&
        ctxP2 !== null &&
        ctxP2.currentPartNumber === 2 &&
        ctxP2.previousPart?.id === 's1-p1' &&
        ctxP2.nextPart?.id === 's1-p3' &&
        ctxP2.firstPart?.id === 's1-p1' &&
        grouped.seriesGroups.length === 1 &&
        grouped.seriesGroups[0].parts.map((p) => p.id).join(',') === 's1-p1,s1-p2,s1-p3',
      `unrelatedCtxNull=${unrelatedCtx === null}, prev=${ctxP2?.previousPart?.id}, next=${ctxP2?.nextPart?.id}, first=${ctxP2?.firstPart?.id}, groups=${grouped.seriesGroups.length}`
    );
  }

  // 3. SERIES-PRIVACY
  {
    const publicPart1 = makeReel({
      id: 'priv-p1',
      title: 'Public Ep 1',
      visibility: 'public',
      series: {
        seriesId: 'series-priv',
        seriesTitle: 'Secret Course',
        creatorId: 'creator-priv',
        partNumber: 1,
      },
      author: { id: 'creator-priv', name: 'Priv', username: 'priv', avatar: '', profilePrivacy: 'public' },
    });
    const onlyMePart2 = makeReel({
      id: 'priv-p2',
      title: 'Hidden Only Me Ep 2',
      visibility: 'only_me',
      series: {
        seriesId: 'series-priv',
        seriesTitle: 'Secret Course',
        creatorId: 'creator-priv',
        partNumber: 2,
      },
      author: { id: 'creator-priv', name: 'Priv', username: 'priv', avatar: '', profilePrivacy: 'public' },
    });
    const followersPart3 = makeReel({
      id: 'priv-p3',
      title: 'Followers Ep 3',
      visibility: 'followers',
      series: {
        seriesId: 'series-priv',
        seriesTitle: 'Secret Course',
        creatorId: 'creator-priv',
        partNumber: 3,
      },
      author: { id: 'creator-priv', name: 'Priv', username: 'priv', avatar: '', profilePrivacy: 'public' },
    });

    const nonFollowerCanView = (r: ReelHighlight) => r.visibility === 'public';
    const ctxForStranger = resolveSeriesNavigationContext(
      publicPart1,
      [publicPart1, onlyMePart2, followersPart3],
      nonFollowerCanView
    );
    const blockedCurrentCtx = resolveSeriesNavigationContext(
      onlyMePart2,
      [publicPart1, onlyMePart2],
      nonFollowerCanView
    );

    assert(
      'SERIES-PRIVACY',
      'Series Privacy Enforcement',
      'Restricted/only_me/followers parts are filtered before exposing next/prev links, part lists, or context',
      ctxForStranger !== null &&
        ctxForStranger.accessibleParts.length === 1 &&
        ctxForStranger.nextPart === null &&
        blockedCurrentCtx === null,
      `accessibleParts=${ctxForStranger?.accessibleParts.length}, nextPart=${ctxForStranger?.nextPart}, blockedCurrentNull=${blockedCurrentCtx === null}`
    );
  }

  // 4. READINESS-SLOW-OFFLINE
  {
    const s0 = createInitialReadinessSnapshot(
      { reelId: 'r-1', seriesId: 's-1', partNumber: 2, lastPositionSeconds: 0 },
      true
    );
    const sMeta = reduceVideoReadinessEvent(s0, { type: 'loadedmetadata', videoWidth: 1080, readyState: 1 });
    const sSlow = reduceVideoReadinessEvent(sMeta, { type: 'slow_timeout' });
    const sOffline = reduceVideoReadinessEvent(sSlow, { type: 'offline', positionSeconds: 42 });
    const sOnline = reduceVideoReadinessEvent(sOffline, { type: 'online' });
    const sReady = reduceVideoReadinessEvent(sOnline, { type: 'canplay', videoWidth: 1080, readyState: 3 });

    // Exponential backoff bounded to MAX_AUTO_RETRIES (3)
    const delays = [0, 1, 2].map(getBackoffDelayMs);
    let sRetry = s0;
    for (let i = 0; i < 6; i++) {
      sRetry = reduceVideoReadinessEvent(sRetry, { type: 'retry_auto' });
    }
    const sErr = reduceVideoReadinessEvent(sRetry, { type: 'error', message: 'Network failed', positionSeconds: 42 });

    const uiHasPrompts =
      reelsViewCode.includes('Your video is taking longer to load') &&
      reelsViewCode.includes("readinessSnapshot.phase === 'offline'") &&
      reelsViewCode.includes('cancelActiveVideoLoading');

    assert(
      'READINESS-SLOW-OFFLINE',
      'Video Readiness, Slow-Load & Offline Recovery',
      'Metadata vs playability tracked distinctly; 7s slow prompt, offline position/series preservation, and max-3 exponential backoff enforced',
      SLOW_LOAD_TIMEOUT_MS === 7000 &&
        MAX_AUTO_RETRIES === 3 &&
        sMeta.hasMetadata === true &&
        sMeta.isPlayable === false &&
        sSlow.phase === 'slow' &&
        sOffline.phase === 'offline' &&
        sOffline.context.lastPositionSeconds === 42 &&
        sOffline.context.seriesId === 's-1' &&
        sOffline.context.partNumber === 2 &&
        sOnline.phase === 'buffering' &&
        sReady.phase === 'ready' &&
        sReady.isPlayable === true &&
        delays.join(',') === '1000,2000,4000' &&
        sRetry.retryCount === MAX_AUTO_RETRIES &&
        sErr.phase === 'error' &&
        uiHasPrompts,
      `slowTimeout=${SLOW_LOAD_TIMEOUT_MS}, sMetaReady=${sMeta.isPlayable}, sSlow=${sSlow.phase}, offlinePos=${sOffline.context.lastPositionSeconds}, delays=${delays.join(',')}, cappedRetries=${sRetry.retryCount}, uiPrompts=${uiHasPrompts}`
    );
  }

  // 5. TABS-TRENDING-EMPTY
  {
    const reelsHasTabs =
      reelsViewCode.includes('reels-tab-following') &&
      reelsViewCode.includes("setFeedFilter('forYou')") &&
      reelsViewCode.includes('reels-tab-discover') &&
      reelsViewCode.includes('reels-tab-trending');

    const noArbitrary500Gate =
      !communityFeedCode.includes('likesCount >= 500') &&
      !communityFeedCode.includes('likesCount > 500') &&
      !reelsViewCode.includes('likesCount >= 500') &&
      !reelsViewCode.includes('likesCount > 500');

    const reelsHonestEmpty =
      reelsViewCode.includes("You're not following anyone yet") &&
      reelsViewCode.includes('No Reels from followed creators yet') &&
      reelsViewCode.includes('realCreatorSuggestions');

    const feedHonestEmpty =
      communityFeedCode.includes('You are not following any creators yet') &&
      communityFeedCode.includes('No posts from followed creators yet') &&
      communityFeedCode.includes('suggestedCreators');

    assert(
      'TABS-TRENDING-EMPTY',
      'Reels Tabs, Genuine Trending & Honest Empty States',
      'Following/For You/Discover/Trending supported without fake 500-like gate, distinguishing 0-follows vs empty followed feed with real suggestions',
      reelsHasTabs && noArbitrary500Gate && reelsHonestEmpty && feedHonestEmpty,
      `reelsHasTabs=${reelsHasTabs}, noArbitrary500Gate=${noArbitrary500Gate}, reelsHonestEmpty=${reelsHonestEmpty}, feedHonestEmpty=${feedHonestEmpty}`
    );
  }

  // 6. MOBILE-SPACING-OVERFLOW
  {
    const feedTightSpacing =
      communityFeedCode.includes('py-3 sm:py-5 space-y-3 sm:space-y-4') &&
      communityFeedCode.includes('flex-wrap items-center justify-between gap-2');
    const headerMinW = headerCode.includes('gap-2 min-w-0') && headerCode.includes('px-3 sm:px-4');
    const profileMinW = profileViewCode.includes('px-3 sm:px-4') && profileViewCode.includes('min-w-0');
    const postCardMinW = postCardCode.includes('flex-1 min-w-0 bg-white border');

    assert(
      'MOBILE-SPACING-OVERFLOW',
      'Mobile Feed Spacing & Overflow Fixes',
      'Mobile post stream uses 12-16px spacing (space-y-3 sm:space-y-4), wrapping filters bar, and min-w-0 flex safety across Header/Profile/PostCard',
      feedTightSpacing && headerMinW && profileMinW && postCardMinW,
      `feedTightSpacing=${feedTightSpacing}, headerMinW=${headerMinW}, profileMinW=${profileMinW}, postCardMinW=${postCardMinW}`
    );
  }

  // 7. PROTECTED-HASH
  {
    const expectedHashes: Record<string, string> = {
      'server.ts': '2e95338cb66613db54f5137f961b3acca9b8735b1f83bcf8322fd6adaaa84f01',
      'services/v2RewardEngine.ts': '7258cb342e153fb5bb6cf401db84014d6108b0ecc2fa4c3c8752064f12a5ba7a',
      'services/v2IntegrationAdapter.ts': '5759a7225efb119f6bac2d2e8ce49ae7b5562def4fb0c36acefc897ae26aa1cb',
      'tests/v2Phase10IntegrationVerification.ts': '9e2eb1be31cc973e2f3d112547b4ffd9d94064409f1a57c28f0055c4ac9abac8',
    };
    let allMatch = true;
    const mismatches: string[] = [];
    for (const [file, expected] of Object.entries(expectedHashes)) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (actual !== expected) {
        allMatch = false;
        mismatches.push(file);
      }
    }
    assert(
      'PROTECTED-HASH',
      'Protected Phase 10 & Server Integrity',
      'Protected backend and Phase 10 files match pre-edit SHA-256 checksums identically',
      allMatch,
      allMatch ? 'ALL_MATCH' : `MISMATCH: ${mismatches.join(', ')}`
    );
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  return { total: results.length, passed, failed, results };
}

if (
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1]?.includes('reelsNavigationSeriesRecoveryVerification')
) {
  console.log('--- METFA SOCIAL: REELS NAVIGATION, SERIES, READINESS & UX VERIFICATION ---');
  runReelsNavigationSeriesRecoveryVerification().then((res) => {
    res.results.forEach((r) => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} [${r.testId}] ${r.category} - ${r.description}`);
      console.log(`   Status: ${r.status} | Evidence: ${r.evidence}`);
    });
    console.log(`\nTOTAL: ${res.total} | PASSED: ${res.passed} | FAILED: ${res.failed}`);
    if (res.failed > 0) process.exit(1);
  });
}
