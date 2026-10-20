import { supabase, isSupabaseConfigured, getClientAuthToken } from './supabaseClient';
import { saveMediaItem } from '../utils/mediaStorage';

export interface UploadResult {
  url: string;
  storageType: 'supabase' | 'server' | 'indexeddb';
  fileName: string;
  sizeBytes?: number;
  mimeType?: string;
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
}

/**
 * Uploads a file (image or video) persistently to Supabase Storage or server disk fallback.
 * Guarantees that the media has a permanent URL that survives page refresh.
 */
export async function uploadMediaItem(
  source: File | Blob | string,
  options: UploadMediaOptions = {}
): Promise<UploadResult> {
  if (options.signal?.aborted) {
    throw new DOMException('The upload operation was aborted.', 'AbortError');
  }

  const isDataUrl = typeof source === 'string' && source.startsWith('data:');
  let blob: Blob;
  let mimeType: string;
  let rawFileName = options.fileName || '';

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
        const res = await fetch(source, { signal: options.signal });
        blob = await res.blob();
        mimeType = blob.type || (options.type === 'video' ? 'video/mp4' : 'image/jpeg');
        if (!rawFileName) {
          const ext = (mimeType.split('/')[1] || '').split(';')[0] || (options.type === 'video' ? 'mp4' : 'jpg');
          rawFileName = `upload_${Date.now()}.${ext}`;
        }
      } catch (blobErr: any) {
        if (blobErr?.name === 'AbortError' || options.signal?.aborted) {
          throw blobErr;
        }
        console.warn('[StorageService] Error fetching blob URL:', blobErr);
        throw new Error('Failed to read media source for upload. The temporary media may have expired or been revoked.');
      }
    } else {
      // It's already an HTTP URL or relative path
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
    mimeType = source.type;
    rawFileName = source.name;
  } else {
    blob = source;
    mimeType = blob.type || (options.type === 'video' ? 'video/mp4' : 'image/jpeg');
    if (!rawFileName) {
      const ext = mimeType.split('/')[1] || (options.type === 'video' ? 'mp4' : 'jpg');
      rawFileName = `upload_${Date.now()}.${ext}`;
    }
  }

  const determinedType: 'image' | 'video' =
    options.type || (mimeType.startsWith('video') ? 'video' : 'image');
  const sanitizedFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePath = `${options.userId || 'community'}/${Date.now()}_${sanitizedFileName}`;

  // 1. Attempt Supabase Storage Upload if configured
  if (options.signal?.aborted) {
    throw new DOMException('The upload operation was aborted.', 'AbortError');
  }

  if (isSupabaseConfigured()) {
    try {
      const bucketName = 'posts';
      let uploadResult: any;

      if (options.signal) {
        if (options.signal.aborted) {
          throw new DOMException('The upload operation was aborted.', 'AbortError');
        }
        let abortHandler: () => void;
        const abortPromise = new Promise<never>((_, reject) => {
          abortHandler = () => {
            reject(new DOMException('The upload operation was aborted.', 'AbortError'));
          };
          options.signal!.addEventListener('abort', abortHandler, { once: true });
        });

        try {
          uploadResult = await Promise.race([
            (supabase as any).storage.from(bucketName).upload(uniquePath, blob, {
              contentType: mimeType,
              upsert: true,
              cacheControl: '3600',
            }),
            abortPromise,
          ]);
        } finally {
          if (options.signal && abortHandler!) {
            options.signal.removeEventListener('abort', abortHandler);
          }
        }
      } else {
        uploadResult = await (supabase as any).storage.from(bucketName).upload(uniquePath, blob, {
          contentType: mimeType,
          upsert: true,
          cacheControl: '3600',
        });
      }

      if (options.signal?.aborted) {
        throw new DOMException('The upload operation was aborted.', 'AbortError');
      }

      const { data, error } = uploadResult || {};

      if (!error && data?.path) {
        const { data: publicUrlData } = (supabase as any).storage
          .from(bucketName)
          .getPublicUrl(data.path);

        if (publicUrlData?.publicUrl) {
          return {
            url: publicUrlData.publicUrl,
            storageType: 'supabase',
            fileName: sanitizedFileName,
            sizeBytes: blob.size,
            mimeType,
          };
        }
      } else {
        console.warn('[StorageService] Supabase upload error:', error?.message);
      }
    } catch (sbErr: any) {
      if (sbErr?.name === 'AbortError' || options.signal?.aborted) {
        throw sbErr;
      }
      console.warn('[StorageService] Supabase upload exception, falling back to server:', sbErr);
    }
  }

  if (options.signal?.aborted) {
    throw new DOMException('The upload operation was aborted.', 'AbortError');
  }

  // 2. Fallback to Server Storage via /api/storage/upload
  try {
    const base64Data = isDataUrl
      ? (source as string)
      : await new Promise<string>((resolve, reject) => {
          if (options.signal?.aborted) {
            return reject(new DOMException('The upload operation was aborted.', 'AbortError'));
          }
          const reader = new FileReader();
          const abortHandler = () => {
            reader.abort();
            reject(new DOMException('The upload operation was aborted.', 'AbortError'));
          };
          if (options.signal) {
            options.signal.addEventListener('abort', abortHandler, { once: true });
          }
          reader.onload = () => {
            if (options.signal) options.signal.removeEventListener('abort', abortHandler);
            resolve(reader.result as string);
          };
          reader.onerror = () => {
            if (options.signal) options.signal.removeEventListener('abort', abortHandler);
            reject(reader.error || new Error('FileReader error reading media'));
          };
          reader.onabort = () => {
            if (options.signal) options.signal.removeEventListener('abort', abortHandler);
            reject(new DOMException('The upload operation was aborted.', 'AbortError'));
          };
          reader.readAsDataURL(blob);
        });

    if (options.signal?.aborted) {
      throw new DOMException('The upload operation was aborted.', 'AbortError');
    }

    const token = await getClientAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers,
      signal: options.signal,
      body: JSON.stringify({
        fileBase64: base64Data,
        fileName: sanitizedFileName,
        mimeType,
        type: determinedType,
      }),
    });

    if (options.signal?.aborted) {
      throw new DOMException('The upload operation was aborted.', 'AbortError');
    }

    if (response.ok) {
      const result = await response.json();
      if (result?.url) {
        return {
          url: result.url,
          storageType: 'server',
          fileName: sanitizedFileName,
          sizeBytes: blob.size,
          mimeType,
        };
      }
    } else {
      const errJson = await response.json().catch(() => ({}));
      console.warn('[StorageService] Server upload failed:', response.status, errJson?.error);
    }
  } catch (srvErr: any) {
    if (srvErr?.name === 'AbortError' || options.signal?.aborted) {
      throw srvErr;
    }
    console.warn('[StorageService] Server upload exception:', srvErr);
  }

  // Both Supabase Storage and Server disk uploads have failed.
  // NEVER return an ephemeral "blob:" or "data:" URL as a permanent post URL.
  // Throw an explicit error to halt post publishing and preserve the user's composer state.
  throw new Error('Upload failed: Unable to persist media to cloud or server storage. Please check your connection and authentication status.');
}
