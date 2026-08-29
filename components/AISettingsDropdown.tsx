import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  Sparkles,
  Bot,
  Flame,
  Key,
  RefreshCw,
  Trash2,
  Check,
  ChevronDown
} from 'lucide-react';
import { getStudioSettings, saveStudioSettings } from '../utils/chatStore';

interface AISettingsDropdownProps {
  onOpenSettings?: () => void;
  onOpenApiKeysModal?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const AISettingsDropdown: React.FC<AISettingsDropdownProps> = ({
  onOpenSettings,
  onOpenApiKeysModal,
  onNavigateTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeEngine, setActiveEngine] = useState<'gemini' | 'openai' | 'grok'>(() => {
    try {
      const current = getStudioSettings();
      return current.engine || 'gemini';
    } catch {
      return 'gemini';
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Listen to engine updates from other sources
  useEffect(() => {
    const handleEngineSync = (e: any) => {
      if (e.detail?.engine) {
        setActiveEngine(e.detail.engine);
      }
    };
    window.addEventListener('metfa_ai_engine_changed', handleEngineSync);
    return () => window.removeEventListener('metfa_ai_engine_changed', handleEngineSync);
  }, []);

  const handleSelectEngine = (engine: 'gemini' | 'openai' | 'grok') => {
    setActiveEngine(engine);
    try {
      const current = getStudioSettings();
      const model = engine === 'gemini' ? 'gemini-3.7-flash' : engine === 'openai' ? 'gpt-4o' : 'grok-2';
      saveStudioSettings({ ...current, engine, model });
    } catch (err) {
      console.error(err);
    }

    // Dispatch global event
    window.dispatchEvent(
      new CustomEvent('metfa_ai_switch_engine', {
        detail: { engine },
      })
    );
    setIsOpen(false);
  };

  const handleOpenStudioParameters = () => {
    setIsOpen(false);
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      window.dispatchEvent(new CustomEvent('metfa_ai_open_settings'));
    }
  };

  const handleOpenKeysModal = () => {
    setIsOpen(false);
    if (onOpenApiKeysModal) {
      onOpenApiKeysModal();
    } else {
      window.dispatchEvent(new CustomEvent('metfa_ai_open_keys'));
    }
  };

  const handleNewConversation = () => {
    setIsOpen(false);
    if (onNavigateTab) onNavigateTab('chat');
    window.dispatchEvent(new CustomEvent('metfa_ai_new_chat'));
  };

  const handleClearHistory = () => {
    setIsOpen(false);
    if (onNavigateTab) onNavigateTab('chat');
    window.dispatchEvent(new CustomEvent('metfa_ai_clear_history'));
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Top Header Trigger Button */}
      <button
        type="button"
        id="header-ai-settings-dropdown-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center border transition-all shadow-sm active:scale-95 cursor-pointer ${
          isOpen
            ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-purple-500/20 ring-2 ring-purple-500/30'
            : 'bg-gray-900/80 hover:bg-gray-850 border-gray-800 hover:border-purple-500/40 text-gray-300 hover:text-white'
        }`}
        title="AI Studio Settings & Model Controls"
      >
        <Sliders className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-purple-400" />
      </button>

      {/* Modern Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-64 sm:w-72 bg-gray-950/95 border border-purple-500/30 rounded-2xl shadow-2xl backdrop-blur-xl p-2 z-50 animate-fadeIn space-y-1.5">
          {/* Section: AI Engine Selection */}
          <div className="px-2 py-1">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">AI Engine</div>
          </div>

          <div className="space-y-1">
            {/* Gemini 3.7 */}
            <button
              type="button"
              onClick={() => handleSelectEngine('gemini')}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeEngine === 'gemini'
                  ? 'bg-gradient-to-r from-purple-900/60 to-teal-900/50 text-white border border-purple-500/40 shadow-sm'
                  : 'text-gray-300 hover:bg-gray-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-lg bg-purple-500/20 text-teal-300">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="leading-tight">Gemini 3.7 Flash</div>
                  <div className="text-[10px] text-gray-400 font-normal">Google DeepMind • Multimodal</div>
                </div>
              </div>
              {activeEngine === 'gemini' && <Check className="w-4 h-4 text-teal-300 shrink-0" />}
            </button>

            {/* ChatGPT */}
            <button
              type="button"
              onClick={() => handleSelectEngine('openai')}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeEngine === 'openai'
                  ? 'bg-emerald-950/60 text-white border border-emerald-500/40 shadow-sm'
                  : 'text-gray-300 hover:bg-gray-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="leading-tight">ChatGPT (GPT-4o)</div>
                  <div className="text-[10px] text-gray-400 font-normal">OpenAI Vision & Reasoning</div>
                </div>
              </div>
              {activeEngine === 'openai' && <Check className="w-4 h-4 text-emerald-300 shrink-0" />}
            </button>

            {/* Grok */}
            <button
              type="button"
              onClick={() => handleSelectEngine('grok')}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                activeEngine === 'grok'
                  ? 'bg-blue-950/60 text-white border border-blue-500/40 shadow-sm'
                  : 'text-gray-300 hover:bg-gray-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-lg bg-blue-500/20 text-amber-300">
                  <Flame className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="leading-tight">Grok-2</div>
                  <div className="text-[10px] text-gray-400 font-normal">xAI Real-time Intelligence</div>
                </div>
              </div>
              {activeEngine === 'grok' && <Check className="w-4 h-4 text-amber-300 shrink-0" />}
            </button>
          </div>

          <div className="border-t border-gray-800/80 my-1" />

          {/* Section: Studio Tools */}
          <div className="space-y-1">
            <button
              type="button"
              id="dropdown-open-studio-parameters"
              onClick={handleOpenStudioParameters}
              className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-gray-200 hover:bg-purple-950/40 hover:text-purple-300 flex items-center gap-2.5 transition cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div>Studio Parameters</div>
                <div className="text-[10px] text-gray-400 font-normal">Temperature, styles & system prompt</div>
              </div>
            </button>

            <button
              type="button"
              id="dropdown-open-custom-api-keys"
              onClick={handleOpenKeysModal}
              className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-gray-200 hover:bg-teal-950/40 hover:text-teal-300 flex items-center gap-2.5 transition cursor-pointer"
            >
              <Key className="w-4 h-4 text-teal-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div>Custom API Keys</div>
                <div className="text-[10px] text-gray-400 font-normal">Configure Gemini, OpenAI & Grok keys</div>
              </div>
            </button>
          </div>

          <div className="border-t border-gray-800/80 my-1" />

          {/* Section: Conversation Management */}
          <div className="space-y-1">
            <button
              type="button"
              id="dropdown-header-new-chat"
              onClick={handleNewConversation}
              className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-gray-200 hover:bg-gray-850 hover:text-white flex items-center gap-2.5 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>New Conversation</span>
            </button>

            <button
              type="button"
              id="dropdown-header-clear-history"
              onClick={handleClearHistory}
              className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 flex items-center gap-2.5 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Clear Prompt History</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISettingsDropdown;
