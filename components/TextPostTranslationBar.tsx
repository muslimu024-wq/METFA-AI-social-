import React, { useEffect, useState } from 'react';
import {
  Languages,
  Loader2,
  RotateCcw,
  AlertCircle,
  Flag,
  Check,
} from 'lucide-react';
import { SupportedTranslationLanguage } from '../types/community';
import {
  SUPPORTED_TRANSLATION_LANGUAGES,
  computeTextContentHash,
  detectReliableSourceLanguageLabel,
  getCachedTranslation,
  getTranslationLanguageLabel,
  reportPoorTranslation,
} from '../utils/translationCache';
import { translatePostText } from '../services/translationService';

interface TextPostTranslationBarProps {
  postId: string;
  sourceText: string;
  targetLanguage: SupportedTranslationLanguage;
  onTargetLanguageChange: (lang: SupportedTranslationLanguage) => void;
  onTranslationChange: (state: {
    isShowingTranslation: boolean;
    translatedText: string | null;
    detectedSourceLanguage: string | null;
  }) => void;
  variant?: 'light' | 'gradient';
}

export const TextPostTranslationBar: React.FC<TextPostTranslationBarProps> = ({
  postId,
  sourceText,
  targetLanguage,
  onTargetLanguageChange,
  onTranslationChange,
  variant = 'light',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShowingTranslation, setIsShowingTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [detectedSourceLanguage, setDetectedSourceLanguage] = useState<string | null>(() =>
    detectReliableSourceLanguageLabel(sourceText)
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReported, setIsReported] = useState(false);

  const contentHash = computeTextContentHash(sourceText);

  // Invalidate displayed translation automatically whenever postId or edited sourceText hash changes
  useEffect(() => {
    setErrorMsg(null);
    setIsReported(false);
    const localDetected = detectReliableSourceLanguageLabel(sourceText);
    setDetectedSourceLanguage(localDetected);

    const cached = getCachedTranslation(postId, sourceText, targetLanguage);
    if (cached && isShowingTranslation) {
      setTranslatedText(cached.translatedText);
      setDetectedSourceLanguage(cached.detectedSourceLanguage || localDetected);
      onTranslationChange({
        isShowingTranslation: true,
        translatedText: cached.translatedText,
        detectedSourceLanguage: cached.detectedSourceLanguage || localDetected,
      });
    } else if (!cached) {
      setTranslatedText(null);
      if (isShowingTranslation) {
        setIsShowingTranslation(false);
        onTranslationChange({
          isShowingTranslation: false,
          translatedText: null,
          detectedSourceLanguage: localDetected,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, contentHash]);

  const runTranslation = async (lang: SupportedTranslationLanguage, forceRefresh = false) => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const { result } = await translatePostText({
        postId,
        text: sourceText,
        targetLanguage: lang,
        forceRefresh,
      });
      setTranslatedText(result.translatedText);
      const srcLabel = result.detectedSourceLanguage || detectReliableSourceLanguageLabel(sourceText);
      setDetectedSourceLanguage(srcLabel);
      setIsShowingTranslation(true);
      setIsReported(false);
      onTranslationChange({
        isShowingTranslation: true,
        translatedText: result.translatedText,
        detectedSourceLanguage: srcLabel,
      });
    } catch (err: any) {
      // Honest failure: preserve original text and offer Retry
      setIsShowingTranslation(false);
      setTranslatedText(null);
      onTranslationChange({
        isShowingTranslation: false,
        translatedText: null,
        detectedSourceLanguage: detectReliableSourceLanguageLabel(sourceText),
      });
      setErrorMsg(
        err?.message || 'Translation failed. Original text has been preserved.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTranslate = async () => {
    if (isLoading) return;
    if (isShowingTranslation) {
      setIsShowingTranslation(false);
      onTranslationChange({
        isShowingTranslation: false,
        translatedText,
        detectedSourceLanguage,
      });
      return;
    }

    if (translatedText) {
      const cached = getCachedTranslation(postId, sourceText, targetLanguage);
      if (cached) {
        setIsShowingTranslation(true);
        onTranslationChange({
          isShowingTranslation: true,
          translatedText: cached.translatedText,
          detectedSourceLanguage: cached.detectedSourceLanguage,
        });
        return;
      }
    }

    await runTranslation(targetLanguage);
  };

  const handleLanguageSelect = async (newLang: SupportedTranslationLanguage) => {
    onTargetLanguageChange(newLang);
    setIsReported(false);
    const cached = getCachedTranslation(postId, sourceText, newLang);
    if (isShowingTranslation) {
      if (cached) {
        setTranslatedText(cached.translatedText);
        setDetectedSourceLanguage(cached.detectedSourceLanguage);
        onTranslationChange({
          isShowingTranslation: true,
          translatedText: cached.translatedText,
          detectedSourceLanguage: cached.detectedSourceLanguage,
        });
      } else {
        await runTranslation(newLang);
      }
    } else if (cached) {
      setTranslatedText(cached.translatedText);
    }
  };

  const handleReportPoorTranslation = () => {
    reportPoorTranslation({
      postId,
      contentHash,
      targetLanguage,
      detectedSourceLanguage: detectedSourceLanguage || undefined,
      reason: 'User reported inaccurate translation',
    });
    setIsReported(true);
  };

  if (!sourceText || !sourceText.trim()) return null;

  const isGradient = variant === 'gradient';

  return (
    <div
      data-testid={`post-translation-bar-${postId}`}
      className="px-4 py-1.5 space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            data-testid={`translate-toggle-btn-${postId}`}
            disabled={isLoading}
            onClick={handleToggleTranslate}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer disabled:opacity-60 ${
              isShowingTranslation
                ? isGradient
                  ? 'bg-teal-500/20 border-teal-400/50 text-teal-900'
                  : 'bg-purple-50 border-purple-200 text-purple-700'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
            ) : (
              <Languages className="w-3.5 h-3.5 text-purple-600" />
            )}
            <span>
              {isLoading
                ? 'Translating...'
                : isShowingTranslation
                ? 'Show Original'
                : 'See Translation'}
            </span>
          </button>

          <select
            aria-label="Target translation language"
            data-testid={`translate-lang-select-${postId}`}
            value={targetLanguage}
            disabled={isLoading}
            onChange={(e) =>
              handleLanguageSelect(e.target.value as SupportedTranslationLanguage)
            }
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {SUPPORTED_TRANSLATION_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label} ({lang.nativeLabel})
              </option>
            ))}
          </select>

          {!isShowingTranslation && detectedSourceLanguage && (
            <span className="text-[10px] text-slate-500 font-medium">
              Detected: {detectedSourceLanguage}
            </span>
          )}
        </div>

        {isShowingTranslation && (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              data-testid={`machine-translated-label-${postId}`}
              className="text-[10px] font-semibold text-slate-500"
            >
              Machine translated
              {detectedSourceLanguage ? ` (${detectedSourceLanguage} → ` : ' to '}
              {getTranslationLanguageLabel(targetLanguage)}
              {detectedSourceLanguage ? ')' : ''}
            </span>

            <button
              type="button"
              data-testid={`report-translation-btn-${postId}`}
              disabled={isReported}
              onClick={handleReportPoorTranslation}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-rose-600 transition cursor-pointer disabled:text-emerald-700 disabled:cursor-default"
            >
              {isReported ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Reported</span>
                </>
              ) : (
                <>
                  <Flag className="w-3 h-3" />
                  <span>Report poor translation</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          data-testid={`translation-error-${postId}`}
          className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-[11px] text-rose-800"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
          <button
            type="button"
            data-testid={`translation-retry-btn-${postId}`}
            onClick={() => runTranslation(targetLanguage, true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold shrink-0 cursor-pointer transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TextPostTranslationBar;
