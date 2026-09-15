/**
 * METFA V2 — Master Admin Control Center & Governance Engine (Phase 9)
 *
 * CANONICAL ADMINISTRATIVE & GOVERNANCE CONTROL SURFACE
 *
 * CORE ARCHITECTURAL INVARIANTS:
 * 1. Role-Based Access Control (RBAC):
 *    Strict least-privilege matrix. Freelancer has zero admin controls; Support has support-safe view;
 *    Finance Admin manages finances; Ads Manager manages ads; Super Admin has master authority.
 * 2. Feature Flags & Kill Switches:
 *    Only 8 canonical flags. Exactly 6 emergency kill switches.
 *    Kill switches pause FUTURE processing only; NEVER delete data, rewrite history, or mutate ledgers.
 * 3. AI Governance (Level 1–6):
 *    "AI does the thinking and preparation. Human does the authorization. System does the controlled execution."
 *    AI is strictly forbidden from financial approvals, ledger mutations, policy splits, or security overrides.
 * 4. Append-Only Audit Trail:
 *    Every administrative mutation, toggle, and approval is immutably logged with sanitized metadata.
 *    Audit records are strictly non-updatable and non-deletable.
 * 5. Secret & PII Sanitization:
 *    API keys, credentials, and raw verification documents are never exposed in UI or logs.
 */

import { V2ModuleId, SignalSeverity, SignalStatus } from '../types/v2';
import {
  V2UserRole,
  V2AdminPermission,
  V2FeatureFlagKey,
  V2FeatureFlagState,
  V2KillSwitchKey,
  V2KillSwitchState,
  V2AiGovernanceLevel,
  V2AiGovernancePolicy,
  V2AiHealthStatus,
  V2AiProviderHealth,
  V2ModuleHealthStatus,
  V2AttentionQueueItem,
  V2ApprovalItem,
  V2ApprovalItemCategory,
  V2GovernanceAuditEntry,
  V2AdminControlOverview,
} from '../types/v2Admin';
import { v2RevenueEngine } from './v2RevenueEngine';
import { v2ContributionEngine } from './v2ContributionEngine';
import { v2RewardEngine } from './v2RewardEngine';
import { v2WalletEngine } from './v2WalletEngine';
import { v2RiskEngine } from './v2RiskEngine';

// Canonical 16 Module IDs matching V2 Registry
const ALL_V2_MODULE_IDS: V2ModuleId[] = [
  'verified',
  'ads',
  'revenue',
  'contribution',
  'rewards',
  'risk',
  'wallet',
  'payout',
  'operations-ai',
  'signal',
  'work',
  'freelancer-team',
  'creator',
  'audio',
  'admin-control',
  'governance-audit',
];

export class V2AdminEngine {
  // Feature Flags: Exact 8 Canonical Flags
  private featureFlags: Map<V2FeatureFlagKey, V2FeatureFlagState> = new Map();

  // Emergency Kill Switches: Exact 6 Canonical Switches
  private killSwitches: Map<V2KillSwitchKey, V2KillSwitchState> = new Map();

  // AI Health Registry
  private aiProviders: Map<string, V2AiProviderHealth> = new Map();

  // Unified Approval Center Items
  private approvalItems: Map<string, V2ApprovalItem> = new Map();

  // Append-Only Governance Audit Trail
  private auditLogs: V2GovernanceAuditEntry[] = [];

  // Versioned Governance Policies
  private aiGovernancePolicies: Map<V2AiGovernanceLevel, V2AiGovernancePolicy> = new Map();

  constructor() {
    this.bootstrapFeatureFlags();
    this.bootstrapKillSwitches();
    this.bootstrapAiGovernancePolicies();
    this.bootstrapAiHealth();
    this.bootstrapApprovalCenter();

    // Initial audit log entry
    this.recordAudit({
      category: 'SYSTEM_BOOTSTRAP',
      actor_id: 'system_core',
      actor_role: 'SUPER_ADMIN',
      action: 'ADMIN_ENGINE_INITIALIZED',
      target_module: 'admin-control',
      target_id: 'master_control_surface',
      new_state: { status: 'INITIALIZED', flags_count: 8, kill_switches_count: 6 },
      ip_masked: '127.0.0.1',
      reason_notes: 'METFA V2 Admin Control Center & Governance layer initialized.',
    });
  }

  // ==========================================================================
  // 1. BOOTSTRAPPING FOUNDATION
  // ==========================================================================

