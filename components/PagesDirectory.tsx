import React, { useState } from 'react';
import { FileText, Plus, Users, Check, Sparkles, Search } from 'lucide-react';
import { SocialPage, UserProfile } from '../types/community';
import { getPages, toggleFollowPage } from '../utils/socialStore';

interface PagesDirectoryProps {
  userProfile: UserProfile;
  onCreatePageClick: () => void;
}

export const PagesDirectory: React.FC<PagesDirectoryProps> = ({
  userProfile,
  onCreatePageClick,
}) => {
  const [pages, setPages] = useState<SocialPage[]>(getPages());
  const [searchQuery, setSearchQuery] = useState('');

  const handleFollow = (id: string) => {
    const updated = toggleFollowPage(id);
    setPages(updated);
  };

  const filteredPages = pages.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-900/80 p-4 rounded-3xl border border-gray-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">Creator & Brand Pages</h3>
          </div>
          <p className="text-xs text-gray-400">Discover and follow specialized AI vision studios</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            type="button"
            onClick={onCreatePageClick}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 shrink-0 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Page</span>
          </button>
        </div>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPages.map((page) => (
          <div
            key={page.id}
            className="bg-gray-900 border border-gray-800 hover:border-purple-500/40 rounded-3xl overflow-hidden shadow-xl transition flex flex-col justify-between"
          >
            {/* Cover Image */}
            <div className="h-28 bg-gray-950 relative overflow-hidden">
              {page.coverImage && (
                <img src={page.coverImage} alt="Cover" className="w-full h-full object-cover opacity-80" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
            </div>

            {/* Page Info */}
            <div className="p-4 pt-0 relative flex-1 flex flex-col justify-between">
              <div className="flex items-end justify-between -mt-8 mb-3">
                <img
                  src={page.avatar}
                  alt={page.name}
                  className="w-16 h-16 rounded-2xl border-4 border-gray-900 object-cover shadow-lg"
                />

                <button
                  type="button"
                  onClick={() => handleFollow(page.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm ${
                    page.isFollowing
                      ? 'bg-gray-800 text-teal-300 border border-gray-700'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {page.isFollowing ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-white">{page.name}</h4>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    {page.category}
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-mono block">@{page.username}</span>
                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">{page.description}</p>
              </div>

              <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
                <span className="font-semibold">{page.followersCount} followers</span>
                <span>{page.tags?.slice(0, 2).map((t) => `#${t}`).join(' ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PagesDirectory;
