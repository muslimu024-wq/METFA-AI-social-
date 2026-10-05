/**
 * METFA V2 — Operations AI Module (METFA Operations AI)
 *
 * AI orchestration for system diagnostics, signal analysis, and task briefing.
 * Connects directly to v2AdminEngine AI provider telemetry, governance levels, and action boundaries.
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
} from 'lucide-react';
import { v2AdminEngine } from '../../../services/v2AdminEngine';

export const V2OperationsAiModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'providers' | 'governance' | 'boundary-tester'>('providers');
  const [testAction, setTestAction] = useState<string>('APPROVE_PAYOUT');
  const [testResult, setTestResult] = useState<ReturnType<
    typeof v2AdminEngine.canAiExecuteAction
  > | null>(() => v2AdminEngine.canAiExecuteAction('APPROVE_PAYOUT'));

  const aiProviders = v2AdminEngine.listAiProviders();
  const governancePolicies = v2AdminEngine.listAiGovernancePolicies();

  const handleTestBoundary = (action: string) => {
    setTestAction(action);
    setTestResult(v2AdminEngine.canAiExecuteAction(action));
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
                  Orchestration Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                AI orchestration for system diagnostics, signal analysis, and task briefing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Primary Provider: <strong className="text-purple-700 font-bold">Google Gemini 2.5 Flash</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 max-w-6xl mx-auto py-2">
          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'providers' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Provider Telemetry ({aiProviders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'governance' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Governance Tiers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('boundary-tester')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'boundary-tester' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
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
            <strong>METFA AI Architecture Mandate:</strong> <em>"AI does the thinking and preparation. Human does the authorization. System does the controlled execution."</em> AI models prepare task briefs and detect anomalies, but are strictly prohibited from mutating financial ledgers or self-approving payouts.
          </div>
        </div>

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
