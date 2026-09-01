import React, { useState, useEffect, useCallback } from 'react';
import { RotateCw, Sparkles, X } from 'lucide-react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import AuthModal from './components/AuthModal';
import RewardedAdModal from './components/RewardedAdModal';
import CreatePageModal from './components/CreatePageModal';
import CreateGroupModal from './components/CreateGroupModal';
import AISettingsModal from './components/AISettingsModal';
import { AIStudioModule } from './features/ai-studio';
import { SocialEcosystemModule, SocialSubTab } from './features/social';
import { getDailyCredits, addRewardCredits, DailyCreditsData } from './utils/creditManager';
import { useAuth } from './context/AuthContext';

export function App() {
  const { userProfile, isAuthenticated, metfaId } = useAuth();

  // App Navigation: Social-First Architecture - Sync with PWA shortcuts and URL query params
  const [activeTab, setActiveTab] = useState<'chat' | SocialSubTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'chat') return 'chat';
      if (tabParam && ['feed', 'reels', 'notifications', 'live', 'pages', 'groups', 'profile'].includes(tabParam)) {
        return tabParam as SocialSubTab;
      }
    } catch {}
    return 'feed';
  });

  // Keep URL search query aligned with active tab
  const handleNavigateTab = useCallback((tab: string) => {
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

    // Cross-app navigation & deep link listener (for Sellme & AliExpress Marketplace)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetTab = urlParams.get('tab') || urlParams.get('route');
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (targetTab === 'marketplace' || hash === 'marketplace' || urlParams.get('source') === 'sellme') {
        setActiveTab('marketplace');
      }
    } catch {}

    const handleOpenMarketplace = () => setActiveTab('marketplace');
    window.addEventListener('metfa_open_marketplace', handleOpenMarketplace);

    // Global listener to trigger Auth Modal from any deep action
    const handleOpenAuth = () => setIsAuthModalOpen(true);
    const handleOpenApiKeys = () => setIsApiKeysModalOpen(true);
    window.addEventListener('metfa_open_auth_modal', handleOpenAuth);
    window.addEventListener('metfa_open_api_keys_modal', handleOpenApiKeys);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('swUpdated', handleSwUpdated);
      window.removeEventListener('metfa_open_marketplace', handleOpenMarketplace);
      window.removeEventListener('metfa_open_auth_modal', handleOpenAuth);
      window.removeEventListener('metfa_open_api_keys_modal', handleOpenApiKeys);
    };
  }, []);

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

  const isSocialTab = activeTab !== 'chat';

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

      {/* 1. Global Metfa Unified Top Header */}
      <Header
        activeTab={activeTab}
        onNavigateTab={handleNavigateTab}
        creditsData={creditsData}
        onWatchAdClick={() => setIsRewardedAdOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onCreatePageClick={() => setIsCreatePageOpen(true)}
        onCreateGroupClick={() => setIsCreateGroupOpen(true)}
        installPrompt={installPrompt}
        onInstallPwa={handleInstallPwa}
        isStandalone={isStandalone}
      />

      {/* 2. Decoupled Feature Modules Viewport */}
      <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {/* Module A: AI Studio (LLM routing, vision, multimodal tools, settings) */}
        <div className={`w-full h-full flex flex-col flex-1 min-h-0 ${activeTab === 'chat' ? 'flex' : 'hidden'}`}>
          <AIStudioModule
            onShareToSocialFeed={(data) => {
              setShareModalData(data);
              handleNavigateTab('feed');
            }}
            onNavigateToSocial={(tab) => handleNavigateTab(tab)}
          />
        </div>

        {/* Module B: Social Ecosystem (Feed, Reels, Live Streams, Pages, Groups, Profile) */}
        <div className={`w-full h-full flex flex-col flex-1 min-h-0 ${isSocialTab ? 'flex' : 'hidden'}`}>
          <SocialEcosystemModule
            currentTab={isSocialTab ? (activeTab as SocialSubTab) : 'feed'}
            onNavigateTab={handleNavigateTab}
            creditsData={creditsData}
            onWatchAdClick={() => setIsRewardedAdOpen(true)}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onRemixPrompt={handleRemixPrompt}
            shareModalData={shareModalData}
            onCloseShareModal={() => setShareModalData(null)}
          />
        </div>
      </main>

      {/* 3. Global Persistent Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onNavigateTab={handleNavigateTab}
      />

      {/* 4. Global SSO Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* 5. Prompt Credits Refill Modal */}
      <RewardedAdModal
        isOpen={isRewardedAdOpen}
        onClose={() => setIsRewardedAdOpen(false)}
        onRewardClaimed={handleRewardClaimed}
      />

      {/* 6. Quick Page Creation Modal */}
      <CreatePageModal
        isOpen={isCreatePageOpen}
        onClose={() => setIsCreatePageOpen(false)}
        userProfile={userProfile}
      />

      {/* 7. Quick Group Creation Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        userProfile={userProfile}
      />

      {/* 8. App Secrets & AI API Keys Modal */}
      <AISettingsModal
        isOpen={isApiKeysModalOpen}
        onClose={() => setIsApiKeysModalOpen(false)}
      />
    </div>
  );
}

export default App;
