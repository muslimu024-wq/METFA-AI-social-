/**
 * METFA V2 — Core Contribution Engine
 * 
 * CORE RULES:
 * 1. Contribution Points (CP) are NOT money.
 *    No conversions, no payout rates, no monetary balances here.
 * 2. Server-Authoritative: The client NEVER dictates CP, quality score, or eligibility.
 * 3. Immutable Append-Only Ledger: Historical entries are never updated or deleted.
 * 4. Multi-Stage Qualification Pipeline:
 *    Raw Activity -> Validation -> Eligibility -> Quality Check -> Idempotency -> Policy -> Daily Limit -> Cooldown -> Risk Signals -> Immutable Ledger
 * 5. Reversal / Adjustment: When transactions are refunded or invalidated, create linked reversal entries.
 * 6. Feature Flag: 'contribution_enabled' toggles engine processing.
 * 7. AI Boundary: METFA AI can review patterns and advise, but CANNOT award, modify, or fabricate CP.
 */

import {
  V2ContributionAction,
  V2ContributionEntryType,
  V2ContributionLedgerRecord,
  V2ContributionPolicyRecord,
  V2ContributionProcessingResult,
  V2ContributionUserSummary,
  V2ContributionEngineHealth,
  V2ActivityEventRequest,
} from '../types/v2Contribution';

export class V2ContributionEngine {
  // In-memory data store adhering strictly to v2_contribution_policies and v2_contribution_ledger
  private policies: Map<string, V2ContributionPolicyRecord[]> = new Map(); // action -> versioned policies
  private ledger: Map<string, V2ContributionLedgerRecord> = new Map(); // entry_id -> record
  private idempotencyIndex: Map<string, string> = new Map(); // idempotency_key -> entry_id
  private userLastActionTimestamp: Map<string, number> = new Map(); // `${user_id}:${action}` -> timestamp ms
  private featureFlagEnabled: boolean = true; // Controlled by 'contribution_enabled'

  constructor() {
    this.seedDefaultPolicies();
  }

