import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types/community';
import {
  normalizeDefaultPostAudience,
  normalizeProfilePrivacy,
} from '../utils/privacyPolicy';

export interface SupabaseProfileRow {
  id: string;
  metfa_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  is_verified?: boolean | null;
  profile_privacy?: string | null;
  default_post_audience?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  stats?: {
    postsCount?: number;
    followersCount?: number;
    followingCount?: number;
    totalLikes?: number;
    reelsCount?: number;
  } | null;
}

export function validateSupabaseConfig(): { url: string; key: string } | null {
  try {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
    const procEnv = typeof process !== 'undefined' ? process.env || {} : {};

    const rawUrl =
      (metaEnv && metaEnv.VITE_SUPABASE_URL) ||
      (win && win.__ENV__ && win.__ENV__.VITE_SUPABASE_URL) ||
      (win && win.__ENV__ && win.__ENV__.SUPABASE_URL) ||
      (win && win.VITE_SUPABASE_URL) ||
      (win && win.SUPABASE_URL) ||
      (procEnv && (procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL)) ||
      '';

    const rawKey =
      (metaEnv && (metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) ||
      (win &&
        win.__ENV__ &&
        (win.__ENV__.VITE_SUPABASE_ANON_KEY ||
          win.__ENV__.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          win.__ENV__.SUPABASE_ANON_KEY)) ||
      (win &&
        (win.VITE_SUPABASE_ANON_KEY ||
          win.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          win.SUPABASE_ANON_KEY)) ||
      (procEnv &&
        (procEnv.VITE_SUPABASE_ANON_KEY ||
          procEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          procEnv.SUPABASE_ANON_KEY)) ||
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

    return { url: parsed.origin, key: cleanKey };
  } catch {
    return null;
  }
}

export const isSupabaseConfigured = (): boolean => {
  return validateSupabaseConfig() !== null;
};

const createFallbackClient = (): any => {
  const dummyAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOAuth: async () => ({
      data: { url: null },
      error: { message: 'Supabase authentication is not configured.' },
    }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: { message: 'Supabase authentication is not configured.' },
    }),
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: { message: 'Supabase authentication is not configured.' },
    }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: null }, error: null }),
    refreshSession: async () => ({ data: { session: null }, error: null }),
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
      in: () => queryObj,
      or: () => queryObj,
      is: () => queryObj,
      order: () => queryObj,
      limit: () => queryObj,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (val: any) => any) => Promise.resolve({ data: null, error: null }).then(resolve),
    };
    return queryObj;
  };

  const dummyStorage = {
    from: () => ({
      upload: async () => ({ data: null, error: new Error('Supabase storage not configured') }),
      createSignedUrl: async () => ({
        data: null,
        error: new Error('Supabase storage not configured'),
      }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  };

  return {
    auth: dummyAuth,
    from: () => createDummyQuery(),
    rpc: async () => ({ data: null, error: new Error('Supabase RPC not configured') }),
    storage: dummyStorage,
  };
};

let clientInstance: SupabaseClient | null = null;
let lastUsedConfig: { url: string; key: string } | null = null;
let initFailed = false;
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

  if (
    lastUsedConfig &&
    lastUsedConfig.url === config.url &&
    lastUsedConfig.key === config.key &&
    initFailed
  ) {
    return fallbackClient;
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
    initFailed = false;
    return clientInstance;
  } catch (e) {
    console.warn('[Supabase] Initialization failed, using fallback client:', e);
    lastUsedConfig = config;
    initFailed = true;
    return fallbackClient;
  }
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: keyof SupabaseClient) {
    const active = getActiveSupabaseClient() as any;
    const val = active[prop];
    if (typeof val === 'function') {
      return val.bind(active);
    }
    return val;
  },
});

const DEFAULT_NEUTRAL_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";

export function mapSupabaseRowToUserProfile(
  row: SupabaseProfileRow & { metfa_id?: string | null },
  fallbackMeta?: Record<string, any> | null
): UserProfile & { metfaId?: string } {
  const rawAvatar = row.avatar_url?.trim();
  const safeAvatar =
    rawAvatar &&
    !rawAvatar.includes('dicebear.com') &&
    !rawAvatar.includes('api.dicebear') &&
    !rawAvatar.toLowerCase().includes('bottts') &&
    !rawAvatar.includes('images.unsplash.com')
      ? rawAvatar
      : DEFAULT_NEUTRAL_AVATAR;

  const statsRaw = row.stats || {};
  return {
    id: row.id || '',
    metfaId: row.metfa_id || undefined,
    name: row.display_name || row.username || 'Creator',
    username: row.username || 'creator',
    avatar: safeAvatar,
    bio: row.bio || '',
    location: row.location || '',
    website: row.website || '',
    isVerified: row.is_verified ?? true,
    joinDate: row.created_at
      ? `Joined ${new Date(row.created_at).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })}`
      : 'Joined Recently',
    profilePrivacy: normalizeProfilePrivacy(
      row.profile_privacy ?? fallbackMeta?.profile_privacy ?? null
    ),
    defaultPostAudience: normalizeDefaultPostAudience(
      row.default_post_audience ?? fallbackMeta?.default_post_audience ?? null
    ),
    stats: {
      postsCount: Number(statsRaw.postsCount ?? 0),
      followersCount: Number(statsRaw.followersCount ?? 0),
      followingCount: Number(statsRaw.followingCount ?? 0),
      totalLikes: Number(statsRaw.totalLikes ?? 0),
      reelsCount: Number(statsRaw.reelsCount ?? 0),
    },
  };
}

let inFlightTokenRefresh: Promise<string | null> | null = null;

function refreshAccessTokenOnce(): Promise<string | null> {
  if (!inFlightTokenRefresh) {
    inFlightTokenRefresh = supabase.auth
      .refreshSession()
      .then(({ data, error }) => (error ? null : data?.session?.access_token || null))
      .catch(() => null)
      .finally(() => {
        inFlightTokenRefresh = null;
      });
  }
  return inFlightTokenRefresh;
}

export async function getClientAuthToken(forceRefresh = false): Promise<string | null> {
  try {
    if (forceRefresh) {
      return await refreshAccessTokenOnce();
    }
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session?.access_token) {
      return null;
    }
    const expiresSoon =
      typeof session.expires_at === 'number' && session.expires_at * 1000 <= Date.now() + 60_000;
    const hasOversizedMetadataJwt = session.access_token.length > 4096;
    if (expiresSoon || hasOversizedMetadataJwt) {
      const refreshed = await refreshAccessTokenOnce();
      if (refreshed) {
        return refreshed;
      }
    }
    return session.access_token;
  } catch {
    return null;
  }
}
