import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Edit3,
  Sparkles,
  Zap,
  Film,
  Compass,
  FileText,
  Users,
  Check,
  Globe,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  LogIn,
  ShieldCheck,
  CheckCircle2,
  ArrowRightLeft,
  Building2,
  Camera,
  Upload,
  Wand2,
  X,
  RefreshCw,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Heart,
  MessageCircle,
  Play,
} from 'lucide-react';
import { UserProfile, CommunityPost, ReelHighlight } from '../types/community';
import { DailyCreditsData } from '../utils/creditManager';
import { getPages, getGroups } from '../utils/socialStore';
import { useAuth } from '../context/AuthContext';
import { fileToBase64, saveMediaItem } from '../utils/mediaStorage';
import { generateCustomAIAvatar } from '../services/aiAssistantService';
import { compressImageDataUrl } from '../utils/storageUtils';
import {
  getSavedPostsList,
  getSavedReelsList,
  toggleSavePost,
  toggleSaveReel,
} from '../utils/bookmarkStore';

interface ProfileViewProps {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  creditsData: DailyCreditsData;
  userPosts: CommunityPost[];
  userReels: ReelHighlight[];
  allPosts?: CommunityPost[];
  allReels?: ReelHighlight[];
  onUpdatePosts?: (posts: CommunityPost[]) => void;
  onUpdateReels?: (reels: ReelHighlight[]) => void;
  onWatchAdClick?: () => void;
  onOpenAuthModal?: () => void;
  onCreatePageClick?: () => void;
  onCreateGroupClick?: () => void;
  onOpenSettings?: () => void;
}

