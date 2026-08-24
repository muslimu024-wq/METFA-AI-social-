import React from 'react';
import {
  Sparkles,
  Compass,
  Film,
  Radio,
  FileText,
  Users,
  User
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
  feedCount?: number;
  creditsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigateTab,
}) => {
  const tabs = [
    { id: 'chat', label: 'AI Studio', icon: Sparkles },
    { id: 'feed', label: 'Feed', icon: Compass },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'live', label: 'Live', icon: Radio, isLive: true },
    { id: 'pages', label: 'Pages', icon: FileText },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="shrink-0 w-full bg-gray-950/95 backdrop-blur-xl border-t border-gray-800/90 py-1.5 px-2 z-40">
      <div className="max-w-md sm:max-w-xl mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigateTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition relative group ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition ${
                  isActive
                    ? 'bg-gradient-to-tr from-purple-600 to-teal-500 shadow-md shadow-purple-600/30'
                    : 'group-hover:bg-gray-850'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    tab.isLive && isActive ? 'text-white' : tab.isLive ? 'text-rose-400' : ''
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-semibold mt-0.5 tracking-tight ${
                  isActive ? 'text-purple-300 font-bold' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>

              {isActive && (
                <div className="absolute -bottom-1 w-4 h-0.5 bg-gradient-to-r from-purple-400 to-teal-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
