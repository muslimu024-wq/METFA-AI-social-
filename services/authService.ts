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
  metfaId: string; // Unified Metfa ID (e.g. MID-7482-ABCD)
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

export const GUEST_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";

/**
 * Curated list of clean, neutral default avatars
 */
export const DEFAULT_AVATARS: string[] = [
  GUEST_AVATAR,
];

/**
 * Returns the application's clean neutral default avatar UI
 * without invoking fake people photos or external cartoon bot APIs.
 */
export const getDefaultAvatar = (_seed?: string): string => {
  return GUEST_AVATAR;
};

/**
 * Sanitizes avatar URL to ensure user-uploaded images/photos are preserved,
 * while eliminating legacy dummy fake person photos and cartoon bot endpoints.
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
    trimmed === 'null' ||
    trimmed.includes('images.unsplash.com') // purge legacy fake person demo photos
  ) {
    return getDefaultAvatar(seed);
  }
  return trimmed;
};

/**
 * Generates an automatic unique username (e.g. creator_1234)
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

// Default clean guest user representing an unauthenticated guest state
export const GUEST_USER: AuthUser = {
  id: '',
  metfaId: '',
  name: 'Guest',
  username: 'guest',
  authType: 'guest',
  phoneOrEmail: '',
  avatar: GUEST_AVATAR,
  sessionToken: '',
  tokenExpiry: 0,
  createdAt: '',
  isVerified: false,
};

export const GUEST_PROFILE: UserProfile = {
  id: '',
  name: 'Guest',
  username: 'guest',
  avatar: GUEST_AVATAR,
  bio: '',
  location: '',
  website: '',
  isVerified: false,
  joinDate: '',
  stats: {
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    totalLikes: 0,
    reelsCount: 0,
  },
};

/**
 * Reset authentication and profile cache keys safely without deleting unrelated app data
 */
export const clearStaleAuthCache = (): void => {
  safeRemoveItem(SSO_SESSION_KEY);
  safeRemoveItem(AUTH_USER_KEY);
  safeRemoveItem(USER_PROFILE_KEY);
  safeRemoveItem(ACTIVE_IDENTITY_KEY);
};

/**
 * Retrieve current active cached SSO user.
 * Note: When Supabase is configured, LocalStorage is NEVER the source of truth for authentication.
 * The authoritative identity is determined exclusively by the active Supabase session.
 */
