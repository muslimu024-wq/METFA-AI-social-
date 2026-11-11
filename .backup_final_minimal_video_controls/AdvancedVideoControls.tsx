import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
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

function formatTime(seconds: number): string {
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

    // Initial check
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
    },
    [videoRef, duration]
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
  };

  const effectiveTime = scrubPreviewTime !== null ? scrubPreviewTime : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;

  // Adaptive logic: If video duration < 25s, prioritize 5s skip; if >= 25s, provide clear 10s skip controls
  const isShortVideo = duration > 0 && duration < 25;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      data-testid="advanced-video-controls"
      className={`relative z-30 select-none flex flex-col gap-2 p-2.5 rounded-2xl border transition-all ${
        theme === 'glass'
          ? 'bg-black/85 backdrop-blur-md border-white/15 text-white shadow-xl'
          : 'bg-gray-950/95 border-gray-800 text-white shadow-2xl'
      } ${className}`}
    >
      {/* 1. Draggable & Tappable Progress Bar / Timeline */}
      <div className="flex flex-col gap-1 w-full">
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
          className="relative w-full h-4 flex items-center cursor-pointer group/timeline py-1 touch-none"
        >
          {/* Background Track */}
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden transition-all group-hover/timeline:h-2">
            {/* Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-purple-500 rounded-full transition-[width] duration-75 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>

          {/* Draggable Scrubber Knob */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md border border-purple-400 transition-transform ${
              isScrubbing ? 'scale-125 ring-2 ring-teal-400' : 'scale-90 group-hover/timeline:scale-110'
            }`}
            style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>

        {/* Timestamps */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 px-0.5">
          <span data-testid="video-current-time" className="text-teal-300 font-semibold">
            {formatTime(effectiveTime)}
          </span>
          <span data-testid="video-duration-time" className="text-slate-400">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 2. Playback Button Controls (Adaptive 5s / 10s skip, Play/Pause, Sound) */}
      <div className="flex items-center justify-between gap-1 w-full pt-0.5">
        {/* Left Side: Skip Backward Controls */}
        <div className="flex items-center gap-1">
          {/* 10-Second Backward Control (Clear on longer videos, compact badge) */}
          <button
            type="button"
            data-testid="video-skip-back-10-btn"
            onClick={(e) => seekDelta(-10, e)}
            className={`p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition text-white flex items-center justify-center gap-0.5 cursor-pointer ${
              isShortVideo ? 'opacity-80' : 'opacity-100'
            }`}
            title="Skip backward 10 seconds"
            aria-label="Skip backward 10 seconds"
          >
            <RotateCcw className="w-3.5 h-3.5 text-teal-300" />
            <span className="text-[10px] font-extrabold font-mono text-teal-300">10s</span>
          </button>

          {/* 5-Second Backward Control */}
          <button
            type="button"
            data-testid="video-skip-back-5-btn"
            onClick={(e) => seekDelta(-5, e)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition text-white flex items-center justify-center gap-0.5 cursor-pointer"
            title="Skip backward 5 seconds"
            aria-label="Skip backward 5 seconds"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-200" />
            <span className="text-[10px] font-bold font-mono text-slate-200">5s</span>
          </button>
        </div>

        {/* Center: Play / Pause Button */}
        <button
          type="button"
          data-testid="video-play-pause-btn"
          onClick={togglePlay}
          className="p-2 rounded-full bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white shadow-md active:scale-90 transition cursor-pointer flex items-center justify-center min-w-[36px] min-h-[36px]"
          title={isPlaying ? 'Pause video' : 'Play video'}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white translate-x-0.5" />
          )}
        </button>

        {/* Right Side: Skip Forward Controls & Sound */}
        <div className="flex items-center gap-1">
          {/* 5-Second Forward Control */}
          <button
            type="button"
            data-testid="video-skip-fwd-5-btn"
            onClick={(e) => seekDelta(5, e)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition text-white flex items-center justify-center gap-0.5 cursor-pointer"
            title="Skip forward 5 seconds"
            aria-label="Skip forward 5 seconds"
          >
            <span className="text-[10px] font-bold font-mono text-slate-200">5s</span>
            <RotateCw className="w-3.5 h-3.5 text-slate-200" />
          </button>

          {/* 10-Second Forward Control */}
          <button
            type="button"
            data-testid="video-skip-fwd-10-btn"
            onClick={(e) => seekDelta(10, e)}
            className={`p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition text-white flex items-center justify-center gap-0.5 cursor-pointer ${
              isShortVideo ? 'opacity-80' : 'opacity-100'
            }`}
            title="Skip forward 10 seconds"
            aria-label="Skip forward 10 seconds"
          >
            <span className="text-[10px] font-extrabold font-mono text-teal-300">10s</span>
            <RotateCw className="w-3.5 h-3.5 text-teal-300" />
          </button>

          {/* Sound Toggle Button */}
          <button
            type="button"
            data-testid="video-sound-toggle-btn"
            onClick={onToggleMute}
            className={`p-1.5 rounded-xl border transition cursor-pointer flex items-center justify-center ${
              isMuted
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-300 hover:bg-rose-900/80'
                : 'bg-teal-950/70 border-teal-500/40 text-teal-300 hover:bg-teal-900/80'
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

          {/* Optional: Open in Reels with Position Continuity */}
          {onOpenReel && (
            <button
              type="button"
              data-testid="video-open-reels-continuity-btn"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenReel(effectiveTime);
              }}
              className="p-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/40 text-purple-200 transition cursor-pointer flex items-center justify-center"
              title="Watch in Reels with position continuity"
              aria-label="Watch in Reels"
            >
              <Film className="w-3.5 h-3.5 text-purple-300" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedVideoControls;
