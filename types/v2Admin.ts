/**
 * METFA V2 — Admin Control Center & Governance Types (Phase 9)
 *
 * Single Source of Truth for:
 * - Role-Based Access Control (RBAC)
 * - Canonical 8 Feature Flags
 * - Canonical 6 Emergency Kill Switches
 * - 6-Level AI Governance Model
 * - AI Health & Telemetry States
 * - Attention Queue & Unified Approval Items
 * - 16-Module Health Telemetry
 * - Append-Only Governance Audit Logs
 */

import { V2ModuleId, SignalSeverity, SignalStatus } from './v2';

// ============================================================================
// 1. ROLES & PERMISSIONS
// ============================================================================

export type V2UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINANCE_ADMIN'
  | 'ADS_MANAGER'
  | 'CONTENT_MANAGER'
  | 'OPERATOR'
  | 'DEVELOPER'
  | 'FREELANCER'
  | 'REVIEWER'
  | 'SUPPORT'
  | 'ANALYST';

export type V2AdminPermission =
  | 'SYSTEM_SETTINGS_READ'
  | 'SYSTEM_SETTINGS_WRITE'
  | 'FEATURE_FLAGS_MANAGE'
  | 'EMERGENCY_KILL_SWITCH'
  | 'FINANCE_READ'
  | 'FINANCE_SETTLE'
  | 'PAYOUT_APPROVE'
  | 'ADS_MANAGE'
  | 'CONTENT_MODERATE'
  | 'RISK_RESOLVE'
  | 'VERIFICATION_REVIEW'
  | 'POLICY_MANAGE'
  | 'AUDIT_LOG_READ'
  | 'AI_GOVERNANCE_MANAGE'
  | 'TECHNICAL_OPS';

// ============================================================================
// 2. CANONICAL FEATURE FLAGS (EXACT 8 REQUIRED)
// ============================================================================

export type V2FeatureFlagKey =
  | 'ads_enabled'
  | 'sponsored_feed_enabled'
  | 'reels_ads_enabled'
  | 'external_ad_providers_enabled'
  | 'contribution_enabled'
  | 'reward_enabled'
  | 'payout_enabled'
  | 'ai_monetization_enabled';

export interface V2FeatureFlagState {
  key: V2FeatureFlagKey;
  label: string;
  description: string;
  enabled: boolean;
  category: 'ads' | 'contribution' | 'rewards' | 'finance' | 'ai';
  allowedRoles: V2UserRole[];
  lastUpdatedBy?: string;
  lastUpdatedRole?: string;
  lastUpdatedAt: string;
}

// ============================================================================
// 3. EMERGENCY KILL SWITCHES (EXACT 6 REQUIRED)
// ============================================================================

export type V2KillSwitchKey =
  | 'ads_paused'
  | 'rewards_paused'
  | 'payouts_paused'
  | 'contribution_paused'
  | 'external_providers_paused'
  | 'ai_actions_paused';

export interface V2KillSwitchState {
  key: V2KillSwitchKey;
  label: string;
  description: string;
  isPaused: boolean;
  targetModule: V2ModuleId;
  pausedBy?: string;
  pausedRole?: string;
  pausedAt?: string;
  reason?: string;
}

// ============================================================================
// 4. METFA AI GOVERNANCE MODEL (6 LEVELS)
// ============================================================================

export enum V2AiGovernanceLevel {
  LEVEL_1_READ = 'LEVEL_1_READ',
  LEVEL_2_ANALYZE = 'LEVEL_2_ANALYZE',
  LEVEL_3_DRAFT = 'LEVEL_3_DRAFT',
  LEVEL_4_RECOMMEND = 'LEVEL_4_RECOMMEND',
  LEVEL_5_SAFE_EXECUTE = 'LEVEL_5_SAFE_EXECUTE',
  LEVEL_6_CRITICAL_HUMAN_APPROVAL = 'LEVEL_6_CRITICAL_HUMAN_APPROVAL',
}

export interface V2AiGovernancePolicy {
  level: V2AiGovernanceLevel;
  title: string;
  description: string;
  allowedActions: string[];
  prohibitedActions: string[];
  requiresHumanSignature: boolean;
}

// ============================================================================
// 5. AI HEALTH STATES & PROVIDER ADAPTERS
// ============================================================================

export type V2AiHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'MISSING'
  | 'INVALID'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'ERROR'
  | 'RECOVERED'
  | 'UNKNOWN';

