import React from 'react';
import {
  Sparkles,
  Sliders,
  Zap,
  Users,
  Compass,
  Film,
  Radio,
  FileText,
  User
} from 'lucide-react';
import { DailyCreditsData } from '../utils/creditManager';
import NotificationDropdown from './NotificationDropdown';
import CreditsBadge from './CreditsBadge';

interface HeaderProps {
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
  creditsData: DailyCreditsData;
  onWatchAdClick?: () => void;
  onOpenSettings?: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNavigateTab,
  creditsData,
  onWatchAdClick,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div
          onClick={() => onNavigateTab('chat')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-400 p-0.5 shadow-lg shadow-purple-600/30 group-hover:scale-105 transition transform">
            <div className="w-full h-full bg-gray-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-teal-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black tracking-tight text-white group-hover:text-purple-300 transition">
                Metfa <span className="bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">AI</span>
              </h1>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-800/80">
                Studio
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium hidden sm:block">
              Multimodal Vision & Creative Ecosystem
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-gray-900/60 p-1.5 rounded-2xl border border-gray-800">
          <button
            type="button"
            onClick={() => onNavigateTab('chat')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Studio</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('feed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'feed'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Feed</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('reels')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'reels'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Reels</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('live')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'live'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>Live Studio</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('pages')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'pages'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Pages</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('groups')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'groups'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Groups</span>
          </button>
        </nav>

        {/* Right Section: Credits Badge, Notifications, Settings, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Daily Credits Badge */}
          <CreditsBadge creditsData={creditsData} onWatchAdClick={onWatchAdClick} compact={true} />

          {/* Notifications Dropdown */}
          <NotificationDropdown onNavigateTab={onNavigateTab} />

          {/* Studio Settings Drawer Button */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition"
              title="Studio Configuration"
            >
              <Sliders className="w-5 h-5" />
            </button>
          )}

          {/* User Profile Avatar */}
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            className={`w-9 h-9 rounded-2xl overflow-hidden border-2 transition ${
              activeTab === 'profile'
                ? 'border-purple-500 ring-2 ring-purple-500/30'
                : 'border-gray-700 hover:border-gray-500'
            }`}
            title="Your Profile"
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
              alt="User Avatar"
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
