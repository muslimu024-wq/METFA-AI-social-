import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Sparkles,
  RotateCcw,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  Wand2,
  CornerDownLeft,
} from 'lucide-react';
import {
  RecentPromptItem,
  getRecentPrompts,
  deleteRecentPrompt,
  clearAllRecentPrompts,
} from '../utils/promptHistoryStore';

interface RecentPromptHistoryListProps {
  onSelectPrompt: (promptText: string, stylePreset?: string) => void;
  currentInput?: string;
  maxDisplayCount?: number;
}

export const RecentPromptHistoryList: React.FC<RecentPromptHistoryListProps> = ({
  onSelectPrompt,
  currentInput = '',
  maxDisplayCount = 12,
}) => {
  const [prompts, setPrompts] = useState<RecentPromptItem[]>(() => getRecentPrompts());
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justSelectedId, setJustSelectedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize prompts when updated elsewhere via window event
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail?.prompts) {
        setPrompts(e.detail.prompts);
      } else {
        setPrompts(getRecentPrompts());
      }
    };

    window.addEventListener('metfa_ai_recent_prompts_updated', handleUpdate);
    return () => window.removeEventListener('metfa_ai_recent_prompts_updated', handleUpdate);
  }, []);

  const handlePromptClick = (item: RecentPromptItem) => {
    onSelectPrompt(item.prompt, item.stylePreset);
    setJustSelectedId(item.id);
    setTimeout(() => {
      setJustSelectedId(null);
    }, 1200);
  };

  const handleDeleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteRecentPrompt(id);
    setPrompts(updated);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Clear all recent prompts from your history?')) {
      clearAllRecentPrompts();
      setPrompts([]);
    }
  };

  const handleCopyPrompt = (e: React.MouseEvent, item: RecentPromptItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.prompt);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (prompts.length === 0) {
    return (
      <div
        id="recent-prompts-history-empty"
        className="w-full max-w-5xl xl:max-w-6xl mt-1.5 px-2 flex items-center justify-between text-[11px] text-gray-500"
      >
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-gray-400" />
          <span>Recent transformation prompts will appear here automatically.</span>
        </span>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('metfa_ai_recent_prompts_history_v1');
            setPrompts(getRecentPrompts());
          }}
          className="text-purple-600 hover:text-purple-700 font-medium hover:underline cursor-pointer"
        >
          Load Starter Inspiration
        </button>
      </div>
    );
  }

  const displayedPrompts = isExpanded ? prompts : prompts.slice(0, maxDisplayCount);

  return (
    <div
      id="recent-prompts-history-bar"
      className="w-full max-w-5xl xl:max-w-6xl mt-1.5 sm:mt-2 px-1 flex flex-col gap-1.5 transition-all"
    >
      {/* Header Controls Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-purple-600" />
          <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
            Recent Prompts
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-semibold">
            {prompts.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {prompts.length > 4 && (
            <button
              type="button"
              id="recent-prompts-toggle-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] font-medium text-purple-600 hover:text-purple-700 flex items-center gap-0.5 hover:underline cursor-pointer"
            >
              <span>{isExpanded ? 'Collapse' : `View all (${prompts.length})`}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          <button
            type="button"
            id="recent-prompts-clear-all-btn"
            onClick={handleClearAll}
            className="text-[11px] text-gray-400 hover:text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
            title="Clear all recent prompts"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Prompts Scroll or Grid List */}
      <div
        ref={scrollContainerRef}
        className={`w-full transition-all duration-200 ${
          isExpanded
            ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin'
            : 'flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin'
        }`}
      >
        {displayedPrompts.map((item, idx) => {
          const isSelected = justSelectedId === item.id;
          const isExactMatch = currentInput.trim().toLowerCase() === item.prompt.toLowerCase();

          return (
            <div
              key={item.id || idx}
              id={`recent-prompt-chip-${item.id}`}
              onClick={() => handlePromptClick(item)}
              title={`Click to reuse: "${item.prompt}"`}
              className={`group/chip relative flex items-center justify-between gap-1.5 transition-all border rounded-xl cursor-pointer ${
                isExpanded ? 'p-2' : 'px-2.5 py-1 shrink-0 max-w-[260px] sm:max-w-[320px]'
              } ${
                isSelected
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm scale-98'
                  : isExactMatch
                  ? 'bg-purple-50/80 text-purple-900 border-purple-300 ring-1 ring-purple-400/50'
                  : 'bg-white hover:bg-purple-50/40 text-gray-700 hover:text-gray-900 border-gray-200 hover:border-purple-300 shadow-2xs'
              }`}
            >
              {/* Left Indicator & Prompt Text */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {isSelected ? (
                  <Check className="w-3 h-3 text-white shrink-0 animate-bounce" />
                ) : (
                  <Sparkles
                    className={`w-3 h-3 shrink-0 ${
                      item.stylePreset ? 'text-purple-600' : 'text-gray-400 group-hover/chip:text-purple-500'
                    }`}
                  />
                )}

                <span
                  className={`text-xs whitespace-nowrap truncate font-medium ${
                    isSelected ? 'text-white font-semibold' : ''
                  }`}
                >
                  {item.prompt}
                </span>
              </div>

              {/* Style preset badge or quick action */}
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {item.stylePreset && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                      isSelected
                        ? 'bg-purple-700 text-white'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {item.stylePreset.split(' ')[0]}
                  </span>
                )}

                {/* Reuse icon indicator */}
                <span
                  className={`p-0.5 rounded transition ${
                    isSelected
                      ? 'text-white'
                      : 'text-gray-400 group-hover/chip:text-purple-600'
                  }`}
                  title="Click to insert into input field"
                >
                  <CornerDownLeft className="w-3 h-3" />
                </span>

                {/* Copy prompt button */}
                <button
                  type="button"
                  onClick={(e) => handleCopyPrompt(e, item)}
                  className={`p-0.5 rounded transition opacity-0 group-hover/chip:opacity-100 cursor-pointer ${
                    isSelected
                      ? 'text-white hover:bg-purple-700'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Copy prompt to clipboard"
                >
                  {copiedId === item.id ? (
                    <Check className="w-2.5 h-2.5 text-teal-400" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                </button>

                {/* Delete prompt button */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteItem(e, item.id)}
                  className={`p-0.5 rounded transition opacity-0 group-hover/chip:opacity-100 cursor-pointer ${
                    isSelected
                      ? 'text-white hover:bg-rose-700'
                      : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                  title="Remove prompt from history"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentPromptHistoryList;
