import React, { useState } from 'react';
import {
  Film,
  X,
  Sparkles,
  Video,
  Music,
  ShieldCheck,
  Play,
  Pause,
  Trash2,
  Plus,
  Sliders,
  Volume2,
  VolumeX,
  Clock,
  Radio,
} from 'lucide-react';
import { ReelHighlight, UserProfile } from '../types/community';
import { AudioTrack, ReelAudioConfig } from '../types/audio';
import { addReelHighlight } from '../utils/socialStore';
import { recordTrackUsage, createOriginalSoundRecord } from '../utils/audioStore';
import { compressImageDataUrl } from '../utils/storageUtils';
import AudioTrackPickerModal from './AudioTrackPickerModal';
import AudioLicenseInfoModal from './AudioLicenseInfoModal';

interface CreateReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onReelCreated: (reel: ReelHighlight) => void;
}

export const CreateReelModal: React.FC<CreateReelModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onReelCreated,
}) => {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [promptUsed, setPromptUsed] = useState('');
  const [videoSrc, setVideoSrc] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
  const [thumbnailSrc, setThumbnailSrc] = useState('https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600');
  const [duration, setDuration] = useState(15);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null);

  // Audio Mixer & Alignment settings
  const [showAudioMixer, setShowAudioMixer] = useState(false);
  const [musicVolume, setMusicVolume] = useState(100);
  const [originalAudioVolume, setOriginalAudioVolume] = useState(100);
  const [audioStartTime, setAudioStartTime] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Modals for Audio selection & Rights inspector
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [isLicenseInfoOpen, setIsLicenseInfoOpen] = useState(false);

  if (!isOpen) return null;

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setVideoSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      const compressed = await compressImageDataUrl(raw, 600, 800, 0.7);
      setThumbnailSrc(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !caption.trim()) return;

    const compressedThumb = await compressImageDataUrl(thumbnailSrc, 600, 800, 0.7);
    const tempReelId = `reel_${Date.now()}`;

    let resolvedTrack = selectedAudioTrack;

    if (resolvedTrack) {
      recordTrackUsage(resolvedTrack.id);
    } else {
      // Auto-create Original Sound record from the user's video reel
      resolvedTrack = createOriginalSoundRecord({
        userId: userProfile.id,
        username: userProfile.username,
        userAvatar: userProfile.avatar,
        reelId: tempReelId,
        videoSrc,
        duration,
        title: `Original sound — @${userProfile.username.replace('@', '')}`,
      });
    }

    const musicTrackName = resolvedTrack
      ? `${resolvedTrack.title} • ${resolvedTrack.artist}`
      : `Original sound — @${userProfile.username.replace('@', '')}`;

    const audioConfig: ReelAudioConfig = {
      volume: musicVolume / 100,
      originalVolume: originalAudioVolume / 100,
      startTime: audioStartTime,
      duration: duration,
      fadeIn,
      fadeOut,
    };

    const newReel = addReelHighlight({
      title: title.trim() || 'AI Creation Reel',
      caption: caption.trim() || 'Created with Metfa Studio #AI',
      promptUsed: promptUsed.trim() || undefined,
      videoSrc,
      thumbnailSrc: compressedThumb,
      duration,
      isLiked: false,
      musicTrack: musicTrackName,
      audioTrack: resolvedTrack || undefined,
      author: {
        id: userProfile.id,
        name: userProfile.name,
        username: userProfile.username,
        avatar: userProfile.avatar,
        isVerified: userProfile.isVerified,
      },
    });

    onReelCreated(newReel);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-950 text-purple-300">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create AI Reel</h3>
                <p className="text-xs text-gray-400">Post short video highlights with licensed audio & original sounds</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 pt-3 flex-1">
            {/* Video Upload Box */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
                Upload Video Clip (MP4 / WebM)
              </label>
              <label className="border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-950/60 transition group">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                <Video className="w-7 h-7 text-purple-400 mb-1.5" />
                <span className="text-xs font-bold text-gray-300 group-hover:text-white">
                  Choose Video File
                </span>
                <span className="text-[10px] text-gray-500">Up to 90 seconds</span>
              </label>

              {/* Video preview */}
              <div className="mt-2.5 rounded-2xl overflow-hidden border border-gray-800 bg-black aspect-video flex items-center justify-center">
                <video src={videoSrc} controls className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Audio Soundtrack Picker Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-purple-400" />
                  <span>Audio Soundtrack</span>
                </label>
                <div className="flex items-center gap-2">
                  {selectedAudioTrack && (
                    <button
                      type="button"
                      onClick={() => setShowAudioMixer(!showAudioMixer)}
                      className={`text-[11px] font-bold transition flex items-center gap-1 ${
                        showAudioMixer ? 'text-purple-400' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Sliders className="w-3 h-3" />
                      <span>{showAudioMixer ? 'Hide Mixer' : 'Audio Mixer'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAudioPickerOpen(true)}
                    className="text-[11px] font-bold text-teal-400 hover:text-teal-300 transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{selectedAudioTrack ? 'Change Sound' : 'Add Sound'}</span>
                  </button>
                </div>
              </div>

              {selectedAudioTrack ? (
                <div className="p-3 bg-purple-950/30 border border-purple-500/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={selectedAudioTrack.cover_url}
                        alt={selectedAudioTrack.title}
                        className="w-10 h-10 rounded-xl object-cover border border-purple-500/30 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white truncate">{selectedAudioTrack.title}</h4>
                          {selectedAudioTrack.track_type === 'original' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-500/40 text-amber-300 text-[8px] font-bold">
                              ORIGINAL
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-purple-300 truncate font-mono">
                          {selectedAudioTrack.artist} • {selectedAudioTrack.genre}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsLicenseInfoOpen(true)}
                          className="text-[9px] text-teal-400 font-bold hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>{selectedAudioTrack.license_type}</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedAudioTrack(null)}
                      className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 transition shrink-0"
                      title="Remove soundtrack"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Audio Mixer Controls */}
                  {showAudioMixer && (
                    <div className="pt-2 border-t border-purple-500/20 space-y-2.5 text-xs">
                      {/* Music Volume */}
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                          <span className="flex items-center gap-1 font-bold">
                            <Volume2 className="w-3 h-3 text-purple-400" />
                            <span>Soundtrack Volume</span>
                          </span>
                          <span className="font-mono text-purple-300">{musicVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={musicVolume}
                          onChange={(e) => setMusicVolume(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>

                      {/* Original Video Volume */}
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                          <span className="flex items-center gap-1 font-bold">
                            <Volume2 className="w-3 h-3 text-teal-400" />
                            <span>Original Clip Audio</span>
                          </span>
                          <span className="font-mono text-teal-300">{originalAudioVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={originalAudioVolume}
                          onChange={(e) => setOriginalAudioVolume(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                        />
                      </div>

                      {/* Audio Trim / Start Time */}
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                          <span className="flex items-center gap-1 font-bold">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Audio Start Offset</span>
                          </span>
                          <span className="font-mono text-amber-300">{audioStartTime}s</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, (selectedAudioTrack.duration || 60) - duration)}
                          value={audioStartTime}
                          onChange={(e) => setAudioStartTime(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      {/* Fade in / Fade out */}
                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-300">
                          <input
                            type="checkbox"
                            checked={fadeIn}
                            onChange={(e) => setFadeIn(e.target.checked)}
                            className="rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                          />
                          <span>Fade In</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-300">
                          <input
                            type="checkbox"
                            checked={fadeOut}
                            onChange={(e) => setFadeOut(e.target.checked)}
                            className="rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                          />
                          <span>Fade Out</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAudioPickerOpen(true)}
                    className="w-full p-3 bg-gray-950 border border-gray-800 hover:border-purple-500/50 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:text-purple-300 transition text-xs font-medium"
                  >
                    <Music className="w-4 h-4 text-purple-400" />
                    <span>Add Sound (Royalty-Free, Licensed, SFX, or Saved)</span>
                  </button>
                  <p className="text-[10px] text-gray-500 text-center flex items-center justify-center gap-1">
                    <Radio className="w-3 h-3 text-amber-400" />
                    <span>Without music, your clip audio will be saved as "Original sound — @{userProfile.username.replace('@', '')}"</span>
                  </p>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
                Reel Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cyberpunk City Inpainting 10s"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Caption */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
                Caption & Tags
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="#MetfaAI #GenerativeVision #Reels"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Prompt */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
                AI Prompt Used (Optional)
              </label>
              <textarea
                value={promptUsed}
                onChange={(e) => setPromptUsed(e.target.value)}
                placeholder="The prompt used to create this scene..."
                rows={2}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Publish Reel</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Audio Track Picker Modal */}
      <AudioTrackPickerModal
        isOpen={isAudioPickerOpen}
        onClose={() => setIsAudioPickerOpen(false)}
        onSelectTrack={(track) => setSelectedAudioTrack(track)}
        selectedTrackId={selectedAudioTrack?.id}
        userProfile={userProfile}
      />

      {/* Audio License Certificate Modal */}
      {selectedAudioTrack && isLicenseInfoOpen && (
        <AudioLicenseInfoModal
          isOpen={isLicenseInfoOpen}
          track={selectedAudioTrack}
          onClose={() => setIsLicenseInfoOpen(false)}
        />
      )}
    </>
  );
};

export default CreateReelModal;
