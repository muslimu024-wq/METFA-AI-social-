/**
 * METFA V2 — Master Foundation Types & Interfaces
 *
 * Single Source of Truth for METFA V2:
 * - Module Registry & Navigation
 * - AI Health & Telemetry
 * - Operations AI & Orchestration
 * - Signal Architecture & Lifecycle
 * - Work, Task, Freelancer/Team & Review Engine
 * - Immutable Financial Ledgers (Revenue, Wallet, Payout)
 * - Dynamic Contribution Policies & Point Models
 * - Reward Settlements & Configurable Pools
 * - Risk & Fraud Engine
 * - Verification & Identity Tiers
 * - Audio Economy & Licensing
 * - Universal Sponsored Ads Provider Adapters
 * - Governance, Audit & Compliance
 *
 * STRICT PRODUCT RULES:
 * 1. Voice Post belongs exclusively to METFA Social as a native content type.
 *    METFA Audio in V2 handles audio economy, licensing, attribution, and analytics.
 * 2. Financial balances must NEVER be simple mutable client values.
 * 3. Human authorization is mandatory for all financial, credential, and verification mutations.
 * 4. Provider-agnostic adapters must isolate core logic from external networks.
 */

// ============================================================================
// 1. MODULE REGISTRY & APP GRID
// ============================================================================

/**
 * The 16 canonical V2 Module IDs
 */
export type V2ModuleId =
  | 'verified'
  | 'ads'
  | 'revenue'
  | 'contribution'
  | 'rewards'
  | 'risk'
  | 'wallet'
  | 'payout'
  | 'operations-ai'
  | 'signal'
  | 'work'
  | 'freelancer-team'
  | 'creator'
  | 'audio'
  | 'admin-control'
  | 'governance-audit';

/**
 * Exact short labels for the mobile-friendly App Grid (WITHOUT "METFA" prefix)
 */
export type V2AppGridLabel =
  | 'Verified'
  | 'Ads'
  | 'Revenue'
  | 'Contribution'
  | 'Rewards'
  | 'Risk'
  | 'Wallet'
  | 'Payout'
  | 'Operations AI'
  | 'Signal'
  | 'Work'
  | 'Freelancer/Team'
  | 'Creator'
  | 'Audio'
  | 'Admin Control'
  | 'Governance + Audit';

/**
 * Full internal product names used when a module is opened
 */
export type V2FullProductName =
  | 'METFA Verified'
  | 'METFA Ads'
  | 'METFA Revenue'
  | 'METFA Contribution'
  | 'METFA Rewards'
  | 'METFA Risk'
  | 'METFA Wallet'
  | 'METFA Payout'
  | 'METFA Operations AI'
  | 'METFA Signal'
  | 'METFA Work'
  | 'METFA Freelancer/Team'
  | 'METFA Creator'
  | 'METFA Audio'
  | 'METFA Admin Control'
  | 'METFA Governance + Audit';

export interface V2ModuleMetadata {
  id: V2ModuleId;
  shortLabel: V2AppGridLabel;
  fullProductName: V2FullProductName;
  iconName: string; // lucide icon identifier
  description: string;
  category: 'core' | 'finance' | 'operations' | 'creator' | 'governance';
  badge?: string;
  requiredRole?: 'user' | 'creator' | 'freelancer' | 'operator' | 'admin' | 'superadmin';
  isActive: boolean;
}

// ============================================================================
// 2. AI HEALTH & TELEMETRY FOUNDATION
// ============================================================================

export type AiHealthState =
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

export type AiProviderName = 'gemini' | 'openai' | 'xai_grok' | 'intelligent_core_engine' | 'custom_adapter';

export interface AiModelHealthSnapshot {
  provider: AiProviderName;
  model: string;
  state: AiHealthState;
  latencyMs: number;
  lastSuccessfulRequest?: string; // ISO 8601 string
  lastFailedRequest?: string;     // ISO 8601 string
  consecutiveFailures: number;
  quotaState: 'normal' | 'near_limit' | 'exceeded' | 'unknown';
  authenticationState: 'valid' | 'invalid' | 'missing' | 'expired';
  permissionState: 'granted' | 'restricted' | 'unknown';
  modelAvailability: boolean;
  fallbackUsageCount: number;
  lastErrorSummary?: string;      // Safe, non-sensitive summary (NO keys or tokens)
  recordedAt: string;
}

