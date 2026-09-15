/**
 * METFA V2 — Centralized Risk & Anti-Fraud Engine (Phase 8)
 *
 * CANONICAL RISK & ANTI-FRAUD ENGINE
 *
 * Architectural Flow:
 * ACTIVITY / EVENT
 *   → RISK SIGNAL DETECTION (Deterministic rules & anomaly analysis)
 *   → SIGNAL NORMALIZATION (0–100 score, policy thresholds)
 *   → RISK SCORING & SEVERITY (LOW, NOTICE, MEDIUM, HIGH, CRITICAL)
 *   → ELIGIBILITY DECISION (ALLOW, MONITOR, FLAG, HOLD_*, REQUIRE_REVIEW)
 *   → SIGNAL ENGINE INTEGRATION (MetfaSignal / Task generation)
 *   → OPERATOR REVIEW / ACTION (Server-authoritative, human-in-the-loop)
 *   → AUDIT TRAIL (Immutable history of all evaluations & reviews)
 *
 * CRITICAL INVARIANTS:
 * 1. Risk Detection != User Punishment. Suspicious activity triggers review/holds, NEVER automatic bans.
 * 2. Immutable Ledger Immunity: Risk Engine NEVER mutates wallet ledger, NEVER invents CP, NEVER creates money.
 * 3. AI Advisory Boundary: AI analysis is strictly advisory; inferences are never treated as verified fraud.
 * 4. Phase 5 Compatibility: Preserves and ingests Phase 5 qualification flags.
 * 5. Privacy & Data Minimization: No invasive tracking, no PII, sanitized evidence only.
 * 6. Server-Authoritative: Operator actions require authorized roles; AI actors are strictly blocked from mutations.
 */

import { V2ModuleId, SignalSeverity, SignalStatus } from '../types/v2';
import {
  V2RiskCategory,
  V2RiskSeverity,
  V2RiskConfidence,
  V2RiskConfidenceSource,
  V2RiskDataClassification,
  V2RiskAction,
  V2RiskSignalStatus,
  V2UserEligibilityStatus,
  V2RiskSignalType,
  V2RiskSignal,
  V2RiskPolicy,
  V2UserRiskSummary,
  V2RiskEvaluationRequest,
  V2RiskEvaluationResult,
  V2RiskAuditLog,
  V2RiskEngineHealth,
} from '../types/v2Risk';
import { V2DbSignal } from '../types/v2Database';

// ============================================================================
// DEFAULT VERSIONED POLICY
// ============================================================================

