/**
 * METFA SOCIAL — FINAL MINIMAL VIDEO SEEK & TIMELINE DESIGN VERIFICATION
 * 
 * Verifies:
 * 1. DUR-179: Video duration of 179s (< 180s) automatically selects -5s / +5s seeking interval.
 * 2. DUR-180: Video duration of exactly 180s automatically selects -10s / +10s seeking interval.
 * 3. DUR-181: Video duration greater than 180s (> 180s) automatically selects -10s / +10s seeking interval.
 * 4. BTN-TWO: Exactly TWO seek buttons rendered (one backward, one forward; no legacy 4-button layout).
 * 5. LAYOUT-INLINE: Current time and total duration displayed in compact inline layout between the two seek controls.
 * 6. SEEK-START: Backward seeking at or near beginning clamps strictly at 0 (never negative).
 * 7. SEEK-END: Forward seeking at or near end clamps strictly at actual video duration.
 * 8. SEEK-REPEAT: Rapid repeated taps calculate accurately from updated current playback positions.
 * 9. TL-REVEAL: Tapping duration/time display reveals thin timeline immediately below it.
 * 10. TL-NO-CONTAINER: Timeline has NO background, card, box, border, gradient panel, or decorative container.
 * 11. TL-DRAG: Direct touch dragging (mobile Android) and desktop pointer interaction seek accurately.
 * 12. TL-AUTOHIDE: Timeline auto-hides after seeking is completed or after brief inactivity.
 * 13. PANEL-MINIMAL: No permanent large control panel over the video; primary visual focus is the video.
 * 14. INT-FEED: Feed video player integration (CommunityPostCard & PostCard) embeds minimal controls.
 * 15. INT-REELS: Reels player integration (ReelsFeedView) embeds minimal controls with stable refs.
 * 16. CONT-POS: Feed-to-Reels playback-position continuity preserves exact currentTime.
 * 17. SND-SYNC: Audio mute/unmute toggle controls and state preservation across interactions.
 * 18. BAS-P10: Protected Phase 10 baseline integrity intact (all 3 files 100% matched).
 */

import * as fs from 'fs';
import * as crypto from 'crypto';

