/**
 * METFA V2 — Core Contribution Engine Types & Specifications
 * 
 * CORE RULES:
 * 1. Contribution Points (CP) are NOT money.
 * 2. Never implement CP -> cash conversions, views -> money, or wallet payouts here.
 * 3. Raw activity must NEVER automatically earn CP; it passes multi-stage qualification.
 * 4. Append-only ledger architecture. No updating or deleting historical entries.
 * 5. Feature Flag 'contribution_enabled' controls engine ingestion.
 */

export type V2ContributionAction =
  | 'ORIGINAL_CONTENT'
  | 'QUALIFIED_VIEW'
  | 'QUALIFIED_WATCH'
  | 'MEANINGFUL_ENGAGEMENT'
  | 'COMMUNITY_CONTRIBUTION'
  | 'VERIFIED_ACTIVITY'
  | 'MARKETPLACE_CONTRIBUTION'
  | 'BUSINESS_ACTIVITY'
  | 'AUDIO_USAGE'
  | 'AUDIO_ATTRIBUTION'
  | 'VOICE_POST_LISTEN'
  | 'CREATOR_ACTIVITY';

export type V2ContributionStatus =
  | 'RECORDED'
  | 'QUALIFIED'
  | 'FLAGGED_RISK'
  | 'SETTLED'
  | 'DISCARDED';

export type V2ContributionEntryType =
  | 'AWARD'
  | 'REVERSAL'
  | 'ADJUSTMENT';

export interface V2ContributionPolicyRecord {
  id: string;
  action: V2ContributionAction;
  version: number;
  base_points: number;
  quality_multiplier_max: number; // e.g. 2.00
  daily_limit_points: number;     // max CP per user per day for this action
  cooldown_seconds: number;       // min delay between actions for this user
  eligibility_tier_required: 'STANDARD' | 'VERIFIED' | 'CREATOR_PRO' | 'BUSINESS';
  fraud_weight: number;           // 0.0 to 1.0 weight factor in risk scoring
  configuration: {
    min_watch_duration_seconds?: number;
    min_completion_ratio?: number; // e.g. 0.60 for 60%
    min_content_length?: number;
    require_verified_transaction?: boolean;
    require_audio_license_verified?: boolean;
    [key: string]: unknown;
  };
  status: 'ACTIVE' | 'PAUSED' | 'DEPRECATED';
  effective_from: string;
  effective_until?: string;
  created_at: string;
}

export interface V2ContributionLedgerRecord {
  id: string;
  user_id: string;
  action: V2ContributionAction;
  policy_id: string;
  policy_version: number;
  entry_type: V2ContributionEntryType;
  base_points: number;
  quality_multiplier: number; // calculated server-side
  final_points: number;       // integer CP (positive for AWARD, negative for REVERSAL)
  source_ref: string;         // external/client reference: e.g. 'post:uuid', 'order:uuid', 'event:uuid'
  original_entry_id?: string; // For REVERSAL / ADJUSTMENT linking
  risk_score: number;         // 0 to 100 risk assessment
  risk_flags?: string[];
  status: V2ContributionStatus;
  period_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface V2ActivityEventRequest {
  user_id: string;
  action: V2ContributionAction;
  source_ref: string;
  event_timestamp?: string;
  user_tier?: 'STANDARD' | 'VERIFIED' | 'CREATOR_PRO' | 'BUSINESS';
  payload?: {
    watch_duration_seconds?: number;
    total_content_duration_seconds?: number;
    completion_ratio?: number;
    content_text?: string;
    is_original?: boolean;
    transaction_status?: 'COMPLETED' | 'PENDING' | 'REFUNDED' | 'CANCELLED' | 'CHARGEBACK';
    transaction_ref?: string;
    audio_track_id?: string;
    audio_license_type?: string;
    audio_attribution_valid?: boolean;
    is_author?: boolean;
    is_self_action?: boolean;
    [key: string]: unknown;
  };
}

export interface V2ContributionProcessingResult {
  success: boolean;
  status: 'QUALIFIED' | 'REJECTED' | 'DUPLICATE' | 'DISABLED' | 'RATE_LIMITED' | 'COOLDOWN' | 'RISK_FLAGGED';
  entry?: V2ContributionLedgerRecord;
  rejection_reason?: string;
  points_awarded: number;
  is_duplicate: boolean;
}

export interface V2ContributionUserSummary {
  user_id: string;
  total_qualified_points: number;
  points_today: number;
  by_action: Record<string, number>;
  entries_count: number;
  last_activity_at?: string;
}

export interface V2ContributionEngineHealth {
  status: 'HEALTHY' | 'PAUSED' | 'DEGRADED';
  feature_flag_enabled: boolean;
  active_policies_count: number;
  total_ledger_entries: number;
  total_qualified_points: number;
  unresolved_risk_signals: number;
}
