/**
 * Background AI Assistant Service for Metfa Social Ecosystem
 * Handles AI Caption & Hashtags generation, text refinement,
 * quick comment replies, and AI avatar generation.
 * All calls run asynchronously in the background so the UI never blocks.
 */

import { getStoredApiKeys } from '../utils/apiKeysStore';

export interface CaptionResult {
  caption: string;
  hashtags: string[];
  suggestedMood?: string;
  modelUsed?: string;
}

export interface RefineResult {
  refinedText: string;
  changesSummary?: string;
  modelUsed?: string;
}

export interface QuickRepliesResult {
  replies: string[];
  modelUsed?: string;
}

export interface AvatarResult {
  avatarUrl: string;
  promptUsed: string;
  modelUsed?: string;
}

function getAiHeaders(): Record<string, string> {
  const keys = getStoredApiKeys();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (keys.geminiApiKey) {
    headers['x-gemini-api-key'] = keys.geminiApiKey;
    headers['Authorization'] = `Bearer ${keys.geminiApiKey}`;
  }
  if (keys.openaiApiKey) {
    headers['x-openai-api-key'] = keys.openaiApiKey;
  }
  if (keys.grokApiKey) {
    headers['x-grok-api-key'] = keys.grokApiKey;
    headers['x-xai-api-key'] = keys.grokApiKey;
  }
  return headers;
}

/**
 * Generate AI Caption & Trending Hashtags (Bengali / English / Auto)
 */
export async function generateAICaptionAndHashtags(options: {
  userInput?: string;
  imageBase64?: string;
  language?: 'auto' | 'bengali' | 'english';
  tone?: 'Casual' | 'Creative' | 'Professional' | 'Hype' | 'Aesthetic';
}): Promise<CaptionResult> {
  const { userInput = '', imageBase64, language = 'auto', tone = 'Creative' } = options;
  const storedKeys = getStoredApiKeys();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 35000);

    const response = await fetch('/api/ai/caption-hashtags', {
      method: 'POST',
      headers: getAiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        text: userInput,
        imageBase64,
        language,
        tone,
        geminiApiKey: storedKeys.geminiApiKey,
        openaiApiKey: storedKeys.openaiApiKey,
        grokApiKey: storedKeys.grokApiKey,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        caption: data.caption || userInput || '',
        hashtags: Array.isArray(data.hashtags) && data.hashtags.length > 0 ? data.hashtags : [],
        suggestedMood: data.suggestedMood || tone,
        modelUsed: data.modelUsed || 'Google Gemini',
      };
    } else {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `AI generation failed (${response.status})`);
    }
  } catch (err: any) {
    console.error('[AI Assistant] Caption generation error:', err);
    throw err;
  }
}

/**
 * Refine text: Fix grammar, expand ideas, or adjust post tone
 */
export async function refineTextWithAI(options: {
  text: string;
  mode: 'fix_grammar' | 'expand' | 'tone';
  tone?: 'Professional' | 'Funny' | 'Creative' | 'Viral' | 'Casual' | 'Hype' | 'Aesthetic';
}): Promise<RefineResult> {
  const { text, mode, tone = 'Creative' } = options;
  if (!text.trim()) return { refinedText: text };

  const storedKeys = getStoredApiKeys();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 35000);

    const response = await fetch('/api/ai/refine-text', {
      method: 'POST',
      headers: getAiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        text,
        mode,
        tone,
        geminiApiKey: storedKeys.geminiApiKey,
        openaiApiKey: storedKeys.openaiApiKey,
        grokApiKey: storedKeys.grokApiKey,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.refinedText) {
        return {
          refinedText: data.refinedText,
          changesSummary: data.changesSummary || 'Refined with Google Gemini',
          modelUsed: data.modelUsed || 'Google Gemini',
        };
      }
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `AI text refinement failed (${response.status})`);
  } catch (err: any) {
    console.error('[AI Assistant] Refine text error:', err);
    throw err;
  }
}

/**
 * Generate 3 Quick AI Replies for post comments
 */
export async function generateQuickAIReply(commentText: string, postCaption?: string): Promise<QuickRepliesResult> {
  const storedKeys = getStoredApiKeys();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 30000);

    const response = await fetch('/api/ai/quick-reply', {
      method: 'POST',
      headers: getAiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        commentText,
        postCaption,
        geminiApiKey: storedKeys.geminiApiKey,
        openaiApiKey: storedKeys.openaiApiKey,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.replies) && data.replies.length > 0) {
        return { replies: data.replies, modelUsed: data.modelUsed || 'Google Gemini' };
      }
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `AI quick reply failed (${response.status})`);
  } catch (err: any) {
    console.error('[AI Assistant] Quick reply error:', err);
    throw err;
  }
}

/**
 * Generate AI Avatar Customization
 */
export async function generateCustomAIAvatar(options: {
  style: 'Cyberpunk' | 'Anime 3D' | 'Photorealistic Studio' | 'Minimalist Vector' | 'Neon Synthwave' | 'Fantasy Royalty';
  gender?: string;
  traits?: string;
  customSeed?: string;
}): Promise<AvatarResult> {
  const { style, traits = '', customSeed } = options;
  const seed = customSeed || Math.random().toString(36).substring(2, 9);
  const storedKeys = getStoredApiKeys();

  const prompt = `${style} style avatar portrait, ${traits || 'charismatic futuristic digital creator'}, sharp facial features, dramatic cinematic lighting, 8k resolution, octane render`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 45000);

    const response = await fetch('/api/ai/generate-avatar', {
      method: 'POST',
      headers: getAiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        style,
        prompt,
        seed,
        geminiApiKey: storedKeys.geminiApiKey,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.avatarUrl) {
        return {
          avatarUrl: data.avatarUrl,
          promptUsed: prompt,
          modelUsed: data.modelUsed,
        };
      }
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `AI avatar generation failed (${response.status})`);
  } catch (err: any) {
    console.error('[AI Assistant] Avatar server generation error:', err);
    throw err;
  }
}
