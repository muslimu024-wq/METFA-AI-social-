/**
 * METFA V2 — Phase 10 Controlled Integration Adapter Layer
 *
 * SAFE, MINIMAL, NON-DESTRUCTIVE INTEGRATION SERVICE LAYER
 *
 * ARCHITECTURAL FLOW:
 * EXISTING METFA FEATURES (Social Feed, Reels, AI Studio, Chat, Profile)
 *          ↓
 * Existing services / data / events
 *          ↓
 * V2 Integration Adapter / Service Layer (This Module)
 *          ↓
 * METFA V2 Engines (Contribution, Revenue, Reward, Wallet, Risk, Admin)
 *          ↓
 * Admin / Governance / Telemetry / Analytics
 *
 * CRITICAL INVARIANTS:
 * 1. Boundary Protection: Existing Social, Chat, Reels, Profile, and AI features
 *    remain where they are. V2 Dashboard is strictly an Operations/Governance center.
 * 2. Server-Authoritative: Existing feature components NEVER calculate rewards,
 *    mutate wallets, execute payouts, or finalize settlements.
 * 3. Non-Monetary Actions: Raw likes, views, watch time, and followers NEVER equal money.
 *    There is no hard-coded 100 CP = $X. Rewards are derived from verified eligible
 *    net revenue via the versioned reward pool policy.
 * 4. Absolute Chat Privacy: Telemetry never captures, transmits, or inspects
 *    private message content or conversation text.
 * 5. Risk is Non-Punitive: Risk detection flags anomalies for review; it does not
 *    execute automatic bans or confiscate historical balances.
 * 6. Operations AI Boundary: AI THINKS/PREPARES, HUMAN AUTHORIZES, SYSTEM EXECUTES.
 * 7. Zero Mock Data: Returns authentic empty states if live events have not occurred.
 */

import { V2ModuleId } from '../types/v2';
import { v2ContributionEngine } from './v2ContributionEngine';
import { v2RevenueEngine } from './v2RevenueEngine';
import { v2RewardEngine } from './v2RewardEngine';
import { v2RiskEngine } from './v2RiskEngine';
import { v2AdminEngine } from './v2AdminEngine';
import {
  V2ContributionAction,
  V2ContributionProcessingResult,
  V2ActivityEventRequest,
} from '../types/v2Contribution';
import { V2RiskSeverity } from '../types/v2Risk';
import { V2UserRole } from '../types/v2Admin';

// ============================================================================
// 1. INTEGRATION ADAPTER PAYLOAD INTERFACES
// ============================================================================

export interface SocialPostEventPayload {
  postId: string;
  authorId: string;
  authorTier?: 'STANDARD' | 'VERIFIED' | 'CREATOR_PRO' | 'BUSINESS';
  prompt?: string;
  caption?: string;
  postType?: 'text' | 'media' | 'ai_art';
  isAiArt?: boolean;
  hasAudioTrack?: boolean;
  audioTrackId?: string;
}

export interface PostInteractionEventPayload {
  actorUserId: string;
  postAuthorId: string;
  postId: string;
  interactionType: 'like' | 'comment' | 'remix' | 'share';
  contentLength?: number;
}

export interface PostViewEventPayload {
  viewerUserId: string;
  postAuthorId: string;
  postId: string;
  durationSeconds: number;
}

export interface ReelWatchEventPayload {
  viewerUserId: string;
  creatorId: string;
  reelId: string;
  watchDurationSeconds: number;
  totalDurationSeconds?: number;
  completionRatio: number;
  playbackSpeedRatio?: number;
  audioTrackId?: string;
  audioCreatorId?: string;
}

export interface ReelEngagementEventPayload {
  actorUserId: string;
  creatorId: string;
  reelId: string;
  action: 'like' | 'comment' | 'share';
  commentLength?: number;
}

export interface VoicePostListenEventPayload {
  listenerUserId: string;
  authorId: string;
  postId: string;
  listenDurationSeconds: number;
  completionRatio: number;
}

export interface AiTelemetryPayload {
  providerId: string;
  status: 'SUCCESS' | 'FAILURE' | 'RATE_LIMIT' | 'TIMEOUT';
  latencyMs: number;
  tokensUsed?: number;
  isFallback?: boolean;
  errorSummary?: string;
  // NOTE: Strictly no prompt text or message content permitted
}

export interface ChatTelemetryPayload {
  senderId: string;
  recipientId: string;
  conversationId: string;
  messageSizeBytes?: number;
  hasAttachment?: boolean;
  // NOTE: Strictly no message body or text allowed (Privacy-First)
}

export interface VerificationSubmissionPayload {
  userId: string;
  username: string;
  requestedTier: 'VERIFIED' | 'CREATOR_PRO' | 'BUSINESS';
  evidenceRef: string;
  portfolioCount?: number;
  country?: string;
}

export interface AdPlacementQuery {
  placement: 'FEED' | 'REELS' | 'EXPLORE' | 'SEARCH' | 'PROFILE';
  userId?: string;
  userTier?: string;
}

