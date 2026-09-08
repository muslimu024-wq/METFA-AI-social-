import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioMessagePlayerProps {
  src: string;
  duration?: number;
  isCurrentUser?: boolean;
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({
  src,
  duration = 0,
  isCurrentUser = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState<number>(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (duration > 0) {
      setLoadedDuration(duration);
    }
  }, [duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Voice play error:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      setLoadedDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = loadedDuration > 0 ? (currentTime / loadedDuration) * 100 : 0;

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 py-1 px-1 min-w-[200px] sm:min-w-[240px] select-none ${
      isCurrentUser ? 'text-white' : 'text-slate-800'
    }`}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95 ${
          isCurrentUser
            ? 'bg-white text-teal-700 hover:bg-slate-100'
            : 'bg-teal-600 text-white hover:bg-teal-700'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform / Progress Slider */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-0.5 h-6">
          {/* Simulated waveform bars */}
          {[12, 20, 16, 28, 24, 18, 26, 32, 22, 14, 20, 28, 16, 22, 18, 12].map((height, i) => {
            const barProgress = (i / 16) * 100;
            const isPassed = progressPercent >= barProgress;
            return (
              <div
                key={i}
                className="flex-1 flex items-center justify-center h-full cursor-pointer"
                onClick={() => {
                  if (audioRef.current && loadedDuration > 0) {
                    const target = (i / 16) * loadedDuration;
                    audioRef.current.currentTime = target;
                    setCurrentTime(target);
                  }
                }}
              >
                <div
                  className={`w-full rounded-full transition-all duration-100 ${
                    isCurrentUser
                      ? isPassed
                        ? 'bg-white'
                        : 'bg-white/40 hover:bg-white/60'
                      : isPassed
                      ? 'bg-teal-600'
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                  style={{ height: `${height}%`, maxHeight: '100%' }}
                />
              </div>
            );
          })}
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between text-[10px] font-mono mt-0.5 opacity-80">
          <span>{formatTime(currentTime > 0 ? currentTime : loadedDuration)}</span>
          <span className="flex items-center gap-1">
            <Volume2 className="w-2.5 h-2.5" />
            <span>Voice</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioMessagePlayer;
