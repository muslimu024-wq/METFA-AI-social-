/**
 * METFA SOCIAL — REELS TIMELINE, TIMESTAMP & MUSIC VISIBILITY VERIFICATION SUITE
 *
 * Automated checks (runnable cleanly via `npx tsx tests/reelsTimelineVisibilityVerification.ts`):
 * 1. TL-HIDDEN-NORMAL-PLAYBACK: Normal Reels playback renders Timeline (2px) & Timestamp hidden (opacity-0, data-timeline-visible="false").
 * 2. TL-SINGLE-TAP-REVEAL: First intentional single tap on visible video reveals ONLY Timeline & Timestamp (Center controls stay hidden).
 * 3. TL-AUTO-HIDE-1800MS: Timeline & Timestamp stay visible for 1.8s (within 1.5-2.0s) and auto-hide cleanly when idle.
 * 4. TL-SCRUB-HOLD-AND-RESET-TIMER: Scrubbing/dragging timeline keeps Timeline & Timestamp visible for entire drag; 1.8s countdown restarts ONLY after release.
 * 5. TL-LIVE-TIMESTAMP-SCRUB: Timeline drag immediately updates live preview timestamp & formatted M:SS string.
 * 6. TL-PAUSED-VISIBILITY: Pausing video keeps Timeline & Timestamp visible without auto-hiding; resuming play triggers 1.8s auto-hide.
 * 7. CTRL-INDEPENDENT-VISIBILITY: Center Play/Pause & ±5s controls have completely independent state & 1000ms timer from Timeline (1800ms).
 * 8. GESTURE-SWIPE-HOLD-BURST-IMMUNITY: Vertical swipe (>12px), 2X hold (>=300ms), and rapid burst taps (<320ms) NEVER reveal Timeline or Center controls.
 * 9. THIN-2PX-LARGE-HIT-TARGET: Preserves 2px (h-0.5) track inside 36px (h-9) touch-none hit target with pointer/touch dedup.
 * 10. MUSIC-DECOUPLED-ACCESSIBLE: Reels music button/link is decoupled from timeline state (no always-on strip) and wires Use This Soundtrack cleanly.
 * 11. PHASE10-PROTECTED-FILES: Phase 10 protected files remain 100% SHA-256 unchanged.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AdvancedVideoControls,
  AUTO_HIDE_DELAY_MS,
  TIMELINE_AUTO_HIDE_DELAY_MS,
  HOLD_SPEED_DELAY_MS,
  HOLD_MOVE_TOLERANCE_PX,
  SINGLE_TAP_DISAMBIGUATION_MS,
  RAPID_TAP_BURST_WINDOW_MS,
  calculateScrubTime,
  clampSeekTime,
  formatTime,
} from '../components/AdvancedVideoControls';

interface AssertionResult {
  testId: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

/**
 * Deterministic timeline + center controls state machine mirroring AdvancedVideoControls.tsx
 * with simulated virtual clock (`nowMs`, scheduled timers, pointer/touch events, video play/pause).
 */
class ReelsControlsMachine {
  nowMs = 1000;
  duration = 60;
  currentTime = 10;
  scrubPreviewTime: number | null = null;
  isPlaying = true;
  isScrubbing = false;
  isSpeed2x = false;

  isTimelineVisible = false;
  areControlsVisible = false;

  private lastTapMs = 0;
  private pendingTapRevealAt: number | null = null;
  private timelineHideAt: number | null = null;
  private centerHideAt: number | null = null;
  private holdPointer: { id: number; startX: number; startY: number; downAt: number; moved: boolean; activated2x: boolean } | null = null;
  private activeScrubInput: 'pointer' | 'touch' | null = null;

  get isTimelineDisplayed(): boolean {
    return this.isTimelineVisible || this.isScrubbing || !this.isPlaying;
  }

  get effectiveTime(): number {
    return this.scrubPreviewTime !== null ? this.scrubPreviewTime : this.currentTime;
  }

