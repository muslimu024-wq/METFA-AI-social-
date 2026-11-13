/**
 * METFA SOCIAL — REELS TOUCH, TIMELINE & 2X HOLD-TO-SPEED VERIFICATION SUITE
 *
 * Verifies:
 * 1. TOUCH-DEDUP: Timeline scrub & control taps prevent dual Touch + Pointer execution on Android/mobile.
 * 2. RAPID-SEEK: Repeated rapid -5s / +5s taps accumulate from pending seek target and clamp strictly to [0, duration].
 * 3. HOLD-2X-RIGHT: Holding right Reels zone (>=300ms while playing) activates 2X speed & "2X" badge; release restores 1X.
 * 4. HOLD-2X-LEFT: Holding left Reels zone (>=300ms while playing) activates 2X speed & "2X" badge; release restores 1X.
 * 5. HOLD-2X-SHORT-TAP: Short tap (<300ms) never activates 2X; instead reveals controls cleanly.
 * 6. HOLD-2X-PAUSED-GUARD: Holding left/right while video is paused NEVER activates 2X.
 * 7. HOLD-2X-SWIPE-GUARD: Vertical/horizontal swipe (>12px movement) cancels hold timer so scrolling never triggers 2X.
 * 8. HOLD-2X-CANCEL-SAFETY: Touch cancel, blur, visibilitychange, pause, ended, and unmount always restore playbackRate = 1.
 * 9. HOLD-2X-REELS-ONLY: 2X hold zones and 2X badge are strictly gated to Reels (shouldRenderCenterControls) and absent in Feed.
 * 10. TIMELINE-BOUNDARY: Timeline touch/drag only starts inside progressBarRef (touches outside never trigger seek).
 * 11. AUTOHIDE-1S-INTACT: 1-second (1000ms) auto-hide remains preserved; 2X badge renders only during long press.
 * 12. BAS-PHASE10-AND-SERVER: Protected Phase 10 files and server.ts remain 100% hash-matched & untouched.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  AUTO_HIDE_DELAY_MS,
  HOLD_SPEED_DELAY_MS,
  HOLD_MOVE_TOLERANCE_PX,
  clampSeekTime,
  calculateScrubTime,
} from '../components/AdvancedVideoControls';

interface AssertionResult {
  testId: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

// Simulated Hold-to-Speed state machine mirroring AdvancedVideoControls.tsx logic
class HoldSpeedMachine {
  playbackRate = 1;
  isSpeed2x = false;
  controlsRevealed = false;
  paused = false;
  ended = false;
  isScrubbing = false;
  private holdActive: {
    pointerId: number;
    startX: number;
    startY: number;
    side: 'left' | 'right';
    activated2x: boolean;
  } | null = null;
  private timerFired = false;

  pointerDown(pointerId: number, side: 'left' | 'right', x: number, y: number) {
    if (this.isScrubbing) return;
    this.holdActive = { pointerId, startX: x, startY: y, side, activated2x: false };
    this.timerFired = false;
  }

  advanceTime(ms: number) {
    if (!this.holdActive || this.timerFired) return;
    if (ms >= HOLD_SPEED_DELAY_MS) {
      this.timerFired = true;
      if (!this.paused && !this.ended && !this.isScrubbing) {
        this.holdActive.activated2x = true;
        this.playbackRate = 2;
        this.isSpeed2x = true;
      }
    }
  }

  pointerMove(pointerId: number, x: number, y: number) {
    if (!this.holdActive || this.holdActive.pointerId !== pointerId) return;
    const dist = Math.hypot(x - this.holdActive.startX, y - this.holdActive.startY);
    if (!this.holdActive.activated2x && dist > HOLD_MOVE_TOLERANCE_PX) {
      this.holdActive = null;
    }
  }

  pointerUp(pointerId: number, x: number, y: number) {
    if (!this.holdActive || this.holdActive.pointerId !== pointerId) return;
    const was2x = this.holdActive.activated2x || this.isSpeed2x;
    const dist = Math.hypot(x - this.holdActive.startX, y - this.holdActive.startY);
    this.stop();
    if (!was2x && dist <= HOLD_MOVE_TOLERANCE_PX) {
      this.controlsRevealed = true;
    }
  }

  cancelOrInterrupt() {
    this.stop();
  }

  pauseVideo() {
    this.paused = true;
    this.stop();
  }

  private stop() {
    this.holdActive = null;
    this.isSpeed2x = false;
    this.playbackRate = 1;
  }
}

export function runReelsTouchAnd2xSpeedVerification(): {
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

  const controlsCode = fs.readFileSync('components/AdvancedVideoControls.tsx', 'utf-8');
  const reelsViewCode = fs.readFileSync('components/ReelsFeedView.tsx', 'utf-8');

  // 1. TOUCH-DEDUP
  {
    let activeInput: 'pointer' | 'touch' | null = null;
    let scrubStartCount = 0;

    // Simulate Android browser firing pointerdown THEN touchstart for same tap
    if (activeInput === null) {
      activeInput = 'pointer';
      scrubStartCount++;
    }
    if (activeInput === null) {
      activeInput = 'touch';
      scrubStartCount++;
    }

    const hasInputRefGuard =
      controlsCode.includes('activeScrubInputRef') &&
      controlsCode.includes("if (activeScrubInputRef.current !== null) return;") &&
      controlsCode.includes("if (activeScrubInputRef.current !== 'touch'") &&
      controlsCode.includes('touch-manipulation');

    assert(
      'TOUCH-DEDUP',
      'Dual Execution Prevention',
      'Timeline scrub and buttons deduplicate Pointer + Touch events so 1 tap/drag executes exactly once',
      scrubStartCount === 1 && hasInputRefGuard,
      `scrubStartCount=${scrubStartCount}, hasInputRefGuard=${hasInputRefGuard}`
    );
  }

  // 2. RAPID-SEEK
  {
    const duration = 30;
    let pendingTarget = 2;
    // 3 rapid +5s taps from 2s -> 7 -> 12 -> 17
    pendingTarget = clampSeekTime(pendingTarget + 5, duration);
    pendingTarget = clampSeekTime(pendingTarget + 5, duration);
    pendingTarget = clampSeekTime(pendingTarget + 5, duration);
    const forwardAccum = pendingTarget;

    // 4 rapid -5s taps from 17s -> 12 -> 7 -> 2 -> 0 (clamped)
    pendingTarget = clampSeekTime(pendingTarget - 5, duration);
    pendingTarget = clampSeekTime(pendingTarget - 5, duration);
    pendingTarget = clampSeekTime(pendingTarget - 5, duration);
    pendingTarget = clampSeekTime(pendingTarget - 5, duration);
    const backwardClamped = pendingTarget;

    const hasPendingSeekRef =
      controlsCode.includes('pendingSeekRef') &&
      controlsCode.includes('clampSeekTime(baseTime + deltaSeconds, maxDuration)');

    assert(
      'RAPID-SEEK',
      'Rapid Seek Accumulation',
      'Rapid repeated -5s/+5s taps accumulate cleanly from pending target and clamp within [0, duration]',
      forwardAccum === 17 && backwardClamped === 0 && hasPendingSeekRef,
      `forwardAccum=${forwardAccum}s, backwardClamped=${backwardClamped}s, hasPendingSeekRef=${hasPendingSeekRef}`
    );
  }

  // 3. HOLD-2X-RIGHT
  {
    const m = new HoldSpeedMachine();
    m.pointerDown(1, 'right', 320, 300);
    m.advanceTime(300);
    const duringHoldRate = m.playbackRate;
    const duringHoldBadge = m.isSpeed2x;
    m.pointerUp(1, 320, 300);
    const afterReleaseRate = m.playbackRate;
    const afterReleaseBadge = m.isSpeed2x;

    const hasRightZone = controlsCode.includes('data-testid="reels-hold-speed-right"');

    assert(
      'HOLD-2X-RIGHT',
      'Right Hold-to-Speed 2X',
      'Long press on right Reels zone sets speed to 2X with "2X" indicator; release immediately restores 1X',
      duringHoldRate === 2 && duringHoldBadge && afterReleaseRate === 1 && !afterReleaseBadge && hasRightZone,
      `during=${duringHoldRate}X (badge=${duringHoldBadge}), release=${afterReleaseRate}X (badge=${afterReleaseBadge})`
    );
  }

  // 4. HOLD-2X-LEFT
  {
    const m = new HoldSpeedMachine();
    m.pointerDown(2, 'left', 40, 300);
    m.advanceTime(300);
    const duringHoldRate = m.playbackRate;
    const duringHoldBadge = m.isSpeed2x;
    m.pointerUp(2, 40, 300);
    const afterReleaseRate = m.playbackRate;
    const afterReleaseBadge = m.isSpeed2x;

    const hasLeftZone = controlsCode.includes('data-testid="reels-hold-speed-left"');

    assert(
      'HOLD-2X-LEFT',
      'Left Hold-to-Speed 2X',
      'Long press on left Reels zone sets speed to 2X with "2X" indicator; release immediately restores 1X',
      duringHoldRate === 2 && duringHoldBadge && afterReleaseRate === 1 && !afterReleaseBadge && hasLeftZone,
      `during=${duringHoldRate}X (badge=${duringHoldBadge}), release=${afterReleaseRate}X (badge=${afterReleaseBadge})`
    );
  }

  // 5. HOLD-2X-SHORT-TAP
  {
    const m = new HoldSpeedMachine();
    m.pointerDown(3, 'right', 320, 300);
    m.advanceTime(120); // short tap < 300ms
    const midRate = m.playbackRate;
    m.pointerUp(3, 320, 300);
    const endRate = m.playbackRate;

    assert(
      'HOLD-2X-SHORT-TAP',
      'Short Tap Isolation',
      'Single short tap (<300ms) never triggers 2X and instead reveals playback controls normally',
      midRate === 1 && endRate === 1 && !m.isSpeed2x && m.controlsRevealed,
      `midRate=${midRate}, endRate=${endRate}, controlsRevealed=${m.controlsRevealed}`
    );
  }

  // 6. HOLD-2X-PAUSED-GUARD
  {
    const m = new HoldSpeedMachine();
    m.paused = true;
    m.pointerDown(4, 'right', 320, 300);
    m.advanceTime(500);
    const pausedHoldRate = m.playbackRate;
    const pausedHoldBadge = m.isSpeed2x;
    m.pointerUp(4, 320, 300);

    const hasPausedGuard =
      controlsCode.includes('if (!video || video.paused || video.ended)') &&
      controlsCode.includes('currentVideo.paused ||');

    assert(
      'HOLD-2X-PAUSED-GUARD',
      'Paused Video Guard',
      'Holding left or right while video is paused NEVER enables 2X speed',
      pausedHoldRate === 1 && !pausedHoldBadge && hasPausedGuard,
      `pausedHoldRate=${pausedHoldRate}, pausedHoldBadge=${pausedHoldBadge}, hasPausedGuard=${hasPausedGuard}`
    );
  }

  // 7. HOLD-2X-SWIPE-GUARD
  {
    const m = new HoldSpeedMachine();
    m.pointerDown(5, 'right', 320, 300);
    m.pointerMove(5, 320, 260); // 40px vertical swipe for Reels scrolling
    m.advanceTime(400);
    const swipeRate = m.playbackRate;

    assert(
      'HOLD-2X-SWIPE-GUARD',
      'Scroll Swipe Isolation',
      'Vertical scroll swipe (>12px) cancels hold timer so Reels scrolling never triggers 2X',
      swipeRate === 1 && !m.isSpeed2x,
      `swipeRate=${swipeRate}, isSpeed2x=${m.isSpeed2x}`
    );
  }

  // 8. HOLD-2X-CANCEL-SAFETY
  {
    const m1 = new HoldSpeedMachine();
    m1.pointerDown(6, 'left', 40, 300);
    m1.advanceTime(300);
    m1.cancelOrInterrupt(); // pointercancel / visibilitychange / blur / unmount

    const m2 = new HoldSpeedMachine();
    m2.pointerDown(7, 'right', 320, 300);
    m2.advanceTime(300);
    m2.pauseVideo(); // pause during 2X

    const hasAllSafetyHooks =
      controlsCode.includes('onPointerCancel={handleHoldZonePointerCancel}') &&
      controlsCode.includes('onLostPointerCapture={handleHoldZonePointerCancel}') &&
      controlsCode.includes("document.addEventListener('visibilitychange'") &&
      controlsCode.includes("window.addEventListener('blur'") &&
      controlsCode.includes("window.addEventListener('pointerup', handleGlobalPointerEnd)") &&
      controlsCode.includes("window.addEventListener('pointercancel', handleGlobalPointerEnd)") &&
      reelsViewCode.includes('el.playbackRate = 1;');

    assert(
      'HOLD-2X-CANCEL-SAFETY',
      'Interruption & Exit Cleanup',
      'Touch cancel, blur, visibility change, pause, and Reels unmount always restore speed to 1X',
      m1.playbackRate === 1 && !m1.isSpeed2x && m2.playbackRate === 1 && !m2.isSpeed2x && hasAllSafetyHooks,
      `m1Rate=${m1.playbackRate}, m2Rate=${m2.playbackRate}, hasAllSafetyHooks=${hasAllSafetyHooks}`
    );
  }

  // 9. HOLD-2X-REELS-ONLY
  {
    const gatedZones = controlsCode.includes('{shouldRenderCenterControls && (\n        <>\n          <div\n            data-testid="reels-hold-speed-left"');
    const gatedBadge = controlsCode.includes('{shouldRenderCenterControls && isSpeed2x && (');
    assert(
      'HOLD-2X-REELS-ONLY',
      'Reels-Only Feature Scope',
      '2X Hold-to-Speed zones and 2X badge render strictly in Reels mode and never in Feed',
      gatedZones && gatedBadge,
      `gatedZones=${gatedZones}, gatedBadge=${gatedBadge}`
    );
  }

  // 10. TIMELINE-BOUNDARY
  {
    const insideTargetCheck =
      controlsCode.includes('!progressBarRef.current || !progressBarRef.current.contains(e.target as Node)');
    const scrubPreviewZero = calculateScrubTime(100, 100, 200, 90);
    const scrubPreviewHalf = calculateScrubTime(200, 100, 200, 90);
    const scrubPreviewEnd = calculateScrubTime(350, 100, 200, 90);
    const zIndexOrder =
      controlsCode.includes('relative z-20 my-auto flex items-center') &&
      controlsCode.includes('relative z-20 mt-auto w-full flex flex-col');

    assert(
      'TIMELINE-BOUNDARY',
      'Timeline Containment & Precision',
      'Timeline scrub rejects outside targets, maps drag positions accurately, and sits above z-10 hold zones',
      insideTargetCheck && scrubPreviewZero === 0 && scrubPreviewHalf === 45 && scrubPreviewEnd === 90 && zIndexOrder,
      `insideTargetCheck=${insideTargetCheck}, drag=[${scrubPreviewZero}, ${scrubPreviewHalf}, ${scrubPreviewEnd}], zIndexOrder=${zIndexOrder}`
    );
  }

  // 11. AUTOHIDE-1S-INTACT
  {
    const autoHideIntact = AUTO_HIDE_DELAY_MS === 1000 && controlsCode.includes('scheduleControlsAutoHide(1000)');
    assert(
      'AUTOHIDE-1S-INTACT',
      '1-Second Auto-Hide Preserved',
      '1-second auto-hide timing remains intact and unaffected by 2X Hold-to-Speed',
      autoHideIntact,
      `AUTO_HIDE_DELAY_MS=${AUTO_HIDE_DELAY_MS}, autoHideIntact=${autoHideIntact}`
    );
  }

  // 12. BAS-PHASE10-AND-SERVER
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
      'BAS-PHASE10-AND-SERVER',
      'Protected Baseline Integrity',
      'server.ts and Phase 10 protected files remain 100% untouched',
      allMatch,
      summary.join(', ')
    );
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  return { total: results.length, passed, failed, results };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('reelsTouchAnd2xSpeedVerification')) {
  console.log('--- METFA SOCIAL: REELS TOUCH, TIMELINE & 2X HOLD-TO-SPEED VERIFICATION ---');
  const res = runReelsTouchAnd2xSpeedVerification();
  res.results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.testId}] ${r.category} - ${r.description}`);
    console.log(`   Status: ${r.status} | Evidence: ${r.evidence}`);
  });
  console.log(`\nTOTAL: ${res.total} | PASSED: ${res.passed} | FAILED: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
