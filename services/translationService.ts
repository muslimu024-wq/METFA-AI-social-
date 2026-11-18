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
import { getStoredApiKeys } from '../utils/apiKeysStore';

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
  const storedKeys = getStoredApiKeys();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (storedKeys.geminiApiKey) {
    headers['x-gemini-api-key'] = storedKeys.geminiApiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }, 22000);

  let response: Response;
  try {
    response = await fetch('/api/ai/translate', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        postId: params.postId,
        text: cleanText,
        targetLanguage: params.targetLanguage,
        targetLanguageLabel: getTranslationLanguageLabel(params.targetLanguage),
        ...(storedKeys.geminiApiKey ? { geminiApiKey: storedKeys.geminiApiKey } : {}),
      }),
    });
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    throw new TranslationServiceError(
      isAbort
        ? 'Translation request timed out. Original post text is preserved.'
        : err?.message || 'Unable to reach translation server. Original post text is preserved.',
      'NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let rawBody = '';
  try {
    rawBody = await response.text();
  } catch {
    throw new TranslationServiceError(
      `Unable to read translation server response (HTTP ${response.status}). Original text preserved.`,
      'TRANSLATION_FAILED',
      response.status
    );
  }

  const trimmedBody = rawBody.trim();
  const looksLikeHtml =
    contentType.includes('text/html') ||
    trimmedBody.startsWith('<!doctype') ||
    trimmedBody.startsWith('<!DOCTYPE') ||
    trimmedBody.startsWith('<html');

  if (looksLikeHtml) {
    throw new TranslationServiceError(
      `Translation endpoint returned HTML instead of JSON (HTTP ${response.status}). Original text has been preserved.`,
      'TRANSLATION_FAILED',
      response.status
    );
  }

  let payload: any = null;
  if (trimmedBody) {
    try {
      payload = JSON.parse(trimmedBody);
    } catch {
      throw new TranslationServiceError(
        `Translation service returned invalid JSON response (HTTP ${response.status}). Original text has been preserved.`,
        'TRANSLATION_FAILED',
        response.status
      );
    }
  }

  const normalized = Array.isArray(payload) ? payload[0] : payload;
  const translatedTextRaw =
    typeof normalized?.translatedText === 'string'
      ? normalized.translatedText
      : typeof normalized?.translated_text === 'string'
      ? normalized.translated_text
      : '';

  if (!response.ok || normalized?.success === false || !translatedTextRaw.trim()) {
    const code =
      normalized?.code === 'AI_KEY_REQUIRED' || response.status === 503
        ? 'AI_KEY_REQUIRED'
        : 'TRANSLATION_FAILED';
    throw new TranslationServiceError(
      normalized?.error ||
        `Translation service did not return translated text (HTTP ${response.status}). Original text has been preserved.`,
      code,
      response.status
    );
  }

  const result: PostTranslationResult = {
    postId: params.postId,
    contentHash,
    targetLanguage: params.targetLanguage,
    translatedText: translatedTextRaw,
    detectedSourceLanguage: String(normalized?.detectedSourceLanguage || 'Detected'),
    modelUsed: normalized?.modelUsed || 'gemini-4-hydrogen',
    createdAt: new Date().toISOString(),
  };

  saveCachedTranslation(result);
  return { result, fromCache: false };
}
