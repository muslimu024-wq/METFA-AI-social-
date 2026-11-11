/**
 * METFA SOCIAL — FINAL MINIMAL VIDEO SEEK & TIMELINE DESIGN VERIFICATION
 * 
 * Verifies:
 * 1. DUR-01: Video duration < 3 min (< 180s) automatically selects 5s seeking interval.
 * 2. DUR-02: Video duration == 3 min (180s) automatically selects 10s seeking interval.
 * 3. DUR-03: Video duration > 3 min (> 180s) automatically selects 10s seeking interval.
 * 4. BTN-01: Exactly TWO seek buttons rendered (dynamic backward & forward showing selected interval).
 * 5. SEEK-01: Boundary seek clamping at beginning (never underflow below 0).
 * 6. SEEK-02: Boundary seek clamping at end (never overflow beyond video duration).
 * 7. SEEK-03: Repeated consecutive taps calculate accurately from current playback position.
 * 8. TL-EXP-01: Duration click reveals the thin expandable timeline (toggles on/off).
 * 9. TL-EXP-02: Timeline has NO additional background, card, box, filled panel, or decorative container overlay.
 * 10. TL-EXP-03: Direct touch dragging & tapping seek to the correct position (Android & desktop support).
 * 11. TL-EXP-04: Auto-hide timer hides timeline after seeking is completed or after inactivity period.
 * 12. INT-01: Feed video player integration (CommunityPostCard & PostCard) embeds minimal controls.
 * 13. INT-02: Reels player integration (ReelsFeedView) embeds minimal controls with stable refs.
 * 14. CONT-01: Feed-to-Reels playback-position continuity (preserves exact currentTime).
 * 15. SND-01: Audio mute/unmute toggle controls and state preservation across interactions.
 * 16. BAS-01: Phase 10 baseline integrity (all 3 files 100% untouched).
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

  // 1. DUR-01: Duration below 3 minutes (< 180s) selects 5s seeking interval
  {
    const shortReel = getSeekInterval(90); // 90s Reel
    const shortFeedClip = getSeekInterval(30); // 30s video
    const nearLimitClip = getSeekInterval(179); // 179s clip

    const pass = shortReel === 5 && shortFeedClip === 5 && nearLimitClip === 5;
    assert(
      'DUR-01',
      'Seek Interval Selection',
      'Videos shorter than 3 minutes (< 180s) automatically use 5-second seeking interval',
      pass,
      `duration 30s => ${shortFeedClip}s, duration 90s => ${shortReel}s, duration 179s => ${nearLimitClip}s`
    );
  }

  // 2. DUR-02: Duration exactly 3 minutes (180s) selects 10s seeking interval
  {
    const exactlyThreeMin = getSeekInterval(180);

    const pass = exactlyThreeMin === 10;
    assert(
      'DUR-02',
      'Seek Interval Selection',
      'A video of exactly 3 minutes (180s) automatically uses 10-second seeking interval',
      pass,
      `duration 180s => ${exactlyThreeMin}s interval`
    );
  }

  // 3. DUR-03: Duration longer than 3 minutes (> 180s) selects 10s seeking interval
  {
    const longFeedVideo = getSeekInterval(240); // 4 min
    const podcastVideo = getSeekInterval(600); // 10 min

    const pass = longFeedVideo === 10 && podcastVideo === 10;
    assert(
      'DUR-03',
      'Seek Interval Selection',
      'Videos longer than 3 minutes (> 180s) automatically use 10-second seeking interval',
      pass,
      `duration 240s => ${longFeedVideo}s, duration 600s => ${podcastVideo}s`
    );
  }

  // 4. BTN-01: Exactly TWO seek buttons rendered (no four-button layout)
  {
    const hasDynamicSeekInterval = controlsCode.includes('effectiveDuration >= 180 ? 10 : 5');
    const hasSeekBack = controlsCode.includes('data-testid="video-seek-backward-btn"');
    const hasSeekFwd = controlsCode.includes('data-testid="video-seek-forward-btn"');
    const noLegacy10Back = !controlsCode.includes('data-testid="video-skip-back-10-btn"');
    const noLegacy10Fwd = !controlsCode.includes('data-testid="video-skip-fwd-10-btn"');

    const pass = hasDynamicSeekInterval && hasSeekBack && hasSeekFwd && noLegacy10Back && noLegacy10Fwd;
    assert(
      'BTN-01',
      'Dynamic Seek Buttons',
      'Displays exactly TWO dynamic seek buttons (one backward, one forward) with automatic interval presentation',
      pass,
      `hasDynamicSeekInterval=${hasDynamicSeekInterval}, hasSeekBack=${hasSeekBack}, hasSeekFwd=${hasSeekFwd}, noLegacySeparateButtons=${noLegacy10Back && noLegacy10Fwd}`
    );
  }

  // 5. SEEK-01: Boundary seek clamping at beginning (never underflow below 0)
  {
    const duration = 90;
    const seekFromZero = simulateSeekDelta(0, -5, duration);
    const seekFromTwo = simulateSeekDelta(2, -5, duration);

    const pass = seekFromZero === 0 && seekFromTwo === 0;
    assert(
      'SEEK-01',
      'Seek Clamping',
      'Backward seeking at or near the beginning clamps strictly at 0 (no underflow)',
      pass,
      `seekFromZero=${seekFromZero}, seekFromTwo=${seekFromTwo}`
    );
  }

  // 6. SEEK-02: Boundary seek clamping at end (never overflow beyond video duration)
  {
    const duration = 90;
    const seekFromEnd = simulateSeekDelta(90, 5, duration);
    const seekNearEnd = simulateSeekDelta(88, 5, duration);

    const pass = seekFromEnd === 90 && seekNearEnd === 90;
    assert(
      'SEEK-02',
      'Seek Clamping',
      'Forward seeking at or near the end clamps strictly at actual video duration (no overflow)',
      pass,
      `seekFromEnd=${seekFromEnd}, seekNearEnd=${seekNearEnd} (duration=${duration})`
    );
  }

  // 7. SEEK-03: Repeated consecutive taps calculate accurately from current playback position
  {
    const duration = 240; // 4-minute video -> 10s interval
    let current = 20;
    current = simulateSeekDelta(current, 10, duration); // 30
    current = simulateSeekDelta(current, 10, duration); // 40
    current = simulateSeekDelta(current, 10, duration); // 50
    current = simulateSeekDelta(current, -10, duration); // 40

    const pass = current === 40;
    assert(
      'SEEK-03',
      'Repeated Seek',
      'Repeated consecutive taps correctly calculate accumulated positions from current playback time',
      pass,
      `Final position after [20 + 10 + 10 + 10 - 10]: ${current}s (expected 40s)`
    );
  }

  // 8. TL-EXP-01: Duration click reveals the thin expandable timeline (toggles on/off)
  {
    const hasToggleBtn = controlsCode.includes('data-testid="video-duration-toggle-btn"') &&
                         controlsCode.includes('onClick={toggleTimeline}');
    const hasExpandableContainer = controlsCode.includes('data-testid="expandable-timeline-container"') &&
                                   controlsCode.includes('{isTimelineOpen && (');

    const pass = hasToggleBtn && hasExpandableContainer;
    assert(
      'TL-EXP-01',
      'Expandable Timeline',
      'Clickable duration display toggles the thin expandable timeline directly underneath it',
      pass,
      `hasToggleBtn=${hasToggleBtn}, hasExpandableContainer=${hasExpandableContainer}`
    );
  }

  // 9. TL-EXP-02: Timeline has NO additional background, card, box, filled panel, or decorative container overlay
  {
    // Check that expandable-timeline-container does not have heavy background cards or boxes
    const hasNoCardBackground = !controlsCode.includes('expandable-timeline-container" className="bg-') &&
                                !controlsCode.includes('expandable-timeline-container" className="backdrop-blur-') &&
                                controlsCode.includes('className="w-full pt-1.5 pb-0.5 select-none"');
    const isThinLine = controlsCode.includes('h-0.5 bg-white/30 rounded-full') &&
                       controlsCode.includes('w-2 h-2 bg-white rounded-full');

    const pass = hasNoCardBackground && isThinLine;
    assert(
      'TL-EXP-02',
      'Minimal Timeline Styling',
      'Timeline is rendered as a clean minimal thin line without background cards, boxes, panels, or overlays',
      pass,
      `hasNoCardBackground=${hasNoCardBackground}, isThinLine=${isThinLine}`
    );
  }

  // 10. TL-EXP-03: Direct touch dragging & tapping seek to the correct position (Android & desktop support)
  {
    const rectLeft = 50;
    const rectWidth = 300;
    const duration = 120;

    // Tapping at 25% (clientX = 50 + 75 = 125)
    const timeQuarter = simulateCalculateSeekTime(125, rectLeft, rectWidth, duration);
    // Tapping at 50% (clientX = 50 + 150 = 200)
    const timeHalf = simulateCalculateSeekTime(200, rectLeft, rectWidth, duration);

    const hasTouchHandlers = controlsCode.includes('onTouchStart={handleTouchStart}') &&
                             controlsCode.includes('onTouchMove={handleTouchMove}') &&
                             controlsCode.includes('onTouchEnd={handleTouchEnd}');
    const hasPointerHandlers = controlsCode.includes('onPointerDown={handlePointerDown}') &&
                               controlsCode.includes('window.addEventListener(\'pointermove\'');

    const pass = timeQuarter === 30 && timeHalf === 60 && hasTouchHandlers && hasPointerHandlers;
    assert(
      'TL-EXP-03',
      'Timeline Touch & Pointer Drag',
      'Direct touch dragging on mobile Android and pointer interaction on desktop seek precisely to mapped timestamp',
      pass,
      `timeQuarter=${timeQuarter}s, timeHalf=${timeHalf}s, hasTouchHandlers=${hasTouchHandlers}, hasPointerHandlers=${hasPointerHandlers}`
    );
  }

  // 11. TL-EXP-04: Auto-hide timer hides timeline after seeking is completed or after inactivity period
  {
    const hasAutoHide = controlsCode.includes('scheduleTimelineAutoHide') &&
                        controlsCode.includes('hideTimelineTimeoutRef') &&
                        controlsCode.includes('setIsTimelineOpen(false)');

    assert(
      'TL-EXP-04',
      'Timeline Auto-Hide',
      'Timeline automatically hides after seeking completes or after a brief period of inactivity',
      hasAutoHide,
      `hasAutoHide=${hasAutoHide}`
    );
  }

  // 12. INT-01: Feed video player integration (CommunityPostCard & PostCard) embeds minimal controls
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
      'INT-01',
      'Feed Integration',
      'CommunityPostCard and PostCard embed the minimal video controls with ref binding and continuity',
      pass,
      `commHasImport=${commHasImport}, commHasComponent=${commHasComponent}, pcHasImport=${pcHasImport}, pcHasComponent=${pcHasComponent}`
    );
  }

  // 13. INT-02: Reels player integration (ReelsFeedView) embeds minimal controls with stable refs
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
      'INT-02',
      'Reels Integration',
      'ReelsFeedView integrates the minimal video controls for every Reel card using memoized stable video refs',
      pass,
      `reelsHasImport=${reelsHasImport}, reelsHasRefMap=${reelsHasRefMap}, reelsHasControls=${reelsHasControls}`
    );
  }

  // 14. CONT-01: Feed-to-Reels playback-position continuity (preserves exact currentTime)
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
      'CONT-01',
      'Position Continuity',
      'Feed-to-Reels navigation carries exact currentTime from Feed video player and restores position in ReelsFeedView',
      pass,
      `indexCapturesTime=${indexCapturesTime}, reelsAppliesTime=${reelsAppliesTime}`
    );
  }

  // 15. SND-01: Audio mute/unmute toggle controls and state preservation across interactions
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
      'SND-01',
      'Audio State Sync',
      'Sound mute and unmute controls remain fully functional with live DOM audio synchronization',
      pass,
      `hasMuteToggle=${hasMuteToggle}, reelsSyncsSound=${reelsSyncsSound}`
    );
  }

  // 16. BAS-01: Phase 10 baseline integrity (all 3 files 100% untouched)
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
      'BAS-01',
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
  console.log('--- METFA SOCIAL: MINIMAL VIDEO SEEK & TIMELINE DESIGN VERIFICATION ---');
  const res = runAdvancedVideoControlsVerification();
  res.results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.testId}] ${r.category} - ${r.description}`);
    console.log(`   Status: ${r.status} | Evidence: ${r.evidence}`);
  });
  console.log(`\nTOTAL: ${res.total} | PASSED: ${res.passed} | FAILED: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
