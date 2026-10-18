import crypto from "crypto";
import { v2WalletEngine, V2WalletEngine } from "./v2WalletEngine";
import { v2RevenueEngine, V2RevenueEngine } from "./v2RevenueEngine";
import { getServerSupabaseClient } from "./serverAuth";
import {
  PremiumContent,
  PremiumPurchase,
  StreamAuthorizationResponse,
  TrailerDurationSeconds,
  LiveAccessTier,
  LiveSessionStatus,
  LiveRecordingStatus,
  PremiumLiveSession,
  PremiumLivePurchase,
  OrdinaryLiveVideo,
  CleanupJobResult
} from "../types/premiumContent";

export class V2PremiumContentEngine {
  private contents = new Map<string, PremiumContent>();
  private purchases = new Map<string, PremiumPurchase>();
  private entitlements = new Map<string, Set<string>>(); // viewer_id -> Set of content_id

  // Premium Live State
  private liveSessions = new Map<string, PremiumLiveSession>();
  private livePurchases = new Map<string, PremiumLivePurchase>();
  private liveEntitlements = new Map<string, Map<string, LiveAccessTier>>(); // viewer_id -> Map of sessionId -> LiveAccessTier
  private ordinaryLiveVideos = new Map<string, OrdinaryLiveVideo>();

  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> purchase_id
  private auditLogs: Array<{
    id: string;
    action: string;
    actor_id: string;
    actor_role: string;
    target_id: string;
    timestamp: string;
    details: any;
  }> = [];

  constructor(
    private walletEngine: V2WalletEngine = v2WalletEngine,
    private revenueEngine: V2RevenueEngine = v2RevenueEngine
  ) {}

  public async hydrateFromDatabase(): Promise<void> {
    const supabase = getServerSupabaseClient();
    if (!supabase) return;

    try {
      // 1. Hydrate uploaded content
      const { data: dbContent, error: cErr } = await supabase.from("premium_content").select("*");
      if (!cErr && Array.isArray(dbContent)) {
        for (const c of dbContent) {
          const item: PremiumContent = {
            id: c.id,
            creator_id: c.creator_id,
            title: c.title,
            description: c.description || "",
            preview_video_url: c.preview_video_url,
            full_video_storage_path: c.full_video_storage_path,
            free_preview_duration_seconds: (c.free_preview_duration_seconds || 180) as TrailerDurationSeconds,
            price_cents: Number(c.price_cents || 100),
            currency: c.currency || "USD",
            creator_split_bps: Number(c.creator_split_bps || 8000),
            is_active: c.is_active !== false,
            created_at: c.created_at,
            updated_at: c.updated_at
          };
          this.contents.set(item.id, item);
        }
      }

      // 2. Hydrate uploaded video purchases & entitlements
      const { data: dbPurchases, error: pErr } = await supabase.from("premium_purchases").select("*");
      if (!pErr && Array.isArray(dbPurchases)) {
        for (const p of dbPurchases) {
          const purchase: PremiumPurchase = {
            id: p.id,
            content_id: p.content_id,
            viewer_id: p.viewer_id,
            creator_id: p.creator_id,
            amount_cents: Number(p.amount_cents || 0),
            currency: p.currency || "USD",
            payment_method: p.payment_method || "METFA_WALLET",
            wallet_ledger_id: p.wallet_ledger_id,
            creator_wallet_ledger_id: p.creator_wallet_ledger_id,
            platform_fee_cents: Number(p.platform_fee_cents || 0),
            creator_amount_cents: Number(p.creator_amount_cents || 0),
            status: p.status || "COMPLETED",
            refund_reason: p.refund_reason,
            refunded_at: p.refunded_at,
            created_at: p.created_at,
            updated_at: p.updated_at
          };
          this.purchases.set(purchase.id, purchase);
          this.idempotencyIndex.set(`purchase:${purchase.content_id}:${purchase.viewer_id}`, purchase.id);

          if (purchase.status === "COMPLETED") {
            if (!this.entitlements.has(purchase.viewer_id)) {
              this.entitlements.set(purchase.viewer_id, new Set());
            }
            this.entitlements.get(purchase.viewer_id)!.add(purchase.content_id);
          }
        }
      }

      // 3. Hydrate live sessions
      const { data: dbSessions, error: sErr } = await supabase.from("premium_live_sessions").select("*");
      if (!sErr && Array.isArray(dbSessions)) {
        for (const s of dbSessions) {
          const session: PremiumLiveSession = {
            id: s.id,
            creator_id: s.creator_id,
            title: s.title,
            description: s.description || "",
            scheduled_start_time: s.scheduled_start_time,
            status: s.status || "SCHEDULED",
            live_price_cents: Number(s.live_price_cents || 100),
            replay_price_cents: Number(s.replay_price_cents || s.live_price_cents || 150),
            currency: s.currency || "USD",
            live_channel_id: s.live_channel_id || `live_ch_${s.id.slice(0, 8)}`,
            recording_storage_path: s.recording_storage_path,
            recording_status: s.recording_status || "NONE",
            recording_failure_reason: s.recording_failure_reason,
            published_at: s.published_at,
            retention_protected: Boolean(s.retention_protected),
            creator_split_bps: Number(s.creator_split_bps || 8000),
            created_at: s.created_at,
            updated_at: s.updated_at
          };
          this.liveSessions.set(session.id, session);
        }
      }

      // 4. Hydrate live purchases
      const { data: dbLivePurchases, error: lpErr } = await supabase.from("premium_live_purchases").select("*");
      if (!lpErr && Array.isArray(dbLivePurchases)) {
        for (const lp of dbLivePurchases) {
          const livePurchase: PremiumLivePurchase = {
            id: lp.id,
            session_id: lp.session_id,
            viewer_id: lp.viewer_id,
            creator_id: lp.creator_id,
            access_tier: lp.access_tier,
            amount_cents: Number(lp.amount_cents || 0),
            currency: lp.currency || "USD",
            payment_method: lp.payment_method || "METFA_WALLET",
            wallet_ledger_id: lp.wallet_ledger_id,
            creator_wallet_ledger_id: lp.creator_wallet_ledger_id,
            platform_fee_cents: Number(lp.platform_fee_cents || 0),
            creator_amount_cents: Number(lp.creator_amount_cents || 0),
            status: lp.status || "COMPLETED",
            refund_reason: lp.refund_reason,
            refunded_at: lp.refunded_at,
            created_at: lp.created_at,
            updated_at: lp.updated_at
          };
          this.livePurchases.set(livePurchase.id, livePurchase);
          this.idempotencyIndex.set(`live_purchase:${livePurchase.session_id}:${livePurchase.viewer_id}:${livePurchase.access_tier}`, livePurchase.id);

          if (livePurchase.status === "COMPLETED") {
            if (!this.liveEntitlements.has(livePurchase.viewer_id)) {
              this.liveEntitlements.set(livePurchase.viewer_id, new Map());
            }
            this.liveEntitlements.get(livePurchase.viewer_id)!.set(livePurchase.session_id, livePurchase.access_tier);
          }
        }
      }
    } catch (err: any) {
      console.warn("[v2PremiumContentEngine] DB hydration note:", err?.message || err);
    }
  }

