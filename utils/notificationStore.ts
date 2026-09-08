import { AppNotification, NotificationType } from '../types/notification';
import { GUEST_AVATAR, sanitizeAvatarUrl } from '../services/authService';

const STORAGE_KEY = 'metfa_notifications_v2';

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_welcome',
    type: 'system',
    title: 'Welcome to Metfa Social ✨',
    message: 'Explore next-generation multimodal vision intelligence, creative inpainting, Reels, Pages, and Live Broadcasting.',
    timestamp: 'Just now',
    isRead: false,
    actor: {
      name: 'Metfa Social',
      username: 'metfa.system',
      avatar: GUEST_AVATAR,
    },
    linkTab: 'feed',
  },
  {
    id: 'notif_credits',
    type: 'credits_refill',
    title: 'Daily Prompt Credits Refreshed',
    message: 'Your 10 free daily multimodal generation credits have been renewed for today!',
    timestamp: '1h ago',
    isRead: false,
    actor: {
      name: 'Credit Manager',
      username: 'credits',
      avatar: GUEST_AVATAR,
    },
    linkTab: 'chat',
  },
];

export const getNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data.filter((n) => n.actor?.name !== 'Elena Rostova' && n.actor?.name !== 'Marcus Vance');
      }
    }
  } catch (err) {
    console.error('Error reading notifications:', err);
  }
  return INITIAL_NOTIFICATIONS;
};

export const saveNotifications = (notifications: AppNotification[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent('metfa_notifications_updated', { detail: notifications }));
  } catch (err) {
    console.error('Error saving notifications:', err);
  }
};

export const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>): AppNotification => {
  const current = getNotifications();
  const newNotif: AppNotification = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: 'Just now',
    isRead: false,
  };
  const updated = [newNotif, ...current].slice(0, 50);
  saveNotifications(updated);
  return newNotif;
};

export const markAllNotificationsAsRead = (): void => {
  const current = getNotifications();
  const updated = current.map((n) => ({ ...n, isRead: true }));
  saveNotifications(updated);
};

export const markNotificationAsRead = (id: string): void => {
  const current = getNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  saveNotifications(updated);
};