export interface AiHealthReport {
  overallState: AiHealthState;
  activeProvider: AiProviderName;
  activeModel: string;
  providers: Record<AiProviderName, {
    state: AiHealthState;
    availableModels: string[];
    primaryModel: string;
    models: Record<string, AiModelHealthSnapshot>;
  }>;
  evaluatedAt: string;
  unresolvedIssuesCount: number;
}

// ============================================================================
// 3. METFA OPERATIONS AI (ORCHESTRATION LAYER)
// ============================================================================

/**
 * Operations AI principle:
 * "AI does the thinking and preparation.
 *  Human does the authorization.
 *  System does the controlled execution."
 */
export interface OperationsAiContext {
  operatorId: string;
  authorizedScope: V2ModuleId[];
  timestamp: string;
}

export interface OperationsAiAnalysisRequest {
  targetType: 'signal' | 'task' | 'anomaly' | 'health' | 'audit' | 'contribution';
  targetId: string;
  evidencePayload: Record<string, unknown>;
  context: OperationsAiContext;
}

export interface OperationsAiRecommendation {
  id: string;
  summary: string;
  reasoning: string;
  riskAssessment: 'low' | 'medium' | 'high' | 'critical';
  proposedAction: {
    actionType: string;
    targetModule: V2ModuleId;
    parameters: Record<string, unknown>;
  };
  requiresHumanApproval: boolean;
  approvalRoleRequired: 'operator' | 'admin' | 'superadmin';
  draftTaskBrief?: string;
  createdAt: string;
}

// ============================================================================
// 4. METFA SIGNAL ARCHITECTURE
// ============================================================================

export type SignalSeverity = 'INFO' | 'NOTICE' | 'WARNING' | 'HIGH' | 'CRITICAL';

export type SignalStatus =
  | 'DETECTED'
  | 'AI_ANALYZED'
  | 'TASK_CREATED'
  | 'IN_PROGRESS'
  | 'PENDING_APPROVAL'
  | 'RESOLVED'
  | 'DISMISSED';

export interface MetfaSignal {
  id: string;
  title: string;
  whyDetected: string;
  severity: SignalSeverity;
  affectedModule: V2ModuleId;
  evidence: Record<string, unknown>; // Diagnostic logs, latencies, state keys (NO secrets)
  aiAnalysis?: {
    summary: string;
    rootCause: string;
    recommendedAction: string;
    confidenceScore: number;
    analyzedAt: string;
  };
  requiredApproval: 'none' | 'operator' | 'admin' | 'superadmin';
  status: SignalStatus;
  linkedTaskId?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

// ============================================================================
// 5. WORK & TASK MANAGEMENT FOUNDATION
// ============================================================================

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'AI_REVIEWED'
  | 'ADMIN_APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TaskDeliverable {
  id: string;
  title: string;
  description: string;
  fileUrl?: string;
  hashChecksum?: string;
  submittedAt?: string;
}

export interface TaskAssignment {
  assignedToId: string;
  assignedToName: string;
  assignmentType: 'individual' | 'team' | 'freelancer';
  assignedAt: string;
  acceptedAt?: string;
}

