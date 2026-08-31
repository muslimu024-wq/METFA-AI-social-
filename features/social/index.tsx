import React, { useState, useEffect } from 'react';
import CommunityFeed from '../../components/CommunityFeed';
import ReelsFeedView from '../../components/ReelsFeedView';
import LiveStreamingStudio from '../../components/LiveStreamingStudio';
import PagesDirectory from '../../components/PagesDirectory';
import GroupsDirectory from '../../components/GroupsDirectory';
import ProfileView from '../../components/ProfileView';
import NotificationsView from '../../components/NotificationsView';
import CreatePostModal from '../../components/CreatePostModal';
import CreateReelModal from '../../components/CreateReelModal';
import CreatePageModal from '../../components/CreatePageModal';
import CreateGroupModal from '../../components/CreateGroupModal';
import ShareToFeedModal from '../../components/ShareToFeedModal';
import { CommunityPost, ReelHighlight } from '../../types/community';
import {
  getCommunityPosts,
  saveCommunityPosts,
} from '../../utils/communityStore';
import {
  getReelHighlights,
  saveReelHighlights,
} from '../../utils/socialStore';
import { DailyCreditsData } from '../../utils/creditManager';
import { addNotification } from '../../utils/notificationStore';
import { useAuth } from '../../context/AuthContext';

export type SocialSubTab = 'feed' | 'reels' | 'notifications' | 'live' | 'pages' | 'groups' | 'profile';

export interface SocialEcosystemProps {
  currentTab: SocialSubTab;
  onNavigateTab: (tab: string) => void;
  creditsData: DailyCreditsData;
  onWatchAdClick?: () => void;
  onOpenAuthModal?: () => void;
  onRemixPrompt?: (prompt: string, stylePreset?: string) => void;
  shareModalData?: { prompt: string; imageSrc: string; stylePreset?: string } | null;
  onCloseShareModal?: () => void;
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
}) => {
  const { userProfile, updateProfile } = useAuth();

  // Social State (Isolated from AI Studio chat & inference)
  const [posts, setPosts] = useState<CommunityPost[]>(() => getCommunityPosts());
  const [reels, setReels] = useState<ReelHighlight[]>(() => getReelHighlights());

  // Creation Modals
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Automatically dismiss active modals when currentTab changes
  useEffect(() => {
    setIsCreatePostOpen(false);
    setIsCreateReelOpen(false);
    setIsCreatePageOpen(false);
    setIsCreateGroupOpen(false);
  }, [currentTab]);

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

  const handlePostCreated = (newPostData: any) => {
    const newPost: CommunityPost = {
      ...newPostData,
      id: `post_${Date.now()}`,
      likesCount: 1,
      remixCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: 'Just now',
      isLiked: true,
      comments: [],
    };
    const updated = [newPost, ...posts];
    setPosts(updated);
    saveCommunityPosts(updated);
    onNavigateTab('feed');

    addNotification({
      type: 'remix',
      title: 'Post Published',
      message: `Your artwork "${newPost.prompt.slice(0, 30)}..." is now live on the feed!`,
      linkTab: 'feed',
    });
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
        <NotificationsView
          onNavigateTab={onNavigateTab}
          onWatchAdClick={onWatchAdClick}
        />
      )}

      {currentTab === 'live' && <LiveStreamingStudio userProfile={userProfile} />}

      {currentTab === 'pages' && (
        <PagesDirectory
          userProfile={userProfile}
          onCreatePageClick={() => setIsCreatePageOpen(true)}
        />
      )}

      {currentTab === 'groups' && (
        <GroupsDirectory
          userProfile={userProfile}
          onCreateGroupClick={() => setIsCreateGroupOpen(true)}
        />
      )}

      {currentTab === 'profile' && (
        <ProfileView
          userProfile={userProfile}
          onUpdateProfile={updateProfile}
          creditsData={creditsData}
          userPosts={posts.filter((p) => p.author.id === userProfile.id)}
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
        />
      )}

      {/* Share AI Studio Creation to Social Feed Modal */}
      {shareModalData && (
        <ShareToFeedModal
          isOpen={true}
          onClose={() => onCloseShareModal?.()}
          postData={shareModalData}
          userProfile={userProfile}
          onPostCreated={handlePostCreated}
        />
      )}

      {/* Creation Modals */}
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        userProfile={userProfile}
        onPostCreated={handlePostCreated}
      />

      <CreateReelModal
        isOpen={isCreateReelOpen}
        onClose={() => setIsCreateReelOpen(false)}
        userProfile={userProfile}
        onReelCreated={handleReelCreated}
      />

      <CreatePageModal
        isOpen={isCreatePageOpen}
        onClose={() => setIsCreatePageOpen(false)}
        userProfile={userProfile}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        userProfile={userProfile}
      />
    </div>
  );
};

export default SocialEcosystemModule;
