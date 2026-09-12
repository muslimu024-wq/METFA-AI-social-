/**
 * METFA V2 — Wallet & Immutable Ledger Engine Interactive Module (Phase 7)
 * 
 * CORE MANDATES:
 * 1. Authoritative Immutable Ledger: Wallet state is strictly ledger-derived.
 * 2. Integer Minor Units: Zero floating-point arithmetic (cents).
 * 3. Prohibits direct balance mutations (walletBalance += X is strictly forbidden).
 * 4. Authoritative Ingestion: Credits originate ONLY from finalized Phase 6 Reward Allocations.
 * 5. Rejects ESTIMATED stage rewards and unfinalized revenue periods.
 * 6. Controlled State Transitions: Pending -> Approved -> Withdrawable -> Payout Hold -> Payout Debit / Release.
 * 7. Immutability: Modifications and deletions are strictly rejected; corrections append signed REVERSAL entries.
 * 8. AI Mutation Barrier: METFA AI actors are strictly blocked from authorizing or executing financial transactions.
 * 9. Deterministic Replay: reconcileWallet() proves zero discrepancies across historical ledger chains.
 * 10. Includes interactive 25-point automated verification suite.
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet,
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
  FileText,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Check,
  Bot,
} from 'lucide-react';
import {
  V2WalletAccount,
  V2WalletLedgerEntry,
  V2WalletLedgerEntryType,
  V2WalletReconciliationResult,
} from '../../../types/v2Wallet';
import { v2WalletEngine } from '../../../services/v2WalletEngine';
import { v2RewardEngine } from '../../../services/v2RewardEngine';
import { runV2WalletEngineVerification, V2WalletTestSuiteSummary } from '../../../tests/v2WalletVerification';

interface V2WalletModuleProps {
  currentRole?: string;
  currentUserId?: string;
}

export const V2WalletModule: React.FC<V2WalletModuleProps> = ({
  currentRole: initialRole = 'FINANCE_ADMIN',
  currentUserId = 'admin_demo_operator',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'wallets' | 'ledger' | 'actions' | 'verification'>('overview');
  const [actorRole, setActorRole] = useState<string>(initialRole);
  const [wallets, setWallets] = useState<V2WalletAccount[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<V2WalletLedgerEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  
  // Feedback notices
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reconciliation state
  const [reconciliationResult, setReconciliationResult] = useState<V2WalletReconciliationResult | null>(null);

  // Form states
  const [payoutHoldAmountDollars, setPayoutHoldAmountDollars] = useState<string>('10.00');
  const [payoutRequestId, setPayoutRequestId] = useState<string>(`pay_req_${Date.now()}`);
  const [adminCorrectionDollars, setAdminCorrectionDollars] = useState<string>('25.00');
  const [adminCorrectionReason, setAdminCorrectionReason] = useState<string>('Creator incentive bonus adjustment');
  const [adminCorrectionDirection, setAdminCorrectionDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [selectedEntryForReversal, setSelectedEntryForReversal] = useState<V2WalletLedgerEntry | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('Reversing ledger entry per compliance audit');

  // Test suite state
  const [testResults, setTestResults] = useState<V2WalletTestSuiteSummary | null>(null);
  const [testsRunning, setTestsRunning] = useState(false);

  // Reload data from V2 Wallet Engine
  const reloadData = () => {
    try {
      const allWallets = v2WalletEngine.listWallets();
      setWallets(allWallets);

      if (allWallets.length > 0) {
        const activeId = selectedWalletId && allWallets.some((w) => w.id === selectedWalletId)
          ? selectedWalletId
          : allWallets[0].id;
        setSelectedWalletId(activeId);
        setLedgerEntries(v2WalletEngine.getWalletLedger(activeId));
      } else {
        setLedgerEntries([]);
      }
    } catch (err: unknown) {
      console.error('Failed to load wallet data:', err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  useEffect(() => {
    if (selectedWalletId) {
      setLedgerEntries(v2WalletEngine.getWalletLedger(selectedWalletId));
      setReconciliationResult(null);
    }
  }, [selectedWalletId]);

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) || wallets[0];

  const formatCurrency = (cents: number, currency = 'USD') => {
    const dollars = (cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${currency === 'BDT' ? '৳' : '$'}${dollars}`;
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleReconcile = (walletId: string) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = v2WalletEngine.reconcileWallet(walletId);
      setReconciliationResult(result);
      if (result.is_reconciled) {
        setSuccessMsg(`Wallet '${walletId}' successfully reconciled against ${result.replayed_ledger_entries_count} ledger entries with 0 discrepancies.`);
      } else {
        setErrorMsg(`Reconciliation variance detected: ${result.discrepancies.join(', ')}`);
      }
    } catch (err: unknown) {
      setErrorMsg(`Reconciliation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHoldPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cents = Math.round(parseFloat(payoutHoldAmountDollars || '0') * 100);
    if (isNaN(cents) || cents <= 0) {
      setErrorMsg('Invalid payout hold amount. Must be greater than 0.');
      setIsProcessing(false);
      return;
    }

    const res = v2WalletEngine.holdForPayout({
      payout_request_id: payoutRequestId,
      user_id: selectedWallet.user_id,
      amount_cents: cents,
      currency: selectedWallet.currency,
      actor_id: currentUserId,
      actor_role: actorRole,
    });

    if (res.success) {
      setSuccessMsg(`Successfully placed ${formatCurrency(cents)} hold for payout request '${payoutRequestId}'.`);
      setPayoutRequestId(`pay_req_${Date.now()}`);
      reloadData();
    } else {
      setErrorMsg(res.error || 'Failed to place payout hold.');
    }
    setIsProcessing(false);
  };

  const handleDebitPayout = () => {
    if (!selectedWallet) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = v2WalletEngine.debitPayout({
      payout_request_id: payoutRequestId,
      user_id: selectedWallet.user_id,
      actor_id: currentUserId,
      actor_role: actorRole,
    });

    if (res.success) {
      setSuccessMsg(`Payout debit finalized: Held funds permanently deducted.`);
      setPayoutRequestId(`pay_req_${Date.now()}`);
      reloadData();
    } else {
      setErrorMsg(res.error || 'Failed to debit payout.');
    }
    setIsProcessing(false);
  };

  const handleReleaseHold = () => {
    if (!selectedWallet) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = v2WalletEngine.releasePayoutHold({
      payout_request_id: payoutRequestId,
      user_id: selectedWallet.user_id,
      reason: 'Manual hold release by operator',
      actor_id: currentUserId,
      actor_role: actorRole,
    });

    if (res.success) {
      setSuccessMsg(`Payout hold released. Funds returned to available balance.`);
      reloadData();
    } else {
      setErrorMsg(res.error || 'Failed to release payout hold.');
    }
    setIsProcessing(false);
  };

  const handleAdminCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cents = Math.round(parseFloat(adminCorrectionDollars || '0') * 100);
    if (isNaN(cents) || cents <= 0) {
      setErrorMsg('Invalid adjustment amount. Must be greater than 0.');
      setIsProcessing(false);
      return;
    }

    const res = v2WalletEngine.adminCorrection({
      wallet_id: selectedWallet.id,
      user_id: selectedWallet.user_id,
      amount_cents: cents,
      direction: adminCorrectionDirection,
      reason: adminCorrectionReason,
      actor_id: currentUserId,
      actor_role: actorRole,
    });

    if (res.success) {
      setSuccessMsg(`Admin correction recorded: ${adminCorrectionDirection} of ${formatCurrency(cents)} successfully appended to ledger.`);
      reloadData();
    } else {
      setErrorMsg(res.error || 'Admin correction rejected.');
    }
    setIsProcessing(false);
  };

  const handleReverseEntry = () => {
    if (!selectedEntryForReversal) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = v2WalletEngine.reverseLedgerEntry({
      ledger_entry_id: selectedEntryForReversal.id,
      reason: reversalReason,
      actor_id: currentUserId,
      actor_role: actorRole,
    });

    if (res.success) {
      setSuccessMsg(`Reversal appended successfully: Reference entry '${selectedEntryForReversal.id}' reversed with new entry '${res.reversal_entry?.id}'.`);
      setSelectedEntryForReversal(null);
      reloadData();
    } else {
      setErrorMsg(res.error || 'Reversal failed.');
    }
    setIsProcessing(false);
  };

  const handleCreditLatestReward = () => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const periods = v2RewardEngine.listSettlementPeriods();
      const finalizedPeriod = periods.find((p) => p.status === 'FINALIZED') || periods[0];

      if (!finalizedPeriod) {
        setErrorMsg('No Phase 6 reward settlement periods found. Please run a settlement in METFA Rewards first.');
        setIsProcessing(false);
        return;
      }

      const allocations = v2RewardEngine.getAllocationsForPeriod(finalizedPeriod.id);
      const eligibleAlloc = allocations.find((a) => a.status === 'APPROVED' || a.status === 'WITHDRAWABLE');

      if (!eligibleAlloc) {
        setErrorMsg('No finalized/withdrawable reward allocations found in the latest settlement period.');
        setIsProcessing(false);
        return;
      }

      const res = v2WalletEngine.creditFromRewardAllocation({
        allocation_id: eligibleAlloc.id,
        actor_id: currentUserId,
        actor_role: actorRole,
        auto_release: true,
      });

      if (res.success) {
        setSuccessMsg(`Authoritative credit ingested: ${formatCurrency(eligibleAlloc.allocated_cents)} credited for user '${eligibleAlloc.user_id}' from allocation '${eligibleAlloc.id}'. ${res.is_cached ? '(Cached duplicate - no double count)' : ''}`);
        reloadData();
      } else {
        setErrorMsg(res.error || 'Reward credit failed.');
      }
    } catch (err: unknown) {
      setErrorMsg(`Reward credit ingestion error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunVerification = () => {
    setTestsRunning(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    setTimeout(() => {
      try {
        const summary = runV2WalletEngineVerification();
        setTestResults(summary);
        if (summary.failedTests === 0) {
          setSuccessMsg(`Verification Passed: All ${summary.totalTests} Phase 7 test checks completed successfully.`);
        } else {
          setErrorMsg(`Verification Notice: ${summary.failedTests} of ${summary.totalTests} checks failed.`);
        }
      } catch (err: unknown) {
        setErrorMsg(`Verification execution error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setTestsRunning(false);
      }
    }, 150);
  };

  const filteredLedgerEntries = ledgerEntries.filter((entry) => {
    if (typeFilter === 'ALL') return true;
    return entry.entry_type === typeFilter;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Actor Role Simulation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-inner">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                  METFA Wallet & Immutable Ledger
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Phase 7 Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Authoritative financial state engine with append-only ledger replay, integer minor-unit accounting, and strict AI mutation barriers.
              </p>
            </div>
          </div>

          {/* Actor Role Switcher */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 shrink-0 self-start md:self-auto">
            <span className="text-xs font-semibold text-slate-600 pl-1">Actor Role:</span>
            <select
              value={actorRole}
              onChange={(e) => setActorRole(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="FINANCE_ADMIN">FINANCE_ADMIN (Authorized)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (Authorized)</option>
              <option value="OPERATOR">OPERATOR (Holds/Releases)</option>
              <option value="USER">USER (Standard User)</option>
              <option value="METFA_AI">METFA_AI (Strictly Blocked)</option>
            </select>
            {actorRole === 'METFA_AI' && (
              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Blocked
              </span>
            )}
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Invariants', icon: ShieldCheck },
          { id: 'wallets', label: 'Wallet Accounts', icon: Wallet },
          { id: 'ledger', label: 'Immutable Ledger', icon: FileText },
          { id: 'actions', label: 'Financial Operations', icon: ArrowRight },
          { id: 'verification', label: 'Verification Suite (25)', icon: Play },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: OVERVIEW & INVARIANTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Available</span>
              <span className="text-base sm:text-lg font-bold text-emerald-600 mt-1 block">
                {formatCurrency(selectedWallet?.available_balance_cents || 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Withdrawable balance</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Pending</span>
              <span className="text-base sm:text-lg font-bold text-amber-600 mt-1 block">
                {formatCurrency(selectedWallet?.pending_balance_cents || 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">In review window</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Approved</span>
              <span className="text-base sm:text-lg font-bold text-purple-600 mt-1 block">
                {formatCurrency(selectedWallet?.approved_balance_cents || 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Awaiting release</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Locked Hold</span>
              <span className="text-base sm:text-lg font-bold text-slate-700 mt-1 block">
                {formatCurrency(selectedWallet?.locked_balance_cents || 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Held for payout</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Earnings</span>
              <span className="text-base sm:text-lg font-bold text-slate-900 mt-1 block">
                {formatCurrency(selectedWallet?.lifetime_earnings_cents || 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Lifetime credited</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Payouts</span>
              <span className="text-base sm:text-lg font-bold text-slate-900 mt-1 block">
                {formatCurrency(selectedWallet?.lifetime_payouts_cents || 0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Lifetime debited</span>
            </div>
          </div>

          {/* Core Architectural Invariants */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <span>Phase 7 Financial Architectural Directives</span>
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
                100% Invariant Enforcement
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Immutable Append-Only Ledger</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  Account balances are strictly derived from the sequential replay of ledger entries. Direct mutations (<code className="font-mono text-purple-700">balance += X</code>) are forbidden.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Integer Minor-Unit Math (BIGINT Cents)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  Zero floating-point operations. All financial math utilizes integer minor units to eliminate rounding drift across currency lifecycles.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Authoritative Reward Ingestion Boundary</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  Credits can only originate from finalized Phase 6 Reward Allocations. Unfinalized revenue periods and ESTIMATED stages are rejected.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>METFA AI Mutation Barrier</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">
                  AI actors are strictly prohibited from authorizing or mutating wallet accounts, ledger records, holds, or policy settings.
                </p>
              </div>
            </div>

            {/* Reconciliation Proof Card */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800">Deterministic Replay Proof:</span>
                <span className="text-xs text-slate-500 ml-1.5">
                  Verify current account balance against historical ledger playback.
                </span>
              </div>
              <button
                type="button"
                onClick={() => selectedWallet && handleReconcile(selectedWallet.id)}
                disabled={isProcessing || !selectedWallet}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Reconcile Selected Wallet</span>
              </button>
            </div>

            {reconciliationResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                reconciliationResult.is_reconciled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {reconciliationResult.is_reconciled ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                    Reconciliation Status: {reconciliationResult.is_reconciled ? 'PERFECT RECONCILIATION (0 Discrepancies)' : 'DISCREPANCY DETECTED'}
                  </span>
                  <span>{reconciliationResult.replayed_ledger_entries_count} Entries Replayed</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div>Account Avail: {formatCurrency(reconciliationResult.account_available_balance_cents)}</div>
                  <div>Replayed Avail: {formatCurrency(reconciliationResult.ledger_derived_available_cents)}</div>
                  <div>Account Locked: {formatCurrency(reconciliationResult.account_locked_balance_cents)}</div>
                  <div>Replayed Locked: {formatCurrency(reconciliationResult.ledger_derived_locked_cents)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WALLET ACCOUNTS */}
      {activeTab === 'wallets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Registered Wallet Accounts ({wallets.length})</h2>
            <button
              type="button"
              onClick={reloadData}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wallets.map((wallet) => {
              const isSelected = wallet.id === selectedWalletId;
              return (
                <div
                  key={wallet.id}
                  onClick={() => setSelectedWalletId(wallet.id)}
                  className={`p-5 rounded-2xl border transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-purple-50/40 border-purple-300 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{wallet.id}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {wallet.currency}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5 block">User: {wallet.user_id}</span>
                    </div>

                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      {formatCurrency(wallet.available_balance_cents, wallet.currency)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200/80 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Pending</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(wallet.pending_balance_cents, wallet.currency)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Approved</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(wallet.approved_balance_cents, wallet.currency)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Locked Hold</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(wallet.locked_balance_cents, wallet.currency)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                    <span>Lifetime Earned: {formatCurrency(wallet.lifetime_earnings_cents, wallet.currency)}</span>
                    <span>Lifetime Paid: {formatCurrency(wallet.lifetime_payouts_cents, wallet.currency)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: IMMUTABLE LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Wallet:</span>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="text-xs font-mono font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id} ({w.user_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Filter Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="ALL">All Entry Types</option>
                <option value="REWARD_CREDIT">REWARD_CREDIT</option>
                <option value="PAYOUT_HOLD">PAYOUT_HOLD</option>
                <option value="PAYOUT_DEBIT">PAYOUT_DEBIT</option>
                <option value="PAYOUT_RELEASE">PAYOUT_RELEASE</option>
                <option value="ADMIN_CORRECTION">ADMIN_CORRECTION</option>
                <option value="REVERSAL">REVERSAL</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Entry ID / Hash</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredLedgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No ledger entries found for selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerEntries.map((entry) => {
                      const isCredit = entry.direction === 'CREDIT';
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-slate-800 block truncate max-w-[140px]" title={entry.id}>
                              {entry.id}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px]" title={entry.idempotency_key}>
                              Key: {entry.idempotency_key}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              entry.entry_type === 'REWARD_CREDIT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : entry.entry_type === 'PAYOUT_HOLD'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : entry.entry_type === 'PAYOUT_DEBIT'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : entry.entry_type === 'REVERSAL'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {entry.entry_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <span className={isCredit ? 'text-emerald-600' : 'text-rose-600'}>
                              {isCredit ? '+' : '-'}{formatCurrency(entry.amount_cents, entry.currency)}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {formatCurrency(entry.balance_after_cents, entry.currency)}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <span className="block font-medium">{entry.actor_role}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[100px]">{entry.actor_id}</span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {entry.entry_type !== 'REVERSAL' && (
                              <button
                                type="button"
                                onClick={() => setSelectedEntryForReversal(entry)}
                                className="px-2 py-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-md transition cursor-pointer"
                                title="Reverse this entry (Appends signed REVERSAL entry)"
                              >
                                Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reversal Confirmation Modal / Card */}
          {selectedEntryForReversal && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                  Append Immutable Reversal Entry for '{selectedEntryForReversal.id}'
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedEntryForReversal(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-purple-800">
                Notice: The original ledger entry will remain completely intact. A new signed <code className="font-mono font-bold">REVERSAL</code> entry of <code className="font-mono font-bold">{formatCurrency(selectedEntryForReversal.amount_cents)}</code> will be appended.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Compliance reversal justification..."
                  className="flex-1 text-xs bg-white border border-purple-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={handleReverseEntry}
                  disabled={isProcessing}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  Confirm Reversal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FINANCIAL OPERATIONS & BOUNDARIES */}
      {activeTab === 'actions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action 1: Ingest Reward Credit */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span>Phase 6 Reward Allocation Ingestion</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Authoritatively ingests finalized reward allocations into the wallet ledger. Only approved/withdrawable allocations can be credited.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Selected Wallet:</span>
                <span className="font-mono font-bold text-slate-800">{selectedWallet?.id}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Target User:</span>
                <span className="font-mono text-slate-800">{selectedWallet?.user_id}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreditLatestReward}
              disabled={isProcessing}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Ingest Latest Finalized Reward</span>
            </button>
          </div>

          {/* Action 2: Payout Hold & Debit Flow */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ArrowUpRight className="w-4 h-4 text-purple-600" />
                <span>Payout Hold & Finalization Flow</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Transfers withdrawable balance to locked hold state, followed by debit or release.
              </p>
            </div>

            <form onSubmit={handleHoldPayout} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Hold Amount ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={payoutHoldAmountDollars}
                  onChange={(e) => setPayoutHoldAmountDollars(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Place Payout Hold
                </button>
                <button
                  type="button"
                  onClick={handleDebitPayout}
                  disabled={isProcessing || (selectedWallet?.locked_balance_cents || 0) <= 0}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer disabled:opacity-40"
                  title="Permanently debits held funds (Idempotent)"
                >
                  Finalize Debit
                </button>
                <button
                  type="button"
                  onClick={handleReleaseHold}
                  disabled={isProcessing || (selectedWallet?.locked_balance_cents || 0) <= 0}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-40"
                  title="Releases held funds back to available balance"
                >
                  Release Hold
                </button>
              </div>
            </form>
          </div>

          {/* Action 3: Administrative Correction */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Admin Ledger Correction</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Appends a signed audit entry for manual partner bonus or dispute resolution.
              </p>
            </div>

            <form onSubmit={handleAdminCorrection} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Direction</label>
                  <select
                    value={adminCorrectionDirection}
                    onChange={(e) => setAdminCorrectionDirection(e.target.value as 'CREDIT' | 'DEBIT')}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-semibold"
                  >
                    <option value="CREDIT">CREDIT (+)</option>
                    <option value="DEBIT">DEBIT (-)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Amount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={adminCorrectionDollars}
                    onChange={(e) => setAdminCorrectionDollars(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Audit Justification</label>
                <input
                  type="text"
                  value={adminCorrectionReason}
                  onChange={(e) => setAdminCorrectionReason(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                Post Signed Correction
              </button>
            </form>
          </div>

          {/* Action 4: AI Barrier Demonstration */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Bot className="w-4 h-4 text-rose-600" />
                <span>AI Financial Barrier Test</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Attempts to authorize a ledger entry as an autonomous AI agent. Demonstrates the strict rejection barrier mandated by METFA V2.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs space-y-1">
              <span className="font-bold block">Safety Rule:</span>
              <span>METFA AI agents cannot create money, approve payouts, or modify ledger records under any circumstances.</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const res = v2WalletEngine.adminCorrection({
                  wallet_id: selectedWallet?.id || 'wlt_test',
                  user_id: selectedWallet?.user_id || 'usr_test',
                  amount_cents: 1000,
                  direction: 'CREDIT',
                  reason: 'AI attempted unauthorized credit',
                  actor_id: 'ai_bot_agent',
                  actor_role: 'METFA_AI',
                });
                if (!res.success) {
                  setErrorMsg(`Boundary Protection Confirmed: ${res.error}`);
                }
              }}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Simulate AI Credit Attempt</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: VERIFICATION SUITE */}
      {activeTab === 'verification' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Phase 7 Automated Verification Suite (25 Tests)
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                Executes end-to-end tests covering account initialization, authoritative reward credit, idempotency, append-only immutability, negative balance protection, payout holds, and reconciliation replay.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunVerification}
              disabled={testsRunning}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              <Play className={`w-4 h-4 ${testsRunning ? 'animate-spin' : ''}`} />
              <span>{testsRunning ? 'Running Verification...' : 'Execute 25-Point Test Suite'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-4">
              {/* Scorecard */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <span className="text-xs text-slate-500 block">Total Checks</span>
                  <span className="text-xl font-bold text-slate-900">{testResults.totalTests}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <span className="text-xs text-emerald-600 font-medium block">Passed Checks</span>
                  <span className="text-xl font-bold text-emerald-600">{testResults.passedTests}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <span className="text-xs text-rose-600 font-medium block">Failed Checks</span>
                  <span className="text-xl font-bold text-rose-600">{testResults.failedTests}</span>
                </div>
              </div>

              {/* Individual Test Cards */}
              <div className="space-y-2">
                {testResults.results.map((result) => (
                  <div
                    key={result.testId}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                      result.passed
                        ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950'
                        : 'bg-rose-50/50 border-rose-200/80 text-rose-950'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {result.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{result.testId}</span>
                          <span className="font-semibold">{result.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          {result.message}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                      result.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {result.passed ? 'PASS' : 'FAIL'}
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

export default V2WalletModule;