export const getActiveSSOUser = (): AuthUser => {
  if (isSupabaseConfigured()) {
    return GUEST_USER;
  }
  try {
    const raw = safeGetItem(AUTH_USER_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.id && data.username && data.authType !== 'guest') {
        if (!data.metfaId) data.metfaId = generateUnifiedMetfaId();
        data.avatar = sanitizeAvatarUrl(data.avatar, data.username || data.name);
        return data;
      }
    }
  } catch (err) {
    console.error('Error loading active SSO user:', err);
  }
  return GUEST_USER;
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
  if (profileOverride) {
    // When profileOverride is provided: USE profileOverride as the profile source.
    updatedProfile = {
      ...profileOverride,
      id: normalizedUser.id,
      name: resolvedName,
      username: resolvedUsername,
      avatar: resolvedAvatar,
      isVerified: resolvedIsVerified,
    };
  } else {
    // When no profileOverride is provided:
    // Only reuse cached profile if cachedProfile.id === normalizedUser.id
    let cachedProfile: UserProfile | null = null;
    try {
      const rawProfile = safeGetItem(USER_PROFILE_KEY);
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile);
        if (parsed && parsed.id === normalizedUser.id) {
          console.log(`[METFA AUTH] Cached profile ID: ${parsed.id}`);
          cachedProfile = parsed;
        } else if (parsed) {
          console.log(`[METFA AUTH] Cache rejected because IDs differ: cached=${parsed.id}, current=${normalizedUser.id}`);
          safeRemoveItem(USER_PROFILE_KEY);
        }
      }
    } catch {}

    if (cachedProfile) {
      updatedProfile = {
        ...cachedProfile,
        id: normalizedUser.id,
        name: resolvedName,
        username: resolvedUsername,
        avatar: resolvedAvatar,
        isVerified: resolvedIsVerified,
      };
    } else {
      console.log(`[METFA AUTH] Creating new profile: ${normalizedUser.id}`);
      updatedProfile = {
        id: normalizedUser.id,
        name: resolvedName,
        username: resolvedUsername,
        avatar: resolvedAvatar,
        isVerified: resolvedIsVerified,
        bio: '',
        location: '',
        website: '',
        joinDate: `Joined ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        stats: {
          postsCount: 0,
          followersCount: 0,
          followingCount: 0,
          totalLikes: 0,
          reelsCount: 0,
        },
      };
    }
  }

  safeSetItem(USER_PROFILE_KEY, JSON.stringify(updatedProfile));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_profile_updated', { detail: updatedProfile }));
  }

  // Synchronize ActiveIdentity
  const activeIdentity: PostingIdentity = {
    type: 'personal',
    id: normalizedUser.id,
    name: resolvedName,
    username: resolvedUsername,
    avatar: resolvedAvatar,
    badge: resolvedIsVerified ? 'Verified Creator' : (normalizedUser.authType === 'guest' ? 'Guest' : 'Creator'),
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
export async function fetchSupabaseProfile(userId: string): Promise<(UserProfile & { metfaId?: string }) | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  console.log(`[METFA AUTH] Loading profile for: ${userId}`);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[METFA AUTH] Failed to fetch profile:', error.message);
      return null;
    }
    if (!data) return null;
    console.log(`[METFA AUTH] Profile ID: ${data.id}`);
    return mapSupabaseRowToUserProfile(data);
  } catch (err) {
    console.warn('[METFA AUTH] Error reading profile:', err);
    return null;
  }
}

/**
 * Upsert profile into Supabase Database
 */
export async function upsertSupabaseProfile(
  userId: string,
  profile: Partial<UserProfile> & { email?: string; phone?: string; metfaId?: string }
): Promise<(UserProfile & { metfaId?: string }) | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const row: Partial<SupabaseProfileRow> = {
      id: userId,
      display_name: profile.name || 'Creator',
      username: profile.username || 'creator',
      avatar_url: sanitizeAvatarUrl(profile.avatar, profile.username || profile.name),
      bio: profile.bio || '',
      location: profile.location || '',
      website: profile.website || '',
      is_verified: profile.isVerified ?? true,
      email: profile.email,
      phone: profile.phone,
      metfa_id: profile.metfaId || generateUnifiedMetfaId(userId),
      stats: profile.stats || {
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
        totalLikes: 0,
        reelsCount: 0,
      },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('[METFA AUTH] Error upserting profile:', error.message);
      return null;
    }
    console.log(`[METFA AUTH] Profile ID: ${userId}`);
    return mapSupabaseRowToUserProfile(data);
  } catch (err) {
    console.warn('[METFA AUTH] Error during profile upsert:', err);
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
  console.log(`[METFA AUTH] Supabase user ID: ${sbUser.id}`);
  // 1. Check if database profile already exists
  let dbProfile = await fetchSupabaseProfile(sbUser.id);
  if (dbProfile) {
    console.log(`[METFA AUTH] Profile ID: ${dbProfile.id}`);
  }

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

  // FIX: IF dbProfile?.metfa_id exists: use dbProfile.metfa_id
  // ELSE: generate a Metfa ID ONCE, save it into public.profiles.metfa_id, then reuse that same value forever.
  let metfaId: string = dbProfile?.metfaId || (dbProfile as any)?.metfa_id || '';
  let shouldSaveMetfaId = false;

  if (!metfaId) {
    metfaId = generateUnifiedMetfaId(sbUser.id);
    shouldSaveMetfaId = true;
  }

  // If no database profile row exists yet, create it now
  if (!dbProfile && isSupabaseConfigured()) {
    console.log(`[METFA AUTH] Creating new profile: ${sbUser.id}`);
    dbProfile = await upsertSupabaseProfile(sbUser.id, {
      name,
      username,
      avatar,
      email,
      phone,
      metfaId,
      isVerified: true,
      stats: {
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
        totalLikes: 0,
        reelsCount: 0,
      },
    });
  } else if (dbProfile && shouldSaveMetfaId && isSupabaseConfigured()) {
    console.log(`[METFA AUTH] Saving generated Metfa ID to profile: ${metfaId}`);
    await upsertSupabaseProfile(sbUser.id, {
      ...dbProfile,
      metfaId,
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
      followersCount: 0,
      followingCount: 0,
      totalLikes: 0,
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
    console.log('[METFA AUTH] Supabase configured: true');
    console.log('[METFA AUTH] Initiating real Google OAuth via Supabase...');
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
        console.warn('[METFA AUTH] Google OAuth error:', error.message);
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
      console.error('[METFA AUTH] Google OAuth exception:', err);
      return { error: err?.message || 'Google OAuth failed to initialize.' };
    }
  }

  return { error: 'Supabase authentication is not configured.' };
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

  // If Supabase is configured, execute real Auth and DB operations ONLY
  if (isSupabaseConfigured()) {
    console.log('[METFA AUTH] Supabase configured: true');
    try {
      if (authMethod === 'phone') {
        const cleanPhone = identifier.replace(/[^\d+]/g, '');
        const userPassword = params.password || `MetfaPass_${cleanPhone.slice(-6)}!9`;

        // Attempt real Supabase phone sign up
        const { data: phoneSignUpData, error: phoneSignUpError } = await supabase.auth.signUp({
          phone: cleanPhone,
          password: userPassword,
          options: {
            data: {
              full_name: cleanName,
              username: cleanUsername,
              avatar_url: cleanAvatar,
            },
          },
        });

        let currentSbUser = phoneSignUpData?.user;
        let session = phoneSignUpData?.session;

        if (phoneSignUpError && (
          phoneSignUpError.message.toLowerCase().includes('already registered') ||
          phoneSignUpError.message.toLowerCase().includes('already exists')
        )) {
          const { data: phoneSignInData, error: phoneSignInError } = await supabase.auth.signInWithPassword({
            phone: cleanPhone,
            password: userPassword,
          });
          if (phoneSignInError) {
            return {
              user: GUEST_USER,
              profile: GUEST_PROFILE,
              error: `Phone account exists: ${phoneSignInError.message}`,
            };
          }
          currentSbUser = phoneSignInData?.user;
          session = phoneSignInData?.session;
        } else if (phoneSignUpError) {
          return {
            user: GUEST_USER,
            profile: GUEST_PROFILE,
            error: phoneSignUpError.message.includes('provider is disabled') || phoneSignUpError.message.includes('SMS')
              ? 'Phone authentication requires SMS provider setup in Supabase. Please sign in with Email or Google.'
              : phoneSignUpError.message,
          };
        }

        if (currentSbUser && !session) {
          const { data: sessionData } = await supabase.auth.getSession();
          session = sessionData?.session;
          if (!session) {
            return {
              user: GUEST_USER,
              profile: GUEST_PROFILE,
              error: 'Verification code sent. Please verify your phone number to continue.',
            };
          }
        }

        const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
        if (!authenticatedUser || !authenticatedUser.id) {
          return {
            user: GUEST_USER,
            profile: GUEST_PROFILE,
            error: 'Authentication failed to establish a valid Supabase session.',
          };
        }

        console.log(`[METFA AUTH] Authenticated user: ${authenticatedUser.id}`);
        // Check first if a profile already exists so we NEVER overwrite existing account data
        const existingDbPhoneProfile = await fetchSupabaseProfile(authenticatedUser.id);
        let profile = existingDbPhoneProfile;
        if (!existingDbPhoneProfile) {
          profile = await upsertSupabaseProfile(authenticatedUser.id, {
            name: cleanName,
            username: cleanUsername,
            avatar: cleanAvatar,
            phone: identifier,
            isVerified: true,
          });
        }

        const { authUser, userProfile } = await mapSupabaseUserToAuthUser(authenticatedUser, session);
        const finalProfile = profile || userProfile;
        persistSSOSession(authUser, finalProfile);
        return { user: authUser, profile: finalProfile };
      }

      // Email / Gmail auth method
      const emailToUse = identifier.trim().toLowerCase();
      const userPassword = params.password || `MetfaPass_${emailToUse.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}!9`;

      // 1. Try signing up new user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailToUse,
        password: userPassword,
        options: {
          data: {
            full_name: cleanName,
            username: cleanUsername,
            avatar_url: cleanAvatar,
          },
        },
      });

      let currentSbUser = signUpData?.user;
      let session = signUpData?.session;

      // 2. If user already registered, sign them in directly with password
      if (signUpError && (
        signUpError.message.toLowerCase().includes('already registered') ||
        signUpError.message.toLowerCase().includes('already in use') ||
        signUpError.message.toLowerCase().includes('already exists')
      )) {
        console.log('[METFA AUTH] Account already registered, signing in with password...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: userPassword,
        });

        if (signInError) {
          console.warn('[METFA AUTH] Sign-in failed for existing account:', signInError.message);
          return {
            user: GUEST_USER,
            profile: GUEST_PROFILE,
            error: `This account already exists. Please switch to "Sign In" to log in.`,
          };
        }
        currentSbUser = signInData?.user;
        session = signInData?.session;
      } else if (signUpError) {
        console.warn('[METFA AUTH] Sign-up failed:', signUpError.message);
        return {
          user: GUEST_USER,
          profile: GUEST_PROFILE,
          error: signUpError.message,
        };
      }

      // Check if session exists in client
      if (!session) {
        const { data: sessionData } = await supabase.auth.getSession();
        session = sessionData?.session;
        if (!currentSbUser && session?.user) {
          currentSbUser = session.user;
        }
      }

      // If user was created but no session exists (email confirmation required)
      if (currentSbUser && !session) {
        console.log(`[METFA AUTH] User created (${currentSbUser.id}), pending email confirmation`);
        return {
          user: GUEST_USER,
          profile: GUEST_PROFILE,
          error: 'Account created! Please check your email to confirm your registration before signing in.',
        };
      }

      // Requirement: After authentication, verify:
      // const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
      // If authenticatedUser exists: use authenticatedUser.id everywhere.
      const { data: { user: authenticatedUser } } = await supabase.auth.getUser();

      if (!authenticatedUser || !authenticatedUser.id) {
        return {
          user: GUEST_USER,
          profile: GUEST_PROFILE,
          error: 'Authentication failed to establish a valid Supabase session.',
        };
      }

      console.log(`[METFA AUTH] Authenticated user: ${authenticatedUser.id}`);

      // Upsert profile in Supabase profiles table using auth.users.id only if not already present
      // Check first if a profile already exists so we NEVER overwrite existing account data
      const existingDbEmailProfile = await fetchSupabaseProfile(authenticatedUser.id);
      let profile = existingDbEmailProfile;
      if (!existingDbEmailProfile) {
        profile = await upsertSupabaseProfile(authenticatedUser.id, {
          name: cleanName,
          username: cleanUsername,
          avatar: cleanAvatar,
          email: emailToUse,
          isVerified: true,
        });
      }

      const { authUser, userProfile } = await mapSupabaseUserToAuthUser(authenticatedUser, session);
      const finalProfile = profile || userProfile;
      persistSSOSession(authUser, finalProfile);
      return { user: authUser, profile: finalProfile };
    } catch (err: any) {
      console.error('[METFA AUTH] Authentication exception:', err);
      return {
        user: GUEST_USER,
        profile: GUEST_PROFILE,
        error: err?.message || 'Authentication failed. Please check network connection.',
      };
    }
  }

  return {
    user: GUEST_USER,
    profile: GUEST_PROFILE,
    error: 'Supabase authentication is not configured. Real authentication requires Supabase configuration.',
  };
}

/**
 * 2b. REAL USER SIGN IN ("Sign In / Log In" for existing accounts)
 * Strictly preserves existing user ID, profile, posts, reels, messages, and account data without overwriting.
 */
export async function signInExistingUser(params: {
  authMethod: 'gmail' | 'phone';
  identifier: string; // Email or Phone number
  password?: string;
}): Promise<{ user: AuthUser; profile: UserProfile; error?: string }> {
  const { authMethod, identifier, password } = params;

  if (isSupabaseConfigured()) {
    console.log('[METFA AUTH] Supabase configured: true. Attempting sign-in for existing user...');
    try {
      let session: Session | null = null;
      let currentSbUser: User | null = null;

      if (authMethod === 'phone') {
        const cleanPhone = identifier.replace(/[^\d+]/g, '');
        const defaultPassword = `MetfaPass_${cleanPhone.slice(-6)}!9`;
        const userPassword = password || defaultPassword;

        let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          phone: cleanPhone,
          password: userPassword,
        });

        // If custom password failed, try default password as fallback in case account was created without password
        if (signInError && password && password !== defaultPassword) {
          const fallbackRes = await supabase.auth.signInWithPassword({
            phone: cleanPhone,
            password: defaultPassword,
          });
          if (!fallbackRes.error && fallbackRes.data?.user) {
            signInData = fallbackRes.data;
            signInError = null;
          }
        }

        if (signInError) {
          return {
            user: GUEST_USER,
            profile: GUEST_PROFILE,
            error: signInError.message.includes('Invalid login credentials')
              ? 'Invalid phone number or password. If you are new to METFA Social, please switch to Sign Up.'
              : signInError.message,
          };
        }

        currentSbUser = signInData?.user || null;
        session = signInData?.session || null;
      } else {
        // Gmail / Email
        const emailToUse = identifier.trim().toLowerCase();
        const defaultPassword = `MetfaPass_${emailToUse.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}!9`;
        const userPassword = password || defaultPassword;

        let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: userPassword,
        });

        // If custom password failed, try default password as fallback
        if (signInError && password && password !== defaultPassword) {
          const fallbackRes = await supabase.auth.signInWithPassword({
            email: emailToUse,
            password: defaultPassword,
          });
          if (!fallbackRes.error && fallbackRes.data?.user) {
            signInData = fallbackRes.data;
            signInError = null;
          }
        }

        if (signInError) {
          return {
            user: GUEST_USER,
            profile: GUEST_PROFILE,
            error: signInError.message.includes('Invalid login credentials')
              ? 'Invalid email or password. If you are new to METFA Social, please switch to Sign Up.'
              : signInError.message,
          };
        }

        currentSbUser = signInData?.user || null;
        session = signInData?.session || null;
      }

      if (!session) {
        const { data: sessionData } = await supabase.auth.getSession();
        session = sessionData?.session || null;
        if (!currentSbUser && session?.user) {
          currentSbUser = session.user;
        }
      }

      const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
      if (!authenticatedUser || !authenticatedUser.id) {
        return {
          user: GUEST_USER,
          profile: GUEST_PROFILE,
          error: 'Authentication failed to establish a valid Supabase session.',
        };
      }

      console.log(`[METFA AUTH] Authenticated existing user ID: ${authenticatedUser.id}`);

      // PRESERVE EXISTING PROFILE & ACCOUNT DATA - NEVER OVERWRITE
      const existingProfile = await fetchSupabaseProfile(authenticatedUser.id);
      const { authUser, userProfile } = await mapSupabaseUserToAuthUser(authenticatedUser, session);
      const finalProfile = existingProfile || userProfile;

      persistSSOSession(authUser, finalProfile);
      return { user: authUser, profile: finalProfile };
    } catch (err: any) {
      console.error('[METFA AUTH] Sign-in exception:', err);
      return {
        user: GUEST_USER,
        profile: GUEST_PROFILE,
        error: err?.message || 'Sign in failed. Please check network connection.',
      };
    }
  }

  return {
    user: GUEST_USER,
    profile: GUEST_PROFILE,
    error: 'Supabase authentication is not configured.',
  };
}

/**
 * 3. REAL SUPABASE SIGN OUT
 */
export async function supabaseSignOut(): Promise<AuthUser> {
  console.log('[METFA AUTH] Signing out user...');
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Supabase] SignOut error:', err);
    }
  }

  clearStaleAuthCache();
  const guestUser = GUEST_USER;
  const guestProfile = GUEST_PROFILE;

  if (typeof window !== 'undefined') {
    const guestIdentity: PostingIdentity = {
      type: 'personal',
      id: guestUser.id,
      name: guestUser.name,
      username: guestUser.username,
      avatar: guestUser.avatar,
      badge: 'Guest',
    };
    window.dispatchEvent(new CustomEvent('metfa_identity_changed', { detail: guestIdentity }));
    window.dispatchEvent(new CustomEvent('metfa_profile_updated', { detail: guestProfile }));
    window.dispatchEvent(new CustomEvent('metfa_auth_changed', { detail: guestUser }));
  }
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

