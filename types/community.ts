import { AudioTrack } from './audio';

export * from './audio';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  location?: string;
  website?: string;
  isVerified?: boolean;
  joinDate: string;
  stats: {
    postsCount: number;
    followersCount: number;
    followingCount: number;
    totalLikes: number;
    reelsCount: number;
  };
}

export interface PostingIdentity {
  type: 'personal' | 'page' | 'group';
  id: string;
  name: string;
  username: string;
  avatar: string;
  badge?: string;
}

export interface VoiceComment {
  id: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
  };
  audioUrl: string;
  duration: number; // in seconds
  timestamp: string;
  waveform?: number[];
  likesCount: number;
  isLiked?: boolean;
}

export interface PostComment {
  id: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
  };
  text: string;
  timestamp: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface CommunityPost {
  id: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
  };
  postingIdentity?: PostingIdentity;
  pageId?: string;
  pageName?: string;
  pageCategory?: string;
  groupId?: string;
  groupName?: string;
  prompt: string;
  caption?: string;
  stylePreset?: string;
  imageSrc?: string;
  imageGallery?: string[];
  videoSrc?: string;
  originalImageSrc?: string;
  textBackgroundPreset?: string; // e.g. 'sunset', 'cyberpunk', 'emerald', 'midnight', 'fire'
  postType?: 'text' | 'media' | 'ai_art';
  likesCount: number;
  remixCount: number;
  commentsCount: number;
  sharesCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  userReaction?: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'fire';
  reactionCounts?: {
    like?: number;
    love?: number;
    haha?: number;
    wow?: number;
    sad?: number;
    fire?: number;
  };
  comments: PostComment[];
  voiceComments?: VoiceComment[];
  createdAt: string;
  tags: string[];
  feedType?: 'for_you' | 'following' | 'trending' | 'page' | 'group';
  audioTrack?: AudioTrack;
}

export interface ReelHighlight {
  id: string;
  title: string;
  caption: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
  };
  videoSrc: string;
  thumbnailSrc?: string;
  duration: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: string;
  promptUsed?: string;
  musicTrack?: string;
  audioTrack?: AudioTrack;
}

export interface SocialPage {
  id: string;
  ownerId: string;
  name: string;
  username: string;
  handle: string;
  description: string;
  category: string;
  avatar: string;
  coverImage?: string;
  isVerified?: boolean;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
  createdAt: string;
  website?: string;
  contactEmail?: string;
  tags: string[];
}

export interface SocialGroup {
  id: string;
  name: string;
  handle: string;
  description: string;
  category: string;
  privacy: 'public' | 'private';
  avatar: string;
  coverImage?: string;
  membersCount: number;
  postsCount: number;
  isJoined?: boolean;
  ownerId: string;
  members: string[];
  rules: string[];
  createdAt: string;
}

export interface LiveStreamMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: string;
  isHost?: boolean;
  isAI?: boolean;
}

export interface LiveStream {
  id: string;
  title: string;
  description: string;
  host: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
  };
  category: string;
  viewersCount: number;
  likesCount: number;
  isLive: boolean;
  thumbnailUrl: string;
  streamUrl?: string;
  tags: string[];
  startedAt: string;
}
