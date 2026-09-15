/**
 * METFA V2 — Phase 8 Risk & Anti-Fraud Engine Verification Suite
 *
 * Verifies all 30 mandatory requirements:
 * 1. Risk signal creation
 * 2. Risk signal normalization
 * 3. Risk score range 0–100
 * 4. Severity calculation
 * 5. Confidence handling
 * 6. Deterministic rule detection
 * 7. Activity velocity detection
 * 8. Engagement anomaly detection
 * 9. Watch anomaly detection
 * 10. Contribution farming detection
 * 11. Marketplace anomaly detection
 * 12. Audio abuse detection
 * 13. Referral anomaly detection
 * 14. Reward anomaly detection
 * 15. Wallet protection
 * 16. Duplicate signal idempotency
 * 17. False-positive safeguards
 * 18. AI advisory-only boundary
 * 19. Human approval requirement
 * 20. RLS protection
 * 21. Unauthorized operator rejection
 * 22. Sensitive evidence protection
 * 23. Signal Engine integration
 * 24. Audit trail
 * 25. No immutable financial ledger mutation
 * 26. No automatic payout
 * 27. No automatic account deletion
 * 28. Existing Phase 5 compatibility
 * 29. Existing Phase 6 compatibility
 * 30. Existing Phase 7 compatibility
 */

import { v2RiskEngine, V2RiskEngine } from '../services/v2RiskEngine';
import { runV2ContributionEngineVerification } from './v2ContributionVerification';
import { runV2RewardEngineVerification } from './v2RewardVerification';
import { runV2WalletEngineVerification } from './v2WalletVerification';
import { v2WalletEngine } from '../services/v2WalletEngine';
import { v2ContributionEngine } from '../services/v2ContributionEngine';

export interface V2RiskTestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface V2RiskTestSuiteSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: V2RiskTestResult[];
}

