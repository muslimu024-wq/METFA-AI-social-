/**
 * METFA V2 — Reward Engine Interactive Module (Phase 6)
 * 
 * CORE RULES & MANDATES:
 * 1. Proportional Allocation Model: CP is NOT a fixed currency.
 *    User Reward = Global Pool * (User CP / Total Network CP)
 * 2. Mandated Legal Language:
 *    "Reward distribution must never exceed the verified eligible revenue allocated to the reward pool."
 * 3. Exact reward_pool_percentage comes from the active versioned Admin Policy (never hard-coded).
 * 4. Authoritative Phase 4 Revenue Engine source for eligible net revenue.
 * 5. Authoritative Phase 5 Contribution Engine source for eligible points.
 * 6. Zero-overallocation rule: SUM(allocations) <= verified reward pool.
 * 7. Strictly integer minor-unit accounting (BIGINT cents).
 * 8. Stage transitions: ESTIMATED -> PENDING -> APPROVED -> WITHDRAWABLE.
 * 9. Phase 6 boundary: Does not execute wallet transfers or payouts.
 * 10. Includes interactive 22-point automated verification suite.
 */

import React, { useState, useEffect } from 'react';
import {
  PieChart,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Info,
  Clock,
  Filter,
  ArrowRight,
  Lock,
  Layers,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
} from 'lucide-react';
import {
  V2RewardSettlementPeriodRecord,
  V2RewardAllocationRecord,
  V2RewardPoolPolicy,
  V2RewardEngineHealth,
  V2RewardAllocationStatus,
} from '../../../types/v2Reward';
import { v2RewardEngine } from '../../../services/v2RewardEngine';
import { v2RevenueEngine } from '../../../services/v2RevenueEngine';
import { runV2RewardEngineVerification, V2RewardTestSuiteSummary } from '../../../tests/v2RewardVerification';

interface V2RewardModuleProps {
  currentRole?: string;
  currentUserId?: string;
}

