import React, { useState } from 'react';
import { AlertCircle, Film } from 'lucide-react';
import { CommunityPost } from '../types/community';

export interface CommunityVideoPlayerProps {
  src?: string;
  poster?: string;
  className?: string;
  title?: string;
}

/**
 * Robust video player component with graceful fallback.
 * Prevents silent black rectangles when a video URL is invalid, revoked, or unplayable.
 */
export const CommunityVideoPlayer: React.FC<CommunityVideoPlayerProps> = ({
  src,
  poster,
  className = 'w-full max-h-[520px] object-cover bg-black',
  title = 'Video',
}) => {
  const [hasError, setHasError] = useState(false);

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
    <div className="relative w-full overflow-hidden flex items-center justify-center bg-black">
      <video
        src={src}
        controls
        playsInline
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
