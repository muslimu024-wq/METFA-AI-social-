import React, { useState } from 'react';
import { Users, X, Check, Lock, Globe } from 'lucide-react';
import { SocialGroup, UserProfile } from '../types/community';
import { createSocialGroup } from '../utils/socialStore';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onGroupCreated?: (group: SocialGroup) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onGroupCreated,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('AI Vision & Restoration');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;

    const handle = `@${name.toLowerCase().replace(/\s+/g, '')}`;

    const newGroup = createSocialGroup({
      ownerId: userProfile.id,
      name: name.trim(),
      handle,
      description: description.trim() || 'Community hub for creative AI enthusiasts',
      category,
      privacy,
      avatar,
      coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000',
      rules: ['Respect fellow creators', 'Credit original prompt authors', 'No spam'],
    });

    onGroupCreated?.(newGroup);
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
            <div className="p-2 rounded-xl bg-teal-950 text-teal-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Community Group</h3>
              <p className="text-xs text-gray-400">Build a circle for prompt engineering & tips</p>
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
              Group Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Inpainting & Image Fusion Guild"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1 uppercase tracking-wider">
              Privacy Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPrivacy('public')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  privacy === 'public'
                    ? 'bg-teal-950 text-teal-300 border-teal-500/50'
                    : 'bg-gray-950 text-gray-400 border-gray-800'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Public Group</span>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy('private')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  privacy === 'private'
                    ? 'bg-teal-950 text-teal-300 border-teal-500/50'
                    : 'bg-gray-950 text-gray-400 border-gray-800'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Private Group</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-300 block mb-1 uppercase tracking-wider">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              <option value="AI Vision & Restoration">AI Vision & Restoration</option>
              <option value="Prompt Engineering">Prompt Engineering</option>
              <option value="3D Rendering & VFX">3D Rendering & VFX</option>
              <option value="Character Design & Anime">Character Design & Anime</option>
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
              placeholder="What is this community group about?"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-800 mt-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-3 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/30 transition flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Create Group</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
