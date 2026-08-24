import React from 'react';
import {
  X,
  Sliders,
  Sparkles,
  Zap,
  Shield,
  Layers,
  Video,
  Database,
  Cpu
} from 'lucide-react';
import { StudioSettings } from '../types/chat';
import { DailyCreditsData } from '../utils/creditManager';

interface StudioSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Partial<StudioSettings>;
  onUpdateSettings: (settings: Partial<StudioSettings>) => void;
  creditsData: DailyCreditsData;
  onWatchAdClick?: () => void;
}

export const StudioSettingsDrawer: React.FC<StudioSettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  creditsData,
  onWatchAdClick,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-gray-900 border-l border-gray-800 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-950 border border-purple-800 text-purple-300">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Studio Settings</h3>
                <p className="text-xs text-gray-400">Configure AI models & defaults</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Credits Summary Card */}
          <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-white">Daily Prompt Credits</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-500/50">
                {creditsData?.remainingCredits ?? 0} Remaining
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              Watch a sponsored ad to get +2 instant credits anytime!
            </p>
            {onWatchAdClick && (
              <button
                type="button"
                onClick={onWatchAdClick}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Watch Short Ad (+2 Credits)</span>
              </button>
            )}
          </div>

          {/* AI Model Selection */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">
                Primary Intelligence Model
              </label>
              <select
                value={settings.model || 'gemini-2.5-flash'}
                onChange={(e) => onUpdateSettings({ model: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
              >
                <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Primary - Ultra Fast & Low Latency)</option>
                <option value="gemini-2.5-flash-lite">🌱 Gemini 2.5 Flash Lite (Lightweight Fast)</option>
                <option value="gemini-3.7-flash">🧠 Gemini 3.7 Flash (Heavy Multimodal)</option>
                <option value="gemini-3.1-flash-lite-image">🎨 Gemini 3.1 Flash Lite Image (Visual Inpainting)</option>
              </select>
            </div>

            {/* Quality Level */}
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">
                Render Quality Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['standard', 'hd', 'ultra_4k'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onUpdateSettings({ qualityLevel: lvl })}
                    className={`py-2 px-1 text-xs rounded-xl font-bold uppercase transition border ${
                      (settings.qualityLevel || 'hd') === lvl
                        ? 'bg-purple-600/90 text-white border-purple-400 shadow-sm'
                        : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'
                    }`}
                  >
                    {lvl.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Creativity Temperature */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Creativity Temperature
                </label>
                <span className="text-xs font-mono text-teal-400 font-bold">
                  {settings.temperature ?? 0.7}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.temperature ?? 0.7}
                onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-semibold">
                <span>Exact / Technical (0.1)</span>
                <span>Balanced (0.7)</span>
                <span>Hyper-Creative (1.0)</span>
              </div>
            </div>

            {/* Default Style Preset */}
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">
                Active Style Preset
              </label>
              <select
                value={settings.stylePreset || ''}
                onChange={(e) => onUpdateSettings({ stylePreset: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
              >
                <option value="">None (Natural Prompting)</option>
                <option value="Cyberpunk 2088">Cyberpunk 2088</option>
                <option value="Anime Studio Ghibli">Anime Studio Ghibli</option>
                <option value="Photorealistic 8K">Photorealistic 8K</option>
                <option value="Cinematic Sci-Fi">Cinematic Sci-Fi</option>
                <option value="Fantasy Oil Painting">Fantasy Oil Painting</option>
                <option value="Surrealist Dream">Surrealist Dream</option>
                <option value="Vibrant 3D Render">Vibrant 3D Render</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-gray-800 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudioSettingsDrawer;
