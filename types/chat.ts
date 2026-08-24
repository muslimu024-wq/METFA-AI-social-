export interface ChatAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'code';
  name: string;
  size: number;
  mimeType: string;
  previewUrl: string;
  base64?: string;
  duration?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ChatAttachment[];
  timestamp: string;
  isStreaming?: boolean;
  generatedImageB64?: string;
  isImageGeneration?: boolean;
  modelUsed?: string;
  isFallback?: boolean;
  latencyMs?: number;
  tokensUsed?: number;
  isError?: boolean;
  canRetry?: boolean;
  retryPayload?: {
    text: string;
    attachments: ChatAttachment[];
  };
}

export interface StudioSettings {
  model: string;
  temperature: number;
  systemInstruction?: string;
  stylePreset?: string;
  aspectRatio?: string;
  qualityLevel?: 'standard' | 'hd' | 'ultra_4k';
  safetySettings?: string;
  autoEnhancePrompt?: boolean;
  voiceAutoRead?: boolean;
}

