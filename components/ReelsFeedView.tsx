import React, { useState } from 'react';
import {
  Film,
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  Plus,
  Play,
  Volume2,
  Repeat
} from 'lucide-react';
import { ReelHighlight, UserProfile } from '../types/community';
import { getReelHighlights, saveReelHighlights } from '../utils/socialStore';

interface ReelsFeedViewProps {
  reels: ReelHighlight[];
  onUpdateReels: (reels: ReelHighlight[]) => void;
  userProfile: UserProfile;
  onRemixPrompt: (prompt: string) => void;
  onCreateReelClick: () => void;
}

export const ReelsFeedView: React.FC<ReelsFeedViewProps> = ({
  reels,
  onUpdateReels,
  userProfile,
  onRemixPrompt,
  onCreateReelClick,
}) => {
  const handleLike = (id: string) => {
    const updated = reels.map((r) => {
      if (r.id === id) {
        const isLiked = !r.isLiked;
        return {
          ...r,
          isLiked,
          likesCount: isLiked ? r.likesCount + 1 : Math.max(0, r.likesCount - 1),
        };
      }
      return r;
    });
    onUpdateReels(updated);
    saveReelHighlights(updated);
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 py-4 space-y-6">
      <div className="flex items-center justify-between bg-gray-900/80 p-3 rounded-2xl border border-gray-800 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white">90s AI Creation Reels</h3>
        </div>

        <button
          type="button"
          onClick={onCreateReelClick}
          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-md transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Post Reel</span>
        </button>
      </div>

      {/* Vertical Reels Stack */}
      <div className="space-y-6">
        {reels.map((reel) => (
          <div
            key={reel.id}
            className="relative rounded-3xl overflow-hidden bg-black border border-gray-800 shadow-2xl aspect-[9/16] flex flex-col justify-between p-4"
          >
            {/* Video Background */}
            <video
              src={reel.videoSrc}
              poster={reel.thumbnailSrc}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

            {/* Top Bar */}
            <div className="relative z-10 flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-black/60 rounded-full font-bold text-teal-300 border border-white/10 backdrop-blur-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-teal-400" />
                  {reel.duration}s Reel
                </span>
              </div>
            </div>

            {/* Bottom Info & Right Actions */}
            <div className="relative z-10 flex items-end justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={reel.author.avatar}
                    alt={reel.author.name}
                    className="w-8 h-8 rounded-full border border-white/20 object-cover"
                  />
                  <span className="font-bold text-white text-xs">@{reel.author.username}</span>
                </div>

                <h4 className="text-sm font-extrabold text-white leading-tight drop-shadow-md">
                  {reel.title}
                </h4>
                <p className="text-xs text-gray-200 line-clamp-2 leading-relaxed drop-shadow">
                  {reel.caption}
                </p>

                {reel.promptUsed && (
                  <button
                    type="button"
                    onClick={() => onRemixPrompt(reel.promptUsed || '')}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Repeat className="w-3 h-3" />
                    <span>Remix Prompt</span>
                  </button>
                )}
              </div>

              {/* Right Action Icons */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleLike(reel.id)}
                  className="flex flex-col items-center gap-1 text-white group"
                >
                  <div
                    className={`p-2.5 rounded-full backdrop-blur-md transition ${
                      reel.isLiked ? 'bg-rose-600/90 text-white' : 'bg-black/60 group-hover:bg-black/80'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${reel.isLiked ? 'fill-current' : ''}`} />
                  </div>
                  <span className="text-[10px] font-bold">{reel.likesCount}</span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center gap-1 text-white group"
                >
                  <div className="p-2.5 rounded-full bg-black/60 group-hover:bg-black/80 backdrop-blur-md transition">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold">{reel.commentsCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Reel link copied!');
                  }}
                  className="flex flex-col items-center gap-1 text-white group"
                >
                  <div className="p-2.5 rounded-full bg-black/60 group-hover:bg-black/80 backdrop-blur-md transition">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold">{reel.sharesCount}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReelsFeedView;
