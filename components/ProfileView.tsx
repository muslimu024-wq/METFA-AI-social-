import React, { useState } from 'react';
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
  Calendar
} from 'lucide-react';
import { UserProfile, CommunityPost, ReelHighlight } from '../types/community';
import { DailyCreditsData } from '../utils/creditManager';
import { saveUserProfile } from '../utils/communityStore';

interface ProfileViewProps {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  creditsData: DailyCreditsData;
  userPosts: CommunityPost[];
  userReels: ReelHighlight[];
  onWatchAdClick?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onUpdateProfile,
  creditsData,
  userPosts,
  userReels,
  onWatchAdClick,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [bio, setBio] = useState(userProfile.bio);
  const [location, setLocation] = useState(userProfile.location || '');
  const [website, setWebsite] = useState(userProfile.website || '');
  const [activeTab, setActiveTab] = useState<'creations' | 'reels'>('creations');

  const handleSave = () => {
    const updated: UserProfile = {
      ...userProfile,
      name,
      bio,
      location,
      website,
    };
    onUpdateProfile(updated);
    saveUserProfile(updated);
    setIsEditing(false);
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Profile Header Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl p-6 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-20 h-20 rounded-3xl object-cover border-4 border-purple-500/40 shadow-xl"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">{userProfile.name}</h2>
                {userProfile.isVerified && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950 border border-teal-800 text-teal-300 font-bold">
                    Verified Creator
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 font-mono">@{userProfile.username}</span>

              <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                {userProfile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    {userProfile.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  {userProfile.joinDate}
                </span>
              </div>
            </div>
          </div>

          <div>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-gray-700 flex items-center gap-1.5 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            )}
          </div>
        </div>

        {/* Bio editing / display */}
        <div className="py-4">
          {!isEditing ? (
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">{userProfile.bio}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-800 text-center">
          <div className="p-3 bg-gray-950/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center">
            <span className="text-xl sm:text-2xl font-black text-white">{userPosts.length}</span>
            <span className="text-[11px] text-gray-400 uppercase font-semibold mt-0.5">Creations</span>
          </div>

          <div className="p-3 bg-gray-950/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center">
            <span className="text-xl sm:text-2xl font-black text-white">
              {userProfile.stats?.followersCount || 3840}
            </span>
            <span className="text-[11px] text-gray-400 uppercase font-semibold mt-0.5">Followers</span>
          </div>

          <div className="p-3 bg-gray-950/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center">
            <span className="text-xl sm:text-2xl font-black text-white">
              {userProfile.stats?.totalLikes || 19200}
            </span>
            <span className="text-[11px] text-gray-400 uppercase font-semibold mt-0.5">Total Likes</span>
          </div>

          <div className="p-3 bg-gray-950/60 rounded-2xl border border-gray-800 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-xl sm:text-2xl font-black text-white">
                {creditsData?.remainingCredits ?? 0}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 uppercase font-semibold mt-0.5">Credits</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Creations vs Reels */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('creations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'creations'
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-900'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>My AI Creations ({userPosts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'reels'
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-900'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Reel Highlights ({userReels.length})</span>
        </button>
      </div>

      {/* Content Grid */}
      {activeTab === 'creations' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {userPosts.map((post) => (
            <div
              key={post.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg group hover:border-purple-500/40 transition"
            >
              <img src={post.imageSrc} alt={post.prompt} className="w-full h-44 object-cover" />
              <div className="p-3">
                <p className="text-xs text-gray-300 line-clamp-2 italic mb-2">"{post.prompt}"</p>
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>{post.likesCount} likes</span>
                  <span>{post.createdAt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'reels' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {userReels.map((reel) => (
            <div
              key={reel.id}
              className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-gray-800 shadow-md group"
            >
              <video
                src={reel.videoSrc}
                poster={reel.thumbnailSrc}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                <h5 className="text-xs font-bold text-white line-clamp-1">{reel.title}</h5>
                <span className="text-[10px] text-gray-400">{reel.likesCount} likes</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileView;
