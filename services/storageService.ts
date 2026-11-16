import {
  supabase,
  isSupabaseConfigured,
  validateSupabaseConfig,
  getClientAuthToken,
} from './supabaseClient';
import { saveMediaItem } from '../utils/mediaStorage';

export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB max video selection
export const MAX_SERVER_UPLOAD_BYTES = 35 * 1024 * 1024; // 35 MB matches /api/storage/upload server limit
export const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000; // 2-minute network/stall guard

const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'webm',
  'mov',
  '3gp',
  '3g2',
  'ogg',
  'ogv',
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/mp4',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
};

const MIME_TO_EXTENSION: Record<string, string> = {
  'video/mp4': 'mp4',
  'application/mp4': 'mp4',
  'video/x-m4v': 'mp4',
  'video/quicktime': 'mp4',
  'video/3gpp': '3gp',
  'video/3gpp2': '3g2',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
};

export interface UploadResult {
  url: string;
  storageType: 'supabase' | 'server' | 'indexeddb';
  fileName: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface UploadProgressInfo {
  stage: 'preparing' | 'uploading' | 'processing' | 'done';
  percent: number;
  loadedBytes: number;
  totalBytes: number;
}

export interface PreparedVideoFileResult {
  file: File;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  originalName: string;
}

export interface ValidateVideoOptions {
  maxBytes?: number;
  checkServerFallbackLimit?: boolean;
}

/**
 * Inspects initial file bytes to identify MP4/MOV/3GP (ISO BMFF ftyp), WebM (EBML), or OGG containers,
 * and rejects obvious non-video files (images, PDFs, ZIPs) even when Android gallery URIs omit MIME types.
 */
export function detectVideoMimeFromBytes(
  bytes: Uint8Array
): { mimeType: string; extension: string; isNonVideoSignature?: boolean } | null {
  if (!bytes || bytes.length < 4) return null;

  // Reject clear non-video headers immediately
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg', isNonVideoSignature: true };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mimeType: 'image/png', extension: 'png', isNonVideoSignature: true };
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mimeType: 'application/pdf', extension: 'pdf', isNonVideoSignature: true };
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { mimeType: 'application/zip', extension: 'zip', isNonVideoSignature: true };
  }

  // WebM / Matroska EBML header: 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mimeType: 'video/webm', extension: 'webm' };
  }

  // Ogg header: OggS
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { mimeType: 'video/ogg', extension: 'ogv' };
  }

  // ISO BMFF (MP4 / MOV / M4V / 3GP): contains 'ftyp' in first 64 bytes
  const scanLen = Math.min(bytes.length, 64);
  for (let i = 0; i <= scanLen - 4; i++) {
    if (
      bytes[i] === 0x66 && // f
      bytes[i + 1] === 0x74 && // t
      bytes[i + 2] === 0x79 && // y
      bytes[i + 3] === 0x70 // p
    ) {
      return { mimeType: 'video/mp4', extension: 'mp4' };
    }
  }

  return null;
}

async function readBlobHeaderBytes(blob: Blob, maxBytes = 64): Promise<Uint8Array> {
  const slice = blob.slice(0, Math.min(blob.size, maxBytes));
  if (typeof (slice as any).arrayBuffer === 'function') {
    const buf = await (slice as any).arrayBuffer();
    return new Uint8Array(buf);
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array((reader.result as ArrayBuffer) || new ArrayBuffer(0)));
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read selected video file bytes.'));
    reader.readAsArrayBuffer(slice);
  });
}

function normalizeBaseFileName(rawName: string | undefined, targetExt: string): string {
  const fallbackBase = `reel_video_${Date.now()}`;
  const cleaned = (rawName || '')
    .trim()
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!cleaned) {
    return `${fallbackBase}.${targetExt}`;
  }
  const dotIdx = cleaned.lastIndexOf('.');
  if (dotIdx > 0) {
    const base = cleaned.slice(0, dotIdx) || fallbackBase;
    const ext = cleaned.slice(dotIdx + 1).toLowerCase();
    if (SUPPORTED_VIDEO_EXTENSIONS.has(ext)) {
      return `${base}.${ext}`;
    }
    return `${base}.${targetExt}`;
  }
  return `${cleaned}.${targetExt}`;
}

