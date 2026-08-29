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
  Clock,
  Download,
  CheckCircle2,
  Flame,
  Key,
  Film,
  Crop,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { ChatMessage, ChatAttachment, StudioSettings } from '../types/chat';
import { DailyCreditsData } from '../utils/creditManager';
import MarkdownMessage from './MarkdownMessage';
import MultimodalInputBar from './MultimodalInputBar';
import { executeNativeShare, SharePayload } from '../utils/shareUtils';
import SocialShareModal from './SocialShareModal';
import ExportPresetModal from './ExportPresetModal';
import CreditsBadge from './CreditsBadge';
import ConfirmActionModal from './ConfirmActionModal';

interface GeminiChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  onShareToFeed: (postData: { prompt: string; imageSrc: string; stylePreset?: string }) => void;
  onUpscaleImage: (base64Image: string) => Promise<string>;
  onClearChat: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onClearAllHistory?: () => void;
  settings?: Partial<StudioSettings>;
  onUpdateSettings?: (settings: Partial<StudioSettings>) => void;
  onOpenSettings?: () => void;
  onOpenApiKeys?: () => void;
  onEnhancePrompt?: (prompt: string) => Promise<string>;
  creditsCount: number;
  creditsData?: DailyCreditsData;
  onWatchAdClick?: () => void;
  onRetryMessage?: (payload?: { text: string; attachments: ChatAttachment[] }) => void;
}

