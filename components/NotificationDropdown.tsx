import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Heart,
  Sparkles,
  Zap,
  Users,
  Film,
  FileText,
  Volume2,
  X
} from 'lucide-react';
import { AppNotification, NotificationType } from '../types/notification';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from '../utils/notificationStore';

interface NotificationDropdownProps {
  onNavigateTab: (tabId: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onNavigateTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
    if (notif.linkTab) {
      onNavigateTab(notif.linkTab);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const renderIcon = (type: NotificationType) => {
    switch (type) {
      case 'like':
        return <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />;
      case 'remix':
      case 'generation_done':
        return <Sparkles className="w-3.5 h-3.5 text-teal-400" />;
      case 'credits_refill':
      case 'ad_reward':
        return <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />;
      case 'group_created':
        return <Users className="w-3.5 h-3.5 text-indigo-400" />;
      case 'page_created':
        return <FileText className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-gradient-to-r from-pink-500 to-rose-500 text-[10px] font-black text-white rounded-full flex items-center justify-center shadow-md animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-gray-900/95 border border-purple-500/30 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-fadeIn">
          {/* Dropdown Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">Notifications</h4>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-800/60 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">No notifications yet</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex gap-3 items-start cursor-pointer transition hover:bg-gray-800/60 ${
                    !notif.isRead ? 'bg-purple-950/20' : ''
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={notif.actor?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt="Actor"
                      className="w-9 h-9 rounded-xl object-cover border border-gray-700"
                    />
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-gray-900 border border-gray-800">
                      {renderIcon(notif.type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-gray-200 leading-tight mb-0.5 truncate">
                      {notif.title}
                    </h5>
                    <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">{notif.message}</p>
                    <span className="text-[10px] text-gray-500 font-medium mt-1 block">{notif.timestamp}</span>
                  </div>

                  {!notif.isRead && <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0 mt-1" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