/**
 * Validates and normalizes any gallery-selected video File or Blob (including Android content://
 * URIs that omit MIME types or file extensions). Throws an explicit actionable error on empty,
 * unreadable, oversized, or unsupported files.
 */
export async function validateAndPrepareVideoFile(
  source: File | Blob,
  options: ValidateVideoOptions = {}
): Promise<PreparedVideoFileResult> {
  if (!source) {
    throw new Error('No video file was received from the device picker.');
  }

  const sizeBytes = typeof source.size === 'number' ? source.size : 0;
  if (sizeBytes <= 0) {
    throw new Error('Selected video file is empty (0 bytes). Please choose another video.');
  }

  const maxAllowed = options.maxBytes ?? MAX_VIDEO_UPLOAD_BYTES;
  if (sizeBytes > maxAllowed) {
    const mb = (sizeBytes / (1024 * 1024)).toFixed(1);
    const maxMb = Math.round(maxAllowed / (1024 * 1024));
    throw new Error(`Selected video is too large (${mb} MB). Maximum allowed size is ${maxMb} MB.`);
  }

  const checkServerCap =
    options.checkServerFallbackLimit !== undefined
      ? options.checkServerFallbackLimit
      : !isSupabaseConfigured();

  if (checkServerCap && sizeBytes > MAX_SERVER_UPLOAD_BYTES) {
    const mb = (sizeBytes / (1024 * 1024)).toFixed(1);
    const maxMb = Math.round(MAX_SERVER_UPLOAD_BYTES / (1024 * 1024));
    throw new Error(
      `Selected video is ${mb} MB, which exceeds the ${maxMb} MB server upload limit. Please select a shorter or compressed video clip.`
    );
  }

  let headerBytes: Uint8Array;
  try {
    headerBytes = await readBlobHeaderBytes(source, 64);
  } catch (readErr: any) {
    throw new Error(
      readErr?.message ||
        'Could not read the selected video from your device gallery. Please try selecting the file again.'
    );
  }

  if (!headerBytes || headerBytes.length === 0) {
    throw new Error(
      'Unable to read video bytes from your gallery selection. Please grant storage access or pick a local video.'
    );
  }

  const originalName = source instanceof File ? source.name : '';
  const rawType = (source.type || '').split(';')[0].trim().toLowerCase();
  const extFromName = originalName.includes('.')
    ? originalName.split('.').pop()?.trim().toLowerCase() || ''
    : '';

  const detected = detectVideoMimeFromBytes(headerBytes);
  if (detected?.isNonVideoSignature) {
    throw new Error(
      `Selected file appears to be "${detected.mimeType}", not a supported MP4/WebM/MOV video.`
    );
  }

  let resolvedMime = '';
  let resolvedExt = '';

  if (detected) {
    resolvedMime = detected.mimeType;
    resolvedExt = detected.extension;
  } else if (rawType && (rawType.startsWith('video/') || MIME_TO_EXTENSION[rawType])) {
    resolvedMime = rawType === 'video/quicktime' || rawType === 'video/x-m4v' ? 'video/mp4' : rawType;
    resolvedExt = MIME_TO_EXTENSION[rawType] || rawType.split('/')[1] || 'mp4';
  } else if (extFromName && SUPPORTED_VIDEO_EXTENSIONS.has(extFromName)) {
    resolvedMime = EXTENSION_TO_MIME[extFromName] || 'video/mp4';
    resolvedExt = MIME_TO_EXTENSION[resolvedMime] || 'mp4';
  } else {
    throw new Error(
      'Unsupported video format. Please choose an MP4, WebM, or MOV video file from your gallery.'
    );
  }

  const normalizedName = normalizeBaseFileName(originalName, resolvedExt);

  let normalizedFile: File;
  if (
    source instanceof File &&
    source.type.toLowerCase() === resolvedMime &&
    source.name === normalizedName
  ) {
    normalizedFile = source;
  } else if (typeof File !== 'undefined') {
    normalizedFile = new File([source], normalizedName, {
      type: resolvedMime,
      lastModified: source instanceof File && source.lastModified ? source.lastModified : Date.now(),
    });
  } else {
    normalizedFile = Object.assign(source, {
      name: normalizedName,
      lastModified: Date.now(),
    }) as File;
  }

  return {
    file: normalizedFile,
    mimeType: resolvedMime,
    extension: resolvedExt,
    sizeBytes,
    originalName: originalName || normalizedName,
  };
}

