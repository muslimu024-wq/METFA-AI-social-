import { UserProfile } from './community';

export type ConversationType = 'direct' | 'group' | 'page' | 'marketplace';

export type MessageType = 'text' | 'image' | 'video' | 'voice';

export interface MessageMediaMetadata {
  duration?: number; // duration in seconds for audio / video
  size?: number; // file size in bytes
  mimeType?: string;
  fileName?: string;
  width?: number;
  height?: number;
  waveform?: number[];
}

export interface ConversationMember {
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt?: string;
  profile?: UserProfile;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  mediaUrl?: string;
  mediaMetadata?: MessageMediaMetadata;
  createdAt: string;
  updatedAt?: string;
  isRead?: boolean;
  senderProfile?: UserProfile;
  isPending?: boolean; // Client-side optimistic status
  error?: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  members: ConversationMember[];
  unreadCount: number;
  partnerProfile?: UserProfile;
  partnerId?: string;
  lastMessage?: Message;
}

export interface SendMessagePayload {
  conversationId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  mediaUrl?: string;
  mediaMetadata?: MessageMediaMetadata;
}