  // =========================================================================
  // 1. DEFAULT VERSIONED POLICIES
  // =========================================================================
  private seedDefaultPolicies(): void {
    const defaultList: Omit<V2ContributionPolicyRecord, 'id' | 'created_at'>[] = [
      {
        action: 'ORIGINAL_CONTENT',
        version: 1,
        base_points: 25,
        quality_multiplier_max: 2.0,
        daily_limit_points: 150,
        cooldown_seconds: 300, // 5 minutes between posts
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.8,
        configuration: { min_content_length: 20 },
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'QUALIFIED_VIEW',
        version: 1,
        base_points: 1,
        quality_multiplier_max: 1.0,
        daily_limit_points: 50,
        cooldown_seconds: 15,
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.5,
        configuration: { min_view_duration_seconds: 5 },
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'QUALIFIED_WATCH',
        version: 1,
        base_points: 5,
        quality_multiplier_max: 2.0,
        daily_limit_points: 100,
        cooldown_seconds: 30,
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.6,
        configuration: { min_watch_duration_seconds: 15, min_completion_ratio: 0.6 },
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'MEANINGFUL_ENGAGEMENT',
        version: 1,
        base_points: 3,
        quality_multiplier_max: 1.5,
        daily_limit_points: 60,
        cooldown_seconds: 20,
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.7,
        configuration: { min_content_length: 5 },
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'COMMUNITY_CONTRIBUTION',
        version: 1,
        base_points: 20,
        quality_multiplier_max: 2.0,
        daily_limit_points: 100,
        cooldown_seconds: 180,
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.5,
        configuration: {},
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'VERIFIED_ACTIVITY',
        version: 1,
        base_points: 15,
        quality_multiplier_max: 1.5,
        daily_limit_points: 75,
        cooldown_seconds: 60,
        eligibility_tier_required: 'VERIFIED',
        fraud_weight: 0.3,
        configuration: {},
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'MARKETPLACE_CONTRIBUTION',
        version: 1,
        base_points: 50,
        quality_multiplier_max: 1.5,
        daily_limit_points: 250,
        cooldown_seconds: 300,
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.9,
        configuration: { require_verified_transaction: true },
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'BUSINESS_ACTIVITY',
        version: 1,
        base_points: 40,
        quality_multiplier_max: 1.5,
        daily_limit_points: 200,
        cooldown_seconds: 300,
        eligibility_tier_required: 'BUSINESS',
        fraud_weight: 0.6,
        configuration: {},
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'AUDIO_USAGE',
        version: 1,
        base_points: 10,
        quality_multiplier_max: 1.5,
        daily_limit_points: 50,
        cooldown_seconds: 120,
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.5,
        configuration: { require_audio_license_verified: true },
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'AUDIO_ATTRIBUTION',
        version: 1,
        base_points: 10,
        quality_multiplier_max: 1.2,
        daily_limit_points: 50,
        cooldown_seconds: 120,
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.4,
        configuration: {},
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'VOICE_POST_LISTEN',
        version: 1,
        base_points: 4,
        quality_multiplier_max: 1.5,
        daily_limit_points: 40,
        cooldown_seconds: 60,
        eligibility_tier_required: 'STANDARD',
        fraud_weight: 0.5,
        configuration: { min_watch_duration_seconds: 10, min_completion_ratio: 0.5 },
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
      {
        action: 'CREATOR_ACTIVITY',
        version: 1,
        base_points: 30,
        quality_multiplier_max: 2.0,
        daily_limit_points: 150,
        cooldown_seconds: 300,
        eligibility_tier_required: 'CREATOR_PRO',
        fraud_weight: 0.4,
        configuration: {},
        status: 'ACTIVE',
        effective_from: '2026-01-01T00:00:00.000Z',
      },
    ];

    for (const p of defaultList) {
      this.registerPolicy({
        ...p,
        id: `pol_${p.action.toLowerCase()}_v${p.version}`,
        created_at: new Date().toISOString(),
      });
    }
  }

  // =========================================================================
  // 2. FEATURE FLAG MANAGEMENT
  // =========================================================================
  public setContributionEnabled(enabled: boolean): void {
    this.featureFlagEnabled = enabled;
  }

  public isContributionEnabled(): boolean {
    return this.featureFlagEnabled;
  }

  // =========================================================================
  // 3. POLICY VERSIONING & REGISTRATION
  // =========================================================================
  public registerPolicy(policy: V2ContributionPolicyRecord): void {
    const list = this.policies.get(policy.action) || [];
    // If registering a new ACTIVE version, mark previous active ones as SUPERSEDED/DEPRECATED
    if (policy.status === 'ACTIVE') {
      for (const existing of list) {
        if (existing.status === 'ACTIVE') {
          existing.status = 'DEPRECATED';
        }
      }
    }
    list.push(policy);
    this.policies.set(policy.action, list);
  }

  public getActivePolicy(action: V2ContributionAction): V2ContributionPolicyRecord | null {
    const list = this.policies.get(action);
    if (!list || list.length === 0) return null;
    const now = new Date().toISOString();
    const active = list.find((p) => {
      if (p.status !== 'ACTIVE') return false;
      if (p.effective_from > now) return false;
      if (p.effective_until && p.effective_until < now) return false;
      return true;
    });
    return active || null;
  }

  public listPolicies(): V2ContributionPolicyRecord[] {
    const all: V2ContributionPolicyRecord[] = [];
    for (const list of this.policies.values()) {
      all.push(...list);
    }
    return all;
  }

  // =========================================================================
  // 4. MAIN CONTRIBUTION PROCESSING PIPELINE
  // =========================================================================
  public processActivity(event: V2ActivityEventRequest): V2ContributionProcessingResult {
    // Stage 1: Feature Flag Check
    if (!this.featureFlagEnabled) {
      return {
        success: false,
        status: 'DISABLED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: "Feature flag 'contribution_enabled' is inactive. Contributions paused.",
      };
    }

    const { user_id, action, source_ref, payload } = event;

    // Stage 2: Basic Input & Self-Farming Validation
    if (!user_id || !action || !source_ref) {
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Missing required activity parameters: user_id, action, or source_ref.',
      };
    }

    if (payload?.is_self_action) {
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Self-farming detected: Users cannot earn contribution points on their own content/actions.',
      };
    }

    // Stage 3: Idempotency Check
    const idempotencyKey = `${user_id}:${action}:${source_ref}`;
    if (this.idempotencyIndex.has(idempotencyKey)) {
      const existingId = this.idempotencyIndex.get(idempotencyKey)!;
      const existingEntry = this.ledger.get(existingId);
      return {
        success: true,
        status: 'DUPLICATE',
        entry: existingEntry,
        points_awarded: existingEntry?.final_points || 0,
        is_duplicate: true,
      };
    }

