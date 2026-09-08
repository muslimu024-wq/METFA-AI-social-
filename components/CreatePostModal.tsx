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
  Smile,
  Music,
  ShieldCheck,
  Maximize2,
  Minimize2,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { CommunityPost, UserProfile } from '../types/community';
import { AudioTrack } from '../types/audio';
import { getPages, getGroups } from '../utils/socialStore';
import { recordTrackUsage } from '../utils/audioStore';
import { generateAICaptionAndHashtags, refineTextWithAI } from '../services/aiAssistantService';
import { saveMediaItem, fileToBase64 } from '../utils/mediaStorage';
import { compressImageDataUrl } from '../utils/storageUtils';
import AudioTrackPickerModal from './AudioTrackPickerModal';
import AudioLicenseInfoModal from './AudioLicenseInfoModal';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onPostCreated: (
    post: Omit<CommunityPost, 'id' | 'likesCount' | 'remixCount' | 'commentsCount' | 'sharesCount' | 'createdAt' | 'comments'>
  ) => Promise<any> | void;
}

export const TEXT_GRADIENTS = [
  { id: 'none', label: 'Default', bgClass: 'bg-slate-50 border border-slate-200 text-slate-900' },
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
  const [videoTitle, setVideoTitle] = useState('');
  const [videoThumbnail, setVideoThumbnail] = useState<string | undefined>(undefined);
  const [selectedIdentity, setSelectedIdentity] = useState('personal');
  const [stylePreset, setStylePreset] = useState('Cyberpunk 2088');
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null);
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  // AI Assistant States
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiTone, setAiTone] = useState<'Creative' | 'Casual' | 'Professional' | 'Hype'>('Creative');
  const [aiLanguage, setAiLanguage] = useState<'auto' | 'bengali' | 'english'>('auto');
  const [aiGeneratedTags, setAiGeneratedTags] = useState<string[]>([]);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);

  // Validation & Asynchronous Publishing State
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Reset all fields when modal opens to ensure no lingering dummy or prior media
  React.useEffect(() => {
    if (isOpen) {
      setPostMode('text');
      setCaption('');
      setPrompt('');
      setSelectedGradient('none');
      setMediaGallery([]);
      setVideoSrc(undefined);
      setVideoTitle('');
      setVideoThumbnail(undefined);
      setValidationError(null);
      setIsPublishing(false);
      setUploadProgress(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isPublishing) return;
    setValidationError(null);
    setIsPublishing(false);
    setUploadProgress(null);
    setVideoSrc(undefined);
    setVideoTitle('');
    setVideoThumbnail(undefined);
    setMediaGallery([]);
    setCaption('');
    setPrompt('');
    onClose();
  };

  if (!isOpen) return null;

  const pages = getPages();
  const groups = getGroups();

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setValidationError(null);

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
        // Crucial: When user uploads a video, completely clear photo gallery
        setMediaGallery([]);
        break; // Only 1 video per post
      } else {
        setMediaType('image');
        // Crucial: When user uploads photos, completely clear any video
        setVideoSrc(undefined);
        setVideoTitle('');
        setVideoThumbnail(undefined);
        setMediaGallery((prev) => [...prev, base64]);
        setPostMode('media');
      }
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidationError(null);
    const rawBase64 = await fileToBase64(file);
    const base64 = await compressImageDataUrl(rawBase64, 800, 800, 0.75);
    setVideoThumbnail(base64);
  };

  const handleRemoveMedia = (index: number) => {
    setValidationError(null);
    setMediaGallery((prev) => prev.filter((_, idx) => idx !== index));
    if (mediaGallery.length <= 1 && !videoSrc) {
      setPostMode('text');
    }
  };

  const handleRemoveVideo = () => {
    setValidationError(null);
    setVideoSrc(undefined);
    setVideoTitle('');
    setVideoThumbnail(undefined);
    if (mediaGallery.length === 0) {
      setPostMode('text');
    }
  };

  const handleClearAllMedia = () => {
    setValidationError(null);
    setMediaGallery([]);
    setVideoSrc(undefined);
    setVideoTitle('');
    setVideoThumbnail(undefined);
    setPostMode('text');
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

  const handleSubmit = async () => {
    if (isPublishing) return;
    setValidationError(null);

    // Validation 1: Video Post must have a video title
    if (videoSrc && !videoTitle.trim()) {
      setValidationError('Please enter a descriptive title for your video.');
      return;
    }

    // Validation 2: Pure text post must have text
    if (postMode === 'text' && !videoSrc && mediaGallery.length === 0 && !caption.trim()) {
      setValidationError('Please write what is on your mind before publishing.');
      return;
    }

    // Validation 3: Media post with no media attached must have at least text
    if (postMode === 'media' && !videoSrc && mediaGallery.length === 0 && !caption.trim()) {
      setValidationError('Please upload at least one photo or video, or enter post text.');
      return;
    }

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

    const primaryImage = mediaGallery.length > 0 ? mediaGallery[0] : undefined;

    if (selectedAudioTrack) {
      recordTrackUsage(selectedAudioTrack.id);
    }

    const effectivePrompt = videoSrc
      ? (videoTitle.trim() || caption.trim().slice(0, 80) || 'Metfa Video Post')
      : (prompt.trim() || caption.trim().slice(0, 80) || 'Metfa Social Update');

    setIsPublishing(true);
    setUploadProgress(videoSrc ? 'Uploading video to secure storage & publishing...' : 'Publishing post to feed...');

    try {
      await onPostCreated({
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
        prompt: effectivePrompt,
        caption: caption.trim(),
        videoTitle: videoSrc ? videoTitle.trim() : undefined,
        videoThumbnail: videoSrc ? (videoThumbnail || undefined) : undefined,
        stylePreset: postMode === 'media' ? stylePreset : undefined,
        // Crucial: When video is uploaded, NEVER attach old photos or dummy cover
        imageSrc: videoSrc ? (videoThumbnail || undefined) : primaryImage,
        imageGallery: videoSrc ? undefined : (mediaGallery.length > 0 ? mediaGallery : undefined),
        videoSrc: videoSrc || undefined,
        textBackgroundPreset: postMode === 'text' && selectedGradient !== 'none' ? selectedGradient : undefined,
        postType: postMode === 'text' ? 'text' : 'media',
        audioTrack: selectedAudioTrack || undefined,
        tags: aiGeneratedTags.length > 0 ? aiGeneratedTags : ['MetfaAI', 'SocialFirst'],
        feedType: 'for_you',
      });

      // Successful publish -> reset and close cleanly
      setVideoSrc(undefined);
      setVideoTitle('');
      setVideoThumbnail(undefined);
      setMediaGallery([]);
      setCaption('');
      setPrompt('');
      setIsPublishing(false);
      setUploadProgress(null);
      onClose();
    } catch (err: any) {
      console.error('[CreatePostModal] Error publishing post:', err);
      setIsPublishing(false);
      setUploadProgress(null);
      setValidationError(err?.message || 'Failed to publish post. Please check your connection and try again.');
    }
  };

  const activeGradientClass = TEXT_GRADIENTS.find((g) => g.id === selectedGradient)?.bgClass || 'bg-gray-950 text-white';

  return (
    <div
      onClick={isFullscreen ? undefined : handleClose}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-white text-slate-900 w-full h-full overflow-hidden animate-fadeIn'
          : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn'
      }
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          isFullscreen
            ? 'flex-1 flex flex-col w-full h-full overflow-hidden bg-white text-slate-900'
            : 'bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative overflow-hidden max-h-[92vh] flex flex-col text-slate-900'
        }
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">Create Post</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  Full-Screen Composer
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Publish to Social Feed with ample space to write & review</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              disabled={isPublishing}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer disabled:opacity-50"
              title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isPublishing}
              className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 sm:px-8 py-4 sm:py-6 space-y-5 scrollbar-thin">
          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs sm:text-sm font-semibold shadow-2xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span className="flex-1">{validationError}</span>
              <button
                type="button"
                onClick={() => setValidationError(null)}
                className="text-rose-500 hover:text-rose-800 p-1 transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Upload Progress Banner */}
          {isPublishing && uploadProgress && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-center gap-3 text-purple-700 text-xs sm:text-sm font-semibold shadow-2xs">
              <RotateCw className="w-4 h-4 shrink-0 text-purple-600 animate-spin" />
              <span className="flex-1">{uploadProgress}</span>
            </div>
          )}
          {/* 1. Identity Selector & Post Type Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="w-9 h-9 rounded-full object-cover border border-purple-500/40 shrink-0"
              />
              <select
                value={selectedIdentity}
                onChange={(e) => setSelectedIdentity(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-purple-500 font-bold truncate flex-1"
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
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setPostMode('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  postMode === 'text' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Text Post</span>
              </button>
              <button
                type="button"
                onClick={() => setPostMode('media')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  postMode === 'media' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Media Post</span>
              </button>
            </div>
          </div>

          {/* 2. Text / Gradient Post Composer View */}
          {postMode === 'text' ? (
            <div className="space-y-4 flex flex-col">
              <div
                className={`rounded-3xl p-5 sm:p-8 transition-all duration-300 min-h-[360px] sm:min-h-[460px] flex flex-col justify-between shadow-xs ${activeGradientClass}`}
              >
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={`What's happening, ${userProfile.name}? Share your thoughts, announcements, or ideas...`}
                  className={`w-full flex-1 min-h-[280px] sm:min-h-[380px] bg-transparent placeholder-slate-400 focus:outline-none resize-none font-medium text-base sm:text-lg leading-relaxed ${
                    selectedGradient !== 'none' ? 'text-white text-lg sm:text-xl font-bold text-center my-auto placeholder-white/70' : 'text-slate-900'
                  }`}
                  autoFocus
                />
                <div className="flex items-center justify-between pt-3 border-t border-black/5 shrink-0">
                  <span className={`text-xs font-mono font-medium ${selectedGradient !== 'none' ? 'text-white/80' : 'text-slate-400'}`}>
                    {caption.length} characters
                  </span>
                  <span className={`text-[11px] ${selectedGradient !== 'none' ? 'text-white/80' : 'text-slate-400'}`}>
                    Full-Screen View • Write & edit clearly
                  </span>
                </div>
              </div>

              {/* Background Color/Gradient Swatches */}
              <div className="flex items-center gap-2 overflow-x-auto py-1 shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-purple-600" />
                  Background
                </span>
                {TEXT_GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGradient(g.id)}
                    className={`w-7 h-7 rounded-xl transition-transform shrink-0 cursor-pointer ${g.bgClass} ${
                      selectedGradient === g.id ? 'ring-2 ring-teal-400 scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={g.label}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* 3. Media Post Composer View */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">Caption & Description</label>
                  <span className="text-[11px] text-slate-400 font-mono">{caption.length} characters</span>
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write your caption, story or description in detail..."
                  rows={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white resize-y font-medium leading-relaxed min-h-[160px]"
                />
              </div>

              {/* Video Specific View */}
              {videoSrc ? (
                <div className="space-y-3 bg-purple-50/60 border border-purple-200 rounded-2xl p-4">
                  {/* Video Title Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-purple-600" />
                        <span>Video Title</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <span className="text-[11px] text-purple-600 font-mono">Required</span>
                    </div>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Enter a descriptive title for this video..."
                      className="w-full bg-white border border-purple-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-2xs"
                    />
                  </div>

                  {/* Video Player & Actions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-purple-600" />
                        <span>Video Preview</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveVideo}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                        title="Delete / Remove this video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Video</span>
                      </button>
                    </div>

                    <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-300 max-h-80 flex items-center justify-center">
                      <video
                        src={videoSrc}
                        controls
                        poster={videoThumbnail}
                        className="w-full max-h-80 object-contain"
                      />
                    </div>
                  </div>

                  {/* Optional Custom Video Thumbnail / Cover */}
                  <div className="pt-2 border-t border-purple-200/80">
                    {videoThumbnail ? (
                      <div className="flex items-center justify-between gap-3 p-3 bg-white border border-purple-200 rounded-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={videoThumbnail}
                            alt="Cover thumbnail"
                            className="w-14 h-14 rounded-lg object-cover border border-purple-300 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">Custom Cover Thumbnail Attached</p>
                            <p className="text-[11px] text-slate-500">Displays before the video starts playing</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVideoThumbnail(undefined)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Cover</span>
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-purple-100/50 border border-purple-200 rounded-xl text-xs font-bold text-purple-700 cursor-pointer transition">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailUpload}
                          className="hidden"
                        />
                        <ImageIcon className="w-4 h-4 text-purple-600" />
                        <span>Add Custom Cover Thumbnail (Optional)</span>
                      </label>
                    )}
                  </div>
                </div>
              ) : mediaGallery.length > 0 ? (
                /* Multi-Photo Gallery Preview */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Attached Photos ({mediaGallery.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setMediaGallery([])}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear All Photos</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                    {mediaGallery.map((imgUrl, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100 border border-slate-200 shadow-2xs">
                        <img src={imgUrl} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(idx)}
                          className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition shadow-sm cursor-pointer"
                          title="Remove this photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs text-teal-700 font-bold cursor-pointer transition">
                      <input type="file" accept="image/*" multiple onChange={handleMediaUpload} className="hidden" />
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add More Photos</span>
                    </label>
                  </div>
                </div>
              ) : (
                /* Upload Buttons for Video and Photos */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="border-2 border-dashed border-purple-200 hover:border-purple-600 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-purple-50/30 hover:bg-purple-50 transition group">
                    <input type="file" accept="video/*" onChange={handleMediaUpload} className="hidden" />
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                      <Video className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700">
                      Upload Video Post
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">MP4, WebM, MOV video</span>
                  </label>

                  <label className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-teal-50/30 transition group">
                    <input type="file" accept="image/*" multiple onChange={handleMediaUpload} className="hidden" />
                    <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-teal-700">
                      Upload Photos
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Single or multi-photo gallery</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* 4. Licensed Audio Soundtrack Attachment */}
          <div className="bg-slate-50 border border-purple-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-purple-600" />
                <span>Background Audio Soundtrack</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAudioPickerOpen(true)}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-800 transition flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>{selectedAudioTrack ? 'Change Audio' : 'Add Music'}</span>
              </button>
            </div>

            {selectedAudioTrack ? (
              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={selectedAudioTrack.cover_url}
                    alt={selectedAudioTrack.title}
                    className="w-10 h-10 rounded-lg object-cover border border-purple-300 shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{selectedAudioTrack.title}</h4>
                    <p className="text-[10px] text-purple-700 truncate font-mono">
                      {selectedAudioTrack.artist} • {selectedAudioTrack.genre}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsLicenseModalOpen(true)}
                      className="text-[9px] text-teal-700 font-bold hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>{selectedAudioTrack.license_type}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAudioTrack(null)}
                  className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                  title="Remove soundtrack"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Attach licensed or royalty-free audio with verified rights certificate.
              </p>
            )}
          </div>

          {/* 5. ✨ Integrated AI Assistant Panel */}
          <div className="bg-slate-50 border border-purple-200 rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAIAssistantOpen(!isAIAssistantOpen)}
                className="flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-900 transition"
              >
                <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" />
                <span>✨ AI Magic Assistant</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  ({isAIAssistantOpen ? 'Hide' : 'Tap to Expand'})
                </span>
              </button>

              {isGeneratingAI && (
                <span className="text-[10px] text-purple-600 font-mono flex items-center gap-1 animate-pulse">
                  <Wand2 className="w-3 h-3 animate-spin" />
                  Processing...
                </span>
              )}
            </div>

            {aiStatusMessage && (
              <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl text-[11px] text-purple-800 animate-fadeIn">
                {aiStatusMessage}
              </div>
            )}

            {isAIAssistantOpen && (
              <div className="space-y-2.5 pt-2 border-t border-slate-200 animate-fadeIn">
                {/* Tone & Language Selectors */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 block mb-1">Tone</span>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                    >
                      <option value="Creative">Creative</option>
                      <option value="Casual">Casual</option>
                      <option value="Professional">Professional</option>
                      <option value="Hype">Viral / Hype 🔥</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-600 block mb-1">Language</span>
                    <select
                      value={aiLanguage}
                      onChange={(e) => setAiLanguage(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
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
                    className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-800 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                  >
                    <Wand2 className="w-3 h-3 text-teal-600" />
                    <span>Auto Caption & Hashtags</span>
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingAI || !caption.trim()}
                    onClick={() => handleRefineText('fix_grammar')}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Fix Grammar
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingAI || !caption.trim()}
                    onClick={() => handleRefineText('expand')}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Expand Story
                  </button>
                </div>

                {/* AI Generated Trending Hashtags pills */}
                {aiGeneratedTags.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-600 block mb-1">
                      Suggested Trending Hashtags (Tap to add):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiGeneratedTags.map((tag, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAddHashtag(tag)}
                          className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-full text-[10px] font-bold transition"
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
        <div className="py-3.5 px-4 sm:px-8 border-t border-slate-100 shrink-0 flex items-center justify-between bg-white">
          <span className="text-xs text-slate-500 hidden sm:inline-block">
            {caption.trim().length > 0 ? `${caption.trim().split(/\s+/).length} words` : 'Social Post'}
          </span>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPublishing}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPublishing || (!caption.trim() && mediaGallery.length === 0 && !videoSrc)}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition flex items-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Publish Post</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Audio Track Picker Modal */}
      <AudioTrackPickerModal
        isOpen={isAudioPickerOpen}
        onClose={() => setIsAudioPickerOpen(false)}
        onSelectTrack={(track) => setSelectedAudioTrack(track)}
        selectedTrackId={selectedAudioTrack?.id}
      />

      {/* Audio License Certificate Modal */}
      {selectedAudioTrack && isLicenseModalOpen && (
        <AudioLicenseInfoModal
          isOpen={isLicenseModalOpen}
          track={selectedAudioTrack}
          onClose={() => setIsLicenseModalOpen(false)}
        />
      )}
    </div>
  );
};

export default CreatePostModal;