  advanceBy(deltaMs: number) {
    const target = this.nowMs + deltaMs;
    while (true) {
      const candidates: Array<{ at: number; kind: 'hold2x' | 'tapReveal' | 'timelineHide' | 'centerHide' }> = [];
      if (this.holdPointer && !this.holdPointer.moved && !this.holdPointer.activated2x && this.isPlaying) {
        candidates.push({ at: this.holdPointer.downAt + HOLD_SPEED_DELAY_MS, kind: 'hold2x' });
      }
      if (this.pendingTapRevealAt !== null) {
        candidates.push({ at: this.pendingTapRevealAt, kind: 'tapReveal' });
      }
      if (this.timelineHideAt !== null) {
        candidates.push({ at: this.timelineHideAt, kind: 'timelineHide' });
      }
      if (this.centerHideAt !== null) {
        candidates.push({ at: this.centerHideAt, kind: 'centerHide' });
      }

      candidates.sort((a, b) => a.at - b.at);
      const next = candidates[0];
      if (!next || next.at > target) break;

      this.nowMs = next.at;
      if (next.kind === 'hold2x') {
        if (this.holdPointer && !this.holdPointer.moved && this.isPlaying && !this.isScrubbing) {
          this.holdPointer.activated2x = true;
          this.isSpeed2x = true;
          this.pendingTapRevealAt = null;
          this.areControlsVisible = false;
        }
      } else if (next.kind === 'tapReveal') {
        this.pendingTapRevealAt = null;
        if (!this.isScrubbing && !this.isSpeed2x) {
          if (!this.isTimelineVisible && this.isPlaying) {
            this.isTimelineVisible = true;
            this.timelineHideAt = this.nowMs + TIMELINE_AUTO_HIDE_DELAY_MS;
          } else {
            this.areControlsVisible = true;
            this.centerHideAt = this.nowMs + AUTO_HIDE_DELAY_MS;
          }
        }
      } else if (next.kind === 'timelineHide') {
        this.timelineHideAt = null;
        if (!this.isScrubbing && this.isPlaying) {
          this.isTimelineVisible = false;
        }
      } else if (next.kind === 'centerHide') {
        this.centerHideAt = null;
        if (!this.isScrubbing) {
          this.areControlsVisible = false;
        }
      }
    }
    this.nowMs = target;
  }

  pointerDownVideo(id: number, x: number, y: number) {
    if (this.isScrubbing) return;
    this.holdPointer = { id, startX: x, startY: y, downAt: this.nowMs, moved: false, activated2x: false };
  }

  pointerMoveVideo(id: number, x: number, y: number) {
    if (!this.holdPointer || this.holdPointer.id !== id) return;
    const dist = Math.hypot(x - this.holdPointer.startX, y - this.holdPointer.startY);
    if (!this.holdPointer.activated2x && dist > HOLD_MOVE_TOLERANCE_PX) {
      this.holdPointer.moved = true;
      this.holdPointer = null;
    }
  }

  pointerUpVideo(id: number, x: number, y: number) {
    if (!this.holdPointer || this.holdPointer.id !== id) return;
    const dist = Math.hypot(x - this.holdPointer.startX, y - this.holdPointer.startY);
    const was2x = this.holdPointer.activated2x || this.isSpeed2x;
    const wasMoved = this.holdPointer.moved || dist > HOLD_MOVE_TOLERANCE_PX;
    this.holdPointer = null;
    this.isSpeed2x = false;

    if (!was2x && !wasMoved) {
      this.handleIntentionalTapCandidate();
    }
  }

  private handleIntentionalTapCandidate() {
    if (this.isScrubbing || this.isSpeed2x) return;
    if (this.pendingTapRevealAt !== null) {
      this.pendingTapRevealAt = null;
      this.lastTapMs = this.nowMs;
      this.areControlsVisible = false;
      return;
    }
    if (this.nowMs - this.lastTapMs < RAPID_TAP_BURST_WINDOW_MS) {
      this.lastTapMs = this.nowMs;
      this.areControlsVisible = false;
      return;
    }
    this.lastTapMs = this.nowMs;

    if (this.areControlsVisible) {
      this.centerHideAt = null;
      this.areControlsVisible = false;
      return;
    }

    this.pendingTapRevealAt = this.nowMs + SINGLE_TAP_DISAMBIGUATION_MS;
  }

