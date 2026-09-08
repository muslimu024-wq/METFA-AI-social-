import React, { useState } from 'react';
import {
  X,
  Images,
  Wand2,
  Maximize2,
  Download,
  Copy,
  Check,
  Share2,
  Trash2,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Layers,
  ZoomIn,
  Columns2,
} from 'lucide-react';
import { GeneratedImageRecord } from '../types';

interface RecentImagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  images: GeneratedImageRecord[];
  onSelectForComparison?: (image: GeneratedImageRecord) => void;
  onRetransform: (
    image: GeneratedImageRecord,
    customInstruction: string,
    stylePreset?: string
  ) => void;
  onUpscale: (image: GeneratedImageRecord) => Promise<void>;
  onShareToFeed?: (payload: { prompt: string; imageSrc: string; stylePreset?: string }) => void;
  onClearImages: () => void;
  isTransforming?: boolean;
}

const TRANSFORMATION_PRESETS = [
  { id: 'cyberpunk', label: 'Cyberpunk 2088', style: 'Cyberpunk 2088' },
  { id: 'anime', label: 'Anime Studio Ghibli', style: 'Anime Studio Ghibli' },
  { id: 'photoreal', label: 'Photorealistic 8K', style: 'Photorealistic 8K' },
  { id: 'scifi', label: 'Cinematic Sci-Fi', style: 'Cinematic Sci-Fi' },
  { id: 'oil', label: 'Fantasy Oil Painting', style: 'Fantasy Oil Painting' },
  { id: 'surreal', label: 'Surrealist Dream', style: 'Surrealist Dream' },
  { id: '3d', label: 'Vibrant 3D Render', style: 'Vibrant 3D Render' },
  { id: 'watercolor', label: 'Watercolor', style: 'Watercolor Masterpiece' },
];

