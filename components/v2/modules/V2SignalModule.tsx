/**
 * METFA V2 — Signal Module (METFA Signal)
 *
 * Contextual and global system alerts, performance anomalies, and incident tracking.
 * Connects directly to v2RiskEngine signals, engine health, and audit trail.
 */

import React, { useState, useEffect } from 'react';
import {
  Siren,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Filter,
  Activity,
  Clock,
  Bot,
  RefreshCw,
  Search,
  Check,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { V2RiskSignal, V2RiskSeverity } from '../../../types/v2Risk';
import { v2RiskEngine } from '../../../services/v2RiskEngine';

export const V2SignalModule: React.FC = () => {
  const [signals, setSignals] = useState<V2RiskSignal[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedSignal, setSelectedSignal] = useState<V2RiskSignal | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('Investigation complete. Anomaly resolved.');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reloadData = () => {
    try {
      const all = v2RiskEngine.listSignals();
      setSignals(all);
      if (all.length > 0 && !selectedSignal) {
        setSelectedSignal(all[0]);
      }
    } catch (err) {
      console.error('Failed to load risk signals', err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const engineHealth = v2RiskEngine.getEngineHealth();

  const handleResolveSignal = (signalId: string, status: 'RESOLVED' | 'DISMISSED') => {
    setActionSuccess(null);
    setActionError(null);

    const res = v2RiskEngine.resolveSignal({
      signal_id: signalId,
      resolution: status,
      notes: resolutionNotes,
      actor_id: 'operator_current',
      actor_role: 'ADMIN',
    });

    if (res.success) {
      setActionSuccess(`Signal ${signalId} successfully marked as ${status}.`);
      reloadData();
      if (selectedSignal?.id === signalId && res.signal) {
        setSelectedSignal(res.signal);
      }
    } else {
      setActionError(res.error || 'Failed to update signal.');
    }
  };

  const filteredSignals = signals.filter(
    (s) => selectedSeverity === 'ALL' || s.severity === selectedSeverity
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-xs">
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Signal
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                  <Activity className="w-3 h-3 mr-1 text-rose-600" />
                  Live Detection
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Contextual and global system alerts, performance anomalies, and incident tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              Active Signals: <strong className="text-rose-600 font-bold">{engineHealth.active_signals_count}</strong>
            </span>
            <button
              type="button"
              onClick={reloadData}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer transition"
              title="Refresh Signals"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Notifications */}
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

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Total Signals</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{engineHealth.total_signals_detected}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Active Signals</span>
            <div className="text-lg font-bold text-rose-600 mt-0.5">{engineHealth.active_signals_count}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Under Review</span>
            <div className="text-lg font-bold text-amber-600 mt-0.5">{engineHealth.under_review_count}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Resolved</span>
            <div className="text-lg font-bold text-emerald-600 mt-0.5">{engineHealth.resolved_signals_count}</div>
          </div>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSelectedSeverity(sev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedSeverity === sev
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Signals List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {filteredSignals.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                No signals registered matching filter.
              </div>
            ) : (
              filteredSignals.map((sig) => (
                <div
                  key={sig.id}
                  onClick={() => setSelectedSignal(sig)}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    selectedSignal?.id === sig.id
                      ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sig.severity === 'CRITICAL' || sig.severity === 'HIGH'
                          ? 'bg-rose-100 text-rose-800'
                          : sig.severity === 'WARNING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sig.severity}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Score: {sig.risk_score}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 mb-1">{sig.signal_type}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {String(sig.evidence?.description || sig.recommended_action || sig.signal_type)}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-2">
                    <span>{sig.status}</span>
                    <span>{new Date(sig.detected_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Signal Detail */}
          <div className="lg:col-span-2">
            {selectedSignal ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600">
                      {selectedSignal.category} • Module: {selectedSignal.affected_module}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-1">
                      {selectedSignal.signal_type}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Signal ID: {selectedSignal.id} • Target User: {selectedSignal.user_id}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      selectedSignal.status === 'ACTIVE'
                        ? 'bg-rose-100 text-rose-800'
                        : selectedSignal.status === 'UNDER_REVIEW'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedSignal.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Deterministic Rule Explanation
                  </h4>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                    {String(selectedSignal.evidence?.description || selectedSignal.recommended_action || selectedSignal.signal_type)}
                  </p>
                </div>

                {/* Evidence Payload */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Evidence Diagnostics
                  </h4>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedSignal.evidence, null, 2)}
                  </pre>
                </div>

                {/* Operator Actions */}
                {selectedSignal.status === 'ACTIVE' || selectedSignal.status === 'UNDER_REVIEW' ? (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700">
                      Resolution Notes & Operator Justification
                    </label>
                    <input
                      type="text"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="Enter resolution notes..."
                    />

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleResolveSignal(selectedSignal.id, 'RESOLVED')}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Resolve Signal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveSignal(selectedSignal.id, 'DISMISSED')}
                        className="py-2.5 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Dismiss as False Positive
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs">
                    This signal has been resolved ({selectedSignal.resolved_at ? new Date(selectedSignal.resolved_at).toLocaleString() : 'Done'}).
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
                Select a signal from the list to view evidence diagnostics.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default V2SignalModule;
