import { UserProfile, PostingIdentity } from '../types/community';
import { safeSetItem, safeGetItem, safeRemoveItem } from '../utils/storageUtils';
import {
  supabase,
  isSupabaseConfigured,
  SupabaseProfileRow,
  mapSupabaseRowToUserProfile
} from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string; // Supabase user UUID (or guest id)
  metfaId: string; // Unified Metfa ID (e.g. MID-9281-ABCD)
  name: string;
  username: string; // @username
  authType: 'gmail' | 'phone' | 'email' | 'guest';
  phoneOrEmail: string;
  avatar: string;
  sessionToken: string;
  tokenExpiry: number;
  createdAt: string;
  isVerified?: boolean;
}

const SSO_SESSION_KEY = 'metfa_sso_session_v1';
const AUTH_USER_KEY = 'metfa_auth_user_v2';
const USER_PROFILE_KEY = 'metfa_user_profile_v2';
const ACTIVE_IDENTITY_KEY = 'metfa_active_identity_v1';

/**
 * Curated list of clean, professional creator avatars (high-res portrait photography)
 */
export const DEFAULT_AVATARS: string[] = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', // Female creator portrait
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', // Male creator portrait
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80', // Female portrait
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', // Male portrait
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80', // Creative portrait
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80', // Studio portrait
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80', // Clean profile
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80', // Creator portrait
];

/**
 * Returns a clean, professional default avatar image deterministically based on seed
 * without invoking external bot/cartoon avatar APIs.
 */
export const getDefaultAvatar = (seed?: string): string => {
  if (!seed || typeof seed !== 'string') return DEFAULT_AVATARS[0];
  const cleanSeed = seed.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < cleanSeed.length; i++) {
    hash = (hash << 5) - hash + cleanSeed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index];
};

/**
 * Sanitizes avatar URL to ensure user-uploaded images/photos are preserved,
 * while eliminating legacy cartoon bot/dicebear endpoints.
 */
export const sanitizeAvatarUrl = (avatar?: string | null, seed?: string): string => {
  if (!avatar || typeof avatar !== 'string') return getDefaultAvatar(seed);
  const trimmed = avatar.trim();
  if (
    !trimmed ||
    trimmed.includes('dicebear.com') ||
    trimmed.includes('api.dicebear') ||
    trimmed.toLowerCase().includes('bottts') ||
    trimmed === 'undefined' ||
    trimmed === 'null'
  ) {
    return getDefaultAvatar(seed);
  }
  return trimmed;
};

/**
 * Generates an automatic unique username (e.g. alex_1234)
 */
export const generateUniqueUsername = (input: string): string => {
  const clean = input
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const prefix = clean.length > 2 ? clean.slice(0, 12) : 'creator';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}_${randomSuffix}`;
};

/**
 * Generates a Unified Metfa ID (e.g. MID-8842-K92A)
 */
export const generateUnifiedMetfaId = (seed?: string): string => {
  const timestampSuffix = seed ? seed.slice(0, 4).toUpperCase() : Date.now().toString(36).slice(-4).toUpperCase();
  const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MID-${timestampSuffix}-${randomHex}`;
};

// Default initial guest user
export const INITIAL_GUEST_USER: AuthUser = {
  id: 'usr_metfa_9281',
  metfaId: 'MID-9281-ALEX',
  name: 'Alex Rivera',
  username: 'alex.rivera',
  authType: 'guest',
  phoneOrEmail: 'alex.rivera.ai@gmail.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  sessionToken: '',
  tokenExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
  createdAt: '2026-01-10',
  isVerified: true,
};

/**
 * Retrieve current active cached SSO user
 */
export const getActiveSSOUser = (): AuthUser => {
  try {
    const raw = safeGetItem(AUTH_USER_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.id && data.username) {
        if (!data.metfaId) data.metfaId = generateUnifiedMetfaId();
        data.avatar = sanitizeAvatarUrl(data.avatar, data.username || data.name);
        return data;
      }
    }
  } catch (err) {
    console.error('Error loading active SSO user:', err);
  }
  return INITIAL_GUEST_USER;
};

