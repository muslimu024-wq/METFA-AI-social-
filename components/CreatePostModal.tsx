import React, { useState } from 'react';
import { Plus, X, UploadCloud, Sparkles, Check, Layers } from 'lucide-react';
import { CommunityPost, UserProfile } from '../types/community';
import { getPages, getGroups } from '../utils/socialStore';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onPostCreated: (post: Omit<CommunityPost, 'id' | 'likesCount' | 'remixCount' | 'commentsCount' | 'sharesCount' | 'createdAt' | 'comments'>) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onPostCreated,
}) => {
  const [prompt, setPrompt] = useState('');
  const [caption, setCaption] = useState('');
  const [stylePreset, setStylePreset] = useState('Cyberpunk 2088');
  const [imageSrc, setImageSrc] = useState('https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1000');
  const [selectedIdentity, setSelectedIdentity] = useState('personal');

  if (!isOpen) return null;

  const pages = getPages();
  const groups = getGroups();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!prompt.trim() || !imageSrc) return;

    let pageId: string | undefined;
    let pageName: string | undefined;
    let groupId: string | undefined;
    let groupName: string | undefined;

    if (selectedIdentity.startsWith('page_')) {
      const page = pages.find((p) => p.id === selectedIdentity);
      if (page) {
        pageId = page.id;
        pageName = page.name;
      }
    } else if (selectedIdentity.startsWith('group_')) {
      const group = groups.find((g) => g.id === selectedIdentity);
      if (group) {
        groupId = group.id;
        groupName = group.name;
      }
    }

    onPostCreated({
      author: {
        id: userProfile.id,
        name: userProfile.name,
        username: userProfile.username,
        avatar: userProfile.avatar,
        isVerified: userProfile.isVerified,
      },
      pageId,
      pageName,
      groupId,
      groupName,
      prompt: prompt.trim(),
      caption: caption.trim() || 'Created with Metfa AI Studio',
      stylePreset,
      imageSrc,
      tags: ['MetfaAI', stylePreset.replace(/\s+/g, '')],
      feedType: 'for_you',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-950 text-purple-300">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Community Post</h3>
              <p className="text-xs text-gray-400">Share your AI artwork or photo edit</p>
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

        {/* Form */}
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
          {/* Identity */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
              Posting As
            </label>
            <select
              value={selectedIdentity}
              onChange={(e) => setSelectedIdentity(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="personal">Personal Profile (@{userProfile.username})</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  Page: {p.name}
                </option>
              ))}
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Group: {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
              AI Prompt Used
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Ultra-realistic cybernetic samurai in neon rain, 8k resolution..."
              rows={2}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
              Caption
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Thoughts about this piece..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Image upload preview */}
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
              Artwork Image
            </label>
            <div className="flex items-center gap-3">
              <img
                src={imageSrc}
                alt="Preview"
                className="w-20 h-20 rounded-xl object-cover border border-gray-800 shrink-0"
              />
              <label className="flex-1 cursor-pointer py-3 px-4 bg-gray-950 hover:bg-gray-850 border border-dashed border-gray-700 rounded-xl flex items-center justify-center gap-2 text-xs text-gray-300 transition">
                <UploadCloud className="w-4 h-4 text-purple-400" />
                <span>Upload Custom Image</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-gray-800 mt-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Publish Post</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;
