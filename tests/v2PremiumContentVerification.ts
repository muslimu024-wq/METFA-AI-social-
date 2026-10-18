import { V2PremiumContentEngine } from "../services/v2PremiumContentEngine";
import { V2WalletEngine } from "../services/v2WalletEngine";
import { V2RevenueEngine } from "../services/v2RevenueEngine";

export async function runV2PremiumContentVerification(): Promise<{
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: Array<{ testId: string; name: string; passed: boolean; message: string }>;
}> {
  const walletEngine = new V2WalletEngine();
  const revenueEngine = new V2RevenueEngine();
  const engine = new V2PremiumContentEngine(walletEngine, revenueEngine);

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

  runTest("PPV-12", "Premium Live: Session cancellation issues 100% wallet refunds", () => {
    const cancelSession = engine.createLiveSession({
      creator_id: creatorId,
      title: "Cancelled Masterclass",
      scheduled_start_time: new Date().toISOString(),
      live_price_cents: 2000,
      replay_price_cents: 2000,
      actor_id: creatorId,
      actor_role: "CREATOR"
    }).session!;

    engine.purchaseLiveAccess({
      session_id: cancelSession.id,
      viewer_id: viewerReplayId,
      access_tier: "LIVE_ONLY",
      actor_id: viewerReplayId,
      actor_role: "USER"
    });

    const balanceBefore = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;
    const cancelRes = engine.cancelLiveSession({
      session_id: cancelSession.id,
      reason: "Speaker illness",
      actor_id: creatorId,
      actor_role: "CREATOR"
    });
    const balanceAfter = walletEngine.getWalletByUserId(viewerReplayId)?.available_balance_cents || 0;

    return cancelRes.success && cancelRes.refunded_tickets_count === 1 && balanceAfter === balanceBefore + 2000;
  }, "Cancelled live session issued 100% refund ($20.00) without deleting audit records");

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
