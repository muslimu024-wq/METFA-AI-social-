import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Edit3,
  Sparkles,
  Zap,
  Film,
  Compass,
  FileText,
  Users,
  Check,
  Globe,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  LogIn,
  ShieldCheck,
  CheckCircle2,
  ArrowRightLeft,
  Building2,
  Camera,
  Upload,
  Wand2,
  X,
  RefreshCw,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Heart,
  MessageCircle,
  MessageSquare,
  Play,
  Loader2,
  UserPlus,
  UserCheck,
  Lock,
  Clock,
  AlertCircle,
  UserX,
} from 'lucide-react';
import {
  FollowRequestRecord,
  FollowRelationStatus,
  PostAudience,
  ProfilePrivacy,
  UserProfile,
  CommunityPost,
  ReelHighlight,
} from '../types/community';
import { DailyCreditsData } from '../utils/creditManager';
import { getPages, getGroups } from '../utils/socialStore';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { fileToBase64, saveMediaItem } from '../utils/mediaStorage';
import { generateCustomAIAvatar } from '../services/aiAssistantService';
import { compressImageDataUrl } from '../utils/storageUtils';
import { fetchSupabaseProfile } from '../services/authService';
import {
  followUser,
  unfollowUser,
  cancelFollowRequest,
  fetchFollowStatus,
  fetchFollowedUserIds,
  fetchIncomingFollowRequests,
  respondToFollowRequest,
  fetchProfilesPrivacyBatch,
  reconcileProfileFollowCounts,
  isValidProfileUuid,
} from '../services/followService';
import {
  syncFollowCache,
  syncPendingFollowRequestCache,
  isUserFollowed,
  isFollowRequestPending,
} from '../utils/followStore';
import { isContentOwner } from '../utils/communityStore';
import {
  canViewerAccessPost,
  canViewPrivateProfileContent,
  formatAudienceMeta,
  normalizeDefaultPostAudience,
  normalizeProfilePrivacy,
} from '../utils/privacyPolicy';
import { addNotification } from '../utils/notificationStore';
import {
  getSavedPostsList,
  getSavedReelsList,
  filterVisibleSavedPosts,
  filterVisibleSavedReels,
  toggleSavePost,
  toggleSaveReel,
} from '../utils/bookmarkStore';
import { BarChart3 } from 'lucide-react';
import CreatorStudioAnalytics from './CreatorStudioAnalytics';
import ContentAnalyticsModal from './ContentAnalyticsModal';
import {
  ContentCatalogDescriptor,
  postToContentDescriptor,
  reelToContentDescriptor,
  trackFollowAttribution,
} from '../utils/contentTracker';

interface ProfileViewProps {
  userProfile: UserProfile;
  viewedProfileUserId?: string | null;
  onUpdateProfile: (profile: UserProfile) => void;
  creditsData: DailyCreditsData;
  userPosts: CommunityPost[];
  userReels: ReelHighlight[];
  allPosts?: CommunityPost[];
  allReels?: ReelHighlight[];
  onUpdatePosts?: (posts: CommunityPost[]) => void;
  onUpdateReels?: (reels: ReelHighlight[]) => void;
  onWatchAdClick?: () => void;
  onOpenAuthModal?: () => void;
  onCreatePageClick?: () => void;
  onCreateGroupClick?: () => void;
  onOpenChatWithUser?: (userId: string, userProfile?: UserProfile, conversationId?: string) => void;
}