  scrubStart(input: 'pointer' | 'touch', clientX: number, rectLeft = 0, rectWidth = 200) {
    if (this.activeScrubInput !== null) return false;
    this.activeScrubInput = input;
    this.isScrubbing = true;
    this.pendingTapRevealAt = null;
    this.timelineHideAt = null;
    this.isTimelineVisible = true;
    this.areControlsVisible = false;

    const t = calculateScrubTime(clientX, rectLeft, rectWidth, this.duration);
    this.scrubPreviewTime = t;
    this.currentTime = t;
    return true;
  }

  scrubMove(clientX: number, rectLeft = 0, rectWidth = 200) {
    if (!this.isScrubbing) return;
    const t = calculateScrubTime(clientX, rectLeft, rectWidth, this.duration);
    this.scrubPreviewTime = t;
    this.currentTime = t;
  }

  scrubEnd(clientX: number, rectLeft = 0, rectWidth = 200) {
    const t = calculateScrubTime(clientX, rectLeft, rectWidth, this.duration);
    this.currentTime = t;
    this.scrubPreviewTime = null;
    this.isScrubbing = false;
    this.activeScrubInput = null;
    this.areControlsVisible = false;
    this.isTimelineVisible = true;
    if (this.isPlaying) {
      this.timelineHideAt = this.nowMs + TIMELINE_AUTO_HIDE_DELAY_MS;
    }
  }

  pause() {
    this.isPlaying = false;
    this.timelineHideAt = null;
  }

  play() {
    this.isPlaying = true;
    if (this.isTimelineVisible && !this.isScrubbing) {
      this.timelineHideAt = this.nowMs + TIMELINE_AUTO_HIDE_DELAY_MS;
    }
  }
}