const AVATAR_STYLES = [
  'Cyberpunk',
  'Anime 3D',
  'Photorealistic Studio',
  'Minimalist Vector',
  'Neon Synthwave',
  'Fantasy Royalty',
] as const;

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onUpdateProfile,
  creditsData,
  userPosts,
  userReels,
  allPosts,
  allReels,
  onUpdatePosts,
  onUpdateReels,
  onWatchAdClick,
  onOpenAuthModal,
  onCreatePageClick,
  onCreateGroupClick,
  onOpenSettings,
}) => {
  const { user: authUser, activeIdentity, updateProfile, switchIdentity } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [username, setUsername] = useState(userProfile.username);
  const [bio, setBio] = useState(userProfile.bio);
  const [location, setLocation] = useState(userProfile.location || '');
  const [website, setWebsite] = useState(userProfile.website || '');
  const [activeTab, setActiveTab] = useState<'creations' | 'reels' | 'saved'>('creations');
  const [savedFilter, setSavedFilter] = useState<'all' | 'posts' | 'reels'>('all');
  const [savedPosts, setSavedPosts] = useState<CommunityPost[]>(() => getSavedPostsList(allPosts));
  const [savedReels, setSavedReels] = useState<ReelHighlight[]>(() => getSavedReelsList(allReels));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync saved posts & reels when storage changes or props update
  useEffect(() => {
    setSavedPosts(getSavedPostsList(allPosts));
    setSavedReels(getSavedReelsList(allReels));

    const handleSavedUpdated = () => {
      setSavedPosts(getSavedPostsList(allPosts));
      setSavedReels(getSavedReelsList(allReels));
    };

    window.addEventListener('metfa_saved_items_updated', handleSavedUpdated);
    window.addEventListener('metfa_posts_updated', handleSavedUpdated);
    window.addEventListener('metfa_reels_updated', handleSavedUpdated);

    return () => {
      window.removeEventListener('metfa_saved_items_updated', handleSavedUpdated);
      window.removeEventListener('metfa_posts_updated', handleSavedUpdated);
      window.removeEventListener('metfa_reels_updated', handleSavedUpdated);
    };
  }, [allPosts, allReels]);

  const handleUnsavePost = (postId: string) => {
    const res = toggleSavePost(postId);
    if (onUpdatePosts) {
      onUpdatePosts(res.updatedPosts);
    }
    setSavedPosts(getSavedPostsList(res.updatedPosts));
    showToast('Post removed from saved bookmarks');
  };

  const handleUnsaveReel = (reelId: string) => {
    const res = toggleSaveReel(reelId);
    if (onUpdateReels) {
      onUpdateReels(res.updatedReels);
    }
    setSavedReels(getSavedReelsList(res.updatedReels));
    showToast('Reel removed from saved bookmarks');
  };

  // AI Avatar Generator Modal State
  const [isAIAvatarModalOpen, setIsAIAvatarModalOpen] = useState(false);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState<typeof AVATAR_STYLES[number]>('Cyberpunk');
  const [avatarTraits, setAvatarTraits] = useState('');
  const [generatedAvatarPreview, setGeneratedAvatarPreview] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const switcherRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setName(userProfile.name);
    setUsername(userProfile.username);
    setBio(userProfile.bio);
    setLocation(userProfile.location || '');
    setWebsite(userProfile.website || '');
  }, [userProfile]);

  // Close Account Switcher when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setIsSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const pages = getPages();
  const groups = getGroups();

  const handleSave = () => {
    const cleanUsername = username.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '') || userProfile.username;
    const updated: UserProfile = {
      ...userProfile,
      name: name.trim() || userProfile.name,
      username: cleanUsername,
      bio: bio.trim(),
      location: location.trim(),
      website: website.trim(),
    };
    updateProfile(updated);
    onUpdateProfile(updated);
    setIsEditing(false);
  };

  const handleSelectIdentity = (type: 'personal' | 'page' | 'group', item?: any) => {
    if (type === 'personal') {
      switchIdentity({
        type: 'personal',
        id: authUser.id,
        name: authUser.name,
        username: authUser.username,
        avatar: authUser.avatar,
        badge: authUser.isVerified ? 'Verified Creator' : 'Creator',
      });
    } else if (type === 'page' && item) {
      switchIdentity({
        type: 'page',
        id: item.id,
        name: item.name,
        username: item.username,
        avatar: item.avatar,
        badge: 'Page Admin',
      });
    } else if (type === 'group' && item) {
      switchIdentity({
        type: 'group',
        id: item.id,
        name: item.name,
        username: item.handle.replace('@', ''),
        avatar: item.avatar,
        badge: 'Group Admin',
      });
    }
    setIsSwitcherOpen(false);
  };

  // Direct File Avatar Upload with safe compression
  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImageDataUrl(base64, 250, 250, 0.8);
      await saveMediaItem({
        userId: userProfile.id,
        type: 'image',
        dataUrl: compressed,
        name: `avatar_${Date.now()}.png`,
        sizeBytes: file.size,
        mimeType: file.type,
      });

      const updated = { ...userProfile, avatar: compressed };
      updateProfile(updated);
      onUpdateProfile(updated);
    } catch (err) {
      console.warn('Avatar file read error:', err);
    }
  };

  // AI Avatar Generation
  const handleGenerateAIAvatar = async () => {
    setIsGeneratingAvatar(true);
    try {
      const result = await generateCustomAIAvatar({
        style: selectedAvatarStyle,
        traits: avatarTraits,
      });
      setGeneratedAvatarPreview(result.avatarUrl);
    } catch (err) {
      console.warn('Avatar gen error:', err);
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleApplyAIAvatar = async () => {
    if (!generatedAvatarPreview) return;
    try {
      const compressed = await compressImageDataUrl(generatedAvatarPreview, 250, 250, 0.8);
      const updated = { ...userProfile, avatar: compressed };
      updateProfile(updated);
      onUpdateProfile(updated);
    } catch {
      const updated = { ...userProfile, avatar: generatedAvatarPreview };
      updateProfile(updated);
      onUpdateProfile(updated);
    }
    setIsAIAvatarModalOpen(false);
    setGeneratedAvatarPreview(null);
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleAvatarFileUpload}
        className="hidden"
      />

      {/* UNIFIED SINGLE PROFILE HEADER CARD */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Cover Artwork Banner */}
        <div className="h-32 sm:h-44 bg-gradient-to-r from-purple-950/90 via-gray-900 to-teal-950/80 relative border-b border-gray-800/80">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/30 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Profile Content Container */}
        <div className="px-5 sm:px-8 pb-7 pt-0 relative">
          {/* 1. [Profile Avatar + Verified Badge] */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-20">
            {/* Avatar with Verified Badge Overlay */}
            <div className="relative inline-block group shrink-0">
              <img
                src={activeIdentity.avatar || userProfile.avatar}
                alt={activeIdentity.name || userProfile.name}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-gray-900 shadow-2xl bg-gray-950 group-hover:opacity-90 transition"
              />

              {/* Verified Creator Badge overlay */}
              {userProfile.isVerified && (
                <div
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-teal-500 text-black border-2 border-gray-900 shadow-md flex items-center justify-center"
                  title="Verified Creator"
                >
                  <ShieldCheck className="w-4 h-4 text-black stroke-[2.5]" />
                </div>
              )}

              {/* Avatar Quick Upload / AI Trigger Overlay */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition cursor-pointer backdrop-blur-xs"
                title="Click to upload custom profile photo"
              >
                <Camera className="w-6 h-6 text-white" />
                <span className="text-[10px] text-gray-200 font-bold">Change</span>
              </div>
            </div>

            {/* SSO / Unified ID Badges */}
            <div className="flex items-center gap-2 flex-wrap sm:mb-2">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 font-mono font-semibold">
                Unified ID: {authUser.metfaId || authUser.id}
              </span>
              {authUser.authType !== 'guest' ? (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-teal-950/80 border border-teal-800 text-teal-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-teal-400" />
                  SSO Active
                </span>
              ) : (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400 font-medium">
                  Guest Mode
                </span>
              )}
            </div>
          </div>

          {/* 2. [Name & @Username] */}
          <div className="mt-3.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeIdentity.name || userProfile.name}
              </h1>
              {userProfile.isVerified && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-950 border border-teal-800 text-teal-300 font-bold flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="w-3 h-3 text-teal-400" />
                  Verified Creator
                </span>
              )}
              {/* Identity Type Pill */}
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gray-800/90 border border-gray-700 text-gray-300 font-semibold flex items-center gap-1">
                {activeIdentity.type === 'personal' ? (
                  <>
                    <User className="w-3 h-3 text-teal-400" />
                    <span>Personal Profile</span>
                  </>
                ) : activeIdentity.type === 'page' ? (
                  <>
                    <Building2 className="w-3 h-3 text-purple-400" />
                    <span>Page • {activeIdentity.badge || 'Creator Page'}</span>
                  </>
                ) : (
                  <>
                    <Users className="w-3 h-3 text-amber-400" />
                    <span>Group • {activeIdentity.badge || 'Managed Group'}</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs sm:text-sm text-teal-400 font-mono font-bold">
                @{activeIdentity.username || userProfile.username}
              </span>
            </div>
          </div>

          {/* 3. [Bio & ID] */}
          <div className="mt-3 space-y-3">
            {!isEditing ? (
              <>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-3xl whitespace-pre-line">
                  {userProfile.bio || 'Digital creator and AI enthusiast exploring generative media on Metfa Social.'}
                </p>

                {/* Metadata row: Location, Website, Join Date */}
                <div className="flex items-center gap-3.5 text-xs text-gray-400 flex-wrap pt-0.5">
                  {userProfile.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{userProfile.location}</span>
                    </span>
                  )}
                  {userProfile.website && (
                    <a
                      href={userProfile.website.startsWith('http') ? userProfile.website : `https://${userProfile.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300 transition underline-offset-2 hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[220px]">{userProfile.website.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  )}
                  {userProfile.joinDate && (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>Joined {userProfile.joinDate}</span>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3 bg-gray-950/80 p-4 sm:p-5 rounded-2xl border border-purple-500/30 animate-fadeIn my-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Username (@)</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Bio / Creator Statement</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Tokyo / Remote or San Francisco"
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Website / Portfolio</label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://metfa.ai/@yourname"
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CLEAN ACTION BUTTONS ROW: [Edit Profile | Switch Account | AI Avatar | Upload Photo] */}
          <div className="flex items-center gap-2 sm:gap-2.5 mt-5 flex-wrap relative" ref={switcherRef}>
            {/* 1. Edit Profile Button / Save Changes */}
            {!isEditing ? (
              <button
                type="button"
                id="edit-profile-btn"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-gray-700 flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="save-profile-btn"
                  onClick={handleSave}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
                <button
                  type="button"
                  id="cancel-edit-profile-btn"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl border border-gray-700 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* 2. Sleek Account Switcher Dropdown Trigger */}
            <div className="relative">
              <button
                type="button"
                id="switch-account-dropdown-btn"
                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition shadow-sm active:scale-95 cursor-pointer ${
                  isSwitcherOpen
                    ? 'bg-purple-900/80 border-purple-400 text-white'
                    : 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-200 hover:text-white'
                }`}
                title="Switch active posting account or page"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                <span>Switch Account</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                    isSwitcherOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {/* Compact Switcher Dropdown Popover */}
              {isSwitcherOpen && (
                <div
                  id="account-switcher-dropdown-menu"
                  className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-gray-950 border border-purple-500/40 rounded-2xl shadow-2xl p-2.5 z-40 animate-scaleUp backdrop-blur-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2.5 py-1.5 border-b border-gray-800 flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                      Posting Identities
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">Select active profile</span>
                  </div>

                  {/* Personal Profile Option */}
                  <button
                    type="button"
                    id="switch-to-personal-btn"
                    onClick={() => handleSelectIdentity('personal')}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition ${
                      activeIdentity.type === 'personal'
                        ? 'bg-purple-900/60 border border-purple-400 text-white shadow-sm'
                        : 'hover:bg-gray-900 text-gray-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={authUser.avatar}
                        alt="Personal"
                        className="w-8 h-8 rounded-lg object-cover shrink-0 border border-gray-700"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate text-white">{authUser.name}</div>
                        <div className="text-[10px] text-teal-400 font-mono">Personal • @{authUser.username}</div>
                      </div>
                    </div>
                    {activeIdentity.type === 'personal' && (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    )}
                  </button>

                  {/* Pages Section */}
                  {pages.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-850">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Creator Pages
                      </div>
                      <div className="space-y-1 mt-1 max-h-40 overflow-y-auto pr-1">
                        {pages.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectIdentity('page', p)}
                            className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition ${
                              activeIdentity.id === p.id
                                ? 'bg-purple-900/60 border border-purple-400 text-white shadow-sm'
                                : 'hover:bg-gray-900 text-gray-300 hover:text-white border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={p.avatar}
                                alt={p.name}
                                className="w-7 h-7 rounded-lg object-cover shrink-0 border border-gray-700"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate text-white">{p.name}</div>
                                <div className="text-[10px] text-purple-400 font-mono">Page • {p.category}</div>
                              </div>
                            </div>
                            {activeIdentity.id === p.id && (
                              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Managed Groups Section */}
                  {groups.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-850">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Managed Groups
                      </div>
                      <div className="space-y-1 mt-1 max-h-36 overflow-y-auto pr-1">
                        {groups.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleSelectIdentity('group', g)}
                            className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition ${
                              activeIdentity.id === g.id
                                ? 'bg-purple-900/60 border border-purple-400 text-white shadow-sm'
                                : 'hover:bg-gray-900 text-gray-300 hover:text-white border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={g.avatar}
                                alt={g.name}
                                className="w-7 h-7 rounded-lg object-cover shrink-0 border border-gray-700"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate text-white">{g.name}</div>
                                <div className="text-[10px] text-amber-400 font-mono">
                                  Group • {g.membersCount} members
                                </div>
                              </div>
                            </div>
                            {activeIdentity.id === g.id && (
                              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Create New Page / Group Shortcuts */}
                  {(onCreatePageClick || onCreateGroupClick) && (
                    <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-1.5">
                      {onCreatePageClick && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSwitcherOpen(false);
                            onCreatePageClick();
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-gray-900 hover:bg-gray-850 text-purple-300 hover:text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 border border-gray-800 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>New Page</span>
                        </button>
                      )}
                      {onCreateGroupClick && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSwitcherOpen(false);
                            onCreateGroupClick();
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-gray-900 hover:bg-gray-850 text-amber-300 hover:text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1 border border-gray-800 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>New Group</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. ✨ AI Avatar Studio Trigger */}
            <button
              type="button"
              id="ai-avatar-btn"
              onClick={() => setIsAIAvatarModalOpen(true)}
              className="px-3.5 py-2 bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-purple-200 hover:text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-purple-400" />
              <span>✨ AI Avatar</span>
            </button>

            {/* 4. Upload Photo Button */}
            <button
              type="button"
              id="upload-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Upload Photo</span>
              <span className="sm:hidden">Photo</span>
            </button>

            {/* 5. SSO / Auth Modal Trigger */}
            {onOpenAuthModal && (
              <button
                type="button"
                id="profile-auth-btn"
                onClick={onOpenAuthModal}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95 ml-auto sm:ml-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Phone / Gmail</span>
              </button>
            )}
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-gray-800 text-center">
            <div className="p-3 bg-gray-950/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-white">{userPosts.length}</span>
              <span className="text-[11px] text-gray-400 uppercase font-semibold mt-0.5">Posts</span>
            </div>

            <div className="p-3 bg-gray-950/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-white">
                {userProfile.stats?.followersCount || 3840}
              </span>
              <span className="text-[11px] text-gray-400 uppercase font-semibold mt-0.5">Followers</span>
            </div>

            <div className="p-3 bg-gray-950/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-white">
                {userProfile.stats?.followingCount || 192}
              </span>
              <span className="text-[11px] text-gray-400 uppercase font-semibold mt-0.5">Following</span>
            </div>

            <div className="p-3 bg-gray-950/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-white">{userReels.length}</span>
              <span className="text-[11px] text-gray-400 uppercase font-semibold mt-0.5">Reels</span>
            </div>
          </div>
        </div>
      </div>

      {/* CREATIONS, REELS & SAVED TABS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            <button
              type="button"
              id="tab-creations-btn"
              onClick={() => setActiveTab('creations')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'creations'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Posts & Artworks ({userPosts.length})</span>
            </button>

            <button
              type="button"
              id="tab-reels-btn"
              onClick={() => setActiveTab('reels')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'reels'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Reels ({userReels.length})</span>
            </button>

            <button
              type="button"
              id="tab-saved-btn"
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved ({savedPosts.length + savedReels.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'creations' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {userPosts.length > 0 ? (
              userPosts.map((post) => (
                <div
                  key={post.id}
                  className="group relative rounded-2xl overflow-hidden aspect-square bg-gray-900 border border-gray-800 shadow-md"
                >
                  {post.imageSrc ? (
                    <img
                      src={post.imageSrc}
                      alt={post.prompt}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full p-4 flex items-center justify-center text-center bg-purple-950/40 text-xs font-bold text-gray-200">
                      {post.caption || post.prompt}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-3">
                    <p className="text-[11px] text-white line-clamp-2 font-medium">{post.caption || post.prompt}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-gray-900/60 rounded-3xl border border-gray-800 p-6">
                <Compass className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-gray-300">No creations published yet</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Create posts or share artworks from the AI Studio to showcase them on your profile.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reels' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {userReels.length > 0 ? (
              userReels.map((reel) => (
                <div
                  key={reel.id}
                  className="group relative rounded-2xl overflow-hidden aspect-[9/16] bg-gray-900 border border-gray-800 shadow-md"
                >
                  <img
                    src={reel.thumbnailSrc || reel.videoSrc}
                    alt={reel.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-between p-3">
                    <span className="self-end px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-mono text-teal-300">
                      {reel.duration}s
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{reel.title}</h4>
                      <p className="text-[10px] text-gray-400 line-clamp-1">{reel.caption}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-gray-900/60 rounded-3xl border border-gray-800 p-6">
                <Film className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-gray-300">No reels created yet</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Record or generate short video reels to build your video highlight portfolio.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Sub-filter chips */}
            <div className="flex items-center gap-1.5 pb-1">
              <button
                type="button"
                id="saved-filter-all"
                onClick={() => setSavedFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  savedFilter === 'all'
                    ? 'bg-gray-800 text-amber-300 border border-amber-500/40'
                    : 'text-gray-400 hover:text-white bg-gray-950/60 border border-gray-850'
                }`}
              >
                All ({savedPosts.length + savedReels.length})
              </button>

              <button
                type="button"
                id="saved-filter-posts"
                onClick={() => setSavedFilter('posts')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  savedFilter === 'posts'
                    ? 'bg-gray-800 text-amber-300 border border-amber-500/40'
                    : 'text-gray-400 hover:text-white bg-gray-950/60 border border-gray-850'
                }`}
              >
                Posts ({savedPosts.length})
              </button>

              <button
                type="button"
                id="saved-filter-reels"
                onClick={() => setSavedFilter('reels')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  savedFilter === 'reels'
                    ? 'bg-gray-800 text-amber-300 border border-amber-500/40'
                    : 'text-gray-400 hover:text-white bg-gray-950/60 border border-gray-850'
                }`}
              >
                Reels ({savedReels.length})
              </button>
            </div>

            {/* Saved Content Render */}
            {(savedFilter === 'all' || savedFilter === 'posts') && savedPosts.length > 0 && (
              <div className="space-y-2.5">
                {savedFilter === 'all' && (
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-teal-400" />
                    <span>Saved Posts ({savedPosts.length})</span>
                  </h4>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedPosts.map((post) => (
                    <div
                      key={`saved_post_${post.id}`}
                      className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-3.5 flex flex-col justify-between shadow-lg transition"
                    >
                      <div className="space-y-2.5">
                        {/* Author Header & Unsave Button */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={post.author.avatar}
                              alt={post.author.name}
                              className="w-7 h-7 rounded-full object-cover border border-gray-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{post.author.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">@{post.author.username}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            id={`unsave-post-btn-${post.id}`}
                            onClick={() => handleUnsavePost(post.id)}
                            className="p-1.5 bg-amber-950/80 hover:bg-amber-900/80 border border-amber-800/80 text-amber-300 rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
                            title="Remove from bookmarks"
                          >
                            <Bookmark className="w-3.5 h-3.5 fill-current text-amber-400" />
                            <span className="text-[11px] font-semibold">Saved</span>
                          </button>
                        </div>

                        {/* Media / Canvas Preview */}
                        {post.imageSrc ? (
                          <div className="w-full h-36 rounded-xl overflow-hidden bg-black/40 border border-gray-800 relative">
                            <img
                              src={post.imageSrc}
                              alt={post.prompt}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-full p-3 rounded-xl bg-purple-950/30 border border-purple-900/30 text-xs text-gray-200 line-clamp-3">
                            {post.caption || post.prompt}
                          </div>
                        )}

                        <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                          {post.caption || post.prompt}
                        </p>
                      </div>

                      {/* Footer Stats */}
                      <div className="flex items-center gap-3 pt-2 mt-2 border-t border-gray-800/80 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-rose-400" />
                          <span>{post.likesCount || 0}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5 text-teal-400" />
                          <span>{post.commentsCount || 0}</span>
                        </span>
                        <span className="ml-auto text-[10px] text-gray-500">{post.createdAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(savedFilter === 'all' || savedFilter === 'reels') && savedReels.length > 0 && (
              <div className="space-y-2.5 pt-2">
                {savedFilter === 'all' && (
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-purple-400" />
                    <span>Saved Reels ({savedReels.length})</span>
                  </h4>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {savedReels.map((reel) => (
                    <div
                      key={`saved_reel_${reel.id}`}
                      className="group relative rounded-2xl overflow-hidden aspect-[9/16] bg-gray-900 border border-gray-800 shadow-md flex flex-col justify-between"
                    >
                      <img
                        src={reel.thumbnailSrc || reel.videoSrc}
                        alt={reel.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="relative z-10 p-2.5 flex items-start justify-between bg-gradient-to-b from-black/80 via-transparent to-transparent">
                        <span className="px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-mono text-teal-300">
                          {reel.duration}s
                        </span>

                        <button
                          type="button"
                          id={`unsave-reel-btn-${reel.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnsaveReel(reel.id);
                          }}
                          className="p-1.5 rounded-xl bg-amber-500 text-white shadow-md transition hover:scale-105 active:scale-95 cursor-pointer"
                          title="Remove bookmark"
                        >
                          <Bookmark className="w-3.5 h-3.5 fill-current text-white" />
                        </button>
                      </div>

                      <div className="relative z-10 p-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                        <h4 className="text-xs font-bold text-white line-clamp-1">{reel.title}</h4>
                        <p className="text-[10px] text-gray-300 line-clamp-1">@{reel.author.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {savedPosts.length === 0 && savedReels.length === 0 && (
              <div className="py-14 text-center bg-gray-900/60 rounded-3xl border border-gray-800 p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-800/60 text-amber-400 flex items-center justify-center mx-auto">
                  <Bookmark className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-gray-200">No saved items yet</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                    Bookmark posts and reels in your feed or explore views to save them here for quick access later.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 border border-amber-500/50 text-white px-4 py-2 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 z-50 animate-fadeIn backdrop-blur-md">
          <Bookmark className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ✨ AI AVATAR GENERATOR MODAL */}
      {isAIAvatarModalOpen && (
        <div
          onClick={() => setIsAIAvatarModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-950 border border-purple-500/30 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-950 text-purple-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">✨ AI Avatar Studio</h3>
                  <p className="text-[10px] text-gray-400">Generate a stylized profile avatar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAIAvatarModalOpen(false)}
                className="p-1.5 rounded-full bg-gray-900 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar Preview Canvas */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-28 h-28 rounded-3xl overflow-hidden border-4 border-purple-500/50 shadow-xl bg-gray-900 flex items-center justify-center relative">
                {generatedAvatarPreview ? (
                  <img
                    src={generatedAvatarPreview}
                    alt="AI Avatar Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={userProfile.avatar}
                    alt="Current Avatar"
                    className="w-full h-full object-cover opacity-60"
                  />
                )}
                {isGeneratingAvatar && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-teal-400 animate-spin mb-1" />
                    <span className="text-[10px] text-teal-200 font-bold">Rendering...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Style Selector */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                Avatar Aesthetic Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {AVATAR_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setSelectedAvatarStyle(style)}
                    className={`p-2 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                      selectedAvatarStyle === style
                        ? 'bg-purple-950 border-purple-500 text-white'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom traits input */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Custom Visual Traits (Optional)
              </label>
              <input
                type="text"
                value={avatarTraits}
                onChange={(e) => setAvatarTraits(e.target.value)}
                placeholder="e.g. silver hair, neon goggles, smiling..."
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleGenerateAIAvatar}
                disabled={isGeneratingAvatar}
                className="flex-1 py-2 px-3 bg-gray-900 hover:bg-gray-850 border border-gray-800 text-purple-300 hover:text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{generatedAvatarPreview ? 'Reroll Style' : 'Generate Avatar'}</span>
              </button>

              {generatedAvatarPreview && (
                <button
                  type="button"
                  onClick={handleApplyAIAvatar}
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Set as Avatar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
