/**
 * METFA V2 — Risk & Anti-Fraud Engine Types & Specifications (Phase 8)
 *
 * CORE ARCHITECTURAL DIRECTIVES:
 * 1. Centralized Risk Engine: Canonical layer for fraud, anomaly, and abuse detection.
 * 2. Risk Detection != User Punishment:
 *    Suspicious signals trigger observation, review, or holds. Never automatic bans.
 * 3. Normalized Risk Score: 0 to 100 integer range.
 * 4. Configurable Policies: Thresholds and enforcement rules are policy-driven, never hard-coded.
 * 5. Phase 5 Compatibility: Preserves and ingests Phase 5 qualification flags.
 * 6. Financial Ledger Immunity:
 *    - Never invents CP or money.
 *    - Never modifies immutable wallet or contribution history.
 *    - Never bypasses Reward or Wallet engines.
 * 7. AI Boundary:
 *    - AI analysis is strictly advisory with explicit confidence.
 *    - Distinguishes VERIFIED_DATA, OBSERVED_SIGNAL, INFERENCE, ESTIMATE, RECOMMENDATION.
 *    - AI cannot declare fraud as fact, execute bans, or mutate ledgers.
 * 8. Privacy & Data Minimization:
 *    - No invasive fingerprinting, no PII, sanitized non-sensitive evidence.
 * 9. Server-Authoritative & RLS: Sensitive fraud rules and evidence protected from regular users.
 */

import { V2ModuleId, SignalSeverity } from './v2';

// ============================================================================
// 1. RISK CATEGORIES & ENUMS
// ============================================================================

export type V2RiskCategory =
  | 'ACCOUNT'
  | 'DEVICE_NETWORK'
  | 'ACTIVITY_VELOCITY'
  | 'ENGAGEMENT'
  | 'CONTENT'
  | 'WATCH_VIEW_ABUSE'
  | 'CONTRIBUTION_FARMING'
  | 'MARKETPLACE'
  | 'AUDIO'
  | 'REFERRAL'
  | 'WALLET_REWARD'
  | 'PAYOUT_READINESS'
  | 'ADS'
  | 'VERIFICATION';

export type V2RiskSeverity = SignalSeverity; // 'INFO' | 'NOTICE' | 'WARNING' | 'HIGH' | 'CRITICAL'

export type V2RiskConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type V2RiskDataClassification =
  | 'VERIFIED_DATA'
  | 'OBSERVED_SIGNAL'
  | 'INFERENCE'
  | 'ESTIMATE'
  | 'RECOMMENDATION';

export type V2RiskConfidenceSource =
  | 'DETERMINISTIC_RULE'
  | 'STATISTICAL_ANOMALY'
  | 'AI_ADVISORY';

export type V2RiskAction =
  | 'ALLOW'
  | 'MONITOR'
  | 'FLAG'
  | 'HOLD_CONTRIBUTION'
  | 'HOLD_REWARD'
  | 'HOLD_PAYOUT'
  | 'REQUIRE_REVIEW'
  | 'REQUIRE_ADDITIONAL_VERIFICATION'
  | 'LIMIT_ACTIVITY'
  | 'REJECT_ACTIVITY';

export type V2RiskSignalStatus =
  | 'ACTIVE'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'DISMISSED';

export type V2UserEligibilityStatus =
  | 'ELIGIBLE'
  | 'LIMITED'
  | 'HELD_FOR_REVIEW'
  | 'EXCLUDED';

export type V2RiskSourceType =
  | 'CONTRIBUTION_LEDGER'
  | 'REWARD_ALLOCATION'
  | 'WALLET_TRANSACTION'
  | 'PAYOUT_REQUEST'
  | 'AD_EVENT'
  | 'MARKETPLACE_TRANSACTION'
  | 'AUDIO_EVENT'
  | 'USER_ACTIVITY'
  | 'VERIFICATION_REQUEST'
  | 'SYSTEM';

