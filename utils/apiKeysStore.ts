/**
 * METFA SOCIAL — Ephemeral Session-Scoped BYOK Store
 *
 * P0-5 SECURITY REMEDIATION:
 * 1. Third-party API keys (OpenAI, Gemini, xAI Grok, Claude) are strictly EPHEMERAL.
 * 2. They are NEVER persisted in permanent plaintext localStorage.
 * 3. Legacy plaintext localStorage keys are purged immediately upon initialization.
 * 4. Keys reside strictly in-memory with sessionStorage isolation (scoped only to the
 *    active tab, wiped immediately on window/tab close or logout).
 * 5. Full masking utility provided for safe UI display.
 * 6. Zero logging of credentials.
 *
 * NOTE ON FUTURE ARCHITECTURE:
 * Cross-device persistent recovery of BYOK credentials will require a dedicated
 * server-side encrypted vault (e.g. Supabase Vault / PostgreSQL pgcrypto with per-user
 * envelope encryption). Client-side permanent plaintext storage is strictly disallowed.
 */

export interface AppApiKeys {
  geminiApiKey: string;
  openaiApiKey: string;
  grokApiKey: string;
  claudeApiKey: string;
  replicateApiKey: string;
  customApiEndpoint: string;
  customApiKey: string;
}

export const SESSION_KEYS_STORAGE_KEY = 'metfa_session_keys_v1';
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

// In-memory runtime cache for the active browser session
let inMemoryApiKeys: AppApiKeys | null = null;

function sanitizeSingleKey(val: any): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
    return '';
  }
  // Ignore visual masking placeholders
  if (
    trimmed === '...' ||
    trimmed === 'sk-...' ||
    trimmed === 'AIzaSy...' ||
    trimmed === 'xai-...' ||
    trimmed.includes('••••')
  ) {
    return '';
  }
  return trimmed;
}

/**
 * Actively purges any legacy plaintext API keys from persistent localStorage.
 */
function purgeLegacyLocalStorageKeys(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const legacyKeys = [
      'metfa_api_keys_v1',
      'geminiApiKey',
      'openaiApiKey',
      'grokApiKey',
      'xaiApiKey',
      'claudeApiKey',
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'XAI_API_KEY',
      'GROK_API_KEY',
      'CLAUDE_API_KEY',
      'VITE_GEMINI_API_KEY',
      'VITE_OPENAI_API_KEY',
    ];

    for (const key of legacyKeys) {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    }

    // Also sanitize studio settings JSON if present
    const studioRaw = localStorage.getItem(STUDIO_SETTINGS_KEY);
    if (studioRaw) {
      try {
        const parsed = JSON.parse(studioRaw);
        if (parsed && typeof parsed === 'object') {
          let modified = false;
          if ('geminiApiKey' in parsed) { delete parsed.geminiApiKey; modified = true; }
          if ('openaiApiKey' in parsed) { delete parsed.openaiApiKey; modified = true; }
          if ('grokApiKey' in parsed) { delete parsed.grokApiKey; modified = true; }
          if ('claudeApiKey' in parsed) { delete parsed.claudeApiKey; modified = true; }
          if (modified) {
            localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(parsed));
          }
        }
      } catch {
        // ignore parse error
      }
    }
  } catch {
    // ignore storage access errors
  }
}

// Auto-purge legacy plaintext storage on module load
if (typeof window !== 'undefined') {
  purgeLegacyLocalStorageKeys();
}

/**
 * Retrieves the current session's API keys from in-memory cache or ephemeral sessionStorage.
 */
export function getStoredApiKeys(): AppApiKeys {
  if (inMemoryApiKeys) {
    return { ...inMemoryApiKeys };
  }

  const result: AppApiKeys = { ...DEFAULT_API_KEYS };

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = sessionStorage.getItem(SESSION_KEYS_STORAGE_KEY);
      if (raw) {
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
      }
    } catch {
      // ignore parse error
    }
  }

  inMemoryApiKeys = result;
  return { ...result };
}

/**
 * Saves BYOK credentials into the ephemeral tab session.
 * NEVER writes credentials to persistent localStorage.
 */
export function saveStoredApiKeys(keys: Partial<AppApiKeys>): AppApiKeys {
  const current = getStoredApiKeys();
  const updated: AppApiKeys = {
    ...current,
    ...keys,
  };

  // Sanitize values
  (Object.keys(updated) as Array<keyof AppApiKeys>).forEach((k) => {
    updated[k] = sanitizeSingleKey(updated[k]);
  });

  inMemoryApiKeys = updated;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(SESSION_KEYS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('metfa_apikeys_updated', { detail: updated }));
    } catch {
      // sessionStorage quota or security restriction
    }
  }

  return { ...updated };
}

/**
 * Clears all stored API keys from memory and ephemeral sessionStorage.
 * Also cleans up any lingering legacy storage.
 */
export function clearStoredApiKeys(): void {
  inMemoryApiKeys = { ...DEFAULT_API_KEYS };

  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage) {
        sessionStorage.removeItem(SESSION_KEYS_STORAGE_KEY);
      }
      purgeLegacyLocalStorageKeys();
      window.dispatchEvent(new CustomEvent('metfa_apikeys_updated', { detail: DEFAULT_API_KEYS }));
    } catch {
      // ignore
    }
  }
}

/**
 * Produces a masked representation of an API key for safe UI display (e.g. "sk-p••••••••1a2b").
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}
