import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, Layers } from 'lucide-react';

export interface MediaCarouselProps {
  images: string[];
  altBase?: string;
  onSlideView?: (slideIndex: number, totalSlides: number) => void;
  onImageClick?: (imageUrl: string, slideIndex: number) => void;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  images,
  altBase = 'Post visual',
  onSlideView,
  onImageClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel');
  const touchStartXRef = useRef<number | null>(null);

  if (!Array.isArray(images) || images.length === 0) return null;

  const totalSlides = images.length;

  const goToSlide = (nextIdx: number) => {
    const bounded = Math.max(0, Math.min(totalSlides - 1, nextIdx));
    if (bounded === currentIndex) return;
    setCurrentIndex(bounded);
    if (onSlideView) {
      onSlideView(bounded, totalSlides);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToSlide(currentIndex > 0 ? currentIndex - 1 : totalSlides - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToSlide(currentIndex < totalSlides - 1 ? currentIndex + 1 : 0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = touchStartXRef.current - endX;
    touchStartXRef.current = null;
    if (Math.abs(diff) > 36) {
      if (diff > 0 && currentIndex < totalSlides - 1) {
        goToSlide(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        goToSlide(currentIndex - 1);
      }
    }
  };

  if (viewMode === 'grid') {
    return (
      <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-200/80 mb-3">
        <div className="absolute top-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setViewMode('carousel');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/85 text-white text-xs font-medium backdrop-blur-sm transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Carousel</span>
          </button>
        </div>
        <div
          className={`grid gap-1 ${
            images.length === 2
              ? 'grid-cols-2'
              : images.length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {images.map((src, idx) => (
            <button
              key={`${src}_${idx}`}
              type="button"
              onClick={() => {
                onSlideView?.(idx, totalSlides);
                onImageClick?.(src, idx);
              }}
              className="relative aspect-square overflow-hidden bg-slate-800 group cursor-pointer focus:outline-none"
            >
              <img
                src={src}
                alt={`${altBase} slide ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/65 text-[10px] font-semibold text-white tabular-nums">
                {idx + 1}/{totalSlides}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-200/80 mb-3 select-none group"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar Overlay */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none">
        <span className="px-2.5 py-1 rounded-lg bg-black/70 text-white text-xs font-semibold backdrop-blur-sm tabular-nums">
          {currentIndex + 1} / {totalSlides}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setViewMode('grid');
          }}
          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/85 text-white text-xs font-medium backdrop-blur-sm transition cursor-pointer"
          title="View all slides in grid"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>
      </div>

      {/* Active Slide Image */}
      <div
        onClick={() => onImageClick?.(images[currentIndex], currentIndex)}
        className="w-full aspect-[4/3] sm:aspect-[16/11] max-h-[460px] flex items-center justify-center bg-slate-950 cursor-pointer"
      >
        <img
          src={images[currentIndex]}
          alt={`${altBase} slide ${currentIndex + 1} of ${totalSlides}`}
          className="w-full h-full object-contain transition-opacity duration-200"
        />
      </div>

      {/* Previous / Next Navigation Buttons */}
      {totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous slide"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center shadow-md backdrop-blur-sm transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next slide"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center shadow-md backdrop-blur-sm transition cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Slide Indicator Dots */}
      {totalSlides > 1 && (
        <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5 z-10 pointer-events-none">
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(idx);
              }}
              className={`pointer-events-auto h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaCarousel;
