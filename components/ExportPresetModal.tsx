import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Film,
  Sliders,
  Check,
  Download,
  Share2,
  Maximize2,
  Crop,
  Layers,
  Eye,
  Smartphone,
  Square,
  Tv,
  Palette
} from 'lucide-react';
import { ReelHighlight } from '../types/community';
import { saveReelHighlight } from '../utils/socialStore';
import { useAuth } from '../context/AuthContext';
import { addNotification } from '../utils/notificationStore';

interface ExportPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  initialPrompt?: string;
  onExportToReels?: (reel: ReelHighlight) => void;
  onExportToFeed?: (data: { imageSrc: string; prompt: string; stylePreset: string }) => void;
}

export type AspectRatioType = '9:16' | '1:1' | '4:5' | '16:9';

export interface FilterPreset {
  id: string;
  name: string;
  filterCss: string;
  description: string;
}

export const REELS_FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'original',
    name: 'Normal (Clean)',
    filterCss: 'none',
    description: 'Natural high-definition tones',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    filterCss: 'contrast(125%) saturate(140%) hue-rotate(15deg) brightness(105%)',
    description: 'Deep electric blues and glowing magentas',
  },
  {
    id: 'golden_hour',
    name: 'Golden Sunset',
    filterCss: 'sepia(30%) saturate(135%) contrast(110%) brightness(105%)',
    description: 'Warm, luminous golden hour lighting',
  },
  {
    id: 'hdr_cinematic',
    name: 'Cinematic HDR',
    filterCss: 'contrast(130%) saturate(115%) brightness(102%)',
    description: 'Dramatic dynamic range and crisp micro-contrast',
  },
  {
    id: 'anime_vivid',
    name: 'Anime Pop',
    filterCss: 'saturate(160%) brightness(110%) contrast(115%)',
    description: 'Vibrant colors and cartoon saturation',
  },
  {
    id: 'noir_mood',
    name: 'Moody Noir',
    filterCss: 'grayscale(90%) contrast(140%) brightness(95%)',
    description: 'Monochromatic dramatic shadows',
  },
];

