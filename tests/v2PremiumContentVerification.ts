import { V2PremiumContentEngine } from "../services/v2PremiumContentEngine";
import { V2WalletEngine } from "../services/v2WalletEngine";
import { V2RevenueEngine } from "../services/v2RevenueEngine";
import { requireAuth } from "../services/serverAuth";

export async function runV2PremiumContentVerification(): Promise<{
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: Array<{ testId: string; name: string; passed: boolean; message: string }>;
}> {
  const walletEngine = new V2WalletEngine(undefined, { isIsolatedTest: true });
  const revenueEngine = new V2RevenueEngine({ isIsolatedTest: true });
  const engine = new V2PremiumContentEngine(walletEngine, revenueEngine, { isIsolatedTest: true });

  // Setup test revenue period
  revenueEngine.createRevenuePeriod({
    period_name: "2026-PPV-LIVE-PERIOD",
    period_start: "2026-01-01T00:00:00.000Z",
    period_end: "2026-12-31T23:59:59.000Z",
    currency: "USD",
    actor_id: "admin_setup",
    actor_role: "FINANCE_ADMIN"
  });

  const results: Array<{ testId: string; name: string; passed: boolean; message: string }> = [];

  const runTest = (testId: string, name: string, fn: () => boolean | Promise<boolean>, message: string) => {
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res.then(passed => {
          results.push({ testId, name, passed, message });
        }).catch(err => {
          results.push({ testId, name, passed: false, message: `Error: ${err?.message || err}` });
        });
      }
      results.push({ testId, name, passed: Boolean(res), message });
    } catch (err: any) {
      results.push({ testId, name, passed: false, message: `Error: ${err?.message || err}` });
    }
  };

  // Setup Test Users
  const creatorId = "usr_creator_live_01";
  const viewerLiveOnlyId = "usr_viewer_live_only";
  const viewerReplayId = "usr_viewer_replay";
  const poorViewerId = "usr_viewer_poor";

  // Fund viewers with balances
  const fundWallet = (userId: string, amountCents: number) => {
    const w = walletEngine.getOrCreateWallet(userId, "USD");
    walletEngine.postLedgerEntry({
      id: `ledg_fund_${userId}`,
      wallet_id: w.id,
      user_id: userId,
      entry_type: "ADMIN_CORRECTION",
      direction: "CREDIT",
      amount_cents: amountCents,
      currency: "USD",
      source_type: "WALLET",
      source_id: "init",
      idempotency_key: `init_${userId}`,
      status: "POSTED",
      balance_after_cents: amountCents,
      description: "Test initial balance",
      metadata: {},
      created_at: new Date().toISOString()
    });
    walletEngine.reconcileAndApplyAccountState(w.id);
  };

  fundWallet(viewerLiveOnlyId, 10000); // $100.00
  fundWallet(viewerReplayId, 10000);   // $100.00
  fundWallet(poorViewerId, 50);        // $0.50

  // ========================================================
  // PART 1: UPLOADED PREMIUM VIDEOS (3/4/5 min trailer & 80/20 split)
  // ========================================================

  let createdVideoId = "";
  runTest("PPV-01", "Uploaded video: Mandatory creator-selectable 3/4/5-min trailer (180s)", () => {
    const res = engine.createContent({
      creator_id: creatorId,
      title: "Full-Stack Web Architecture 2026",
      description: "Production deep dive.",
      preview_video_url: "https://cdn.metfa.social/posts/trailer_3min.mp4",
      full_video_storage_path: "premium-videos/full_master_4k.mp4",
      free_preview_duration_seconds: 180, // Exactly 3 minutes
      price_cents: 1000, // $10.00
      actor_id: creatorId,
      actor_role: "CREATOR"
    });
    if (res.success && res.content) {
      createdVideoId = res.content.id;
      return res.content.free_preview_duration_seconds === 180 && res.content.creator_split_bps === 8000;
    }
    return false;
  }, "Content created with mandatory 180s trailer and default 80% split (8000 BPS)");

  runTest("PPV-02", "Uploaded video: Non-conforming trailer durations rejected", () => {
    const r1 = engine.createContent({
      creator_id: creatorId,
      title: "Bad Trailer",
      preview_video_url: "https://example.com/p.mp4",
      full_video_storage_path: "path.mp4",
      free_preview_duration_seconds: 15, // Illegal: not 180, 240, or 300
      price_cents: 1000,
      actor_id: creatorId,
      actor_role: "CREATOR"
    });
    const r2 = engine.createContent({
      creator_id: creatorId,
      title: "Bad Trailer 2",
      preview_video_url: "https://example.com/p.mp4",
      full_video_storage_path: "path.mp4",
      free_preview_duration_seconds: 60, // Illegal: not 180, 240, or 300
      price_cents: 1000,
      actor_id: creatorId,
      actor_role: "CREATOR"
    });
    return !r1.success && !r2.success && (r1.error || "").includes("3 minutes (180s), 4 minutes (240s), or 5 minutes (300s)");
  }, "Correctly rejected non-conforming trailer durations (15s and 60s)");

  runTest("PPV-03", "Uploaded video: Initial 80% Creator / 20% METFA split verified", () => {
    const purchaseRes = engine.purchaseWithWallet({
      content_id: createdVideoId,
      viewer_id: viewerLiveOnlyId,
      actor_id: viewerLiveOnlyId,
      actor_role: "USER"
    });
    if (!purchaseRes.success || !purchaseRes.purchase) return false;
    // $10.00 total -> $8.00 (800 cents) Creator, $2.00 (200 cents) METFA
    const p = purchaseRes.purchase;
    return p.amount_cents === 1000 && p.creator_amount_cents === 800 && p.platform_fee_cents === 200;
  }, "Verified initial 80% Creator ($8.00) and 20% METFA ($2.00) split on purchase");

  runTest("PPV-04", "Uploaded video: Configurable authorized commission update", () => {
    const updateRes = engine.updateContentCommission({
      content_id: createdVideoId,
      new_creator_split_bps: 8500, // 85% Creator / 15% METFA
      actor_id: "admin_finance",
      actor_role: "FINANCE_ADMIN"
    });
    const unauthRes = engine.updateContentCommission({
      content_id: createdVideoId,
      new_creator_split_bps: 9000,
      actor_id: viewerLiveOnlyId,
      actor_role: "USER"
    });
    return updateRes.success && updateRes.content?.creator_split_bps === 8500 && !unauthRes.success;
  }, "Admin successfully updated commission to 8500 BPS; unauthorized user rejected");

  // ========================================================
  // PART 2: PREMIUM LIVE SESSIONS (Live Only vs Live + Replay)
  // ========================================================

  let liveSessionId = "";
  runTest("PPV-05", "Premium Live: Creator schedules session with Live-Only & Replay pricing", () => {
    const res = engine.createLiveSession({
      creator_id: creatorId,
      title: "Global Tech Keynote & Live Coding 2026",
      description: "Interactive live session with Q&A and exclusive system architecture.",
      scheduled_start_time: new Date(Date.now() + 3600000).toISOString(),
      live_price_cents: 1000,   // $10.00 Live Only
      replay_price_cents: 1500, // $15.00 Live + Permanent Replay
      currency: "USD",
      creator_split_bps: 8000,
      actor_id: creatorId,
      actor_role: "CREATOR_PRO"
    });
    if (res.success && res.session) {
      liveSessionId = res.session.id;
      return res.session.live_price_cents === 1000 && res.session.replay_price_cents === 1500 && res.session.status === "SCHEDULED";
    }
    return false;
  }, "Scheduled live session with $10 Live-Only and $15 Live+Replay pricing");

  runTest("PPV-06", "Premium Live: Viewer A purchases Live Only ticket (80/20 split)", () => {
    const res = engine.purchaseLiveAccess({
      session_id: liveSessionId,
      viewer_id: viewerLiveOnlyId,
      access_tier: "LIVE_ONLY",
      actor_id: viewerLiveOnlyId,
      actor_role: "USER"
    });
    if (!res.success || !res.purchase) return false;
    // $10.00 total -> $8.00 (800 cents) Creator, $2.00 (200 cents) METFA
    const p = res.purchase;
    return p.access_tier === "LIVE_ONLY" && p.amount_cents === 1000 && p.creator_amount_cents === 800 && p.platform_fee_cents === 200;
  }, "Viewer A purchased Live Only ticket for $10 (Creator: $8.00, Platform: $2.00)");

  runTest("PPV-07", "Premium Live: Viewer B purchases Live + Permanent Replay ticket", () => {
    const res = engine.purchaseLiveAccess({
      session_id: liveSessionId,
      viewer_id: viewerReplayId,
      access_tier: "LIVE_AND_PERMANENT_REPLAY",
      actor_id: viewerReplayId,
      actor_role: "USER"
    });
    if (!res.success || !res.purchase) return false;
    // $15.00 total -> $12.00 (1200 cents) Creator, $3.00 (300 cents) METFA
    const p = res.purchase;
    const session = engine.getLiveSession(liveSessionId);
    return p.access_tier === "LIVE_AND_PERMANENT_REPLAY" && p.amount_cents === 1500 && p.creator_amount_cents === 1200 && session?.retention_protected === true;
  }, "Viewer B purchased Live+Replay for $15; session marked retention_protected = true");

  runTest("PPV-08", "Premium Live: Live stream authorization permits both ticket tiers", () => {
    engine.startLiveSession(liveSessionId, creatorId);
    const authViewerA = engine.authorizeLiveStream({ session_id: liveSessionId, user_id: viewerLiveOnlyId });
    const authViewerB = engine.authorizeLiveStream({ session_id: liveSessionId, user_id: viewerReplayId });
    const authUnpurchased = engine.authorizeLiveStream({ session_id: liveSessionId, user_id: poorViewerId });

    return authViewerA.authorized && authViewerB.authorized && !authUnpurchased.authorized && authViewerA.access_tier === "LIVE_ONLY" && authViewerB.access_tier === "LIVE_AND_PERMANENT_REPLAY";
  }, "Live stream access granted to both Live-Only and Live+Replay purchasers; denied to unpurchased");

  await runTest("PPV-09", "Premium Live: Replay access rejected BEFORE recording is published", async () => {
    // Session ended but recording not published
    engine.endLiveSession(liveSessionId, creatorId);
    const res = await engine.authorizeReplayStream({ session_id: liveSessionId, user_id: viewerReplayId });
    return !res.authorized && res.recording_status === "FINALIZING";
  }, "Replay stream honestly denied while recording is still finalizing");

  await runTest("PPV-10", "Premium Live: Replay access granted to Viewer B, DENIED to Viewer A (Live Only)", async () => {
    // Finalize and publish recording
    engine.finalizeAndPublishReplay({
      session_id: liveSessionId,
      recording_storage_path: "premium-videos/live_keynote_final_1080p.mp4",
      actor_id: creatorId,
      actor_role: "CREATOR"
    });

    const resViewerB = await engine.authorizeReplayStream({ session_id: liveSessionId, user_id: viewerReplayId });
    const resViewerA = await engine.authorizeReplayStream({ session_id: liveSessionId, user_id: viewerLiveOnlyId });

    return resViewerB.authorized && Boolean(resViewerB.stream_url) && !resViewerA.authorized && (resViewerA.error || "").includes("Live Only");
  }, "Replay granted to Live+Replay holder; Live-Only holder strictly denied replay access");

  let failSessionId = "";
  runTest("PPV-11", "Premium Live: Recording failure honesty & automatic delta refund", () => {
    // Setup a failed session
    const failSession = engine.createLiveSession({
      creator_id: creatorId,
      title: "Audio Tech Workshop",
      scheduled_start_time: new Date().toISOString(),
      live_price_cents: 1000,
      replay_price_cents: 1400,
      actor_id: creatorId,
      actor_role: "CREATOR"
    }).session!;
    failSessionId = failSession.id;

    engine.purchaseLiveAccess({
      session_id: failSession.id,
      viewer_id: viewerReplayId,
      access_tier: "LIVE_AND_PERMANENT_REPLAY",
      actor_id: viewerReplayId,
      actor_role: "USER"
    });

    const balanceBefore = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;
    const failResult = engine.markRecordingFailed({
      session_id: failSession.id,
      failure_reason: "Encoder packet corruption during broadcast capture",
      actor_id: "admin_ops",
      actor_role: "ADMIN"
    });

    const balanceAfter = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;
    // Replay delta ($14.00 - $10.00 = $4.00 = 400 cents) automatically refunded to viewer wallet!
    const deltaRefunded = balanceAfter === balanceBefore + 400;

    return failResult.success && failResult.refunded_users_count === 1 && deltaRefunded && failSession.recording_status === "FAILED";
  }, "Recording failure handled honestly: $4.00 replay delta automatically refunded to viewer");

  let containedSessionId = "";
  let containedPurchaseId = "";
  runTest("PPV-12", "Phase 2A Containment: Authorized owner/admin cancellation fails closed (503) with zero mutations", () => {
    const cancelSession = engine.createLiveSession({
      creator_id: creatorId,
      title: "Contained Masterclass",
      scheduled_start_time: new Date(Date.now() + 7200000).toISOString(),
      live_price_cents: 2000,
      replay_price_cents: 2500,
      actor_id: creatorId,
      actor_role: "CREATOR"
    }).session!;
    containedSessionId = cancelSession.id;

    const purchaseRes = engine.purchaseLiveAccess({
      session_id: cancelSession.id,
      viewer_id: viewerReplayId,
      access_tier: "LIVE_AND_PERMANENT_REPLAY",
      actor_id: viewerReplayId,
      actor_role: "USER"
    });
    containedPurchaseId = purchaseRes.purchase!.id;

    const viewerBalBefore = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;
    const creatorBalBefore = walletEngine.getWalletByUserId(creatorId)?.available_balance_cents || 0;
    const ledgerCountBefore = walletEngine.listAllLedgerEntries().length;
    const periodBefore = { ...revenueEngine.listPeriods()[0] };
    const updatedBefore = cancelSession.updated_at;

    // Attempt by session creator
    const ownerCancel = engine.cancelLiveSession({
      session_id: cancelSession.id,
      reason: "Speaker illness",
      actor_id: creatorId,
      actor_role: "CREATOR"
    });

    // Attempt by multi-role SUPER_ADMIN (even when roles[0] is non-admin)
    const adminCancel = engine.cancelLiveSession({
      session_id: cancelSession.id,
      reason: "Admin maintenance",
      actor_id: "usr_super_admin_01",
      actor_role: "SUPPORT",
      actor_roles: ["SUPPORT", "SUPER_ADMIN"]
    });

    const sessionAfter = engine.getLiveSession(cancelSession.id)!;
    const purchaseAfter = engine.getViewerPurchases(viewerReplayId).live.find(p => p.id === containedPurchaseId)!;
    const viewerBalAfter = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;
    const creatorBalAfter = walletEngine.getWalletByUserId(creatorId)?.available_balance_cents || 0;
    const ledgerCountAfter = walletEngine.listAllLedgerEntries().length;
    const periodAfter = revenueEngine.listPeriods()[0];

    // Confirm viewer still retains valid stream entitlement
    engine.startLiveSession(cancelSession.id, creatorId);
    const streamAuth = engine.authorizeLiveStream({ session_id: cancelSession.id, user_id: viewerReplayId });

    return (
      ownerCancel.success === false &&
      ownerCancel.code === "SERVICE_UNAVAILABLE" &&
      ownerCancel.statusCode === 503 &&
      ownerCancel.refunded_tickets_count === 0 &&
      ownerCancel.blocker_details?.containment_phase === "PHASE_2A_FAIL_CLOSED" &&
      adminCancel.success === false &&
      adminCancel.code === "SERVICE_UNAVAILABLE" &&
      adminCancel.statusCode === 503 &&
      adminCancel.refunded_tickets_count === 0 &&
      sessionAfter.retention_protected === true &&
      purchaseAfter.status === "COMPLETED" &&
      purchaseAfter.refunded_at === undefined &&
      viewerBalAfter === viewerBalBefore &&
      creatorBalAfter === creatorBalBefore &&
      ledgerCountAfter === ledgerCountBefore &&
      periodAfter.gross_revenue_cents === periodBefore.gross_revenue_cents &&
      periodAfter.refunds_cents === periodBefore.refunds_cents &&
      updatedBefore.length > 0 &&
      streamAuth.authorized === true &&
      streamAuth.access_tier === "LIVE_AND_PERMANENT_REPLAY"
    );
  }, "Owner and Admin cancellation fail closed (503 SERVICE_UNAVAILABLE) without mutating session, purchase, wallets, revenue, or entitlements");

  // ========================================================
  // PART 3: 30-DAY RETENTION POLICY & PRESERVATION OF REPLAYS
  // ========================================================

  runTest("PPV-13", "Retention: Ordinary live video > 30 days is purged; < 30 days preserved", () => {
    const now = Date.now();
    const oldDate = new Date(now - 31 * 86400 * 1000).toISOString(); // 31 days old
    const freshDate = new Date(now - 5 * 86400 * 1000).toISOString(); // 5 days old

    const oldVideo = engine.registerOrdinaryLiveVideo({
      id: "ord_video_old_01",
      creator_id: creatorId,
      title: "Daily Casual Chat #42",
      storage_path: "live-broadcasts/chat_old.mp4",
      created_at: oldDate
    });

    const freshVideo = engine.registerOrdinaryLiveVideo({
      id: "ord_video_fresh_01",
      creator_id: creatorId,
      title: "Daily Casual Chat #43",
      storage_path: "live-broadcasts/chat_fresh.mp4",
      created_at: freshDate
    });

    // Run cleanup job
    const cleanup = engine.executeLiveVideoRetentionCleanupJob();

    return oldVideo.is_purged === true && freshVideo.is_purged === false && cleanup.ordinary_purged_count >= 1 && cleanup.purged_file_paths.includes(oldVideo.storage_path);
  }, "Ordinary live video > 30 days purged; fresh video < 30 days preserved");

  runTest("PPV-14", "Retention: Premium Replay with active entitlements SURVIVES 30-day cleanup", () => {
    // Take liveSessionId (which has viewerReplayId holding LIVE_AND_PERMANENT_REPLAY)
    // Simulate time advancing to 35 days in the future:
    const future35Days = new Date(Date.now() + 35 * 86400 * 1000).toISOString();

    const cleanupResult = engine.executeLiveVideoRetentionCleanupJob(future35Days);
    const sessionAfter = engine.getLiveSession(liveSessionId);

    // Recording must NOT be deleted; must be in protected_session_ids
    const survives = sessionAfter?.recording_status === "PUBLISHED" && sessionAfter?.retention_protected === true && cleanupResult.protected_session_ids.includes(liveSessionId);

    return survives;
  }, "Premium Replay recording with permanent viewer entitlement explicitly survived 30-day cleanup");

  runTest("PPV-15", "Retention: General 30-day cleanup remains globally active & cleans unentitled live files", () => {
    // Create an unentitled expired live session (0 purchases)
    const unentitledPastSession = engine.createLiveSession({
      creator_id: creatorId,
      title: "Old Unsold Broadcast",
      scheduled_start_time: new Date(Date.now() - 40 * 86400 * 1000).toISOString(),
      live_price_cents: 500,
      replay_price_cents: 500,
      actor_id: creatorId,
      actor_role: "CREATOR"
    }).session!;

    // Artificially backdate created_at to 40 days ago
    unentitledPastSession.created_at = new Date(Date.now() - 40 * 86400 * 1000).toISOString();
    unentitledPastSession.status = "ENDED";
    unentitledPastSession.recording_status = "PUBLISHED";
    unentitledPastSession.recording_storage_path = "premium-videos/unsold_stream.mp4";

    const cleanup = engine.executeLiveVideoRetentionCleanupJob();

    return cleanup.premium_expired_unentitled_purged_count >= 1 && cleanup.purged_file_paths.includes("premium-videos/unsold_stream.mp4") && unentitledPastSession.recording_status === "NONE";
  }, "Unentitled expired live session purged by cleanup job; general 30-day policy enforced");

  // ========================================================
  // PART 4: PHASE 2A CANCELLATION SECURITY & ROUTE CONTAINMENT
  // ========================================================

  runTest("PPV-17", "Security Containment: Non-owner users and AI actors rejected (403 FORBIDDEN) with zero mutations", () => {
    const targetSession = engine.getLiveSession(containedSessionId)!;
    const statusBefore = targetSession.status;
    const viewerBalBefore = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;
    const creatorBalBefore = walletEngine.getWalletByUserId(creatorId)?.available_balance_cents || 0;
    const ledgerCountBefore = walletEngine.listAllLedgerEntries().length;
    const periodBefore = { ...revenueEngine.listPeriods()[0] };

    const regularUserAttempt = engine.cancelLiveSession({
      session_id: containedSessionId,
      reason: "Malicious non-owner cancel",
      actor_id: "usr_attacker_non_owner",
      actor_role: "USER",
      actor_roles: ["USER"]
    });

    const operatorAttempt = engine.cancelLiveSession({
      session_id: containedSessionId,
      reason: "Operator non-owner cancel",
      actor_id: "usr_operator_non_owner",
      actor_role: "OPERATOR",
      actor_roles: ["OPERATOR", "SUPPORT"]
    });

    const aiAttempt = engine.cancelLiveSession({
      session_id: containedSessionId,
      reason: "Automated AI cancel",
      actor_id: creatorId,
      actor_role: "AI_AGENT",
      actor_roles: ["CREATOR", "AI_AGENT"]
    });

    const sessionAfter = engine.getLiveSession(containedSessionId)!;
    const purchaseAfter = engine.getViewerPurchases(viewerReplayId).live.find(p => p.id === containedPurchaseId)!;
    const streamAuth = engine.authorizeLiveStream({ session_id: containedSessionId, user_id: viewerReplayId });

    return (
      !regularUserAttempt.success &&
      regularUserAttempt.code === "FORBIDDEN" &&
      regularUserAttempt.statusCode === 403 &&
      regularUserAttempt.refunded_tickets_count === 0 &&
      !operatorAttempt.success &&
      operatorAttempt.code === "FORBIDDEN" &&
      operatorAttempt.statusCode === 403 &&
      !aiAttempt.success &&
      aiAttempt.code === "FORBIDDEN" &&
      aiAttempt.statusCode === 403 &&
      sessionAfter.status === statusBefore &&
      purchaseAfter.status === "COMPLETED" &&
      walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents === viewerBalBefore &&
      walletEngine.getWalletByUserId(creatorId)?.available_balance_cents === creatorBalBefore &&
      walletEngine.listAllLedgerEntries().length === ledgerCountBefore &&
      revenueEngine.listPeriods()[0].gross_revenue_cents === periodBefore.gross_revenue_cents &&
      revenueEngine.listPeriods()[0].refunds_cents === periodBefore.refunds_cents &&
      streamAuth.authorized === true
    );
  }, "Non-owner users, operators, and AI actors strictly denied (403) with zero state or ledger changes");

  runTest("PPV-18", "Security Containment: Post-delta-refund over-refund & creator negative-balance clawback blocked", () => {
    const creatorWalletBeforeHold = walletEngine.getWalletByUserId(creatorId)!;
    const holdAmount = creatorWalletBeforeHold.available_balance_cents;
    const holdRes = walletEngine.holdForPayout({
      user_id: creatorId,
      amount_cents: holdAmount,
      currency: "USD",
      payout_request_id: "payout_containment_check_01",
      actor_id: creatorId,
      actor_role: "CREATOR"
    });

    const viewerBalBefore = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;
    const creatorAvailBefore = walletEngine.getWalletByUserId(creatorId)?.available_balance_cents || 0;
    const ledgerCountBefore = walletEngine.listAllLedgerEntries().length;

    // Attempt Phase 1 exploit sequence on failSessionId (already delta-refunded in PPV-11)
    const attackerCancel = engine.cancelLiveSession({
      session_id: failSessionId,
      reason: "Attempted over-refund & negative clawback",
      actor_id: "usr_attacker_02",
      actor_role: "USER"
    });
    const creatorCancel = engine.cancelLiveSession({
      session_id: failSessionId,
      reason: "Host cancel after recording failure",
      actor_id: creatorId,
      actor_role: "CREATOR"
    });

    const failSessionAfter = engine.getLiveSession(failSessionId)!;
    const creatorWalletAfter = walletEngine.getWalletByUserId(creatorId)!;
    const viewerBalAfter = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;

    return (
      holdRes.success === true &&
      creatorAvailBefore === 0 &&
      !attackerCancel.success &&
      attackerCancel.statusCode === 403 &&
      !creatorCancel.success &&
      creatorCancel.statusCode === 503 &&
      failSessionAfter.recording_status === "FAILED" &&
      failSessionAfter.status !== "CANCELLED" &&
      viewerBalAfter === viewerBalBefore &&
      creatorWalletAfter.available_balance_cents === 0 &&
      creatorWalletAfter.locked_balance_cents === holdAmount &&
      walletEngine.listAllLedgerEntries().length === ledgerCountBefore
    );
  }, "Blocked post-failure over-refund (+400c) and blocked negative creator balance (-clawback) under payout hold");

  await runTest("PPV-19", "HTTP Route Containment: POST /api/v2/premium/live/sessions/:id/cancel enforces 401/403/503 without mutations", async () => {
    const createMockRes = () => {
      const mock: { statusCode: number; body: any; status: (c: number) => any; json: (b: any) => any } = {
        statusCode: 200,
        body: null,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.body = payload;
          return this;
        }
      };
      return mock;
    };

    const ledgerCountBefore = walletEngine.listAllLedgerEntries().length;
    const statusBefore = engine.getLiveSession(containedSessionId)?.status;

    // 1. Unauthenticated request through requireAuth middleware -> 401
    const unauthReq: any = { headers: {}, params: { id: containedSessionId }, body: { reason: "No token" } };
    const unauthRes = createMockRes();
    let nextCalled = false;
    await requireAuth(unauthReq, unauthRes as any, () => {
      nextCalled = true;
    });

    // 2. Authenticated non-owner through handleCancelRequest -> 403
    const nonOwnerRes = createMockRes();
    engine.handleCancelRequest(
      {
        params: { id: containedSessionId },
        body: { reason: "Unauthorized HTTP cancel" },
        v2Auth: { userId: "usr_http_stranger", roles: ["USER"] }
      },
      nonOwnerRes
    );

    // 3. Authenticated session creator through handleCancelRequest -> 503
    const ownerRes = createMockRes();
    engine.handleCancelRequest(
      {
        params: { id: containedSessionId },
        body: { reason: "Creator HTTP cancel" },
        v2Auth: { userId: creatorId, roles: ["CREATOR_PRO"] }
      },
      ownerRes
    );

    // 4. Authenticated multi-role Admin through handleCancelRequest -> 503
    const adminRes = createMockRes();
    engine.handleCancelRequest(
      {
        params: { id: containedSessionId },
        body: { reason: "Admin HTTP cancel" },
        v2Auth: { userId: "usr_http_admin", roles: ["ANALYST", "ADMIN"] }
      },
      adminRes
    );

    // 5. Unknown session ID through disabled route -> 503 (never 200)
    const unknownRes = createMockRes();
    engine.handleCancelRequest(
      {
        params: { id: "non_existent_session_uuid" },
        body: { reason: "Probe" },
        v2Auth: { userId: "usr_http_stranger", roles: ["USER"] }
      },
      unknownRes
    );

    return (
      nextCalled === false &&
      unauthRes.statusCode === 401 &&
      nonOwnerRes.statusCode === 403 &&
      nonOwnerRes.body?.success === false &&
      nonOwnerRes.body?.code === "FORBIDDEN" &&
      ownerRes.statusCode === 503 &&
      ownerRes.body?.success === false &&
      ownerRes.body?.code === "SERVICE_UNAVAILABLE" &&
      adminRes.statusCode === 503 &&
      adminRes.body?.success === false &&
      adminRes.body?.code === "SERVICE_UNAVAILABLE" &&
      unknownRes.statusCode === 503 &&
      unknownRes.body?.success === false &&
      engine.getLiveSession(containedSessionId)?.status === statusBefore &&
      walletEngine.listAllLedgerEntries().length === ledgerCountBefore
    );
  }, "HTTP route returns 401 (unauthenticated), 403 (non-owner), and 503 (disabled for owner/admin/unknown) with zero mutations");

  runTest("PPV-16", "Financial Integrity: 100% wallet reconciliation across all transactions", () => {
    const rA = walletEngine.reconcileWallet(walletEngine.getOrCreateWallet(viewerLiveOnlyId).id);
    const rB = walletEngine.reconcileWallet(walletEngine.getOrCreateWallet(viewerReplayId).id);
    const rCreator = walletEngine.reconcileWallet(walletEngine.getOrCreateWallet(creatorId).id);

    return rA.is_reconciled && rB.is_reconciled && rCreator.is_reconciled && rA.discrepancies.length === 0 && rB.discrepancies.length === 0 && rCreator.discrepancies.length === 0;
  }, "All viewer and creator wallets reconciled with zero discrepancies across all PPV & Live actions");

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const allPassed = failedTests === 0;

  return {
    passed: allPassed,
    totalTests,
    passedTests,
    failedTests,
    results
  };
}
