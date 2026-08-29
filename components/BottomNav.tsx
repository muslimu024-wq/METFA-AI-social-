import React, { useState, useEffect } from 'react';
import {
  Home,
  Sparkles,
  Film,
  Bell,
  User
} from 'lucide-react';
import { getNotifications } from '../utils/notificationStore';

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

  // 5 Balanced Navigation Tabs (Home, AI Tools, Reels, Notifications, Profile)
  const tabs = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'chat', label: 'AI Tools', icon: Sparkles },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="shrink-0 w-full bg-gray-950/95 backdrop-blur-xl border-t border-gray-800/90 py-1.5 px-2 sm:px-4 z-40">
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
              onClick={() => onNavigateTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-2xl transition relative group cursor-pointer ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1.5 rounded-xl transition ${
                    isActive
                      ? 'bg-gradient-to-tr from-purple-600 to-teal-500 shadow-md shadow-purple-600/30 text-white'
                      : 'group-hover:bg-gray-850 text-gray-400 group-hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Unread badge count for Notifications tab */}
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 bg-gradient-to-r from-pink-500 to-rose-500 text-[10px] font-black text-white rounded-full flex items-center justify-center shadow-md animate-pulse">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </div>

              <span
                className={`text-[10px] font-bold mt-1 tracking-tight whitespace-nowrap ${
                  isActive ? 'text-purple-300 font-extrabold' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>

              {isActive && (
                <div className="absolute -bottom-1 w-5 h-0.5 bg-gradient-to-r from-purple-400 to-teal-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