export const RecentImagesDrawer: React.FC<RecentImagesDrawerProps> = ({
  isOpen,
  onClose,
  images,
  onSelectForComparison,
  onRetransform,
  onUpscale,
  onShareToFeed,
  onClearImages,
  isTransforming = false,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTransformId, setActiveTransformId] = useState<string | null>(null);
  const [transformInstruction, setTransformInstruction] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [upscalingId, setUpscalingId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<GeneratedImageRecord | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyPrompt = (prompt: string, id: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (image: GeneratedImageRecord) => {
    try {
      const link = document.createElement('a');
      link.href = image.imageSrc;
      link.download = `metfa-ai-visual-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleToggleTransform = (image: GeneratedImageRecord) => {
    if (activeTransformId === image.id) {
      setActiveTransformId(null);
      setTransformInstruction('');
      setSelectedPreset('');
    } else {
      setActiveTransformId(image.id);
      setTransformInstruction('');
      setSelectedPreset('');
    }
  };

  const handleExecuteTransform = (image: GeneratedImageRecord) => {
    const finalInstruction = transformInstruction.trim() || 'Transform and reimagine this visual scene';
    onRetransform(image, finalInstruction, selectedPreset || undefined);
    setActiveTransformId(null);
    setTransformInstruction('');
    setSelectedPreset('');
  };

  const handleExecuteUpscale = async (image: GeneratedImageRecord) => {
    if (upscalingId) return;
    try {
      setUpscalingId(image.id);
      await onUpscale(image);
    } finally {
      setUpscalingId(null);
    }
  };

  return (
    <>
      <div
        id="ai-studio-recent-images-overlay"
        onClick={onClose}
        className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs animate-fadeIn"
      >
        <div
          id="ai-studio-recent-images-drawer"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-gray-900 border-l border-gray-800 h-full flex flex-col shadow-2xl text-slate-100 overflow-hidden"
        >
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between shrink-0 bg-gray-900/95 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-900/80 to-indigo-900/80 border border-purple-700/50 text-purple-300 shadow-inner">
                <Images className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">Recent Visuals</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-600/40 text-purple-300 font-mono">
                    {images.length}/10
                  </span>
                </div>
                <p className="text-xs text-gray-400">Quick access & multimodal re-transformation</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {images.length > 0 && (
                <>
                  {confirmClear ? (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => {
                          onClearImages();
                          setConfirmClear(false);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="px-2 py-1 text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="p-2 rounded-xl bg-gray-800/80 hover:bg-rose-950/60 hover:text-rose-400 text-gray-400 border border-gray-700/60 transition cursor-pointer"
                      title="Clear session image history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                id="ai-studio-recent-images-close-btn"
                onClick={onClose}
                className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700/60 transition cursor-pointer"
                title="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Local Session Notice Banner */}
          <div className="px-4 sm:px-5 py-2.5 bg-gray-950/70 border-b border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span>Local session state only • Not uploaded to database</span>
            </div>
            <span className="text-gray-500 text-[10px]">Capped at 10 items</span>
          </div>

          {/* Drawer Content Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
            {images.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 shadow-inner">
                  <Images className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h4 className="text-sm font-bold text-white">No session visuals yet</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Generate visual scenes or upload photos in AI Studio. Your last 10 session creations will appear here for fast re-transformation.
                  </p>
                </div>
              </div>
            ) : (
              images.map((img, idx) => {
                const isExpanded = activeTransformId === img.id;
                const isUpscaling = upscalingId === img.id;

                return (
                  <div
                    key={img.id || `img_${idx}`}
                    id={`recent-image-card-${img.id}`}
                    className="bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-2xl overflow-hidden transition-all duration-200 shadow-lg group"
                  >
                    {/* Card Header Bar */}
                    <div className="px-3.5 py-2 bg-gray-900/60 border-b border-gray-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                          #{idx + 1}
                        </span>
                        {img.isUpscaled && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800/60 flex items-center gap-1">
                            <Maximize2 className="w-2.5 h-2.5" />
                            <span>4K Upscaled</span>
                          </span>
                        )}
                        {img.originalImageSrc && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 flex items-center gap-1">
                            <Columns2 className="w-2.5 h-2.5" />
                            <span>Transformed</span>
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">
                          {new Date(img.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                        <Zap className="w-2.5 h-2.5 text-teal-500" />
                        <span>{img.modelUsed || 'Gemini 3.7 Flash'}</span>
                      </div>
                    </div>

                    {/* Image Preview & Hover Actions */}
                    <div className="relative aspect-video bg-black/50 overflow-hidden flex items-center justify-center group/img">
                      <img
                        src={img.imageSrc}
                        alt={img.prompt || 'Generated visual'}
                        onClick={() => onSelectForComparison?.(img)}
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500 cursor-pointer"
                        loading="lazy"
                      />

                      {/* Floating Quick Action Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-between pointer-events-none">
                        <div className="flex justify-end gap-1.5 pointer-events-auto">
                          {onSelectForComparison && (
                            <button
                              type="button"
                              onClick={() => onSelectForComparison(img)}
                              className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white backdrop-blur-md transition cursor-pointer"
                              title="Compare side-by-side with original"
                            >
                              <Columns2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setLightboxImage(img)}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition cursor-pointer"
                            title="Inspect full screen"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(img)}
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition cursor-pointer"
                            title="Download original image"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Fast Transform Trigger on Hover */}
                        <div className="flex justify-between items-end pointer-events-auto">
                          {onSelectForComparison && (
                            <button
                              type="button"
                              onClick={() => onSelectForComparison(img)}
                              className="px-2.5 py-1.5 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer backdrop-blur-sm"
                            >
                              <Columns2 className="w-3.5 h-3.5" />
                              <span>Compare</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleTransform(img)}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Re-transform</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Prompt Info */}
                    <div className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-gray-300 line-clamp-2 italic leading-relaxed">
                          "{img.prompt || 'Generated visual scene'}"
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(img.prompt, img.id)}
                          className="shrink-0 p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
                          title="Copy prompt"
                        >
                          {copiedId === img.id ? (
                            <Check className="w-3.5 h-3.5 text-teal-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Main Action Bar */}
                      <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          id={`retransform-btn-${img.id}`}
                          onClick={() => handleToggleTransform(img)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                            isExpanded
                              ? 'bg-purple-900/60 border border-purple-500/50 text-purple-200'
                              : 'bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 text-purple-300'
                          }`}
                        >
                          <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Re-transform</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 ml-0.5" />
                          ) : (
                            <ChevronDown className="w-3 h-3 ml-0.5" />
                          )}
                        </button>

                        <div className="flex items-center gap-1.5">
                          {/* Side-by-Side Compare Button */}
                          {onSelectForComparison && (
                            <button
                              type="button"
                              id={`compare-btn-${img.id}`}
                              onClick={() => onSelectForComparison(img)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-950/70 hover:bg-indigo-900/90 border border-indigo-700/60 text-indigo-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                              title="Compare side-by-side with original uploaded image"
                            >
                              <Columns2 className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="hidden sm:inline">Compare</span>
                            </button>
                          )}

                          {/* 4K Upscale Button */}
                          <button
                            type="button"
                            onClick={() => handleExecuteUpscale(img)}
                            disabled={isUpscaling}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-700/60 text-gray-300 hover:text-white transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            title="Upscale to 4K resolution"
                          >
                            <Maximize2 className="w-3 h-3 text-teal-400" />
                            <span className="hidden sm:inline">
                              {isUpscaling ? 'Upscaling...' : '4K'}
                            </span>
                          </button>

                          {/* Share to Community Feed */}
                          {onShareToFeed && (
                            <button
                              type="button"
                              onClick={() => {
                                onShareToFeed({
                                  prompt: img.prompt || 'AI visual creation',
                                  imageSrc: img.imageSrc,
                                  stylePreset: img.stylePreset,
                                });
                                onClose();
                              }}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-700/60 text-gray-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                              title="Post artwork to Metfa Feed"
                            >
                              <Share2 className="w-3 h-3 text-indigo-400" />
                              <span className="hidden sm:inline">Post</span>
                            </button>
                          )}

                          {/* Download */}
                          <button
                            type="button"
                            onClick={() => handleDownload(img)}
                            className="p-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700/60 text-gray-400 hover:text-white transition cursor-pointer"
                            title="Download file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Re-transformation Workspace */}
                      {isExpanded && (
                        <div className="mt-3 p-3.5 rounded-xl bg-gray-900 border border-purple-800/40 space-y-3 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-purple-400" />
                              <span>Multimodal Transformation</span>
                            </span>
                            <span className="text-[10px] text-gray-400">Reference attached</span>
                          </div>

                          {/* Style Presets Pills */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                              Style Variations
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {TRANSFORMATION_PRESETS.map((preset) => {
                                const isSelected = selectedPreset === preset.style;
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedPreset(isSelected ? '' : preset.style)
                                    }
                                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-purple-600 text-white border border-purple-400 shadow-xs'
                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700/60'
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Custom Transformation Prompt */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                              Transformation Instruction
                            </label>
                            <textarea
                              value={transformInstruction}
                              onChange={(e) => setTransformInstruction(e.target.value)}
                              placeholder="e.g. Add neon rain reflections, dramatic volumetric lighting, or turn character into robotic android..."
                              rows={2}
                              className="w-full bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none resize-none"
                            />
                          </div>

                          {/* Submit Transformation */}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTransformId(null);
                                setTransformInstruction('');
                                setSelectedPreset('');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition cursor-pointer"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              id={`execute-transform-btn-${img.id}`}
                              disabled={isTransforming}
                              onClick={() => handleExecuteTransform(img)}
                              className="px-4 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                              <span>{isTransforming ? 'Transforming...' : 'Transform Visual'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[90vh] bg-gray-950 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-3 sm:p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Full Resolution Preview</span>
                {lightboxImage.modelUsed && (
                  <span className="text-[10px] text-gray-400 font-mono">({lightboxImage.modelUsed})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(lightboxImage)}
                  className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black">
              <img
                src={lightboxImage.imageSrc}
                alt={lightboxImage.prompt}
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>

            {lightboxImage.prompt && (
              <div className="p-3.5 bg-gray-900/90 border-t border-gray-800 text-xs text-gray-300 italic">
                "{lightboxImage.prompt}"
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RecentImagesDrawer;