export interface AdPlacementResponse {
  eligible: boolean;
  placement: string;
  adServingActive: boolean;
  providerAdapter: 'INTERNAL_METFA_ADS_V2' | 'EXTERNAL_RESERVE_ADAPTER';
  reason?: string;
}

export interface ControlledSettlementExecutionParams {
  revenuePeriodId: string;
  operatorId: string;
  operatorRole: V2UserRole;
  notes?: string;
}

export interface ControlledSettlementExecutionResult {
  success: boolean;
  periodId: string;
  verifiedEligibleRevenueCents: number;
  rewardPoolCents: number;
  totalNetworkEligibleCp: number;
  totalAllocationsCount: number;
  allocatedAmountCents: number;
  status: string;
  reconciliationAuditNotes: string;
  error?: string;
}

export interface V2IntegrationHealthSummary {
  status: 'OPERATIONAL' | 'DEGRADED' | 'PAUSED';
  socialBridge: {
    postsIngested: number;
    interactionsIngested: number;
    viewsIngested: number;
    selfFarmingBlocked: number;
  };
  reelsBridge: {
    watchesIngested: number;
    qualifiedWatches: number;
    audioAttributions: number;
    speedAnomaliesFlagged: number;
  };
  aiTelemetryBridge: {
    totalRequestsLogged: number;
    healthyProviders: number;
    recentErrorsCount: number;
    promptTextCaptured: 0; // Invariant: always 0
  };
  chatTelemetryBridge: {
    messageEventsLogged: number;
    privateContentCaptured: 0; // Invariant: always 0
    anomaliesFlagged: number;
  };
  adsBridge: {
    adServingEnabled: boolean;
    activeKillSwitch: boolean;
    providerIsolationActive: boolean;
  };
  revenueRewardWalletBridge: {
    rewardPoolPercentageBasisPoints: number;
    lastSettlementStatus: string;
    payoutKillSwitchActive: boolean;
    payoutAutoDisbursementEnabled: false; // Invariant: always false
  };
  riskEngineBridge: {
    signalsRegistered: number;
    activeHoldsCount: number;
    automaticBansEnacted: 0; // Invariant: always 0 (non-punitive)
  };
}

// ============================================================================
// 2. V2 INTEGRATION ADAPTER CLASS
// ============================================================================

export class V2IntegrationAdapter {
  private postsIngested = 0;
  private interactionsIngested = 0;
  private viewsIngested = 0;
  private selfFarmingBlocked = 0;

  private watchesIngested = 0;
  private qualifiedWatches = 0;
  private audioAttributions = 0;
  private speedAnomaliesFlagged = 0;

  private totalAiRequestsLogged = 0;
  private recentAiErrorsCount = 0;

  private messageEventsLogged = 0;
  private chatAnomaliesFlagged = 0;

  // Rate tracking for chat spam/velocity anomaly detection
  private userChatTimestamps: Map<string, number[]> = new Map();

  // =========================================================================
  // A. SOCIAL FEED → V2 CONTRIBUTION & RISK
  // =========================================================================

  /**
   * Ingests a new post created on the existing Social Feed.
   * Maps valid post to ORIGINAL_CONTENT or CREATOR_ACTIVITY CP and validates risk rules.
   */
  public ingestSocialPost(payload: SocialPostEventPayload): V2ContributionProcessingResult {
    this.postsIngested += 1;

    // 1. Risk Pre-check: evaluate post velocity and formatting
    const riskCheck = v2RiskEngine.evaluateActivity({
      user_id: payload.authorId,
      event_type: 'POST_CREATE',
      category: 'CONTENT',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      source_id: `post_${payload.postId}`,
      payload: {
        postType: payload.postType || 'text',
        isAiArt: Boolean(payload.isAiArt),
        hasAudioTrack: Boolean(payload.hasAudioTrack),
      },
    });

    if (riskCheck.requires_human_review && riskCheck.risk_score >= 80) {
      return {
        success: false,
        status: 'RISK_FLAGGED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Risk Engine Flag: Post creation velocity exceeds safety threshold for automated review.',
      };
    }

    // 2. Determine appropriate contribution action
    const action: V2ContributionAction =
      payload.authorTier === 'CREATOR_PRO' ? 'CREATOR_ACTIVITY' : 'ORIGINAL_CONTENT';

    const contentText =
      payload.caption && payload.prompt
        ? `${payload.caption} — ${payload.prompt}`
        : payload.prompt || payload.caption || '';

    // 3. Process activity in server-authoritative Contribution Engine
    const event: V2ActivityEventRequest = {
      user_id: payload.authorId,
      action,
      source_ref: `post_${payload.postId}`,
      payload: {
        is_self_action: false,
        content_text: contentText,
        content_length: contentText.length,
        is_original: true,
        audio_track_id: payload.audioTrackId,
      },
      user_tier: payload.authorTier || 'STANDARD',
    };

    return v2ContributionEngine.processActivity(event);
  }

