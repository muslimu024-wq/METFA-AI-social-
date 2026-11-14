import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import {
  Film,
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  Plus,
  Volume2,
  VolumeX,
  Repeat,
  Bookmark,
  MoreVertical,
  Trash2,
  Edit3,
  Copy,
  Flag,
  CheckCircle2,
  X,
  Music,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Radio,
  Search,
  Send,
  UserPlus,
  UserCheck,
  Globe,
  Users,
  Lock,
  Clock,
  AlertCircle,
  Info,
  User,
} from 'lucide-react';
import { FollowRelationStatus, PostAudience, ProfilePrivacy, ReelHighlight, UserProfile, PostComment } from '../types/community';
import { AudioTrack } from '../types/audio';
import { useAuth } from '../context/AuthContext';
import {
  saveReelHighlights,
  incrementReelShares,
  deleteReelHighlight,
  editReelHighlight,
} from '../utils/socialStore';
import {
  deletePersistentReel,
  editPersistentReel,
} from '../services/reelService';
import { fetchComments, createComment } from '../services/engagementService';
import {
  followUser,
  unfollowUser,
  cancelFollowRequest,
  fetchFollowedUserIds,
  fetchOutgoingPendingRequests,
  fetchProfilesPrivacyBatch,
  isValidProfileUuid,
} from '../services/followService';
import {
  getFollowedUserIds,
  isUserFollowed,
  isFollowRequestPending,
  replaceFollowedUsersCache,
  replacePendingFollowRequestsCache,
  syncFollowCache,
  syncPendingFollowRequestCache,
} from '../utils/followStore';
import { isSupabaseConfigured } from '../services/supabaseClient';
import {
  canSharePost,
  canViewerAccessPost,
  formatAudienceMeta,
  isLegacyUnspecifiedAudience,
  normalizeAudience,
} from '../utils/privacyPolicy';
import { getAudioTracks } from '../utils/audioStore';
import { isContentOwner } from '../utils/communityStore';
import { toggleSaveReel } from '../utils/bookmarkStore';
import { executeNativeShare, SharePayload } from '../utils/shareUtils';
import { AdvancedVideoControls } from './AdvancedVideoControls';
import { VideoPlaybackSessionTracker } from '../utils/videoTracker';
import {
  reelToContentDescriptor,
  trackContentImpression,
  trackEngagementAction,
  trackFollowAttribution,
} from '../utils/contentTracker';
import { TrendingUp } from 'lucide-react';

import PostDetailsModal from './PostDetailsModal';

// Lazy-load action modals
const SocialShareModal = lazy(() => import('./SocialShareModal'));
const ConfirmActionModal = lazy(() => import('./ConfirmActionModal'));
const AudioLicenseInfoModal = lazy(() => import('./AudioLicenseInfoModal'));
const ContentAnalyticsModal = lazy(() => import('./ContentAnalyticsModal'));

interface ReelsFeedViewProps {
  reels: ReelHighlight[];
  directSelectedReel?: ReelHighlight | null;
  onUpdateReels: (reels: ReelHighlight[]) => void;
  userProfile: UserProfile;
  onRemixPrompt: (prompt: string) => void;
  onCreateReelClick: () => void;
  isLoading?: boolean;
  targetReelId?: string | null;
  onClearTargetReel?: () => void;
  initialCurrentTime?: number;
  onNavigateTab?: (tabId: string) => void;
  onViewProfile?: (userId: string) => void;
  onUseMusic?: (track: AudioTrack) => void;
}

