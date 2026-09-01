export interface AppApiKeys {
  geminiApiKey: string;
  openaiApiKey: string;
  grokApiKey: string;
  claudeApiKey: string;
  replicateApiKey: string;
  customApiEndpoint: string;
  customApiKey: string;
}

export const API_KEYS_STORAGE_KEY = 'metfa_api_keys_v1';
export const STUDIO_SETTINGS_KEY = 'metfa_studio_settings_v3';

export const DEFAULT_API_KEYS: AppApiKeys = {
  geminiApiKey: '',
  openaiApiKey: '',
  grokApiKey: '',
  claudeApiKey: '',
  replicateApiKey: '',
  customApiEndpoint: '',
  customApiKey: '',
};

function sanitizeSingleKey(val: any): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
    return '';
  }
  // Ignore purely visual placeholders
  if (trimmed === '...' || trimmed === 'sk-...' || trimmed === 'AIzaSy...' || trimmed === 'xai-...') {
    return '';
  }
  return trimmed;
}

export function getStoredApiKeys(): AppApiKeys {
  const result: AppApiKeys = { ...DEFAULT_API_KEYS };

  try {
    // 1. Direct AppApiKeys JSON bundle
    const raw = typeof window !== 'undefined' ? localStorage.getItem(API_KEYS_STORAGE_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.geminiApiKey) result.geminiApiKey = sanitizeSingleKey(parsed.geminiApiKey);
          if (parsed.openaiApiKey) result.openaiApiKey = sanitizeSingleKey(parsed.openaiApiKey);
          if (parsed.grokApiKey) result.grokApiKey = sanitizeSingleKey(parsed.grokApiKey);
          if (parsed.claudeApiKey) result.claudeApiKey = sanitizeSingleKey(parsed.claudeApiKey);
          if (parsed.replicateApiKey) result.replicateApiKey = sanitizeSingleKey(parsed.replicateApiKey);
          if (parsed.customApiEndpoint) result.customApiEndpoint = sanitizeSingleKey(parsed.customApiEndpoint);
          if (parsed.customApiKey) result.customApiKey = sanitizeSingleKey(parsed.customApiKey);
        }
      } catch {
        // ignore parse error
      }
    }

    // 2. Check Studio Settings JSON bundle
    const studioRaw = typeof window !== 'undefined' ? localStorage.getItem(STUDIO_SETTINGS_KEY) : null;
    if (studioRaw) {
      try {
        const studio = JSON.parse(studioRaw);
        if (studio && typeof studio === 'object') {
          if (!result.geminiApiKey && studio.geminiApiKey) {
            result.geminiApiKey = sanitizeSingleKey(studio.geminiApiKey);
          }
          if (!result.openaiApiKey && studio.openaiApiKey) {
            result.openaiApiKey = sanitizeSingleKey(studio.openaiApiKey);
          }
          if (!result.grokApiKey && studio.grokApiKey) {
            result.grokApiKey = sanitizeSingleKey(studio.grokApiKey);
          }
          if (!result.claudeApiKey && studio.claudeApiKey) {
            result.claudeApiKey = sanitizeSingleKey(studio.claudeApiKey);
          }
        }
      } catch {
        // ignore parse error
      }
    }

    // 3. Fallback to direct localStorage keys without reserved name conflicts
    if (typeof window !== 'undefined') {
      const directGemini = localStorage.getItem('geminiApiKey') || localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('VITE_GEMINI_API_KEY');
      if (!result.geminiApiKey && directGemini) {
        result.geminiApiKey = sanitizeSingleKey(directGemini);
      }

      const directOpenAI = localStorage.getItem('openaiApiKey') || localStorage.getItem('OPENAI_API_KEY') || localStorage.getItem('VITE_OPENAI_API_KEY');
      if (!result.openaiApiKey && directOpenAI) {
        result.openaiApiKey = sanitizeSingleKey(directOpenAI);
      }

      const directGrok = localStorage.getItem('grokApiKey') || localStorage.getItem('xaiApiKey') || localStorage.getItem('XAI_API_KEY') || localStorage.getItem('GROK_API_KEY');
      if (!result.grokApiKey && directGrok) {
        result.grokApiKey = sanitizeSingleKey(directGrok);
      }

      const directClaude = localStorage.getItem('claudeApiKey') || localStorage.getItem('CLAUDE_API_KEY') || localStorage.getItem('ANTHROPIC_API_KEY');
      if (!result.claudeApiKey && directClaude) {
        result.claudeApiKey = sanitizeSingleKey(directClaude);
      }
    }

    return result;
  } catch (err) {
    console.error('Failed to load stored API keys:', err);
    return result;
  }
}

