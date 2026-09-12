/**
 * METFA V2 — Contribution Engine Interactive Module (Phase 5)
 * 
 * CORE RULES:
 * 1. Contribution Points (CP) are NOT money. No cash conversions or monetary rewards displayed.
 * 2. Clean, server-authoritative UI showing policies, qualification status, and append-only ledger.
 * 3. Shows real data only: Policies, User Summary, Immutable Ledger, Qualification Inspector.
 * 4. Includes interactive 21-point automated verification suite.
 */

import React, { useState, useEffect } from 'react';
import {
  Award,
  ShieldCheck,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Info,
  Clock,
  Filter,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
} from 'lucide-react';
import {
  V2ContributionPolicyRecord,
  V2ContributionLedgerRecord,
  V2ContributionUserSummary,
  V2ContributionEngineHealth,
  V2ContributionAction,
} from '../../../types/v2Contribution';
import { V2ContributionTestSuiteSummary } from '../../../tests/v2ContributionVerification';

interface V2ContributionModuleProps {
  currentRole?: string;
  currentUserId?: string;
}

export const V2ContributionModule: React.FC<V2ContributionModuleProps> = ({
  currentRole = 'OPERATOR',
  currentUserId = 'user_demo_creator',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'policies' | 'ledger' | 'qualifier' | 'verification'>('overview');
  const [health, setHealth] = useState<V2ContributionEngineHealth | null>(null);
  const [policies, setPolicies] = useState<V2ContributionPolicyRecord[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<V2ContributionLedgerRecord[]>([]);
  const [userSummary, setUserSummary] = useState<V2ContributionUserSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Test Suite State
  const [testResults, setTestResults] = useState<V2ContributionTestSuiteSummary | null>(null);
  const [testsRunning, setTestsRunning] = useState(false);

  // Qualification Simulation Form
  const [simAction, setSimAction] = useState<V2ContributionAction>('ORIGINAL_CONTENT');
  const [simDuration, setSimDuration] = useState<number>(30);
  const [simCompletion, setSimCompletion] = useState<number>(0.85);
  const [simContent, setSimContent] = useState<string>('Creating original educational content for METFA community.');
  const [simTxStatus, setSimTxStatus] = useState<string>('COMPLETED');
  const [simAudioValid, setSimAudioValid] = useState<boolean>(true);
  const [simResult, setSimResult] = useState<any>(null);

  // Reversal Form
  const [showReversalModal, setShowReversalModal] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [hRes, pRes, lRes, uRes] = await Promise.all([
        fetch('/api/v2/contribution/health'),
        fetch('/api/v2/contribution/policies'),
        fetch('/api/v2/contribution/ledger'),
        fetch(`/api/v2/contribution/user/${currentUserId}/summary`),
      ]);

      if (hRes.ok) setHealth(await hRes.json());
      if (pRes.ok) setPolicies(await pRes.json());
      if (lRes.ok) setLedgerEntries(await lRes.json());
      if (uRes.ok) setUserSummary(await uRes.json());
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to communicate with V2 Contribution Engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUserId]);

  const handleToggleFeatureFlag = async () => {
    if (!health) return;
    try {
      const res = await fetch('/api/v2/contribution/feature-flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-metfa-role': currentRole,
        },
        body: JSON.stringify({ enabled: !health.feature_flag_enabled }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to toggle feature flag');
      }
      setSuccessMsg(`Contribution engine feature flag toggled to: ${!health.feature_flag_enabled ? 'ENABLED' : 'PAUSED'}`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSimulateQualification = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSimResult(null);

    const payload: Record<string, unknown> = {};
    if (simAction === 'QUALIFIED_VIEW') {
      payload.watch_duration_seconds = simDuration;
    } else if (simAction === 'QUALIFIED_WATCH' || simAction === 'VOICE_POST_LISTEN') {
      payload.watch_duration_seconds = simDuration;
      payload.completion_ratio = simCompletion;
    } else if (simAction === 'ORIGINAL_CONTENT' || simAction === 'MEANINGFUL_ENGAGEMENT') {
      payload.content_text = simContent;
      payload.is_original = true;
    } else if (simAction === 'MARKETPLACE_CONTRIBUTION') {
      payload.transaction_status = simTxStatus;
    } else if (simAction === 'AUDIO_USAGE' || simAction === 'AUDIO_ATTRIBUTION') {
      payload.audio_attribution_valid = simAudioValid;
    }

    try {
      const res = await fetch('/api/v2/contribution/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          action: simAction,
          source_ref: `sim_${Date.now()}`,
          payload,
          user_tier: 'STANDARD',
        }),
      });
      const data = await res.json();
      setSimResult(data);
      if (data.success) {
        setSuccessMsg(`Activity qualified! Earned ${data.points_awarded} Contribution Points.`);
        fetchData();
      } else {
        setErrorMsg(`Qualification rejected: ${data.rejection_reason}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Simulation network failure');
    }
  };

  const handleExecuteReversal = async () => {
    if (!showReversalModal || !reversalReason) return;
    try {
      const res = await fetch('/api/v2/contribution/reverse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-metfa-role': currentRole,
        },
        body: JSON.stringify({
          original_entry_id: showReversalModal,
          reason: reversalReason,
          actor_id: currentUserId,
          actor_role: currentRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Reversal failed');
      }
      setSuccessMsg(`Reversal recorded: ${data.reversal_entry?.final_points} CP adjustment created.`);
      setShowReversalModal(null);
      setReversalReason('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRunVerificationSuite = async () => {
    setTestsRunning(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v2/contribution/run-tests', {
        headers: { 'x-metfa-role': currentRole },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verification suite failed');
      }
      const data: V2ContributionTestSuiteSummary = await res.json();
      setTestResults(data);
      if (data.failedTests === 0) {
        setSuccessMsg(`All ${data.totalTests} verification checks passed with 100% compliance.`);
      } else {
        setErrorMsg(`${data.failedTests} out of ${data.totalTests} verification checks failed.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setTestsRunning(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Award className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">METFA · Contribution</h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Phase 5
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Server-authoritative contribution scoring pipeline and append-only points ledger.
          </p>
        </div>

        {/* Feature Flag & Verification Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFeatureFlag}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              health?.feature_flag_enabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
          >
            {health?.feature_flag_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            <span>Flag: {health?.feature_flag_enabled ? 'ENABLED' : 'PAUSED'}</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium text-slate-500 gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 transition-colors border-b-2 -mb-px ${
            activeTab === 'overview' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('policies')}
          className={`pb-2.5 transition-colors border-b-2 -mb-px ${
            activeTab === 'policies' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          Active Policies ({policies.length})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-2.5 transition-colors border-b-2 -mb-px ${
            activeTab === 'ledger' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          Contribution Ledger ({ledgerEntries.length})
        </button>
        <button
          onClick={() => setActiveTab('qualifier')}
          className={`pb-2.5 transition-colors border-b-2 -mb-px ${
            activeTab === 'qualifier' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          Qualification Simulator
        </button>
        <button
          onClick={() => setActiveTab('verification')}
          className={`pb-2.5 transition-colors border-b-2 -mb-px ${
            activeTab === 'verification' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent hover:text-slate-800'
          }`}
        >
          21-Test Verification Suite
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Your Qualified Points</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {userSummary?.total_qualified_points?.toLocaleString() || 0} <span className="text-sm font-normal text-slate-500">CP</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Today: +{userSummary?.points_today || 0} CP</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Active Policies</span>
                <ShieldCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {policies.filter((p) => p.status === 'ACTIVE').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Versioned activity definitions active
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Total Immutable Entries</span>
                <Filter className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {health?.total_ledger_entries || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Append-only authoritative ledger entries
              </div>
            </div>
          </div>

          {/* Strict Notice: Points are not money */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-800">Core Rule: Contribution Points (CP) are NOT Money.</span>
              <p className="mt-0.5">
                METFA Social does not support fixed views-to-cash or likes-to-cash conversions. Qualified actions earn non-monetary Contribution Points recorded in an immutable ledger for future policy-governed settlement cycles.
              </p>
            </div>
          </div>

          {/* Contribution by Activity Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Your Contributions by Activity</h3>
            {userSummary?.by_action && Object.keys(userSummary.by_action).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(userSummary.by_action).map(([act, pts]) => (
                  <div key={act} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{act}</div>
                      <div className="text-[11px] text-slate-500">Points earned</div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">+{pts} CP</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                No contributions recorded yet for this session. Use the Qualification Simulator to test qualifying actions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: POLICIES */}
      {activeTab === 'policies' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Configured Contribution Policies</h3>
            <span className="text-xs text-slate-500">Versioned & Policy-Governed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Ver</th>
                  <th className="py-2.5 px-3">Base CP</th>
                  <th className="py-2.5 px-3">Max Multiplier</th>
                  <th className="py-2.5 px-3">Daily Limit</th>
                  <th className="py-2.5 px-3">Cooldown</th>
                  <th className="py-2.5 px-3">Required Tier</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {policies.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{p.action}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">v{p.version}</td>
                    <td className="py-2.5 px-3 font-medium text-emerald-700">+{p.base_points} CP</td>
                    <td className="py-2.5 px-3">{p.quality_multiplier_max}x</td>
                    <td className="py-2.5 px-3">{p.daily_limit_points} CP</td>
                    <td className="py-2.5 px-3">{p.cooldown_seconds}s</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 border border-slate-200">
                        {p.eligibility_tier_required}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: IMMUTABLE LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Immutable Contribution Ledger</h3>
              <p className="text-xs text-slate-500">Append-only audit trail. Historical entries cannot be modified or deleted.</p>
            </div>
            <span className="text-xs font-mono text-slate-500">{ledgerEntries.length} entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">ID / Time</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Final CP</th>
                  <th className="py-2.5 px-3">Source Ref</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Ledger is empty. Perform activities via the simulator to append entries.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[11px] text-slate-900">{e.id.substring(0, 16)}...</div>
                        <div className="text-[10px] text-slate-400">{new Date(e.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{e.user_id}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{e.action}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            e.entry_type === 'AWARD'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {e.entry_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span className={e.final_points >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {e.final_points >= 0 ? `+${e.final_points}` : e.final_points} CP
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{e.source_ref}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            e.status === 'QUALIFIED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : e.status === 'FLAGGED_RISK'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {e.entry_type === 'AWARD' && (
                          <button
                            onClick={() => setShowReversalModal(e.id)}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REVERSAL MODAL */}
      {showReversalModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <RotateCcw className="w-5 h-5" />
              <span>Append-Only Reversal / Adjustment</span>
            </div>
            <p className="text-xs text-slate-600">
              This creates an append-only compensating entry deducting the awarded CP from the ledger. The original entry is never deleted.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Reversal / Invalidation</label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Transaction refunded, copyright violation, duplicate session"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReversalModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReversal}
                disabled={!reversalReason}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: QUALIFICATION SIMULATOR */}
      {activeTab === 'qualifier' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Activity Qualification Simulator</h3>
            <p className="text-xs text-slate-500">
              Submit test activity events to evaluate server-side qualification, quality multipliers, and risk detection.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contribution Action</label>
              <select
                value={simAction}
                onChange={(e) => setSimAction(e.target.value as V2ContributionAction)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ORIGINAL_CONTENT">ORIGINAL_CONTENT</option>
                <option value="QUALIFIED_VIEW">QUALIFIED_VIEW</option>
                <option value="QUALIFIED_WATCH">QUALIFIED_WATCH</option>
                <option value="MEANINGFUL_ENGAGEMENT">MEANINGFUL_ENGAGEMENT</option>
                <option value="COMMUNITY_CONTRIBUTION">COMMUNITY_CONTRIBUTION</option>
                <option value="VERIFIED_ACTIVITY">VERIFIED_ACTIVITY</option>
                <option value="MARKETPLACE_CONTRIBUTION">MARKETPLACE_CONTRIBUTION</option>
                <option value="BUSINESS_ACTIVITY">BUSINESS_ACTIVITY</option>
                <option value="AUDIO_USAGE">AUDIO_USAGE</option>
                <option value="AUDIO_ATTRIBUTION">AUDIO_ATTRIBUTION</option>
                <option value="VOICE_POST_LISTEN">VOICE_POST_LISTEN</option>
                <option value="CREATOR_ACTIVITY">CREATOR_ACTIVITY</option>
              </select>
            </div>

            {(simAction === 'QUALIFIED_VIEW' || simAction === 'QUALIFIED_WATCH' || simAction === 'VOICE_POST_LISTEN') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Watch/Listen Duration (seconds)</label>
                <input
                  type="number"
                  value={simDuration}
                  onChange={(e) => setSimDuration(Number(e.target.value))}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {(simAction === 'QUALIFIED_WATCH' || simAction === 'VOICE_POST_LISTEN') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Completion Ratio ({Math.round(simCompletion * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={simCompletion}
                  onChange={(e) => setSimCompletion(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>
            )}

            {(simAction === 'ORIGINAL_CONTENT' || simAction === 'MEANINGFUL_ENGAGEMENT') && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Content Text</label>
                <textarea
                  value={simContent}
                  onChange={(e) => setSimContent(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                />
              </div>
            )}

            {simAction === 'MARKETPLACE_CONTRIBUTION' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Status</label>
                <select
                  value={simTxStatus}
                  onChange={(e) => setSimTxStatus(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="REFUNDED">REFUNDED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            )}

            {(simAction === 'AUDIO_USAGE' || simAction === 'AUDIO_ATTRIBUTION') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">License & Attribution Valid?</label>
                <select
                  value={simAudioValid ? 'YES' : 'NO'}
                  onChange={(e) => setSimAudioValid(e.target.value === 'YES')}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="YES">YES (Valid Attribution)</option>
                  <option value="NO">NO (Unverified Attribution)</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSimulateQualification}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <Zap className="w-4 h-4" />
              <span>Evaluate & Award Contribution</span>
            </button>
          </div>

          {/* Simulation Output Card */}
          {simResult && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">Evaluation Result</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    simResult.success
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {simResult.status}
                </span>
              </div>
              <div className="text-xs space-y-1 text-slate-600">
                <div>Points Awarded: <span className="font-bold text-emerald-700">{simResult.points_awarded} CP</span></div>
                {simResult.entry && (
                  <>
                    <div>Quality Multiplier Applied: <span className="font-mono">{simResult.entry.quality_multiplier}x</span></div>
                    <div>Ledger Entry ID: <span className="font-mono text-[11px]">{simResult.entry.id}</span></div>
                    <div>Risk Score: <span className="font-mono">{simResult.entry.risk_score}/100</span></div>
                  </>
                )}
                {simResult.rejection_reason && (
                  <div className="text-rose-600 font-medium">Reason: {simResult.rejection_reason}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: 21-TEST VERIFICATION SUITE */}
      {activeTab === 'verification' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">21-Point Contribution Verification Suite</h3>
              <p className="text-xs text-slate-500">
                Rigorous testing suite confirming all qualification rules, idempotency, daily limits, immutability, and AI advisory boundaries.
              </p>
            </div>
            <button
              onClick={handleRunVerificationSuite}
              disabled={testsRunning}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${testsRunning ? 'animate-spin' : ''}`} />
              <span>{testsRunning ? 'Executing...' : 'Run All 21 Tests'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div>
                  <div className="text-xs text-slate-500">Total Checks</div>
                  <div className="text-base font-bold text-slate-800">{testResults.totalTests}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Passed</div>
                  <div className="text-base font-bold text-emerald-600">{testResults.passedTests}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Failed</div>
                  <div className={`text-base font-bold ${testResults.failedTests > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {testResults.failedTests}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {testResults.results.map((r) => (
                  <div key={r.testId} className="p-3 bg-white flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-800">
                          <span className="font-mono text-slate-400 mr-2">{r.testId}</span>
                          {r.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{r.message}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {r.passed ? 'PASS' : 'FAIL'}
                    </span>
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

export default V2ContributionModule;
