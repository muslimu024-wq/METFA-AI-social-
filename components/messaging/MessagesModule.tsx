import React, { useState, useEffect } from 'react';
import { MessageSquare, ShieldCheck, Lock, Sparkles, LogIn } from 'lucide-react';
import { Conversation } from '../../types/messaging';
import { UserProfile } from '../../types/community';
import {
  fetchUserConversations,
  getOrCreateDirectConversation,
} from '../../services/messagingService';
import { useAuth } from '../../context/AuthContext';
import ConversationsListView from './ConversationsListView';
import ChatScreen from './ChatScreen';
import BrandTitle from '../BrandTitle';

interface MessagesModuleProps {
  initialPartnerId?: string;
  initialPartnerProfile?: UserProfile;
  initialConversationId?: string;
  onViewProfile?: (userId: string) => void;
  onExploreProfiles?: () => void;
  onClose?: () => void;
}

export const MessagesModule: React.FC<MessagesModuleProps> = ({
  initialPartnerId,
  initialPartnerProfile,
  initialConversationId,
  onViewProfile,
  onExploreProfiles,
  onClose,
}) => {
  const { user, userProfile, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserId = user?.id || '';

  // 1. Fetch conversations for authenticated user
  const loadConversations = async (selectTargetId?: string) => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }

    try {
      const { conversations: list } = await fetchUserConversations(currentUserId);
      setConversations(list);

      if (selectTargetId) {
        const found = list.find((c) => c.id === selectTargetId);
        if (found) setSelectedConversation(found);
      }
    } catch (err) {
      console.warn('[MessagesModule] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [currentUserId]);

  // 2. Handle direct jump from profile / external trigger (initialConversationId or initialPartnerId)
  useEffect(() => {
    const handleInitialJump = async () => {
      if (!currentUserId) return;

      // If initialConversationId is provided directly from Profile RPC, jump to it
      if (initialConversationId) {
        setIsLoading(true);
        try {
          const { conversations: updatedList } = await fetchUserConversations(currentUserId);
          setConversations(updatedList);
          const target = updatedList.find((c) => c.id === initialConversationId);
          if (target) {
            setSelectedConversation(target);
          } else {
            // Synthesize minimal conversation object if not yet in list
            setSelectedConversation({
              id: initialConversationId,
              type: 'direct',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastMessageAt: new Date().toISOString(),
              lastMessagePreview: 'Conversation started',
              members: [
                { conversationId: initialConversationId, userId: currentUserId, joinedAt: new Date().toISOString() },
                ...(initialPartnerId
                  ? [
                      {
                        conversationId: initialConversationId,
                        userId: initialPartnerId,
                        joinedAt: new Date().toISOString(),
                        profile: initialPartnerProfile,
                      },
                    ]
                  : []),
              ],
              unreadCount: 0,
              partnerProfile: initialPartnerProfile,
              partnerId: initialPartnerId,
            });
          }
        } catch (err) {
          console.warn('[MessagesModule] Error jumping to direct conversation:', err);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (!initialPartnerId || initialPartnerId === currentUserId) return;

      setIsLoading(true);
      try {
        const { conversationId } = await getOrCreateDirectConversation(
          initialPartnerId,
          currentUserId,
          initialPartnerProfile
        );

        if (conversationId) {
          const { conversations: updatedList } = await fetchUserConversations(currentUserId);
          setConversations(updatedList);
          const target = updatedList.find((c) => c.id === conversationId);
          if (target) {
            setSelectedConversation(target);
          } else {
            // Synthesize minimal conversation object if not yet in list
            setSelectedConversation({
              id: conversationId,
              type: 'direct',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastMessageAt: new Date().toISOString(),
              lastMessagePreview: 'Conversation started',
              members: [
                { conversationId, userId: currentUserId, joinedAt: new Date().toISOString() },
                {
                  conversationId,
                  userId: initialPartnerId,
                  joinedAt: new Date().toISOString(),
                  profile: initialPartnerProfile,
                },
              ],
              unreadCount: 0,
              partnerProfile: initialPartnerProfile,
              partnerId: initialPartnerId,
            });
          }
        }
      } catch (err) {
        console.warn('[MessagesModule] Error jumping to direct conversation:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (initialConversationId || initialPartnerId) {
      handleInitialJump();
    }
  }, [initialConversationId, initialPartnerId, currentUserId]);

  // If user is guest/unauthenticated, present clear login invitation
  if (!isAuthenticated || !currentUserId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8" />
        </div>
        <BrandTitle service="Chat" size="lg" asHeading={true} className="mb-1" />
        <p className="text-sm text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Sign in to your METFA Social account to start instant real-time conversations, send voice
          notes, and share media directly with creators and friends.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('metfa_open_auth_modal'))}
          className="mt-5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-md active:scale-95 transition"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In to METFA Chat</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[500px] bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Left Pane: Conversations List (Hidden on mobile when conversation selected) */}
      <div
        className={`w-full md:w-80 lg:w-96 shrink-0 h-full flex flex-col ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ConversationsListView
          conversations={conversations}
          selectedConversationId={selectedConversation?.id || null}
          onSelectConversation={(conv) => setSelectedConversation(conv)}
          isLoading={isLoading}
          onExploreProfiles={onExploreProfiles}
        />
      </div>

      {/* Right Pane: Active Chat Screen or Desktop Empty Prompt */}
      <div
        className={`flex-1 h-full flex flex-col ${
          !selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversation ? (
          <ChatScreen
            key={selectedConversation.id}
            conversationId={selectedConversation.id}
            partnerProfile={selectedConversation.partnerProfile}
            partnerId={selectedConversation.partnerId}
            currentUserId={currentUserId}
            currentUserProfile={userProfile || undefined}
            onBack={() => {
              setSelectedConversation(null);
              loadConversations();
            }}
            onViewProfile={onViewProfile}
          />
        ) : (
          /* Desktop Placeholder when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
            <div className="w-16 h-16 rounded-3xl bg-teal-100/60 text-teal-700 flex items-center justify-center mb-4 shadow-xs">
              <MessageSquare className="w-8 h-8" />
            </div>
            <BrandTitle service="Chat" size="base" asHeading={true} className="mb-1" />
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              Select a conversation from the left to read and send direct messages, voice notes,
              photos, and videos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesModule;