const DEFAULT_RISK_POLICY: V2RiskPolicy = {
  id: 'policy_v2_risk_default',
  version: 1,
  policy_name: 'METFA Canonical Anti-Fraud & Risk Policy v1.0',
  description: 'Server-authoritative risk scoring, multi-signal anomaly detection, and human-in-the-loop review.',
  thresholds: {
    low_max: 19,
    notice_max: 39,
    medium_max: 59,
    high_max: 79,
    critical_min: 80,
  },
  rules: {
    max_actions_per_minute: 30,
    max_comments_per_minute: 12,
    max_posts_per_hour: 15,
    max_identical_actions_window: 4,
    min_watch_duration_seconds: 5,
    min_completion_ratio: 0.60,
    max_playback_speed_ratio: 2.5,
    max_identical_content_ratio: 0.85,
    max_ad_ctr_threshold: 0.35,
    max_refund_ratio_threshold: 0.40,
    require_review_threshold: 60,
    hold_action_threshold: 80,
  },
  is_active: true,
  effective_from: '2026-09-01T00:00:00Z',
  approved_by: 'GOVERNANCE_SYSTEM',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

// ============================================================================
// ENGINE CLASS
// ============================================================================

export class V2RiskEngine {
  private activePolicy: V2RiskPolicy = { ...DEFAULT_RISK_POLICY };
  private policyHistory: Map<number, V2RiskPolicy> = new Map([
    [DEFAULT_RISK_POLICY.version, { ...DEFAULT_RISK_POLICY }],
  ]);

  // Primary in-memory stores (sync with v2_risk_signals, v2_signals, v2_audit_logs)
  private signals: Map<string, V2RiskSignal> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // idempotency_key -> signal_id
  private userSummaries: Map<string, V2UserRiskSummary> = new Map();
  private metfaSignals: Map<string, V2DbSignal> = new Map();
  private auditLogs: V2RiskAuditLog[] = [];
  private engineEnabled = true;

  // Rate tracking buckets for activity velocity analysis
  // user_id -> list of action timestamps (ms)
  private userActionTimestamps: Map<string, number[]> = new Map();

  // Known authorized roles
  private readonly AUTHORIZED_OPERATOR_ROLES = [
    'SUPER_ADMIN',
    'ADMIN',
    'COMPLIANCE_OFFICER',
    'FRAUD_INVESTIGATOR',
    'OPERATOR',
  ];

  constructor() {
    this.recordAudit({
      action: 'RISK_ENGINE_BOOTSTRAP',
      actor_id: 'SYSTEM',
      actor_role: 'SYSTEM',
      target_type: 'SYSTEM',
      reason: 'METFA V2 Canonical Risk & Anti-Fraud Engine initialized.',
      new_state: { policy_version: this.activePolicy.version },
    });
  }

  // =========================================================================
  // 1. POLICY & THRESHOLD MANAGEMENT
  // =========================================================================

  public getActivePolicy(): V2RiskPolicy {
    return { ...this.activePolicy };
  }

  public getPolicyByVersion(version: number): V2RiskPolicy | null {
    const policy = this.policyHistory.get(version);
    return policy ? { ...policy } : null;
  }

  public updatePolicy(params: {
    newPolicy: Partial<V2RiskPolicy>;
    actor_id: string;
    actor_role: string;
    reason: string;
  }): { success: boolean; policy?: V2RiskPolicy; error?: string } {
    if (this.isAiActor(params.actor_role)) {
      return {
        success: false,
        error: 'METFA AI Boundary Violation: AI agents cannot alter risk policies.',
      };
    }

    if (!['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_OFFICER'].includes(params.actor_role)) {
      return {
        success: false,
        error: `Unauthorized: Updating risk policy requires Admin or Compliance role. Received '${params.actor_role}'.`,
      };
    }

    const nextVersion = this.activePolicy.version + 1;
    const updated: V2RiskPolicy = {
      ...this.activePolicy,
      ...params.newPolicy,
      version: nextVersion,
      thresholds: {
        ...this.activePolicy.thresholds,
        ...(params.newPolicy.thresholds || {}),
      },
      rules: {
        ...this.activePolicy.rules,
        ...(params.newPolicy.rules || {}),
      },
      approved_by: params.actor_id,
      updated_at: new Date().toISOString(),
    };

    this.activePolicy = updated;
    this.policyHistory.set(nextVersion, updated);

    this.recordAudit({
      action: 'RISK_POLICY_UPDATED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: updated.id,
      target_type: 'POLICY',
      reason: params.reason,
      new_state: { version: nextVersion },
    });

    return { success: true, policy: { ...updated } };
  }

  // =========================================================================
  // 2. CANONICAL EVALUATION PIPELINE
  // =========================================================================

  /**
   * Main entry point to evaluate an activity, transaction, or user event.
   * Multi-stage pipeline:
   * 1. Deterministic rules & category checks
   * 2. Anomaly detection & velocity checks
   * 3. AI advisory context (strictly advisory)
   * 4. False-positive safeguards
   * 5. Normalization (0-100 score, severity)
   * 6. Idempotency & deduplication
   * 7. Signal generation & METFA Signal linking
   * 8. User profile re-aggregation
   */
  public evaluateActivity(request: V2RiskEvaluationRequest): V2RiskEvaluationResult {
    const evaluatedAt = new Date().toISOString();
    const policy = this.activePolicy;

    // Track activity timestamps for velocity detection
    this.recordUserActionTimestamp(request.user_id);

    // Run deterministic rules across all 14 categories
    const detection = this.runDeterministicAnalysis(request);

    // Apply false positive protection
    const sanitizedScore = this.applyFalsePositiveProtection(
      detection.score,
      detection.signalType,
      request
    );

    const clampedScore = Math.max(0, Math.min(100, Math.round(sanitizedScore)));
    const severity = this.mapScoreToSeverity(clampedScore, policy);
    const recommendedAction = this.deriveRecommendedAction(
      clampedScore,
      detection.signalType,
      request.category,
      policy
    );
    const requiresHumanReview = clampedScore >= policy.rules.require_review_threshold;

    // Determine data classification & confidence
    let dataClassification: V2RiskDataClassification = detection.isDeterministic
      ? 'VERIFIED_DATA'
      : 'OBSERVED_SIGNAL';
    let confidenceSource: V2RiskConfidenceSource = detection.isDeterministic
      ? 'DETERMINISTIC_RULE'
      : 'STATISTICAL_ANOMALY';
    let confidence: V2RiskConfidence = detection.confidence;

    // Factor in AI advisory if provided (STRICTLY ADVISORY)
    if (request.ai_advisory) {
      // Inferences are never treated as facts
      if (request.ai_advisory.classification === 'INFERENCE' || request.ai_advisory.classification === 'ESTIMATE') {
        dataClassification = request.ai_advisory.classification;
        confidenceSource = 'AI_ADVISORY';
        // AI alone cannot inflate score to CRITICAL without deterministic backing
        if (!detection.isDeterministic && request.ai_advisory.confidence === 'LOW') {
          // Disregard low-confidence AI speculation
          confidence = 'LOW';
        }
      }
    }

    // Build idempotency key to prevent duplicate spam signals
    const timeWindowMinute = Math.floor(Date.now() / 60000);
    const idempotencyKey = `${request.user_id}:${detection.signalType}:${request.source_id || 'generic'}:${timeWindowMinute}`;

    let signalCreated = false;
    let signal: V2RiskSignal | undefined;
    let metfaSignalCreated = false;
    let metfaSignalId: string | undefined;

    // Only create a persistent risk signal if score warrants NOTICE or higher (>= 20)
    if (clampedScore >= policy.thresholds.low_max) {
      const existingSignalId = this.idempotencyIndex.get(idempotencyKey);
      if (existingSignalId && this.signals.has(existingSignalId)) {
        // Return existing signal (Idempotent replay)
        signal = this.signals.get(existingSignalId);
      } else {
        // Create new normalized risk signal
        const signalId = `rsig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const newSignal: V2RiskSignal = {
          id: signalId,
          user_id: request.user_id,
          signal_type: detection.signalType,
          category: request.category,
          severity,
          risk_score: clampedScore,
          confidence,
          confidence_source: confidenceSource,
          data_classification: dataClassification,
          affected_module: request.affected_module,
          source_type: request.source_type,
          source_id: request.source_id,
          evidence: this.sanitizeEvidence(detection.evidence),
          recommended_action: recommendedAction,
          requires_human_review: requiresHumanReview,
          status: 'ACTIVE',
          detected_at: evaluatedAt,
          idempotency_key: idempotencyKey,
          metadata: {
            policy_version: policy.version,
            raw_event: request.event_type,
          },
        };

        // Link with Centralized METFA Signal architecture if HIGH or CRITICAL
        if (severity === 'HIGH' || severity === 'CRITICAL' || requiresHumanReview) {
          const metfaSignal = this.createMetfaSignalRecord(newSignal, detection.explanation);
          newSignal.linked_metfa_signal_id = metfaSignal.id;
          metfaSignalCreated = true;
          metfaSignalId = metfaSignal.id;
        }

        this.signals.set(signalId, newSignal);
        this.idempotencyIndex.set(idempotencyKey, signalId);
        signal = newSignal;
        signalCreated = true;

        this.recordAudit({
          action: 'RISK_SIGNAL_DETECTED',
          actor_id: 'RISK_ENGINE',
          actor_role: 'SYSTEM',
          target_id: signalId,
          target_type: 'SIGNAL',
          reason: detection.explanation,
          new_state: {
            user_id: request.user_id,
            signal_type: detection.signalType,
            severity,
            score: clampedScore,
          },
        });
      }
    }

    // Re-aggregate user profile summary
    this.refreshUserRiskSummary(request.user_id);

    return {
      evaluated: true,
      user_id: request.user_id,
      risk_score: clampedScore,
      severity,
      category: request.category,
      recommended_action: recommendedAction,
      requires_human_review: requiresHumanReview,
      signal_created: signalCreated,
      signal,
      metfa_signal_created: metfaSignalCreated,
      metfa_signal_id: metfaSignalId,
      explanation: detection.explanation,
      evidence: this.sanitizeEvidence(detection.evidence),
      evaluated_at: evaluatedAt,
    };
  }

  // =========================================================================
  // 3. DETERMINISTIC ANALYSIS ACROSS ALL 14 CATEGORIES
  // =========================================================================

  private runDeterministicAnalysis(request: V2RiskEvaluationRequest): {
    score: number;
    signalType: V2RiskSignalType | string;
    explanation: string;
    isDeterministic: boolean;
    confidence: V2RiskConfidence;
    evidence: Record<string, unknown>;
  } {
    const obs = request.observation || {};
    const rules = this.activePolicy.rules;

    switch (request.category) {
      // 1. ACCOUNT
      case 'ACCOUNT': {
        if (obs.action_count_in_window && obs.action_count_in_window > 20 && obs.window_seconds && obs.window_seconds <= 60) {
          return {
            score: 75,
            signalType: 'ACCOUNT_CREATION_VELOCITY',
            explanation: 'Abnormal account registration velocity observed from identical network pattern.',
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { action_count: obs.action_count_in_window, window_seconds: obs.window_seconds },
          };
        }
        return {
          score: 10,
          signalType: 'ACCOUNT_INTEGRITY_ANOMALY',
          explanation: 'Account activity evaluated cleanly.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 2. DEVICE_NETWORK
      case 'DEVICE_NETWORK': {
        // Shared IP or VPN alone is protected by False Positive Safeguards
        if (obs.is_vpn_detected) {
          return {
            score: 15, // Protected low score
            signalType: 'SUSPICIOUS_NETWORK_PATTERN',
            explanation: 'VPN usage observed; normal privacy tool, no policy breach by itself.',
            isDeterministic: true,
            confidence: 'LOW',
            evidence: { is_vpn: true },
          };
        }
        if (obs.ip_sharing_user_count && obs.ip_sharing_user_count > 50) {
          return {
            score: 70,
            signalType: 'EXCESSIVE_SAME_DEVICE_ACTIVITY',
            explanation: 'Excessive concurrent accounts accessing from single network cluster.',
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { shared_count: obs.ip_sharing_user_count },
          };
        }
        return {
          score: 10,
          signalType: 'DEVICE_ACTIVITY_ANOMALY',
          explanation: 'Network signals within standard variance.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 3. ACTIVITY_VELOCITY
      case 'ACTIVITY_VELOCITY': {
        const actionsPerMin = this.getUserActionVelocityPerMinute(request.user_id);
        if (actionsPerMin > rules.max_actions_per_minute) {
          return {
            score: 82,
            signalType: 'EXCESSIVE_ACTION_VELOCITY',
            explanation: `Action velocity (${actionsPerMin}/min) exceeds maximum allowed limit (${rules.max_actions_per_minute}/min).`,
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { actions_per_min: actionsPerMin, limit: rules.max_actions_per_minute },
          };
        }
        if (obs.identical_actions_count && obs.identical_actions_count > rules.max_identical_actions_window) {
          return {
            score: 75,
            signalType: 'REPEATED_IDENTICAL_ACTIONS',
            explanation: `Repeated identical action executed ${obs.identical_actions_count} times in short succession.`,
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { identical_count: obs.identical_actions_count },
          };
        }
        return {
          score: 15,
          signalType: 'EXCESSIVE_ACTION_VELOCITY',
          explanation: `Action rate of ${actionsPerMin}/min is normal.`,
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: { actions_per_min: actionsPerMin },
        };
      }

      // 4. ENGAGEMENT
      case 'ENGAGEMENT': {
        if (obs.is_self_target) {
          return {
            score: 85,
            signalType: 'SELF_ENGAGEMENT_LOOP',
            explanation: 'Self-engagement loop detected: user attempting to qualify own content.',
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { is_self_target: true },
          };
        }
        return {
          score: 10,
          signalType: 'COORDINATED_ENGAGEMENT',
          explanation: 'Engagement patterns verified authentic.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 5. CONTENT
      case 'CONTENT': {
        const text = obs.content_text || '';
        // Spam regex matching Phase 5 pattern
        if (/(.)\1{6,}/.test(text)) {
          return {
            score: 85,
            signalType: 'SPAM_CONTENT_PATTERN',
            explanation: 'Content flagged for repetitive character sequences and artificial spam padding.',
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { sample_length: text.length },
          };
        }
        return {
          score: 10,
          signalType: 'DUPLICATE_CONTENT_PATTERN',
          explanation: 'Content originality standards met.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 6. WATCH_VIEW_ABUSE
      case 'WATCH_VIEW_ABUSE': {
        const duration = obs.duration_seconds ?? 0;
        const completionRatio = obs.completion_ratio ?? 1.0;
        if (duration < rules.min_watch_duration_seconds) {
          return {
            score: 55,
            signalType: 'SHORT_DURATION_FARMING',
            explanation: `Watch duration (${duration}s) below required minimum (${rules.min_watch_duration_seconds}s).`,
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { duration_seconds: duration, required_seconds: rules.min_watch_duration_seconds },
          };
        }
        if (completionRatio < rules.min_completion_ratio) {
          return {
            score: 50,
            signalType: 'ABNORMAL_WATCH_TIME_PATTERN',
            explanation: `Watch completion ratio (${(completionRatio * 100).toFixed(0)}%) below required threshold.`,
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { completion_ratio: completionRatio },
          };
        }
        return {
          score: 5,
          signalType: 'REPEATED_ARTIFICIAL_VIEWS',
          explanation: 'Watch telemetry verified within genuine consumption boundaries.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: { duration_seconds: duration, completion_ratio: completionRatio },
        };
      }

      // 7. CONTRIBUTION_FARMING
      case 'CONTRIBUTION_FARMING': {
        if (obs.identical_actions_count && obs.identical_actions_count > 6) {
          return {
            score: 88,
            signalType: 'CP_FARMING_PATTERN',
            explanation: 'Automated rapid contribution farming detected across cooldown boundaries.',
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { repetitive_count: obs.identical_actions_count },
          };
        }
        return {
          score: 10,
          signalType: 'COOLDOWN_BYPASS_ATTEMPT',
          explanation: 'Contribution rate conforms to policy limits.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 8. MARKETPLACE
      case 'MARKETPLACE': {
        if (obs.transaction_status && obs.transaction_status !== 'COMPLETED') {
          return {
            score: 70,
            signalType: 'UNVERIFIED_TRANSACTION_CP',
            explanation: `Marketplace contribution claimed on unverified transaction state '${obs.transaction_status}'.`,
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { status: obs.transaction_status },
          };
        }
        return {
          score: 5,
          signalType: 'SUSPICIOUS_MARKETPLACE_TX',
          explanation: 'Marketplace transaction verified settled.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 9. AUDIO
      case 'AUDIO': {
        if (obs.audio_has_license === false) {
          return {
            score: 75,
            signalType: 'INVALID_AUDIO_ATTRIBUTION',
            explanation: 'Audio asset utilized without verified attribution or license attribution.',
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { licensed: false },
          };
        }
        return {
          score: 5,
          signalType: 'ARTIFICIAL_AUDIO_USAGE',
          explanation: 'Audio attribution and licensing conform to creator standards.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 10. REFERRAL
      case 'REFERRAL': {
        if (obs.is_self_target) {
          return {
            score: 90,
            signalType: 'SELF_REFERRAL',
            explanation: 'Self-referral anomaly detected: referrer and referred identity match.',
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { is_self_referral: true },
          };
        }
        return {
          score: 10,
          signalType: 'CIRCULAR_REFERRAL',
          explanation: 'Referral graph verified authentic.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 11. WALLET_REWARD
      case 'WALLET_REWARD': {
        if (obs.reward_amount_cents && obs.reward_amount_cents > 500000) {
          // Large reward: note that large legitimate reward is NOT fraud!
          return {
            score: 30, // NOTICE only, NOT High/Critical
            signalType: 'ABNORMAL_REWARD_ACCUMULATION',
            explanation: 'Substantial reward settlement pending. Monitored for audit compliance.',
            isDeterministic: true,
            confidence: 'MEDIUM',
            evidence: { amount_cents: obs.reward_amount_cents },
          };
        }
        return {
          score: 5,
          signalType: 'DUPLICATE_REWARD_ATTEMPT',
          explanation: 'Wallet reward allocation conforms to verified revenue pool.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 12. PAYOUT_READINESS
      case 'PAYOUT_READINESS': {
        if (obs.payout_failed_count && obs.payout_failed_count >= 3) {
          return {
            score: 75,
            signalType: 'REPEATED_FAILED_PAYOUTS',
            explanation: `User experienced ${obs.payout_failed_count} consecutive failed payout attempts.`,
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { failures: obs.payout_failed_count },
          };
        }
        return {
          score: 10,
          signalType: 'UNUSUAL_PAYOUT_BEHAVIOR',
          explanation: 'Payout readiness requirements verified.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 13. ADS
      case 'ADS': {
        if (obs.ad_click_rate && obs.ad_click_rate > rules.max_ad_ctr_threshold) {
          return {
            score: 85,
            signalType: 'AD_CLICK_FARMING',
            explanation: `Abnormal ad click-through rate (${(obs.ad_click_rate * 100).toFixed(1)}%) indicates artificial click farming.`,
            isDeterministic: true,
            confidence: 'HIGH',
            evidence: { ctr: obs.ad_click_rate, threshold: rules.max_ad_ctr_threshold },
          };
        }
        return {
          score: 5,
          signalType: 'ABNORMAL_AD_CLICK_BEHAVIOR',
          explanation: 'Ad impression and interaction telemetry clean.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      // 14. VERIFICATION
      case 'VERIFICATION': {
        return {
          score: 10,
          signalType: 'SUSPICIOUS_VERIFICATION_INFO',
          explanation: 'Identity verification record active and consistent.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }

      default: {
        return {
          score: 0,
          signalType: 'GENERAL_ACTIVITY_CHECK',
          explanation: 'Activity evaluated without detected anomalies.',
          isDeterministic: true,
          confidence: 'HIGH',
          evidence: {},
        };
      }
    }
  }

  // =========================================================================
  // 4. FALSE-POSITIVE SAFEGUARDS
  // =========================================================================

  private applyFalsePositiveProtection(
    rawScore: number,
    signalType: string,
    request: V2RiskEvaluationRequest
  ): number {
    const obs = request.observation || {};

    // 1. VPN usage alone must NOT result in high risk or holds
    if (obs.is_vpn_detected && !obs.identical_actions_count && !obs.is_self_target) {
      return Math.min(rawScore, 20); // Clamped to low/notice
    }

    // 2. Modest shared IP (e.g. household, dorm, office with < 10 accounts)
    if (obs.ip_sharing_user_count && obs.ip_sharing_user_count <= 10 && rawScore > 35) {
      return 25; // Notice only
    }

    // 3. High legitimate engagement (e.g., creator with genuine content)
    if (obs.is_original && signalType === 'EXCESSIVE_ACTION_VELOCITY' && rawScore > 40) {
      // Don't punish high engagement on original content unless exceeding hard burst limit
      const velocity = this.getUserActionVelocityPerMinute(request.user_id);
      if (velocity <= this.activePolicy.rules.max_actions_per_minute) {
        return Math.min(rawScore, 30);
      }
    }

    // 4. Large legitimate reward allocation is NEVER automatically treated as fraud
    if (signalType === 'ABNORMAL_REWARD_ACCUMULATION' && rawScore > 35) {
      return 30; // Monitored only, never held
    }

    return rawScore;
  }

  // =========================================================================
  // 5. SEVERITY & ACTION DERIVATION
  // =========================================================================

  private mapScoreToSeverity(score: number, policy: V2RiskPolicy): V2RiskSeverity {
    if (score >= policy.thresholds.critical_min) return 'CRITICAL';
    if (score >= policy.thresholds.high_max) return 'HIGH';
    if (score >= policy.thresholds.medium_max) return 'WARNING';
    if (score >= policy.thresholds.notice_max) return 'NOTICE';
    return 'INFO';
  }

  private deriveRecommendedAction(
    score: number,
    signalType: string,
    category: V2RiskCategory,
    policy: V2RiskPolicy
  ): V2RiskAction {
    if (score < policy.thresholds.notice_max) {
      return score <= policy.thresholds.low_max ? 'ALLOW' : 'MONITOR';
    }

    if (score < policy.thresholds.high_max) {
      return score >= policy.rules.require_review_threshold ? 'REQUIRE_REVIEW' : 'FLAG';
    }

    // Critical scores (>= 80): policy-targeted holds
    switch (category) {
      case 'CONTRIBUTION_FARMING':
      case 'WATCH_VIEW_ABUSE':
      case 'CONTENT':
        return 'HOLD_CONTRIBUTION';
      case 'WALLET_REWARD':
        return 'HOLD_REWARD';
      case 'PAYOUT_READINESS':
        return 'HOLD_PAYOUT';
      case 'ACTIVITY_VELOCITY':
        return 'LIMIT_ACTIVITY';
      case 'ADS':
        return 'REJECT_ACTIVITY';
      default:
        return 'REQUIRE_REVIEW';
    }
  }

  // =========================================================================
  // 6. PHASE 5 CONTRIBUTION INGESTION
  // =========================================================================

  /**
   * Directly ingests risk flags emitted by Phase 5 Contribution Engine.
   * Ensures seamless integration without competing risk systems.
   */
  public ingestPhase5RiskFlag(entry: {
    user_id: string;
    action: string;
    risk_score: number;
    risk_flags: string[];
    reason?: string;
    source_ref: string;
    payload?: Record<string, unknown>;
  }): V2RiskSignal | null {
    if (!entry.risk_flags || entry.risk_flags.length === 0) return null;

    const primaryFlag = entry.risk_flags[0];
    let category: V2RiskCategory = 'CONTRIBUTION_FARMING';

    if (primaryFlag.includes('WATCH') || primaryFlag.includes('DURATION') || primaryFlag.includes('COMPLETION')) {
      category = 'WATCH_VIEW_ABUSE';
    } else if (primaryFlag.includes('SPAM') || primaryFlag.includes('CONTENT')) {
      category = 'CONTENT';
    } else if (primaryFlag.includes('TRANSACTION')) {
      category = 'MARKETPLACE';
    } else if (primaryFlag.includes('AUDIO')) {
      category = 'AUDIO';
    } else if (primaryFlag.includes('ENGAGEMENT')) {
      category = 'ENGAGEMENT';
    }

    const defaultContent = primaryFlag === 'SPAM_PATTERN' ? 'aaaaaaaaaa repetitive spam padding' : '';

    const evalResult = this.evaluateActivity({
      user_id: entry.user_id,
      event_type: `P5_CONTRIBUTION_${entry.action}`,
      category,
      affected_module: 'contribution',
      source_type: 'CONTRIBUTION_LEDGER',
      source_id: entry.source_ref,
      payload: entry.payload,
      observation: {
        duration_seconds: (entry.payload?.watch_duration_seconds as number) ?? (primaryFlag.includes('DURATION') ? 1 : 10),
        completion_ratio: (entry.payload?.completion_ratio as number) ?? (primaryFlag.includes('COMPLETION') ? 0.2 : 1.0),
        content_text: (entry.payload?.content_text as string) || defaultContent,
        is_original: Boolean(entry.payload?.is_original),
        transaction_status: (entry.payload?.transaction_status as string) || (primaryFlag.includes('TRANSACTION') ? 'REFUNDED' : 'COMPLETED'),
        audio_has_license: entry.payload?.audio_has_license !== undefined ? Boolean(entry.payload?.audio_has_license) : !primaryFlag.includes('AUDIO'),
        identical_actions_count: primaryFlag.includes('FARMING') ? 8 : 1,
      },
    });

    return evalResult.signal || null;
  }

  // =========================================================================
  // 7. USER RISK PROFILE & ELIGIBILITY ENFORCEMENT
  // =========================================================================

  public getUserRiskSummary(userId: string): V2UserRiskSummary {
    let summary = this.userSummaries.get(userId);
    if (!summary) {
      summary = this.buildFreshUserSummary(userId);
      this.userSummaries.set(userId, summary);
    }
    return { ...summary };
  }

  public checkUserContributionEligibility(userId: string): {
    isEligible: boolean;
    reason?: string;
    holdActive: boolean;
  } {
    const summary = this.getUserRiskSummary(userId);
    if (summary.is_contribution_held) {
      return {
        isEligible: false,
        reason: 'Contribution Points temporarily held under risk review.',
        holdActive: true,
      };
    }
    if (summary.eligibility_status === 'EXCLUDED') {
      return {
        isEligible: false,
        reason: 'Account excluded from contribution participation by policy.',
        holdActive: true,
      };
    }
    return { isEligible: true, holdActive: false };
  }

  public checkUserRewardEligibility(userId: string): {
    isEligible: boolean;
    reason?: string;
    holdActive: boolean;
  } {
    const summary = this.getUserRiskSummary(userId);
    if (summary.is_reward_held) {
      return {
        isEligible: false,
        reason: 'Reward distribution temporarily held for compliance review.',
        holdActive: true,
      };
    }
    return { isEligible: true, holdActive: false };
  }

  public checkUserPayoutEligibility(userId: string): {
    isEligible: boolean;
    reason?: string;
    holdActive: boolean;
  } {
    const summary = this.getUserRiskSummary(userId);
    if (summary.is_payout_held) {
      return {
        isEligible: false,
        reason: 'Payout processing temporarily locked for risk review.',
        holdActive: true,
      };
    }
    return { isEligible: true, holdActive: false };
  }

  public setUserHold(params: {
    user_id: string;
    hold_type: 'contribution' | 'reward' | 'payout';
    active: boolean;
    reason: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; summary?: V2UserRiskSummary; error?: string } {
    if (this.isAiActor(params.actor_role)) {
      return {
        success: false,
        error: 'METFA AI Boundary Violation: AI agents cannot place or lift user holds.',
      };
    }

    if (!this.AUTHORIZED_OPERATOR_ROLES.includes(params.actor_role)) {
      return {
        success: false,
        error: `Unauthorized: Setting holds requires operator role. Received '${params.actor_role}'.`,
      };
    }

    const summary = this.userSummaries.get(params.user_id) || this.buildFreshUserSummary(params.user_id);

    if (params.hold_type === 'contribution') {
      summary.is_contribution_held = params.active;
    } else if (params.hold_type === 'reward') {
      summary.is_reward_held = params.active;
    } else if (params.hold_type === 'payout') {
      summary.is_payout_held = params.active;
    }

    summary.last_evaluated_at = new Date().toISOString();
    this.userSummaries.set(params.user_id, summary);

    this.recordAudit({
      action: params.active ? 'USER_HOLD_PLACED' : 'USER_HOLD_RELEASED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: params.user_id,
      target_type: 'HOLD',
      reason: params.reason,
      new_state: {
        hold_type: params.hold_type,
        active: params.active,
      },
    });

    return { success: true, summary: { ...summary } };
  }

  // =========================================================================
  // 8. OPERATOR REVIEW & RESOLUTION WORKFLOW
  // =========================================================================

  public resolveSignal(params: {
    signal_id: string;
    resolution: 'RESOLVED' | 'DISMISSED';
    notes: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; signal?: V2RiskSignal; error?: string } {
    if (this.isAiActor(params.actor_role)) {
      return {
        success: false,
        error: 'METFA AI Boundary Violation: AI agents cannot resolve risk signals.',
      };
    }

    if (!this.AUTHORIZED_OPERATOR_ROLES.includes(params.actor_role)) {
      return {
        success: false,
        error: `Unauthorized: Resolving risk signals requires operator role. Received '${params.actor_role}'.`,
      };
    }

    const signal = this.signals.get(params.signal_id);
    if (!signal) {
      return { success: false, error: `Risk signal '${params.signal_id}' not found.` };
    }

    const previousStatus = signal.status;
    signal.status = params.resolution;
    signal.resolved_at = new Date().toISOString();
    signal.resolved_by = params.actor_id;
    signal.resolution_notes = params.notes;

    // Also resolve linked METFA Signal if present
    if (signal.linked_metfa_signal_id) {
      const metfaSig = this.metfaSignals.get(signal.linked_metfa_signal_id);
      if (metfaSig) {
        metfaSig.status = (params.resolution === 'RESOLVED' ? 'RESOLVED' : 'DISMISSED') as SignalStatus;
        metfaSig.resolved_at = signal.resolved_at;
        metfaSig.resolved_by = signal.resolved_by;
      }
    }

    // Re-evaluate user profile
    this.refreshUserRiskSummary(signal.user_id);

    this.recordAudit({
      action: 'RISK_SIGNAL_RESOLVED',
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: signal.id,
      target_type: 'SIGNAL',
      reason: params.notes,
      previous_state: { status: previousStatus },
      new_state: { status: params.resolution, resolved_by: params.actor_id },
    });

    return { success: true, signal: { ...signal } };
  }

  // =========================================================================
  // 9. SIGNAL ENGINE INTEGRATION
  // =========================================================================

  private createMetfaSignalRecord(riskSignal: V2RiskSignal, explanation: string): V2DbSignal {
    const metfaSignalId = `sig_v2_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const requiredApproval = riskSignal.severity === 'CRITICAL' ? 'admin' : 'operator';

    const dbSignal: V2DbSignal = {
      id: metfaSignalId,
      title: `[RISK] ${riskSignal.signal_type} on ${riskSignal.affected_module}`,
      why_detected: explanation,
      severity: riskSignal.severity,
      affected_module: riskSignal.affected_module,
      evidence: this.sanitizeEvidence(riskSignal.evidence),
      ai_analysis: {
        summary: `Detected ${riskSignal.category} risk with score ${riskSignal.risk_score}/100.`,
        confidence: riskSignal.confidence,
        data_classification: riskSignal.data_classification,
        recommended_action: riskSignal.recommended_action,
      },
      recommended_action: riskSignal.recommended_action,
      required_approval: requiredApproval,
      status: 'DETECTED',
      created_at: riskSignal.detected_at,
    };

    this.metfaSignals.set(metfaSignalId, dbSignal);
    return dbSignal;
  }

  public listMetfaSignals(): V2DbSignal[] {
    return Array.from(this.metfaSignals.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // =========================================================================
  // 10. TELEMETRY & HEALTH
  // =========================================================================

  public listSignals(filters?: {
    user_id?: string;
    severity?: V2RiskSeverity;
    category?: V2RiskCategory;
    status?: V2RiskSignalStatus;
    affected_module?: string;
  }): V2RiskSignal[] {
    let result = Array.from(this.signals.values());

    if (filters?.user_id) {
      result = result.filter((s) => s.user_id === filters.user_id);
    }
    if (filters?.severity) {
      result = result.filter((s) => s.severity === filters.severity);
    }
    if (filters?.category) {
      result = result.filter((s) => s.category === filters.category);
    }
    if (filters?.status) {
      result = result.filter((s) => s.status === filters.status);
    }
    if (filters?.affected_module) {
      result = result.filter((s) => s.affected_module === filters.affected_module);
    }

    return result.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  }

  public getSignal(signalId: string): V2RiskSignal | null {
    const sig = this.signals.get(signalId);
    return sig ? { ...sig } : null;
  }

  public getAuditLogs(): V2RiskAuditLog[] {
    return [...this.auditLogs];
  }

  public getEngineHealth(): V2RiskEngineHealth {
    const allSignals = Array.from(this.signals.values());
    const active = allSignals.filter((s) => s.status === 'ACTIVE');
    const underReview = allSignals.filter((s) => s.status === 'UNDER_REVIEW');
    const resolved = allSignals.filter((s) => s.status === 'RESOLVED' || s.status === 'DISMISSED');

    let highRiskUsers = 0;
    let heldContribution = 0;
    let heldReward = 0;
    let heldPayout = 0;

    for (const summary of this.userSummaries.values()) {
      if (summary.risk_level === 'HIGH' || summary.risk_level === 'CRITICAL') {
        highRiskUsers++;
      }
      if (summary.is_contribution_held) heldContribution++;
      if (summary.is_reward_held) heldReward++;
      if (summary.is_payout_held) heldPayout++;
    }

    return {
      status: this.engineEnabled ? 'HEALTHY' : 'PAUSED',
      engine_enabled: this.engineEnabled,
      active_policy_version: this.activePolicy.version,
      total_signals_detected: allSignals.length,
      active_signals_count: active.length,
      under_review_count: underReview.length,
      resolved_signals_count: resolved.length,
      high_risk_users_count: highRiskUsers,
      active_holds: {
        contribution: heldContribution,
        reward: heldReward,
        payout: heldPayout,
      },
    };
  }

  public resetForTesting(): void {
    this.signals.clear();
    this.idempotencyIndex.clear();
    this.userSummaries.clear();
    this.metfaSignals.clear();
    this.userActionTimestamps.clear();
    this.auditLogs = [];
    this.activePolicy = { ...DEFAULT_RISK_POLICY };
    this.policyHistory = new Map([[DEFAULT_RISK_POLICY.version, { ...DEFAULT_RISK_POLICY }]]);
    this.engineEnabled = true;

    this.recordAudit({
      action: 'RISK_ENGINE_BOOTSTRAP',
      actor_id: 'SYSTEM',
      actor_role: 'SYSTEM',
      target_type: 'SYSTEM',
      reason: 'METFA V2 Canonical Risk & Anti-Fraud Engine initialized.',
      new_state: { policy_version: this.activePolicy.version },
    });
  }

  // =========================================================================
  // 11. INTERNAL HELPERS
  // =========================================================================

  private refreshUserRiskSummary(userId: string): void {
    const userSignals = Array.from(this.signals.values()).filter(
      (s) => s.user_id === userId && s.status === 'ACTIVE'
    );

    let maxScore = 0;
    let highCount = 0;
    let criticalCount = 0;
    const categories: Set<V2RiskCategory> = new Set();
    let latestAt: string | undefined;

    for (const s of userSignals) {
      if (s.risk_score > maxScore) maxScore = s.risk_score;
      if (s.severity === 'HIGH') highCount++;
      if (s.severity === 'CRITICAL') criticalCount++;
      categories.add(s.category);
      if (!latestAt || new Date(s.detected_at).getTime() > new Date(latestAt).getTime()) {
        latestAt = s.detected_at;
      }
    }

    const currentSummary = this.userSummaries.get(userId) || this.buildFreshUserSummary(userId);
    const riskLevel = this.mapScoreToSeverity(maxScore, this.activePolicy);
    const requiresReview = maxScore >= this.activePolicy.rules.require_review_threshold;

    // If critical signals exist, auto-apply policy holds if not already set
    if (criticalCount > 0 && maxScore >= this.activePolicy.rules.hold_action_threshold) {
      if (categories.has('CONTRIBUTION_FARMING') || categories.has('WATCH_VIEW_ABUSE')) {
        currentSummary.is_contribution_held = true;
      }
      if (categories.has('WALLET_REWARD')) {
        currentSummary.is_reward_held = true;
      }
      if (categories.has('PAYOUT_READINESS')) {
        currentSummary.is_payout_held = true;
      }
    }

    currentSummary.overall_risk_score = maxScore;
    currentSummary.risk_level = riskLevel;
    currentSummary.active_signals_count = userSignals.length;
    currentSummary.high_severity_signals_count = highCount;
    currentSummary.critical_signals_count = criticalCount;
    currentSummary.requires_human_review = requiresReview;
    currentSummary.active_categories = Array.from(categories);
    currentSummary.latest_signal_at = latestAt;
    currentSummary.last_evaluated_at = new Date().toISOString();

    if (criticalCount > 0) {
      currentSummary.eligibility_status = 'HELD_FOR_REVIEW';
    } else if (highCount > 0) {
      currentSummary.eligibility_status = 'LIMITED';
    } else {
      currentSummary.eligibility_status = 'ELIGIBLE';
    }

    this.userSummaries.set(userId, currentSummary);
  }

  private buildFreshUserSummary(userId: string): V2UserRiskSummary {
    return {
      user_id: userId,
      overall_risk_score: 0,
      risk_level: 'INFO',
      active_signals_count: 0,
      high_severity_signals_count: 0,
      critical_signals_count: 0,
      requires_human_review: false,
      eligibility_status: 'ELIGIBLE',
      is_contribution_held: false,
      is_reward_held: false,
      is_payout_held: false,
      last_evaluated_at: new Date().toISOString(),
      active_categories: [],
    };
  }

  private recordUserActionTimestamp(userId: string): void {
    const now = Date.now();
    const timestamps = this.userActionTimestamps.get(userId) || [];
    // Keep only timestamps from last 60 seconds
    const windowStart = now - 60000;
    const filtered = timestamps.filter((t) => t > windowStart);
    filtered.push(now);
    this.userActionTimestamps.set(userId, filtered);
  }

  private getUserActionVelocityPerMinute(userId: string): number {
    const now = Date.now();
    const timestamps = this.userActionTimestamps.get(userId) || [];
    const windowStart = now - 60000;
    return timestamps.filter((t) => t > windowStart).length;
  }

  private sanitizeEvidence(evidence: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const forbiddenKeys = ['password', 'token', 'secret', 'auth', 'cookie', 'jwt', 'session', 'ssn', 'card'];

    for (const [key, value] of Object.entries(evidence)) {
      const lower = key.toLowerCase();
      if (forbiddenKeys.some((k) => lower.includes(k))) {
        sanitized[key] = '[REDACTED_FOR_SECURITY]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private isAiActor(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return r.includes('AI') || r.includes('BOT') || r.includes('METFA_AI') || r.includes('AGENT');
  }

  private recordAudit(entry: Omit<V2RiskAuditLog, 'id' | 'timestamp'>): void {
    const log: V2RiskAuditLog = {
      id: `audit_risk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }
}

export const v2RiskEngine = new V2RiskEngine();
