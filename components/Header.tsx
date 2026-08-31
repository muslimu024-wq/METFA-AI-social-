import React, { useState } from 'react';
import {
  Sparkles,
  Key,
  Zap,
  Users,
  Compass,
  Film,
  Radio,
  FileText,
  User,
  Menu,
  X,
  Plus,
  LogIn,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Settings,
  HelpCircle,
  Sliders,
  Search,
  CheckCircle2,
  ExternalLink,
  Crown,
  Download,
  ShoppingBag,
} from 'lucide-react';
import { DailyCreditsData } from '../utils/creditManager';
import { getPages, getGroups } from '../utils/socialStore';
import { useAuth } from '../context/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import GlobalSearchBar from './GlobalSearchBar';
import AISettingsDropdown from './AISettingsDropdown';

interface HeaderProps {
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
  creditsData: DailyCreditsData;
  onWatchAdClick?: () => void;
  onOpenSettings?: () => void;
  onOpenAuthModal?: () => void;
  onCreatePageClick?: () => void;
  onCreateGroupClick?: () => void;
  unreadCount?: number;
  installPrompt?: any;
  onInstallPwa?: () => void;
  isStandalone?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNavigateTab,
  creditsData,
  onWatchAdClick,
  onOpenSettings,
  onOpenAuthModal,
  onCreatePageClick,
  onCreateGroupClick,
  installPrompt,
  onInstallPwa,
  isStandalone,
}) => {
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
  const { user: authUser, activeIdentity, logout } = useAuth();
  const pages = getPages();
  const groups = getGroups();

  // Automatically close side drawer when active tab changes
  React.useEffect(() => {
    setIsSideDrawerOpen(false);
  }, [activeTab]);

  const handleNavigate = (tab: string) => {
    onNavigateTab(tab);
    setIsSideDrawerOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/80 transition-all">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          {/* Left: Drawer Menu + App Logo + Metfa Social Brand Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* [Menu Drawer] */}
            <button
              type="button"
              id="header-menu-drawer-btn"
              onClick={() => setIsSideDrawerOpen(true)}
              className="p-2 rounded-xl text-gray-300 hover:text-white bg-gray-900 border border-gray-800 hover:border-purple-500/50 transition cursor-pointer shrink-0"
              title="Open Shortcuts Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* [App Logo] and [Full Title: "metfa Social"] */}
            <div
              onClick={() => onNavigateTab('feed')}
              className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
              title="Metfa Social - Home Feed"
            >
              <img
                src="/logo.png"
                alt="Metfa Social Official Logo"
                className="w-9 h-9 min-w-[36px] max-w-[36px] min-h-[36px] max-h-[36px] rounded-2xl shadow-md shadow-blue-950/60 group-hover:scale-105 transition-transform shrink-0 object-cover block pointer-events-none"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/metfa-emblem.png';
                }}
              />
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white group-hover:text-blue-300 transition whitespace-nowrap flex items-baseline gap-1">
                <span className="font-black text-white text-base sm:text-lg tracking-tight">metfa</span>
                <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent font-bold text-xs sm:text-sm">Social</span>
              </h1>
            </div>
          </div>

          {/* Right: [Search Icon] -> [Sellme Marketplace] -> [AI Settings Menu (Conditional: AI Tools Only)] -> [User Profile Avatar] */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* [Search Icon] (Opens Global Search Dialog with speech dictation, tags & group filters) */}
            <GlobalSearchBar onNavigateTab={onNavigateTab} />

            {/* [Sellme Marketplace Navigation Link] */}
            <a
              id="header-sellme-marketplace-btn"
              href="https://shop.metfaai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gray-900/90 hover:bg-purple-950/70 border border-gray-800 hover:border-purple-500/60 flex items-center justify-center text-gray-300 hover:text-teal-300 transition shrink-0 active:scale-95 shadow-sm group"
              title="Sellme Marketplace (shop.metfaai.com)"
            >
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:scale-110 transition-transform text-purple-300 group-hover:text-teal-300" />
            </a>

            {/* [AI Settings Dropdown Menu] - Rendered ONLY on "AI Tools" (chat) tab */}
            {activeTab === 'chat' && (
              <AISettingsDropdown
                onOpenSettings={onOpenSettings}
                onNavigateTab={onNavigateTab}
              />
            )}

            {/* [User Profile Avatar] */}
            <button
              type="button"
              id="header-user-profile-btn"
              onClick={() => onNavigateTab('profile')}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden border-2 transition shrink-0 shadow-sm active:scale-95 cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-purple-500 ring-2 ring-purple-500/30'
                  : 'border-gray-700 hover:border-purple-400'
              }`}
              title="View User Profile"
            >
              <img
                src={activeIdentity.avatar || authUser.avatar}
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out Menu / Drawer (Facebook UX Pattern) */}
      {isSideDrawerOpen && (
        <div
          onClick={() => setIsSideDrawerOpen(false)}
          className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-84 max-w-[88vw] bg-gray-950 border-r border-gray-800 h-full p-5 overflow-y-auto flex flex-col justify-between shadow-2xl"
          >
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/logo.png"
                    alt="Metfa Social"
                    className="w-8 h-8 min-w-[32px] max-w-[32px] min-h-[32px] max-h-[32px] rounded-xl shadow-md shrink-0 object-cover block pointer-events-none"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/metfa-emblem.png';
                    }}
                  />
                  <div>
                    <h3 className="text-sm font-black text-white">Menu & Shortcuts</h3>
                    <p className="text-[10px] text-gray-400">Metfa Social & AI Ecosystem</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSideDrawerOpen(false)}
                  className="p-1.5 rounded-full bg-gray-800 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. REAL LOGGED-IN USER PROFILE HEADER */}
              <div
                onClick={() => handleNavigate('profile')}
                className="p-3.5 bg-gradient-to-r from-purple-950/60 to-gray-900 rounded-2xl border border-purple-500/30 flex items-center gap-3 cursor-pointer hover:border-purple-500/60 transition shadow-md group"
              >
                <div className="relative shrink-0">
                  <img
                    src={authUser.avatar || activeIdentity.avatar}
                    alt={authUser.name}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-purple-400 shadow-sm"
                  />
                  {authUser.isVerified && (
                    <div className="absolute -bottom-1 -right-1 bg-teal-500 rounded-full p-0.5 border border-black">
                      <ShieldCheck className="w-3 h-3 text-black" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black text-white truncate">{authUser.name}</h4>
                    {authUser.authType !== 'guest' && (
                      <span className="text-[9px] px-1.5 py-0.2 bg-teal-950 border border-teal-800 text-teal-300 rounded font-semibold shrink-0">
                        SSO
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-teal-400 font-mono font-bold truncate">@{authUser.username}</p>
                  <p className="text-[9px] text-purple-300/80 font-mono truncate">ID: {authUser.metfaId || authUser.id}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 transition" />
              </div>

              {/* 2. Main Navigation Shortcuts */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 block mb-1">
                  Main Shortcuts
                </span>

                <button
                  type="button"
                  onClick={() => handleNavigate('feed')}
                  className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition ${
                    activeTab === 'feed'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-900'
                  }`}
                >
                  <Compass className="w-4 h-4 text-purple-300" />
                  <span>Community Feed</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('chat')}
                  className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition ${
                    activeTab === 'chat'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-teal-300" />
                  <span>AI Tools & Studio</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('reels')}
                  className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition ${
                    activeTab === 'reels'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-900'
                  }`}
                >
                  <Film className="w-4 h-4 text-pink-300" />
                  <span>90s Reels</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('groups')}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition ${
                    activeTab === 'groups'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-amber-300" />
                    <span>Groups & Hubs</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 bg-gray-800 rounded-full text-gray-400 font-normal">
                    {groups.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('pages')}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition ${
                    activeTab === 'pages'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-blue-300" />
                    <span>Pages & Channels</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 bg-gray-800 rounded-full text-gray-400 font-normal">
                    {pages.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('live')}
                  className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition ${
                    activeTab === 'live'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-900'
                  }`}
                >
                  <Radio className="w-4 h-4 text-rose-400" />
                  <span>Go Live / Broadcasts</span>
                </button>

                <a
                  href="https://shop.metfaai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-gray-300 hover:bg-gray-900 hover:text-teal-300 transition"
                  title="Sellme Marketplace (shop.metfaai.com)"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="w-4 h-4 text-teal-400" />
                    <span>Sellme Marketplace</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </a>
              </div>

              {/* 3. FEATURED SAMPLE CREATORS & PAGES */}
              <div className="pt-3 border-t border-gray-800 space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Featured Creators & Pages
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavigate('pages')}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-1.5">
                  {pages.slice(0, 3).map((page) => (
                    <div
                      key={page.id}
                      onClick={() => handleNavigate('pages')}
                      className="p-2 bg-gray-900/60 hover:bg-gray-900 rounded-xl border border-gray-850 hover:border-gray-750 flex items-center justify-between cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={page.avatar}
                          alt={page.name}
                          className="w-7 h-7 rounded-lg object-cover shrink-0 border border-gray-750"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-200 truncate flex items-center gap-1">
                            <span>{page.name}</span>
                            {page.isVerified && <ShieldCheck className="w-3 h-3 text-teal-400 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono truncate">
                            {page.category} • {page.followersCount.toLocaleString()} fans
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-500 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Quick Actions */}
              <div className="pt-3 border-t border-gray-800 space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 block mb-1">
                  Create & Manage
                </span>

                {onCreatePageClick && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSideDrawerOpen(false);
                      onCreatePageClick();
                    }}
                    className="w-full py-2 px-3 bg-gray-900 hover:bg-gray-850 border border-gray-800 text-purple-300 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Creator Page</span>
                  </button>
                )}

                {onCreateGroupClick && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSideDrawerOpen(false);
                      onCreateGroupClick();
                    }}
                    className="w-full py-2 px-3 bg-gray-900 hover:bg-gray-850 border border-gray-800 text-teal-300 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Create New Group</span>
                  </button>
                )}

                {authUser.authType === 'guest' ? (
                  onOpenAuthModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSideDrawerOpen(false);
                        onOpenAuthModal();
                      }}
                      className="w-full py-2 px-3 bg-gradient-to-r from-purple-600 to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Phone / Gmail Login</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSideDrawerOpen(false);
                      logout();
                    }}
                    className="w-full py-2 px-3 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Log Out (@{authUser.username})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-gray-800 space-y-2 text-xs text-gray-400">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSideDrawerOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full py-2 px-3 rounded-xl hover:bg-gray-900 flex items-center gap-2 text-gray-300 hover:text-white transition"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span>Studio & Multi-AI Settings</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsSideDrawerOpen(false);
                  window.dispatchEvent(new CustomEvent('metfa_open_api_keys_modal'));
                }}
                className="w-full py-2 px-3 rounded-xl hover:bg-teal-950/40 border border-teal-500/20 hover:border-teal-500/50 flex items-center justify-between text-teal-300 hover:text-teal-200 transition"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-teal-400" />
                  <span>App Secrets & API Keys</span>
                </div>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-mono">
                  BYOK
                </span>
              </button>

              {/* PWA Install Button (When browser supports install prompt) */}
              {onInstallPwa && installPrompt && (
                <button
                  type="button"
                  id="drawer-install-pwa-btn"
                  onClick={() => {
                    setIsSideDrawerOpen(false);
                    onInstallPwa();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-teal-950/60 to-purple-950/60 border border-teal-500/40 hover:border-teal-400 flex items-center justify-between text-teal-300 hover:text-white transition group"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-teal-400 group-hover:translate-y-0.5 transition-transform" />
                    <span className="font-bold">Install Metfa App</span>
                  </div>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded-full font-semibold">PWA</span>
                </button>
              )}

              {/* PWA Active Status (When running in standalone display mode) */}
              {isStandalone && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900/60 border border-gray-800/80 text-[11px] text-teal-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Metfa Social Desktop/Mobile App (Installed)</span>
                </div>
              )}

              <div className="text-[10px] text-gray-500 px-3">
                Metfa Social v2.6 • Unified Creator & AI Ecosystem
              </div>
            </div>
          </div>

          <div className="flex-1 cursor-pointer" onClick={() => setIsSideDrawerOpen(false)} />
        </div>
      )}
    </>
  );
};

export default Header;
