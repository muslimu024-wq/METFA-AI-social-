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
  | 'follow'
  | 'follow_request'
  | 'follow_approved'
  | 'login'
  | 'account_switch';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actor?: {
    id?: string;
    name: string;
    username: string;
    avatar: string;
  };
  linkTab?: string;
  thumbnail?: string;
  followRequestId?: string;
}
