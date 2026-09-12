/**
 * METFA V2 — App Grid Component
 *
 * Displays the 16 canonical V2 modules in a clean, modern, responsive grid:
 * - Desktop: balanced 4-column layout
 * - Tablet: 3-column layout
 * - Mobile: compact, touch-friendly 2-column layout with no horizontal overflow
 * - Labels are strictly shortened (no "METFA" repetition)
 * - Accessible focus, semantic hover feedback, and clear Lucide icons
 */

import React from 'react';
import {
  ShieldCheck,
  Megaphone,
  CircleDollarSign,
  Sparkles,
  Gift,
  ShieldAlert,
  Wallet,
  Banknote,
  Bot,
  Siren,
  Briefcase,
  Users,
  Palette,
  Music,
  Sliders,
  FileCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { V2ModuleMetadata, V2ModuleId } from '../../types/v2';
import { V2_MODULE_REGISTRY } from '../../data/v2Registry';

interface V2AppGridProps {
  onSelectModule: (moduleId: V2ModuleId) => void;
  activeModuleId?: V2ModuleId | null;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  ShieldCheck,
  Megaphone,
  CircleDollarSign,
  Sparkles,
  Gift,
  ShieldAlert,
  Wallet,
  Banknote,
  Bot,
  Siren,
  Briefcase,
  Users,
  Palette,
  Music,
  Sliders,
  FileCheck,
};

// Subtle icon container color accents matching the module domain
const ACCENT_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  verified: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'group-hover:ring-blue-200' },
  ads: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'group-hover:ring-emerald-200' },
  revenue: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'group-hover:ring-amber-200' },
  contribution: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'group-hover:ring-purple-200' },
  rewards: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'group-hover:ring-rose-200' },
  risk: { bg: 'bg-red-50', text: 'text-red-600', ring: 'group-hover:ring-red-200' },
  wallet: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'group-hover:ring-indigo-200' },
  payout: { bg: 'bg-teal-50', text: 'text-teal-600', ring: 'group-hover:ring-teal-200' },
  'operations-ai': { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'group-hover:ring-violet-200' },
  signal: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'group-hover:ring-orange-200' },
  work: { bg: 'bg-cyan-50', text: 'text-cyan-600', ring: 'group-hover:ring-cyan-200' },
  'freelancer-team': { bg: 'bg-sky-50', text: 'text-sky-600', ring: 'group-hover:ring-sky-200' },
  creator: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', ring: 'group-hover:ring-fuchsia-200' },
  audio: { bg: 'bg-pink-50', text: 'text-pink-600', ring: 'group-hover:ring-pink-200' },
  'admin-control': { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'group-hover:ring-slate-300' },
  'governance-audit': { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'group-hover:ring-emerald-200' },
};

export const V2AppGrid: React.FC<V2AppGridProps> = ({ onSelectModule, activeModuleId }) => {
  return (
    <div className="w-full">
      {/* 16 Canonical App Grid Items */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {V2_MODULE_REGISTRY.map((mod: V2ModuleMetadata) => {
          const IconComponent = ICON_MAP[mod.iconName] || Info;
          const accent = ACCENT_MAP[mod.id] || {
            bg: 'bg-purple-50',
            text: 'text-purple-600',
            ring: 'group-hover:ring-purple-200',
          };
          const isSelected = activeModuleId === mod.id;

          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onSelectModule(mod.id)}
              className={`group text-left p-3 sm:p-4 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between relative overflow-hidden bg-white shadow-2xs hover:shadow-xs active:scale-[0.98] ${
                isSelected
                  ? 'border-purple-600 ring-2 ring-purple-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Top Row: Icon + Optional Badge */}
              <div className="flex items-start justify-between w-full mb-3">
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${accent.bg} ${accent.text} flex items-center justify-center transition-transform group-hover:scale-105 shrink-0`}
                >
                  <IconComponent className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                </div>

                {mod.badge ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide">
                    {mod.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                )}
              </div>

              {/* Bottom: Short Label + Subtitle */}
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors truncate">
                  {mod.shortLabel}
                </h3>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                  {mod.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default V2AppGrid;
