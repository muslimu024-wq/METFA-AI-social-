import React, { useState } from 'react';
import { Zap, Plus, Video } from 'lucide-react';
import { DailyCreditsData } from '../utils/creditManager';

interface CreditsBadgeProps {
  creditsData: DailyCreditsData;
  onWatchAdClick?: () => void;
  compact?: boolean;
}

export const CreditsBadge: React.FC<CreditsBadgeProps> = ({
  creditsData,
  onWatchAdClick,
  compact = false,
}) => {
  const remaining = creditsData?.remainingCredits ?? 0;
  const isOutOfCredits = remaining <= 0;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
            isOutOfCredits
              ? 'bg-red-950/70 border-red-500/50 text-red-300 animate-pulse'
              : 'bg-gray-850 border-gray-800 text-teal-300'
          }`}
          title={`Remaining Free Prompts Today: ${remaining}`}
        >
          <Zap className={`w-3.5 h-3.5 ${isOutOfCredits ? 'text-red-400' : 'text-amber-400 fill-amber-400'}`} />
          <span className="font-bold text-white text-xs">{remaining}</span>
          <span className="text-gray-400 text-[10px] hidden sm:inline">credits</span>
        </div>

        {onWatchAdClick && (
          <button
            type="button"
            onClick={onWatchAdClick}
            className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition transform active:scale-95"
            title="Watch short sponsored video for +2 credits"
          >
            <Video className="w-3 h-3" />
            <span className="text-[11px]">+2</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isOutOfCredits ? 'bg-red-950 text-red-400' : 'bg-purple-950 text-amber-400'
        }`}>
          <Zap className="w-5 h-5 fill-current" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-gray-100">
              Remaining Free Prompts Today: <span className={isOutOfCredits ? 'text-red-400 text-base' : 'text-teal-400 text-base'}>{remaining}</span>
            </h4>
            <span className="text-[11px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full border border-gray-700">
              Daily Reset
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {isOutOfCredits ? 'Out of free credits. Watch a short video to get 2 more.' : 'Resets every 24 hours at midnight.'}
          </p>
        </div>
      </div>

      {onWatchAdClick && (
        <button
          type="button"
          onClick={onWatchAdClick}
          className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition transform active:scale-95"
        >
          <Video className="w-3.5 h-3.5" />
          <span>+2 Credits</span>
        </button>
      )}
    </div>
  );
};

export default CreditsBadge;
