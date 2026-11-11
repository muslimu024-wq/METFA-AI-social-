import React, { useState, useRef } from 'react';
import { AlertCircle, Film, Volume2, VolumeX } from 'lucide-react';
import { CommunityPost } from '../types/community';

export interface CommunityVideoPlayerProps {
  src?: string;
  poster?: string;
  className?: string;
  title?: string;
  isReel?: boolean;
  reelId?: string;
  onOpenReel?: (reelId: string, payload?: { videoSrc?: string; title?: string }) => void;
}

/**
 * Robust video player component with graceful fallback and Feed-to-Reels navigation.
 * Prevents silent black rectangles when a video URL is invalid, revoked, or unplayable.
 */
export const CommunityVideoPlayer: React.FC<CommunityVideoPlayerProps> = ({
  src,
  poster,
  className = 'w-full max-h-[520px] object-cover bg-black',
  title = 'Video',
  isReel = false,
  reelId,
  onOpenReel,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isFeedMuted, setIsFeedMuted] = useState(true);
  const lastNavTimeRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Touch gesture scroll detection to prevent accidental navigation while scrolling on mobile
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isTouchScrollingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isTouchScrollingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPosRef.current && e.touches && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      if (dx > 8 || dy > 8) {
        // Finger moved > 8px, user is scrolling the feed
        isTouchScrollingRef.current = true;
      }
    }
  };

  const handleOpenReelClick = (e: React.MouseEvent | React.TouchEvent) => {
    // If user was scrolling, cancel navigation immediately
    if (isTouchScrollingRef.current) {
      isTouchScrollingRef.current = false;
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    const now = Date.now();
    if (now - lastNavTimeRef.current < 400) return;
    lastNavTimeRef.current = now;

    if (reelId) {
      console.log('[Metfa Nav] Reel video picture tapped:', reelId, title);
      if (onOpenReel) {
        try {
          onOpenReel(reelId, { videoSrc: src, title });
        } catch (err) {
          console.warn('[Metfa Nav] onOpenReel error:', err);
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('metfa_open_reel', { detail: { reelId, videoSrc: src, title } })
        );
      }
    }
  };

  const handleToggleFeedSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsFeedMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
        if (!next) {
          videoRef.current.play().catch(() => {});
        }
      }
      return next;
    });
  };

  // If no source is provided or if video failed to load, display friendly error state
  if (!src || hasError) {
    return (
      <div className="w-full h-64 bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300 gap-2.5 border border-slate-800">
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-500">
          <AlertCircle className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-200">Video unavailable</p>
        <p className="text-xs text-slate-500 text-center max-w-xs">
          This video media could not be loaded or the upload did not complete.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden flex items-center justify-center bg-black group/videoplayer">
      {/* Tap/Click directly on visible video picture area to open in Reels view */}
      {reelId && (
        <div
          role="button"
          tabIndex={0}
          data-testid={`feed-reel-video-picture-area-${reelId}`}
          onClick={handleOpenReelClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="absolute inset-x-0 top-0 bottom-14 z-20 cursor-pointer bg-black/0 active:bg-white/5 transition-colors focus:outline-none select-none touch-manipulation"
          title="Watch Reel"
          aria-label={`Watch ${title} in Reels`}
        />
      )}

      {/* Accessible Watch Reel badge (Top Left) */}
      {reelId && (
        <button
          type="button"
          data-testid={`feed-reel-nav-btn-${reelId}`}
          onClick={handleOpenReelClick}
          className="absolute top-3 left-3 z-30 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black text-white border border-teal-500/50 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-xl transition transform active:scale-95 cursor-pointer pointer-events-auto"
          title="Watch fullscreen in Reels feed"
          aria-label={`Watch ${title} in Reels`}
        >
          <Film className="w-3.5 h-3.5 text-teal-400 shrink-0 animate-pulse" />
          <span className="text-[11px] font-semibold text-teal-300">Watch Reel</span>
          <span className="text-[10px] text-slate-400 font-mono">→</span>
        </button>
      )}

      {/* Visible Feed Sound Mute / Unmute Button (Top Right) */}
      <button
        type="button"
        data-testid={`feed-video-sound-btn-${reelId || 'video'}`}
        onClick={handleToggleFeedSound}
        className={`absolute top-3 right-3 z-30 p-2 rounded-full backdrop-blur-md border transition cursor-pointer flex items-center justify-center pointer-events-auto ${
          isFeedMuted
            ? 'bg-black/70 border-white/20 text-slate-300 hover:text-white'
            : 'bg-teal-950/80 border-teal-500/50 text-teal-300 hover:bg-teal-900 shadow-sm shadow-teal-500/20'
        }`}
        title={isFeedMuted ? 'Unmute video sound' : 'Mute video sound'}
        aria-label={isFeedMuted ? 'Unmute video sound' : 'Mute video sound'}
      >
        {isFeedMuted ? (
          <VolumeX className="w-4 h-4 text-slate-300" />
        ) : (
          <Volume2 className="w-4 h-4 text-teal-300 animate-pulse" />
        )}
      </button>

      {/* HTML5 video element: controls bar on bottom 56px is uncovered and protected against accidental navigation */}
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        muted={isFeedMuted}
        autoPlay
        poster={poster}
        aria-label={title}
        className={className}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

export interface CommunityPostCardProps {
  post: CommunityPost;
  priority?: boolean;
}

/**
 * CommunityPostCard — Renders social post cards with verified video error boundaries.
 */
export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  priority = false,
}) => {
  return (
    <article className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs mb-4">
      {/* Media Viewport */}
      {post.videoSrc ? (
        <CommunityVideoPlayer
          src={post.videoSrc}
          poster={post.videoThumbnail || post.imageSrc}
          title={post.videoTitle || post.prompt}
        />
      ) : post.imageSrc ? (
        <img
          src={post.imageSrc}
          alt={post.prompt || 'Post media'}
          loading={priority ? 'eager' : 'lazy'}
          className="w-full max-h-[520px] object-cover"
        />
      ) : null}

      {/* Post Text & Metadata */}
      <div className="p-4 space-y-2">
        {post.videoTitle && (
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Film className="w-4 h-4 text-purple-600 shrink-0" />
            <span>{post.videoTitle}</span>
          </h4>
        )}
        {post.caption && (
          <p className="text-sm text-slate-800 whitespace-pre-line">{post.caption}</p>
        )}
        {post.prompt && !post.caption && (
          <p className="text-sm text-slate-700">{post.prompt}</p>
        )}
      </div>
    </article>
  );
};

export default CommunityPostCard;
