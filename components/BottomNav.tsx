import React, { useState, useEffect } from 'react';
import {
  Home,
  Sparkles,
  Film,
  Bell,
  User
} from 'lucide-react';
import { getNotifications } from '../utils/notificationStore';
import { SellmeLogo } from './SellmeLogo';
import { getSellmeShopUrl } from '../services/marketplaceService';

interface BottomNavProps {
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
  feedCount?: number;
  creditsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigateTab,
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    try {
      return getNotifications().filter((n) => !n.isRead).length;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setUnreadCount(e.detail.filter((n: any) => !n.isRead).length);
      }
    };
    window.addEventListener('metfa_notifications_updated', handleUpdate);
    return () => window.removeEventListener('metfa_notifications_updated', handleUpdate);
  }, []);

  // Navigation Tabs (Home, AI Tools, Reels, Marketplace, Notifications, Profile)
  const tabs = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'chat', label: 'AI Tools', icon: Sparkles },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'marketplace', label: 'Marketplace', isSellme: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="shrink-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200 py-1.5 px-1.5 sm:px-4 z-40 shadow-xs">
      <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto flex items-center justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeTab === tab.id ||
            (tab.id === 'feed' && ['groups', 'pages', 'live'].includes(activeTab));

          return (
            <button
              key={tab.id}
              type="button"
              id={`bottom-nav-${tab.id}-btn`}
              onClick={() => {
                if (tab.id === 'marketplace') {
                  const url = getSellmeShopUrl();
                  window.open(url, '_blank', 'noopener,noreferrer');
                  return;
                }
                onNavigateTab(tab.id);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 sm:px-2 rounded-2xl transition relative group cursor-pointer ${
                isActive
                  ? 'text-purple-700'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title={tab.label}
              aria-label={tab.label}
            >
              <div className="relative flex items-center justify-center">
                {tab.isSellme ? (
                  <div className="p-1.5 rounded-xl transition group-hover:bg-slate-100 flex items-center justify-center">
                    <SellmeLogo className="w-[25px] h-[25px] sm:w-[26px] sm:h-[26px] rounded-md object-contain shrink-0 shadow-2xs group-hover:scale-110 transition-transform" />
                  </div>
                ) : (
                  <div
                    className={`p-2 rounded-xl transition ${
                      isActive
                        ? 'bg-gradient-to-tr from-purple-600 to-teal-500 shadow-sm shadow-purple-600/30 text-white'
                        : 'group-hover:bg-slate-100 text-slate-500 group-hover:text-slate-800'
                    }`}
                  >
                    {Icon && <Icon className="w-5 h-5" />}
                  </div>
                )}

                {/* Unread badge count for Notifications tab */}
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-gradient-to-r from-pink-500 to-rose-500 text-[10px] font-black text-white rounded-full flex items-center justify-center shadow-xs animate-pulse pointer-events-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </div>

              {isActive && (
                <div className="absolute bottom-0.5 w-4 h-0.5 bg-gradient-to-r from-purple-600 to-teal-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