  private isAiActor(role: string): boolean {
    const aiRoles = ["AI_AGENT", "AI_ADVISORY", "AI_ASSISTANT", "AUTOMATION"];
    return aiRoles.includes((role || "").toUpperCase());
  }

  // ==========================================
  // SECTION 1: UPLOADED PREMIUM VIDEOS
  // ==========================================

  public createContent(params: {
    creator_id: string;
    title: string;
    description?: string;
    preview_video_url: string;
    full_video_storage_path: string;
    free_preview_duration_seconds: number; // Mandatory 180, 240, or 300
    price_cents: number;
    currency?: string;
    creator_split_bps?: number; // Default 8000 (80%)
    actor_id: string;
    actor_role: string;
  }): { success: boolean; content?: PremiumContent; error?: string } {
    if (this.isAiActor(params.actor_role)) {
      return { success: false, error: "METFA AI Boundary Violation: AI agents cannot create premium monetized assets directly." };
    }

    if (!params.title || !params.title.trim()) {
      return { success: false, error: "Content title is required and cannot be empty." };
    }

    if (!params.preview_video_url || !params.preview_video_url.trim()) {
      return { success: false, error: "Preview video trailer URL is required." };
    }

    if (!params.full_video_storage_path || !params.full_video_storage_path.trim()) {
      return { success: false, error: "Secure private video storage path is required." };
    }

    // Mandatory creator-selectable 3, 4, or 5 minute free trailer
    const validTrailerDurations = [180, 240, 300];
    if (!validTrailerDurations.includes(params.free_preview_duration_seconds)) {
      return {
        success: false,
        error: "Free preview trailer must be creator-selectable: exactly 3 minutes (180s), 4 minutes (240s), or 5 minutes (300s)."
      };
    }

    if (!Number.isSafeInteger(params.price_cents) || params.price_cents < 50) {
      return { success: false, error: "Price must be an integer of at least 50 cents ($0.50)." };
    }

    const contentId = crypto.randomUUID();
    const currency = (params.currency || "USD").toUpperCase();
    // 80% Creator / 20% METFA default split
    const splitBps = typeof params.creator_split_bps === "number" && params.creator_split_bps >= 5000 && params.creator_split_bps <= 9500
      ? params.creator_split_bps
      : 8000;

    const now = new Date().toISOString();

    const content: PremiumContent = {
      id: contentId,
      creator_id: params.creator_id,
      title: params.title.trim(),
      description: (params.description || "").trim(),
      preview_video_url: params.preview_video_url.trim(),
      full_video_storage_path: params.full_video_storage_path.trim(),
      free_preview_duration_seconds: params.free_preview_duration_seconds as TrailerDurationSeconds,
      price_cents: params.price_cents,
      currency,
      creator_split_bps: splitBps,
      is_active: true,
      created_at: now,
      updated_at: now
    };

    this.contents.set(contentId, content);

    // Asynchronously synchronize to Supabase
    const supabase = getServerSupabaseClient();
    if (supabase) {
      supabase.from("premium_content").insert({
        id: content.id,
        creator_id: content.creator_id,
        title: content.title,
        description: content.description,
        preview_video_url: content.preview_video_url,
        full_video_storage_path: content.full_video_storage_path,
        free_preview_duration_seconds: content.free_preview_duration_seconds,
        price_cents: content.price_cents,
        currency: content.currency,
        creator_split_bps: content.creator_split_bps,
        is_active: content.is_active,
        created_at: content.created_at,
        updated_at: content.updated_at
      }).then(({ error }) => {
        if (error) console.warn("[v2PremiumContentEngine] Supabase content insert note:", error.message);
      });
    }

    this.recordAudit({
      action: "PREMIUM_CONTENT_CREATED",
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: content.id,
      details: {
        title: content.title,
        price_cents: content.price_cents,
        trailer_seconds: content.free_preview_duration_seconds,
        creator_split_bps: content.creator_split_bps
      }
    });

    return { success: true, content };
  }

