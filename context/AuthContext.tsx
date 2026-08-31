import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  AuthUser,
  getActiveSSOUser,
  persistSSOSession,
  saveProfileAndEnterMetfa,
  signInWithGoogleOAuth,
  supabaseSignOut,
  fetchSupabaseProfile,
  upsertSupabaseProfile,
  mapSupabaseUserToAuthUser,
  INITIAL_GUEST_USER,
} from '../services/authService';
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
  signInWithGoogle: (params?: { email?: string; fullName?: string; avatar?: string }) => Promise<{ url?: string; error?: string; user?: AuthUser; profile?: UserProfile }>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  switchIdentity: (identity: PostingIdentity) => void;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(() => getActiveSSOUser());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => getUserProfile());
  const [activeIdentity, setActiveIdentityState] = useState<PostingIdentity>(() => getActiveIdentity());
  const isSupabaseConnected = isSupabaseConfigured();

  const refreshAuth = useCallback(() => {
    const currentAuth = getActiveSSOUser();
    const currentProf = getUserProfile();
    const currentId = getActiveIdentity();
    setUser(currentAuth);
    setUserProfile(currentProf);
    setActiveIdentityState(currentId);
  }, []);

  // 1. Initialize Supabase Session on App Startup & Listen to Auth State Changes
  useEffect(() => {
    if (!isSupabaseConnected) {
      console.info('[Metfa Auth] Supabase not yet configured. Running in local session mode.');
      return;
    }

    let isMounted = true;

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('[Supabase] Get session error:', error.message);
        return;
      }
      if (session?.user) {
        const { authUser, userProfile: syncedProfile } = await mapSupabaseUserToAuthUser(session.user, session);
        if (isMounted) {
          setUser(authUser);
          setUserProfile(syncedProfile);
          persistSSOSession(authUser, syncedProfile);
        }
      }
    });

    // Subscribe to auth state changes (OAuth callbacks, token refresh, sign-in, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      console.log(`[Supabase Auth Event]: ${event}`);

      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
        const { authUser, userProfile: syncedProfile } = await mapSupabaseUserToAuthUser(session.user, session);
        if (isMounted) {
          setUser(authUser);
          setUserProfile(syncedProfile);
          persistSSOSession(authUser, syncedProfile);
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          const guestUser = INITIAL_GUEST_USER;
          setUser(guestUser);
          persistSSOSession(guestUser);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [isSupabaseConnected]);

  // 2. Window Custom Event Listeners for UI state sync
  useEffect(() => {
    const handleAuthChanged = (e: any) => {
      if (e.detail) {
        setUser(e.detail);
      }
      refreshAuth();
    };

    const handleProfileUpdated = (e: any) => {
      if (e.detail) {
        setUserProfile(e.detail);
      }
      refreshAuth();
    };

    const handleIdentityChanged = (e: any) => {
      if (e.detail) {
        setActiveIdentityState(e.detail);
      }
      refreshAuth();
    };

    window.addEventListener('metfa_auth_changed', handleAuthChanged);
    window.addEventListener('metfa_profile_updated', handleProfileUpdated);
    window.addEventListener('metfa_identity_changed', handleIdentityChanged);

    return () => {
      window.removeEventListener('metfa_auth_changed', handleAuthChanged);
      window.removeEventListener('metfa_profile_updated', handleProfileUpdated);
      window.removeEventListener('metfa_identity_changed', handleIdentityChanged);
    };
  }, [refreshAuth]);

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
      if (!result.error && result.user) {
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
        avatar: customAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
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
        avatar: customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      });
    },
    [saveProfileAndEnter]
  );

  const signInWithGoogle = useCallback(async (params?: { email?: string; fullName?: string; avatar?: string }) => {
    const res = await signInWithGoogleOAuth(params);
    if (res.user && res.profile) {
      setUser(res.user);
      setUserProfile(res.profile);
      refreshAuth();
    }
    return res;
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    const guestUser = await supabaseSignOut();
    setUser(guestUser);
    refreshAuth();
  }, [refreshAuth]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const current = getUserProfile();
    const updated: UserProfile = {
      ...current,
      ...updates,
    };
    doSaveUserProfile(updated);
    setUserProfile(updated);

    // If Supabase is connected and user is authenticated, persist to profiles table
    if (isSupabaseConfigured() && user.id && !user.id.startsWith('guest_')) {
      try {
        await upsertSupabaseProfile(user.id, updated);
      } catch (err) {
        console.warn('[Supabase] Failed to sync profile updates to database:', err);
      }
    }

    // Also sync with AuthUser & ActiveIdentity
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
  }, [user.id]);

  const switchIdentity = useCallback((identity: PostingIdentity) => {
    doSetActiveIdentity(identity);
    setActiveIdentityState(identity);
  }, []);

  const isAuthenticated = user.authType !== 'guest' && Boolean(user.id);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        activeIdentity,
        isAuthenticated,
        isSupabaseConnected,
        sessionToken: user.sessionToken || null,
        metfaId: user.metfaId || 'MID-GUEST',
        loginPhone,
        loginGmail,
        saveProfileAndEnter,
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