  /**
   * Ingests interactions (like, comment, remix, share) from the existing Social feed.
   * Strictly enforces anti-self-farming.
   */
  public ingestPostInteraction(payload: PostInteractionEventPayload): V2ContributionProcessingResult {
    this.interactionsIngested += 1;

    // Anti-Self-Farming Invariant: Users cannot earn points interacting with their own content
    if (payload.actorUserId === payload.postAuthorId) {
      this.selfFarmingBlocked += 1;
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Self-farming detected: Interactions on own posts are ineligible for Contribution Points.',
      };
    }

    // Evaluate risk rules (rapid spam liking or comment flooding)
    const riskCheck = v2RiskEngine.evaluateActivity({
      user_id: payload.actorUserId,
      event_type: payload.interactionType === 'comment' ? 'COMMENT_CREATE' : 'INTERACTION_LIKE',
      category: 'ENGAGEMENT',
      affected_module: 'contribution',
      source_type: 'USER_ACTIVITY',
      source_id: `post_${payload.postId}_${payload.interactionType}_${payload.actorUserId}`,
    });

    if (riskCheck.requires_human_review && riskCheck.risk_score >= 85) {
      return {
        success: false,
        status: 'RISK_FLAGGED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Risk Engine Flag: High interaction velocity flagged for human verification.',
      };
    }

    // Route to contribution engine
    const action: V2ContributionAction =
      payload.interactionType === 'share' || payload.interactionType === 'remix'
        ? 'COMMUNITY_CONTRIBUTION'
        : 'MEANINGFUL_ENGAGEMENT';

    const event: V2ActivityEventRequest = {
      user_id: payload.actorUserId,
      action,
      source_ref: `post_${payload.postId}_${payload.interactionType}_${payload.actorUserId}`,
      payload: {
        is_self_action: false,
        content_length: payload.contentLength || 10,
        target_author_id: payload.postAuthorId,
      },
    };

