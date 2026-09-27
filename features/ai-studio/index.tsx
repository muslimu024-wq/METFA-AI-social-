import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Images,
  Undo2,
  RotateCcw,
  Download,
  Check,
  Video,
  Sparkles,
  Maximize2,
  Trash2,
  Layers,
} from 'lucide-react';
import GeminiChatView from '../../components/GeminiChatView';
import StudioSettingsDrawer from '../../components/StudioSettingsDrawer';
import RewardedAdModal from '../../components/RewardedAdModal';
import { RecentImagesDrawer } from './components/RecentImagesDrawer';
import { SideBySideComparisonView } from './components/SideBySideComparisonView';
import {
  addRecentPrompt,
  getRecentPrompts,
  clearAllRecentPrompts,
  togglePinRecentPrompt,
  renameRecentPrompt,
  deleteRecentPrompt,
  RecentPromptItem,
} from './utils/promptHistoryStore';
import { downloadTransformedImageLocally } from './utils/downloadUtils';
import { ChatMessage, ChatAttachment, StudioSettings } from '../../types/chat';
import { GeneratedImageRecord } from './types';
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
import BrandTitle from '../../components/BrandTitle';

export interface AIStudioProps {
  onShareToSocialFeed?: (payload: { prompt: string; imageSrc: string; stylePreset?: string }) => void;
  externalPreset?: string;
  onNavigateToSocial?: (tab: string) => void;
}

export interface TransformationUndoSnapshot {
  id: string;
  timestamp: number;
  previousMessages: ChatMessage[];
  previousRecentImages: GeneratedImageRecord[];
  revertedPrompt: string;
  revertedStylePreset?: string;
  revertedAttachments?: ChatAttachment[];
  revertedImageSrc?: string;
  nextMessages?: ChatMessage[];
  nextRecentImages?: GeneratedImageRecord[];
}

const SESSION_IMAGES_STORAGE_KEY = 'metfa_ai_session_generated_images_v1';

/**
 * Loads the last 10 generated images from local session state (sessionStorage),
 * falling back to reusing existing session messages if available.
 */
const loadSessionImages = (): GeneratedImageRecord[] => {
  try {
    const raw = sessionStorage.getItem(SESSION_IMAGES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 10);
      }
    }
  } catch {}

  // Reuse existing messages history from session if available
  try {
    const session = getCurrentSession();
    if (session && session.messages) {
      const extracted: GeneratedImageRecord[] = [];
      const msgs = session.messages;
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (m.generatedImageB64) {
          let prompt = '';
          let originalImageSrc: string | undefined = undefined;
          if (i > 0 && msgs[i - 1].role === 'user') {
            prompt = msgs[i - 1].content;
            const userAtt = msgs[i - 1].attachments?.find(
              (att) => att.type === 'image' || att.mimeType?.startsWith('image/') || Boolean(att.previewUrl) || Boolean(att.base64)
            );
            if (userAtt) {
              originalImageSrc =
                userAtt.previewUrl ||
                (userAtt.base64
                  ? (userAtt.base64.startsWith('data:')
                      ? userAtt.base64
                      : `data:${userAtt.mimeType || 'image/png'};base64,${userAtt.base64}`)
                  : undefined);
            }
          } else {
            prompt = m.content || 'Generated visual scene';
          }
          extracted.push({
            id: m.id,
            imageSrc: m.generatedImageB64.startsWith('data:')
              ? m.generatedImageB64
              : `data:image/png;base64,${m.generatedImageB64}`,
            prompt,
            timestamp: m.timestamp || new Date().toISOString(),
            modelUsed: m.modelUsed || 'Gemini 3.7 Flash',
            originalMessageId: m.id,
            originalImageSrc,
            transformationType: originalImageSrc ? 'multimodal_upload' : 'text_to_image',
          });
        }
      }
      const recent = extracted.slice(-10).reverse();
      if (recent.length > 0) {
        try {
          sessionStorage.setItem(SESSION_IMAGES_STORAGE_KEY, JSON.stringify(recent));
        } catch {}
      }
      return recent;
    }
  } catch {}
  return [];
};

