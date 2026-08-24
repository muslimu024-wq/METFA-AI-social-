import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import GeminiChatView from './components/GeminiChatView';
import CommunityFeed from './components/CommunityFeed';
import ReelsFeedView from './components/ReelsFeedView';
import LiveStreamingStudio from './components/LiveStreamingStudio';
import PagesDirectory from './components/PagesDirectory';
import GroupsDirectory from './components/GroupsDirectory';
import ProfileView from './components/ProfileView';
import StudioSettingsDrawer from './components/StudioSettingsDrawer';
import RewardedAdModal from './components/RewardedAdModal';
import ShareToFeedModal from './components/ShareToFeedModal';
import CreatePostModal from './components/CreatePostModal';
import CreatePageModal from './components/CreatePageModal';
import CreateGroupModal from './components/CreateGroupModal';

import { ChatMessage, ChatAttachment, StudioSettings } from './types/chat';
import { CommunityPost, ReelHighlight, UserProfile } from './types/community';
import {
  getChatSessions,
  getCurrentSession,
  saveSession,
  createNewSession,
  getStudioSettings,
  saveStudioSettings
} from './utils/chatStore';
import {
  getCommunityPosts,
  saveCommunityPosts,
  getUserProfile,
  saveUserProfile
} from './utils/communityStore';
import {
  getReelHighlights
} from './utils/socialStore';
import {
  getDailyCredits,
  consumeCredit,
  addRewardCredits,
  DailyCreditsData
} from './utils/creditManager';
import {
  sendMultimodalMessage,
  enhancePromptWithAI,
  upscaleImageWithAI
} from './services/geminiService';
import { addNotification } from './utils/notificationStore';

