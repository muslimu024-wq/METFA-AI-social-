import { ChatMessage, StudioSettings } from '../types/chat';
import { safeSetItem, safeGetItem, safeRemoveItem } from './storageUtils';

const CHAT_STORAGE_KEY = 'metfa_chat_messages_v3';
const SESSIONS_STORAGE_KEY = 'metfa_chat_sessions_v3';
const SETTINGS_STORAGE_KEY = 'metfa_studio_settings_v3';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_welcome',
    role: 'assistant',
    content: `👋 **Welcome to Metfa Social!**

I am your multimodal intelligence companion powered by **Gemini 3.7 Flash** with low-latency response times and automatic high-availability fallback.

Here is what we can do together:

1. 🖼️ **Multimodal Scene Transformation**: Upload any photo, screenshot, or artwork, add your vision or style prompt, and transform it instantly.
2. 🔍 **Screenshot & Code Diagnostics**: Drop full-screen error logs, IDE captures, or terminal messages for instant root cause detection and fixed code blocks.
3. 🪄 **4K AI Upscale & Super-Resolution**: Upscale any artwork with micro-texture sharpening and noise suppression.
4. 🎙️ **Multilingual & Voice-Enabled**: Converse seamlessly in any language (Multilingual Support Enabled).

How can I help you create or debug today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    modelUsed: 'gemini-3.7-flash',
  },
];

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  model: 'gemini-3.7-flash',
  qualityLevel: 'hd',
  stylePreset: '',
  temperature: 0.7,
  autoEnhancePrompt: false,
};

export const getStoredChatMessages = (): ChatMessage[] => {
  try {
    const raw = safeGetItem(CHAT_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        const seenIds = new Set<string>();
        return data.map((msg, index) => {
          let id = msg.id || `msg_${Date.now()}_${index}`;
          if (seenIds.has(id)) {
            id = `${id}_${index}_${Math.random().toString(36).slice(2, 6)}`;
          }
          seenIds.add(id);
          return { ...msg, id };
        });
      }
    }
  } catch (err) {
    console.error('Error loading stored chat messages:', err);
  }
  return INITIAL_CHAT_MESSAGES;
};

export const saveStoredChatMessages = (messages: ChatMessage[]): void => {
  try {
    // Keep max 25 messages, strip oversized base64 on older messages to preserve storage
    const trimmed = messages.slice(-25).map((m, idx, arr) => {
      if (idx < arr.length - 3 && m.attachments && m.attachments.length > 0) {
        // Keep metadata but reduce attachment footprint on old messages
        return {
          ...m,
          attachments: m.attachments.map((att) => ({
            ...att,
            base64: undefined,
            previewUrl: att.previewUrl?.startsWith('data:') ? 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400' : att.previewUrl,
          })),
        };
      }
      return m;
    });
    safeSetItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Error saving chat messages:', err);
  }
};

export const clearStoredChatMessages = (): void => {
  safeRemoveItem(CHAT_STORAGE_KEY);
};

export const getChatSessions = (): ChatSession[] => {
  try {
    const raw = safeGetItem(SESSIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Error loading chat sessions:', err);
  }

  const initialSession: ChatSession = {
    id: 'session_default',
    title: 'New Scene Creation',
    messages: getStoredChatMessages(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return [initialSession];
};

export const getCurrentSession = (): ChatSession => {
  const sessions = getChatSessions();
  return sessions[0];
};

export const saveSession = (session: ChatSession): void => {
  try {
    const sessions = getChatSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    let updated: ChatSession[];
    if (index >= 0) {
      updated = [...sessions];
      updated[index] = session;
    } else {
      updated = [session, ...sessions];
    }
    // Keep max 10 sessions in storage
    const trimmedSessions = updated.slice(0, 10);
    safeSetItem(SESSIONS_STORAGE_KEY, JSON.stringify(trimmedSessions));
    saveStoredChatMessages(session.messages);
  } catch (err) {
    console.error('Error saving session:', err);
  }
};

export const createNewSession = (title = 'New Scene Creation'): ChatSession => {
  const newSession: ChatSession = {
    id: `session_${Date.now()}`,
    title,
    messages: INITIAL_CHAT_MESSAGES,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const sessions = [newSession, ...getChatSessions()];
  try {
    safeSetItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 10)));
  } catch (e) {
    console.error(e);
  }
  saveStoredChatMessages(newSession.messages);
  return newSession;
};

export const getStudioSettings = (): StudioSettings => {
  try {
    const raw = safeGetItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data) return { ...DEFAULT_STUDIO_SETTINGS, ...data };
    }
  } catch (err) {
    console.error('Error loading studio settings:', err);
  }
  return DEFAULT_STUDIO_SETTINGS;
};

export const saveStudioSettings = (settings: StudioSettings): void => {
  try {
    safeSetItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving studio settings:', err);
  }
};

/**
 * Deletes a single chat message or prompt history item from current session and storage.
 */
export const deleteChatMessage = (messageId: string): ChatMessage[] => {
  const currentSession = getCurrentSession();
  const updatedMessages = (currentSession.messages || []).filter((m) => m.id !== messageId);
  currentSession.messages = updatedMessages;
  currentSession.updatedAt = new Date().toISOString();
  saveSession(currentSession);
  return updatedMessages;
};

/**
 * Clears all chat messages and prompt history from the current session.
 */
export const clearAllChatHistory = (): ChatMessage[] => {
  const currentSession = getCurrentSession();
  currentSession.messages = [];
  currentSession.updatedAt = new Date().toISOString();
  saveSession(currentSession);
  return [];
};

