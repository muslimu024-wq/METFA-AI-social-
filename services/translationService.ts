import {
  PostTranslationResult,
  SupportedTranslationLanguage,
} from '../types/community';
import {
  computeTextContentHash,
  getCachedTranslation,
  getTranslationLanguageLabel,
  saveCachedTranslation,
} from '../utils/translationCache';
import { getClientAuthToken } from './supabaseClient';

export class TranslationServiceError extends Error {
  code: 'AI_KEY_REQUIRED' | 'NETWORK_ERROR' | 'TRANSLATION_FAILED';
  status?: number;

  constructor(
    message: string,
    code: 'AI_KEY_REQUIRED' | 'NETWORK_ERROR' | 'TRANSLATION_FAILED' = 'TRANSLATION_FAILED',
    status?: number
  ) {
    super(message);
    this.name = 'TranslationServiceError';
    this.code = code;
    this.status = status;
  }
}

export async function translatePostText(params: {
  postId: string;
  text: string;
  targetLanguage: SupportedTranslationLanguage;
  forceRefresh?: boolean;
}): Promise<{ result: PostTranslationResult; fromCache: boolean }> {
  const cleanText = (params.text || '').trim();
  if (!cleanText) {
    throw new TranslationServiceError('There is no text content to translate.', 'TRANSLATION_FAILED');
  }

  const contentHash = computeTextContentHash(cleanText);
  if (!params.forceRefresh) {
    const cached = getCachedTranslation(params.postId, cleanText, params.targetLanguage);
    if (cached) {
      return { result: cached, fromCache: true };
    }
  }

  const token = await getClientAuthToken().catch(() => null);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch('/api/ai/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        postId: params.postId,
        text: cleanText,
        targetLanguage: params.targetLanguage,
        targetLanguageLabel: getTranslationLanguageLabel(params.targetLanguage),
      }),
    });
  } catch (err: any) {
    throw new TranslationServiceError(
      err?.message || 'Unable to reach translation server. Original post text is preserved.',
      'NETWORK_ERROR'
    );
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.translatedText) {
    const code =
      payload?.code === 'AI_KEY_REQUIRED' || response.status === 503
        ? 'AI_KEY_REQUIRED'
        : 'TRANSLATION_FAILED';
    throw new TranslationServiceError(
      payload?.error ||
        `Translation request failed (${response.status}). Original text has been preserved.`,
      code,
      response.status
    );
  }

  const result: PostTranslationResult = {
    postId: params.postId,
    contentHash,
    targetLanguage: params.targetLanguage,
    translatedText: String(payload.translatedText),
    detectedSourceLanguage: String(payload.detectedSourceLanguage || 'Detected'),
    modelUsed: payload.modelUsed || 'gemini-4-hydrogen',
    createdAt: new Date().toISOString(),
  };

  saveCachedTranslation(result);
  return { result, fromCache: false };
}