export const ReelsFeedView: React.FC<ReelsFeedViewProps> = ({
  reels,
  directSelectedReel,
  onUpdateReels,
  userProfile,
  onRemixPrompt,
  onCreateReelClick,
  isLoading = false,
  targetReelId,
  onClearTargetReel,
  initialCurrentTime,
  onNavigateTab,
  onViewProfile,
  onUseMusic,
}) => {
  const { user: authUser } = useAuth();
  // Immersive Reels Overlay Feed Filters & Search
  const [feedFilter, setFeedFilter] = useState<'forYou' | 'following'>('forYou');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followedAuthorIds, setFollowedAuthorIds] = useState<string[]>(() =>
    isSupabaseConfigured() ? [] : getFollowedUserIds()
  );
  const [pendingRequestIds, setPendingRequestIds] = useState<string[]>([]);
  const [profilesPrivacyMap, setProfilesPrivacyMap] = useState<Map<string, ProfilePrivacy>>(new Map());

  const getReelFollowStatus = (reel: ReelHighlight): FollowRelationStatus => {
    const aid = reel.author?.id?.toLowerCase();
    const uname = reel.author?.username?.toLowerCase();
    const supabaseActive = isSupabaseConfigured();
    const isFollowed =
      followedAuthorIds.some((id) => id.toLowerCase() === aid || id.toLowerCase() === uname) ||
      (!supabaseActive && (isUserFollowed(reel.author?.id) || isUserFollowed(reel.author?.username)));
    if (isFollowed) return 'following';
    if (
      (aid && pendingRequestIds.some((id) => id.toLowerCase() === aid)) ||
      isFollowRequestPending(reel.author?.id)
    ) {
      return 'pending';
    }
    return 'none';
  };

  const resolveReelAuthorPrivacy = (reel: ReelHighlight): ProfilePrivacy =>
    (reel.author?.id && profilesPrivacyMap.get(reel.author.id)) ||
    reel.authorProfilePrivacy ||
    reel.author?.profilePrivacy ||
    'public';

  // Combine persistent reels with any transient Feed-selected reel, enforce visibility rules,
  // hoist targetReelId to top, and apply Following / Search filters cleanly.
  const baseReels = React.useMemo(() => {
    const combined =
      directSelectedReel && !reels.some((r) => r.id === directSelectedReel.id)
        ? [directSelectedReel, ...reels]
        : reels;
    const viewerId = authUser?.id || (userProfile?.id !== 'guest' ? userProfile?.id : null);
    const accessible = combined.filter((r) => {
      const viewerIsOwner = isContentOwner(r.author, userProfile, authUser, undefined, r.id);
      const followStatus = getReelFollowStatus(r);
      return canViewerAccessPost({
        visibility: r.visibility,
        authorId: r.author?.id,
        authorProfilePrivacy: resolveReelAuthorPrivacy(r),
        viewerId,
        viewerFollowsAuthor: followStatus === 'following',
        viewerIsOwner,
      });
    });
    if (!targetReelId) return accessible;
    const target = accessible.find((r) => r.id === targetReelId);
    if (!target) return accessible;
    return [target, ...accessible.filter((r) => r.id !== targetReelId)];
  }, [reels, directSelectedReel, targetReelId, authUser?.id, userProfile?.id, followedAuthorIds, profilesPrivacyMap]);

  const displayedReels = React.useMemo(() => {
    let list = baseReels;
    if (feedFilter === 'following') {
      list = list.filter((r) => getReelFollowStatus(r) === 'following');
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.caption?.toLowerCase().includes(q) ||
          r.author?.name?.toLowerCase().includes(q) ||
          r.author?.username?.toLowerCase().includes(q) ||
          r.musicTrack?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [baseReels, feedFilter, followedAuthorIds, pendingRequestIds, searchQuery]);

  const [activeSharePayload, setActiveSharePayload] = useState<SharePayload | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingReelId, setSharingReelId] = useState<string | null>(null);

  // Reel CRUD & Context Menu State
  const [activeReelMenuId, setActiveReelMenuId] = useState<string | null>(null);
  const [editingReel, setEditingReel] = useState<ReelHighlight | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingCaption, setEditingCaption] = useState('');
  const [editingVisibility, setEditingVisibility] = useState<PostAudience | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [inspectingAudioTrack, setInspectingAudioTrack] = useState<AudioTrack | null>(null);
  const [inspectingAnalyticsReel, setInspectingAnalyticsReel] = useState<ReelHighlight | null>(null);
  const [inspectingDetailsReel, setInspectingDetailsReel] = useState<ReelHighlight | null>(null);

  // Comments Drawer State
  const [activeCommentsReel, setActiveCommentsReel] = useState<ReelHighlight | null>(null);
  const [reelComments, setReelComments] = useState<PostComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Authoritative Follow state & pending requests synchronization (never additive across accounts)
  useEffect(() => {
    let active = true;
    const refreshFollows = () => setFollowedAuthorIds(getFollowedUserIds());
    window.addEventListener('metfa_following_updated', refreshFollows);

    if (authUser?.id) {
      fetchFollowedUserIds().then(({ followedIds, error }) => {
        if (!active || error) return;
        replaceFollowedUsersCache(followedIds);
        setFollowedAuthorIds(Array.from(followedIds));
      });
      fetchOutgoingPendingRequests().then(({ targetIds, error }) => {
        if (!active || error) return;
        replacePendingFollowRequestsCache(targetIds);
        setPendingRequestIds(Array.from(targetIds));
      });
    } else {
      setFollowedAuthorIds(isSupabaseConfigured() ? [] : getFollowedUserIds());
      setPendingRequestIds([]);
    }

    return () => {
      active = false;
      window.removeEventListener('metfa_following_updated', refreshFollows);
    };
  }, [authUser?.id]);

  // Batch-load author profile privacy settings for reel creators
  useEffect(() => {
    const ids = Array.from(
      new Set(reels.map((r) => r.author?.id).filter((id): id is string => Boolean(id && isValidProfileUuid(id))))
    );
    if (ids.length === 0) return;
    let active = true;
    fetchProfilesPrivacyBatch(ids).then(({ privacyMap, error }) => {
      if (!error && active && privacyMap.size > 0) {
        setProfilesPrivacyMap(privacyMap);
      }
    });
    return () => {
      active = false;
    };
  }, [reels]);

  // Reels Audio Mute / Unmute State & Direct Video Element DOM synchronization
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeVisibleReelId, setActiveVisibleReelId] = useState<string | null>(
    () => targetReelId || directSelectedReel?.id || reels[0]?.id || null
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<{ [id: string]: HTMLVideoElement | null }>({});

  // Stable ref map for AdvancedVideoControls integration
  const reelVideoRefs = useRef<Map<string, { current: HTMLVideoElement | null }>>(new Map());
  const getReelVideoRef = React.useCallback((id: string): React.RefObject<HTMLVideoElement | null> => {
    if (!reelVideoRefs.current.has(id)) {
      reelVideoRefs.current.set(id, { current: videoRefs.current[id] || null });
    }
    const r = reelVideoRefs.current.get(id)!;
    r.current = videoRefs.current[id] || null;
    return r as React.RefObject<HTMLVideoElement | null>;
  }, []);

  // Keep activeVisibleReelId synced when displayedReels list changes
  useEffect(() => {
    if (displayedReels.length === 0) {
      setActiveVisibleReelId(null);
      return;
    }
    if (targetReelId && displayedReels.some((r) => r.id === targetReelId)) {
      setActiveVisibleReelId(targetReelId);
      return;
    }
    if (!activeVisibleReelId || !displayedReels.some((r) => r.id === activeVisibleReelId)) {
      setActiveVisibleReelId(displayedReels[0].id);
    }
  }, [displayedReels, targetReelId, activeVisibleReelId]);

  // Track currently visible snapped Reel via IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const rid = (entry.target as HTMLElement).dataset.reelId;
            if (rid) {
              setActiveVisibleReelId(rid);
            }
          }
        }
      },
      { root: container, threshold: [0.6] }
    );

    const slides = container.querySelectorAll('[data-reel-id]');
    slides.forEach((slide) => observer.observe(slide));

    return () => observer.disconnect();
  }, [displayedReels]);

  const toggleSound = (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMuted((prev) => {
      const nextMuted = !prev;
      const el = videoRefs.current[reelId];
      if (el) {
        el.muted = nextMuted;
        if (!nextMuted) {
          el.play().catch((err) => {
            console.log('[Reels Sound] Explicit play attempt error:', err);
          });
        }
      }
      return nextMuted;
    });
  };

  // Play only the currently snapped active reel & pause offscreen reels (with muted autoplay policy fallback)
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, el]) => {
      if (!el) return;
      el.muted = isMuted;
      if (!activeVisibleReelId || id === activeVisibleReelId) {
        el.play().catch((err) => {
          if (!isMuted && err?.name === 'NotAllowedError') {
            el.muted = true;
            setIsMuted(true);
            el.play().catch(() => {});
          } else {
            console.log('[Reels Sound] Browser playback notice:', err);
          }
        });
      } else {
        try {
          el.playbackRate = 1;
          el.pause();
        } catch {}
      }
    });
    }, [isMuted, displayedReels, activeVisibleReelId]);

  // Emit genuine Reel impression & attach VideoPlaybackSessionTracker to active reel video element
  useEffect(() => {
    if (!activeVisibleReelId) return;
    const activeReel = displayedReels.find((r) => r.id === activeVisibleReelId);
    const el = videoRefs.current[activeVisibleReelId];
    if (!activeReel) return;

    trackContentImpression({
      contentId: activeReel.id,
      contentType: 'reel',
      creatorId: activeReel.author?.id || '',
      viewerId: userProfile?.id,
      trafficSource: 'reels',
    });

    if (!el) return;
    const tracker = new VideoPlaybackSessionTracker({
      videoId: activeReel.id,
      videoType: 'reel',
      creatorId: activeReel.author?.id || '',
      viewerId: userProfile?.id,
      trafficSource: 'reels',
    });
    tracker.attach(el);

    return () => {
      tracker.detach();
    };
  }, [activeVisibleReelId, displayedReels, userProfile?.id]);

  // Clean up, restore 1X speed, and pause videos when unmounting Reels feed to prevent audio leaking
  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach((el) => {
        if (el) {
          try {
            el.playbackRate = 1;
            el.pause();
          } catch {}
        }
      });
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle auto-scroll and fallback notification when targetReelId is passed
  useEffect(() => {
    if (!isLoading && targetReelId && baseReels.length > 0) {
      const exists = baseReels.some((r) => r.id === targetReelId);
      if (!exists) {
        showToast('The selected reel is unavailable or has been removed.');
        if (onClearTargetReel) {
          onClearTargetReel();
        }
      } else {
        const el = document.getElementById(`reel-${targetReelId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }
    }
  }, [isLoading, targetReelId, baseReels, onClearTargetReel]);

  // Seek target Reel to initialCurrentTime when navigating from Feed with position continuity
  useEffect(() => {
    if (targetReelId && typeof initialCurrentTime === 'number' && initialCurrentTime > 0) {
      const el = videoRefs.current[targetReelId];
      if (el) {
        const applySeek = () => {
          try {
            el.currentTime = initialCurrentTime;
          } catch (err) {
            console.log('[Reels Position Continuity] Seek error:', err);
          }
        };
        if (el.readyState >= 1) {
          applySeek();
        } else {
          el.addEventListener('loadedmetadata', applySeek, { once: true });
        }
      }
    }
  }, [targetReelId, initialCurrentTime]);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu-root="true"]')) {
        setActiveReelMenuId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleExitReelsTo = (targetTab: string) => {
    Object.values(videoRefs.current).forEach((el) => {
      if (el) {
        try {
          el.playbackRate = 1;
          el.pause();
        } catch {}
      }
    });
    if (onClearTargetReel) onClearTargetReel();
    if (onNavigateTab) {
      onNavigateTab(targetTab);
    }
  };

  const handleCreatorProfileClick = (authorId: string) => {
    if (!authorId) return;
    Object.values(videoRefs.current).forEach((el) => {
      if (el) {
        try {
          el.playbackRate = 1;
          el.pause();
        } catch {}
      }
    });
    if (onViewProfile) {
      onViewProfile(authorId);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metfa_view_profile', { detail: { userId: authorId } }));
    }
  };

  const handleFollowToggle = async (author: ReelHighlight['author'], sourceReelId?: string) => {
    if (isContentOwner(author, userProfile, authUser, undefined, sourceReelId)) {
      return;
    }

    const aid = author.id.toLowerCase();
    const uname = author.username.toLowerCase();
    const currentlyFollowed =
      followedAuthorIds.some((id) => id.toLowerCase() === aid || id.toLowerCase() === uname) ||
      (!isSupabaseConfigured() && (isUserFollowed(author.id) || isUserFollowed(author.username)));
    const currentlyPending =
      pendingRequestIds.some((id) => id.toLowerCase() === aid) || isFollowRequestPending(author.id);

    if (!isValidProfileUuid(author.id)) {
      if (isSupabaseConfigured()) return;
      const nextFollow = !currentlyFollowed;
      syncFollowCache(author, nextFollow);
      setFollowedAuthorIds(getFollowedUserIds());
      trackFollowAttribution({
        creatorId: author.id,
        viewerId: authUser?.id || userProfile?.id,
        contentId: sourceReelId,
        contentType: 'reel',
        attributionMethod: 'direct_content_follow',
        followDelta: nextFollow ? 1 : -1,
        trafficSource: 'reels',
      });
      showToast(nextFollow ? `Following @${author.username}` : `Unfollowed @${author.username}`);
      return;
    }

    if (currentlyPending) {
      const res = await cancelFollowRequest(author.id);
      if (!res.success && res.error?.toLowerCase().includes('authentication')) {
        window.dispatchEvent(new CustomEvent('metfa_open_auth_modal'));
        return;
      }
      if (res.success) {
        setPendingRequestIds((prev) => prev.filter((id) => id.toLowerCase() !== aid));
        syncPendingFollowRequestCache(author.id, false);
        showToast(`Follow request cancelled for @${author.username}`);
      } else {
        showToast(res.error || 'Could not cancel follow request');
      }
      return;
    }

    const res = currentlyFollowed ? await unfollowUser(author.id) : await followUser(author.id);
    if (!res.success && res.error?.toLowerCase().includes('authentication')) {
      window.dispatchEvent(new CustomEvent('metfa_open_auth_modal'));
      return;
    }
    if (res.success && res.requestStatus === 'pending') {
      setPendingRequestIds((prev) => Array.from(new Set([...prev, author.id])));
      syncPendingFollowRequestCache(author.id, true);
      syncFollowCache(author, false);
      showToast(`Follow request sent to @${author.username}`);
      return;
    }
    syncFollowCache(author, res.isFollowing);
    syncPendingFollowRequestCache(author.id, false);
    if (res.isFollowing) {
      setFollowedAuthorIds((prev) => Array.from(new Set([...prev, author.id])));
    } else {
      setFollowedAuthorIds((prev) => prev.filter((id) => id.toLowerCase() !== aid));
    }
    if (res.success) {
      trackFollowAttribution({
        creatorId: author.id,
        viewerId: authUser?.id || userProfile?.id,
        contentId: sourceReelId,
        contentType: 'reel',
        attributionMethod: 'direct_content_follow',
        followDelta: res.isFollowing ? 1 : -1,
        trafficSource: 'reels',
      });
    }
    showToast(res.isFollowing ? `Following @${author.username}` : `Unfollowed @${author.username}`);
  };

  const handleOpenComments = async (reel: ReelHighlight) => {
    setActiveCommentsReel(reel);
    setCommentText('');
    setIsLoadingComments(true);
    const { comments } = await fetchComments(reel.id);
    setReelComments(comments);
    setIsLoadingComments(false);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommentsReel || isSubmittingComment) return;
    const clean = commentText.trim();
    if (!clean) return;

    setIsSubmittingComment(true);
    const { comment, error } = await createComment(activeCommentsReel.id, clean);
    setIsSubmittingComment(false);

    if (error && error.toLowerCase().includes('authentication')) {
      window.dispatchEvent(new CustomEvent('metfa_open_auth_modal'));
      return;
    }
    if (error || !comment) {
      showToast(error || 'Could not post comment right now');
      return;
    }

    setReelComments((prev) => [...prev, comment]);
    setCommentText('');

    trackEngagementAction({
      contentId: activeCommentsReel.id,
      contentType: 'reel',
      creatorId: activeCommentsReel.author?.id || '',
      viewerId: userProfile?.id,
      action: 'comment',
      trafficSource: 'reels',
    });

    const updated = reels.map((r) =>
      r.id === activeCommentsReel.id ? { ...r, commentsCount: (r.commentsCount || 0) + 1 } : r
    );
    onUpdateReels(updated);
    saveReelHighlights(updated);
    setActiveCommentsReel((prev) =>
      prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : prev
    );
  };

  const handleStartEditReel = (reel: ReelHighlight) => {
    setEditingReel(reel);
    setEditingTitle(reel.title);
    setEditingCaption(reel.caption);
    setEditingVisibility(normalizeAudience(reel.visibility));
    setActiveReelMenuId(null);
  };

  const handleSaveReelEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReel) return;
    const finalTitle = editingTitle.trim() || editingReel.title;
    const finalCaption = editingCaption.trim() || editingReel.caption;
    const resolvedVisibility =
      editingVisibility !== null ? editingVisibility : (editingReel.visibility ?? null);

    editPersistentReel(
      editingReel.id,
      {
        title: finalTitle,
        caption: finalCaption,
        ...(editingVisibility !== null ? { visibility: editingVisibility } : {}),
      },
      authUser?.id || userProfile.id
    );

    const updated = editReelHighlight(editingReel.id, {
      title: finalTitle,
      caption: finalCaption,
      visibility: resolvedVisibility,
    });
    onUpdateReels(updated);
    setEditingReel(null);
    showToast('Reel updated successfully');
  };

  const handleDeleteReel = (reelId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Reel',
      message: 'Are you sure you want to permanently delete this reel? This action cannot be undone.',
      onConfirm: () => {
        deletePersistentReel(reelId, userProfile.id);
        const updated = deleteReelHighlight(reelId);
        onUpdateReels(updated);
        setActiveReelMenuId(null);
        showToast('Reel deleted successfully');
      },
    });
  };

  const handleLike = (id: string) => {
    const targetReel = reels.find((r) => r.id === id);
    if (targetReel) {
      trackEngagementAction({
        contentId: targetReel.id,
        contentType: 'reel',
        creatorId: targetReel.author?.id || '',
        viewerId: userProfile?.id,
        action: 'like',
        trafficSource: 'reels',
      });
    }
    const updated = reels.map((r) => {
      if (r.id === id) {
        const isLiked = !r.isLiked;
        return {
          ...r,
          isLiked,
          likesCount: isLiked ? r.likesCount + 1 : Math.max(0, r.likesCount - 1),
        };
      }
      return r;
    });
    onUpdateReels(updated);
    saveReelHighlights(updated);
  };

  const handleToggleSaveReel = (reelId: string) => {
    const res = toggleSaveReel(reelId);
    if (res.isSaved) {
      const targetReel = reels.find((r) => r.id === reelId);
      trackEngagementAction({
        contentId: reelId,
        contentType: 'reel',
        creatorId: targetReel?.author?.id || '',
        viewerId: userProfile?.id,
        action: 'save',
        trafficSource: 'reels',
      });
    }
    onUpdateReels(res.updatedReels);
    showToast(res.isSaved ? 'Saved reel to your bookmarks!' : 'Removed reel from bookmarks');
  };

  const handleShareReel = async (reel: ReelHighlight) => {
    const authorPrivacy = resolveReelAuthorPrivacy(reel);
    if (!canSharePost({ visibility: reel.visibility, authorProfilePrivacy: authorPrivacy })) {
      showToast('Sharing is disabled for Followers-only, Only Me, or Private-profile Reels.');
      return;
    }
    trackEngagementAction({
      contentId: reel.id,
      contentType: 'reel',
      creatorId: reel.author?.id || '',
      viewerId: authUser?.id || userProfile?.id,
      action: 'share',
      trafficSource: 'reels',
    });
    setSharingReelId(reel.id);
    const payload: SharePayload = {
      id: reel.id,
      type: 'reel',
      title: `${reel.title} - Metfa Reel`,
      text: `${reel.title}: ${reel.caption}`,
      url: window.location.href,
      imageSrc: reel.thumbnailSrc || undefined,
      authorName: reel.author.name,
      authorUsername: reel.author.username,
    };

    const handleIncrement = () => {
      const updated = incrementReelShares(reel.id);
      onUpdateReels(updated);
    };

    await executeNativeShare(payload, {
      onSuccess: () => {
        handleIncrement();
      },
      onFallback: () => {
        setActiveSharePayload(payload);
        setIsShareModalOpen(true);
      },
    });
  };

  return (
    <div
      data-testid="reels-immersive-viewport"
      className="relative flex-1 w-full h-full min-h-0 bg-black text-white overflow-hidden select-none"
    >
      {/* Immersive Transparent Overlay Top Navigation (METFA's own Reels Chrome) */}
      <div
        data-testid="reels-top-overlay-nav"
        className="absolute top-0 inset-x-0 z-30 pt-2.5 pb-3 px-3 sm:px-4 bg-gradient-to-b from-black/75 via-black/35 to-transparent pointer-events-none"
      >
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          {/* Left: Back to Feed & Live */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="reels-nav-back-btn"
              onClick={() => handleExitReelsTo('feed')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition cursor-pointer"
              title="Back to Feed"
              aria-label="Back to Feed"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              data-testid="reels-nav-live-btn"
              onClick={() => handleExitReelsTo('live')}
              className="px-2 py-1.5 rounded-lg text-[11px] font-bold text-white/85 hover:text-white hover:bg-white/10 active:scale-95 transition flex items-center gap-1 cursor-pointer"
              title="METFA Live"
              aria-label="Live"
            >
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              <span>Live</span>
            </button>
          </div>

          {/* Center: Following / For You / Community */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              data-testid="reels-tab-following"
              onClick={() => setFeedFilter('following')}
              className={`relative py-1 text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
                feedFilter === 'following' ? 'text-white' : 'text-white/65 hover:text-white/90'
              }`}
            >
              <span>Following</span>
              {feedFilter === 'following' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-teal-400 rounded-full" />
              )}
            </button>

            <button
              type="button"
              data-testid="reels-tab-foryou"
              onClick={() => setFeedFilter('forYou')}
              className={`relative py-1 text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
                feedFilter === 'forYou' ? 'text-white' : 'text-white/65 hover:text-white/90'
              }`}
            >
              <span>For You</span>
              {feedFilter === 'forYou' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-teal-400 rounded-full" />
              )}
            </button>

            <button
              type="button"
              data-testid="reels-tab-community"
              onClick={() => handleExitReelsTo('feed')}
              className="py-1 text-xs sm:text-sm font-bold text-white/65 hover:text-white transition cursor-pointer whitespace-nowrap"
            >
              Community
            </button>
          </div>

          {/* Right: Search & Post Reel */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="reels-nav-search-btn"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                isSearchOpen || searchQuery.trim()
                  ? 'bg-teal-500/25 text-teal-300'
                  : 'text-white/90 hover:text-white hover:bg-white/15'
              }`}
              title="Search Reels"
              aria-label="Search Reels"
            >
              <Search className="w-4.5 h-4.5" />
            </button>

            <button
              type="button"
              data-testid="reels-nav-create-btn"
              onClick={onCreateReelClick}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white flex items-center justify-center shadow-md active:scale-95 transition cursor-pointer"
              title="Post Reel"
              aria-label="Post Reel"
            >
              <Plus className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Inline Working Reels Search Input */}
        {isSearchOpen && (
          <div className="mt-2 flex items-center gap-2 bg-black/80 backdrop-blur-md border border-white/15 rounded-xl px-3 py-1.5 pointer-events-auto animate-fadeIn">
            <Search className="w-4 h-4 text-teal-400 shrink-0" />
            <input
              type="text"
              data-testid="reels-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reels by title, creator, caption, or music..."
              className="w-full bg-transparent text-xs text-white placeholder-white/50 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-white/60 hover:text-white p-0.5 cursor-pointer"
                aria-label="Clear reels search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="text-[11px] font-bold text-white/70 hover:text-white px-1.5 cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Full-Viewport Vertical Snap-Scroll Reels Container */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-y-auto snap-y snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {isLoading && displayedReels.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center space-y-3 bg-black">
            <div className="w-14 h-14 rounded-full bg-purple-950/60 text-purple-400 border border-purple-800/50 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Loading Community Reels...</h3>
              <p className="text-xs text-slate-400">Fetching latest creations from cloud storage</p>
            </div>
          </div>
        ) : displayedReels.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center space-y-4 bg-black animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-purple-950/60 text-purple-400 border border-purple-800/50 flex items-center justify-center">
              <Film className="w-8 h-8 text-purple-400" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="text-base font-bold text-white">
                {searchQuery.trim()
                  ? `No reels match "${searchQuery.trim()}"`
                  : feedFilter === 'following'
                    ? 'No reels from followed creators yet'
                    : 'No Reels yet'}
              </h3>
              <p className="text-xs text-slate-400">
                {searchQuery.trim()
                  ? 'Try another keyword or clear your search filter.'
                  : feedFilter === 'following'
                    ? 'Follow creators in For You to see their latest Reels here.'
                    : 'Be the first creator to share a 90-second AI reel with the METFA Social community!'}
              </p>
            </div>
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Clear Search
              </button>
            ) : feedFilter === 'following' ? (
              <button
                type="button"
                onClick={() => setFeedFilter('forYou')}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-teal-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Explore For You
              </button>
            ) : (
              <button
                type="button"
                onClick={onCreateReelClick}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-md transition transform active:scale-95 cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Reel</span>
              </button>
            )}
          </div>
        ) : (
          displayedReels.map((reel, idx) => {
            const followStatus = getReelFollowStatus(reel);
            const isFollowingAuthor = followStatus === 'following';
            const isOwner = isContentOwner(reel.author, userProfile, authUser, undefined, reel.id);
            const authorPrivacy = resolveReelAuthorPrivacy(reel);
            const audienceMeta = formatAudienceMeta(reel.visibility, authorPrivacy);
            const allowExternalShare = canSharePost({
              visibility: reel.visibility,
              authorProfilePrivacy: authorPrivacy,
            });

            return (
              <div
                key={reel.id}
                id={`reel-${reel.id}`}
                data-reel-id={reel.id}
                data-testid={`reel-card-${reel.id}`}
                className="relative w-full h-full min-h-full snap-start snap-always overflow-hidden bg-black flex flex-col justify-between"
              >
                {/* Full-Viewport Edge-to-Edge Video */}
                <video
                  ref={(el) => {
                    videoRefs.current[reel.id] = el;
                    const stable = reelVideoRefs.current.get(reel.id);
                    if (stable) stable.current = el;
                  }}
                  src={reel.videoSrc}
                  poster={reel.thumbnailSrc}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover bg-black"
                />

                {/* Edge-legibility dark gradients (never blocks touch) */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75 pointer-events-none" />

                {/* Top Bar (z-30 stays clickable above tap-reveal layer) — Sound & Context Menu cleanly positioned under Global Overlay Nav */}
                <div className="relative z-30 flex items-center justify-between pt-14 px-3 sm:px-4 text-xs text-white pointer-events-none">
                  <div className="flex items-center gap-2 pointer-events-auto">
                    {targetReelId === reel.id && (
                      <span
                        data-testid={`reel-target-badge-${reel.id}`}
                        className="px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded-md text-[10px] font-semibold backdrop-blur-xs"
                      >
                        From Feed
                      </span>
                    )}
                  </div>

                  {/* Right controls: Sound Toggle & Context Menu */}
                  <div className="flex items-center gap-2 pointer-events-auto">
                    <button
                      type="button"
                      data-testid={`reel-sound-toggle-btn-${reel.id}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => toggleSound(reel.id, e)}
                      className={`w-9 h-9 rounded-full backdrop-blur-md border transition cursor-pointer flex items-center justify-center touch-manipulation ${
                        isMuted
                          ? 'bg-black/50 border-rose-500/50 text-rose-300 hover:bg-black/75'
                          : 'bg-teal-950/75 border-teal-500/50 text-teal-300 hover:bg-teal-900 shadow-sm shadow-teal-500/20'
                      }`}
                      title={isMuted ? 'Unmute Reel Audio' : 'Mute Reel Audio'}
                      aria-label={isMuted ? 'Unmute Reel Audio' : 'Mute Reel Audio'}
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-teal-300" />
                      )}
                    </button>

                    <div className="relative" data-menu-root="true">
                      <button
                        type="button"
                        id={`reel-menu-btn-${reel.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReelMenuId((prev) => (prev === reel.id ? null : reel.id));
                        }}
                        className="w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white border border-white/15 backdrop-blur-md transition flex items-center justify-center cursor-pointer"
                        title="Reel options"
                        aria-label="Reel options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeReelMenuId === reel.id && (
                        <div
                          id={`reel-menu-dropdown-${reel.id}`}
                          className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-40 animate-scaleUp text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {reel.author?.id && (
                            <button
                              type="button"
                              id={`view-profile-reel-btn-${reel.id}`}
                              onClick={() => {
                                setActiveReelMenuId(null);
                                handleCreatorProfileClick(reel.author.id);
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                            >
                              <User className="w-4 h-4 text-slate-500 shrink-0" />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800 truncate">View Profile</div>
                                {reel.author?.username && (
                                  <div className="text-[11px] font-mono text-slate-500 truncate">
                                    @{reel.author.username.replace(/^@/, '')}
                                  </div>
                                )}
                              </div>
                            </button>
                          )}

                          <button
                            type="button"
                            id={`reel-details-menu-btn-${reel.id}`}
                            onClick={() => {
                              setActiveReelMenuId(null);
                              setInspectingDetailsReel(reel);
                            }}
                            className="w-full px-3.5 py-2 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                          >
                            <Info className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>Post Details &amp; Tags</span>
                          </button>

                          <div className="h-px bg-slate-100 my-1" />

                          <button
                            type="button"
                            id={`save-reel-menu-btn-${reel.id}`}
                            onClick={() => {
                              handleToggleSaveReel(reel.id);
                              setActiveReelMenuId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left text-slate-700 hover:text-purple-700 hover:bg-purple-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                          >
                            <Bookmark className={`w-4 h-4 ${reel.isSaved ? 'text-amber-500 fill-amber-500' : 'text-amber-500'}`} />
                            <span className="font-semibold">{reel.isSaved ? 'Unsave Reel' : 'Save Reel'}</span>
                          </button>

                          {allowExternalShare && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/#reel-${reel.id}`);
                                setActiveReelMenuId(null);
                                showToast('Reel link copied');
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                            >
                              <Copy className="w-4 h-4 text-teal-600" />
                              <span>Copy Link</span>
                            </button>
                          )}

                          {isOwner ? (
                            <>
                              <div className="h-px bg-slate-100 my-1" />
                              <button
                                type="button"
                                id={`analytics-reel-btn-${reel.id}`}
                                onClick={() => {
                                  setActiveReelMenuId(null);
                                  setInspectingAnalyticsReel(reel);
                                }}
                                className="w-full px-3.5 py-2 text-left text-teal-700 hover:text-teal-900 hover:bg-teal-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                              >
                                <TrendingUp className="w-4 h-4 text-teal-600" />
                                <span>Insights &amp; Analytics</span>
                              </button>

                              <button
                                type="button"
                                id={`edit-reel-btn-${reel.id}`}
                                onClick={() => handleStartEditReel(reel)}
                                className="w-full px-3.5 py-2 text-left text-purple-700 hover:text-purple-900 hover:bg-purple-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4 text-purple-600" />
                                <span>Edit Caption/Tags</span>
                              </button>

                              <button
                                type="button"
                                id={`delete-reel-btn-${reel.id}`}
                                onClick={() => handleDeleteReel(reel.id)}
                                className="w-full px-3.5 py-2 text-left text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete Reel</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="h-px bg-slate-100 my-1" />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveReelMenuId(null);
                                  showToast('Reel reported to moderators');
                                }}
                                className="w-full px-3.5 py-2 text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                              >
                                <Flag className="w-4 h-4 text-slate-400" />
                                <span>Report Content</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Advanced Video Controls (Reels-only 3 center circular controls, 2X Hold-to-Speed, & Unobstructed Bottom Timeline) */}
                <div className="absolute inset-0 z-20 pointer-events-none" onClick={(e) => e.stopPropagation()}>
                  <AdvancedVideoControls
                    videoRef={getReelVideoRef(reel.id)}
                    reelId={reel.id}
                    isMuted={isMuted}
                    onToggleMute={(e) => toggleSound(reel.id, e)}
                    title={reel.title}
                    theme="glass"
                    variant="reels"
                  />
                </div>

                {/* Bottom Info & Right Actions (z-30 stays clickable above tap-reveal layer; pb-14 + pointer-events-none keeps bottom timeline 100% unobstructed) */}
                <div className="relative z-30 pb-14 px-3 sm:px-4 flex items-end justify-between gap-4 pointer-events-none">
                  {/* Bottom-Left Creator, Caption, Music & Remix Info */}
                  <div className="flex-1 min-w-0 space-y-1.5 pointer-events-auto">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleCreatorProfileClick(reel.author.id)}
                        className="shrink-0 cursor-pointer"
                        aria-label={`View ${reel.author.name} profile`}
                      >
                        <img
                          src={reel.author.avatar}
                          alt={reel.author.name}
                          loading={idx === 0 ? undefined : 'lazy'}
                          decoding="async"
                          className="w-9 h-9 rounded-full border border-white/30 object-cover"
                        />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCreatorProfileClick(reel.author.id)}
                            className="text-left group cursor-pointer inline-flex items-center gap-1 min-w-0"
                          >
                            <span className="font-bold text-white text-sm group-hover:text-teal-300 transition truncate max-w-[180px] drop-shadow">
                              {reel.author.name}
                            </span>
                          </button>

                          {!isOwner && (
                            <button
                              type="button"
                              onClick={() => handleFollowToggle(reel.author, reel.id)}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                                followStatus === 'following'
                                  ? 'bg-white/20 text-white hover:bg-white/30'
                                  : followStatus === 'pending'
                                  ? 'bg-amber-500/30 text-amber-200 hover:bg-amber-500/40'
                                  : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                              }`}
                            >
                              {followStatus === 'following' ? (
                                <>
                                  <UserCheck className="w-3 h-3" />
                                  <span>Following</span>
                                </>
                              ) : followStatus === 'pending' ? (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Requested</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-3 h-3" />
                                  <span>Follow</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Compact Time & Audience Metadata Row */}
                        <div
                          className="flex items-center gap-1.5 text-[11px] text-white/80 drop-shadow"
                          title={audienceMeta.description}
                        >
                          <span>{reel.createdAt || 'Recently'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            {audienceMeta.iconKey === 'globe' ? (
                              <Globe className="w-3 h-3 text-white/80" />
                            ) : audienceMeta.iconKey === 'users' ? (
                              <Users className="w-3 h-3 text-white/80" />
                            ) : audienceMeta.iconKey === 'shield' ? (
                              <ShieldCheck className="w-3 h-3 text-amber-300" />
                            ) : (
                              <Lock className="w-3 h-3 text-white/80" />
                            )}
                            <span>{audienceMeta.shortLabel}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-white leading-tight drop-shadow-md line-clamp-1">
                      {reel.title}
                    </h4>
                    {reel.caption && (
                      <p className="text-xs text-gray-100/90 line-clamp-2 leading-snug drop-shadow">
                        {reel.caption}
                      </p>
                    )}

                    {/* Decoupled Music Track Action (independent of timeline state; no heavy always-on music strip) */}
                    {reel.musicTrack && (
                      <button
                        type="button"
                        data-testid={`reel-music-link-${reel.id}`}
                        onClick={() => {
                          const trackString = reel.musicTrack || 'Original Sound';
                          const allTracks = getAudioTracks();
                          const match = allTracks.find(
                            (t) =>
                              trackString.toLowerCase().includes(t.title.toLowerCase()) ||
                              t.title.toLowerCase().includes(trackString.toLowerCase())
                          );
                          setInspectingAudioTrack(
                            match ||
                              reel.audioTrack || {
                                id: `track_${reel.id}`,
                                title: trackString.split('•')[0]?.trim() || trackString,
                                artist: trackString.split('•')[1]?.trim() || 'Metfa Sound Studio',
                                audio_url: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_hum.ogg',
                                cover_url: reel.thumbnailSrc || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
                                duration: reel.duration || 30,
                                genre: 'Electronic',
                                mood: 'Energetic',
                                track_type: 'royalty_free',
                                license_type: 'Royalty-Free Commercial',
                                license_source: 'Metfa Audio Catalog',
                                attribution_required: false,
                                commercial_use_allowed: true,
                                territories: ['Worldwide'],
                                license_start: '2025-01-01T00:00:00.000Z',
                                license_expiry: null,
                                status: 'active',
                              }
                          );
                        }}
                        className="flex items-center gap-1.5 text-[11px] text-white/85 hover:text-teal-300 font-medium transition cursor-pointer max-w-full truncate drop-shadow"
                        title="View soundtrack & use music"
                      >
                        <Music className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span className="truncate">{reel.musicTrack}</span>
                      </button>
                    )}

                    {reel.promptUsed && (
                      <button
                        type="button"
                        onClick={() => onRemixPrompt(reel.promptUsed || '')}
                        className="px-2.5 py-1 bg-white/15 hover:bg-white/25 backdrop-blur-xs text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <Repeat className="w-3 h-3 text-teal-300" />
                        <span>Remix Prompt</span>
                      </button>
                    )}
                  </div>

                  {/* Right Vertical Action Column (Like, Comment, Share, Save) */}
                  <div className="flex flex-col items-center gap-3 shrink-0 pointer-events-auto">
                    <button
                      type="button"
                      data-testid={`reel-like-btn-${reel.id}`}
                      onClick={() => handleLike(reel.id)}
                      className="flex flex-col items-center gap-0.5 text-white group cursor-pointer"
                      aria-label="Like reel"
                    >
                      <div
                        className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center transition active:scale-90 ${
                          reel.isLiked ? 'bg-rose-600/90 text-white' : 'bg-black/45 group-hover:bg-black/70'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${reel.isLiked ? 'fill-current' : ''}`} />
                      </div>
                      <span className="text-[11px] font-bold drop-shadow">{reel.likesCount}</span>
                    </button>

                    <button
                      type="button"
                      data-testid={`reel-comment-btn-${reel.id}`}
                      onClick={() => handleOpenComments(reel)}
                      className="flex flex-col items-center gap-0.5 text-white group cursor-pointer"
                      aria-label="Comments"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/45 group-hover:bg-black/70 backdrop-blur-md flex items-center justify-center transition active:scale-90">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold drop-shadow">{reel.commentsCount}</span>
                    </button>

                    {allowExternalShare ? (
                      <button
                        type="button"
                        id={`share-reel-${reel.id}`}
                        onClick={() => handleShareReel(reel)}
                        className="flex flex-col items-center gap-0.5 text-white group cursor-pointer"
                        title="Share Reel"
                        aria-label="Share Reel"
                      >
                        <div className="w-11 h-11 rounded-full bg-black/45 group-hover:bg-black/70 backdrop-blur-md flex items-center justify-center transition group-hover:scale-105 active:scale-90">
                          <Share2 className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-bold drop-shadow">{reel.sharesCount}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        id={`share-reel-${reel.id}`}
                        onClick={() =>
                          showToast('Sharing is disabled for Followers-only, Only Me, or Private-profile Reels.')
                        }
                        className="flex flex-col items-center gap-0.5 text-white/45 cursor-not-allowed"
                        title="External sharing disabled by Reel audience or profile privacy"
                        aria-label="Sharing restricted"
                      >
                        <div className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center border border-white/10">
                          <Lock className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] font-bold drop-shadow">{reel.sharesCount}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      id={`save-reel-btn-${reel.id}`}
                      onClick={() => handleToggleSaveReel(reel.id)}
                      className="flex flex-col items-center gap-0.5 text-white group cursor-pointer"
                      title={reel.isSaved ? 'Unsave Reel' : 'Save Reel'}
                      aria-label={reel.isSaved ? 'Unsave Reel' : 'Save Reel'}
                    >
                      <div
                        className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center transition group-hover:scale-105 active:scale-90 ${
                          reel.isSaved ? 'bg-amber-500 text-white shadow-md shadow-amber-500/40' : 'bg-black/45 group-hover:bg-black/70'
                        }`}
                      >
                        <Bookmark className={`w-5 h-5 ${reel.isSaved ? 'fill-current text-white' : 'text-amber-400'}`} />
                      </div>
                      <span className="text-[11px] font-bold text-gray-100 drop-shadow">
                        {reel.savesCount ?? 0}
                      </span>
                    </button>

                    {/* Separate Compact Music Action (always accessible without a permanent strip/player) */}
                    <button
                      type="button"
                      data-testid={`reel-music-action-btn-${reel.id}`}
                      onClick={() => {
                        const trackString = reel.musicTrack || 'Original Sound';
                        const allTracks = getAudioTracks();
                        const match = allTracks.find(
                          (t) =>
                            trackString.toLowerCase().includes(t.title.toLowerCase()) ||
                            t.title.toLowerCase().includes(trackString.toLowerCase())
                        );
                        setInspectingAudioTrack(
                          match ||
                            reel.audioTrack || {
                              id: `track_${reel.id}`,
                              title: trackString.split('•')[0]?.trim() || trackString,
                              artist: trackString.split('•')[1]?.trim() || `${reel.author.name}`,
                              audio_url: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_hum.ogg',
                              cover_url: reel.thumbnailSrc || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
                              duration: reel.duration || 30,
                              genre: 'Electronic',
                              mood: 'Energetic',
                              track_type: reel.musicTrack ? 'royalty_free' : 'original',
                              license_type: reel.musicTrack ? 'Royalty-Free Commercial' : 'Original Creator Audio',
                              license_source: 'Metfa Audio Catalog',
                              attribution_required: false,
                              commercial_use_allowed: true,
                              territories: ['Worldwide'],
                              license_start: '2025-01-01T00:00:00.000Z',
                              license_expiry: null,
                              status: 'active',
                            }
                        );
                      }}
                      className="flex flex-col items-center gap-0.5 text-white group cursor-pointer"
                      title="Inspect or use this Reel's music"
                      aria-label="Inspect or use music"
                    >
                      <div className="w-10 h-10 rounded-full bg-black/50 group-hover:bg-teal-600/80 border border-white/20 backdrop-blur-md flex items-center justify-center transition group-hover:scale-105 active:scale-90">
                        <Music className="w-4 h-4 text-teal-300 group-hover:text-white" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Real Persistent Comments Bottom Sheet Drawer */}
      {activeCommentsReel && (
        <div
          data-testid="reels-comments-drawer"
          onClick={() => setActiveCommentsReel(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[70dvh] bg-gray-950 border-t border-white/15 rounded-t-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-bold text-white">
                  Comments ({activeCommentsReel.commentsCount || reelComments.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveCommentsReel(null)}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Close comments"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[160px]">
              {isLoadingComments ? (
                <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Loading comments...</span>
                </div>
              ) : reelComments.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No comments yet. Be the first to comment!
                </div>
              ) : (
                reelComments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <img
                      src={comment.author.avatar}
                      alt={comment.author.name}
                      className="w-7 h-7 rounded-full object-cover border border-white/15 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-bold text-white truncate">{comment.author.name}</span>
                        <span className="text-slate-400">@{comment.author.username}</span>
                        <span className="text-slate-500">• {comment.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-200 mt-0.5 break-words">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleSubmitComment}
              className="p-3 border-t border-white/10 bg-black/50 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/45 focus:outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
              >
                {isSubmittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Post</span>
              </button>
            </form>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <SocialShareModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setActiveSharePayload(null);
            setSharingReelId(null);
          }}
          payload={activeSharePayload}
          canShare={(() => {
            if (!sharingReelId) return true;
            const target = baseReels.find((r) => r.id === sharingReelId);
            if (!target) return false;
            return canSharePost({
              visibility: target.visibility,
              authorProfilePrivacy: resolveReelAuthorPrivacy(target),
            });
          })()}
          onSharePerformed={() => {
            if (sharingReelId) {
              const updated = incrementReelShares(sharingReelId);
              onUpdateReels(updated);
            }
          }}
        />
      </Suspense>

      {/* Edit Reel Modal */}
      {editingReel && (
        <div
          onClick={() => setEditingReel(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
        >
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Reel Caption</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingReel(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReelEdit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reel Title
                </label>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition"
                  placeholder="Enter reel title"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Caption & Description
                </label>
                <textarea
                  value={editingCaption}
                  onChange={(e) => setEditingCaption(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none resize-none transition"
                  placeholder="Describe this reel..."
                  required
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Reel Audience</span>
                  </label>
                  {isLegacyUnspecifiedAudience(editingReel.visibility) && editingVisibility === null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                      Unset (Owner Only)
                    </span>
                  )}
                </div>
                {isLegacyUnspecifiedAudience(editingReel.visibility) && editingVisibility === null && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>Legacy Reel has no explicit audience and is Owner Only until you choose one below.</span>
                  </p>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'public' as PostAudience, label: 'Public', icon: Globe },
                    { id: 'followers' as PostAudience, label: 'Followers', icon: Users },
                    { id: 'only_me' as PostAudience, label: 'Only Me', icon: Lock },
                  ].map((opt) => {
                    const IconComp = opt.icon;
                    const active = editingVisibility === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditingVisibility(opt.id)}
                        className={`px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                          active
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                        }`}
                      >
                        <IconComp className="w-3 h-3" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingReel(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Reel Deletion */}
      {confirmModal && (
        <Suspense fallback={null}>
          <ConfirmActionModal
            isOpen={confirmModal.isOpen}
            title={confirmModal.title}
            message={confirmModal.message}
            confirmLabel="Delete Reel"
            isDestructive={true}
            onConfirm={confirmModal.onConfirm}
            onClose={() => setConfirmModal(null)}
          />
        </Suspense>
      )}

      {/* Audio License & Reuse Modal */}
      {inspectingAudioTrack && (
        <Suspense fallback={null}>
          <AudioLicenseInfoModal
            isOpen={!!inspectingAudioTrack}
            track={inspectingAudioTrack}
            onClose={() => setInspectingAudioTrack(null)}
            onSelectTrack={onUseMusic}
          />
        </Suspense>
      )}

      {/* Unified Reel Analytics Modal (Owner Only) */}
      {inspectingAnalyticsReel && (
        <Suspense fallback={null}>
          <ContentAnalyticsModal
            isOpen={!!inspectingAnalyticsReel}
            onClose={() => setInspectingAnalyticsReel(null)}
            content={reelToContentDescriptor(inspectingAnalyticsReel)}
          />
        </Suspense>
      )}

      {/* Reel & Creator Details Modal (Public/Safe Metadata) */}
      {inspectingDetailsReel && (
        <PostDetailsModal
          isOpen={!!inspectingDetailsReel}
          onClose={() => setInspectingDetailsReel(null)}
          onViewProfile={onViewProfile}
          details={{
            id: inspectingDetailsReel.id,
            contentTypeLabel: 'Reel Video',
            authorId: inspectingDetailsReel.author?.id,
            authorName: inspectingDetailsReel.author?.name || 'Creator',
            authorUsername: inspectingDetailsReel.author?.username,
            authorAvatar: inspectingDetailsReel.author?.avatar || '',
            createdAt: inspectingDetailsReel.createdAt || 'Recently',
            visibility: inspectingDetailsReel.visibility,
            authorProfilePrivacy: resolveReelAuthorPrivacy(inspectingDetailsReel),
            tags: (inspectingDetailsReel as ReelHighlight & { tags?: string[] }).tags,
            musicLabel: inspectingDetailsReel.musicTrack || null,
            caption: inspectingDetailsReel.caption || inspectingDetailsReel.title,
          }}
        />
      )}

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 border border-purple-500/50 text-white text-xs px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default ReelsFeedView;
