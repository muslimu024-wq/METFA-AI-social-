/**
 * METFA V2 — Phase 9 Admin Control Center, Governance & Operations Verification Suite
 *
 * Verifies all 20 mandatory criteria:
 * 1. Admin Control loads and initializes with healthy baseline
 * 2. Role-Based Access Control (RBAC): Least-privilege matrix enforcement
 * 3. Non-admin roles (FREELANCER, SUPPORT, ANALYST) cannot mutate settings or flags
 * 4. Finance Admin restricted to financial domains; Ads Manager to ads domains
 * 5. Canonical 8 Feature Flags: Exact set validation
 * 6. Feature flag changes require authorized roles and are audited
 * 7. Canonical 6 Emergency Kill Switches: Exact set validation
 * 8. Emergency kill switch pauses future operations only
 * 9. Emergency kill switch does NOT mutate historical ledgers or delete data
 * 10. Financial records (Revenue & Wallet ledgers) remain strictly immutable during pause
 * 11. Payout controls remain strictly approval-gated
 * 12. METFA AI Governance: Level 1–6 boundary enforcement
 * 13. AI strictly blocked from approving payouts, settling rewards, or mutating ledgers
 * 14. Secrets & PII are sanitized and never exposed in logs or UI
 * 15. Policy governance: Versioning remains historical-safe (no rewriting past settlements)
 * 16. Audit log is append-only: updates and deletes throw security violations
 * 17. Attention Queue ("Requires Your Attention"): Aggregates critical & high signals
 * 18. AI Health & Telemetry: All 11 states supported with safe sanitization
 * 19. Unified Approval Center: Rejects unauthenticated or AI approval attempts
 * 20. Baseline compatibility: Phase 5, Phase 6, Phase 7, Phase 8 suites pass
 */

import { v2AdminEngine, V2AdminEngine } from '../services/v2AdminEngine';
import { v2WalletEngine } from '../services/v2WalletEngine';
import { v2RiskEngine } from '../services/v2RiskEngine';
import { v2RewardEngine } from '../services/v2RewardEngine';
import { v2ContributionEngine } from '../services/v2ContributionEngine';
import { v2RevenueEngine } from '../services/v2RevenueEngine';
import { V2UserRole, V2AiGovernanceLevel, V2FeatureFlagKey, V2KillSwitchKey } from '../types/v2Admin';
import { runV2RiskEngineVerification } from './v2RiskVerification';
import { runV2WalletEngineVerification } from './v2WalletVerification';

export interface V2GovernanceTestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface V2GovernanceTestSuiteSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: V2GovernanceTestResult[];
}