/**
 * Converts a Base64 Data URL to a Blob
 */
export function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return { blob: new Blob([u8arr], { type: mimeType }), mimeType };
}

export interface UploadMediaOptions {
  userId?: string;
  type?: 'image' | 'video';
  fileName?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  visibility?: string | null;
  onProgress?: (info: UploadProgressInfo) => void;
}

function createAbortError(message = 'The upload operation was aborted.'): DOMException {
  return new DOMException(message, 'AbortError');
}

function readBlobAsDataUrl(
  blob: Blob,
  signal: AbortSignal,
  onProgress?: (loaded: number, total: number) => void
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {
      return reject(createAbortError());
    }
    const reader = new FileReader();
    const abortHandler = () => {
      try {
        reader.abort();
      } catch {}
      reject(createAbortError());
    };
    signal.addEventListener('abort', abortHandler, { once: true });
    reader.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(ev.loaded, ev.total);
      }
    };
    reader.onload = () => {
      signal.removeEventListener('abort', abortHandler);
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      signal.removeEventListener('abort', abortHandler);
      reject(reader.error || new Error('Failed to read media file for upload.'));
    };
    reader.onabort = () => {
      signal.removeEventListener('abort', abortHandler);
      reject(createAbortError());
    };
    reader.readAsDataURL(blob);
  });
}

function sendXhrUpload(params: {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body: Blob | string;
  signal: AbortSignal;
  totalBytes: number;
  onProgress?: (info: UploadProgressInfo) => void;
  progressBasePercent?: number;
  progressMaxPercent?: number;
}): Promise<{ status: number; responseText: string }> {
  return new Promise((resolve, reject) => {
    if (params.signal.aborted) {
      return reject(createAbortError());
    }
    const xhr = new XMLHttpRequest();
    const basePct = params.progressBasePercent ?? 0;
    const maxPct = params.progressMaxPercent ?? 95;
    let settled = false;

    const cleanup = () => {
      params.signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        xhr.abort();
      } catch {}
      reject(createAbortError());
    };

    params.signal.addEventListener('abort', onAbort, { once: true });

    xhr.open(params.method || 'POST', params.url, true);
    Object.entries(params.headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        xhr.setRequestHeader(key, value);
      }
    });

    if (xhr.upload) {
      xhr.upload.onprogress = (ev) => {
        if (!params.onProgress) return;
        const total = ev.lengthComputable && ev.total > 0 ? ev.total : params.totalBytes;
        const ratio = total > 0 ? Math.min(1, Math.max(0, ev.loaded / total)) : 0;
        const percent = Math.min(
          maxPct,
          Math.max(basePct, Math.round(basePct + ratio * (maxPct - basePct)))
        );
        params.onProgress({
          stage: 'uploading',
          percent,
          loadedBytes: ev.loaded,
          totalBytes: total,
        });
      };

      xhr.upload.onloadend = () => {
        params.onProgress?.({
          stage: 'processing',
          percent: Math.max(maxPct, 96),
          loadedBytes: params.totalBytes,
          totalBytes: params.totalBytes,
        });
      };
    }

    xhr.onload = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ status: xhr.status, responseText: xhr.responseText || '' });
    };

    xhr.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Network error occurred while uploading video. Please check your connection and retry.'));
    };

    xhr.onabort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(createAbortError());
    };

    xhr.send(params.body);
  });
}

/**
 * Uploads a file (image or video) persistently to Supabase Storage or server disk fallback.
 * Guarantees that the media has a permanent URL that survives page refresh, reports genuine
 * upload progress, enforces stall timeouts, and respects AbortSignal cancellation.
 */