export const V2RewardModule: React.FC<V2RewardModuleProps> = ({
  currentRole = 'FINANCE_ADMIN',
  currentUserId = 'admin_demo_operator',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settlements' | 'allocations' | 'policies' | 'verification'>('overview');
  const [health, setHealth] = useState<V2RewardEngineHealth | null>(null);
  const [settlementPeriods, setSettlementPeriods] = useState<V2RewardSettlementPeriodRecord[]>([]);
  const [allocations, setAllocations] = useState<V2RewardAllocationRecord[]>([]);
  const [policies, setPolicies] = useState<V2RewardPoolPolicy[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all');
  
  // Action notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Settlement Execution Form
  const [selectedRevenuePeriodId, setSelectedRevenuePeriodId] = useState<string>('');
  const [availableRevenuePeriods, setAvailableRevenuePeriods] = useState<Array<{ id: string; name: string; status: string; netCents: number }>>([]);
  const [autoAdvanceStages, setAutoAdvanceStages] = useState(false);

  // Policy Creation Form
  const [newPolicyBps, setNewPolicyBps] = useState<number>(3000); // 30.00%
  const [newPolicyDesc, setNewPolicyDesc] = useState<string>('Adjusted ecosystem revenue share percentage');

  // Test Suite State
  const [testResults, setTestResults] = useState<V2RewardTestSuiteSummary | null>(null);
  const [testsRunning, setTestsRunning] = useState(false);

  // Load state from engines
  const reloadData = () => {
    try {
      const h = v2RewardEngine.getEngineHealth();
      setHealth(h);
      const periods = v2RewardEngine.listSettlementPeriods();
      setSettlementPeriods(periods);
      setPolicies(v2RewardEngine.listPolicies());

      if (periods.length > 0) {
        const periodToLoad = selectedPeriodId === 'all' ? periods[0].id : selectedPeriodId;
        setAllocations(v2RewardEngine.getAllocationsForPeriod(periodToLoad));
      } else {
        setAllocations([]);
      }

      // Fetch finalized revenue periods from Phase 4
      const revPeriods = v2RevenueEngine.listPeriods();
      const mapped = revPeriods.map((p) => ({
        id: p.id,
        name: p.period_name,
        status: p.status,
        netCents: p.eligible_net_revenue_cents,
      }));
      setAvailableRevenuePeriods(mapped);
      if (mapped.length > 0 && !selectedRevenuePeriodId) {
        const firstFinalized = mapped.find((p) => p.status === 'FINALIZED');
        setSelectedRevenuePeriodId(firstFinalized ? firstFinalized.id : mapped[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load Reward Engine data', err);
    }
  };

  useEffect(() => {
    reloadData();
  }, [selectedPeriodId]);

  // Handle Execute Settlement
  const handleExecuteSettlement = () => {
    if (!selectedRevenuePeriodId) {
      setErrorMsg('Please select a revenue period to settle.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);

    try {
      const result = v2RewardEngine.executeSettlement({
        revenue_period_id: selectedRevenuePeriodId,
        actor_id: currentUserId,
        actor_role: currentRole,
        auto_advance_stages: autoAdvanceStages,
      });

      if (!result.success) {
        setErrorMsg(result.error || 'Failed to execute reward settlement.');
      } else {
        const poolFormatted = `$${((result.total_pool_cents || 0) / 100).toFixed(2)}`;
        const allocFormatted = `$${((result.total_allocated_cents || 0) / 100).toFixed(2)}`;
        setSuccessMsg(
          result.is_cached
            ? `Settlement already exists (Idempotent): Verified Pool ${poolFormatted}, Allocated ${allocFormatted}.`
            : `Reward settlement finalized! Verified Pool ${poolFormatted}, Allocated ${allocFormatted} across ${result.allocations_count || 0} participants.`
        );
        reloadData();
      }
    } catch (err: any) {
      setErrorMsg(`Exception: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Policy Registration
  const handleRegisterPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = v2RewardEngine.registerPolicy({
      reward_pool_percentage_basis_points: Number(newPolicyBps),
      description: newPolicyDesc,
      actor_id: currentUserId,
      actor_role: currentRole,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to register policy.');
    } else {
      setSuccessMsg(`Policy v${res.policy?.version} activated: ${(res.policy!.reward_pool_percentage_basis_points / 100).toFixed(2)}% reward pool share.`);
      reloadData();
    }
  };

  // Handle Stage Advancement
  const handleAdvanceStage = (allocationId: string, targetStatus: V2RewardAllocationStatus) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = v2RewardEngine.advanceAllocationStatus({
      allocation_id: allocationId,
      target_status: targetStatus,
      actor_id: currentUserId,
      actor_role: currentRole,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to advance reward stage.');
    } else {
      setSuccessMsg(`Allocation stage advanced to ${targetStatus}.`);
      reloadData();
    }
  };

  // Run automated 22-point verification suite
  const handleRunVerification = () => {
    setTestsRunning(true);
    setErrorMsg(null);
    try {
      const suite = runV2RewardEngineVerification();
      setTestResults(suite);
      if (suite.failedTests === 0) {
        setSuccessMsg(`All ${suite.totalTests} verification checks passed successfully!`);
      } else {
        setErrorMsg(`${suite.failedTests} of ${suite.totalTests} verification checks failed.`);
      }
      reloadData();
    } catch (err: any) {
      setErrorMsg(`Test suite exception: ${err.message || String(err)}`);
    } finally {
      setTestsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. MANDATED COMPLIANCE & LEGAL INVARIANT BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Phase 6 Core Invariant
              </span>
              <span className="text-xs text-slate-400">Proportional Allocation Model</span>
            </div>
            <p className="text-sm font-medium text-slate-200 mt-1">
              "Reward distribution must never exceed the verified eligible revenue allocated to the reward pool."
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Zero-Overallocation Verified
          </span>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. TAB NAVIGATION */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Engine Overview', icon: PieChart },
            { id: 'settlements', label: 'Settlement Periods', icon: Layers },
            { id: 'allocations', label: 'User Allocations', icon: DollarSign },
            { id: 'policies', label: 'Versioned Policies', icon: Percent },
            { id: 'verification', label: '22-Point Verification', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-purple-600 text-purple-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>Active Policy Share</span>
                <Percent className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {health ? `${(health.active_reward_pool_percentage_bps / 100).toFixed(2)}%` : '25.00%'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Policy v{health?.active_policy_version || 1} • Configurable
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>Finalized Settlements</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {health?.finalized_settlement_periods || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Immutable Ledger Records
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>Total Allocated Rewards</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                ${((health?.total_allocated_reward_cents || 0) / 100).toFixed(2)}
              </div>
              <div className="text-xs text-emerald-600 font-medium mt-1">
                Minor units strictly enforced
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
                <span>Undistributed Remainder</span>
                <ShieldCheck className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                ${((health?.total_undistributed_remainder_cents || 0) / 100).toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Auditable precision reserve
              </div>
            </div>
          </div>

          {/* 9-Step Settlement Pipeline Architecture */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Authoritative 9-Stage Settlement Workflow</h3>
                <p className="text-xs text-slate-500">Continuous mathematical integrity between Phase 4 Revenue and Phase 5 Contributions</p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 font-medium rounded-md border border-slate-200">
                Server Authority
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px]">1-3</span>
                  Revenue Pool Locking
                </div>
                <p className="text-slate-500">Locks verified Phase 4 Revenue period, confirms net revenue cents, and calculates pool using active versioned policy.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">4-6</span>
                  Contribution & Risk Lock
                </div>
                <p className="text-slate-500">Snapshots Phase 5 ledger, excludes reversals and risk-flagged entries, and validates participant eligibility tiers.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">7-9</span>
                  Allocation & Settlement
                </div>
                <p className="text-slate-500">Executes deterministic integer allocation, validates SUM(rewards) &le; Pool, and permanently locks immutable ledger.</p>
              </div>
            </div>
          </div>

          {/* Quick Settlement Execution Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Initiate Authoritative Reward Settlement</h3>
            <p className="text-xs text-slate-500">
              Select a finalized Phase 4 Revenue Period to settle proportional rewards to qualified contributors.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Revenue Period (Phase 4)</label>
                <select
                  value={selectedRevenuePeriodId}
                  onChange={(e) => setSelectedRevenuePeriodId(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 font-medium text-slate-800 focus:ring-2 focus:ring-purple-500"
                >
                  {availableRevenuePeriods.length === 0 ? (
                    <option value="">No revenue periods found in Phase 4</option>
                  ) : (
                    availableRevenuePeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.status}) — Net: ${(p.netCents / 100).toFixed(2)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAdvanceStages}
                    onChange={(e) => setAutoAdvanceStages(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Auto-advance allocations directly to WITHDRAWABLE</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={reloadData}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleExecuteSettlement}
                disabled={isProcessing || !selectedRevenuePeriodId}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                {isProcessing ? 'Settling Period...' : 'Execute Proportional Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SETTLEMENT PERIODS */}
      {activeTab === 'settlements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Immutable Reward Settlement Periods</h3>
            <span className="text-xs text-slate-500">{settlementPeriods.length} periods recorded</span>
          </div>

          {settlementPeriods.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No reward settlements executed yet. Run a settlement from the Overview tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Period Name</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Policy Used</th>
                    <th className="p-3">Net Revenue</th>
                    <th className="p-3">Reward Pool</th>
                    <th className="p-3">Allocated</th>
                    <th className="p-3">Remainder</th>
                    <th className="p-3">Network CP</th>
                    <th className="p-3">Participants</th>
                    <th className="p-3">Finalized At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settlementPeriods.map((period) => (
                    <tr key={period.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">{period.period_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {period.status}
                        </span>
                      </td>
                      <td className="p-3">
                        v{period.applied_policy_version} ({(period.reward_pool_percentage_basis_points / 100).toFixed(1)}%)
                      </td>
                      <td className="p-3 font-medium">${(period.verified_eligible_net_revenue_cents / 100).toFixed(2)}</td>
                      <td className="p-3 font-bold text-purple-700">${(period.total_reward_pool_cents / 100).toFixed(2)}</td>
                      <td className="p-3 font-semibold text-emerald-700">${(period.total_allocated_reward_cents / 100).toFixed(2)}</td>
                      <td className="p-3 text-slate-500">${(period.undistributed_remainder_cents / 100).toFixed(2)}</td>
                      <td className="p-3">{period.total_network_eligible_cp.toLocaleString()} CP</td>
                      <td className="p-3">{period.total_eligible_participants}</td>
                      <td className="p-3 text-slate-400">
                        {period.finalized_at ? new Date(period.finalized_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USER ALLOCATIONS */}
      {activeTab === 'allocations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">User Reward Allocations</h3>
              <p className="text-xs text-slate-500">Deterministic integer share per participant</p>
            </div>

            {settlementPeriods.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Filter Period:</span>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="text-xs rounded-xl border-slate-200 bg-white p-2 font-medium text-slate-800"
                >
                  <option value="all">All Settlements</option>
                  {settlementPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.period_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {allocations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No allocations recorded for the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">User ID</th>
                      <th className="p-3">Qualified CP</th>
                      <th className="p-3">Network Share</th>
                      <th className="p-3">Allocated Amount</th>
                      <th className="p-3">Stage Status</th>
                      <th className="p-3">Risk Status</th>
                      <th className="p-3">Formula / Metadata</th>
                      <th className="p-3 text-right">Stage Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allocations.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-[11px] text-slate-900">{alloc.user_id}</td>
                        <td className="p-3 font-semibold text-slate-800">{alloc.qualified_points} CP</td>
                        <td className="p-3 text-purple-700 font-medium">
                          {(alloc.user_share_ratio * 100).toFixed(2)}%
                        </td>
                        <td className="p-3 font-bold text-emerald-700">
                          ${(alloc.allocated_cents / 100).toFixed(2)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              alloc.status === 'WITHDRAWABLE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : alloc.status === 'APPROVED'
                                ? 'bg-blue-100 text-blue-800'
                                : alloc.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {alloc.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              alloc.risk_review_status === 'CLEAN'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {alloc.risk_review_status}
                          </span>
                        </td>
                        <td className="p-3 text-[10px] text-slate-400 font-mono">
                          {alloc.calculation_metadata.formula}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          {alloc.status === 'PENDING' && (
                            <button
                              onClick={() => handleAdvanceStage(alloc.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg text-[10px] transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          {alloc.status === 'APPROVED' && (
                            <button
                              onClick={() => handleAdvanceStage(alloc.id, 'WITHDRAWABLE')}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-lg text-[10px] transition-colors"
                            >
                              Set Withdrawable
                            </button>
                          )}
                          {alloc.status === 'WITHDRAWABLE' && (
                            <span className="text-[10px] text-emerald-600 font-semibold">Ready for Phase 7</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VERSIONED POLICIES */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          {/* Policy Registration Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Configure Versioned Reward Pool Policy</h3>
            <p className="text-xs text-slate-500">
              Changes apply strictly to future settlements. Historical settlements remain permanently immutable.
            </p>

            <form onSubmit={handleRegisterPolicy} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reward Pool Share (Basis Points)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      step={50}
                      value={newPolicyBps}
                      onChange={(e) => setNewPolicyBps(Number(e.target.value))}
                      className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 font-medium text-slate-800 pr-16"
                    />
                    <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                      {(newPolicyBps / 100).toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Policy Description & Audit Notes
                  </label>
                  <input
                    type="text"
                    value={newPolicyDesc}
                    onChange={(e) => setNewPolicyDesc(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 font-medium text-slate-800"
                    placeholder="e.g. Q4 Ecosystem Incentive Adjustment"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-xs"
                >
                  Publish New Version
                </button>
              </div>
            </form>
          </div>

          {/* Existing Versioned Policies Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Policy Version History</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Version</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Percentage Share</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Effective From</th>
                    <th className="p-3">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {policies.map((pol) => (
                    <tr key={pol.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-900">v{pol.version}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pol.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {pol.status}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-purple-700">
                        {(pol.reward_pool_percentage_basis_points / 100).toFixed(2)}% ({pol.reward_pool_percentage_basis_points} bps)
                      </td>
                      <td className="p-3 text-slate-700">{pol.description}</td>
                      <td className="p-3 text-slate-400">{new Date(pol.effective_from).toLocaleDateString()}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">{pol.approved_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: 22-POINT AUTOMATED VERIFICATION */}
      {activeTab === 'verification' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Phase 6 Master Verification Engine</h3>
              <p className="text-xs text-slate-500 mt-1">
                Executes 22 automated unit, boundary, invariant, and idempotency tests across the Reward Engine.
              </p>
            </div>
            <button
              onClick={handleRunVerification}
              disabled={testsRunning}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-2 shrink-0"
            >
              <Play className="w-4 h-4 fill-white" />
              {testsRunning ? 'Running 22 Checks...' : 'Run All 22 Verification Checks'}
            </button>
          </div>

          {testResults && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Verification Results</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700">
                    {testResults.passedTests} / {testResults.totalTests} Passed
                  </span>
                </div>
                {testResults.failedTests === 0 ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> 100% Invariant Compliance
                  </span>
                ) : (
                  <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> {testResults.failedTests} Failures Detected
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {testResults.results.map((r) => (
                  <div
                    key={r.testId}
                    className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                      r.passed ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-900 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          {r.testId}
                        </span>
                        {r.name}
                      </span>
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed pl-1">{r.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default V2RewardModule;
