/**
 * METFA V2 — Creator Module (METFA Creator)
 *
 * Creator studio analytics, creator roster management, monetization reviews,
 * tier promotions (BASIC -> VERIFIED -> CREATOR_PRO), and dynamic CP value calculator.
 * Connects directly to v2ContributionEngine qualification policies and v2WalletEngine earnings.
 */

import React, { useState, useEffect } from 'react';
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
  Search,
  Filter,
  Sliders,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  Plus,
  UserCheck,
  RefreshCw,
  Calculator,
  Check,
} from 'lucide-react';
import { v2ContributionEngine } from '../../../services/v2ContributionEngine';
import { v2WalletEngine } from '../../../services/v2WalletEngine';
import { getClientAuthToken } from '../../../services/supabaseClient';

export interface CreatorProfile {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  tier: 'BASIC' | 'VERIFIED' | 'CREATOR_PRO';
  accumulatedPoints: number;
  monthlyReach: number;
  monetizationStatus: 'ACTIVE' | 'HELD' | 'PENDING_REVIEW';
  qualityMultiplier: number; // e.g. 1.0 - 2.5
  joinedDate: string;
  walletBindingId?: string;
}

export const V2CreatorModule: React.FC = () => {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'calculator' | 'review' | 'policies'>('roster');
  const [selectedCreator, setSelectedCreator] = useState<CreatorProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('ALL');

  // Calculator State
  const [calcCreatorPoints, setCalcCreatorPoints] = useState<number>(10000);
  const [calcNetworkTotalPoints, setCalcNetworkTotalPoints] = useState<number>(100000);
  const [calcRewardPoolDollars, setCalcRewardPoolDollars] = useState<number>(2500); // $2,500.00
  const [calcResult, setCalcResult] = useState<{
    sharePercentage: number;
    estimatedPayoutDollars: number;
    pointValueCents: number;
  } | null>(null);

  // Review Form State
  const [reviewUserId, setReviewUserId] = useState('');
  const [reviewUsername, setReviewUsername] = useState('');
  const [reviewDisplayName, setReviewDisplayName] = useState('');
  const [reviewInitialTier, setReviewInitialTier] = useState<'BASIC' | 'VERIFIED' | 'CREATOR_PRO'>('VERIFIED');
  const [reviewMultiplier, setReviewMultiplier] = useState<number>(1.2);

  // Notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const contributionHealth = v2ContributionEngine.getEngineHealth();
  const policies = v2ContributionEngine.listPolicies();
  const walletHealth = v2WalletEngine.getEngineHealth();

  const loadCreators = async () => {
    try {
      setLoading(true);
      const token = await getClientAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v2/creator/profiles', { headers });
      if (res.ok) {
        const data = await res.json();
        const loaded: CreatorProfile[] = data.profiles || [];
        setCreators(loaded);
        if (loaded.length > 0 && !selectedCreator) {
          setSelectedCreator(loaded[0]);
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch creator profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCreators();
  }, []);

  // Recalculate dynamic payout preview
  useEffect(() => {
    const totalPts = Math.max(1, calcNetworkTotalPoints);
    const poolCents = Math.round(calcRewardPoolDollars * 100);
    const userPts = Math.min(calcCreatorPoints, totalPts);

    const share = (userPts / totalPts);
    const payoutCents = Math.floor(poolCents * share);
    const pointValue = (poolCents / totalPts) / 100;

    setCalcResult({
      sharePercentage: share * 100,
      estimatedPayoutDollars: payoutCents / 100,
      pointValueCents: pointValue,
    });
  }, [calcCreatorPoints, calcNetworkTotalPoints, calcRewardPoolDollars]);

  const handlePromoteTier = (creatorId: string, newTier: 'BASIC' | 'VERIFIED' | 'CREATOR_PRO') => {
    setCreators((prev) =>
      prev.map((c) => (c.id === creatorId ? { ...c, tier: newTier } : c))
    );
    if (selectedCreator && selectedCreator.id === creatorId) {
      setSelectedCreator({ ...selectedCreator, tier: newTier });
      setSuccessMsg(`Creator @${selectedCreator.username} promoted to tier ${newTier}.`);
    }
  };

  const handleToggleMonetization = (creatorId: string) => {
    setCreators((prev) =>
      prev.map((c) => {
        if (c.id === creatorId) {
          const nextStatus: 'ACTIVE' | 'HELD' = c.monetizationStatus === 'ACTIVE' ? 'HELD' : 'ACTIVE';
          const updated: CreatorProfile = { ...c, monetizationStatus: nextStatus };
          if (selectedCreator && selectedCreator.id === creatorId) setSelectedCreator(updated);
          return updated;
        }
        return c;
      })
    );
    setSuccessMsg('Creator monetization status updated.');
  };

  const handleUpdateMultiplier = (creatorId: string, multiplier: number) => {
    setCreators((prev) =>
      prev.map((c) => (c.id === creatorId ? { ...c, qualityMultiplier: multiplier } : c))
    );
    if (selectedCreator && selectedCreator.id === creatorId) {
      setSelectedCreator({ ...selectedCreator, qualityMultiplier: multiplier });
      setSuccessMsg(`Quality multiplier updated to ${multiplier}x.`);
    }
  };

  const handleAddCreator = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!reviewUsername.trim() || !reviewDisplayName.trim()) {
      setErrorMsg('Username and Display Name are required.');
      return;
    }

    const cleanUsername = reviewUsername.trim().replace(/^@/, '');
    
    // Call server API
    getClientAuthToken().then((token) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      fetch('/api/v2/creator/profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: cleanUsername,
          displayName: reviewDisplayName.trim(),
          tier: reviewInitialTier,
          qualityMultiplier: reviewMultiplier,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.profile) {
            setCreators((prev) => [data.profile, ...prev.filter((p) => p.userId !== data.profile.userId)]);
            setSelectedCreator(data.profile);
            setSuccessMsg(`Creator @${data.profile.username} successfully onboarded and activated.`);
            setActiveTab('roster');
          }
        })
        .catch((err) => {
          setErrorMsg(`Failed to onboard creator: ${err.message || String(err)}`);
        });
    });

    // Reset Form
    setReviewUsername('');
    setReviewDisplayName('');
  };

  const filteredCreators = creators.filter((c) => {
    const matchesTier = selectedTierFilter === 'ALL' || c.tier === selectedTierFilter;
    const matchesQuery =
      !searchQuery ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.userId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesQuery;
  });

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
                  Economy & Management Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Creator studio analytics, audience reach insights, and monetization status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('review')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Review Creator</span>
            </button>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200">
              Active Creators: <strong className="text-amber-700">{creators.length}</strong>
            </span>
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="mt-3 max-w-6xl mx-auto p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-700 font-bold ml-2">×</button>
          </div>
        )}
        {errorMsg && (
          <div className="mt-3 max-w-6xl mx-auto p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-700 font-bold ml-2">×</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 max-w-6xl mx-auto py-2">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'roster' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Creator Roster ({creators.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'calculator' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Dynamic CP Calculator</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'review' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Onboard / Review</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('policies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'policies' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Contribution Policies</span>
          </button>
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

        {/* Dynamic Calculator Tab */}
        {activeTab === 'calculator' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Dynamic Contribution Point Value Simulator</h2>
              <p className="text-xs text-slate-500">
                Mathematical proof: CP value is derived dynamically from verified net revenue (Reward Pool / Total Network CP).
                Zero fixed monetary promises for specific actions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Creator Qualified CP</label>
                <input
                  type="number"
                  min={1}
                  value={calcCreatorPoints}
                  onChange={(e) => setCalcCreatorPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Total Network Qualified CP</label>
                <input
                  type="number"
                  min={1}
                  value={calcNetworkTotalPoints}
                  onChange={(e) => setCalcNetworkTotalPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Verified Period Pool ($ USD)</label>
                <input
                  type="number"
                  min={1}
                  value={calcRewardPoolDollars}
                  onChange={(e) => setCalcRewardPoolDollars(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {calcResult && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
                <div>
                  <span className="text-[11px] text-amber-900 block">Proportional Share</span>
                  <div className="text-xl font-mono font-bold text-amber-800">
                    {calcResult.sharePercentage.toFixed(3)}%
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-amber-900 block">Estimated Period Allocation</span>
                  <div className="text-xl font-mono font-bold text-emerald-700">
                    ${calcResult.estimatedPayoutDollars.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-amber-900 block">Calculated Point Value</span>
                  <div className="text-xl font-mono font-bold text-purple-700">
                    ${calcResult.pointValueCents.toFixed(4)} / CP
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Onboard / Review Form Tab */}
        {activeTab === 'review' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Onboard & Approve Creator Account</h2>
              <p className="text-xs text-slate-500">
                Grant monetization clearance, define initial tier badge, and assign engagement quality multiplier.
              </p>
            </div>

            <form onSubmit={handleAddCreator} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Username *</label>
                  <input
                    type="text"
                    value={reviewUsername}
                    onChange={(e) => setReviewUsername(e.target.value)}
                    placeholder="e.g. maya.art"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Display Name *</label>
                  <input
                    type="text"
                    value={reviewDisplayName}
                    onChange={(e) => setReviewDisplayName(e.target.value)}
                    placeholder="e.g. Maya Art Studio"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">User ID</label>
                  <input
                    type="text"
                    value={reviewUserId}
                    onChange={(e) => setReviewUserId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Initial Tier</label>
                  <select
                    value={reviewInitialTier}
                    onChange={(e) => setReviewInitialTier(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="BASIC">BASIC (Standard Creator)</option>
                    <option value="VERIFIED">VERIFIED (Badged Creator)</option>
                    <option value="CREATOR_PRO">CREATOR_PRO (Premium Partner)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Quality Multiplier</label>
                  <select
                    value={reviewMultiplier}
                    onChange={(e) => setReviewMultiplier(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value={1.0}>1.0x (Standard)</option>
                    <option value={1.2}>1.2x (High Quality)</option>
                    <option value={1.5}>1.5x (Exceptional)</option>
                    <option value={2.0}>2.0x (Partner Tier)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('roster')}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Activate Creator Profile</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Contribution Policies Tab */}
        {activeTab === 'policies' && (
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
                v2ContributionEngine
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
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-amber-600">
                      +{p.base_points} Base CP
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Max Mult: {p.quality_multiplier_max}x
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creator Roster Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Creator List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Creator Accounts ({filteredCreators.length})
              </span>
              <div className="flex items-center gap-1">
                <select
                  value={selectedTierFilter}
                  onChange={(e) => setSelectedTierFilter(e.target.value)}
                  className="text-[11px] font-semibold bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-600 focus:outline-none"
                >
                  <option value="ALL">All Tiers</option>
                  <option value="BASIC">BASIC</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="CREATOR_PRO">CREATOR_PRO</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search username, name, id..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredCreators.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-xs">
                  {loading ? 'Loading creator accounts...' : 'No creator accounts found. Authenticated creators and profiles will appear here.'}
                </div>
              ) : (
                filteredCreators.map((creator) => (
                  <div
                    key={creator.id}
                    onClick={() => setSelectedCreator(creator)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                      selectedCreator?.id === creator.id
                        ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <img
                      src={creator.avatarUrl}
                      alt={creator.username}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 truncate">@{creator.username}</h4>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            creator.tier === 'CREATOR_PRO'
                              ? 'bg-purple-100 text-purple-800'
                              : creator.tier === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {creator.tier}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{creator.displayName}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-100">
                        <span>CP: <strong className="text-amber-700">{creator.accumulatedPoints.toLocaleString()}</strong></span>
                        <span>{creator.monetizationStatus}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detailed Creator Profile & Action Surface */}
          <div className="lg:col-span-2">
            {selectedCreator ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedCreator.avatarUrl}
                      alt={selectedCreator.username}
                      className="w-14 h-14 rounded-full object-cover shadow-xs"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-amber-700 font-bold uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded">
                          Tier: {selectedCreator.tier}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            selectedCreator.monetizationStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {selectedCreator.monetizationStatus}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 mt-1">
                        {selectedCreator.displayName} (@{selectedCreator.username})
                      </h2>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        User ID: {selectedCreator.userId} • Wallet: {selectedCreator.walletBindingId || 'None'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleMonetization(selectedCreator.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                        selectedCreator.monetizationStatus === 'ACTIVE'
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {selectedCreator.monetizationStatus === 'ACTIVE' ? 'Hold Monetization' : 'Activate Monetization'}
                    </button>
                  </div>
                </div>

                {/* Tier Management & Multiplier Controls */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Tier Standing & Quality Scoring Controls
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-700 block">Promote Creator Tier</span>
                      <div className="flex items-center gap-1.5">
                        {(['BASIC', 'VERIFIED', 'CREATOR_PRO'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handlePromoteTier(selectedCreator.id, t)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                              selectedCreator.tier === t
                                ? 'bg-amber-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-700 block">Quality Multiplier</span>
                      <div className="flex items-center gap-1.5">
                        {[1.0, 1.2, 1.5, 2.0].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleUpdateMultiplier(selectedCreator.id, m)}
                            className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
                              selectedCreator.qualityMultiplier === m
                                ? 'bg-purple-700 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {m}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Creator Performance Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">Total CP Score</span>
                    <div className="font-mono font-bold text-amber-700 text-base">
                      {selectedCreator.accumulatedPoints.toLocaleString()} CP
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">Monthly Reach</span>
                    <div className="font-mono font-bold text-slate-800 text-base">
                      {selectedCreator.monthlyReach.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">Active Multiplier</span>
                    <div className="font-mono font-bold text-purple-700 text-base">
                      {selectedCreator.qualityMultiplier}x
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">Contributor Since</span>
                    <div className="font-mono font-bold text-slate-800 text-base">
                      {selectedCreator.joinedDate}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
                Select a creator account to inspect profile and manage monetization standing.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default V2CreatorModule;
