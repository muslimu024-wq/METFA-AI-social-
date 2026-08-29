import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  Eye,
  EyeOff,
  Check,
  Shield,
  Sparkles,
  Zap,
  Bot,
  Lock,
  Trash2,
  ExternalLink,
  Cpu,
  Globe,
  Sliders
} from 'lucide-react';
import { getStoredApiKeys, saveStoredApiKeys, AppApiKeys, DEFAULT_API_KEYS } from '../utils/apiKeysStore';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeysUpdated?: (keys: AppApiKeys) => void;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({
  isOpen,
  onClose,
  onKeysUpdated,
}) => {
  const [keys, setKeys] = useState<AppApiKeys>(DEFAULT_API_KEYS);
  const [showVisibility, setShowVisibility] = useState<{ [key: string]: boolean }>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeys(getStoredApiKeys());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleVisibility = (field: string) => {
    setShowVisibility((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleChange = (field: keyof AppApiKeys, value: string) => {
    setKeys((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSavedSuccess(false);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated = saveStoredApiKeys(keys);
    setSavedSuccess(true);
    onKeysUpdated?.(updated);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  const handleClearField = (field: keyof AppApiKeys) => {
    handleChange(field, '');
  };

  const keyConfigurations = [
    {
      id: 'geminiApiKey' as keyof AppApiKeys,
      title: 'Google Gemini API Key',
      subtitle: 'Powers multimodal chat, high-speed reasoning, and 4K scene analysis',
      placeholder: 'AIzaSy...',
      docsUrl: 'https://aistudio.google.com/app/apikey',
      icon: Sparkles,
      iconColor: 'text-teal-400 bg-teal-950/80 border-teal-800/50',
      badge: 'Primary AI',
    },
    {
      id: 'openaiApiKey' as keyof AppApiKeys,
      title: 'OpenAI / ChatGPT API Key',
      subtitle: 'Powers GPT-4o, GPT-4 Turbo, and DALL-E image generation',
      placeholder: 'sk-proj-...',
      docsUrl: 'https://platform.openai.com/api-keys',
      icon: Zap,
      iconColor: 'text-emerald-400 bg-emerald-950/80 border-emerald-800/50',
      badge: 'Multi-AI',
    },
    {
      id: 'grokApiKey' as keyof AppApiKeys,
      title: 'xAI Grok API Key',
      subtitle: 'Powers Grok 2, real-time reasoning, and uncensored vision pipelines',
      placeholder: 'xai-...',
      docsUrl: 'https://console.x.ai/',
      icon: Bot,
      iconColor: 'text-purple-400 bg-purple-950/80 border-purple-800/50',
      badge: 'Multi-AI',
    },
    {
      id: 'claudeApiKey' as keyof AppApiKeys,
      title: 'Anthropic Claude API Key',
      subtitle: 'Powers Claude 3.5 Sonnet deep code synthesis and structured output',
      placeholder: 'sk-ant-api03-...',
      docsUrl: 'https://console.anthropic.com/',
      icon: Cpu,
      iconColor: 'text-amber-400 bg-amber-950/80 border-amber-800/50',
      badge: 'Optional',
    },
    {
      id: 'replicateApiKey' as keyof AppApiKeys,
      title: 'Replicate / Flux Diffusion Key',
      subtitle: 'Powers open-source diffusion, Flux.1, and SDXL rendering models',
      placeholder: 'r8_...',
      docsUrl: 'https://replicate.com/account/api-tokens',
      icon: Sliders,
      iconColor: 'text-pink-400 bg-pink-950/80 border-pink-800/50',
      badge: 'Optional',
    },
  ];

  return (
    <div
      id="api-keys-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden text-left animate-slideUp sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-800 shrink-0 bg-gray-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-950 to-indigo-950 text-purple-300 border border-purple-700/40 shadow-inner">
              <Key className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>App Secrets & API Keys</span>
                <Lock className="w-3.5 h-3.5 text-teal-400" />
              </h3>
              <p className="text-xs text-gray-400">
                Configure your custom AI credentials & private model endpoints
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-api-keys-modal-btn"
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-750 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
          {/* User-Friendly Help Banner */}
          <div className="bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-teal-950/70 border border-purple-700/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-xs text-gray-200 leading-snug">
              Don't have an API key? Tap <span className="font-bold text-teal-300">"Get Key ↗"</span> next to any engine to generate one directly from the provider for free!
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-gray-950/70 border border-purple-900/30 rounded-2xl p-3.5 flex items-start gap-3">
            <Shield className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div className="text-[11px] text-gray-300 leading-relaxed">
              <span className="font-semibold text-white">Client-Safe Persistence:</span> Keys are stored encrypted in your browser's private <code className="text-purple-300 bg-purple-950/50 px-1 py-0.5 rounded">localStorage</code>. They are transmitted directly to verified AI endpoints without logging or telemetry.
            </div>
          </div>

          {/* Model Keys List */}
          <form onSubmit={handleSave} className="space-y-4">
            {keyConfigurations.map((item) => {
              const IconComp = item.icon;
              const isVisible = !!showVisibility[item.id];
              const value = (keys[item.id] as string) || '';
              const isConfigured = value.trim().length > 0;

              return (
                <div
                  key={item.id}
                  className="bg-gray-950/80 border border-gray-800/90 hover:border-purple-800/40 rounded-2xl p-3.5 transition group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-xl border ${item.iconColor} shrink-0`}>
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold text-white group-hover:text-purple-300 transition">
                          {item.title}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isConfigured
                            ? 'bg-teal-950/70 text-teal-300 border-teal-700/40'
                            : 'bg-gray-900 text-gray-400 border-gray-800'
                        }`}
                      >
                        {isConfigured ? 'Active' : item.badge}
                      </span>
                      <a
                        href={item.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 border border-purple-700/40 hover:border-purple-500 text-[11px] font-bold text-purple-300 hover:text-white transition flex items-center gap-1 shadow-sm"
                        title={`Get ${item.title}`}
                      >
                        <span>Get Key</span>
                        <ExternalLink className="w-3 h-3 text-purple-400" />
                      </a>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 mb-2 leading-tight">
                    {item.subtitle}
                  </p>

                  <div className="relative flex items-center">
                    <input
                      type={isVisible ? 'text' : 'password'}
                      value={value}
                      onChange={(e) => handleChange(item.id, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-3 pr-20 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono transition"
                    />

                    <div className="absolute right-1.5 flex items-center gap-1">
                      {value && (
                        <button
                          type="button"
                          onClick={() => handleClearField(item.id)}
                          className="p-1 text-gray-500 hover:text-rose-400 rounded transition"
                          title="Clear field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleVisibility(item.id)}
                        className="p-1 text-gray-400 hover:text-white rounded transition"
                        title={isVisible ? 'Hide key' : 'Show key'}
                      >
                        {isVisible ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Custom Endpoint / Self-Hosted Section */}
            <div className="bg-gray-950/80 border border-gray-800/90 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl border text-cyan-400 bg-cyan-950/80 border-cyan-800/50 shrink-0">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white">
                    Custom API Endpoint & Proxy
                  </span>
                  <p className="text-[11px] text-gray-400">
                    Connect local Ollama, vLLM, or custom LLM gateway
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    API Base URL
                  </label>
                  <input
                    type="text"
                    value={keys.customApiEndpoint || ''}
                    onChange={(e) => handleChange('customApiEndpoint', e.target.value)}
                    placeholder="https://api.yourdomain.com/v1"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Bearer Token / Custom Secret
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showVisibility['customApiKey'] ? 'text' : 'password'}
                      value={keys.customApiKey || ''}
                      onChange={(e) => handleChange('customApiKey', e.target.value)}
                      placeholder="Bearer token or custom key..."
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-3 pr-10 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono transition"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility('customApiKey')}
                      className="absolute right-2 p-1 text-gray-400 hover:text-white rounded transition"
                    >
                      {showVisibility['customApiKey'] ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-gray-800 bg-gray-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-800 hover:bg-gray-800 text-xs font-bold text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>

          <button
            type="button"
            id="save-api-keys-btn"
            onClick={() => handleSave()}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition active:scale-95 ${
              savedSuccess
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white shadow-purple-600/30'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Keys Saved Securely!</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>Save API Keys</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeysModal;
