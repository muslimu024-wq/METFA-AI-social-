import React, { useState, useEffect } from 'react';
import { X, Check, Hash, Sparkles, Image as ImageIcon, Video, Type, Palette, Maximize2, Minimize2 } from 'lucide-react';
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
  const [isFullscreen, setIsFullscreen] = useState(true);

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
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-white text-slate-900 w-full h-full overflow-hidden animate-fadeIn'
          : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn'
      }
      onClick={(e) => {
        if (!isFullscreen && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="edit-post-modal-dialog"
        role="dialog"
        aria-modal="true"
        className={
          isFullscreen
            ? 'flex-1 flex flex-col w-full h-full overflow-hidden bg-white text-slate-900'
            : 'w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto scrollbar-thin animate-scaleUp text-slate-900'
        }
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">Edit Post</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  Full-Screen Editor
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Update your post content, AI recipe, or tags without clutter</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
              title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Editor Body */}
        <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-6 space-y-6 scrollbar-thin">
          {/* Media Preview Thumbnail if image or video exists */}
          {post.imageSrc && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-56 flex items-center justify-center">
              <img
                src={post.imageSrc}
                alt="Post preview"
                className="w-full h-56 object-cover opacity-95"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-bold text-teal-300 border border-white/10 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Media Post</span>
              </div>
            </div>
          )}

          {post.videoSrc && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-h-56 flex items-center justify-center">
              <video
                src={post.videoSrc}
                className="w-full h-56 object-cover"
                controls
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-bold text-purple-300 border border-white/10 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" />
                <span>Video Post</span>
              </div>
            </div>
          )}

          {isGradientPost && (
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-600" />
                <span>Background Style Preset</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {GRADIENT_OPTIONS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setTextBackgroundPreset(g.id)}
                    className={`h-12 rounded-xl p-2 text-xs font-bold flex items-center justify-center text-center transition border cursor-pointer ${
                      (textBackgroundPreset || 'none') === g.id
                        ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-md scale-[1.02]'
                        : 'border-slate-200 opacity-80 hover:opacity-100'
                    } ${g.class}`}
                  >
                    <span className="truncate">{g.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Post Caption / Text (Spacious Full View) */}
          <div className="space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2">
                <Type className="w-4 h-4 text-purple-600" />
                <span>Caption & Content</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">{caption.length} characters</span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                  {caption.trim().length > 0 ? `${caption.trim().split(/\s+/).length} words` : '0 words'}
                </span>
              </div>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={10}
              placeholder="Share your thoughts, story, or description in detail..."
              className="w-full min-h-[260px] sm:min-h-[340px] bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/20 resize-y leading-relaxed font-normal shadow-2xs transition"
              autoFocus
            />
            <p className="text-[11px] text-slate-400">
              Full-Screen View • Ample space to read, correct typos, check spellings, and edit comfortably
            </p>
          </div>

          {/* AI Recipe / Prompt (if applicable) */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>AI Recipe / Creative Prompt</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="AI prompt used to render this artwork..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition resize-y font-mono"
            />
          </div>

          {/* Tags / Hashtags */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2">
              <Hash className="w-4 h-4 text-purple-600" />
              <span>Tags & Categories</span>
            </label>

            <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-purple-900 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}

              {tags.length === 0 && (
                <span className="text-xs text-slate-400 italic p-1">No tags attached</span>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 border border-slate-200 cursor-pointer"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="py-3.5 px-4 sm:px-8 border-t border-slate-100 shrink-0 flex items-center justify-between bg-white">
          <span className="text-xs text-slate-500 hidden sm:inline-block">
            Review changes and click save when ready
          </span>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPostModal;