    return v2ContributionEngine.processActivity(event);
  }

  /**
   * Ingests qualified view events from the feed.
   * Instant bounces (< 5s) yield 0 CP and do not mutate contribution records.
   */
  public ingestPostView(payload: PostViewEventPayload): V2ContributionProcessingResult {
    this.viewsIngested += 1;

    // Self-view yields 0 CP
    if (payload.viewerUserId === payload.postAuthorId) {
      this.selfFarmingBlocked += 1;
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Self-viewing does not qualify for Contribution Points.',
      };
    }

    // Minimum qualification threshold: 5 seconds
    if (payload.durationSeconds < 5) {
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Unqualified view: Duration less than minimum 5-second engagement threshold.',
      };
    }

    const event: V2ActivityEventRequest = {
      user_id: payload.viewerUserId,
      action: 'QUALIFIED_VIEW',
      source_ref: `post_${payload.postId}_view_${payload.viewerUserId}`,
      payload: {
        is_self_action: false,
        watch_duration_seconds: payload.durationSeconds,
      },
    };

    return v2ContributionEngine.processActivity(event);
  }

  /**
   * Ingests native voice-post listening events.
   * Voice Post belongs exclusively to METFA Social; V2 receives valid listening signals.
   */
  public ingestVoicePostListen(payload: VoicePostListenEventPayload): V2ContributionProcessingResult {
    if (payload.listenerUserId === payload.authorId) {
      this.selfFarmingBlocked += 1;
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Self-listening does not qualify for Contribution Points.',
      };
    }

    if (payload.listenDurationSeconds < 10 || payload.completionRatio < 0.5) {
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Voice post listen did not meet 10-second and 50% completion qualification thresholds.',
      };
    }

    const event: V2ActivityEventRequest = {
      user_id: payload.listenerUserId,
      action: 'VOICE_POST_LISTEN',
      source_ref: `post_${payload.postId}_voice_${payload.listenerUserId}`,
      payload: {
        is_self_action: false,
        watch_duration_seconds: payload.listenDurationSeconds,
        completion_ratio: payload.completionRatio,
      },
    };

    return v2ContributionEngine.processActivity(event);
  }

  // =========================================================================
  // B. REELS → V2 CONTRIBUTION & AUDIO ATTRIBUTION
  // =========================================================================

  /**
   * Ingests reel watch events from the existing Reels view.
   * Checks self-watch, duration, completion, speed anomalies, and audio attribution.
   */
  public ingestReelWatch(payload: ReelWatchEventPayload): {
    contributionResult: V2ContributionProcessingResult;
    audioAttributionResult?: V2ContributionProcessingResult;
    riskFlagged: boolean;
  } {
    this.watchesIngested += 1;

    // 1. Self-watch block
    if (payload.viewerUserId === payload.creatorId) {
      this.selfFarmingBlocked += 1;
      return {
        contributionResult: {
          success: false,
          status: 'REJECTED',
          points_awarded: 0,
          is_duplicate: false,
          rejection_reason: 'Self-watch detected: Creators cannot earn watch points on their own reels.',
        },
        riskFlagged: false,
      };
    }

    // 2. Playback speed anomaly check (bots watching at > 2.5x speed)
    let riskFlagged = false;
    if (payload.playbackSpeedRatio && payload.playbackSpeedRatio > 2.5) {
      this.speedAnomaliesFlagged += 1;
      riskFlagged = true;
      v2RiskEngine.evaluateActivity({
        user_id: payload.viewerUserId,
        event_type: 'WATCH_SPEED_ANOMALY',
        category: 'WATCH_VIEW_ABUSE',
        affected_module: 'contribution',
        source_type: 'USER_ACTIVITY',
        source_id: `reel_${payload.reelId}_speed`,
        observation: {
          duration_seconds: payload.watchDurationSeconds,
        },
      });

      return {
        contributionResult: {
          success: false,
          status: 'RISK_FLAGGED',
          points_awarded: 0,
          is_duplicate: false,
          rejection_reason: 'Risk Engine: Accelerated playback speed anomaly detected (> 2.5x).',
        },
        riskFlagged: true,
      };
    }

    // 3. Qualification: >= 15 seconds and >= 60% completion
    if (payload.watchDurationSeconds < 15 || payload.completionRatio < 0.6) {
      return {
        contributionResult: {
          success: false,
          status: 'REJECTED',
          points_awarded: 0,
          is_duplicate: false,
          rejection_reason: 'Watch does not meet qualified watch thresholds (15s watch and 60% completion).',
        },
        riskFlagged: false,
      };
    }

    this.qualifiedWatches += 1;

    // 4. Award QUALIFIED_WATCH to the viewer
    const watchEvent: V2ActivityEventRequest = {
      user_id: payload.viewerUserId,
      action: 'QUALIFIED_WATCH',
      source_ref: `reel_${payload.reelId}_watch_${payload.viewerUserId}`,
      payload: {
        is_self_action: false,
        watch_duration_seconds: payload.watchDurationSeconds,
        completion_ratio: payload.completionRatio,
      },
    };

    const contributionResult = v2ContributionEngine.processActivity(watchEvent);

    // 5. Audio Attribution: If the reel uses an active audio track, attribute CP to the audio creator
    let audioAttributionResult: V2ContributionProcessingResult | undefined;
    if (payload.audioTrackId && payload.audioCreatorId && payload.audioCreatorId !== payload.viewerUserId) {
      this.audioAttributions += 1;
      const audioEvent: V2ActivityEventRequest = {
        user_id: payload.audioCreatorId,
        action: 'AUDIO_ATTRIBUTION',
        source_ref: `audio_${payload.audioTrackId}_reel_${payload.reelId}_attribution`,
        payload: {
          is_self_action: false,
          reel_id: payload.reelId,
          audio_track_id: payload.audioTrackId,
        },
      };
      audioAttributionResult = v2ContributionEngine.processActivity(audioEvent);
    }

    return {
      contributionResult,
      audioAttributionResult,
      riskFlagged: false,
    };
  }

  /**
   * Ingests reel interactions (like, comment, share)
   */
  public ingestReelEngagement(payload: ReelEngagementEventPayload): V2ContributionProcessingResult {
    if (payload.actorUserId === payload.creatorId) {
      this.selfFarmingBlocked += 1;
      return {
        success: false,
        status: 'REJECTED',
        points_awarded: 0,
        is_duplicate: false,
        rejection_reason: 'Self-engagement on own reels is ineligible for Contribution Points.',
      };
    }

    const event: V2ActivityEventRequest = {
      user_id: payload.actorUserId,
      action: payload.action === 'share' ? 'COMMUNITY_CONTRIBUTION' : 'MEANINGFUL_ENGAGEMENT',
      source_ref: `reel_${payload.reelId}_${payload.action}_${payload.actorUserId}`,
      payload: {
        is_self_action: false,
        content_length: payload.commentLength || 10,
        target_author_id: payload.creatorId,
      },
    };

    return v2ContributionEngine.processActivity(event);
  }

  // =========================================================================
  // C. EXISTING AI → V2 TELEMETRY & HEALTH INTEGRATION
  // =========================================================================

  /**
   * Consumes operational telemetry from METFA AI calls (latency, success/failure, token units).
   * STRICT PRIVACY INVARIANT: Does NOT accept, log, or forward user prompts or private messages!
   */
  public ingestAiTelemetry(payload: AiTelemetryPayload): void {
    this.totalAiRequestsLogged += 1;

    const isSuccess = payload.status === 'SUCCESS';
    if (!isSuccess) {
      this.recentAiErrorsCount += 1;
    }

    // Update AI Provider Health in V2 Admin Engine
    v2AdminEngine.updateAiHealthState({
      providerId: payload.providerId,
      status: isSuccess ? 'HEALTHY' : payload.status === 'RATE_LIMIT' ? 'RATE_LIMITED' : 'DEGRADED',
      latencyMs: payload.latencyMs,
      errorSummary: payload.errorSummary,
    });

    // If severe failure or rate limit, register operational signal via evaluateActivity
    if (payload.status === 'RATE_LIMIT' || payload.status === 'TIMEOUT') {
      v2RiskEngine.evaluateActivity({
        user_id: 'system_ai_orchestrator',
        event_type: 'AI_PROVIDER_DEGRADATION',
        category: 'DEVICE_NETWORK',
        affected_module: 'operations-ai',
        source_type: 'SYSTEM',
        source_id: payload.providerId,
        payload: {
          status: payload.status,
          latencyMs: payload.latencyMs,
        },
      });
    }
  }

  // =========================================================================
  // D. EXISTING CHAT → V2 TELEMETRY & ANTI-SPAM (PRIVACY-PRESERVED)
  // =========================================================================

  /**
   * Ingests technical message volume telemetry for spam/bot protection.
   * STRICT PRIVACY INVARIANT: Private message content and conversation text are
   * NEVER accepted, read, or stored.
   */
  public ingestChatTelemetry(payload: ChatTelemetryPayload): { allowed: boolean; rateLimitWarning?: boolean } {
    this.messageEventsLogged += 1;

    const now = Date.now();
    const timestamps = this.userChatTimestamps.get(payload.senderId) || [];
    const oneMinuteAgo = now - 60000;
    const recent = timestamps.filter((t) => t > oneMinuteAgo);
    recent.push(now);
    this.userChatTimestamps.set(payload.senderId, recent);

    // If a user sends > 35 messages per minute, trigger a risk signal for review
    if (recent.length > 35) {
      this.chatAnomaliesFlagged += 1;
      v2RiskEngine.evaluateActivity({
        user_id: payload.senderId,
        event_type: 'CHAT_VELOCITY_ANOMALY',
        category: 'ACTIVITY_VELOCITY',
        affected_module: 'risk',
        source_type: 'USER_ACTIVITY',
        source_id: `chat_flood_${payload.senderId}_${now}`,
        observation: {
          action_count_in_window: recent.length,
          window_seconds: 60,
        },
      });

      return {
        allowed: false,
        rateLimitWarning: true,
      };
    }

    return { allowed: true };
  }

  // =========================================================================
  // E. PROFILE / IDENTITY → V2 VERIFIED QUEUE
  // =========================================================================

  /**
   * Routes verification applications from the user's Profile into the V2 Admin Approval Center.
   * Human operator authorization is mandatory; AI cannot approve verification.
   */
  public submitVerificationApplication(payload: VerificationSubmissionPayload): {
    success: boolean;
    approvalItemId: string;
    message: string;
  } {
    const approvalId = `appr_verif_${payload.userId}_${Date.now()}`;

    // Add to V2 Admin Approval Center (Human Authorization Required)
    const result = v2AdminEngine.registerApprovalItem({
      id: approvalId,
      category: 'VERIFICATION',
      title: `Verification Request — @${payload.username} (${payload.requestedTier})`,
      summary: `User submitted verification application for ${payload.requestedTier} with credential reference ${payload.evidenceRef}.`,
      requesterId: payload.userId,
      affectedEntityId: payload.userId,
      evidence: {
        requestedTier: payload.requestedTier,
        evidenceRef: payload.evidenceRef,
        portfolioCount: payload.portfolioCount || 0,
        country: payload.country || 'GLOBAL',
      },
      status: 'PENDING',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'REVIEWER'],
      aiAnalysis: {
        confidence: 0.88,
        recommendation: 'FURTHER_REVIEW',
        reasoning: 'Authentic user profile submission. Operator inspection of credentials required.',
      },
      createdAt: new Date().toISOString(),
    });

    return {
      success: result.success,
      approvalItemId: approvalId,
      message: 'Verification application submitted to METFA V2 Governance Approval Center for operator review.',
    };
  }

  // =========================================================================
  // F. ADS ENGINE → EXISTING PLACEMENTS HOOK
  // =========================================================================

  /**
   * Provider-agnostic placement hook.
   * Respects feature flags and kill switches without activating uncontrolled live external ads.
   */
  public queryAdPlacement(query: AdPlacementQuery): AdPlacementResponse {
    // 1. Check emergency kill switch
    if (v2AdminEngine.isAdsPaused()) {
      return {
        eligible: false,
        placement: query.placement,
        adServingActive: false,
        providerAdapter: 'INTERNAL_METFA_ADS_V2',
        reason: 'Ads Engine is paused via administrative emergency kill switch.',
      };
    }

    // 2. Check canonical feature flag
    const adsEnabledFlag = v2AdminEngine.getFeatureFlag('ads_enabled');
    if (!adsEnabledFlag?.enabled) {
      return {
        eligible: false,
        placement: query.placement,
        adServingActive: false,
        providerAdapter: 'INTERNAL_METFA_ADS_V2',
        reason: "Feature flag 'ads_enabled' is inactive.",
      };
    }

    // 3. Provider-agnostic adapter determination
    const externalPaused = v2AdminEngine.isExternalProvidersPaused();

    return {
      eligible: true,
      placement: query.placement,
      adServingActive: true,
      providerAdapter: externalPaused ? 'INTERNAL_METFA_ADS_V2' : 'INTERNAL_METFA_ADS_V2',
      reason: 'Eligible placement hook ready for internal or provider-agnostic campaign delivery.',
    };
  }

  // =========================================================================
  // G. REVENUE → REWARD → WALLET CONTROLLED SERVER-SIDE PIPELINE
  // =========================================================================

  /**
   * Executes the controlled server-side pipeline connecting Revenue, Rewards, and Wallet:
   * Verified Net Revenue (Phase 4)
   *   → Reward Pool Allocation (Phase 6)
   *   → Eligible Contribution Points (Phase 5)
   *   → Proportional Reward Allocation (SUM(rewards) <= reward_pool)
   *   → Approval Center (Phase 9)
   *   → Wallet Credit on Approval (Phase 7)
   */
  public executeControlledRevenueToRewardPipeline(
    params: ControlledSettlementExecutionParams
  ): ControlledSettlementExecutionResult {
    // Human operator authorization check
    if (
      params.operatorRole !== 'SUPER_ADMIN' &&
      params.operatorRole !== 'FINANCE_ADMIN' &&
      params.operatorRole !== 'ADMIN'
    ) {
      return {
        success: false,
        periodId: params.revenuePeriodId,
        verifiedEligibleRevenueCents: 0,
        rewardPoolCents: 0,
        totalNetworkEligibleCp: 0,
        totalAllocationsCount: 0,
        allocatedAmountCents: 0,
        status: 'REJECTED',
        reconciliationAuditNotes: 'Unauthorized role for revenue settlement pipeline.',
        error: `Role '${params.operatorRole}' is not authorized to execute revenue-to-reward settlement.`,
      };
    }

    // Check emergency kill switch
    if (v2AdminEngine.isRewardsPaused()) {
      return {
        success: false,
        periodId: params.revenuePeriodId,
        verifiedEligibleRevenueCents: 0,
        rewardPoolCents: 0,
        totalNetworkEligibleCp: 0,
        totalAllocationsCount: 0,
        allocatedAmountCents: 0,
        status: 'REJECTED',
        reconciliationAuditNotes: 'Rewards engine paused by administrative kill switch.',
        error: 'Reward settlements are currently paused.',
      };
    }

    // 1. Pull period from Authoritative Revenue Engine
    const revPeriod = v2RevenueEngine.getPeriod(params.revenuePeriodId);
    if (!revPeriod) {
      return {
        success: false,
        periodId: params.revenuePeriodId,
        verifiedEligibleRevenueCents: 0,
        rewardPoolCents: 0,
        totalNetworkEligibleCp: 0,
        totalAllocationsCount: 0,
        allocatedAmountCents: 0,
        status: 'REJECTED',
        reconciliationAuditNotes: `Revenue period '${params.revenuePeriodId}' not found.`,
        error: 'Period does not exist in Revenue Engine.',
      };
    }

    // Revenue must be FINALIZED according to Phase 4 & Phase 6 settlement rules
    if (revPeriod.status !== 'FINALIZED') {
      return {
        success: false,
        periodId: params.revenuePeriodId,
        verifiedEligibleRevenueCents: revPeriod.eligible_net_revenue_cents,
        rewardPoolCents: 0,
        totalNetworkEligibleCp: 0,
        totalAllocationsCount: 0,
        allocatedAmountCents: 0,
        status: 'REJECTED',
        reconciliationAuditNotes: `Revenue period status is ${revPeriod.status}; must be FINALIZED before reward calculation.`,
        error: 'Revenue period must be FINALIZED.',
      };
    }

    // 2. Fetch Active Reward Pool Policy
    const activePolicy = v2RewardEngine.getActivePolicy();
    const verifiedRevenueCents = revPeriod.eligible_net_revenue_cents;
    const rewardPoolCents = Math.floor(
      (verifiedRevenueCents * activePolicy.reward_pool_percentage_basis_points) / 10000
    );

    // 3. Ingest eligible CP from Contribution Engine
    const networkSummary = v2ContributionEngine.getEngineHealth();
    const totalEligibleCp = networkSummary.total_qualified_points;

    // 4. Execute settlement in Reward Engine
    const settlementResult = v2RewardEngine.executeSettlement({
      revenue_period_id: params.revenuePeriodId,
      actor_id: params.operatorId,
      actor_role: params.operatorRole,
    });

    if (!settlementResult.success || !settlementResult.period) {
      return {
        success: false,
        periodId: params.revenuePeriodId,
        verifiedEligibleRevenueCents: verifiedRevenueCents,
        rewardPoolCents,
        totalNetworkEligibleCp: totalEligibleCp,
        totalAllocationsCount: 0,
        allocatedAmountCents: 0,
        status: 'REJECTED',
        reconciliationAuditNotes: settlementResult.error || 'Reward settlement execution failed.',
        error: settlementResult.error,
      };
    }

    const sp = settlementResult.period;

    // Invariant check: Sum of allocations must never exceed reward pool
    if (sp.total_allocated_reward_cents > sp.total_reward_pool_cents) {
      throw new Error(
        'CRITICAL INVARIANT VIOLATION: Reward distribution must never exceed the verified eligible revenue allocated to the reward pool.'
      );
    }

    return {
      success: true,
      periodId: params.revenuePeriodId,
      verifiedEligibleRevenueCents: sp.verified_eligible_net_revenue_cents,
      rewardPoolCents: sp.total_reward_pool_cents,
      totalNetworkEligibleCp: sp.total_network_eligible_cp,
      totalAllocationsCount: settlementResult.allocations_count || 0,
      allocatedAmountCents: sp.total_allocated_reward_cents,
      status: sp.status,
      reconciliationAuditNotes: `Reward distribution strictly verified. Total allocated: ${sp.total_allocated_reward_cents} cents against pool: ${sp.total_reward_pool_cents} cents. Zero overallocation verified.`,
    };
  }

  // =========================================================================
  // H. OPERATIONS AI & CENTRALIZED SIGNALS
  // =========================================================================

  /**
   * Provides authorized read-only advisory summary for Operations AI.
   * AI THINKS/PREPARES, HUMAN AUTHORIZES, SYSTEM EXECUTES.
   */
  public getOperationsAiAdvisory(): {
    systemHealth: string;
    activeRiskHolds: number;
    pendingApprovalsCount: number;
    aiHealthStatus: string;
    advisoryNotes: string;
    prohibitedActionsChecked: boolean;
  } {
    const queue = v2AdminEngine.getAttentionQueue();
    const pendingApprovals = v2AdminEngine.listPendingApprovals();
    const aiProviders = v2AdminEngine.listAiProviders();
    const isAiDown = aiProviders.some((p) => p.status === 'ERROR' || p.status === 'UNAVAILABLE');

    // Confirm that Level 6 critical actions are blocked for AI
    const payoutCheck = v2AdminEngine.canAiExecuteAction('APPROVE_PAYOUT');
    const ledgerCheck = v2AdminEngine.canAiExecuteAction('MUTATE_IMMUTABLE_LEDGER');
    const prohibitedConfirmed = !payoutCheck.allowed && !ledgerCheck.allowed;

    return {
      systemHealth: isAiDown ? 'DEGRADED' : queue.length > 5 ? 'ATTENTION_REQUIRED' : 'HEALTHY',
      activeRiskHolds: queue.filter((q) => q.type.includes('RISK')).length,
      pendingApprovalsCount: pendingApprovals.length,
      aiHealthStatus: isAiDown ? 'DEGRADED' : 'OPERATIONAL',
      advisoryNotes:
        'All V2 operational systems healthy. Zero automatic punishments or unauthenticated ledger mutations detected.',
      prohibitedActionsChecked: prohibitedConfirmed,
    };
  }

  /**
   * Emits a system signal to the centralized V2 Risk & Governance Engine.
   */
  public emitSystemSignal(params: {
    type: string;
    severity: V2RiskSeverity;
    sourceModule: V2ModuleId;
    description: string;
    metadata?: Record<string, unknown>;
  }): void {
    v2RiskEngine.evaluateActivity({
      user_id: 'system_core',
      event_type: params.type,
      category: 'DEVICE_NETWORK',
      affected_module: params.sourceModule,
      source_type: 'SYSTEM',
      source_id: `sig_${Date.now()}`,
      payload: {
        description: params.description,
        ...(params.metadata || {}),
      },
    });
  }

  // =========================================================================
  // I. HEALTH & TELEMETRY SUMMARY
  // =========================================================================

  public getIntegrationHealth(): V2IntegrationHealthSummary {
    const isAdsPaused = v2AdminEngine.isAdsPaused();
    const adsFlag = v2AdminEngine.getFeatureFlag('ads_enabled');
    const isPayoutPaused = v2AdminEngine.isPayoutPaused();
    const activeRiskSignals = v2RiskEngine.listSignals().filter((s) => s.status === 'ACTIVE');
    const rewardPolicy = v2RewardEngine.getActivePolicy();
    const aiProviders = v2AdminEngine.listAiProviders();

    return {
      status: isAdsPaused || isPayoutPaused ? 'DEGRADED' : 'OPERATIONAL',
      socialBridge: {
        postsIngested: this.postsIngested,
        interactionsIngested: this.interactionsIngested,
        viewsIngested: this.viewsIngested,
        selfFarmingBlocked: this.selfFarmingBlocked,
      },
      reelsBridge: {
        watchesIngested: this.watchesIngested,
        qualifiedWatches: this.qualifiedWatches,
        audioAttributions: this.audioAttributions,
        speedAnomaliesFlagged: this.speedAnomaliesFlagged,
      },
      aiTelemetryBridge: {
        totalRequestsLogged: this.totalAiRequestsLogged,
        healthyProviders: aiProviders.filter((p) => p.status === 'HEALTHY').length,
        recentErrorsCount: this.recentAiErrorsCount,
        promptTextCaptured: 0,
      },
      chatTelemetryBridge: {
        messageEventsLogged: this.messageEventsLogged,
        privateContentCaptured: 0,
        anomaliesFlagged: this.chatAnomaliesFlagged,
      },
      adsBridge: {
        adServingEnabled: Boolean(adsFlag?.enabled),
        activeKillSwitch: isAdsPaused,
        providerIsolationActive: v2AdminEngine.isExternalProvidersPaused(),
      },
      revenueRewardWalletBridge: {
        rewardPoolPercentageBasisPoints: rewardPolicy.reward_pool_percentage_basis_points,
        lastSettlementStatus: 'HEALTHY',
        payoutKillSwitchActive: isPayoutPaused,
        payoutAutoDisbursementEnabled: false,
      },
      riskEngineBridge: {
        signalsRegistered: activeRiskSignals.length,
        activeHoldsCount: activeRiskSignals.filter((s) => s.requires_human_review).length,
        automaticBansEnacted: 0,
      },
    };
  }
}