export interface V2AiProviderHealth {
  providerId: string;
  providerName: string;
  modelName: string;
  status: V2AiHealthStatus;
  latencyMs: number;
  consecutiveFailures: number;
  lastSuccessfulRequest?: string;
  lastFailedRequest?: string;
  quotaCondition: 'NORMAL' | 'NEAR_LIMIT' | 'EXCEEDED' | 'UNKNOWN';
  fallbackCondition: 'ACTIVE' | 'STANDBY' | 'DISABLED';
  recoveryStatus: 'NORMAL' | 'RECOVERING' | 'MANUAL_INTERVENTION_NEEDED';
  lastErrorSafe?: string; // Strictly sanitized, no secrets/tokens
}

// ============================================================================
// 6. MODULE HEALTH STATUS (ALL 16 MODULES)
// ============================================================================

export type V2ModuleHealthState = 'HEALTHY' | 'OPERATIONAL' | 'WARNING' | 'PAUSED' | 'CRITICAL' | 'FOUNDATION';

export interface V2ModuleHealthStatus {
  moduleId: V2ModuleId;
  label: string;
  fullProductName: string;
  state: V2ModuleHealthState;
  isPaused: boolean;
  activeSignalsCount: number;
  pendingApprovalsCount: number;
  lastCheckedAt: string;
  notes?: string;
}

// ============================================================================
// 7. ATTENTION QUEUE & APPROVAL CENTER
// ============================================================================

export type V2AttentionItemType =
  | 'CRITICAL_RISK_SIGNAL'
  | 'HIGH_RISK_SIGNAL'
  | 'PENDING_PAYOUT_APPROVAL'
  | 'PENDING_VERIFICATION_APPLICATION'
  | 'PENDING_SETTLEMENT_REVIEW'
  | 'EMERGENCY_PAUSE_ACTIVE'
  | 'AI_HEALTH_DEGRADED'
  | 'LEDGER_VARIANCE_WARNING';

export interface V2AttentionQueueItem {
  id: string;
  type: V2AttentionItemType;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'NOTICE';
  title: string;
  description: string;
  affectedModule: V2ModuleId;
  requiredRole: V2UserRole[];
  sourceRefId: string;
  actionRequired: string;
  createdAt: string;
}

export type V2ApprovalItemCategory =
  | 'VERIFICATION'
  | 'FINANCIAL_SETTLEMENT'
  | 'PAYOUT'
  | 'RISK_HOLD'
  | 'POLICY_CHANGE'
  | 'KILL_SWITCH';

export interface V2ApprovalItem {
  id: string;
  category: V2ApprovalItemCategory;
  title: string;
  summary: string;
  requesterId: string;
  affectedEntityId: string;
  amountCents?: number;
  currency?: string;
  evidence: Record<string, unknown>; // Sanitized
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requiredRoles: V2UserRole[];
  aiAnalysis?: {
    confidence: number;
    recommendation: 'APPROVE' | 'REJECT' | 'FURTHER_REVIEW';
    reasoning: string;
  };
  decisionNotes?: string;
  decidedBy?: string;
  decidedByRole?: string;
  decidedAt?: string;
  createdAt: string;
}

// ============================================================================
// 8. APPEND-ONLY GOVERNANCE AUDIT LOG
// ============================================================================

export interface V2GovernanceAuditEntry {
  id: string;
  category:
    | 'FEATURE_FLAG_MUTATION'
    | 'KILL_SWITCH_MUTATION'
    | 'APPROVAL_DECISION'
    | 'POLICY_CHANGE'
    | 'GOVERNANCE_OVERRIDE'
    | 'AI_HEALTH_TRANSITION'
    | 'ROLE_ACCESS_CHECK'
    | 'SYSTEM_BOOTSTRAP';
  actor_id: string;
  actor_role: string;
  action: string;
  target_module: V2ModuleId | 'SYSTEM';
  target_id: string;
  previous_state?: Record<string, unknown>;
  new_state: Record<string, unknown>;
  ip_masked: string;
  reason_notes: string;
  is_tamper_evident: boolean;
  timestamp: string;
}

// ============================================================================
// 9. OVERALL ADMIN CONTROL HEALTH & SNAPSHOT
// ============================================================================

export interface V2AdminControlOverview {
  overallStatus: 'HEALTHY' | 'WARNING' | 'PAUSED' | 'CRITICAL';
  activeFlagsCount: number;
  activePausesCount: number;
  criticalSignalsCount: number;
  pendingApprovalsCount: number;
  aiHealthState: V2AiHealthStatus;
  modulesHealth: Record<V2ModuleId, V2ModuleHealthStatus>;
  killSwitches: Record<V2KillSwitchKey, V2KillSwitchState>;
  featureFlags: Record<V2FeatureFlagKey, V2FeatureFlagState>;
  recentAuditCount: number;
  evaluatedAt: string;
}
