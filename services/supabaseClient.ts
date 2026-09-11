import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '../types/community';

// Retrieve Supabase credentials safely from client environment variables or runtime configuration
export function validateSupabaseConfig(): { url: string; key: string } | null {
  try {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const metaEnv = typeof import.meta !== 'undefined' ? ((import.meta as any).env || {}) : {};
    const procEnv = typeof process !== 'undefined' ? ((process as any).env || {}) : {};

    const rawUrl =
      (metaEnv && metaEnv.VITE_SUPABASE_URL) ||
      (win && win.__ENV__ && win.__ENV__.VITE_SUPABASE_URL) ||
      (win && win.__ENV__ && win.__ENV__.SUPABASE_URL) ||
      (win && win.VITE_SUPABASE_URL) ||
      (win && win.SUPABASE_URL) ||
      (procEnv && (procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL)) ||
      '';

    const rawKey =
      (metaEnv && metaEnv.VITE_SUPABASE_ANON_KEY) ||
      (win && win.__ENV__ && win.__ENV__.VITE_SUPABASE_ANON_KEY) ||
      (win && win.__ENV__ && win.__ENV__.SUPABASE_ANON_KEY) ||
      (win && win.VITE_SUPABASE_ANON_KEY) ||
      (win && win.SUPABASE_ANON_KEY) ||
      (procEnv && (procEnv.VITE_SUPABASE_ANON_KEY || procEnv.SUPABASE_ANON_KEY)) ||
      '';

    const cleanUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    const cleanKey = typeof rawKey === 'string' ? rawKey.trim() : '';

    if (!cleanUrl || !cleanKey || cleanKey.length < 10) {
      return null;
    }

    let normalizedUrl = cleanUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsed = new URL(normalizedUrl);
    if (!parsed.protocol.startsWith('http') || !parsed.hostname || parsed.hostname.length < 3) {
      return null;
    }

    return { url: normalizedUrl, key: cleanKey };
  } catch {
    return null;
  }
}

export const isSupabaseConfigured = (): boolean => {
  return validateSupabaseConfig() !== null;
};

// Safe dummy fallback client to avoid unhandled crashes when Supabase is not configured
const createFallbackClient = (): SupabaseClient => {
  const dummyAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOAuth: async () => ({ data: { url: null }, error: { message: 'Supabase authentication is not configured.' } }),
    signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase authentication is not configured.' } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase authentication is not configured.' } }),
    signOut: async () => ({ error: null }),
  };

  const createDummyQuery = () => {
    const queryObj: any = {
      select: () => queryObj,
      insert: () => queryObj,
      update: () => queryObj,
      delete: () => queryObj,
      upsert: () => queryObj,
      eq: () => queryObj,
      neq: () => queryObj,
      order: () => queryObj,
      limit: () => queryObj,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
    };
    return queryObj;
  };

  const dummyStorage = {
    from: () => ({
      upload: async () => ({ data: null, error: new Error('Supabase storage not configured') }),
      createSignedUrl: async () => ({ data: null, error: new Error('Supabase storage not configured') }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  };

  return {
    auth: dummyAuth as any,
    from: () => createDummyQuery() as any,
    rpc: async () => ({ data: null, error: new Error('Supabase RPC not configured') }),
    storage: dummyStorage as any,
  } as unknown as SupabaseClient;
};

// Cached client instances
let clientInstance: SupabaseClient | null = null;
let lastUsedConfig: { url: string; key: string } | null = null;
const fallbackClient = createFallbackClient();

export function getActiveSupabaseClient(): SupabaseClient {
  const config = validateSupabaseConfig();
  if (!config) {
    return fallbackClient;
  }

  if (
    clientInstance &&
    lastUsedConfig &&
    lastUsedConfig.url === config.url &&
    lastUsedConfig.key === config.key
  ) {
    return clientInstance;
  }

  try {
    clientInstance = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
    lastUsedConfig = config;
    return clientInstance;
  } catch (e) {
    console.warn('[Supabase] Initialization failed, using fallback client:', e);
    return fallbackClient;
  }
}

// Proxied singleton Supabase Client allowing transparent dynamic upgrade
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const active = getActiveSupabaseClient();
    const val = (active as any)[prop];
    if (typeof val === 'function') {
      return val.bind(active);
    }
    return val;
  },
});

export interface SupabaseProfileRow {
  id: string; // auth.users.id
  metfa_id?: string;
  display_name: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string;
  bio?: string;
  location?: string;
  website?: string;
  is_verified?: boolean;
  stats?: {
    postsCount: number;
    followersCount: number;
    followingCount: number;
    totalLikes: number;
    reelsCount: number;
  };
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_NEUTRAL_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";

/**
 * Converts a Supabase database profile row to the app's UserProfile type
 */
export function mapSupabaseRowToUserProfile(row: Partial<SupabaseProfileRow>): UserProfile & { metfaId?: string } {
  const rawAvatar = row.avatar_url?.trim();
  const safeAvatar =
    rawAvatar &&
    !rawAvatar.includes('dicebear.com') &&
    !rawAvatar.includes('api.dicebear') &&
    !rawAvatar.toLowerCase().includes('bottts') &&
    !rawAvatar.includes('images.unsplash.com')
      ? rawAvatar
      : DEFAULT_NEUTRAL_AVATAR;

  return {
    id: row.id || '',
    metfaId: row.metfa_id,
    name: row.display_name || row.username || 'Creator',
    username: row.username || 'creator',
    avatar: safeAvatar,
    bio: row.bio || '',
    location: row.location || '',
    website: row.website || '',
    isVerified: row.is_verified ?? true,
    joinDate: row.created_at
      ? `Joined ${new Date(row.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : 'Joined Recently',
    stats: row.stats || {
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      totalLikes: 0,
      reelsCount: 0,
    },
  };
}
