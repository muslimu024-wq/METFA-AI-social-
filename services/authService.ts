import { UserProfile, PostingIdentity } from '../types/community';
import { safeSetItem, safeGetItem, safeRemoveItem } from '../utils/storageUtils';

export interface AuthUser {
  id: string;
  metfaId: string; // Unified Metfa ID (e.g. MID-9281-ABCD)
  name: string;
  username: string; // @username
  authType: 'phone' | 'gmail' | 'guest';
  phoneOrEmail: string;
  avatar: string;
  sessionToken: string; // Unified JWT / Session token
  tokenExpiry: number;
  createdAt: string;
  isVerified?: boolean;
}

export interface SSOSessionPayload {
  sub: string;
  metfaId: string;
  name: string;
  username: string;
  authType: 'phone' | 'gmail' | 'guest';
  phoneOrEmail: string;
  avatar: string;
  iat: number;
  exp: number;
}

const SSO_SESSION_KEY = 'metfa_sso_session_v1';
const AUTH_USER_KEY = 'metfa_auth_user_v2';
const USER_PROFILE_KEY = 'metfa_user_profile_v2';
const ACTIVE_IDENTITY_KEY = 'metfa_active_identity_v1';

/**
 * Generates a standard JWT-structured session token with base64 payload
 */
export function generateSSOToken(user: Omit<AuthUser, 'sessionToken' | 'tokenExpiry'>): { token: string; expiry: number } {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 30 * 24 * 60 * 60; // 30-day session

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: SSOSessionPayload = {
    sub: user.id,
    metfaId: user.metfaId,
    name: user.name,
    username: user.username,
    authType: user.authType,
    phoneOrEmail: user.phoneOrEmail,
    avatar: user.avatar,
    iat,
    exp,
  };

  const b64Header = btoa(JSON.stringify(header));
  const b64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  // Simulated cryptographically secure signature hash
  const pseudoSignature = btoa(`${user.id}:${user.metfaId}:${exp}`).slice(0, 32);

  const token = `${b64Header}.${b64Payload}.${pseudoSignature}`;
  return { token, expiry: exp * 1000 };
}

/**
 * Validates a JWT-structured SSO token and returns payload
 */
export function parseSSOToken(token: string): SSOSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const jsonStr = decodeURIComponent(escape(atob(parts[1])));
    const payload = JSON.parse(jsonStr) as SSOSessionPayload;
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      console.warn('SSO Session token expired.');
      return null;
    }
    return payload;
  } catch (err) {
    console.error('Failed to parse SSO token:', err);
    return null;
  }
}

/**
 * Generates an automatic unique username (e.g. @name_1234)
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
export const generateUnifiedMetfaId = (): string => {
  const timestampSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MID-${timestampSuffix}-${randomHex}`;
};

// Initial default user for initial view
export const INITIAL_GUEST_USER: AuthUser = {
  id: 'usr_metfa_9281',
  metfaId: 'MID-9281-ALEX',
  name: 'Alex Rivera',
  username: 'alex.rivera',
  authType: 'gmail',
  phoneOrEmail: 'alex.rivera.ai@gmail.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  sessionToken: '',
  tokenExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
  createdAt: '2026-01-10',
  isVerified: true,
};

/**
 * Retrieve current active SSO user
 */
export const getActiveSSOUser = (): AuthUser => {
  try {
    const raw = safeGetItem(AUTH_USER_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.id && data.username) {
        if (!data.metfaId) data.metfaId = generateUnifiedMetfaId();
        return data;
      }
    }
  } catch (err) {
    console.error('Error loading active SSO user:', err);
  }
  return INITIAL_GUEST_USER;
};

/**
 * Persists user session across SSO storage keys and dispatches update events
 */
export const persistSSOSession = (user: AuthUser): void => {
  safeSetItem(AUTH_USER_KEY, JSON.stringify(user));
  if (user.sessionToken) {
    safeSetItem(SSO_SESSION_KEY, user.sessionToken);
  }

  // Synchronize UserProfile
  try {
    const rawProfile = safeGetItem(USER_PROFILE_KEY);
    let currentProfile: UserProfile = rawProfile ? JSON.parse(rawProfile) : ({} as any);
    const updatedProfile: UserProfile = {
      ...currentProfile,
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      isVerified: user.isVerified ?? currentProfile.isVerified ?? true,
      bio: currentProfile.bio || 'AI Creator & Visual Explorer on Metfa Social.',
      location: currentProfile.location || 'Global Creator',
      website: currentProfile.website || `https://metfa.ai/@${user.username}`,
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
  }

  // Synchronize ActiveIdentity
  const activeIdentity: PostingIdentity = {
    type: 'personal',
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    badge: user.isVerified ? 'Verified Creator' : 'Creator',
  };
  safeSetItem(ACTIVE_IDENTITY_KEY, JSON.stringify(activeIdentity));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metfa_identity_changed', { detail: activeIdentity }));
    window.dispatchEvent(new CustomEvent('metfa_auth_changed', { detail: user }));
  }
};

/**
 * Unified SSO Login with Mobile Phone
 */
export const ssoLoginWithPhone = (
  phoneNumber: string,
  name: string,
  customUsername?: string,
  customAvatar?: string
): AuthUser => {
  const cleanPhone = phoneNumber.trim();
  const cleanName = name.trim() || 'Mobile Creator';
  const username = customUsername?.trim() ? customUsername.trim().replace(/^@/, '') : generateUniqueUsername(cleanName || 'phone_user');
  const userId = `usr_${Math.random().toString(36).substring(2, 9)}`;
  const metfaId = generateUnifiedMetfaId();

  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
  const avatar = customAvatar?.trim() || defaultAvatar;

  const partialUser = {
    id: userId,
    metfaId,
    name: cleanName,
    username,
    authType: 'phone' as const,
    phoneOrEmail: cleanPhone,
    avatar,
    createdAt: new Date().toISOString().split('T')[0],
    isVerified: true,
  };

  const { token, expiry } = generateSSOToken(partialUser);
  const user: AuthUser = {
    ...partialUser,
    sessionToken: token,
    tokenExpiry: expiry,
  };

  persistSSOSession(user);
  return user;
};

/**
 * Unified SSO Login with Google/Gmail
 */
export const ssoLoginWithGmail = (
  email: string,
  name: string,
  customAvatar?: string,
  customUsername?: string
): AuthUser => {
  const cleanEmail = email.trim();
  const cleanName = name.trim() || cleanEmail.split('@')[0];
  const username = customUsername?.trim() ? customUsername.trim().replace(/^@/, '') : generateUniqueUsername(cleanEmail);
  const userId = `usr_${Math.random().toString(36).substring(2, 9)}`;
  const metfaId = generateUnifiedMetfaId();

  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const avatar = customAvatar?.trim() || defaultAvatar;

  const partialUser = {
    id: userId,
    metfaId,
    name: cleanName,
    username,
    authType: 'gmail' as const,
    phoneOrEmail: cleanEmail,
    avatar,
    createdAt: new Date().toISOString().split('T')[0],
    isVerified: true,
  };

  const { token, expiry } = generateSSOToken(partialUser);
  const user: AuthUser = {
    ...partialUser,
    sessionToken: token,
    tokenExpiry: expiry,
  };

  persistSSOSession(user);
  return user;
};

/**
 * Unified SSO Logout
 */
export const ssoLogout = (): AuthUser => {
  safeRemoveItem(SSO_SESSION_KEY);
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
};
