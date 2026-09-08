import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Columns2,
  Sliders,
  ArrowLeftRight,
  Maximize2,
  Download,
  Share2,
  Wand2,
  Sparkles,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Copy,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Undo2,
} from 'lucide-react';
import { GeneratedImageRecord } from '../types';
import { TransformationProgressSkeleton } from './TransformationProgressSkeleton';

interface SideBySideComparisonViewProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImage: GeneratedImageRecord | null;
  recentImages: GeneratedImageRecord[];
  onSelectImage: (image: GeneratedImageRecord) => void;
  onRetransform: (
    image: GeneratedImageRecord,
    customInstruction: string,
    stylePreset?: string
  ) => void;
  onUpscale: (image: GeneratedImageRecord) => Promise<void>;
  onShareToFeed?: (payload: { prompt: string; imageSrc: string; stylePreset?: string }) => void;
  isTransforming?: boolean;
  canUndo?: boolean;
  onUndo?: () => void;
}

type ComparisonMode = 'side-by-side' | 'split-slider' | 'cross-fade';

export const SideBySideComparisonView: React.FC<SideBySideComparisonViewProps> = ({
  isOpen,
  onClose,
  selectedImage,
  recentImages,
  onSelectImage,
  onRetransform,
  onUpscale,
  onShareToFeed,
  isTransforming = false,
  canUndo = false,
  onUndo,
}) => {
  const [mode, setMode] = useState<ComparisonMode>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 0 to 100%
  const [fadeOpacity, setFadeOpacity] = useState<number>(50); // 0 to 100%
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const [customOriginalSrc, setCustomOriginalSrc] = useState<string | null>(null);
  const [isUpscaling, setIsUpscaling] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showRetransformBar, setShowRetransformBar] = useState<boolean>(false);
  const [newTransformInstruction, setNewTransformInstruction] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // Reset custom reference when selectedImage changes
  useEffect(() => {
    setCustomOriginalSrc(null);
    setShowRetransformBar(false);
    setNewTransformInstruction('');
    setSelectedPreset('');
  }, [selectedImage?.id]);

  // Handle keyboard shortcuts (Escape to close, Left/Right for slider)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (mode === 'split-slider') {
        if (e.key === 'ArrowLeft') {
          setSliderPosition((prev) => Math.max(0, prev - 5));
        } else if (e.key === 'ArrowRight') {
          setSliderPosition((prev) => Math.min(100, prev + 5));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, onClose]);

  // Handle dragging the split slider
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  useEffect(() => {
    if (!isDraggingSlider) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleSliderMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleSliderMove(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => setIsDraggingSlider(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingSlider, handleSliderMove]);

  if (!isOpen || !selectedImage) return null;

  // Determine original uploaded / reference image
  // 1. Custom uploaded in modal
  // 2. originalImageSrc recorded on the record
  // 3. fallback: search other recent images or empty
  const activeOriginalSrc =
    customOriginalSrc ||
    selectedImage.originalImageSrc ||
    (selectedImage.isUpscaled ? selectedImage.imageSrc : null);

  const hasOriginal = Boolean(activeOriginalSrc);

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        if (loadEvt.target?.result) {
          setCustomOriginalSrc(loadEvt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = (src: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = src;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(selectedImage.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTriggerUpscale = async () => {
    if (isUpscaling) return;
    try {
      setIsUpscaling(true);
      await onUpscale(selectedImage);
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleExecuteRetransform = () => {
    const instruction = newTransformInstruction.trim() || 'Transform this visual with high quality';
    onRetransform(selectedImage, instruction, selectedPreset || undefined);
    setShowRetransformBar(false);
    onClose();
  };

  const currentIndex = recentImages.findIndex((img) => img.id === selectedImage.id);

  return (
    <div
      id="side-by-side-comparison-modal"
      className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col text-slate-100 animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        id="side-by-side-comparison-container"
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full flex flex-col overflow-hidden max-w-7xl mx-auto"
      >
        {/* Top Header Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gray-900/95 border-b border-gray-800 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-700/50 text-purple-300">
              <Columns2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Visual Transformation Comparison
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-950 border border-teal-700/50 text-teal-300 font-mono">
                  Before & After
                </span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">
                Side-by-side comparison of original source and AI transformed visual
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              id="compare-mode-side-by-side-btn"
              onClick={() => setMode('side-by-side')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                mode === 'side-by-side'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Side-by-side dual panel view"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Side-by-Side</span>
            </button>

            <button
              type="button"
              id="compare-mode-split-slider-btn"
              onClick={() => setMode('split-slider')}
              disabled={!hasOriginal}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === 'split-slider'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Interactive curtain split slider"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Curtain Slider</span>
            </button>

            <button
              type="button"
              id="compare-mode-cross-fade-btn"
              onClick={() => setMode('cross-fade')}
              disabled={!hasOriginal}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === 'cross-fade'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Opacity cross-fade overlay"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cross-Fade</span>
            </button>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isZoomed
                  ? 'bg-purple-900/60 border-purple-500 text-purple-200'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
              }`}
              title={isZoomed ? 'Reset zoom' : 'Fit/Fill view'}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>

            <button
              type="button"
              id="close-comparison-view-btn"
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition cursor-pointer"
              title="Close comparison view (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Comparison Stage */}
        <div className="flex-1 min-h-0 relative p-3 sm:p-5 flex flex-col justify-center items-center overflow-hidden">
          {/* Mode 1: Dual Panel Side-by-Side */}
          {mode === 'side-by-side' && (
            <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 min-h-0">
              {/* Left Column: Original Uploaded Image */}
              <div className="flex flex-col bg-gray-950/80 border border-gray-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl min-h-0">
                {/* Header Tag */}
                <div className="px-4 py-2.5 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                      Original Upload / Reference
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleCustomUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-1 text-[11px] font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700/60 transition flex items-center gap-1 cursor-pointer"
                      title="Upload or change source reference photo"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{hasOriginal ? 'Replace' : 'Upload Source'}</span>
                    </button>
                    {activeOriginalSrc && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDownload(activeOriginalSrc, `original-reference-${Date.now()}.png`)
                        }
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition cursor-pointer"
                        title="Download original reference"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Left Image Viewport */}
                <div className="flex-1 min-h-0 relative flex items-center justify-center bg-black/60 p-2 overflow-hidden">
                  {hasOriginal ? (
                    <img
                      src={activeOriginalSrc!}
                      alt="Original uploaded reference"
                      className={`max-w-full max-h-full transition-transform duration-200 rounded-lg ${
                        isZoomed ? 'object-cover w-full h-full scale-105' : 'object-contain'
                      }`}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white mb-1">
                          No uploaded reference attached
                        </h4>
                        <p className="text-xs text-gray-400">
                          This visual was generated from a prompt. You can upload an original photo to compare side-by-side or pick one from session visuals.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Select Reference Photo</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Left Footer Info */}
                <div className="px-4 py-2 bg-gray-900/40 border-t border-gray-800/60 text-[11px] text-gray-400 flex items-center justify-between shrink-0">
                  <span>Source Reference</span>
                  <span className="font-mono text-gray-500">
                    {hasOriginal ? 'Original Input' : 'Text Prompt Input'}
                  </span>
                </div>
              </div>

              {/* Right Column: AI Transformed Visual */}
              <div className="flex flex-col bg-gray-950/80 border border-gray-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl min-h-0">
                {/* Header Tag */}
                <div className="px-4 py-2.5 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                    <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-teal-400" />
                      <span>AI Transformed Visual</span>
                    </span>
                    {selectedImage.isUpscaled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-950 border border-teal-700/60 text-teal-300">
                        4K
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleTriggerUpscale}
                      disabled={isUpscaling}
                      className="px-2 py-1 text-[11px] font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700/60 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Super-resolution 4K upscale"
                    >
                      <Maximize2 className="w-3 h-3 text-teal-400" />
                      <span>{isUpscaling ? 'Upscaling...' : '4K Upscale'}</span>
                    </button>
                    {onShareToFeed && (
                      <button
                        type="button"
                        onClick={() => {
                          onShareToFeed({
                            prompt: selectedImage.prompt,
                            imageSrc: selectedImage.imageSrc,
                            stylePreset: selectedImage.stylePreset,
                          });
                          onClose();
                        }}
                        className="px-2 py-1 text-[11px] font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700/60 transition flex items-center gap-1 cursor-pointer"
                        title="Post artwork to Metfa Feed"
                      >
                        <Share2 className="w-3 h-3 text-indigo-400" />
                        <span className="hidden sm:inline">Post</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(selectedImage.imageSrc, `ai-transformed-${Date.now()}.png`)
                      }
                      className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition cursor-pointer"
                      title="Download transformed visual"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Right Image Viewport */}
                <div className="flex-1 min-h-0 relative flex items-center justify-center bg-black/60 p-2 overflow-hidden">
                  {isTransforming ? (
                    <div className="w-full h-full p-2 flex items-center justify-center overflow-y-auto">
                      <TransformationProgressSkeleton
                        prompt={newTransformInstruction || selectedImage.prompt}
                        stylePreset={selectedImage.stylePreset}
                        referenceImageSrc={activeOriginalSrc || undefined}
                        compact={true}
                      />
                    </div>
                  ) : (
                    <img
                      src={selectedImage.imageSrc}
                      alt={selectedImage.prompt}
                      className={`max-w-full max-h-full transition-transform duration-200 rounded-lg ${
                        isZoomed ? 'object-cover w-full h-full scale-105' : 'object-contain'
                      }`}
                    />
                  )}
                </div>

                {/* Right Footer Info */}
                <div className="px-4 py-2 bg-gray-900/40 border-t border-gray-800/60 text-[11px] text-gray-400 flex items-center justify-between shrink-0">
                  <span className="truncate max-w-[70%] font-mono text-purple-300">
                    {selectedImage.modelUsed || 'Gemini 3.7 Flash'}
                  </span>
                  <span>{new Date(selectedImage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Interactive Split Slider (Curtain Wipe) */}
          {mode === 'split-slider' && hasOriginal && (
            <div className="w-full h-full flex flex-col items-center justify-center min-h-0">
              <div
                ref={sliderContainerRef}
                onMouseDown={() => setIsDraggingSlider(true)}
                onTouchStart={() => setIsDraggingSlider(true)}
                className="relative w-full max-w-4xl h-full max-h-[70vh] bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800 cursor-ew-resize select-none"
              >
                {/* Background Image: Original Upload */}
                <img
                  src={activeOriginalSrc!}
                  alt="Original reference"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />

                {/* Foreground Image: Transformed (Clipped by slider position) */}
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <img
                    src={selectedImage.imageSrc}
                    alt="Transformed AI Visual"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{
                      width: sliderContainerRef.current
                        ? `${sliderContainerRef.current.clientWidth}px`
                        : '100%',
                      maxWidth: 'none',
                    }}
                  />
                </div>

                {/* Draggable Divider Line & Handle */}
                <div
                  className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-lg pointer-events-none"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-gray-950 flex items-center justify-center shadow-xl border-2 border-purple-600 cursor-ew-resize pointer-events-auto active:scale-110 transition-transform">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Interactive Overlay Badges */}
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/20 text-xs font-bold text-teal-300 pointer-events-none">
                  AI Transformed ({Math.round(sliderPosition)}%)
                </div>
                <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/20 text-xs font-bold text-amber-300 pointer-events-none">
                  Original Upload ({Math.round(100 - sliderPosition)}%)
                </div>
              </div>

              {/* Slider Range Bar */}
              <div className="w-full max-w-md mt-3 flex items-center gap-3">
                <span className="text-[11px] font-bold text-teal-400 shrink-0">Transformed</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={(e) => setSliderPosition(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-ew-resize"
                />
                <span className="text-[11px] font-bold text-amber-400 shrink-0">Original</span>
              </div>
            </div>
          )}

          {/* Mode 3: Cross-Fade (Overlay with Opacity) */}
          {mode === 'cross-fade' && hasOriginal && (
            <div className="w-full h-full flex flex-col items-center justify-center min-h-0">
              <div className="relative w-full max-w-4xl h-full max-h-[70vh] bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
                {/* Base Original Image */}
                <img
                  src={activeOriginalSrc!}
                  alt="Original reference"
                  className="absolute inset-0 w-full h-full object-contain"
                />

                {/* Overlaid Transformed Image with Opacity */}
                <img
                  src={selectedImage.imageSrc}
                  alt="Transformed visual"
                  className="absolute inset-0 w-full h-full object-contain transition-opacity duration-75"
                  style={{ opacity: fadeOpacity / 100 }}
                />

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                  Blend: {fadeOpacity}% Transformed / {100 - fadeOpacity}% Original
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="w-full max-w-md mt-3 flex items-center gap-3">
                <span className="text-[11px] font-bold text-amber-400 shrink-0">Original</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={fadeOpacity}
                  onChange={(e) => setFadeOpacity(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <span className="text-[11px] font-bold text-teal-400 shrink-0">Transformed</span>
              </div>
            </div>
          )}
        </div>

        {/* Prompt & Re-transformation Drawer Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gray-900/95 border-t border-gray-800 shrink-0 space-y-2.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            {/* Prompt details */}
            <div className="flex items-center gap-2 max-w-2xl">
              <p className="text-xs text-gray-300 italic line-clamp-1">
                "{selectedImage.prompt || 'Generated visual scene'}"
              </p>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="p-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer shrink-0"
                title="Copy prompt"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                id="comparison-retransform-toggle-btn"
                onClick={() => setShowRetransformBar(!showRetransformBar)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  showRetransformBar
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-950/70 hover:bg-purple-900/70 border border-purple-700/50 text-purple-300'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Re-transform Again</span>
              </button>

              {canUndo && onUndo && (
                <button
                  type="button"
                  id="comparison-undo-btn"
                  onClick={onUndo}
                  disabled={isTransforming}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Undo last transformation: Revert to previous visual (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Undo</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (activeOriginalSrc) {
                    handleDownload(activeOriginalSrc, `original-${selectedImage.id}.png`);
                  }
                  handleDownload(selectedImage.imageSrc, `transformed-${selectedImage.id}.png`);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700/60 transition flex items-center gap-1.5 cursor-pointer"
                title="Download both original and transformed images"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Both</span>
              </button>
            </div>
          </div>

          {/* Expanded Re-transformation Input */}
          {showRetransformBar && (
            <div className="pt-2 border-t border-gray-800 flex flex-col sm:flex-row gap-2 animate-fadeIn">
              <input
                type="text"
                value={newTransformInstruction}
                onChange={(e) => setNewTransformInstruction(e.target.value)}
                placeholder="Enter new transformation style or instruction (e.g. Cyberpunk neon, Anime sketch, 3D claymation)..."
                className="flex-1 bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleExecuteRetransform}
                disabled={isTransforming}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Apply Variation</span>
              </button>
            </div>
          )}

          {/* Filmstrip of Recent 10 Session Visuals */}
          <div className="pt-2 border-t border-gray-800/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1">
              Recent:
            </span>
            {recentImages.map((img, idx) => {
              const isSelected = img.id === selectedImage.id;
              return (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => onSelectImage(img)}
                  className={`relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition transform hover:scale-105 cursor-pointer ${
                    isSelected
                      ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105'
                      : 'border-gray-800 opacity-60 hover:opacity-100'
                  }`}
                  title={img.prompt || `Visual #${idx + 1}`}
                >
                  <img src={img.imageSrc} alt="" className="w-full h-full object-cover" />
                  {img.originalImageSrc && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teal-400 rounded-tl-sm" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideBySideComparisonView;
