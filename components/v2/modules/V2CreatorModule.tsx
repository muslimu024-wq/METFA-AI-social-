/**
 * METFA V2 — Creator Module (METFA Creator)
 *
 * Creator studio analytics, audience reach insights, and monetization status.
 * Connects directly to v2ContributionEngine qualification policies and v2WalletEngine earnings summary.
 */

import React from 'react';
import {
  Palette,
  Sparkles,
  TrendingUp,
  Award,
  Gift,
  Wallet,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Layers,
} from 'lucide-react';
import { v2ContributionEngine } from '../../../services/v2ContributionEngine';
import { v2WalletEngine } from '../../../services/v2WalletEngine';

export const V2CreatorModule: React.FC = () => {
  const contributionHealth = v2ContributionEngine.getEngineHealth();
  const policies = v2ContributionEngine.listPolicies();
  const walletHealth = v2WalletEngine.getEngineHealth();

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-xs">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Creator
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  <Sparkles className="w-3 h-3 mr-1 text-amber-600" />
                  Economy Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Creator studio analytics, audience reach insights, and monetization status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Contribution Points Evaluated: <strong className="text-amber-700 font-bold">{contributionHealth.total_qualified_points.toLocaleString()} CP</strong></span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Network Qualified CP</span>
            <div className="text-lg font-bold text-amber-600 mt-0.5 font-mono">
              {contributionHealth.total_qualified_points.toLocaleString()}
            </div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Active Creator Wallets</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {walletHealth.total_wallets}
            </div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Active Policies</span>
            <div className="text-lg font-bold text-purple-600 mt-0.5">
              {policies.length} Policies
            </div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Monetization Invariant</span>
            <div className="text-xs font-bold text-emerald-700 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Revenue Verified</span>
            </div>
          </div>
        </div>

        {/* Dynamic Qualification Policies */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Live Creator Qualification & Point Policies
              </h2>
              <p className="text-xs text-slate-500">
                Dynamic contribution rules governing qualified engagement, video/audio attribution, and quality multipliers.
              </p>
            </div>
            <span className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
              v2ContributionEngine.listPolicies
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {policies.map((p) => (
              <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 font-mono">{p.action}</span>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Tier: {p.eligibility_tier_required} • Cooldown: {p.cooldown_seconds}s • Daily Limit: {p.daily_limit_points} CP
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="text-right">
                    <div className="font-bold text-slate-800">Base: {p.base_points} CP</div>
                    <div className="text-[11px] text-purple-700 font-mono">Max: {p.quality_multiplier_max}x Multiplier</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Creator Economy Principles */}
        <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>METFA Creator Economy Principles</span>
          </div>
          <ul className="text-xs text-amber-950/90 space-y-1.5 leading-relaxed">
            <li>• <strong>No Fixed Dollar Promise:</strong> Contribution points (CP) reflect genuine platform engagement. Rewards depend exclusively on audited net revenue pools.</li>
            <li>• <strong>Anti-Farming Protection:</strong> Rapid self-reactions, automated loop bots, and watch farming are detected by METFA Risk and excluded from point pools.</li>
            <li>• <strong>Audio Attribution:</strong> Creators using original creator music in 90s Reels attribute points to the original audio copyright holder.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default V2CreatorModule;
