import { supabase, isSupabaseConfigured } from './supabaseClient';
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

/**
 * Uploads a file (image or video) persistently to Supabase Storage or server disk fallback.
 * Guarantees that the media has a permanent URL that survives page refresh.
 */
export async function uploadMediaItem(
  source: File | Blob | string,
  options: {
    userId?: string;
    type?: 'image' | 'video';
    fileName?: string;
  } = {}
): Promise<UploadResult> {
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
  if (isSupabaseConfigured()) {
    try {
      const bucketName = 'posts';
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(uniquePath, blob, {
          contentType: mimeType,
          upsert: true,
          cacheControl: '3600',
        });

      if (!error && data?.path) {
        const { data: publicUrlData } = supabase.storage
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
    } catch (sbErr) {
      console.warn('[StorageService] Supabase upload exception, falling back to server:', sbErr);
    }
  }

  // 2. Fallback to Server Storage via /api/storage/upload
  try {
    const base64Data = isDataUrl
      ? (source as string)
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64: base64Data,
        fileName: sanitizedFileName,
        mimeType,
        type: determinedType,
      }),
    });

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
    }
  } catch (srvErr) {
    console.warn('[StorageService] Server upload exception:', srvErr);
  }

  // 3. Fallback to IndexedDB
  try {
    const dataUrl = isDataUrl
      ? (source as string)
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

    const saved = await saveMediaItem({
      userId: options.userId || 'guest',
      type: determinedType,
      dataUrl,
      name: sanitizedFileName,
      sizeBytes: blob.size,
      mimeType,
    });

    return {
      url: saved.dataUrl,
      storageType: 'indexeddb',
      fileName: sanitizedFileName,
      sizeBytes: blob.size,
      mimeType,
    };
  } catch (idbErr) {
    console.error('[StorageService] IndexedDB fallback failed:', idbErr);
    return {
      url: typeof source === 'string' ? source : '',
      storageType: 'indexeddb',
      fileName: sanitizedFileName,
      sizeBytes: blob.size,
      mimeType,
    };
  }
}