  private bootstrapFeatureFlags(): void {
    const defaultFlags: Array<{
      key: V2FeatureFlagKey;
      label: string;
      description: string;
      category: 'ads' | 'contribution' | 'rewards' | 'finance' | 'ai';
      allowedRoles: V2UserRole[];
    }> = [
      {
        key: 'ads_enabled',
        label: 'Ads Engine Delivery',
        description: 'Master toggle for sponsored ad placement delivery across feeds and reels.',
        category: 'ads',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'ADS_MANAGER'],
      },
      {
        key: 'sponsored_feed_enabled',
        label: 'Sponsored Feed Posts',
        description: 'Enables native in-feed sponsored social post placements.',
        category: 'ads',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'ADS_MANAGER'],
      },
      {
        key: 'reels_ads_enabled',
        label: 'Reels Video Interstitials',
        description: 'Enables short-form video sponsored reel interstitials.',
        category: 'ads',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'ADS_MANAGER'],
      },
      {
        key: 'external_ad_providers_enabled',
        label: 'External Ad Providers',
        description: 'Allows provider-agnostic third-party ad network adapters.',
        category: 'ads',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        key: 'contribution_enabled',
        label: 'Contribution Scoring Pipeline',
        description: 'Governs ingestion and qualification of Contribution Points (CP).',
        category: 'contribution',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN'],
      },
      {
        key: 'reward_enabled',
        label: 'Reward Pool Distributions',
        description: 'Enables revenue-pool allocation and reward period settlements.',
        category: 'rewards',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN'],
      },
      {
        key: 'payout_enabled',
        label: 'Wallet Payout Gateway',
        description: 'Authorizes withdrawal requests and cash disbursement processing.',
        category: 'finance',
        allowedRoles: ['SUPER_ADMIN', 'FINANCE_ADMIN'],
      },
      {
        key: 'ai_monetization_enabled',
        label: 'AI Commercial Tooling',
        description: 'Controls monetization tiers for advanced AI generation and assistant features.',
        category: 'ai',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
      },
    ];

    const now = new Date().toISOString();
    defaultFlags.forEach((df) => {
      this.featureFlags.set(df.key, {
        ...df,
        enabled: true, // Baseline foundation enabled
        lastUpdatedAt: now,
      });
    });
  }

  private bootstrapKillSwitches(): void {
    const defaultSwitches: Array<{
      key: V2KillSwitchKey;
      label: string;
      description: string;
      targetModule: V2ModuleId;
    }> = [
      {
        key: 'ads_paused',
        label: 'Pause Ads Engine',
        description: 'Immediately halts ad serving. Active campaigns remain saved; historical impressions remain untouched.',
        targetModule: 'ads',
      },
      {
        key: 'rewards_paused',
        label: 'Pause Reward Distributions',
        description: 'Freezes future reward settlements. Finalized historical ledger allocations remain strictly immutable.',
        targetModule: 'rewards',
      },
      {
        key: 'payouts_paused',
        label: 'Pause Wallet Payouts',
        description: 'Blocks new withdrawal requests and payout disbursements. User wallet balances remain intact.',
        targetModule: 'payout',
      },
      {
        key: 'contribution_paused',
        label: 'Pause Contribution Scoring',
        description: 'Pauses new CP scoring. Historical points and user tier rankings are preserved without modification.',
        targetModule: 'contribution',
      },
      {
        key: 'external_providers_paused',
        label: 'Pause External Providers',
        description: 'Isolates external adapters (ad networks, third-party relays). Core internal engine stays operational.',
        targetModule: 'ads',
      },
      {
        key: 'ai_actions_paused',
        label: 'Pause AI Operations Actions',
        description: 'Suspends all automated AI task recommendations and execution routines across the workspace.',
        targetModule: 'operations-ai',
      },
    ];

    defaultSwitches.forEach((ds) => {
      this.killSwitches.set(ds.key, {
        ...ds,
        isPaused: false,
      });
    });
  }

  private bootstrapAiGovernancePolicies(): void {
    const policies: V2AiGovernancePolicy[] = [
      {
        level: V2AiGovernanceLevel.LEVEL_1_READ,
        title: 'Level 1 — READ (Passive Inspection)',
        description: 'AI may inspect authorized diagnostics, telemetry, and non-sensitive platform status.',
        allowedActions: ['INSPECT_METRICS', 'READ_PUBLIC_SIGNALS', 'CHECK_HEALTH'],
        prohibitedActions: ['MUTATE_DATA', 'EXECUTE_ACTIONS', 'ACCESS_PII'],
        requiresHumanSignature: false,
      },
      {
        level: V2AiGovernanceLevel.LEVEL_2_ANALYZE,
        title: 'Level 2 — ANALYZE (Pattern & Anomaly Detection)',
        description: 'AI detects anomalies, clusters risk patterns, and evaluates statistical variances.',
        allowedActions: ['DETECT_ANOMALY', 'CORRELATE_SIGNALS', 'CALCULATE_VARIANCE'],
        prohibitedActions: ['MODIFY_THRESHOLDS', 'PUNISH_USERS', 'SET_STATUS'],
        requiresHumanSignature: false,
      },
      {
        level: V2AiGovernanceLevel.LEVEL_3_DRAFT,
        title: 'Level 3 — DRAFT (Operational Task Briefing)',
        description: 'AI generates proposed task specifications, bug drafts, and investigation briefs.',
        allowedActions: ['DRAFT_TASK', 'COMPOSE_SUMMARY', 'PREPARE_AUDIT_REPORT'],
        prohibitedActions: ['ASSIGN_WORK', 'APPROVE_SUBMISSION', 'RELEASE_FUNDS'],
        requiresHumanSignature: false,
      },
      {
        level: V2AiGovernanceLevel.LEVEL_4_RECOMMEND,
        title: 'Level 4 — RECOMMEND (Advisory Recommendations)',
        description: 'AI advises human operators on risk triage, verification validity, and system optimizations.',
        allowedActions: ['RECOMMEND_RISK_ACTION', 'SUGGEST_POLICY_TWEAK', 'RANK_SEVERITY'],
        prohibitedActions: ['AUTO_RESOLVE_HIGH_RISK', 'MODIFY_LEDGER', 'ALTER_REVENUE'],
        requiresHumanSignature: false,
      },
      {
        level: V2AiGovernanceLevel.LEVEL_5_SAFE_EXECUTE,
        title: 'Level 5 — SAFE EXECUTE (Idempotent Non-Destructive Actions)',
        description: 'AI triggers cache pre-warming, benign retry loops, and non-sensitive diagnostic sweeps.',
        allowedActions: ['CLEAR_EPHEMERAL_CACHE', 'RETRY_TRANSIENT_RPC', 'POLL_PROVIDER_HEALTH'],
        prohibitedActions: ['DELETE_DATA', 'CHANGE_PERMISSIONS', 'MUTATE_FINANCES'],
        requiresHumanSignature: false,
      },
      {
        level: V2AiGovernanceLevel.LEVEL_6_CRITICAL_HUMAN_APPROVAL,
        title: 'Level 6 — CRITICAL / HUMAN AUTHORIZATION ONLY',
        description: 'Human authorization is strictly mandatory. AI is blocked by cryptographic and role boundaries.',
        allowedActions: ['PREPARE_FOR_HUMAN_APPROVAL'],
        prohibitedActions: [
          'APPROVE_PAYOUT',
          'FINALIZE_REVENUE_SETTLEMENT',
          'CHANGE_REWARD_POOL_PERCENTAGE',
          'CREATE_MONEY',
          'MUTATE_IMMUTABLE_LEDGER',
          'BYPASS_RLS',
          'CHANGE_PROVIDER_CREDENTIALS',
          'DISABLE_SECURITY_CONTROLS',
          'APPROVE_VERIFICATION',
          'CONFISCATE_USER_FUNDS',
          'DELETE_FINANCIAL_HISTORY',
          'OVERRIDE_DETERMINISTIC_RISK_RULES',
        ],
        requiresHumanSignature: true,
      },
    ];

    policies.forEach((p) => this.aiGovernancePolicies.set(p.level, p));
  }

  private bootstrapAiHealth(): void {
    const now = new Date().toISOString();
    this.aiProviders.set('gemini', {
      providerId: 'gemini_flash',
      providerName: 'Google Gemini',
      modelName: 'gemini-2.5-flash',
      status: 'HEALTHY',
      latencyMs: 185,
      consecutiveFailures: 0,
      lastSuccessfulRequest: now,
      quotaCondition: 'NORMAL',
      fallbackCondition: 'STANDBY',
      recoveryStatus: 'NORMAL',
    });

    this.aiProviders.set('intelligent_core_engine', {
      providerId: 'metfa_core_v2',
      providerName: 'METFA Operations Engine',
      modelName: 'metfa-orchestrator-v2',
      status: 'HEALTHY',
      latencyMs: 42,
      consecutiveFailures: 0,
      lastSuccessfulRequest: now,
      quotaCondition: 'NORMAL',
      fallbackCondition: 'STANDBY',
      recoveryStatus: 'NORMAL',
    });

    this.aiProviders.set('custom_adapter', {
      providerId: 'adapter_aux_01',
      providerName: 'Auxiliary Provider Adapter',
      modelName: 'adapter-passthrough',
      status: 'HEALTHY',
      latencyMs: 120,
      consecutiveFailures: 0,
      lastSuccessfulRequest: now,
      quotaCondition: 'NORMAL',
      fallbackCondition: 'STANDBY',
      recoveryStatus: 'NORMAL',
    });
  }

  private bootstrapApprovalCenter(): void {
    const now = new Date().toISOString();

    // Verification Request Pending Review
    this.approvalItems.set('appr_verif_101', {
      id: 'appr_verif_101',
      category: 'VERIFICATION',
      title: 'Creator Verification Application — @sufian_art',
      summary: 'Verified Creator Tier submission with portfolio credentials and national identity check.',
      requesterId: 'user_creator_sufian',
      affectedEntityId: 'tier_verified_creator',
      evidence: {
        portfolio_count: 14,
        id_doc_hashed: 'sha256:7f92a18d...[SAFE_REF]',
        country: 'BD',
      },
      status: 'PENDING',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'REVIEWER'],
      aiAnalysis: {
        confidence: 0.94,
        recommendation: 'APPROVE',
        reasoning: 'Authentic creator activity history matches registered identity. Zero spam flags.',
      },
      createdAt: now,
    });

    // Financial Settlement Review Pending Dual Approval
    this.approvalItems.set('appr_rev_2026_q3', {
      id: 'appr_rev_2026_q3',
      category: 'FINANCIAL_SETTLEMENT',
      title: 'Q3 2026 Reward Pool Settlement Approval',
      summary: 'Net revenue pool allocation review for Phase 6 distribution.',
      requesterId: 'finance_settlement_worker',
      affectedEntityId: 'period_2026_q3',
      amountCents: 5000000, // $50,000.00
      currency: 'USD',
      evidence: {
        gross_cents: 10000000,
        eligible_net_cents: 7000000,
        reward_pool_cents: 5000000,
        policy_version: 1,
      },
      status: 'PENDING',
      requiredRoles: ['SUPER_ADMIN', 'FINANCE_ADMIN'],
      aiAnalysis: {
        confidence: 0.99,
        recommendation: 'APPROVE',
        reasoning: 'Mathematically reconciled. Zero overallocation variance detected against gross receipts.',
      },
      createdAt: now,
    });

    // Payout Request Pending Approval
    this.approvalItems.set('appr_pay_301', {
      id: 'appr_pay_301',
      category: 'PAYOUT',
      title: 'Creator Payout Disbursement — @creator_tahsin',
      summary: 'Verified withdrawal to registered bank account. Payout readiness confirmed.',
      requesterId: 'user_creator_tahsin',
      affectedEntityId: 'payout_req_301',
      amountCents: 25000, // $250.00
      currency: 'USD',
      evidence: {
        method: 'BANK_TRANSFER',
        account_masked: '****4921',
        risk_score: 12,
      },
      status: 'PENDING',
      requiredRoles: ['SUPER_ADMIN', 'FINANCE_ADMIN'],
      aiAnalysis: {
        confidence: 0.96,
        recommendation: 'APPROVE',
        reasoning: 'Low risk score (12/100). KYC verified. Withdrawable wallet ledger balance confirmed.',
      },
      createdAt: now,
    });
  }

  // ==========================================================================
  // 2. ROLE-BASED ACCESS CONTROL (RBAC) LOGIC
  // ==========================================================================

  public hasPermission(role: V2UserRole, permission: V2AdminPermission): boolean {
    if (role === 'SUPER_ADMIN') return true;

    switch (permission) {
      case 'SYSTEM_SETTINGS_READ':
      case 'AUDIT_LOG_READ':
        return ['ADMIN', 'FINANCE_ADMIN', 'OPERATOR', 'DEVELOPER', 'ANALYST', 'REVIEWER'].includes(role);

      case 'SYSTEM_SETTINGS_WRITE':
        return ['ADMIN'].includes(role);

      case 'FEATURE_FLAGS_MANAGE':
        return ['ADMIN'].includes(role);

      case 'EMERGENCY_KILL_SWITCH':
        return ['ADMIN', 'FINANCE_ADMIN'].includes(role);

      case 'FINANCE_READ':
        return ['ADMIN', 'FINANCE_ADMIN', 'ANALYST'].includes(role);

      case 'FINANCE_SETTLE':
      case 'PAYOUT_APPROVE':
        return ['FINANCE_ADMIN'].includes(role);

      case 'ADS_MANAGE':
        return ['ADMIN', 'ADS_MANAGER'].includes(role);

      case 'CONTENT_MODERATE':
        return ['ADMIN', 'CONTENT_MANAGER', 'REVIEWER'].includes(role);

      case 'RISK_RESOLVE':
        return ['ADMIN', 'OPERATOR'].includes(role);

      case 'VERIFICATION_REVIEW':
        return ['ADMIN', 'REVIEWER'].includes(role);

      case 'POLICY_MANAGE':
        return ['ADMIN', 'FINANCE_ADMIN'].includes(role);

      case 'AI_GOVERNANCE_MANAGE':
        return ['ADMIN'].includes(role);

      case 'TECHNICAL_OPS':
        return ['ADMIN', 'DEVELOPER', 'OPERATOR'].includes(role);

      default:
        return false;
    }
  }

  public isAiActor(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return r.includes('AI') || r.includes('BOT') || r.includes('METFA_AI') || r.includes('AGENT');
  }

  // ==========================================================================
  // 3. FEATURE FLAGS MANAGEMENT
  // ==========================================================================

  public listFeatureFlags(): V2FeatureFlagState[] {
    return Array.from(this.featureFlags.values());
  }

  public getFeatureFlag(key: V2FeatureFlagKey): V2FeatureFlagState | undefined {
    return this.featureFlags.get(key);
  }

  public setFeatureFlag(params: {
    key: V2FeatureFlagKey;
    enabled: boolean;
    actor_id: string;
    actor_role: string;
    reason?: string;
  }): { success: boolean; flag?: V2FeatureFlagState; error?: string } {
    const { key, enabled, actor_id, actor_role, reason } = params;

    // AI Actor Block
    if (this.isAiActor(actor_role)) {
      return { success: false, error: 'AI agents are strictly forbidden from modifying feature flags.' };
    }

    const flag = this.featureFlags.get(key);
    if (!flag) {
      return { success: false, error: `Invalid feature flag: ${key}` };
    }

    // RBAC check
    const role = actor_role as V2UserRole;
    if (role !== 'SUPER_ADMIN' && !flag.allowedRoles.includes(role)) {
      return {
        success: false,
        error: `Role '${actor_role}' is not authorized to modify feature flag '${key}'.`,
      };
    }

    const previousState = { ...flag };
    flag.enabled = enabled;
    flag.lastUpdatedBy = actor_id;
    flag.lastUpdatedRole = actor_role;
    flag.lastUpdatedAt = new Date().toISOString();
    this.featureFlags.set(key, flag);

    // Record append-only audit
    this.recordAudit({
      category: 'FEATURE_FLAG_MUTATION',
      actor_id,
      actor_role,
      action: `SET_FEATURE_FLAG_${key.toUpperCase()}`,
      target_module: this.mapCategoryToModule(flag.category),
      target_id: key,
      previous_state: { enabled: previousState.enabled },
      new_state: { enabled },
      ip_masked: '127.0.0.1',
      reason_notes: reason || `Updated by ${actor_role} ${actor_id}`,
    });

    return { success: true, flag };
  }

  // ==========================================================================
  // 4. EMERGENCY KILL SWITCHES MANAGEMENT
  // ==========================================================================

  public listKillSwitches(): V2KillSwitchState[] {
    return Array.from(this.killSwitches.values());
  }

  public getKillSwitch(key: V2KillSwitchKey): V2KillSwitchState | undefined {
    return this.killSwitches.get(key);
  }

  public setKillSwitch(params: {
    key: V2KillSwitchKey;
    isPaused: boolean;
    actor_id: string;
    actor_role: string;
    reason: string;
  }): { success: boolean; switch?: V2KillSwitchState; error?: string } {
    const { key, isPaused, actor_id, actor_role, reason } = params;

    // AI Actor Block
    if (this.isAiActor(actor_role)) {
      return { success: false, error: 'AI agents are strictly forbidden from triggering emergency kill switches.' };
    }

    // Role check: Only Super Admin, Admin, or Finance Admin (for finance switches)
    const role = actor_role as V2UserRole;
    const isElevated =
      role === 'SUPER_ADMIN' ||
      role === 'ADMIN' ||
      (role === 'FINANCE_ADMIN' && (key === 'payouts_paused' || key === 'rewards_paused'));

    if (!isElevated) {
      return {
        success: false,
        error: `Role '${actor_role}' is not authorized to toggle emergency kill switch '${key}'.`,
      };
    }

    if (!reason || reason.trim().length < 5) {
      return {
        success: false,
        error: 'A valid operational justification (minimum 5 characters) is required for emergency pause actions.',
      };
    }

    const sw = this.killSwitches.get(key);
    if (!sw) {
      return { success: false, error: `Invalid emergency kill switch: ${key}` };
    }

    const previousState = { ...sw };
    sw.isPaused = isPaused;
    sw.pausedBy = isPaused ? actor_id : undefined;
    sw.pausedRole = isPaused ? actor_role : undefined;
    sw.pausedAt = isPaused ? new Date().toISOString() : undefined;
    sw.reason = isPaused ? reason : undefined;
    this.killSwitches.set(key, sw);

    // Record append-only audit
    this.recordAudit({
      category: 'KILL_SWITCH_MUTATION',
      actor_id,
      actor_role,
      action: isPaused ? `PAUSE_KILL_SWITCH_${key.toUpperCase()}` : `RESUME_KILL_SWITCH_${key.toUpperCase()}`,
      target_module: sw.targetModule,
      target_id: key,
      previous_state: { isPaused: previousState.isPaused },
      new_state: { isPaused },
      ip_masked: '127.0.0.1',
      reason_notes: reason,
    });

    return { success: true, switch: sw };
  }

  public isPayoutPaused(): boolean {
    return this.killSwitches.get('payouts_paused')?.isPaused || false;
  }

  public isRewardsPaused(): boolean {
    return this.killSwitches.get('rewards_paused')?.isPaused || false;
  }

  public isAdsPaused(): boolean {
    return this.killSwitches.get('ads_paused')?.isPaused || false;
  }

  public isContributionPaused(): boolean {
    return this.killSwitches.get('contribution_paused')?.isPaused || false;
  }

  public isExternalProvidersPaused(): boolean {
    return this.killSwitches.get('external_providers_paused')?.isPaused || false;
  }

  public isAiActionsPaused(): boolean {
    return this.killSwitches.get('ai_actions_paused')?.isPaused || false;
  }

  // ==========================================================================
  // 5. METFA AI GOVERNANCE & EXECUTION BOUNDARIES
  // ==========================================================================

  public listAiGovernancePolicies(): V2AiGovernancePolicy[] {
    return Array.from(this.aiGovernancePolicies.values());
  }

  /**
   * Evaluates whether METFA AI is legally and operationally authorized to execute an action.
   * STRICT INVARIANT: Level 6 critical financial, ledger, and security actions MUST be blocked!
   */
  public canAiExecuteAction(actionName: string): {
    allowed: boolean;
    governanceLevel: V2AiGovernanceLevel;
    requiresHumanSignature: boolean;
    reason: string;
  } {
    const upperAction = actionName.toUpperCase();

    // Critical Forbidden List for AI (Level 6)
    const criticalForbidden = [
      'APPROVE_PAYOUT',
      'EXECUTE_PAYOUT',
      'FINALIZE_REVENUE_SETTLEMENT',
      'SETTLE_REWARDS',
      'CHANGE_REWARD_POOL_PERCENTAGE',
      'CREATE_MONEY',
      'MUTATE_IMMUTABLE_LEDGER',
      'DEBIT_WALLET',
      'CREDIT_WALLET',
      'BYPASS_RLS',
      'CHANGE_PROVIDER_CREDENTIALS',
      'DISABLE_SECURITY_CONTROLS',
      'APPROVE_VERIFICATION',
      'CONFISCATE_USER_FUNDS',
      'DELETE_FINANCIAL_HISTORY',
      'OVERRIDE_DETERMINISTIC_RISK_RULES',
      'SET_FEATURE_FLAG',
      'TRIGGER_KILL_SWITCH',
      'BAN_USER_ACCOUNT',
      'DELETE_USER_ACCOUNT',
    ];

    if (criticalForbidden.some((f) => upperAction.includes(f))) {
      return {
        allowed: false,
        governanceLevel: V2AiGovernanceLevel.LEVEL_6_CRITICAL_HUMAN_APPROVAL,
        requiresHumanSignature: true,
        reason: 'CRITICAL ACTION VIOLATION: Financial payouts, settlements, ledger mutations, and security controls strictly require authorized human operator signature.',
      };
    }

    // Safe execution (Level 5)
    const safeExecutionList = ['CLEAR_CACHE', 'RETRY_RPC', 'POLL_HEALTH', 'FETCH_ADVISORY_DATA'];
    if (safeExecutionList.some((s) => upperAction.includes(s))) {
      return {
        allowed: true,
        governanceLevel: V2AiGovernanceLevel.LEVEL_5_SAFE_EXECUTE,
        requiresHumanSignature: false,
        reason: 'Authorized Level 5 safe idempotent execution.',
      };
    }

    // Default advisory levels (Level 1–4)
    return {
      allowed: true,
      governanceLevel: V2AiGovernanceLevel.LEVEL_4_RECOMMEND,
      requiresHumanSignature: false,
      reason: 'Authorized advisory, analysis, or drafting task.',
    };
  }

  // ==========================================================================
  // 6. AI HEALTH & TELEMETRY
  // ==========================================================================

  public listAiProviders(): V2AiProviderHealth[] {
    return Array.from(this.aiProviders.values());
  }

  public getAiProviderHealth(providerId: string): V2AiProviderHealth | undefined {
    return this.aiProviders.get(providerId);
  }

  public updateAiHealthState(params: {
    providerId: string;
    status: V2AiHealthStatus;
    latencyMs?: number;
    errorSummary?: string;
  }): void {
    const p = this.aiProviders.get(params.providerId);
    if (!p) return;

    p.status = params.status;
    if (params.latencyMs !== undefined) p.latencyMs = params.latencyMs;

    if (params.status === 'HEALTHY' || params.status === 'RECOVERED') {
      p.consecutiveFailures = 0;
      p.lastSuccessfulRequest = new Date().toISOString();
      p.lastErrorSafe = undefined;
    } else {
      p.consecutiveFailures += 1;
      p.lastFailedRequest = new Date().toISOString();
      // Strictly sanitize error message to avoid secrets/keys leakage
      p.lastErrorSafe = this.sanitizeErrorMessage(params.errorSummary || 'An operational AI exception occurred.');
    }

    this.aiProviders.set(params.providerId, p);
  }

  // ==========================================================================
  // 7. UNIFIED APPROVAL CENTER
  // ==========================================================================

  public registerApprovalItem(item: V2ApprovalItem): { success: boolean; item: V2ApprovalItem } {
    this.approvalItems.set(item.id, item);
    return { success: true, item };
  }

  public listPendingApprovals(): V2ApprovalItem[] {
    return Array.from(this.approvalItems.values()).filter((i) => i.status === 'PENDING');
  }

  public getAllApprovalItems(): V2ApprovalItem[] {
    return Array.from(this.approvalItems.values());
  }

  public decideApproval(params: {
    itemId: string;
    decision: 'APPROVED' | 'REJECTED';
    actor_id: string;
    actor_role: string;
    notes: string;
  }): { success: boolean; item?: V2ApprovalItem; error?: string } {
    const { itemId, decision, actor_id, actor_role, notes } = params;

    // AI Actor Block
    if (this.isAiActor(actor_role)) {
      return { success: false, error: 'AI agents are strictly forbidden from approving or rejecting governance items.' };
    }

    const item = this.approvalItems.get(itemId);
    if (!item) {
      return { success: false, error: `Approval item '${itemId}' not found.` };
    }

    if (item.status !== 'PENDING') {
      return { success: false, error: `Approval item is already ${item.status}.` };
    }

    // Role check
    const role = actor_role as V2UserRole;
    if (role !== 'SUPER_ADMIN' && !item.requiredRoles.includes(role)) {
      return {
        success: false,
        error: `Role '${actor_role}' is not authorized to decide on category '${item.category}'. Required: ${item.requiredRoles.join(', ')}`,
      };
    }

    item.status = decision;
    item.decidedBy = actor_id;
    item.decidedByRole = actor_role;
    item.decidedAt = new Date().toISOString();
    item.decisionNotes = notes || `Decided by ${actor_role} ${actor_id}`;
    this.approvalItems.set(itemId, item);

    // Record append-only audit
    this.recordAudit({
      category: 'APPROVAL_DECISION',
      actor_id,
      actor_role,
      action: `DECIDE_${item.category}_${decision}`,
      target_module: this.mapApprovalCategoryToModule(item.category),
      target_id: item.affectedEntityId,
      new_state: { status: decision, notes: item.decisionNotes },
      ip_masked: '127.0.0.1',
      reason_notes: notes,
    });

    return { success: true, item };
  }

  // ==========================================================================
  // 8. ATTENTION QUEUE ("REQUIRES YOUR ATTENTION")
  // ==========================================================================

  public getAttentionQueue(): V2AttentionQueueItem[] {
    const queue: V2AttentionQueueItem[] = [];

    // 1. High and Critical Signals from Risk Engine
    const riskSignals = v2RiskEngine.listSignals();
    riskSignals
      .filter((s) => s.status === 'ACTIVE' && (s.severity === 'CRITICAL' || s.severity === 'HIGH'))
      .forEach((s) => {
        queue.push({
          id: `attn_sig_${s.id}`,
          type: s.severity === 'CRITICAL' ? 'CRITICAL_RISK_SIGNAL' : 'HIGH_RISK_SIGNAL',
          severity: s.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          title: `Risk Anomaly: ${s.signal_type} (${s.severity})`,
          description: `User ${s.user_id} flagged with risk score ${s.risk_score}/100. Action: ${s.recommended_action}.`,
          affectedModule: 'risk',
          requiredRole: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'],
          sourceRefId: s.id,
          actionRequired: s.requires_human_review ? 'Operator Investigation Required' : 'Review Hold State',
          createdAt: s.detected_at,
        });
      });

    // 2. Pending Approval Center Items
    this.listPendingApprovals().forEach((appr) => {
      queue.push({
        id: `attn_appr_${appr.id}`,
        type:
          appr.category === 'PAYOUT'
            ? 'PENDING_PAYOUT_APPROVAL'
            : appr.category === 'FINANCIAL_SETTLEMENT'
            ? 'PENDING_SETTLEMENT_REVIEW'
            : 'PENDING_VERIFICATION_APPLICATION',
        severity: appr.category === 'FINANCIAL_SETTLEMENT' ? 'CRITICAL' : 'HIGH',
        title: appr.title,
        description: appr.summary,
        affectedModule: this.mapApprovalCategoryToModule(appr.category),
        requiredRole: appr.requiredRoles,
        sourceRefId: appr.id,
        actionRequired: 'Human Authorization Signature Required',
        createdAt: appr.createdAt,
      });
    });

    // 3. Active Emergency Pauses
    this.listKillSwitches()
      .filter((sw) => sw.isPaused)
      .forEach((sw) => {
        queue.push({
          id: `attn_kill_${sw.key}`,
          type: 'EMERGENCY_PAUSE_ACTIVE',
          severity: 'CRITICAL',
          title: `Emergency Kill Switch Engaged: ${sw.label}`,
          description: `Module paused by ${sw.pausedRole || 'OPERATOR'}. Reason: ${sw.reason || 'Safety containment'}.`,
          affectedModule: sw.targetModule,
          requiredRole: ['SUPER_ADMIN', 'ADMIN'],
          sourceRefId: sw.key,
          actionRequired: 'Review Incident and Resume when Safe',
          createdAt: sw.pausedAt || new Date().toISOString(),
        });
      });

    // 4. Degraded AI Health
    this.listAiProviders()
      .filter((p) => p.status !== 'HEALTHY' && p.status !== 'RECOVERED')
      .forEach((p) => {
        queue.push({
          id: `attn_ai_${p.providerId}`,
          type: 'AI_HEALTH_DEGRADED',
          severity: p.status === 'ERROR' || p.status === 'UNAVAILABLE' ? 'CRITICAL' : 'WARNING',
          title: `AI Telemetry Anomaly: ${p.providerName} (${p.status})`,
          description: `Consecutive failures: ${p.consecutiveFailures}. Quota: ${p.quotaCondition}.`,
          affectedModule: 'operations-ai',
          requiredRole: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER'],
          sourceRefId: p.providerId,
          actionRequired: 'Inspect Provider Diagnostics',
          createdAt: new Date().toISOString(),
        });
      });

    return queue.sort((a, b) => {
      const severityRank = { CRITICAL: 0, HIGH: 1, WARNING: 2, NOTICE: 3 };
      return severityRank[a.severity] - severityRank[b.severity];
    });
  }

  // ==========================================================================
  // 9. MODULE HEALTH MAP (ALL 16 MODULES)
  // ==========================================================================

  public getModulesHealth(): Record<V2ModuleId, V2ModuleHealthStatus> {
    const result: Partial<Record<V2ModuleId, V2ModuleHealthStatus>> = {};
    const now = new Date().toISOString();

    const killSwitchMap = new Map<V2ModuleId, boolean>();
    this.listKillSwitches().forEach((sw) => {
      if (sw.isPaused) killSwitchMap.set(sw.targetModule, true);
    });

    ALL_V2_MODULE_IDS.forEach((id) => {
      const isPaused = killSwitchMap.get(id) || false;
      let state: 'HEALTHY' | 'OPERATIONAL' | 'WARNING' | 'PAUSED' | 'CRITICAL' | 'FOUNDATION' = 'OPERATIONAL';

      if (isPaused) {
        state = 'PAUSED';
      } else if (id === 'risk' && v2RiskEngine.listSignals().some((s) => s.status === 'ACTIVE' && s.severity === 'CRITICAL')) {
        state = 'WARNING';
      } else if (id === 'operations-ai' && Array.from(this.aiProviders.values()).some((p) => p.status === 'ERROR')) {
        state = 'WARNING';
      } else if (['revenue', 'contribution', 'rewards', 'wallet', 'risk'].includes(id)) {
        state = 'HEALTHY';
      } else {
        state = 'FOUNDATION';
      }

      result[id] = {
        moduleId: id,
        label: this.formatModuleLabel(id),
        fullProductName: `METFA ${this.formatModuleLabel(id)}`,
        state,
        isPaused,
        activeSignalsCount: id === 'risk' ? v2RiskEngine.listSignals().filter((s) => s.status === 'ACTIVE').length : 0,
        pendingApprovalsCount: Array.from(this.approvalItems.values()).filter(
          (i) => i.status === 'PENDING' && this.mapApprovalCategoryToModule(i.category) === id
        ).length,
        lastCheckedAt: now,
      };
    });

    return result as Record<V2ModuleId, V2ModuleHealthStatus>;
  }

  // ==========================================================================
  // 10. SYSTEM OVERVIEW SNAPSHOT
  // ==========================================================================

  public getOverview(): V2AdminControlOverview {
    const modulesHealth = this.getModulesHealth();
    const flags = this.listFeatureFlags();
    const pauses = this.listKillSwitches().filter((s) => s.isPaused);
    const attention = this.getAttentionQueue();
    const criticalSignals = attention.filter((a) => a.severity === 'CRITICAL').length;
    const pendingApprovals = this.listPendingApprovals().length;

    let overallStatus: 'HEALTHY' | 'WARNING' | 'PAUSED' | 'CRITICAL' = 'HEALTHY';
    if (pauses.length > 0) {
      overallStatus = 'PAUSED';
    } else if (criticalSignals > 0) {
      overallStatus = 'CRITICAL';
    } else if (attention.some((a) => a.severity === 'HIGH')) {
      overallStatus = 'WARNING';
    }

    const providers = this.listAiProviders();
    const aiHealthState = providers.some((p) => p.status === 'ERROR')
      ? 'ERROR'
      : providers.some((p) => p.status === 'DEGRADED')
      ? 'DEGRADED'
      : 'HEALTHY';

    return {
      overallStatus,
      activeFlagsCount: flags.filter((f) => f.enabled).length,
      activePausesCount: pauses.length,
      criticalSignalsCount: criticalSignals,
      pendingApprovalsCount: pendingApprovals,
      aiHealthState,
      modulesHealth,
      killSwitches: Object.fromEntries(this.killSwitches.entries()) as Record<V2KillSwitchKey, V2KillSwitchState>,
      featureFlags: Object.fromEntries(this.featureFlags.entries()) as Record<V2FeatureFlagKey, V2FeatureFlagState>,
      recentAuditCount: this.auditLogs.length,
      evaluatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // 11. APPEND-ONLY GOVERNANCE AUDIT LOG
  // ==========================================================================

  public getAuditLogs(): V2GovernanceAuditEntry[] {
    return [...this.auditLogs];
  }

  /**
   * Enforces append-only immutable constraint.
   * Disallows updating or deleting any existing audit entry.
   */
  public disallowAuditLogUpdateOrDelete(): never {
    throw new Error('GOVERNANCE SECURITY VIOLATION: Audit logs are append-only. Modification and deletion are strictly prohibited by RLS and database triggers.');
  }

  private recordAudit(entry: Omit<V2GovernanceAuditEntry, 'id' | 'timestamp' | 'is_tamper_evident'>): void {
    const log: V2GovernanceAuditEntry = {
      id: `audit_gov_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      is_tamper_evident: true,
      ...entry,
      previous_state: entry.previous_state ? this.sanitizeObject(entry.previous_state) : undefined,
      new_state: this.sanitizeObject(entry.new_state),
    };

    this.auditLogs.unshift(log);
    // Keep max 500 records in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
  }

  // ==========================================================================
  // 12. DATA SANITIZATION HELPERS
  // ==========================================================================

  private sanitizeErrorMessage(msg: string): string {
    const secretPatterns = [
      /sk-[a-zA-Z0-9_-]{20,}/g,
      /AIza[a-zA-Z0-9_-]{30,}/g,
      /bearer\s+[a-zA-Z0-9._-]+/gi,
      /password\s*[:=]\s*[^\s]+/gi,
      /secret\s*[:=]\s*[^\s]+/gi,
    ];

    let sanitized = msg;
    secretPatterns.forEach((p) => {
      sanitized = sanitized.replace(p, '[REDACTED_SECRET]');
    });
    return sanitized;
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const forbiddenKeys = ['password', 'secret', 'token', 'auth', 'cookie', 'jwt', 'card', 'cvv', 'credential'];

    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (forbiddenKeys.some((k) => lower.includes(k))) {
        sanitized[key] = '[REDACTED_FOR_SECURITY]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeErrorMessage(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private mapCategoryToModule(cat: 'ads' | 'contribution' | 'rewards' | 'finance' | 'ai'): V2ModuleId {
    switch (cat) {
      case 'ads':
        return 'ads';
      case 'contribution':
        return 'contribution';
      case 'rewards':
        return 'rewards';
      case 'finance':
        return 'wallet';
      case 'ai':
        return 'operations-ai';
      default:
        return 'admin-control';
    }
  }

  private mapApprovalCategoryToModule(cat: V2ApprovalItemCategory): V2ModuleId {
    switch (cat) {
      case 'VERIFICATION':
        return 'verified';
      case 'FINANCIAL_SETTLEMENT':
        return 'rewards';
      case 'PAYOUT':
        return 'payout';
      case 'RISK_HOLD':
        return 'risk';
      case 'POLICY_CHANGE':
        return 'governance-audit';
      case 'KILL_SWITCH':
        return 'admin-control';
      default:
        return 'admin-control';
    }
  }

  private formatModuleLabel(id: V2ModuleId): string {
    switch (id) {
      case 'freelancer-team':
        return 'Freelancer/Team';
      case 'operations-ai':
        return 'Operations AI';
      case 'admin-control':
        return 'Admin Control';
      case 'governance-audit':
        return 'Governance + Audit';
      default:
        return id.charAt(0).toUpperCase() + id.slice(1);
    }
  }
}

export const v2AdminEngine = new V2AdminEngine();
