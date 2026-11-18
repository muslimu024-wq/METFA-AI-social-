import React, { useEffect, useRef, useState } from 'react';
import {
  Languages,
  Loader2,
  RotateCcw,
  AlertCircle,
  Flag,
  Check,
  X,
} from 'lucide-react';
import { SupportedTranslationLanguage } from '../types/community';
import {
  computeTextContentHash,
  detectReliableSourceLanguageLabel,
  getCachedTranslation,
  getTranslationLanguageLabel,
  reportPoorTranslation,
} from '../utils/translationCache';
import { translatePostText } from '../services/translationService';

export interface PostTranslationCommand {
  action: 'translate' | 'show_original' | 'see_translation';
  lang?: SupportedTranslationLanguage;
  nonce: number;
}

export interface PostTranslationUiStatus {
  isLoading: boolean;
  isShowingTranslation: boolean;
  hasTranslatedResult: boolean;
  errorMsg: string | null;
}

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
  command?: PostTranslationCommand | null;
  onStatusChange?: (status: PostTranslationUiStatus) => void;
  variant?: 'light' | 'gradient';
}

export const TextPostTranslationBar: React.FC<TextPostTranslationBarProps> = ({
  postId,
  sourceText,
  targetLanguage,
  onTargetLanguageChange,
  onTranslationChange,
  command = null,
  onStatusChange,
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
  const lastCommandNonceRef = useRef<number>(0);

  const contentHash = computeTextContentHash(sourceText);

  useEffect(() => {
    onStatusChange?.({
      isLoading,
      isShowingTranslation,
      hasTranslatedResult: Boolean(translatedText),
      errorMsg,
    });
  }, [isLoading, isShowingTranslation, translatedText, errorMsg]);

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
    if (!sourceText || !sourceText.trim()) return;
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

  const handleShowOriginal = () => {
    setErrorMsg(null);
    setIsShowingTranslation(false);
    onTranslationChange({
      isShowingTranslation: false,
      translatedText,
      detectedSourceLanguage,
    });
  };

  const handleToggleTranslate = async (langOverride?: SupportedTranslationLanguage) => {
    if (isLoading) return;
    const activeLang = langOverride || targetLanguage;
    if (langOverride && langOverride !== targetLanguage) {
      onTargetLanguageChange(langOverride);
    }

    if (isShowingTranslation && (!langOverride || langOverride === targetLanguage)) {
      handleShowOriginal();
      return;
    }

    const cached = getCachedTranslation(postId, sourceText, activeLang);
    if (cached) {
      setTranslatedText(cached.translatedText);
      const srcLabel = cached.detectedSourceLanguage || detectReliableSourceLanguageLabel(sourceText);
      setDetectedSourceLanguage(srcLabel);
      setIsShowingTranslation(true);
      setErrorMsg(null);
      onTranslationChange({
        isShowingTranslation: true,
        translatedText: cached.translatedText,
        detectedSourceLanguage: srcLabel,
      });
      return;
    }

    await runTranslation(activeLang);
  };

  // React to imperative translation commands dispatched from the Three-dot menu
  useEffect(() => {
    if (!command || !command.nonce || command.nonce === lastCommandNonceRef.current) return;
    lastCommandNonceRef.current = command.nonce;
    const requestedLang = command.lang || targetLanguage;
    if (command.lang && command.lang !== targetLanguage) {
      onTargetLanguageChange(command.lang);
      setIsReported(false);
    }

    if (command.action === 'show_original') {
      handleShowOriginal();
    } else if (command.action === 'see_translation') {
      handleToggleTranslate(requestedLang);
    } else if (command.action === 'translate') {
      const cached = getCachedTranslation(postId, sourceText, requestedLang);
      if (cached) {
        setTranslatedText(cached.translatedText);
        const srcLabel = cached.detectedSourceLanguage || detectReliableSourceLanguageLabel(sourceText);
        setDetectedSourceLanguage(srcLabel);
        setIsShowingTranslation(true);
        setErrorMsg(null);
        onTranslationChange({
          isShowingTranslation: true,
          translatedText: cached.translatedText,
          detectedSourceLanguage: srcLabel,
        });
      } else {
        runTranslation(requestedLang);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.nonce]);

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

  // Hide controls cleanly beneath idle posts; language selection and trigger live in the Three-dot menu
  if (!isLoading && !isShowingTranslation && !errorMsg) {
    return null;
  }

  const isGradient = variant === 'gradient';

  return (
    <div
      data-testid={`post-translation-bar-${postId}`}
      className="px-4 py-1.5 space-y-1.5"
    >
      {(isLoading || isShowingTranslation) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-testid={`translate-toggle-btn-${postId}`}
              disabled={isLoading}
              onClick={() => (isShowingTranslation ? handleShowOriginal() : handleToggleTranslate())}
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
                  ? `Translating to ${getTranslationLanguageLabel(targetLanguage)}...`
                  : isShowingTranslation
                  ? 'Show Original'
                  : 'See Translation'}
              </span>
            </button>
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
      )}

      {errorMsg && (
        <div
          data-testid={`translation-error-${postId}`}
          className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-[11px] text-rose-800"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="break-words">{errorMsg}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid={`translation-retry-btn-${postId}`}
              onClick={() => runTranslation(targetLanguage, true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold cursor-pointer transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              aria-label="Dismiss translation error"
              onClick={() => setErrorMsg(null)}
              className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100 cursor-pointer transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextPostTranslationBar;