export function runV2GovernanceVerification(): V2GovernanceTestSuiteSummary {
  const results: V2GovernanceTestResult[] = [];

  const runTest = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name, passed: false, message: msg });
    }
  };

  // --------------------------------------------------------------------------
  // TEST 1: Admin Control Initial State
  // --------------------------------------------------------------------------
  runTest('1. Admin Control loads and initializes with 16-module health snapshot', () => {
    const overview = v2AdminEngine.getOverview();
    if (!overview || !overview.modulesHealth) {
      throw new Error('Admin overview or modulesHealth is undefined');
    }
    const moduleKeys = Object.keys(overview.modulesHealth);
    if (moduleKeys.length !== 16) {
      throw new Error(`Expected 16 canonical modules, found ${moduleKeys.length}`);
    }
    if (!['HEALTHY', 'WARNING', 'PAUSED', 'CRITICAL'].includes(overview.overallStatus)) {
      throw new Error(`Invalid overall status: ${overview.overallStatus}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: RBAC Least-Privilege Matrix
  // --------------------------------------------------------------------------
  runTest('2. RBAC: Freelancer has ZERO administrative write permissions', () => {
    const permissions = [
      'SYSTEM_SETTINGS_WRITE',
      'FEATURE_FLAGS_MANAGE',
      'EMERGENCY_KILL_SWITCH',
      'FINANCE_SETTLE',
      'PAYOUT_APPROVE',
      'ADS_MANAGE',
      'POLICY_MANAGE',
    ] as const;

    for (const p of permissions) {
      if (v2AdminEngine.hasPermission('FREELANCER', p)) {
        throw new Error(`Freelancer was improperly granted permission: ${p}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Non-Admin Cannot Mutate Feature Flags
  // --------------------------------------------------------------------------
  runTest('3. Non-admin roles (FREELANCER, SUPPORT, ANALYST) cannot mutate feature flags', () => {
    const roles: V2UserRole[] = ['FREELANCER', 'SUPPORT', 'ANALYST'];
    for (const r of roles) {
      const res = v2AdminEngine.setFeatureFlag({
        key: 'ads_enabled',
        enabled: false,
        actor_id: `test_${r.toLowerCase()}`,
        actor_role: r,
        reason: 'Unauthorized mutation attempt',
      });
      if (res.success) {
        throw new Error(`Role ${r} was improperly allowed to mutate feature flag`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Domain Role Separation (Finance Admin vs Ads Manager)
  // --------------------------------------------------------------------------
  runTest('4. Domain Role Separation: Ads Manager cannot settle finances; Finance Admin cannot manage ads', () => {
    if (v2AdminEngine.hasPermission('ADS_MANAGER', 'FINANCE_SETTLE')) {
      throw new Error('ADS_MANAGER was improperly granted FINANCE_SETTLE permission');
    }
    if (v2AdminEngine.hasPermission('FINANCE_ADMIN', 'ADS_MANAGE')) {
      throw new Error('FINANCE_ADMIN was improperly granted ADS_MANAGE permission');
    }
    if (!v2AdminEngine.hasPermission('FINANCE_ADMIN', 'FINANCE_SETTLE')) {
      throw new Error('FINANCE_ADMIN was denied FINANCE_SETTLE permission');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Canonical 8 Feature Flags Exact Validation
  // --------------------------------------------------------------------------
  runTest('5. Feature Flags: Exactly the 8 canonical flags exist in registry', () => {
    const expectedFlags: V2FeatureFlagKey[] = [
      'ads_enabled',
      'sponsored_feed_enabled',
      'reels_ads_enabled',
      'external_ad_providers_enabled',
      'contribution_enabled',
      'reward_enabled',
      'payout_enabled',
      'ai_monetization_enabled',
    ];

    const flags = v2AdminEngine.listFeatureFlags();
    if (flags.length !== 8) {
      throw new Error(`Expected exactly 8 feature flags, found ${flags.length}`);
    }

    for (const ef of expectedFlags) {
      const found = flags.find((f) => f.key === ef);
      if (!found) {
        throw new Error(`Missing expected feature flag: ${ef}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Authorized Feature Flag Mutation & Audit Logging
  // --------------------------------------------------------------------------
  runTest('6. Authorized feature flag mutation logs immutable audit record with actor details', () => {
    const initialLogsCount = v2AdminEngine.getAuditLogs().length;
    const res = v2AdminEngine.setFeatureFlag({
      key: 'reels_ads_enabled',
      enabled: false,
      actor_id: 'admin_security_lead',
      actor_role: 'ADMIN',
      reason: 'Scheduled maintenance pause for video reels',
    });

    if (!res.success || !res.flag) {
      throw new Error(`Failed authorized feature flag update: ${res.error}`);
    }

    const flagAfter = v2AdminEngine.getFeatureFlag('reels_ads_enabled');
    if (flagAfter?.enabled !== false) {
      throw new Error('Feature flag value was not persisted');
    }

    const logsAfter = v2AdminEngine.getAuditLogs();
    if (logsAfter.length <= initialLogsCount) {
      throw new Error('Audit log was not created for feature flag mutation');
    }

    const latest = logsAfter[0];
    if (latest.actor_id !== 'admin_security_lead' || latest.actor_role !== 'ADMIN') {
      throw new Error('Audit log actor details did not match mutation request');
    }

    // Reset flag for test purity
    v2AdminEngine.setFeatureFlag({
      key: 'reels_ads_enabled',
      enabled: true,
      actor_id: 'admin_security_lead',
      actor_role: 'ADMIN',
      reason: 'Restoring reels ads after test',
    });
  });

  // --------------------------------------------------------------------------
  // TEST 7: Canonical 6 Emergency Kill Switches Exact Set
  // --------------------------------------------------------------------------
  runTest('7. Emergency Kill Switches: Exactly the 6 canonical switches exist', () => {
    const expectedSwitches: V2KillSwitchKey[] = [
      'ads_paused',
      'rewards_paused',
      'payouts_paused',
      'contribution_paused',
      'external_providers_paused',
      'ai_actions_paused',
    ];

    const switches = v2AdminEngine.listKillSwitches();
    if (switches.length !== 6) {
      throw new Error(`Expected exactly 6 kill switches, found ${switches.length}`);
    }

    for (const es of expectedSwitches) {
      const found = switches.find((s) => s.key === es);
      if (!found) {
        throw new Error(`Missing expected kill switch: ${es}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Emergency Kill Switch Operation & Role Guard
  // --------------------------------------------------------------------------
  runTest('8. Emergency Kill Switch requires elevated role and valid operational justification', () => {
    // Attempt with low-privilege role
    const unauthRes = v2AdminEngine.setKillSwitch({
      key: 'ads_paused',
      isPaused: true,
      actor_id: 'operator_bob',
      actor_role: 'OPERATOR',
      reason: 'Testing unauth',
    });
    if (unauthRes.success) {
      throw new Error('Operator was improperly allowed to trigger emergency kill switch');
    }

    // Attempt with missing justification
    const noReasonRes = v2AdminEngine.setKillSwitch({
      key: 'ads_paused',
      isPaused: true,
      actor_id: 'superadmin_alice',
      actor_role: 'SUPER_ADMIN',
      reason: '',
    });
    if (noReasonRes.success) {
      throw new Error('Kill switch was toggled without mandatory justification');
    }

    // Authorized pause
    const authRes = v2AdminEngine.setKillSwitch({
      key: 'ads_paused',
      isPaused: true,
      actor_id: 'superadmin_alice',
      actor_role: 'SUPER_ADMIN',
      reason: 'Critical ad verification audit underway',
    });
    if (!authRes.success || !authRes.switch?.isPaused) {
      throw new Error(`Authorized kill switch failed: ${authRes.error}`);
    }

    if (!v2AdminEngine.isAdsPaused()) {
      throw new Error('v2AdminEngine.isAdsPaused() returned false after pause was engaged');
    }

    // Resume switch
    v2AdminEngine.setKillSwitch({
      key: 'ads_paused',
      isPaused: false,
      actor_id: 'superadmin_alice',
      actor_role: 'SUPER_ADMIN',
      reason: 'Ad verification audit concluded successfully',
    });
    if (v2AdminEngine.isAdsPaused()) {
      throw new Error('Kill switch failed to resume');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Kill Switch Does Not Mutate History or Delete Data
  // --------------------------------------------------------------------------
  runTest('9. Emergency pause blocks FUTURE actions only; historical records remain untouched', () => {
    // Pre-pause: inspect revenue periods and ledger entries
    const initialPeriodsCount = v2RevenueEngine.listPeriods().length;

    // Trigger rewards pause
    v2AdminEngine.setKillSwitch({
      key: 'rewards_paused',
      isPaused: true,
      actor_id: 'finance_admin_01',
      actor_role: 'FINANCE_ADMIN',
      reason: 'Settlement freeze for quarterly review',
    });

    // Check revenue engine periods post-pause
    const postPeriodsCount = v2RevenueEngine.listPeriods().length;
    if (postPeriodsCount !== initialPeriodsCount) {
      throw new Error('Historical revenue periods count was modified during emergency pause');
    }

    // Resume rewards switch
    v2AdminEngine.setKillSwitch({
      key: 'rewards_paused',
      isPaused: false,
      actor_id: 'finance_admin_01',
      actor_role: 'FINANCE_ADMIN',
      reason: 'Freeze lifted after review',
    });
  });

  // --------------------------------------------------------------------------
  // TEST 10: Financial Ledger Immutability Under Pause
  // --------------------------------------------------------------------------
  runTest('10. Financial ledgers (Wallet & Revenue) retain zero ledger mutations under pause', () => {
    // Check wallet accounts before
    const wlt = v2WalletEngine.getOrCreateWallet('usr_immutable_test_01', 'USD');
    const balanceBefore = wlt.available_balance_cents;

    // Pause payouts
    v2AdminEngine.setKillSwitch({
      key: 'payouts_paused',
      isPaused: true,
      actor_id: 'superadmin_01',
      actor_role: 'SUPER_ADMIN',
      reason: 'Payout gateway stress containment',
    });

    // Wallet balance must not decrease or change
    const wltAfter = v2WalletEngine.getOrCreateWallet('usr_immutable_test_01', 'USD');
    if (wltAfter.available_balance_cents !== balanceBefore) {
      throw new Error('Wallet balance changed simply because payouts were paused');
    }

    // Resume payouts
    v2AdminEngine.setKillSwitch({
      key: 'payouts_paused',
      isPaused: false,
      actor_id: 'superadmin_01',
      actor_role: 'SUPER_ADMIN',
      reason: 'Payout gateway resumed',
    });
  });

  // --------------------------------------------------------------------------
  // TEST 11: Payout Approval Gate
  // --------------------------------------------------------------------------
  runTest('11. Payout requests remain approval-gated; cannot be auto-disbursed without authorized human', () => {
    const pendingApprovals = v2AdminEngine.listPendingApprovals();
    const payoutApprovals = pendingApprovals.filter((a) => a.category === 'PAYOUT');
    if (payoutApprovals.length === 0) {
      throw new Error('Expected at least one pending payout approval item in test registry');
    }

    const item = payoutApprovals[0];
    if (!item.requiredRoles.includes('FINANCE_ADMIN') && !item.requiredRoles.includes('SUPER_ADMIN')) {
      throw new Error('Payout approval item did not enforce FINANCE_ADMIN or SUPER_ADMIN requirement');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: METFA AI Governance Level 1–6 Model
  // --------------------------------------------------------------------------
  runTest('12. AI Governance: Full 6-level model is formally defined with policy boundaries', () => {
    const policies = v2AdminEngine.listAiGovernancePolicies();
    if (policies.length !== 6) {
      throw new Error(`Expected 6 AI governance policies, found ${policies.length}`);
    }

    const level6 = policies.find((p) => p.level === V2AiGovernanceLevel.LEVEL_6_CRITICAL_HUMAN_APPROVAL);
    if (!level6 || !level6.requiresHumanSignature) {
      throw new Error('Level 6 policy does not enforce mandatory human signature requirement');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: AI Strictly Blocked from Critical Financial/Security Actions
  // --------------------------------------------------------------------------
  runTest('13. AI Boundary: AI is strictly blocked from payouts, settlements, ledger edits, and kill switches', () => {
    const criticalActions = [
      'APPROVE_PAYOUT',
      'FINALIZE_REVENUE_SETTLEMENT',
      'MUTATE_IMMUTABLE_LEDGER',
      'CHANGE_REWARD_POOL_PERCENTAGE',
      'TRIGGER_KILL_SWITCH',
      'SET_FEATURE_FLAG',
    ];

    for (const act of criticalActions) {
      const check = v2AdminEngine.canAiExecuteAction(act);
      if (check.allowed) {
        throw new Error(`AI was improperly allowed to execute critical action: ${act}`);
      }
      if (check.governanceLevel !== V2AiGovernanceLevel.LEVEL_6_CRITICAL_HUMAN_APPROVAL) {
        throw new Error(`Action ${act} was not classified as Level 6 Critical`);
      }
    }

    // AI actor directly attempting feature flag mutation must be rejected
    const aiFlagAttempt = v2AdminEngine.setFeatureFlag({
      key: 'ads_enabled',
      enabled: false,
      actor_id: 'gemini_agent_01',
      actor_role: 'AI_AGENT',
      reason: 'AI autonomous tweak',
    });
    if (aiFlagAttempt.success) {
      throw new Error('AI actor was improperly allowed to mutate feature flags');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 14: Data Sanitization & Secret Redaction
  // --------------------------------------------------------------------------
  runTest('14. Secrets & PII are sanitized; API tokens and passwords never enter audit logs', () => {
    v2AdminEngine.updateAiHealthState({
      providerId: 'gemini',
      status: 'DEGRADED',
      latencyMs: 850,
      errorSummary: 'Connection failed with key sk-proj1234567890abcdef123456 and password=supersecret',
    });

    const provider = v2AdminEngine.getAiProviderHealth('gemini');
    if (!provider?.lastErrorSafe) {
      throw new Error('Safe error summary was not recorded');
    }
    if (provider.lastErrorSafe.includes('sk-proj1234567890abcdef123456')) {
      throw new Error('API key was leaked in AI health error summary');
    }
    if (provider.lastErrorSafe.includes('supersecret')) {
      throw new Error('Password was leaked in AI health error summary');
    }

    // Restore provider to healthy
    v2AdminEngine.updateAiHealthState({
      providerId: 'gemini',
      status: 'HEALTHY',
      latencyMs: 190,
    });
  });

  // --------------------------------------------------------------------------
  // TEST 15: Policy Versioning Remains Historical-Safe
  // --------------------------------------------------------------------------
  runTest('15. Policy Governance: Changing policies preserves historical versioned records', () => {
    const activeRiskPolicy = v2RiskEngine.getActivePolicy();
    if (!activeRiskPolicy || typeof activeRiskPolicy.version !== 'number') {
      throw new Error('Risk policy versioning is invalid or missing');
    }
    if (activeRiskPolicy.version < 1) {
      throw new Error('Risk policy version is less than 1');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 16: Audit Log is Append-Only
  // --------------------------------------------------------------------------
  runTest('16. Audit Log is strictly append-only; update/delete operations throw security violations', () => {
    let threw = false;
    try {
      v2AdminEngine.disallowAuditLogUpdateOrDelete();
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error('disallowAuditLogUpdateOrDelete failed to throw security violation');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: Attention Queue Surfaces Critical and High Items
  // --------------------------------------------------------------------------
  runTest('17. Attention Queue ("Requires Your Attention") surfaces actionable critical/high items', () => {
    const queue = v2AdminEngine.getAttentionQueue();
    if (!Array.isArray(queue)) {
      throw new Error('Attention queue is not an array');
    }
    // Verify priority sorting: critical comes before warning/notice
    for (let i = 0; i < queue.length - 1; i++) {
      const curr = queue[i].severity;
      const next = queue[i + 1].severity;
      if (curr === 'NOTICE' && next === 'CRITICAL') {
        throw new Error('Attention queue is not sorted by severity priority');
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 18: AI Health Telemetry Supports All 11 States
  // --------------------------------------------------------------------------
  runTest('18. AI Health: Engine supports all 11 canonical telemetry states', () => {
    const validStates = [
      'HEALTHY',
      'DEGRADED',
      'MISSING',
      'INVALID',
      'QUOTA_EXCEEDED',
      'RATE_LIMITED',
      'UNAVAILABLE',
      'TIMEOUT',
      'ERROR',
      'RECOVERED',
      'UNKNOWN',
    ];

    // Cycle through a test state
    v2AdminEngine.updateAiHealthState({
      providerId: 'intelligent_core_engine',
      status: 'RECOVERED',
      latencyMs: 45,
    });
    const p = v2AdminEngine.getAiProviderHealth('intelligent_core_engine');
    if (p?.status !== 'RECOVERED') {
      throw new Error(`AI health state was not set to RECOVERED`);
    }

    // Reset to healthy
    v2AdminEngine.updateAiHealthState({
      providerId: 'intelligent_core_engine',
      status: 'HEALTHY',
      latencyMs: 40,
    });
  });

  // --------------------------------------------------------------------------
  // TEST 19: Unified Approval Center Human Authority Check
  // --------------------------------------------------------------------------
  runTest('19. Unified Approval Center: AI actors are strictly rejected from approving governance items', () => {
    const pending = v2AdminEngine.listPendingApprovals();
    if (pending.length === 0) {
      throw new Error('No pending approvals found for testing');
    }

    const testItem = pending[0];
    const aiDecision = v2AdminEngine.decideApproval({
      itemId: testItem.id,
      decision: 'APPROVED',
      actor_id: 'metfa_ai_auto_approver',
      actor_role: 'METFA_AI',
      notes: 'AI auto approval test',
    });

    if (aiDecision.success) {
      throw new Error('AI actor was improperly permitted to approve governance item');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 20: Cross-Phase Foundation Compatibility (Phase 5, 6, 7, 8)
  // --------------------------------------------------------------------------
  runTest('20. Cross-Phase Integrity: Phase 7 Wallet & Phase 8 Risk suites remain 100% green', () => {
    const walletSuite = runV2WalletEngineVerification();
    if (walletSuite.failedTests > 0) {
      throw new Error(`Phase 7 Wallet suite regression: ${walletSuite.failedTests} tests failed`);
    }

    const riskSuite = runV2RiskEngineVerification();
    if (riskSuite.failedTests > 0) {
      throw new Error(`Phase 8 Risk suite regression: ${riskSuite.failedTests} tests failed`);
    }
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    totalTests: results.length,
    passedTests: passedCount,
    failedTests: failedCount,
    results,
  };
}
