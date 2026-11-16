import {
  PostTranslationResult,
  SupportedTranslationLanguage,
  TranslationReportRecord,
} from '../types/community';
import { safeGetItem, safeSetItem } from './storageUtils';

const TRANSLATION_CACHE_KEY = 'metfa_post_translation_cache_v1';
const PREFERRED_TRANSLATION_LANG_KEY = 'metfa_preferred_translation_lang_v1';
const TRANSLATION_REPORTS_KEY = 'metfa_translation_reports_v1';

export interface TranslationLanguageOption {
  code: SupportedTranslationLanguage;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_TRANSLATION_LANGUAGES: TranslationLanguageOption[] = [
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
];

export function getTranslationLanguageLabel(code: SupportedTranslationLanguage): string {
  return SUPPORTED_TRANSLATION_LANGUAGES.find((l) => l.code === code)?.label || code.toUpperCase();
}

/**
 * Deterministic versioned content hash for a post's source text.
 * Any edit to source text changes the hash and auto-invalidates stale cached translations.
 */
export function computeTextContentHash(text: string): string {
  const normalized = (text || '').trim();
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `v1_${normalized.length}_${hex1}${hex2}`;
}

function makeCacheKey(
  postId: string,
  contentHash: string,
  targetLanguage: SupportedTranslationLanguage
): string {
  return `${postId}::${contentHash}::${targetLanguage}`;
}

function readCacheMap(): Record<string, PostTranslationResult> {
  const raw = safeGetItem(TRANSLATION_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getCachedTranslation(
  postId: string,
  sourceText: string,
  targetLanguage: SupportedTranslationLanguage
): PostTranslationResult | null {
  if (!postId || !sourceText?.trim()) return null;
  const contentHash = computeTextContentHash(sourceText);
  const key = makeCacheKey(postId, contentHash, targetLanguage);
  const map = readCacheMap();
  const hit = map[key];
  if (!hit || hit.contentHash !== contentHash || hit.targetLanguage !== targetLanguage) {
    return null;
  }
  return hit;
}

export function saveCachedTranslation(result: PostTranslationResult): void {
  if (!result?.postId || !result?.contentHash || !result?.targetLanguage) return;
  const map = readCacheMap();
  const key = makeCacheKey(result.postId, result.contentHash, result.targetLanguage);
  map[key] = result;

  // Keep storage bounded (max ~80 cached translations, dropping oldest first)
  const entries = Object.entries(map);
  if (entries.length > 80) {
    entries.sort((a, b) => Date.parse(b[1].createdAt || '') - Date.parse(a[1].createdAt || ''));
    const trimmed = Object.fromEntries(entries.slice(0, 80));
    safeSetItem(TRANSLATION_CACHE_KEY, JSON.stringify(trimmed));
    return;
  }
  safeSetItem(TRANSLATION_CACHE_KEY, JSON.stringify(map));
}

export function invalidatePostTranslations(postId: string): void {
  if (!postId) return;
  const map = readCacheMap();
  let changed = false;
  for (const k of Object.keys(map)) {
    if (k.startsWith(`${postId}::`)) {
      delete map[k];
      changed = true;
    }
  }
  if (changed) {
    safeSetItem(TRANSLATION_CACHE_KEY, JSON.stringify(map));
  }
}

export function getPreferredTranslationLanguage(): SupportedTranslationLanguage {
  const stored = safeGetItem(PREFERRED_TRANSLATION_LANG_KEY);
  if (stored && SUPPORTED_TRANSLATION_LANGUAGES.some((l) => l.code === stored)) {
    return stored as SupportedTranslationLanguage;
  }
  return 'bn';
}

export function setPreferredTranslationLanguage(lang: SupportedTranslationLanguage): void {
  if (SUPPORTED_TRANSLATION_LANGUAGES.some((l) => l.code === lang)) {
    safeSetItem(PREFERRED_TRANSLATION_LANG_KEY, lang);
  }
}

export function reportPoorTranslation(record: Omit<TranslationReportRecord, 'reportedAt'>): TranslationReportRecord {
  const entry: TranslationReportRecord = {
    ...record,
    reportedAt: new Date().toISOString(),
  };
  const raw = safeGetItem(TRANSLATION_REPORTS_KEY);
  let list: TranslationReportRecord[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {}
  }
  list.unshift(entry);
  safeSetItem(TRANSLATION_REPORTS_KEY, JSON.stringify(list.slice(0, 50)));
  return entry;
}

export function getTranslationReports(): TranslationReportRecord[] {
  const raw = safeGetItem(TRANSLATION_REPORTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Reliable script-level source language detector (returns null if ambiguous, never guesses recklessly).
 */
export function detectReliableSourceLanguageLabel(text?: string | null): string | null {
  const clean = (text || '').trim();
  if (clean.length < 3) return null;

  if (/[\u0980-\u09FF]/.test(clean)) return 'Bengali';
  if (/[\u0900-\u097F]/.test(clean)) return 'Hindi';
  if (/[\u0600-\u06FF]/.test(clean)) {
    // Urdu-specific characters vs general Arabic script
    if (/[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1\u06D2]/.test(clean)) {
      return 'Urdu';
    }
    return 'Arabic';
  }
  if (/[\u4E00-\u9FFF]/.test(clean)) return 'Chinese';
  if (/[\u3040-\u30FF]/.test(clean)) return 'Japanese';
  if (/[\uAC00-\uD7AF]/.test(clean)) return 'Korean';

  // Only label English for Latin script when common English function words appear clearly
  const latinChars = clean.match(/[A-Za-z]/g)?.length || 0;
  if (latinChars >= 6 && latinChars >= clean.replace(/\s+/g, '').length * 0.5) {
    if (/[áéíóúñü¿¡]/i.test(clean)) return 'Spanish';
    if (/[àâçéèêëîïôùûüÿœæ]/i.test(clean)) return 'French';
    if (
      /\b(the|is|are|was|were|have|has|had|this|that|with|from|and|for|not|but|you|your|they|their|we|our|hello|today)\b/i.test(
        clean
      )
    ) {
      return 'English';
    }
  }

  return null;
}