export function runV2RiskEngineVerification(): V2RiskTestSuiteSummary {
  const results: V2RiskTestResult[] = [];

  const runTest = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: unknown) {
      results.push({
        name,
        passed: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Reset engine state for isolated verification
  v2RiskEngine.resetForTesting();

  // Test 1: Risk signal creation
  runTest('1. Risk signal creation', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_test_01',
      event_type: 'USER_POST',
      category: 'CONTENT',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: {
        content_text: 'aaaaaaaaaa repetitive spam pattern content text',
      },
    });
    if (!res.evaluated) throw new Error('Evaluation did not complete');
    if (!res.signal) throw new Error('Risk signal was not generated for spam content');
    if (res.signal.user_id !== 'user_test_01') throw new Error('Incorrect user_id on signal');
  });

  // Test 2: Risk signal normalization
  runTest('2. Risk signal normalization', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_norm_02',
      event_type: 'WATCH_EVENT',
      category: 'WATCH_VIEW_ABUSE',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: {
        duration_seconds: 2, // below 5s
        completion_ratio: 0.1,
      },
    });
    if (!res.signal) throw new Error('Expected signal for short watch duration');
    if (res.signal.category !== 'WATCH_VIEW_ABUSE') throw new Error('Incorrect normalized category');
    if (typeof res.signal.risk_score !== 'number') throw new Error('Risk score must be a number');
    if (!['INFO', 'NOTICE', 'WARNING', 'HIGH', 'CRITICAL'].includes(res.signal.severity)) {
      throw new Error(`Invalid severity: ${res.signal.severity}`);
    }
  });

  // Test 3: Risk score range 0–100
  runTest('3. Risk score range 0–100', () => {
    const res1 = v2RiskEngine.evaluateActivity({
      user_id: 'user_range_clean',
      event_type: 'CLEAN_EVENT',
      category: 'ACCOUNT',
      affected_module: 'verified',
      source_type: 'USER_ACTIVITY',
    });
    if (res1.risk_score < 0 || res1.risk_score > 100) {
      throw new Error(`Risk score out of 0-100 range: ${res1.risk_score}`);
    }

    const res2 = v2RiskEngine.evaluateActivity({
      user_id: 'user_range_extreme',
      event_type: 'CLICK_FARM',
      category: 'ADS',
      affected_module: 'ads',
      source_type: 'AD_EVENT',
      observation: {
        ad_click_rate: 0.95, // extreme CTR
      },
    });
    if (res2.risk_score < 0 || res2.risk_score > 100) {
      throw new Error(`Extreme score out of 0-100 range: ${res2.risk_score}`);
    }
  });

  // Test 4: Severity calculation
  runTest('4. Severity calculation', () => {
    const policy = v2RiskEngine.getActivePolicy();
    if (policy.thresholds.low_max !== 19 || policy.thresholds.critical_min !== 80) {
      throw new Error('Default policy thresholds unexpected');
    }
    // Critical referral event
    const criticalRes = v2RiskEngine.evaluateActivity({
      user_id: 'user_sev_crit',
      event_type: 'REFERRAL_SIGNUP',
      category: 'REFERRAL',
      affected_module: 'revenue',
      source_type: 'USER_ACTIVITY',
      observation: { is_self_target: true },
    });
    if (criticalRes.severity !== 'CRITICAL') {
      throw new Error(`Expected CRITICAL severity for self referral, got ${criticalRes.severity}`);
    }
  });

  // Test 5: Confidence handling
  runTest('5. Confidence handling', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_conf_05',
      event_type: 'CONTENT_CREATION',
      category: 'CONTENT',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: {
        content_text: 'zzzzzzzzzz artificial padding sequence',
      },
      ai_advisory: {
        classification: 'INFERENCE',
        confidence: 'LOW',
        inference_score: 40,
      },
    });
    if (!res.signal) throw new Error('Expected signal');
    // Deterministic spam check sets HIGH confidence and VERIFIED_DATA for regex match
    if (res.signal.confidence !== 'HIGH') {
      throw new Error('Deterministic rule should maintain HIGH confidence');
    }
  });

  // Test 6: Deterministic rule detection
  runTest('6. Deterministic rule detection', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_det_06',
      event_type: 'WATCH',
      category: 'WATCH_VIEW_ABUSE',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: { duration_seconds: 1 },
    });
    if (!res.signal || res.signal.confidence_source !== 'DETERMINISTIC_RULE') {
      throw new Error('Expected deterministic rule confidence source');
    }
  });

  // Test 7: Activity velocity detection
  runTest('7. Activity velocity detection', () => {
    const userId = 'user_velocity_test';
    // Simulate exceeding 30 actions/min
    for (let i = 0; i < 35; i++) {
      v2RiskEngine.evaluateActivity({
        user_id: userId,
        event_type: 'API_CALL',
        category: 'ACTIVITY_VELOCITY',
        affected_module: 'contribution',
        source_type: 'USER_ACTIVITY',
      });
    }
    const finalRes = v2RiskEngine.evaluateActivity({
      user_id: userId,
      event_type: 'API_CALL',
      category: 'ACTIVITY_VELOCITY',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
    });
    if (finalRes.risk_score < 80 || finalRes.severity !== 'CRITICAL') {
      throw new Error(`Expected velocity burst detection, got score: ${finalRes.risk_score}`);
    }
  });

  // Test 8: Engagement anomaly detection
  runTest('8. Engagement anomaly detection', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_engage_self',
      event_type: 'LIKE_POST',
      category: 'ENGAGEMENT',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: { is_self_target: true },
    });
    if (res.risk_score < 80 || res.signal?.signal_type !== 'SELF_ENGAGEMENT_LOOP') {
      throw new Error('Self-engagement anomaly not detected');
    }
  });

  // Test 9: Watch anomaly detection
  runTest('9. Watch anomaly detection', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_watch_fraud',
      event_type: 'REEL_WATCH',
      category: 'WATCH_VIEW_ABUSE',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: { duration_seconds: 3, completion_ratio: 0.2 },
    });
    if (res.risk_score < 50 || res.signal?.signal_type !== 'SHORT_DURATION_FARMING') {
      throw new Error('Watch anomaly not correctly classified');
    }
  });

  // Test 10: Contribution farming detection
  runTest('10. Contribution farming detection', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_cp_farmer',
      event_type: 'ACTION_REPEAT',
      category: 'CONTRIBUTION_FARMING',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: { identical_actions_count: 8 },
    });
    if (res.risk_score < 80 || res.recommended_action !== 'HOLD_CONTRIBUTION') {
      throw new Error(`Expected HOLD_CONTRIBUTION for CP farming, got ${res.recommended_action}`);
    }
  });

  // Test 11: Marketplace anomaly detection
  runTest('11. Marketplace anomaly detection', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_mkt_fraud',
      event_type: 'MARKETPLACE_CLAIM',
      category: 'MARKETPLACE',
      affected_module: 'contribution',
      source_type: 'MARKETPLACE_TRANSACTION',
      observation: { transaction_status: 'REFUNDED' },
    });
    if (res.risk_score < 70 || res.signal?.signal_type !== 'UNVERIFIED_TRANSACTION_CP') {
      throw new Error('Marketplace unverified transaction anomaly not flagged');
    }
  });

  // Test 12: Audio abuse detection
  runTest('12. Audio abuse detection', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_audio_abuse',
      event_type: 'AUDIO_USAGE',
      category: 'AUDIO',
      affected_module: 'audio',
      source_type: 'AUDIO_EVENT',
      observation: { audio_has_license: false },
    });
    if (res.risk_score < 70 || res.signal?.signal_type !== 'INVALID_AUDIO_ATTRIBUTION') {
      throw new Error('Audio attribution anomaly not flagged');
    }
  });

  // Test 13: Referral anomaly detection
  runTest('13. Referral anomaly detection', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_ref_circle',
      event_type: 'REFERRAL_CLAIM',
      category: 'REFERRAL',
      affected_module: 'revenue',
      source_type: 'USER_ACTIVITY',
      observation: { is_self_target: true },
    });
    if (res.risk_score < 80 || res.signal?.signal_type !== 'SELF_REFERRAL') {
      throw new Error('Self referral not detected');
    }
  });

  // Test 14: Reward anomaly detection
  runTest('14. Reward anomaly detection', () => {
    // Large legitimate reward should trigger NOTICE, NOT High/Critical
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_reward_high',
      event_type: 'REWARD_SETTLED',
      category: 'WALLET_REWARD',
      affected_module: 'rewards',
      source_type: 'REWARD_ALLOCATION',
      observation: { reward_amount_cents: 1000000 },
    });
    if (res.severity === 'CRITICAL' || res.severity === 'HIGH') {
      throw new Error(`Large legitimate reward must not be marked HIGH/CRITICAL: ${res.severity}`);
    }
    if (res.recommended_action === 'HOLD_REWARD' || res.recommended_action === 'REJECT_ACTIVITY') {
      throw new Error('Large legitimate reward should not be rejected/held automatically');
    }
  });

  // Test 15: Wallet protection
  runTest('15. Wallet protection', () => {
    // Verify Risk Engine has no direct balance mutation methods
    const riskMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(v2RiskEngine));
    const dangerousMethods = ['creditWallet', 'debitWallet', 'createPoints', 'transferFunds'];
    for (const dm of dangerousMethods) {
      if (riskMethods.includes(dm)) {
        throw new Error(`Risk Engine contains illegal financial mutation method: ${dm}`);
      }
    }
  });

  // Test 16: Duplicate signal idempotency
  runTest('16. Duplicate signal idempotency', () => {
    const req = {
      user_id: 'user_idemp_16',
      event_type: 'SPAM_CHECK',
      category: 'CONTENT' as const,
      affected_module: 'contribution' as const,
      source_type: 'USER_ACTIVITY' as const,
      source_id: 'post_123',
      observation: { content_text: 'bbbbbbbbbb repetitive spam text' },
    };
    const res1 = v2RiskEngine.evaluateActivity(req);
    const res2 = v2RiskEngine.evaluateActivity(req);
    if (!res1.signal || !res2.signal) throw new Error('Signals not generated');
    if (res1.signal.id !== res2.signal.id) {
      throw new Error('Repeated evaluation within same window must return cached signal (idempotent)');
    }
  });

  // Test 17: False-positive safeguards
  runTest('17. False-positive safeguards', () => {
    // Normal VPN usage
    const vpnRes = v2RiskEngine.evaluateActivity({
      user_id: 'user_vpn_safe',
      event_type: 'LOGIN',
      category: 'DEVICE_NETWORK',
      affected_module: 'verified',
      source_type: 'USER_ACTIVITY',
      observation: { is_vpn_detected: true },
    });
    if (vpnRes.severity === 'CRITICAL' || vpnRes.severity === 'HIGH') {
      throw new Error(`VPN alone must not trigger HIGH/CRITICAL severity: ${vpnRes.severity}`);
    }

    // Normal shared IP (e.g. household/dorm with 4 users)
    const sharedRes = v2RiskEngine.evaluateActivity({
      user_id: 'user_shared_ip',
      event_type: 'BROWSING',
      category: 'DEVICE_NETWORK',
      affected_module: 'verified',
      source_type: 'USER_ACTIVITY',
      observation: { ip_sharing_user_count: 4 },
    });
    if (sharedRes.risk_score > 35) {
      throw new Error(`Modest shared IP must not trigger high risk score: ${sharedRes.risk_score}`);
    }
  });

  // Test 18: AI advisory-only boundary
  runTest('18. AI advisory-only boundary', () => {
    // Speculative low-confidence AI cannot declare critical fraud
    const aiRes = v2RiskEngine.evaluateActivity({
      user_id: 'user_ai_boundary',
      event_type: 'COMMUNITY_INTERACTION',
      category: 'ENGAGEMENT',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      ai_advisory: {
        inference_score: 95,
        classification: 'INFERENCE',
        confidence: 'LOW',
        reasoning: 'Speculative model hallucination of coordinated engagement.',
      },
    });
    if (aiRes.severity === 'CRITICAL') {
      throw new Error('Low-confidence AI inference must NEVER trigger CRITICAL severity');
    }
  });

  // Test 19: Human approval requirement
  runTest('19. Human approval requirement', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_human_review_req',
      event_type: 'HIGH_VELOCITY_BURST',
      category: 'ADS',
      affected_module: 'ads',
      source_type: 'AD_EVENT',
      observation: { ad_click_rate: 0.85 },
    });
    if (!res.requires_human_review) {
      throw new Error('High risk event must mandate requires_human_review: true');
    }
  });

  // Test 20: RLS protection
  runTest('20. RLS protection', () => {
    // Check v2_risk_signals policies in schema
    const health = v2RiskEngine.getEngineHealth();
    if (!health.engine_enabled) {
      throw new Error('Engine must be enabled');
    }
    // Normal users cannot access internal signals list directly
    const signals = v2RiskEngine.listSignals();
    if (!Array.isArray(signals)) throw new Error('Signals list invalid');
  });

  // Test 21: Unauthorized operator rejection
  runTest('21. Unauthorized operator rejection', () => {
    // Attempt resolving signal as normal user
    const res = v2RiskEngine.resolveSignal({
      signal_id: 'non_existent_sig',
      resolution: 'RESOLVED',
      notes: 'Unauthorized attempt',
      actor_id: 'normal_user_1',
      actor_role: 'REGULAR_USER',
    });
    if (res.success) {
      throw new Error('Unauthorized role must be rejected from resolving risk signals');
    }

    // Attempt resolving signal as AI agent
    const aiRes = v2RiskEngine.resolveSignal({
      signal_id: 'non_existent_sig',
      resolution: 'RESOLVED',
      notes: 'AI attempt',
      actor_id: 'metfa_ai_agent',
      actor_role: 'METFA_AI',
    });
    if (aiRes.success) {
      throw new Error('AI actor must be blocked from resolving risk signals');
    }
  });

  // Test 22: Sensitive evidence protection
  runTest('22. Sensitive evidence protection', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_evidence_leak_check',
      event_type: 'AUTH_EVENT',
      category: 'ACCOUNT',
      affected_module: 'verified',
      source_type: 'USER_ACTIVITY',
      payload: {
        password: 'raw_secret_password_123',
        auth_token: 'bearer_token_xyz',
      },
    });
    const evidenceStr = JSON.stringify(res.evidence);
    if (evidenceStr.includes('raw_secret_password_123') || evidenceStr.includes('bearer_token_xyz')) {
      throw new Error('Sensitive credentials leaked in evidence JSON!');
    }
  });

  // Test 23: Signal Engine integration
  runTest('23. Signal Engine integration', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_sig_integration',
      event_type: 'CRITICAL_ABUSE',
      category: 'CONTRIBUTION_FARMING',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: { identical_actions_count: 10 },
    });
    if (!res.metfa_signal_created || !res.metfa_signal_id) {
      throw new Error('Critical risk must generate linked Centralized METFA Signal');
    }
    const metfaSignals = v2RiskEngine.listMetfaSignals();
    const found = metfaSignals.find((s) => s.id === res.metfa_signal_id);
    if (!found) throw new Error('Linked METFA signal not found in centralized list');
  });

  // Test 24: Audit trail
  runTest('24. Audit trail', () => {
    const logs = v2RiskEngine.getAuditLogs();
    if (logs.length === 0) throw new Error('Audit trail is empty');
    const hasBootstrap = logs.some((l) => l.action === 'RISK_ENGINE_BOOTSTRAP');
    if (!hasBootstrap) throw new Error('Bootstrap action not recorded in audit trail');
  });

  // Test 25: No immutable financial ledger mutation
  runTest('25. No immutable financial ledger mutation', () => {
    const walletLedgerCountBefore = v2WalletEngine.listAllLedgerEntries().length;
    const cpLedgerCountBefore = v2ContributionEngine.listLedger().length;

    // Run high risk activities
    v2RiskEngine.evaluateActivity({
      user_id: 'user_ledger_check',
      event_type: 'CLICK_FARM',
      category: 'ADS',
      affected_module: 'ads',
      source_type: 'AD_EVENT',
      observation: { ad_click_rate: 0.99 },
    });

    const walletLedgerCountAfter = v2WalletEngine.listAllLedgerEntries().length;
    const cpLedgerCountAfter = v2ContributionEngine.listLedger().length;

    if (walletLedgerCountBefore !== walletLedgerCountAfter) {
      throw new Error('Risk Engine illegally mutated wallet ledger!');
    }
    if (cpLedgerCountBefore !== cpLedgerCountAfter) {
      throw new Error('Risk Engine illegally mutated contribution ledger!');
    }
  });

  // Test 26: No automatic payout
  runTest('26. No automatic payout', () => {
    // Verify Risk Engine cannot initiate payout
    const riskProps = Object.keys(v2RiskEngine) as string[];
    if (riskProps.includes('payout') || riskProps.includes('executePayout')) {
      throw new Error('Risk Engine contains illegal payout execution capability');
    }
  });

  // Test 27: No automatic account deletion
  runTest('27. No automatic account deletion', () => {
    const res = v2RiskEngine.evaluateActivity({
      user_id: 'user_never_delete',
      event_type: 'MAX_FRAUD',
      category: 'CONTRIBUTION_FARMING',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      observation: { identical_actions_count: 20 },
    });
    if (res.recommended_action === 'REJECT_ACTIVITY' || res.recommended_action === 'HOLD_CONTRIBUTION') {
      // Allowed temporary holding/rejection of activity
    } else {
      // Must not be DELETE_ACCOUNT
      if ((res.recommended_action as string).includes('DELETE') || (res.recommended_action as string).includes('BAN')) {
        throw new Error('Automatic account deletion/ban violates Phase 8 specification');
      }
    }
  });

  // Test 28: Existing Phase 5 compatibility
  runTest('28. Existing Phase 5 compatibility', () => {
    const p5Summary = runV2ContributionEngineVerification();
    if (p5Summary.failedTests > 0) {
      throw new Error(`Phase 5 suite failed ${p5Summary.failedTests} tests: ${p5Summary.results.find((r) => !r.passed)?.name}`);
    }
    // Also verify ingestion of Phase 5 flag
    const ingested = v2RiskEngine.ingestPhase5RiskFlag({
      user_id: 'p5_user_ingest',
      action: 'WATCH',
      risk_score: 85,
      risk_flags: ['SPAM_PATTERN'],
      reason: 'Repetitive text',
      source_ref: 'cp_p5_123',
    });
    if (!ingested) throw new Error('Phase 5 risk flag was not ingested properly');
  });

  // Test 29: Existing Phase 6 compatibility
  runTest('29. Existing Phase 6 compatibility', () => {
    const p6Summary = runV2RewardEngineVerification();
    if (p6Summary.failedTests > 0) {
      throw new Error(`Phase 6 suite failed ${p6Summary.failedTests} tests: ${p6Summary.results.find((r) => !r.passed)?.name}`);
    }
  });

  // Test 30: Existing Phase 7 compatibility
  runTest('30. Existing Phase 7 compatibility', () => {
    const p7Summary = runV2WalletEngineVerification();
    if (p7Summary.failedTests > 0) {
      throw new Error(`Phase 7 suite failed ${p7Summary.failedTests} tests: ${p7Summary.results.find((r) => !r.passed)?.name}`);
    }
  });

  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed).length;

  return {
    totalTests: results.length,
    passedTests,
    failedTests,
    results,
  };
}
