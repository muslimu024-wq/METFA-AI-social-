import React, { useState } from 'react';
import {
  Plus,
  X,
  UploadCloud,
  Sparkles,
  Check,
  Layers,
  Film,
  Image as ImageIcon,
  Video,
  Type,
  Palette,
  Wand2,
  Trash2,
  HelpCircle,
  Hash,
  Smile
} from 'lucide-react';
import { CommunityPost, UserProfile } from '../types/community';
import { getPages, getGroups } from '../utils/socialStore';
import { generateAICaptionAndHashtags, refineTextWithAI } from '../services/aiAssistantService';
import { saveMediaItem, fileToBase64 } from '../utils/mediaStorage';
import { compressImageDataUrl } from '../utils/storageUtils';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onPostCreated: (
    post: Omit<CommunityPost, 'id' | 'likesCount' | 'remixCount' | 'commentsCount' | 'sharesCount' | 'createdAt' | 'comments'>
  ) => void;
}

export const TEXT_GRADIENTS = [
  { id: 'none', label: 'Default', bgClass: 'bg-gray-950 border border-gray-800 text-white' },
  { id: 'sunset', label: 'Sunset Glow', bgClass: 'bg-gradient-to-tr from-amber-600 via-rose-600 to-purple-800 text-white shadow-lg' },
  { id: 'cyberpunk', label: 'Cyberpunk', bgClass: 'bg-gradient-to-tr from-purple-900 via-indigo-900 to-cyan-700 text-white shadow-lg' },
  { id: 'midnight', label: 'Midnight Neon', bgClass: 'bg-gradient-to-tr from-slate-900 via-purple-950 to-indigo-950 text-purple-100 border border-purple-800/60' },
  { id: 'emerald', label: 'Emerald Dream', bgClass: 'bg-gradient-to-tr from-teal-900 via-emerald-800 to-cyan-900 text-teal-100' },
  { id: 'fire', label: 'Solar Flame', bgClass: 'bg-gradient-to-tr from-red-700 via-orange-600 to-amber-500 text-white shadow-lg' },
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onPostCreated,
}) => {
  const [postMode, setPostMode] = useState<'text' | 'media'>('text');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedGradient, setSelectedGradient] = useState('none');
  const [mediaGallery, setMediaGallery] = useState<string[]>([]);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [selectedIdentity, setSelectedIdentity] = useState('personal');
  const [stylePreset, setStylePreset] = useState('Cyberpunk 2088');

  // AI Assistant States
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiTone, setAiTone] = useState<'Creative' | 'Casual' | 'Professional' | 'Hype'>('Creative');
  const [aiLanguage, setAiLanguage] = useState<'auto' | 'bengali' | 'english'>('auto');
  const [aiGeneratedTags, setAiGeneratedTags] = useState<string[]>([]);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const pages = getPages();
  const groups = getGroups();

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video');
      const rawBase64 = await fileToBase64(file);
      const base64 = isVideo ? rawBase64 : await compressImageDataUrl(rawBase64, 900, 900, 0.75);

      // Save media to persistent IndexedDB
      await saveMediaItem({
        userId: userProfile.id,
        type: isVideo ? 'video' : 'image',
        dataUrl: base64,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
      });

      if (isVideo) {
        setMediaType('video');
        setVideoSrc(base64);
        setPostMode('media');
        break; // Only 1 video per post
      } else {
        setMediaType('image');
        setMediaGallery((prev) => [...prev, base64]);
        setPostMode('media');
      }
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaGallery((prev) => prev.filter((_, idx) => idx !== index));
    if (mediaGallery.length <= 1 && !videoSrc) {
      setPostMode('text');
    }
  };

  // 1. AI Magic Caption & Hashtags Generation
  const handleGenerateAICaption = async () => {
    setIsGeneratingAI(true);
    setAiStatusMessage('✨ Background AI is crafting caption & trending hashtags...');
    try {
      const firstImage = mediaGallery[0] || undefined;
      const result = await generateAICaptionAndHashtags({
        userInput: caption || prompt,
        imageBase64: firstImage,
        language: aiLanguage,
        tone: aiTone,
      });

      if (result.caption) {
        setCaption(result.caption);
      }
      if (result.hashtags && result.hashtags.length > 0) {
        setAiGeneratedTags(result.hashtags);
      }
      setAiStatusMessage(`Generated with ${result.modelUsed || 'Metfa Social'}`);
    } catch (err) {
      console.warn('AI Caption generation error:', err);
    } finally {
      setIsGeneratingAI(false);
      setTimeout(() => setAiStatusMessage(null), 4000);
    }
  };

  // 2. AI Text Refinement
  const handleRefineText = async (mode: 'fix_grammar' | 'expand' | 'tone') => {
    if (!caption.trim()) return;
    setIsGeneratingAI(true);
    setAiStatusMessage(`✨ Refining text (${mode})...`);
    try {
      const result = await refineTextWithAI({
        text: caption,
        mode,
        tone: aiTone,
      });

      if (result.refinedText) {
        setCaption(result.refinedText);
      }
      setAiStatusMessage('Text successfully refined!');
    } catch (err) {
      console.warn('AI Text Refine error:', err);
    } finally {
      setIsGeneratingAI(false);
      setTimeout(() => setAiStatusMessage(null), 3000);
    }
  };

  const handleAddHashtag = (tag: string) => {
    const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
    if (!caption.includes(cleanTag)) {
      setCaption((prev) => `${prev.trim()} ${cleanTag}`.trim());
    }
  };

  const handleSubmit = () => {
    if (!caption.trim() && mediaGallery.length === 0 && !videoSrc && !prompt.trim()) return;

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

    const primaryImage = mediaGallery[0] || (postMode === 'media' ? 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1000' : undefined);

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
      prompt: prompt.trim() || caption.trim().slice(0, 80) || 'Metfa Social Update',
      caption: caption.trim(),
      stylePreset: postMode === 'media' ? stylePreset : undefined,
      imageSrc: primaryImage,
      imageGallery: mediaGallery.length > 0 ? mediaGallery : undefined,
      videoSrc: mediaType === 'video' ? videoSrc : undefined,
      textBackgroundPreset: postMode === 'text' && selectedGradient !== 'none' ? selectedGradient : undefined,
      postType: postMode === 'text' ? 'text' : 'media',
      tags: aiGeneratedTags.length > 0 ? aiGeneratedTags : ['MetfaAI', 'SocialFirst'],
      feedType: 'for_you',
    });

    onClose();
  };

  const activeGradientClass = TEXT_GRADIENTS.find((g) => g.id === selectedGradient)?.bgClass || 'bg-gray-950 text-white';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Create Post</h3>
              <p className="text-[11px] text-gray-400">Publish to Social Feed with AI Magic Assistant</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 scrollbar-thin">
          {/* 1. Identity Selector & Post Type Tabs */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="w-8 h-8 rounded-full object-cover border border-purple-500/40"
              />
              <select
                value={selectedIdentity}
                onChange={(e) => setSelectedIdentity(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-bold truncate flex-1"
              >
                <option value="personal">@{userProfile.username} (Personal)</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    📄 Page: {p.name}
                  </option>
                ))}
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    👥 Group: {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Post Format Toggle */}
            <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setPostMode('text')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  postMode === 'text' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => setPostMode('media')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  postMode === 'media' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Media</span>
              </button>
            </div>
          </div>

          {/* 2. Text / Gradient Post Composer View */}
          {postMode === 'text' ? (
            <div className="space-y-3">
              <div
                className={`rounded-2xl p-4 transition-all duration-300 min-h-[160px] flex flex-col justify-between ${activeGradientClass}`}
              >
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={`What's happening, ${userProfile.name}? Share your thoughts, announcements, or ideas...`}
                  rows={4}
                  className={`w-full bg-transparent placeholder-gray-400 focus:outline-none resize-none font-medium text-sm leading-relaxed ${
                    selectedGradient !== 'none' ? 'text-white text-base font-bold text-center my-auto placeholder-white/70' : 'text-gray-100'
                  }`}
                />
              </div>

              {/* Background Color/Gradient Swatches */}
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-purple-400" />
                  Background
                </span>
                {TEXT_GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGradient(g.id)}
                    className={`w-6 h-6 rounded-lg transition-transform shrink-0 ${g.bgClass} ${
                      selectedGradient === g.id ? 'ring-2 ring-teal-400 scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={g.label}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* 3. Media Post Composer View */
            <div className="space-y-3">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption to your photos or video..."
                rows={2}
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none font-medium"
              />

              {/* Multi-Photo / Video Gallery Preview */}
              {mediaGallery.length > 0 || videoSrc ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {mediaGallery.map((imgUrl, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square bg-black border border-gray-800">
                        <img src={imgUrl} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(idx)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-rose-400 hover:bg-rose-600 hover:text-white transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {videoSrc && (
                      <div className="relative rounded-xl overflow-hidden aspect-square bg-black border border-gray-800 col-span-3">
                        <video src={videoSrc} controls className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setVideoSrc(undefined)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-rose-400 hover:bg-rose-600 hover:text-white transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-950 hover:bg-gray-850 border border-gray-800 rounded-xl text-xs text-teal-300 font-bold cursor-pointer transition">
                    <input type="file" accept="image/*,video/*" multiple onChange={handleMediaUpload} className="hidden" />
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More Photos</span>
                  </label>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-gray-950/60 transition group">
                  <input type="file" accept="image/*,video/*" multiple onChange={handleMediaUpload} className="hidden" />
                  <UploadCloud className="w-8 h-8 text-gray-500 group-hover:text-purple-400 mb-2 transition" />
                  <span className="text-xs font-bold text-gray-300 group-hover:text-white">
                    Upload Photos or Video
                  </span>
                  <span className="text-[10px] text-gray-500 mt-0.5">Supports multi-photo gallery & MP4</span>
                </label>
              )}
            </div>
          )}

          {/* 4. ✨ Integrated AI Assistant Panel */}
          <div className="bg-gray-950/90 border border-purple-500/20 rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAIAssistantOpen(!isAIAssistantOpen)}
                className="flex items-center gap-1.5 text-xs font-bold text-teal-300 hover:text-teal-200 transition"
              >
                <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                <span>✨ AI Magic Assistant</span>
                <span className="text-[10px] text-gray-500 font-normal">
                  ({isAIAssistantOpen ? 'Hide' : 'Tap to Expand'})
                </span>
              </button>

              {isGeneratingAI && (
                <span className="text-[10px] text-purple-400 font-mono flex items-center gap-1 animate-pulse">
                  <Wand2 className="w-3 h-3 animate-spin" />
                  Processing...
                </span>
              )}
            </div>

            {aiStatusMessage && (
              <div className="p-2 bg-purple-950/60 border border-purple-800/60 rounded-xl text-[11px] text-purple-200 animate-fadeIn">
                {aiStatusMessage}
              </div>
            )}

            {isAIAssistantOpen && (
              <div className="space-y-2.5 pt-2 border-t border-gray-800 animate-fadeIn">
                {/* Tone & Language Selectors */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-1">Tone</span>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value as any)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="Creative">Creative</option>
                      <option value="Casual">Casual</option>
                      <option value="Professional">Professional</option>
                      <option value="Hype">Viral / Hype 🔥</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-1">Language</span>
                    <select
                      value={aiLanguage}
                      onChange={(e) => setAiLanguage(e.target.value as any)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="auto">Auto Detect</option>
                      <option value="english">English</option>
                      <option value="bengali">বাংলা (Bengali)</option>
                    </select>
                  </div>
                </div>

                {/* AI Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    disabled={isGeneratingAI}
                    onClick={handleGenerateAICaption}
                    className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <Wand2 className="w-3 h-3 text-teal-400" />
                    <span>Auto Caption & Hashtags</span>
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingAI || !caption.trim()}
                    onClick={() => handleRefineText('fix_grammar')}
                    className="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-xl text-xs font-bold transition"
                  >
                    Fix Grammar
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingAI || !caption.trim()}
                    onClick={() => handleRefineText('expand')}
                    className="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-xl text-xs font-bold transition"
                  >
                    Expand Story
                  </button>
                </div>

                {/* AI Generated Trending Hashtags pills */}
                {aiGeneratedTags.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-gray-400 block mb-1">
                      Suggested Trending Hashtags (Tap to add):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiGeneratedTags.map((tag, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAddHashtag(tag)}
                          className="px-2 py-0.5 bg-purple-950/80 hover:bg-purple-800 border border-purple-700 text-purple-300 rounded-full text-[10px] font-bold transition"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="pt-3 border-t border-gray-800 shrink-0 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold rounded-xl transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!caption.trim() && mediaGallery.length === 0 && !videoSrc}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Publish Post</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;
