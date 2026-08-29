export interface SpeechLanguageOption {
  code: string;
  label: string;
  short: string;
  nativeName: string;
}

export const SUPPORTED_SPEECH_LANGUAGES: SpeechLanguageOption[] = [
  { code: 'auto', label: 'Auto-Detect (Browser / System)', short: 'Auto', nativeName: '🌐 Auto' },
  { code: 'en-US', label: 'English (US/UK/Global)', short: 'EN', nativeName: 'English' },
  { code: 'bn-BD', label: 'বাংলা (Bengali - Bangladesh)', short: 'BN', nativeName: 'বাংলা' },
  { code: 'fil-PH', label: 'Tagalog / Filipino (Philippines)', short: 'TL', nativeName: 'Tagalog' },
  { code: 'ms-MY', label: 'Bahasa Melayu (Malay - Malaysia)', short: 'MS', nativeName: 'Bahasa Melayu' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi - India)', short: 'HI', nativeName: 'हिन्दी' },
  { code: 'ar-SA', label: 'العربية (Arabic - Saudi/Global)', short: 'AR', nativeName: 'العربية' },
  { code: 'es-ES', label: 'Español (Spanish)', short: 'ES', nativeName: 'Español' },
  { code: 'fr-FR', label: 'Français (French)', short: 'FR', nativeName: 'Français' },
  { code: 'ur-PK', label: 'اردو (Urdu)', short: 'UR', nativeName: 'اردو' },
  { code: 'id-ID', label: 'Bahasa Indonesia (Indonesian)', short: 'ID', nativeName: 'Bahasa Indonesia' },
  { code: 'ja-JP', label: '日本語 (Japanese)', short: 'JA', nativeName: '日本語' },
  { code: 'de-DE', label: 'Deutsch (German)', short: 'DE', nativeName: 'Deutsch' },
  { code: 'zh-CN', label: '中文 (Chinese Mandarin)', short: 'ZH', nativeName: '简体中文' },
  { code: 'pt-BR', label: 'Português (Portuguese)', short: 'PT', nativeName: 'Português' },
  { code: 'ru-RU', label: 'Русский (Russian)', short: 'RU', nativeName: 'Русский' },
  { code: 'ko-KR', label: '한국어 (Korean)', short: 'KO', nativeName: '한국어' },
  { code: 'vi-VN', label: 'Tiếng Việt (Vietnamese)', short: 'VI', nativeName: 'Tiếng Việt' },
  { code: 'it-IT', label: 'Italiano (Italian)', short: 'IT', nativeName: 'Italiano' },
  { code: 'th-TH', label: 'ไทย (Thai)', short: 'TH', nativeName: 'ไทย' },
  { code: 'tr-TR', label: 'Türkçe (Turkish)', short: 'TR', nativeName: 'Türkçe' },
];

/**
 * Resolves the effective BCP-47 language tag for Web Speech API.
 * When 'auto' is selected, dynamically detects navigator.language (e.g. tl-PH, ms-MY, bn-BD, hi-IN, ar-SA, en-US)
 */
export const getEffectiveSpeechLanguage = (code: string): string => {
  if (code === 'auto') {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
    return 'en-US';
  }
  return code;
};
