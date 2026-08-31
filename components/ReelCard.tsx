import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Sparkles,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Flag,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { ReelHighlight, UserProfile } from '../types/community';
import { AudioTrack } from '../types/audio';
import { isContentOwner } from '../utils/communityStore';
import { isReelSaved, toggleSaveReel } from '../utils/bookmarkStore';
import { getAudioTracks } from '../utils/audioStore';
import AudioLicenseInfoModal from './AudioLicenseInfoModal';

export interface ReelCardProps {
  reel: ReelHighlight;
  userProfile: UserProfile;
  isActive?: boolean;
  onLike?: (reelId: string) => void;
  onSave?: (reelId: string) => void;
  onShare?: (reel: ReelHighlight) => void;
  onRemixPrompt?: (prompt: string) => void;
  onEditReel?: (reel: ReelHighlight) => void;
  onDeleteReel?: (reelId: string) => void;
  onOpenComments?: (reel: ReelHighlight) => void;
  onShowToast?: (message: string) => void;
  compactMode?: boolean;
}

export const ReelCard: React.FC<ReelCardProps> = ({
  reel,
  userProfile,
  isActive = false,
  onLike,
  onSave,
  onShare,
  onRemixPrompt,
  onEditReel,
  onDeleteReel,
  onOpenComments,
  onShowToast,
  compactMode = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(reel.caption);
  const [editTitle, setEditTitle] = useState(reel.title);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isOwner = isContentOwner(reel.author.id, userProfile.id);
  const isSaved = reel.isSaved ?? isReelSaved(reel.id);
  const savesCount = reel.savesCount ?? (reel.id === 'reel_2' ? 245 : 128);

  // Resolve audio track
  const resolvedAudioTrack: AudioTrack | null = React.useMemo(() => {
    if (reel.audioTrack) return reel.audioTrack;
    if (!reel.musicTrack) return null;
    const tracks = getAudioTracks();
    const match = tracks.find((t) =>
      reel.musicTrack?.toLowerCase().includes(t.title.toLowerCase()) ||
      t.title.toLowerCase().includes(reel.musicTrack?.toLowerCase() || '')
    );
    if (match) return match;
    // Synthesize licensed audio track object
    return {
      id: `track_custom_${reel.id}`,
      title: reel.musicTrack.split('•')[0]?.trim() || reel.musicTrack,
      artist: reel.musicTrack.split('•')[1]?.trim() || 'Metfa Sound Studio',
      audio_url: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_hum.ogg',
      cover_url: reel.thumbnailSrc || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
      duration: reel.duration || 30,
      genre: 'Electronic',
      mood: 'Energetic',
      license_type: 'Royalty-Free Commercial',
      license_source: 'Metfa Audio Catalog',
      track_type: 'royalty_free',
      attribution_required: false,
      commercial_use_allowed: true,
      territories: ['Worldwide'],
      license_start: '2025-01-01T00:00:00.000Z',
      license_expiry: null,
      status: 'active',
    };
  }, [reel.audioTrack, reel.musicTrack, reel.id, reel.thumbnailSrc, reel.duration]);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else if (!isActive && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSaveToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMenuOpen(false);

    if (onSave) {
      onSave(reel.id);
    } else {
      const res = toggleSaveReel(reel.id);
      if (onShowToast) {
        onShowToast(res.isSaved ? 'Reel saved to bookmarks!' : 'Reel removed from bookmarks');
      }
    }
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    const link = `${window.location.origin}/#reel-${reel.id}`;
    navigator.clipboard.writeText(link);
    onShowToast?.('Reel link copied to clipboard!');
  };

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    if (onEditReel) {
      onEditReel({
        ...reel,
        title: editTitle.trim(),
        caption: editCaption.trim(),
      });
    }
    setIsInlineEditing(false);
    onShowToast?.('Reel updated successfully!');
  };

  return (
    <div
      id={`reel-card-${reel.id}`}
      className={`relative rounded-3xl overflow-hidden bg-gray-950 border border-gray-800/80 shadow-2xl transition duration-300 ${
        compactMode ? 'aspect-[9/16] w-full max-w-[280px]' : 'h-[620px] sm:h-[680px] w-full max-w-sm mx-auto'
      }`}
    >
      {/* Video / Thumbnail Container */}
      <div className="absolute inset-0 bg-black cursor-pointer" onClick={togglePlay}>
        {reel.videoSrc ? (
          <video
            ref={videoRef}
            src={reel.videoSrc}
            poster={reel.thumbnailSrc}
            playsInline
            loop
            muted={isMuted}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={reel.thumbnailSrc || 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80'}
            alt={reel.title}
            className="w-full h-full object-cover"
          />
        )}

        {/* Ambient Top & Bottom Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/60 pointer-events-none" />

        {/* Center Play/Pause indicator on pause */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="p-4 rounded-full bg-black/60 backdrop-blur-md text-white/90 shadow-xl">
              <Play className="w-8 h-8 fill-current translate-x-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Top Overlay Bar */}
      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-teal-300 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-teal-400" />
            <span>{reel.duration}s</span>
          </span>

          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Top-Right Reel Options Menu (...) */}
        <div className="relative">
          <button
            type="button"
            id={`reel-menu-btn-${reel.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition cursor-pointer"
            title="Reel options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div
              id={`reel-menu-dropdown-${reel.id}`}
              className="absolute right-0 top-full mt-2 w-48 bg-gray-950/95 border border-gray-800 rounded-2xl shadow-2xl py-1.5 z-40 animate-scaleUp text-xs backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. Save Reel Option */}
              <button
                type="button"
                id={`save-reel-menu-btn-${reel.id}`}
                onClick={handleSaveToggle}
                className="w-full px-3.5 py-2 text-left text-gray-200 hover:text-white hover:bg-purple-950/60 flex items-center gap-2.5 transition font-medium cursor-pointer"
              >
                <Bookmark
                  className={`w-4 h-4 ${isSaved ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}`}
                />
                <span className="font-semibold">{isSaved ? 'Unsave Reel' : 'Save Reel'}</span>
              </button>

              {/* 2. Copy Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full px-3.5 py-2 text-left text-gray-200 hover:text-white hover:bg-gray-900 flex items-center gap-2.5 transition cursor-pointer"
              >
                <Copy className="w-4 h-4 text-teal-400" />
                <span>Copy Link</span>
              </button>

              {/* 3. Author actions */}
              {isOwner ? (
                <>
                  <div className="h-px bg-gray-800/80 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onEditReel) {
                        onEditReel(reel);
                      } else {
                        setIsInlineEditing(true);
                      }
                    }}
                    className="w-full px-3.5 py-2 text-left text-purple-300 hover:text-white hover:bg-purple-950/60 flex items-center gap-2.5 transition font-medium cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-purple-400" />
                    <span>Edit Caption/Tags</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDeleteReel?.(reel.id);
                    }}
                    className="w-full px-3.5 py-2 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center gap-2.5 transition font-medium cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Reel</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="h-px bg-gray-800/80 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onShowToast?.('Reel reported to community moderators');
                    }}
                    className="w-full px-3.5 py-2 text-left text-gray-400 hover:text-gray-200 hover:bg-gray-900 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Flag className="w-4 h-4 text-gray-500" />
                    <span>Report Content</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right-Side Vertical Overlay Action Bar */}
      <div className="absolute right-3.5 bottom-20 z-20 flex flex-col items-center gap-4">
        {/* 1. Like Button */}
        <button
          type="button"
          id={`like-reel-${reel.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onLike?.(reel.id);
          }}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
          title="Like reel"
        >
          <div
            className={`p-2.5 rounded-full backdrop-blur-md transition group-hover:scale-110 active:scale-95 ${
              reel.isLiked ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40' : 'bg-black/60 group-hover:bg-black/80'
            }`}
          >
            <Heart className={`w-5 h-5 ${reel.isLiked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[10px] font-bold text-gray-200">{reel.likesCount}</span>
        </button>

        {/* 2. Comment Button */}
        <button
          type="button"
          id={`comment-reel-${reel.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments?.(reel);
          }}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
          title="Comment on reel"
        >
          <div className="p-2.5 rounded-full bg-black/60 backdrop-blur-md group-hover:bg-black/80 transition group-hover:scale-110 active:scale-95">
            <MessageCircle className="w-5 h-5 text-gray-200" />
          </div>
          <span className="text-[10px] font-bold text-gray-200">{reel.commentsCount}</span>
        </button>

        {/* 3. Share Button */}
        <button
          type="button"
          id={`share-reel-${reel.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onShare?.(reel);
          }}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
          title="Share reel"
        >
          <div className="p-2.5 rounded-full bg-black/60 backdrop-blur-md group-hover:bg-black/80 transition group-hover:scale-110 active:scale-95">
            <Share2 className="w-5 h-5 text-gray-200" />
          </div>
          <span className="text-[10px] font-bold text-gray-200">{reel.sharesCount}</span>
        </button>

        {/* 4. Save / Bookmark Button directly below Share button */}
        <button
          type="button"
          id={`save-reel-${reel.id}`}
          onClick={handleSaveToggle}
          className="flex flex-col items-center gap-1 text-white group cursor-pointer"
          title={isSaved ? 'Unsave Reel' : 'Save Reel'}
        >
          <div
            className={`p-2.5 rounded-full backdrop-blur-md transition group-hover:scale-110 active:scale-95 ${
              isSaved
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40'
                : 'bg-black/60 group-hover:bg-black/80'
            }`}
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current text-white' : 'text-amber-400'}`} />
          </div>
          <span className="text-[10px] font-bold text-gray-200">
            {savesCount}
          </span>
        </button>
      </div>

      {/* Bottom Information Overlay (Author, Caption, Remix) */}
      <div className="absolute inset-x-0 bottom-0 p-4 z-20 space-y-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        {isInlineEditing ? (
          <form onSubmit={handleInlineSave} className="space-y-2 bg-black/90 p-3 rounded-2xl border border-purple-500">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-1.5 text-xs text-white"
              placeholder="Reel Title"
            />
            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-1.5 text-xs text-white resize-none"
              placeholder="Caption and tags..."
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsInlineEditing(false)}
                className="px-2.5 py-1 bg-gray-800 text-xs text-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-purple-600 text-xs text-white font-bold rounded flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Save
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Author Info */}
            <div className="flex items-center gap-2.5">
              <img
                src={reel.author.avatar}
                alt={reel.author.name}
                className="w-9 h-9 rounded-full object-cover border-2 border-purple-500 shadow-md"
              />
              <div className="min-w-0 pr-16">
                <div className="flex items-center gap-1">
                  <h4 className="text-xs font-bold text-white truncate">{reel.author.name}</h4>
                  {reel.author.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                </div>
                <p className="text-[10px] text-teal-300 font-mono">@{reel.author.username}</p>
              </div>
            </div>

            {/* Reel Title & Caption */}
            <div className="pr-16 space-y-0.5">
              <h3 className="text-sm font-bold text-white line-clamp-1">{reel.title}</h3>
              <p className="text-xs text-gray-300 line-clamp-2 leading-tight">{reel.caption}</p>
            </div>

            {/* Audio Track Badge */}
            {reel.musicTrack && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLicenseModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-[10px] text-purple-300 hover:text-teal-300 font-mono bg-black/40 hover:bg-black/70 px-2.5 py-1 rounded-full border border-purple-500/30 transition cursor-pointer shrink-0 max-w-[85%]"
                title="View music license terms & rights certificate"
              >
                <Music className="w-3 h-3 text-teal-400 animate-spin shrink-0" />
                <span className="truncate">{reel.musicTrack}</span>
                <ShieldCheck className="w-3 h-3 text-teal-400 shrink-0 ml-0.5" />
              </button>
            )}

            {/* Remix Prompt Button */}
            {reel.promptUsed && onRemixPrompt && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemixPrompt(reel.promptUsed!);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-md shadow-lg transition active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                  <span>✨ Remix AI Prompt</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Audio License Certificate Modal */}
      {isLicenseModalOpen && resolvedAudioTrack && (
        <AudioLicenseInfoModal
          isOpen={isLicenseModalOpen}
          track={resolvedAudioTrack}
          onClose={() => setIsLicenseModalOpen(false)}
        />
      )}
    </div>
  );
};

export default ReelCard;
