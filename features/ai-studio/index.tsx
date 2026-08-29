import React, { useState, useEffect, useCallback, useMemo } from 'react';
import GeminiChatView from '../../components/GeminiChatView';
import StudioSettingsDrawer from '../../components/StudioSettingsDrawer';
import ApiKeysModal from '../../components/ApiKeysModal';
import RewardedAdModal from '../../components/RewardedAdModal';
import { ChatMessage, ChatAttachment, StudioSettings } from '../../types/chat';
import {
  getCurrentSession,
  saveSession,
  createNewSession,
  getStudioSettings,
  saveStudioSettings,
  deleteChatMessage,
  clearAllChatHistory,
} from '../../utils/chatStore';
import {
  getDailyCredits,
  consumeCredit,
  addRewardCredits,
  DailyCreditsData,
} from '../../utils/creditManager';
import {
  sendMultimodalMessage,
  enhancePromptWithAI,
  upscaleImageWithAI,
} from '../../services/geminiService';
import { addNotification } from '../../utils/notificationStore';
import { useAuth } from '../../context/AuthContext';

export interface AIStudioProps {
  onShareToSocialFeed?: (payload: { prompt: string; imageSrc: string; stylePreset?: string }) => void;
  externalPreset?: string;
  onNavigateToSocial?: (tab: string) => void;
}