export function saveStoredApiKeys(keys: Partial<AppApiKeys>): AppApiKeys {
  try {
    const current = getStoredApiKeys();
    const updated: AppApiKeys = {
      ...current,
      ...keys,
    };

    // Sanitize values
    (Object.keys(updated) as Array<keyof AppApiKeys>).forEach((k) => {
      updated[k] = sanitizeSingleKey(updated[k]);
    });

    if (typeof window !== 'undefined') {
      // 1. Save bundle
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updated));

      // 2. Sync to Studio settings
      const studioRaw = localStorage.getItem(STUDIO_SETTINGS_KEY);
      let studio = {};
      try {
        studio = studioRaw ? JSON.parse(studioRaw) : {};
      } catch {
        studio = {};
      }
      const updatedStudio = {
        ...studio,
        geminiApiKey: updated.geminiApiKey || undefined,
        openaiApiKey: updated.openaiApiKey || undefined,
        grokApiKey: updated.grokApiKey || undefined,
        claudeApiKey: updated.claudeApiKey || undefined,
      };
      localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(updatedStudio));

      // 3. Save direct keys to ensure 100% interoperability across all legacy storage readers
      if (updated.geminiApiKey) {
        localStorage.setItem('geminiApiKey', updated.geminiApiKey);
      } else {
        localStorage.removeItem('geminiApiKey');
      }

      if (updated.openaiApiKey) {
        localStorage.setItem('openaiApiKey', updated.openaiApiKey);
      } else {
        localStorage.removeItem('openaiApiKey');
      }

      if (updated.grokApiKey) {
        localStorage.setItem('grokApiKey', updated.grokApiKey);
        localStorage.setItem('xaiApiKey', updated.grokApiKey);
      } else {
        localStorage.removeItem('grokApiKey');
        localStorage.removeItem('xaiApiKey');
      }

      if (updated.claudeApiKey) {
        localStorage.setItem('claudeApiKey', updated.claudeApiKey);
      } else {
        localStorage.removeItem('claudeApiKey');
      }

      // Dispatch events so components and services react instantly
      window.dispatchEvent(new CustomEvent('metfa_apikeys_updated', { detail: updated }));
      window.dispatchEvent(new CustomEvent('metfa_studio_settings_updated', { detail: updatedStudio }));
    }

    return updated;
  } catch (err) {
    console.error('Failed to save API keys:', err);
    return { ...DEFAULT_API_KEYS, ...keys };
  }
}

export function clearStoredApiKeys(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(API_KEYS_STORAGE_KEY);
      localStorage.removeItem('geminiApiKey');
      localStorage.removeItem('openaiApiKey');
      localStorage.removeItem('grokApiKey');
      localStorage.removeItem('xaiApiKey');
      localStorage.removeItem('claudeApiKey');

      const studioRaw = localStorage.getItem(STUDIO_SETTINGS_KEY);
      if (studioRaw) {
        try {
          const studio = JSON.parse(studioRaw);
          delete studio.geminiApiKey;
          delete studio.openaiApiKey;
          delete studio.grokApiKey;
          delete studio.claudeApiKey;
          localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(studio));
        } catch {
          // ignore
        }
      }

      window.dispatchEvent(new CustomEvent('metfa_apikeys_updated', { detail: DEFAULT_API_KEYS }));
    }
  } catch (err) {
    console.error('Failed to clear API keys:', err);
  }
}
