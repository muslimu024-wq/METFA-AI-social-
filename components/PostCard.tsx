import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  Bookmark,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Flag,
  Mic,
  Square,
  Volume2,
  Send,
  Check,
  X,
  Play,
  Pause,
  Music,
  ShieldCheck,
} from 'lucide-react';
import { CommunityPost, UserProfile } from '../types/community';
import { AudioTrack } from '../types/audio';
import { isContentOwner } from '../utils/communityStore';
import { isPostSaved, toggleSavePost } from '../utils/bookmarkStore';
import { formatDuration } from '../utils/audioStore';
import { AiRecipeBox } from './AiRecipeBox';
import AudioLicenseInfoModal from './AudioLicenseInfoModal';
import { PostContent } from './PostContent';

const GRADIENT_PRESETS: { [key: string]: string } = {
  sunset: 'bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600',
  cyberpunk: 'bg-gradient-to-br from-purple-700 via-pink-600 to-teal-400',
  emerald: 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700',
  midnight: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 border border-purple-800/40',
  fire: 'bg-gradient-to-br from-amber-600 via-red-600 to-rose-700',
};

const REACTION_ICONS: { [key: string]: { label: string; emoji: string; color: string } } = {
  like: { label: 'Like', emoji: '👍', color: 'text-blue-400' },
  love: { label: 'Love', emoji: '❤️', color: 'text-rose-500' },
  haha: { label: 'Haha', emoji: '😆', color: 'text-amber-400' },
  wow: { label: 'Wow', emoji: '😮', color: 'text-yellow-400' },
  sad: { label: 'Sad', emoji: '😢', color: 'text-sky-400' },
  fire: { label: 'Fire', emoji: '🔥', color: 'text-orange-500' },
};

export interface PostCardProps {
  post: CommunityPost;
  userProfile: UserProfile;
  onUpdatePost?: (updatedPost: CommunityPost) => void;
  onDeletePost?: (postId: string) => void;
  onToggleLike?: (postId: string) => void;
  onToggleSave?: (postId: string) => void;
  onRemixPrompt?: (prompt: string, stylePreset?: string) => void;
  onSharePost?: (post: CommunityPost) => void;
  onAddComment?: (postId: string, text: string) => void;
  onAddVoiceComment?: (postId: string, audioUrl: string, duration: number) => void;
  onDeleteComment?: (postId: string, commentId: string) => void;
  onDeleteVoiceComment?: (postId: string, voiceId: string) => void;
  onStartEdit?: (post: CommunityPost) => void;
  isHighlighted?: boolean;
  onShowToast?: (message: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  userProfile,
  onUpdatePost,
  onDeletePost,
  onToggleLike,
  onToggleSave,
  onRemixPrompt,
  onSharePost,
  onAddComment,
  onAddVoiceComment,
  onDeleteComment,
  onDeleteVoiceComment,
  onStartEdit,
  isHighlighted,
  onShowToast,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Local inline caption edit state
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || post.prompt);

  // Voice playback state
  const [isPlayingVoiceId, setIsPlayingVoiceId] = useState<string | null>(null);
  const [isPlayingTrack, setIsPlayingTrack] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackAudioRef = useRef<HTMLAudioElement | null>(null);

  // 10-second Voice Note Recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);

  // Speech-to-text dictation state
  const [isDictating, setIsDictating] = useState(false);
  const speechRecognitionRef = useRef<any>(null);

  const isOwner =
    isContentOwner(post.author.id, userProfile.id) ||
    (post.postingIdentity && isContentOwner(post.postingIdentity.id, userProfile.id));

