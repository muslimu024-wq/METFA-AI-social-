import React, { useState, useEffect, Suspense, lazy } from 'react';
import CommunityFeed from '../../components/CommunityFeed';
import ReelsFeedView from '../../components/ReelsFeedView';
import CreatePostModal from '../../components/CreatePostModal';

// Lazy-load heavy non-initial views and modals
const LiveStreamingStudio = lazy(() => import('../../components/LiveStreamingStudio'));
const PagesDirectory = lazy(() => import('../../components/PagesDirectory'));
const GroupsDirectory = lazy(() => import('../../components/GroupsDirectory'));
const ProfileView = lazy(() => import('../../components/ProfileView'));
const NotificationsView = lazy(() => import('../../components/NotificationsView'));
const CreateReelModal = lazy(() => import('../../components/CreateReelModal'));
const CreatePageModal = lazy(() => import('../../components/CreatePageModal'));
const CreateGroupModal = lazy(() => import('../../components/CreateGroupModal'));
const ShareToFeedModal = lazy(() => import('../../components/ShareToFeedModal'));
const MessagesModule = lazy(() => import('../../components/messaging/MessagesModule'));
import { CommunityPost, ReelHighlight, UserProfile } from '../../types/community';
import {
  getCommunityPosts,
  saveCommunityPosts,
  fetchAndSyncCommunityPosts,
  createPostAsync,
  isContentOwner,
  extractPostIdFromHash,
  matchesPostId,
} from '../../utils/communityStore';
import { fetchSupabasePostById } from '../../services/postService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import {
  getReelHighlights,
  saveReelHighlights,
} from '../../utils/socialStore';
import { DailyCreditsData } from '../../utils/creditManager';
import { addNotification } from '../../utils/notificationStore';
import { useAuth } from '../../context/AuthContext';

export type SocialSubTab = 'feed' | 'reels' | 'notifications' | 'live' | 'pages' | 'groups' | 'profile' | 'marketplace' | 'messages';

export interface SocialEcosystemProps {
  currentTab: SocialSubTab;
  onNavigateTab: (tab: string) => void;
  creditsData: DailyCreditsData;
  onWatchAdClick?: () => void;
  onOpenAuthModal?: () => void;
  onRemixPrompt?: (prompt: string, stylePreset?: string) => void;
  shareModalData?: { prompt: string; imageSrc: string; stylePreset?: string } | null;
  onCloseShareModal?: () => void;
  activeChatPartnerId?: string | null;
  activeChatPartnerProfile?: UserProfile | null;
}

