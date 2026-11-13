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
  if (isNaN(seconds) || seconds < 0) return '0:00';
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

export const AdvancedVideoControls: React.FC<AdvancedVideoControlsProps> = ({
  videoRef,
  isMuted,
  onToggleMute,
  onOpenReel,
  reelId,
  title = 'Video',
  isCompact = false,
  className = '',
  theme = 'glass',
  variant = 'reels',
  showCenterControls,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);

  // Inactivity auto-hide state: controls appear on tap, hide after ~1s (~1000ms) of inactivity
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(true);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bottom expandable timeline state: revealed on clicking duration/time display
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);
  const hideTimelineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const isReelsMode = variant === 'reels';
  const shouldRenderCenterControls = showCenterControls !== undefined ? showCenterControls : isReelsMode;

  // Schedule auto-hide of controls after ~1s (~1000ms) of user inactivity
  const scheduleControlsAutoHide = useCallback((delayMs: number = 1000) => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      // Do not hide controls during an active press, drag, or seek
      if (!isScrubbing) {
        setAreControlsVisible(false);
        setIsTimelineOpen(false);
      }
    }, delayMs);
  }, [isScrubbing]);

  // Keep controls visible while actively interacting
  const keepControlsVisible = useCallback(() => {
    setAreControlsVisible(true);
    scheduleControlsAutoHide(1000);
  }, [scheduleControlsAutoHide]);

  // Sync state with HTML5 video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isScrubbing) {
        setCurrentTime(video.currentTime || 0);
      }
    };

    const handleDurationChange = () => {
      if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Initial sync
    if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
      setDuration(video.duration);
    }
    setCurrentTime(video.currentTime || 0);
    setIsPlaying(!video.paused);

    // Initial auto-hide timer after mount (~1s inactivity)
    scheduleControlsAutoHide(1000);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (hideTimelineTimeoutRef.current) clearTimeout(hideTimelineTimeoutRef.current);
    };
  }, [videoRef, isScrubbing, scheduleControlsAutoHide]);

  // Toggle timeline visibility on clicking the duration display
  const toggleTimeline = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    keepControlsVisible();
    setIsTimelineOpen((prev) => !prev);
  };

  // Toggle Play / Pause
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    keepControlsVisible();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Strictly 5-second backward/forward seek with boundary clamping [0, duration]
  const seekDelta = useCallback(
    (deltaSeconds: number, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      keepControlsVisible();
      const video = videoRef.current;
      if (!video) return;

      const maxDuration = duration > 0 ? duration : (video.duration || 60);
      const current = video.currentTime || 0;
      // Clamp strictly between 0 and actual duration
      const targetTime = Math.max(0, Math.min(maxDuration, current + deltaSeconds));

      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    },
    [videoRef, duration, keepControlsVisible]
  );

  // Calculate timeline position from pointer/touch coordinate
  const calculateSeekTime = useCallback(
    (clientX: number): number => {
      if (!progressBarRef.current) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percentage = rect.width > 0 ? clickX / rect.width : 0;
      const maxDuration = duration > 0 ? duration : (videoRef.current?.duration || 0);
      return percentage * maxDuration;
    },
    [duration, videoRef]
  );

  // Mouse & Pointer handlers for timeline scrub
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setIsScrubbing(true);
    setAreControlsVisible(true);
    const targetTime = calculateSeekTime(e.clientX);
    setScrubPreviewTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();
      const moveTime = calculateSeekTime(moveEvent.clientX);
      setScrubPreviewTime(moveTime);
      if (videoRef.current) {
        videoRef.current.currentTime = moveTime;
        setCurrentTime(moveTime);
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      upEvent.stopPropagation();
      upEvent.preventDefault();
      setIsScrubbing(false);
      setScrubPreviewTime(null);
      scheduleControlsAutoHide(1000);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Touch handlers for timeline scrub (mobile Android/iOS)
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!e.touches[0]) return;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setIsScrubbing(true);
    setAreControlsVisible(true);
    const targetTime = calculateSeekTime(e.touches[0].clientX);
    setScrubPreviewTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isScrubbing || !e.touches[0]) return;
    const moveTime = calculateSeekTime(e.touches[0].clientX);
    setScrubPreviewTime(moveTime);
    if (videoRef.current) {
      videoRef.current.currentTime = moveTime;
      setCurrentTime(moveTime);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsScrubbing(false);
    setScrubPreviewTime(null);
    scheduleControlsAutoHide(1000);
  };

  const effectiveTime = scrubPreviewTime !== null ? scrubPreviewTime : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;

  return (
    <div
      data-testid="advanced-video-controls"
      data-variant={variant}
      onPointerMove={shouldRenderCenterControls ? keepControlsVisible : undefined}
      className={`absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-3 select-none transition-opacity duration-200 ${className}`}
    >
      {/* Invisible Full Tap-to-Reveal Area (REELS ONLY when controls are hidden; never blocks Feed video tap) */}
      {shouldRenderCenterControls && !areControlsVisible && (
        <div
          data-testid="video-tap-reveal-area"
          className="absolute inset-0 z-10 pointer-events-auto cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            keepControlsVisible();
          }}
        />
      )}

      {/* Top spacer */}
      <div className="h-6" />

      {/* A. Exactly Three Circular Controls at the Vertical Center (REELS ONLY) */}
      {shouldRenderCenterControls && (
        <div
          data-testid="reels-center-controls-row"
          className={`my-auto flex items-center justify-center gap-6 transition-all duration-200 ${
            areControlsVisible
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* LEFT: Circular counter-clockwise arrow with large clearly visible 5 inside */}
          <button
            type="button"
            data-testid="video-seek-backward-btn"
            onClick={(e) => seekDelta(-5, e)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 text-white flex items-center justify-center transition shadow-xl backdrop-blur-xs border border-white/20 select-none cursor-pointer group"
            title="Seek backward 5 seconds"
            aria-label="Seek backward 5 seconds"
          >
            <SeekBackward5Icon className="w-7 h-7 text-white group-hover:text-teal-300 transition-colors" />
          </button>

          {/* CENTER: One Play/Pause button */}
          <button
            type="button"
            data-testid="video-play-pause-btn"
            onClick={togglePlay}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-black/70 hover:bg-black/90 active:scale-90 text-white flex items-center justify-center transition shadow-2xl backdrop-blur-xs border border-white/25 select-none cursor-pointer"
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
            onClick={(e) => seekDelta(5, e)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 text-white flex items-center justify-center transition shadow-xl backdrop-blur-xs border border-white/20 select-none cursor-pointer group"
            title="Seek forward 5 seconds"
            aria-label="Seek forward 5 seconds"
          >
            <SeekForward5Icon className="w-7 h-7 text-white group-hover:text-teal-300 transition-colors" />
          </button>
        </div>
      )}

      {/* C. Bottom Timeline & Duration Controls */}
      <div
        className={`mt-auto w-full flex flex-col gap-1 transition-all duration-200 ${
          !shouldRenderCenterControls || areControlsVisible
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Thin Timeline (in Reels mode when visible, or when toggled open in Feed) */}
        {(isTimelineOpen || shouldRenderCenterControls) && (
          <div
            data-testid="expandable-timeline-container"
            className="w-full py-0.5 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={progressBarRef}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={duration || 100}
              aria-valuenow={effectiveTime}
              aria-label="Video scrubber"
              tabIndex={0}
              data-testid="video-progress-bar"
              onPointerDown={handlePointerDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="relative w-full h-3 flex items-center cursor-pointer touch-none"
            >
              {/* Clean thin progress line without any background panel, card, box, or border */}
              <div className="w-full h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>

              {/* Small progress indicator knob */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-xs"
                style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        )}

        {/* Compact bottom bar: Clean M:SS time display (no heavy box in Reels), plus Sound Toggle in Feed */}
        <div className="flex items-center justify-between gap-2 w-full">
          {/* Tappable Duration / Time Display (M:SS format) */}
          <button
            type="button"
            data-testid="video-duration-toggle-btn"
            onClick={toggleTimeline}
            className={
              shouldRenderCenterControls
                ? 'text-[11px] font-mono flex items-center gap-1 cursor-pointer select-none text-white/90 drop-shadow-sm py-0.5'
                : `px-2.5 py-1 rounded-full border backdrop-blur-xs text-[11px] font-mono flex items-center gap-1 cursor-pointer transition select-none shadow-xs ${
                    isTimelineOpen
                      ? 'bg-teal-950/80 border-teal-500/50 text-white'
                      : 'bg-black/60 hover:bg-black/80 border-white/10 text-white/90'
                  }`
            }
            title={isTimelineOpen ? 'Click to hide timeline' : 'Click to view and drag timeline'}
            aria-label="Toggle playback timeline"
          >
            <span data-testid="video-current-time" className="text-teal-300 font-semibold">
              {formatTime(effectiveTime)}
            </span>
            <span className="text-white/50">/</span>
            <span data-testid="video-duration-time" className="text-white/80">
              {formatTime(duration)}
            </span>
          </button>

          {/* Right Controls: Sound Mute/Unmute & Optional Watch Reel */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="video-sound-toggle-btn"
              onClick={onToggleMute}
              className={`p-1.5 rounded-full border transition cursor-pointer flex items-center justify-center backdrop-blur-xs shadow-xs ${
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
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onOpenReel(effectiveTime);
                }}
                className="p-1.5 rounded-full bg-purple-950/70 hover:bg-purple-900 border border-purple-500/40 text-purple-200 transition cursor-pointer flex items-center justify-center backdrop-blur-xs shadow-xs"
                title="Watch in Reels with position continuity"
                aria-label="Watch in Reels"
              >
                <Film className="w-3.5 h-3.5 text-purple-300" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedVideoControls;
