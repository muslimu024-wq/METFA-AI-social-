import React, { useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Sparkles,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CommunityPost } from '../types/community';
import { TextSeriesNavigationContext, recordTextReadingProgress } from '../utils/videoSeries';

interface TextSeriesNavigationBarProps {
  nav: TextSeriesNavigationContext;
  currentPostId: string;
  onNavigateToPart: (targetPost: CommunityPost) => void;
  variant?: 'light' | 'gradient';
}

export const TextSeriesNavigationBar: React.FC<TextSeriesNavigationBarProps> = ({
  nav,
  currentPostId,
  onNavigateToPart,
  variant = 'light',
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isGradient = variant === 'gradient';
  const containerClass = isGradient
    ? 'mx-4 mt-3 mb-1 rounded-2xl border border-white/25 bg-black/35 backdrop-blur-md text-white p-3 space-y-2.5'
    : 'mx-4 mt-2 mb-1 rounded-2xl border border-purple-200/90 bg-purple-50/70 text-slate-900 p-3 space-y-2.5';

  const handleJump = (target: CommunityPost) => {
    recordTextReadingProgress({
      postId: target.id,
      seriesId: nav.seriesId,
      creatorId: nav.creatorId,
      partNumber: target.series?.partNumber || 1,
      totalParts: nav.totalDisplayParts,
    });
    setIsDrawerOpen(false);
    onNavigateToPart(target);
  };

  const partLabel = nav.totalDisplayParts
    ? `Part ${nav.currentPartNumber} of ${nav.totalDisplayParts}`
    : `Part ${nav.currentPartNumber}`;

  return (
    <div
      data-testid={`text-series-nav-${currentPostId}`}
      className={containerClass}
    >
      {/* Series Identity Row */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <BookOpen
              className={`w-3.5 h-3.5 shrink-0 ${isGradient ? 'text-teal-300' : 'text-purple-600'}`}
            />
            <span
              className={`text-xs font-extrabold truncate ${
                isGradient ? 'text-white' : 'text-slate-900'
              }`}
            >
              {nav.seriesTitle}
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums ${
                isGradient
                  ? 'bg-white/15 text-teal-200 border border-white/20'
                  : 'bg-purple-100 text-purple-800 border border-purple-200'
              }`}
            >
              {partLabel}
            </span>
            {nav.isOngoing && (
              <span
                data-testid={`text-series-ongoing-badge-${currentPostId}`}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                  isGradient
                    ? 'bg-teal-400/20 text-teal-200 border border-teal-300/30'
                    : 'bg-teal-50 text-teal-800 border border-teal-200'
                }`}
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>More parts coming soon</span>
              </span>
            )}
          </div>

          <p
            className={`text-[11px] mt-0.5 truncate ${
              isGradient ? 'text-white/75' : 'text-slate-600'
            }`}
          >
            Serial story by <span className="font-semibold">{nav.creatorName}</span>
            {nav.seriesDescription ? ` · ${nav.seriesDescription}` : ''}
          </p>
        </div>

        {/* View All Parts Drawer Toggle */}
        <button
          type="button"
          data-testid={`text-series-all-parts-btn-${currentPostId}`}
          onClick={() => setIsDrawerOpen((prev) => !prev)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0 border ${
            isGradient
              ? 'bg-white/15 hover:bg-white/25 text-white border-white/20'
              : 'bg-white hover:bg-purple-50 text-purple-700 border-purple-200'
          }`}
        >
          <List className="w-3 h-3" />
          <span>View All Parts ({nav.accessibleParts.length})</span>
          {isDrawerOpen ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Serial Navigation Controls: Previous Part / Continue Reading / Next Part */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-black/5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={!nav.previousPart}
            data-testid={`text-series-prev-btn-${currentPostId}`}
            onClick={() => nav.previousPart && handleJump(nav.previousPart)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition border ${
              nav.previousPart
                ? isGradient
                  ? 'bg-white/15 hover:bg-white/25 text-white border-white/25 cursor-pointer'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 cursor-pointer'
                : isGradient
                ? 'bg-white/5 text-white/35 border-white/10 cursor-not-allowed'
                : 'bg-slate-100/70 text-slate-400 border-slate-200/70 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous Part</span>
          </button>

          <button
            type="button"
            disabled={!nav.nextPart}
            data-testid={`text-series-next-btn-${currentPostId}`}
            onClick={() => nav.nextPart && handleJump(nav.nextPart)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition border ${
              nav.nextPart
                ? isGradient
                  ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 border-teal-400 cursor-pointer'
                  : 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 cursor-pointer'
                : isGradient
                ? 'bg-white/5 text-white/35 border-white/10 cursor-not-allowed'
                : 'bg-slate-100/70 text-slate-400 border-slate-200/70 cursor-not-allowed'
            }`}
          >
            <span>Next Part</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {nav.continueReadingPart && (
          <button
            type="button"
            data-testid={`text-series-continue-btn-${currentPostId}`}
            onClick={() => nav.continueReadingPart && handleJump(nav.continueReadingPart)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border ${
              isGradient
                ? 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border-amber-300/40'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>
              Continue Reading (Part {nav.continueReadingPart.series?.partNumber || 1})
            </span>
          </button>
        )}
      </div>

      {/* Ordered All Parts Drawer */}
      {isDrawerOpen && (
        <div
          data-testid={`text-series-drawer-${currentPostId}`}
          className={`rounded-xl p-2 space-y-1 max-h-56 overflow-y-auto border ${
            isGradient
              ? 'bg-black/45 border-white/20 text-white'
              : 'bg-white border-purple-200 text-slate-900'
          }`}
        >
          {nav.accessibleParts.map((partPost) => {
            const pNum = partPost.series?.partNumber || 1;
            const isCurrent = partPost.id === currentPostId;
            const excerpt = (partPost.caption || partPost.prompt || 'Untitled Part')
              .replace(/\s+/g, ' ')
              .slice(0, 72);
            return (
              <button
                key={partPost.id}
                type="button"
                data-testid={`text-series-drawer-item-${partPost.id}`}
                onClick={() => handleJump(partPost)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                  isCurrent
                    ? isGradient
                      ? 'bg-teal-500/30 border border-teal-300/40 text-white font-bold'
                      : 'bg-purple-50 border border-purple-300 text-purple-900 font-bold'
                    : isGradient
                    ? 'hover:bg-white/10 text-white/90'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 tabular-nums ${
                      isGradient
                        ? 'bg-white/15 text-teal-200'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    Part {pNum}
                  </span>
                  <span className="truncate">{excerpt}</span>
                </div>
                {isCurrent && (
                  <span
                    className={`text-[10px] shrink-0 font-semibold ${
                      isGradient ? 'text-teal-200' : 'text-purple-700'
                    }`}
                  >
                    Reading
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TextSeriesNavigationBar;