const AVATAR_STYLES = [
  'Cyberpunk',
  'Anime 3D',
  'Photorealistic Studio',
  'Minimalist Vector',
  'Neon Synthwave',
  'Fantasy Royalty',
] as const;

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  viewedProfileUserId,
  onUpdateProfile,
  creditsData,
  userPosts,
  userReels,
  allPosts,
  allReels,
  onUpdatePosts,
  onUpdateReels,
  onWatchAdClick,
  onOpenAuthModal,
  onCreatePageClick,
  onCreateGroupClick,
  onOpenChatWithUser,
}) => {
  const { user: authUser, activeIdentity, updateProfile, switchIdentity, isAuthenticated } = useAuth();
  
  // Distinguish between viewing authenticated user's own profile vs another user's profile
  const isOwnProfile = !viewedProfileUserId || viewedProfileUserId === authUser?.id || viewedProfileUserId === userProfile.id;

  // Real-time Supabase profile fetch for viewed profile user when targeting another member
  const [fetchedProfile, setFetchedProfile] = useState<UserProfile | null>(null);
  const [ownReconciledCounts, setOwnReconciledCounts] = useState<{
    followersCount: number;
    followingCount: number;
  } | null>(null);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowRelationStatus>('none');
  const isFollowingProfile = followStatus === 'following';
  const [isFollowLoading, setIsFollowLoading] = useState<boolean>(false);
  const [incomingRequests, setIncomingRequests] = useState<FollowRequestRecord[]>([]);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());
  const [profilesPrivacyMap, setProfilesPrivacyMap] = useState<Map<string, ProfilePrivacy>>(new Map());

  useEffect(() => {
    let isMounted = true;
    if (!isOwnProfile && viewedProfileUserId) {
      fetchSupabaseProfile(viewedProfileUserId).then((prof) => {
        if (isMounted && prof) {
          setFetchedProfile(prof);
        }
      });

      if (isValidProfileUuid(viewedProfileUserId)) {
        reconcileProfileFollowCounts(viewedProfileUserId).then((counts) => {
          if (isMounted && !counts.error) {
            setFetchedProfile((prev) =>
              prev
                ? {
                    ...prev,
                    stats: {
                      ...prev.stats,
                      followersCount: counts.followersCount,
                      followingCount: counts.followingCount,
                    },
                  }
                : prev
            );
          }
        });
        fetchFollowStatus(viewedProfileUserId).then(({ status }) => {
          if (isMounted) {
            setFollowStatus(status);
          }
        });
      } else {
        setFollowStatus(
          isUserFollowed(viewedProfileUserId)
            ? 'following'
            : isFollowRequestPending(viewedProfileUserId)
            ? 'pending'
            : 'none'
        );
      }
    } else {
      setFetchedProfile(null);
      setFollowStatus('none');
      if (authUser?.id && isValidProfileUuid(authUser.id)) {
        reconcileProfileFollowCounts(authUser.id).then((counts) => {
          if (isMounted && !counts.error) {
            setOwnReconciledCounts({
              followersCount: counts.followersCount,
              followingCount: counts.followingCount,
            });
          }
        });
        fetchIncomingFollowRequests().then(({ requests, error }) => {
          if (isMounted && !error) {
            setIncomingRequests(requests);
          }
        });
      } else {
        setIncomingRequests([]);
      }
    }
    return () => {
      isMounted = false;
    };
  }, [isOwnProfile, viewedProfileUserId, authUser?.id]);

  // Load viewer's followedSet and saved authors' privacy map for Saved Tab visibility enforcement
  useEffect(() => {
    let active = true;
    if (authUser?.id && isValidProfileUuid(authUser.id)) {
      fetchFollowedUserIds().then(({ followedIds, error }) => {
        if (active && !error) setFollowedSet(followedIds);
      });
    } else {
      setFollowedSet(new Set());
    }
    const authorIds = Array.from(
      new Set([
        ...(allPosts || []).map((p) => p.author?.id),
        ...(allReels || []).map((r) => r.author?.id),
      ].filter((id): id is string => Boolean(id && isValidProfileUuid(id))))
    );
    if (authorIds.length > 0) {
      fetchProfilesPrivacyBatch(authorIds).then(({ privacyMap, error }) => {
        if (active && !error) setProfilesPrivacyMap(privacyMap);
      });
    }
    return () => {
      active = false;
    };
  }, [authUser?.id, allPosts, allReels]);

  const displayProfile: UserProfile = isOwnProfile
    ? ownReconciledCounts
      ? {
          ...userProfile,
          stats: {
            ...userProfile.stats,
            followersCount: ownReconciledCounts.followersCount,
            followingCount: ownReconciledCounts.followingCount,
          },
        }
      : userProfile
    : (fetchedProfile || {
        ...userProfile,
        id: viewedProfileUserId || userProfile.id,
        profilePrivacy: 'public',
        stats: {
          postsCount: userPosts.length,
          followersCount: 0,
          followingCount: 0,
          totalLikes: 0,
          reelsCount: userReels.length,
        },
      });

  const viewerId = authUser?.id || (userProfile.id !== 'guest' ? userProfile.id : null);
  const canViewTargetProfileContent = isOwnProfile
    ? true
    : canViewPrivateProfileContent({
        targetUserId: displayProfile.id,
        profilePrivacy: displayProfile.profilePrivacy || 'public',
        viewerId,
        viewerFollowsTarget: isFollowingProfile,
      });

  const visibleUserPosts = React.useMemo(() => {
    if (isOwnProfile) return userPosts;
    if (!canViewTargetProfileContent) return [];
    return userPosts.filter((p) =>
      canViewerAccessPost({
        visibility: p.visibility,
        authorId: p.author?.id,
        authorProfilePrivacy: displayProfile.profilePrivacy || p.authorProfilePrivacy || p.author?.profilePrivacy || 'public',
        viewerId,
        viewerFollowsAuthor: isFollowingProfile,
        viewerIsOwner: isContentOwner(p.author, userProfile, authUser, p.postingIdentity, p.id),
      })
    );
  }, [isOwnProfile, canViewTargetProfileContent, userPosts, displayProfile.profilePrivacy, viewerId, isFollowingProfile, authUser?.id, userProfile?.id]);

  const visibleUserReels = React.useMemo(() => {
    if (isOwnProfile) return userReels;
    if (!canViewTargetProfileContent) return [];
    return userReels.filter((r) =>
      canViewerAccessPost({
        visibility: r.visibility,
        authorId: r.author?.id,
        authorProfilePrivacy: displayProfile.profilePrivacy || r.authorProfilePrivacy || r.author?.profilePrivacy || 'public',
        viewerId,
        viewerFollowsAuthor: isFollowingProfile,
        viewerIsOwner: isContentOwner(r.author, userProfile, authUser, undefined, r.id),
      })
    );
  }, [isOwnProfile, canViewTargetProfileContent, userReels, displayProfile.profilePrivacy, viewerId, isFollowingProfile, authUser?.id, userProfile?.id]);

  const computeVisibleSavedPosts = () =>
    filterVisibleSavedPosts(allPosts, {
      viewerId,
      followedUserIds: followedSet,
      profilesPrivacyMap,
      isOwnerCheck: (p) => isContentOwner(p.author, userProfile, authUser, p.postingIdentity, p.id),
    });

  const computeVisibleSavedReels = () =>
    filterVisibleSavedReels(allReels, {
      viewerId,
      followedUserIds: followedSet,
      profilesPrivacyMap,
      isOwnerCheck: (r) => isContentOwner(r.author, userProfile, authUser, undefined, r.id),
    });

  const [isEditing, setIsEditing] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [username, setUsername] = useState(userProfile.username);
  const [bio, setBio] = useState(userProfile.bio);
  const [location, setLocation] = useState(userProfile.location || '');
  const [website, setWebsite] = useState(userProfile.website || '');
  const [profilePrivacy, setProfilePrivacy] = useState<ProfilePrivacy>(() =>
    normalizeProfilePrivacy(userProfile.profilePrivacy)
  );
  const [defaultPostAudience, setDefaultPostAudience] = useState<PostAudience>(() =>
    normalizeDefaultPostAudience(userProfile.defaultPostAudience)
  );
  const [activeTab, setActiveTab] = useState<'creations' | 'reels' | 'analytics' | 'saved'>('creations');
  const [savedFilter, setSavedFilter] = useState<'all' | 'posts' | 'reels'>('all');
  const [savedPosts, setSavedPosts] = useState<CommunityPost[]>(() => computeVisibleSavedPosts());
  const [savedReels, setSavedReels] = useState<ReelHighlight[]>(() => computeVisibleSavedReels());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [inspectingAnalyticsItem, setInspectingAnalyticsItem] = useState<ContentCatalogDescriptor | null>(null);

  // Listen for Header / external Studio Analytics shortcut event
  useEffect(() => {
    const handleOpenStudioAnalytics = () => {
      if (isOwnProfile) {
        setActiveTab('analytics');
      }
    };
    window.addEventListener('metfa_open_creator_analytics', handleOpenStudioAnalytics);
    return () => window.removeEventListener('metfa_open_creator_analytics', handleOpenStudioAnalytics);
  }, [isOwnProfile]);

  // Safety: reset edit states if viewing another user's profile
  useEffect(() => {
    if (!isOwnProfile) {
      setIsEditing(false);
      setIsSwitcherOpen(false);
      if (activeTab === 'saved' || activeTab === 'analytics') {
        setActiveTab('creations');
      }
    }
  }, [isOwnProfile, activeTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync saved posts & reels when storage, follow set, or props update (filtered for privacy)
  useEffect(() => {
    setSavedPosts(computeVisibleSavedPosts());
    setSavedReels(computeVisibleSavedReels());

    const handleSavedUpdated = () => {
      setSavedPosts(computeVisibleSavedPosts());
      setSavedReels(computeVisibleSavedReels());
    };

    window.addEventListener('metfa_saved_items_updated', handleSavedUpdated);
    window.addEventListener('metfa_posts_updated', handleSavedUpdated);
    window.addEventListener('metfa_reels_updated', handleSavedUpdated);

    return () => {
      window.removeEventListener('metfa_saved_items_updated', handleSavedUpdated);
      window.removeEventListener('metfa_posts_updated', handleSavedUpdated);
      window.removeEventListener('metfa_reels_updated', handleSavedUpdated);
    };
  }, [allPosts, allReels, followedSet, profilesPrivacyMap, viewerId]);

  const handleUnsavePost = (postId: string) => {
    const res = toggleSavePost(postId);
    if (onUpdatePosts) {
      onUpdatePosts(res.updatedPosts);
    }
    setSavedPosts(computeVisibleSavedPosts());
    showToast('Post removed from saved bookmarks');
  };

  const handleUnsaveReel = (reelId: string) => {
    const res = toggleSaveReel(reelId);
    if (onUpdateReels) {
      onUpdateReels(res.updatedReels);
    }
    setSavedReels(computeVisibleSavedReels());
    showToast('Reel removed from saved bookmarks');
  };

  // AI Avatar Generator Modal State
  const [isAIAvatarModalOpen, setIsAIAvatarModalOpen] = useState(false);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState<typeof AVATAR_STYLES[number]>('Cyberpunk');
  const [avatarTraits, setAvatarTraits] = useState('');
  const [generatedAvatarPreview, setGeneratedAvatarPreview] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const switcherRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setName(userProfile.name);
    setUsername(userProfile.username);
    setBio(userProfile.bio);
    setLocation(userProfile.location || '');
    setWebsite(userProfile.website || '');
    setProfilePrivacy(normalizeProfilePrivacy(userProfile.profilePrivacy));
    setDefaultPostAudience(normalizeDefaultPostAudience(userProfile.defaultPostAudience));
  }, [userProfile]);

  // Close Account Switcher when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setIsSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const pages = getPages();
  const groups = getGroups();

  const handleSave = () => {
    if (!isOwnProfile) return;
    const cleanUsername = username.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '') || userProfile.username;
    const updated: UserProfile = {
      ...userProfile,
      name: name.trim() || userProfile.name,
      username: cleanUsername,
      bio: bio.trim(),
      location: location.trim(),
      website: website.trim(),
      profilePrivacy,
      defaultPostAudience,
    };
    updateProfile(updated);
    onUpdateProfile(updated);
    setIsEditing(false);
    showToast('Profile & privacy settings updated');
  };

  const handleRespondFollowRequest = async (req: FollowRequestRecord, decision: 'approve' | 'decline') => {
    if (!isOwnProfile || respondingRequestId === req.id) return;
    setRespondingRequestId(req.id);
    const res = await respondToFollowRequest(req.id, decision);
    setRespondingRequestId(null);
    if (!res.success) {
      showToast(res.error || 'Could not update follow request.');
      return;
    }
    setIncomingRequests((prev) => prev.filter((r) => r.id !== req.id));
    if (decision === 'approve' && authUser?.id && isValidProfileUuid(authUser.id)) {
      reconcileProfileFollowCounts(authUser.id).then((counts) => {
        if (!counts.error) {
          setOwnReconciledCounts({
            followersCount: counts.followersCount,
            followingCount: counts.followingCount,
          });
        }
      });
      addNotification({
        type: 'follow_approved',
        title: 'Follow Request Approved',
        message: `@${req.requesterProfile?.username || 'creator'} can now follow your profile.`,
        linkTab: 'profile',
      });
    }
    showToast(decision === 'approve' ? 'Follow request approved' : 'Follow request declined');
  };

  const handleSelectIdentity = (type: 'personal' | 'page' | 'group', item?: any) => {
    if (!isOwnProfile) return;
    if (type === 'personal') {
      switchIdentity({
        type: 'personal',
        id: authUser.id,
        name: authUser.name,
        username: authUser.username,
        avatar: authUser.avatar,
        badge: authUser.isVerified ? 'Verified Creator' : 'Creator',
      });
    } else if (type === 'page' && item) {
      switchIdentity({
        type: 'page',
        id: item.id,
        name: item.name,
        username: item.username,
        avatar: item.avatar,
        badge: 'Page Admin',
      });
    } else if (type === 'group' && item) {
      switchIdentity({
        type: 'group',
        id: item.id,
        name: item.name,
        username: item.handle.replace('@', ''),
        avatar: item.avatar,
        badge: 'Group Admin',
      });
    }
    setIsSwitcherOpen(false);
  };

  // Direct File Avatar Upload with safe compression
  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImageDataUrl(base64, 250, 250, 0.8);
      await saveMediaItem({
        userId: userProfile.id,
        type: 'image',
        dataUrl: compressed,
        name: `avatar_${Date.now()}.png`,
        sizeBytes: file.size,
        mimeType: file.type,
      });

      const updated = { ...userProfile, avatar: compressed };
      updateProfile(updated);
      onUpdateProfile(updated);
    } catch (err) {
      console.warn('Avatar file read error:', err);
    }
  };

  // AI Avatar Generation
  const handleGenerateAIAvatar = async () => {
    setIsGeneratingAvatar(true);
    try {
      const result = await generateCustomAIAvatar({
        style: selectedAvatarStyle,
        traits: avatarTraits,
      });
      setGeneratedAvatarPreview(result.avatarUrl);
    } catch (err) {
      console.warn('Avatar gen error:', err);
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleApplyAIAvatar = async () => {
    if (!generatedAvatarPreview) return;
    try {
      const compressed = await compressImageDataUrl(generatedAvatarPreview, 250, 250, 0.8);
      const updated = { ...userProfile, avatar: compressed };
      updateProfile(updated);
      onUpdateProfile(updated);
    } catch {
      const updated = { ...userProfile, avatar: generatedAvatarPreview };
      updateProfile(updated);
      onUpdateProfile(updated);
    }
    setIsAIAvatarModalOpen(false);
    setGeneratedAvatarPreview(null);
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleAvatarFileUpload}
        className="hidden"
      />

      {/* Return to My Profile banner when viewing another member */}
      {!isOwnProfile && (
        <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-2xl px-4 py-2.5 text-xs">
          <span className="text-purple-900 font-medium truncate">
            Viewing <strong className="font-bold text-slate-900">{displayProfile.name}</strong> (@{displayProfile.username})
          </span>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('metfa_view_profile', { detail: { userId: null } }));
            }}
            className="text-purple-700 hover:text-purple-900 font-bold ml-3 text-xs underline underline-offset-2 shrink-0 cursor-pointer"
          >
            ← Back to My Profile
          </button>
        </div>
      )}

      {/* UNIFIED SINGLE PROFILE HEADER CARD */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm relative">
        {/* Cover Artwork Banner */}
        <div className="h-32 sm:h-44 bg-gradient-to-r from-purple-100 via-indigo-50 to-teal-100 relative border-b border-slate-200">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-300/20 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Profile Content Container */}
        <div className="px-5 sm:px-8 pb-7 pt-0 relative">
          {/* 1. [Profile Avatar + Verified Badge] */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-20">
            {/* Avatar with Verified Badge Overlay */}
            <div className="relative inline-block group shrink-0">
              <img
                src={isOwnProfile ? (activeIdentity.avatar || userProfile.avatar) : displayProfile.avatar}
                alt={isOwnProfile ? (activeIdentity.name || userProfile.name) : displayProfile.name}
                decoding="async"
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-white shadow-xl bg-slate-100 group-hover:opacity-90 transition"
              />

              {/* Verified Creator Badge overlay */}
              {(isOwnProfile ? userProfile.isVerified : displayProfile.isVerified) && (
                <div
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-teal-500 text-white border-2 border-white shadow-md flex items-center justify-center"
                  title="Verified Creator"
                >
                  <ShieldCheck className="w-4 h-4 text-white stroke-[2.5]" />
                </div>
              )}

              {/* Avatar Quick Upload / AI Trigger Overlay - Only for own profile */}
              {isOwnProfile && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition cursor-pointer backdrop-blur-xs"
                  title="Click to upload custom profile photo"
                >
                  <Camera className="w-6 h-6 text-white" />
                  <span className="text-[10px] text-white font-bold">Change</span>
                </div>
              )}
            </div>

            {/* SSO / Unified ID Badges */}
            <div className="flex items-center gap-2 flex-wrap sm:mb-2">
              {isOwnProfile ? (
                isAuthenticated ? (
                  <>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-mono font-semibold">
                      Unified ID: {authUser.metfaId || authUser.id}
                    </span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      SSO Active
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                    Visitor (Sign in to activate account)
                  </span>
                )
              ) : (
                displayProfile.id ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-mono font-semibold">
                    Profile ID: {displayProfile.id}
                  </span>
                ) : null
              )}
            </div>
          </div>

          {/* 2. [Name & @Username] */}
          <div className="mt-3.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {isOwnProfile ? (activeIdentity.name || userProfile.name) : displayProfile.name}
              </h1>
              {(isOwnProfile ? userProfile.isVerified : displayProfile.isVerified) && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold flex items-center gap-1 shadow-xs">
                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                  Verified Creator
                </span>
              )}
              {/* Identity Type Pill - Only for own profile */}
              {isOwnProfile && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold flex items-center gap-1">
                  {activeIdentity.type === 'personal' ? (
                    <>
                      <User className="w-3 h-3 text-teal-600" />
                      <span>Personal Profile</span>
                    </>
                  ) : activeIdentity.type === 'page' ? (
                    <>
                      <Building2 className="w-3 h-3 text-purple-600" />
                      <span>Page • {activeIdentity.badge || 'Creator Page'}</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-3 h-3 text-amber-600" />
                      <span>Group • {activeIdentity.badge || 'Managed Group'}</span>
                    </>
                  )}
                </span>
              )}
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 border ${
                  (displayProfile.profilePrivacy || 'public') === 'private'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {(displayProfile.profilePrivacy || 'public') === 'private' ? (
                  <>
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>Private Account</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3 text-teal-600" />
                    <span>Public Profile</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs sm:text-sm text-teal-700 font-mono font-bold">
                @{isOwnProfile ? (activeIdentity.username || userProfile.username) : displayProfile.username}
              </span>
            </div>
          </div>

          {/* 3. [Bio & ID] */}
          <div className="mt-3 space-y-3">
            {!isEditing ? (
              <>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed max-w-3xl whitespace-pre-line">
                  {displayProfile.bio || (isOwnProfile ? 'Digital creator and AI enthusiast exploring generative media on METFA Social.' : 'Digital creator on METFA Social.')}
                </p>

                {/* Metadata row: Location, Website, Join Date */}
                <div className="flex items-center gap-3.5 text-xs text-slate-500 flex-wrap pt-0.5">
                  {displayProfile.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="text-slate-700">{displayProfile.location}</span>
                    </span>
                  )}
                  {displayProfile.website && (
                    <a
                      href={displayProfile.website.startsWith('http') ? displayProfile.website : `https://${displayProfile.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-teal-700 hover:text-teal-900 transition underline-offset-2 hover:underline font-medium"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[220px]">{displayProfile.website.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  )}
                  {displayProfile.joinDate && (
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>Joined {displayProfile.joinDate}</span>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-purple-200 animate-fadeIn my-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Username (@)</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-semibold font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Bio / Creator Statement</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-purple-500 resize-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Tokyo / Remote or San Francisco"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Website / Portfolio</label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://metfa.ai/@yourname"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
                    />
                  </div>
                </div>

                {/* Profile Privacy & Default Post Audience Settings */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">Profile Privacy</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          id: 'public' as ProfilePrivacy,
                          label: 'Public Profile',
                          sub: 'Anyone can follow & view public posts',
                          icon: Globe,
                        },
                        {
                          id: 'private' as ProfilePrivacy,
                          label: 'Private Profile',
                          sub: 'Follow requests require your approval',
                          icon: Lock,
                        },
                      ].map((opt) => {
                        const IconComp = opt.icon;
                        const active = profilePrivacy === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setProfilePrivacy(opt.id)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              active
                                ? 'bg-purple-50 border-purple-400 text-purple-950 shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-purple-300'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-xs font-bold">
                              <IconComp className={`w-3.5 h-3.5 ${active ? 'text-purple-600' : 'text-slate-500'}`} />
                              <span>{opt.label}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">{opt.sub}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">Default Post Audience</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'public' as PostAudience, label: 'Public', icon: Globe },
                        { id: 'followers' as PostAudience, label: 'Followers', icon: Users },
                        { id: 'only_me' as PostAudience, label: 'Only Me', icon: Lock },
                      ].map((opt) => {
                        const IconComp = opt.icon;
                        const active = defaultPostAudience === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setDefaultPostAudience(opt.id)}
                            className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                              active
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-purple-300'
                            }`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Changing Profile Privacy applies going forward and does NOT overwrite or retroactively alter the audience of your existing posts.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CLEAN ACTION BUTTONS ROW: [Edit Profile | Switch Account | AI Avatar | Upload Photo | Message] */}
          <div className="flex items-center gap-2 sm:gap-2.5 mt-5 flex-wrap relative" ref={switcherRef}>
            {/* 1. Edit Profile Button / Save Changes - ONLY for authenticated user's own profile */}
            {isOwnProfile && (
              !isEditing ? (
                <button
                  type="button"
                  id="edit-profile-btn"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="save-profile-btn"
                    onClick={handleSave}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                  <button
                    type="button"
                    id="cancel-edit-profile-btn"
                    onClick={() => setIsEditing(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )
            )}

            {/* Follow / Requested / Following Button - ONLY when viewing another user's profile (!isOwnProfile) */}
            {!isOwnProfile && (
              <button
                type="button"
                id="profile-follow-toggle-btn"
                disabled={isFollowLoading}
                onClick={async () => {
                  const targetUserId = displayProfile.id || viewedProfileUserId;
                  if (!targetUserId) {
                    showToast('Target user could not be identified.');
                    return;
                  }

                  if (targetUserId === authUser?.id || targetUserId === userProfile.id) return;

                  if (isValidProfileUuid(targetUserId)) {
                    setIsFollowLoading(true);
                    if (followStatus === 'pending') {
                      const res = await cancelFollowRequest(targetUserId);
                      setIsFollowLoading(false);
                      if (res.success) {
                        setFollowStatus('none');
                        syncPendingFollowRequestCache(targetUserId, false);
                        showToast(`Follow request cancelled for ${displayProfile.name}`);
                      } else {
                        showToast(res.error || 'Failed to cancel follow request.');
                      }
                    } else if (followStatus === 'none') {
                      const res = await followUser(targetUserId);
                      setIsFollowLoading(false);
                      if (res.success && res.requestStatus === 'pending') {
                        setFollowStatus('pending');
                        syncFollowCache(
                          { id: targetUserId, name: displayProfile.name, username: displayProfile.username, avatar: displayProfile.avatar },
                          false
                        );
                        syncPendingFollowRequestCache(targetUserId, true);
                        showToast(`Follow request sent to ${displayProfile.name}`);
                      } else if (res.success && res.isFollowing) {
                        setFollowStatus('following');
                        syncFollowCache(
                          { id: targetUserId, name: displayProfile.name, username: displayProfile.username, avatar: displayProfile.avatar },
                          true
                        );
                        syncPendingFollowRequestCache(targetUserId, false);
                        trackFollowAttribution({
                          creatorId: targetUserId,
                          viewerId: authUser?.id || userProfile.id,
                          attributionMethod: 'direct_profile_follow',
                          followDelta: 1,
                          trafficSource: 'profile',
                        });
                        reconcileProfileFollowCounts(targetUserId).then((counts) => {
                          if (!counts.error) {
                            setFetchedProfile((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    stats: {
                                      ...prev.stats,
                                      followersCount: counts.followersCount,
                                      followingCount: counts.followingCount,
                                    },
                                  }
                                : prev
                            );
                          }
                        });
                        showToast(`You are now following ${displayProfile.name}`);
                      } else {
                        showToast(res.error || 'Failed to follow user.');
                      }
                    } else {
                      const { success, error } = await unfollowUser(targetUserId);
                      setIsFollowLoading(false);
                      if (success) {
                        setFollowStatus('none');
                        syncFollowCache(
                          { id: targetUserId, name: displayProfile.name, username: displayProfile.username, avatar: displayProfile.avatar },
                          false
                        );
                        syncPendingFollowRequestCache(targetUserId, false);
                        trackFollowAttribution({
                          creatorId: targetUserId,
                          viewerId: authUser?.id || userProfile.id,
                          attributionMethod: 'direct_profile_follow',
                          followDelta: -1,
                          trafficSource: 'profile',
                        });
                        reconcileProfileFollowCounts(targetUserId).then((counts) => {
                          if (!counts.error) {
                            setFetchedProfile((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    stats: {
                                      ...prev.stats,
                                      followersCount: counts.followersCount,
                                      followingCount: counts.followingCount,
                                    },
                                  }
                                : prev
                            );
                          }
                        });
                        showToast(`Unfollowed ${displayProfile.name}`);
                      } else {
                        showToast(error || 'Failed to unfollow user.');
                      }
                    }
                  } else if (!isSupabaseConfigured()) {
                    const next = !isFollowingProfile;
                    setFollowStatus(next ? 'following' : 'none');
                    syncFollowCache(
                      { id: targetUserId, name: displayProfile.name, username: displayProfile.username, avatar: displayProfile.avatar },
                      next
                    );
                    trackFollowAttribution({
                      creatorId: targetUserId,
                      viewerId: authUser?.id || userProfile.id,
                      attributionMethod: 'direct_profile_follow',
                      followDelta: next ? 1 : -1,
                      trafficSource: 'profile',
                    });
                    showToast(next ? `You are now following ${displayProfile.name}` : `Unfollowed ${displayProfile.name}`);
                  }
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer ${
                  isFollowLoading ? 'opacity-70 cursor-wait' : ''
                } ${
                  followStatus === 'following'
                    ? 'bg-slate-100 hover:bg-rose-50 text-slate-800 hover:text-rose-600 border border-slate-200 hover:border-rose-200'
                    : followStatus === 'pending'
                    ? 'bg-amber-50 hover:bg-rose-50 text-amber-800 hover:text-rose-600 border border-amber-200 hover:border-rose-200'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                title={
                  followStatus === 'following'
                    ? 'Following (Click to Unfollow)'
                    : followStatus === 'pending'
                    ? 'Follow request pending (Click to cancel)'
                    : `Follow ${displayProfile.name}`
                }
              >
                {isFollowLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : followStatus === 'following' ? (
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                ) : followStatus === 'pending' ? (
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                <span>
                  {isFollowLoading
                    ? 'Updating...'
                    : followStatus === 'following'
                    ? 'Following'
                    : followStatus === 'pending'
                    ? 'Requested'
                    : 'Follow'}
                </span>
              </button>
            )}

            {/* Messages Button: Opens conversation with target user via existing get_or_create_direct_conversation RPC */}
            <button
              type="button"
              id="profile-direct-messages-btn"
              disabled={isStartingChat}
              onClick={async () => {
                // 1. If viewing own profile, open user's conversations list
                if (isOwnProfile) {
                  const ownId = authUser?.id || userProfile.id;
                  if (onOpenChatWithUser) {
                    onOpenChatWithUser(ownId, userProfile);
                  } else {
                    window.dispatchEvent(
                      new CustomEvent('metfa_open_chat', {
                        detail: { partnerId: ownId, partnerProfile: userProfile },
                      })
                    );
                  }
                  return;
                }

                // 2. Require authenticated Supabase user
                if (!isAuthenticated || !authUser?.id || authUser.id === 'guest') {
                  if (onOpenAuthModal) {
                    onOpenAuthModal();
                  } else {
                    window.dispatchEvent(new CustomEvent('metfa_open_auth_modal'));
                  }
                  return;
                }

                // 3. Get target user's existing Supabase profile ID
                const targetUserId = displayProfile.id || viewedProfileUserId;
                if (!targetUserId) {
                  showToast('Target profile could not be identified.');
                  return;
                }

                if (targetUserId === authUser.id) {
                  return;
                }

                // 4. Call existing Supabase RPC: public.get_or_create_direct_conversation
                setIsStartingChat(true);
                try {
                  let rpcResponse = await supabase.rpc('get_or_create_direct_conversation', {
                    partner_id: targetUserId,
                  });

                  // Handle parameter alias in case parameter in Postgres is named target_user_id
                  if (
                    rpcResponse.error &&
                    (rpcResponse.error.message?.includes('partner_id') ||
                      rpcResponse.error.message?.includes('target_user_id') ||
                      rpcResponse.error.code === '42883')
                  ) {
                    const altResponse = await supabase.rpc('get_or_create_direct_conversation', {
                      target_user_id: targetUserId,
                    });
                    if (!altResponse.error && altResponse.data) {
                      rpcResponse = altResponse;
                    }
                  }

                  if (rpcResponse.error) {
                    console.warn('[ProfileView] Stored procedure notice:', rpcResponse.error.message);
                    showToast('Unable to start conversation. Please try again later.');
                    return;
                  }

                  const convId = rpcResponse.data ? String(rpcResponse.data) : null;
                  if (!convId) {
                    showToast('Unable to start conversation. Please try again later.');
                    return;
                  }

                  // 5. Open existing chat screen for that conversation with returned conversation ID
                  if (onOpenChatWithUser) {
                    onOpenChatWithUser(targetUserId, displayProfile, convId);
                  } else {
                    window.dispatchEvent(
                      new CustomEvent('metfa_open_chat', {
                        detail: {
                          partnerId: targetUserId,
                          partnerProfile: displayProfile,
                          conversationId: convId,
                        },
                      })
                    );
                  }
                } catch (err: any) {
                  console.warn('[ProfileView] Exception starting direct conversation:', err);
                  showToast('Unable to start conversation. Please try again later.');
                } finally {
                  setIsStartingChat(false);
                }
              }}
              className={`px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl border border-teal-200 flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer ${
                isStartingChat ? 'opacity-70 cursor-wait' : ''
              }`}
              title={isOwnProfile ? 'Direct Messages' : `Message ${displayProfile.name}`}
            >
              {isStartingChat ? (
                <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
              )}
              <span>{isStartingChat ? 'Connecting...' : (isOwnProfile ? 'Messages' : 'Message')}</span>
            </button>

            {/* 2. Sleek Account Switcher Dropdown Trigger - ONLY for own profile */}
            {isOwnProfile && (
              <div className="relative">
                <button
                  type="button"
                  id="switch-account-dropdown-btn"
                  onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition shadow-xs active:scale-95 cursor-pointer ${
                    isSwitcherOpen
                      ? 'bg-purple-100 border-purple-300 text-purple-900'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800 hover:text-slate-900'
                  }`}
                  title="Switch active posting account or page"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                  <span>Switch Account</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                      isSwitcherOpen ? 'rotate-180 text-slate-900' : ''
                    }`}
                  />
                </button>

                {/* Compact Switcher Dropdown Popover */}
                {isSwitcherOpen && (
                  <div
                    id="account-switcher-dropdown-menu"
                    className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-40 animate-scaleUp"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                        Posting Identities
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Select active profile</span>
                    </div>

                    {/* Personal Profile Option */}
                    <button
                      type="button"
                      id="switch-to-personal-btn"
                      onClick={() => handleSelectIdentity('personal')}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                        activeIdentity.type === 'personal'
                          ? 'bg-purple-50 border border-purple-300 text-purple-900 shadow-xs'
                          : 'hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={authUser.avatar}
                          alt="Personal"
                          loading="lazy"
                          decoding="async"
                          className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate text-slate-900">{authUser.name}</div>
                          <div className="text-[10px] text-teal-700 font-mono">Personal • @{authUser.username}</div>
                        </div>
                      </div>
                      {activeIdentity.type === 'personal' && (
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      )}
                    </button>

                    {/* Pages Section */}
                    {pages.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Creator Pages
                        </div>
                        <div className="space-y-1 mt-1 max-h-40 overflow-y-auto pr-1">
                          {pages.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectIdentity('page', p)}
                              className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                                activeIdentity.id === p.id
                                  ? 'bg-purple-50 border border-purple-300 text-purple-900 shadow-xs'
                                  : 'hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={p.avatar}
                                  alt={p.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-7 h-7 rounded-lg object-cover shrink-0 border border-slate-200"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate text-slate-900">{p.name}</div>
                                  <div className="text-[10px] text-purple-700 font-mono">Page • {p.category}</div>
                                </div>
                              </div>
                              {activeIdentity.id === p.id && (
                                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Managed Groups Section */}
                    {groups.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Managed Groups
                        </div>
                        <div className="space-y-1 mt-1 max-h-36 overflow-y-auto pr-1">
                          {groups.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => handleSelectIdentity('group', g)}
                              className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                                activeIdentity.id === g.id
                                  ? 'bg-purple-50 border border-purple-300 text-purple-900 shadow-xs'
                                  : 'hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={g.avatar}
                                  alt={g.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-7 h-7 rounded-lg object-cover shrink-0 border border-slate-200"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate text-slate-900">{g.name}</div>
                                  <div className="text-[10px] text-amber-700 font-mono">
                                    Group • {g.membersCount} members
                                  </div>
                                </div>
                              </div>
                              {activeIdentity.id === g.id && (
                                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Create New Page / Group Shortcuts */}
                    {(onCreatePageClick || onCreateGroupClick) && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                        {onCreatePageClick && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSwitcherOpen(false);
                              onCreatePageClick();
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 border border-purple-200 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>New Page</span>
                          </button>
                        )}
                        {onCreateGroupClick && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSwitcherOpen(false);
                              onCreateGroupClick();
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 hover:text-amber-900 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 border border-amber-200 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>New Group</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. ✨ AI Avatar Studio Trigger - ONLY for own profile */}
            {isOwnProfile && (
              <button
                type="button"
                id="ai-avatar-btn"
                onClick={() => setIsAIAvatarModalOpen(true)}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 hover:text-purple-900 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-purple-600" />
                <span>✨ AI Avatar</span>
              </button>
            )}

            {/* 4. Upload Photo Button - ONLY for own profile */}
            {isOwnProfile && (
              <button
                type="button"
                id="upload-avatar-btn"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">Upload Photo</span>
                <span className="sm:hidden">Photo</span>
              </button>
            )}

            {/* 5. SSO / Auth Modal Trigger — Render ONLY for guest users so authenticated users are not prompted */}
            {isOwnProfile && onOpenAuthModal && authUser.authType === 'guest' && (
              <button
                type="button"
                id="profile-auth-btn"
                onClick={onOpenAuthModal}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition active:scale-95 ml-auto sm:ml-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In / Sign Up</span>
                <span className="sm:hidden">Sign In</span>
              </button>
            )}
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 text-center">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {canViewTargetProfileContent ? visibleUserPosts.length : '—'}
              </span>
              <span className="text-[11px] text-slate-500 uppercase font-semibold mt-0.5">Posts</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {canViewFollowList({
                  targetUserId: displayProfile.id,
                  profilePrivacy: displayProfile.profilePrivacy,
                  viewerId,
                  viewerFollowsTarget: isFollowingProfile,
                })
                  ? (displayProfile.stats?.followersCount ?? 0)
                  : (displayProfile.stats?.followersCount ?? 0)}
              </span>
              <span className="text-[11px] text-slate-500 uppercase font-semibold mt-0.5">Followers</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {displayProfile.stats?.followingCount ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 uppercase font-semibold mt-0.5">Following</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {canViewTargetProfileContent ? visibleUserReels.length : '—'}
              </span>
              <span className="text-[11px] text-slate-500 uppercase font-semibold mt-0.5">Reels</span>
            </div>
          </div>

          {/* Incoming Follow Requests Panel (Own Profile Only) */}
          {isOwnProfile && incomingRequests.length > 0 && (
            <div className="mt-5 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-600" />
                  <h4 className="text-xs font-bold text-slate-900">
                    Follow Requests ({incomingRequests.length})
                  </h4>
                </div>
                <span className="text-[10px] font-semibold text-purple-700">
                  Pending approval
                </span>
              </div>
              <div className="space-y-2">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 bg-white border border-purple-100 rounded-xl p-2.5 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={req.requesterProfile?.avatar || userProfile.avatar}
                        alt={req.requesterProfile?.name || 'Requester'}
                        className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {req.requesterProfile?.name || 'METFA Creator'}
                        </p>
                        <p className="text-[10px] text-teal-700 font-mono truncate">
                          @{req.requesterProfile?.username || 'creator'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={respondingRequestId === req.id}
                        onClick={() => handleRespondFollowRequest(req, 'approve')}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        disabled={respondingRequestId === req.id}
                        onClick={() => handleRespondFollowRequest(req, 'decline')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 disabled:opacity-50 text-slate-700 hover:text-rose-600 border border-slate-200 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATIONS, REELS & SAVED TABS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            <button
              type="button"
              id="tab-creations-btn"
              onClick={() => setActiveTab('creations')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'creations'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Posts & Artworks ({canViewTargetProfileContent ? visibleUserPosts.length : 0})</span>
            </button>

            <button
              type="button"
              id="tab-reels-btn"
              onClick={() => setActiveTab('reels')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'reels'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Reels ({canViewTargetProfileContent ? visibleUserReels.length : 0})</span>
            </button>

            {isOwnProfile && (
              <button
                type="button"
                id="tab-analytics-btn"
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Studio Analytics</span>
              </button>
            )}

            {isOwnProfile && (
              <button
                type="button"
                id="tab-saved-btn"
                onClick={() => setActiveTab('saved')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'saved'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved ({savedPosts.length + savedReels.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Private Account Gate when viewing another user's private profile without approved follow */}
        {!isOwnProfile && !canViewTargetProfileContent && (activeTab === 'creations' || activeTab === 'reels') && (
          <div className="py-14 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3 shadow-xs animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h4 className="text-base font-black text-slate-900">This Account is Private</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Follow @{displayProfile.username} to see their posts, reels, and artworks once your follow request is approved.
            </p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'creations' && canViewTargetProfileContent && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visibleUserPosts.length > 0 ? (
              visibleUserPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => {
                    if (isOwnProfile) {
                      setInspectingAnalyticsItem(postToContentDescriptor(post));
                    }
                  }}
                  className={`group relative rounded-2xl overflow-hidden aspect-square bg-slate-100 border border-slate-200 shadow-xs ${
                    isOwnProfile ? 'cursor-pointer' : ''
                  }`}
                >
                  {post.imageSrc || post.imageGallery?.[0] ? (
                    <img
                      src={post.imageSrc || post.imageGallery?.[0]}
                      alt={post.prompt}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full p-4 flex items-center justify-center text-center bg-purple-50 text-xs font-bold text-slate-800">
                      {post.caption || post.prompt}
                    </div>
                  )}
                  {isOwnProfile && (
                    <span className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/65 text-teal-300 opacity-0 group-hover:opacity-100 transition">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-3">
                    <p className="text-[11px] text-white line-clamp-2 font-medium">{post.caption || post.prompt}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200 p-6">
                <Compass className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No creations published yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Create posts or share artworks from the AI Studio to showcase them on your profile.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reels' && canViewTargetProfileContent && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visibleUserReels.length > 0 ? (
              visibleUserReels.map((reel) => (
                <div
                  key={reel.id}
                  onClick={() => {
                    if (isOwnProfile) {
                      setInspectingAnalyticsItem(reelToContentDescriptor(reel));
                    }
                  }}
                  className={`group relative rounded-2xl overflow-hidden aspect-[9/16] bg-slate-100 border border-slate-200 shadow-xs ${
                    isOwnProfile ? 'cursor-pointer' : ''
                  }`}
                >
                  <img
                    src={reel.thumbnailSrc || reel.videoSrc}
                    alt={reel.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-between p-3">
                    <span className="self-end px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-mono text-teal-300">
                      {reel.duration}s
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{reel.title}</h4>
                      <p className="text-[10px] text-slate-200 line-clamp-1">{reel.caption}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200 p-6">
                <Film className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No reels created yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Record or generate short video reels to build your video highlight portfolio.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && isOwnProfile && (
          <CreatorStudioAnalytics
            creatorId={authUser?.id || userProfile.id}
            creatorName={userProfile.name}
            catalog={[
              ...userPosts.map(postToContentDescriptor),
              ...userReels.map(reelToContentDescriptor),
            ]}
          />
        )}

        {activeTab === 'saved' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Sub-filter chips */}
            <div className="flex items-center gap-1.5 pb-1">
              <button
                type="button"
                id="saved-filter-all"
                onClick={() => setSavedFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  savedFilter === 'all'
                    ? 'bg-amber-50 text-amber-800 border border-amber-300'
                    : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                All ({savedPosts.length + savedReels.length})
              </button>

              <button
                type="button"
                id="saved-filter-posts"
                onClick={() => setSavedFilter('posts')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  savedFilter === 'posts'
                    ? 'bg-amber-50 text-amber-800 border border-amber-300'
                    : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                Posts ({savedPosts.length})
              </button>

              <button
                type="button"
                id="saved-filter-reels"
                onClick={() => setSavedFilter('reels')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  savedFilter === 'reels'
                    ? 'bg-amber-50 text-amber-800 border border-amber-300'
                    : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                Reels ({savedReels.length})
              </button>
            </div>

            {/* Saved Content Render */}
            {(savedFilter === 'all' || savedFilter === 'posts') && savedPosts.length > 0 && (
              <div className="space-y-2.5">
                {savedFilter === 'all' && (
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-teal-600" />
                    <span>Saved Posts ({savedPosts.length})</span>
                  </h4>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedPosts.map((post) => (
                    <div
                      key={`saved_post_${post.id}`}
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs transition"
                    >
                      <div className="space-y-2.5">
                        {/* Author Header & Unsave Button */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={post.author.avatar}
                              alt={post.author.name}
                              loading="lazy"
                              decoding="async"
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{post.author.name}</p>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <span className="truncate">{post.createdAt || 'Recently'}</span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">
                                  {formatAudienceMeta(post.visibility, post.authorProfilePrivacy || post.author?.profilePrivacy).shortLabel}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            id={`unsave-post-btn-${post.id}`}
                            onClick={() => handleUnsavePost(post.id)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-xl text-xs flex items-center gap-1 transition cursor-pointer shrink-0"
                            title="Remove from bookmarks"
                          >
                            <Bookmark className="w-3.5 h-3.5 fill-current text-amber-500" />
                            <span className="text-[11px] font-semibold">Saved</span>
                          </button>
                        </div>

                        {/* Caption below header, above media */}
                        {post.imageSrc ? (
                          <>
                            {(post.caption || post.prompt) && (
                              <p className="text-xs text-slate-800 line-clamp-2 leading-relaxed">
                                {post.caption || post.prompt}
                              </p>
                            )}
                            <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                              <img
                                src={post.imageSrc}
                                alt={post.prompt}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </>
                        ) : (
                          <div className="w-full p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-slate-800 line-clamp-3">
                            {post.caption || post.prompt}
                          </div>
                        )}
                      </div>

                      {/* Footer Stats */}
                      <div className="flex items-center gap-3 pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-rose-500" />
                          <span>{post.likesCount || 0}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5 text-teal-600" />
                          <span>{post.commentsCount || 0}</span>
                        </span>
                        <span className="ml-auto text-[10px] text-slate-500">{post.createdAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(savedFilter === 'all' || savedFilter === 'reels') && savedReels.length > 0 && (
              <div className="space-y-2.5 pt-2">
                {savedFilter === 'all' && (
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-purple-600" />
                    <span>Saved Reels ({savedReels.length})</span>
                  </h4>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {savedReels.map((reel) => (
                    <div
                      key={`saved_reel_${reel.id}`}
                      className="group relative rounded-2xl overflow-hidden aspect-[9/16] bg-slate-100 border border-slate-200 shadow-xs flex flex-col justify-between"
                    >
                      <img
                        src={reel.thumbnailSrc || reel.videoSrc}
                        alt={reel.title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="relative z-10 p-2.5 flex items-start justify-between bg-gradient-to-b from-black/80 via-transparent to-transparent">
                        <span className="px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-mono text-teal-300">
                          {reel.duration}s
                        </span>

                        <button
                          type="button"
                          id={`unsave-reel-btn-${reel.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnsaveReel(reel.id);
                          }}
                          className="p-1.5 rounded-xl bg-amber-500 text-white shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                          title="Remove bookmark"
                        >
                          <Bookmark className="w-3.5 h-3.5 fill-current text-white" />
                        </button>
                      </div>

                      <div className="relative z-10 p-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                        <h4 className="text-xs font-bold text-white line-clamp-1">{reel.title}</h4>
                        <p className="text-[10px] text-slate-200 line-clamp-1">{reel.author.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {savedPosts.length === 0 && savedReels.length === 0 && (
              <div className="py-14 text-center bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                  <Bookmark className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">No saved items yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Bookmark posts and reels in your feed or explore views to save them here for quick access later.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 border border-amber-500/50 text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 z-50 animate-fadeIn">
          <Bookmark className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ✨ AI AVATAR GENERATOR MODAL */}
      {isAIAvatarModalOpen && (
        <div
          onClick={() => setIsAIAvatarModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">✨ AI Avatar Studio</h3>
                  <p className="text-[10px] text-slate-500">Generate a stylized profile avatar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAIAvatarModalOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar Preview Canvas */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-28 h-28 rounded-3xl overflow-hidden border-4 border-purple-300 shadow-lg bg-slate-100 flex items-center justify-center relative">
                {generatedAvatarPreview ? (
                  <img
                    src={generatedAvatarPreview}
                    alt="AI Avatar Preview"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={userProfile.avatar}
                    alt="Current Avatar"
                    decoding="async"
                    className="w-full h-full object-cover opacity-80"
                  />
                )}
                {isGeneratingAvatar && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mb-1" />
                    <span className="text-[10px] text-teal-200 font-bold">Rendering...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Style Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Avatar Aesthetic Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {AVATAR_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setSelectedAvatarStyle(style)}
                    className={`p-2 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                      selectedAvatarStyle === style
                        ? 'bg-purple-50 border-purple-400 text-purple-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom traits input */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Custom Visual Traits (Optional)
              </label>
              <input
                type="text"
                value={avatarTraits}
                onChange={(e) => setAvatarTraits(e.target.value)}
                placeholder="e.g. silver hair, neon goggles, smiling..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleGenerateAIAvatar}
                disabled={isGeneratingAvatar}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-purple-700 hover:text-purple-900 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{generatedAvatarPreview ? 'Reroll Style' : 'Generate Avatar'}</span>
              </button>

              {generatedAvatarPreview && (
                <button
                  type="button"
                  onClick={handleApplyAIAvatar}
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Set as Avatar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Individual Content Drilldown Analytics Modal */}
      {inspectingAnalyticsItem && (
        <ContentAnalyticsModal
          isOpen={!!inspectingAnalyticsItem}
          onClose={() => setInspectingAnalyticsItem(null)}
          content={inspectingAnalyticsItem}
        />
      )}
    </div>
  );
};

export default ProfileView;
