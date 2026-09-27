import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowUp } from 'lucide-react';
import { ChatAttachment, StudioSettings } from '../types/chat';
import { fileToAttachment } from '../utils/fileUtils';
import AttachmentModal from './AttachmentModal';
import ImageTextScannerModal from './ImageTextScannerModal';
import { addRecentPrompt } from '../features/ai-studio/utils/promptHistoryStore';

export interface MultimodalInputBarProps {
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  isLoading: boolean;
  settings?: Partial<StudioSettings>;
  onUpdateSettings?: (settings: Partial<StudioSettings>) => void;
  onOpenSettings?: () => void;
  onEnhancePrompt?: (prompt: string) => Promise<string>;
  creditsCount?: number;
  onWatchAdClick?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canDownload?: boolean;
  onDownload?: () => void;
}

export const MultimodalInputBar: React.FC<MultimodalInputBarProps> = ({
  onSendMessage,
  isLoading,
  settings,
  onUpdateSettings,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [interimFeedback, setInterimFeedback] = useState<string>('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannerInitialImage, setScannerInitialImage] = useState<string | undefined>(undefined);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoCameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');
  const isSubmittingRef = useRef<boolean>(false);

  // Helper to join voice chunks cleanly
  const joinWithSpacing = (a: string, b: string): string => {
    if (!a) return b;
    if (!b) return a;
    return `${a.trim()} ${b.trim()}`;
  };

  // Listen to prompt restoration events (e.g. from Recent Prompts Drawer or Undo)
  useEffect(() => {
    const handleRestorePrompt = (
      e: CustomEvent<{
        prompt: string;
        stylePreset?: string;
        attachments?: ChatAttachment[];
      }>
    ) => {
      if (e.detail?.prompt !== undefined) {
        setInputText(e.detail.prompt);
        if (e.detail.stylePreset && onUpdateSettings) {
          onUpdateSettings({ stylePreset: e.detail.stylePreset });
        }
        if (e.detail.attachments && Array.isArray(e.detail.attachments)) {
          setAttachments(e.detail.attachments);
        }
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      }
    };
    window.addEventListener('metfa_ai_restore_prompt', handleRestorePrompt as EventListener);
    return () => window.removeEventListener('metfa_ai_restore_prompt', handleRestorePrompt as EventListener);
  }, [onUpdateSettings]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newAttachments: ChatAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 50MB limit.`);
        continue;
      }
      try {
        const att = await fileToAttachment(file);
        newAttachments.push(att);
      } catch (err) {
        console.error('Error processing attachment:', err);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments].slice(0, 10));
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isLoading || isSubmittingRef.current) return;

    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
    }

    const trimmed = inputText.trim();
    if (!trimmed && attachments.length === 0) return;

    if (trimmed) {
      addRecentPrompt(trimmed, settings?.stylePreset, attachments.length > 0);
    }

    isSubmittingRef.current = true;
    const currentAttachments = [...attachments];

    setInputText('');
    setAttachments([]);
    setInterimFeedback('');

    try {
      onSendMessage(trimmed, currentAttachments);
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSend(e);
    }
  };

  const handleTakePhoto = () => {
    photoCameraInputRef.current?.click();
  };

  const handleRecordVideo = () => {
    videoCameraInputRef.current?.click();
  };

  const handleOpenGallery = () => {
    galleryInputRef.current?.click();
  };

  const handleOpenDocuments = () => {
    fileInputRef.current?.click();
  };

  // Internal Web Speech API runner once microphone permission is verified
  const startSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('আপনার ব্রাউজারে স্পিচ রিকগনিশন সাপোর্ট করে না। অনুগ্রহ করে Google Chrome ব্যবহার করুন।');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      // Auto language detection: default to Bengali (bn-BD) with auto detection
      const userLocale = typeof navigator !== 'undefined' ? (navigator.language || 'bn-BD') : 'bn-BD';
      recognition.lang = userLocale.startsWith('bn') ? 'bn-BD' : userLocale;
      recognition.maxAlternatives = 1;

      baseTextRef.current = inputText;

      recognition.onstart = () => {
        setIsRecording(true);
        setSpeechError(null);
        setInterimFeedback('Listening...');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsRecording(false);
        setInterimFeedback('');
      };

      recognition.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error);
        setIsRecording(false);
        setInterimFeedback('');
        alert('মাইক্রোফোন পারমিশন দিন অথবা ব্রাউজার সেটিংসে মাইক অ্যালাউ করুন।');
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimFeedback('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setSpeechError(err?.message || 'Failed to start speech recognition');
      setIsRecording(false);
      setInterimFeedback('');
    }
  };

  // Direct Voice Mic Recognition: Triggers native getUserMedia permission prompt on click
  const toggleSpeechRecognition = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Error stopping recognition:', e);
        }
      }
      setIsRecording(false);
      setInterimFeedback('');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // Release the initial permission-check stream tracks immediately
          try {
            stream.getTracks().forEach((track) => track.stop());
          } catch {}
          // Start Web Speech API / Voice Input
          startSpeechRecognition();
        })
        .catch((err) => {
          console.warn('Microphone permission check failed:', err);
          alert('Please allow microphone access in your browser settings.');
        });
    } else {
      startSpeechRecognition();
    }
  };

  const hasContent = Boolean(inputText.trim() || attachments.length > 0);

  return (
    <div className="w-full">
      {/* Hidden File Inputs */}
      <input
        ref={photoCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
      <input
        ref={videoCameraInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*,.pdf,.doc,.docx,.txt,.json,.ts,.tsx,.py"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Choose an Action Bottom Modal / Action Sheet */}
      <AttachmentModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        onTakePhoto={handleTakePhoto}
        onRecordVideo={handleRecordVideo}
        onOpenGallery={handleOpenGallery}
        onOpenDocuments={handleOpenDocuments}
        onScanText={() => {
          setScannerInitialImage(undefined);
          setIsScannerModalOpen(true);
        }}
      />

      {/* Browser-Side OCR Image Text Scanner Modal */}
      <ImageTextScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => {
          setIsScannerModalOpen(false);
          setScannerInitialImage(undefined);
        }}
        initialImageSrc={scannerInitialImage}
      />

      {/* Speech Error Banner if any */}
      {speechError && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between px-3 py-1.5 text-xs text-amber-800 bg-amber-50 rounded-lg border border-amber-200">
          <span className="truncate">{speechError}</span>
          <button
            type="button"
            onClick={() => setSpeechError(null)}
            className="text-gray-500 hover:text-gray-800 text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Attachments Preview if any */}
      {attachments.length > 0 && (
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto pb-2 px-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 h-14 w-16 flex items-center justify-center shadow-xs"
            >
              {att.type === 'image' && att.previewUrl ? (
                <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-gray-600 truncate px-1">📎 {att.name}</span>
              )}
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-red-600 text-white rounded-full transition cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Live Voice Recording Status */}
      {isRecording && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between bg-rose-50 border border-rose-200 text-rose-800 rounded-full px-4 py-1.5 text-xs animate-fadeIn shadow-xs">
          <span className="flex items-center gap-2 font-medium">
            <span className="text-base animate-pulse">🎙️</span> Listening (Auto-detect)... {interimFeedback ? `"${interimFeedback}"` : ''}
          </span>
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-semibold cursor-pointer transition"
          >
            Done
          </button>
        </div>
      )}

      {/* Clean Single-Line Input Bar without Language Selector */}
      <div className="p-3 bg-white border-t border-gray-200 w-full">
        <div className="max-w-4xl mx-auto flex items-center gap-2 bg-gray-100 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 border border-gray-200 focus-within:border-purple-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
          {/* Attachment Icon */}
          <button
            type="button"
            id="chat-attach-btn"
            onClick={() => setIsActionModalOpen(true)}
            className="text-gray-500 hover:text-purple-600 p-1 text-base leading-none transition cursor-pointer shrink-0"
            title="Attach"
            aria-label="Attach file"
          >
            📎
          </button>

          {/* Clean Input with 'Ask Metfa AI...' */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Metfa AI..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 placeholder-gray-400 py-1"
          />

          {/* Compact Small Microphone Icon */}
          <button
            type="button"
            id="chat-voice-btn"
            onClick={toggleSpeechRecognition}
            className={`p-1.5 rounded-full transition text-xs flex items-center justify-center cursor-pointer shrink-0 ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse shadow-xs'
                : 'text-gray-500 hover:text-purple-600'
            }`}
            title="Voice Typing"
            aria-label="Voice input"
          >
            🎙️
          </button>

          {/* High-Contrast Gemini-Style Send Button (⬆ Arrow) */}
          <button
            type="button"
            id="chat-send-btn"
            disabled={!hasContent || isLoading}
            onClick={handleSend}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition font-bold text-sm shrink-0 ${
              hasContent && !isLoading
                ? 'bg-purple-600 text-white shadow-md hover:bg-purple-700 cursor-pointer active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title="Send"
            aria-label="Send"
          >
            ⬆
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultimodalInputBar;