  const isSaved = post.isBookmarked ?? isPostSaved(post.id);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-post-menu="${post.id}"]`)) {
        setIsMenuOpen(false);
      }
      if (!target.closest(`[data-reaction-container="${post.id}"]`)) {
        setShowReactionPicker(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [post.id]);

  const handleSaveToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMenuOpen(false);

    if (onToggleSave) {
      onToggleSave(post.id);
    } else {
      const result = toggleSavePost(post.id);
      if (onShowToast) {
        onShowToast(result.isSaved ? 'Saved to your bookmarks!' : 'Removed from bookmarks');
      }
      if (onUpdatePost && result.post) {
        onUpdatePost(result.post);
      }
    }
  };

  const handleCopyLink = () => {
    setIsMenuOpen(false);
    const postUrl = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard.writeText(postUrl);
    onShowToast?.('Post link copied to clipboard!');
  };

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCaption.trim()) return;
    const updated: CommunityPost = {
      ...post,
      caption: editCaption.trim(),
      prompt: post.prompt || editCaption.trim(),
    };
    if (onUpdatePost) {
      onUpdatePost(updated);
    }
    setIsInlineEditing(false);
    onShowToast?.('Post updated successfully!');
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (onAddComment) {
      onAddComment(post.id, commentText.trim());
    }
    setCommentText('');
  };

  // Voice Playback handler
  const handlePlayVoice = (voiceId: string, audioUrl: string) => {
    if (isPlayingVoiceId === voiceId) {
      audioRef.current?.pause();
      setIsPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setIsPlayingVoiceId(voiceId);

    audio.onended = () => setIsPlayingVoiceId(null);
    audio.onerror = () => {
      setIsPlayingVoiceId(null);
      onShowToast?.('Unable to play audio comment');
    };
    audio.play().catch(() => setIsPlayingVoiceId(null));
  };

  // 10-sec Voice Note Recorder
  const handleStartVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        if (onAddVoiceComment) {
          onAddVoiceComment(post.id, audioUrl, recordingSeconds || 5);
        }
        stream.getTracks().forEach((track) => track.stop());
        setRecordingSeconds(0);
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordingSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 10) {
            handleStopVoiceRecording();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Audio recording permission error:', err);
      onShowToast?.('Microphone access required for voice comments');
    }
  };

  const handleStopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    }
  };

  // Speech-to-Text Dictation
  const handleToggleDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onShowToast?.('Speech recognition not supported in this browser');
      return;
    }

    if (isDictating) {
      speechRecognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setCommentText((prev) => `${prev} ${transcript}`.trim());
      };

      recognition.onerror = () => setIsDictating(false);
      recognition.onend = () => setIsDictating(false);

      speechRecognitionRef.current = recognition;
      recognition.start();
      setIsDictating(true);
      onShowToast?.('Listening... Speak now');
    } catch (err) {
      console.warn('Dictation error:', err);
      setIsDictating(false);
    }
  };

  const isPureTextPost = post.postType === 'text' || (!post.imageSrc && !post.videoSrc && (!post.imageGallery || post.imageGallery.length === 0));
  const hasGradient = Boolean(post.textBackgroundPreset && GRADIENT_PRESETS[post.textBackgroundPreset]);

  return (
    <article
      id={`post-${post.id}`}
      className={`bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden transition duration-300 ${
        isHighlighted ? 'ring-2 ring-purple-500 shadow-purple-500/20' : ''
      }`}
    >
      {/* 1. Header: Author & Options Menu (...) */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={post.postingIdentity?.avatar || post.author.avatar}
            alt={post.postingIdentity?.name || post.author.name}
            className="w-10 h-10 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 truncate leading-tight">
                {post.postingIdentity?.name || post.author.name}
              </h4>
              {post.postingIdentity?.badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold shrink-0">
                  {post.postingIdentity.badge}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span className="text-teal-700 font-medium">@{post.postingIdentity?.username || post.author.username}</span>
              <span>•</span>
              <span>{post.createdAt}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {post.stylePreset && (
            <span className="text-[10px] font-semibold px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full hidden sm:inline-block">
              {post.stylePreset}
            </span>
          )}

          {/* Top-Right Context Dropdown Menu (...) */}
          <div className="relative" data-post-menu={post.id}>
            <button
              type="button"
              id={`post-menu-btn-${post.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((prev) => !prev);
              }}
              className={`p-1.5 rounded-xl transition cursor-pointer ${
                isMenuOpen ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Post options"
              aria-label="Post options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                id={`post-menu-dropdown-${post.id}`}
                className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-40 animate-scaleUp text-xs backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. Save Post / Unsave Post at the very top */}
                <button
                  type="button"
                  id={`save-post-menu-btn-${post.id}`}
                  onClick={handleSaveToggle}
                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:text-purple-700 hover:bg-purple-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                >
                  <Bookmark
                    className={`w-4 h-4 ${isSaved ? 'text-amber-500 fill-amber-500' : 'text-amber-500'}`}
                  />
                  <span className="font-semibold">{isSaved ? 'Unsave Post' : 'Save Post'}</span>
                </button>

                {/* 2. Copy Link */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full px-3.5 py-2 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-teal-600" />
                  <span>Copy Link</span>
                </button>

                {/* 3. Author Only Actions: Edit Post & Delete Post */}
                {isOwner ? (
                  <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      type="button"
                      id={`edit-post-menu-btn-${post.id}`}
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (onStartEdit) {
                          onStartEdit(post);
                        } else {
                          setIsInlineEditing(true);
                          setEditCaption(post.caption || post.prompt);
                        }
                      }}
                      className="w-full px-3.5 py-2 text-left text-purple-700 hover:text-purple-900 hover:bg-purple-50 flex items-center gap-2.5 transition font-medium cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4 text-purple-600" />
                      <span>Edit Post</span>
                    </button>

                    <button
                      type="button"
                      id={`delete-post-menu-btn-${post.id}`}
                      onClick={() => {
                        setIsMenuOpen(false);
                        onDeletePost?.(post.id);
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
                        setIsMenuOpen(false);
                        onShowToast?.('Post reported to community moderators');
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

      {/* 2. Post Media / Text Body */}
      {isInlineEditing ? (
        <form onSubmit={handleInlineSave} className="p-4 space-y-3 bg-slate-50 border-b border-slate-200">
          <label className="text-xs font-bold text-purple-800 block">Edit Caption & Text:</label>
          <textarea
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            rows={3}
            className="w-full bg-white border border-purple-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-purple-500 resize-none font-medium shadow-xs"
            placeholder="Write your updated post caption..."
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsInlineEditing(false)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </form>
      ) : isPureTextPost ? (
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
                ? 'text-lg sm:text-xl font-black text-white leading-relaxed text-center drop-shadow-sm'
                : 'text-sm sm:text-base text-slate-900 leading-relaxed font-normal text-left'
            }
            buttonClassName={
              hasGradient
                ? 'text-white hover:underline font-bold text-xs mt-2'
                : 'text-blue-600 hover:text-blue-800 font-semibold text-sm mt-1'
            }
          />
        </div>
      ) : (
        <div className="relative group bg-slate-100 max-h-[520px] overflow-hidden flex items-center justify-center">
          {post.videoSrc ? (
            <video
              src={post.videoSrc}
              controls
              playsInline
              poster={post.imageSrc}
              className="w-full max-h-[520px] object-cover bg-black"
            />
          ) : post.imageGallery && post.imageGallery.length > 1 ? (
            <div
              className={`w-full grid gap-1 ${
                post.imageGallery.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {post.imageGallery.map((img, i) => (
                <div key={i} className="aspect-square bg-slate-100 overflow-hidden">
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

      {/* 3. Caption & AI Prompt Recipe Card (Default Closed / Opt-in) */}
      {!isInlineEditing && (
        <div className="p-4 space-y-3">
          {!isPureTextPost && post.caption && (
            <PostContent
              text={post.caption}
              charLimit={160}
              textClassName="text-sm text-slate-800 leading-relaxed font-normal"
              buttonClassName="text-blue-600 hover:text-blue-800 font-semibold text-sm mt-1"
            />
          )}

          {post.prompt && post.prompt !== post.caption && (
            <AiRecipeBox
              prompt={post.prompt}
              stylePreset={post.stylePreset}
              onRemixPrompt={onRemixPrompt}
            />
          )}

          {post.audioTrack && (
            <div className="p-2.5 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative group shrink-0">
                  <img
                    src={post.audioTrack.cover_url}
                    alt={post.audioTrack.title}
                    className="w-10 h-10 rounded-xl object-cover border border-purple-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!trackAudioRef.current) {
                        const audio = new Audio(post.audioTrack!.audio_url);
                        trackAudioRef.current = audio;
                        audio.onended = () => setIsPlayingTrack(false);
                        audio.onerror = () => setIsPlayingTrack(false);
                      }
                      if (isPlayingTrack) {
                        trackAudioRef.current.pause();
                        setIsPlayingTrack(false);
                      } else {
                        trackAudioRef.current.play().catch(() => setIsPlayingTrack(false));
                        setIsPlayingTrack(true);
                      }
                    }}
                    className="absolute inset-0 bg-black/40 hover:bg-black/60 rounded-xl flex items-center justify-center text-white transition cursor-pointer"
                  >
                    {isPlayingTrack ? (
                      <Pause className="w-4 h-4 text-teal-300" />
                    ) : (
                      <Play className="w-4 h-4 text-purple-200 fill-purple-200 ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Music className="w-3 h-3 text-purple-600 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-900 truncate">{post.audioTrack.title}</h4>
                  </div>
                  <p className="text-[10px] text-purple-700 truncate font-mono">
                    {post.audioTrack.artist} • {formatDuration(post.audioTrack.duration)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsLicenseModalOpen(true)}
                className="px-2 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-[10px] font-bold flex items-center gap-1 shrink-0 transition"
                title="View verified licensing certificate"
              >
                <ShieldCheck className="w-3 h-3 text-teal-600" />
                <span>{post.audioTrack.license_type}</span>
              </button>
            </div>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {post.tags.map((tag, i) => (
                <span key={i} className="text-[11px] text-teal-700 font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Action Bar (Like, Comment, Share, Save) */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Reaction / Like Button */}
          <div className="relative" data-reaction-container={post.id}>
            <button
              type="button"
              id={`like-post-${post.id}`}
              onClick={() => onToggleLike?.(post.id)}
              onMouseEnter={() => setShowReactionPicker(true)}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold transition cursor-pointer ${
                post.isLiked
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current text-rose-600' : ''}`} />
              <span>{post.likesCount}</span>
            </button>
          </div>

          {/* Comments Toggle Button */}
          <button
            type="button"
            id={`comments-toggle-${post.id}`}
            onClick={() => setShowComments((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold transition cursor-pointer ${
              showComments ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{(post.comments?.length || 0) + (post.voiceComments?.length || 0)}</span>
          </button>

          {/* Share Button */}
          {onSharePost && (
            <button
              type="button"
              id={`share-post-${post.id}`}
              onClick={() => onSharePost(post)}
              className="px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 font-bold transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
        </div>

        {/* Quick Save Bookmark Action Button */}
        <button
          type="button"
          id={`bookmark-post-${post.id}`}
          onClick={handleSaveToggle}
          className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
            isSaved
              ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
              : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title={isSaved ? 'Unsave from bookmarks' : 'Save post to bookmarks'}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current text-amber-500' : ''}`} />
          <span className="text-[11px] font-bold hidden sm:inline">
            {isSaved ? 'Saved' : 'Save'}
          </span>
        </button>
      </div>

      {/* 5. Interactive Comments Section */}
      {showComments && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4 animate-fadeIn">
          {/* Voice Comments */}
          {post.voiceComments && post.voiceComments.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                🎙️ Audio Voice Comments ({post.voiceComments.length})
              </span>
              <div className="space-y-2">
                {post.voiceComments.map((vc) => (
                  <div
                    key={vc.id}
                    className="p-2.5 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handlePlayVoice(vc.id, vc.audioUrl)}
                        className={`p-2 rounded-full transition cursor-pointer ${
                          isPlayingVoiceId === vc.id
                            ? 'bg-purple-600 text-white animate-pulse'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        {isPlayingVoiceId === vc.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{vc.author.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">@{vc.author.username}</span>
                        </div>
                        <div className="text-[10px] text-teal-700 font-mono">{vc.duration}s voice memo</div>
                      </div>
                    </div>

                    {isContentOwner(vc.author.id, userProfile.id) && onDeleteVoiceComment && (
                      <button
                        type="button"
                        onClick={() => onDeleteVoiceComment(post.id, vc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete voice note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text Comments List */}
          {post.comments && post.comments.length > 0 && (
            <div className="space-y-2.5">
              {post.comments.map((c) => (
                <div key={c.id} className="p-3 bg-white rounded-2xl border border-slate-200 flex items-start justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <img src={c.author.avatar} alt={c.author.name} className="w-7 h-7 rounded-xl object-cover shrink-0 mt-0.5 border border-slate-200" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{c.author.name}</span>
                        <span className="text-[10px] text-teal-700 font-mono">@{c.author.username}</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed">{c.text}</p>
                    </div>
                  </div>

                  {isContentOwner(c.author.id, userProfile.id) && onDeleteComment && (
                    <button
                      type="button"
                      onClick={() => onDeleteComment(post.id, c.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Comment Input Bar */}
          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-2 border-t border-slate-200">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={isDictating ? 'Listening...' : 'Write a comment or prompt reply...'}
              className="flex-1 bg-white border border-slate-300 focus:border-purple-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition font-medium shadow-xs"
            />

            {/* Speech Dictation Button */}
            <button
              type="button"
              onClick={handleToggleDictation}
              className={`p-2 rounded-xl transition cursor-pointer ${
                isDictating ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Voice-to-Text Dictation"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* 10s Voice Memo Button */}
            <button
              type="button"
              onClick={isRecordingVoice ? handleStopVoiceRecording : handleStartVoiceRecording}
              className={`p-2 rounded-xl transition cursor-pointer ${
                isRecordingVoice
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
              title={isRecordingVoice ? `Recording (${recordingSeconds}s)... Tap to send` : 'Record 10s Voice Note'}
            >
              {isRecordingVoice ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="p-2 bg-gradient-to-r from-purple-600 to-teal-500 disabled:opacity-40 text-white rounded-xl transition cursor-pointer shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Audio License Certificate Modal */}
      {isLicenseModalOpen && post.audioTrack && (
        <AudioLicenseInfoModal
          isOpen={isLicenseModalOpen}
          track={post.audioTrack}
          onClose={() => setIsLicenseModalOpen(false)}
        />
      )}
    </article>
  );
};

export const FeedPostCard = PostCard;
export { AiRecipeBox };
export default PostCard;

