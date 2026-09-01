import React, { useState, useEffect } from 'react';
import {
  Film,
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  Plus,
  Play,
  Volume2,
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
} from 'lucide-react';
import { ReelHighlight, UserProfile } from '../types/community';
import { AudioTrack } from '../types/audio';
import {
  getReelHighlights,
  saveReelHighlights,
  incrementReelShares,
  deleteReelHighlight,
  editReelHighlight,
} from '../utils/socialStore';
import { getAudioTracks } from '../utils/audioStore';
import { isContentOwner } from '../utils/communityStore';
import { toggleSaveReel, isReelSaved } from '../utils/bookmarkStore';
import { executeNativeShare, SharePayload } from '../utils/shareUtils';
import SocialShareModal from './SocialShareModal';
import ConfirmActionModal from './ConfirmActionModal';
import AudioLicenseInfoModal from './AudioLicenseInfoModal';

interface ReelsFeedViewProps {
  reels: ReelHighlight[];
  onUpdateReels: (reels: ReelHighlight[]) => void;
  userProfile: UserProfile;
  onRemixPrompt: (prompt: string) => void;
  onCreateReelClick: () => void;
}

export const ReelsFeedView: React.FC<ReelsFeedViewProps> = ({
  reels,
  onUpdateReels,
  userProfile,
  onRemixPrompt,
  onCreateReelClick,
}) => {
  const [activeSharePayload, setActiveSharePayload] = useState<SharePayload | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingReelId, setSharingReelId] = useState<string | null>(null);

  // Reel CRUD & Context Menu State
  const [activeReelMenuId, setActiveReelMenuId] = useState<string | null>(null);
  const [editingReel, setEditingReel] = useState<ReelHighlight | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingCaption, setEditingCaption] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [inspectingAudioTrack, setInspectingAudioTrack] = useState<AudioTrack | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

  const handleStartEditReel = (reel: ReelHighlight) => {
    setEditingReel(reel);
    setEditingTitle(reel.title);
    setEditingCaption(reel.caption);
    setActiveReelMenuId(null);
  };

  const handleSaveReelEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReel) return;
    const updated = editReelHighlight(editingReel.id, {
      title: editingTitle.trim() || editingReel.title,
      caption: editingCaption.trim() || editingReel.caption,
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
        const updated = deleteReelHighlight(reelId);
        onUpdateReels(updated);
        setActiveReelMenuId(null);
        showToast('Reel deleted successfully');
      },
    });
  };

  const handleLike = (id: string) => {
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
    onUpdateReels(res.updatedReels);
    showToast(res.isSaved ? 'Saved reel to your bookmarks!' : 'Removed reel from bookmarks');
  };

  const handleShareReel = async (reel: ReelHighlight) => {
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
    <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 py-4 space-y-6">
      <div className="flex items-center justify-between bg-gray-900/80 p-3 rounded-2xl border border-gray-800 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white">90s AI Creation Reels</h3>
        </div>

        <button
          type="button"
          onClick={onCreateReelClick}
          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-md transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Post Reel</span>
        </button>
      </div>

      {/* Vertical Reels Stack */}
      <div className="space-y-6">
        {reels.map((reel) => (
          <div
            key={reel.id}
            className="relative rounded-3xl overflow-hidden bg-black border border-gray-800 shadow-2xl aspect-[9/16] flex flex-col justify-between p-4"
          >
            {/* Video Background */}
            <video
              src={reel.videoSrc}
              poster={reel.thumbnailSrc}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

            {/* Top Bar */}
            <div className="relative z-10 flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-black/60 rounded-full font-bold text-teal-300 border border-white/10 backdrop-blur-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-teal-400" />
                  {reel.duration}s Reel
                </span>
              </div>

              {/* Reel Action Context Menu */}
              <div className="relative" data-menu-root="true">
                <button
                  type="button"
                  id={`reel-menu-btn-${reel.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveReelMenuId((prev) => (prev === reel.id ? null : reel.id));
                  }}
                  className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/10 backdrop-blur-md transition"
                  title="Reel options"
                  aria-label="Reel options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {activeReelMenuId === reel.id && (
                  <div
                    id={`reel-menu-dropdown-${reel.id}`}
                    className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-30 animate-scaleUp text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 1. Save Reel / Unsave Reel at top */}
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

                    {/* 2. Copy Link */}
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

                    {/* 3. Author Actions vs Non-Author */}
                    {isContentOwner(reel.author.id, userProfile.id) ? (
                      <>
                        <div className="h-px bg-slate-100 my-1" />
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

            {/* Bottom Info & Right Actions */}
            <div className="relative z-10 flex items-end justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={reel.author.avatar}
                    alt={reel.author.name}
                    className="w-8 h-8 rounded-full border border-white/20 object-cover"
                  />
                  <span className="font-bold text-white text-xs">@{reel.author.username}</span>
                </div>

                <h4 className="text-sm font-extrabold text-white leading-tight drop-shadow-md">
                  {reel.title}
                </h4>
                <p className="text-xs text-gray-200 line-clamp-2 leading-relaxed drop-shadow">
                  {reel.caption}
                </p>

                {/* Audio Track Badge */}
                {reel.musicTrack && (
                  <button
                    type="button"
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
                    className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-teal-300 font-mono bg-black/50 hover:bg-black/80 px-2.5 py-1 rounded-full border border-purple-500/30 transition cursor-pointer max-w-full truncate"
                    title="Inspect audio license & rights certificate"
                  >
                    <Music className="w-3 h-3 text-teal-400 shrink-0" />
                    <span className="truncate">{reel.musicTrack}</span>
                    <ShieldCheck className="w-3 h-3 text-teal-400 shrink-0 ml-0.5" />
                  </button>
                )}

                {reel.promptUsed && (
                  <button
                    type="button"
                    onClick={() => onRemixPrompt(reel.promptUsed || '')}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Repeat className="w-3 h-3" />
                    <span>Remix Prompt</span>
                  </button>
                )}
              </div>

              {/* Right Action Icons (Like, Comment, Share, Save/Bookmark) */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleLike(reel.id)}
                  className="flex flex-col items-center gap-1 text-white group cursor-pointer"
                >
                  <div
                    className={`p-2.5 rounded-full backdrop-blur-md transition ${
                      reel.isLiked ? 'bg-rose-600/90 text-white' : 'bg-black/60 group-hover:bg-black/80'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${reel.isLiked ? 'fill-current' : ''}`} />
                  </div>
                  <span className="text-[10px] font-bold">{reel.likesCount}</span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center gap-1 text-white group cursor-pointer"
                >
                  <div className="p-2.5 rounded-full bg-black/60 group-hover:bg-black/80 backdrop-blur-md transition">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold">{reel.commentsCount}</span>
                </button>

                {/* Share Button */}
                <button
                  type="button"
                  id={`share-reel-${reel.id}`}
                  onClick={() => handleShareReel(reel)}
                  className="flex flex-col items-center gap-1 text-white group cursor-pointer"
                  title="Share Reel to Social Media"
                >
                  <div className="p-2.5 rounded-full bg-black/60 group-hover:bg-black/80 backdrop-blur-md transition group-hover:scale-105 active:scale-95">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold">{reel.sharesCount}</span>
                </button>

                {/* Save / Bookmark Button directly below Share button */}
                <button
                  type="button"
                  id={`save-reel-btn-${reel.id}`}
                  onClick={() => handleToggleSaveReel(reel.id)}
                  className="flex flex-col items-center gap-1 text-white group cursor-pointer"
                  title={reel.isSaved ? 'Unsave Reel' : 'Save Reel'}
                >
                  <div
                    className={`p-2.5 rounded-full backdrop-blur-md transition group-hover:scale-105 active:scale-95 ${
                      reel.isSaved ? 'bg-amber-500 text-white shadow-md shadow-amber-500/40' : 'bg-black/60 group-hover:bg-black/80'
                    }`}
                  >
                    <Bookmark className={`w-5 h-5 ${reel.isSaved ? 'fill-current text-white' : 'text-amber-400'}`} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-200">
                    {reel.savesCount ?? (reel.id === 'reel_2' ? 245 : 128)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SocialShareModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setActiveSharePayload(null);
          setSharingReelId(null);
        }}
        payload={activeSharePayload}
        onSharePerformed={() => {
          if (sharingReelId) {
            const updated = incrementReelShares(sharingReelId);
            onUpdateReels(updated);
          }
        }}
      />

      {/* Edit Reel Modal */}
      {editingReel && (
        <div
          onClick={() => setEditingReel(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
        >
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp"
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
        <ConfirmActionModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel="Delete Reel"
          isDestructive={true}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Audio License Certificate Modal */}
      {inspectingAudioTrack && (
        <AudioLicenseInfoModal
          isOpen={!!inspectingAudioTrack}
          track={inspectingAudioTrack}
          onClose={() => setInspectingAudioTrack(null)}
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

export default ReelsFeedView;
