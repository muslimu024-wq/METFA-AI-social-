/**
 * METFA V2 — Ads Module (METFA Ads)
 *
 * Universal provider-agnostic sponsored campaign manager and placement delivery engine.
 * Connects directly to v2AdminEngine feature flags, emergency kill switches, and v2IntegrationAdapter placement queries.
 */

import React, { useState } from 'react';
import {
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Shield,
  Zap,
  Play,
  Radio,
  RefreshCw,
  Eye,
  Sliders,
  Lock,
} from 'lucide-react';
import { v2AdminEngine } from '../../../services/v2AdminEngine';
import { v2IntegrationAdapter } from '../../../services/v2IntegrationAdapter';

export const V2AdsModule: React.FC = () => {
  const [activePlacement, setActivePlacement] = useState<
    'FEED' | 'REELS' | 'EXPLORE' | 'SEARCH' | 'PROFILE'
  >('FEED');

  const [testResult, setTestResult] = useState<ReturnType<
    typeof v2IntegrationAdapter.queryAdPlacement
  > | null>(null);

  const adsFlag = v2AdminEngine.getFeatureFlag('ads_enabled');
  const isAdsPaused = v2AdminEngine.isAdsPaused();
  const isExternalPaused = v2AdminEngine.isExternalProvidersPaused();

  const handleTestPlacement = (placement: typeof activePlacement) => {
    setActivePlacement(placement);
    const res = v2IntegrationAdapter.queryAdPlacement({ placement });
    setTestResult(res);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center text-white shadow-xs">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Ads
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                    !isAdsPaused && adsFlag?.enabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full mr-1.5 ${
                      !isAdsPaused && adsFlag?.enabled ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {!isAdsPaused && adsFlag?.enabled ? 'Active Serving Hook' : 'Gated / Paused'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Universal provider-agnostic sponsored campaign manager and placement delivery engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Provider Adapter: <code className="font-mono font-bold text-indigo-700">INTERNAL_METFA_ADS_V2</code>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-slate-500">Canonical Feature Flag</span>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-bold ${
                  adsFlag?.enabled ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                ads_enabled: {adsFlag?.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Authorized roles: {adsFlag?.allowedRoles.join(', ') || 'ADMIN'}
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-slate-500">Emergency Kill Switch</span>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-bold ${
                  isAdsPaused ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                ads_paused: {isAdsPaused ? 'PAUSED' : 'ACTIVE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Immediate containment for uncontrolled delivery
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-slate-500">External Provider Isolation</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-purple-700">
                {isExternalPaused ? 'ISOLATED (INTERNAL ONLY)' : 'PROVIDER-AGNOSTIC READY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Zero external tracking scripts or cookies permitted
            </p>
          </div>
        </div>

        {/* Interactive Placement Query Tester */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Provider-Agnostic Placement Query Tester
              </h2>
              <p className="text-xs text-slate-500">
                Execute authoritative placement queries against v2IntegrationAdapter to test delivery eligibility.
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
              v2IntegrationAdapter.queryAdPlacement
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'FEED', label: 'Feed Slot', desc: 'In-feed native sponsored card' },
              { id: 'REELS', label: 'Reels Slot', desc: 'Interstitial video slot' },
              { id: 'EXPLORE', label: 'Explore Slot', desc: 'Discovery grid banner' },
              { id: 'SEARCH', label: 'Search Slot', desc: 'Contextual keyword ad' },
              { id: 'PROFILE', label: 'Profile Slot', desc: 'Non-intrusive creator slot' },
            ].map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleTestPlacement(slot.id as any)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  activePlacement === slot.id
                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">{slot.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{slot.desc}</div>
              </button>
            ))}
          </div>

          {testResult && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Query Evaluation Result:</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    testResult.eligible
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {testResult.eligible ? 'ELIGIBLE TO SERVE' : 'INELIGIBLE'}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-600 bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                <div>Placement: <span className="font-bold text-slate-900">{testResult.placement}</span></div>
                <div>Ad Serving Active: <span className="font-bold text-slate-900">{String(testResult.adServingActive)}</span></div>
                <div>Provider Adapter: <span className="font-bold text-indigo-700">{testResult.providerAdapter}</span></div>
                <div>Reason: <span className="text-slate-700">{testResult.reason}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Architecture & Safety Rules */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Sponsored Ads Architectural Directives
          </h3>
          <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Privacy By Design:</strong> Third-party tracking cookies, device fingerprinters, and pixel leaks are strictly blocked by the client sandbox.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Provider-Agnostic Adapter:</strong> All ads pass through standard <code className="font-mono text-slate-700">UniversalAdCreative</code> schemas, isolating core social feeds from ad network changes.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span><strong>Emergency Kill Switch:</strong> Platform operators can immediately shut off ad injection system-wide without deploying code.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default V2AdsModule;
