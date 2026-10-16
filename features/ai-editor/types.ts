/**
 * METFA Social — AI Editor Phase-1 MVP Types
 * Strict Nokia 1100 philosophy: minimal complexity, high durability, real processing.
 */

export type EditorMediaType = 'video' | 'audio';

export type EditorScreen = 'select' | 'video_edit' | 'audio_edit';

export type VideoOperation = 'trim' | 'enhance' | 'clean_audio' | 'make_reel';

export type AudioOperation = 'trim' | 'clean_voice' | 'improve_sound';

export interface ProcessedMediaResult {
  type: EditorMediaType;
  blob: Blob;
  dataUrl: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  durationSeconds: number;
  width?: number;
  height?: number;
  appliedOperations: string[];
}

export interface VideoTrimRange {
  startTime: number;
  endTime: number;
}

export interface AudioTrimRange {
  startTime: number;
  endTime: number;
}

export interface ProcessingState {
  isProcessing: boolean;
  operationName: string;
  progressPercent: number;
  statusText: string;
  error: string | null;
}

export interface VideoClipItem {
  id: string;
  file: File;
  name: string;
  originalUrl: string;
  currentUrl: string;
  result: ProcessedMediaResult | null;
  isEdited: boolean;
  durationSeconds: number;
  width?: number;
  height?: number;
}
