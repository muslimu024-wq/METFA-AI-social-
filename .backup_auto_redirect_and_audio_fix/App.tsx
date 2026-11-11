import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { RotateCw, Sparkles, X, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import { SocialEcosystemModule, SocialSubTab } from './features/social';
import { getDailyCredits, addRewardCredits, DailyCreditsData } from './utils/creditManager';
import { useAuth } from './context/AuthContext';
import { initV2IntegrationListeners } from './services/v2IntegrationAdapter';
import { getSellmeShopUrl } from './services/marketplaceService';
import { getClientAuthToken } from './services/supabaseClient';

// Lazy-load genuinely heavy, non-initial features & modals
const AIStudioModule = lazy(() => import('./features/ai-studio'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const RewardedAdModal = lazy(() => import('./components/RewardedAdModal'));
const CreatePageModal = lazy(() => import('./components/CreatePageModal'));
const CreateGroupModal = lazy(() => import('./components/CreateGroupModal'));
const AISettingsModal = lazy(() => import('./components/AISettingsModal'));
const V2Dashboard = lazy(() => import('./components/v2/V2Dashboard'));

export function App() {
  const { user, userProfile, isAuthenticated, isSupabaseConnected, sessionToken, metfaId, authNotification, clearAuthNotification } = useAuth();

  // App Navigation: Social-First Architecture - Sync with PWA shortcuts and URL query params
  const [activeTab, setActiveTab] = useState<'chat' | 'v2' | SocialSubTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'chat') return 'chat';
      // Do not allow initial unverified landing on 'v2'; default safely to 'feed'
      if (tabParam && ['feed', 'reels', 'notifications', 'live', 'pages', 'groups', 'profile'].includes(tabParam)) {
        return tabParam as SocialSubTab;
      }
    } catch {}
    return 'feed';
  });

  // Track verified METFA Owner / Admin status and resolution state
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState<boolean>(false);
  const [isOwnerAuthSettled, setIsOwnerAuthSettled] = useState<boolean>(false);

  // Authoritatively check METFA Owner/Admin privileges against /api/v2/auth/owner-check
  useEffect(() => {
    let isMounted = true;

    async function fetchOwnerCheck(bearerToken: string): Promise<Response> {
      return fetch('/api/v2/auth/owner-check', {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
    }

    async function checkOwnerPrivileges() {
      try {
        let token = await getClientAuthToken(false);
        if (!token) {
          if (isMounted) {
            setIsOwnerOrAdmin(false);
            setIsOwnerAuthSettled(true);
          }
          return;
        }

        let res = await fetchOwnerCheck(token);

        // At most one controlled session refresh & retry if token rotated/expired or held stale header bloat
        if (res.status === 401 || res.status === 400) {
          const refreshedToken = await getClientAuthToken(true);
          if (refreshedToken && refreshedToken !== token) {
            token = refreshedToken;
            res = await fetchOwnerCheck(token);
          }
        }

        if (res.ok) {
          const data = await res.json().catch(() => null);
          const authorized = !!data?.authorized;
          if (isMounted) {
            setIsOwnerOrAdmin(authorized);
            setIsOwnerAuthSettled(true);
            if (authorized) {
              try {
                const url = new URL(window.location.href);
                const tab = url.searchParams.get('tab') || url.hash.replace('#', '').toLowerCase();
                if (tab === 'v2') {
                  setActiveTab('v2');
                }
              } catch {}
            }
          }
        } else {
          if (isMounted) {
            setIsOwnerOrAdmin(false);
            setIsOwnerAuthSettled(true);
          }
        }
      } catch {
        if (isMounted) {
          setIsOwnerOrAdmin(false);
          setIsOwnerAuthSettled(true);
        }
      }
    }

    checkOwnerPrivileges();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, sessionToken, user.id, isSupabaseConnected]);

  // Sync activeTab state with document title and URL
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (activeTab === 'feed') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', activeTab);
      }
      if (activeTab !== 'reels' && (url.hash.startsWith('#reel') || url.hash.startsWith('#/reel') || url.hash.startsWith('#reel_'))) {
        url.hash = '';
      }
      if (activeTab !== 'feed' && (url.hash.startsWith('#post') || url.hash.startsWith('#/post') || url.hash.startsWith('#post_'))) {
        url.hash = '';
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [activeTab]);

  // Track if AI Studio module has been activated to defer downloading its heavy bundle until first accessed
  const [hasLoadedChat, setHasLoadedChat] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') === 'chat';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (activeTab === 'chat' && !hasLoadedChat) {
      setHasLoadedChat(true);
    }
  }, [activeTab, hasLoadedChat]);

  // Keep URL search query aligned with active tab
  const handleNavigateTab = useCallback((tab: string) => {
    if (tab === 'marketplace') {
      window.open(getSellmeShopUrl(), '_blank', 'noopener,noreferrer');
      return;
    }
    // Opening normal tabs (including profile tab) clears viewed profile to show authenticated user's profile
    setViewedProfileUserId(null);
    setActiveTab(tab as any);
    try {
      const url = new URL(window.location.href);
      if (tab === 'feed') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tab);
      }
      // When navigating to any tab other than reels, clear any reel hash deep link
      if (tab !== 'reels' && (url.hash.startsWith('#reel') || url.hash.startsWith('#/reel') || url.hash.startsWith('#reel_'))) {
        url.hash = '';
      }
      // When navigating to any tab other than feed, clear any post hash deep link
      if (tab !== 'feed' && (url.hash.startsWith('#post') || url.hash.startsWith('#/post') || url.hash.startsWith('#post_'))) {
        url.hash = '';
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  // Handle viewing another user's profile (e.g. from Chat screen)
  const handleViewProfile = useCallback((targetId: string) => {
    if (!targetId) {
      setViewedProfileUserId(null);
      setActiveTab('profile');
      return;
    }
    setViewedProfileUserId(targetId);
    setActiveTab('profile');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'profile');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  // Shared Credits state for global header & badges
  const [creditsData, setCreditsData] = useState<DailyCreditsData>(() => getDailyCredits());

  // Global App Shell Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRewardedAdOpen, setIsRewardedAdOpen] = useState(false);
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);

  // Automatically dismiss all active modals and overlays when navigating between tabs
  useEffect(() => {
    setIsAuthModalOpen(false);
    setIsRewardedAdOpen(false);
    setIsCreatePageOpen(false);
    setIsCreateGroupOpen(false);
    setIsApiKeysModalOpen(false);
    setShareModalData(null);
  }, [activeTab]);

  // PWA Install Prompt & Standalone Mode Detection
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    try {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    } catch {
      return false;
    }
  });

  // PWA Update Available Notification State
  const [pwaUpdateAvailable, setPwaUpdateAvailable] = useState<boolean>(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  // Global Share to Social Modal Payload
  const [shareModalData, setShareModalData] = useState<{
    prompt: string;
    imageSrc: string;
    stylePreset?: string;
  } | null>(null);

  // Active Direct Chat Target (passed to MessagesModule)
  const [activeChatPartnerId, setActiveChatPartnerId] = useState<string | null>(null);
  const [activeChatPartnerProfile, setActiveChatPartnerProfile] = useState<any | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Active Viewed Profile User ID (distinguishes own profile vs another user's profile)
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(null);

  // Dedicated PWA Install and Service Worker Update Lifecycle Listener
  useEffect(() => {
    // 1. Proactively inspect registration.waiting to prevent missed updates on mount
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          setPwaUpdateAvailable(true);
        }
      }).catch((err) => {
        console.warn('[PWA] Registration check warning:', err);
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    const handleSwUpdated = (e: any) => {
      const worker = e.detail?.waiting || e.detail?.registration?.waiting;
      if (worker) {
        setWaitingWorker(worker);
      }
      setPwaUpdateAvailable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('swUpdated', handleSwUpdated);
    window.addEventListener('metfa_pwa_update_available', handleSwUpdated);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('swUpdated', handleSwUpdated);
      window.removeEventListener('metfa_pwa_update_available', handleSwUpdated);
    };
  }, []);

  // Global App Navigation, Deep Linking & V2 Integration Listeners
  useEffect(() => {
    // Cross-app navigation & deep link listener (for Social Posts, Sellme & AliExpress Marketplace)
    const handleCheckHashRoute = () => {
      try {
        const rawHash = window.location.hash || '';
        const urlParams = new URLSearchParams(window.location.search);
        const targetTab = urlParams.get('tab') || urlParams.get('route');

        // 1. Explicit hash deep links MUST take precedence over URL query parameters
        if (
          rawHash.startsWith('#reel-') ||
          rawHash.startsWith('#/reel-') ||
          rawHash.startsWith('#reel_')
        ) {
          console.log('[Metfa Nav] App.tsx handleCheckHashRoute matched reel hash:', rawHash);
          setActiveTab('reels');
        } else if (
          rawHash.startsWith('#post-') ||
          rawHash.startsWith('#/post-') ||
          rawHash.startsWith('#post_')
        ) {
          setActiveTab('feed');
        } else if (targetTab === 'reels') {
          setActiveTab('reels');
        } else if (targetTab === 'feed') {
          setActiveTab('feed');
        } else if (targetTab === 'chat') {
          setActiveTab('chat');
        } else if (targetTab && ['notifications', 'live', 'pages', 'groups', 'profile'].includes(targetTab)) {
          setActiveTab(targetTab as SocialSubTab);
        } else if (
          targetTab === 'v2' ||
          rawHash.replace('#', '').toLowerCase() === 'v2'
        ) {
          setActiveTab('v2');
        } else if (
          targetTab === 'marketplace' ||
          rawHash.replace('#', '').toLowerCase() === 'marketplace' ||
          urlParams.get('source') === 'sellme'
        ) {
          window.open('https://shop.metfaai.com', '_blank', 'noopener,noreferrer');
          setActiveTab('feed');
        }
      } catch {}
    };

    handleCheckHashRoute();
    window.addEventListener('hashchange', handleCheckHashRoute);

    const handleOpenMarketplace = () => {
      window.open('https://shop.metfaai.com', '_blank', 'noopener,noreferrer');
    };
    window.addEventListener('metfa_open_marketplace', handleOpenMarketplace);

    // Global listener to open chat with a specific user
    const handleOpenChat = (e: any) => {
      const { partnerId, partnerProfile, conversationId } = e.detail || {};
      setActiveChatPartnerId(partnerId || null);
      setActiveChatPartnerProfile(partnerProfile || null);
      setActiveConversationId(conversationId || null);
      handleNavigateTab('messages');
    };
    window.addEventListener('metfa_open_chat', handleOpenChat);

    // Global listener to open profile for a specific user ID
    const handleOpenProfile = (e: any) => {
      const targetId = e.detail?.userId ?? e.detail?.targetId;
      if (targetId) {
        handleViewProfile(targetId);
      } else {
        setViewedProfileUserId(null);
        handleNavigateTab('profile');
      }
    };
    window.addEventListener('metfa_view_profile', handleOpenProfile);

    // Global listener to trigger Auth Modal from any deep action
    const handleOpenAuth = () => {
      if (isAuthenticated) return;
      setIsAuthModalOpen(true);
    };
    const handleOpenApiKeys = () => setIsApiKeysModalOpen(true);
    window.addEventListener('metfa_open_auth_modal', handleOpenAuth);
    window.addEventListener('metfa_open_api_keys_modal', handleOpenApiKeys);

    // Global listener to open reels feed
    const handleOpenReelEvent = () => {
      setActiveTab('reels');
    };
    window.addEventListener('metfa_open_reel', handleOpenReelEvent);

    // Initialize non-destructive V2 Integration Event Listeners
    const cleanupV2 = initV2IntegrationListeners();

    return () => {
      cleanupV2();
      window.removeEventListener('hashchange', handleCheckHashRoute);
      window.removeEventListener('metfa_open_marketplace', handleOpenMarketplace);
      window.removeEventListener('metfa_open_chat', handleOpenChat);
      window.removeEventListener('metfa_view_profile', handleOpenProfile);
      window.removeEventListener('metfa_open_auth_modal', handleOpenAuth);
      window.removeEventListener('metfa_open_api_keys_modal', handleOpenApiKeys);
      window.removeEventListener('metfa_open_reel', handleOpenReelEvent);
    };
  }, [handleViewProfile, handleNavigateTab, isAuthenticated, isOwnerOrAdmin, isOwnerAuthSettled]);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    try {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } catch (err) {
      console.error('PWA Install Error:', err);
    }
  };

  const handleReloadApp = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      navigator.serviceWorker?.addEventListener('controllerchange', () => {
        window.location.reload();
      }, { once: true });
    }
    setTimeout(() => {
      window.location.reload();
    }, 350);
  };

  // Sync credits when updated anywhere in the app
  const refreshCredits = useCallback(() => {
    setCreditsData(getDailyCredits());
  }, []);

  const handleRewardClaimed = useCallback((amount: number) => {
    const updated = addRewardCredits(amount);
    setCreditsData(updated);
    setIsRewardedAdOpen(false);
  }, []);

  // Handle Remixing prompt from Social Feed into AI Studio Chat
  const handleRemixPrompt = useCallback((prompt: string) => {
    handleNavigateTab('chat');
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('metfa_remix_prompt', {
          detail: { prompt },
        })
      );
    }, 150);
  }, [handleNavigateTab]);

  const isSocialTab = activeTab !== 'chat' && activeTab !== 'v2';

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-full bg-slate-50 text-slate-900 overflow-hidden font-sans select-none">
      {/* PWA Update Ready Banner */}
      {pwaUpdateAvailable && (
        <div className="bg-gradient-to-r from-purple-700 via-indigo-600 to-teal-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-md z-50 shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 animate-spin text-teal-300" />
            <span>A new version of Metfa Social is ready!</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReloadApp}
              className="bg-white text-gray-900 font-bold px-3 py-1 rounded-lg text-xs hover:bg-gray-150 transition flex items-center gap-1 shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Update Now</span>
            </button>
            <button
              type="button"
              onClick={() => setPwaUpdateAvailable(false)}
              className="p-1 hover:bg-white/20 rounded-md transition text-white/80 hover:text-white"
              title="Dismiss update notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Global Metfa Unified Top Header (hidden on METFA V2 Dashboard) */}
      {activeTab !== 'v2' && (
        <Header
          activeTab={activeTab}
          onNavigateTab={handleNavigateTab}
          creditsData={creditsData}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onWatchAdClick={() => setIsRewardedAdOpen(true)}
          onOpenAuthModal={() => {
            if (!isAuthenticated) setIsAuthModalOpen(true);
          }}
          onCreatePageClick={() => setIsCreatePageOpen(true)}
          onCreateGroupClick={() => setIsCreateGroupOpen(true)}
          installPrompt={installPrompt}
          onInstallPwa={handleInstallPwa}
          isStandalone={isStandalone}
        />
      )}

      {/* Auth Notification Banner (e.g. email confirmation status or link expiry) */}
      {authNotification && (
        <div
          className={`w-full px-4 py-3 border-b flex items-center justify-between gap-3 text-xs z-30 transition animate-fadeIn ${
            authNotification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : authNotification.type === 'success'
              ? 'bg-teal-50 border-teal-200 text-teal-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {authNotification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : authNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <div className="min-w-0">
              <strong className="font-semibold mr-1.5">{authNotification.title}:</strong>
              <span className="text-slate-700">{authNotification.message}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {authNotification.action === 'signin' && !isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer"
              >
                Sign In
              </button>
            )}
            <button
              type="button"
              onClick={clearAuthNotification}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-black/5 transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Decoupled Feature Modules Viewport */}
      <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {/* Module A: AI Studio (LLM routing, vision, multimodal tools, settings) - lazy-loaded only when requested */}
        <div className={`w-full h-full flex flex-col flex-1 min-h-0 ${activeTab === 'chat' ? 'flex' : 'hidden'}`}>
          {(activeTab === 'chat' || hasLoadedChat) && (
            <Suspense
              fallback={
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  <span className="text-xs font-medium">Loading AI Studio...</span>
                </div>
              }
            >
              <AIStudioModule
                onShareToSocialFeed={(data) => {
                  setShareModalData(data);
                  handleNavigateTab('feed');
                }}
                onNavigateToSocial={(tab) => handleNavigateTab(tab)}
              />
            </Suspense>
          )}
        </div>

        {/* Module B: Social Ecosystem (Feed, Reels, Live Streams, Pages, Groups, Profile) */}
        <div className={`w-full h-full flex flex-col flex-1 min-h-0 ${isSocialTab ? 'flex' : 'hidden'}`}>
          <SocialEcosystemModule
            currentTab={isSocialTab ? (activeTab as SocialSubTab) : 'feed'}
            onNavigateTab={handleNavigateTab}
            creditsData={creditsData}
            onWatchAdClick={() => setIsRewardedAdOpen(true)}
            onOpenAuthModal={() => {
              if (!isAuthenticated) setIsAuthModalOpen(true);
            }}
            onRemixPrompt={handleRemixPrompt}
            shareModalData={shareModalData}
            onCloseShareModal={() => setShareModalData(null)}
            activeChatPartnerId={activeChatPartnerId}
            activeChatPartnerProfile={activeChatPartnerProfile}
            activeConversationId={activeConversationId}
            viewedProfileUserId={viewedProfileUserId}
            onViewProfile={handleViewProfile}
          />
        </div>

        {/* Module C: METFA V2 Dashboard & Reusable Viewport Shell */}
        {activeTab === 'v2' && (
          <div className="w-full h-full flex flex-col flex-1 min-h-0">
            <Suspense
              fallback={
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  <span className="text-xs font-medium">Loading METFA V2 Dashboard...</span>
                </div>
              }
            >
              <V2Dashboard onBackToSocial={() => handleNavigateTab('feed')} />
            </Suspense>
          </div>
        )}
      </main>

      {/* 3. Global Persistent Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onNavigateTab={handleNavigateTab}
      />

      {/* 4. Global SSO Auth Modal */}
      {isAuthModalOpen && !isAuthenticated && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthModalOpen && !isAuthenticated}
            onClose={() => setIsAuthModalOpen(false)}
          />
        </Suspense>
      )}

      {/* 5. Prompt Credits Refill Modal */}
      {isRewardedAdOpen && (
        <Suspense fallback={null}>
          <RewardedAdModal
            isOpen={isRewardedAdOpen}
            onClose={() => setIsRewardedAdOpen(false)}
            onRewardClaimed={handleRewardClaimed}
          />
        </Suspense>
      )}

      {/* 6. Quick Page Creation Modal */}
      {isCreatePageOpen && (
        <Suspense fallback={null}>
          <CreatePageModal
            isOpen={isCreatePageOpen}
            onClose={() => setIsCreatePageOpen(false)}
            userProfile={userProfile}
          />
        </Suspense>
      )}

      {/* 7. Quick Group Creation Modal */}
      {isCreateGroupOpen && (
        <Suspense fallback={null}>
          <CreateGroupModal
            isOpen={isCreateGroupOpen}
            onClose={() => setIsCreateGroupOpen(false)}
            userProfile={userProfile}
          />
        </Suspense>
      )}

      {/* 8. App Secrets & AI API Keys Modal */}
      {isApiKeysModalOpen && (
        <Suspense fallback={null}>
          <AISettingsModal
            isOpen={isApiKeysModalOpen}
            onClose={() => setIsApiKeysModalOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
