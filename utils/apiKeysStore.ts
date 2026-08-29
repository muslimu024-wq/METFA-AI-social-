export interface AppApiKeys {
  geminiApiKey: string;
  openaiApiKey: string;
  grokApiKey: string;
  claudeApiKey: string;
  replicateApiKey: string;
  customApiEndpoint: string;
  customApiKey: string;
}

const API_KEYS_STORAGE_KEY = 'metfa_api_keys_v1';
const STUDIO_SETTINGS_KEY = 'metfa_studio_settings_v3';

export const DEFAULT_API_KEYS: AppApiKeys = {
  geminiApiKey: '',
  openaiApiKey: '',
  grokApiKey: '',
  claudeApiKey: '',
  replicateApiKey: '',
  customApiEndpoint: '',
  customApiKey: '',
};

export function getStoredApiKeys(): AppApiKeys {
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
    let keys: Partial<AppApiKeys> = {};
    if (raw) {
      keys = JSON.parse(raw);
    }

    // Also check studio settings for backwards compatibility
    const studioRaw = localStorage.getItem(STUDIO_SETTINGS_KEY);
    if (studioRaw) {
      const studio = JSON.parse(studioRaw);
      if (!keys.geminiApiKey && studio.geminiApiKey) {
        keys.geminiApiKey = studio.geminiApiKey;
      }
      if (!keys.openaiApiKey && studio.openaiApiKey) {
        keys.openaiApiKey = studio.openaiApiKey;
      }
      if (!keys.grokApiKey && studio.grokApiKey) {
        keys.grokApiKey = studio.grokApiKey;
      }
    }

    // Sanitize any revoked/placeholder keys
    if (keys.openaiApiKey && (keys.openaiApiKey.startsWith('sk-proj-k4NuRPTm') || keys.openaiApiKey.includes('...'))) {
      keys.openaiApiKey = '';
    }
    if (keys.grokApiKey && (keys.grokApiKey.startsWith('xai-ZBBc1') || keys.grokApiKey.startsWith('xai-dummy'))) {
      keys.grokApiKey = '';
    }

    return {
      ...DEFAULT_API_KEYS,
      ...keys,
    };
  } catch (err) {
    console.error('Failed to load stored API keys:', err);
    return DEFAULT_API_KEYS;
  }
}

export function saveStoredApiKeys(keys: Partial<AppApiKeys>): AppApiKeys {
  try {
    const current = getStoredApiKeys();
    const updated = {
      ...current,
      ...keys,
    };
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updated));

    // Also sync to studio settings
    const studioRaw = localStorage.getItem(STUDIO_SETTINGS_KEY);
    const studio = studioRaw ? JSON.parse(studioRaw) : {};
    studio.geminiApiKey = updated.geminiApiKey;
    studio.openaiApiKey = updated.openaiApiKey;
    studio.grokApiKey = updated.grokApiKey;
    localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(studio));

    // Dispatch event so all components react immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metfa_apikeys_updated', { detail: updated }));
    }

    return updated;
  } catch (err) {
    console.error('Failed to save API keys:', err);
    return { ...DEFAULT_API_KEYS, ...keys };
  }
}

export function clearStoredApiKeys(): void {
  try {
    localStorage.removeItem(API_KEYS_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metfa_apikeys_updated', { detail: DEFAULT_API_KEYS }));
    }
  } catch (err) {
    console.error('Failed to clear API keys:', err);
  }
}
