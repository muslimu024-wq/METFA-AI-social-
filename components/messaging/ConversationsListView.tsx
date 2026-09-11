import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  ShieldCheck,
  CheckCheck,
  Check,
  Clock,
  Sparkles,
  User,
  Radio,
} from 'lucide-react';
import { Conversation } from '../../types/messaging';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import BrandTitle from '../BrandTitle';

interface ConversationsListViewProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conv: Conversation) => void;
  isLoading: boolean;
  onExploreProfiles?: () => void;
}

export const ConversationsListView: React.FC<ConversationsListViewProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isLoading,
  onExploreProfiles,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const isCloudConnected = isSupabaseConfigured();

  // Filter conversations by partner's name or username
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = c.partnerProfile?.name?.toLowerCase() || '';
    const username = c.partnerProfile?.username?.toLowerCase() || '';
    return name.includes(q) || username.includes(q);
  });

  // Relative time helper
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const now = new Date().getTime();
      const time = new Date(isoString).getTime();
      const diff = Math.max(0, Math.floor((now - time) / 1000));

      if (diff < 60) return 'now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

      const date = new Date(isoString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* 1. Header & Search */}
      <div className="p-3.5 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <BrandTitle service="Chat" size="base" asHeading={true} />
          </div>

          {/* Realtime connection indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
            title={
              isCloudConnected
                ? 'Supabase Cloud Realtime is connected'
                : 'Local persistent storage active'
            }
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isCloudConnected ? 'Supabase Realtime' : 'Storage Active'}</span>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-transparent focus:border-teal-500 focus:bg-white text-slate-900 text-xs rounded-xl outline-none transition placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 2. Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-slate-400">Loading inbox...</div>
        ) : filteredConversations.length === 0 ? (
          /* Empty State (Clean, no fake data) */
          <div className="p-6 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">No conversations yet</h4>
            <p className="text-xs text-slate-500 max-w-[240px] mt-1 leading-relaxed">
              Connect with creators and friends across METFA Social. Visit any creator's profile and
              click "Message" to start a chat!
            </p>
            {onExploreProfiles && (
              <button
                type="button"
                onClick={onExploreProfiles}
                className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
              >
                Discover Creators
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === selectedConversationId;
            const partnerName = conv.partnerProfile?.name || 'Metfa Creator';
            const partnerUsername = conv.partnerProfile?.username
              ? `@${conv.partnerProfile.username}`
              : '';
            const partnerAvatar =
              conv.partnerProfile?.avatar ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.partnerId || 'partner'}`;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors select-none ${
                  isSelected
                    ? 'bg-teal-50/70 border-l-4 border-teal-600'
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                {/* Partner Avatar with Online Dot */}
                <div className="relative shrink-0">
                  <img
                    src={partnerAvatar}
                    alt={partnerName}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-xs"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.partnerId || 'partner'}`;
                    }}
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {partnerName}
                      </span>
                      {conv.partnerProfile?.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {formatTimeAgo(conv.lastMessageAt || conv.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 truncate">
                      {conv.lastMessagePreview || 'Conversation started'}
                    </p>

                    {/* Unread count badge */}
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-teal-600 text-white rounded-full min-w-[18px] text-center shadow-xs">
                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationsListView;
