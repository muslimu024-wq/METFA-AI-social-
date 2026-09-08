export * from '../../../types/chat';

export interface GeneratedImageRecord {
  id: string;
  imageSrc: string;
  prompt: string;
  timestamp: string;
  modelUsed?: string;
  isUpscaled?: boolean;
  stylePreset?: string;
  originalMessageId?: string;
  originalImageSrc?: string;
  originalPrompt?: string;
  transformationType?: 'retransform' | 'upscale' | 'multimodal_upload' | 'text_to_image';
}