export function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'chat' | 'feed' | 'reels' | 'live' | 'pages' | 'groups' | 'profile'>('chat');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<StudioSettings>(getStudioSettings());

  // Community & User State
  const [userProfile, setUserProfile] = useState<UserProfile>(getUserProfile());
  const [posts, setPosts] = useState<CommunityPost[]>(getCommunityPosts());
  const [reels, setReels] = useState<ReelHighlight[]>(getReelHighlights());
  const [creditsData, setCreditsData] = useState<DailyCreditsData>(getDailyCredits());

  // Modals & Drawers
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRewardedAdOpen, setIsRewardedAdOpen] = useState(false);
  const [shareModalData, setShareModalData] = useState<{ prompt: string; imageSrc: string; stylePreset?: string } | null>(null);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Initialize Chat Session
  useEffect(() => {
    const session = getCurrentSession();
    if (session && session.messages) {
      setMessages(session.messages);
    }
  }, []);

  // Listen to credits updates across tabs or components
  useEffect(() => {
    const handleCreditsUpdate = (e: any) => {
      if (e.detail) {
        setCreditsData(e.detail);
      }
    };
    window.addEventListener('metfa_credits_updated', handleCreditsUpdate);
    return () => window.removeEventListener('metfa_credits_updated', handleCreditsUpdate);
  }, []);

  const handleUpdateSettings = (newSettings: Partial<StudioSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveStudioSettings(updated);
  };

  const handleSendMessage = async (text: string, attachments: ChatAttachment[]) => {
    // Check credits
    if (creditsData.remainingCredits <= 0) {
      setIsRewardedAdOpen(true);
      return;
    }

    // Deduct 1 credit
    const updatedCredits = consumeCredit();
    setCreditsData(updatedCredits);

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      attachments,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Build conversation history for context
      const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = newMessages
        .slice(-6)
        .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      // Call our backend API
      const result = await sendMultimodalMessage(
        text,
        attachments,
        settings,
        chatHistory
      );

      const assistantMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: result.text || 'Transformation complete.',
        generatedImageB64: result.generatedImageB64,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      // Save to active session
      const currentSession = getCurrentSession();
      if (currentSession) {
        currentSession.messages = finalMessages;
        currentSession.updatedAt = new Date().toISOString();
        saveSession(currentSession);
      }

      if (result.generatedImageB64) {
        addNotification({
          type: 'generation_done',
          title: 'Scene Transformation Ready',
          message: 'Your multimodal AI render has completed successfully.',
          linkTab: 'chat',
        });
      }
    } catch (err: any) {
      console.error('Chat error:', err);

      // Refund the consumed credit on failure so user is never penalized
      const refunded = addRewardCredits(1);
      setCreditsData(refunded);

      const isUnavailable =
        err?.message?.includes('503') ||
        err?.message?.includes('heavy load') ||
        err?.message?.includes('timed out') ||
        err?.message?.includes('busy');

      const friendlyErrorNotice = isUnavailable
        ? `⚠️ **Gemini Service Notice**\n\nThe AI service is currently experiencing heavy global traffic or high latency. Metfa AI automatically attempted fallback models, but the request timed out.\n\n✨ **Your prompt credit was automatically refunded.** Please click **Try Again** below.`
        : `⚠️ **Error generating response**\n\n${err.message || 'Please check your connection and try again.'}\n\n✨ **Your prompt credit was automatically refunded.**`;

      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: friendlyErrorNotice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        canRetry: true,
        retryPayload: {
          text,
          attachments,
        },
      };

      const finalMessagesWithErr = [...newMessages, errorMsg];
      setMessages(finalMessagesWithErr);

      const currentSession = getCurrentSession();
      if (currentSession) {
        currentSession.messages = finalMessagesWithErr;
        currentSession.updatedAt = new Date().toISOString();
        saveSession(currentSession);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryMessage = (payload?: { text: string; attachments: ChatAttachment[] }) => {
    if (!payload) return;
    handleSendMessage(payload.text, payload.attachments || []);
  };

  const handleClearChat = () => {
    const newSess = createNewSession();
    setMessages(newSess.messages);
  };

  const handleUpscaleImage = async (base64Image: string): Promise<string> => {
    const enhanced = await upscaleImageWithAI(base64Image);
    addNotification({
      type: 'generation_done',
      title: '4K Ultra HD Upscale Ready',
      message: 'Your creation has been upscaled to crystal-clear 4K resolution.',
      linkTab: 'chat',
    });
    return enhanced;
  };

  const handleRemixPrompt = (prompt: string, stylePreset?: string) => {
    if (stylePreset) {
      handleUpdateSettings({ stylePreset });
    }
    setActiveTab('chat');
    // Pre-populate input or trigger instant generation
    handleSendMessage(`[Remix Recipe]: ${prompt}`, []);
  };

  const handleRewardClaimed = (amount: number) => {
    const updated = addRewardCredits(amount);
    setCreditsData(updated);
  };

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
    setActiveTab('feed');

    addNotification({
      type: 'remix',
      title: 'Post Published',
      message: `Your artwork "${newPost.prompt.slice(0, 30)}..." is now live on the feed!`,
      linkTab: 'feed',
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 font-sans antialiased overflow-hidden select-none">
      {/* Top Navigation Header */}
      <Header
        activeTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab as any)}
        creditsData={creditsData}
        onWatchAdClick={() => setIsRewardedAdOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Viewport Container - Flex 1 and Min-H-0 ensures zero vertical overflow and dynamic expansion */}
      <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {activeTab === 'chat' && (
          <GeminiChatView
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onShareToFeed={(data) => setShareModalData(data)}
            onUpscaleImage={handleUpscaleImage}
            onClearChat={handleClearChat}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onEnhancePrompt={(p) => enhancePromptWithAI(p)}
            creditsCount={creditsData.remainingCredits}
            onRetryMessage={handleRetryMessage}
          />
        )}

        {activeTab === 'feed' && (
          <CommunityFeed
            posts={posts}
            onUpdatePosts={(p) => {
              setPosts(p);
              saveCommunityPosts(p);
            }}
            userProfile={userProfile}
            onRemixPrompt={handleRemixPrompt}
            onCreatePostClick={() => setIsCreatePostOpen(true)}
          />
        )}

        {activeTab === 'reels' && (
          <ReelsFeedView
            reels={reels}
            onUpdateReels={(r) => setReels(r)}
            userProfile={userProfile}
            onRemixPrompt={handleRemixPrompt}
            onCreateReelClick={() => setIsCreatePostOpen(true)}
          />
        )}

        {activeTab === 'live' && <LiveStreamingStudio userProfile={userProfile} />}

        {activeTab === 'pages' && (
          <PagesDirectory
            userProfile={userProfile}
            onCreatePageClick={() => setIsCreatePageOpen(true)}
          />
        )}

        {activeTab === 'groups' && (
          <GroupsDirectory
            userProfile={userProfile}
            onCreateGroupClick={() => setIsCreateGroupOpen(true)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            userProfile={userProfile}
            onUpdateProfile={setUserProfile}
            creditsData={creditsData}
            userPosts={posts.filter((p) => p.author.id === userProfile.id)}
            userReels={reels.filter((r) => r.author.id === userProfile.id)}
            onWatchAdClick={() => setIsRewardedAdOpen(true)}
          />
        )}
      </main>

      {/* Persistent Bottom Tab Bar */}
      <BottomNav activeTab={activeTab} onNavigateTab={(tab) => setActiveTab(tab as any)} />

      {/* Studio Settings Drawer */}
      <StudioSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        creditsData={creditsData}
        onWatchAdClick={() => {
          setIsSettingsOpen(false);
          setIsRewardedAdOpen(true);
        }}
      />

      {/* Rewarded Ad Modal */}
      <RewardedAdModal
        isOpen={isRewardedAdOpen}
        onClose={() => setIsRewardedAdOpen(false)}
        onRewardClaimed={handleRewardClaimed}
      />

      {/* Share to Feed Modal */}
      {shareModalData && (
        <ShareToFeedModal
          isOpen={true}
          onClose={() => setShareModalData(null)}
          postData={shareModalData}
          userProfile={userProfile}
          onPostCreated={handlePostCreated}
        />
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        userProfile={userProfile}
        onPostCreated={handlePostCreated}
      />

      {/* Create Page Modal */}
      <CreatePageModal
        isOpen={isCreatePageOpen}
        onClose={() => setIsCreatePageOpen(false)}
        userProfile={userProfile}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        userProfile={userProfile}
      />
    </div>
  );
}

export default App;