// Canonical risk signal types across all 14 categories
export type V2RiskSignalType =
  // Account
  | 'ACCOUNT_CREATION_VELOCITY'
  | 'ACCOUNT_AGE_ACTIVITY_MISMATCH'
  | 'REPEATED_ACCOUNT_BEHAVIOR'
  | 'ACCOUNT_INTEGRITY_ANOMALY'
  // Device / Network
  | 'DEVICE_ACTIVITY_ANOMALY'
  | 'EXCESSIVE_SAME_DEVICE_ACTIVITY'
  | 'SUSPICIOUS_NETWORK_PATTERN'
  | 'UNUSUAL_GEO_NETWORK_CHANGE'
  // Activity Velocity
  | 'EXCESSIVE_ACTION_VELOCITY'
  | 'ABNORMAL_POSTING_VELOCITY'
  | 'ABNORMAL_COMMENTING_VELOCITY'
  | 'ABNORMAL_FOLLOW_VELOCITY'
  | 'REPEATED_IDENTICAL_ACTIONS'
  // Engagement
  | 'SELF_ENGAGEMENT_LOOP'
  | 'COORDINATED_ENGAGEMENT'
  | 'ABNORMAL_ENGAGEMENT_RATIO'
  | 'SUSPICIOUS_ENGAGEMENT_TIMING'
  // Content
  | 'DUPLICATE_CONTENT_PATTERN'
  | 'CONTENT_SIMILARITY_BURST'
  | 'SPAM_CONTENT_PATTERN'
  | 'AUTOMATED_CONTENT_BEHAVIOR'
  | 'LOW_QUALITY_REPETITIVE_CONTENT'
  // Watch / View Abuse
  | 'REPEATED_ARTIFICIAL_VIEWS'
  | 'ABNORMAL_WATCH_TIME_PATTERN'
  | 'IMPOSSIBLE_COMPLETION_SPEED'
  | 'SHORT_DURATION_FARMING'
  | 'SUSPICIOUS_REPLAY_PATTERN'
  // Contribution Farming
  | 'CP_FARMING_PATTERN'
  | 'COOLDOWN_BYPASS_ATTEMPT'
  | 'DAILY_CAP_ABUSE_ATTEMPT'
  | 'SOURCE_REFERENCE_MANIPULATION'
  // Marketplace
  | 'SUSPICIOUS_MARKETPLACE_TX'
  | 'MARKETPLACE_REFUND_ANOMALY'
  | 'TRANSACTION_FARMING'
  | 'BUYER_SELLER_COLLUSION'
  | 'UNVERIFIED_TRANSACTION_CP'
  // Audio
  | 'ARTIFICIAL_AUDIO_USAGE'
  | 'ATTRIBUTION_MANIPULATION'
  | 'SUSPICIOUS_AUDIO_VELOCITY'
  | 'INVALID_AUDIO_ATTRIBUTION'
  // Referral
  | 'SUSPICIOUS_REFERRAL_CLUSTER'
  | 'SELF_REFERRAL'
  | 'CIRCULAR_REFERRAL'
  | 'ABNORMAL_REFERRAL_VELOCITY'
  // Wallet / Reward
  | 'DUPLICATE_REWARD_ATTEMPT'
  | 'ABNORMAL_REWARD_ACCUMULATION'
  | 'SUSPICIOUS_REWARD_ACTIVITY_RATIO'
  | 'WALLET_RECONCILIATION_ANOMALY'
  | 'REPEATED_REVERSAL_PATTERN'
  // Payout Readiness
  | 'UNUSUAL_PAYOUT_BEHAVIOR'
  | 'REPEATED_FAILED_PAYOUTS'
  | 'PAYOUT_ACCOUNT_MISMATCH'
  | 'SUSPICIOUS_WITHDRAWAL_PATTERN'
  // Ads
  | 'ABNORMAL_AD_CLICK_BEHAVIOR'
  | 'AD_CLICK_FARMING'
  | 'AD_IMPRESSION_ANOMALY'
  | 'AD_CONVERSION_ANOMALY'
  // Verification
  | 'SUSPICIOUS_VERIFICATION_INFO'
  | 'IMPERSONATION_INDICATOR'
  | 'REPEATED_VERIFICATION_ATTEMPTS'
  | 'IDENTITY_ACCOUNT_MISMATCH';

// ============================================================================
// 2. RISK SIGNAL RECORD
// ============================================================================