export async function uploadMediaItem(
  source: File | Blob | string,
  options: UploadMediaOptions = {}
): Promise<UploadResult> {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  const isDataUrl = typeof source === 'string' && source.startsWith('data:');
  let blob: Blob;
  let mimeType: string;
  let rawFileName = options.fileName || '';

  const requestController = new AbortController();
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;
  const timeoutTimer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          requestController.abort();
        }, timeoutMs)
      : null;

  const forwardExternalAbort = () => requestController.abort();
  options.signal?.addEventListener('abort', forwardExternalAbort, { once: true });

  const throwIfCancelledOrTimedOut = () => {
    if (options.signal?.aborted) {
      throw createAbortError();
    }
    if (timedOut || requestController.signal.aborted) {
      throw new Error('Upload timed out because the connection stalled. Please retry.');
    }
  };

  try {
    if (typeof source === 'string') {
      if (source.startsWith('data:')) {
        const extracted = dataUrlToBlob(source);
        blob = extracted.blob;
        mimeType = extracted.mimeType;
        if (!rawFileName) {
          const ext = mimeType.split('/')[1] || (options.type === 'video' ? 'mp4' : 'jpg');
          rawFileName = `upload_${Date.now()}.${ext}`;
        }
      } else if (source.startsWith('blob:')) {
        try {
          const res = await fetch(source, { signal: requestController.signal });
          blob = await res.blob();
          mimeType = blob.type || (options.type === 'video' ? 'video/mp4' : 'image/jpeg');
          if (!rawFileName) {
            const ext =
              (mimeType.split('/')[1] || '').split(';')[0] ||
              (options.type === 'video' ? 'mp4' : 'jpg');
            rawFileName = `upload_${Date.now()}.${ext}`;
          }
        } catch (blobErr: any) {
          throwIfCancelledOrTimedOut();
          if (blobErr?.name === 'AbortError') {
            throw blobErr;
          }
          console.warn('[StorageService] Error fetching blob URL:', blobErr);
          throw new Error(
            'Failed to read media source for upload. The temporary media may have expired or been revoked.'
          );
        }
      } else {
        // Already an HTTP URL or permanent server path
        options.onProgress?.({
          stage: 'done',
          percent: 100,
          loadedBytes: 0,
          totalBytes: 0,
        });
        return {
          url: source,
          storageType: 'server',
          fileName: rawFileName || 'existing_media',
          sizeBytes: 0,
          mimeType: options.type === 'video' ? 'video/mp4' : 'image/jpeg',
        };
      }
    } else if (source instanceof File) {
      blob = source;
      mimeType = source.type || '';
      rawFileName = options.fileName || source.name;
    } else {
      blob = source;
      mimeType = blob.type || '';
      if (!rawFileName) {
        rawFileName = `upload_${Date.now()}.${options.type === 'video' ? 'mp4' : 'jpg'}`;
      }
    }

    if (!blob || blob.size <= 0) {
      throw new Error('Selected media file is empty (0 bytes). Please choose a valid file.');
    }

    // Normalize missing or Android gallery MIME types for videos before upload
    if (options.type === 'video' || mimeType.startsWith('video/') || mimeType === '') {
      if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'video/quicktime' || mimeType === 'video/x-m4v') {
        try {
          const headerBytes = await readBlobHeaderBytes(blob, 64);
          const detected = detectVideoMimeFromBytes(headerBytes);
          if (detected && !detected.isNonVideoSignature) {
            mimeType = detected.mimeType;
          }
        } catch {}
      }
      if (!mimeType) {
        mimeType = options.type === 'video' ? 'video/mp4' : 'image/jpeg';
      }
    }

    const determinedType: 'image' | 'video' =
      options.type || (mimeType.startsWith('video') ? 'video' : 'image');

    const baseName = (rawFileName || `upload_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const inferredExt =
      MIME_TO_EXTENSION[mimeType.toLowerCase()] ||
      (determinedType === 'video' ? 'mp4' : 'jpg');
    const sanitizedFileName = baseName.includes('.') ? baseName : `${baseName}.${inferredExt}`;
    const uniquePath = `${options.userId || 'community'}/${Date.now()}_${sanitizedFileName}`;

    throwIfCancelledOrTimedOut();

    // 1. Attempt Supabase Storage Upload if configured
    let supabaseFailureReason: string | null = null;
    if (isSupabaseConfigured()) {
      const sbConfig = validateSupabaseConfig();
      const bucketName = 'posts';
      try {
        if (typeof XMLHttpRequest !== 'undefined' && sbConfig) {
          const authToken = await getClientAuthToken().catch(() => null);
          const encodedPath = uniquePath.split('/').map(encodeURIComponent).join('/');
          const uploadEndpoint = `${sbConfig.url}/storage/v1/object/${bucketName}/${encodedPath}`;

          const xhrRes = await sendXhrUpload({
            url: uploadEndpoint,
            method: 'POST',
            headers: {
              apikey: sbConfig.key,
              Authorization: `Bearer ${authToken || sbConfig.key}`,
              'x-upsert': 'true',
              'cache-control': '3600',
              'Content-Type': mimeType,
            },
            body: blob,
            signal: requestController.signal,
            totalBytes: blob.size,
            onProgress: options.onProgress,
            progressBasePercent: 5,
            progressMaxPercent: 95,
          });

          throwIfCancelledOrTimedOut();

          if (xhrRes.status >= 200 && xhrRes.status < 300) {
            const { data: publicUrlData } = (supabase as any).storage
              .from(bucketName)
              .getPublicUrl(uniquePath);
            const resolvedUrl =
              publicUrlData?.publicUrl ||
              `${sbConfig.url}/storage/v1/object/public/${bucketName}/${encodedPath}`;

            options.onProgress?.({
              stage: 'done',
              percent: 100,
              loadedBytes: blob.size,
              totalBytes: blob.size,
            });

            return {
              url: resolvedUrl,
              storageType: 'supabase',
              fileName: sanitizedFileName,
              sizeBytes: blob.size,
              mimeType,
            };
          } else {
            let parsedMsg = '';
            try {
              const errBody = JSON.parse(xhrRes.responseText || '{}');
              parsedMsg = errBody?.message || errBody?.error || '';
            } catch {}
            supabaseFailureReason = parsedMsg || `Cloud storage HTTP ${xhrRes.status}`;
            console.warn('[StorageService] Supabase XHR upload status:', xhrRes.status, supabaseFailureReason);
          }
        } else {
          let abortHandler: () => void;
          const abortPromise = new Promise<never>((_, reject) => {
            abortHandler = () => {
              reject(
                options.signal?.aborted
                  ? createAbortError()
                  : new Error('Upload timed out because the connection stalled. Please retry.')
              );
            };
            requestController.signal.addEventListener('abort', abortHandler, { once: true });
          });

          let uploadResult: any;
          try {
            options.onProgress?.({
              stage: 'uploading',
              percent: 15,
              loadedBytes: 0,
              totalBytes: blob.size,
            });
            uploadResult = await Promise.race([
              (supabase as any).storage.from(bucketName).upload(uniquePath, blob, {
                contentType: mimeType,
                upsert: true,
                cacheControl: '3600',
              }),
              abortPromise,
            ]);
          } finally {
            if (abortHandler!) {
              requestController.signal.removeEventListener('abort', abortHandler);
            }
          }

          throwIfCancelledOrTimedOut();

          const { data, error } = uploadResult || {};
          if (!error && data?.path) {
            const { data: publicUrlData } = (supabase as any).storage
              .from(bucketName)
              .getPublicUrl(data.path);

            if (publicUrlData?.publicUrl) {
              options.onProgress?.({
                stage: 'done',
                percent: 100,
                loadedBytes: blob.size,
                totalBytes: blob.size,
              });
              return {
                url: publicUrlData.publicUrl,
                storageType: 'supabase',
                fileName: sanitizedFileName,
                sizeBytes: blob.size,
                mimeType,
              };
            }
          } else if (error) {
            supabaseFailureReason = error?.message || 'Cloud storage upload rejected';
            console.warn('[StorageService] Supabase upload error:', supabaseFailureReason);
          }
        }
      } catch (sbErr: any) {
        throwIfCancelledOrTimedOut();
        if (sbErr?.name === 'AbortError') {
          throw sbErr;
        }
        supabaseFailureReason = sbErr?.message || 'Cloud storage upload exception';
        console.warn('[StorageService] Supabase upload exception, falling back to server:', sbErr);
      }
    }

    throwIfCancelledOrTimedOut();

    // 2. Fallback to Server Storage via /api/storage/upload
    if (blob.size > MAX_SERVER_UPLOAD_BYTES) {
      const mb = (blob.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        supabaseFailureReason
          ? `Cloud upload failed (${supabaseFailureReason}) and file (${mb} MB) exceeds the 35 MB server fallback limit.`
          : `Video size (${mb} MB) exceeds the 35 MB server upload limit. Please select a smaller clip.`
      );
    }

    options.onProgress?.({
      stage: 'preparing',
      percent: 4,
      loadedBytes: 0,
      totalBytes: blob.size,
    });

    const base64Data = isDataUrl
      ? (source as string)
      : await readBlobAsDataUrl(blob, requestController.signal, (loaded, total) => {
          const pct = total > 0 ? Math.min(18, Math.max(4, Math.round(4 + (loaded / total) * 14))) : 10;
          options.onProgress?.({
            stage: 'preparing',
            percent: pct,
            loadedBytes: loaded,
            totalBytes: total,
          });
        });

    throwIfCancelledOrTimedOut();

    const token = await getClientAuthToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const bodyPayload = JSON.stringify({
      fileBase64: base64Data,
      fileName: sanitizedFileName,
      mimeType,
      type: determinedType,
      visibility: options.visibility || null,
    });

    let serverStatus = 0;
    let serverResponseJson: any = {};

    if (typeof XMLHttpRequest !== 'undefined') {
      const xhrRes = await sendXhrUpload({
        url: '/api/storage/upload',
        method: 'POST',
        headers,
        body: bodyPayload,
        signal: requestController.signal,
        totalBytes: blob.size,
        onProgress: options.onProgress,
        progressBasePercent: 20,
        progressMaxPercent: 95,
      });
      serverStatus = xhrRes.status;
      try {
        serverResponseJson = JSON.parse(xhrRes.responseText || '{}');
      } catch {
        serverResponseJson = {};
      }
    } else {
      options.onProgress?.({
        stage: 'uploading',
        percent: 30,
        loadedBytes: 0,
        totalBytes: blob.size,
      });
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers,
        signal: requestController.signal,
        body: bodyPayload,
      });
      serverStatus = response.status;
      serverResponseJson = await response.json().catch(() => ({}));
    }

    throwIfCancelledOrTimedOut();

    if (serverStatus >= 200 && serverStatus < 300 && serverResponseJson?.url) {
      options.onProgress?.({
        stage: 'done',
        percent: 100,
        loadedBytes: blob.size,
        totalBytes: blob.size,
      });
      return {
        url: serverResponseJson.url,
        storageType: 'server',
        fileName: sanitizedFileName,
        sizeBytes: blob.size,
        mimeType: serverResponseJson.mimeType || mimeType,
      };
    }

    const srvMessage = serverResponseJson?.error;
    if (serverStatus === 401 || serverStatus === 403) {
      throw new Error(
        srvMessage || 'Authentication is required to upload videos. Please sign in and retry.'
      );
    }
    if (serverStatus === 413) {
      throw new Error(
        srvMessage || 'Video file is too large for server upload (maximum 35 MB).'
      );
    }
    if (serverStatus === 415) {
      throw new Error(
        srvMessage || 'Unsupported video format. Please upload a valid MP4 or WebM video.'
      );
    }
    if (srvMessage) {
      throw new Error(`Upload failed: ${srvMessage}`);
    }

    throw new Error(
      supabaseFailureReason
        ? `Upload failed (${supabaseFailureReason}). Please check your connection and retry.`
        : 'Upload failed: Unable to persist media to cloud or server storage. Please check your connection and authentication status.'
    );
  } catch (err: any) {
    if (options.signal?.aborted) {
      throw createAbortError();
    }
    if (timedOut) {
      throw new Error('Upload timed out because the connection stalled. Please retry.');
    }
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw err instanceof Error
      ? err
      : new Error('Upload failed: Unable to persist media to cloud or server storage.');
  } finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
    options.signal?.removeEventListener('abort', forwardExternalAbort);
  }
}