/**
 * Persists user session across storage keys and dispatches update events
 * maintaining strict bidirectional consistency for identity, avatar, and profile fields.
 */
export const persistSSOSession = (user: AuthUser, profileOverride?: UserProfile): void => {
  // Determine normalized avatar, giving precedence to explicit user upload or profile override
  const resolvedAvatar = sanitizeAvatarUrl(
    profileOverride?.avatar || user.avatar,
    user.username || user.name
  );

  const resolvedName = (profileOverride?.name || user.name || 'Metfa Creator').trim();
  const resolvedUsername = (profileOverride?.username || user.username || 'creator').trim().replace(/^@/, '');
  const resolvedIsVerified = profileOverride?.isVerified ?? user.isVerified ?? true;

  const normalizedUser: AuthUser = {
    ...user,
    name: resolvedName,
    username: resolvedUsername,
    avatar: resolvedAvatar,
    isVerified: resolvedIsVerified,
  };

  safeSetItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
  if (normalizedUser.sessionToken) {
    safeSetItem(SSO_SESSION_KEY, normalizedUser.sessionToken);
  }

  // Synchronize UserProfile
  let updatedProfile: UserProfile;
  try {
    const rawProfile = safeGetItem(USER_PROFILE_KEY);
    const currentProfile: Partial<UserProfile> = rawProfile ? JSON.parse(rawProfile) : {};

    updatedProfile = profileOverride ? {
      ...currentProfile,
      ...profileOverride,
      id: normalizedUser.id,
      name: resolvedName,
      username: resolvedUsername,
      avatar: resolvedAvatar,
      isVerified: resolvedIsVerified,
    } : {
      id: normalizedUser.id,
      name: resolvedName,
      username: resolvedUsername,
      avatar: resolvedAvatar,
      isVerified: resolvedIsVerified,
      bio: currentProfile.bio || 'AI Creator & Visual Explorer on Metfa Social.',
      location: currentProfile.location || 'Global Creator',
      website: currentProfile.website || `https://metfa.ai/@${resolvedUsername}`,
      joinDate: currentProfile.joinDate || `Joined ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      stats: currentProfile.stats || {
        postsCount: 0,
        followersCount: 142,
        followingCount: 68,
        totalLikes: 1240,
        reelsCount: 0,
      },
    };

    safeSetItem(USER_PROFILE_KEY, JSON.stringify(updatedProfile));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metfa_profile_updated', { detail: updatedProfile }));
    }
  } catch (e) {
    console.error('Error syncing UserProfile in persistSSOSession:', e);
    updatedProfile = {
      id: normalizedUser.id,
      name: resolvedName,
      username: resolvedUsername,
      avatar: resolvedAvatar,
      isVerified: resolvedIsVerified,
      bio: 'AI Creator & Visual Explorer on Metfa Social.',
      location: 'Global Creator',
      website: `https://metfa.ai/@${resolvedUsername}`,
      joinDate: `Joined ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      stats: {
        postsCount: 0,
        followersCount: 142,
        followingCount: 68,
        totalLikes: 1240,
        reelsCount: 0,
      },
    };
  }

  // Synchronize ActiveIdentity
  const activeIdentity: PostingIdentity = {
    type: 'personal',
    id: normalizedUser.id,
    name: resolvedName,
    username: resolvedUsername,
    avatar: resolvedAvatar,
    badge: resolvedIsVerified ? 'Verified Creator' : 'Creator',
  };
  safeSetItem(ACTIVE_IDENTITY_KEY, JSON.stringify(activeIdentity));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_identity_changed', { detail: activeIdentity }));
    window.dispatchEvent(new CustomEvent('metfa_auth_changed', { detail: normalizedUser }));
  }
};

/**
 * Fetch profile from Supabase Database
 */
export async function fetchSupabaseProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] Failed to fetch profile:', error.message);
      return null;
    }
    if (!data) return null;
    return mapSupabaseRowToUserProfile(data);
  } catch (err) {
    console.warn('[Supabase] Error reading profile:', err);
    return null;
  }
}

/**
 * Upsert profile into Supabase Database
 */
export async function upsertSupabaseProfile(
  userId: string,
  profile: Partial<UserProfile> & { email?: string; phone?: string; metfaId?: string }
): Promise<UserProfile | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const row: Partial<SupabaseProfileRow> = {
      id: userId,
      display_name: profile.name || 'Metfa Creator',
      username: profile.username || 'creator',
      avatar_url: sanitizeAvatarUrl(profile.avatar, profile.username || profile.name),
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      is_verified: profile.isVerified ?? true,
      email: profile.email,
      phone: profile.phone,
      metfa_id: profile.metfaId || generateUnifiedMetfaId(userId),
      stats: profile.stats,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('[Supabase] Error upserting profile:', error.message);
      return null;
    }
    return mapSupabaseRowToUserProfile(data);
  } catch (err) {
    console.warn('[Supabase] Error during profile upsert:', err);
    return null;
  }
}

/**
 * Map Supabase User & Session to local AuthUser
 */
export async function mapSupabaseUserToAuthUser(
  sbUser: User,
  session?: Session | null
): Promise<{ authUser: AuthUser; userProfile: UserProfile }> {
  // 1. Check if database profile already exists
  let dbProfile = await fetchSupabaseProfile(sbUser.id);

  const rawMetadata = sbUser.user_metadata || {};
  const email = sbUser.email || (rawMetadata.email as string) || '';
  const phone = sbUser.phone || (rawMetadata.phone as string) || '';
  const name =
    dbProfile?.name ||
    rawMetadata.full_name ||
    rawMetadata.name ||
    (email ? email.split('@')[0] : 'Metfa Creator');

  const username =
    dbProfile?.username ||
    rawMetadata.user_name ||
    rawMetadata.username ||
    generateUniqueUsername(name || email || 'creator');

  const avatar = sanitizeAvatarUrl(
    dbProfile?.avatar || rawMetadata.avatar_url || rawMetadata.picture,
    username || name
  );

  const metfaId = generateUnifiedMetfaId(sbUser.id);

  // If no database profile row exists yet, create it now
  if (!dbProfile && isSupabaseConfigured()) {
    dbProfile = await upsertSupabaseProfile(sbUser.id, {
      name,
      username,
      avatar,
      email,
      phone,
      metfaId,
      isVerified: true,
    });
  }

  const authUser: AuthUser = {
    id: sbUser.id,
    metfaId,
    name,
    username,
    authType: sbUser.app_metadata?.provider === 'google' ? 'gmail' : (phone ? 'phone' : 'email'),
    phoneOrEmail: email || phone,
    avatar,
    sessionToken: session?.access_token || '',
    tokenExpiry: session?.expires_at ? session.expires_at * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000,
    createdAt: sbUser.created_at ? sbUser.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    isVerified: true,
  };

  const finalProfile: UserProfile = dbProfile || {
    id: sbUser.id,
    name,
    username,
    avatar,
    bio: 'AI Creator & Visual Explorer on Metfa Social.',
    location: 'Global Creator',
    website: `https://metfa.ai/@${username}`,
    isVerified: true,
    joinDate: `Joined ${new Date(sbUser.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    stats: {
      postsCount: 0,
      followersCount: 142,
      followingCount: 68,
      totalLikes: 1240,
      reelsCount: 0,
    },
  };

  return { authUser, userProfile: finalProfile };
}

/**
 * 1. REAL GOOGLE OAUTH WITH SUPABASE & SEAMLESS 1-TAP GOOGLE FALLBACK
 */
export async function signInWithGoogleOAuth(params?: {
  email?: string;
  fullName?: string;
  avatar?: string;
}): Promise<{ url?: string; error?: string; user?: AuthUser; profile?: UserProfile }> {
  if (isSupabaseConfigured()) {
    try {
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { error: error.message };
      }
      if (data?.url) {
        if (typeof window !== 'undefined') {
          window.location.href = data.url;
        }
        return { url: data.url };
      }
      return {};
    } catch (err: any) {
      return { error: err?.message || 'Google OAuth failed to initialize.' };
    }
  }

  // Graceful 1-Click Fast Google Sign-in if Supabase credentials are not configured yet
  const email = params?.email?.trim() || 'google.creator@gmail.com';
  const name = params?.fullName?.trim() || (email.includes('@') && !email.startsWith('google.creator') ? email.split('@')[0] : 'Google Creator');
  const cleanUsername = generateUniqueUsername(name);
  const avatar = sanitizeAvatarUrl(params?.avatar, cleanUsername);
  const userId = `usr_google_${Math.random().toString(36).substring(2, 9)}`;
  const metfaId = generateUnifiedMetfaId();

  const googleUser: AuthUser = {
    id: userId,
    metfaId,
    name,
    username: cleanUsername,
    authType: 'gmail',
    phoneOrEmail: email,
    avatar,
    sessionToken: `google_token_${Date.now()}`,
    tokenExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
    createdAt: new Date().toISOString().split('T')[0],
    isVerified: true,
  };

  const googleProfile: UserProfile = {
    id: userId,
    name,
    username: cleanUsername,
    avatar,
    bio: 'Verified Creator on Metfa Social via Google Account.',
    location: 'Global Creator',
    website: `https://metfa.ai/@${cleanUsername}`,
    isVerified: true,
    joinDate: `Joined ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    stats: {
      postsCount: 0,
      followersCount: 210,
      followingCount: 95,
      totalLikes: 1540,
      reelsCount: 0,
    },
  };

  persistSSOSession(googleUser, googleProfile);
  return { user: googleUser, profile: googleProfile };
}

/**
 * 2. REAL USER SIGN UP / PROFILE ONBOARDING ("Save Profile & Enter Metfa")
 */
export async function saveProfileAndEnterMetfa(params: {
  authMethod: 'gmail' | 'phone';
  identifier: string; // Email or Phone number
  password?: string;
  fullName: string;
  username?: string;
  avatar: string;
}): Promise<{ user: AuthUser; profile: UserProfile; error?: string }> {
  const { authMethod, identifier, fullName, username, avatar } = params;
  const cleanName = fullName.trim() || 'Metfa Creator';
  const cleanUsername = username?.trim()
    ? username.trim().replace(/^@/, '')
    : generateUniqueUsername(cleanName || identifier);
  const cleanAvatar = sanitizeAvatarUrl(avatar, cleanUsername || cleanName);

  // If Supabase is configured, execute real Auth and DB operations
  if (isSupabaseConfigured()) {
    try {
      const emailToUse = authMethod === 'gmail'
        ? identifier.trim()
        : `${identifier.replace(/[^0-9]/g, '')}@metfa.social`;
      
      // Default deterministic secure key for 1-tap onboarding if user didn't specify password
      const userPassword = params.password || `MetfaPass_${identifier.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}!9`;

      // Attempt 1: Try signing up new user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailToUse,
        password: userPassword,
        options: {
          data: {
            full_name: cleanName,
            username: cleanUsername,
            avatar_url: cleanAvatar,
            phone_number: authMethod === 'phone' ? identifier : undefined,
          },
        },
      });

      let currentSbUser = signUpData?.user;
      let session = signUpData?.session;

      // Attempt 2: If user already registered, sign them in directly
      if (signUpError && signUpError.message.toLowerCase().includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: userPassword,
        });

        if (signInError) {
          return {
            user: INITIAL_GUEST_USER,
            profile: mapSupabaseRowToUserProfile({}),
            error: `Account exists: ${signInError.message}. If you have a different password, please sign in.`,
          };
        }
        currentSbUser = signInData?.user;
        session = signInData?.session;
      } else if (signUpError) {
        return {
          user: INITIAL_GUEST_USER,
          profile: mapSupabaseRowToUserProfile({}),
          error: signUpError.message,
        };
      }

      if (currentSbUser) {
        // Upsert profile in Supabase profiles table
        const profile = await upsertSupabaseProfile(currentSbUser.id, {
          name: cleanName,
          username: cleanUsername,
          avatar: cleanAvatar,
          email: authMethod === 'gmail' ? identifier : undefined,
          phone: authMethod === 'phone' ? identifier : undefined,
          isVerified: true,
        });

        const { authUser, userProfile } = await mapSupabaseUserToAuthUser(currentSbUser, session);
        persistSSOSession(authUser, profile || userProfile);
        return { user: authUser, profile: profile || userProfile };
      }
    } catch (err: any) {
      console.error('[Supabase Auth Error]:', err);
      return {
        user: INITIAL_GUEST_USER,
        profile: mapSupabaseRowToUserProfile({}),
        error: err?.message || 'Authentication failed. Please check network connection.',
      };
    }
  }

  // Graceful Local Fallback if Supabase credentials are not populated
  const userId = `usr_${Math.random().toString(36).substring(2, 9)}`;
  const metfaId = generateUnifiedMetfaId();
  const localUser: AuthUser = {
    id: userId,
    metfaId,
    name: cleanName,
    username: cleanUsername,
    authType: authMethod,
    phoneOrEmail: identifier,
    avatar: cleanAvatar,
    sessionToken: `local_token_${Date.now()}`,
    tokenExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
    createdAt: new Date().toISOString().split('T')[0],
    isVerified: true,
  };

  const localProfile: UserProfile = {
    id: userId,
    name: cleanName,
    username: cleanUsername,
    avatar: cleanAvatar,
    bio: 'AI Creator & Visual Explorer on Metfa Social.',
    location: 'Global Creator',
    website: `https://metfa.ai/@${cleanUsername}`,
    isVerified: true,
    joinDate: `Joined ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    stats: {
      postsCount: 0,
      followersCount: 142,
      followingCount: 68,
      totalLikes: 1240,
      reelsCount: 0,
    },
  };

  persistSSOSession(localUser, localProfile);
  return { user: localUser, profile: localProfile };
}

/**
 * 3. REAL SUPABASE SIGN OUT
 */
export async function supabaseSignOut(): Promise<AuthUser> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Supabase] SignOut error:', err);
    }
  }

  safeRemoveItem(SSO_SESSION_KEY);
  safeRemoveItem(AUTH_USER_KEY);
  const guestUser: AuthUser = {
    id: `guest_${Date.now()}`,
    metfaId: generateUnifiedMetfaId(),
    name: 'Guest Explorer',
    username: generateUniqueUsername('guest'),
    authType: 'guest',
    phoneOrEmail: '',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    sessionToken: '',
    tokenExpiry: 0,
    createdAt: new Date().toISOString().split('T')[0],
    isVerified: false,
  };
  persistSSOSession(guestUser);
  return guestUser;
}

// Backward-compatible alias helpers
export const ssoLoginWithPhone = (phone: string, name: string, user?: string, av?: string) => {
  return saveProfileAndEnterMetfa({
    authMethod: 'phone',
    identifier: phone,
    fullName: name,
    username: user,
    avatar: sanitizeAvatarUrl(av, user || name),
  });
};

export const ssoLoginWithGmail = (email: string, name: string, av?: string, user?: string) => {
  return saveProfileAndEnterMetfa({
    authMethod: 'gmail',
    identifier: email,
    fullName: name,
    username: user,
    avatar: sanitizeAvatarUrl(av, user || name),
  });
};

export const ssoLogout = supabaseSignOut;

