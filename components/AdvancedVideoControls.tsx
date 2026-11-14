import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
} from 'lucide-react';

export interface AdvancedVideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isMuted: boolean;
  onToggleMute: (e: React.MouseEvent) => void;
  onOpenReel?: (currentTime: number) => void;
  reelId?: string;
  title?: string;
  isCompact?: boolean;
  className?: string;
  theme?: 'dark' | 'glass';
  variant?: 'reels' | 'feed';
  showCenterControls?: boolean;
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Recognizable circular directional arrow with large, clearly visible 5 centered inside.
 * Left arrow sweeps counter-clockwise with arrowhead pointing left/down.
 */
export const SeekBackward5Icon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Circular counter-clockwise arc */}
    <path
      d="M 24 8 A 16 16 0 1 0 40 24"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
    />
    {/* Arrowhead pointing counter-clockwise */}
    <path
      d="M 28 3.5 L 22 8 L 28 12.5"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Large clearly visible 5 centered inside */}
    <text
      x="24"
      y="26"
      textAnchor="middle"
      dominantBaseline="central"
      fill="currentColor"
      fontSize="15"
      fontWeight="800"
      fontFamily="system-ui, -apple-system, sans-serif"
    >5</text>
  </svg>
);

/**
 * Recognizable circular directional arrow with large, clearly visible 5 centered inside.
 * Right arrow sweeps clockwise with arrowhead pointing right/down.
 */
export const SeekForward5Icon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Circular clockwise arc */}
    <path
      d="M 24 8 A 16 16 0 1 1 8 24"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
    />
    {/* Arrowhead pointing clockwise */}
    <path
      d="M 20 3.5 L 26 8 L 20 12.5"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Large clearly visible 5 centered inside */}
    <text
      x="24"
      y="26"
      textAnchor="middle"
      dominantBaseline="central"
      fill="currentColor"
      fontSize="15"
      fontWeight="800"
      fontFamily="system-ui, -apple-system, sans-serif"
    >5</text>
  </svg>
);

export const AUTO_HIDE_DELAY_MS = 1000;
export const TIMELINE_AUTO_HIDE_DELAY_MS = 1800;
export const HOLD_SPEED_DELAY_MS = 300;
export const HOLD_MOVE_TOLERANCE_PX = 12;
export const SINGLE_TAP_DISAMBIGUATION_MS = 220;
export const RAPID_TAP_BURST_WINDOW_MS = 320;

export function clampSeekTime(targetSeconds: number, maxDuration: number): number {
  const safeMax = maxDuration > 0 && isFinite(maxDuration) ? maxDuration : 0;
  if (safeMax <= 0) return 0;
  return Math.max(0, Math.min(safeMax, targetSeconds));
}

export function calculateScrubTime(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  maxDuration: number
): number {
  const clickX = Math.max(0, Math.min(rectWidth, clientX - rectLeft));
  const percentage = rectWidth > 0 ? clickX / rectWidth : 0;
  const safeMax = maxDuration > 0 && isFinite(maxDuration) ? maxDuration : 0;
  return percentage * safeMax;
}

