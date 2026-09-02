import React, { useState, useRef, useEffect } from 'react';
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
  Check,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Volume2,
  Film,
  Image as ImageIcon,
  Radio,
  X,
  Languages,
  Wand2,
  Type,
  Smile,
  Flame as FireIcon,
  MoreVertical,
  MoreHorizontal,
  Edit3,
  Trash2,
  Copy,
  Flag,
  CheckCircle2,
} from 'lucide-react';
import { CommunityPost, UserProfile, VoiceComment, PostComment } from '../types/community';
import {
  toggleLikePost,
  saveCommunityPosts,
  incrementPostShares,
  isContentOwner,
  updateCommunityPost,
  deleteCommunityPost,
  updatePostAsync,
  deletePostAsync,
  updateComment,
  deleteComment,
  deleteVoiceComment,
} from '../utils/communityStore';
import { toggleSavePost, isPostSaved } from '../utils/bookmarkStore';
import { executeNativeShare, SharePayload } from '../utils/shareUtils';
import { generateQuickAIReply } from '../services/aiAssistantService';
import SocialShareModal from './SocialShareModal';
import ConfirmActionModal from './ConfirmActionModal';
import EditPostModal from './EditPostModal';
import { AiRecipeBox } from './AiRecipeBox';
import { PostContent } from './PostContent';
import { useAuth } from '../context/AuthContext';

interface CommunityFeedProps {
  posts: CommunityPost[];
  onUpdatePosts: (posts: CommunityPost[]) => void;
  userProfile: UserProfile;
  onRemixPrompt: (prompt: string, stylePreset?: string) => void;
  onCreatePostClick: () => void;
}

const REACTION_EMOJIS: { [k: string]: { emoji: string; label: string; color: string } } = {
  like: { emoji: '👍', label: 'Like', color: 'text-blue-400' },
  love: { emoji: '❤️', label: 'Love', color: 'text-rose-500' },
  haha: { emoji: '😂', label: 'Haha', color: 'text-amber-400' },
  wow: { emoji: '😮', label: 'Wow', color: 'text-teal-400' },
  sad: { emoji: '😢', label: 'Sad', color: 'text-indigo-400' },
  fire: { emoji: '🔥', label: 'Fire', color: 'text-orange-500' },
};

const GRADIENT_PRESETS: { [k: string]: string } = {
  sunset: 'bg-gradient-to-tr from-amber-600 via-rose-600 to-purple-800 text-white shadow-xl',
  cyberpunk: 'bg-gradient-to-tr from-purple-900 via-indigo-900 to-cyan-700 text-white shadow-xl',
  midnight: 'bg-gradient-to-tr from-slate-900 via-purple-950 to-indigo-950 text-purple-100 border border-purple-800/60',
  emerald: 'bg-gradient-to-tr from-teal-900 via-emerald-800 to-cyan-900 text-teal-100 shadow-xl',
  fire: 'bg-gradient-to-tr from-red-700 via-orange-600 to-amber-500 text-white shadow-xl',
};

