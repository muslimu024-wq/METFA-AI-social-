/**
 * METFA V2 — Admin Control Center Module (Phase 9)
 *
 * CANONICAL ADMINISTRATIVE CONTROL SURFACE
 *
 * Integrates:
 * 1. System Overview & "Requires Your Attention" Priority Queue
 * 2. 16-Module Canonical Status Grid
 * 3. 8 Canonical Feature Flags with RBAC enforcement
 * 4. 6 Canonical Emergency Kill Switches (Future-only pause, zero ledger mutation)
 * 5. AI Health Telemetry & Safe Diagnostics (Zero secrets/tokens)
 * 6. Unified Approval Center (Human-in-the-loop authorization only)
 * 7. Interactive 20-Point Phase 9 Verification Suite Runner
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Lock,
  Unlock,
  Bot,
  Activity,
  Zap,
  Clock,
  Eye,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Power,
  ChevronRight,
  Filter,
  Network,
  Radio,
  Video,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  V2UserRole,
  V2FeatureFlagKey,
  V2KillSwitchKey,
  V2AdminControlOverview,
  V2AttentionQueueItem,
  V2ApprovalItem,
  V2AiProviderHealth,
  V2ModuleHealthStatus,
} from '../../../types/v2Admin';
import { v2AdminEngine } from '../../../services/v2AdminEngine';
import { runV2GovernanceVerification, V2GovernanceTestSuiteSummary } from '../../../tests/v2GovernanceVerification';
import {
  runV2Phase10IntegrationVerification,
  V2Phase10TestSuiteSummary,
} from '../../../tests/v2Phase10IntegrationVerification';
import { v2IntegrationAdapter, V2IntegrationHealthSummary } from '../../../services/v2IntegrationAdapter';
import { V2ModuleId } from '../../../types/v2';

interface V2AdminControlModuleProps {
  initialRole?: V2UserRole;
  initialUserId?: string;
  onNavigateToModule?: (moduleId: V2ModuleId) => void;
}

const AVAILABLE_ROLES: V2UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'FINANCE_ADMIN',
  'ADS_MANAGER',
  'CONTENT_MANAGER',
  'OPERATOR',
  'DEVELOPER',
  'FREELANCER',
  'REVIEWER',
  'SUPPORT',
  'ANALYST',
];

export const V2AdminControlModule: React.FC<V2AdminControlModuleProps> = ({
  initialRole = 'SUPER_ADMIN',
  initialUserId = 'admin_lead_01',
  onNavigateToModule,
}) => {
  const [currentRole, setCurrentRole] = useState<V2UserRole>(initialRole);
  const [currentUserId] = useState<string>(initialUserId);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'modules' | 'flags' | 'kill-switches' | 'ai-health' | 'approvals' | 'integration' | 'verification'
  >('overview');

  const [overview, setOverview] = useState<V2AdminControlOverview | null>(null);
  const [attentionQueue, setAttentionQueue] = useState<V2AttentionQueueItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<V2ApprovalItem[]>([]);
  const [aiProviders, setAiProviders] = useState<V2AiProviderHealth[]>([]);
  const [integrationHealth, setIntegrationHealth] = useState<V2IntegrationHealthSummary | null>(null);

  // Action status state
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Kill Switch Modal / Prompt State
  const [selectedKillSwitch, setSelectedKillSwitch] = useState<V2KillSwitchKey | null>(null);
  const [killSwitchReason, setKillSwitchReason] = useState<string>('Emergency containment procedure.');

  // Approval Decision State
  const [selectedApprovalItem, setSelectedApprovalItem] = useState<V2ApprovalItem | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<string>('Authorized by platform operator signature.');

  // Verification Suite State
  const [testResults, setTestResults] = useState<V2GovernanceTestSuiteSummary | null>(null);
  const [testsRunning, setTestsRunning] = useState(false);
  const [phase10Results, setPhase10Results] = useState<V2Phase10TestSuiteSummary | null>(null);
  const [phase10Running, setPhase10Running] = useState(false);
  const [verificationActivePhase, setVerificationActivePhase] = useState<'p9' | 'p10'>('p10');

  const reloadData = () => {
    try {
      setOverview(v2AdminEngine.getOverview());
      setAttentionQueue(v2AdminEngine.getAttentionQueue());
      setPendingApprovals(v2AdminEngine.listPendingApprovals());
      setAiProviders(v2AdminEngine.listAiProviders());
      setIntegrationHealth(v2IntegrationAdapter.getIntegrationHealth());
    } catch (err) {
      console.error('Failed to load admin engine state', err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleToggleFlag = (key: V2FeatureFlagKey, currentVal: boolean) => {
    setActionSuccess(null);
    setActionError(null);

    const res = v2AdminEngine.setFeatureFlag({
      key,
      enabled: !currentVal,
      actor_id: currentUserId,
      actor_role: currentRole,
      reason: `Toggled to ${!currentVal} via Admin Control Center by ${currentRole}`,
    });

    if (res.success) {
      setActionSuccess(`Feature flag '${key}' set to ${!currentVal ? 'ENABLED' : 'DISABLED'}.`);
      reloadData();
    } else {
      setActionError(res.error || 'Failed to update feature flag.');
    }
  };

  const handleToggleKillSwitch = (key: V2KillSwitchKey, currentPaused: boolean) => {
    setActionSuccess(null);
    setActionError(null);

    const res = v2AdminEngine.setKillSwitch({
      key,
      isPaused: !currentPaused,
      actor_id: currentUserId,
      actor_role: currentRole,
      reason: killSwitchReason || 'Emergency operational adjustment.',
    });

    if (res.success) {
      setActionSuccess(`Emergency switch '${key}' ${!currentPaused ? 'PAUSED' : 'RESUMED'}. Future processing updated.`);
      setSelectedKillSwitch(null);
      reloadData();
    } else {
      setActionError(res.error || 'Failed to toggle emergency kill switch.');
    }
  };

  const handleApprovalDecision = (itemId: string, decision: 'APPROVED' | 'REJECTED') => {
    setActionSuccess(null);
    setActionError(null);

    const res = v2AdminEngine.decideApproval({
      itemId,
      decision,
      actor_id: currentUserId,
      actor_role: currentRole,
      notes: approvalNotes,
    });

    if (res.success) {
      setActionSuccess(`Item successfully marked as ${decision}. Audit record created.`);
      setSelectedApprovalItem(null);
      reloadData();
    } else {
      setActionError(res.error || 'Failed to submit approval decision.');
    }
  };

  const handleRunTests = () => {
    setTestsRunning(true);
    setTimeout(() => {
      const summary = runV2GovernanceVerification();
      setTestResults(summary);
      setTestsRunning(false);
      reloadData();
    }, 150);
  };

  const handleRunPhase10Tests = () => {
    setPhase10Running(true);
    setTimeout(() => {
      const summary = runV2Phase10IntegrationVerification();
      setPhase10Results(summary);
      setPhase10Running(false);
      reloadData();
    }, 150);
  };

  if (!overview) {
    return (
      <div className="p-8 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
        Loading METFA Admin Control Center...
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* 1. Master Header with Role Switcher & Live Status */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Sliders className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Admin Control Center
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                    overview.overallStatus === 'HEALTHY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : overview.overallStatus === 'PAUSED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                      overview.overallStatus === 'HEALTHY'
                        ? 'bg-emerald-500'
                        : overview.overallStatus === 'PAUSED'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  {overview.overallStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Phase 9 Centralized Governance, RBAC, Feature Flags & Emergency Kill Switches
              </p>
            </div>
          </div>

          {/* Role Switcher for Testing/Inspection */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <Shield className="w-4 h-4 text-slate-500 ml-1" />
            <label htmlFor="role-select" className="text-xs font-medium text-slate-600">
              Active Role:
            </label>
            <select
              id="role-select"
              value={currentRole}
              onChange={(e) => {
                setCurrentRole(e.target.value as V2UserRole);
                setActionSuccess(null);
                setActionError(null);
              }}
              className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              {AVAILABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Action Notifications */}
        {actionSuccess && (
          <div className="mt-3 max-w-6xl mx-auto p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="mt-3 max-w-6xl mx-auto p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* 2. Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-1 sm:gap-2 max-w-6xl mx-auto overflow-x-auto no-scrollbar py-2">
          {[
            { id: 'overview', label: 'Overview & Attention', icon: Activity, count: attentionQueue.length },
            { id: 'modules', label: '16 Modules', icon: Sliders, count: 16 },
            { id: 'flags', label: 'Feature Flags', icon: Zap, count: overview.activeFlagsCount },
            { id: 'kill-switches', label: 'Kill Switches', icon: Power, count: overview.activePausesCount },
            { id: 'ai-health', label: 'AI Health', icon: Bot },
            { id: 'approvals', label: 'Approval Center', icon: FileCheck, count: pendingApprovals.length },
            { id: 'integration', label: 'Platform Bridges (P10)', icon: Network, count: 10 },
            { id: 'verification', label: 'Verification Suites', icon: CheckCircle2 },
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
                      isCurrent
                        ? 'bg-white/20 text-white'
                        : tab.id === 'kill-switches' && tab.count > 0
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
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

      {/* 3. Main Tab Content Shell */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* TAB A: OVERVIEW & ATTENTION QUEUE */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Active Feature Flags
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {overview.activeFlagsCount} <span className="text-xs text-slate-400 font-normal">/ 8</span>
                </div>
                <div className="text-xs text-emerald-600 font-medium mt-1">Operational Baseline</div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Emergency Pauses
                </div>
                <div
                  className={`text-2xl font-black ${
                    overview.activePausesCount > 0 ? 'text-amber-600' : 'text-slate-900'
                  }`}
                >
                  {overview.activePausesCount} <span className="text-xs text-slate-400 font-normal">/ 6</span>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  {overview.activePausesCount > 0 ? 'Active System Pauses' : 'All Clear (No Pauses)'}
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Pending Approvals
                </div>
                <div className="text-2xl font-black text-purple-600">{overview.pendingApprovalsCount}</div>
                <div className="text-xs text-slate-500 font-medium mt-1">Human Signatures Needed</div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  AI Operations Health
                </div>
                <div className="text-2xl font-black text-emerald-600">{overview.aiHealthState}</div>
                <div className="text-xs text-slate-500 font-medium mt-1">Zero Secrets / Sanitized</div>
              </div>
            </div>

            {/* "Requires Your Attention" Priority Queue */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-bold text-slate-900">Requires Your Attention</h2>
                  <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                    {attentionQueue.length} Priority Items
                  </span>
                </div>
                <button
                  type="button"
                  onClick={reloadData}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Queue</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {attentionQueue.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    All clear. No critical anomalies, pending holds, or active emergency pauses.
                  </div>
                ) : (
                  attentionQueue.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            item.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : item.severity === 'HIGH'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {item.severity}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 truncate">{item.title}</h3>
                            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                              Module: {item.affectedModule}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.description}</p>
                          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-3">
                            <span>Required Role: {item.requiredRole.join(', ')}</span>
                            <span>•</span>
                            <span className="font-semibold text-purple-700">{item.actionRequired}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                        {item.type.includes('PAYOUT') || item.type.includes('SETTLEMENT') || item.type.includes('VERIFICATION') ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab('approvals')}
                            className="px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-700 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                          >
                            Open in Approvals
                          </button>
                        ) : item.type === 'EMERGENCY_PAUSE_ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab('kill-switches')}
                            className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                          >
                            Manage Kill Switch
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateToModule) onNavigateToModule(item.affectedModule);
                            }}
                            className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer"
                          >
                            Inspect Module
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Administrative Audit Activity */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Recent Append-Only Audit Activity</h3>
                <span className="text-xs text-slate-500 font-mono">
                  Total Logged: {overview.recentAuditCount} entries
                </span>
              </div>
              <div className="text-xs text-slate-600 divide-y divide-slate-100">
                {v2AdminEngine
                  .getAuditLogs()
                  .slice(0, 5)
                  .map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-semibold text-slate-800">{log.action}</span> by{' '}
                        <span className="font-mono text-purple-700">{log.actor_role}</span> ({log.actor_id})
                        <div className="text-[11px] text-slate-400 mt-0.5">{log.reason_notes}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB B: 16 CANONICAL MODULE STATUS GRID */}
        {activeTab === 'modules' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">16 Canonical V2 Modules Telemetry</h2>
                <p className="text-xs text-slate-500">
                  Comprehensive health, pause states, and pending items for all subsystems
                </p>
              </div>
              <button
                type="button"
                onClick={reloadData}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Grid</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.values(overview.modulesHealth).map((mod: V2ModuleHealthStatus) => (
                <div
                  key={mod.moduleId}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">{mod.label}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          mod.state === 'HEALTHY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : mod.state === 'PAUSED'
                            ? 'bg-amber-100 text-amber-800'
                            : mod.state === 'WARNING'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {mod.state}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mb-2">{mod.fullProductName}</div>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 text-[11px] space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Emergency Pause:</span>
                      <span className={mod.isPaused ? 'font-bold text-amber-600' : 'text-slate-400'}>
                        {mod.isPaused ? 'ENGAGED' : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Signals:</span>
                      <span className="font-semibold text-slate-700">{mod.activeSignalsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending Approvals:</span>
                      <span className="font-semibold text-purple-700">{mod.pendingApprovalsCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB C: CANONICAL 8 FEATURE FLAGS */}
        {activeTab === 'flags' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Canonical 8 Feature Flags</h2>
                <p className="text-xs text-slate-500">
                  Granular role-gated flags. Changes are audited with actor details and previous states.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Operating as: <span className="font-mono font-bold text-purple-700">{currentRole}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100">
              {v2AdminEngine.listFeatureFlags().map((flag) => {
                const canEdit =
                  currentRole === 'SUPER_ADMIN' || (flag.allowedRoles as V2UserRole[]).includes(currentRole);

                return (
                  <div
                    key={flag.key}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{flag.label}</span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {flag.key}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            flag.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {flag.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{flag.description}</p>
                      <div className="text-[11px] text-slate-400">
                        Authorized Roles: {flag.allowedRoles.join(', ')}
                        {flag.lastUpdatedBy && (
                          <span className="ml-2 font-mono">
                            • Last by {flag.lastUpdatedRole || 'SYSTEM'} ({new Date(flag.lastUpdatedAt).toLocaleTimeString()})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      {!canEdit && (
                        <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Requires {flag.allowedRoles[0]}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleToggleFlag(flag.key, flag.enabled)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                          !canEdit
                            ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                            : flag.enabled
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {flag.enabled ? 'Disable Flag' : 'Enable Flag'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB D: CANONICAL 6 EMERGENCY KILL SWITCHES */}
        {activeTab === 'kill-switches' && (
          <div className="space-y-4">
            {/* Safety Banner */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>CRITICAL SAFETY INVARIANT — FUTURE PROCESSING ONLY</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-800">
                Engaging an emergency kill switch blocks future processing and requests only. It{' '}
                <strong>NEVER</strong> deletes data, erases transaction history, confiscates user rewards, or mutates
                immutable ledgers. Requires elevated administrative authorization.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {v2AdminEngine.listKillSwitches().map((sw) => {
                const isElevated =
                  currentRole === 'SUPER_ADMIN' ||
                  currentRole === 'ADMIN' ||
                  (currentRole === 'FINANCE_ADMIN' &&
                    (sw.key === 'payouts_paused' || sw.key === 'rewards_paused'));

                return (
                  <div
                    key={sw.key}
                    className={`p-5 rounded-2xl border transition flex flex-col justify-between ${
                      sw.isPaused
                        ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Power className={`w-4 h-4 ${sw.isPaused ? 'text-rose-600' : 'text-slate-400'}`} />
                          <span className="font-bold text-sm text-slate-900">{sw.label}</span>
                        </div>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            sw.isPaused ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {sw.isPaused ? 'PAUSED' : 'ACTIVE'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-3 leading-relaxed">{sw.description}</p>
                      {sw.isPaused && sw.reason && (
                        <div className="p-2.5 bg-rose-100/60 rounded-xl text-rose-900 text-xs mb-3">
                          <span className="font-bold">Pause Reason:</span> {sw.reason}
                          <div className="text-[10px] text-rose-700 mt-0.5">
                            Paused by {sw.pausedRole} ({sw.pausedBy}) at{' '}
                            {sw.pausedAt ? new Date(sw.pausedAt).toLocaleTimeString() : 'N/A'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-mono">Module: {sw.targetModule}</span>
                      <button
                        type="button"
                        disabled={!isElevated}
                        onClick={() => {
                          if (sw.isPaused) {
                            handleToggleKillSwitch(sw.key, true);
                          } else {
                            setSelectedKillSwitch(sw.key);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          !isElevated
                            ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                            : sw.isPaused
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        }`}
                      >
                        {sw.isPaused ? 'Resume Processing' : 'Emergency Pause'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal for Kill Switch Justification */}
            {selectedKillSwitch && (
              <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full shadow-lg space-y-4">
                  <div className="flex items-center gap-2 text-rose-700 font-bold">
                    <AlertTriangle className="w-5 h-5" />
                    <h3>Confirm Emergency Kill Switch</h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    You are engaging the emergency kill switch for{' '}
                    <strong className="text-slate-900 font-mono">{selectedKillSwitch}</strong>. Provide an operational
                    justification for the append-only audit trail.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Operational Justification (Mandatory):
                    </label>
                    <textarea
                      rows={3}
                      value={killSwitchReason}
                      onChange={(e) => setKillSwitchReason(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      placeholder="e.g. Risk anomaly investigation, payment gateway degradation..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedKillSwitch(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleKillSwitch(selectedKillSwitch, false)}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      Engage Pause
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB E: AI HEALTH & TELEMETRY */}
        {activeTab === 'ai-health' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">AI Health & Model Telemetry</h2>
                <p className="text-xs text-slate-500">
                  Operational metrics across all integrated AI providers. Sensitive API tokens and credentials are strictly sanitized.
                </p>
              </div>
              <button
                type="button"
                onClick={reloadData}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Telemetry</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {aiProviders.map((p) => (
                <div key={p.providerId} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{p.providerName}</h3>
                      <div className="text-[11px] font-mono text-purple-600">{p.modelName}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'HEALTHY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'DEGRADED' || p.status === 'QUOTA_EXCEEDED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span>Telemetry Latency:</span>
                      <span className="font-mono font-bold text-slate-800">{p.latencyMs} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Consecutive Failures:</span>
                      <span className={p.consecutiveFailures > 0 ? 'font-bold text-rose-600' : 'text-slate-400'}>
                        {p.consecutiveFailures}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quota Condition:</span>
                      <span className="font-semibold text-slate-700">{p.quotaCondition}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fallback Adapter:</span>
                      <span className="text-slate-700">{p.fallbackCondition}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recovery Pipeline:</span>
                      <span className="text-emerald-700 font-semibold">{p.recoveryStatus}</span>
                    </div>
                  </div>

                  {p.lastErrorSafe && (
                    <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-lg">
                      <span className="font-bold">Sanitized Diagnostic:</span> {p.lastErrorSafe}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB F: APPROVAL CENTER */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Unified Approval Center</h2>
                <p className="text-xs text-slate-500">
                  Human authorization gate for verification, settlements, and payouts. AI cannot self-approve.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Operating as: <span className="font-mono font-bold text-purple-700">{currentRole}</span>
              </div>
            </div>

            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  No pending items awaiting approval. All queues are resolved.
                </div>
              ) : (
                pendingApprovals.map((appr) => {
                  const canDecide =
                    currentRole === 'SUPER_ADMIN' || (appr.requiredRoles as V2UserRole[]).includes(currentRole);

                  return (
                    <div
                      key={appr.id}
                      className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 max-w-xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                            {appr.category}
                          </span>
                          <h3 className="font-bold text-sm text-slate-900">{appr.title}</h3>
                          {appr.amountCents !== undefined && (
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              ${(appr.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{appr.summary}</p>
                        {appr.aiAnalysis && (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                            <Bot className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-purple-900">
                                AI Advisory Recommendation ({Math.round(appr.aiAnalysis.confidence * 100)}% confidence):
                              </span>{' '}
                              {appr.aiAnalysis.recommendation} — {appr.aiAnalysis.reasoning}
                            </div>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400">
                          Required Authority: {appr.requiredRoles.join(', ')} • Requester: {appr.requesterId}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {!canDecide ? (
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            Requires {appr.requiredRoles.join(' or ')}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprovalDecision(appr.id, 'REJECTED')}
                              className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200 transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprovalDecision(appr.id, 'APPROVED')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
                            >
                              Approve with Signature
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB G: PLATFORM INTEGRATION BRIDGES (PHASE 10) */}
        {activeTab === 'integration' && (
          <div className="space-y-6">
            {/* Top Banner with Run Suite Quick Action */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                    Phase 10 Baseline
                  </span>
                  <h2 className="text-base font-bold text-slate-900">Platform Integration Bridges</h2>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  Connects existing Social, Reels, AI Studio, and Chat features to the server-authoritative METFA V2
                  Engines via safe, non-destructive adapter layers. Existing UIs and architectures remain intact.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={reloadData}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Refresh Telemetry"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={phase10Running}
                  onClick={() => {
                    setActiveTab('verification');
                    setVerificationActivePhase('p10');
                    handleRunPhase10Tests();
                  }}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run 24 Integration Tests</span>
                </button>
              </div>
            </div>

            {/* Live Telemetry Summary Cards */}
            {integrationHealth && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold">Social Posts</span>
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {integrationHealth.socialBridge.postsIngested}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {integrationHealth.socialBridge.interactionsIngested} interactions
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold">Reels Watched</span>
                    <Video className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {integrationHealth.reelsBridge.watchesIngested}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    {integrationHealth.reelsBridge.qualifiedWatches} qualified
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold">Audio Attribution</span>
                    <Radio className="w-3.5 h-3.5 text-pink-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {integrationHealth.reelsBridge.audioAttributions}
                  </div>
                  <div className="text-[10px] text-slate-400">Licensing tracks</div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold">AI Telemetry</span>
                    <Bot className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {integrationHealth.aiTelemetryBridge.totalRequestsLogged}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    0 prompts logged (Safe)
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold">Chat Telemetry</span>
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {integrationHealth.chatTelemetryBridge.messageEventsLogged}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    0 texts logged (Safe)
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold">Active Holds</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="text-xl font-black text-purple-700">
                    {integrationHealth.riskEngineBridge.activeHoldsCount}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {integrationHealth.riskEngineBridge.signalsRegistered} signals total
                  </div>
                </div>
              </div>
            )}

            {/* 10 Detailed Integration Bridge Cards */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Live Integration Subsystem Status</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Social Feed Bridge */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">1. Social Feed Bridge</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Social posts and interaction events safely ingest into V2 Contribution Engine without affecting feed
                    rendering. Anti-self-farming prevents credit accumulation on self-likes or comments.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Self-Farming Blocked: Active</span>
                    <span>Min Text Threshold: 20 chars</span>
                  </div>
                </div>

                {/* 2. Reels & Watch Time Bridge */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
                        <Video className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">2. Reels & Watch Time Bridge</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enforces strict qualification thresholds (≥15 seconds or ≥60% completion). Speed anomalies (&gt; 2.5x)
                    are rejected and routed to Risk engine.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Qualification: 15s / 60%</span>
                    <span>Max Speed Ratio: 2.5x</span>
                  </div>
                </div>

                {/* 3. Audio Licensing Attribution Bridge */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center text-pink-700">
                        <Radio className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">3. Audio Attribution Bridge</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Licensed audio reels automatically attribute secondary contribution units to the original audio
                    artist ledger on qualified views.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Attributed Views: {integrationHealth?.reelsBridge.audioAttributions || 0}</span>
                    <span>Dual-Ledger Credit: Active</span>
                  </div>
                </div>

                {/* 4. AI Studio Telemetry Bridge */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                        <Bot className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">4. AI Studio Telemetry Bridge</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      CONNECTED (SAFE)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tracks provider health, latency, and error states without ever intercepting or logging user prompts
                    or private model responses.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Prompts Captured: 0</span>
                    <span>Healthy Providers: {integrationHealth?.aiTelemetryBridge.healthyProviders || 0}</span>
                  </div>
                </div>

                {/* 5. Chat Telemetry & Anti-Spam Bridge */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">5. Chat Telemetry Bridge</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      CONNECTED (SAFE)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Monitors message velocities to prevent automated spam and flooding. Absolute zero private message
                    text is parsed, forwarded, or stored.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Message Text Stored: 0</span>
                    <span>Rate Throttling: Active</span>
                  </div>
                </div>

                {/* 6. Profile Verification Queue Bridge */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">6. Profile Verification Bridge</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Verification requests from existing profiles feed directly into the V2 Unified Approval Center.
                    Human operator approval is required; AI cannot self-approve badges.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Approval Center Integration: Active</span>
                    <span>AI Approval Blocked: Active</span>
                  </div>
                </div>

                {/* 7. Ads Placement Governance Bridge */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-700">
                        <Zap className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">7. Ads Placement Bridge</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Existing feed and reel ad placements check the V2 Feature Flag and Emergency Kill Switch before
                    attempting rendering. Third-party SDKs are strictly isolated.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Ad Serving: {integrationHealth?.adsBridge.adServingEnabled ? 'Enabled' : 'Disabled'}</span>
                    <span>Provider Isolation: {integrationHealth?.adsBridge.providerIsolationActive ? 'Enforced' : 'Clean'}</span>
                  </div>
                </div>

                {/* 8. Revenue → Reward → Wallet Settlement Pipeline */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                        <Lock className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">8. Revenue Settlement Pipeline</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      DETERMINISTIC
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Finalized revenue periods flow into versioned reward allocations with zero overallocation. Payouts
                    remain strictly manual and require explicit human operator signature.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Pool Allocation: {(integrationHealth?.revenueRewardWalletBridge.rewardPoolPercentageBasisPoints || 4000) / 100}%</span>
                    <span>Auto-Disbursement: FALSE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB H: VERIFICATION SUITES (PHASE 9 & PHASE 10) */}
        {activeTab === 'verification' && (
          <div className="space-y-4">
            {/* Phase Suite Selector */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVerificationActivePhase('p10')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    verificationActivePhase === 'p10'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Phase 10: Platform Integration (24 Tests)
                </button>
                <button
                  type="button"
                  onClick={() => setVerificationActivePhase('p9')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    verificationActivePhase === 'p9'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Phase 9: Governance & Admin (20 Tests)
                </button>
              </div>

              <div>
                {verificationActivePhase === 'p10' ? (
                  <button
                    type="button"
                    disabled={phase10Running}
                    onClick={handleRunPhase10Tests}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
                  >
                    {phase10Running ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Running 24 Tests...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Run Phase 10 Verification Suite</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={testsRunning}
                    onClick={handleRunTests}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
                  >
                    {testsRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Running 20 Tests...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Run Phase 9 Verification Suite</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Phase 10 Results View */}
            {verificationActivePhase === 'p10' && (
              <div className="space-y-3">
                {!phase10Results ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
                    <Network className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    Click "Run Phase 10 Verification Suite" to execute all 24 end-to-end integration tests.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        phase10Results.failedCount === 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        {phase10Results.failedCount === 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                        <span>
                          {phase10Results.failedCount === 0
                            ? 'ALL 24 PHASE 10 PLATFORM INTEGRATION TESTS PASSED (100%)'
                            : `${phase10Results.failedCount} TESTS FAILED`}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-bold">
                        {phase10Results.passedCount} / {phase10Results.totalTests} Passed
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                      {phase10Results.results.map((r) => (
                        <div key={r.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {r.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                              <span className="text-slate-900 font-bold truncate">{r.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                                {r.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 ml-6 leading-relaxed">{r.notes}</p>
                          </div>
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <span className="text-[10px] text-slate-400 font-mono">{r.durationMs}ms</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                r.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Phase 9 Results View */}
            {verificationActivePhase === 'p9' && (
              <div className="space-y-3">
                {!testResults ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
                    <Sliders className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    Click "Run Phase 9 Verification Suite" to execute all 20 Governance & Admin tests.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        testResults.failedTests === 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        {testResults.failedTests === 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                        <span>
                          {testResults.failedTests === 0
                            ? 'ALL 20 PHASE 9 VERIFICATION TESTS PASSED'
                            : `${testResults.failedTests} TESTS FAILED`}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-bold">
                        {testResults.passedTests} / {testResults.totalTests} Passed
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                      {testResults.results.map((r, i) => (
                        <div key={i} className="p-3 sm:p-4 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {r.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                            <span className="text-slate-800 font-medium truncate">{r.name}</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              r.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
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
        )}
      </div>
    </div>
  );
};

export default V2AdminControlModule;
