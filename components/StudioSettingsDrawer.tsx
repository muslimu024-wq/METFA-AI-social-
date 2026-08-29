import React, { useState } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  Zap,
  Shield,
  Layers,
  Video,
  Database,
  Cpu,
  Key,
  Eye,
  EyeOff,
  Bot,
  Flame,
  CheckCircle2
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
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGrokKey, setShowGrokKey] = useState(false);

  if (!isOpen) return null;

  const currentEngine = settings.engine || 'gemini';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-gray-900 border-l border-gray-800 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-950 border border-purple-800 text-purple-300">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Studio Settings & Multi-AI</h3>
                <p className="text-xs text-gray-400">Manage Gemini, OpenAI, and Grok engines</p>
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

          {/* Credits & Usage Summary Card */}
          <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-white">Daily AI Usage & Credits</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-500/50">
                {creditsData?.remainingCredits ?? 0} Left Today
              </span>
            </div>
            
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-3 bg-gray-900/60 p-2 rounded-xl">
              <span>Used Today: <strong className="text-white">{creditsData?.usedToday ?? 0} prompts</strong></span>
              <span>Total Earned: <strong className="text-teal-400">{creditsData?.totalEarnedToday ?? 10} credits</strong></span>
            </div>

            {onWatchAdClick && (
              <button
                type="button"
                onClick={onWatchAdClick}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Watch Short Ad (+2 Credits)</span>
              </button>
            )}
          </div>

          {/* Multi-AI Engine Selector */}
          <div className="mb-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">
                Active AI Engine
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      engine: 'gemini',
                      model: 'gemini-3.7-flash',
                    })
                  }
                  className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                    currentEngine === 'gemini'
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                      : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-teal-300" />
                  <span className="text-xs font-bold">Google Gemini</span>
                  <span className="text-[9px] opacity-80">Built-in Fast</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      engine: 'openai',
                      model: 'gpt-4o',
                    })
                  }
                  className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                    currentEngine === 'openai'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                      : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'
                  }`}
                >
                  <Bot className="w-4 h-4 text-emerald-300" />
                  <span className="text-xs font-bold">ChatGPT</span>
                  <span className="text-[9px] opacity-80">OpenAI</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      engine: 'grok',
                      model: 'grok-2',
                    })
                  }
                  className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                    currentEngine === 'grok'
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                      : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-white'
                  }`}
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-bold">xAI Grok</span>
                  <span className="text-[9px] opacity-80">Real-time</span>
                </button>
              </div>
            </div>

            {/* Engine Specific Model Selectors */}
            {currentEngine === 'gemini' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">
                    Gemini Model Flavor
                  </label>
                  <select
                    value={settings.model || 'gemini-3.7-flash'}
                    onChange={(e) => onUpdateSettings({ model: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                  >
                    <option value="gemini-3.7-flash">⚡ Gemini 3.7 Flash (Primary - Fast Multimodal & Reasoning)</option>
                    <option value="gemini-3.1-flash-lite">🌱 Gemini 3.1 Flash Lite (Ultra-lightweight Fast)</option>
                    <option value="gemini-3.1-flash-lite-image">🎨 Gemini 3.1 Flash Lite Image (Visual Inpainting)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span>Google Gemini API Key</span>
                    <span className="text-[10px] text-gray-500 font-normal">Optional (BYO Key)</span>
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={settings.geminiApiKey || ''}
                      onChange={(e) => onUpdateSettings({ geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="p-1 text-gray-500 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentEngine === 'openai' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">
                    OpenAI Model
                  </label>
                  <select
                    value={settings.model || 'gpt-4o'}
                    onChange={(e) => onUpdateSettings({ model: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="gpt-4o">🟢 GPT-4o (High-Intelligence Flagship)</option>
                    <option value="gpt-4o-mini">🟢 GPT-4o Mini (Affordable & Fast)</option>
                    <option value="o3-mini">🟢 o3-mini (Advanced Reasoning)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span>OpenAI API Key</span>
                    <span className="text-[10px] text-gray-500 font-normal">Optional (BYO Key)</span>
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showOpenAIKey ? 'text' : 'password'}
                      value={settings.openaiApiKey || ''}
                      onChange={(e) => onUpdateSettings({ openaiApiKey: e.target.value })}
                      placeholder="sk-proj-..."
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      className="p-1 text-gray-500 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {showOpenAIKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentEngine === 'grok' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-2">
                    xAI Grok Model
                  </label>
                  <select
                    value={settings.model || 'grok-2'}
                    onChange={(e) => onUpdateSettings({ model: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="grok-2">⚡ Grok-2 (State of the Art)</option>
                    <option value="grok-2-mini">⚡ Grok-2 Mini (Fast Stream)</option>
                    <option value="grok-beta">⚡ Grok Beta (Experimental)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span>xAI Grok API Key</span>
                    <span className="text-[10px] text-gray-500 font-normal">Optional (BYO Key)</span>
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showGrokKey ? 'text' : 'password'}
                      value={settings.grokApiKey || ''}
                      onChange={(e) => onUpdateSettings({ grokApiKey: e.target.value })}
                      placeholder="xai-..."
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGrokKey(!showGrokKey)}
                      className="p-1 text-gray-500 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {showGrokKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                <span>Exact (0.1)</span>
                <span>Balanced (0.7)</span>
                <span>Creative (1.0)</span>
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
        <div className="pt-4 border-t border-gray-800 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply Settings & Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudioSettingsDrawer;