export const SocialEcosystemModule: React.FC<SocialEcosystemProps> = ({
  currentTab,
  onNavigateTab,
  creditsData,
  onWatchAdClick,
  onOpenAuthModal,
  onRemixPrompt,
  shareModalData,
  onCloseShareModal,
  activeChatPartnerId,
  activeChatPartnerProfile,
}) => {
  const { user, userProfile, updateProfile, isSupabaseConnected } = useAuth();

  // Social State (Isolated from AI Studio chat & inference)
  const [posts, setPosts] = useState<CommunityPost[]>(() => getCommunityPosts());
  const [reels, setReels] = useState<ReelHighlight[]>(() => getReelHighlights());
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(true);
  const [targetSharedPostId, setTargetSharedPostId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return extractPostIdFromHash(window.location.hash);
    }
    return null;
  });

  // Creation Modals
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Automatically load and synchronize posts from Supabase database
  useEffect(() => {
    let isMounted = true;
    setIsLoadingPosts(true);

    fetchAndSyncCommunityPosts().then(async (syncedPosts) => {
      if (!isMounted) return;

      let finalPosts = syncedPosts || [];

      // Check if a deep-linked shared post is requested
      const currentTargetId = extractPostIdFromHash(window.location.hash) || targetSharedPostId;
      if (currentTargetId) {
        const alreadyPresent = finalPosts.some((p) => matchesPostId(p, currentTargetId));
        if (!alreadyPresent && isSupabaseConfigured()) {
          try {
            const { post: singlePost } = await fetchSupabasePostById(currentTargetId);
            if (singlePost && isMounted) {
              finalPosts = [singlePost, ...finalPosts.filter((p) => p.id !== singlePost.id)];
            }
          } catch (err) {
            console.warn('[SocialModule] Error fetching targeted shared post:', err);
          }
        }
      }

      if (isMounted) {
        setPosts(finalPosts);
        setIsLoadingPosts(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id, isSupabaseConnected]);

  // Deep Link listener for URL hash changes (#post-post_1788406851913)
  useEffect(() => {
    const handleHashChange = async () => {
      const postId = extractPostIdFromHash(window.location.hash);
      if (postId) {
        setTargetSharedPostId(postId);
        if (currentTab !== 'feed') {
          onNavigateTab('feed');
        }

        // If post not already in state and Supabase is configured, fetch immediately
        setPosts((currentPosts) => {
          const exists = currentPosts.some((p) => matchesPostId(p, postId));
          if (!exists && isSupabaseConfigured()) {
            fetchSupabasePostById(postId).then(({ post }) => {
              if (post) {
                setPosts((prev) => {
                  if (prev.some((p) => matchesPostId(p, post.id))) return prev;
                  return [post, ...prev];
                });
              }
            });
          }
          return currentPosts;
        });
      } else {
        setTargetSharedPostId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [currentTab, onNavigateTab]);

  // Automatically dismiss active modals when currentTab changes
  useEffect(() => {
    if (currentTab === 'marketplace') {
      window.open('https://shop.metfaai.com', '_blank', 'noopener,noreferrer');
      onNavigateTab('feed');
      return;
    }
    setIsCreatePostOpen(false);
    setIsCreateReelOpen(false);
    setIsCreatePageOpen(false);
    setIsCreateGroupOpen(false);
  }, [currentTab, onNavigateTab]);

  // Synchronize posts and reels when updated externally
  useEffect(() => {
    const handlePostsUpdated = (e: any) => {
      if (e.detail) setPosts(e.detail);
    };
    const handleReelsUpdated = (e: any) => {
      if (e.detail) setReels(e.detail);
    };
    window.addEventListener('metfa_posts_updated', handlePostsUpdated);
    window.addEventListener('metfa_reels_updated', handleReelsUpdated);
    return () => {
      window.removeEventListener('metfa_posts_updated', handlePostsUpdated);
      window.removeEventListener('metfa_reels_updated', handleReelsUpdated);
    };
  }, []);

  const handlePostCreated = async (newPostData: any) => {
    try {
      const authorId = user?.id || userProfile?.id;
      const createdPost = await createPostAsync(newPostData, authorId);
      setPosts((prev) => [createdPost, ...prev.filter((p) => p.id !== createdPost.id)]);
      onNavigateTab('feed');
      return createdPost;
    } catch (err) {
      console.warn('[SocialModule] Error creating post:', err);
      throw err;
    }
  };

  const handleReelCreated = (newReel: ReelHighlight) => {
    const updated = [newReel, ...reels];
    setReels(updated);
    onNavigateTab('reels');

    addNotification({
      type: 'remix',
      title: 'Reel Published',
      message: `Your reel "${newReel.title}" is now live!`,
      linkTab: 'reels',
    });
  };

  const handleRemix = (prompt: string, stylePreset?: string) => {
    if (onRemixPrompt) {
      onRemixPrompt(prompt, stylePreset);
    }
  };

  return (
    <div className="w-full h-full flex flex-col flex-1 min-h-0 relative overflow-hidden">
      {/* Sub-view switcher based on currentTab */}
      {currentTab === 'feed' && (
        <CommunityFeed
          posts={posts}
          onUpdatePosts={(p) => {
            setPosts(p);
            saveCommunityPosts(p);
          }}
          userProfile={userProfile}
          onRemixPrompt={handleRemix}
          onCreatePostClick={() => setIsCreatePostOpen(true)}
          targetSharedPostId={targetSharedPostId}
          isLoadingPosts={isLoadingPosts}
          onClearSharedPost={() => {
            setTargetSharedPostId(null);
            if (typeof window !== 'undefined' && window.location.hash.startsWith('#post')) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }}
        />
      )}

      {currentTab === 'reels' && (
        <ReelsFeedView
          reels={reels}
          onUpdateReels={(r) => setReels(r)}
          userProfile={userProfile}
          onRemixPrompt={(prompt) => handleRemix(prompt)}
          onCreateReelClick={() => setIsCreateReelOpen(true)}
        />
      )}

      {currentTab === 'notifications' && (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">Loading Notifications...</div>}>
          <NotificationsView
            onNavigateTab={onNavigateTab}
            onWatchAdClick={onWatchAdClick}
          />
        </Suspense>
      )}

      {currentTab === 'live' && (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">Loading Live Studio...</div>}>
          <LiveStreamingStudio userProfile={userProfile} />
        </Suspense>
      )}

      {currentTab === 'pages' && (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">Loading Pages...</div>}>
          <PagesDirectory
            userProfile={userProfile}
            onCreatePageClick={() => setIsCreatePageOpen(true)}
          />
        </Suspense>
      )}

      {currentTab === 'groups' && (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">Loading Groups...</div>}>
          <GroupsDirectory
            userProfile={userProfile}
            onCreateGroupClick={() => setIsCreateGroupOpen(true)}
          />
        </Suspense>
      )}

      {currentTab === 'profile' && (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">Loading Profile...</div>}>
          <ProfileView
            userProfile={userProfile}
            onUpdateProfile={updateProfile}
            creditsData={creditsData}
            userPosts={posts.filter((p) => isContentOwner(p.author, userProfile, user, p.postingIdentity, p.id))}
            userReels={reels.filter((r) => r.author.id === userProfile.id)}
            allPosts={posts}
            allReels={reels}
            onUpdatePosts={(updated) => {
              setPosts(updated);
              saveCommunityPosts(updated);
            }}
            onUpdateReels={(updated) => {
              setReels(updated);
              saveReelHighlights(updated);
            }}
            onWatchAdClick={onWatchAdClick}
            onOpenAuthModal={onOpenAuthModal}
            onCreatePageClick={() => setIsCreatePageOpen(true)}
            onCreateGroupClick={() => setIsCreateGroupOpen(true)}
            onOpenChatWithUser={(targetId, targetProfile) => {
              window.dispatchEvent(
                new CustomEvent('metfa_open_chat', {
                  detail: { partnerId: targetId, partnerProfile: targetProfile },
                })
              );
            }}
          />
        </Suspense>
      )}

      {currentTab === 'messages' && (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">Loading Messages...</div>}>
          <div className="max-w-6xl mx-auto w-full p-2 sm:p-4 h-full flex-1 flex flex-col">
            <MessagesModule
              initialPartnerId={activeChatPartnerId || undefined}
              initialPartnerProfile={activeChatPartnerProfile || undefined}
              onViewProfile={(targetId) => {
                onNavigateTab('profile');
              }}
              onExploreProfiles={() => onNavigateTab('feed')}
            />
          </div>
        </Suspense>
      )}

      {/* Share AI Studio Creation to Social Feed Modal */}
      {shareModalData && (
        <Suspense fallback={null}>
          <ShareToFeedModal
            isOpen={true}
            onClose={() => onCloseShareModal?.()}
            postData={shareModalData}
            userProfile={userProfile}
            onPostCreated={handlePostCreated}
          />
        </Suspense>
      )}

      {/* Creation Modals */}
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        userProfile={userProfile}
        onPostCreated={handlePostCreated}
      />

      {isCreateReelOpen && (
        <Suspense fallback={null}>
          <CreateReelModal
            isOpen={isCreateReelOpen}
            onClose={() => setIsCreateReelOpen(false)}
            userProfile={userProfile}
            onReelCreated={handleReelCreated}
          />
        </Suspense>
      )}

      {isCreatePageOpen && (
        <Suspense fallback={null}>
          <CreatePageModal
            isOpen={isCreatePageOpen}
            onClose={() => setIsCreatePageOpen(false)}
            userProfile={userProfile}
          />
        </Suspense>
      )}

      {isCreateGroupOpen && (
        <Suspense fallback={null}>
          <CreateGroupModal
            isOpen={isCreateGroupOpen}
            onClose={() => setIsCreateGroupOpen(false)}
            userProfile={userProfile}
          />
        </Suspense>
      )}
    </div>
  );
};

export default SocialEcosystemModule;
