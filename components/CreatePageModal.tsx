import React, { useState } from 'react';
import { FileText, X, Check, UploadCloud } from 'lucide-react';
import { SocialPage, UserProfile } from '../types/community';
import { createSocialPage } from '../utils/socialStore';

interface CreatePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onPageCreated?: (page: SocialPage) => void;
}

export const CreatePageModal: React.FC<CreatePageModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onPageCreated,
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [category, setCategory] = useState('Technology & AI');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;

    const cleanUsername = (username.trim() || name.toLowerCase().replace(/\s+/g, '.')).replace(/^@/, '');

    const newPage = createSocialPage({
      ownerId: userProfile.id,
      name: name.trim(),
      username: cleanUsername,
      handle: `@${cleanUsername}`,
      description: description.trim() || 'Official Metfa Creator Studio Page',
      category,
      avatar,
      coverImage: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1000',
      isVerified: true,
      tags: ['AIStudio', category.replace(/\s+/g, '')],
    });

    onPageCreated?.(newPage);
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
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Creator Page</h3>
              <p className="text-xs text-gray-400">Launch a specialized brand or studio</p>
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

        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1 uppercase tracking-wider">
              Page Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cyberpunk Concept Lab"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1 uppercase tracking-wider">
              Handle / Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-gray-500">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cyberpunk.lab"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1 uppercase tracking-wider">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="Technology & AI">Technology & AI</option>
              <option value="Digital Art & Design">Digital Art & Design</option>
              <option value="Gaming & Concept Art">Gaming & Concept Art</option>
              <option value="Photography & Restoration">Photography & Restoration</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does your studio specialize in?"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-800 mt-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Launch Page</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePageModal;
