import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { RotateCw, Sparkles, X } from 'lucide-react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import { SocialEcosystemModule, SocialSubTab } from './features/social';
import { getDailyCredits, addRewardCredits, DailyCreditsData } from './utils/creditManager';
import { useAuth } from './context/AuthContext';
import { initV2IntegrationListeners } from './services/v2IntegrationAdapter';

// Lazy-load genuinely heavy, non-initial features & modals
const AIStudioModule = lazy(() => import('./features/ai-studio'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const RewardedAdModal = lazy(() => import('./components/RewardedAdModal'));
const CreatePageModal = lazy(() => import('./components/CreatePageModal'));
const CreateGroupModal = lazy(() => import('./components/CreateGroupModal'));
const AISettingsModal = lazy(() => import('./components/AISettingsModal'));
const V2Dashboard = lazy(() => import('./components/v2/V2Dashboard'));

export function App() {
  const { userProfile, isAuthenticated, metfaId } = useAuth();

  // App Navigation: Social-First Architecture - Sync with PWA shortcuts and URL query params
  const [activeTab, setActiveTab] = useState<'chat' | 'v2' | SocialSubTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'chat') return 'chat';
      if (tabParam === 'v2') return 'v2';
      if (tabParam && ['feed', 'reels', 'notifications', 'live', 'pages', 'groups', 'profile'].includes(tabParam)) {
        return tabParam as SocialSubTab;
      }
    } catch {}
    return 'feed';
  });

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
      window.open('https://shop.metfaai.com', '_blank', 'noopener,noreferrer');
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

  // Listen for PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    const handleSwUpdated = (e: any) => {
      if (e.detail && e.detail.waiting) {
        setWaitingWorker(e.detail.waiting);
        setPwaUpdateAvailable(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('swUpdated', handleSwUpdated);

    // Cross-app navigation & deep link listener (for Social Posts, Sellme & AliExpress Marketplace)
    const handleCheckHashRoute = () => {
      try {
        const rawHash = window.location.hash || '';
        const urlParams = new URLSearchParams(window.location.search);
        const targetTab = urlParams.get('tab') || urlParams.get('route');

        if (
          rawHash.startsWith('#post-') ||
          rawHash.startsWith('#/post-') ||
          rawHash.startsWith('#post_') ||
          targetTab === 'feed'
        ) {
          setActiveTab('feed');
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

    // Initialize non-destructive V2 Integration Event Listeners
    const cleanupV2 = initV2IntegrationListeners();

    return () => {
      cleanupV2();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('swUpdated', handleSwUpdated);
      window.removeEventListener('hashchange', handleCheckHashRoute);
      window.removeEventListener('metfa_open_marketplace', handleOpenMarketplace);
      window.removeEventListener('metfa_open_chat', handleOpenChat);
      window.removeEventListener('metfa_view_profile', handleOpenProfile);
      window.removeEventListener('metfa_open_auth_modal', handleOpenAuth);
      window.removeEventListener('metfa_open_api_keys_modal', handleOpenApiKeys);
    };
  }, [handleViewProfile, handleNavigateTab, isAuthenticated]);

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
    }
    window.location.reload();
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
