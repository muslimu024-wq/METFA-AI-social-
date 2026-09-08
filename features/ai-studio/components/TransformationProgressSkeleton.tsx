import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Wand2,
  Brain,
  Layers,
  Clock,
  ArrowRight,
  Palette,
  Image as ImageIcon,
  Cpu,
  CheckCircle2,
} from 'lucide-react';

export interface TransformationProgressSkeletonProps {
  prompt?: string;
  stylePreset?: string;
  referenceImageSrc?: string;
  activeEngine?: string;
  activeModel?: string;
  compact?: boolean;
}

interface StepInfo {
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const TRANSFORMATION_STAGES: StepInfo[] = [
  {
    label: 'Analyzing Prompt & Input',
    sublabel: 'Deconstructing composition & reference tokens',
    icon: Brain,
  },
  {
    label: 'Neural Diffusion Synthesis',
    sublabel: 'Generating latent color palettes & textures',
    icon: Palette,
  },
  {
    label: 'Detail & Lighting Pass',
    sublabel: 'Volumetric illumination, reflections & depth',
    icon: Layers,
  },
  {
    label: 'Finalizing High-Res Render',
    sublabel: 'Super-resolution pixel pass & rendering output',
    icon: Sparkles,
  },
];

export const TransformationProgressSkeleton: React.FC<TransformationProgressSkeletonProps> = ({
  prompt = '',
  stylePreset,
  referenceImageSrc,
  activeEngine = 'gemini',
  activeModel = 'gemini-3.8-flash',
  compact = false,
}) => {
  const [progress, setProgress] = useState<number>(8);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  // Dynamic progressive timer simulating real neural generation lifecycle
  useEffect(() => {
    const startTime = Date.now();

    const timerInterval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    const progressInterval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;

      setProgress((currentProgress) => {
        // Easing curve: quick start, steady middle, asymptotic approach to 96%
        if (elapsedMs < 2000) {
          // 0 - 2s: 8% -> 28%
          return Math.min(28, currentProgress + 4);
        } else if (elapsedMs < 6000) {
          // 2s - 6s: 28% -> 62%
          return Math.min(62, currentProgress + 2.5);
        } else if (elapsedMs < 11000) {
          // 6s - 11s: 62% -> 86%
          return Math.min(86, currentProgress + 1.2);
        } else if (elapsedMs < 18000) {
          // 11s - 18s: 86% -> 94%
          return Math.min(94, currentProgress + 0.6);
        } else {
          // > 18s: gently approach 97%
          return Math.min(97, currentProgress + 0.2);
        }
      });
    }, 250);

    return () => {
      clearInterval(timerInterval);
      clearInterval(progressInterval);
    };
  }, []);

  // Determine active stage index based on current progress
  const currentStageIndex =
    progress < 25 ? 0 : progress < 58 ? 1 : progress < 84 ? 2 : 3;

  const currentStage = TRANSFORMATION_STAGES[currentStageIndex];
  const StageIcon = currentStage.icon;

  const formattedTime = `${Math.floor(secondsElapsed / 60)
    .toString()
    .padStart(2, '0')}:${(secondsElapsed % 60).toString().padStart(2, '0')}s`;

  const engineLabel =
    activeEngine === 'openai'
      ? 'DALL-E 3 / GPT-4o'
      : activeEngine === 'grok'
      ? 'xAI Grok'
      : 'Gemini 3.7 Flash Diffusion';

  return (
    <div
      id="ai-transformation-skeleton-container"
      className={`w-full flex gap-2.5 sm:gap-4 items-start transition-all animate-fadeIn ${
        compact ? 'p-1' : ''
      }`}
    >
      {/* Bot Avatar with Active Glowing Pulse */}
      {!compact && (
        <div className="relative shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-400 flex items-center justify-center shadow-md animate-pulse">
            <Wand2 className="w-4 sm:w-5 h-4 sm:h-5 text-white animate-spin [animation-duration:4s]" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-teal-400 border-2 border-white rounded-full animate-ping" />
        </div>
      )}

      {/* Main Skeleton Card */}
      <div
        className={`flex-1 min-w-0 bg-white border border-purple-200/80 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden ${
          compact ? 'p-3' : 'p-4 sm:p-5'
        }`}
      >
        {/* Top Header & Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
            </span>
            <span className="text-xs sm:text-sm font-bold bg-gradient-to-r from-purple-700 via-indigo-700 to-teal-600 bg-clip-text text-transparent">
              {referenceImageSrc ? 'Transforming Image' : 'Generating AI Visual Scene'}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200/70 text-purple-700 font-semibold hidden xs:inline-flex">
              {engineLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {stylePreset && stylePreset !== 'None' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center gap-1">
                <Palette className="w-2.5 h-2.5" />
                <span className="truncate max-w-[120px]">{stylePreset}</span>
              </span>
            )}
            <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200/60">
              <Clock className="w-3 h-3 text-gray-400" />
              <span>{formattedTime}</span>
            </span>
          </div>
        </div>

        {/* Dynamic Progress Bar Section */}
        <div className="mt-3.5 flex flex-col gap-2">
          {/* Progress Header Row: Current Action & Percentage */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0 font-medium text-gray-700">
              <StageIcon className="w-3.5 h-3.5 text-purple-600 shrink-0 animate-bounce [animation-duration:2s]" />
              <span className="font-semibold text-purple-900 truncate">
                {currentStage.label}
              </span>
              <span className="text-gray-400 hidden sm:inline">•</span>
              <span className="text-gray-500 text-[11px] truncate hidden sm:inline">
                {currentStage.sublabel}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2 font-mono font-bold text-xs text-purple-700">
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Progress Bar Track with Gradient Glow */}
          <div className="relative w-full h-2.5 bg-purple-50 rounded-full overflow-hidden border border-purple-100 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-400 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            >
              {/* Shimmer Light Streak passing across the bar */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-sweep" />
            </div>
          </div>

          {/* 4-Step Milestone Progress Track */}
          <div className="grid grid-cols-4 gap-1 sm:gap-2 mt-1">
            {TRANSFORMATION_STAGES.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <div
                  key={stage.label}
                  className={`flex flex-col items-center gap-1 py-1 px-1 rounded-lg transition-all ${
                    isCurrent
                      ? 'bg-purple-50/80 border border-purple-200 shadow-2xs'
                      : isCompleted
                      ? 'opacity-80'
                      : 'opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-teal-600" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                    )}
                    <span
                      className={`text-[9px] sm:text-[10px] font-semibold truncate ${
                        isCurrent
                          ? 'text-purple-800'
                          : isCompleted
                          ? 'text-teal-700'
                          : 'text-gray-400'
                      }`}
                    >
                      Step {idx + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Visual Skeleton Canvas Placeholder */}
        <div className="mt-4 w-full">
          {referenceImageSrc ? (
            /* Dual Transformation Layout: Original Reference -> Emerging Skeleton */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80">
              {/* Left: Original Reference Photo */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 px-1">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-purple-600" />
                    <span>Original Reference</span>
                  </span>
                  <span className="text-[10px] text-gray-400">Input Photo</span>
                </div>
                <div className="relative aspect-video sm:aspect-square w-full rounded-xl overflow-hidden bg-gray-900 border border-gray-300 shadow-inner flex items-center justify-center">
                  <img
                    src={referenceImageSrc}
                    alt="Reference to transform"
                    className="w-full h-full object-cover opacity-85"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 text-[10px] text-white/90 truncate font-mono bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded">
                    Source Photo
                  </div>
                </div>
              </div>

              {/* Right: AI Synthesis Skeleton Preview */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-purple-800 px-1">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-600 animate-spin [animation-duration:5s]" />
                    <span>Synthesizing Result</span>
                  </span>
                  <span className="text-[10px] font-mono text-purple-600">1024×1024</span>
                </div>
                <div className="relative aspect-video sm:aspect-square w-full rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 via-slate-100 to-indigo-100 border-2 border-dashed border-purple-300/80 flex flex-col items-center justify-center p-4">
                  {/* Subtle Scanning Holographic Beam */}
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-shimmer-sweep opacity-75 shadow-[0_0_12px_rgba(45,212,191,0.8)]" />

                  {/* Shimmer Pulse Background */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-200/30 via-transparent to-teal-200/30 animate-pulse" />

                  {/* Centered Holographic Ring */}
                  <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/90 border border-purple-200 shadow-md flex items-center justify-center">
                      <Wand2 className="w-6 h-6 text-purple-600 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-gray-800">
                        {stylePreset || 'Re-imagining Visual'}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        Computing Diffusion Latents...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Single Visual Scene Skeleton Canvas */
            <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full rounded-2xl overflow-hidden bg-gradient-to-br from-purple-50 via-slate-100 to-teal-50/40 border border-purple-200/80 p-4 sm:p-6 flex flex-col items-center justify-center text-center shadow-inner">
              {/* Shimmer Scanning Beam */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-shimmer-sweep opacity-70" />
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-200/20 via-transparent to-indigo-200/20 animate-pulse" />

              {/* Glowing Center Badge */}
              <div className="relative z-10 flex flex-col items-center gap-2 max-w-md">
                <div className="relative">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white shadow-md border border-purple-200 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 animate-spin [animation-duration:6s]" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-teal-400 rounded-full border-2 border-white animate-ping" />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs sm:text-sm font-bold text-gray-800">
                    Neural Image Diffusion Active
                  </span>
                  {prompt && (
                    <p className="text-[11px] text-gray-500 italic max-w-sm line-clamp-1">
                      "{prompt}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Skeleton Caption & Action Button Placeholders */}
        <div className="mt-3.5 pt-3 border-t border-gray-100 flex flex-col gap-2.5">
          {/* Skeleton Text Lines simulating Assistant output */}
          <div className="flex flex-col gap-1.5 w-full">
            <div className="h-3.5 bg-slate-200 rounded-full w-4/5 animate-pulse" />
            <div className="h-3 bg-slate-200 rounded-full w-3/5 animate-pulse" />
          </div>

          {/* Skeleton Action Pill Buttons Placeholder */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <div className="h-7 w-20 bg-slate-100 border border-slate-200/60 rounded-xl animate-pulse" />
              <div className="h-7 w-24 bg-slate-100 border border-slate-200/60 rounded-xl animate-pulse" />
              <div className="h-7 w-20 bg-slate-100 border border-slate-200/60 rounded-xl animate-pulse hidden sm:block" />
            </div>

            <span className="text-[10px] text-gray-400 font-mono">
              Rendering in progress...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransformationProgressSkeleton;