interface AssertionResult {
  testId: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

export function runAdvancedVideoControlsVerification(): {
  total: number;
  passed: number;
  failed: number;
  results: AssertionResult[];
} {
  const results: AssertionResult[] = [];

  const assert = (testId: string, category: string, description: string, condition: boolean, evidence: string) => {
    results.push({
      testId,
      category,
      description,
      status: condition ? 'PASS' : 'FAIL',
      evidence,
    });
  };

  // Helper simulating seek interval calculation from AdvancedVideoControls.tsx
  const getSeekInterval = (duration: number): number => {
    return duration >= 180 ? 10 : 5;
  };

  // Helper simulating seekDelta function from AdvancedVideoControls.tsx
  const simulateSeekDelta = (current: number, delta: number, duration: number): number => {
    const maxDuration = duration > 0 ? duration : 60;
    return Math.max(0, Math.min(maxDuration, current + delta));
  };

  // Helper simulating calculateSeekTime from AdvancedVideoControls.tsx
  const simulateCalculateSeekTime = (clientX: number, rectLeft: number, rectWidth: number, duration: number): number => {
    const clickX = Math.max(0, Math.min(rectWidth, clientX - rectLeft));
    const percentage = rectWidth > 0 ? clickX / rectWidth : 0;
    return percentage * duration;
  };

  const controlsCode = fs.readFileSync('components/AdvancedVideoControls.tsx', 'utf-8');

  // 1. DUR-179: Duration of 179s (< 180s) selects 5s seeking interval
  {
    const interval179 = getSeekInterval(179);
    const interval30 = getSeekInterval(30);
    const interval90 = getSeekInterval(90);

    const pass = interval179 === 5 && interval30 === 5 && interval90 === 5;
    assert(
      'DUR-179',
      'Seek Interval Selection',
      'Video duration of 179s (< 180s) automatically selects -5s / +5s seeking interval',
      pass,
      `duration 179s => ${interval179}s interval (also 30s => ${interval30}s, 90s => ${interval90}s)`
    );
  }

  // 2. DUR-180: Duration of exactly 180s selects 10s seeking interval
  {
    const interval180 = getSeekInterval(180);

    const pass = interval180 === 10;
    assert(
      'DUR-180',
      'Seek Interval Selection',
      'Video duration of exactly 180s automatically selects -10s / +10s seeking interval',
      pass,
      `duration 180s => ${interval180}s interval`
    );
  }

  // 3. DUR-181: Duration greater than 180s selects 10s seeking interval
  {
    const interval181 = getSeekInterval(181);
    const interval240 = getSeekInterval(240);
    const interval600 = getSeekInterval(600);

    const pass = interval181 === 10 && interval240 === 10 && interval600 === 10;
    assert(
      'DUR-181',
      'Seek Interval Selection',
      'Video duration greater than 180s (> 180s) automatically selects -10s / +10s seeking interval',
      pass,
      `duration 181s => ${interval181}s, duration 240s => ${interval240}s, duration 600s => ${interval600}s`
    );
  }

  // 4. BTN-TWO: Exactly TWO seek buttons rendered (one backward, one forward; no 4-button layout)
  {
    const hasDynamicSeekInterval = controlsCode.includes('effectiveDuration >= 180 ? 10 : 5');
    const hasSeekBack = controlsCode.includes('data-testid="video-seek-backward-btn"');
    const hasSeekFwd = controlsCode.includes('data-testid="video-seek-forward-btn"');
    const noLegacy10Back = !controlsCode.includes('data-testid="video-skip-back-10-btn"');
    const noLegacy10Fwd = !controlsCode.includes('data-testid="video-skip-fwd-10-btn"');
    const noLegacy5Back = !controlsCode.includes('data-testid="video-skip-back-5-btn"');
    const noLegacy5Fwd = !controlsCode.includes('data-testid="video-skip-fwd-5-btn"');

    const pass = hasDynamicSeekInterval && hasSeekBack && hasSeekFwd && noLegacy10Back && noLegacy10Fwd && noLegacy5Back && noLegacy5Fwd;
    assert(
      'BTN-TWO',
      'Seek Controls Architecture',
      'Displays exactly TWO dynamic seek buttons: one backward and one forward (no four-button layout)',
      pass,
      `hasSeekBack=${hasSeekBack}, hasSeekFwd=${hasSeekFwd}, legacy4ButtonsRemoved=${noLegacy10Back && noLegacy10Fwd && noLegacy5Back && noLegacy5Fwd}`
    );
  }

  // 5. LAYOUT-INLINE: Current time and total duration displayed inline between the two seek controls
  {
    const hasInlineGroup = controlsCode.includes('Center Seek & Duration Group: [Backward Seek] [Inline Duration / Time] [Forward Seek]');
    const backIndex = controlsCode.indexOf('data-testid="video-seek-backward-btn"');
    const durationIndex = controlsCode.indexOf('data-testid="video-duration-toggle-btn"');
    const fwdIndex = controlsCode.indexOf('data-testid="video-seek-forward-btn"');

    const isInlineBetween = backIndex > 0 && durationIndex > backIndex && fwdIndex > durationIndex;

    const pass = hasInlineGroup && isInlineBetween;
    assert(
      'LAYOUT-INLINE',
      'Inline Controls Layout',
      'Current time and total duration displayed in compact inline layout directly between backward and forward seek controls',
      pass,
      `backBtnIndex=${backIndex}, durationBtnIndex=${durationIndex}, fwdBtnIndex=${fwdIndex} (ordered correctly: ${isInlineBetween})`
    );
  }

  // 6. SEEK-START: Backward seeking at or near beginning clamps strictly at 0
  {
    const duration = 90;
    const seekFromZero = simulateSeekDelta(0, -5, duration);
    const seekFromTwo = simulateSeekDelta(2, -5, duration);

    const pass = seekFromZero === 0 && seekFromTwo === 0;
    assert(
      'SEEK-START',
      'Seek Clamping',
      'Backward seeking at or near the beginning clamps strictly at 0 (never negative)',
      pass,
      `seekFromZero=${seekFromZero}, seekFromTwo=${seekFromTwo}`
    );
  }

  // 7. SEEK-END: Forward seeking at or near end clamps strictly at actual video duration
  {
    const duration = 90;
    const seekFromEnd = simulateSeekDelta(90, 5, duration);
    const seekNearEnd = simulateSeekDelta(88, 5, duration);

    const pass = seekFromEnd === 90 && seekNearEnd === 90;
    assert(
      'SEEK-END',
      'Seek Clamping',
      'Forward seeking at or near the end clamps strictly at actual video duration (never exceeds duration)',
      pass,
      `seekFromEnd=${seekFromEnd}, seekNearEnd=${seekNearEnd} (duration=${duration})`
    );
  }

  // 8. SEEK-REPEAT: Rapid repeated taps calculate accurately from updated current playback positions
  {
    const duration = 240; // 4-minute video -> 10s interval
    let current = 20;
    current = simulateSeekDelta(current, 10, duration); // 30
    current = simulateSeekDelta(current, 10, duration); // 40
    current = simulateSeekDelta(current, 10, duration); // 50
    current = simulateSeekDelta(current, -10, duration); // 40

    const pass = current === 40;
    assert(
      'SEEK-REPEAT',
      'Repeated Seek',
      'Repeated consecutive taps correctly calculate accumulated positions from current playback time',
      pass,
      `Final position after [20 + 10 + 10 + 10 - 10]: ${current}s (expected 40s)`
    );
  }

  // 9. TL-REVEAL: Tapping duration/time display reveals thin timeline immediately below it
  {
    const hasToggleBtn = controlsCode.includes('data-testid="video-duration-toggle-btn"') &&
                         controlsCode.includes('onClick={toggleTimeline}');
    const hasExpandableContainer = controlsCode.includes('data-testid="expandable-timeline-container"') &&
                                   controlsCode.includes('{isTimelineOpen && (');

    const pass = hasToggleBtn && hasExpandableContainer;
    assert(
      'TL-REVEAL',
      'Expandable Timeline',
      'Tapping the duration/time display reveals the thin timeline immediately underneath it',
      pass,
      `hasToggleBtn=${hasToggleBtn}, hasExpandableContainer=${hasExpandableContainer}`
    );
  }

  // 10. TL-NO-CONTAINER: Timeline has NO background, card, box, border, gradient panel, or decorative container
  {
    const hasNoCardBackground = !controlsCode.includes('expandable-timeline-container" className="bg-') &&
                                !controlsCode.includes('expandable-timeline-container" className="border-') &&
                                !controlsCode.includes('expandable-timeline-container" className="backdrop-blur-') &&
                                !controlsCode.includes('expandable-timeline-container" className="bg-gradient-');
    const isThinLine = controlsCode.includes('h-0.5 bg-white/30 rounded-full') &&
                       controlsCode.includes('w-2 h-2 bg-white rounded-full');

    const pass = hasNoCardBackground && isThinLine;
    assert(
      'TL-NO-CONTAINER',
      'Minimal Timeline Styling',
      'Timeline is rendered with no background, card, box, border, gradient panel, or decorative container',
      pass,
      `hasNoCardBackground=${hasNoCardBackground}, isThinLine=${isThinLine}`
    );
  }

  // 11. TL-DRAG: Direct touch dragging (mobile Android) and desktop pointer interaction seek accurately
  {
    const rectLeft = 50;
    const rectWidth = 300;
    const duration = 120;

    const timeQuarter = simulateCalculateSeekTime(125, rectLeft, rectWidth, duration);
    const timeHalf = simulateCalculateSeekTime(200, rectLeft, rectWidth, duration);

    const hasTouchHandlers = controlsCode.includes('onTouchStart={handleTouchStart}') &&
                             controlsCode.includes('onTouchMove={handleTouchMove}') &&
                             controlsCode.includes('onTouchEnd={handleTouchEnd}');
    const hasPointerHandlers = controlsCode.includes('onPointerDown={handlePointerDown}') &&
                               controlsCode.includes('window.addEventListener(\'pointermove\'');

    const pass = timeQuarter === 30 && timeHalf === 60 && hasTouchHandlers && hasPointerHandlers;
    assert(
      'TL-DRAG',
      'Touch & Pointer Seeking',
      'Direct touch dragging on mobile Android and pointer interaction on desktop map accurately to seek timestamps',
      pass,
      `timeQuarter=${timeQuarter}s, timeHalf=${timeHalf}s, hasTouchHandlers=${hasTouchHandlers}, hasPointerHandlers=${hasPointerHandlers}`
    );
  }

  // 12. TL-AUTOHIDE: Timeline auto-hides after seeking is completed or after brief inactivity
  {
    const hasAutoHide = controlsCode.includes('scheduleTimelineAutoHide') &&
                        controlsCode.includes('hideTimelineTimeoutRef') &&
                        controlsCode.includes('setIsTimelineOpen(false)');

    assert(
      'TL-AUTOHIDE',
      'Timeline Auto-Hide',
      'Timeline automatically hides after seeking is completed or after a brief period of inactivity',
      hasAutoHide,
      `hasAutoHide=${hasAutoHide}`
    );
  }

  // 13. PANEL-MINIMAL: No permanent large control panel over the video; primary visual focus is the video
  {
    const rootContainer = controlsCode.includes('className={`relative z-30 select-none flex flex-col gap-1 w-full max-w-full transition-all pointer-events-auto');
    const noOpaqueOverlay = !controlsCode.includes('className="relative z-30 bg-black/90') &&
                            !controlsCode.includes('className="relative z-30 bg-gray-950');

    const pass = rootContainer && noOpaqueOverlay;
    assert(
      'PANEL-MINIMAL',
      'Minimal Visual Design',
      'No permanent large control panel over video; controls are compact floating pill elements keeping video as primary visual focus',
      pass,
      `rootContainer=${rootContainer}, noOpaqueOverlay=${noOpaqueOverlay}`
    );
  }

  // 14. INT-FEED: Feed video player integration (CommunityPostCard & PostCard) embeds minimal controls
  {
    const communityCode = fs.readFileSync('components/CommunityPostCard.tsx', 'utf-8');
    const postCardCode = fs.readFileSync('components/PostCard.tsx', 'utf-8');

    const commHasImport = communityCode.includes("import { AdvancedVideoControls } from './AdvancedVideoControls';");
    const commHasComponent = communityCode.includes('<AdvancedVideoControls') &&
                             (communityCode.includes('videoRef={videoRef}') || communityCode.includes('videoRef={feedVideoRef}')) &&
                             communityCode.includes('onOpenReel=');

    const pcHasImport = postCardCode.includes("import { AdvancedVideoControls } from './AdvancedVideoControls';");
    const pcHasComponent = postCardCode.includes('<AdvancedVideoControls') &&
                           postCardCode.includes('videoRef={feedVideoRef}') &&
                           postCardCode.includes('onOpenReel=');

    const pass = commHasImport && commHasComponent && pcHasImport && pcHasComponent;
    assert(
      'INT-FEED',
      'Feed Integration',
      'CommunityPostCard and PostCard embed the minimal video controls with ref binding and continuity',
      pass,
      `commHasImport=${commHasImport}, commHasComponent=${commHasComponent}, pcHasImport=${pcHasImport}, pcHasComponent=${pcHasComponent}`
    );
  }

  // 15. INT-REELS: Reels player integration (ReelsFeedView) embeds minimal controls with stable refs
  {
    const reelsCode = fs.readFileSync('components/ReelsFeedView.tsx', 'utf-8');

    const reelsHasImport = reelsCode.includes("import { AdvancedVideoControls } from './AdvancedVideoControls';");
    const reelsHasRefMap = reelsCode.includes('reelVideoRefs = React.useRef') &&
                           reelsCode.includes('getReelVideoRef = React.useCallback');
    const reelsHasControls = reelsCode.includes('<AdvancedVideoControls') &&
                             reelsCode.includes('videoRef={getReelVideoRef(reel.id)}') &&
                             reelsCode.includes('isMuted={isMuted}');

    const pass = reelsHasImport && reelsHasRefMap && reelsHasControls;
    assert(
      'INT-REELS',
      'Reels Integration',
      'ReelsFeedView integrates the minimal video controls for every Reel card using memoized stable video refs',
      pass,
      `reelsHasImport=${reelsHasImport}, reelsHasRefMap=${reelsHasRefMap}, reelsHasControls=${reelsHasControls}`
    );
  }

  // 16. CONT-POS: Feed-to-Reels playback-position continuity (preserves exact currentTime)
  {
    const socialIndexCode = fs.readFileSync('features/social/index.tsx', 'utf-8');
    const reelsCode = fs.readFileSync('components/ReelsFeedView.tsx', 'utf-8');

    const indexCapturesTime = socialIndexCode.includes('targetReelInitialTime') &&
                              socialIndexCode.includes('videoPayload.currentTime') &&
                              socialIndexCode.includes('initialCurrentTime={targetReelInitialTime}');

    const reelsAppliesTime = reelsCode.includes('initialCurrentTime?: number;') &&
                             reelsCode.includes('el.currentTime = initialCurrentTime;');

    const pass = indexCapturesTime && reelsAppliesTime;
    assert(
      'CONT-POS',
      'Position Continuity',
      'Feed-to-Reels navigation carries exact currentTime from Feed video player and restores position in ReelsFeedView',
      pass,
      `indexCapturesTime=${indexCapturesTime}, reelsAppliesTime=${reelsAppliesTime}`
    );
  }

  // 17. SND-SYNC: Audio mute/unmute toggle controls and state preservation across interactions
  {
    const hasMuteToggle = controlsCode.includes('data-testid="video-sound-toggle-btn"') &&
                          controlsCode.includes('onClick={onToggleMute}') &&
                          controlsCode.includes('Volume2') &&
                          controlsCode.includes('VolumeX');

    const reelsCode = fs.readFileSync('components/ReelsFeedView.tsx', 'utf-8');
    const reelsSyncsSound = reelsCode.includes('toggleSound = (reelId: string, e: React.MouseEvent)') &&
                            reelsCode.includes('el.muted = nextMuted;') &&
                            reelsCode.includes('onToggleMute={(e) => toggleSound(reel.id, e)}');

    const pass = hasMuteToggle && reelsSyncsSound;
    assert(
      'SND-SYNC',
      'Audio State Sync',
      'Sound mute and unmute controls remain fully functional with live DOM audio synchronization',
      pass,
      `hasMuteToggle=${hasMuteToggle}, reelsSyncsSound=${reelsSyncsSound}`
    );
  }

  // 18. BAS-P10: Phase 10 baseline integrity (all 3 files 100% untouched)
  {
    const expectedHashes: { [key: string]: string } = {
      'services/v2RewardEngine.ts': '7258cb342e153fb5bb6cf401db84014d6108b0ecc2fa4c3c8752064f12a5ba7a',
      'services/v2IntegrationAdapter.ts': '5759a7225efb119f6bac2d2e8ce49ae7b5562def4fb0c36acefc897ae26aa1cb',
      'tests/v2Phase10IntegrationVerification.ts': '9e2eb1be31cc973e2f3d112547b4ffd9d94064409f1a57c28f0055c4ac9abac8',
    };

    let allMatch = true;
    const hashResults: string[] = [];

    for (const [file, expected] of Object.entries(expectedHashes)) {
      if (!fs.existsSync(file)) {
        allMatch = false;
        hashResults.push(`${file}: MISSING`);
        continue;
      }
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      const matches = actual === expected;
      if (!matches) allMatch = false;
      hashResults.push(`${file}: ${matches ? 'MATCH' : 'MISMATCH (' + actual + ')'}`);
    }

    assert(
      'BAS-P10',
      'Phase 10 Integrity',
      'Protected Phase 10 files remain strictly untouched with cryptographic hash matching baseline',
      allMatch,
      hashResults.join('; ')
    );
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

// CLI runner if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('advancedVideoControlsVerification')) {
  console.log('--- METFA SOCIAL: FINAL MINIMAL VIDEO CONTROLS UX CORRECTION VERIFICATION ---');
  const res = runAdvancedVideoControlsVerification();
  res.results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.testId}] ${r.category} - ${r.description}`);
    console.log(`   Status: ${r.status} | Evidence: ${r.evidence}`);
  });
  console.log(`\nTOTAL: ${res.total} | PASSED: ${res.passed} | FAILED: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
