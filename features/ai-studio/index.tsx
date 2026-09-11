import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Images, Undo2, RotateCcw, Download, Check } from 'lucide-react';
import GeminiChatView from '../../components/GeminiChatView';
import StudioSettingsDrawer from '../../components/StudioSettingsDrawer';
import RewardedAdModal from '../../components/RewardedAdModal';
import { RecentImagesDrawer } from './components/RecentImagesDrawer';
import { SideBySideComparisonView } from './components/SideBySideComparisonView';
import { addRecentPrompt } from './utils/promptHistoryStore';
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
  const { userProfile } = useAuth();

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
        displayMsg = 'Direct AI image generation requires a Gemini API key with billing enabled (or an OpenAI / Grok key in Settings > API Keys), as image models have a quota limit of 0 on Google\'s free tier.';
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
      if (onShareToSocialFeed) {
        onShareToSocialFeed(postData);
      }
    },
    [onShareToSocialFeed]
  );

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-[#04060C]">
      {/* Top Left Floating Brand Identity: METFA AI */}
      <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-20 hidden sm:flex items-center pointer-events-none">
        <div className="flex items-center px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-purple-500/30 backdrop-blur-md shadow-xl">
          <BrandTitle service="AI" size="sm" theme="dark" asHeading={true} />
        </div>
      </div>

      {/* Top Floating Action Controls: Undo, Download & Recent Visuals */}
      <div className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
        {/* Undo Transformation Button */}
        <button
          type="button"
          id="ai-studio-undo-btn"
          onClick={handleUndoTransformation}
          disabled={!canUndo || isLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer border ${
            canUndo && !isLoading
              ? 'bg-slate-900/95 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border-amber-500/40 hover:border-amber-400'
              : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
          }`}
          title="Undo Last Transformation: Revert to previous visual & prompt (Ctrl+Z)"
        >
          <Undo2 className={`w-4 h-4 transition-transform ${canUndo ? 'hover:-rotate-45' : ''}`} />
          <span className="text-xs font-semibold hidden sm:inline">Undo</span>
          {undoCount > 0 && (
            <span className="flex items-center justify-center px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {undoCount}
            </span>
          )}
        </button>

        {/* Download Current Transformed Image Button */}
        {currentTransformedImage && (
          <button
            type="button"
            id="ai-studio-download-btn"
            onClick={handleDownloadCurrent}
            disabled={isDownloading}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer border ${
              downloadSuccess
                ? 'bg-teal-950/90 text-teal-300 border-teal-500/50'
                : 'bg-slate-900/90 hover:bg-slate-800 text-teal-400 hover:text-teal-300 border-teal-500/40 hover:border-teal-400'
            }`}
            title="Download current transformed visual directly to your device"
          >
            {downloadSuccess ? (
              <Check className="w-4 h-4 text-teal-300" />
            ) : (
              <Download className={`w-4 h-4 text-teal-400 ${isDownloading ? 'animate-bounce' : ''}`} />
            )}
            <span className="text-xs font-semibold hidden sm:inline">
              {downloadSuccess ? 'Saved' : isDownloading ? 'Saving...' : 'Download'}
            </span>
          </button>
        )}

        {/* Quick Access Slide-Over Trigger for Last 10 Generated Images */}
        <button
          type="button"
          id="ai-studio-recent-images-btn"
          onClick={() => setIsRecentImagesOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-slate-900/90 hover:bg-slate-800 border border-purple-500/40 hover:border-purple-400 text-white rounded-2xl shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer group"
          title="Recent Visuals (Last 10 Generated Images in Session)"
        >
          <div className="relative flex items-center justify-center">
            <Images className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
            {recentImages.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 text-[9px] font-black bg-gradient-to-r from-purple-600 to-teal-500 text-white rounded-full ring-2 ring-slate-900">
                {recentImages.length}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-200 group-hover:text-white hidden sm:inline">
            Recent Visuals
          </span>
          <span className="text-[10px] font-mono text-purple-300 hidden md:inline">
            ({recentImages.length}/10)
          </span>
        </button>
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
    </div>
  );
};

export default AIStudioModule;

