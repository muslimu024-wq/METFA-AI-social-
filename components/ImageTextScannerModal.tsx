import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  ScanText,
  Copy,
  Check,
  RotateCcw,
  Send,
  AlertCircle,
  Loader2,
  Languages,
  FileText,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { createWorker } from 'tesseract.js';

export type ScannerState =
  | 'idle'
  | 'image_selected'
  | 'scanning'
  | 'extracted'
  | 'no_text'
  | 'error';

export type OCRLanguage = 'eng' | 'ben' | 'eng+ben';

export interface ImageTextScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImageSrc?: string;
  onExtractedTextSent?: (text: string) => void;
}

const LANGUAGE_OPTIONS: { id: OCRLanguage; label: string; subLabel: string }[] = [
  { id: 'eng', label: 'English', subLabel: 'Standard Latin Text' },
  { id: 'ben', label: 'বাংলা (Bangla)', subLabel: 'Bengali Script' },
  { id: 'eng+ben', label: 'English + বাংলা', subLabel: 'Bilingual / মিশ্র' },
];

/**
 * ImageTextScannerModal — Client-Side OCR Utility for METFA AI
 * Performs zero-cost, private client-side OCR inside Web Workers via Tesseract.js.
 * Does not invoke Gemini/OpenAI/Grok or external vision APIs for optical character recognition.
 */
