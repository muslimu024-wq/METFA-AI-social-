import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, Wand2 } from 'lucide-react';

export interface AiRecipeBoxProps {
  prompt: string;
  stylePreset?: string;
  onRemixPrompt?: (prompt: string, stylePreset?: string) => void;
  className?: string;
}

/**
 * AiRecipeBox - Strictly OPT-IN (Default Closed)
 *
 * 1. Initial visibility state is hidden: showRecipe = false.
 * 2. Does NOT render prompt container by default under post images.
 * 3. Renders a compact "✨ AI Recipe" / "Remix" trigger button.
 * 4. Clicking reveals the expanded prompt card.
 * 5. Contains an explicit ❌ (Close) button to collapse back anytime.
 */
export const AiRecipeBox: React.FC<AiRecipeBoxProps> = ({
  prompt,
  stylePreset,
  onRemixPrompt,
  className = '',
}) => {
  // STRICT DEFAULT CLOSED STATE: Opt-in only
  const [showRecipe, setShowRecipe] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!prompt || !prompt.trim()) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemix = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemixPrompt?.(prompt.trim(), stylePreset);
  };

  return (
    <div className={`mt-2 ${className}`}>
      {!showRecipe ? (
        // USER-TRIGGERED COMPACT TOGGLE BUTTON (DEFAULT CLOSED)
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRecipe(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/60 hover:border-purple-700 text-purple-300 hover:text-purple-200 text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm group"
            title="View AI Prompt Recipe & Parameters"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span>AI Recipe</span>
          </button>

          {onRemixPrompt && (
            <button
              type="button"
              onClick={handleRemix}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-xl transition cursor-pointer"
              title="Remix prompt directly in AI Studio"
            >
              <Wand2 className="w-3 h-3 text-teal-400" />
              <span>Remix</span>
            </button>
          )}
        </div>
      ) : (
        // EXPANDED AI RECIPE CONTAINER WITH EXPLICIT CLOSE BUTTON (❌)
        <div className="p-3.5 bg-gray-950/95 border border-purple-800/60 rounded-2xl space-y-2.5 shadow-xl animate-fadeIn backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                AI Recipe & Prompt
              </span>
              {stylePreset && (
                <span className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded-md font-mono">
                  {stylePreset}
                </span>
              )}
            </div>

            {/* Explicit Close Button ❌ */}
            <button
              type="button"
              onClick={() => setShowRecipe(false)}
              className="p-1 text-gray-400 hover:text-rose-400 hover:bg-gray-800/80 rounded-lg transition cursor-pointer"
              title="Close AI Recipe (Collapse)"
              aria-label="Close AI Recipe"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt Body */}
          <div className="p-2.5 bg-gray-900/90 rounded-xl border border-gray-800 text-xs text-gray-200 font-mono leading-relaxed select-text">
            <p className="italic">"{prompt}"</p>
          </div>

          {/* Action Bar inside Recipe Box */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:text-teal-300 bg-gray-900 hover:bg-gray-850 rounded-lg border border-gray-800 transition cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied Prompt' : 'Copy Prompt'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRecipe(false)}
                className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 transition font-medium cursor-pointer"
              >
                Hide
              </button>

              {onRemixPrompt && (
                <button
                  type="button"
                  onClick={handleRemix}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Remix in Studio</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiRecipeBox;
