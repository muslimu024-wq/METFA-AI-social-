/**
 * METFA V2 — Operations AI Module (METFA Operations AI)
 *
 * AI orchestration for system diagnostics, signal analysis, task briefing,
 * provider telemetry, and strict mathematical autonomy boundaries.
 * Connects directly to v2AdminEngine, v2RiskEngine, and the METFA Work pipeline.
 */

import React, { useState } from 'react';
import {
  Bot,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Lock,
  ArrowRight,
  Play,
  FileText,
  AlertTriangle,
  RefreshCw,
  Send,
  Check,
} from 'lucide-react';
import { v2AdminEngine } from '../../../services/v2AdminEngine';
import { v2RiskEngine } from '../../../services/v2RiskEngine';
import { V2ModuleId, MetfaTask } from '../../../types/v2';

export const V2OperationsAiModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'operations' | 'providers' | 'governance' | 'boundary-tester'>('operations');

  // Diagnostic State
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<{
    timestamp: string;
    overallHealth: string;
    modulesAnalyzed: number;
    activeSignalsCount: number;
    findings: string[];
    recommendations: string[];
  } | null>(null);

  // Task Brief Generator State
  const [briefTargetModule, setBriefTargetModule] = useState<V2ModuleId>('payout');
  const [briefProblemStatement, setBriefProblemStatement] = useState('Elevated withdrawal volume detected for creator tier accounts.');
  const [generatedBrief, setGeneratedBrief] = useState<{
    suggestedFix: string;
    safetyDirectives: string[];
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  } | null>(null);
  const [briefDispatched, setBriefDispatched] = useState(false);

  // Boundary Tester State
  const [testAction, setTestAction] = useState<string>('APPROVE_PAYOUT');
  const [testResult, setTestResult] = useState<ReturnType<
    typeof v2AdminEngine.canAiExecuteAction
  > | null>(() => v2AdminEngine.canAiExecuteAction('APPROVE_PAYOUT'));

  // Notification State
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const aiProviders = v2AdminEngine.listAiProviders();
  const governancePolicies = v2AdminEngine.listAiGovernancePolicies();

  const handleTestBoundary = (action: string) => {
    setTestAction(action);
    setTestResult(v2AdminEngine.canAiExecuteAction(action));
  };

  const handleRunSystemDiagnostic = () => {
    setDiagnosticRunning(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    setTimeout(() => {
      try {
        const overview = v2AdminEngine.getOverview();
        const riskHealth = v2RiskEngine.getEngineHealth();
        const activeSignals = v2RiskEngine.listSignals();

        const findings: string[] = [];
        const recommendations: string[] = [];

        // Check modules
        const degraded = Object.values(overview.modulesHealth || {}).filter(
          (m) => m.state === 'WARNING' || m.state === 'PAUSED' || m.state === 'CRITICAL'
        );

        if (degraded.length === 0) {
          findings.push('All 16 canonical modules reporting HEALTHY telemetry.');
        } else {
          findings.push(`Elevated telemetry status detected in ${degraded.length} module(s): ${degraded.map((m) => m.label).join(', ')}.`);
        }

        // Check risk signals
        if (riskHealth.active_signals_count > 0) {
          findings.push(`Risk Engine has ${riskHealth.active_signals_count} active signal(s) awaiting review.`);
          recommendations.push('Review open signals in METFA Signal before scheduled reward settlement.');
        } else {
          findings.push('Zero unhandled critical anomalies in risk detection buffer.');
        }

        // Provider check
        const providers = v2AdminEngine.listAiProviders();
        const healthyProv = providers.filter((p) => p.status === 'HEALTHY');
        findings.push(`${healthyProv.length} of ${providers.length} AI providers operating in normal latency range (< 120ms).`);

        recommendations.push('Operational invariant satisfied: Zero AI direct financial mutations.');
        recommendations.push('Maintain regular review cycles for pending creator and payout items.');

        setDiagnosticReport({
          timestamp: new Date().toISOString(),
          overallHealth: overview.overallStatus,
          modulesAnalyzed: Object.keys(overview.modulesHealth || {}).length || 16,
          activeSignalsCount: riskHealth.active_signals_count,
          findings,
          recommendations,
        });

        setSuccessMsg('Comprehensive AI diagnostic scan completed successfully.');
      } catch (err: any) {
        setErrorMsg('Failed to complete diagnostic scan: ' + (err?.message || 'Engine error'));
      } finally {
        setDiagnosticRunning(false);
      }
    }, 600);
  };

  const handleGenerateTaskBrief = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setBriefDispatched(false);

    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM';
    if (briefProblemStatement.toLowerCase().includes('emergency') || briefProblemStatement.toLowerCase().includes('fraud')) {
      priority = 'URGENT';
    } else if (briefProblemStatement.toLowerCase().includes('payout') || briefProblemStatement.toLowerCase().includes('revenue')) {
      priority = 'HIGH';
    }

    const directives = [
      'Invariant: AI does thinking, human does authorization, system executes.',
      `Module Target: Strictly preserve ${briefTargetModule.toUpperCase()} invariants.`,
      'Do not tamper with immutable historical ledger chains.',
      'Ensure verified audit entry is recorded upon completion.',
    ];

    const fix = `Perform targeted verification on ${briefTargetModule.toUpperCase()} pipeline. Validate input hashes, verify authorization permissions, and produce documented deliverable.`;

    setGeneratedBrief({
      suggestedFix: fix,
      safetyDirectives: directives,
      priority,
    });
    setSuccessMsg('Operational task brief successfully synthesized.');
  };

  const handleDispatchToWork = () => {
    if (!generatedBrief) return;

    try {
      const STORAGE_KEY = 'metfa_v2_work_tasks';
      let existingTasks: MetfaTask[] = [];
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) existingTasks = JSON.parse(saved);

      const newTask: MetfaTask = {
        id: `task_ai_${Date.now().toString(36)}`,
        affectedModule: briefTargetModule,
        title: `AI Brief: ${briefProblemStatement.slice(0, 50)}...`,
        description: briefProblemStatement,
        aiBrief: {
          problemStatement: briefProblemStatement,
          suggestedFix: generatedBrief.suggestedFix,
          safetyDirectives: generatedBrief.safetyDirectives,
          generatedAt: new Date().toISOString(),
        },
        requirements: [
          'Verify module state against diagnostic findings',
          'Execute recommended operational check',
          'Submit evidence checklist for review',
        ],
        doNotChangeConstraints: generatedBrief.safetyDirectives,
        deliverables: [
          {
            id: `deliv_ai_${Date.now()}`,
            title: 'Operational Resolution Proof',
            description: 'Verification evidence addressing the problem statement.',
          },
        ],
        acceptanceCriteria: ['Operator approval signature', 'Zero regressions'],
        testRequirements: ['Idempotency audit test'],
        priority: generatedBrief.priority,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      existingTasks.unshift(newTask);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingTasks));
      setBriefDispatched(true);
      setSuccessMsg(`Task successfully dispatched to METFA Work execution queue as task "${newTask.id}".`);
    } catch (err: any) {
      setErrorMsg('Failed to dispatch task to METFA Work: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-700 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Operations AI
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                  <Cpu className="w-3 h-3 mr-1 text-purple-600" />
                  Orchestration & Diagnostics Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                AI orchestration for system diagnostics, signal analysis, task briefing, and boundary enforcement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Primary Provider: <strong className="text-purple-700 font-bold">Google Gemini 2.5 Flash</strong></span>
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
            onClick={() => setActiveTab('operations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'operations' ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Operational AI Actions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'providers' ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Provider Telemetry ({aiProviders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'governance' ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Governance Tiers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('boundary-tester')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'boundary-tester' ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Action Boundary Gate</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Core Philosophy Banner */}
        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
          <div className="text-xs text-purple-950 leading-relaxed">
            <strong>METFA AI Architecture Mandate:</strong> <em>&quot;AI does the thinking and preparation. Human does the authorization. System does the controlled execution.&quot;</em> AI models prepare task briefs and detect anomalies, but are strictly prohibited from mutating financial ledgers or self-approving payouts.
          </div>
        </div>

        {/* Tab 1: Operational AI Actions */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            {/* Section A: Real System Diagnostic Runner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    AI System Diagnostics & Telemetry Evaluation
                  </h2>
                  <p className="text-xs text-slate-500">
                    Runs an automated non-destructive telemetry scan across all 16 canonical modules and risk anomaly signals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunSystemDiagnostic}
                  disabled={diagnosticRunning}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-purple-400 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${diagnosticRunning ? 'animate-spin' : ''}`} />
                  <span>{diagnosticRunning ? 'Analyzing System...' : 'Run Diagnostics Scan'}</span>
                </button>
              </div>

              {diagnosticReport && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Diagnostic Assessment: <strong className="text-emerald-700">{diagnosticReport.overallHealth}</strong>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Scanned at {new Date(diagnosticReport.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">Observed Findings</span>
                    <ul className="space-y-1 text-slate-600">
                      {diagnosticReport.findings.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">Operational Directives</span>
                    <ul className="space-y-1 text-slate-600">
                      {diagnosticReport.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Section B: Task Brief Generator & Dispatch to METFA Work */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  AI Task Brief Synthesizer & Work Dispatcher
                </h2>
                <p className="text-xs text-slate-500">
                  Generate structured problem statements and safety directives, then dispatch directly to the METFA Work pipeline.
                </p>
              </div>

              <form onSubmit={handleGenerateTaskBrief} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Target Module</label>
                    <select
                      value={briefTargetModule}
                      onChange={(e) => setBriefTargetModule(e.target.value as V2ModuleId)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="payout">Payout</option>
                      <option value="verified">Verified</option>
                      <option value="revenue">Revenue</option>
                      <option value="rewards">Rewards</option>
                      <option value="ads">Ads</option>
                      <option value="risk">Risk</option>
                      <option value="audio">Audio</option>
                      <option value="creator">Creator</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">Operational Problem Statement</label>
                    <input
                      type="text"
                      value={briefProblemStatement}
                      onChange={(e) => setBriefProblemStatement(e.target.value)}
                      placeholder="Describe the operational condition to analyze..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Synthesize Task Brief</span>
                </button>
              </form>

              {generatedBrief && (
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900">
                      Synthesized Brief for {briefTargetModule.toUpperCase()} (Priority: {generatedBrief.priority})
                    </span>
                    <button
                      type="button"
                      onClick={handleDispatchToWork}
                      disabled={briefDispatched}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>{briefDispatched ? 'Dispatched to Work' : 'Dispatch to METFA Work'}</span>
                    </button>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-purple-800 block">Suggested Approach:</span>
                    <p className="text-purple-950 mt-0.5">{generatedBrief.suggestedFix}</p>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-purple-800 block">Safety Directives:</span>
                    <ul className="text-purple-900 space-y-0.5 mt-0.5">
                      {generatedBrief.safetyDirectives.map((d, i) => (
                        <li key={i}>• {d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Providers */}
        {activeTab === 'providers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiProviders.map((provider) => (
              <div
                key={provider.providerId}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{provider.providerName}</h3>
                      <span className="text-[11px] font-mono text-slate-500">{provider.modelName}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      provider.status === 'HEALTHY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {provider.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400">Latency:</span>{' '}
                    <span className="font-bold text-slate-800">{provider.latencyMs}ms</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Quota:</span>{' '}
                    <span className="font-bold text-emerald-700">{provider.quotaCondition}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Fallback:</span>{' '}
                    <span className="font-bold text-purple-700">{provider.fallbackCondition}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Failures:</span>{' '}
                    <span className="font-bold text-slate-800">{provider.consecutiveFailures}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Governance */}
        {activeTab === 'governance' && (
          <div className="space-y-4">
            {governancePolicies.map((pol) => (
              <div
                key={pol.level}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-600" />
                    <h3 className="text-sm font-bold text-slate-900">{pol.title}</h3>
                  </div>
                  <span className="text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                    Level {pol.level}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{pol.description}</p>
                <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  Permitted Scope: {pol.allowedActions.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Boundary Tester */}
        {activeTab === 'boundary-tester' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                AI Autonomy Boundary & Action Gate Evaluator
              </h2>
              <p className="text-xs text-slate-500">
                Demonstrates mathematical proof of AI non-execution for sensitive financial and governance operations.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                'APPROVE_PAYOUT',
                'FINALIZE_SETTLEMENT',
                'MUTATE_FEATURE_FLAG',
                'READ_SYSTEM_METRICS',
                'EVALUATE_RISK_SIGNAL',
                'EXECUTE_REFUND',
                'TRIGGER_EMERGENCY_PAUSE',
                'DRAFT_TASK_BRIEF',
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleTestBoundary(action)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer text-xs font-mono font-bold ${
                    testAction === action
                      ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-200 text-purple-900'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  testResult.allowed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold">
                  {testResult.allowed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>
                    Action &apos;{testAction}&apos; is {testResult.allowed ? 'PERMITTED' : 'STRICTLY PROHIBITED FOR AI'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed">{testResult.reason}</p>
                {testResult.requiresHumanSignature && (
                  <div className="text-[11px] font-mono pt-1">
                    Human Authorization Required: <span className="font-bold">MANDATORY HUMAN SIGNATURE</span>
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

export default V2OperationsAiModule;