export const AIStudioModule: React.FC<AIStudioProps> = ({
  onShareToSocialFeed,
}) => {
  const { userProfile } = useAuth();

  // Chat History & Inference State (Isolated from Social Feed)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<StudioSettings>(() => getStudioSettings());
  const [creditsData, setCreditsData] = useState<DailyCreditsData>(() => getDailyCredits());

  // Local AI Studio Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);
  const [isRewardedAdOpen, setIsRewardedAdOpen] = useState(false);

  // Helper to ensure 100% deduplicated message list by unique ID
  const deduplicateMessages = useCallback((msgs: ChatMessage[]): ChatMessage[] => {
    const map = new Map<string, ChatMessage>();
    for (const m of msgs) {
      if (m && m.id) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values());
  }, []);

  // Initialize Chat Session
  useEffect(() => {
    const session = getCurrentSession();
    if (session && session.messages) {
      setMessages(deduplicateMessages(session.messages));
    }
  }, [deduplicateMessages]);

  const handleUpdateSettings = useCallback((newSettings: Partial<StudioSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveStudioSettings(updated);
      return updated;
    });
  }, []);

  const handleSendMessage = useCallback(async (text: string, attachments: ChatAttachment[]) => {
    // Prevent duplicate submissions if actively generating
    if (isLoading) return;

    // Check credits
    if (creditsData.remainingCredits <= 0) {
      setIsRewardedAdOpen(true);
      return;
    }

    // Deduct 1 credit
    const updatedCredits = consumeCredit();
    setCreditsData(updatedCredits);

    const userMsgId = `msg_user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      attachments,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Append user message once to state and local storage
    let currentHistory: ChatMessage[] = [];
    setMessages((prevMessages) => {
      const newMessages = deduplicateMessages([...prevMessages, userMsg]);
      currentHistory = newMessages;
      const currentSession = getCurrentSession();
      if (currentSession) {
        currentSession.messages = newMessages;
        currentSession.updatedAt = new Date().toISOString();
        saveSession(currentSession);
      }
      return newMessages;
    });

    setIsLoading(true);

    try {
      const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = currentHistory
        .slice(-6)
        .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const result = await sendMultimodalMessage(text, attachments, settings, chatHistory);

      const assistantMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        role: 'assistant',
        content: result.text || 'Transformation complete.',
        systemNotice: result.systemNotice,
        modelUsed: result.modelUsed,
        isFallback: result.isFallback,
        latencyMs: result.latencyMs,
        tokensUsed: result.tokensUsed,
        generatedImageB64: result.generatedImageB64,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((current) => {
        const finalMessages = deduplicateMessages([...current, assistantMsg]);
        const currentSession = getCurrentSession();
        if (currentSession) {
          currentSession.messages = finalMessages;
          currentSession.updatedAt = new Date().toISOString();
          saveSession(currentSession);
        }
        return finalMessages;
      });

      if (result.generatedImageB64) {
        addNotification({
          type: 'generation_done',
          title: 'Scene Transformation Ready',
          message: 'Your multimodal AI render has completed successfully.',
          linkTab: 'chat',
        });
      }
    } catch (err: any) {
      console.error('Chat error:', err);

      if (err?.message?.includes('OpenAI') || err?.message?.includes('credits') || err?.message?.includes('Grok')) {
        handleUpdateSettings({ engine: 'gemini', model: 'gemini-3.7-flash' });
      }

      const refunded = addRewardCredits(1);
      setCreditsData(refunded);

      const isUnavailable =
        err?.message?.includes('503') ||
        err?.message?.includes('heavy load') ||
        err?.message?.includes('timed out') ||
        err?.message?.includes('busy');

      const friendlyErrorNotice = isUnavailable
        ? `⚠️ **Gemini Service Notice**\n\nThe AI service is currently experiencing high load. Metfa Social attempted automatic fallbacks, but the request timed out.\n\n✨ **Your prompt credit was refunded.** Click **Try Again** below.`
        : `⚠️ **Error generating response**\n\n${err.message || 'Please check your connection and try again.'}\n\n✨ **Your prompt credit was refunded.**`;

      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        role: 'assistant',
        content: friendlyErrorNotice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        canRetry: true,
        retryPayload: {
          text,
          attachments,
        },
      };

      setMessages((current) => {
        const finalMessagesWithErr = deduplicateMessages([...current, errorMsg]);
        const currentSession = getCurrentSession();
        if (currentSession) {
          currentSession.messages = finalMessagesWithErr;
          currentSession.updatedAt = new Date().toISOString();
          saveSession(currentSession);
        }
        return finalMessagesWithErr;
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, creditsData.remainingCredits, settings, handleUpdateSettings, deduplicateMessages]);

  // Listen to credits updates and cross-module remix events
  useEffect(() => {
    const handleCreditsUpdate = (e: any) => {
      if (e.detail) {
        setCreditsData(e.detail);
      }
    };

    const handleRemixEvent = (e: any) => {
      if (e.detail?.prompt) {
        if (e.detail.stylePreset) {
          handleUpdateSettings({ stylePreset: e.detail.stylePreset });
        }
        handleSendMessage(`[Remix Recipe]: ${e.detail.prompt}`, []);
      }
    };

    const handleSwitchEngineEvent = (e: any) => {
      if (e.detail?.engine) {
        const eng = e.detail.engine;
        const model = eng === 'gemini' ? 'gemini-3.7-flash' : eng === 'openai' ? 'gpt-4o' : 'grok-2';
        handleUpdateSettings({ engine: eng, model });
      }
    };

    const handleOpenSettingsEvent = () => {
      setIsSettingsOpen(true);
    };

    const handleOpenKeysEvent = () => {
      setIsApiKeysOpen(true);
    };

    const handleNewChatEvent = () => {
      const newSess = createNewSession();
      setMessages(newSess.messages);
    };

    const handleClearHistoryEvent = () => {
      const updated = clearAllChatHistory();
      setMessages(updated);
    };

    window.addEventListener('metfa_credits_updated', handleCreditsUpdate);
    window.addEventListener('metfa_remix_prompt', handleRemixEvent);
    window.addEventListener('metfa_ai_switch_engine', handleSwitchEngineEvent);
    window.addEventListener('metfa_ai_open_settings', handleOpenSettingsEvent);
    window.addEventListener('metfa_ai_open_keys', handleOpenKeysEvent);
    window.addEventListener('metfa_ai_new_chat', handleNewChatEvent);
    window.addEventListener('metfa_ai_clear_history', handleClearHistoryEvent);

    return () => {
      window.removeEventListener('metfa_credits_updated', handleCreditsUpdate);
      window.removeEventListener('metfa_remix_prompt', handleRemixEvent);
      window.removeEventListener('metfa_ai_switch_engine', handleSwitchEngineEvent);
      window.removeEventListener('metfa_ai_open_settings', handleOpenSettingsEvent);
      window.removeEventListener('metfa_ai_open_keys', handleOpenKeysEvent);
      window.removeEventListener('metfa_ai_new_chat', handleNewChatEvent);
      window.removeEventListener('metfa_ai_clear_history', handleClearHistoryEvent);
    };
  }, [handleSendMessage, handleUpdateSettings]);

  const handleRetryMessage = (payload?: { text: string; attachments: ChatAttachment[] }) => {
    if (!payload) return;
    handleSendMessage(payload.text, payload.attachments || []);
  };

  const handleClearChat = () => {
    const newSess = createNewSession();
    setMessages(newSess.messages);
  };

  const handleDeleteMessage = (messageId: string) => {
    const updated = deleteChatMessage(messageId);
    setMessages(updated);
  };

  const handleClearAllHistory = () => {
    const updated = clearAllChatHistory();
    setMessages(updated);
  };

  const handleUpscaleImage = async (base64Image: string): Promise<string> => {
    const enhanced = await upscaleImageWithAI(base64Image);
    addNotification({
      type: 'generation_done',
      title: '4K Ultra HD Upscale Ready',
      message: 'Your creation has been upscaled to crystal-clear 4K resolution.',
      linkTab: 'chat',
    });
    return enhanced;
  };

  const handleRewardClaimed = (amount: number) => {
    const updated = addRewardCredits(amount);
    setCreditsData(updated);
  };

  return (
    <div className="w-full h-full flex flex-col flex-1 min-h-0 relative overflow-hidden">
      {/* Primary Multimodal Viewport */}
      <GeminiChatView
        messages={messages}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onShareToFeed={(postData) => {
          if (onShareToSocialFeed) {
            onShareToSocialFeed(postData);
          }
        }}
        onUpscaleImage={handleUpscaleImage}
        onClearChat={handleClearChat}
        onDeleteMessage={handleDeleteMessage}
        onClearAllHistory={handleClearAllHistory}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenApiKeys={() => setIsApiKeysOpen(true)}
        onEnhancePrompt={(p) => enhancePromptWithAI(p)}
        creditsCount={creditsData.remainingCredits}
        creditsData={creditsData}
        onWatchAdClick={() => setIsRewardedAdOpen(true)}
        onRetryMessage={handleRetryMessage}
      />

      {/* AI Studio Model & Flavor Settings Drawer */}
      <StudioSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        creditsData={creditsData}
        onWatchAdClick={() => {
          setIsSettingsOpen(false);
          setIsRewardedAdOpen(true);
        }}
      />

      {/* BYO Keys Configuration */}
      <ApiKeysModal
        isOpen={isApiKeysOpen}
        onClose={() => setIsApiKeysOpen(false)}
        onKeysUpdated={(updatedKeys) => {
          if (updatedKeys.geminiApiKey || updatedKeys.openaiApiKey || updatedKeys.grokApiKey) {
            handleUpdateSettings({
              geminiApiKey: updatedKeys.geminiApiKey,
              openaiApiKey: updatedKeys.openaiApiKey,
              grokApiKey: updatedKeys.grokApiKey,
            });
          }
        }}
      />

      {/* Prompt Credits Refill Modal */}
      <RewardedAdModal
        isOpen={isRewardedAdOpen}
        onClose={() => setIsRewardedAdOpen(false)}
        onRewardClaimed={handleRewardClaimed}
      />
    </div>
  );
};

export const AIToolsView = AIStudioModule;
export default AIStudioModule;
