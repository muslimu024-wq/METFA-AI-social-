import React, { useState, useEffect } from 'react';
import { X, Check, Hash, Sparkles, Image as ImageIcon, Video, Type, Palette } from 'lucide-react';
import { CommunityPost } from '../types/community';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: CommunityPost | null;
  onSave: (updatedPost: CommunityPost) => void;
}

const GRADIENT_OPTIONS = [
  { id: 'none', label: 'Default', class: 'bg-slate-100 border border-slate-200 text-slate-900' },
  { id: 'sunset', label: 'Sunset Glow', class: 'bg-gradient-to-tr from-amber-600 via-rose-600 to-purple-800 text-white' },
  { id: 'cyberpunk', label: 'Cyberpunk', class: 'bg-gradient-to-tr from-purple-900 via-indigo-900 to-cyan-700 text-white' },
  { id: 'midnight', label: 'Midnight Neon', class: 'bg-gradient-to-tr from-slate-900 via-purple-950 to-indigo-950 text-purple-100' },
  { id: 'emerald', label: 'Emerald Dream', class: 'bg-gradient-to-tr from-teal-900 via-emerald-800 to-cyan-900 text-teal-100' },
  { id: 'fire', label: 'Solar Flame', class: 'bg-gradient-to-tr from-red-700 via-orange-600 to-amber-500 text-white' },
];

export const EditPostModal: React.FC<EditPostModalProps> = ({
  isOpen,
  onClose,
  post,
  onSave,
}) => {
  const [caption, setCaption] = useState('');
  const [prompt, setPrompt] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [textBackgroundPreset, setTextBackgroundPreset] = useState<string | undefined>(undefined);
  const [stylePreset, setStylePreset] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (post) {
      setCaption(post.caption || '');
      setPrompt(post.prompt || '');
      setTags(post.tags || []);
      setTextBackgroundPreset(post.textBackgroundPreset);
      setStylePreset(post.stylePreset);
    }
  }, [post]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const handleAddTag = () => {
    const cleanTag = tagInput.replace(/^#/, '').trim();
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags([...tags, cleanTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = () => {
    const updatedPost: CommunityPost = {
      ...post,
      caption: caption.trim(),
      prompt: prompt.trim() || caption.trim(),
      tags,
      textBackgroundPreset: textBackgroundPreset === 'none' ? undefined : textBackgroundPreset,
      stylePreset,
    };
    onSave(updatedPost);
    onClose();
  };

  const isGradientPost = !!post.textBackgroundPreset;

  return (
    <div
      id="edit-post-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="edit-post-modal-dialog"
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-thin animate-scaleUp text-slate-900"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 border border-purple-200">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Edit Post</h3>
              <p className="text-[11px] text-slate-500 font-medium">Update your post text, prompt recipe, or tags</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Media Preview Thumbnail if image or video exists */}
        {post.imageSrc && (
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-48 flex items-center justify-center">
            <img
              src={post.imageSrc}
              alt="Post preview"
              className="w-full h-48 object-cover opacity-90"
            />
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-teal-300 border border-white/10 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              <span>Media Post</span>
            </div>
          </div>
        )}

        {post.videoSrc && (
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-h-44 flex items-center justify-center">
            <video
              src={post.videoSrc}
              className="w-full h-44 object-cover"
              controls
            />
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-purple-300 border border-white/10 flex items-center gap-1">
              <Video className="w-3 h-3" />
              <span>Video</span>
            </div>
          </div>
        )}

        {isGradientPost && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              <span>Background Style</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GRADIENT_OPTIONS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setTextBackgroundPreset(g.id)}
                  className={`h-10 rounded-xl p-1.5 text-[10px] font-bold flex items-center justify-center text-center transition border ${
                    (textBackgroundPreset || 'none') === g.id
                      ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-md scale-[1.02]'
                      : 'border-slate-200 opacity-75 hover:opacity-100'
                  } ${g.class}`}
                >
                  <span className="truncate">{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Post Caption / Text */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-purple-600" />
              <span>Caption & Content</span>
            </label>
            <span className="text-[10px] text-slate-500 font-mono">{caption.length} chars</span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="Share your thoughts, story, or description..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white resize-none transition"
          />
        </div>

        {/* AI Recipe / Prompt (if applicable) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>AI Recipe / Creative Prompt</span>
          </label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="AI prompt used to render this artwork..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition"
          />
        </div>

        {/* Tags / Hashtags */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-purple-600" />
            <span>Tags & Categories</span>
          </label>

          <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 bg-slate-50 rounded-xl border border-slate-200">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-[11px] font-medium flex items-center gap-1"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-purple-900 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {tags.length === 0 && (
              <span className="text-[11px] text-slate-400 italic p-1">No tags attached</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag (e.g. Cyberpunk, 8K, ConceptArt)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={handleAddTag}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95 border border-slate-200"
            >
              Add
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPostModal;
