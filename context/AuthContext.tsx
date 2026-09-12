import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  AuthUser,
  getActiveSSOUser,
  persistSSOSession,
  saveProfileAndEnterMetfa,
  signInExistingUser,
  signInWithGoogleOAuth,
  supabaseSignOut,
  fetchSupabaseProfile,
  upsertSupabaseProfile,
  mapSupabaseUserToAuthUser,
  GUEST_USER,
  GUEST_PROFILE,
  GUEST_AVATAR,
  clearStaleAuthCache,
  getDefaultAvatar,
  sanitizeAvatarUrl,
} from '../services/authService';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { UserProfile, PostingIdentity } from '../types/community';
import { getUserProfile, saveUserProfile as doSaveUserProfile } from '../utils/communityStore';
import { getActiveIdentity, setActiveIdentity as doSetActiveIdentity } from '../utils/socialStore';

interface AuthContextType {
  user: AuthUser;
  userProfile: UserProfile;
  activeIdentity: PostingIdentity;
  isAuthenticated: boolean;
  isSupabaseConnected: boolean;
  sessionToken: string | null;
  metfaId: string;
  loginPhone: (phoneNumber: string, name: string, customUsername?: string, customAvatar?: string) => Promise<{ user: AuthUser; profile: UserProfile; error?: string }>;
  loginGmail: (email: string, name: string, customAvatar?: string, customUsername?: string) => Promise<{ user: AuthUser; profile: UserProfile; error?: string }>;
  saveProfileAndEnter: (params: {
    authMethod: 'gmail' | 'phone';
    identifier: string;
    fullName: string;
    username?: string;
    avatar: string;
    password?: string;
  }) => Promise<{ user: AuthUser; profile: UserProfile; error?: string }>;
  signInUser: (params: {
    authMethod: 'gmail' | 'phone';
    identifier: string;
    password?: string;
  }) => Promise<{ user: AuthUser; profile: UserProfile; error?: string }>;
  signInWithGoogle: (params?: { email?: string; fullName?: string; avatar?: string }) => Promise<{ url?: string; error?: string; user?: AuthUser; profile?: UserProfile }>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  switchIdentity: (identity: PostingIdentity) => void;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(() => isSupabaseConfigured());

