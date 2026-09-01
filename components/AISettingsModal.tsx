import React, { useState, useEffect } from 'react';
import { getStudioSettings, saveStudioSettings } from '../utils/chatStore';
import { getStoredApiKeys, saveStoredApiKeys } from '../utils/apiKeysStore';
import { StudioSettings } from '../types/chat';

export interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AISettingsModal({ isOpen, onClose, onSaved }: AISettingsModalProps) {
  // Direct official API key links
  const aiProviders = [
    {
      name: 'Google Gemini',
      keyName: 'geminiApiKey' as const,
      placeholder: 'AIzaSy...',
      getLink: 'https://aistudio.google.com/app/apikey',
      description: 'Powers multimodal chat, high-speed reasoning, and 4K scene analysis.'
    },
    {
      name: 'OpenAI / ChatGPT',
      keyName: 'openaiApiKey' as const,
      placeholder: 'sk-proj-...',
      getLink: 'https://platform.openai.com/api-keys',
      description: 'Powers GPT-4o, GPT-4 Turbo, and DALL-E image generation.'
    },
    {
      name: 'xAI Grok',
      keyName: 'grokApiKey' as const,
      placeholder: 'xai-...',
      getLink: 'https://console.x.ai/',
      description: 'Powers Grok-2, real-time reasoning, and uncensored vision pipelines.'
    },
    {
      name: 'Anthropic Claude',
      keyName: 'claudeApiKey' as const,
      placeholder: 'sk-ant-api03-...',
      getLink: 'https://console.anthropic.com/settings/keys',
      description: 'Powers Claude 3.5 Sonnet deep synthesis and structured output.'
    }
  ];

  const [keys, setKeys] = useState<{
    geminiApiKey: string;
    openaiApiKey: string;
    grokApiKey: string;
    claudeApiKey: string;
  }>({
    geminiApiKey: '',
    openaiApiKey: '',
    grokApiKey: '',
    claudeApiKey: '',
  });

  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = getStoredApiKeys();
        const studio = getStudioSettings();
        setKeys({
          geminiApiKey: stored.geminiApiKey || studio.geminiApiKey || '',
          openaiApiKey: stored.openaiApiKey || studio.openaiApiKey || '',
          grokApiKey: stored.grokApiKey || studio.grokApiKey || '',
          claudeApiKey: stored.claudeApiKey || studio.claudeApiKey || '',
        });
      } catch {
        // ignore fallback
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyChange = (keyName: keyof typeof keys, value: string) => {
    setKeys((prev) => ({
      ...prev,
      [keyName]: value,
    }));
  };

  const handleSave = () => {
    try {
      const geminiKey = keys.geminiApiKey.trim();
      const openaiKey = keys.openaiApiKey.trim();
      const grokKey = keys.grokApiKey.trim();
      const claudeKey = keys.claudeApiKey.trim();

      // 1. Save to universal API keys store (handles multiple storage layers & events)
      saveStoredApiKeys({
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
        grokApiKey: grokKey,
        claudeApiKey: claudeKey,
      });

      // 2. Sync to Studio settings
      const current = getStudioSettings();
      const updated: StudioSettings = {
        ...current,
        geminiApiKey: geminiKey || undefined,
        openaiApiKey: openaiKey || undefined,
        grokApiKey: grokKey || undefined,
        claudeApiKey: claudeKey || undefined,
      };
      saveStudioSettings(updated);
      
      window.dispatchEvent(
        new CustomEvent('metfa_studio_settings_updated', {
          detail: updated,
        })
      );
      
      if (onSaved) {
        onSaved();
      }
      setShowSavedToast(true);
      setTimeout(() => {
        setShowSavedToast(false);
        onClose();
      }, 500);
    } catch {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl overflow-y-auto max-h-[90vh] text-gray-900 animate-fadeIn relative"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            🔑 App Secrets & API Keys (BYOK)
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Configure your custom AI credentials & private model endpoints securely. Your keys activate direct cloud acceleration.
        </p>

        {/* Input for each AI engine */}
        <div className="space-y-4">
          {aiProviders.map((provider) => (
            <div key={provider.keyName} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-800">{provider.name}</span>
                <a 
                  href={provider.getLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-md font-medium hover:bg-blue-700 transition inline-flex items-center gap-1"
                >
                  Get Key ↗
                </a>
              </div>
              <p className="text-xs text-gray-500 mb-2">{provider.description}</p>
              <input 
                type="password" 
                value={keys[provider.keyName]}
                onChange={(e) => handleKeyChange(provider.keyName, e.target.value)}
                placeholder={provider.placeholder}
                className="w-full text-xs p-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          ))}
        </div>

        {/* Save confirmation */}
        {showSavedToast && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-semibold text-center">
            ✓ API keys saved successfully! Cloud acceleration active.
          </div>
        )}

        {/* Footer buttons */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose} 
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave} 
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm cursor-pointer transition"
          >
            Save API Keys
          </button>
        </div>

      </div>
    </div>
  );
}

export default AISettingsModal;
