/**
 * METFA V2 — Risk & Anti-Fraud Engine Interactive Module (Phase 8)
 *
 * CORE PRINCIPLES:
 * 1. Risk Detection != User Punishment:
 *    Suspicious signals trigger review and policy-driven holds, never automatic bans or deletions.
 * 2. Immutable Financial Ledger Immunity:
 *    Risk engine never tampers with wallet balances or contribution history.
 * 3. AI Boundary:
 *    AI analysis is strictly advisory; inferences are never treated as verified fraud.
 * 4. Human-in-the-Loop Review:
 *    Only authorized operators can resolve signals or update policy.
 * 5. Interactive 30-point automated verification suite.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Info,
  Lock,
  Search,
  Filter,
  Sliders,
  Users,
  Eye,
  Activity,
  Layers,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  V2RiskSignal,
  V2RiskPolicy,
  V2UserRiskSummary,
  V2RiskEngineHealth,
  V2RiskCategory,
  V2RiskSeverity,
} from '../../../types/v2Risk';
import { v2RiskEngine } from '../../../services/v2RiskEngine';
import { runV2RiskEngineVerification, V2RiskTestSuiteSummary } from '../../../tests/v2RiskVerification';

interface V2RiskModuleProps {
  currentRole?: string;
  currentUserId?: string;
}

export const V2RiskModule: React.FC<V2RiskModuleProps> = ({
  currentRole = 'COMPLIANCE_OFFICER',
  currentUserId = 'compliance_operator_01',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'reviews' | 'users' | 'policies' | 'verification'>('overview');
  const [health, setHealth] = useState<V2RiskEngineHealth | null>(null);
  const [signals, setSignals] = useState<V2RiskSignal[]>([]);
  const [activePolicy, setActivePolicy] = useState<V2RiskPolicy | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedSignal, setSelectedSignal] = useState<V2RiskSignal | null>(null);

  // User Lookup
  const [searchUserId, setSearchUserId] = useState<string>('');
  const [searchedSummary, setSearchedSummary] = useState<V2UserRiskSummary | null>(null);

  // Review Actions
  const [reviewNotes, setReviewNotes] = useState<string>('Verified through standard audit review.');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Test Suite State
  const [testResults, setTestResults] = useState<V2RiskTestSuiteSummary | null>(null);
  const [testsRunning, setTestsRunning] = useState(false);

  // Reload data
  const reloadData = () => {
    try {
      const h = v2RiskEngine.getEngineHealth();
      setHealth(h);
      const allSignals = v2RiskEngine.listSignals();
      setSignals(allSignals);
      setActivePolicy(v2RiskEngine.getActivePolicy());

      if (searchUserId) {
        setSearchedSummary(v2RiskEngine.getUserRiskSummary(searchUserId));
      }
    } catch (err: unknown) {
      console.error('Failed to reload risk data', err);
    }
  };

  useEffect(() => {
    reloadData();
  }, [searchUserId]);

  // Handle Signal Resolution
  const handleResolve = (signalId: string, resolution: 'RESOLVED' | 'DISMISSED') => {
    setIsProcessing(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = v2RiskEngine.resolveSignal({
        signal_id: signalId,
        resolution,
        notes: reviewNotes,
        actor_id: currentUserId,
        actor_role: currentRole,
      });

      if (res.success) {
        setActionSuccess(`Signal successfully marked as ${resolution}.`);
        setSelectedSignal(null);
        reloadData();
      } else {
        setActionError(res.error || 'Failed to resolve signal.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle User Hold Toggle
  const handleToggleHold = (holdType: 'contribution' | 'reward' | 'payout', currentActive: boolean) => {
    if (!searchedSummary) return;
    setIsProcessing(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = v2RiskEngine.setUserHold({
        user_id: searchedSummary.user_id,
        hold_type: holdType,
        active: !currentActive,
        reason: reviewNotes || 'Administrative compliance review.',
        actor_id: currentUserId,
        actor_role: currentRole,
      });

      if (res.success && res.summary) {
        setSearchedSummary(res.summary);
        setActionSuccess(`User ${holdType} hold ${!currentActive ? 'activated' : 'released'}.`);
        reloadData();
      } else {
        setActionError(res.error || 'Failed to update hold state.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Run Verification Suite
  const handleRunVerification = () => {
    setTestsRunning(true);
    setTimeout(() => {
      try {
        const summary = runV2RiskEngineVerification();
        setTestResults(summary);
        reloadData();
      } catch (err: unknown) {
        console.error('Failed to run verification suite', err);
      } finally {
        setTestsRunning(false);
      }
    }, 100);
  };

  const filteredSignals = signals.filter((s) => {
    if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && s.severity !== selectedSeverity) return false;
    return true;
  });

  const reviewQueue = signals.filter((s) => s.status === 'ACTIVE' && (s.requires_human_review || s.severity === 'HIGH' || s.severity === 'CRITICAL'));

  const getSeverityBadge = (severity: V2RiskSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">HIGH</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">WARNING</span>;
      case 'NOTICE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">NOTICE</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">INFO</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Module Header & KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Engine State</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{health?.status || 'HEALTHY'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Policy v{health?.active_policy_version || 1}.0</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Active Signals</span>
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900">
            {health?.active_signals_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{health?.total_signals_detected ?? 0} total logged</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Review Queue</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-amber-600">
            {reviewQueue.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Operator action required</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Active Holds</span>
            <Lock className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900">
            {(health?.active_holds.contribution || 0) + (health?.active_holds.reward || 0) + (health?.active_holds.payout || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            CP: {health?.active_holds.contribution || 0} | Rew: {health?.active_holds.reward || 0}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-700 font-bold ml-2">×</button>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-red-700 font-bold ml-2">×</button>
        </div>
      )}

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition shrink-0 ${
            activeTab === 'overview'
              ? 'border-b-2 border-purple-600 text-purple-700 bg-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Risk Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('signals')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition shrink-0 ${
            activeTab === 'signals'
              ? 'border-b-2 border-purple-600 text-purple-700 bg-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Risk Signals ({signals.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition shrink-0 ${
            activeTab === 'reviews'
              ? 'border-b-2 border-purple-600 text-purple-700 bg-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Review Queue ({reviewQueue.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition shrink-0 ${
            activeTab === 'users'
              ? 'border-b-2 border-purple-600 text-purple-700 bg-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          User Lookup & Holds
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policies')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition shrink-0 ${
            activeTab === 'policies'
              ? 'border-b-2 border-purple-600 text-purple-700 bg-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Policies & Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('verification')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition shrink-0 ${
            activeTab === 'verification'
              ? 'border-b-2 border-purple-600 text-purple-700 bg-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Verification Suite (30)
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldAlert className="w-4 h-4 text-purple-600" />
              <span>Centralized Anti-Fraud Engine Core Architecture</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The METFA V2 Risk Engine serves as the canonical risk and anomaly detection layer across METFA Social, Contribution Points, Reward Distributions, and Wallet transactions. All detection follows strict policy rules, sanitizes evidence, and adheres to server-authoritative governance.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <span className="text-xs font-bold text-slate-800 block">Risk Detection ≠ Punishment</span>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Suspicious patterns trigger investigation and temporary holds. Automatic user bans and account deletions are strictly prohibited.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <span className="text-xs font-bold text-slate-800 block">Immutable Ledger Immunity</span>
                <p className="text-[11px] text-slate-500 leading-normal">
                  The Risk Engine cannot mutate wallet balances, delete ledger records, or create synthetic points. Balances stay mathematically reconciled.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <span className="text-xs font-bold text-slate-800 block">AI Advisory-Only Boundary</span>
                <p className="text-[11px] text-slate-500 leading-normal">
                  AI inferences are strictly advisory and classified as estimates. Deterministic rules govern holds and human operators decide resolutions.
                </p>
              </div>
            </div>
          </div>

          {/* Active Policy Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Sliders className="w-4 h-4 text-slate-600" />
                <span>Active Policy Thresholds (v{activePolicy?.version || 1}.0)</span>
              </div>
              <span className="text-[11px] text-purple-600 font-semibold">{activePolicy?.policy_name}</span>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500">LOW</div>
                <div className="font-bold text-slate-800">0 - {activePolicy?.thresholds.low_max}</div>
                <div className="text-[9px] text-emerald-600">ALLOW</div>
              </div>
              <div className="p-2 rounded bg-blue-50 border border-blue-200">
                <div className="text-[10px] text-blue-600">NOTICE</div>
                <div className="font-bold text-blue-900">{((activePolicy?.thresholds.low_max || 19) + 1)} - {activePolicy?.thresholds.notice_max}</div>
                <div className="text-[9px] text-blue-700">MONITOR</div>
              </div>
              <div className="p-2 rounded bg-yellow-50 border border-yellow-200">
                <div className="text-[10px] text-yellow-700">WARNING</div>
                <div className="font-bold text-yellow-900">{((activePolicy?.thresholds.notice_max || 39) + 1)} - {activePolicy?.thresholds.medium_max}</div>
                <div className="text-[9px] text-yellow-800">FLAG</div>
              </div>
              <div className="p-2 rounded bg-amber-50 border border-amber-200">
                <div className="text-[10px] text-amber-700">HIGH</div>
                <div className="font-bold text-amber-900">{((activePolicy?.thresholds.medium_max || 59) + 1)} - {activePolicy?.thresholds.high_max}</div>
                <div className="text-[9px] text-amber-800">REVIEW</div>
              </div>
              <div className="p-2 rounded bg-red-50 border border-red-200">
                <div className="text-[10px] text-red-600">CRITICAL</div>
                <div className="font-bold text-red-900">{activePolicy?.thresholds.critical_min} - 100</div>
                <div className="text-[9px] text-red-700">HOLD ACTION</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIGNALS LIST */}
      {activeTab === 'signals' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Filters:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
              >
                <option value="all">All Categories</option>
                <option value="ACCOUNT">Account</option>
                <option value="DEVICE_NETWORK">Device / Network</option>
                <option value="ACTIVITY_VELOCITY">Velocity</option>
                <option value="ENGAGEMENT">Engagement</option>
                <option value="CONTENT">Content</option>
                <option value="WATCH_VIEW_ABUSE">Watch Abuse</option>
                <option value="CONTRIBUTION_FARMING">CP Farming</option>
                <option value="MARKETPLACE">Marketplace</option>
                <option value="AUDIO">Audio</option>
                <option value="REFERRAL">Referral</option>
                <option value="WALLET_REWARD">Wallet / Reward</option>
                <option value="PAYOUT_READINESS">Payout</option>
                <option value="ADS">Ads</option>
                <option value="VERIFICATION">Verification</option>
              </select>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="WARNING">Warning</option>
                <option value="NOTICE">Notice</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            <button
              type="button"
              onClick={reloadData}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {filteredSignals.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No risk signals matching the selected criteria.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Detected At</th>
                    <th className="p-3">User ID</th>
                    <th className="p-3">Signal Type</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSignals.map((sig) => (
                    <tr key={sig.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {new Date(sig.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 font-mono text-[11px] font-semibold text-slate-800">
                        {sig.user_id}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {sig.signal_type}
                      </td>
                      <td className="p-3 text-slate-500">
                        {sig.category}
                      </td>
                      <td className="p-3">
                        {getSeverityBadge(sig.severity)}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {sig.risk_score}
                      </td>
                      <td className="p-3 text-slate-600 font-mono text-[10px]">
                        {sig.recommended_action}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sig.status === 'ACTIVE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {sig.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedSignal(sig)}
                          className="px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-50 rounded transition cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal / Detail View for Selected Signal */}
          {selectedSignal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Risk Signal Inspection</h3>
                    <p className="text-[11px] font-mono text-slate-500">{selectedSignal.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSignal(null)}
                    className="text-slate-400 hover:text-slate-700 text-sm font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">USER ID</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedSignal.user_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">SEVERITY & SCORE</span>
                    <span className="font-bold text-slate-800">{selectedSignal.severity} ({selectedSignal.risk_score}/100)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CLASSIFICATION</span>
                    <span className="text-slate-700 font-mono text-[11px]">{selectedSignal.data_classification}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CONFIDENCE SOURCE</span>
                    <span className="text-slate-700 font-mono text-[11px]">{selectedSignal.confidence_source}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] mb-1">SANITIZED EVIDENCE</span>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] font-mono text-slate-700 overflow-x-auto max-h-36">
                    {JSON.stringify(selectedSignal.evidence, null, 2)}
                  </pre>
                </div>

                {selectedSignal.status === 'ACTIVE' && (
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <input
                      type="text"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Operator resolution notes..."
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleResolve(selectedSignal.id, 'DISMISSED')}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleResolve(selectedSignal.id, 'RESOLVED')}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
                      >
                        Resolve Clean
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REVIEW QUEUE */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-slate-900">Operator Review Queue</h3>
              <p className="text-[11px] text-slate-500">
                Cases requiring human investigation before holds or adjustments are made.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {reviewQueue.length} Pending
            </span>
          </div>

          {reviewQueue.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No active signals currently requiring operator review. All clean!
            </div>
          ) : (
            <div className="space-y-3">
              {reviewQueue.map((sig) => (
                <div key={sig.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getSeverityBadge(sig.severity)}
                      <span className="text-xs font-bold text-slate-900">{sig.signal_type}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">Score: {sig.risk_score}/100</span>
                  </div>

                  <div className="text-xs text-slate-600">
                    User <code className="font-bold text-slate-800">{sig.user_id}</code> triggered action <span className="font-semibold text-purple-700">{sig.recommended_action}</span> on category <span className="font-semibold">{sig.category}</span>.
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2 text-[11px] font-mono text-slate-700 border border-slate-200">
                    Evidence: {JSON.stringify(sig.evidence)}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">Requires authorized operator role</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleResolve(sig.id, 'DISMISSED')}
                        className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleResolve(sig.id, 'RESOLVED')}
                        className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
                      >
                        Resolve & Clear
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: USER LOOKUP & HOLDS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900">User Risk Profile & Hold Governance</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                  placeholder="Search user_id (e.g. user_test_01)..."
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
                />
              </div>
              <button
                type="button"
                onClick={() => setSearchUserId(searchUserId.trim())}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Inspect
              </button>
            </div>
          </div>

          {searchedSummary && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">User Profile: {searchedSummary.user_id}</h4>
                  <p className="text-[11px] text-slate-500">Eligibility Status: <span className="font-semibold text-purple-700">{searchedSummary.eligibility_status}</span></p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">{searchedSummary.overall_risk_score}/100</div>
                  {getSeverityBadge(searchedSummary.risk_level)}
                </div>
              </div>

              {/* Hold Controls */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Contribution Hold</span>
                    <Lock className={`w-3.5 h-3.5 ${searchedSummary.is_contribution_held ? 'text-red-600' : 'text-slate-300'}`} />
                  </div>
                  <p className="text-[10px] text-slate-500">Temporarily pauses CP earning qualification.</p>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleToggleHold('contribution', searchedSummary.is_contribution_held)}
                    className={`w-full py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      searchedSummary.is_contribution_held
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    {searchedSummary.is_contribution_held ? 'Release Hold' : 'Place Hold'}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Reward Hold</span>
                    <Lock className={`w-3.5 h-3.5 ${searchedSummary.is_reward_held ? 'text-red-600' : 'text-slate-300'}`} />
                  </div>
                  <p className="text-[10px] text-slate-500">Pauses reward pool distribution to wallet.</p>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleToggleHold('reward', searchedSummary.is_reward_held)}
                    className={`w-full py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      searchedSummary.is_reward_held
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    {searchedSummary.is_reward_held ? 'Release Hold' : 'Place Hold'}
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Payout Hold</span>
                    <Lock className={`w-3.5 h-3.5 ${searchedSummary.is_payout_held ? 'text-red-600' : 'text-slate-300'}`} />
                  </div>
                  <p className="text-[10px] text-slate-500">Locks wallet withdrawal/payout requests.</p>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleToggleHold('payout', searchedSummary.is_payout_held)}
                    className={`w-full py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      searchedSummary.is_payout_held
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    {searchedSummary.is_payout_held ? 'Release Hold' : 'Place Hold'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: POLICIES & RULES */}
      {activeTab === 'policies' && activePolicy && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">{activePolicy.policy_name}</h3>
                <p className="text-xs text-slate-500">Version {activePolicy.version} • Approved by {activePolicy.approved_by}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE
              </span>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">Canonical Rule Thresholds:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">MAX ACTIONS/MIN</span>
                  <span className="font-bold text-slate-800">{activePolicy.rules.max_actions_per_minute} actions</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">MIN WATCH DURATION</span>
                  <span className="font-bold text-slate-800">{activePolicy.rules.min_watch_duration_seconds}s</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">MIN COMPLETION RATIO</span>
                  <span className="font-bold text-slate-800">{(activePolicy.rules.min_completion_ratio * 100).toFixed(0)}%</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">MAX AD CTR LIMIT</span>
                  <span className="font-bold text-slate-800">{(activePolicy.rules.max_ad_ctr_threshold * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: VERIFICATION SUITE */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Phase 8 Risk & Anti-Fraud Verification Suite</h3>
              <p className="text-xs text-slate-500">
                Automated 30-point test harness verifying normalization, rule sets, ledger immunity, and false-positive protections.
              </p>
            </div>
            <button
              type="button"
              disabled={testsRunning}
              onClick={handleRunVerification}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testsRunning ? 'Executing Tests...' : 'Run All 30 Tests'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                  <span className="text-[11px] text-slate-500 block">TOTAL TESTS</span>
                  <span className="text-base font-bold text-slate-800">{testResults.totalTests}</span>
                </div>
                <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                  <span className="text-[11px] text-emerald-700 block">PASSED</span>
                  <span className="text-base font-bold text-emerald-700">{testResults.passedTests}</span>
                </div>
                <div className="bg-white rounded-xl border border-red-200 bg-red-50/50 p-3 text-center">
                  <span className="text-[11px] text-red-700 block">FAILED</span>
                  <span className="text-base font-bold text-red-700">{testResults.failedTests}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {testResults.results.map((r, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span className={r.passed ? 'text-slate-800 font-medium' : 'text-red-700 font-bold'}>
                        {r.name}
                      </span>
                    </div>
                    {r.message && (
                      <span className="text-[11px] text-red-600 font-mono">{r.message}</span>
                    )}
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

export default V2RiskModule;