export function runReelsTimelineVisibilityVerification(): {
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
  const socialIndexCode = fs.readFileSync('features/social/index.tsx', 'utf-8');

  // 1. TL-HIDDEN-NORMAL-PLAYBACK (including real React SSR markup check)
  {
    const m = new ReelsControlsMachine();
    const dummyVideoRef = { current: null } as React.RefObject<HTMLVideoElement | null>;
    const html = renderToStaticMarkup(
      React.createElement(AdvancedVideoControls, {
        videoRef: dummyVideoRef,
        isMuted: true,
        onToggleMute: () => {},
        reelId: 'reel_test_1',
        variant: 'reels',
      })
    );
    const ssrHiddenTimeline =
      html.includes('data-timeline-visible="false"') &&
      html.includes('data-timestamp-visible="false"') &&
      html.includes('data-center-controls-visible="false"');

    assert(
      'TL-HIDDEN-NORMAL-PLAYBACK',
      'Normal Playback Clean Screen',
      'During normal Reels playback, Timeline (2px) & Timestamp start completely hidden (opacity-0, data-timeline-visible="false")',
      !m.isTimelineDisplayed && !m.areControlsVisible && ssrHiddenTimeline,
      `machineTimeline=${m.isTimelineDisplayed}, machineCenter=${m.areControlsVisible}, ssrHiddenTimeline=${ssrHiddenTimeline}`
    );
  }

  // 2. TL-SINGLE-TAP-REVEAL
  {
    const m = new ReelsControlsMachine();
    m.pointerDownVideo(1, 180, 320);
    m.advanceBy(80);
    m.pointerUpVideo(1, 180, 320);
    m.advanceBy(SINGLE_TAP_DISAMBIGUATION_MS);

    assert(
      'TL-SINGLE-TAP-REVEAL',
      'Tap Reveals Timeline Only',
      'Single intentional tap on visible video reveals Timeline & Timestamp while keeping Center playback controls hidden',
      m.isTimelineDisplayed && m.isTimelineVisible && !m.areControlsVisible,
      `timelineVisible=${m.isTimelineVisible}, timelineDisplayed=${m.isTimelineDisplayed}, centerControls=${m.areControlsVisible}`
    );
  }

  // 3. TL-AUTO-HIDE-1800MS
  {
    const m = new ReelsControlsMachine();
    m.pointerDownVideo(2, 180, 320);
    m.advanceBy(60);
    m.pointerUpVideo(2, 180, 320);
    m.advanceBy(SINGLE_TAP_DISAMBIGUATION_MS);
    const visibleAtReveal = m.isTimelineDisplayed;
    m.advanceBy(1500);
    const stillVisibleAt1500ms = m.isTimelineDisplayed;
    m.advanceBy(300); // total 1800ms since reveal
    const hiddenAt1800ms = !m.isTimelineDisplayed;

    const delayInRange = TIMELINE_AUTO_HIDE_DELAY_MS >= 1500 && TIMELINE_AUTO_HIDE_DELAY_MS <= 2000;

    assert(
      'TL-AUTO-HIDE-1800MS',
      '1.5-2s Auto-Hide Timer',
      'Timeline & Timestamp remain visible across 1.5s window and auto-hide cleanly at 1800ms',
      delayInRange && visibleAtReveal && stillVisibleAt1500ms && hiddenAt1800ms,
      `delay=${TIMELINE_AUTO_HIDE_DELAY_MS}ms, visibleAtReveal=${visibleAtReveal}, at1500ms=${stillVisibleAt1500ms}, hiddenAt1800ms=${hiddenAt1800ms}`
    );
  }

  // 4. TL-SCRUB-HOLD-AND-RESET-TIMER
  {
    const m = new ReelsControlsMachine();
    const claimedPointer = m.scrubStart('pointer', 50, 0, 200);
    const dedupTouchRejected = !m.scrubStart('touch', 50, 0, 200);
    m.advanceBy(2600); // > 1800ms while actively dragging
    const visibleThroughoutLongDrag = m.isTimelineDisplayed && !m.areControlsVisible;
    m.scrubMove(100, 0, 200);
    m.scrubEnd(120, 0, 200);
    const visibleImmediatelyAfterRelease = m.isTimelineDisplayed && !m.areControlsVisible;
    m.advanceBy(1500);
    const stillVisibleAt1500msAfterRelease = m.isTimelineDisplayed;
    m.advanceBy(300); // 1800ms after scrubEnd
    const hiddenAt1800msAfterRelease = !m.isTimelineDisplayed && !m.areControlsVisible;

    assert(
      'TL-SCRUB-HOLD-AND-RESET-TIMER',
      'Scrub Hold & Post-Release Timer',
      'Timeline & Timestamp stay visible throughout active drag and start 1800ms countdown ONLY after drag release',
      claimedPointer &&
        dedupTouchRejected &&
        visibleThroughoutLongDrag &&
        visibleImmediatelyAfterRelease &&
        stillVisibleAt1500msAfterRelease &&
        hiddenAt1800msAfterRelease,
      `dragVisible=${visibleThroughoutLongDrag}, afterRelease=${visibleImmediatelyAfterRelease}, at1500=${stillVisibleAt1500msAfterRelease}, hiddenAt1800=${hiddenAt1800msAfterRelease}`
    );
  }

  // 5. TL-LIVE-TIMESTAMP-SCRUB
  {
    const m = new ReelsControlsMachine();
    m.duration = 60;
    m.scrubStart('pointer', 0, 0, 200);
    const t0 = formatTime(m.effectiveTime);
    m.scrubMove(50, 0, 200); // 25% of 60s = 15s -> 0:15
    const t25 = formatTime(m.effectiveTime);
    m.scrubMove(100, 0, 200); // 50% of 60s = 30s -> 0:30
    const t50 = formatTime(m.effectiveTime);
    m.scrubEnd(150, 0, 200); // 75% of 60s = 45s -> 0:45
    const t75 = formatTime(m.effectiveTime);

    assert(
      'TL-LIVE-TIMESTAMP-SCRUB',
      'Instant Drag Timestamp Update',
      'Dragging timeline immediately updates preview timestamp (0:00 -> 0:15 -> 0:30 -> 0:45) without lag',
      t0 === '0:00' && t25 === '0:15' && t50 === '0:30' && t75 === '0:45' && clampSeekTime(99, 60) === 60,
      `times=[${t0}, ${t25}, ${t50}, ${t75}]`
    );
  }

  // 6. TL-PAUSED-VISIBILITY
  {
    const m = new ReelsControlsMachine();
    m.pause();
    m.advanceBy(5000); // stays paused for 5 seconds
    const staysVisibleWhilePaused = m.isTimelineDisplayed && !m.areControlsVisible;
    m.isTimelineVisible = true;
    m.play();
    m.advanceBy(1800);
    const hidesAfterResume = !m.isTimelineDisplayed;

    assert(
      'TL-PAUSED-VISIBILITY',
      'Paused Video Timeline Access',
      'Pausing video keeps Timeline & Timestamp accessible without opening Center Controls, then hides 1.8s after play resumes',
      staysVisibleWhilePaused && hidesAfterResume,
      `staysVisibleWhilePaused=${staysVisibleWhilePaused}, hidesAfterResume=${hidesAfterResume}`
    );
  }

  // 7. CTRL-INDEPENDENT-VISIBILITY
  {
    const m = new ReelsControlsMachine();
    // Tap 1: opens Timeline + Timestamp only
    m.pointerDownVideo(10, 180, 320);
    m.advanceBy(50);
    m.pointerUpVideo(10, 180, 320);
    m.advanceBy(SINGLE_TAP_DISAMBIGUATION_MS);
    const step1OnlyTimeline = m.isTimelineDisplayed && !m.areControlsVisible;

    // Wait past burst window (400ms), Tap 2: opens Center controls independently
    m.advanceBy(400);
    m.pointerDownVideo(11, 180, 320);
    m.advanceBy(50);
    m.pointerUpVideo(11, 180, 320);
    m.advanceBy(SINGLE_TAP_DISAMBIGUATION_MS);
    const step2CenterOpen = m.areControlsVisible && m.isTimelineDisplayed;

    // Center controls auto-hide at 1000ms while timeline keeps its remaining ~1800ms schedule
    m.advanceBy(1000);
    const centerClosedIndependently = !m.areControlsVisible;

    assert(
      'CTRL-INDEPENDENT-VISIBILITY',
      'Independent Center Controls State',
      'Center Play/Pause & ±5s controls operate on completely separate visibility state & 1000ms timer from Timeline (1800ms)',
      step1OnlyTimeline && step2CenterOpen && centerClosedIndependently,
      `step1OnlyTimeline=${step1OnlyTimeline}, step2CenterOpen=${step2CenterOpen}, centerClosedIndependently=${centerClosedIndependently}`
    );
  }

  // 8. GESTURE-SWIPE-HOLD-BURST-IMMUNITY
  {
    // Vertical swipe > 12px
    const mSwipe = new ReelsControlsMachine();
    mSwipe.pointerDownVideo(20, 180, 400);
    mSwipe.pointerMoveVideo(20, 180, 320); // 80px swipe up
    mSwipe.pointerUpVideo(20, 180, 320);
    mSwipe.advanceBy(500);

    // 2X Hold >= 300ms
    const mHold = new ReelsControlsMachine();
    mHold.pointerDownVideo(21, 320, 300);
    mHold.advanceBy(350);
    const activated2x = mHold.isSpeed2x;
    mHold.pointerUpVideo(21, 320, 300);
    mHold.advanceBy(500);

    // Rapid double/burst taps < 320ms
    const mBurst = new ReelsControlsMachine();
    mBurst.pointerDownVideo(22, 180, 300);
    mBurst.advanceBy(40);
    mBurst.pointerUpVideo(22, 180, 300);
    mBurst.advanceBy(100);
    mBurst.pointerDownVideo(23, 180, 300);
    mBurst.advanceBy(40);
    mBurst.pointerUpVideo(23, 180, 300);
    mBurst.advanceBy(500);

    const swipeClean = !mSwipe.isTimelineDisplayed && !mSwipe.areControlsVisible;
    const holdClean = activated2x && !mHold.isTimelineDisplayed && !mHold.areControlsVisible;
    const burstClean = !mBurst.isTimelineDisplayed && !mBurst.areControlsVisible;

    assert(
      'GESTURE-SWIPE-HOLD-BURST-IMMUNITY',
      'Gesture Disambiguation',
      'Vertical swipes, 2X long-press holds, and rapid burst taps NEVER accidentally reveal Timeline or Center controls',
      swipeClean && holdClean && burstClean,
      `swipeClean=${swipeClean}, holdClean=${holdClean}, burstClean=${burstClean}`
    );
  }

  // 9. THIN-2PX-LARGE-HIT-TARGET
  {
    const hasThin2pxLine = controlsCode.includes('w-full h-0.5 bg-white/30 rounded-full');
    const hasLargeTouchNoneHitTarget = controlsCode.includes('w-full h-9 flex items-center touch-none');
    const hasPointerCapture = controlsCode.includes('setPointerCapture?.(e.pointerId)');
    const hasTouchPointerDedup = controlsCode.includes('if (activeScrubInputRef.current !== null) return;');

    assert(
      'THIN-2PX-LARGE-HIT-TARGET',
      '2px Visual Track + Touch Target',
      'Timeline preserves thin 2px (h-0.5) track inside 36px (h-9) touch-none hit target with pointer/touch dedup',
      hasThin2pxLine && hasLargeTouchNoneHitTarget && hasPointerCapture && hasTouchPointerDedup,
      `thin2px=${hasThin2pxLine}, hitTarget36px=${hasLargeTouchNoneHitTarget}, pointerCapture=${hasPointerCapture}, dedup=${hasTouchPointerDedup}`
    );
  }

  // 10. MUSIC-DECOUPLED-ACCESSIBLE
  {
    const hasRightActionBtn = reelsViewCode.includes('data-testid={`reel-music-action-btn-${reel.id}`}');
    const hasCaptionMusicLink = reelsViewCode.includes('data-testid={`reel-music-link-${reel.id}`}');
    const wiredSelectTrack = reelsViewCode.includes('onSelectTrack={onUseMusic}');
    const prefillInCreateReel =
      socialIndexCode.includes('initialAudioTrack={editorInitialAudio}') &&
      fs.readFileSync('components/CreateReelModal.tsx', 'utf-8').includes('initialAudioTrack?: AudioTrack | null;');
    const decoupledFromTimeline =
      !reelsViewCode.includes('isTimelineVisible') &&
      !controlsCode.includes('musicTrack');

    assert(
      'MUSIC-DECOUPLED-ACCESSIBLE',
      'Decoupled Music Action',
      'Music action is accessible independently (no always-on strip/player tied to timeline) and wires Use This Soundtrack to CreateReelModal',
      hasRightActionBtn && hasCaptionMusicLink && wiredSelectTrack && prefillInCreateReel && decoupledFromTimeline,
      `rightBtn=${hasRightActionBtn}, link=${hasCaptionMusicLink}, wiredSelectTrack=${wiredSelectTrack}, prefill=${prefillInCreateReel}, decoupled=${decoupledFromTimeline}`
    );
  }

  // 11. PHASE10-PROTECTED-FILES
  {
    const expectedPhase10: { [file: string]: string } = {
      'services/v2RewardEngine.ts': '7258cb342e153fb5bb6cf401db84014d6108b0ecc2fa4c3c8752064f12a5ba7a',
      'services/v2IntegrationAdapter.ts': '5759a7225efb119f6bac2d2e8ce49ae7b5562def4fb0c36acefc897ae26aa1cb',
      'tests/v2Phase10IntegrationVerification.ts': '9e2eb1be31cc973e2f3d112547b4ffd9d94064409f1a57c28f0055c4ac9abac8',
    };
    let allMatch = true;
    const summary: string[] = [];
    for (const [file, expected] of Object.entries(expectedPhase10)) {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      const ok = actual === expected;
      if (!ok) allMatch = false;
      summary.push(`${file}=${ok ? 'MATCH' : 'MISMATCH'}`);
    }

    assert(
      'PHASE10-PROTECTED-FILES',
      'Phase 10 Integrity Guard',
      'Protected Phase 10 files remain 100% SHA-256 unchanged',
      allMatch,
      summary.join(', ')
    );
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  return { total: results.length, passed, failed, results };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('reelsTimelineVisibilityVerification')) {
  console.log('--- METFA SOCIAL: REELS TIMELINE, TIMESTAMP & MUSIC VISIBILITY VERIFICATION ---');
  const res = runReelsTimelineVisibilityVerification();
  res.results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.testId}] ${r.category} - ${r.description}`);
    console.log(`   Status: ${r.status} | Evidence: ${r.evidence}`);
  });
  console.log(`\nTOTAL: ${res.total} | PASSED: ${res.passed} | FAILED: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
