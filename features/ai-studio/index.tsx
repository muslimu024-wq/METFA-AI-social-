import React, { useState, useEffect, useCallback, useMemo } from 'react';
import GeminiChatView from '../../components/GeminiChatView';
import StudioSettingsDrawer from '../../components/StudioSettingsDrawer';
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

  // 1. Initial Load of Chat History & Settings
  useEffect(() => {
    const session = getCurrentSession();
    if (session && session.messages) {
      setMessages(deduplicateMessages(session.messages));
    }
    setSettings(getStudioSettings());
    setCreditsData(getDailyCredits());
  }, [deduplicateMessages]);

  // 2. Global Event Listeners for Multi-AI synchronization
  useEffect(() => {
    const handleNewChat = () => {
      const newSession = createNewSession();
      setMessages([]);
      saveSession(newSession);
    };

    const handleClearHistory = () => {
      clearAllChatHistory();
      setMessages([]);
    };

    const handleSwitchEngine = (e: any) => {
      if (e.detail?.engine) {
        const engine = e.detail.engine;
        const model = engine === 'gemini' ? 'gemini-3.7-flash' : engine === 'openai' ? 'gpt-4o' : 'grok-2';
        setSettings((prev) => {
          const updated = { ...prev, engine, model };
          saveStudioSettings(updated);
          return updated;
        });
      }
    };

    const handleOpenSettingsModal = () => setIsSettingsOpen(true);

    window.addEventListener('metfa_ai_new_chat', handleNewChat);
    window.addEventListener('metfa_ai_clear_history', handleClearHistory);
    window.addEventListener('metfa_ai_switch_engine', handleSwitchEngine);
    window.addEventListener('metfa_ai_open_settings', handleOpenSettingsModal);

    return () => {
      window.removeEventListener('metfa_ai_new_chat', handleNewChat);
      window.removeEventListener('metfa_ai_clear_history', handleClearHistory);
      window.removeEventListener('metfa_ai_switch_engine', handleSwitchEngine);
      window.removeEventListener('metfa_ai_open_settings', handleOpenSettingsModal);
    };
  }, []);

  // Sync settings when updated
  const handleUpdateSettings = useCallback((newSettings: Partial<StudioSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveStudioSettings(updated);
      return updated;
    });
  }, []);

  // Send Message with Multi-AI Routing & Multimodal Support
  const handleSendMessage = async (text: string, attachments: ChatAttachment[]) => {
    if (!text.trim() && attachments.length === 0) return;

    // Check Credits
    if (creditsData.remainingCredits <= 0) {
      setIsRewardedAdOpen(true);
      return;
    }

    // 1. Consume 1 Credit
    const updatedCredits = consumeCredit();
    setCreditsData(updatedCredits);

    const userMessageId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    // Append user message immediately
    const updatedMessages = deduplicateMessages([...messages, userMessage]);
    setMessages(updatedMessages);
    setIsLoading(true);

    // Save to persistence
    const currentSession = getCurrentSession();
    if (currentSession) {
      currentSession.messages = updatedMessages;
      saveSession(currentSession);
    }

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // 2. Call AI Service (routes to Gemini/OpenAI/Grok)
      const aiResponse = await sendMultimodalMessage(
        text,
        attachments,
        settings,
        history
      );

      const assistantMessageId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: aiResponse.text,
        timestamp: new Date().toISOString(),
        generatedImageB64: aiResponse.generatedImageB64,
        isImageGeneration: Boolean(aiResponse.generatedImageB64 || aiResponse.isImageGeneration),
        modelUsed: aiResponse.modelUsed || settings.model || 'gemini-3.7-flash',
        isFallback: aiResponse.isFallback,
        latencyMs: aiResponse.latencyMs,
        tokensUsed: aiResponse.tokensUsed,
        systemNotice: aiResponse.systemNotice,
      };

      const finalMessages = deduplicateMessages([...updatedMessages, assistantMessage]);
      setMessages(finalMessages);

      if (currentSession) {
        currentSession.messages = finalMessages;
        saveSession(currentSession);
      }

      // If image was generated, trigger helpful notification
      if (aiResponse.generatedImageB64) {
        addNotification({
          type: 'system',
          title: 'Metfa AI Studio Creation',
          message: 'Generated your visual creation in high definition!',
          actor: {
            name: 'Metfa AI Studio',
            username: 'studio.ai',
            avatar: '/logo.png',
          },
          linkTab: 'chat',
        });
      }
    } catch (err: any) {
      console.error('Inference execution error:', err);
      const errorMessageId = `err_${Date.now()}`;
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        role: 'assistant',
        content: `**AI Service Notice:** ${err?.message || 'Unable to connect to AI server. Please try again.'}`,
        timestamp: new Date().toISOString(),
        isError: true,
        canRetry: true,
        retryPayload: { text, attachments },
      };

      const finalMessages = deduplicateMessages([...updatedMessages, errorMessage]);
      setMessages(finalMessages);
      if (currentSession) {
        currentSession.messages = finalMessages;
        saveSession(currentSession);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryMessage = useCallback((payload?: { text: string; attachments: ChatAttachment[] }) => {
    if (payload && (payload.text || (payload.attachments && payload.attachments.length > 0))) {
      handleSendMessage(payload.text, payload.attachments || []);
    }
  }, [handleSendMessage]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    const session = createNewSession();
    saveSession(session);
  }, []);

  const handleDeleteMessage = useCallback((messageId: string) => {
    deleteChatMessage(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const handleClearAllHistory = useCallback(() => {
    clearAllChatHistory();
    setMessages([]);
  }, []);

  const handleRewardClaimed = useCallback((amount: number) => {
    const updated = addRewardCredits(amount);
    setCreditsData(updated);
    setIsRewardedAdOpen(false);
  }, []);

  const handleShareToFeed = useCallback(
    (postData: { prompt: string; imageSrc: string; stylePreset?: string }) => {
      if (onShareToSocialFeed) {
        onShareToSocialFeed(postData);
      }
    },
    [onShareToSocialFeed]
  );

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-[#04060C]">
      <GeminiChatView
        messages={messages}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onShareToFeed={handleShareToFeed}
        onUpscaleImage={(img) => upscaleImageWithAI(img)}
        onClearChat={handleClearChat}
        onDeleteMessage={handleDeleteMessage}
        onClearAllHistory={handleClearAllHistory}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
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

      {/* Credits Refill Modal */}
      <RewardedAdModal
        isOpen={isRewardedAdOpen}
        onClose={() => setIsRewardedAdOpen(false)}
        onRewardClaimed={handleRewardClaimed}
      />
    </div>
  );
};

export default AIStudioModule;
