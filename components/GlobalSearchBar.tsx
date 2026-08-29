import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Users,
  Compass,
  Sparkles,
  ChevronRight,
  Flame,
  Check,
  Globe,
  Lock,
  Tag,
  ArrowRight,
  Layers,
  Heart,
  Repeat,
  SlidersHorizontal,
  ExternalLink,
  Mic,
  MicOff,
  Loader2
} from 'lucide-react';
import { CommunityPost, SocialGroup } from '../types/community';
import { getCommunityPosts } from '../utils/communityStore';
import { getGroups, toggleJoinGroup } from '../utils/socialStore';

interface GlobalSearchBarProps {
  onNavigateTab: (tabId: string) => void;
  className?: string;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  onNavigateTab,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'posts' | 'groups'>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [groups, setGroups] = useState<SocialGroup[]>([]);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseQueryRef = useRef<string>('');

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Load initial data and subscribe to updates
  useEffect(() => {
    const loadData = () => {
      setPosts(getCommunityPosts());
      setGroups(getGroups());
    };

    loadData();

    const handlePostsUpdated = (e: any) => {
      if (e.detail) setPosts(e.detail);
      else setPosts(getCommunityPosts());
    };

    const handleGroupsUpdated = (e: any) => {
      if (e.detail) setGroups(e.detail);
      else setGroups(getGroups());
    };

    window.addEventListener('metfa_posts_updated', handlePostsUpdated);
    window.addEventListener('metfa_groups_updated', handleGroupsUpdated);

    return () => {
      window.removeEventListener('metfa_posts_updated', handlePostsUpdated);
      window.removeEventListener('metfa_groups_updated', handleGroupsUpdated);
    };
  }, []);

  // Global Keyboard shortcut: Cmd+K / Ctrl+K / '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'k' && (e.metaKey || e.ctrlKey)) ||
        (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')
      ) {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setIsMobileSearchOpen(false);
        inputRef.current?.blur();
        mobileInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter posts and groups
  const trimmedQuery = query.trim().toLowerCase();

  const matchedPosts = trimmedQuery
    ? posts.filter((p) => {
        const promptMatch = p.prompt?.toLowerCase().includes(trimmedQuery);
        const captionMatch = p.caption?.toLowerCase().includes(trimmedQuery);
        const authorMatch =
          p.author?.name?.toLowerCase().includes(trimmedQuery) ||
          p.author?.username?.toLowerCase().includes(trimmedQuery);
        const pageMatch = p.pageName?.toLowerCase().includes(trimmedQuery);
        const groupMatch = p.groupName?.toLowerCase().includes(trimmedQuery);
        const styleMatch = p.stylePreset?.toLowerCase().includes(trimmedQuery);
        const tagsMatch = p.tags?.some((t) => t.toLowerCase().includes(trimmedQuery));
        return (
          promptMatch ||
          captionMatch ||
          authorMatch ||
          pageMatch ||
          groupMatch ||
          styleMatch ||
          tagsMatch
        );
      })
    : [];

  const matchedGroups = trimmedQuery
    ? groups.filter((g) => {
        const nameMatch = g.name?.toLowerCase().includes(trimmedQuery);
        const handleMatch = g.handle?.toLowerCase().includes(trimmedQuery);
        const descMatch = g.description?.toLowerCase().includes(trimmedQuery);
        const categoryMatch = g.category?.toLowerCase().includes(trimmedQuery);
        const rulesMatch = g.rules?.some((r) => r.toLowerCase().includes(trimmedQuery));
        return nameMatch || handleMatch || descMatch || categoryMatch || rulesMatch;
      })
    : [];

  const totalMatches = matchedPosts.length + matchedGroups.length;

  const handleJoinGroup = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    const updated = toggleJoinGroup(groupId);
    setGroups(updated);
  };

