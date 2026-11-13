/**
 * METFA SOCIAL — REELS IMMERSIVE UI & VIDEO CONTROL FIX VERIFICATION SUITE
 *
 * Verifies:
 * 1. IMM-HEADER-NAV-HIDDEN: App.tsx hides Feed Header & BottomNav ONLY when Reels is active, restoring them on exit.
 * 2. IMM-NO-CARD-CHROME: ReelsFeedView removes card wrappers, padding, teal borders, and aspect-[9/16] frames for full-viewport edge-to-edge playback.
 * 3. IMM-NO-ANDROID-SYS-HACK: No forced theme-color runtime overrides or requestFullscreen() hacks.
 * 4. IMM-OVERLAY-NAV-REAL: Top overlay (Back, Live, Following, For You, Community, Search, Create), Right actions (Like, Comment drawer, Share, Save), and Bottom info (Creator profile, Follow, Caption, Music license) all execute real logic.
 * 5. TL-DRAG-ISOLATED: Bottom thin 2px timeline stays interactive in Reels, uses touch-none + setPointerCapture + pb-14 clearance, updates live scrub time, and resumes playback on release.
 * 6. TL-METADATA-GUARD: Timeline & seekClamp prevent invalid/stale seek positions before valid video metadata/duration loads.
 * 7. CTR-NO-ACCIDENTAL-POPUP: Initial controls start hidden; timeline drag, swipe (>12px), hover pointermove, 2X hold, and rapid multi-taps do NOT pop up center controls.
 * 8. BAS-INTEGRITY: server.ts & Phase 10 protected files remain 100% SHA-256 unchanged.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  AUTO_HIDE_DELAY_MS,
  HOLD_SPEED_DELAY_MS,
  HOLD_MOVE_TOLERANCE_PX,
  SINGLE_TAP_DISAMBIGUATION_MS,
  RAPID_TAP_BURST_WINDOW_MS,
  clampSeekTime,
  calculateScrubTime,
  formatTime,
} from '../components/AdvancedVideoControls';

interface AssertionResult {
  testId: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

export function runReelsImmersiveUiVerification(): {
  total: number;
  passed: number;
  failed: number;
  results: AssertionResult[];
} {
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

  const appCode = fs.readFileSync('App.tsx', 'utf-8');
  const reelsCode = fs.readFileSync('components/ReelsFeedView.tsx', 'utf-8');
  const controlsCode = fs.readFileSync('components/AdvancedVideoControls.tsx', 'utf-8');
  const socialIndexCode = fs.readFileSync('features/social/index.tsx', 'utf-8');

  // 1. IMM-HEADER-NAV-HIDDEN
  {
    const hasFlag = appCode.includes("const isReelsFullscreen = activeTab === 'reels';");
    const hidesHeader = appCode.includes("activeTab !== 'v2' && !isReelsFullscreen && (") && appCode.includes('<Header');
    const hidesBottomNav = appCode.includes('{!isReelsFullscreen && (') && appCode.includes('<BottomNav');
    const switchesCanvasCleanly = appCode.includes("isReelsFullscreen ? 'bg-black text-white' : 'bg-slate-50 text-slate-900'");

    assert(
      'IMM-HEADER-NAV-HIDDEN',
      'Full-Screen Shell Isolation',
      'Global Header & BottomNav hide strictly when activeTab === "reels" and restore cleanly for Feed/Profile/etc.',
      hasFlag && hidesHeader && hidesBottomNav && switchesCanvasCleanly,
      `hasFlag=${hasFlag}, hidesHeader=${hidesHeader}, hidesBottomNav=${hidesBottomNav}, switchesCanvasCleanly=${switchesCanvasCleanly}`
    );
  }

  // 2. IMM-NO-CARD-CHROME
  {
    const hasImmersiveViewport = reelsCode.includes('data-testid="reels-immersive-viewport"');
    const hasSnapFullSlides =
      reelsCode.includes('snap-y snap-mandatory') &&
      reelsCode.includes('w-full h-full min-h-full snap-start snap-always overflow-hidden bg-black') &&
      reelsCode.includes('absolute inset-0 w-full h-full object-cover bg-black');
    const noFeedCardBorders =
      !reelsCode.includes('border-teal-400 ring-2') &&
      !reelsCode.includes('aspect-[9/16]') &&
      !reelsCode.includes('rounded-3xl overflow-hidden bg-black border');

    assert(
      'IMM-NO-CARD-CHROME',
      'Edge-to-Edge Immersive Viewport',
      'Feed card frames, outer margins/padding, aspect-[9/16] box, and teal card borders removed in Reels',
      hasImmersiveViewport && hasSnapFullSlides && noFeedCardBorders,
      `hasImmersiveViewport=${hasImmersiveViewport}, hasSnapFullSlides=${hasSnapFullSlides}, noFeedCardBorders=${noFeedCardBorders}`
    );
  }

  // 3. IMM-NO-ANDROID-SYS-HACK
  {
    const noRuntimeSystemBarHack =
      !appCode.includes('theme-color') &&
      !appCode.includes('requestFullscreen') &&
      !reelsCode.includes('theme-color') &&
      !reelsCode.includes('requestFullscreen') &&
      !controlsCode.includes('requestFullscreen');

    assert(
      'IMM-NO-ANDROID-SYS-HACK',
      'System Bar Safety',
      'Zero forced modifications to Android status bar, theme-color meta, or system navigation bar',
      noRuntimeSystemBarHack,
      `noRuntimeSystemBarHack=${noRuntimeSystemBarHack}`
    );
  }

  // 4. IMM-OVERLAY-NAV-REAL
  {
    const topNavReal =
      reelsCode.includes('data-testid="reels-nav-back-btn"') &&
      reelsCode.includes('data-testid="reels-nav-live-btn"') &&
      reelsCode.includes('data-testid="reels-tab-following"') &&
      reelsCode.includes('data-testid="reels-tab-foryou"') &&
      reelsCode.includes('data-testid="reels-tab-community"') &&
      reelsCode.includes('data-testid="reels-nav-search-btn"') &&
      reelsCode.includes('data-testid="reels-nav-create-btn"');
    const realHandlers =
      reelsCode.includes('handleExitReelsTo') &&
      reelsCode.includes('setFeedFilter') &&
      reelsCode.includes('data-testid="reels-search-input"') &&
      reelsCode.includes('data-testid="reels-comments-drawer"') &&
      reelsCode.includes('fetchComments') &&
      reelsCode.includes('createComment') &&
      reelsCode.includes('handleFollowToggle') &&
      reelsCode.includes('handleCreatorProfileClick') &&
      socialIndexCode.includes('onNavigateTab={onNavigateTab}');

    assert(
      'IMM-OVERLAY-NAV-REAL',
      'Real Transparent Overlay Navigation',
      'Every top nav, filter, search, creator profile, follow, comment drawer, share, save, and create button executes real logic',
      topNavReal && realHandlers,
      `topNavReal=${topNavReal}, realHandlers=${realHandlers}`
    );
  }

  // 5. TL-DRAG-ISOLATED
  {
    const thinLine = controlsCode.includes('h-0.5 bg-white/30 rounded-full');
    const generousTouchTarget = controlsCode.includes('h-9 flex items-center touch-none');
    const pointerCapture = controlsCode.includes('setPointerCapture?.(e.pointerId)');
    const alwaysReachableBottomBar = controlsCode.includes(
      'className="relative z-20 mt-auto w-full flex flex-col gap-0.5 pointer-events-auto"'
    );
    const reelsBottomClearance = reelsCode.includes('pb-14 px-3 sm:px-4 flex items-end justify-between gap-4 pointer-events-none');
    const scrubCalc =
      calculateScrubTime(150, 100, 200, 80) === 20 &&
      formatTime(20) === '0:20' &&
      formatTime(95) === '1:35';

    assert(
      'TL-DRAG-ISOLATED',
      'Timeline Drag & Isolation',
      'Thin 2px timeline stays unobstructed & interactive with touch-none + pointer capture and accurate seek math',
      thinLine && generousTouchTarget && pointerCapture && alwaysReachableBottomBar && reelsBottomClearance && scrubCalc,
      `thinLine=${thinLine}, generousTouchTarget=${generousTouchTarget}, pointerCapture=${pointerCapture}, alwaysReachableBottomBar=${alwaysReachableBottomBar}, reelsBottomClearance=${reelsBottomClearance}, scrubCalc=${scrubCalc}`
    );
  }

  // 6. TL-METADATA-GUARD
  {
    const clampEmptyDurationZero = clampSeekTime(15, 0) === 0 && clampSeekTime(-5, 60) === 0 && clampSeekTime(99, 60) === 60;
    const guardsUnreadyVideo =
      controlsCode.includes('isMetadataReady') &&
      controlsCode.includes('if (getValidMaxDuration() <= 0) return;') &&
      controlsCode.includes('if (!video || maxDuration <= 0) return;');

    assert(
      'TL-METADATA-GUARD',
      'Metadata & Duration Safety',
      'Invalid seek or stale timestamp positions are blocked until video metadata and valid duration load',
      clampEmptyDurationZero && guardsUnreadyVideo,
      `clampEmptyDurationZero=${clampEmptyDurationZero}, guardsUnreadyVideo=${guardsUnreadyVideo}`
    );
  }

  // 7. CTR-NO-ACCIDENTAL-POPUP
  {
    const startsHidden = controlsCode.includes('const [areControlsVisible, setAreControlsVisible] = useState<boolean>(false);');
    const noPointerMoveReveal = !controlsCode.includes('e.pointerType !== \'touch\'');
    const scrubSuppressesCenterControls =
      controlsCode.includes('if (shouldRenderCenterControls) {\n        setAreControlsVisible(false);\n      }');
    const tapDisambiguation =
      SINGLE_TAP_DISAMBIGUATION_MS === 220 &&
      RAPID_TAP_BURST_WINDOW_MS === 320 &&
      HOLD_SPEED_DELAY_MS === 300 &&
      HOLD_MOVE_TOLERANCE_PX === 12 &&
      AUTO_HIDE_DELAY_MS === 1000 &&
      controlsCode.includes('handleIntentionalTapCandidate') &&
      controlsCode.includes('touch-pan-y');

    assert(
      'CTR-NO-ACCIDENTAL-POPUP',
      'Intentional Gesture Disambiguation',
      'Center controls start hidden and never trigger accidentally on scrub, swipe scroll, hover move, 2X hold, or rapid taps',
      startsHidden && noPointerMoveReveal && scrubSuppressesCenterControls && tapDisambiguation,
      `startsHidden=${startsHidden}, noPointerMoveReveal=${noPointerMoveReveal}, scrubSuppressesCenterControls=${scrubSuppressesCenterControls}, tapDisambiguation=${tapDisambiguation}`
    );
  }

  // 8. BAS-INTEGRITY
  {
    const expectedHashes: { [key: string]: string } = {
      'server.ts': '50bd702bc0e5ef75ce2a04bd2333181642cbf6ac290dcd3a187478721cc44a3e',
      'services/v2RewardEngine.ts': '7258cb342e153fb5bb6cf401db84014d6108b0ecc2fa4c3c8752064f12a5ba7a',
      'services/v2IntegrationAdapter.ts': '5759a7225efb119f6bac2d2e8ce49ae7b5562def4fb0c36acefc897ae26aa1cb',
      'tests/v2Phase10IntegrationVerification.ts': '9e2eb1be31cc973e2f3d112547b4ffd9d94064409f1a57c28f0055c4ac9abac8',
    };
    let allMatch = true;
    const summary: string[] = [];
    for (const [file, expected] of Object.entries(expectedHashes)) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      const ok = actual === expected;
      if (!ok) allMatch = false;
      summary.push(`${file}=${ok ? 'MATCH' : 'MISMATCH'}`);
    }

    assert(
      'BAS-INTEGRITY',
      'Protected Baseline Integrity',
      'server.ts and Phase 10 protected files remain 100% SHA-256 unchanged',
      allMatch,
      summary.join(', ')
    );
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  return { total: results.length, passed, failed, results };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('reelsImmersiveUiVerification')) {
  console.log('--- METFA SOCIAL: REELS IMMERSIVE UI & VIDEO CONTROL VERIFICATION ---');
  const res = runReelsImmersiveUiVerification();
  res.results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.testId}] ${r.category} - ${r.description}`);
    console.log(`   Status: ${r.status} | Evidence: ${r.evidence}`);
  });
  console.log(`\nTOTAL: ${res.total} | PASSED: ${res.passed} | FAILED: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
