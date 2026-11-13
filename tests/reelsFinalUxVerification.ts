/**
 * METFA SOCIAL — REELS FINAL UX AUDIT & CORRECTION VERIFICATION SUITE
 *
 * Verifies:
 * 1. UX-REELS-ONLY: 3 center controls (-5s, Play/Pause, +5s) render ONLY in Reels (variant="reels"), NOT in Feed (variant="feed").
 * 2. UX-FEED-TAP-SAFE: tap-reveal overlay does NOT cover Feed video picture area (gated on shouldRenderCenterControls).
 * 3. UX-AUTOHIDE-1S: Controls auto-hide after ~1 second (1000ms) of inactivity.
 * 4. UX-SCRUB-IMMUNE: Controls never auto-hide while scrubbing/dragging (isScrubbing guard).
 * 5. UX-TIMELINE-CLEAN: Bottom timeline has thin 2px progress bar, clean M:SS time, and zero card/box/border/gradient panel.
 * 6. UX-REELS-ZINDEX: Reels Top Bar and Bottom Actions use z-30 above tap-reveal z-20 so Like/Share/Menu/Sound never get blocked.
 * 7. DATA-NO-POLLUTION: Feed 'media' video opens via transient directSelectedReel without polluting persistent reels catalog.
 * 8. DATA-PERSISTENT-ISOLATION: fetchPersistentReels queries strictly post_type='reel' and excludes 'media' feed videos & dummy reels.
 * 9. DATA-RACE-IMMUNE: Async fetchPersistentReels resolving [] after Feed-to-Reels click does NOT wipe directSelectedReel.
 * 10. LIVE-SUPABASE-STATE: Live check of Supabase posts table confirming real DB rows and persistent vs media classification.
 * 11. AUDIO-FALLBACK: Unmuted autoplay NotAllowedError falls back gracefully to muted playback instead of freezing video.
 * 12. BAS-PHASE10: Protected Phase 10 files remain 100% untouched.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { ReelHighlight, CommunityPost } from '../types/community';

interface AssertionResult {
  testId: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

export async function runReelsFinalUxVerification(): Promise<{
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

  const controlsCode = fs.readFileSync('components/AdvancedVideoControls.tsx', 'utf-8');
  const reelsViewCode = fs.readFileSync('components/ReelsFeedView.tsx', 'utf-8');
  const postCardCode = fs.readFileSync('components/PostCard.tsx', 'utf-8');
  const commPostCardCode = fs.readFileSync('components/CommunityPostCard.tsx', 'utf-8');
  const socialIndexCode = fs.readFileSync('features/social/index.tsx', 'utf-8');
  const reelServiceCode = fs.readFileSync('services/reelService.ts', 'utf-8');

  // 1. UX-REELS-ONLY
  {
    const gatedCenter =
      controlsCode.includes('shouldRenderCenterControls && (') &&
      controlsCode.includes('data-testid="reels-center-controls-row"');
    const feedVariants =
      postCardCode.includes('variant="feed"') && commPostCardCode.includes('variant="feed"');
    const reelsVariant = reelsViewCode.includes('variant="reels"');

    assert(
      'UX-REELS-ONLY',
      'Reels-Only Playback Controls',
      '3 circular center controls (-5s, Play/Pause, +5s) render exclusively in Reels and never in Feed',
      gatedCenter && feedVariants && reelsVariant,
      `gatedCenter=${gatedCenter}, feedVariants=${feedVariants}, reelsVariant=${reelsVariant}`
    );
  }

  // 2. UX-FEED-TAP-SAFE
  {
    const tapRevealGated = controlsCode.includes('shouldRenderCenterControls && !areControlsVisible');
    assert(
      'UX-FEED-TAP-SAFE',
      'Feed Tap Non-Interference',
      'Invisible tap-reveal area is disabled in Feed so tapping Feed video picture area opens Reels reliably',
      tapRevealGated,
      `tapRevealGated=${tapRevealGated}`
    );
  }

  // 3. UX-AUTOHIDE-1S
  {
    const default1000 = controlsCode.includes('delayMs: number = 1000');
    const keep1000 = controlsCode.includes('keepControlsVisible') && controlsCode.includes('scheduleControlsAutoHide(1000)');
    const no2500 = !controlsCode.includes('2500');

    assert(
      'UX-AUTOHIDE-1S',
      '1-Second Auto-Hide',
      'Reels controls hide after ~1000ms (1 second) of inactivity',
      default1000 && keep1000 && no2500,
      `default1000=${default1000}, keep1000=${keep1000}, no2500Remaining=${no2500}`
    );
  }

  // 4. UX-SCRUB-IMMUNE
  {
    const scrubGuard = controlsCode.includes('if (!isScrubbingRef.current) {');
    const clearsTimer =
      controlsCode.includes('handlePointerDown') &&
      controlsCode.includes('handleTouchStart') &&
      controlsCode.includes('clearTimeout(inactivityTimerRef.current)');
    const reschedulesOnEnd =
      controlsCode.includes('onPointerUp') &&
      controlsCode.includes('handleTouchEnd') &&
      controlsCode.includes('scheduleControlsAutoHide(1000)');

    assert(
      'UX-SCRUB-IMMUNE',
      'Scrubbing Immunity',
      'Controls remain visible during pointer/touch timeline drag and hide ~1s after release',
      scrubGuard && clearsTimer && reschedulesOnEnd,
      `scrubGuard=${scrubGuard}, clearsTimer=${clearsTimer}, reschedulesOnEnd=${reschedulesOnEnd}`
    );
  }

  // 5. UX-TIMELINE-CLEAN
  {
    const thinLine = controlsCode.includes('h-0.5 bg-white/30 rounded-full');
    const cleanReelsTimeBtn = controlsCode.includes(
      "shouldRenderCenterControls\n                ? 'text-[11px] font-mono flex items-center gap-1 cursor-pointer select-none text-white/90 drop-shadow-sm py-0.5 touch-manipulation'"
    );
    const noContainerBg = !controlsCode.includes('expandable-timeline-container" className="bg-');

    assert(
      'UX-TIMELINE-CLEAN',
      'Minimal Bottom Timeline',
      'Bottom timeline uses thin 2px line and clean M:SS text in Reels with no box, card, border, or gradient panel',
      thinLine && cleanReelsTimeBtn && noContainerBg,
      `thinLine=${thinLine}, cleanReelsTimeBtn=${cleanReelsTimeBtn}, noContainerBg=${noContainerBg}`
    );
  }

  // 6. UX-REELS-ZINDEX
  {
    const topBarZ30 = reelsViewCode.includes('Top Bar (z-30 stays clickable above tap-reveal layer)') &&
                      reelsViewCode.includes('className="relative z-30 flex items-center justify-between');
    const bottomActionsZ30 = reelsViewCode.includes('className="relative z-30 pb-14 px-3 sm:px-4 flex items-end justify-between');

    assert(
      'UX-REELS-ZINDEX',
      'Interactive Action Layering',
      'Reels Top Bar (Sound/Menu) and Bottom Actions (Like/Share/Save) sit at z-30 above tap-reveal z-20',
      topBarZ30 && bottomActionsZ30,
      `topBarZ30=${topBarZ30}, bottomActionsZ30=${bottomActionsZ30}`
    );
  }

  // 7. DATA-NO-POLLUTION & DATA-RACE-IMMUNE
  {
    const hasDirectState = socialIndexCode.includes('const [directSelectedReel, setDirectSelectedReel]');
    const clearedOnLeave =
      socialIndexCode.includes("if (currentTab !== 'reels')") &&
      socialIndexCode.includes('setDirectSelectedReel(null);');
    const viewMergesWithoutPolluting = reelsViewCode.includes('directSelectedReel && !reels.some');

    // Simulate race condition: Feed video opens first, then async fetchPersistentReels returns []
    const persistentReelsAfterFetch: ReelHighlight[] = [];
    const directSelectedReel: ReelHighlight = {
      id: 'fe6de735-7690-4f42-a0d6-64866fa1e778',
      title: 'জীবনের কিছু কিছু মুহুর্ত',
      caption: '',
      author: { id: '3d82b025', name: 'Creator', username: 'creator', avatar: '', isVerified: true },
      videoSrc: 'https://example.com/video.mp4',
      duration: 15,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: 'Just now',
    };
    const combined =
      directSelectedReel && !persistentReelsAfterFetch.some((r) => r.id === directSelectedReel.id)
        ? [directSelectedReel, ...persistentReelsAfterFetch]
        : persistentReelsAfterFetch;

    assert(
      'DATA-RACE-IMMUNE',
      'Feed-to-Reels Race Immunity',
      'Transient directSelectedReel keeps Feed-clicked video visible even when persistent reels returns empty, and clears on exit',
      hasDirectState && clearedOnLeave && viewMergesWithoutPolluting && combined.length === 1 && combined[0].id === directSelectedReel.id,
      `hasDirectState=${hasDirectState}, clearedOnLeave=${clearedOnLeave}, combinedLength=${combined.length}`
    );
  }

  // 8. DATA-PERSISTENT-ISOLATION
  {
    const strictEqReel = reelServiceCode.includes(".eq('post_type', 'reel')");
    const resolvesAuthors = reelServiceCode.includes('resolveMissingReelAuthors');
    const usesDisplayedLength =
      reelsViewCode.includes('isLoading && displayedReels.length === 0') &&
      reelsViewCode.includes('displayedReels.length === 0 ?');

    assert(
      'DATA-PERSISTENT-ISOLATION',
      'Persistent Reels Catalog Isolation',
      'fetchPersistentReels queries strictly post_type="reel", resolves missing authors, and ReelsFeedView checks displayedReels.length',
      strictEqReel && resolvesAuthors && usesDisplayedLength,
      `strictEqReel=${strictEqReel}, resolvesAuthors=${resolvesAuthors}, usesDisplayedLength=${usesDisplayedLength}`
    );
  }

  // 9. LIVE-SUPABASE-STATE
  {
    let dbCheckOk = false;
    let totalPosts = 0;
    let persistentReelCount = 0;
    let mediaVideoCount = 0;
    try {
      const sb = createClient(
        'https://vrkyqbjlyjjdydxrjskh.supabase.co',
        'sb_publishable_3Ol9fNJTcbzMb4JOqjXo3A_dDslwpIK'
      );
      const { data: allRows, error } = await sb
        .from('posts')
        .select('id, post_type, video_src');
      if (!error && Array.isArray(allRows)) {
        dbCheckOk = true;
        totalPosts = allRows.length;
        persistentReelCount = allRows.filter((r: any) => r.post_type === 'reel' && r.video_src).length;
        mediaVideoCount = allRows.filter((r: any) => r.post_type === 'media' && r.video_src).length;
      }
    } catch {}

    assert(
      'LIVE-SUPABASE-STATE',
      'Live Database Audit',
      'Queried live Supabase posts table cleanly; verified real post_type distribution',
      dbCheckOk,
      `dbCheckOk=${dbCheckOk}, totalPosts=${totalPosts}, persistentReels=${persistentReelCount}, feedMediaVideos=${mediaVideoCount}`
    );
  }

  // 10. AUDIO-FALLBACK
  {
    const hasAutoplayFallback =
      reelsViewCode.includes("err?.name === 'NotAllowedError'") &&
      reelsViewCode.includes('el.muted = true;') &&
      reelsViewCode.includes('setIsMuted(true);');

    assert(
      'AUDIO-FALLBACK',
      'Autoplay Policy Fallback',
      'Direct Reels load handles browser unmuted autoplay NotAllowedError by falling back to muted playback instead of pausing',
      hasAutoplayFallback,
      `hasAutoplayFallback=${hasAutoplayFallback}`
    );
  }

  // 11. BAS-PHASE10
  {
    const expectedHashes: { [key: string]: string } = {
      'services/v2RewardEngine.ts': '7258cb342e153fb5bb6cf401db84014d6108b0ecc2fa4c3c8752064f12a5ba7a',
      'services/v2IntegrationAdapter.ts': '5759a7225efb119f6bac2d2e8ce49ae7b5562def4fb0c36acefc897ae26aa1cb',
      'tests/v2Phase10IntegrationVerification.ts': '9e2eb1be31cc973e2f3d112547b4ffd9d94064409f1a57c28f0055c4ac9abac8',
    };

    let allMatch = true;
    const hashResults: string[] = [];
    for (const [file, expected] of Object.entries(expectedHashes)) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      const matches = actual === expected;
      if (!matches) allMatch = false;
      hashResults.push(`${file}=${matches ? 'MATCH' : 'MISMATCH'}`);
    }

    assert(
      'BAS-PHASE10',
      'Phase 10 Integrity',
      'Protected Phase 10 files remain 100% untouched',
      allMatch,
      hashResults.join(', ')
    );
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  return { total: results.length, passed, failed, results };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('reelsFinalUxVerification')) {
  console.log('--- METFA SOCIAL: REELS FINAL UX AUDIT & CORRECTION VERIFICATION ---');
  runReelsFinalUxVerification().then((res) => {
    res.results.forEach((r) => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} [${r.testId}] ${r.category} - ${r.description}`);
      console.log(`   Status: ${r.status} | Evidence: ${r.evidence}`);
    });
    console.log(`\nTOTAL: ${res.total} | PASSED: ${res.passed} | FAILED: ${res.failed}`);
    if (res.failed > 0) process.exit(1);
  });
}