export const AIStudioModule: React.FC<AIStudioProps> = ({
  onShareToSocialFeed,
}) => {
  const { userProfile, isAuthenticated } = useAuth();

  // Chat History & Inference State (Isolated from Social Feed)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<StudioSettings>(() => getStudioSettings());
  const [creditsData, setCreditsData] = useState<DailyCreditsData>(() => getDailyCredits());

  // Local AI Studio Modals & Drawers
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRewardedAdOpen, setIsRewardedAdOpen] = useState(false);
  const [isRecentImagesOpen, setIsRecentImagesOpen] = useState(false);
  const [selectedComparisonImage, setSelectedComparisonImage] = useState<GeneratedImageRecord | null>(null);

  // Top Bar Drawer Menu, Recent Prompts, and Media Tab State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'prompts' | 'images' | 'videos'>('prompts');
  const [recentPrompts, setRecentPrompts] = useState<RecentPromptItem[]>(() => {
    if (typeof window !== 'undefined') {
      return getRecentPrompts();
    }
    return [];
  });

  // Long-press Context Menu for Prompts
  const [selectedPrompt, setSelectedPrompt] = useState<RecentPromptItem | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef<boolean>(false);

  const handlePromptTouchStart = (item: RecentPromptItem) => {
    isLongPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setSelectedPrompt(item);
    }, 500); // 500ms long press
  };

  const handlePromptTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePinPrompt = (id: string) => {
    const updated = togglePinRecentPrompt(id);
    setRecentPrompts(updated);
    setSelectedPrompt(null);
  };

  const handleDeletePrompt = (id: string) => {
    const updated = deleteRecentPrompt(id);
    setRecentPrompts(updated);
    setSelectedPrompt(null);
  };

  const handleRenamePrompt = (id: string) => {
    const currentText = selectedPrompt?.prompt || '';
    const newTitle = prompt('নতুন নাম লিখুন:', currentText);
    if (newTitle && newTitle.trim()) {
      const updated = renameRecentPrompt(id, newTitle.trim());
      setRecentPrompts(updated);
    }
    setSelectedPrompt(null);
  };

  const handleSharePrompt = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'Metfa AI Prompt', text }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert('প্রম্পটটি কপি করা হয়েছে!');
    }
    setSelectedPrompt(null);
  };

  // Extract actual video attachments from messages (Zero-Dummy enforcement)
  const actualVideos = useMemo(() => {
    const list: { id: string; name: string; url?: string; prompt?: string; timestamp?: string }[] = [];
    for (const msg of messages) {
      if (msg.attachments && Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att.type === 'video') {
            list.push({
              id: att.id || `vid_${list.length}`,
              name: att.name,
              url: att.previewUrl,
              prompt: msg.content,
              timestamp: msg.timestamp,
            });
          }
        }
      }
    }
    return list;
  }, [messages]);

  // Sync recent prompts from store events
  useEffect(() => {
    const handlePromptsUpdate = (e: any) => {
      if (e.detail?.prompts) {
        setRecentPrompts(e.detail.prompts);
      } else {
        setRecentPrompts(getRecentPrompts());
      }
    };
    window.addEventListener('metfa_ai_recent_prompts_updated', handlePromptsUpdate);
    return () => window.removeEventListener('metfa_ai_recent_prompts_updated', handlePromptsUpdate);
  }, []);

  // Local Session State for Last 10 Generated Images (No Supabase Persistence)
  const [recentImages, setRecentImages] = useState<GeneratedImageRecord[]>(() => loadSessionImages());

  // Undo & Redo History Stacks for Reverting Image Transformations
  const [undoStack, setUndoStack] = useState<TransformationUndoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<TransformationUndoSnapshot[]>([]);
  const [undoToast, setUndoToast] = useState<string | null>(null);

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

  const canUndo = useMemo(() => {
    if (isLoading) return false;
    if (undoStack.length > 0) return true;
    return (
      recentImages.length > 0 ||
      messages.some((m) => m.role === 'assistant' && (m.generatedImageB64 || m.isImageGeneration))
    );
  }, [isLoading, undoStack.length, recentImages.length, messages]);

  const canRedo = useMemo(() => {
    return !isLoading && redoStack.length > 0;
  }, [isLoading, redoStack.length]);

  const undoCount = undoStack.length > 0 ? undoStack.length : recentImages.length > 0 ? 1 : 0;

  // Local Download State for Current Transformed Image
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Derive the active transformed image available for instant local download
  const currentTransformedImage = useMemo(() => {
    if (recentImages.length > 0 && recentImages[0].imageSrc) {
      return {
        imageSrc: recentImages[0].imageSrc,
        prompt: recentImages[0].prompt || 'transformed-visual',
      };
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].generatedImageB64) {
        return {
          imageSrc: messages[i].generatedImageB64!,
          prompt: messages[i].content || 'transformed-visual',
        };
      }
    }
    return null;
  }, [recentImages, messages]);

  // Handler to download the current transformed visual directly to local device
  const handleDownloadCurrent = useCallback(async () => {
    if (!currentTransformedImage) return;
    setIsDownloading(true);
    try {
      const res = await downloadTransformedImageLocally(
        currentTransformedImage.imageSrc,
        currentTransformedImage.prompt
      );
      if (res.success) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2500);
      }
    } catch (err) {
      console.error('[AIStudio] Failed to download transformed image:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [currentTransformedImage]);

  // 1. Initial Load of Chat History & Settings
  useEffect(() => {
    const session = getCurrentSession();
    if (session && session.messages) {
      setMessages(deduplicateMessages(session.messages));
      // Ingest existing user prompts from session into recent prompts history
      for (const m of session.messages) {
        if (m.role === 'user' && m.content?.trim()) {
          addRecentPrompt(
            m.content.trim(),
            undefined,
            Boolean(m.attachments && m.attachments.length > 0)
          );
        }
      }
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
        const model = engine === 'gemini' ? 'gemini-3.8-flash' : engine === 'openai' ? 'gpt-4o' : 'grok-2';
        setSettings((prev) => {
          const updated = { ...prev, engine, model };
          saveStudioSettings(updated);
          return updated;
        });
      }
    };

    const handleOpenSettingsModal = () => setIsSettingsOpen(true);
    const handleOpenRecentImages = () => setIsRecentImagesOpen(true);

    window.addEventListener('metfa_ai_new_chat', handleNewChat);
    window.addEventListener('metfa_ai_clear_history', handleClearHistory);
    window.addEventListener('metfa_ai_switch_engine', handleSwitchEngine);
    window.addEventListener('metfa_ai_open_settings', handleOpenSettingsModal);
    window.addEventListener('metfa_ai_open_recent_images', handleOpenRecentImages);

    return () => {
      window.removeEventListener('metfa_ai_new_chat', handleNewChat);
      window.removeEventListener('metfa_ai_clear_history', handleClearHistory);
      window.removeEventListener('metfa_ai_switch_engine', handleSwitchEngine);
      window.removeEventListener('metfa_ai_open_settings', handleOpenSettingsModal);
      window.removeEventListener('metfa_ai_open_recent_images', handleOpenRecentImages);
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

    if (text.trim()) {
      addRecentPrompt(text.trim(), settings.stylePreset, attachments.length > 0);
    }

    const userMessageId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    // Take snapshot of current state right before transformation begins
    const snapshotBeforeTransform: TransformationUndoSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      previousMessages: [...messages],
      previousRecentImages: [...recentImages],
      revertedPrompt: text,
      revertedStylePreset: settings.stylePreset,
      revertedAttachments: attachments.length > 0 ? attachments : undefined,
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
        modelUsed: aiResponse.modelUsed || settings.model || 'gemini-3.8-flash',
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

      // If image was generated, update local session state (strictly max 10 images) & notification
      if (aiResponse.generatedImageB64) {
        // Detect if user had supplied an original image attachment for transformation
        const imageAtt = attachments.find(
          (a) => a.type === 'image' || a.mimeType?.startsWith('image/') || Boolean(a.previewUrl) || Boolean(a.base64)
        );
        let originalImageSrc: string | undefined = undefined;
        if (imageAtt) {
          if (imageAtt.previewUrl) {
            originalImageSrc = imageAtt.previewUrl;
          } else if (imageAtt.base64) {
            originalImageSrc = imageAtt.base64.startsWith('data:')
              ? imageAtt.base64
              : `data:${imageAtt.mimeType || 'image/png'};base64,${imageAtt.base64}`;
          }
        }

        const newRecord: GeneratedImageRecord = {
          id: assistantMessageId,
          imageSrc: aiResponse.generatedImageB64.startsWith('data:')
            ? aiResponse.generatedImageB64
            : `data:image/png;base64,${aiResponse.generatedImageB64}`,
          prompt: text || 'Generated visual scene',
          timestamp: new Date().toISOString(),
          modelUsed: aiResponse.modelUsed || settings.model || 'gemini-3.8-flash',
          stylePreset: settings.stylePreset,
          originalMessageId: assistantMessageId,
          originalImageSrc,
          transformationType: originalImageSrc ? 'retransform' : 'text_to_image',
        };

        setRecentImages((prev) => {
          const updated = [newRecord, ...prev.filter((i) => i.id !== newRecord.id)].slice(0, 10);
          try {
            sessionStorage.setItem(SESSION_IMAGES_STORAGE_KEY, JSON.stringify(updated));
          } catch (storageErr) {
            console.warn('[AIStudio] Session storage quota notice for recent images:', storageErr);
          }

          // Record complete undo snapshot so user can instantly revert this transformation
          const completedSnapshot: TransformationUndoSnapshot = {
            ...snapshotBeforeTransform,
            revertedImageSrc: newRecord.imageSrc,
            nextMessages: finalMessages,
            nextRecentImages: updated,
          };
          setUndoStack((uPrev) => [completedSnapshot, ...uPrev].slice(0, 20));
          setRedoStack([]);

          return updated;
        });

        // If currently in side-by-side comparison with the reference image, seamlessly update to show new transformed result
        setSelectedComparisonImage((curr) => {
          if (curr && originalImageSrc && (curr.imageSrc === originalImageSrc || curr.originalImageSrc === originalImageSrc)) {
            return newRecord;
          }
          return curr;
        });

        addNotification({
          type: 'system',
          title: 'METFA AI Creation',
          message: 'Generated your visual creation in high definition!',
          actor: {
            name: 'METFA AI',
            username: 'studio.ai',
            avatar: '/logo.png',
          },
          linkTab: 'chat',
        });
      }
    } catch (err: any) {
      console.error('Inference execution error:', err);
      let displayMsg = err?.message || 'Unable to connect to AI server. Please try again.';
      if (displayMsg.includes('limit: 0') || displayMsg.includes('free_tier') || displayMsg.includes('quota') && displayMsg.includes('image')) {
        displayMsg = 'Direct AI image generation requires a Gemini API key with billing enabled, as image models have a quota limit of 0 on Google\'s free tier.';
      } else if (displayMsg.includes('503') || displayMsg.includes('high demand') || displayMsg.includes('overloaded')) {
        displayMsg = 'Google Gemini models are currently experiencing temporary high demand. Please click "Try Again" in a few moments.';
      }
      const errorMessageId = `err_${Date.now()}`;
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        role: 'assistant',
        content: `**AI Service Notice:** ${displayMsg}`,
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

  // Upscale image handler - also updates local session state with the upscaled creation
  const handleUpscaleImage = useCallback(
    async (base64Image: string, sourceImage?: GeneratedImageRecord): Promise<string> => {
      const upscaledB64 = await upscaleImageWithAI(base64Image);
      if (upscaledB64) {
        const originalSrc =
          sourceImage?.imageSrc ||
          (base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`);

        const upscaledRecord: GeneratedImageRecord = {
          id: `upscale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          imageSrc: upscaledB64.startsWith('data:') ? upscaledB64 : `data:image/png;base64,${upscaledB64}`,
          prompt: sourceImage?.prompt ? `4K Upscale: ${sourceImage.prompt}` : 'AI 4K Super-Resolution Upscale',
          timestamp: new Date().toISOString(),
          modelUsed: 'AI 4K Super-Resolution',
          isUpscaled: true,
          originalImageSrc: originalSrc,
          transformationType: 'upscale',
        };

        setRecentImages((prev) => {
          const updated = [upscaledRecord, ...prev.filter((i) => i.id !== upscaledRecord.id)].slice(0, 10);
          try {
            sessionStorage.setItem(SESSION_IMAGES_STORAGE_KEY, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setSelectedComparisonImage((curr) => {
          if (curr && (curr.id === sourceImage?.id || curr.imageSrc === originalSrc)) {
            return upscaledRecord;
          }
          return curr;
        });
      }
      return upscaledB64;
    },
    []
  );

  // Re-transformation Handler: takes selected recent image, packages it as multimodal attachment, and triggers inference
  const handleRetransformImage = useCallback(
    async (
      image: GeneratedImageRecord,
      customInstruction: string,
      stylePreset?: string
    ) => {
      setIsRecentImagesOpen(false);

      const rawBase64 = image.imageSrc.replace(/^data:image\/[a-z]+;base64,/, '');
      const referenceAttachment: ChatAttachment = {
        id: `att_retransform_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'image',
        name: 'reference-visual.png',
        size: Math.round((rawBase64.length * 3) / 4),
        mimeType: 'image/png',
        previewUrl: image.imageSrc,
        base64: rawBase64,
      };

      let promptText = customInstruction.trim();
      if (customInstruction.trim()) {
        addRecentPrompt(customInstruction.trim(), stylePreset, true);
      }
      if (stylePreset) {
        promptText = `[Style: ${stylePreset}] ${promptText}`;
      }

      await handleSendMessage(promptText, [referenceAttachment]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleSendMessage]
  );

  const handleUpscaleFromDrawer = useCallback(
    async (image: GeneratedImageRecord) => {
      const rawBase64 = image.imageSrc.replace(/^data:image\/[a-z]+;base64,/, '');
      await handleUpscaleImage(rawBase64, image);
    },
    [handleUpscaleImage]
  );

  const handleSelectImageForComparison = useCallback((image: GeneratedImageRecord) => {
    setSelectedComparisonImage(image);
    setIsRecentImagesOpen(false);
  }, []);

  const handleClearRecentImages = useCallback(() => {
    setRecentImages([]);
    try {
      sessionStorage.removeItem(SESSION_IMAGES_STORAGE_KEY);
    } catch {}
  }, []);

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
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  // Primary Undo Transformation Handler: Reverts last image transformation, restores previous visual & prompt
  const handleUndoTransformation = useCallback(() => {
    if (isLoading) return;

    let messagesToRestore: ChatMessage[] = [];
    let recentImagesToRestore: GeneratedImageRecord[] = [];
    let promptToRestore = '';
    let styleToRestore = settings.stylePreset;
    let attachmentsToRestore: ChatAttachment[] | undefined = undefined;

    if (undoStack.length > 0) {
      const [topSnapshot, ...remainingUndo] = undoStack;
      messagesToRestore = topSnapshot.previousMessages;
      recentImagesToRestore = topSnapshot.previousRecentImages;
      promptToRestore = topSnapshot.revertedPrompt;
      styleToRestore = topSnapshot.revertedStylePreset || settings.stylePreset;
      attachmentsToRestore = topSnapshot.revertedAttachments;

      // Save to redo stack before applying undo
      setRedoStack((prev) => [
        {
          ...topSnapshot,
          nextMessages: [...messages],
          nextRecentImages: [...recentImages],
        },
        ...prev,
      ].slice(0, 20));

      setUndoStack(remainingUndo);
    } else {
      // Robust Fallback: analyze current messages & recent images directly
      let targetAiIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (
          messages[i].role === 'assistant' &&
          (messages[i].generatedImageB64 || messages[i].isImageGeneration)
        ) {
          targetAiIndex = i;
          break;
        }
      }

      if (targetAiIndex !== -1) {
        let userPromptIndex = -1;
        for (let j = targetAiIndex - 1; j >= 0; j--) {
          if (messages[j].role === 'user') {
            userPromptIndex = j;
            promptToRestore = messages[j].content || '';
            attachmentsToRestore = messages[j].attachments;
            break;
          }
        }

        messagesToRestore = messages.filter(
          (_, idx) => idx !== targetAiIndex && idx !== userPromptIndex
        );
        recentImagesToRestore = recentImages.length > 0 ? recentImages.slice(1) : [];

        const styleMatch = promptToRestore.match(/^\[Style:\s*([^\]]+)\]\s*(.*)/s);
        if (styleMatch) {
          styleToRestore = styleMatch[1];
          promptToRestore = styleMatch[2];
        }
      } else if (recentImages.length > 0) {
        const [topImage, ...remainingImages] = recentImages;
        recentImagesToRestore = remainingImages;
        promptToRestore = topImage.prompt;
        styleToRestore = topImage.stylePreset || settings.stylePreset;
        messagesToRestore = [...messages];
      } else {
        return; // Nothing to undo
      }
    }

    // 1. Update message state and persistent session storage
    setMessages(messagesToRestore);
    const currentSession = getCurrentSession();
    if (currentSession) {
      currentSession.messages = messagesToRestore;
      saveSession(currentSession);
    }

    // 2. Update recent generated images state & sessionStorage
    setRecentImages(recentImagesToRestore);
    try {
      sessionStorage.setItem(SESSION_IMAGES_STORAGE_KEY, JSON.stringify(recentImagesToRestore));
    } catch (storageErr) {
      console.warn('[AIStudio] Failed to update session storage for undone images:', storageErr);
    }

    // 3. Update active comparison visual if it was displaying the undone image
    if (selectedComparisonImage) {
      if (recentImagesToRestore.length > 0) {
        setSelectedComparisonImage(recentImagesToRestore[0]);
      } else {
        setSelectedComparisonImage(null);
      }
    }

    // 4. Restore the prompt, style preset, and attachments into MultimodalInputBar
    if (promptToRestore) {
      window.dispatchEvent(
        new CustomEvent('metfa_ai_restore_prompt', {
          detail: {
            prompt: promptToRestore,
            stylePreset: styleToRestore,
            attachments: attachmentsToRestore,
          },
        })
      );
    }

    const cleanPrompt = promptToRestore.replace(/^\[Style:\s*[^\]]+\]\s*/, '').trim();
    const snippet = cleanPrompt.length > 28 ? `${cleanPrompt.slice(0, 28)}...` : cleanPrompt;
    setUndoToast(
      snippet
        ? `Transformation undone! Restored prompt: "${snippet}"`
        : 'Transformation undone! Reverted to previous image state'
    );
    setTimeout(() => setUndoToast(null), 3500);
  }, [
    isLoading,
    undoStack,
    messages,
    recentImages,
    settings.stylePreset,
    selectedComparisonImage,
  ]);

  // Redo Transformation Handler: Re-applies the undone transformation if available
  const handleRedoTransformation = useCallback(() => {
    if (isLoading || redoStack.length === 0) return;
    const [topRedo, ...remainingRedo] = redoStack;

    if (topRedo.nextMessages && topRedo.nextRecentImages) {
      setMessages(topRedo.nextMessages);
      const currentSession = getCurrentSession();
      if (currentSession) {
        currentSession.messages = topRedo.nextMessages;
        saveSession(currentSession);
      }

      setRecentImages(topRedo.nextRecentImages);
      try {
        sessionStorage.setItem(SESSION_IMAGES_STORAGE_KEY, JSON.stringify(topRedo.nextRecentImages));
      } catch {}

      setUndoStack((prev) => [topRedo, ...prev]);
      setRedoStack(remainingRedo);

      setUndoToast('Redone transformation restored');
      setTimeout(() => setUndoToast(null), 3000);
    }
  }, [isLoading, redoStack]);

  // Global Keyboard Shortcut: Ctrl+Z / Cmd+Z for Quick Transformation Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (canRedo && !isLoading) {
            e.preventDefault();
            handleRedoTransformation();
          }
        } else {
          // If not typing in input/textarea, trigger AI Studio Undo
          if (!isTyping && canUndo && !isLoading) {
            e.preventDefault();
            handleUndoTransformation();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, isLoading, handleUndoTransformation, handleRedoTransformation]);

  const handleRewardClaimed = useCallback((amount: number) => {
    const updated = addRewardCredits(amount);
    setCreditsData(updated);
    setIsRewardedAdOpen(false);
  }, []);

  const handleShareToFeed = useCallback(
    (postData: { prompt: string; imageSrc: string; stylePreset?: string }) => {
      if (!isAuthenticated) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('metfa_open_auth_modal'));
        }
        return;
      }
      if (onShareToSocialFeed) {
        onShareToSocialFeed(postData);
      }
    },
    [isAuthenticated, onShareToSocialFeed]
  );

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-[#04060C]">
      {/* Top Left Floating Brand Identity: METFA AI & Top Bar Three-Line Menu Button */}
      <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-20 flex items-center gap-2">
        {/* Top Bar - Three-Line Menu Button (Opens Drawer with Recent Prompts, Images, Videos) */}
        <button
          type="button"
          id="ai-studio-top-drawer-menu-btn"
          onClick={() => {
            setRecentPrompts(getRecentPrompts());
            setIsDrawerOpen(true);
          }}
          className="p-2 text-white bg-slate-900/90 hover:bg-slate-800 border border-purple-500/30 rounded-2xl shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer flex items-center justify-center text-lg leading-none"
          title="Menu (Recent Prompts, Images, Videos)"
          aria-label="Open Menu"
        >
          ☰
        </button>

        <div className="hidden sm:flex items-center px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-purple-500/30 backdrop-blur-md shadow-xl pointer-events-none">
          <BrandTitle service="AI" size="sm" theme="dark" asHeading={true} />
        </div>
      </div>

      <GeminiChatView
        messages={messages}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onShareToFeed={handleShareToFeed}
        onUpscaleImage={handleUpscaleImage}
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
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndoTransformation}
        onRedo={handleRedoTransformation}
        canDownload={Boolean(currentTransformedImage)}
        onDownload={handleDownloadCurrent}
      />

      {/* Slide-over Menu for Last 10 Generated Images */}
      <RecentImagesDrawer
        isOpen={isRecentImagesOpen}
        onClose={() => setIsRecentImagesOpen(false)}
        images={recentImages}
        onSelectForComparison={handleSelectImageForComparison}
        onRetransform={handleRetransformImage}
        onUpscale={handleUpscaleFromDrawer}
        onShareToFeed={handleShareToFeed}
        onClearImages={handleClearRecentImages}
        isTransforming={isLoading}
      />

      {/* Side-by-Side Transformation Comparison View */}
      <SideBySideComparisonView
        isOpen={Boolean(selectedComparisonImage)}
        onClose={() => setSelectedComparisonImage(null)}
        selectedImage={selectedComparisonImage}
        recentImages={recentImages}
        onSelectImage={(img) => setSelectedComparisonImage(img)}
        onRetransform={handleRetransformImage}
        onUpscale={handleUpscaleFromDrawer}
        onShareToFeed={handleShareToFeed}
        isTransforming={isLoading}
        canUndo={canUndo}
        onUndo={handleUndoTransformation}
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

      {/* Visual Undo Toast Feedback */}
      {undoToast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 animate-bounce-short pointer-events-none">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/95 border border-amber-500/50 shadow-2xl rounded-2xl backdrop-blur-md text-amber-200 text-xs font-medium max-w-md">
            <Undo2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{undoToast}</span>
          </div>
        </div>
      )}

      {/* Three-Line Navigation Drawer Menu */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsDrawerOpen(false)} 
          />

          {/* Drawer Content */}
          <div className="relative bg-white w-80 sm:w-96 h-full p-4 z-10 flex flex-col shadow-2xl animate-slideRight">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-base text-gray-700">☰</span>
                <h3 className="font-bold text-gray-800 text-base">Menu</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsDrawerOpen(false)} 
                className="text-gray-500 hover:text-gray-800 text-base p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                aria-label="Close Menu"
              >
                ✕
              </button>
            </div>

            {/* Quick Active Artwork Actions if an image is loaded */}
            {(currentTransformedImage || canUndo) && (
              <div className="mt-3 p-2.5 bg-purple-50/70 border border-purple-100 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="text-xs font-semibold text-purple-900 truncate">
                    Active Artwork
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canUndo && (
                    <button
                      type="button"
                      onClick={() => {
                        handleUndoTransformation();
                        setIsDrawerOpen(false);
                      }}
                      className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Undo transformation"
                    >
                      <Undo2 className="w-3 h-3 text-amber-700" />
                      <span>Undo {undoCount > 0 ? `(${undoCount})` : ''}</span>
                    </button>
                  )}
                  {currentTransformedImage && (
                    <button
                      type="button"
                      onClick={handleDownloadCurrent}
                      disabled={isDownloading}
                      className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Download active visual"
                    >
                      {downloadSuccess ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <Download className="w-3 h-3 text-white" />
                      )}
                      <span>{downloadSuccess ? 'Saved' : 'Download'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Media Navigation Tabs: Recent Prompts, Images, Videos */}
            <div className="mt-3 flex items-center bg-gray-100 p-1 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => setDrawerTab('prompts')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1 cursor-pointer ${
                  drawerTab === 'prompts'
                    ? 'bg-white text-purple-700 font-bold shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>Prompts</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 font-bold">
                  {recentPrompts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('images')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1 cursor-pointer ${
                  drawerTab === 'images'
                    ? 'bg-white text-purple-700 font-bold shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>Images</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 font-bold">
                  {recentImages.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('videos')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition flex items-center justify-center gap-1 cursor-pointer ${
                  drawerTab === 'videos'
                    ? 'bg-white text-purple-700 font-bold shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>Videos</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 font-bold">
                  {actualVideos.length}
                </span>
              </button>
            </div>

            {/* Tab 1: Recent Prompts with Long-Press Action (Pin, Share, Rename, Delete) */}
            {drawerTab === 'prompts' && (
              <div className="mt-3 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center text-xs text-gray-500 mb-2 px-1">
                  <span className="font-semibold text-gray-600">
                    RECENT PROMPTS ({recentPrompts.length})
                  </span>
                  {recentPrompts.length > 4 && (
                    <button 
                      type="button"
                      onClick={() => setShowAllPrompts(!showAllPrompts)}
                      className="text-purple-600 hover:underline text-xs font-medium cursor-pointer"
                    >
                      {showAllPrompts ? 'Show less' : 'View all'}
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                    Recent Prompts (Long press for options)
                  </span>
                  {recentPrompts.length === 0 ? (
                    <div className="text-center py-10 text-xs text-gray-400">
                      No recent prompts yet. Start chatting to build your prompt history!
                    </div>
                  ) : (
                    (showAllPrompts ? recentPrompts : recentPrompts.slice(0, 20)).map((item, idx) => (
                      <div
                        key={item.id || idx}
                        onTouchStart={() => handlePromptTouchStart(item)}
                        onTouchEnd={handlePromptTouchEnd}
                        onMouseDown={() => handlePromptTouchStart(item)}
                        onMouseUp={handlePromptTouchEnd}
                        onClick={() => {
                          if (isLongPressTriggered.current) return;
                          window.dispatchEvent(
                            new CustomEvent('metfa_ai_restore_prompt', {
                              detail: {
                                prompt: item.prompt,
                                stylePreset: item.stylePreset,
                              },
                            })
                          );
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full text-left p-2.5 text-xs rounded-xl truncate transition flex items-center justify-between gap-2 cursor-pointer select-none ${
                          item.isPinned
                            ? 'bg-purple-100 text-purple-900 font-semibold border border-purple-200'
                            : 'bg-purple-50/70 hover:bg-purple-100 text-purple-800 border border-purple-100/60'
                        }`}
                        title={item.prompt}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <span className="text-purple-600 shrink-0">✨</span>
                          <span className="truncate flex-1 font-medium">{item.prompt}</span>
                        </div>
                        {item.isPinned && (
                          <span className="text-xs shrink-0 ml-1" title="Pinned to top">
                            📌
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {recentPrompts.length > 0 && (
                  <div className="pt-3 border-t border-gray-100 mt-2 flex justify-between items-center text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        clearAllRecentPrompts();
                        setRecentPrompts([]);
                      }}
                      className="text-gray-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      Clear history
                    </button>
                    <span className="text-[10px] text-gray-400">Tap to load, hold for options</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Generated Images */}
            {drawerTab === 'images' && (
              <div className="mt-3 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center text-xs text-gray-500 mb-2 px-1">
                  <span className="font-semibold text-gray-600">
                    GENERATED IMAGES ({recentImages.length})
                  </span>
                  {recentImages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearRecentImages}
                      className="text-gray-400 hover:text-rose-600 text-xs transition cursor-pointer"
                    >
                      Clear images
                    </button>
                  )}
                </div>

                <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  {recentImages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-gray-400">
                      No generated images in this session yet.
                    </div>
                  ) : (
                    recentImages.map((img) => (
                      <div
                        key={img.id}
                        className="p-2 bg-gray-50 hover:bg-purple-50/40 rounded-xl border border-gray-200 transition flex gap-2.5 items-center group"
                      >
                        <img
                          src={img.imageSrc}
                          alt="AI Artwork"
                          className="w-16 h-16 rounded-lg object-cover bg-gray-200 shrink-0 border border-gray-200"
                        />
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <p className="text-xs text-gray-800 font-medium line-clamp-2 leading-snug">
                            {img.prompt}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedComparisonImage(img);
                                setIsDrawerOpen(false);
                              }}
                              className="px-2 py-0.5 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md text-[11px] font-semibold transition cursor-pointer"
                            >
                              Compare
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpscaleFromDrawer(img);
                                setIsDrawerOpen(false);
                              }}
                              className="px-2 py-0.5 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md text-[11px] font-semibold transition cursor-pointer"
                            >
                              Upscale
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadTransformedImageLocally(img.imageSrc, img.prompt)}
                              className="p-1 bg-white hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 transition cursor-pointer"
                              title="Download"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Generated Videos */}
            {drawerTab === 'videos' && (
              <div className="mt-3 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center text-xs text-gray-500 mb-2 px-1">
                  <span className="font-semibold text-gray-600">
                    GENERATED VIDEOS ({actualVideos.length})
                  </span>
                </div>

                <div className="space-y-2 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  {actualVideos.length === 0 ? (
                    <div className="text-center py-10 text-xs text-gray-400">
                      No video media in this session yet.
                    </div>
                  ) : (
                    actualVideos.map((vid) => (
                      <div
                        key={vid.id}
                        className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                          <Video className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="truncate">{vid.name || 'Video Media'}</span>
                        </div>
                        {vid.prompt && (
                          <p className="text-[11px] text-gray-600 line-clamp-2 italic">
                            "{vid.prompt}"
                          </p>
                        )}
                        {vid.url && (
                          <video
                            src={vid.url}
                            controls
                            className="w-full max-h-36 rounded-lg bg-black object-cover mt-1"
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Gemini-Style Context Menu Modal for Long-Pressed Prompt */}
      {selectedPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setSelectedPrompt(null)}
        >
          <div
            className="bg-white rounded-2xl p-4 w-72 max-w-full shadow-2xl space-y-3 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-xs font-bold text-gray-500 truncate border-b pb-2">
              "{selectedPrompt.prompt}"
            </h4>
            <button
              type="button"
              onClick={() => handleSharePrompt(selectedPrompt.prompt)}
              className="w-full text-left py-1.5 px-2 rounded-lg hover:bg-purple-50 text-sm flex items-center gap-2.5 text-gray-700 hover:text-purple-700 transition cursor-pointer"
            >
              <span>🔗</span>
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={() => handlePinPrompt(selectedPrompt.id)}
              className="w-full text-left py-1.5 px-2 rounded-lg hover:bg-purple-50 text-sm flex items-center gap-2.5 text-gray-700 hover:text-purple-700 transition cursor-pointer"
            >
              <span>📌</span>
              <span>{selectedPrompt.isPinned ? 'Unpin' : 'Pin to Top'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleRenamePrompt(selectedPrompt.id)}
              className="w-full text-left py-1.5 px-2 rounded-lg hover:bg-purple-50 text-sm flex items-center gap-2.5 text-gray-700 hover:text-purple-700 transition cursor-pointer"
            >
              <span>✏️</span>
              <span>Rename</span>
            </button>
            <button
              type="button"
              onClick={() => handleDeletePrompt(selectedPrompt.id)}
              className="w-full text-left py-1.5 px-2 rounded-lg hover:bg-red-50 text-sm flex items-center gap-2.5 text-red-600 font-medium transition cursor-pointer"
            >
              <span>🗑️</span>
              <span>Delete</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPrompt(null)}
              className="w-full text-center mt-2 text-xs text-gray-400 hover:text-gray-600 pt-2 border-t cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIStudioModule;

