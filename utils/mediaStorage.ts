/**
 * Metfa Media Storage Engine
 * Persistent media storage using IndexedDB with Base64/LocalStorage fallback.
 * Stores rich metadata (User ID, Image/Video URL, Timestamp, AI Prompt metadata, Aspect Ratio, Filters).
 */

export interface StoredMediaItem {
  id: string;
  userId: string;
  type: 'image' | 'video';
  dataUrl: string; // Base64 or Blob URL
  thumbnailUrl?: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  aspectRatio?: string;
  filterPreset?: string;
  aiMetadata?: {
    isAIGenerated?: boolean;
    prompt?: string;
    modelUsed?: string;
    stylePreset?: string;
    enhancedPrompt?: string;
    captionGenerated?: string;
  };
}

const DB_NAME = 'metfa_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_items';
const LOCAL_STORAGE_KEY = 'metfa_stored_media_v1';

// Open IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save media item to IndexedDB with localStorage fallback
 */
export async function saveMediaItem(item: Omit<StoredMediaItem, 'id' | 'createdAt'>): Promise<StoredMediaItem> {
  const fullItem: StoredMediaItem = {
    ...item,
    id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.put(fullItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed, falling back to LocalStorage:', err);
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const existing: StoredMediaItem[] = raw ? JSON.parse(raw) : [];
      // Keep only latest 20 items in localStorage to avoid quota limits
      const updated = [fullItem, ...existing.slice(0, 19)];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (lsErr) {
      console.error('LocalStorage media write failed:', lsErr);
    }
  }

  // Dispatch event for UI reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_media_saved', { detail: fullItem }));
  }

  return fullItem;
}

/**
 * Get all stored media items for a user
 */
export async function getMediaItems(userId?: string): Promise<StoredMediaItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let items: StoredMediaItem[] = request.result || [];
        if (userId) {
          items = items.filter((i) => i.userId === userId);
        }
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(items);
      };

      request.onerror = () => {
        resolve(getLocalStorageMedia(userId));
      };
    });
  } catch {
    return getLocalStorageMedia(userId);
  }
}

function getLocalStorageMedia(userId?: string): StoredMediaItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      let items: StoredMediaItem[] = JSON.parse(raw);
      if (userId) {
        items = items.filter((i) => i.userId === userId);
      }
      return items;
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Helper to convert File or Blob to Base64
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