export const GeminiChatView: React.FC<GeminiChatViewProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onShareToFeed,
  onUpscaleImage,
  onClearChat,
  onDeleteMessage,
  onClearAllHistory,
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenApiKeys,
  onEnhancePrompt,
  creditsCount,
  creditsData,
  onWatchAdClick,
  onRetryMessage,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [upscalingId, setUpscalingId] = React.useState<string | null>(null);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [downloadedId, setDownloadedId] = React.useState<string | null>(null);

  // Social Share Sheet state
  const [activeSharePayload, setActiveSharePayload] = React.useState<SharePayload | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [exportPresetData, setExportPresetData] = React.useState<{ imageSrc: string; prompt: string } | null>(null);

  // Confirmation Dialog & Notification State
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Listen to clear history events from Header
  useEffect(() => {
    const handleClearHistoryEvent = () => {
      handleClearHistoryConfirm();
    };
    window.addEventListener('metfa_ai_clear_history', handleClearHistoryEvent);
    return () => window.removeEventListener('metfa_ai_clear_history', handleClearHistoryEvent);
  }, []);

  const handleDeleteMessage = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete AI Prompt / Message',
      message: 'Are you sure you want to remove this message from your prompt history? This cannot be undone.',
      onConfirm: () => {
        if (onDeleteMessage) {
          onDeleteMessage(id);
        }
        showToast('Message deleted from history');
      },
    });
  };

  const handleClearHistoryConfirm = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear AI Prompt History',
      message: 'Are you sure you want to delete all AI prompt history for this session? This action cannot be undone.',
      onConfirm: () => {
        if (onClearAllHistory) {
          onClearAllHistory();
        } else {
          onClearChat();
        }
        showToast('All prompt history cleared');
      },
    });
  };

  const activeEngine = settings?.engine || 'gemini';

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

  const handleShareContent = async (payload: SharePayload) => {
    await executeNativeShare(payload, {
      onFallback: () => {
        setActiveSharePayload(payload);
        setIsShareModalOpen(true);
      },
    });
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

  const handleDownloadOriginal = (msg: ChatMessage) => {
    if (!msg.generatedImageB64) return;
    try {
      setDownloadedId(msg.id);
      const link = document.createElement('a');
      const href = msg.generatedImageB64.startsWith('data:')
        ? msg.generatedImageB64
        : `data:image/png;base64,${msg.generatedImageB64}`;
      link.href = href;
      link.download = `metfa-ai-artwork-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => setDownloadedId(null), 2500);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleRetry = (msg: ChatMessage) => {
    if (!onRetryMessage || !msg.retryPayload) return;
    setRetryingId(msg.id);
    onRetryMessage(msg.retryPayload);
    setTimeout(() => setRetryingId(null), 2000);
  };

  const handleSwitchEngine = (engine: 'gemini' | 'openai' | 'grok') => {
    if (!onUpdateSettings) return;
    if (engine === 'gemini') {
      onUpdateSettings({ engine: 'gemini', model: 'gemini-3.7-flash' });
    } else if (engine === 'openai') {
      onUpdateSettings({ engine: 'openai', model: 'gpt-4o' });
    } else if (engine === 'grok') {
      onUpdateSettings({ engine: 'grok', model: 'grok-2' });
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 relative overflow-hidden bg-[#FAFAFB] text-gray-900">
      {/* Messages Scroll Area - Clean, Full Width & Spacious Readability (Book Reading Theme) */}
      <div className="flex-1 overflow-y-auto px-1.5 sm:px-3 md:px-4 py-2.5 sm:py-4 space-y-3 sm:space-y-4 scrollbar-thin">
        <div className="w-[98%] sm:w-[96%] max-w-6xl xl:max-w-7xl mx-auto space-y-3 sm:space-y-4">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isError = !!msg.isError;
            const uniqueMsgKey = msg.id || `msg_${index}`;

            return (
              <div
                key={uniqueMsgKey}
                className={`flex gap-2 sm:gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} w-full animate-fadeIn`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm mt-0.5 ${
                      isError
                        ? 'bg-amber-100 border border-amber-300 text-amber-800'
                        : 'bg-gradient-to-tr from-purple-600 to-teal-500 text-white shadow-purple-500/20'
                    }`}
                  >
                    {isError ? <AlertTriangle className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}

                {/* Message Bubble Container - Wide & Readable */}
                <div
                  className={`rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 shadow-sm transition-all ${
                    isUser
                      ? 'max-w-[94%] sm:max-w-[88%] md:max-w-[80%] bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-br-sm ml-auto shadow-purple-600/10'
                      : isError
                      ? 'w-full max-w-full flex-1 min-w-0 bg-amber-50 border border-amber-200 text-gray-900 rounded-bl-sm'
                      : 'w-full max-w-full flex-1 min-w-0 bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-xs'
                  }`}
                >
                  {/* Attachments Preview if any */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {msg.attachments.map((att, attIndex) => (
                        <div
                          key={att.id ? `${att.id}_${attIndex}` : `att_${attIndex}`}
                          className="relative rounded-xl overflow-hidden border border-gray-200 max-w-[200px] shadow-xs"
                        >
                          {att.type === 'image' ? (
                            <img
                              src={att.previewUrl}
                              alt={att.name}
                              className="w-full h-32 object-cover"
                            />
                          ) : (
                            <div className="p-3 bg-gray-50 text-xs flex items-center gap-2 text-gray-700">
                              <span>📎</span>
                              <span className="truncate">{att.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Generated Image with High Quality Actions */}
                  {msg.generatedImageB64 && (
                    <div className="mb-4 rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white group">
                      <div className="relative">
                        <img
                          src={`data:image/png;base64,${msg.generatedImageB64}`}
                          alt="AI Output"
                          className="w-full h-auto max-h-[480px] object-cover"
                        />
                      </div>

                      {/* Image Action Bar */}
                      <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span className="font-semibold text-gray-800">Generated Artwork</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Download Original Button */}
                          <button
                            type="button"
                            onClick={() => handleDownloadOriginal(msg)}
                            className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                            title="Download original high-quality image"
                          >
                            {downloadedId === msg.id ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                                <span className="text-teal-700">Saved!</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5 text-teal-600" />
                                <span>Download Original</span>
                              </>
                            )}
                          </button>

                          {/* Upscale 4K Button */}
                          <button
                            type="button"
                            onClick={() => handleUpscale(msg)}
                            disabled={upscalingId === msg.id}
                            className="px-3 py-1.5 text-xs font-bold bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                            title="AI 4K Super-Resolution Upscale"
                          >
                            <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
                            <span>{upscalingId === msg.id ? 'Upscaling 4K...' : 'Upscale 4K'}</span>
                          </button>

                          {/* Social Share Sheet (Native / WhatsApp, Facebook, etc.) */}
                          <button
                            type="button"
                            id={`share-art-social-${msg.id}`}
                            onClick={() =>
                              handleShareContent({
                                id: msg.id,
                                type: 'artwork',
                                title: 'AI Artwork created with Metfa Studio',
                                text: msg.content ? `Check out this AI visual creation: ${msg.content.slice(0, 120)}...` : 'AI Visual Artwork rendered on Metfa Social',
                                url: window.location.href,
                                imageSrc: `data:image/png;base64,${msg.generatedImageB64}`,
                              })
                            }
                            className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                            title="Share directly to WhatsApp, Facebook, Telegram, etc."
                          >
                            <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Share</span>
                          </button>

                          {/* Export Preset for Reels / Social stories */}
                          <button
                            type="button"
                            onClick={() => {
                              setExportPresetData({
                                imageSrc: `data:image/png;base64,${msg.generatedImageB64}`,
                                prompt: msg.content || 'AI Visual creation from Metfa Social',
                              });
                            }}
                            className="px-3 py-1.5 text-xs font-bold bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-700 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                            title="Export Preset (9:16 Aspect Ratio & Reels Filter Presets)"
                          >
                            <Film className="w-3.5 h-3.5 text-pink-600" />
                            <span>Export Preset</span>
                          </button>

                          {/* Share to Community Feed Button */}
                          <button
                            type="button"
                            id={`share-art-feed-${msg.id}`}
                            onClick={() => {
                              onShareToFeed({
                                prompt: 'AI scene generated with Metfa Studio',
                                imageSrc: `data:image/png;base64,${msg.generatedImageB64}`,
                              });
                            }}
                            className="px-3 py-1.5 text-xs font-bold bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                            title="Share artwork to Metfa Community Feed"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                            <span>Post to Feed</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Optional Fallback System Notice Badge (Deduplicated & Clean) */}
                  {msg.systemNotice && (
                    <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">{msg.systemNotice}</div>
                    </div>
                  )}

                  {/* Message Content */}
                  <MarkdownMessage content={msg.content} />

                  {/* Dedicated Action Buttons for Error Recovery */}
                  {isError && (
                    <div className="mt-4 pt-3 border-t border-amber-200 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs text-amber-900 font-medium">
                          Quick Recovery Actions:
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {activeEngine !== 'gemini' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleSwitchEngine('gemini');
                                if (msg.retryPayload && onRetryMessage) {
                                  handleRetry(msg);
                                }
                              }}
                              className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-900 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                              <span>Switch to Gemini 3.7 Flash</span>
                            </button>
                          )}

                          {onOpenApiKeys && (
                            <button
                              type="button"
                              onClick={onOpenApiKeys}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95"
                            >
                              <Key className="w-3.5 h-3.5 text-amber-600" />
                              <span>Configure API Keys</span>
                            </button>
                          )}

                          {msg.canRetry && msg.retryPayload && onRetryMessage && (
                            <button
                              type="button"
                              onClick={() => handleRetry(msg)}
                              disabled={retryingId === msg.id}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${retryingId === msg.id ? 'animate-spin' : ''}`} />
                              <span>{retryingId === msg.id ? 'Retrying...' : 'Try Again'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message Footer Info */}
                  <div className="flex items-center justify-between gap-4 mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="opacity-80">{msg.timestamp}</span>

                      {/* Model & Latency badge */}
                      {msg.modelUsed && !isUser && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-[10px] text-gray-700 font-medium">
                          <Zap className="w-2.5 h-2.5 text-teal-600" />
                          <span>{msg.modelUsed}</span>
                          {msg.isFallback && (
                            <span className="text-amber-600 font-bold ml-0.5">(fallback)</span>
                          )}
                          {msg.latencyMs && (
                            <span className="text-gray-500 ml-1">({(msg.latencyMs / 1000).toFixed(1)}s)</span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isUser && !isError && (
                        <>
                          <button
                            type="button"
                            id={`share-msg-${msg.id}`}
                            onClick={() =>
                              handleShareContent({
                                id: msg.id,
                                type: 'general',
                                title: 'Metfa Social Insight',
                                text: msg.content.length > 250 ? `${msg.content.slice(0, 250)}...` : msg.content,
                                url: window.location.href,
                              })
                            }
                            className="hover:text-purple-700 transition flex items-center gap-1 text-gray-500"
                            title="Share answer"
                          >
                            <Share2 className="w-3 h-3 text-gray-500 hover:text-purple-700" />
                            <span>Share</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.content, msg.id)}
                            className="hover:text-purple-700 transition flex items-center gap-1 text-gray-500"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-teal-600" />
                                <span className="text-teal-700 font-semibold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </>
                      )}

                      {/* Delete this prompt / message button */}
                      <button
                        type="button"
                        id={`delete-msg-${msg.id}`}
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="hover:text-rose-600 text-gray-400 hover:bg-rose-50 px-1.5 py-0.5 rounded-lg transition flex items-center gap-1 text-[10px]"
                        title="Delete this prompt/message"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-sm">
                    <User className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-2.5 sm:gap-4 items-start w-full animate-pulse">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-teal-500 flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
              </div>
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-gray-200 shadow-sm rounded-bl-sm flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-purple-700">
                  <Wand2 className="w-4 h-4 animate-spin text-teal-600 shrink-0" />
                  <span>
                    Metfa Social is processing with {activeEngine === 'openai' ? 'ChatGPT' : activeEngine === 'grok' ? 'xAI Grok' : 'Gemini 3.7 Flash'}...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Section (Gemini Minimalist Input without unnecessary footer) */}
      <div className="shrink-0 w-full px-1.5 sm:px-3 md:px-4 pt-1.5 pb-2 sm:pb-3 bg-gradient-to-t from-[#FAFAFB] via-[#FAFAFB]/95 to-transparent">
        <MultimodalInputBar
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onOpenSettings={onOpenSettings}
          onEnhancePrompt={onEnhancePrompt}
          creditsCount={creditsCount}
          onWatchAdClick={onWatchAdClick}
        />
      </div>

      <SocialShareModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setActiveSharePayload(null);
        }}
        payload={activeSharePayload}
      />

      {exportPresetData && (
        <ExportPresetModal
          isOpen={!!exportPresetData}
          onClose={() => setExportPresetData(null)}
          imageSrc={exportPresetData.imageSrc}
          initialPrompt={exportPresetData.prompt}
          onExportToFeed={(data) => {
            onShareToFeed({
              prompt: data.prompt,
              imageSrc: data.imageSrc,
              stylePreset: data.stylePreset,
            });
            setExportPresetData(null);
          }}
        />
      )}

      {/* Confirmation Dialog for AI Prompt / Message Deletion */}
      {confirmModal && (
        <ConfirmActionModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel="Delete"
          isDestructive={true}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default GeminiChatView;
