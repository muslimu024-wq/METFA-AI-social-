export type NotificationType =
  | 'like'
  | 'remix'
  | 'comment'
  | 'generation_done'
  | 'credits_refill'
  | 'ad_reward'
  | 'page_created'
  | 'group_created'
  | 'system'
  | 'follow';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actor?: {
    name: string;
    username: string;
    avatar: string;
  };
  linkTab?: string;
  thumbnail?: string;
}
