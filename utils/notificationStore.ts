import { AppNotification, NotificationType } from '../types/notification';

const STORAGE_KEY = 'metfa_notifications_v2';

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_welcome',
    type: 'system',
    title: 'Welcome to Metfa AI Studio ✨',
    message: 'Explore next-generation multimodal vision intelligence, creative inpainting, 90s Reels, Pages, and Live Broadcasting.',
    timestamp: 'Just now',
    isRead: false,
    actor: {
      name: 'Metfa AI System',
      username: 'metfa.system',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    },
    linkTab: 'chat',
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
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    linkTab: 'chat',
  },
  {
    id: 'notif_trending_reel',
    type: 'remix',
    title: 'Trending AI Reel Highlight',
    message: 'Check out the new Neon Cyberpunk scene generation highlight created in Metfa Studio.',
    timestamp: '3h ago',
    isRead: true,
    actor: {
      name: 'Elena Rostova',
      username: 'elena_ai',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    linkTab: 'reels',
  },
];

export const getNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
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
