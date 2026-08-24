import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  Repeat,
  Bookmark,
  Send,
  Plus,
  Compass,
  TrendingUp,
  Flame,
  Check
} from 'lucide-react';
import { CommunityPost, UserProfile } from '../types/community';
import { toggleLikePost, saveCommunityPosts } from '../utils/communityStore';

interface CommunityFeedProps {
  posts: CommunityPost[];
  onUpdatePosts: (posts: CommunityPost[]) => void;
  userProfile: UserProfile;
  onRemixPrompt: (prompt: string, stylePreset?: string) => void;
  onCreatePostClick: () => void;
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  posts,
  onUpdatePosts,
  userProfile,
  onRemixPrompt,
  onCreatePostClick,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'trending' | 'for_you'>('all');
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);

  const filteredPosts = posts.filter((p) => {
    if (activeFilter === 'trending') return (p.likesCount || 0) > 500;
    if (activeFilter === 'for_you') return p.feedType === 'for_you' || !p.feedType;
    return true;
  });

  const handleLike = (postId: string) => {
    const updated = toggleLikePost(postId);
    onUpdatePosts(updated);
  };

  const handleAddComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const updated = posts.map((p) => {
      if (p.id === postId) {
        return {
          ...p,
          commentsCount: (p.commentsCount || 0) + 1,
          comments: [
            ...(p.comments || []),
            {
              id: `c_${Date.now()}`,
              author: {
                id: userProfile.id,
                name: userProfile.name,
                username: userProfile.username,
                avatar: userProfile.avatar,
                isVerified: userProfile.isVerified,
              },
              text,
              timestamp: 'Just now',
              likesCount: 0,
            },
          ],
        };
      }
      return p;
    });

    onUpdatePosts(updated);
    saveCommunityPosts(updated);
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Feed Filters & Create Action Bar */}
      <div className="flex items-center justify-between gap-3 bg-gray-900/80 p-2.5 rounded-2xl border border-gray-800 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              activeFilter === 'all'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-850'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('for_you')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              activeFilter === 'for_you'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-850'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>For You</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('trending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              activeFilter === 'trending'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-850'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
            <span>Trending</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCreatePostClick}
          className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1 transition transform active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Post</span>
        </button>
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {filteredPosts.map((post) => {
          const isCommentsOpen = activeCommentsPostId === post.id;

          return (
            <div
              key={post.id}
              className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl hover:border-purple-500/30 transition-all animate-fadeIn"
            >
              {/* Post Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={post.postingIdentity?.avatar || post.author.avatar}
                    alt={post.author.name}
                    className="w-10 h-10 rounded-2xl object-cover border border-gray-700 shadow-sm"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-white leading-tight">
                        {post.postingIdentity?.name || post.author.name}
                      </h4>
                      {post.postingIdentity?.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                          {post.postingIdentity.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>@{post.postingIdentity?.username || post.author.username}</span>
                      <span>•</span>
                      <span>{post.createdAt}</span>
                    </div>
                  </div>
                </div>

                {post.stylePreset && (
                  <span className="text-[11px] font-semibold px-2.5 py-1 bg-purple-950/80 border border-purple-800/60 text-purple-300 rounded-full">
                    {post.stylePreset}
                  </span>
                )}
              </div>

              {/* Post Image Container */}
              <div className="relative group bg-gray-950 max-h-[500px] overflow-hidden flex items-center justify-center">
                <img
                  src={post.imageSrc}
                  alt={post.prompt}
                  className="w-full h-auto max-h-[500px] object-cover"
                />
              </div>

              {/* Post Content */}
              <div className="p-4 space-y-3">
                {post.caption && (
                  <p className="text-sm text-gray-200 leading-relaxed font-normal">{post.caption}</p>
                )}

                {/* Prompt Card */}
                <div className="p-3 bg-gray-950/90 border border-gray-800 rounded-2xl flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                      Prompt Recipe
                    </span>
                    <p className="text-xs text-gray-300 line-clamp-2 italic">"{post.prompt}"</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemixPrompt(post.prompt, post.stylePreset)}
                    className="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Remix</span>
                  </button>
                </div>

                {/* Post Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-gray-400 text-xs">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 transition ${
                        post.isLiked ? 'text-rose-500 font-bold' : 'hover:text-white'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current' : ''}`} />
                      <span>{post.likesCount || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveCommentsPostId(isCommentsOpen ? null : post.id)}
                      className="flex items-center gap-1.5 hover:text-white transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments?.length || post.commentsCount || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemixPrompt(post.prompt, post.stylePreset)}
                      className="flex items-center gap-1.5 hover:text-white transition"
                    >
                      <Repeat className="w-4 h-4" />
                      <span>{post.remixCount || 0}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: post.prompt, text: post.caption, url: window.location.href });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        alert('Link copied to clipboard!');
                      }
                    }}
                    className="flex items-center gap-1 hover:text-white transition"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Comments Section */}
                {isCommentsOpen && (
                  <div className="pt-3 border-t border-gray-800 space-y-3 animate-fadeIn">
                    {/* Add comment input */}
                    <div className="flex items-center gap-2">
                      <img
                        src={userProfile.avatar}
                        alt={userProfile.name}
                        className="w-7 h-7 rounded-xl object-cover"
                      />
                      <input
                        type="text"
                        value={commentInputs[post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        placeholder="Write a comment..."
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(post.id)}
                        className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Existing Comments */}
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                      {(post.comments || []).map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5 text-xs">
                          <img
                            src={c.author.avatar}
                            alt={c.author.name}
                            className="w-6 h-6 rounded-lg object-cover mt-0.5"
                          />
                          <div className="bg-gray-950/80 p-2.5 rounded-2xl flex-1 border border-gray-800/80">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-white text-[11px]">{c.author.name}</span>
                              <span className="text-[10px] text-gray-500">{c.timestamp}</span>
                            </div>
                            <p className="text-gray-300 text-xs">{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommunityFeed;
