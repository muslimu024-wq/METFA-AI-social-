import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '../types/community';

// Retrieve Supabase credentials safely from client environment variables
const env = typeof import.meta !== 'undefined' ? ((import.meta as any).env || {}) : {};

function validateSupabaseConfig(): { url: string; key: string } | null {
  try {
    const rawUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
    const rawKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';

    if (!rawUrl || !rawKey || rawKey.length < 10) {
      return null;
    }

    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsed = new URL(normalizedUrl);
    if (!parsed.protocol.startsWith('http') || !parsed.hostname || parsed.hostname.length < 3) {
      return null;
    }

    return { url: normalizedUrl, key: rawKey };
  } catch {
    return null;
  }
}

const activeConfig = validateSupabaseConfig();

export const isSupabaseConfigured = (): boolean => {
  return activeConfig !== null;
};

// Safe dummy fallback client to avoid unhandled crashes when Supabase is not configured
const createFallbackClient = (): SupabaseClient => {
  const dummyAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOAuth: async () => ({ data: { url: null }, error: { message: 'Supabase not configured' } }),
    signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
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
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
    };
    return queryObj;
  };

  return {
    auth: dummyAuth as any,
    from: () => createDummyQuery() as any,
  } as unknown as SupabaseClient;
};

// Singleton Supabase Client with persistent session handling
let clientInstance: SupabaseClient;

if (activeConfig) {
  try {
    clientInstance = createClient(activeConfig.url, activeConfig.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
  } catch (e) {
    console.warn('[Supabase] Initialization failed, using fallback client:', e);
    clientInstance = createFallbackClient();
  }
} else {
  clientInstance = createFallbackClient();
}

export const supabase: SupabaseClient = clientInstance;

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

/**
 * Converts a Supabase database profile row to the app's UserProfile type
 */
export function mapSupabaseRowToUserProfile(row: Partial<SupabaseProfileRow>): UserProfile {
  const defaultAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
  ];
  const seed = (row.username || row.display_name || 'creator').toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const cleanFallback = defaultAvatars[Math.abs(hash) % defaultAvatars.length];
  const rawAvatar = row.avatar_url?.trim();
  const safeAvatar =
    rawAvatar &&
    !rawAvatar.includes('dicebear.com') &&
    !rawAvatar.includes('api.dicebear') &&
    !rawAvatar.toLowerCase().includes('bottts')
      ? rawAvatar
      : cleanFallback;

  return {
    id: row.id || 'user_default',
    name: row.display_name || row.username || 'Metfa Creator',
    username: row.username || 'creator',
    avatar: safeAvatar,
    bio: row.bio || 'AI Creator & Visual Explorer on Metfa Social.',
    location: row.location || 'Global Creator',
    website: row.website || `https://metfa.ai/@${row.username || 'creator'}`,
    isVerified: row.is_verified ?? true,
    joinDate: row.created_at
      ? `Joined ${new Date(row.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : 'Joined Recently',
    stats: row.stats || {
      postsCount: 0,
      followersCount: 142,
      followingCount: 68,
      totalLikes: 1240,
      reelsCount: 0,
    },
  };
}
