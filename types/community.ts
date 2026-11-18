import { AudioTrack, ReelAudioConfig } from './audio';

export * from './audio';

export type ProfilePrivacy = 'public' | 'private';
export type PostAudience = 'public' | 'followers' | 'only_me';
export type FollowRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

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
  profilePrivacy?: ProfilePrivacy;
  defaultPostAudience?: PostAudience;
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

export type SeriesContentType = 'video' | 'text';

export interface VideoSeriesMeta {
  seriesId: string;
  seriesTitle: string;
  seriesDescription?: string;
  creatorId: string;
  partNumber: number;
  totalParts?: number;
  firstPartId?: string;
  visibility?: PostAudience | 'private' | null;
  isPublished?: boolean;
  seriesType?: SeriesContentType;
  isOngoing?: boolean;
}

export type ContentSeriesMeta = VideoSeriesMeta;

export interface VideoWatchProgress {
  videoId: string;
  creatorId?: string;
  seriesId?: string;
  partNumber?: number;
  positionSeconds: number;
  durationSeconds?: number;
  updatedAt: string;
}

export interface TextReadingProgress {
  postId: string;
  seriesId: string;
  creatorId: string;
  partNumber: number;
  totalParts?: number;
  scrollOffset?: number;
  updatedAt: string;
}

export type SupportedTranslationLanguage =
  | 'en'
  | 'bn'
  | 'ar'
  | 'hi'
  | 'es'
  | 'fr'
  | 'ur';

export interface PostTranslationResult {
  postId: string;
  contentHash: string;
  targetLanguage: SupportedTranslationLanguage;
  translatedText: string;
  detectedSourceLanguage: string;
  modelUsed?: string;
  createdAt: string;
}

export interface TranslationReportRecord {
  postId: string;
  contentHash: string;
  targetLanguage: SupportedTranslationLanguage;
  detectedSourceLanguage?: string;
  reason?: string;
  reportedAt: string;
}

export interface CommunityPost {
  id: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
    profilePrivacy?: ProfilePrivacy;
  };
  authorProfilePrivacy?: ProfilePrivacy;
  visibility?: PostAudience | 'private' | null;
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
  videoTitle?: string;
  videoThumbnail?: string;
  originalImageSrc?: string;
  textBackgroundPreset?: string; // e.g. 'sunset', 'cyberpunk', 'emerald', 'midnight', 'fire'
  postType?: 'text' | 'media' | 'ai_art' | 'reel';
  likesCount: number;
  remixCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount?: number;
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
  createdAtIso?: string;
  tags: string[];
  feedType?: 'for_you' | 'following' | 'trending' | 'page' | 'group';
  audioTrack?: AudioTrack;
  audioConfig?: ReelAudioConfig;
  series?: VideoSeriesMeta;
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
    profilePrivacy?: ProfilePrivacy;
  };
  authorProfilePrivacy?: ProfilePrivacy;
  visibility?: PostAudience | 'private' | null;
  sourcePostType?: 'reel' | 'media' | 'video';
  videoSrc: string;
  thumbnailSrc?: string;
  duration: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount?: number;
  viewsCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: string;
  createdAtIso?: string;
  promptUsed?: string;
  musicTrack?: string;
  audioTrack?: AudioTrack;
  audioConfig?: ReelAudioConfig;
  series?: VideoSeriesMeta;
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