export const CommunityFeed: React.FC<CommunityFeedProps> = ({
  posts,
  onUpdatePosts,
  userProfile,
  onRemixPrompt,
  onCreatePostClick,
}) => {
  const { user: authUser, activeIdentity } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'all' | 'trending' | 'for_you'>('all');
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);

  // Context Menus & Action State for Post & Comment CRUD
  const [activePostMenuId, setActivePostMenuId] = useState<string | null>(null);
  const [activeCommentMenuId, setActiveCommentMenuId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu-root="true"]')) {
        setActivePostMenuId(null);
        setActiveCommentMenuId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Post CRUD Handlers
  const handleSavePostEdit = async (updatedPost: CommunityPost) => {
    const authorId = authUser?.id || userProfile?.id;
    const updated = await updatePostAsync(updatedPost.id, updatedPost, authorId);
    onUpdatePosts(updated);
    setEditingPost(null);
    showToast('Post updated successfully');
  };

  const handleDeletePost = (postId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Post',
      message: 'Are you sure you want to permanently delete this post? This action cannot be undone and will remove it from the feed and your profile.',
      onConfirm: async () => {
        const authorId = authUser?.id || userProfile?.id;
        const updated = await deletePostAsync(postId, authorId);
        onUpdatePosts(updated);
        setActivePostMenuId(null);
        showToast('Post deleted successfully');
      },
    });
  };

  // Comment CRUD Handlers
  const handleStartEditComment = (comment: PostComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
    setActiveCommentMenuId(null);
  };

  const handleSaveCommentEdit = (postId: string, commentId: string) => {
    if (!editingCommentText.trim()) return;
    const updated = updateComment(postId, commentId, editingCommentText.trim());
    onUpdatePosts(updated);
    setEditingCommentId(null);
    setEditingCommentText('');
    showToast('Comment updated');
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment? It will be removed immediately.',
      onConfirm: () => {
        const updated = deleteComment(postId, commentId);
        onUpdatePosts(updated);
        setActiveCommentMenuId(null);
        showToast('Comment deleted');
      },
    });
  };

  const handleDeleteVoiceComment = (postId: string, voiceId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Voice Comment',
      message: 'Are you sure you want to delete this voice audio comment? It will be removed immediately.',
      onConfirm: () => {
        const updated = deleteVoiceComment(postId, voiceId);
        onUpdatePosts(updated);
        showToast('Voice comment deleted');
      },
    });
  };

  const handleToggleBookmark = (postId: string) => {
    const res = toggleSavePost(postId);
    onUpdatePosts(res.updatedPosts);
    showToast(res.isSaved ? 'Saved to your bookmarks!' : 'Removed from bookmarks');
  };

  // Reaction hover/popup state
  const [activeReactionPickerPostId, setActiveReactionPickerPostId] = useState<string | null>(null);

  // Share state
  const [activeSharePayload, setActiveSharePayload] = useState<SharePayload | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingPostId, setSharingPostId] = useState<string | null>(null);

  // Voice Dictation (Speech-to-Text in Comments with Auto Language Detection)
  const [dictatingPostId, setDictatingPostId] = useState<string | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const commentBaseTextRef = useRef<string>('');

  // 10-Second Voice Audio Comment Recording State
  const [isRecordingVoiceClip, setIsRecordingVoiceClip] = useState<string | null>(null);
  const [recordTimer, setRecordTimer] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Voice Comment Playback State
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Quick AI Replies state for comments
  const [quickRepliesData, setQuickRepliesData] = useState<{ [commentId: string]: string[] }>({});
  const [loadingQuickReplyId, setLoadingQuickReplyId] = useState<string | null>(null);

  useEffect(() => {
    const handleFocusPost = (e: any) => {
      const targetId = e.detail;
      if (!targetId) return;
      setHighlightedPostId(targetId);
      setActiveFilter('all');

      setTimeout(() => {
        const el = document.getElementById(`post-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      setTimeout(() => {
        setHighlightedPostId(null);
      }, 4000);
    };

    window.addEventListener('metfa_feed_focus_post', handleFocusPost);

    return () => {
      window.removeEventListener('metfa_feed_focus_post', handleFocusPost);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const filteredPosts = posts.filter((p) => {
    if (activeFilter === 'trending') return (p.likesCount || 0) > 500;
    if (activeFilter === 'for_you') return p.feedType === 'for_you' || !p.feedType;
    return true;
  });

  const handleLike = (postId: string) => {
    const updated = toggleLikePost(postId);
    onUpdatePosts(updated);
  };

  const handleReactionSelect = (postId: string, reactionType: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'fire') => {
    const updated = posts.map((p) => {
      if (p.id === postId) {
        const prevReaction = p.userReaction;
        const currentCounts = { ...(p.reactionCounts || {}) };

        // Decrement previous reaction if any
        if (prevReaction && currentCounts[prevReaction]) {
          currentCounts[prevReaction] = Math.max(0, (currentCounts[prevReaction] || 1) - 1);
        }

        // Toggle off if same reaction clicked
        if (prevReaction === reactionType) {
          return {
            ...p,
            userReaction: undefined,
            isLiked: false,
            reactionCounts: currentCounts,
            likesCount: Math.max(0, (p.likesCount || 1) - 1),
          };
        }

        // Increment new reaction
        currentCounts[reactionType] = (currentCounts[reactionType] || 0) + 1;
        return {
          ...p,
          userReaction: reactionType,
          isLiked: true,
          reactionCounts: currentCounts,
          likesCount: prevReaction ? p.likesCount : (p.likesCount || 0) + 1,
        };
      }
      return p;
    });

    onUpdatePosts(updated);
    saveCommunityPosts(updated);
    setActiveReactionPickerPostId(null);
  };

  const handleAddTextComment = (postId: string, textOverride?: string) => {
    const text = (textOverride || commentInputs[postId])?.trim();
    if (!text) return;

    if (dictatingPostId === postId && speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      setDictatingPostId(null);
    }

    const updated = posts.map((p) => {
      if (p.id === postId) {
        return {
          ...p,
          commentsCount: (p.commentsCount || 0) + 1,
          comments: [
            ...(p.comments || []),
            {
              id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
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

  // Generate 3 Quick AI replies for a comment
  const handleFetchQuickAIReply = async (comment: PostComment, post: CommunityPost) => {
    setLoadingQuickReplyId(comment.id);
    try {
      const result = await generateQuickAIReply(comment.text, post.caption || post.prompt);
      setQuickRepliesData((prev) => ({
        ...prev,
        [comment.id]: result.replies,
      }));
    } catch (err) {
      console.warn('Quick AI reply error:', err);
    } finally {
      setLoadingQuickReplyId(null);
    }
  };

  const handleSharePost = async (post: CommunityPost) => {
    setSharingPostId(post.id);
    const authorName = post.postingIdentity?.name || post.author.name;
    const authorHandle = post.postingIdentity?.username || post.author.username;
    const payload: SharePayload = {
      id: post.id,
      type: 'post',
      title: `${authorName}'s Post - Metfa`,
      text: post.caption || post.prompt || 'Shared from Metfa Social Ecosystem',
      url: window.location.href,
      imageSrc: post.imageSrc || post.imageGallery?.[0] || undefined,
      authorName,
      authorUsername: authorHandle,
    };

    const handleIncrement = () => {
      const updated = incrementPostShares(post.id);
      onUpdatePosts(updated);
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

  // Toggle Speech-to-Text Dictation
  const toggleSpeechToText = (postId: string) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (dictatingPostId === postId) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (e) {
          console.warn(e);
        }
      }
      setDictatingPostId(null);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      const autoLang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
      recognition.lang = autoLang;
      recognition.maxAlternatives = 1;

      commentBaseTextRef.current = commentInputs[postId] || '';

      recognition.onstart = () => {
        setDictatingPostId(postId);
      };

      recognition.onresult = (event: any) => {
        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            sessionFinal += chunk;
          } else {
            sessionInterim += chunk;
          }
        }

        const sessionTranscript = (sessionFinal + (sessionInterim ? ' ' + sessionInterim : '')).trim();
        const base = commentBaseTextRef.current.trim();
        const updated = base ? `${base} ${sessionTranscript}` : sessionTranscript;

        setCommentInputs((prev) => ({ ...prev, [postId]: updated }));
      };

      recognition.onerror = () => {
        setDictatingPostId(null);
      };

      recognition.onend = () => {
        setDictatingPostId(null);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setDictatingPostId(null);
    }
  };

  // Start 10-Second Voice Clip Recording
  const startVoiceRecording = async (postId: string) => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const duration = Math.min(10, Math.max(1, recordTimer));

          const waveform = Array.from({ length: 12 }, () => Math.floor(20 + Math.random() * 75));

          const newVoiceComment: VoiceComment = {
            id: `vc_${Date.now()}`,
            author: {
              id: userProfile.id,
              name: userProfile.name,
              username: userProfile.username,
              avatar: userProfile.avatar,
              isVerified: userProfile.isVerified,
            },
            audioUrl,
            duration,
            timestamp: 'Just now',
            likesCount: 0,
            waveform,
          };

          const updated = posts.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                commentsCount: (p.commentsCount || 0) + 1,
                voiceComments: [...(p.voiceComments || []), newVoiceComment],
              };
            }
            return p;
          });

          onUpdatePosts(updated);
          saveCommunityPosts(updated);

          stream.getTracks().forEach((track) => track.stop());
          setIsRecordingVoiceClip(null);
          setRecordTimer(0);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };

        mediaRecorder.start();
        setIsRecordingVoiceClip(postId);
        setRecordTimer(0);

        let seconds = 0;
        timerIntervalRef.current = setInterval(() => {
          seconds += 1;
          setRecordTimer(seconds);
          if (seconds >= 10) {
            stopVoiceRecording();
          }
        }, 1000);
      } else {
        alert('Microphone access is not supported in this environment.');
      }
    } catch {
      // simulated voice comment fallback
      const fallbackVoice: VoiceComment = {
        id: `vc_${Date.now()}`,
        author: {
          id: userProfile.id,
          name: userProfile.name,
          username: userProfile.username,
          avatar: userProfile.avatar,
          isVerified: userProfile.isVerified,
        },
        audioUrl: 'https://actions.google.com/sounds/v1/water/rain_heavy.ogg',
        duration: 5,
        timestamp: 'Just now',
        likesCount: 0,
        waveform: [30, 60, 90, 45, 80, 70, 40, 85, 95, 60, 40, 25],
      };

      const updated = posts.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            commentsCount: (p.commentsCount || 0) + 1,
            voiceComments: [...(p.voiceComments || []), fallbackVoice],
          };
        }
        return p;
      });

      onUpdatePosts(updated);
      saveCommunityPosts(updated);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecordingVoiceClip(null);
    setRecordTimer(0);
  };

  const togglePlayVoice = (vc: VoiceComment) => {
    if (playingVoiceId === vc.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingVoiceId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(vc.audioUrl);
      audioPlayerRef.current = audio;
      setPlayingVoiceId(vc.id);
      audio.play().catch((err) => console.log('Audio playback error:', err));
      audio.onended = () => {
        setPlayingVoiceId(null);
      };
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-2xl lg:max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5">
      {/* 1. Prominent "Create Post" Card at Top of Main Social Feed */}
      <div className="bg-white border border-slate-200 rounded-3xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <img
            src={userProfile.avatar}
            alt={userProfile.name}
            className="w-10 h-10 rounded-2xl object-cover border border-purple-500/40 shrink-0"
          />
          <button
            type="button"
            onClick={onCreatePostClick}
            className="flex-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 hover:border-purple-500/50 rounded-2xl px-4 py-2.5 text-left text-xs sm:text-sm text-slate-600 transition cursor-pointer"
          >
            What's on your mind, {userProfile.name.split(' ')[0]}?
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1">
          <button
            type="button"
            onClick={onCreatePostClick}
            className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>Photo / Video</span>
          </button>

          <button
            type="button"
            onClick={onCreatePostClick}
            className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Type className="w-4 h-4 text-purple-600" />
            <span>Text Post</span>
          </button>

          <button
            type="button"
            onClick={onCreatePostClick}
            className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-teal-700 hover:text-teal-900 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>AI Magic</span>
          </button>
        </div>
      </div>

      {/* 2. Feed Filters Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('for_you')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'for_you'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>For You</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('trending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'trending'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
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

      {/* 3. Posts Stream */}
      <div className="space-y-5">
        {filteredPosts.map((post) => {
          const isCommentsOpen = activeCommentsPostId === post.id;
          const isThisRecordingVoice = isRecordingVoiceClip === post.id;
          const isThisDictating = dictatingPostId === post.id;
          const totalCommentsCount =
            (post.comments?.length || 0) + (post.voiceComments?.length || 0) || post.commentsCount || 0;
          const userReaction = post.userReaction;
          const isReactionPickerOpen = activeReactionPickerPostId === post.id;

          const hasGradient = post.textBackgroundPreset && GRADIENT_PRESETS[post.textBackgroundPreset];
          const isPureTextPost = (!post.imageSrc && (!post.imageGallery || post.imageGallery.length === 0) && !post.videoSrc) || hasGradient;

          return (
            <div
              key={post.id}
              id={`post-${post.id}`}
              className={`bg-white border rounded-3xl overflow-hidden shadow-sm transition-all duration-500 animate-fadeIn ${
                highlightedPostId === post.id
                  ? 'border-purple-500 ring-4 ring-purple-500/20 scale-[1.01] shadow-purple-500/20'
                  : 'border-slate-200 hover:border-purple-300'
              }`}
            >
              {/* Post Author Header */}
              <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <img
                    src={post.postingIdentity?.avatar || post.author.avatar}
                    alt={post.author.name}
                    className="w-10 h-10 rounded-2xl object-cover border border-slate-200 shadow-xs"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {post.postingIdentity?.name || post.author.name}
                      </h4>
                      {post.postingIdentity?.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {post.postingIdentity.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <span>@{post.postingIdentity?.username || post.author.username}</span>
                      <span>•</span>
                      <span>{post.createdAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {post.stylePreset && (
                    <span className="text-[11px] font-semibold px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full">
                      {post.stylePreset}
                    </span>
                  )}

                  {/* Post Context Action Menu */}
                  <div className="relative" data-menu-root="true">
                    <button
                      type="button"
                      id={`post-menu-btn-${post.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePostMenuId((prev) => (prev === post.id ? null : post.id));
                        setActiveCommentMenuId(null);
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                      title="Post options"
                      aria-label="Post options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activePostMenuId === post.id && (
                      <div
                        id={`post-menu-dropdown-${post.id}`}
                        className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-30 animate-scaleUp text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 1. Save Post / Unsave Post at the top */}
                        <button
                          type="button"
                          id={`save-post-menu-btn-${post.id}`}
                          onClick={() => {
                            handleToggleBookmark(post.id);
                            setActivePostMenuId(null);
                          }}
                          className="w-full px-3.5 py-2 text-left text-slate-700 hover:text-purple-700 hover:bg-purple-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                        >
                          <Bookmark className={`w-4 h-4 ${post.isBookmarked ? 'text-amber-500 fill-amber-500' : 'text-amber-500'}`} />
                          <span className="font-semibold">{post.isBookmarked ? 'Unsave Post' : 'Save Post'}</span>
                        </button>

                        {/* 2. Copy Link */}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/#post-${post.id}`);
                            setActivePostMenuId(null);
                            showToast('Post link copied to clipboard');
                          }}
                          className="w-full px-3.5 py-2 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Copy className="w-4 h-4 text-teal-600" />
                          <span>Copy Link</span>
                        </button>

                        {/* 3. Author actions (Edit / Delete) vs Non-author (Report) */}
                        {isContentOwner(post.author.id, userProfile.id) || (post.postingIdentity && isContentOwner(post.postingIdentity.id, userProfile.id)) ? (
                          <>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              type="button"
                              id={`edit-post-btn-${post.id}`}
                              onClick={() => {
                                setActivePostMenuId(null);
                                setEditingPost(post);
                              }}
                              className="w-full px-3.5 py-2 text-left text-purple-700 hover:text-purple-900 hover:bg-purple-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4 text-purple-600" />
                              <span>Edit Post</span>
                            </button>

                            <button
                              type="button"
                              id={`delete-post-btn-${post.id}`}
                              onClick={() => {
                                setActivePostMenuId(null);
                                handleDeletePost(post.id);
                              }}
                              className="w-full px-3.5 py-2 text-left text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete Post</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setActivePostMenuId(null);
                                showToast('Post reported to community moderators');
                              }}
                              className="w-full px-3.5 py-2 text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                            >
                              <Flag className="w-4 h-4 text-slate-400" />
                              <span>Report Post</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Media Player Container / Gradient Text Canvas */}
              {isPureTextPost ? (
                /* Pure Text / Gradient Canvas */
                <div
                  className={`p-6 sm:p-8 flex items-center justify-center text-center ${
                    hasGradient ? GRADIENT_PRESETS[post.textBackgroundPreset!] : 'bg-slate-50 text-slate-900 text-left'
                  }`}
                >
                  <PostContent
                    text={post.caption || post.prompt}
                    charLimit={hasGradient ? 220 : 180}
                    className="w-full"
                    textClassName={
                      hasGradient
                        ? 'text-lg sm:text-xl font-black text-white leading-relaxed text-center'
                        : 'text-sm sm:text-base text-slate-900 leading-relaxed font-normal text-left'
                    }
                    buttonClassName={
                      hasGradient
                        ? 'text-white/90 hover:text-white underline font-bold text-xs mt-2'
                        : 'text-purple-600 hover:text-purple-700 font-semibold text-sm mt-1'
                    }
                  />
                </div>
              ) : (
                /* Photo / Video / Gallery */
                <div className="relative group bg-slate-950 max-h-[520px] overflow-hidden flex items-center justify-center">
                  {post.videoSrc ? (
                    <video
                      src={post.videoSrc}
                      controls
                      playsInline
                      poster={post.imageSrc}
                      className="w-full max-h-[520px] object-cover bg-black"
                    />
                  ) : post.imageGallery && post.imageGallery.length > 1 ? (
                    /* Multi-image Grid */
                    <div
                      className={`w-full grid gap-1 ${
                        post.imageGallery.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
                      }`}
                    >
                      {post.imageGallery.map((img, i) => (
                        <div key={i} className="aspect-square bg-slate-950 overflow-hidden">
                          <img src={img} alt={`Gallery ${i}`} className="w-full h-full object-cover hover:scale-105 transition" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <img
                      src={post.imageSrc || post.imageGallery?.[0]}
                      alt={post.prompt}
                      className="w-full h-auto max-h-[520px] object-cover"
                    />
                  )}
                </div>
              )}

              {/* Post Caption (if media post) & Prompt Card (Default Closed / Opt-in) */}
              <div className="p-4 space-y-3">
                {!isPureTextPost && post.caption && (
                  <PostContent
                    text={post.caption}
                    charLimit={160}
                    textClassName="text-sm text-slate-800 leading-relaxed font-normal"
                    buttonClassName="text-purple-600 hover:text-purple-700 font-semibold text-sm mt-1"
                  />
                )}

                {/* Prompt Recipe Card (if AI Artwork - Strictly Opt-In) */}
                {post.prompt && post.prompt !== post.caption && (
                  <AiRecipeBox
                    prompt={post.prompt}
                    stylePreset={post.stylePreset}
                    onRemixPrompt={onRemixPrompt}
                  />
                )}

                {/* Post Action Buttons & Reaction Popover */}
                <div className="relative pt-2 border-t border-slate-100 text-slate-600 text-xs">
                  {/* Floating Reactions Bar Popover */}
                  {isReactionPickerOpen && (
                    <div className="absolute -top-12 left-2 z-30 bg-white border border-slate-200 rounded-full px-2 py-1.5 shadow-xl flex items-center gap-1.5 animate-fadeIn">
                      {Object.entries(REACTION_EMOJIS).map(([key, item]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleReactionSelect(post.id, key as any)}
                          className="text-lg hover:scale-135 transform transition duration-150 p-1"
                          title={item.label}
                        >
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Like / Reaction Trigger */}
                      <button
                        type="button"
                        onClick={() => handleLike(post.id)}
                        onMouseEnter={() => setActiveReactionPickerPostId(post.id)}
                        className={`flex items-center gap-1.5 transition ${
                          userReaction
                            ? `${REACTION_EMOJIS[userReaction]?.color} font-bold`
                            : post.isLiked
                            ? 'text-rose-500 font-bold'
                            : 'hover:text-slate-900'
                        }`}
                      >
                        {userReaction ? (
                          <span className="text-sm">{REACTION_EMOJIS[userReaction].emoji}</span>
                        ) : (
                          <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current' : ''}`} />
                        )}
                        <span>{post.likesCount || 0}</span>
                      </button>

                      {/* Comments Toggle */}
                      <button
                        type="button"
                        onClick={() => setActiveCommentsPostId(isCommentsOpen ? null : post.id)}
                        className={`flex items-center gap-1.5 transition ${
                          isCommentsOpen ? 'text-purple-600 font-bold' : 'hover:text-slate-900'
                        }`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{totalCommentsCount}</span>
                      </button>

                      {/* Remix Count */}
                      <button
                        type="button"
                        onClick={() => onRemixPrompt(post.prompt, post.stylePreset)}
                        className="flex items-center gap-1.5 hover:text-slate-900 transition"
                      >
                        <Repeat className="w-4 h-4" />
                        <span>{post.remixCount || 0}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      id={`share-post-${post.id}`}
                      onClick={() => handleSharePost(post)}
                      className="flex items-center gap-1.5 hover:text-slate-900 transition group"
                      title="Share Post"
                    >
                      <Share2 className="w-4 h-4 group-hover:scale-110 transition" />
                      <span>{post.sharesCount || 0}</span>
                    </button>
                  </div>
                </div>

                {/* Comments & 10s Voice Audio Section */}
                {isCommentsOpen && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 animate-fadeIn">
                    {/* Recording Banner if active */}
                    {isThisRecordingVoice && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-rose-600 animate-spin" />
                          <span className="text-xs font-bold text-rose-900">
                            Recording 10s Voice Comment ({recordTimer}s / 10s max)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={stopVoiceRecording}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>Done</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelVoiceRecording}
                            className="p-1 bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Dictation Banner if active */}
                    {isThisDictating && (
                      <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between animate-fadeIn text-xs">
                        <div className="flex items-center gap-2 text-teal-800">
                          <Radio className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                          <span className="font-bold">
                            🎙️ Listening to your comment (Auto-detecting language)...
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSpeechToText(post.id)}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs"
                        >
                          Done
                        </button>
                      </div>
                    )}

                    {/* Add comment input bar + Mic triggers */}
                    <div className="flex items-center gap-2">
                      <img
                        src={userProfile.avatar}
                        alt={userProfile.name}
                        className="w-7 h-7 rounded-xl object-cover border border-slate-200"
                      />
                      <div className="flex-1 relative flex items-center">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTextComment(post.id);
                          }}
                          placeholder={
                            dictatingPostId === post.id
                              ? '🎙️ Listening... (Speak now)'
                              : 'Write a comment or speak in any language...'
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-24 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
                        />

                        {/* Mic & Voice triggers */}
                        <div className="absolute right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleSpeechToText(post.id)}
                            title="Voice Typing (Auto-Detect Language)"
                            className={`p-1 rounded-lg transition ${
                              isThisDictating
                                ? 'bg-teal-600 text-white animate-pulse font-bold'
                                : 'text-slate-400 hover:text-teal-700 hover:bg-slate-100'
                            }`}
                          >
                            <Mic className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (isThisRecordingVoice) stopVoiceRecording();
                              else startVoiceRecording(post.id);
                            }}
                            title="Record 10-second Audio Comment"
                            className={`p-1 rounded-lg transition ${
                              isThisRecordingVoice
                                ? 'bg-rose-600 text-white animate-pulse'
                                : 'text-slate-400 hover:text-purple-700 hover:bg-slate-100'
                            }`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddTextComment(post.id)}
                        className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shrink-0 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Existing Voice & Text Comments List with ✨ Quick AI Reply */}
                    <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                      {/* Render Voice Comments */}
                      {(post.voiceComments || []).map((vc) => {
                        const isPlaying = playingVoiceId === vc.id;
                        return (
                          <div
                            key={vc.id}
                            className="flex items-start gap-2.5 text-xs bg-purple-50 p-2.5 rounded-2xl border border-purple-200"
                          >
                            <img
                              src={vc.author.avatar}
                              alt={vc.author.name}
                              className="w-7 h-7 rounded-xl object-cover mt-0.5 border border-purple-200"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-slate-900 text-[11px] flex items-center gap-1">
                                  <span>{vc.author.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 bg-teal-100 border border-teal-200 text-teal-800 rounded-full font-mono font-medium">
                                    🎤 Voice ({vc.duration}s)
                                  </span>
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500">{vc.timestamp}</span>
                                  {isContentOwner(vc.author.id, userProfile.id) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVoiceComment(post.id, vc.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                                      title="Delete voice comment"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => togglePlayVoice(vc)}
                                  className="p-1.5 rounded-full bg-purple-600 text-white hover:bg-purple-500 transition shadow-xs"
                                >
                                  {isPlaying ? (
                                    <Pause className="w-3 h-3 fill-current" />
                                  ) : (
                                    <Play className="w-3 h-3 fill-current ml-0.5" />
                                  )}
                                </button>

                                <div className="flex items-center gap-0.5 flex-1 h-5 overflow-hidden">
                                  {(vc.waveform || [30, 60, 90, 45, 75, 50, 80, 40, 65, 90, 45, 30]).map(
                                    (height, idx) => (
                                      <div
                                        key={idx}
                                        style={{ height: `${Math.max(4, (height / 100) * 18)}px` }}
                                        className={`w-1 rounded-full transition-all ${
                                          isPlaying
                                            ? 'bg-gradient-to-t from-purple-500 to-teal-400 animate-pulse'
                                            : 'bg-slate-300'
                                        }`}
                                      />
                                    )
                                  )}
                                </div>

                                <span className="text-[10px] font-mono text-teal-700 font-bold">
                                  0:0{vc.duration}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Render Text Comments with Inline Edit, Delete & Quick AI Reply */}
                      {(post.comments || []).map((c) => {
                        const quickReplies = quickRepliesData[c.id];
                        const isLoadingReplies = loadingQuickReplyId === c.id;
                        const isOwner = isContentOwner(c.author.id, userProfile.id);

                        return (
                          <div key={c.id} className="space-y-1.5 text-xs">
                            <div className="flex items-start gap-2.5">
                              <img
                                src={c.author.avatar}
                                alt={c.author.name}
                                className="w-7 h-7 rounded-xl object-cover mt-0.5 border border-slate-200"
                              />
                              <div className="bg-slate-50 p-2.5 rounded-2xl flex-1 border border-slate-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-slate-900 text-[11px]">{c.author.name}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-500">{c.timestamp}</span>

                                    {/* Comment Context Menu */}
                                    <div className="relative" data-menu-root="true">
                                      <button
                                        type="button"
                                        id={`comment-menu-btn-${c.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveCommentMenuId((prev) => (prev === c.id ? null : c.id));
                                          setActivePostMenuId(null);
                                        }}
                                        className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition"
                                        title="Comment options"
                                        aria-label="Comment options"
                                      >
                                        <MoreHorizontal className="w-3 h-3" />
                                      </button>

                                      {activeCommentMenuId === c.id && (
                                        <div
                                          id={`comment-menu-dropdown-${c.id}`}
                                          className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 animate-scaleUp text-xs"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {isOwner ? (
                                            <>
                                              <button
                                                type="button"
                                                id={`edit-comment-btn-${c.id}`}
                                                onClick={() => handleStartEditComment(c)}
                                                className="w-full px-2.5 py-1.5 text-left text-slate-700 hover:text-purple-700 hover:bg-purple-50 flex items-center gap-1.5 transition text-[11px] font-medium"
                                              >
                                                <Edit3 className="w-3 h-3 text-purple-600" />
                                                <span>Edit Comment</span>
                                              </button>

                                              <button
                                                type="button"
                                                id={`delete-comment-btn-${c.id}`}
                                                onClick={() => handleDeleteComment(post.id, c.id)}
                                                className="w-full px-2.5 py-1.5 text-left text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 transition text-[11px] font-medium border-t border-slate-100 mt-0.5 pt-1"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                                <span>Delete Comment</span>
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  navigator.clipboard.writeText(c.text);
                                                  setActiveCommentMenuId(null);
                                                  showToast('Comment text copied');
                                                }}
                                                className="w-full px-2.5 py-1.5 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1.5 transition text-[11px]"
                                              >
                                                <Copy className="w-3 h-3 text-slate-500" />
                                                <span>Copy Text</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveCommentMenuId(null);
                                                  showToast('Comment reported');
                                                }}
                                                className="w-full px-2.5 py-1.5 text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1.5 transition text-[11px] border-t border-slate-100 mt-0.5 pt-1"
                                              >
                                                <Flag className="w-3 h-3" />
                                                <span>Report</span>
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Inline Comment Editing or Standard Text */}
                                {editingCommentId === c.id ? (
                                  <div className="space-y-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                                    <textarea
                                      id={`edit-comment-input-${c.id}`}
                                      value={editingCommentText}
                                      onChange={(e) => setEditingCommentText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          handleSaveCommentEdit(post.id, c.id);
                                        }
                                        if (e.key === 'Escape') {
                                          setEditingCommentId(null);
                                        }
                                      }}
                                      rows={2}
                                      className="w-full bg-white border border-purple-500 rounded-xl p-2 text-xs text-slate-900 focus:outline-none resize-none shadow-inner"
                                      autoFocus
                                    />
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditingCommentId(null)}
                                        className="px-2.5 py-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 rounded-lg transition"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        id={`save-comment-btn-${c.id}`}
                                        onClick={() => handleSaveCommentEdit(post.id, c.id)}
                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] rounded-lg shadow-sm transition"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-slate-800 text-xs leading-relaxed">{c.text}</p>
                                )}

                                {/* Creator Action: ✨ Quick AI Reply Trigger */}
                                <div className="mt-2 pt-1 border-t border-slate-200/80 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => handleFetchQuickAIReply(c, post)}
                                    disabled={isLoadingReplies}
                                    className="text-[10px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 transition"
                                  >
                                    <Sparkles className="w-3 h-3 text-teal-600" />
                                    <span>
                                      {isLoadingReplies ? 'Generating smart replies...' : '✨ Quick AI Reply'}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Quick AI Replies suggestions row */}
                            {quickReplies && quickReplies.length > 0 && (
                              <div className="pl-9 space-y-1 animate-fadeIn">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Tap to reply:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {quickReplies.map((reply, rIdx) => (
                                    <button
                                      key={rIdx}
                                      type="button"
                                      onClick={() => handleAddTextComment(post.id, reply)}
                                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded-xl text-[11px] font-medium transition text-left"
                                    >
                                      {reply}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <SocialShareModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setActiveSharePayload(null);
          setSharingPostId(null);
        }}
        payload={activeSharePayload}
        onSharePerformed={() => {
          if (sharingPostId) {
            const updated = incrementPostShares(sharingPostId);
            onUpdatePosts(updated);
          }
        }}
      />

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModal
          isOpen={!!editingPost}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={handleSavePostEdit}
        />
      )}

      {/* Confirmation Dialog for Delete Post/Comment */}
      {confirmModal && (
        <ConfirmActionModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel="Delete Permanently"
          isDestructive={true}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 border border-purple-500/50 text-white text-xs px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;
