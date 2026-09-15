/**
 * METFA V2 — Governance & Audit Module (Phase 9)
 *
 * GOVERNANCE, AUDIT & COMPLIANCE SURFACE
 *
 * Integrates:
 * 1. METFA AI Governance Model (Levels 1–6) & Real-Time Action Policy Evaluator
 * 2. Versioned Policy Governance (Reward Pool, Contribution, Risk, Features)
 * 3. Append-Only Tamper-Evident Audit Trail Viewer
 */

import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bot,
  Lock,
  Search,
  Filter,
  RefreshCw,
  Layers,
  FileText,
  Sliders,
  ChevronRight,
  Info,
} from 'lucide-react';
import { V2AiGovernanceLevel, V2GovernanceAuditEntry } from '../../../types/v2Admin';
import { v2AdminEngine } from '../../../services/v2AdminEngine';
import { v2RiskEngine } from '../../../services/v2RiskEngine';
import { v2RevenueEngine } from '../../../services/v2RevenueEngine';

export const V2GovernanceAuditModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ai-governance' | 'policies' | 'audit-logs'>('ai-governance');

  // AI Governance Action Checker State
  const [testActionName, setTestActionName] = useState<string>('APPROVE_PAYOUT');
  const [actionCheckResult, setActionCheckResult] = useState<ReturnType<
    typeof v2AdminEngine.canAiExecuteAction
  > | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<V2GovernanceAuditEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const reloadData = () => {
    try {
      setAuditLogs(v2AdminEngine.getAuditLogs());
    } catch (err) {
      console.error('Failed to load governance audit logs', err);
    }
  };

  useEffect(() => {
    reloadData();
    handleCheckAction('APPROVE_PAYOUT');
  }, []);

  const handleCheckAction = (actionStr: string) => {
    const res = v2AdminEngine.canAiExecuteAction(actionStr);
    setActionCheckResult(res);
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesCat = selectedCategory === 'ALL' || log.category === selectedCategory;
    const matchesQuery =
      !searchQuery ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.reason_notes.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const aiPolicies = v2AdminEngine.listAiGovernancePolicies();

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* 1. Module Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Governance + Audit
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Tamper-Evident
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Phase 9 AI Governance Boundaries, Versioned Policy Management & Append-Only Audit Trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 font-mono">
              Audit Entries: {auditLogs.length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-1 sm:gap-2 max-w-6xl mx-auto overflow-x-auto no-scrollbar py-2">
          {[
            { id: 'ai-governance', label: 'AI Governance (Levels 1–6)', icon: Bot },
            { id: 'policies', label: 'Versioned Policies', icon: Sliders },
            { id: 'audit-logs', label: 'Append-Only Audit Trail', icon: FileText, count: auditLogs.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isCurrent ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* TAB 1: AI GOVERNANCE MODEL */}
        {activeTab === 'ai-governance' && (
          <div className="space-y-6">
            {/* Core Principle Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-5 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-300" />
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  METFA AI Governance Mandate
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-purple-200 leading-relaxed font-serif italic">
                &ldquo;AI does the thinking and preparation. Human does the authorization. System does the controlled execution.&rdquo;
              </p>
              <div className="text-[11px] text-slate-300 pt-1 border-t border-white/10">
                METFA AI operates as an intelligent advisory co-pilot. It is strictly blocked from making monetary payouts,
                modifying immutable ledgers, altering reward pool splits, or bypassing security controls.
              </div>
            </div>

            {/* Interactive Real-Time Action Checker */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Interactive AI Action Evaluator</h3>
                  <p className="text-xs text-slate-500">
                    Verify how the governance engine evaluates proposed actions before execution.
                  </p>
                </div>
                <span className="text-xs font-mono bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg font-semibold">
                  Rule: Level 6 Requires Human Signature
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={testActionName}
                  onChange={(e) => {
                    setTestActionName(e.target.value);
                    handleCheckAction(e.target.value);
                  }}
                  placeholder="e.g. APPROVE_PAYOUT, CALCULATE_VARIANCE, CLEAR_CACHE"
                  className="flex-1 text-xs p-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <div className="flex gap-1.5 overflow-x-auto">
                  {['APPROVE_PAYOUT', 'MUTATE_IMMUTABLE_LEDGER', 'CALCULATE_VARIANCE', 'CLEAR_CACHE'].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setTestActionName(sample);
                        handleCheckAction(sample);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg whitespace-nowrap cursor-pointer transition"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {actionCheckResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                    actionCheckResult.allowed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {actionCheckResult.allowed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span>{actionCheckResult.allowed ? 'ACTION PERMITTED FOR AI' : 'BLOCKED FOR AI EXECUTION'}</span>
                      <span className="font-mono text-[10px] px-2 py-0.2 rounded-full bg-white/70">
                        {actionCheckResult.governanceLevel}
                      </span>
                    </div>
                    <p className="mt-1 leading-relaxed text-[11px] opacity-90">{actionCheckResult.reason}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 6 AI Governance Levels Cards */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">The 6 METFA AI Governance Levels</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiPolicies.map((p) => {
                  const isCritical = p.level === V2AiGovernanceLevel.LEVEL_6_CRITICAL_HUMAN_APPROVAL;
                  return (
                    <div
                      key={p.level}
                      className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                        isCritical
                          ? 'bg-purple-50/50 border-purple-200 ring-1 ring-purple-100'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-slate-900">{p.title}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.requiresHumanSignature
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.requiresHumanSignature ? 'HUMAN SIGNATURE' : 'AUTONOMOUS ADVISORY'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-3">{p.description}</p>
                      </div>

                      <div className="space-y-2 border-t border-slate-100 pt-2.5 text-[11px]">
                        <div>
                          <span className="font-semibold text-emerald-700">Permitted:</span>{' '}
                          <span className="text-slate-600">{p.allowedActions.join(', ')}</span>
                        </div>
                        {p.prohibitedActions.length > 0 && (
                          <div>
                            <span className="font-semibold text-rose-700">Prohibited for AI:</span>{' '}
                            <span className="text-slate-500 font-mono text-[10px]">
                              {p.prohibitedActions.slice(0, 4).join(', ')}
                              {p.prohibitedActions.length > 4 && ` +${p.prohibitedActions.length - 4} more`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VERSIONED POLICIES */}
        {activeTab === 'policies' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Versioned Policy Governance</h2>
                <p className="text-xs text-slate-500">
                  Historical-safe versioning. Modifying a policy creates a new version for future events without altering past settlements.
                </p>
              </div>
              <span className="text-xs bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600">
                Rule: No Hard-Coded Monies
              </span>
            </div>

            <div className="space-y-3">
              {/* Policy 1: Reward Pool */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">Reward Pool Allocation Policy</span>
                    <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                      v1.0 ACTIVE
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Effective: 2026-09-12</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Calculates reward distributions strictly from verified eligible net revenue periods. Enforces mathematical
                  variance limits and dual administrator signatures for final disbursement.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 font-mono flex items-center justify-between">
                  <span>Pool Basis Points: Configurable per finalized period</span>
                  <span className="text-emerald-700 font-semibold">Zero Hard-Coded Splits</span>
                </div>
              </div>

              {/* Policy 2: Contribution Policy */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">Contribution Points (CP) Policy</span>
                    <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                      v1.0 ACTIVE
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Effective: 2026-09-12</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Governs points awarded for authentic engagement, listens, and creator works. Includes quality multiplier caps,
                  daily velocity thresholds, and anti-farming cooling windows.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 font-mono flex items-center justify-between">
                  <span>Quality Multiplier Max: 1.50x</span>
                  <span>Daily Limit: Policy Controlled</span>
                </div>
              </div>

              {/* Policy 3: Risk Policy */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">Canonical Anti-Fraud & Risk Policy</span>
                    <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                      v1.0 ACTIVE
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Effective: 2026-09-12</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Normalized 0–100 scoring across 14 anomaly categories. Invariant: Risk Detection != Punishment. Suspicious
                  behavior triggers human review holds, never automatic wallet confiscation.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 font-mono flex items-center justify-between">
                  <span>Critical Threshold: 80/100</span>
                  <span>Review Requirement: Mandatory Human Gate</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: APPEND-ONLY AUDIT TRAIL */}
        {activeTab === 'audit-logs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Append-Only Audit Trail (v2_audit_logs)</h2>
                <p className="text-xs text-slate-500">
                  Tamper-evident logs of administrative actions, flag mutations, and approvals. Non-editable and non-deletable.
                </p>
              </div>
              <button
                type="button"
                onClick={reloadData}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by action, actor, or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 font-medium cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="FEATURE_FLAG_MUTATION">Feature Flags</option>
                <option value="KILL_SWITCH_MUTATION">Kill Switches</option>
                <option value="APPROVAL_DECISION">Approvals</option>
                <option value="POLICY_CHANGE">Policies</option>
                <option value="SYSTEM_BOOTSTRAP">System</option>
              </select>
            </div>

            {/* Logs List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No audit records match the selected filter.
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50/70 transition space-y-1">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {log.category}
                        </span>
                        <span className="font-bold text-slate-900">{log.action}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                      <span>
                        Actor: <strong className="font-mono text-purple-700">{log.actor_role}</strong> ({log.actor_id})
                      </span>
                      <span>•</span>
                      <span>Target: {log.target_module} ({log.target_id})</span>
                      <span>•</span>
                      <span className="text-slate-500 font-mono">IP: {log.ip_masked}</span>
                    </div>

                    <p className="text-xs text-slate-500 italic mt-0.5">{log.reason_notes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default V2GovernanceAuditModule;
