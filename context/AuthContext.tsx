import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  AuthUser,
  getActiveSSOUser,
  persistSSOSession,
  ssoLoginWithPhone,
  ssoLoginWithGmail,
  ssoLogout,
  parseSSOToken,
} from '../services/authService';
import { UserProfile, PostingIdentity } from '../types/community';
import { getUserProfile, saveUserProfile as doSaveUserProfile } from '../utils/communityStore';
import { getActiveIdentity, setActiveIdentity as doSetActiveIdentity } from '../utils/socialStore';

interface AuthContextType {
  user: AuthUser;
  userProfile: UserProfile;
  activeIdentity: PostingIdentity;
  isAuthenticated: boolean;
  sessionToken: string | null;
  metfaId: string;
  loginPhone: (phoneNumber: string, name: string, customUsername?: string, customAvatar?: string) => AuthUser;
  loginGmail: (email: string, name: string, customAvatar?: string, customUsername?: string) => AuthUser;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  switchIdentity: (identity: PostingIdentity) => void;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(() => getActiveSSOUser());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => getUserProfile());
  const [activeIdentity, setActiveIdentityState] = useState<PostingIdentity>(() => getActiveIdentity());

  const refreshAuth = useCallback(() => {
    const currentAuth = getActiveSSOUser();
    const currentProf = getUserProfile();
    const currentId = getActiveIdentity();
    setUser(currentAuth);
    setUserProfile(currentProf);
    setActiveIdentityState(currentId);
  }, []);

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

  const loginPhone = useCallback((phoneNumber: string, name: string, customUsername?: string, customAvatar?: string): AuthUser => {
    const loggedInUser = ssoLoginWithPhone(phoneNumber, name, customUsername, customAvatar);
    setUser(loggedInUser);
    const updatedProfile = getUserProfile();
    setUserProfile(updatedProfile);
    setActiveIdentityState(getActiveIdentity());
    return loggedInUser;
  }, []);

  const loginGmail = useCallback((email: string, name: string, customAvatar?: string, customUsername?: string): AuthUser => {
    const loggedInUser = ssoLoginWithGmail(email, name, customAvatar, customUsername);
    setUser(loggedInUser);
    const updatedProfile = getUserProfile();
    setUserProfile(updatedProfile);
    setActiveIdentityState(getActiveIdentity());
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    const guestUser = ssoLogout();
    setUser(guestUser);
    refreshAuth();
  }, [refreshAuth]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    const current = getUserProfile();
    const updated: UserProfile = {
      ...current,
      ...updates,
    };
    doSaveUserProfile(updated);
    setUserProfile(updated);

    // Also sync with AuthUser & ActiveIdentity
    const currentAuth = getActiveSSOUser();
    const updatedAuth: AuthUser = {
      ...currentAuth,
      name: updated.name || currentAuth.name,
      username: updated.username || currentAuth.username,
      avatar: updated.avatar || currentAuth.avatar,
    };
    persistSSOSession(updatedAuth);
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
  }, []);

  const switchIdentity = useCallback((identity: PostingIdentity) => {
    doSetActiveIdentity(identity);
    setActiveIdentityState(identity);
  }, []);

  const isAuthenticated = user.authType !== 'guest';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        activeIdentity,
        isAuthenticated,
        sessionToken: user.sessionToken || null,
        metfaId: user.metfaId || 'MID-GUEST',
        loginPhone,
        loginGmail,
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