export const ExportPresetModal: React.FC<ExportPresetModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  initialPrompt = '',
  onExportToReels,
  onExportToFeed,
}) => {
  const { userProfile, activeIdentity } = useAuth();
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('9:16');
  const [selectedFilter, setSelectedFilter] = useState<string>('cyberpunk');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(110);
  const [saturation, setSaturation] = useState(120);
  const [reelTitle, setReelTitle] = useState(initialPrompt.slice(0, 45) || 'Metfa Social Visual Highlight');
  const [musicTrack, setMusicTrack] = useState('Cybernetic Pulse (Original Mix)');
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const currentPreset = REELS_FILTER_PRESETS.find((f) => f.id === selectedFilter) || REELS_FILTER_PRESETS[0];

  // Combined CSS filter style
  const customFilterStyle = {
    filter: `${currentPreset.filterCss !== 'none' ? currentPreset.filterCss : ''} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
  };

  const getAspectContainerClass = () => {
    switch (aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] max-w-[240px] sm:max-w-[270px]';
      case '1:1':
        return 'aspect-square max-w-[280px]';
      case '4:5':
        return 'aspect-[4/5] max-w-[270px]';
      case '16:9':
        return 'aspect-[16/9] max-w-[340px]';
      default:
        return 'aspect-[9/16] max-w-[260px]';
    }
  };

  const handleExportReel = () => {
    setIsExporting(true);
    const newReel: ReelHighlight = {
      id: `reel_${Date.now()}`,
      title: reelTitle.trim() || 'AI Visual Reel',
      caption: `${initialPrompt || 'Created with Metfa Social Studio'} • Filter: ${currentPreset.name}`,
      author: {
        id: userProfile.id,
        name: activeIdentity.name || userProfile.name,
        username: activeIdentity.username || userProfile.username,
        avatar: activeIdentity.avatar || userProfile.avatar,
        isVerified: userProfile.isVerified,
      },
      videoSrc: imageSrc, // Used as visual highlight poster/video
      thumbnailSrc: imageSrc,
      duration: 15,
      likesCount: 1,
      commentsCount: 0,
      sharesCount: 0,
      isLiked: true,
      createdAt: 'Just now',
      promptUsed: initialPrompt,
      musicTrack,
    };

    saveReelHighlight(newReel);

    if (onExportToReels) {
      onExportToReels(newReel);
    }

    addNotification({
      type: 'remix',
      title: 'Reel Exported to Ecosystem',
      message: `"${newReel.title}" is now optimized for Reels view!`,
      linkTab: 'reels',
    });

    setIsExporting(false);
    onClose();
  };

  const handleExportFeed = () => {
    if (onExportToFeed) {
      onExportToFeed({
        imageSrc,
        prompt: initialPrompt,
        stylePreset: currentPreset.name,
      });
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-950 border border-purple-500/30 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl relative overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-purple-600 to-teal-500 text-white shadow-md">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Reels & Social Export Preset</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 font-bold uppercase">
                  9:16 Optimized
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Configure aspect ratios, safe-zone overlays, and color grading before sharing to Reels
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-gray-900 text-gray-400 hover:text-white border border-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Preview, Right Controls */}
        <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
          {/* Left Preview Canvas (Columns 5/12) */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-gray-900/60 p-4 rounded-3xl border border-gray-800/80">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between w-full px-2">
              <span>Live Aspect Preview</span>
              <span className="text-teal-400 font-mono">{aspectRatio}</span>
            </div>

            {/* Viewport Frame with Aspect Ratio */}
            <div className={`relative rounded-2xl overflow-hidden bg-black shadow-2xl border-2 border-purple-500/40 w-full mx-auto flex items-center justify-center transition-all ${getAspectContainerClass()}`}>
              <img
                src={imageSrc}
                alt="Export Preset Preview"
                style={customFilterStyle}
                className="w-full h-full object-cover transition duration-300"
              />

              {/* Reels Safe Zone Overlay Guidelines (for 9:16) */}
              {showSafeZone && aspectRatio === '9:16' && (
                <div className="absolute inset-0 pointer-events-none border border-dashed border-teal-400/40 m-3 rounded-xl flex flex-col justify-between p-2">
                  <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-[9px] text-teal-300 font-mono w-max border border-teal-500/30">
                    Top Bar Safe Zone
                  </div>

                  <div className="space-y-1">
                    <div className="bg-black/70 backdrop-blur-md rounded-lg p-2 text-left border border-white/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <img
                          src={activeIdentity.avatar || userProfile.avatar}
                          alt="User"
                          className="w-4 h-4 rounded-full object-cover"
                        />
                        <span className="text-[10px] font-bold text-white leading-tight">
                          @{activeIdentity.username || userProfile.username}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-200 line-clamp-1 font-medium">{reelTitle}</p>
                      <div className="flex items-center gap-1 text-[8px] text-teal-300 mt-0.5">
                        <span>🎵</span>
                        <span className="truncate">{musicTrack}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle Safe Zone button */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSafeZone(!showSafeZone)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 ${
                  showSafeZone
                    ? 'bg-teal-950 border border-teal-800 text-teal-300'
                    : 'bg-gray-850 text-gray-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showSafeZone ? 'Safe Zone: Visible' : 'Safe Zone: Hidden'}</span>
              </button>
            </div>
          </div>

          {/* Right Configuration Controls (Columns 7/12) */}
          <div className="md:col-span-7 space-y-5 overflow-y-auto pr-1">
            {/* 1. Target Aspect Ratio */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Crop className="w-3.5 h-3.5 text-purple-400" />
                <span>Target Social Format</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '9:16', label: 'Reels / Shorts', desc: '9:16 Vertical', icon: Smartphone },
                  { id: '1:1', label: 'Square Feed', desc: '1:1 Standard', icon: Square },
                  { id: '4:5', label: 'Social Portrait', desc: '4:5 Feed', icon: Smartphone },
                  { id: '16:9', label: 'Landscape', desc: '16:9 Cinematic', icon: Tv },
                ].map((item) => {
                  const isSelected = aspectRatio === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAspectRatio(item.id as AspectRatioType)}
                      className={`p-2.5 rounded-2xl border text-left transition flex flex-col items-start ${
                        isSelected
                          ? 'bg-purple-950/80 border-purple-500 text-white shadow-md'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-850'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-teal-400' : 'text-gray-400'}`} />
                      <span className="text-xs font-black leading-tight">{item.label}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Color & Cinematic Filter Presets */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-teal-400" />
                <span>Reels Color Grading & Filter</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {REELS_FILTER_PRESETS.map((preset) => {
                  const isSelected = selectedFilter === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedFilter(preset.id)}
                      className={`p-2.5 rounded-2xl border text-left transition ${
                        isSelected
                          ? 'bg-purple-950/80 border-purple-400 text-white shadow-md'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-850'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-white">{preset.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-teal-400" />}
                      </div>
                      <p className="text-[10px] text-gray-400 line-clamp-1">{preset.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Fine-Tune Sliders */}
            <div className="p-3.5 bg-gray-900/80 rounded-2xl border border-gray-800 space-y-3">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                Fine-Tune Visual Parameters
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Brightness</span>
                    <span className="font-mono text-white">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="140"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-purple-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Contrast</span>
                    <span className="font-mono text-white">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="150"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-teal-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Saturation</span>
                    <span className="font-mono text-white">{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="180"
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 4. Reels Metadata (Title & Track) */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1 uppercase tracking-wider">
                  Reel Overlay Title
                </label>
                <input
                  type="text"
                  value={reelTitle}
                  onChange={(e) => setReelTitle(e.target.value)}
                  placeholder="e.g. Futuristic Tokyo Night Walk..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1 uppercase tracking-wider">
                  Audio Soundtrack
                </label>
                <select
                  value={musicTrack}
                  onChange={(e) => setMusicTrack(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                >
                  <option value="Cybernetic Pulse (Original Mix)">Cybernetic Pulse (Original Mix)</option>
                  <option value="Lo-Fi Night Drive in Shibuya">Lo-Fi Night Drive in Shibuya</option>
                  <option value="Ambient Dreamscape (Gemini Theme)">Ambient Dreamscape (Gemini Theme)</option>
                  <option value="Cinematic Deep Bass Drops">Cinematic Deep Bass Drops</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="pt-4 border-t border-gray-800 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportFeed}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Share to Feed</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-white text-xs font-bold rounded-xl transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExportReel}
              disabled={isExporting}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-black rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-1.5 transform active:scale-95"
            >
              <Film className="w-4 h-4" />
              <span>Export to Reels ({aspectRatio})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPresetModal;
