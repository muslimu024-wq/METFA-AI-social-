/**
 * METFA V2 — Reusable Module Viewport Shell
 *
 * Provides the unified layout for any opened V2 module:
 * - Full METFA product name using BrandTitle
 * - Clean back navigation to the V2 Dashboard
 * - Consistent header, icon, description, and status badges
 * - Professional empty/foundation state placeholder (NO fake numbers, campaigns, or mock data)
 * - Safe responsive design with zero horizontal overflow
 */

import React from 'react';
import {
  ArrowLeft,
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
  CheckCircle2,
  Info,
} from 'lucide-react';
import BrandTitle from '../BrandTitle';
import { V2ModuleMetadata } from '../../types/v2';
import V2RevenueModule from './modules/V2RevenueModule';
import V2ContributionModule from './modules/V2ContributionModule';
import V2RewardModule from './modules/V2RewardModule';
import V2WalletModule from './modules/V2WalletModule';
import V2RiskModule from './modules/V2RiskModule';
import V2AdminControlModule from './modules/V2AdminControlModule';
import V2GovernanceAuditModule from './modules/V2GovernanceAuditModule';

interface V2ModuleViewportProps {
  module: V2ModuleMetadata;
  onBackToDashboard: () => void;
  children?: React.ReactNode;
}

// Icon mapping matching the V2 registry
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

export const V2ModuleViewport: React.FC<V2ModuleViewportProps> = ({
  module,
  onBackToDashboard,
  children,
}) => {
  const IconComponent = ICON_MAP[module.iconName] || Info;

  // Extract service title (strip "METFA " prefix to feed into BrandTitle)
  const serviceName = module.fullProductName.replace(/^METFA\s+/, '');

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 overflow-y-auto">
      {/* 1. Sub-Header with Back Navigation & Master Brand Title */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="p-1.5 sm:p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Back to V2 Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
            <span className="hidden sm:inline text-xs font-semibold text-slate-600">
              Dashboard
            </span>
          </button>

          <div className="h-4 w-px bg-slate-200 shrink-0 mx-0.5 sm:mx-1" />

          {/* Module Icon & Master Brand Title */}
          <div className="flex items-center gap-2 min-w-0 truncate">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <IconComponent className="w-4 h-4" />
            </div>

            <BrandTitle
              service={serviceName}
              size="base"
              theme="light"
              asHeading={true}
              className="truncate"
            />
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 border border-purple-200 text-purple-700">
            <CheckCircle2 className="w-3 h-3 text-purple-600" />
            <span>V2 Foundation</span>
          </span>
        </div>
      </div>

      {/* 2. Main Content Slot or Professional Neutral Empty State */}
      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
        {children ? (
          children
        ) : module.id === 'revenue' ? (
          <V2RevenueModule />
        ) : module.id === 'contribution' ? (
          <V2ContributionModule />
        ) : module.id === 'rewards' ? (
          <V2RewardModule />
        ) : module.id === 'wallet' ? (
          <V2WalletModule />
        ) : module.id === 'risk' ? (
          <V2RiskModule />
        ) : module.id === 'admin-control' ? (
          <V2AdminControlModule />
        ) : module.id === 'governance-audit' ? (
          <V2GovernanceAuditModule />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mb-4 shadow-inner">
              <IconComponent className="w-8 h-8" />
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
              {module.fullProductName}
            </h2>

            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
              {module.description}
            </p>

            {/* Strict Non-Mock Empty State Directives */}
            <div className="w-full max-w-lg bg-slate-50 rounded-xl border border-slate-200/80 p-4 text-left space-y-2 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Info className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Foundation Ready</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                The {module.fullProductName} architectural contracts, TypeScript interfaces, and permission schemas are established. The execution engine will be activated in a subsequent release phase.
              </p>
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>Internal Identifier: <code className="text-slate-600 font-mono">{module.id}</code></span>
                <span>Category: <span className="capitalize text-slate-600 font-medium">{module.category}</span></span>
              </div>
            </div>

            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to App Grid</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default V2ModuleViewport;
