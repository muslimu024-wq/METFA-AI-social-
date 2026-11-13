import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
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
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);

  // Expandable timeline state: hidden by default, revealed on clicking duration/time
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);
  const hideTimelineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressBarRef = useRef<HTMLDivElement | null>(null);

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

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoRef, isScrubbing]);

  // Clean up hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimelineTimeoutRef.current) {
        clearTimeout(hideTimelineTimeoutRef.current);
      }
    };
  }, []);

  // Schedule auto-hide of timeline after seeking is completed or after a period of inactivity
  const scheduleTimelineAutoHide = useCallback((delayMs: number = 3500) => {
    if (hideTimelineTimeoutRef.current) {
      clearTimeout(hideTimelineTimeoutRef.current);
    }
    hideTimelineTimeoutRef.current = setTimeout(() => {
      setIsTimelineOpen(false);
    }, delayMs);
  }, []);

  // Toggle timeline visibility on clicking the duration display
  const toggleTimeline = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsTimelineOpen((prev) => {
      const nextState = !prev;
      if (nextState) {
        scheduleTimelineAutoHide(4000);
      } else if (hideTimelineTimeoutRef.current) {
        clearTimeout(hideTimelineTimeoutRef.current);
      }
      return nextState;
    });
  };

  // Toggle Play / Pause
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Determine dynamic seek interval based on video duration:
  // - Duration below 3 minutes (< 180 seconds): 5 seconds
  // - Duration of 3 minutes or longer (>= 180 seconds): 10 seconds
  const effectiveDuration = duration > 0 ? duration : (videoRef.current?.duration || 0);
  const seekInterval = effectiveDuration >= 180 ? 10 : 5;

  // Perform seek with boundary clamping and immediate synchronous update
  const seekDelta = useCallback(
    (deltaSeconds: number, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      const video = videoRef.current;
      if (!video) return;

      const maxDuration = duration > 0 ? duration : (video.duration || 60);
      const current = video.currentTime || 0;
      // Clamp strictly between 0 and actual duration
      const targetTime = Math.max(0, Math.min(maxDuration, current + deltaSeconds));

      video.currentTime = targetTime;
      setCurrentTime(targetTime);

      // If timeline is open, reset auto-hide timer
      if (isTimelineOpen) {
        scheduleTimelineAutoHide(3500);
      }
    },
    [videoRef, duration, isTimelineOpen, scheduleTimelineAutoHide]
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
    if (hideTimelineTimeoutRef.current) clearTimeout(hideTimelineTimeoutRef.current);
    setIsScrubbing(true);
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
      scheduleTimelineAutoHide(3000);
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
    if (hideTimelineTimeoutRef.current) clearTimeout(hideTimelineTimeoutRef.current);
    setIsScrubbing(true);
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
    scheduleTimelineAutoHide(3000);
  };

  const effectiveTime = scrubPreviewTime !== null ? scrubPreviewTime : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      data-testid="advanced-video-controls"
      className={`relative z-30 select-none flex flex-col gap-1 w-full max-w-full transition-all pointer-events-auto ${className}`}
    >
      {/* 1. Main Minimal Controls Bar (Play, Backward Seek, Inline Duration/Time, Forward Seek, Sound, Reel Opener) */}
      <div className="flex items-center justify-between gap-1.5 w-full">
        {/* Play/Pause button */}
        <button
          type="button"
          data-testid="video-play-pause-btn"
          onClick={togglePlay}
          className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white border border-white/10 backdrop-blur-xs transition cursor-pointer flex items-center justify-center shadow-xs shrink-0"
          title={isPlaying ? 'Pause video' : 'Play video'}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-white" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
          )}
        </button>

        {/* Center Seek & Duration Group: [Backward Seek] [Inline Duration / Time] [Forward Seek] */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Dynamic Backward Seek: exactly ONE button showing selected interval (5s or 10s) */}
          <button
            type="button"
            data-testid="video-seek-backward-btn"
            data-seek-interval={seekInterval}
            onClick={(e) => seekDelta(-seekInterval, e)}
            className="px-2 py-1 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white/95 border border-white/10 backdrop-blur-xs text-[10px] font-mono font-bold flex items-center gap-1 transition select-none cursor-pointer shadow-xs shrink-0"
            title={`Skip backward ${seekInterval} seconds`}
            aria-label={`Skip backward ${seekInterval} seconds`}
          >
            <RotateCcw className="w-3 h-3 text-teal-300 shrink-0" />
            <span>{seekInterval}s</span>
          </button>

          {/* Compact Inline Time / Duration Display (Toggles expandable timeline) */}
          <button
            type="button"
            data-testid="video-duration-toggle-btn"
            onClick={toggleTimeline}
            className={`px-2.5 py-1 rounded-full border backdrop-blur-xs text-[11px] font-mono flex items-center gap-1 cursor-pointer transition select-none shadow-xs shrink-0 ${
              isTimelineOpen
                ? 'bg-teal-950/80 border-teal-500/50 text-white'
                : 'bg-black/60 hover:bg-black/80 border-white/10 text-white/90'
            }`}
            title={isTimelineOpen ? 'Click to hide timeline' : 'Click to view and drag timeline'}
            aria-label="Toggle playback timeline"
          >
            <span data-testid="video-current-time" className="text-teal-300 font-semibold">
              {formatTime(effectiveTime)}
            </span>
            <span className="text-white/40">/</span>
            <span data-testid="video-duration-time" className="text-slate-300">
              {formatTime(duration)}
            </span>
          </button>

          {/* Dynamic Forward Seek: exactly ONE button showing selected interval (5s or 10s) */}
          <button
            type="button"
            data-testid="video-seek-forward-btn"
            data-seek-interval={seekInterval}
            onClick={(e) => seekDelta(seekInterval, e)}
            className="px-2 py-1 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white/95 border border-white/10 backdrop-blur-xs text-[10px] font-mono font-bold flex items-center gap-1 transition select-none cursor-pointer shadow-xs shrink-0"
            title={`Skip forward ${seekInterval} seconds`}
            aria-label={`Skip forward ${seekInterval} seconds`}
          >
            <span>{seekInterval}s</span>
            <RotateCw className="w-3 h-3 text-teal-300 shrink-0" />
          </button>
        </div>

        {/* Right Side: Sound Toggle & Optional Continuity Opener */}
        <div className="flex items-center gap-1.5 shrink-0">
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

      {/* 2. Expandable Thin Directly Draggable Timeline (NO card, background, box, or filled overlay) */}
      {isTimelineOpen && (
        <div
          data-testid="expandable-timeline-container"
          className="w-full pt-1.5 pb-0.5 select-none"
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
            {/* Minimal thin line without background box/panel/decorative track container */}
            <div className="w-full h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>

            {/* Small minimal progress indicator dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-xs"
              style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedVideoControls;
