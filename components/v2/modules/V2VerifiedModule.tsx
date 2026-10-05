/**
 * METFA V2 — Verified Module (METFA Verified)
 *
 * Creator verification, identity validation, and authentic account tier badges.
 * Exposes live verification queues from v2AdminEngine, tier requirements, and review gates.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  UserCheck,
  FileText,
  AlertCircle,
  Filter,
  Search,
  Award,
  Lock,
  ChevronRight,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { V2ApprovalItem, V2UserRole } from '../../../types/v2Admin';
import { v2AdminEngine } from '../../../services/v2AdminEngine';
import { getClientAuthToken } from '../../../services/supabaseClient';

export const V2VerifiedModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'tiers' | 'audit'>('queue');
  const [verificationItems, setVerificationItems] = useState<V2ApprovalItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<V2ApprovalItem | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>('Identity documents and portfolio verified.');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const reloadData = () => {
    try {
      const pending = v2AdminEngine.listPendingApprovals().filter(
        (item) => item.category === 'VERIFICATION'
      );
      setVerificationItems(pending);
      if (pending.length > 0 && !selectedItem) {
        setSelectedItem(pending[0]);
      }
    } catch (err) {
      console.error('Failed to load verification items', err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleDecision = async (itemId: string, decision: 'APPROVED' | 'REJECTED') => {
    setActionSuccess(null);
    setActionError(null);

    const token = await getClientAuthToken();
    if (token) {
      try {
        const res = await fetch(`/api/v2/admin/approvals/${encodeURIComponent(itemId)}/decide`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            decision,
            notes: decisionNotes,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setActionSuccess(`Verification successfully marked as ${decision}. Audit record created.`);
          setSelectedItem(null);
          reloadData();
          return;
        } else if (!res.ok) {
          setActionError(data?.error || `Server authorization error (${res.status}).`);
          return;
        }
      } catch (err) {
        console.warn('Network call failed, relying on engine state:', err);
      }
    }

    const res = v2AdminEngine.decideApproval({
      itemId,
      decision,
      actor_id: 'operator_current',
      actor_role: 'ADMIN',
      notes: decisionNotes,
    });

    if (res.success) {
      setActionSuccess(`Verification successfully marked as ${decision}.`);
      setSelectedItem(null);
      reloadData();
    } else {
      setActionError(res.error || 'Failed to submit decision.');
    }
  };

  const filteredItems = verificationItems.filter((item) =>
    searchQuery === ''
      ? true
      : item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.requesterId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-700 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Verified
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Live Gate
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Creator verification, identity validation, and authentic account tier badges
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              Pending Applications: <strong className="text-purple-700 font-bold">{verificationItems.length}</strong>
            </span>
            <button
              type="button"
              onClick={reloadData}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer transition"
              title="Refresh"
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

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 max-w-6xl mx-auto py-2">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'queue' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Verification Queue ({verificationItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tiers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tiers' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Identity Tiers & Badges</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
        {activeTab === 'queue' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Applications
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {filteredItems.length} awaiting review
                </span>
              </div>

              {filteredItems.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  All verification applications have been reviewed.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-4 rounded-xl border transition cursor-pointer ${
                      selectedItem?.id === item.id
                        ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-2 leading-relaxed">
                      {item.summary}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Requester: {item.requesterId}</span>
                      <span>AI: {Math.round((item.aiAnalysis?.confidence || 0) * 100)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Detail View */}
            <div className="lg:col-span-2">
              {selectedItem ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                        {selectedItem.category}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-2">
                        {selectedItem.title}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Application ID: <code className="font-mono text-slate-700">{selectedItem.id}</code> • Entity: <code className="font-mono text-slate-700">{selectedItem.affectedEntityId}</code>
                      </p>
                    </div>
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      Pending Human Authorization
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Application Summary & Credentials
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      {selectedItem.summary}
                    </p>
                  </div>

                  {/* AI Advisory Analysis */}
                  {selectedItem.aiAnalysis && (
                    <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-bold text-purple-900">
                          AI Advisory Review ({Math.round(selectedItem.aiAnalysis.confidence * 100)}% Confidence Score)
                        </span>
                      </div>
                      <p className="text-xs text-purple-800 leading-relaxed">
                        Recommendation: <strong>{selectedItem.aiAnalysis.recommendation}</strong> — {selectedItem.aiAnalysis.reasoning}
                      </p>
                      <div className="text-[11px] text-purple-600 pt-1">
                        AI Directive: Prepared by AI advisory engine. Final approval requires human operator signature.
                      </div>
                    </div>
                  )}

                  {/* Decision Controls */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700">
                      Verification Decision Notes & Justification
                    </label>
                    <input
                      type="text"
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter verification notes..."
                    />

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleDecision(selectedItem.id, 'APPROVED')}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Grant Verification Badge</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(selectedItem.id, 'REJECTED')}
                        className="py-2.5 px-4 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Reject Application
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
                  Select an application from the queue to inspect credentials.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tiers' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Canonical Identity & Verification Tiers</h2>
              <p className="text-xs text-slate-500">
                METFA Social enforces cryptographic and portfolio standards for verification badges across the ecosystem.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h3 className="text-xs font-bold text-slate-900">STANDARD USER</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Standard authenticated account. Basic social access, public posts, and general engagement tracking.
                  </p>
                  <span className="text-[10px] font-mono text-slate-400 block pt-1">Threshold: Default on signup</span>
                </div>

                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-purple-900">VERIFIED CREATOR</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Verified creator badge. Eligible for weighted contribution points, sponsored campaigns, and audio attribution.
                  </p>
                  <span className="text-[10px] font-mono text-purple-700 block pt-1">Threshold: ID check + 10+ original posts</span>
                </div>

                <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-teal-600" />
                    <h3 className="text-xs font-bold text-teal-900">PARTNER / OFFICIAL</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Official platform partner or licensed merchant. Priority payout routing, brand sync, and enterprise ads placement.
                  </p>
                  <span className="text-[10px] font-mono text-teal-700 block pt-1">Threshold: Commercial sync review</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default V2VerifiedModule;