  // Check if runtime configuration is delivered via /api/config on initial mount
  useEffect(() => {
    if (!isSupabaseConnected && typeof window !== 'undefined') {
      fetch('/api/config')
        .then((res) => (res.ok ? res.json() : null))
        .then((cfg) => {
          if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
            (window as any).__ENV__ = Object.assign((window as any).__ENV__ || {}, {
              VITE_SUPABASE_URL: cfg.supabaseUrl,
              VITE_SUPABASE_ANON_KEY: cfg.supabaseAnonKey,
            });
            if (isSupabaseConfigured()) {
              setIsSupabaseConnected(true);
            }
          }
        })
        .catch(() => {});
    }
  }, [isSupabaseConnected]);

  // App Startup — Single Source of Truth:
  // When Supabase is configured, do NOT initialize the active authenticated user from localStorage as authority!
  // Start strictly in guest state until supabase.auth.getSession() resolves the authoritative session.
  const [user, setUser] = useState<AuthUser>(() => {
    if (isSupabaseConfigured()) {
      return GUEST_USER;
    }
    return getActiveSSOUser();
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    if (isSupabaseConfigured()) {
      return GUEST_PROFILE;
    }
    return getUserProfile();
  });

  const [activeIdentity, setActiveIdentityState] = useState<PostingIdentity>(() => {
    if (isSupabaseConfigured()) {
      return {
        type: 'personal',
        id: GUEST_USER.id,
        name: GUEST_USER.name,
        username: GUEST_USER.username,
        avatar: GUEST_USER.avatar,
        badge: 'Guest',
      };
    }
    return getActiveIdentity();
  });

  const refreshAuth = useCallback(() => {
    if (isSupabaseConnected) {
      // Re-verify from Supabase session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          mapSupabaseUserToAuthUser(session.user, session).then(({ authUser, userProfile: syncedProfile }) => {
            setUser(authUser);
            setUserProfile(syncedProfile);
            const iden: PostingIdentity = {
              type: 'personal',
              id: authUser.id,
              name: syncedProfile.name || authUser.name,
              username: syncedProfile.username || authUser.username,
              avatar: syncedProfile.avatar || authUser.avatar,
              badge: syncedProfile.isVerified ? 'Verified Creator' : 'Creator',
            };
            setActiveIdentityState(iden);
          });
        } else {
          setUser(GUEST_USER);
          setUserProfile(GUEST_PROFILE);
          const guestIden: PostingIdentity = {
            type: 'personal',
            id: GUEST_USER.id,
            name: GUEST_USER.name,
            username: GUEST_USER.username,
            avatar: GUEST_USER.avatar,
            badge: 'Guest',
          };
          setActiveIdentityState(guestIden);
        }
      });
      return;
    }

    const currentAuth = getActiveSSOUser();
    const currentProf = getUserProfile();
    const currentId = getActiveIdentity();
    setUser(currentAuth);
    setUserProfile(currentProf);
    setActiveIdentityState(currentId);
  }, [isSupabaseConnected]);

  // Helper to resolve Supabase session and enforce Supabase-first single source of truth
  const resolveSupabaseSession = useCallback(async (session: Session | null) => {
    console.log(`[METFA AUTH] Supabase session: ${session ? 'Active' : 'None'}`);

    if (session?.user) {
      const supabaseUser = session.user;
      const realUserId = supabaseUser.id;
      console.log(`[METFA AUTH] Supabase user ID: ${realUserId}`);

      // Profile cache verification: cachedProfile.id === currentSupabaseUser.id
      let resolvedProfile: UserProfile | null = null;
      try {
        const cachedRaw = localStorage.getItem('metfa_user_profile_v2');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed && parsed.id === realUserId) {
            console.log(`[METFA AUTH] Cached profile ID: ${parsed.id}`);
            resolvedProfile = parsed;
          } else if (parsed) {
            console.log(`[METFA AUTH] Cache rejected because IDs differ: cached=${parsed?.id}, current=${realUserId}`);
            localStorage.removeItem('metfa_user_profile_v2');
          }
        }
      } catch {}

      // Fetch profile from Supabase Database
      console.log(`[METFA AUTH] Loading profile for: ${realUserId}`);
      const dbProfile = await fetchSupabaseProfile(realUserId);
      if (dbProfile) {
        console.log(`[METFA AUTH] Profile ID: ${dbProfile.id}`);
        resolvedProfile = dbProfile;
      }

      // Map Supabase User & create profile if needed
      const { authUser, userProfile: mappedProfile } = await mapSupabaseUserToAuthUser(supabaseUser, session);
      const finalProfile = resolvedProfile || mappedProfile;

      console.log(`[METFA AUTH] Authenticated user: ${authUser.id}`);

      setUser(authUser);
      setUserProfile(finalProfile);
      const activeId: PostingIdentity = {
        type: 'personal',
        id: authUser.id,
        name: finalProfile.name || authUser.name,
        username: finalProfile.username || authUser.username,
        avatar: finalProfile.avatar || authUser.avatar,
        badge: finalProfile.isVerified ? 'Verified Creator' : 'Creator',
      };
      setActiveIdentityState(activeId);
      doSetActiveIdentity(activeId);

      // Only after successful Supabase resolution, update LocalStorage cache
      persistSSOSession(authUser, finalProfile);
    } else {
      // If there is NO Supabase session: clear stale cache and set clean guest state
      console.log('[METFA AUTH] Guest mode: no Supabase session');
      clearStaleAuthCache();
      setUser(GUEST_USER);
      setUserProfile(GUEST_PROFILE);
      const guestIdentity: PostingIdentity = {
        type: 'personal',
        id: GUEST_USER.id,
        name: GUEST_USER.name,
        username: GUEST_USER.username,
        avatar: GUEST_USER.avatar,
        badge: 'Guest',
      };
      setActiveIdentityState(guestIdentity);
      doSetActiveIdentity(guestIdentity);
    }
  }, []);

  // 1. Initialize Supabase Session on App Startup & Listen to Auth State Changes
  useEffect(() => {
    console.log(`[METFA AUTH] Supabase configured: ${isSupabaseConnected}`);

    if (!isSupabaseConnected) {
      console.log('[METFA AUTH] Guest mode: Supabase not configured');
      return;
    }

    let isMounted = true;

    // A. Start with authentication unresolved / guest state (initialized in useState)
    // B. Call supabase.auth.getSession()
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('[METFA AUTH] Get session error:', error.message);
      }
      resolveSupabaseSession(session);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      console.log(`[Supabase Auth Event]: ${event}`);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        await resolveSupabaseSession(session);
      } else if (event === 'SIGNED_OUT' || !session) {
        console.log('[METFA AUTH] Guest mode: signed out');
        clearStaleAuthCache();
        if (isMounted) {
          setUser(GUEST_USER);
          setUserProfile(GUEST_PROFILE);
          const guestIdentity: PostingIdentity = {
            type: 'personal',
            id: GUEST_USER.id,
            name: GUEST_USER.name,
            username: GUEST_USER.username,
            avatar: GUEST_USER.avatar,
            badge: 'Guest',
          };
          setActiveIdentityState(guestIdentity);
          doSetActiveIdentity(guestIdentity);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [isSupabaseConnected, resolveSupabaseSession]);

  // 2. Window Custom Event Listeners for UI state sync
  useEffect(() => {
    const handleAuthChanged = (e: any) => {
      if (e.detail) {
        setUser(e.detail);
      }
    };

    const handleProfileUpdated = (e: any) => {
      if (e.detail) {
        setUserProfile(e.detail);
      }
    };

    const handleIdentityChanged = (e: any) => {
      if (e.detail) {
        setActiveIdentityState(e.detail);
      }
    };

    window.addEventListener('metfa_auth_changed', handleAuthChanged);
    window.addEventListener('metfa_profile_updated', handleProfileUpdated);
    window.addEventListener('metfa_identity_changed', handleIdentityChanged);

    return () => {
      window.removeEventListener('metfa_auth_changed', handleAuthChanged);
      window.removeEventListener('metfa_profile_updated', handleProfileUpdated);
      window.removeEventListener('metfa_identity_changed', handleIdentityChanged);
    };
  }, []);

  // Real Save Profile & Enter Metfa Handler
  const saveProfileAndEnter = useCallback(
    async (params: {
      authMethod: 'gmail' | 'phone';
      identifier: string;
      fullName: string;
      username?: string;
      avatar: string;
      password?: string;
    }) => {
      const result = await saveProfileAndEnterMetfa(params);
      if (!result.error && result.user && result.user.authType !== 'guest' && result.user.id) {
        if (isSupabaseConfigured()) {
          setIsSupabaseConnected(true);
        }
        setUser(result.user);
        setUserProfile(result.profile);
        const activeId: PostingIdentity = {
          type: 'personal',
          id: result.user.id,
          name: result.user.name,
          username: result.user.username,
          avatar: result.user.avatar,
          badge: result.user.isVerified ? 'Verified Creator' : 'Creator',
        };
        doSetActiveIdentity(activeId);
        setActiveIdentityState(activeId);
      }
      return result;
    },
    []
  );

  const loginPhone = useCallback(
    async (phoneNumber: string, name: string, customUsername?: string, customAvatar?: string) => {
      return saveProfileAndEnter({
        authMethod: 'phone',
        identifier: phoneNumber,
        fullName: name,
        username: customUsername,
        avatar: sanitizeAvatarUrl(customAvatar, customUsername || name),
      });
    },
    [saveProfileAndEnter]
  );

  const loginGmail = useCallback(
    async (email: string, name: string, customAvatar?: string, customUsername?: string) => {
      return saveProfileAndEnter({
        authMethod: 'gmail',
        identifier: email,
        fullName: name,
        username: customUsername,
        avatar: sanitizeAvatarUrl(customAvatar, customUsername || name),
      });
    },
    [saveProfileAndEnter]
  );

  const signInUser = useCallback(
    async (params: {
      authMethod: 'gmail' | 'phone';
      identifier: string;
      password?: string;
    }) => {
      const result = await signInExistingUser(params);
      if (result.user && result.profile && result.user.authType !== 'guest') {
        if (isSupabaseConfigured()) {
          setIsSupabaseConnected(true);
        }
        setUser(result.user);
        setUserProfile(result.profile);
        const activeId: PostingIdentity = {
          type: 'personal',
          id: result.user.id,
          name: result.user.name,
          username: result.user.username,
          avatar: result.user.avatar,
          badge: result.user.isVerified ? 'Verified Creator' : 'Creator',
        };
        doSetActiveIdentity(activeId);
        setActiveIdentityState(activeId);
      }
      return result;
    },
    []
  );

  const signInWithGoogle = useCallback(async (params?: { email?: string; fullName?: string; avatar?: string }) => {
    const res = await signInWithGoogleOAuth(params);
    if (res.user && res.profile && res.user.authType !== 'guest') {
      if (isSupabaseConfigured()) {
        setIsSupabaseConnected(true);
      }
      setUser(res.user);
      setUserProfile(res.profile);
      const activeId: PostingIdentity = {
        type: 'personal',
        id: res.user.id,
        name: res.user.name,
        username: res.user.username,
        avatar: res.user.avatar,
        badge: res.user.isVerified ? 'Verified Creator' : 'Creator',
      };
      doSetActiveIdentity(activeId);
      setActiveIdentityState(activeId);
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    console.log('[METFA AUTH] Logging out...');
    const guestUser = await supabaseSignOut();
    setUser(guestUser);
    setUserProfile(GUEST_PROFILE);
    const guestIdentity: PostingIdentity = {
      type: 'personal',
      id: guestUser.id,
      name: guestUser.name,
      username: guestUser.username,
      avatar: guestUser.avatar,
      badge: 'Guest',
    };
    setActiveIdentityState(guestIdentity);
    doSetActiveIdentity(guestIdentity);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (isSupabaseConfigured()) {
      // Obtain the authoritative Supabase session user directly from auth.getUser()
      const {
        data: { user: currentSupabaseUser },
      } = await supabase.auth.getUser();

      if (!currentSupabaseUser || !currentSupabaseUser.id) {
        console.warn('[METFA AUTH] Cannot update profile: no authenticated Supabase user');
        return;
      }

      const realUserId = currentSupabaseUser.id;
      console.log(`[METFA AUTH] Updating profile for user: ${realUserId}`);

      const sanitizedUpdates = {
        ...updates,
        id: realUserId,
      };

      // 1. Sync to Supabase public.profiles FIRST
      const dbProfile = await upsertSupabaseProfile(realUserId, sanitizedUpdates);

      const finalProfile: UserProfile = dbProfile || {
        ...userProfile,
        ...sanitizedUpdates,
        id: realUserId,
      };

      // 2. UI and local cache synchronization AFTER database synchronization
      doSaveUserProfile(finalProfile);
      setUserProfile(finalProfile);

      const updatedAuth: AuthUser = {
        ...user,
        id: realUserId,
        name: finalProfile.name || user.name,
        username: finalProfile.username || user.username,
        avatar: finalProfile.avatar || user.avatar,
      };
      persistSSOSession(updatedAuth, finalProfile);
      setUser(updatedAuth);

      const activeId: PostingIdentity = {
        type: 'personal',
        id: realUserId,
        name: finalProfile.name,
        username: finalProfile.username,
        avatar: finalProfile.avatar,
        badge: finalProfile.isVerified ? 'Verified Creator' : 'Creator',
      };
      doSetActiveIdentity(activeId);
      setActiveIdentityState(activeId);
      return;
    }

    // Local dev mode fallback when Supabase is not configured
    const current = getUserProfile();
    const updated: UserProfile = {
      ...current,
      ...updates,
      id: user.id || current.id,
    };
    doSaveUserProfile(updated);
    setUserProfile(updated);

    const currentAuth = getActiveSSOUser();
    const updatedAuth: AuthUser = {
      ...currentAuth,
      name: updated.name || currentAuth.name,
      username: updated.username || currentAuth.username,
      avatar: updated.avatar || currentAuth.avatar,
    };
    persistSSOSession(updatedAuth, updated);
    setUser(updatedAuth);

    const activeId: PostingIdentity = {
      type: 'personal',
      id: updated.id,
      name: updated.name,
      username: updated.username,
      avatar: updated.avatar,
      badge: updated.isVerified ? 'Verified Creator' : 'Creator',
    };
    doSetActiveIdentity(activeId);
    setActiveIdentityState(activeId);
  }, [user, userProfile]);

  const switchIdentity = useCallback((identity: PostingIdentity) => {
    doSetActiveIdentity(identity);
    setActiveIdentityState(identity);
  }, []);

  const isAuthenticated =
    user.authType !== 'guest' &&
    Boolean(user.id);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        activeIdentity,
        isAuthenticated,
        isSupabaseConnected,
        sessionToken: user.sessionToken || null,
        metfaId: user.metfaId || '',
        loginPhone,
        loginGmail,
        saveProfileAndEnter,
        signInUser,
        signInWithGoogle,
        logout,
        updateProfile,
        switchIdentity,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