  // Configurable authorized commission changes
  public updateContentCommission(params: {
    content_id: string;
    new_creator_split_bps: number;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; error?: string; content?: PremiumContent } {
    const allowed = ["SUPER_ADMIN", "ADMIN", "FINANCE_ADMIN"];
    if (!allowed.includes(params.actor_role)) {
      return { success: false, error: "Unauthorized: Commission changes require Admin or Finance authorization." };
    }

    const content = this.contents.get(params.content_id);
    if (!content) {
      return { success: false, error: `Content '${params.content_id}' not found.` };
    }

    if (!Number.isSafeInteger(params.new_creator_split_bps) || params.new_creator_split_bps < 5000 || params.new_creator_split_bps > 9500) {
      return { success: false, error: "Commission must be between 5000 (50%) and 9500 (95%) basis points." };
    }

    content.creator_split_bps = params.new_creator_split_bps;
    content.updated_at = new Date().toISOString();

    this.recordAudit({
      action: "PREMIUM_COMMISSION_UPDATED",
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: content.id,
      details: { new_split_bps: content.creator_split_bps }
    });

    return { success: true, content };
  }

  public getContent(contentId: string, requesterUserId?: string): {
    content?: Partial<PremiumContent> & { has_full_access: boolean };
    error?: string;
  } {
    const item = this.contents.get(contentId);
    if (!item) {
      return { error: `Premium content '${contentId}' not found.` };
    }

    const isCreator = requesterUserId && requesterUserId === item.creator_id;
    const hasPurchased = requesterUserId && this.hasEntitlement(contentId, requesterUserId);
    const hasFullAccess = Boolean(isCreator || hasPurchased);

    if (hasFullAccess) {
      return {
        content: {
          ...item,
          has_full_access: true
        }
      };
    }

    // Redact full video private storage path for non-purchasers!
    return {
      content: {
        id: item.id,
        creator_id: item.creator_id,
        title: item.title,
        description: item.description,
        preview_video_url: item.preview_video_url,
        free_preview_duration_seconds: item.free_preview_duration_seconds,
        price_cents: item.price_cents,
        currency: item.currency,
        is_active: item.is_active,
        created_at: item.created_at,
        updated_at: item.updated_at,
        has_full_access: false
      }
    };
  }

  public listContent(requesterUserId?: string): Array<Partial<PremiumContent> & { has_full_access: boolean }> {
    const result: Array<Partial<PremiumContent> & { has_full_access: boolean }> = [];
    for (const item of this.contents.values()) {
      if (!item.is_active && requesterUserId !== item.creator_id) {
        continue;
      }
      const isCreator = requesterUserId && requesterUserId === item.creator_id;
      const hasPurchased = requesterUserId && this.hasEntitlement(item.id, requesterUserId);
      const hasFullAccess = Boolean(isCreator || hasPurchased);

      if (hasFullAccess) {
        result.push({ ...item, has_full_access: true });
      } else {
        result.push({
          id: item.id,
          creator_id: item.creator_id,
          title: item.title,
          description: item.description,
          preview_video_url: item.preview_video_url,
          free_preview_duration_seconds: item.free_preview_duration_seconds,
          price_cents: item.price_cents,
          currency: item.currency,
          is_active: item.is_active,
          created_at: item.created_at,
          updated_at: item.updated_at,
          has_full_access: false
        });
      }
    }
    return result;
  }

  public hasEntitlement(contentId: string, viewerId: string): boolean {
    const userEntitlements = this.entitlements.get(viewerId);
    return Boolean(userEntitlements && userEntitlements.has(contentId));
  }

  public purchaseWithWallet(params: {
    content_id: string;
    viewer_id: string;
    actor_id: string;
    actor_role: string;
    idempotency_key?: string;
  }): {
    success: boolean;
    is_cached?: boolean;
    purchase?: PremiumPurchase;
    error?: string;
    wallet_balance_cents?: number;
  } {
    if (this.isAiActor(params.actor_role)) {
      return { success: false, error: "METFA AI Boundary Violation: AI agents cannot execute purchases." };
    }

    if (params.viewer_id !== params.actor_id && !["SUPER_ADMIN", "ADMIN"].includes(params.actor_role)) {
      return { success: false, error: "Unauthorized: You cannot purchase content for another user account." };
    }

    const content = this.contents.get(params.content_id);
    if (!content) {
      return { success: false, error: `Content '${params.content_id}' not found.` };
    }

    if (!content.is_active) {
      return { success: false, error: "This premium content is currently inactive and not available for purchase." };
    }

    if (content.creator_id === params.viewer_id) {
      return { success: false, error: "Creator already owns permanent streaming access to their own video." };
    }

    const idempotencyKey = params.idempotency_key || `purchase:${content.id}:${params.viewer_id}`;
    const existingPurchaseId = this.idempotencyIndex.get(idempotencyKey);
    if (existingPurchaseId) {
      const existing = this.purchases.get(existingPurchaseId);
      if (existing && existing.status === "COMPLETED") {
        return {
          success: true,
          is_cached: true,
          purchase: { ...existing }
        };
      }
    }

    // 1. Atomic Wallet Debit
    const debitRes = this.walletEngine.debitForPremiumPurchase({
      viewer_id: params.viewer_id,
      amount_cents: content.price_cents,
      currency: content.currency,
      content_id: content.id,
      title: content.title,
      idempotency_key: idempotencyKey,
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      creator_id: content.creator_id
    });

    if (!debitRes.success || !debitRes.ledger_entry) {
      return {
        success: false,
        error: debitRes.error || "Wallet debit failed."
      };
    }

    const purchaseId = crypto.randomUUID();

    // 2. Revenue Split: 80% Creator / 20% METFA (or customized split)
    const splitBps = content.creator_split_bps || 8000;
    const creatorAmountCents = Math.round(content.price_cents * (splitBps / 10000));
    const platformFeeCents = content.price_cents - creatorAmountCents;

    // 3. Credit Creator's Wallet
    const royaltyRes = this.walletEngine.creditPremiumRoyalty({
      creator_id: content.creator_id,
      amount_cents: creatorAmountCents,
      currency: content.currency,
      content_id: content.id,
      purchase_id: purchaseId,
      title: content.title,
      actor_id: params.actor_id,
      actor_role: params.actor_role
    });

    // 4. Record Platform Revenue in V2 Revenue Engine
    try {
      const periods = this.revenueEngine.listPeriods();
      const openPeriod = periods.find(p => p.status === "OPEN" && p.currency === content.currency) || periods[0];
      if (openPeriod && platformFeeCents > 0) {
        this.revenueEngine.recordRevenueEntry({
          period_id: openPeriod.id,
          source: "PREMIUM_CONTENT",
          entry_type: "GROSS_INCOME",
          amount_cents: platformFeeCents,
          currency: content.currency,
          reference_id: `plat_fee_${purchaseId}`,
          description: `Platform fee for PPV access: ${content.title}`,
          actor_id: params.actor_id,
          actor_role: params.actor_role,
          auto_verify: true
        });
      }
    } catch (e: any) {
      console.warn("[v2PremiumContentEngine] Revenue entry note:", e?.message);
    }

    // 5. Grant Permanent Entitlement & Save Purchase
    const now = new Date().toISOString();
    const purchase: PremiumPurchase = {
      id: purchaseId,
      content_id: content.id,
      viewer_id: params.viewer_id,
      creator_id: content.creator_id,
      amount_cents: content.price_cents,
      currency: content.currency,
      payment_method: "METFA_WALLET",
      wallet_ledger_id: debitRes.ledger_entry.id,
      creator_wallet_ledger_id: royaltyRes.ledger_entry?.id,
      platform_fee_cents: platformFeeCents,
      creator_amount_cents: creatorAmountCents,
      status: "COMPLETED",
      created_at: now,
      updated_at: now
    };

    this.purchases.set(purchaseId, purchase);
    this.idempotencyIndex.set(idempotencyKey, purchaseId);

    if (!this.entitlements.has(params.viewer_id)) {
      this.entitlements.set(params.viewer_id, new Set());
    }
    this.entitlements.get(params.viewer_id)!.add(content.id);

    // Synchronize to Supabase
    const supabase = getServerSupabaseClient();
    if (supabase) {
      supabase.from("premium_purchases").insert({
        id: purchase.id,
        content_id: purchase.content_id,
        viewer_id: purchase.viewer_id,
        creator_id: purchase.creator_id,
        amount_cents: purchase.amount_cents,
        currency: purchase.currency,
        payment_method: purchase.payment_method,
        wallet_ledger_id: purchase.wallet_ledger_id,
        creator_wallet_ledger_id: purchase.creator_wallet_ledger_id,
        platform_fee_cents: purchase.platform_fee_cents,
        creator_amount_cents: purchase.creator_amount_cents,
        status: purchase.status,
        created_at: purchase.created_at,
        updated_at: purchase.updated_at
      }).then(({ error }) => {
        if (error) console.warn("[v2PremiumContentEngine] Supabase purchase insert note:", error.message);
      });
    }

    this.recordAudit({
      action: "PREMIUM_PURCHASE_COMPLETED",
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: purchase.id,
      details: {
        content_id: content.id,
        viewer_id: params.viewer_id,
        amount_cents: content.price_cents,
        creator_amount_cents: creatorAmountCents,
        platform_fee_cents: platformFeeCents
      }
    });

    return {
      success: true,
      purchase,
      wallet_balance_cents: debitRes.wallet?.available_balance_cents
    };
  }

  // Strict Rule 6 Enforcement
  public processExternalPayment(params: {
    content_id: string;
    viewer_id: string;
    provider: string;
    actor_id: string;
  }): { success: boolean; error: string; blocker_details: any } {
    const provider = (params.provider || "UNKNOWN").toUpperCase();

    const envMap: Record<string, string | undefined> = {
      STRIPE: process.env.STRIPE_SECRET_KEY,
      PAYPAL: process.env.PAYPAL_CLIENT_SECRET,
      BKASH: process.env.BKASH_APP_SECRET,
      SSLCOMMERZ: process.env.SSLCOMMERZ_STORE_PASSWORD
    };

    const hasCreds = Boolean(envMap[provider] && envMap[provider]!.trim().length > 0);

    return {
      success: false,
      error: `External payment provider '${provider}' is not configured in this deployment. Missing verified API secret credentials. Simulation of payments is strictly prohibited by security and financial policy. Please purchase using your verified METFA Wallet balance.`,
      blocker_details: {
        requested_provider: provider,
        credentials_present: hasCreds,
        required_env_vars: [`${provider}_SECRET_KEY`],
        resolution: "To enable external gateway checkouts, real gateway API credentials must be provisioned in the backend environment. In the meantime, all transactions are securely backed by METFA Wallet balances."
      }
    };
  }

  public async authorizeStream(params: {
    content_id: string;
    user_id?: string;
    user_roles?: string[];
  }): Promise<StreamAuthorizationResponse> {
    const content = this.contents.get(params.content_id);
    if (!content) {
      return {
        authorized: false,
        error: `Content '${params.content_id}' not found.`
      };
    }

    if (!params.user_id) {
      return {
        authorized: false,
        error: "Full-length streaming requires viewer authentication and pay-per-view access purchase.",
        preview_url: content.preview_video_url,
        free_preview_duration_seconds: content.free_preview_duration_seconds,
        price_cents: content.price_cents
      };
    }

    const isCreator = content.creator_id === params.user_id;
    const isSuperAdmin = (params.user_roles || []).includes("SUPER_ADMIN");
    const hasEntitlement = this.hasEntitlement(content.id, params.user_id);

    if (!isCreator && !isSuperAdmin && !hasEntitlement) {
      return {
        authorized: false,
        error: "Payment Required: Full video requires a one-time pay-per-view purchase.",
        preview_url: content.preview_video_url,
        free_preview_duration_seconds: content.free_preview_duration_seconds,
        price_cents: content.price_cents
      };
    }

    const supabase = getServerSupabaseClient();
    let streamUrl = content.full_video_storage_path;

    if (supabase) {
      try {
        const { data: signedData, error: sErr } = await supabase.storage
          .from("premium-videos")
          .createSignedUrl(content.full_video_storage_path, 3600);

        if (!sErr && signedData?.signedUrl) {
          streamUrl = signedData.signedUrl;
        }
      } catch (e: any) {
        console.warn("[v2PremiumContentEngine] Signed URL generation note:", e?.message);
      }
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return {
      authorized: true,
      stream_url: streamUrl,
      expires_at: expiresAt,
      free_preview_duration_seconds: content.free_preview_duration_seconds,
      preview_url: content.preview_video_url
    };
  }

  public refundPurchase(params: {
    purchase_id: string;
    reason: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; error?: string; purchase?: PremiumPurchase } {
    if (this.isAiActor(params.actor_role)) {
      return { success: false, error: "METFA AI Boundary Violation: AI agents cannot authorize financial refunds." };
    }

    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "FINANCE_ADMIN"];
    if (!allowedRoles.includes(params.actor_role)) {
      return { success: false, error: `Unauthorized: Refund requires Admin authority. Received '${params.actor_role}'.` };
    }

    const purchase = this.purchases.get(params.purchase_id);
    if (!purchase) {
      return { success: false, error: `Purchase '${params.purchase_id}' not found.` };
    }

    if (purchase.status === "REFUNDED") {
      return { success: false, error: "This purchase has already been refunded." };
    }

    // 1. Financial Reversal in Wallet Engine
    const refundRes = this.walletEngine.refundPremiumPurchase({
      purchase_id: purchase.id,
      viewer_id: purchase.viewer_id,
      creator_id: purchase.creator_id,
      refund_amount_cents: purchase.amount_cents,
      clawback_amount_cents: purchase.creator_amount_cents,
      currency: purchase.currency,
      reason: params.reason,
      actor_id: params.actor_id,
      actor_role: params.actor_role
    });

    if (!refundRes.success) {
      return { success: false, error: refundRes.error || "Wallet refund operation failed." };
    }

    // 2. Adjust Platform Revenue in Revenue Engine
    try {
      const periods = this.revenueEngine.listPeriods();
      const openPeriod = periods.find(p => p.status === "OPEN" && p.currency === purchase.currency) || periods[0];
      if (openPeriod && purchase.platform_fee_cents > 0) {
        this.revenueEngine.recordRevenueEntry({
          period_id: openPeriod.id,
          source: "PREMIUM_CONTENT",
          entry_type: "REFUND",
          amount_cents: purchase.platform_fee_cents,
          currency: purchase.currency,
          reference_id: `ref_fee_${purchase.id}`,
          description: `Platform fee refund: ${params.reason}`,
          actor_id: params.actor_id,
          actor_role: params.actor_role,
          auto_verify: true
        });
      }
    } catch (e: any) {
      console.warn("[v2PremiumContentEngine] Revenue refund entry note:", e?.message);
    }

    // 3. Revoke Viewer Entitlement
    const userEntitlements = this.entitlements.get(purchase.viewer_id);
    if (userEntitlements) {
      userEntitlements.delete(purchase.content_id);
    }

    // 4. Update Purchase Record
    purchase.status = "REFUNDED";
    purchase.refund_reason = params.reason;
    purchase.refunded_at = new Date().toISOString();
    purchase.updated_at = new Date().toISOString();

    return { success: true, purchase };
  }

  // ==========================================
  // SECTION 2: PREMIUM LIVE SESSIONS & REPLAY
  // ==========================================

  public createLiveSession(params: {
    creator_id: string;
    title: string;
    description?: string;
    scheduled_start_time: string;
    live_price_cents: number;
    replay_price_cents: number;
    currency?: string;
    creator_split_bps?: number; // Default 8000 (80%)
    actor_id: string;
    actor_role: string;
  }): { success: boolean; session?: PremiumLiveSession; error?: string } {
    if (this.isAiActor(params.actor_role)) {
      return { success: false, error: "METFA AI Boundary Violation: AI agents cannot schedule live monetized sessions." };
    }

    if (!params.title || !params.title.trim()) {
      return { success: false, error: "Live session title is required." };
    }

    if (!params.scheduled_start_time) {
      return { success: false, error: "Scheduled start time is required." };
    }

    if (!Number.isSafeInteger(params.live_price_cents) || params.live_price_cents < 50) {
      return { success: false, error: "Live session price must be at least 50 cents ($0.50)." };
    }

    if (!Number.isSafeInteger(params.replay_price_cents) || params.replay_price_cents < params.live_price_cents) {
      return { success: false, error: "Live + Replay price must be greater than or equal to the Live-Only price." };
    }

    const sessionId = crypto.randomUUID();
    const currency = (params.currency || "USD").toUpperCase();
    const splitBps = typeof params.creator_split_bps === "number" && params.creator_split_bps >= 5000 && params.creator_split_bps <= 9500
      ? params.creator_split_bps
      : 8000;

    const now = new Date().toISOString();

    const session: PremiumLiveSession = {
      id: sessionId,
      creator_id: params.creator_id,
      title: params.title.trim(),
      description: (params.description || "").trim(),
      scheduled_start_time: params.scheduled_start_time,
      status: "SCHEDULED",
      live_price_cents: params.live_price_cents,
      replay_price_cents: params.replay_price_cents,
      currency,
      live_channel_id: `live_stream_${sessionId.slice(0, 8)}`,
      recording_status: "NONE",
      retention_protected: false,
      creator_split_bps: splitBps,
      created_at: now,
      updated_at: now
    };

    this.liveSessions.set(sessionId, session);

    this.recordAudit({
      action: "PREMIUM_LIVE_SESSION_CREATED",
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: session.id,
      details: {
        title: session.title,
        live_price_cents: session.live_price_cents,
        replay_price_cents: session.replay_price_cents
      }
    });

    return { success: true, session };
  }

  public getLiveSession(sessionId: string): PremiumLiveSession | undefined {
    return this.liveSessions.get(sessionId);
  }

  public listLiveSessions(): PremiumLiveSession[] {
    return Array.from(this.liveSessions.values()).sort(
      (a, b) => new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
    );
  }

  public startLiveSession(sessionId: string, creatorId: string): { success: boolean; error?: string; session?: PremiumLiveSession } {
    const session = this.liveSessions.get(sessionId);
    if (!session) return { success: false, error: "Live session not found." };
    if (session.creator_id !== creatorId) return { success: false, error: "Only the session creator can start the broadcast." };

    session.status = "LIVE";
    session.recording_status = "RECORDING";
    session.recording_storage_path = `premium-videos/live_${session.id}_master.mp4`;
    session.updated_at = new Date().toISOString();

    this.recordAudit({
      action: "PREMIUM_LIVE_BROADCAST_STARTED",
      actor_id: creatorId,
      actor_role: "CREATOR",
      target_id: session.id,
      details: { channel_id: session.live_channel_id }
    });

    return { success: true, session };
  }

  public endLiveSession(sessionId: string, creatorId: string): { success: boolean; error?: string; session?: PremiumLiveSession } {
    const session = this.liveSessions.get(sessionId);
    if (!session) return { success: false, error: "Live session not found." };
    if (session.creator_id !== creatorId) return { success: false, error: "Only the session creator can conclude the broadcast." };

    session.status = "ENDED";
    session.recording_status = "FINALIZING";
    session.updated_at = new Date().toISOString();

    this.recordAudit({
      action: "PREMIUM_LIVE_BROADCAST_ENDED",
      actor_id: creatorId,
      actor_role: "CREATOR",
      target_id: session.id,
      details: { recording_status: session.recording_status }
    });

    return { success: true, session };
  }

  // Server-side verification before replay access is granted
  public finalizeAndPublishReplay(params: {
    session_id: string;
    recording_storage_path?: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; error?: string; session?: PremiumLiveSession } {
    const session = this.liveSessions.get(params.session_id);
    if (!session) return { success: false, error: "Live session not found." };

    const allowed = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER", "CREATOR_PRO"];
    if (!allowed.includes(params.actor_role) && session.creator_id !== params.actor_id) {
      return { success: false, error: "Unauthorized: You do not have permission to publish recording replays." };
    }

    if (session.status !== "ENDED") {
      return { success: false, error: "Live session must be ended before replay can be published." };
    }

    const storagePath = params.recording_storage_path || session.recording_storage_path;
    if (!storagePath || !storagePath.trim()) {
      return { success: false, error: "Valid private storage path is required for replay video file." };
    }

    session.recording_storage_path = storagePath.trim();
    session.recording_status = "PUBLISHED";
    session.published_at = new Date().toISOString();
    session.updated_at = new Date().toISOString();

    // Check if any viewers have LIVE_AND_PERMANENT_REPLAY entitlements:
    let replayEntitlementCount = 0;
    for (const p of this.livePurchases.values()) {
      if (p.session_id === session.id && p.status === "COMPLETED" && p.access_tier === "LIVE_AND_PERMANENT_REPLAY") {
        replayEntitlementCount++;
      }
    }

    // Explicitly protect from 30-day cleanup only if valid replay entitlements exist!
    if (replayEntitlementCount > 0) {
      session.retention_protected = true;
    }

    this.recordAudit({
      action: "PREMIUM_REPLAY_PUBLISHED",
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: session.id,
      details: {
        storage_path: session.recording_storage_path,
        entitled_replays_count: replayEntitlementCount,
        retention_protected: session.retention_protected
      }
    });

    return { success: true, session };
  }

  // Honest failure handling: refund replay fee delta to purchasers
  public markRecordingFailed(params: {
    session_id: string;
    failure_reason: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; error?: string; session?: PremiumLiveSession; refunded_users_count: number } {
    const session = this.liveSessions.get(params.session_id);
    if (!session) return { success: false, error: "Live session not found.", refunded_users_count: 0 };

    session.recording_status = "FAILED";
    session.recording_failure_reason = params.failure_reason;
    session.retention_protected = false;
    session.updated_at = new Date().toISOString();

    // For all purchasers with LIVE_AND_PERMANENT_REPLAY, calculate difference between replay & live price:
    const deltaCents = Math.max(0, session.replay_price_cents - session.live_price_cents);
    let refundCount = 0;

    if (deltaCents > 0) {
      for (const p of this.livePurchases.values()) {
        if (p.session_id === session.id && p.status === "COMPLETED" && p.access_tier === "LIVE_AND_PERMANENT_REPLAY") {
          // Refund delta to viewer
          const viewerWallet = this.walletEngine.getOrCreateWallet(p.viewer_id, p.currency);
          const entryId = `ledg_delta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          this.walletEngine.postLedgerEntry({
            id: entryId,
            wallet_id: viewerWallet.id,
            user_id: p.viewer_id,
            entry_type: "PREMIUM_LIVE_REFUND",
            amount_cents: deltaCents,
            currency: p.currency,
            direction: "CREDIT",
            source_type: "PREMIUM_LIVE",
            source_id: session.id,
            idempotency_key: `fail_refund:${p.id}`,
            status: "POSTED",
            balance_after_cents: viewerWallet.available_balance_cents + deltaCents,
            description: `Partial refund: Live session replay recording failed (${params.failure_reason})`,
            metadata: { purchase_id: p.id, session_id: session.id, reason: params.failure_reason },
            created_at: new Date().toISOString()
          });
          this.walletEngine.reconcileAndApplyAccountState(viewerWallet.id);

          // Downgrade access tier to LIVE_ONLY
          p.access_tier = "LIVE_ONLY";
          p.updated_at = new Date().toISOString();
          const viewerMap = this.liveEntitlements.get(p.viewer_id);
          if (viewerMap) viewerMap.set(session.id, "LIVE_ONLY");

          refundCount++;
        }
      }
    }

    this.recordAudit({
      action: "PREMIUM_RECORDING_FAILED",
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: session.id,
      details: { reason: params.failure_reason, refunded_users_count: refundCount, delta_cents: deltaCents }
    });

    return { success: true, session, refunded_users_count: refundCount };
  }

  // Cancel live session & 100% refund all ticket holders
  public cancelLiveSession(params: {
    session_id: string;
    reason: string;
    actor_id: string;
    actor_role: string;
  }): { success: boolean; error?: string; session?: PremiumLiveSession; refunded_tickets_count: number } {
    const session = this.liveSessions.get(params.session_id);
    if (!session) return { success: false, error: "Live session not found.", refunded_tickets_count: 0 };

    session.status = "CANCELLED";
    session.recording_status = "NONE";
    session.retention_protected = false;
    session.updated_at = new Date().toISOString();

    let refundedCount = 0;
    for (const p of this.livePurchases.values()) {
      if (p.session_id === session.id && p.status === "COMPLETED") {
        // Refund full ticket price to viewer
        const viewerWallet = this.walletEngine.getOrCreateWallet(p.viewer_id, p.currency);
        const refEntryId = `ledg_canc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.walletEngine.postLedgerEntry({
          id: refEntryId,
          wallet_id: viewerWallet.id,
          user_id: p.viewer_id,
          entry_type: "PREMIUM_LIVE_REFUND",
          amount_cents: p.amount_cents,
          currency: p.currency,
          direction: "CREDIT",
          source_type: "PREMIUM_LIVE",
          source_id: session.id,
          idempotency_key: `cancel_refund:${p.id}`,
          status: "POSTED",
          balance_after_cents: viewerWallet.available_balance_cents + p.amount_cents,
          description: `Full refund: Live session cancelled (${params.reason})`,
          metadata: { purchase_id: p.id, session_id: session.id, reason: params.reason },
          created_at: new Date().toISOString()
        });
        this.walletEngine.reconcileAndApplyAccountState(viewerWallet.id);

        // Claw back creator royalty
        const creatorWallet = this.walletEngine.getOrCreateWallet(session.creator_id, p.currency);
        const clawEntryId = `ledg_claw_live_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.walletEngine.postLedgerEntry({
          id: clawEntryId,
          wallet_id: creatorWallet.id,
          user_id: session.creator_id,
          entry_type: "PREMIUM_LIVE_ROYALTY_CLAWBACK",
          amount_cents: p.creator_amount_cents,
          currency: p.currency,
          direction: "DEBIT",
          source_type: "PREMIUM_LIVE",
          source_id: session.id,
          idempotency_key: `cancel_clawback:${p.id}`,
          status: "POSTED",
          balance_after_cents: creatorWallet.available_balance_cents - p.creator_amount_cents,
          description: `Royalty clawback: Live session cancelled (${params.reason})`,
          metadata: { purchase_id: p.id, session_id: session.id },
          created_at: new Date().toISOString()
        });
        this.walletEngine.reconcileAndApplyAccountState(creatorWallet.id);

        // Revoke entitlement
        p.status = "REFUNDED";
        p.refund_reason = params.reason;
        p.refunded_at = new Date().toISOString();
        p.updated_at = new Date().toISOString();

        const viewerMap = this.liveEntitlements.get(p.viewer_id);
        if (viewerMap) viewerMap.delete(session.id);

        refundedCount++;
      }
    }

    this.recordAudit({
      action: "PREMIUM_LIVE_SESSION_CANCELLED",
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: session.id,
      details: { reason: params.reason, refunded_tickets_count: refundedCount }
    });

    return { success: true, session, refunded_tickets_count: refundedCount };
  }

  // Purchasing access to Premium Live (LIVE_ONLY vs LIVE_AND_PERMANENT_REPLAY)
  public purchaseLiveAccess(params: {
    session_id: string;
    viewer_id: string;
    access_tier: LiveAccessTier;
    actor_id: string;
    actor_role: string;
    idempotency_key?: string;
  }): {
    success: boolean;
    is_cached?: boolean;
    purchase?: PremiumLivePurchase;
    error?: string;
    wallet_balance_cents?: number;
  } {
    if (this.isAiActor(params.actor_role)) {
      return { success: false, error: "METFA AI Boundary Violation: AI agents cannot execute purchases." };
    }

    if (params.viewer_id !== params.actor_id && !["SUPER_ADMIN", "ADMIN"].includes(params.actor_role)) {
      return { success: false, error: "Unauthorized: You cannot purchase tickets for another user account." };
    }

    const session = this.liveSessions.get(params.session_id);
    if (!session) {
      return { success: false, error: `Live session '${params.session_id}' not found.` };
    }

    if (session.status === "CANCELLED") {
      return { success: false, error: "Cannot purchase tickets for a cancelled live session." };
    }

    if (session.creator_id === params.viewer_id) {
      return { success: false, error: "Creator already owns full broadcast access to their live stream." };
    }

    // Check existing entitlement for upgrade logic
    const viewerMap = this.liveEntitlements.get(params.viewer_id);
    const existingTier = viewerMap ? viewerMap.get(session.id) : undefined;

    if (existingTier === "LIVE_AND_PERMANENT_REPLAY") {
      return { success: true, is_cached: true, error: "You already own permanent access (Live + Replay) for this session." };
    }

    if (existingTier === "LIVE_ONLY" && params.access_tier === "LIVE_ONLY") {
      return { success: true, is_cached: true, error: "You already hold a Live Only ticket for this session." };
    }

    // Price determination (if upgrading from Live Only to Replay, charge only difference)
    const isUpgrade = existingTier === "LIVE_ONLY" && params.access_tier === "LIVE_AND_PERMANENT_REPLAY";
    const amountToDebit = isUpgrade
      ? Math.max(0, session.replay_price_cents - session.live_price_cents)
      : params.access_tier === "LIVE_AND_PERMANENT_REPLAY"
      ? session.replay_price_cents
      : session.live_price_cents;

    const idempotencyKey = params.idempotency_key || `live_purchase:${session.id}:${params.viewer_id}:${params.access_tier}`;
    const existingPurchaseId = this.idempotencyIndex.get(idempotencyKey);
    if (existingPurchaseId) {
      const existing = this.livePurchases.get(existingPurchaseId);
      if (existing && existing.status === "COMPLETED") {
        return { success: true, is_cached: true, purchase: { ...existing } };
      }
    }

    // 1. Atomic Wallet Debit
    const viewerWallet = this.walletEngine.getOrCreateWallet(params.viewer_id, session.currency);
    if (viewerWallet.available_balance_cents < amountToDebit) {
      return {
        success: false,
        error: `Insufficient METFA Wallet balance. Required: ${amountToDebit} cents, Available: ${viewerWallet.available_balance_cents} cents.`
      };
    }

    const debitEntryId = `ledg_live_deb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const debitBalanceAfter = viewerWallet.available_balance_cents - amountToDebit;

    this.walletEngine.postLedgerEntry({
      id: debitEntryId,
      wallet_id: viewerWallet.id,
      user_id: viewerWallet.user_id,
      entry_type: "PREMIUM_LIVE_PURCHASE_DEBIT",
      amount_cents: amountToDebit,
      currency: session.currency,
      direction: "DEBIT",
      source_type: "PREMIUM_LIVE",
      source_id: session.id,
      idempotency_key: idempotencyKey,
      status: "POSTED",
      balance_after_cents: debitBalanceAfter,
      description: `Purchase ${params.access_tier} for live session: ${session.title}`,
      metadata: { session_id: session.id, access_tier: params.access_tier, is_upgrade: isUpgrade },
      created_at: new Date().toISOString()
    });
    this.walletEngine.reconcileAndApplyAccountState(viewerWallet.id);

    // 2. Revenue Split: 80% Creator / 20% METFA (or customized split)
    const splitBps = session.creator_split_bps || 8000;
    const creatorAmountCents = Math.round(amountToDebit * (splitBps / 10000));
    const platformFeeCents = amountToDebit - creatorAmountCents;

    // 3. Creator Royalty Credit
    const creatorWallet = this.walletEngine.getOrCreateWallet(session.creator_id, session.currency);
    const royaltyEntryId = `ledg_live_roy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const creatorBalanceAfter = creatorWallet.available_balance_cents + creatorAmountCents;

    this.walletEngine.postLedgerEntry({
      id: royaltyEntryId,
      wallet_id: creatorWallet.id,
      user_id: creatorWallet.user_id,
      entry_type: "PREMIUM_LIVE_ROYALTY",
      amount_cents: creatorAmountCents,
      currency: session.currency,
      direction: "CREDIT",
      source_type: "PREMIUM_LIVE",
      source_id: session.id,
      idempotency_key: `royalty:${session.id}:${params.viewer_id}:${params.access_tier}`,
      status: "POSTED",
      balance_after_cents: creatorBalanceAfter,
      description: `Creator ticket royalty: ${session.title} (${params.access_tier})`,
      metadata: { session_id: session.id, access_tier: params.access_tier, platform_fee_cents: platformFeeCents },
      created_at: new Date().toISOString()
    });
    this.walletEngine.reconcileAndApplyAccountState(creatorWallet.id);

    // 4. Record Platform Fee in Revenue Engine
    try {
      const periods = this.revenueEngine.listPeriods();
      const openPeriod = periods.find(p => p.status === "OPEN" && p.currency === session.currency) || periods[0];
      if (openPeriod && platformFeeCents > 0) {
        this.revenueEngine.recordRevenueEntry({
          period_id: openPeriod.id,
          source: "PREMIUM_CONTENT",
          entry_type: "GROSS_INCOME",
          amount_cents: platformFeeCents,
          currency: session.currency,
          reference_id: `live_fee_${debitEntryId}`,
          description: `Platform fee on live ticket: ${session.title}`,
          actor_id: params.actor_id,
          actor_role: params.actor_role,
          auto_verify: true
        });
      }
    } catch (e: any) {
      console.warn("[v2PremiumContentEngine] Revenue live fee note:", e?.message);
    }

    // 5. Save Purchase Record and Entitlement
    const purchaseId = crypto.randomUUID();
    const now = new Date().toISOString();

    const livePurchase: PremiumLivePurchase = {
      id: purchaseId,
      session_id: session.id,
      viewer_id: params.viewer_id,
      creator_id: session.creator_id,
      access_tier: params.access_tier,
      amount_cents: amountToDebit,
      currency: session.currency,
      payment_method: "METFA_WALLET",
      wallet_ledger_id: debitEntryId,
      creator_wallet_ledger_id: royaltyEntryId,
      platform_fee_cents: platformFeeCents,
      creator_amount_cents: creatorAmountCents,
      status: "COMPLETED",
      created_at: now,
      updated_at: now
    };

    this.livePurchases.set(purchaseId, livePurchase);
    this.idempotencyIndex.set(idempotencyKey, purchaseId);

    if (!this.liveEntitlements.has(params.viewer_id)) {
      this.liveEntitlements.set(params.viewer_id, new Map());
    }
    this.liveEntitlements.get(params.viewer_id)!.set(session.id, params.access_tier);

    // If permanent replay purchased, protect recording from 30-day cleanup
    if (params.access_tier === "LIVE_AND_PERMANENT_REPLAY") {
      session.retention_protected = true;
    }

    this.recordAudit({
      action: "PREMIUM_LIVE_TICKET_PURCHASED",
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: purchaseId,
      details: {
        session_id: session.id,
        access_tier: params.access_tier,
        amount_cents: amountToDebit,
        creator_cents: creatorAmountCents,
        fee_cents: platformFeeCents
      }
    });

    return {
      success: true,
      purchase: livePurchase,
      wallet_balance_cents: debitBalanceAfter
    };
  }

  // Live Stream Authorization
  public authorizeLiveStream(params: {
    session_id: string;
    user_id?: string;
    user_roles?: string[];
  }): { authorized: boolean; error?: string; live_channel_id?: string; access_tier?: LiveAccessTier; live_price_cents?: number } {
    const session = this.liveSessions.get(params.session_id);
    if (!session) return { authorized: false, error: "Live session not found." };

    if (!params.user_id) {
      return {
        authorized: false,
        error: "Viewer authentication required to join premium live stream.",
        live_price_cents: session.live_price_cents
      };
    }

    const isCreator = session.creator_id === params.user_id;
    const isSuperAdmin = (params.user_roles || []).includes("SUPER_ADMIN");
    const viewerMap = this.liveEntitlements.get(params.user_id);
    const accessTier = viewerMap?.get(session.id);

    if (!isCreator && !isSuperAdmin && !accessTier) {
      return {
        authorized: false,
        error: "Ticket Required: Live streaming access requires an active live session ticket.",
        live_price_cents: session.live_price_cents
      };
    }

    return {
      authorized: true,
      live_channel_id: session.live_channel_id,
      access_tier: isCreator ? "LIVE_AND_PERMANENT_REPLAY" : accessTier
    };
  }

  // Replay Stream Authorization (Server-side verified)
  public async authorizeReplayStream(params: {
    session_id: string;
    user_id?: string;
    user_roles?: string[];
  }): Promise<StreamAuthorizationResponse> {
    const session = this.liveSessions.get(params.session_id);
    if (!session) {
      return { authorized: false, error: "Live session not found." };
    }

    // Replay Gate 1: Recording Must Be Verified and Published
    if (session.recording_status !== "PUBLISHED") {
      const statusMsg = session.recording_status === "FAILED"
        ? `Replay unavailable: Recording failed (${session.recording_failure_reason || "Encoding issue"}).`
        : session.recording_status === "FINALIZING" || session.recording_status === "RECORDING"
        ? "Replay is currently processing. Access will become available once finalized and published."
        : "Replay has not been published for this live session.";

      return {
        authorized: false,
        recording_status: session.recording_status,
        error: statusMsg
      };
    }

    if (!params.user_id) {
      return {
        authorized: false,
        error: "Viewer authentication required to access recording replay.",
        price_cents: session.replay_price_cents
      };
    }

    const isCreator = session.creator_id === params.user_id;
    const isSuperAdmin = (params.user_roles || []).includes("SUPER_ADMIN");
    const viewerMap = this.liveEntitlements.get(params.user_id);
    const accessTier = viewerMap?.get(session.id);

    // Replay Gate 2: Entitlement check
    if (!isCreator && !isSuperAdmin && accessTier !== "LIVE_AND_PERMANENT_REPLAY") {
      const errorMsg = accessTier === "LIVE_ONLY"
        ? "Your purchased ticket was Live Only. Replay access requires a Live + Permanent Replay ticket."
        : "Replay access requires a Live + Replay ticket.";

      return {
        authorized: false,
        error: errorMsg,
        access_tier: accessTier,
        price_cents: session.replay_price_cents
      };
    }

    // Generate time-limited signed streaming URL from private bucket
    const supabase = getServerSupabaseClient();
    let streamUrl = session.recording_storage_path || "";

    if (supabase && streamUrl) {
      try {
        const { data: signedData, error: sErr } = await supabase.storage
          .from("premium-videos")
          .createSignedUrl(streamUrl, 3600);

        if (!sErr && signedData?.signedUrl) {
          streamUrl = signedData.signedUrl;
        }
      } catch (e: any) {
        console.warn("[v2PremiumContentEngine] Replay signed URL note:", e?.message);
      }
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return {
      authorized: true,
      stream_url: streamUrl,
      expires_at: expiresAt,
      recording_status: session.recording_status,
      access_tier: "LIVE_AND_PERMANENT_REPLAY"
    };
  }

  // ==========================================
  // SECTION 3: 30-DAY RETENTION POLICY & CLEANUP JOB
  // ==========================================

  public registerOrdinaryLiveVideo(params: {
    id: string;
    creator_id: string;
    title: string;
    storage_path: string;
    created_at?: string;
  }): OrdinaryLiveVideo {
    const createdAt = params.created_at || new Date().toISOString();
    // Exactly 30 days retention
    const expiresAt = new Date(new Date(createdAt).getTime() + 30 * 86400 * 1000).toISOString();

    const video: OrdinaryLiveVideo = {
      id: params.id,
      creator_id: params.creator_id,
      title: params.title,
      storage_path: params.storage_path,
      created_at: createdAt,
      expires_at: expiresAt,
      is_purged: false
    };

    this.ordinaryLiveVideos.set(video.id, video);
    return video;
  }

  // Runs retention cleanup: ordinary live videos > 30 days are purged;
  // Premium Replays with active permanent replay entitlements survive!
  public executeLiveVideoRetentionCleanupJob(simulatedNowTimestamp?: string): CleanupJobResult {
    const now = simulatedNowTimestamp ? new Date(simulatedNowTimestamp).getTime() : Date.now();
    let ordinaryPurged = 0;
    let premiumProtected = 0;
    let premiumPurged = 0;
    const purgedPaths: string[] = [];
    const protectedSessionIds: string[] = [];

    // 1. Process Ordinary Live Videos
    for (const video of this.ordinaryLiveVideos.values()) {
      if (!video.is_purged) {
        const expiryTime = new Date(video.expires_at).getTime();
        if (now >= expiryTime) {
          video.is_purged = true;
          video.purged_at = new Date(now).toISOString();
          purgedPaths.push(video.storage_path);
          ordinaryPurged++;
        }
      }
    }

    // 2. Process Premium Live Sessions
    for (const session of this.liveSessions.values()) {
      const sessionAge = now - new Date(session.created_at).getTime();
      const isPast30Days = sessionAge >= 30 * 86400 * 1000;

      if (isPast30Days && session.recording_storage_path) {
        // Check if session has active LIVE_AND_PERMANENT_REPLAY entitlements:
        let activeReplayCount = 0;
        for (const p of this.livePurchases.values()) {
          if (p.session_id === session.id && p.status === "COMPLETED" && p.access_tier === "LIVE_AND_PERMANENT_REPLAY") {
            activeReplayCount++;
          }
        }

        if (activeReplayCount > 0 && session.recording_status === "PUBLISHED") {
          // EXPLICITLY PROTECTED: permanent account-based access requires retention!
          session.retention_protected = true;
          protectedSessionIds.push(session.id);
          premiumProtected++;
        } else {
          // NO ACTIVE REPLAY ENTITLEMENTS: purged per 30-day retention!
          purgedPaths.push(session.recording_storage_path);
          session.recording_storage_path = undefined;
          session.recording_status = "NONE";
          session.retention_protected = false;
          premiumPurged++;
        }
      }
    }

    const result: CleanupJobResult = {
      timestamp: new Date(now).toISOString(),
      total_scanned: this.ordinaryLiveVideos.size + this.liveSessions.size,
      ordinary_purged_count: ordinaryPurged,
      premium_replays_protected_count: premiumProtected,
      premium_expired_unentitled_purged_count: premiumPurged,
      purged_file_paths: purgedPaths,
      protected_session_ids: protectedSessionIds
    };

    this.recordAudit({
      action: "LIVE_VIDEO_RETENTION_CLEANUP_EXECUTED",
      actor_id: "system_retention_job",
      actor_role: "SYSTEM",
      target_id: "retention_engine",
      details: result
    });

    return result;
  }

  // Helper queries
  public getViewerPurchases(viewerId: string): { uploaded: PremiumPurchase[]; live: PremiumLivePurchase[] } {
    const uploaded = Array.from(this.purchases.values()).filter(p => p.viewer_id === viewerId);
    const live = Array.from(this.livePurchases.values()).filter(p => p.viewer_id === viewerId);
    return { uploaded, live };
  }

  public getCreatorEarnings(creatorId: string): {
    total_sales: number;
    total_royalties_cents: number;
    uploaded_purchases: PremiumPurchase[];
    live_purchases: PremiumLivePurchase[];
  } {
    let sales = 0;
    let royalties = 0;
    const uploadedPurchases: PremiumPurchase[] = [];
    const livePurchasesList: PremiumLivePurchase[] = [];

    for (const p of this.purchases.values()) {
      if (p.creator_id === creatorId && p.status === "COMPLETED") {
        sales++;
        royalties += p.creator_amount_cents;
        uploadedPurchases.push({ ...p });
      }
    }

    for (const lp of this.livePurchases.values()) {
      if (lp.creator_id === creatorId && lp.status === "COMPLETED") {
        sales++;
        royalties += lp.creator_amount_cents;
        livePurchasesList.push({ ...lp });
      }
    }

    return {
      total_sales: sales,
      total_royalties_cents: royalties,
      uploaded_purchases: uploadedPurchases,
      live_purchases: livePurchasesList
    };
  }

  public getAuditLogs(): any[] {
    return [...this.auditLogs];
  }

  private recordAudit(params: {
    action: string;
    actor_id: string;
    actor_role: string;
    target_id: string;
    details: any;
  }): void {
    this.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action: params.action,
      actor_id: params.actor_id,
      actor_role: params.actor_role,
      target_id: params.target_id,
      timestamp: new Date().toISOString(),
      details: params.details
    });
  }

  public resetForTesting(): void {
    this.contents.clear();
    this.purchases.clear();
    this.entitlements.clear();
    this.liveSessions.clear();
    this.livePurchases.clear();
    this.liveEntitlements.clear();
    this.ordinaryLiveVideos.clear();
    this.idempotencyIndex.clear();
    this.auditLogs = [];
  }
}

export const v2PremiumContentEngine = new V2PremiumContentEngine();
