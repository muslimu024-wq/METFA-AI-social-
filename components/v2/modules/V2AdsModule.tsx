/**
 * METFA V2 — Ads Module (METFA Ads)
 *
 * Universal provider-agnostic sponsored campaign manager and placement delivery engine.
 * Supports end-to-end campaign creation, creative assets, product links, targeting,
 * budget controls, active serving status, and placement delivery queries.
 */

import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Shield,
  Zap,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Eye,
  Sliders,
  Lock,
  ExternalLink,
  Target,
  DollarSign,
  Calendar,
  Sparkles,
  MousePointerClick,
  FileCheck,
} from 'lucide-react';
import { v2AdminEngine } from '../../../services/v2AdminEngine';
import { v2IntegrationAdapter, AdPlacementQuery, AdPlacementResponse } from '../../../services/v2IntegrationAdapter';

export interface V2AdCampaign {
  id: string;
  name: string;
  objective: 'BRAND_AWARENESS' | 'TRAFFIC' | 'CONVERSIONS' | 'VIDEO_VIEWS';
  totalBudgetCents: number;
  dailyBudgetCents: number;
  spentCents: number;
  currency: string;
  bidStrategy: 'AUTO_CPM' | 'MANUAL_CPC';
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  startDate: string;
  endDate?: string;
  creative: {
    headline: string;
    description: string;
    ctaLabel: string;
    destinationUrl: string;
    mediaType: 'image' | 'video';
    mediaUrl: string;
  };
  targeting: {
    countries: string[];
    languages: string[];
    topics: string[];
    minAge: number;
  };
  impressions: number;
  clicks: number;
  createdAt: string;
}

const STORAGE_KEY = 'metfa_v2_ads_campaigns';

const INITIAL_CAMPAIGNS: V2AdCampaign[] = [
  {
    id: 'camp_metfa_001',
    name: 'METFA Creator AI Inpainting Launch',
    objective: 'CONVERSIONS',
    totalBudgetCents: 50000, // $500.00
    dailyBudgetCents: 2500,  // $25.00
    spentCents: 12450,       // $124.50
    currency: 'USD',
    bidStrategy: 'AUTO_CPM',
    status: 'ACTIVE',
    startDate: '2026-10-01',
    creative: {
      headline: 'Next-Gen Multimodal AI Art Studio',
      description: 'Explore neural scene inpainting and high-resolution generative design.',
      ctaLabel: 'Try Creator Studio',
      destinationUrl: 'https://metfa.social/studio',
      mediaType: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    },
    targeting: {
      countries: ['US', 'CA', 'GB', 'BD', 'IN'],
      languages: ['en', 'bn'],
      topics: ['AI Art', 'Design', 'Generative Media'],
      minAge: 18,
    },
    impressions: 48200,
    clicks: 1940,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'camp_metfa_002',
    name: 'Original Audio Sync & Licensing Drive',
    objective: 'VIDEO_VIEWS',
    totalBudgetCents: 30000, // $300.00
    dailyBudgetCents: 1500,  // $15.00
    spentCents: 4500,        // $45.00
    currency: 'USD',
    bidStrategy: 'AUTO_CPM',
    status: 'ACTIVE',
    startDate: '2026-10-03',
    creative: {
      headline: 'Monetize Original Music in 90s Reels',
      description: 'Clear commercial licensing terms and earn attribution CP on every watch.',
      ctaLabel: 'Browse Audio Catalog',
      destinationUrl: 'https://metfa.social/audio',
      mediaType: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
    },
    targeting: {
      countries: ['GLOBAL'],
      languages: ['en'],
      topics: ['Music', 'Reels', 'Sound Production'],
      minAge: 18,
    },
    impressions: 18500,
    clicks: 820,
    createdAt: new Date().toISOString(),
  },
];