export const ImageTextScannerModal: React.FC<ImageTextScannerModalProps> = ({
  isOpen,
  onClose,
  initialImageSrc,
  onExtractedTextSent,
}) => {
  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ name: string; size: number } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<OCRLanguage>('eng');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeWorkerRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Terminate active OCR worker if running
  const cleanupActiveWorker = useCallback(async () => {
    if (activeWorkerRef.current) {
      try {
        await activeWorkerRef.current.terminate();
      } catch (err) {
        console.warn('OCR worker termination notice:', err);
      } finally {
        activeWorkerRef.current = null;
      }
    }
  }, []);

  // Reset state when opening or closing
  useEffect(() => {
    if (isOpen) {
      if (initialImageSrc) {
        setSelectedImageSrc(initialImageSrc);
        setImageMeta({ name: 'Selected Image', size: 0 });
        setScannerState('image_selected');
      } else {
        setScannerState('idle');
        setSelectedImageSrc(null);
        setImageMeta(null);
      }
      setExtractedText('');
      setConfidence(null);
      setErrorMessage(null);
      setScanProgress(0);
      setStatusMessage('');
      setIsCopied(false);
      setCopyFeedback(null);
    } else {
      cleanupActiveWorker();
    }
    return () => {
      cleanupActiveWorker();
    };
  }, [isOpen, initialImageSrc, cleanupActiveWorker]);

  if (!isOpen) return null;

  // Handle local image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP, etc.).');
      setScannerState('error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImageSrc(result);
      setImageMeta({ name: file.name, size: file.size });
      setScannerState('image_selected');
      setErrorMessage(null);
      setExtractedText('');
      setConfidence(null);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected image file.');
      setScannerState('error');
    };
    reader.readAsDataURL(file);
  };

  // Execute client-side OCR recognition
  const handleStartScan = async () => {
    if (!selectedImageSrc) return;

    setScannerState('scanning');
    setScanProgress(5);
    setStatusMessage('Initializing OCR engine...');
    setErrorMessage(null);

    try {
      await cleanupActiveWorker();

      // Determine language argument for Tesseract.js
      const langParam = selectedLanguage === 'eng+ben' ? ['eng', 'ben'] : selectedLanguage;

      const worker = await createWorker(langParam as any, 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setStatusMessage('Recognizing text characters...');
            setScanProgress(Math.max(10, Math.round((m.progress || 0) * 100)));
          } else if (m.status === 'loading tesseract core') {
            setStatusMessage('Loading core WebAssembly runtime...');
            setScanProgress(15);
          } else if (m.status === 'loading language traineddata') {
            setStatusMessage(`Downloading language data (${selectedLanguage})...`);
            setScanProgress(30);
          } else if (m.status === 'initializing api') {
            setStatusMessage('Configuring language dictionaries...');
            setScanProgress(50);
          }
        },
      });

      activeWorkerRef.current = worker;

      const recognitionResult = await worker.recognize(selectedImageSrc);
      const recognizedRaw = recognitionResult.data?.text || '';
      const recognizedTrimmed = recognizedRaw.trim();
      const avgConfidence = recognitionResult.data?.confidence ?? null;

      // Clean up worker immediately after recognition
      await worker.terminate();
      activeWorkerRef.current = null;

      if (!recognizedTrimmed) {
        setScannerState('no_text');
        setExtractedText('');
        setConfidence(avgConfidence);
      } else {
        setExtractedText(recognizedRaw);
        setConfidence(avgConfidence);
        setScannerState('extracted');
      }
    } catch (err: any) {
      console.error('Client-side OCR scan failed:', err);
      activeWorkerRef.current = null;
      setErrorMessage(
        err?.message ||
          'OCR engine encountered an error while processing the image. Please verify your connection or try another image.'
      );
      setScannerState('error');
    }
  };

  // Copy entire extracted text to clipboard
  const handleCopyAll = async () => {
    if (!extractedText) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(extractedText);
      } else {
        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = extractedText;
        document.body.appendChild(tempTextarea);
        tempTextarea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextarea);
      }
      setIsCopied(true);
      setCopyFeedback('All text copied to clipboard!');
      setTimeout(() => {
        setIsCopied(false);
        setCopyFeedback(null);
      }, 2500);
    } catch (err) {
      setCopyFeedback('Automatic copy blocked. Please select and copy manually.');
    }
  };

  // Send extracted/edited text to METFA AI prompt box
  const handleSendToAI = () => {
    const textToSend = extractedText.trim();
    if (!textToSend) return;

    // Dispatch the existing prompt-restore event
    window.dispatchEvent(
      new CustomEvent('metfa_ai_restore_prompt', {
        detail: {
          prompt: textToSend,
        },
      })
    );

    if (onExtractedTextSent) {
      onExtractedTextSent(textToSend);
    }

    onClose();
  };

  // Close modal with safety cleanup
  const handleModalClose = () => {
    cleanupActiveWorker();
    onClose();
  };

  return (
    <div
      onClick={handleModalClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
              <ScanText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="ocr-modal-title" className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Image Text Scanner (OCR)
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Client-Side
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Zero-cost local text extraction from images without external API calls
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-ocr-scanner-modal-btn"
            onClick={handleModalClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Modal Body / Scrollable Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin">
          {/* Language Selection Header */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-purple-600" /> Target Language
              </label>
              <span className="text-[11px] text-gray-500">Trained OCR dictionaries</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LANGUAGE_OPTIONS.map((lang) => {
                const isSelected = selectedLanguage === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    disabled={scannerState === 'scanning'}
                    onClick={() => setSelectedLanguage(lang.id)}
                    className={`px-3 py-2 rounded-xl text-left border transition text-xs flex flex-col justify-center ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50/40'
                    } ${scannerState === 'scanning' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-semibold">{lang.label}</span>
                    <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-purple-100' : 'text-gray-500'}`}>
                      {lang.subLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STATE 1: IDLE / SELECT IMAGE */}
          {scannerState === 'idle' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition group"
            >
              <div className="p-3.5 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 group-hover:scale-105 transition-transform mb-3">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Choose or drop an image</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Select a screenshot, receipt, book page, or sign to scan and extract text
              </p>
              <button
                type="button"
                id="ocr-select-image-btn"
                className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                Browse Gallery & Files
              </button>
            </div>
          )}

          {/* STATE 2: IMAGE SELECTED (READY TO SCAN) */}
          {scannerState === 'image_selected' && selectedImageSrc && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-900 max-h-64 flex items-center justify-center">
                <img
                  src={selectedImageSrc}
                  alt="Selected preview"
                  className="max-h-64 w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black text-white text-xs font-medium backdrop-blur-xs transition"
                >
                  Change Image
                </button>
              </div>

              {imageMeta && (
                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span className="truncate max-w-xs">{imageMeta.name}</span>
                  {imageMeta.size > 0 && (
                    <span>{(imageMeta.size / 1024).toFixed(1)} KB</span>
                  )}
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  id="ocr-start-scan-btn"
                  onClick={handleStartScan}
                  className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
                >
                  <ScanText className="w-4 h-4" />
                  Scan Text Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImageSrc(null);
                    setScannerState('idle');
                  }}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-semibold text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: SCANNING / OCR IN PROGRESS */}
          {scannerState === 'scanning' && (
            <div className="border border-purple-200 bg-purple-50/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-sm text-purple-600 animate-pulse">
                  <ScanText className="w-8 h-8" />
                </div>
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin absolute -top-1 -right-1" />
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping shrink-0" />
                    {statusMessage || 'Processing image...'}
                  </span>
                  <span className="text-purple-700 font-bold ml-2 shrink-0">{scanProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-300 rounded-full"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 max-w-sm">
                Running optical character recognition directly in your browser. This does not use network AI credits.
              </p>

              <button
                type="button"
                onClick={async () => {
                  await cleanupActiveWorker();
                  setScannerState(selectedImageSrc ? 'image_selected' : 'idle');
                }}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline"
              >
                Cancel Scan
              </button>
            </div>
          )}

          {/* STATE 4: EXTRACTED TEXT (EDITABLE & READY TO COPY/SEND) */}
          {scannerState === 'extracted' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-600 px-1">
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" /> Extracted Text ({extractedText.length} chars)
                </span>
                {confidence !== null && (
                  <span className="text-[11px] text-gray-500">
                    Confidence: <span className="font-semibold text-gray-700">{Math.round(confidence)}%</span>
                  </span>
                )}
              </div>

              {/* Editable Textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  rows={8}
                  placeholder="Extracted text will appear here. You can freely edit or refine it..."
                  className="w-full bg-white border border-gray-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 rounded-2xl p-3.5 text-sm text-gray-900 leading-relaxed resize-y scrollbar-thin outline-none"
                />
              </div>

              {/* Copy Feedback Toast/Notice */}
              {copyFeedback && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl animate-fadeIn">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{copyFeedback}</span>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  {/* Copy All Button */}
                  <button
                    type="button"
                    id="ocr-copy-all-btn"
                    onClick={handleCopyAll}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs transition flex items-center gap-1.5 border border-gray-200"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-600" />
                        <span>Copy All</span>
                      </>
                    )}
                  </button>

                  {/* Rescan / Retry Button */}
                  <button
                    type="button"
                    id="ocr-rescan-btn"
                    onClick={handleStartScan}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs transition flex items-center gap-1.5 border border-gray-200"
                    title="Rescan image with current language settings"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
                    <span>Rescan</span>
                  </button>

                  {/* Change Image Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition"
                  >
                    New Image
                  </button>
                </div>

                {/* Send to METFA AI Button */}
                <button
                  type="button"
                  id="ocr-send-to-ai-btn"
                  onClick={handleSendToAI}
                  disabled={!extractedText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to METFA AI</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 5: NO TEXT DETECTED */}
          {scannerState === 'no_text' && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-6 text-center space-y-3">
              <div className="p-3 rounded-2xl bg-white border border-amber-200 text-amber-600 inline-block shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">No readable text found</h4>
              <p className="text-xs text-gray-600 max-w-md mx-auto">
                No clear text could be recognized in this image. Try ensuring the image is upright, properly lit, and that the appropriate language (English or বাংলা) is selected.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleStartScan}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry Scan
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold transition"
                >
                  Try Different Image
                </button>
              </div>
            </div>
          )}

          {/* STATE 6: ERROR OCCURRED */}
          {scannerState === 'error' && (
            <div className="border border-rose-200 bg-rose-50/60 rounded-2xl p-6 text-center space-y-3">
              <div className="p-3 rounded-2xl bg-white border border-rose-200 text-rose-600 inline-block shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Scan Failed</h4>
              <p className="text-xs text-rose-800 max-w-md mx-auto">
                {errorMessage || 'An error occurred during OCR text extraction.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {selectedImageSrc && (
                  <button
                    type="button"
                    onClick={handleStartScan}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Try Again
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold transition"
                >
                  Choose Another Image
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 shrink-0">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-gray-400" />
            Extracted text can be edited before sending.
          </span>
          <button
            type="button"
            onClick={handleModalClose}
            className="text-gray-600 hover:text-gray-900 font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageTextScannerModal;