  const handleSelectPost = (post: CommunityPost) => {
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    onNavigateTab('feed');
    // Dispatch event so CommunityFeed can highlight/scroll to the post
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metfa_feed_focus_post', { detail: post.id }));
    }
  };

  const handleSelectGroup = (group: SocialGroup) => {
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    onNavigateTab('groups');
  };

  const handleQuickTagClick = (tag: string) => {
    setQuery(tag);
    setIsOpen(true);
    inputRef.current?.focus();
    mobileInputRef.current?.focus();
  };

  const highlightMatch = (text: string, highlight: string) => {
    if (!highlight.trim() || !text) return text;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-purple-500/30 text-purple-200 font-semibold px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser.');
      setTimeout(() => setSpeechError(null), 3000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Error stopping speech recognition:', e);
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      const autoDetectedLang =
        typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
      recognition.lang = autoDetectedLang;
      recognition.maxAlternatives = 1;

      baseQueryRef.current = query;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setIsOpen(true);
      };

      recognition.onresult = (event: any) => {
        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            sessionFinal += transcriptChunk;
          } else {
            sessionInterim += transcriptChunk;
          }
        }

        const currentSessionTranscript = (
          sessionFinal + (sessionInterim ? ' ' + sessionInterim : '')
        ).trim();
        const base = baseQueryRef.current.trim();
        const updated = base
          ? `${base} ${currentSessionTranscript}`
          : currentSessionTranscript;

        setQuery(updated);
        if (!isOpen) setIsOpen(true);
      };

      recognition.onerror = (event: any) => {
        console.warn('Search speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone permission blocked. Please allow mic access in your browser.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Speech error: ${event.error}`);
        }
        setIsListening(false);
        setTimeout(() => setSpeechError(null), 3500);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Speech recognition start error:', err);
      setSpeechError('Could not start speech recognition.');
      setIsListening(false);
      setTimeout(() => setSpeechError(null), 3000);
    }
  };

  const popularSuggestions = [
    { label: 'Cyberpunk 2088', icon: Sparkles, type: 'style' },
    { label: 'Gemini AI Vision Lab', icon: Layers, type: 'page' },
    { label: 'Neural Scene Inpainters', icon: Users, type: 'group' },
    { label: 'Volumetric Lighting', icon: Flame, type: 'tag' },
    { label: 'DigitalArt', icon: Tag, type: 'tag' },
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Search Icon Trigger Button for Header */}
      <button
        type="button"
        id="header-search-btn"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="p-2 rounded-xl text-gray-300 hover:text-white bg-gray-900 border border-gray-800 hover:border-purple-500/50 transition cursor-pointer flex items-center justify-center shrink-0"
        title="Search Posts, Prompts & Groups (Cmd+K)"
      >
        <Search className="w-5 h-5 text-purple-300" />
      </button>

      {/* Full-featured Global Search Modal Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-20 px-3 pb-6 animate-fadeIn"
          onClick={() => {
            if (isListening && recognitionRef.current) {
              try {
                recognitionRef.current.stop();
              } catch {}
              setIsListening(false);
            }
            setIsOpen(false);
          }}
        >
          <div
            ref={containerRef}
            className="w-full max-w-2xl bg-gray-950 border border-gray-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-left animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Search Input Header */}
            <div className="p-3 sm:p-4 bg-gray-900/90 border-b border-gray-800 flex items-center gap-2.5">
              <Search className="w-5 h-5 text-purple-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                id="global-modal-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isListening ? 'Listening for speech...' : 'Search posts, prompts, tags, groups...'}
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none"
              />

              {/* Speech Recognition Mic Button */}
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2 rounded-xl transition flex items-center justify-center shrink-0 ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse shadow-sm shadow-rose-500/40'
                    : 'text-gray-400 hover:text-purple-300 hover:bg-gray-800'
                }`}
                title={isListening ? 'Stop dictation' : 'Dictate with voice'}
              >
                <Mic className={`w-4 h-4 ${isListening ? 'text-rose-400 animate-bounce' : ''}`} />
              </button>

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition shrink-0"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isListening && recognitionRef.current) {
                    try {
                      recognitionRef.current.stop();
                    } catch {}
                    setIsListening(false);
                  }
                  setIsOpen(false);
                }}
                className="px-2.5 py-1.5 text-xs font-bold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 transition shrink-0"
              >
                ESC
              </button>
            </div>

            {speechError && (
              <div className="p-2.5 bg-rose-950/70 border-b border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
                <span>{speechError}</span>
                <button type="button" onClick={() => setSpeechError(null)} className="text-rose-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isListening && (
              <div className="p-2.5 bg-rose-950/40 border-b border-rose-800/50 flex items-center gap-2 text-rose-300 text-xs animate-pulse">
                <Mic className="w-4 h-4 text-rose-400 animate-bounce" />
                <span className="font-semibold">Listening... Speak now to fill search terms</span>
              </div>
            )}

            {/* Results / Suggestions Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {renderDropdownContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderDropdownContent() {
    return (
      <>
        {/* Category Filter Tabs (When searching) */}
        {trimmedQuery && (
          <div className="p-2.5 bg-gray-950/80 border-b border-gray-800/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                  activeCategory === 'all'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-850'
                }`}
              >
                <span>All</span>
                <span className="text-[9px] bg-gray-900/80 px-1 py-0.2 rounded-full font-mono">
                  {totalMatches}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('posts')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                  activeCategory === 'posts'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-850'
                }`}
              >
                <Compass className="w-3 h-3" />
                <span>Posts</span>
                <span className="text-[9px] bg-gray-900/80 px-1 py-0.2 rounded-full font-mono">
                  {matchedPosts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('groups')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                  activeCategory === 'groups'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-850'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Groups</span>
                <span className="text-[9px] bg-gray-900/80 px-1 py-0.2 rounded-full font-mono">
                  {matchedGroups.length}
                </span>
              </button>
            </div>

            <span className="text-[10px] text-gray-500 font-mono">
              {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
            </span>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
          {/* If query is empty: Suggestions & Trends */}
          {!trimmedQuery ? (
            <div className="p-3 space-y-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mb-2.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Popular Creator Searches & Tags</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {popularSuggestions.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickTagClick(item.label)}
                        className="px-2.5 py-1.5 bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/40 rounded-xl text-xs text-gray-300 hover:text-white transition flex items-center gap-1.5 active:scale-95"
                      >
                        <IconComp className="w-3 h-3 text-purple-400" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Directory Shortcuts */}
              <div className="pt-3 border-t border-gray-800/80">
                <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-2">
                  <span>Explore Direct Channels</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsMobileSearchOpen(false);
                      onNavigateTab('feed');
                    }}
                    className="p-2.5 rounded-xl bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/40 transition flex items-center gap-2 text-left"
                  >
                    <div className="p-1.5 rounded-lg bg-purple-950 text-purple-400">
                      <Compass className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">Community Feed</span>
                      <span className="text-[10px] text-gray-500 block truncate">Latest AI artworks</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsMobileSearchOpen(false);
                      onNavigateTab('groups');
                    }}
                    className="p-2.5 rounded-xl bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-teal-500/40 transition flex items-center gap-2 text-left"
                  >
                    <div className="p-1.5 rounded-lg bg-teal-950 text-teal-400">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">Creator Groups</span>
                      <span className="text-[10px] text-gray-500 block truncate">{groups.length} active circles</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : totalMatches === 0 ? (
            /* Empty State */
            <div className="p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-950 border border-gray-800 flex items-center justify-center mx-auto text-gray-500">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">No matches found for "{query}"</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Try searching for keywords like "Cyberpunk", "Inpainting", or artist names.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {['Cyberpunk', 'Gemini', 'Submerged', 'Fantasy'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleQuickTagClick(s)}
                    className="px-2 py-1 bg-gray-950 hover:bg-gray-800 border border-gray-800 text-[10px] text-purple-300 rounded-lg"
                  >
                    #{s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Groups Results Section */}
              {(activeCategory === 'all' || activeCategory === 'groups') && matchedGroups.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      <span>Community Groups ({matchedGroups.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setIsMobileSearchOpen(false);
                        onNavigateTab('groups');
                      }}
                      className="text-[10px] text-gray-400 hover:text-white lowercase flex items-center gap-0.5"
                    >
                      <span>view all</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {matchedGroups.map((group) => (
                      <div
                        key={group.id}
                        onClick={() => handleSelectGroup(group)}
                        className="p-2.5 rounded-xl bg-gray-950/80 hover:bg-gray-850 border border-gray-800/90 hover:border-teal-500/50 transition cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <img
                            src={group.avatar}
                            alt={group.name}
                            className="w-9 h-9 rounded-xl object-cover border border-teal-500/30 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition truncate">
                                {highlightMatch(group.name, trimmedQuery)}
                              </h4>
                              {group.privacy === 'private' ? (
                                <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              ) : (
                                <Globe className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 truncate">
                              {highlightMatch(group.description || group.handle, trimmedQuery)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-500">
                              <span className="text-teal-400/90">{group.category}</span>
                              <span>•</span>
                              <span>{group.membersCount.toLocaleString()} members</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleJoinGroup(e, group.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 active:scale-95 ${
                            group.isJoined
                              ? 'bg-teal-950/80 text-teal-300 border border-teal-800/60 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-800'
                              : 'bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow'
                          }`}
                        >
                          {group.isJoined ? 'Joined' : 'Join'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts Results Section */}
              {(activeCategory === 'all' || activeCategory === 'posts') && matchedPosts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3 h-3" />
                      <span>Community Posts & Prompts ({matchedPosts.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setIsMobileSearchOpen(false);
                        onNavigateTab('feed');
                      }}
                      className="text-[10px] text-gray-400 hover:text-white lowercase flex items-center gap-0.5"
                    >
                      <span>view in feed</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {matchedPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => handleSelectPost(post)}
                        className="p-2.5 rounded-xl bg-gray-950/80 hover:bg-gray-850 border border-gray-800/90 hover:border-purple-500/50 transition cursor-pointer flex items-start gap-3 group"
                      >
                        {/* Thumbnail */}
                        {post.imageSrc && (
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-900 border border-gray-800 shrink-0 relative">
                            <img
                              src={post.imageSrc}
                              alt="Post artwork"
                              className="w-full h-full object-cover group-hover:scale-105 transition transform duration-300"
                            />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Author & Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <img
                                src={post.author.avatar}
                                alt={post.author.name}
                                className="w-4 h-4 rounded-full object-cover shrink-0"
                              />
                              <span className="text-[11px] font-bold text-white group-hover:text-purple-300 transition truncate">
                                {highlightMatch(post.author.name, trimmedQuery)}
                              </span>
                              {post.pageName && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 shrink-0 truncate">
                                  {post.pageName}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-gray-500 shrink-0">{post.createdAt}</span>
                          </div>

                          {/* Prompt / Caption snippet */}
                          <p className="text-[11px] text-gray-300 line-clamp-2 leading-snug">
                            {highlightMatch(post.prompt || post.caption || '', trimmedQuery)}
                          </p>

                          {/* Tags & Stats Footer */}
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {post.stylePreset && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-900 text-teal-300 border border-gray-800">
                                  {post.stylePreset}
                                </span>
                              )}
                              {post.tags?.slice(0, 2).map((t, idx) => (
                                <span key={idx} className="text-[9px] text-gray-400">
                                  #{t}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-gray-400 shrink-0">
                              <span className="flex items-center gap-0.5">
                                <Heart className="w-2.5 h-2.5 text-rose-400" />
                                {post.likesCount || 0}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Repeat className="w-2.5 h-2.5 text-teal-400" />
                                {post.remixCount || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Dropdown Footer */}
        {trimmedQuery && totalMatches > 0 && (
          <div className="p-2 bg-gray-950 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-400 shrink-0 px-3">
            <span>Click any result to jump directly to feed or groups</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsMobileSearchOpen(false);
                onNavigateTab(activeCategory === 'groups' ? 'groups' : 'feed');
              }}
              className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
            >
              <span>Explore All Results</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </>
    );
  }
};

export default GlobalSearchBar;