export interface V2RiskSignal {
  id: string;
  user_id: string;
  signal_type: V2RiskSignalType | string;
  category: V2RiskCategory;
  severity: V2RiskSeverity;
  risk_score: number; // 0 - 100
  confidence: V2RiskConfidence;
  confidence_source: V2RiskConfidenceSource;
  data_classification: V2RiskDataClassification;
  affected_module: V2ModuleId | string;
  source_type: V2RiskSourceType;
  source_id?: string;
  evidence: Record<string, unknown>; // Sanitized, no secrets, no invasive tracking
  recommended_action: V2RiskAction;
  requires_human_review: boolean;
  status: V2RiskSignalStatus;
  detected_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  idempotency_key: string;
  linked_metfa_signal_id?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 3. RISK POLICY & CONFIGURATION
// ============================================================================

export interface V2RiskThresholdConfig {
  low_max: number;      // e.g. 19
  notice_max: number;   // e.g. 39
  medium_max: number;   // e.g. 59
  high_max: number;     // e.g. 79
  critical_min: number; // e.g. 80
}

export interface V2RiskRuleLimits {
  // Activity velocity
  max_actions_per_minute: number;       // e.g. 30
  max_comments_per_minute: number;      // e.g. 12
  max_posts_per_hour: number;           // e.g. 15
  max_identical_actions_window: number; // e.g. 4
  // Watch / Content
  min_watch_duration_seconds: number;   // e.g. 5
  min_completion_ratio: number;         // e.g. 0.60
  max_playback_speed_ratio: number;     // e.g. 2.5
  max_identical_content_ratio: number;  // e.g. 0.85
  // Ads
  max_ad_ctr_threshold: number;         // e.g. 0.35 (35% CTR)
  // Marketplace & Audio
  max_refund_ratio_threshold: number;   // e.g. 0.40 (40% refunds)
  // Review & Enforcement Triggers
  require_review_threshold: number;     // e.g. 60
  hold_action_threshold: number;        // e.g. 80
}

export interface V2RiskPolicy {
  id: string;
  version: number;
  policy_name: string;
  description: string;
  thresholds: V2RiskThresholdConfig;
  rules: V2RiskRuleLimits;
  is_active: boolean;
  effective_from: string;
  approved_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 4. USER RISK PROFILE & AGGREGATE SUMMARY
// ============================================================================

export interface V2UserRiskSummary {
  user_id: string;
  overall_risk_score: number; // 0 - 100
  risk_level: V2RiskSeverity;
  active_signals_count: number;
  high_severity_signals_count: number;
  critical_signals_count: number;
  requires_human_review: boolean;
  eligibility_status: V2UserEligibilityStatus;
  
  // Specific hold states (policy-driven)
  is_contribution_held: boolean;
  is_reward_held: boolean;
  is_payout_held: boolean;
  
  latest_signal_at?: string;
  last_evaluated_at: string;
  active_categories: V2RiskCategory[];
}

// ============================================================================
// 5. EVALUATION INPUT & RESULT
// ============================================================================

export interface V2RiskEvaluationRequest {
  user_id: string;
  event_type: string;
  category: V2RiskCategory;
  affected_module: V2ModuleId | string;
  source_type: V2RiskSourceType;
  source_id?: string;
  payload?: Record<string, unknown>;
  
  // Contextual observation data (sanitized, non-invasive)
  observation?: {
    action_count_in_window?: number;
    window_seconds?: number;
    identical_actions_count?: number;
    duration_seconds?: number;
    expected_min_duration?: number;
    completion_ratio?: number;
    is_self_target?: boolean;
    ip_sharing_user_count?: number;
    is_vpn_detected?: boolean;
    content_text?: string;
    is_original?: boolean;
    transaction_status?: string;
    audio_has_license?: boolean;
    ad_click_rate?: number;
    reward_amount_cents?: number;
    payout_failed_count?: number;
  };

  // Optional AI advisory input (strictly advisory)
  ai_advisory?: {
    inference_score?: number;
    classification: V2RiskDataClassification;
    reasoning?: string;
    confidence: V2RiskConfidence;
  };
}

export interface V2RiskEvaluationResult {
  evaluated: boolean;
  user_id: string;
  risk_score: number; // 0 - 100
  severity: V2RiskSeverity;
  category: V2RiskCategory;
  recommended_action: V2RiskAction;
  requires_human_review: boolean;
  signal_created: boolean;
  signal?: V2RiskSignal;
  metfa_signal_created: boolean;
  metfa_signal_id?: string;
  explanation: string;
  evidence: Record<string, unknown>;
  evaluated_at: string;
}

// ============================================================================
// 6. AUDIT & TELEMETRY
// ============================================================================

export interface V2RiskAuditLog {
  id: string;
  action: string;
  actor_id: string;
  actor_role: string;
  target_id?: string;
  target_type: 'SIGNAL' | 'USER_RISK' | 'POLICY' | 'HOLD' | 'SYSTEM';
  reason?: string;
  previous_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  timestamp: string;
}

export interface V2RiskEngineHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'PAUSED';
  engine_enabled: boolean;
  active_policy_version: number;
  total_signals_detected: number;
  active_signals_count: number;
  under_review_count: number;
  resolved_signals_count: number;
  high_risk_users_count: number;
  active_holds: {
    contribution: number;
    reward: number;
    payout: number;
  };
}