export interface MetfaTask {
  id: string;
  sourceSignalId?: string;
  affectedModule: V2ModuleId;
  title: string;
  description: string;
  aiBrief: {
    problemStatement: string;
    suggestedFix: string;
    safetyDirectives: string[];
    generatedAt: string;
  };
  requirements: string[];
  doNotChangeConstraints: string[];
  deliverables: TaskDeliverable[];
  acceptanceCriteria: string[];
  testRequirements: string[];
  priority: TaskPriority;
  deadline?: string;
  assignment?: TaskAssignment;
  status: TaskStatus;
  submissionNotes?: string;
  aiReview?: {
    checklistScore: number; // 0-100
    findings: string[];
    isApprovedByAi: boolean;
    reviewedAt: string;
  };
  adminApproval?: {
    approvedBy: string;
    approvedAt: string;
    decisionNotes: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 6. IMMUTABLE FINANCIAL LEDGER & REVENUE FOUNDATION
// ============================================================================

export type LedgerEntryType =
  | 'GROSS_REVENUE'
  | 'REFUND'
  | 'PAYMENT_FEE'
  | 'TAX_WITHHOLDING'
  | 'ELIGIBLE_COST'
  | 'NET_REVENUE_FINALIZED'
  | 'POOL_ALLOCATION'
  | 'REWARD_PENDING'
  | 'REWARD_APPROVED'
  | 'WALLET_CREDIT'
  | 'PAYOUT_INITIATED'
  | 'PAYOUT_SETTLED';

export interface LedgerEntry {
  id: string;
  ledgerType: 'REVENUE' | 'CONTRIBUTION' | 'REWARD' | 'WALLET' | 'PAYOUT';
  entryType: LedgerEntryType;
  amountCents: number; // Stored in cents/integer units to prevent floating-point drift
  currency: string;    // ISO 4217, e.g., 'USD', 'BDT'
  description: string;
  referenceId: string; // ID of external invoice, transaction, or settlement period
  metadata: Record<string, unknown>;
  isFinalized: boolean;
  finalizedAt?: string;
  createdAt: string;
}

/**
 * Admin Policy for Reward Pool configuration.
 * Hard-coding fixed revenue splits (e.g. 80/20, 75/25) is strictly forbidden.
 */
export interface RewardPoolPolicy {
  id: string;
  version: number;
  percentage: number; // e.g. 70.0% (validated between 0.00 and 100.00)
  minSettlementThresholdCents: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
  approvedByAdminId: string;
  approvedAt: string;
}

export interface RevenueCalculationCycle {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossRevenueCents: number;
  refundsCents: number;
  paymentFeesCents: number;
  taxesCents: number;
  eligibleCostsCents: number;
  eligibleNetRevenueCents: number;
  appliedPolicyVersion: number;
  rewardPoolCents: number;
  isSettled: boolean;
  settledAt?: string;
}

// ============================================================================
// 7. CONTRIBUTION FOUNDATION
// ============================================================================

export type ContributionActionType =
  | 'POST_ENGAGEMENT_QUALIFIED'
  | 'REEL_QUALIFIED_WATCH'
  | 'VOICE_POST_QUALIFIED_LISTEN' // Voice Post listening evaluated without replacing Social Voice Post
  | 'COMMUNITY_HELPFUL_ANSWER'
  | 'CREATIVE_PROMPT_REMIXED'
  | 'PAGE_VERIFIED_PUBLISH'
  | 'PEER_MODERATION_AUDIT';

export interface ContributionPolicy {
  id: string;
  action: ContributionActionType;
  basePoints: number;
  qualityMultiplierMax: number; // e.g., 2.5
  dailyLimitPoints: number;
  cooldownSeconds: number;
  eligibilityTierRequired: 'BASIC' | 'VERIFIED' | 'CREATOR_PRO';
  fraudWeight: number; // Weight factor in anomaly detection
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'ACTIVE' | 'PAUSED' | 'DEPRECATED';
}

export interface ContributionRecord {
  id: string;
  userId: string;
  action: ContributionActionType;
  basePoints: number;
  qualityScore: number; // 0.0 to 1.0
  finalPointsAwarded: number;
  evidenceRef: string; // e.g., 'post:123', 'listen:456'
  riskEvaluationId?: string;
  settlementPeriodId?: string;
  recordedAt: string;
}

// ============================================================================
// 8. REWARD SETTLEMENT & WALLET FOUNDATION
// ============================================================================

/**
 * Core Rule: METFA Social NEVER promises a fixed monetary reward for a specific action.
 * Rewards depend on verified eligible revenue, configurable policies, and finalized settlements.
 */
export interface RewardSettlementPeriod {
  id: string;
  cycleId: string;
  totalPoolCents: number;
  totalVerifiedContributionPoints: number;
  pointValueCents: number; // Calculated dynamically: totalPoolCents / totalVerifiedContributionPoints
  totalParticipants: number;
  status: 'CALCULATING' | 'AUDIT_REVIEW' | 'FINALIZED' | 'DISBURSED';
  auditSignedBy?: string;
  finalizedAt?: string;
}

export interface UserRewardAllocation {
  id: string;
  periodId: string;
  userId: string;
  totalQualifiedPoints: number;
  estimatedRewardCents: number;
  pendingRewardCents: number;
  approvedRewardCents: number;
  withdrawableBalanceCents: number;
  deductionsCents: number;
  deductionReason?: string;
  status: 'ESTIMATED' | 'PENDING' | 'APPROVED' | 'PAID' | 'REVOKED';
  createdAt: string;
}

export interface MetfaWallet {
  userId: string;
  currency: string;
  pendingRewardCents: number;
  approvedRewardCents: number;
  withdrawableBalanceCents: number;
  lifetimeEarningsCents: number;
  lifetimePaidOutCents: number;
  isLockedForAudit: boolean;
  lockReason?: string;
  lastUpdated: string;
}

export type PayoutStatus =
  | 'REQUESTED'
  | 'RISK_SCREENING'
  | 'ADMIN_REVIEW'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED';

export interface PayoutRequest {
  id: string;
  userId: string;
  amountCents: number;
  currency: string;
  payoutMethod: 'BANK_TRANSFER' | 'BKASH' | 'NAGAD' | 'STRIPE_CONNECT' | 'WISE';
  accountDetailsMasked: string; // Masked for security: '****1234'
  status: PayoutStatus;
  riskScore: number; // 0 to 100
  adminApprovalNotes?: string;
  approvedByAdminId?: string;
  transactionRef?: string;
  requestedAt: string;
  processedAt?: string;
}

// ============================================================================
// 9. RISK & FRAUD ENGINE
// ============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface DeviceRiskSignals {
  fingerprintHash: string;
  isEmulator: boolean;
  isRootedOrJailbroken: boolean;
  userAgent: string;
  clientTimezone: string;
}

export interface NetworkRiskSignals {
  ipAddressMasked: string;
  isVpn: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  countryCode: string;
}

export interface BehavioralRiskSignals {
  rapidActionVelocity: number; // Actions per minute
  duplicateFingerprintAccounts: number;
  botPatternScore: number; // 0.0 to 1.0
  unnaturalAudioLoopCount: number; // For Audio/Voice abuse detection
}

export interface RiskEvaluation {
  id: string;
  userId: string;
  entityType: 'USER' | 'PAYOUT' | 'CONTRIBUTION' | 'CONTENT';
  entityId: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0 - 100
  flaggedRules: string[];
  deviceSignals?: DeviceRiskSignals;
  networkSignals?: NetworkRiskSignals;
  behavioralSignals?: BehavioralRiskSignals;
  recommendedAction: 'ALLOW' | 'CHALLENGE_CAPTCHA' | 'HOLD_FOR_REVIEW' | 'BLOCK';
  isResolved: boolean;
  evaluatedAt: string;
}

// ============================================================================
// 10. VERIFICATION & IDENTITY TIERS
// ============================================================================

export type VerificationTier = 'STANDARD' | 'VERIFIED_CREATOR' | 'PARTNER' | 'BUSINESS' | 'OFFICIAL';

export interface VerificationApplication {
  id: string;
  userId: string;
  requestedTier: VerificationTier;
  legalFullName: string;
  country: string;
  idDocumentType: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVING_LICENSE' | 'BUSINESS_REGISTRATION';
  idDocumentHash: string; // Encrypted / Hashed storage reference
  portfolioLinks: string[];
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ADDITIONAL_INFO_REQUIRED' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  reviewedByAdminId?: string;
  submittedAt: string;
  reviewedAt?: string;
}

// ============================================================================
// 11. AUDIO ECONOMY & LICENSING (NON-SOCIAL VOICE POST)
// ============================================================================

export type AudioLicenseType =
  | 'CREATIVE_COMMONS_BY'
  | 'PLATFORM_FREE_USE'
  | 'COMMERCIAL_REV_SHARE'
  | 'EXCLUSIVE_CREATOR';

export interface AudioEconomyTrack {
  id: string;
  title: string;
  artistName: string;
  ownerUserId: string;
  licenseType: AudioLicenseType;
  creatorRevenueSplitPercentage: number; // e.g. 70.0%
  totalUsagesInReels: number;
  totalUsagesInVideos: number;
  totalQualifiedPlays: number;
  generatedAdPoolRevenueCents: number;
  copyrightClaimStatus: 'CLEAN' | 'FLAGGED' | 'DISPUTED' | 'DMCA_TAKEDOWN';
  registeredAt: string;
}

// ============================================================================
// 12. PROVIDER ADAPTER INTERFACES (UNIVERSAL SPONSORED ADS & AI)
// ============================================================================

export interface AdPlacementContext {
  slotId: string;
  placementType: 'FEED_NATIVE' | 'REEL_INTERSTITIAL' | 'BANNER_SLOT' | 'REWARDED_VIDEO';
  userId?: string;
  language: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export interface UniversalAdCreative {
  id: string;
  providerId: string;
  campaignId: string;
  title: string;
  sponsorName: string;
  sponsorLogoUrl?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  callToActionLabel: string;
  destinationUrl: string;
  badgeLabel: 'Sponsored' | 'Ad';
  impressionTrackingUrl?: string;
  clickTrackingUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Provider-Agnostic Ad Adapter Interface.
 * Any external or self-hosted ad network plugs into METFA Social through this contract.
 */
export interface AdProviderAdapter {
  providerId: string;
  providerName: string;
  initialize: (config: Record<string, unknown>) => Promise<boolean>;
  fetchAd: (context: AdPlacementContext) => Promise<UniversalAdCreative | null>;
  trackImpression: (adId: string) => Promise<void>;
  trackClick: (adId: string) => Promise<void>;
  checkHealth: () => Promise<{ isHealthy: boolean; latencyMs: number }>;
}

/**
 * Provider-Agnostic AI Adapter Interface.
 * Allows METFA Operations AI and Chat to interface with any model service.
 */
export interface AiProviderAdapter {
  providerName: AiProviderName;
  checkHealth: (model: string) => Promise<AiModelHealthSnapshot>;
  dispatchCompletion: (params: {
    model: string;
    systemInstruction?: string;
    prompt: string;
    contextPayload?: Record<string, unknown>;
  }) => Promise<{ text: string; latencyMs: number; isFallback: boolean }>;
}

// ============================================================================
// 13. GOVERNANCE, AUDIT & COMPLIANCE
// ============================================================================

export type AuditActionCategory =
  | 'FINANCIAL_SETTLEMENT'
  | 'PAYOUT_APPROVAL'
  | 'REWARD_POLICY_CHANGE'
  | 'VERIFICATION_GRANTED'
  | 'VERIFICATION_REVOKED'
  | 'RISK_RULE_MODIFIED'
  | 'ADMIN_ACCESS_CHANGED'
  | 'SIGNAL_DISMISSAL';

export interface AuditLogEntry {
  id: string;
  category: AuditActionCategory;
  actorId: string;
  actorRole: string;
  targetEntityId: string;
  targetEntityType: string;
  previousStateMasked?: Record<string, unknown>;
  newStateMasked: Record<string, unknown>;
  ipAddressMasked: string;
  reasonNotes: string;
  timestamp: string;
}

export interface GovernanceProposal {
  id: string;
  title: string;
  summary: string;
  category: 'FINANCIAL' | 'POLICY' | 'SECURITY' | 'MODERATION';
  proposerId: string;
  status: 'DRAFT' | 'VOTING_OPEN' | 'PASSED' | 'REJECTED' | 'EXECUTED';
  votesFor: number;
  votesAgainst: number;
  quorumPercentage: number;
  votingDeadline: string;
  executedAt?: string;
  executedBy?: string;
}
