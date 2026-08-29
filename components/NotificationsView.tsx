import React, { useState, useEffect } from 'react';
import {
  Bell,
  Heart,
  Sparkles,
  Zap,
  Users,
  FileText,
  CheckCheck,
  Trash2,
  Filter,
  ArrowRight,
  Clock,
  ShieldCheck,
  Crown
} from 'lucide-react';
import { AppNotification, NotificationType } from '../types/notification';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  saveNotifications
} from '../utils/notificationStore';

interface NotificationsViewProps {
  onNavigateTab: (tabId: string) => void;
  onWatchAdClick?: () => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onNavigateTab,
  onWatchAdClick,
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'rewards' | 'social'>('all');

  const loadNotifications = () => {
    setNotifications(getNotifications());
  };

  useEffect(() => {
    loadNotifications();

    const handleUpdate = (e: any) => {
      if (e.detail) setNotifications(e.detail);
    };

    window.addEventListener('metfa_notifications_updated', handleUpdate);
    return () => window.removeEventListener('metfa_notifications_updated', handleUpdate);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
    if (notif.linkTab) {
      onNavigateTab(notif.linkTab);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleClearAll = () => {
    saveNotifications([]);
    setNotifications([]);
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filterType === 'unread') return !notif.isRead;
    if (filterType === 'rewards') return notif.type === 'ad_reward' || notif.type === 'credits_refill';
    if (filterType === 'social') return notif.type === 'like' || notif.type === 'remix' || notif.type === 'comment' || notif.type === 'group_created' || notif.type === 'page_created';
    return true;
  });

  const renderIcon = (type: NotificationType) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />;
      case 'remix':
      case 'generation_done':
        return <Sparkles className="w-4 h-4 text-teal-400" />;
      case 'credits_refill':
      case 'ad_reward':
        return <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />;
      case 'group_created':
        return <Users className="w-4 h-4 text-indigo-400" />;
      case 'page_created':
        return <FileText className="w-4 h-4 text-purple-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto bg-gray-950 px-3 sm:px-6 py-4 md:py-6 scrollbar-thin">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* View Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900/90 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Stay updated with AI generation results, rewards, and community activity</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-teal-300 hover:text-teal-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="p-2 rounded-xl bg-gray-800/80 hover:bg-rose-950/60 text-gray-400 hover:text-rose-400 transition"
                title="Clear all notifications"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Alerts' },
            { id: 'unread', label: `Unread (${unreadCount})` },
            { id: 'rewards', label: 'Rewards & Coins' },
            { id: 'social', label: 'Community & Remixes' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                filterType === tab.id
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                  : 'bg-gray-900/80 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-850'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification Cards List */}
        <div className="space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center bg-gray-900/40 rounded-3xl border border-gray-800/80 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-800/60 flex items-center justify-center mx-auto text-gray-500">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-gray-300">No notifications found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                When you create AI art, receive likes or remixes, or claim video ad rewards, updates will show up here.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-3.5 items-start relative group ${
                  !notif.isRead
                    ? 'bg-purple-950/30 border-purple-500/40 hover:bg-purple-950/40 shadow-md shadow-purple-950/20'
                    : 'bg-gray-900/80 border-gray-800/80 hover:bg-gray-850/90 text-gray-300'
                }`}
              >
                {/* Icon avatar */}
                <div className="relative shrink-0 mt-0.5">
                  <img
                    src={notif.actor?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt="Actor"
                    className="w-10 h-10 rounded-2xl object-cover border border-gray-700 shadow-sm"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-gray-900 border border-gray-800 shadow-md">
                    {renderIcon(notif.type)}
                  </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-sm font-bold truncate ${!notif.isRead ? 'text-white' : 'text-gray-200'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[11px] text-gray-500 shrink-0 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {notif.timestamp}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>

                  {notif.linkTab && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-purple-400 group-hover:text-teal-300 transition">
                      <span>View in {notif.linkTab === 'chat' ? 'AI Studio' : notif.linkTab.toUpperCase()}</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  )}
                </div>

                {/* Unread indicator dot */}
                {!notif.isRead && (
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-400 to-teal-400 shrink-0 mt-1 shadow-sm shadow-purple-500/50" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsView;
