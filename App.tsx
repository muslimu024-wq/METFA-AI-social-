import React, { useState, useEffect, useCallback } from 'react';
import { RotateCw, Sparkles, X } from 'lucide-react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import AuthModal from './components/AuthModal';
import ApiKeysModal from './components/ApiKeysModal';
import RewardedAdModal from './components/RewardedAdModal';
import CreatePageModal from './components/CreatePageModal';
import CreateGroupModal from './components/CreateGroupModal';
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
  const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);
  const [isRewardedAdOpen, setIsRewardedAdOpen] = useState(false);
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Automatically dismiss all active modals and overlays when navigating between tabs
  useEffect(() => {
    setIsAuthModalOpen(false);
    setIsApiKeysOpen(false);
    setIsRewardedAdOpen(false);
    setIsCreatePageOpen(false);
    setIsCreateGroupOpen(false);
    setShareModalData(null);
  }, [activeTab]);

  // PWA Install Prompt & Standalone Mode Detection
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    try {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      );
    } catch {
      return false;
    }
  });
  const [pwaUpdateAvailable, setPwaUpdateAvailable] = useState<boolean>(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // PWA Lifecycle Event Handlers
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      console.log('[PWA] Metfa Social installed successfully as PWA!');
    };

    const handlePwaUpdate = (e: any) => {
      if (e.detail?.registration) {
        setSwRegistration(e.detail.registration);
      }
      setPwaUpdateAvailable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('metfa_pwa_update_available', handlePwaUpdate);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('metfa_pwa_update_available', handlePwaUpdate);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        console.log('[PWA] User accepted installation prompt');
        setInstallPrompt(null);
      }
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err);
    }
  };

  const handleApplyUpdate = () => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  // Cross-Module Bridge State: Share AI Studio Creation to Social Feed
  const [shareModalData, setShareModalData] = useState<{
    prompt: string;
    imageSrc: string;
    stylePreset?: string;
  } | null>(null);

  // Synchronize credits
  useEffect(() => {
    const handleCreditsUpdate = (e: any) => {
      if (e.detail) {
        setCreditsData(e.detail);
      }
    };
    window.addEventListener('metfa_credits_updated', handleCreditsUpdate);
    return () => window.removeEventListener('metfa_credits_updated', handleCreditsUpdate);
  }, []);

  const handleRewardClaimed = (amount: number) => {
    const updated = addRewardCredits(amount);
    setCreditsData(updated);
  };

  // Cross-Module Action: Remix prompt from Social post into AI Studio
  const handleRemixPrompt = useCallback((prompt: string, stylePreset?: string) => {
    handleNavigateTab('chat');
    // Dispatch event for AI Studio to catch prompt remix
    window.dispatchEvent(
      new CustomEvent('metfa_remix_prompt', {
        detail: { prompt, stylePreset },
      })
    );
  }, [handleNavigateTab]);

  const isSocialTab = activeTab !== 'chat';

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 font-sans antialiased overflow-hidden select-none">
      {/* PWA New Version Update Banner */}
      {pwaUpdateAvailable && (
        <div className="bg-gradient-to-r from-purple-700 via-teal-600 to-indigo-700 text-white text-xs px-4 py-2 flex items-center justify-between shadow-lg z-50 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
            <span className="font-semibold">New Metfa Social update available!</span>
            <span className="hidden sm:inline text-purple-100">Get the latest AI models & social features.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApplyUpdate}
              className="px-3 py-1 bg-white text-purple-900 font-bold rounded-lg hover:bg-purple-50 transition flex items-center gap-1.5 shadow-sm"
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
        onOpenApiKeysModal={() => setIsApiKeysOpen(true)}
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
            onOpenApiKeysModal={() => setIsApiKeysOpen(true)}
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

      {/* 5. Global API Secrets & Key Configuration Modal */}
      <ApiKeysModal
        isOpen={isApiKeysOpen}
        onClose={() => setIsApiKeysOpen(false)}
      />

      {/* 6. Prompt Credits Refill Modal */}
      <RewardedAdModal
        isOpen={isRewardedAdOpen}
        onClose={() => setIsRewardedAdOpen(false)}
        onRewardClaimed={handleRewardClaimed}
      />

      {/* 7. Quick Page Creation Modal */}
      <CreatePageModal
        isOpen={isCreatePageOpen}
        onClose={() => setIsCreatePageOpen(false)}
        userProfile={userProfile}
      />

      {/* 8. Quick Group Creation Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        userProfile={userProfile}
      />
    </div>
  );
}

export default App;
