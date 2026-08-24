import React, { useState, useEffect } from 'react';
import { Video, X, Zap, CheckCircle2, Gift, Sparkles } from 'lucide-react';

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardClaimed: (amount: number) => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  onClose,
  onRewardClaimed,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [rewardReady, setRewardReady] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCountdown(5);
      setRewardReady(false);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isPlaying && countdown === 0) {
      setRewardReady(true);
    }
    return () => clearInterval(timer);
  }, [isPlaying, countdown]);

  if (!isOpen) return null;

  const handleStartAd = () => {
    setIsPlaying(true);
    setCountdown(5);
  };

  const handleClaim = () => {
    onRewardClaimed(2);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden text-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full bg-gray-800/60 hover:bg-gray-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {!isPlaying && !rewardReady && (
          <div>
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-400 mx-auto flex items-center justify-center shadow-lg shadow-purple-600/30 mb-4">
              <Gift className="w-8 h-8 text-white" />
            </div>

            <h3 className="text-xl font-black text-white mb-1">Get 2 Free Generation Credits!</h3>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Watch a quick 5-second sponsored presentation to unlock 2 immediate multimodal AI scene generations.
            </p>

            <button
              type="button"
              onClick={handleStartAd}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white font-bold text-sm rounded-2xl shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition transform active:scale-95"
            >
              <Video className="w-4 h-4" />
              <span>Watch Video (5s)</span>
            </button>
          </div>
        )}

        {isPlaying && !rewardReady && (
          <div className="py-6">
            <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-gray-950 border border-purple-800/40 flex flex-col items-center justify-center mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 to-teal-900/30 animate-pulse" />
              <Sparkles className="w-10 h-10 text-teal-400 mb-2 relative z-10 animate-bounce" />
              <h4 className="text-base font-extrabold text-white relative z-10">Metfa Cloud Studio Partner</h4>
              <p className="text-xs text-purple-300 relative z-10">Ultra-fast GPU Inference & Vision</p>

              <div className="absolute bottom-3 right-3 bg-black/80 px-2.5 py-1 rounded-full text-xs font-bold text-teal-300 border border-teal-500/30">
                Reward in {countdown}s
              </div>
            </div>

            <p className="text-xs text-gray-400">Please wait while the sponsored preview finishes...</p>
          </div>
        )}

        {rewardReady && (
          <div className="py-2 animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-teal-500/20 border border-teal-500/40 mx-auto flex items-center justify-center shadow-lg mb-4">
              <CheckCircle2 className="w-8 h-8 text-teal-400" />
            </div>

            <h3 className="text-xl font-black text-white mb-1">Reward Ready!</h3>
            <p className="text-sm text-gray-300 mb-6">
              You have completed the preview. Claim your <strong>+2 Free AI Credits</strong> now.
            </p>

            <button
              type="button"
              onClick={handleClaim}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold text-sm rounded-2xl shadow-xl shadow-teal-600/30 flex items-center justify-center gap-2 transition transform active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current text-amber-300" />
              <span>Claim +2 Credits</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardedAdModal;
