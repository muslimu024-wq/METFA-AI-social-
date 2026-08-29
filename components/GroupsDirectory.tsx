import React, { useState, useEffect } from 'react';
import { Users, Plus, Check, Search, Shield, Lock, Globe } from 'lucide-react';
import { SocialGroup, UserProfile } from '../types/community';
import { getGroups, toggleJoinGroup } from '../utils/socialStore';

interface GroupsDirectoryProps {
  userProfile: UserProfile;
  onCreateGroupClick: () => void;
}

export const GroupsDirectory: React.FC<GroupsDirectoryProps> = ({
  userProfile,
  onCreateGroupClick,
}) => {
  const [groups, setGroups] = useState<SocialGroup[]>(getGroups());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleGroupsUpdated = (e: any) => {
      if (e.detail) setGroups(e.detail);
      else setGroups(getGroups());
    };

    window.addEventListener('metfa_groups_updated', handleGroupsUpdated);
    return () => window.removeEventListener('metfa_groups_updated', handleGroupsUpdated);
  }, []);

  const handleJoin = (id: string) => {
    const updated = toggleJoinGroup(id);
    setGroups(updated);
  };

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-900/80 p-4 rounded-3xl border border-gray-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-bold text-white">Community Groups</h3>
          </div>
          <p className="text-xs text-gray-400">Join creator circles, share prompt recipes and inpainting tips</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <button
            type="button"
            onClick={onCreateGroupClick}
            className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 shrink-0 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGroups.map((group) => (
          <div
            key={group.id}
            className="bg-gray-900 border border-gray-800 hover:border-teal-500/40 rounded-3xl overflow-hidden shadow-xl transition flex flex-col justify-between"
          >
            {/* Cover Image */}
            <div className="h-24 bg-gray-950 relative overflow-hidden">
              {group.coverImage && (
                <img src={group.coverImage} alt="Cover" className="w-full h-full object-cover opacity-75" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
            </div>

            {/* Info */}
            <div className="p-4 pt-0 relative flex-1 flex flex-col justify-between">
              <div className="flex items-end justify-between -mt-7 mb-3">
                <img
                  src={group.avatar}
                  alt={group.name}
                  className="w-14 h-14 rounded-2xl border-4 border-gray-900 object-cover shadow-lg"
                />

                <button
                  type="button"
                  onClick={() => handleJoin(group.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm ${
                    group.isJoined
                      ? 'bg-gray-800 text-teal-300 border border-gray-700'
                      : 'bg-teal-600 hover:bg-teal-500 text-white'
                  }`}
                >
                  {group.isJoined ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Joined</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Join Group</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white">{group.name}</h4>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    {group.privacy === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {group.privacy === 'public' ? 'Public Group' : 'Private Group'}
                  </span>
                  <span>•</span>
                  <span>{group.category}</span>
                </div>
                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">{group.description}</p>
              </div>

              <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
                <span className="font-semibold text-teal-300">{group.membersCount} members</span>
                <span>{group.postsCount} creations shared</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroupsDirectory;