    // Stage 4: Policy Resolution
    const policy = this.getActivePolicy(action);
    if (!policy) {
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: `No active policy configured for action '${action}'.`,
      };
    }

    // Stage 5: User Tier Eligibility Check
    const userTier = event.user_tier || 'STANDARD';
    if (!this.isTierEligible(userTier, policy.eligibility_tier_required)) {
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: `User tier '${userTier}' does not meet required tier '${policy.eligibility_tier_required}'.`,
      };
    }

    // Stage 6: Cooldown Check
    const cooldownKey = `${user_id}:${action}`;
    const lastTimestamp = this.userLastActionTimestamp.get(cooldownKey) || 0;
    const now = Date.now();
    const elapsedSeconds = (now - lastTimestamp) / 1000;
    if (elapsedSeconds < policy.cooldown_seconds) {
      return {
        success: false,
        status: 'COOLDOWN',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: `Cooldown active: Must wait ${Math.ceil(policy.cooldown_seconds - elapsedSeconds)}s before next '${action}'.`,
      };
    }

    // Stage 7: Daily Limit Check
    const todayPoints = this.calculateUserDailyPointsForAction(user_id, action);
    if (todayPoints >= policy.daily_limit_points) {
      return {
        success: false,
        status: 'RATE_LIMITED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: `Daily limit of ${policy.daily_limit_points} CP reached for '${action}'.`,
      };
    }

    // Stage 8: Quality & Qualification Verification
    const qualification = this.evaluateQualification(action, policy, payload);
    if (!qualification.isQualified) {
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: qualification.reason || 'Activity failed quality qualification threshold.',
      };
    }

    // Stage 9: Calculate Server-Authoritative Points
    // CP = floor(base_points * quality_multiplier)
    // Capped by remaining daily limit
    const rawCalculatedPoints = Math.floor(policy.base_points * qualification.qualityMultiplier);
    const availablePointsRoom = Math.max(0, policy.daily_limit_points - todayPoints);
    const finalPoints = Math.min(rawCalculatedPoints, availablePointsRoom);

    if (finalPoints <= 0) {
      return {
        success: false,
        status: 'RATE_LIMITED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Available daily points capacity exhausted.',
      };
    }

    // Stage 10: Risk Assessment Signal
    const riskScore = qualification.riskScore;
    const riskFlags = qualification.riskFlags;
    const status = riskScore > 75 ? 'FLAGGED_RISK' : 'QUALIFIED';

    // Stage 11: Append to Immutable Ledger
    const entryId = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const ledgerEntry: V2ContributionLedgerRecord = {
      id: entryId,
      user_id,
      action,
      policy_id: policy.id,
      policy_version: policy.version,
      entry_type: 'AWARD',
      base_points: policy.base_points,
      quality_multiplier: qualification.qualityMultiplier,
      final_points: finalPoints,
      source_ref,
      risk_score: riskScore,
      risk_flags: riskFlags,
      status,
      metadata: {
        payload_summary: payload || {},
        qualification_reason: qualification.reason || 'Passed quality verification',
      },
      created_at: new Date().toISOString(),
    };

    this.ledger.set(entryId, ledgerEntry);
    this.idempotencyIndex.set(idempotencyKey, entryId);
    this.userLastActionTimestamp.set(cooldownKey, now);

    return {
      success: true,
      status: 'QUALIFIED',
      entry: { ...ledgerEntry },
      points_awarded: finalPoints,
      is_duplicate: false,
    };
  }

  // =========================================================================
  // 5. QUALIFICATION ENGINE
  // =========================================================================
  private evaluateQualification(
    action: V2ContributionAction,
    policy: V2ContributionPolicyRecord,
    payload?: V2ActivityEventRequest['payload']
  ): { isQualified: boolean; qualityMultiplier: number; riskScore: number; riskFlags: string[]; reason?: string } {
    let qualityMultiplier = 1.0;
    let riskScore = 0;
    const riskFlags: string[] = [];

    switch (action) {
      case 'QUALIFIED_VIEW': {
        const viewDuration = payload?.watch_duration_seconds ?? 0;
        const minDuration = (policy.configuration.min_view_duration_seconds as number) || 5;
        if (viewDuration < minDuration) {
          return { isQualified: false, qualityMultiplier: 1.0, riskScore: 40, riskFlags: ['DURATION_TOO_SHORT'], reason: `View duration of ${viewDuration}s below threshold of ${minDuration}s.` };
        }
        break;
      }

      case 'QUALIFIED_WATCH':
      case 'VOICE_POST_LISTEN': {
        const watchDuration = payload?.watch_duration_seconds ?? 0;
        const completionRatio = payload?.completion_ratio ?? 0;
        const minDuration = (policy.configuration.min_watch_duration_seconds as number) || 15;
        const minRatio = (policy.configuration.min_completion_ratio as number) || 0.6;

        if (watchDuration < minDuration) {
          return { isQualified: false, qualityMultiplier: 1.0, riskScore: 50, riskFlags: ['WATCH_TIME_INSUFFICIENT'], reason: `Watch duration (${watchDuration}s) does not meet minimum policy requirement (${minDuration}s).` };
        }

        if (completionRatio < minRatio) {
          return { isQualified: false, qualityMultiplier: 1.0, riskScore: 45, riskFlags: ['COMPLETION_RATIO_LOW'], reason: `Completion ratio (${(completionRatio * 100).toFixed(0)}%) below minimum policy required (${(minRatio * 100).toFixed(0)}%).` };
        }

        // Quality multiplier scales with completion ratio up to policy max
        if (completionRatio >= 0.9) {
          qualityMultiplier = Math.min(policy.quality_multiplier_max, 1.8);
        } else if (completionRatio >= 0.75) {
          qualityMultiplier = Math.min(policy.quality_multiplier_max, 1.4);
        }
        break;
      }

      case 'ORIGINAL_CONTENT': {
        const text = payload?.content_text || '';
        const minLength = (policy.configuration.min_content_length as number) || 20;

        if (text.length < minLength) {
          return { isQualified: false, qualityMultiplier: 1.0, riskScore: 60, riskFlags: ['CONTENT_TOO_SHORT'], reason: `Original content length (${text.length} chars) below required threshold (${minLength} chars).` };
        }

        // Check for spam-like repeated characters or obvious artificial padding
        if (/(.)\1{6,}/.test(text)) {
          return { isQualified: false, qualityMultiplier: 1.0, riskScore: 85, riskFlags: ['SPAM_PATTERN'], reason: 'Content flagged for repetitive character sequences.' };
        }

        if (payload?.is_original) {
          qualityMultiplier = Math.min(policy.quality_multiplier_max, 1.5);
        }
        break;
      }

      case 'MEANINGFUL_ENGAGEMENT': {
        const text = payload?.content_text || '';
        const minLength = (policy.configuration.min_content_length as number) || 5;
        if (text.length < minLength) {
          return { isQualified: false, qualityMultiplier: 1.0, riskScore: 50, riskFlags: ['ENGAGEMENT_LOW_EFFORT'], reason: 'Engagement comment does not meet meaningful length standards.' };
        }
        break;
      }

      case 'MARKETPLACE_CONTRIBUTION': {
        const txStatus = payload?.transaction_status;
        if (policy.configuration.require_verified_transaction && txStatus !== 'COMPLETED') {
          return {
            isQualified: false,
            qualityMultiplier: 1.0,
            riskScore: 70,
            riskFlags: ['UNVERIFIED_TRANSACTION'],
            reason: `Marketplace contribution requires 'COMPLETED' transaction status. Received: '${txStatus || 'NONE'}'.`,
          };
        }
        qualityMultiplier = Math.min(policy.quality_multiplier_max, 1.25);
        break;
      }

      case 'AUDIO_USAGE':
      case 'AUDIO_ATTRIBUTION': {
        if (policy.configuration.require_audio_license_verified && !payload?.audio_attribution_valid) {
          return {
            isQualified: false,
            qualityMultiplier: 1.0,
            riskScore: 65,
            riskFlags: ['INVALID_AUDIO_ATTRIBUTION'],
            reason: 'Audio contribution requires valid attribution and license verification.',
          };
        }
        break;
      }

      default:
        qualityMultiplier = 1.0;
        break;
    }

    return {
      isQualified: true,
      qualityMultiplier: Number(qualityMultiplier.toFixed(2)),
      riskScore,
      riskFlags,
    };
  }

  // =========================================================================
  // 6. REVERSAL & ADJUSTMENT ENGINE (IMMUTABLE CORRECTIONS)
  // =========================================================================
  public reverseContribution(params: {
    original_entry_id: string;
    reason: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; reversal_entry?: V2ContributionLedgerRecord; error?: string } {
    // Role check: Only ADMIN / OPERATOR can authorize reversals
    const allowed = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'OPERATOR'];
    if (!allowed.includes(params.actor_role)) {
      return { success: false, error: `Unauthorized: Reversals require operator or admin role. Received '${params.actor_role}'.` };
    }

    const original = this.ledger.get(params.original_entry_id);
    if (!original) {
      return { success: false, error: `Original contribution entry '${params.original_entry_id}' not found.` };
    }

    if (original.entry_type === 'REVERSAL') {
      return { success: false, error: 'Cannot reverse an entry that is already a REVERSAL.' };
    }

    // Create append-only reversal entry (deducting final_points)
    const reversalId = `cp_rev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const reversalEntry: V2ContributionLedgerRecord = {
      id: reversalId,
      user_id: original.user_id,
      action: original.action,
      policy_id: original.policy_id,
      policy_version: original.policy_version,
      entry_type: 'REVERSAL',
      base_points: original.base_points,
      quality_multiplier: original.quality_multiplier,
      final_points: -Math.abs(original.final_points), // Negative CP correction
      source_ref: `reversal:${original.id}`,
      original_entry_id: original.id,
      risk_score: 0,
      status: 'QUALIFIED',
      metadata: {
        reason: params.reason,
        authorized_by: params.actor_id,
        reversed_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    };

    this.ledger.set(reversalId, reversalEntry);

    return { success: true, reversal_entry: { ...reversalEntry } };
  }

  // =========================================================================
  // 7. USER CONTRIBUTION SUMMARIES & AGGREGATIONS
  // =========================================================================
  public getUserSummary(userId: string): V2ContributionUserSummary {
    const userEntries = Array.from(this.ledger.values()).filter((e) => e.user_id === userId);

    let totalPoints = 0;
    let pointsToday = 0;
    const byAction: Record<string, number> = {};
    const todayStart = new Date().toISOString().substring(0, 10);
    let lastActivityAt: string | undefined = undefined;

    for (const e of userEntries) {
      if (e.status === 'QUALIFIED' || e.status === 'RECORDED') {
        totalPoints += e.final_points;
        byAction[e.action] = (byAction[e.action] || 0) + e.final_points;

        if (e.created_at.startsWith(todayStart)) {
          pointsToday += e.final_points;
        }

        if (!lastActivityAt || e.created_at > lastActivityAt) {
          lastActivityAt = e.created_at;
        }
      }
    }

    return {
      user_id: userId,
      total_qualified_points: Math.max(0, totalPoints),
      points_today: Math.max(0, pointsToday),
      by_action: byAction,
      entries_count: userEntries.length,
      last_activity_at: lastActivityAt,
    };
  }

  public listLedger(userId?: string): V2ContributionLedgerRecord[] {
    const entries = Array.from(this.ledger.values());
    const filtered = userId ? entries.filter((e) => e.user_id === userId) : entries;
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getEngineHealth(): V2ContributionEngineHealth {
    const activePolicies = this.listPolicies().filter((p) => p.status === 'ACTIVE').length;
    const allEntries = Array.from(this.ledger.values());
    const qualifiedPoints = allEntries
      .filter((e) => e.status === 'QUALIFIED')
      .reduce((sum, e) => sum + e.final_points, 0);
    const riskFlagsCount = allEntries.filter((e) => e.status === 'FLAGGED_RISK').length;

    return {
      status: !this.featureFlagEnabled ? 'PAUSED' : riskFlagsCount > 10 ? 'DEGRADED' : 'HEALTHY',
      feature_flag_enabled: this.featureFlagEnabled,
      active_policies_count: activePolicies,
      total_ledger_entries: allEntries.length,
      total_qualified_points: Math.max(0, qualifiedPoints),
      unresolved_risk_signals: riskFlagsCount,
    };
  }

  // =========================================================================
  // 8. PRIVATE UTILITIES
  // =========================================================================
  private isTierEligible(userTier: string, requiredTier: string): boolean {
    const ranks: Record<string, number> = {
      STANDARD: 1,
      VERIFIED: 2,
      CREATOR_PRO: 3,
      BUSINESS: 3,
    };
    const userRank = ranks[userTier] || 1;
    const reqRank = ranks[requiredTier] || 1;
    return userRank >= reqRank;
  }

  private calculateUserDailyPointsForAction(userId: string, action: V2ContributionAction): number {
    const today = new Date().toISOString().substring(0, 10);
    return Array.from(this.ledger.values())
      .filter(
        (e) =>
          e.user_id === userId &&
          e.action === action &&
          e.entry_type === 'AWARD' &&
          (e.status === 'QUALIFIED' || e.status === 'RECORDED') &&
          e.created_at.startsWith(today)
      )
      .reduce((sum, e) => sum + e.final_points, 0);
  }
}

// Global Server-Authoritative Singleton Instance
export const v2ContributionEngine = new V2ContributionEngine();
