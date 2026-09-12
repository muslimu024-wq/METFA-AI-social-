/**
 * METFA V2 — Master Dashboard View
 *
 * Central container for METFA V2:
 * - Displays the App Grid with all 16 canonical modules
 * - Manages active selected module state
 * - Mounts the reusable V2ModuleViewport when a module is selected
 * - Preserves BrandTitle styling matching the existing Home header
 * - Light/Dark adaptive styling matching the METFA Social shell
 */

import React, { useState } from 'react';
import { LayoutGrid, Sparkles, Shield, ArrowLeft } from 'lucide-react';
import BrandTitle from '../BrandTitle';
import V2AppGrid from './V2AppGrid';
import V2ModuleViewport from './V2ModuleViewport';
import { V2ModuleId, V2ModuleMetadata } from '../../types/v2';
import { V2_MODULE_REGISTRY } from '../../data/v2Registry';

interface V2DashboardProps {
  onBackToSocial?: () => void;
}

export const V2Dashboard: React.FC<V2DashboardProps> = ({ onBackToSocial }) => {
  const [selectedModuleId, setSelectedModuleId] = useState<V2ModuleId | null>(null);

  // Find metadata for the currently opened module
  const activeModule: V2ModuleMetadata | undefined = selectedModuleId
    ? V2_MODULE_REGISTRY.find((m) => m.id === selectedModuleId)
    : undefined;

  // If a module is selected, render the reusable viewport shell
  if (activeModule) {
    return (
      <V2ModuleViewport
        module={activeModule}
        onBackToDashboard={() => setSelectedModuleId(null)}
      />
    );
  }

  // Otherwise, render the main METFA V2 Dashboard with the App Grid
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 overflow-y-auto">
      {/* 1. Dashboard Master Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBackToSocial && (
            <button
              type="button"
              onClick={onBackToSocial}
              className="p-1.5 sm:p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0"
              title="Return to Social Feed"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
              <span className="hidden sm:inline text-xs font-semibold text-slate-600">
                Feed
              </span>
            </button>
          )}

          {/* Master Brand Title: METFA V2 Dashboard */}
          <div className="flex items-center gap-2 min-w-0 truncate">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <BrandTitle
              service="V2 Dashboard"
              size="lg"
              theme="light"
              asHeading={true}
              className="truncate"
            />
          </div>
        </div>

        {/* Foundation Tag */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-purple-500/10 to-teal-500/10 border border-purple-200 text-purple-700">
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>Master Foundation</span>
          </span>
        </div>
      </div>

      {/* 2. Dashboard Body & App Grid */}
      <div className="flex-1 p-3 sm:p-6 max-w-5xl mx-auto w-full space-y-4 sm:space-y-6">
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-semibold text-purple-200 mb-2">
              <Shield className="w-3 h-3 text-teal-300" />
              <span>Unified Internal Infrastructure</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white mb-1.5">
              METFA V2 Operations & Economy
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/90 leading-relaxed">
              Provider-agnostic internal systems for verification, sponsored campaigns, revenue ledgers, risk controls, and automated orchestration.
            </p>
          </div>
          {/* Subtle Background Glow */}
          <div className="absolute right-0 top-0 -bottom-10 w-64 bg-gradient-to-l from-teal-500/20 to-transparent pointer-events-none" />
        </div>

        {/* 3. The 16 Canonical Modules App Grid */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Core Modules (16)
            </h3>
            <span className="text-[11px] text-slate-400">
              Select any module to open
            </span>
          </div>

          <V2AppGrid onSelectModule={(id) => setSelectedModuleId(id)} />
        </div>
      </div>
    </div>
  );
};

export default V2Dashboard;
