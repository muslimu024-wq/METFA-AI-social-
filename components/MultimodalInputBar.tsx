import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  Sparkles,
  X,
  FileText,
  Video,
  Layers,
  Wand2,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { ChatAttachment, StudioSettings } from '../types/chat';
import { fileToAttachment } from '../utils/fileUtils';
import AttachmentModal from './AttachmentModal';

export interface MultimodalInputBarProps {
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  isLoading: boolean;
  settings?: Partial<StudioSettings>;
  onUpdateSettings?: (settings: Partial<StudioSettings>) => void;
  onOpenSettings?: () => void;
  onEnhancePrompt?: (prompt: string) => Promise<string>;
  creditsCount: number;
  onWatchAdClick?: () => void;
}

const STYLE_PRESETS = [
  'None',
  'Cyberpunk 2088',
  'Anime Studio Ghibli',
  'Photorealistic 8K',
  'Cinematic Sci-Fi',
  'Fantasy Oil Painting',
  'Surrealist Dream',
  'Vibrant 3D Render',
];

export const MultimodalInputBar: React.FC<MultimodalInputBarProps> = ({
  onSendMessage,
  isLoading,
  settings,
  onUpdateSettings,
  onEnhancePrompt,
  onWatchAdClick,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [interimFeedback, setInterimFeedback] = useState<string>('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoCameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');
  const isSubmittingRef = useRef<boolean>(false);

  // Gemini-style auto-expanding textarea: starts single line (40px), auto-expands up to max-h-36 (144px), then scrolls
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Single line starts at 40px, caps at max-h-36 (144px)
      const targetHeight = Math.min(Math.max(40, scrollHeight), 144);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [inputText]);

  // Clean up recognition on unmount
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

    // Prevent duplicate triggers if currently loading or submitting
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

    isSubmittingRef.current = true;
    const currentAttachments = [...attachments];

    // Clear UI state cleanly and snap back to single-line default
    setInputText('');
    setAttachments([]);
    setInterimFeedback('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }

    // Call callback once
    try {
      onSendMessage(trimmed, currentAttachments);
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSend(e);
    }
  };

  const handleEnhanceClick = async () => {
    if (!inputText.trim() || isEnhancing || !onEnhancePrompt) return;
    try {
      setIsEnhancing(true);
      const enhanced = await onEnhancePrompt(inputText);
      if (enhanced) {
        setInputText(enhanced);
      }
    } catch (err) {
      console.error('Failed to enhance prompt:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleTakePhoto = () => {
    try {
      localStorage.setItem('has_granted_permissions', 'true');
      localStorage.setItem('metfa_media_permissions_granted', 'granted');
    } catch {
      // ignore
    }
    photoCameraInputRef.current?.click();
  };

  const handleRecordVideo = () => {
    try {
      localStorage.setItem('has_granted_permissions', 'true');
      localStorage.setItem('metfa_media_permissions_granted', 'granted');
    } catch {
      // ignore
    }
    videoCameraInputRef.current?.click();
  };

  const handleOpenGallery = () => {
    galleryInputRef.current?.click();
  };

  const handleOpenDocuments = () => {
    fileInputRef.current?.click();
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

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

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // Auto-detect client / browser language dynamically in the background without UI dropdowns
      const autoDetectedLang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
      recognition.lang = autoDetectedLang;
      recognition.maxAlternatives = 1;

      // Save the base text buffer before this speech session started
      baseTextRef.current = inputText;

      recognition.onstart = () => {
        try {
          localStorage.setItem('has_granted_permissions', 'true');
          localStorage.setItem('metfa_media_permissions_granted', 'granted');
        } catch {
          // ignore
        }
        setIsRecording(true);
        setSpeechError(null);
        setInterimFeedback('🎙️ Listening... (Auto-detecting language)');
      };

      recognition.onresult = (event: any) => {
        let sessionFinal = '';
        let sessionInterim = '';

        // Iterate through all results in the current session
        for (let i = 0; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            sessionFinal += transcriptChunk;
          } else {
            sessionInterim += transcriptChunk;
          }
        }

        // Construct clean text without repetitive duplicate word appending
        const currentSessionTranscript = (sessionFinal + (sessionInterim ? ' ' + sessionInterim : '')).trim();
        const base = baseTextRef.current.trim();
        const updated = base
          ? `${base} ${currentSessionTranscript}`
          : currentSessionTranscript;

        setInputText(updated);
        setInterimFeedback(sessionInterim || sessionFinal || '');
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone permission required for voice typing.');
        } else if (event.error === 'no-speech') {
          // Benign timeout
        } else {
          setSpeechError(`Voice recognition: ${event.error}`);
        }
        setIsRecording(false);
        setInterimFeedback('');
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimFeedback('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Could not start speech recognition:', err);
      setIsRecording(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hidden file inputs configured with distinct target modes */}
      {/* 1. Direct Photo Capture */}
      <input
        ref={photoCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* 2. Direct Video Recording */}
      <input
        ref={videoCameraInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* 3. Media Gallery (Photos & Videos) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* 4. Documents & General Code/Files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*,.pdf,.doc,.docx,.txt,.json,.ts,.tsx,.py"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Choose an Action Bottom Modal / Action Sheet (Includes Camera as 1st option) */}
      <AttachmentModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        onTakePhoto={handleTakePhoto}
        onRecordVideo={handleRecordVideo}
        onOpenGallery={handleOpenGallery}
        onOpenDocuments={handleOpenDocuments}
      />

      {/* Style Presets Bar (collapsible / toggleable) */}
      {showPresets && (
        <div className="w-full max-w-5xl xl:max-w-6xl px-3 mb-2 flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin animate-fadeIn">
          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-600" /> Preset:
          </span>
          {STYLE_PRESETS.map((preset) => {
            const isSelected =
              settings?.stylePreset === preset || (!settings?.stylePreset && preset === 'None');
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onUpdateSettings?.({ stylePreset: preset === 'None' ? '' : preset });
                }}
                className={`text-xs px-3 py-1 rounded-xl whitespace-nowrap font-medium transition border ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:text-purple-700'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      )}

      {/* Live Voice Recording Status Bar if active */}
      {isRecording && (
        <div className="w-full max-w-5xl xl:max-w-6xl mb-2 px-3 flex items-center justify-between bg-rose-50 border border-rose-200 rounded-2xl py-1.5 px-3 animate-fadeIn text-xs shadow-sm gap-2">
          <div className="flex items-center gap-2 text-rose-800 min-w-0">
            <Radio className="w-4 h-4 text-rose-600 animate-spin shrink-0" />
            <span className="font-bold shrink-0">
              🎙️ Listening... (Auto-Detecting Language)
            </span>
            {interimFeedback && (
              <span className="text-rose-950 font-medium italic truncate max-w-[200px] sm:max-w-md">
                "{interimFeedback}"
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-sm shrink-0 transition"
          >
            Done
          </button>
        </div>
      )}

      {/* Main Light / Book Reading Theme Input Card */}
      <div className="w-full max-w-5xl xl:max-w-6xl bg-white border border-gray-300 hover:border-gray-400 focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-500/20 rounded-2xl p-2.5 sm:p-3 shadow-sm transition-all relative">
        {/* Attachments Preview Carousel */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-2 border-b border-gray-100">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative group shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 h-16 w-20 flex items-center justify-center shadow-xs"
              >
                {att.type === 'image' && att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
                ) : att.type === 'video' ? (
                  <div className="flex flex-col items-center justify-center p-1 text-center">
                    <Video className="w-5 h-5 text-indigo-600" />
                    <span className="text-[9px] text-gray-600 truncate max-w-[64px]">{att.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-1 text-center">
                    <FileText className="w-5 h-5 text-teal-600" />
                    <span className="text-[9px] text-gray-600 truncate max-w-[64px]">{att.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-600 text-white rounded-full transition opacity-90 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Gemini-Style Auto-Expanding Single-to-Multiline Textarea */}
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Metfa Social, speak in any language, describe ideas or paste details..."
          rows={1}
          className="w-full bg-transparent text-gray-900 placeholder-gray-400 text-sm md:text-base resize-none focus:outline-none px-2 py-1.5 min-h-[40px] max-h-36 overflow-y-auto leading-relaxed scrollbar-thin"
        />

        {/* Speech Error Banner */}
        {speechError && (
          <div className="flex items-center justify-between px-3 py-1.5 mb-2 text-xs text-amber-800 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span className="truncate">{speechError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSpeechError(null)}
              className="text-gray-500 hover:text-gray-900 text-xs ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Toolbar Footer Actions (In-Bar Camera Removed, Preserving Attach, Voice, Styles, Ad Badge, Send) */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
          {/* Left Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            {/* 1. Attachment / Paperclip Button (Opens "Choose an Action" Action Sheet) */}
            <button
              type="button"
              id="chat-attach-action-btn"
              onClick={() => setIsActionModalOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition flex items-center gap-1 text-xs font-medium"
              title="Attach Camera, Video, Photos & Videos, or Documents"
            >
              <Paperclip className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">Attach</span>
            </button>

            {/* 2. Multilingual Voice Recognition Button (Auto-Detect, No Dropdown) */}
            <button
              type="button"
              id="chat-voice-btn"
              onClick={toggleSpeechRecognition}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 text-xs font-medium ${
                isRecording
                  ? 'bg-rose-600 text-white font-bold animate-pulse shadow-sm'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 bg-gray-50 border border-gray-200'
              }`}
              title={isRecording ? 'Stop Recording' : 'Voice Input (Auto-detects any spoken language)'}
            >
              {isRecording ? (
                <MicOff className="w-3.5 h-3.5 text-white" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>{isRecording ? 'Listening...' : 'Voice'}</span>
            </button>

            {/* 3. Layers / Style Presets Button */}
            <button
              type="button"
              id="chat-styles-btn"
              onClick={() => setShowPresets(!showPresets)}
              className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-medium ${
                showPresets
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title="Choose style presets"
            >
              <Layers className="w-4 h-4 text-amber-600" />
              <span className="hidden md:inline">Styles</span>
            </button>

            {/* Optional AI Enhance Prompt Button */}
            {inputText.trim().length > 5 && onEnhancePrompt && (
              <button
                type="button"
                disabled={isEnhancing}
                onClick={handleEnhanceClick}
                className="p-2 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition flex items-center gap-1"
                title="Enhance prompt with AI"
              >
                <Wand2 className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin text-purple-600' : 'text-purple-600'}`} />
                <span>{isEnhancing ? 'Enhancing...' : 'Enhance'}</span>
              </button>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 4. Rewarded Video Ad Badge (+2 Free Coins / Credits) */}
            {onWatchAdClick && (
              <button
                type="button"
                id="chat-input-reward-ad-btn"
                onClick={onWatchAdClick}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 shadow-xs transition transform active:scale-95 cursor-pointer shrink-0"
                title="Watch 5-second Video Ad to earn +2 Free Prompt Credits"
              >
                <Video className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span className="font-black tracking-tight">+2</span>
                <span className="hidden sm:inline text-[10px] text-amber-700 font-semibold">Coins</span>
              </button>
            )}

            {/* 5. Send Button */}
            <button
              type="button"
              id="chat-input-send-btn"
              disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
              onClick={handleSend}
              className={`py-1.5 sm:py-2 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition transform active:scale-95 shrink-0 cursor-pointer ${
                (!inputText.trim() && attachments.length === 0) || isLoading
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-purple-500/20'
              }`}
            >
              <span>{isLoading ? 'Generating...' : 'Send'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultimodalInputBar;
