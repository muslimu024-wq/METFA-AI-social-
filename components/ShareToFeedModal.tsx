import React, { useState } from 'react';
import { Share2, X, Sparkles, Wand2, Check } from 'lucide-react';
import { CommunityPost, PostingIdentity, UserProfile } from '../types/community';
import { getPages, getGroups } from '../utils/socialStore';
import { generateSocialCaptionAndHashtags } from '../services/geminiService';

interface ShareToFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  postData: {
    prompt: string;
    imageSrc: string;
    stylePreset?: string;
  };
  userProfile: UserProfile;
  onPostCreated: (post: Omit<CommunityPost, 'id' | 'likesCount' | 'remixCount' | 'commentsCount' | 'sharesCount' | 'createdAt' | 'comments'>) => void;
}

export const ShareToFeedModal: React.FC<ShareToFeedModalProps> = ({
  isOpen,
  onClose,
  postData,
  userProfile,
  onPostCreated,
}) => {
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('MetfaAI, DigitalArt, GeminiVision');
  const [selectedIdentity, setSelectedIdentity] = useState<'personal' | string>('personal');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  if (!isOpen) return null;

  const pages = getPages();
  const groups = getGroups();

  const handleGenerateCaption = async () => {
    try {
      setIsGeneratingCaption(true);
      const generated = await generateSocialCaptionAndHashtags(postData.prompt);
      if (generated) {
        setCaption(generated);
      }
    } catch (err) {
      console.error('Failed to generate caption:', err);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleSubmit = () => {
    let postingIdentity: PostingIdentity = {
      type: 'personal',
      id: userProfile.id,
      name: userProfile.name,
      username: userProfile.username,
      avatar: userProfile.avatar,
    };

    let pageId: string | undefined;
    let pageName: string | undefined;
    let groupId: string | undefined;
    let groupName: string | undefined;

    if (selectedIdentity.startsWith('page_')) {
      const page = pages.find((p) => p.id === selectedIdentity);
      if (page) {
        postingIdentity = {
          type: 'page',
          id: page.id,
          name: page.name,
          username: page.username,
          avatar: page.avatar,
          badge: 'Official Page',
        };
        pageId = page.id;
        pageName = page.name;
      }
    } else if (selectedIdentity.startsWith('group_')) {
      const group = groups.find((g) => g.id === selectedIdentity);
      if (group) {
        postingIdentity = {
          type: 'group',
          id: group.id,
          name: group.name,
          username: group.handle,
          avatar: group.avatar,
          badge: 'Group Share',
        };
        groupId = group.id;
        groupName = group.name;
      }
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    onPostCreated({
      author: {
        id: userProfile.id,
        name: userProfile.name,
        username: userProfile.username,
        avatar: userProfile.avatar,
        isVerified: userProfile.isVerified,
      },
      postingIdentity,
      pageId,
      pageName,
      groupId,
      groupName,
      prompt: postData.prompt,
      caption: caption.trim() || 'Created with Metfa AI Studio.',
      stylePreset: postData.stylePreset,
      imageSrc: postData.imageSrc,
      tags: tags.length > 0 ? tags : ['MetfaAI', 'GeminiVision'],
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
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Share to Community Feed</h3>
              <p className="text-xs text-gray-400">Publish your artwork across Metfa</p>
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

        {/* Preview image */}
        <div className="mb-4 rounded-2xl overflow-hidden bg-gray-950 border border-gray-800 max-h-48 flex items-center justify-center">
          <img src={postData.imageSrc} alt="Preview" className="max-h-48 w-auto object-cover" />
        </div>

        {/* Identity Selector */}
        <div className="mb-4">
          <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
            Post As
          </label>
          <select
            value={selectedIdentity}
            onChange={(e) => setSelectedIdentity(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
          >
            <option value="personal">Personal Profile (@{userProfile.username})</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                Page: {p.name} (@{p.username})
              </option>
            ))}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                Group: {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Caption with AI Generate button */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Caption</label>
            <button
              type="button"
              disabled={isGeneratingCaption}
              onClick={handleGenerateCaption}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
            >
              <Wand2 className={`w-3 h-3 ${isGeneratingCaption ? 'animate-spin' : ''}`} />
              <span>{isGeneratingCaption ? 'Generating...' : 'AI Caption'}</span>
            </button>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a description or thoughts about your scene..."
            rows={2}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        {/* Tags */}
        <div className="mb-6">
          <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          <span>Publish Creation</span>
        </button>
      </div>
    </div>
  );
};

export default ShareToFeedModal;