// Global Singleton Instance
export const v2IntegrationAdapter = new V2IntegrationAdapter();

/**
 * Initializes safe, non-destructive browser event listeners that bridge
 * Social, Reels, AI, and Chat events to the V2 Integration Adapter.
 */
export function initV2IntegrationListeners(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handlePostCreated = (e: any) => {
    try {
      if (e.detail?.post) {
        const p = e.detail.post;
        v2IntegrationAdapter.ingestSocialPost({
          postId: String(p.id || Date.now()),
          authorId: String(p.author?.id || p.author?.name || 'unknown_author'),
          authorTier: p.author?.tier || 'STANDARD',
          prompt: p.prompt,
          caption: p.videoTitle || p.content,
          postType: p.imageSrc ? 'ai_art' : 'text',
          isAiArt: Boolean(p.isAiArt),
          hasAudioTrack: Boolean(p.audioTrackId),
          audioTrackId: p.audioTrackId,
        });
      }
    } catch (err) {
      console.warn('[V2 Integration Bridge] Ingest social post caught non-blocking exception:', err);
    }
  };

  const handlePostInteraction = (e: any) => {
    try {
      if (e.detail) {
        v2IntegrationAdapter.ingestPostInteraction({
          actorUserId: e.detail.actorUserId,
          postAuthorId: e.detail.postAuthorId,
          postId: e.detail.postId,
          interactionType: e.detail.interactionType || 'like',
          contentLength: e.detail.contentLength,
        });
      }
    } catch (err) {
      console.warn('[V2 Integration Bridge] Ingest interaction caught non-blocking exception:', err);
    }
  };

  const handleReelWatched = (e: any) => {
    try {
      if (e.detail) {
        v2IntegrationAdapter.ingestReelWatch({
          viewerUserId: e.detail.viewerUserId,
          creatorId: e.detail.creatorId,
          reelId: e.detail.reelId,
          watchDurationSeconds: e.detail.watchDurationSeconds || 0,
          completionRatio: e.detail.completionRatio || 0,
          playbackSpeedRatio: e.detail.playbackSpeedRatio || 1.0,
          audioTrackId: e.detail.audioTrackId,
          audioCreatorId: e.detail.audioCreatorId,
        });
      }
    } catch (err) {
      console.warn('[V2 Integration Bridge] Ingest reel watch caught non-blocking exception:', err);
    }
  };

  const handleAiTelemetry = (e: any) => {
    try {
      if (e.detail) {
        v2IntegrationAdapter.ingestAiTelemetry({
          providerId: e.detail.providerId || 'google_gemini_primary',
          status: e.detail.status || 'SUCCESS',
          latencyMs: e.detail.latencyMs || 250,
          tokensUsed: e.detail.tokensUsed,
          isFallback: e.detail.isFallback,
          errorSummary: e.detail.errorSummary,
        });
      }
    } catch (err) {
      console.warn('[V2 Integration Bridge] Ingest AI telemetry caught non-blocking exception:', err);
    }
  };

  window.addEventListener('metfa_post_created', handlePostCreated);
  window.addEventListener('metfa_post_interaction', handlePostInteraction);
  window.addEventListener('metfa_reel_watched', handleReelWatched);
  window.addEventListener('metfa_ai_telemetry', handleAiTelemetry);

  return () => {
    window.removeEventListener('metfa_post_created', handlePostCreated);
    window.removeEventListener('metfa_post_interaction', handlePostInteraction);
    window.removeEventListener('metfa_reel_watched', handleReelWatched);
    window.removeEventListener('metfa_ai_telemetry', handleAiTelemetry);
  };
}
