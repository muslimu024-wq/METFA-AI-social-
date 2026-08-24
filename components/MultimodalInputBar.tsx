import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  MicOff,
  Sparkles,
  X,
  FileText,
  Video,
  Camera,
  Layers,
  Wand2,
  AlertCircle
} from 'lucide-react';
import { ChatAttachment, StudioSettings } from '../types/chat';
import { fileToAttachment } from '../utils/fileUtils';
import AccessRequestModal from './AccessRequestModal';

interface MultimodalInputBarProps {
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  isLoading: boolean;
  settings?: Partial<StudioSettings>;
  onUpdateSettings?: (settings: Partial<StudioSettings>) => void;
  onOpenSettings?: () => void;
  onEnhancePrompt?: (prompt: string) => Promise<string>;
  creditsCount: number;
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
  onOpenSettings,
  onEnhancePrompt,
  creditsCount,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea smoothly with comfortable minimum height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(64, Math.min(scrollHeight, 240))}px`;
    }
  }, [inputText]);

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

  const handleSend = () => {
    if ((!inputText.trim() && attachments.length === 0) || isLoading) return;
    onSendMessage(inputText.trim(), attachments);
    setInputText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = '64px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access was denied.');
          setShowPermissionModal(true);
        } else {
          setSpeechError(`Voice input error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Could not start speech recognition:', err);
      setShowPermissionModal(true);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,text/*,application/json,.ts,.tsx,.py"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Style Presets Bar (collapsible / toggleable) */}
      {showPresets && (
        <div className="w-full max-w-4xl px-3 mb-2 flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Preset:
          </span>
          {STYLE_PRESETS.map((preset) => {
            const isSelected = settings?.stylePreset === preset || (!settings?.stylePreset && preset === 'None');
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onUpdateSettings?.({ stylePreset: preset === 'None' ? '' : preset });
                }}
                className={`text-xs px-3 py-1 rounded-xl whitespace-nowrap font-medium transition border ${
                  isSelected
                    ? 'bg-purple-600/90 text-white border-purple-400 shadow-sm shadow-purple-600/30'
                    : 'bg-gray-900/80 text-gray-300 border-gray-800 hover:border-gray-700 hover:text-white'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Expanded Input Card */}
      <div className="w-full max-w-4xl bg-gray-900/95 border border-purple-500/20 hover:border-purple-500/40 focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 rounded-3xl p-3 shadow-xl backdrop-blur-xl transition-all">
        {/* Attachments Preview Carousel */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-2 border-b border-gray-800/80">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative group shrink-0 rounded-xl overflow-hidden bg-gray-950 border border-gray-800 h-16 w-20 flex items-center justify-center"
              >
                {att.type === 'image' && att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
                ) : att.type === 'video' ? (
                  <div className="flex flex-col items-center justify-center p-1 text-center">
                    <Video className="w-5 h-5 text-indigo-400" />
                    <span className="text-[9px] text-gray-400 truncate max-w-[64px]">{att.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-1 text-center">
                    <FileText className="w-5 h-5 text-teal-400" />
                    <span className="text-[9px] text-gray-400 truncate max-w-[64px]">{att.name}</span>
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

        {/* Spacious Multiline Textarea */}
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Metfa AI, upload screenshots for diagnostics, or enter a scene prompt..."
          rows={2}
          className="w-full bg-transparent text-gray-100 placeholder-gray-500 text-sm md:text-base resize-none focus:outline-none px-2 py-1.5 min-h-[64px] leading-relaxed"
        />

        {/* Speech Error Banner */}
        {speechError && (
          <div className="flex items-center gap-1.5 px-2 py-1 mb-2 text-xs text-amber-400 bg-amber-950/40 rounded-lg border border-amber-800/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{speechError}</span>
          </div>
        )}

        {/* Toolbar Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 mt-1">
          {/* Left Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/80 transition flex items-center gap-1 text-xs"
              title="Attach photos, videos, or logs"
            >
              <Paperclip className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Attach</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowPermissionModal(true);
              }}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/80 transition flex items-center gap-1 text-xs"
              title="Open camera capture"
            >
              <Camera className="w-4 h-4 text-teal-400" />
              <span className="hidden md:inline">Camera</span>
            </button>

            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-2 rounded-xl transition flex items-center gap-1 text-xs ${
                isRecording
                  ? 'bg-red-600/90 text-white animate-pulse'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/80'
              }`}
              title={isRecording ? 'Stop Recording' : 'Voice Input'}
            >
              {isRecording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-indigo-400" />}
              <span className="hidden sm:inline">{isRecording ? 'Listening...' : 'Voice'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className={`p-2 rounded-xl transition flex items-center gap-1 text-xs ${
                showPresets
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-700/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/80'
              }`}
              title="Choose style presets"
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">Styles</span>
            </button>

            {inputText.trim().length > 5 && onEnhancePrompt && (
              <button
                type="button"
                disabled={isEnhancing}
                onClick={handleEnhanceClick}
                className="p-2 text-xs font-semibold text-purple-300 hover:text-purple-200 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-700/40 rounded-xl transition flex items-center gap-1"
                title="Enhance prompt with AI"
              >
                <Wand2 className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : ''}`} />
                <span>{isEnhancing ? 'Enhancing...' : 'Enhance'}</span>
              </button>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
              onClick={handleSend}
              className={`py-2 px-4 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition transform active:scale-95 ${
                (!inputText.trim() && attachments.length === 0) || isLoading
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white shadow-purple-600/30'
              }`}
            >
              <span>{isLoading ? 'Generating...' : 'Send'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Permission modal with fallback */}
      <AccessRequestModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onPermissionGranted={() => {
          toggleSpeechRecognition();
        }}
        onFallbackToFileUpload={() => {
          fileInputRef.current?.click();
        }}
        title="Microphone & Media Access"
        description="Allow Metfa AI to access your microphone for voice commands and camera for capturing reference photos."
      />
    </div>
  );
};

export default MultimodalInputBar;
