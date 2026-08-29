import React, { useState } from 'react';
import { Film, X, UploadCloud, Sparkles, Plus, Play, Video } from 'lucide-react';
import { ReelHighlight, UserProfile } from '../types/community';
import { addReelHighlight } from '../utils/socialStore';
import { compressImageDataUrl } from '../utils/storageUtils';

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

    const newReel = addReelHighlight({
      title: title.trim() || 'AI Creation Reel',
      caption: caption.trim() || 'Created with Metfa Studio #AI',
      promptUsed: promptUsed.trim() || undefined,
      videoSrc,
      thumbnailSrc: compressedThumb,
      duration,
      isLiked: false,
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-950 text-purple-300">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create AI Reel</h3>
              <p className="text-xs text-gray-400">Post short video highlights or time-lapses</p>
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

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
          <div className="pt-2 flex items-center justify-end gap-2">
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
  );
};

export default CreateReelModal;
