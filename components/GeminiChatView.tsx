import React, { useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  User,
  Share2,
  Maximize2,
  Copy,
  Check,
  RefreshCw,
  Zap,
  ShieldCheck,
  Wand2,
  Sliders,
  AlertTriangle,
  RotateCcw,
  Clock
} from 'lucide-react';
import { ChatMessage, ChatAttachment, StudioSettings } from '../types/chat';
import MarkdownMessage from './MarkdownMessage';
import MultimodalInputBar from './MultimodalInputBar';

interface GeminiChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  onShareToFeed: (postData: { prompt: string; imageSrc: string; stylePreset?: string }) => void;
  onUpscaleImage: (base64Image: string) => Promise<string>;
  onClearChat: () => void;
  settings?: Partial<StudioSettings>;
  onUpdateSettings?: (settings: Partial<StudioSettings>) => void;
  onOpenSettings?: () => void;
  onEnhancePrompt?: (prompt: string) => Promise<string>;
  creditsCount: number;
  onRetryMessage?: (payload?: { text: string; attachments: ChatAttachment[] }) => void;
}

export const GeminiChatView: React.FC<GeminiChatViewProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onShareToFeed,
  onUpscaleImage,
  onClearChat,
  settings,
  onUpdateSettings,
  onOpenSettings,
  onEnhancePrompt,
  creditsCount,
  onRetryMessage,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [upscalingId, setUpscalingId] = React.useState<string | null>(null);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpscale = async (msg: ChatMessage) => {
    if (!msg.generatedImageB64 || upscalingId) return;
    try {
      setUpscalingId(msg.id);
      await onUpscaleImage(msg.generatedImageB64);
    } catch (err) {
      console.error('Upscale failed:', err);
    } finally {
      setUpscalingId(null);
    }
  };

  const handleRetry = (msg: ChatMessage) => {
    if (!onRetryMessage || !msg.retryPayload) return;
    setRetryingId(msg.id);
    onRetryMessage(msg.retryPayload);
    setTimeout(() => setRetryingId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 relative overflow-hidden bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Top Floating Mini-Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-800/80 bg-gray-950/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-xs font-bold text-gray-200 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            Gemini 2.5 Flash
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-700/50 text-teal-300 font-semibold">
            Fast Response Mode
          </span>
          <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/60 text-purple-300">
            8s Auto-Fallback Protected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-300 px-2 py-1 rounded-lg hover:bg-gray-800/60 transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearChat}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-gray-800/60 transition"
            title="Start new conversation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Session</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area - Flex-1 so it takes all available vertical space */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-5 scrollbar-thin">
        <div className="max-w-4xl mx-auto space-y-5">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isError = !!msg.isError;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                      isError
                        ? 'bg-amber-950 border border-amber-600 text-amber-300'
                        : 'bg-gradient-to-tr from-purple-600 to-teal-500 text-white shadow-purple-500/20'
                    }`}
                  >
                    {isError ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
                  </div>
                )}

                {/* Message Bubble Container */}
                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-3xl p-4 sm:p-5 shadow-lg ${
                    isUser
                      ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white rounded-br-sm'
                      : isError
                      ? 'bg-amber-950/40 border border-amber-800/80 text-amber-100 rounded-bl-sm backdrop-blur-sm'
                      : 'bg-gray-900/90 border border-gray-800/90 text-gray-100 rounded-bl-sm'
                  }`}
                >
                  {/* Attached media preview inside user message */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="rounded-2xl overflow-hidden bg-black/40 border border-white/10 max-h-48 max-w-xs shadow-md"
                        >
                          {att.type === 'image' && att.previewUrl ? (
                            <img src={att.previewUrl} alt={att.name} className="max-h-48 w-auto object-cover rounded-xl" />
                          ) : (
                            <div className="p-2.5 text-xs flex items-center gap-2">
                              <span className="font-semibold text-white truncate">{att.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated Image Result (Inpainting / Scene Transformation) */}
                  {msg.generatedImageB64 && (
                    <div className="my-3 rounded-2xl overflow-hidden border border-purple-500/40 bg-gray-950 shadow-2xl relative group">
                      <img
                        src={`data:image/png;base64,${msg.generatedImageB64}`}
                        alt="Transformed Scene"
                        className="w-full h-auto max-h-[420px] object-cover"
                      />
                      <div className="p-3 bg-gray-950/90 flex items-center justify-between border-t border-gray-800">
                        <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                          AI Generated Scene
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={upscalingId === msg.id}
                            onClick={() => handleUpscale(msg)}
                            className="px-3 py-1.5 text-xs font-bold bg-purple-950 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded-xl flex items-center gap-1.5 transition"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>{upscalingId === msg.id ? 'Upscaling 4K...' : 'Upscale 4K'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onShareToFeed({
                                prompt: 'AI scene generated with Metfa Studio',
                                imageSrc: `data:image/png;base64,${msg.generatedImageB64}`,
                              });
                            }}
                            className="px-3 py-1.5 text-xs font-bold bg-teal-950 hover:bg-teal-900 border border-teal-700/60 text-teal-300 rounded-xl flex items-center gap-1.5 transition"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share to Feed</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  <MarkdownMessage content={msg.content} />

                  {/* Dedicated Action Button for Retry if Error occurred */}
                  {isError && msg.canRetry && msg.retryPayload && onRetryMessage && (
                    <div className="mt-4 pt-3 border-t border-amber-800/40 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs text-amber-300/90 font-medium">
                        Click below to resend your request with high-speed fallback:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRetry(msg)}
                        disabled={retryingId === msg.id}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${retryingId === msg.id ? 'animate-spin' : ''}`} />
                        <span>{retryingId === msg.id ? 'Retrying...' : 'Try Again'}</span>
                      </button>
                    </div>
                  )}

                  {/* Message Footer Info */}
                  <div className="flex items-center justify-between gap-4 mt-3 pt-2 border-t border-white/10 text-[11px] text-gray-400">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="opacity-80">{msg.timestamp}</span>

                      {/* Model & Latency badge */}
                      {msg.modelUsed && !isUser && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800/80 border border-gray-700/60 text-[10px] text-gray-300">
                          <Zap className="w-2.5 h-2.5 text-teal-400" />
                          <span>{msg.modelUsed}</span>
                          {msg.isFallback && (
                            <span className="text-amber-400 font-bold ml-0.5">(fallback)</span>
                          )}
                          {msg.latencyMs && (
                            <span className="text-gray-400 ml-1">({(msg.latencyMs / 1000).toFixed(1)}s)</span>
                          )}
                        </span>
                      )}
                    </div>

                    {!isUser && !isError && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.content, msg.id)}
                          className="hover:text-white transition flex items-center gap-1"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-teal-400" />
                              <span className="text-teal-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-800 to-indigo-900 border border-purple-500/40 flex items-center justify-center shrink-0 shadow-md">
                    <User className="w-5 h-5 text-purple-200" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-start animate-pulse">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-teal-500 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="p-4 rounded-3xl bg-gray-900/90 border border-gray-800 rounded-bl-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                  <Wand2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Metfa AI is processing with Gemini 2.5 Flash (low-latency mode)...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Section & Footer - Expand dynamically downwards without awkward dead space */}
      <div className="shrink-0 w-full px-3 sm:px-6 pt-2 pb-1 bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent">
        <MultimodalInputBar
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onOpenSettings={onOpenSettings}
          onEnhancePrompt={onEnhancePrompt}
          creditsCount={creditsCount}
        />

        {/* Footer text placed cleanly right above bottom navigation bar */}
        <div className="py-1.5 text-center">
          <p className="text-[11px] text-gray-500 font-medium tracking-wide">
            © 2026 Metfa AI • Multimodal Vision & Creative Studio • Powered by Gemini 2.5 Flash
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeminiChatView;