export const V2AdsModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'create' | 'placements' | 'governance'>('campaigns');
  const [campaigns, setCampaigns] = useState<V2AdCampaign[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return INITIAL_CAMPAIGNS;
  });

  const [activePlacement, setActivePlacement] = useState<
    'FEED' | 'REELS' | 'EXPLORE' | 'SEARCH' | 'PROFILE'
  >('FEED');

  const [testResult, setTestResult] = useState<AdPlacementResponse | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State for New Campaign
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState<'BRAND_AWARENESS' | 'TRAFFIC' | 'CONVERSIONS' | 'VIDEO_VIEWS'>('CONVERSIONS');
  const [dailyBudgetDollars, setDailyBudgetDollars] = useState('20.00');
  const [totalBudgetDollars, setTotalBudgetDollars] = useState('200.00');
  const [bidStrategy, setBidStrategy] = useState<'AUTO_CPM' | 'MANUAL_CPC'>('AUTO_CPM');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Learn More');
  const [destinationUrl, setDestinationUrl] = useState('https://metfa.social');
  const [mediaUrl, setMediaUrl] = useState('https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&q=80');
  const [targetCountries, setTargetCountries] = useState('US, GB, CA, BD');
  const [targetTopics, setTargetTopics] = useState('Technology, Creators, Social');

  const adsFlag = v2AdminEngine.getFeatureFlag('ads_enabled');
  const isAdsPaused = v2AdminEngine.isAdsPaused();
  const isExternalPaused = v2AdminEngine.isExternalProvidersPaused();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
    } catch {
      // Storage quota failsafe
    }
  }, [campaigns]);

  const handleToggleStatus = (campaignId: string) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === campaignId) {
          const newStatus = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
          return { ...c, status: newStatus };
        }
        return c;
      })
    );
    setSuccessMsg('Campaign status updated successfully.');
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!campaignName.trim() || !headline.trim()) {
      setErrorMsg('Campaign name and headline are required.');
      return;
    }

    const dailyCents = Math.round(parseFloat(dailyBudgetDollars || '0') * 100);
    const totalCents = Math.round(parseFloat(totalBudgetDollars || '0') * 100);

    if (dailyCents <= 0 || totalCents <= 0) {
      setErrorMsg('Please specify valid non-zero budget amounts.');
      return;
    }

    const newCampaign: V2AdCampaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: campaignName.trim(),
      objective,
      totalBudgetCents: totalCents,
      dailyBudgetCents: dailyCents,
      spentCents: 0,
      currency: 'USD',
      bidStrategy,
      status: isAdsPaused ? 'PAUSED' : 'ACTIVE',
      startDate: new Date().toISOString().split('T')[0],
      creative: {
        headline: headline.trim(),
        description: description.trim(),
        ctaLabel,
        destinationUrl: destinationUrl.trim(),
        mediaType: 'image',
        mediaUrl: mediaUrl.trim(),
      },
      targeting: {
        countries: targetCountries.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
        languages: ['en'],
        topics: targetTopics.split(',').map((s) => s.trim()).filter(Boolean),
        minAge: 18,
      },
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString(),
    };

    setCampaigns((prev) => [newCampaign, ...prev]);
    setSuccessMsg(`Campaign "${newCampaign.name}" published successfully.`);
    setActiveTab('campaigns');

    // Reset Form
    setCampaignName('');
    setHeadline('');
    setDescription('');
  };

  const handleTestPlacement = (placement: typeof activePlacement) => {
    setActivePlacement(placement);
    const res = v2IntegrationAdapter.queryAdPlacement({ placement });
    setTestResult(res);
  };

  const totalSpentCents = campaigns.reduce((acc, c) => acc + c.spentCents, 0);
  const totalImpressions = campaigns.reduce((acc, c) => acc + c.impressions, 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
  const activeCount = campaigns.filter((c) => c.status === 'ACTIVE').length;

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
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 max-w-6xl mx-auto py-2">
          <button
            type="button"
            onClick={() => setActiveTab('campaigns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'campaigns' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Campaigns ({campaigns.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('placements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'placements' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Placements & Serving</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'governance' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Governance & Privacy</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Global Performance Telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Active Campaigns</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{activeCount} / {campaigns.length}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Delivered Impressions</span>
            <div className="text-lg font-bold text-indigo-700 mt-0.5">{totalImpressions.toLocaleString()}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Verified Clicks</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{totalClicks.toLocaleString()}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Total Ad Spend</span>
            <div className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">
              ${(totalSpentCents / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* TAB 1: CAMPAIGNS LIST */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Managed Sponsored Campaigns
              </h2>
              <span className="text-xs text-slate-500">
                Provider-Agnostic Isolation Active
              </span>
            </div>

            {campaigns.length === 0 ? (
              <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
                <Megaphone className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500">No campaigns created yet.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
                >
                  Create First Campaign
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      {camp.creative.mediaUrl && (
                        <img
                          src={camp.creative.mediaUrl}
                          alt={camp.creative.headline}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{camp.name}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              camp.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {camp.status}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                            {camp.objective}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          {camp.creative.headline} — <span className="text-slate-400 font-normal">{camp.creative.description}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono pt-1">
                          <span>Budget: ${(camp.totalBudgetCents / 100).toFixed(2)}</span>
                          <span>Daily: ${(camp.dailyBudgetCents / 100).toFixed(2)}</span>
                          <span>Spent: ${(camp.spentCents / 100).toFixed(2)}</span>
                          <span>Impr: {camp.impressions.toLocaleString()}</span>
                          <span>Clicks: {camp.clicks.toLocaleString()}</span>
                          <span>Target: {camp.targeting.countries.join(', ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={camp.creative.destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Link</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(camp.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          camp.status === 'ACTIVE'
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {camp.status === 'ACTIVE' ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREATE CAMPAIGN FORM */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateCampaign} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Create Real Sponsored Campaign
              </h2>
              <p className="text-xs text-slate-500">
                Configure creative assets, destination product links, audience targeting, and daily spend limits.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Autumn Creator Drive"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Objective *</label>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="CONVERSIONS">Conversions (Product / Signups)</option>
                  <option value="TRAFFIC">Traffic (Link Clicks)</option>
                  <option value="BRAND_AWARENESS">Brand Awareness</option>
                  <option value="VIDEO_VIEWS">Video Views (Reels)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Daily Budget ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={dailyBudgetDollars}
                  onChange={(e) => setDailyBudgetDollars(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Total Budget ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={totalBudgetDollars}
                  onChange={(e) => setTotalBudgetDollars(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Ad Headline *</label>
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Catchy headline displayed on sponsored card"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Ad Description / Body</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Primary promotional copy explaining the offer"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Call-to-Action (CTA)</label>
                <select
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="Learn More">Learn More</option>
                  <option value="Shop Now">Shop Now</option>
                  <option value="Sign Up">Sign Up</option>
                  <option value="Try Studio">Try Studio</option>
                  <option value="Listen Now">Listen Now</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Destination / Product Link URL *</label>
                <input
                  type="url"
                  required
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Media Asset URL (Image/Banner) *</label>
                <input
                  type="url"
                  required
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Target Countries (comma separated)</label>
                <input
                  type="text"
                  value={targetCountries}
                  onChange={(e) => setTargetCountries(e.target.value)}
                  placeholder="US, CA, GB, BD"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Target Content Topics (comma separated)</label>
                <input
                  type="text"
                  value={targetTopics}
                  onChange={(e) => setTargetTopics(e.target.value)}
                  placeholder="AI, Music, Art, Gaming"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('campaigns')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                Publish Campaign
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: PLACEMENTS & SERVING */}
        {activeTab === 'placements' && (
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
        )}

        {/* TAB 4: GOVERNANCE & PRIVACY */}
        {activeTab === 'governance' && (
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
        )}
      </div>
    </div>
  );
};

export default V2AdsModule;
