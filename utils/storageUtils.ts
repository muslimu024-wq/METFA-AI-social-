/**
 * Metfa Safe Storage & Quota Management Engine
 * Provides resilient, quota-aware storage wrappers with automatic pruning,
 * in-memory fallback, and lightweight image compression to prevent QuotaExceededError.
 */

const MEMORY_STORAGE: Record<string, string> = {};

/**
 * Compresses a base64 or blob data URL to a lightweight JPEG/WebP format
 * using HTML Canvas to reduce storage footprint by 90-95%.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.7
): Promise<string> {
  if (!dataUrl || typeof window === 'undefined') return dataUrl;

  // If it's already an external HTTP/HTTPS URL, no need to compress
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }

  // If it's not a base64 image data URL (e.g., video or audio), return as is
  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  // If the dataUrl is already small (< 60KB), keep it
  if (dataUrl.length < 60000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Clears non-critical caches and trims oversized keys when localStorage is near capacity.
 */
export function pruneStorageToFreeQuota(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // 1. Remove obsolete or disposable legacy keys
    const nonCriticalKeys = [
      'metfa_chat_messages_v1',
      'metfa_chat_messages_v2',
      'metfa_chat_sessions_v1',
      'metfa_chat_sessions_v2',
      'metfa_stored_media_v1',
      'metfa_community_posts_v1',
      'metfa_reels_temp',
    ];

    nonCriticalKeys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    // 2. Prune old chat messages if they are too large
    try {
      const chatRaw = localStorage.getItem('metfa_chat_messages_v3');
      if (chatRaw && chatRaw.length > 500000) {
        const parsed = JSON.parse(chatRaw);
        if (Array.isArray(parsed) && parsed.length > 10) {
          // Keep only last 10 messages with attachments stripped on older messages
          const pruned = parsed.slice(-10).map((msg, idx, arr) => {
            if (idx < arr.length - 2 && msg.attachments) {
              return { ...msg, attachments: [] };
            }
            return msg;
          });
          localStorage.setItem('metfa_chat_messages_v3', JSON.stringify(pruned));
        }
      }
    } catch {}

    // 3. Prune old community posts if they contain oversized base64 images
    try {
      const postsRaw = localStorage.getItem('metfa_community_posts_v2');
      if (postsRaw && postsRaw.length > 800000) {
        const posts = JSON.parse(postsRaw);
        if (Array.isArray(posts)) {
          const trimmed = posts.slice(0, 15).map((p, idx) => {
            // Keep image on top 5 posts, replace large base64 on older ones with fallback image
            if (idx >= 5 && p.imageSrc && p.imageSrc.startsWith('data:')) {
              return {
                ...p,
                imageSrc: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
                originalImageSrc: undefined,
                imageGallery: undefined,
              };
            }
            return p;
          });
          localStorage.setItem('metfa_community_posts_v2', JSON.stringify(trimmed));
        }
      }
    } catch {}
  } catch (err) {
    console.warn('Could not prune localStorage:', err);
  }
}

/**
 * Resilient localStorage.setItem with automatic QuotaExceeded recovery and in-memory fallback.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') {
    MEMORY_STORAGE[key] = value;
    return true;
  }

  try {
    localStorage.setItem(key, value);
    MEMORY_STORAGE[key] = value;
    return true;
  } catch (error: any) {
    const isQuotaError =
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22 ||
      error?.code === 1014;

    if (isQuotaError) {
      console.warn(`[SafeStorage] QuotaExceeded for key "${key}". Running pruning routine...`);
      pruneStorageToFreeQuota();

      // Retry once after pruning
      try {
        localStorage.setItem(key, value);
        MEMORY_STORAGE[key] = value;
        return true;
      } catch (retryError) {
        console.warn(`[SafeStorage] Retry failed for key "${key}". Storing in memory fallback.`, retryError);
      }
    } else {
      console.error(`[SafeStorage] Error setting key "${key}":`, error);
    }

    // Always keep memory storage synchronized so current session never breaks
    MEMORY_STORAGE[key] = value;
    return false;
  }
}

/**
 * Resilient localStorage.getItem with memory fallback.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return MEMORY_STORAGE[key] || null;
  }

  try {
    const item = localStorage.getItem(key);
    if (item !== null) {
      MEMORY_STORAGE[key] = item;
      return item;
    }
  } catch (err) {
    console.warn(`[SafeStorage] Error reading key "${key}":`, err);
  }

  return MEMORY_STORAGE[key] || null;
}

/**
 * Resilient localStorage.removeItem with memory cleanup.
 */
export function safeRemoveItem(key: string): void {
  delete MEMORY_STORAGE[key];
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}
