export interface RecentPromptItem {
  id: string;
  prompt: string;
  timestamp: string;
  stylePreset?: string;
  isTransformation?: boolean;
}

const PROMPT_HISTORY_STORAGE_KEY = 'metfa_ai_recent_prompts_history_v1';

const DEFAULT_STARTER_PROMPTS: Omit<RecentPromptItem, 'id' | 'timestamp'>[] = [
  {
    prompt: 'Transform this into a Cyberpunk 2088 neon cityscape with rainy reflections',
    stylePreset: 'Cyberpunk 2088',
    isTransformation: true,
  },
  {
    prompt: 'Convert into Studio Ghibli anime watercolor illustration with soft morning sunlight',
    stylePreset: 'Anime Studio Ghibli',
    isTransformation: true,
  },
  {
    prompt: 'Enhance into 8K photorealistic portrait with cinematic volumetric studio lighting',
    stylePreset: 'Photorealistic 8K',
    isTransformation: true,
  },
  {
    prompt: 'Re-imagine as a vibrant 3D isometric miniature world with tactile clay textures',
    stylePreset: 'Vibrant 3D Render',
    isTransformation: true,
  },
  {
    prompt: 'Transform into a moody dark fantasy oil painting with textured impasto brushstrokes',
    stylePreset: 'Fantasy Oil Painting',
    isTransformation: true,
  },
  {
    prompt: 'Transform into a surrealist dreamscape with floating clock towers and nebula skies',
    stylePreset: 'Surrealist Dream',
    isTransformation: true,
  },
];

/**
 * Load recent prompts from localStorage. If empty, returns seeded starter prompts.
 */
export const getRecentPrompts = (): RecentPromptItem[] => {
  try {
    const raw = localStorage.getItem(PROMPT_HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading recent prompts from localStorage:', err);
  }

  // Seed default starter prompts
  const now = new Date();
  const seeded: RecentPromptItem[] = DEFAULT_STARTER_PROMPTS.map((item, idx) => ({
    id: `starter_prompt_${idx}_${Date.now()}`,
    prompt: item.prompt,
    timestamp: new Date(now.getTime() - idx * 3600000).toISOString(),
    stylePreset: item.stylePreset,
    isTransformation: item.isTransformation,
  }));

  try {
    localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(seeded));
  } catch {}

  return seeded;
};

/**
 * Add or bump a prompt to the top of recent history.
 * Keeps max 20 unique prompts.
 */
export const addRecentPrompt = (
  promptText: string,
  stylePreset?: string,
  isTransformation: boolean = true
): RecentPromptItem[] => {
  const trimmed = promptText.trim();
  if (!trimmed) return getRecentPrompts();

  const current = getRecentPrompts();
  const existingFiltered = current.filter(
    (item) => item.prompt.toLowerCase() !== trimmed.toLowerCase()
  );

  const newItem: RecentPromptItem = {
    id: `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    prompt: trimmed,
    timestamp: new Date().toISOString(),
    stylePreset: stylePreset && stylePreset !== 'None' ? stylePreset : undefined,
    isTransformation,
  };

  const updated = [newItem, ...existingFiltered].slice(0, 20);

  try {
    localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom event for cross-component reactive synchronization
    window.dispatchEvent(
      new CustomEvent('metfa_ai_recent_prompts_updated', { detail: { prompts: updated } })
    );
  } catch (err) {
    console.error('Error saving recent prompts to localStorage:', err);
  }

  return updated;
};

/**
 * Delete a specific prompt from history.
 */
export const deleteRecentPrompt = (id: string): RecentPromptItem[] => {
  const current = getRecentPrompts();
  const updated = current.filter((item) => item.id !== id);

  try {
    localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent('metfa_ai_recent_prompts_updated', { detail: { prompts: updated } })
    );
  } catch (err) {
    console.error('Error deleting recent prompt from localStorage:', err);
  }

  return updated;
};

/**
 * Clear all stored recent prompts and reset to starter presets.
 */
export const clearAllRecentPrompts = (): RecentPromptItem[] => {
  try {
    localStorage.removeItem(PROMPT_HISTORY_STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent('metfa_ai_recent_prompts_updated', { detail: { prompts: [] } })
    );
  } catch (err) {
    console.error('Error clearing recent prompts from localStorage:', err);
  }
  return [];
};