export const AdvancedVideoControls: React.FC<AdvancedVideoControlsProps> = ({
  videoRef,
  isMuted,
  onToggleMute,
  onOpenReel,
  reelId,
  title = 'Video',
  className = '',
  variant = 'reels',
  showCenterControls,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMetadataReady, setIsMetadataReady] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);
  const [isSpeed2x, setIsSpeed2x] = useState<boolean>(false);

  // Center playback controls start hidden so Reels opens cleanly without accidental popups.
  // They appear strictly on an intentional tap and auto-hide independently after AUTO_HIDE_DELAY_MS (1000ms).
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(false);
  const areControlsVisibleRef = useRef<boolean>(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimestampRef = useRef<number>(0);

  // Reels Timeline & Timestamp visibility is 100% independent of Center Playback Controls:
  // hidden during normal playback, revealed on tap/scrub/pause, auto-hides after 1.8s (1.5-2s window).
  const [isTimelineVisible, setIsTimelineVisible] = useState<boolean>(false);
  const isTimelineVisibleRef = useRef<boolean>(false);
  const timelineHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bottom expandable timeline state (used in Feed variant only)
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);

  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Stable refs to prevent listener teardown lag, stale closures, and dual touch/pointer execution
  const isScrubbingRef = useRef<boolean>(false);
  const activeScrubInputRef = useRef<'pointer' | 'touch' | null>(null);
  const activeScrubPointerIdRef = useRef<number | null>(null);
  const activeScrubTouchIdRef = useRef<number | null>(null);
  const wasPlayingBeforeScrubRef = useRef<boolean>(false);
  const pendingSeekRef = useRef<{ target: number; timestamp: number } | null>(null);
  const isPlayingRef = useRef<boolean>(true);

  // Center tap tracking (scroll/swipe rejection)
  const centerTapPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // 2X Hold-to-Speed refs (Reels only)
  const isSpeed2xRef = useRef<boolean>(false);
  const holdSpeedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    side: 'left' | 'right';
    activated2x: boolean;
    moved: boolean;
  } | null>(null);

  const isReelsMode = variant === 'reels';
  const shouldRenderCenterControls = showCenterControls !== undefined ? showCenterControls : isReelsMode;

  useEffect(() => {
    areControlsVisibleRef.current = areControlsVisible;
  }, [areControlsVisible]);

  useEffect(() => {
    isTimelineVisibleRef.current = isTimelineVisible;
  }, [isTimelineVisible]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const clearTapRevealTimer = useCallback(() => {
    if (tapRevealTimerRef.current) {
      clearTimeout(tapRevealTimerRef.current);
      tapRevealTimerRef.current = null;
    }
  }, []);

  const clearTimelineHideTimer = useCallback(() => {
    if (timelineHideTimerRef.current) {
      clearTimeout(timelineHideTimerRef.current);
      timelineHideTimerRef.current = null;
    }
  }, []);

  // Immediately stop 2X Hold-to-Speed and restore normal 1X playback speed
  const stopHoldToSpeed = useCallback(() => {
    if (holdSpeedTimerRef.current) {
      clearTimeout(holdSpeedTimerRef.current);
      holdSpeedTimerRef.current = null;
    }
    holdPointerRef.current = null;
    if (isSpeed2xRef.current) {
      isSpeed2xRef.current = false;
      setIsSpeed2x(false);
    }
    const video = videoRef.current;
    if (video && video.playbackRate !== 1) {
      try {
        video.playbackRate = 1;
      } catch {}
    }
  }, [videoRef]);

  // Schedule auto-hide of center controls after ~1s (1000ms) of inactivity (independent of timeline state)
  const scheduleControlsAutoHide = useCallback((delayMs: number = AUTO_HIDE_DELAY_MS) => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      // Do not hide center controls during an active press, drag, or seek
      if (!isScrubbingRef.current) {
        setAreControlsVisible(false);
        if (!shouldRenderCenterControls) {
          setIsTimelineOpen(false);
        }
      }
    }, delayMs);
  }, [shouldRenderCenterControls]);

  // Schedule auto-hide of Reels timeline & timestamp after 1.5–2s (1800ms) of inactivity
  const scheduleTimelineAutoHide = useCallback((delayMs: number = TIMELINE_AUTO_HIDE_DELAY_MS) => {
    clearTimelineHideTimer();
    timelineHideTimerRef.current = setTimeout(() => {
      timelineHideTimerRef.current = null;
      // Keep timeline visible while actively scrubbing or paused
      if (!isScrubbingRef.current && isPlayingRef.current) {
        setIsTimelineVisible(false);
      }
    }, delayMs);
  }, [clearTimelineHideTimer]);

  // Keep center controls visible while actively interacting (never forces timeline or vice versa)
  const keepControlsVisible = useCallback(() => {
    clearTapRevealTimer();
    setAreControlsVisible(true);
    scheduleControlsAutoHide(1000);
  }, [clearTapRevealTimer, scheduleControlsAutoHide]);

  // Reveal Timeline & Timestamp ONLY (center Play/Pause & ±5s controls stay hidden)
  const revealTimelineOnly = useCallback(() => {
    clearTapRevealTimer();
    setIsTimelineVisible(true);
    if (isPlayingRef.current) {
      scheduleTimelineAutoHide(TIMELINE_AUTO_HIDE_DELAY_MS);
    } else {
      clearTimelineHideTimer();
    }
  }, [clearTapRevealTimer, scheduleTimelineAutoHide, clearTimelineHideTimer]);

  // Strict single-tap disambiguation:
  // - Suppresses rapid multi-tap popups, swipe reveals, and 2X long-press conflicts
  // - Tap 1 on normal playback reveals Timeline + Timestamp ONLY (never pops up center controls)
  // - Tap while Timeline + Timestamp are already shown toggles/opens center controls independently
  // - Tap while center controls are visible hides center controls cleanly
  const handleIntentionalTapCandidate = useCallback(() => {
    if (!shouldRenderCenterControls || isScrubbingRef.current || isSpeed2xRef.current) {
      return;
    }

    const now = Date.now();
    if (tapRevealTimerRef.current) {
      clearTimeout(tapRevealTimerRef.current);
      tapRevealTimerRef.current = null;
      lastTapTimestampRef.current = now;
      setAreControlsVisible(false);
      return;
    }

    if (now - lastTapTimestampRef.current < RAPID_TAP_BURST_WINDOW_MS) {
      lastTapTimestampRef.current = now;
      setAreControlsVisible(false);
      return;
    }

    lastTapTimestampRef.current = now;

    if (areControlsVisibleRef.current) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      setAreControlsVisible(false);
      return;
    }

    tapRevealTimerRef.current = setTimeout(() => {
      tapRevealTimerRef.current = null;
      if (isScrubbingRef.current || isSpeed2xRef.current) return;

      if (!isTimelineVisibleRef.current && isPlayingRef.current) {
        revealTimelineOnly();
      } else {
        keepControlsVisible();
      }
    }, SINGLE_TAP_DISAMBIGUATION_MS);
  }, [shouldRenderCenterControls, revealTimelineOnly, keepControlsVisible]);

  // Reset per-reel state cleanly when reelId changes so no stale duration/position flashes
  useEffect(() => {
    setAreControlsVisible(false);
    setIsTimelineVisible(false);
    setScrubPreviewTime(null);
    setIsScrubbing(false);
    isScrubbingRef.current = false;
    pendingSeekRef.current = null;
    clearTapRevealTimer();
    clearTimelineHideTimer();
    stopHoldToSpeed();
  }, [reelId, clearTapRevealTimer, clearTimelineHideTimer, stopHoldToSpeed]);

  // Sync state with HTML5 video events (bound cleanly without re-subscribing on scrub)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncMetadataState = () => {
      const hasValidDuration =
        typeof video.duration === 'number' &&
        !isNaN(video.duration) &&
        isFinite(video.duration) &&
        video.duration > 0;
      if (hasValidDuration && video.readyState >= 1) {
        setDuration(video.duration);
        setIsMetadataReady(true);
      } else if (hasValidDuration) {
        setDuration(video.duration);
        setIsMetadataReady(true);
      } else {
        setDuration(0);
        setIsMetadataReady(false);
      }
    };

    const handleTimeUpdate = () => {
      if (!isScrubbingRef.current) {
        setCurrentTime(isFinite(video.currentTime) ? video.currentTime : 0);
      }
    };

    const handleDurationChange = () => {
      syncMetadataState();
    };

    const handleSeeked = () => {
      if (
        pendingSeekRef.current &&
        Math.abs((video.currentTime || 0) - pendingSeekRef.current.target) < 0.75
      ) {
        pendingSeekRef.current = null;
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      if (isTimelineVisibleRef.current && !isScrubbingRef.current) {
        scheduleTimelineAutoHide(TIMELINE_AUTO_HIDE_DELAY_MS);
      }
    };
    const handlePause = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      clearTimelineHideTimer();
      stopHoldToSpeed();
    };
    const handleEnded = () => {
      stopHoldToSpeed();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleDurationChange);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    // Initial sync: treat autoplay startup before playback begins as playing so timeline does not flash on load
    syncMetadataState();
    setCurrentTime(video.readyState >= 1 && isFinite(video.currentTime) ? video.currentTime : 0);
    const initialPaused = video.paused && (video.currentTime > 0 || !video.autoplay);
    setIsPlaying(!initialPaused);
    isPlayingRef.current = !initialPaused;

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleDurationChange);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      stopHoldToSpeed();
      clearTapRevealTimer();
      clearTimelineHideTimer();
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [videoRef, reelId, clearTapRevealTimer, clearTimelineHideTimer, scheduleTimelineAutoHide, stopHoldToSpeed]);

  // Global interruption safety: restore 1X speed on window blur, visibility change, or pointer release anywhere
  useEffect(() => {
    if (!shouldRenderCenterControls) {
      stopHoldToSpeed();
      return;
    }

    const handleVisibilityOrBlur = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        stopHoldToSpeed();
        clearTapRevealTimer();
      }
    };
    const handleWindowBlur = () => {
      stopHoldToSpeed();
      clearTapRevealTimer();
    };
    const handleGlobalPointerEnd = (ev: PointerEvent) => {
      if (holdPointerRef.current && ev.pointerId === holdPointerRef.current.pointerId) {
        stopHoldToSpeed();
      }
      if (centerTapPointerRef.current && ev.pointerId === centerTapPointerRef.current.pointerId) {
        centerTapPointerRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pointerup', handleGlobalPointerEnd);
    window.addEventListener('pointercancel', handleGlobalPointerEnd);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pointerup', handleGlobalPointerEnd);
      window.removeEventListener('pointercancel', handleGlobalPointerEnd);
      stopHoldToSpeed();
    };
  }, [shouldRenderCenterControls, clearTapRevealTimer, stopHoldToSpeed]);

  const getValidMaxDuration = useCallback((): number => {
    if (duration > 0 && isFinite(duration)) return duration;
    const vid = videoRef.current;
    if (vid && vid.readyState >= 1 && isFinite(vid.duration) && vid.duration > 0) {
      return vid.duration;
    }
    return 0;
  }, [duration, videoRef]);

  // Toggle timeline visibility on clicking the duration display
  const toggleTimeline = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!shouldRenderCenterControls) {
      setIsTimelineOpen((prev) => !prev);
      scheduleControlsAutoHide(1000);
    } else if (isPlayingRef.current) {
      setIsTimelineVisible((prev) => {
        const next = !prev;
        if (next) {
          scheduleTimelineAutoHide(TIMELINE_AUTO_HIDE_DELAY_MS);
        } else {
          clearTimelineHideTimer();
        }
        return next;
      });
    }
  };

  // Toggle Play / Pause (also stops 2X if active; keeps timeline visible when paused without auto-opening center controls)
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    stopHoldToSpeed();
    keepControlsVisible();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
        if (isTimelineVisibleRef.current) {
          scheduleTimelineAutoHide(TIMELINE_AUTO_HIDE_DELAY_MS);
        }
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      clearTimelineHideTimer();
    }
  };

  // Strictly 5-second backward/forward seek with boundary clamping [0, duration] and rapid-tap accumulation
  const seekDelta = useCallback(
    (deltaSeconds: number, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      keepControlsVisible();
      const video = videoRef.current;
      const maxDuration = getValidMaxDuration();
      if (!video || maxDuration <= 0) return;

      const now = Date.now();
      const hasPendingSeek =
        pendingSeekRef.current &&
        (now - pendingSeekRef.current.timestamp < 500 || video.seeking);
      const baseTime = hasPendingSeek
        ? pendingSeekRef.current!.target
        : (video.currentTime || 0);
      const targetTime = clampSeekTime(baseTime + deltaSeconds, maxDuration);

      pendingSeekRef.current = { target: targetTime, timestamp: now };
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    },
    [videoRef, getValidMaxDuration, keepControlsVisible]
  );

  // Calculate timeline position from pointer/touch coordinate
  const calculateSeekTime = useCallback(
    (clientX: number): number => {
      if (!progressBarRef.current) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      const maxDuration = getValidMaxDuration();
      if (maxDuration <= 0) return 0;
      return calculateScrubTime(clientX, rect.left, rect.width, maxDuration);
    },
    [getValidMaxDuration]
  );

  // Unified scrub start helper (shows Timeline + Timestamp, never pops up center controls!)
  const beginScrubAt = useCallback(
    (clientX: number) => {
      const maxDuration = getValidMaxDuration();
      if (maxDuration <= 0) return;

      stopHoldToSpeed();
      clearTapRevealTimer();
      clearTimelineHideTimer();
      pendingSeekRef.current = null;

      isScrubbingRef.current = true;
      setIsScrubbing(true);

      // Show Timeline + Timestamp while keeping center playback controls hidden in Reels
      if (shouldRenderCenterControls) {
        setIsTimelineVisible(true);
      }
      if (shouldRenderCenterControls) {
        setAreControlsVisible(false);
      } else {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        setIsTimelineOpen(true);
      }

      const video = videoRef.current;
      if (video) {
        wasPlayingBeforeScrubRef.current = !video.paused && !video.ended;
      }

      const targetTime = calculateSeekTime(clientX);
      setScrubPreviewTime(targetTime);
      setCurrentTime(targetTime);
      if (video) {
        try {
          video.currentTime = targetTime;
        } catch {}
      }
    },
    [getValidMaxDuration, calculateSeekTime, stopHoldToSpeed, clearTapRevealTimer, clearTimelineHideTimer, shouldRenderCenterControls, videoRef]
  );

  // Unified scrub move helper
  const moveScrubTo = useCallback(
    (clientX: number) => {
      const maxDuration = getValidMaxDuration();
      if (maxDuration <= 0) return;

      const moveTime = calculateSeekTime(clientX);
      setScrubPreviewTime(moveTime);
      setCurrentTime(moveTime);
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = moveTime;
        } catch {}
      }
    },
    [getValidMaxDuration, calculateSeekTime, videoRef]
  );

  // Unified scrub finish helper (starts 1.8s timeline auto-hide ONLY after drag/tap interaction ends)
  const endScrubAt = useCallback(
    (clientX?: number) => {
      const video = videoRef.current;
      const maxDuration = getValidMaxDuration();

      if (maxDuration > 0 && typeof clientX === 'number' && !isNaN(clientX)) {
        const finalTime = calculateSeekTime(clientX);
        setCurrentTime(finalTime);
        if (video) {
          try {
            video.currentTime = finalTime;
          } catch {}
        }
      }

      if (video && wasPlayingBeforeScrubRef.current && video.paused && !video.ended) {
        video.play().catch(() => {});
      }

      isScrubbingRef.current = false;
      activeScrubInputRef.current = null;
      activeScrubPointerIdRef.current = null;
      activeScrubTouchIdRef.current = null;
      setIsScrubbing(false);
      setScrubPreviewTime(null);

      if (shouldRenderCenterControls) {
        setAreControlsVisible(false);
        setIsTimelineVisible(true);
        if (wasPlayingBeforeScrubRef.current || isPlayingRef.current) {
          scheduleTimelineAutoHide(TIMELINE_AUTO_HIDE_DELAY_MS);
        }
      } else {
        scheduleControlsAutoHide(1000);
      }
    },
    [getValidMaxDuration, calculateSeekTime, shouldRenderCenterControls, scheduleTimelineAutoHide, scheduleControlsAutoHide, videoRef]
  );

  // Primary Pointer handler for timeline scrub (isolated from vertical Reels swipe via touch-none & setPointerCapture)
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!progressBarRef.current || !progressBarRef.current.contains(e.target as Node)) return;
    if (activeScrubInputRef.current !== null) return;
    if (getValidMaxDuration() <= 0) return;

    activeScrubInputRef.current = 'pointer';
    activeScrubPointerIdRef.current = e.pointerId;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}

    beginScrubAt(e.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (
        activeScrubInputRef.current !== 'pointer' ||
        moveEvent.pointerId !== activeScrubPointerIdRef.current
      ) {
        return;
      }
      moveEvent.stopPropagation();
      moveScrubTo(moveEvent.clientX);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      if (
        activeScrubInputRef.current !== 'pointer' ||
        upEvent.pointerId !== activeScrubPointerIdRef.current
      ) {
        return;
      }
      upEvent.stopPropagation();
      try {
        (progressBarRef.current as HTMLElement | null)?.releasePointerCapture?.(upEvent.pointerId);
      } catch {}
      endScrubAt(upEvent.clientX);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Fallback Touch handlers (only executes if pointerdown did not already claim the gesture)
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeScrubInputRef.current !== null) return;
    if (!progressBarRef.current || !progressBarRef.current.contains(e.target as Node)) return;
    if (getValidMaxDuration() <= 0) return;
    const touch = e.touches[0];
    if (!touch) return;

    activeScrubInputRef.current = 'touch';
    activeScrubTouchIdRef.current = touch.identifier;
    beginScrubAt(touch.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeScrubInputRef.current !== 'touch' || !isScrubbingRef.current) return;
    const touch =
      Array.from(e.touches).find((t) => t.identifier === activeScrubTouchIdRef.current) ||
      e.touches[0];
    if (!touch) return;
    moveScrubTo(touch.clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (activeScrubInputRef.current !== 'touch') return;
    const changed =
      Array.from(e.changedTouches).find((t) => t.identifier === activeScrubTouchIdRef.current) ||
      e.changedTouches[0];
    endScrubAt(changed?.clientX);
  };

  // Reels-Only Left/Right Hold-to-Speed (2X) Gesture Handlers (touch-pan-y preserves native vertical swipe)
  const handleHoldZonePointerDown = (side: 'left' | 'right', e: React.PointerEvent) => {
    if (!shouldRenderCenterControls) return;
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isScrubbingRef.current) return;

    // Reset any prior stale timer
    if (holdSpeedTimerRef.current) {
      clearTimeout(holdSpeedTimerRef.current);
      holdSpeedTimerRef.current = null;
    }

    holdPointerRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      side,
      activated2x: false,
      moved: false,
    };

    const video = videoRef.current;
    // Do NOT activate 2X if video is paused or ended
    if (!video || video.paused || video.ended) {
      return;
    }

    holdSpeedTimerRef.current = setTimeout(() => {
      const currentHold = holdPointerRef.current;
      const currentVideo = videoRef.current;
      if (
        !currentHold ||
        currentHold.pointerId !== e.pointerId ||
        currentHold.moved ||
        !currentVideo ||
        currentVideo.paused ||
        currentVideo.ended ||
        isScrubbingRef.current
      ) {
        return;
      }

      clearTapRevealTimer();
      currentHold.activated2x = true;
      currentVideo.playbackRate = 2;
      isSpeed2xRef.current = true;
      setIsSpeed2x(true);
      setAreControlsVisible(false);
    }, HOLD_SPEED_DELAY_MS);
  };

  const handleHoldZonePointerMove = (e: React.PointerEvent) => {
    const currentHold = holdPointerRef.current;
    if (!currentHold || currentHold.pointerId !== e.pointerId) return;

    const dist = Math.hypot(e.clientX - currentHold.startX, e.clientY - currentHold.startY);
    if (!currentHold.activated2x && dist > HOLD_MOVE_TOLERANCE_PX) {
      // User is scrolling/swiping rather than holding still -> cancel hold-to-speed timer
      currentHold.moved = true;
      if (holdSpeedTimerRef.current) {
        clearTimeout(holdSpeedTimerRef.current);
        holdSpeedTimerRef.current = null;
      }
      holdPointerRef.current = null;
    }
  };

  const handleHoldZonePointerUp = (e: React.PointerEvent) => {
    const currentHold = holdPointerRef.current;
    if (!currentHold || currentHold.pointerId !== e.pointerId) return;

    const was2x = currentHold.activated2x || isSpeed2xRef.current;
    const dist = Math.hypot(e.clientX - currentHold.startX, e.clientY - currentHold.startY);
    const wasMoved = currentHold.moved || dist > HOLD_MOVE_TOLERANCE_PX;
    stopHoldToSpeed();

    // Short stationary tap (<300ms, not 2X, not scroll): single-tap reveal disambiguation
    if (!was2x && !wasMoved) {
      handleIntentionalTapCandidate();
    }
  };

  const handleHoldZonePointerCancel = (e: React.PointerEvent) => {
    const currentHold = holdPointerRef.current;
    if (!currentHold || currentHold.pointerId !== e.pointerId) return;
    stopHoldToSpeed();
  };

  // Center tap area pointer handlers (strict swipe & multi-tap rejection)
  const handleCenterTapPointerDown = (e: React.PointerEvent) => {
    if (!shouldRenderCenterControls || !e.isPrimary || isScrubbingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    centerTapPointerRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  };

  const handleCenterTapPointerMove = (e: React.PointerEvent) => {
    const current = centerTapPointerRef.current;
    if (!current || current.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - current.startX, e.clientY - current.startY);
    if (dist > HOLD_MOVE_TOLERANCE_PX) {
      current.moved = true;
    }
  };

  const handleCenterTapPointerUp = (e: React.PointerEvent) => {
    const current = centerTapPointerRef.current;
    if (!current || current.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - current.startX, e.clientY - current.startY);
    const moved = current.moved || dist > HOLD_MOVE_TOLERANCE_PX;
    centerTapPointerRef.current = null;
    if (!moved) {
      handleIntentionalTapCandidate();
    }
  };

  const handleCenterTapPointerCancel = (e: React.PointerEvent) => {
    const current = centerTapPointerRef.current;
    if (!current || current.pointerId !== e.pointerId) return;
    centerTapPointerRef.current = null;
  };

  const validDuration = isMetadataReady && duration > 0 && isFinite(duration) ? duration : 0;
  const effectiveTime = validDuration > 0 ? (scrubPreviewTime !== null ? scrubPreviewTime : currentTime) : 0;
  const progressPercent = validDuration > 0 ? (effectiveTime / validDuration) * 100 : 0;

  // In Reels, both Timeline and Timestamp are hidden during normal playback and appear strictly on tap, scrub, or pause.
  const isReelsTimelineDisplayed = isTimelineVisible || isScrubbing || !isPlaying;
  const showTimelineContainer = shouldRenderCenterControls || isTimelineOpen;
  const isReelsTimelineHidden = shouldRenderCenterControls && !isReelsTimelineDisplayed;

  return (
    <div
      data-testid="advanced-video-controls"
      data-variant={variant}
      data-timeline-visible={shouldRenderCenterControls ? (isReelsTimelineDisplayed ? 'true' : 'false') : (isTimelineOpen ? 'true' : 'false')}
      data-center-controls-visible={areControlsVisible ? 'true' : 'false'}
      className={`absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-3 select-none transition-opacity duration-200 ${className}`}
    >
      {/* Reels-Only Left & Right 2X Hold-to-Speed Zones (z-10: touch-pan-y preserves vertical swipe scrolling) */}
      {shouldRenderCenterControls && (
        <>
          <div
            data-testid="reels-hold-speed-left"
            onPointerDown={(e) => handleHoldZonePointerDown('left', e)}
            onPointerMove={handleHoldZonePointerMove}
            onPointerUp={handleHoldZonePointerUp}
            onPointerCancel={handleHoldZonePointerCancel}
            onLostPointerCapture={handleHoldZonePointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute left-0 top-16 bottom-20 w-[30%] z-10 pointer-events-auto touch-pan-y select-none"
            style={{ WebkitTouchCallout: 'none' }}
            aria-label="Hold left side for 2X playback speed"
          />
          <div
            data-testid="reels-hold-speed-right"
            onPointerDown={(e) => handleHoldZonePointerDown('right', e)}
            onPointerMove={handleHoldZonePointerMove}
            onPointerUp={handleHoldZonePointerUp}
            onPointerCancel={handleHoldZonePointerCancel}
            onLostPointerCapture={handleHoldZonePointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute right-0 top-16 bottom-20 w-[30%] z-10 pointer-events-auto touch-pan-y select-none"
            style={{ WebkitTouchCallout: 'none' }}
            aria-label="Hold right side for 2X playback speed"
          />
        </>
      )}

      {/* Center Tap-to-Reveal Area (REELS ONLY when center controls are hidden; swipe & multi-tap immune) */}
      {shouldRenderCenterControls && !areControlsVisible && (
        <div
          data-testid="video-tap-reveal-area"
          className="absolute left-[30%] right-[30%] top-16 bottom-20 z-10 pointer-events-auto cursor-pointer touch-pan-y"
          onPointerDown={handleCenterTapPointerDown}
          onPointerMove={handleCenterTapPointerMove}
          onPointerUp={handleCenterTapPointerUp}
          onPointerCancel={handleCenterTapPointerCancel}
        />
      )}

      {/* Small & Clean 2X Speed Indicator (REELS ONLY while long-press 2X is active) */}
      {shouldRenderCenterControls && isSpeed2x && (
        <div
          data-testid="reels-2x-speed-indicator"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-2.5 py-0.5 rounded-full bg-black/75 text-white text-xs font-extrabold tracking-wider shadow-lg backdrop-blur-xs border border-white/20"
        >
          2X
        </div>
      )}

      {/* Top spacer */}
      <div className="h-6" />

      {/* A. Exactly Three Circular Controls at the Vertical Center (REELS ONLY) */}
      {shouldRenderCenterControls && (
        <div
          data-testid="reels-center-controls-row"
          className={`relative z-20 my-auto flex items-center justify-center gap-6 transition-all duration-200 ${
            areControlsVisible
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none scale-95'
          }`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* LEFT: Circular counter-clockwise arrow with large clearly visible 5 inside */}
          <button
            type="button"
            data-testid="video-seek-backward-btn"
            onPointerDown={(e) => {
              e.stopPropagation();
              keepControlsVisible();
            }}
            onClick={(e) => seekDelta(-5, e)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 text-white flex items-center justify-center transition shadow-xl backdrop-blur-xs border border-white/20 select-none cursor-pointer touch-manipulation group"
            title="Seek backward 5 seconds"
            aria-label="Seek backward 5 seconds"
          >
            <SeekBackward5Icon className="w-7 h-7 text-white group-hover:text-teal-300 transition-colors" />
          </button>

          {/* CENTER: One Play/Pause button */}
          <button
            type="button"
            data-testid="video-play-pause-btn"
            onPointerDown={(e) => {
              e.stopPropagation();
              keepControlsVisible();
            }}
            onClick={togglePlay}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-black/70 hover:bg-black/90 active:scale-90 text-white flex items-center justify-center transition shadow-2xl backdrop-blur-xs border border-white/25 select-none cursor-pointer touch-manipulation"
            title={isPlaying ? 'Pause video' : 'Play video'}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-white" />
            ) : (
              <Play className="w-6 h-6 fill-white translate-x-0.5" />
            )}
          </button>

          {/* RIGHT: Circular clockwise arrow with large clearly visible 5 inside */}
          <button
            type="button"
            data-testid="video-seek-forward-btn"
            onPointerDown={(e) => {
              e.stopPropagation();
              keepControlsVisible();
            }}
            onClick={(e) => seekDelta(5, e)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 text-white flex items-center justify-center transition shadow-xl backdrop-blur-xs border border-white/20 select-none cursor-pointer touch-manipulation group"
            title="Seek forward 5 seconds"
            aria-label="Seek forward 5 seconds"
          >
            <SeekForward5Icon className="w-7 h-7 text-white group-hover:text-teal-300 transition-colors" />
          </button>
        </div>
      )}

      {/* C. Bottom Timeline & Duration Controls (Hidden during normal Reels playback; reveals on tap, scrub, or pause) */}
      <div
        className="relative z-20 mt-auto w-full flex flex-col gap-0.5 pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Thin 2px Timeline with generous touch-none hit target */}
        {showTimelineContainer && (
          <div
            data-testid="expandable-timeline-container"
            data-timeline-visible={shouldRenderCenterControls ? (isReelsTimelineDisplayed ? 'true' : 'false') : 'true'}
            aria-hidden={isReelsTimelineHidden}
            className={`w-full select-none transition-opacity duration-200 ${
              isReelsTimelineHidden ? 'opacity-0' : 'opacity-100'
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={progressBarRef}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={validDuration}
              aria-valuenow={effectiveTime}
              aria-label="Video scrubber"
              tabIndex={isReelsTimelineHidden ? -1 : 0}
              data-testid="video-progress-bar"
              onPointerDown={handlePointerDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className={`relative w-full h-9 flex items-center touch-none ${
                validDuration > 0 ? 'cursor-pointer' : 'cursor-default opacity-70'
              }`}
            >
              {/* Clean thin 2px progress line without any background panel, card, box, or border */}
              <div className="w-full h-0.5 bg-white/30 rounded-full overflow-hidden pointer-events-none">
                <div
                  className="h-full bg-teal-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>

              {/* Small progress indicator knob (emphasizes cleanly via scale transform during active drag) */}
              {validDuration > 0 && (
                <div
                  data-testid="video-scrubber-knob"
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-xs pointer-events-none transition-transform duration-100 ${
                    isScrubbing ? 'scale-150 ring-2 ring-teal-400/60' : ''
                  }`}
                  style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              )}
            </div>
          </div>
        )}

        {/* Compact bottom bar: Clean M:SS timestamp (hidden during normal Reels playback; visible when timeline is shown) */}
        <div className="flex items-center justify-between gap-2 w-full">
          {/* Tappable Duration / Time Display (M:SS format) */}
          <button
            type="button"
            data-testid="video-duration-toggle-btn"
            data-timestamp-visible={shouldRenderCenterControls ? (isReelsTimelineDisplayed ? 'true' : 'false') : 'true'}
            aria-hidden={isReelsTimelineHidden}
            tabIndex={isReelsTimelineHidden ? -1 : 0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleTimeline}
            className={
              shouldRenderCenterControls
                ? `text-[11px] font-mono flex items-center gap-1 select-none text-white/90 drop-shadow-sm py-0.5 touch-manipulation transition-opacity duration-200 ${
                    isReelsTimelineDisplayed
                      ? 'opacity-100 pointer-events-auto cursor-pointer'
                      : 'opacity-0 pointer-events-none'
                  }`
                : `px-2.5 py-1 rounded-full border backdrop-blur-xs text-[11px] font-mono flex items-center gap-1 cursor-pointer transition select-none shadow-xs touch-manipulation ${
                    isTimelineOpen
                      ? 'bg-teal-950/80 border-teal-500/50 text-white'
                      : 'bg-black/60 hover:bg-black/80 border-white/10 text-white/90'
                  }`
            }
            title={
              shouldRenderCenterControls
                ? 'Playback position and duration'
                : isTimelineOpen
                  ? 'Click to hide timeline'
                  : 'Click to view and drag timeline'
            }
            aria-label="Toggle playback timeline"
          >
            <span data-testid="video-current-time" className="text-teal-300 font-semibold">
              {formatTime(effectiveTime)}
            </span>
            <span className="text-white/50">/</span>
            <span data-testid="video-duration-time" className="text-white/80">
              {formatTime(validDuration)}
            </span>
          </button>

          {/* Right Controls (hidden in Reels since ReelsFeedView renders its own Sound & Menu controls; visible in Feed) */}
          {!shouldRenderCenterControls && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="video-sound-toggle-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onToggleMute}
                className={`p-1.5 rounded-full border transition cursor-pointer flex items-center justify-center backdrop-blur-xs shadow-xs touch-manipulation ${
                  isMuted
                    ? 'bg-black/60 border-rose-500/40 text-rose-300 hover:bg-black/80'
                    : 'bg-teal-950/80 border-teal-500/40 text-teal-300 hover:bg-teal-900/80'
                }`}
                title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
                aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-teal-300" />
                )}
              </button>

              {onOpenReel && (
                <button
                  type="button"
                  data-testid="video-open-reels-continuity-btn"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onOpenReel(effectiveTime);
                  }}
                  className="p-1.5 rounded-full bg-purple-950/70 hover:bg-purple-900 border border-purple-500/40 text-purple-200 transition cursor-pointer flex items-center justify-center backdrop-blur-xs shadow-xs touch-manipulation"
                  title="Watch in Reels with position continuity"
                  aria-label="Watch in Reels"
                >
                  <Film className="w-3.5 h-3.5 text-purple-300" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedVideoControls;
