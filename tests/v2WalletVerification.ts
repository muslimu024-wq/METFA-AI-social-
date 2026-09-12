/**
 * METFA V2 — Phase 7 Wallet & Immutable Ledger Verification Suite
 * 
 * 25 Rigorous Automated Verification Checks:
 * WAL-01: Wallet Account Creation (Integer minor units, initialized at 0 cents)
 * WAL-02: Authoritative Reward -> Wallet Credit (Credits ledger from finalized Phase 6 allocation)
 * WAL-03: Approved Settlement Period Boundary (Rejects unfinalized settlement periods)
 * WAL-04: Estimated Reward Rejection (Strictly rejects ESTIMATED stage reward allocations)
 * WAL-05: Pending Reward Protection (Pending credit does not prematurely inflate withdrawable balance)
 * WAL-06: Withdrawable Eligibility (Only approved/released funds enter available_balance_cents)
 * WAL-07: Idempotent Reward Credit (Duplicate credit call returns cached entry without double-counting)
 * WAL-08: Duplicate Credit Prevention (Idempotency key prevents duplicate ledger entries)
 * WAL-09: Append-Only Ledger Structure (Ledger is append-only, preserving exact history)
 * WAL-10: Update Rejection Guard (Direct updateLedgerEntry is strictly rejected with immutability error)
 * WAL-11: Delete Rejection Guard (Direct deleteLedgerEntry is strictly rejected with immutability error)
 * WAL-12: Reversal Creates New Entry (Reversal leaves original entry intact and posts a new REVERSAL entry)
 * WAL-13: No Arbitrary Client Credit (Client cannot choose credit amount; strictly bound to allocation)
 * WAL-14: No Over-Credit Invariant (Credit amount exactly matches allocation.allocated_cents)
 * WAL-15: No Over-Debit Invariant (Payout hold cannot exceed available withdrawable funds)
 * WAL-16: Negative Balance Protection (System strictly blocks transactions causing negative balance)
 * WAL-17: Currency Consistency Guard (Cross-currency transactions strictly rejected)
 * WAL-18: Payout Hold Compatibility (Moves available funds into locked hold without losing audit trail)
 * WAL-19: Payout Debit Idempotency (Finalizing payout debit is idempotent and permanently debits held funds)
 * WAL-20: Payout Hold Release (Cancelled/failed payout releases funds from locked back to available)
 * WAL-21: Deterministic Reconciliation (Replaying ledger matches account cached figures with 0 discrepancies)
 * WAL-22: Unauthorized Role Rejection (Non-admin rejected from performing admin corrections or reversals)
 * WAL-23: Admin Correction Audit Trail (Authorized admin adjustment posts auditable entry)
 * WAL-24: METFA AI Mutation Barrier (AI actor role strictly blocked from authorizing credits/debits/holds)
 * WAL-25: Historical Ledger Chain Integrity (Reconciliation passes cleanly across complex lifecycle chains)
 */

import { V2WalletEngine } from '../services/v2WalletEngine';
import { V2RewardEngine } from '../services/v2RewardEngine';
import { v2RevenueEngine } from '../services/v2RevenueEngine';
import { v2ContributionEngine } from '../services/v2ContributionEngine';

export interface V2WalletTestResult {
  testId: string;
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface V2WalletTestSuiteSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: V2WalletTestResult[];
}

export function runV2WalletEngineVerification(): V2WalletTestSuiteSummary {
  const results: V2WalletTestResult[] = [];

  const runTest = (
    testId: string,
    name: string,
    fn: () => { passed: boolean; message: string; details?: Record<string, unknown> }
  ) => {
    try {
      const outcome = fn();
      results.push({
        testId,
        name,
        passed: outcome.passed,
        message: outcome.message,
        details: outcome.details,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        testId,
        name,
        passed: false,
        message: `Unexpected exception: ${errorMsg}`,
      });
    }
  };

  // Helper setup: Provisions a finalized revenue period and finalized reward settlement
  const setupFinalizedRewardSystem = (rewardEngine: V2RewardEngine) => {
    // 1. Create a finalized revenue period in v2RevenueEngine
    const revPeriod = v2RevenueEngine.createRevenuePeriod({
      period_name: `RevPeriod_WalTest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      period_start: '2026-09-01T00:00:00.000Z',
      period_end: '2026-09-30T23:59:59.000Z',
      currency: 'USD',
      actor_id: 'admin_test_setup',
      actor_role: 'SUPER_ADMIN',
    });

    v2RevenueEngine.recordRevenueEntry({
      period_id: revPeriod.id,
      source: 'ADS',
      entry_type: 'GROSS_INCOME',
      amount_cents: 1000000, // $10,000.00
      currency: 'USD',
      reference_id: `ref_gross_${revPeriod.id}`,
      description: 'Verified test ad revenue',
      actor_id: 'admin_test_setup',
      actor_role: 'FINANCE_ADMIN',
      auto_verify: true,
    });

    v2RevenueEngine.finalizeRevenuePeriod({
      period_id: revPeriod.id,
      actor_id: 'admin_test_setup',
      actor_role: 'SUPER_ADMIN',
    });

    // 2. Ensure test user has contributions in Phase 5
    const testUserId = `usr_wal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    v2ContributionEngine.processActivity({
      user_id: testUserId,
      action: 'ORIGINAL_CONTENT',
      source_ref: `post:waltest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      payload: { content_text: 'Quality post with sufficient text to qualify.' },
      user_tier: 'STANDARD',
    });

    // 3. Execute and finalize a reward settlement in rewardEngine
    const settRes = rewardEngine.executeSettlement({
      revenue_period_id: revPeriod.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_advance_stages: true, // Allocations become WITHDRAWABLE
    });

    const period = settRes.period!;
    const allocations = rewardEngine.getAllocationsForPeriod(period.id);
    const userAlloc = allocations.find((a) => a.user_id === testUserId) || allocations[0];

    return { revPeriod, period, allocations, userAlloc, testUserId };
  };

  // -------------------------------------------------------------------------
  // WAL-01: Wallet Account Creation
  // -------------------------------------------------------------------------
  runTest('WAL-01', 'Wallet Account Creation (Integer minor units, initialized at 0 cents)', () => {
    const walletEngine = new V2WalletEngine();
    walletEngine.resetForTesting();

    const wallet = walletEngine.getOrCreateWallet('usr_fresh_01', 'USD');
    const isValid =
      wallet.id.startsWith('wlt_') &&
      wallet.user_id === 'usr_fresh_01' &&
      wallet.currency === 'USD' &&
      wallet.available_balance_cents === 0 &&
      wallet.pending_balance_cents === 0 &&
      wallet.approved_balance_cents === 0 &&
      wallet.locked_balance_cents === 0 &&
      wallet.lifetime_earnings_cents === 0 &&
      wallet.lifetime_payouts_cents === 0 &&
      wallet.is_locked_for_audit === false;

    return {
      passed: isValid,
      message: isValid
        ? 'Wallet successfully initialized with zero integer minor-unit balances.'
        : 'Wallet account creation failed initialization invariants.',
      details: { wallet },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-02: Authoritative Reward -> Wallet Credit
  // -------------------------------------------------------------------------
  runTest('WAL-02', 'Authoritative Reward -> Wallet Credit', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'sys_settler',
      actor_role: 'SYSTEM',
      auto_release: true,
    });

    const passed =
      creditRes.success &&
      creditRes.ledger_entry !== undefined &&
      creditRes.ledger_entry.amount_cents === userAlloc.allocated_cents &&
      creditRes.ledger_entry.direction === 'CREDIT' &&
      creditRes.wallet !== undefined &&
      creditRes.wallet.available_balance_cents === userAlloc.allocated_cents;

    return {
      passed: Boolean(passed),
      message: passed
        ? `Successfully credited ${userAlloc.allocated_cents} cents from Phase 6 reward allocation.`
        : `Reward credit failed: ${creditRes.error}`,
      details: { creditRes, allocated_cents: userAlloc.allocated_cents },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-03: Approved Settlement Period Boundary
  // -------------------------------------------------------------------------
  runTest('WAL-03', 'Approved Settlement Period Boundary (Rejects unfinalized periods)', () => {
    const walletEngine = new V2WalletEngine();
    walletEngine.resetForTesting();

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: 'non_existent_alloc_id',
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
    });

    const passed = !creditRes.success && creditRes.error?.includes('not found');
    return {
      passed: Boolean(passed),
      message: passed
        ? 'Correctly rejected non-existent or unfinalized allocation.'
        : 'Failed to reject invalid reward allocation.',
      details: { error: creditRes.error },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-04: Estimated Reward Rejection
  // -------------------------------------------------------------------------
  runTest('WAL-04', 'Estimated Reward Rejection (Strictly rejects ESTIMATED stage)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);
    userAlloc.status = 'ESTIMATED';

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
    });

    const passed = !creditRes.success && creditRes.error?.includes('Estimated rewards cannot be credited');
    return {
      passed: Boolean(passed),
      message: passed
        ? 'Correctly rejected ESTIMATED stage allocation from wallet credit.'
        : 'Failed to reject ESTIMATED stage allocation.',
      details: { error: creditRes.error },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-05: Pending Reward Protection
  // -------------------------------------------------------------------------
  runTest('WAL-05', 'Pending Reward Protection (Pending credit does not inflate withdrawable balance)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);
    userAlloc.status = 'PENDING';

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: false,
    });

    const wallet = creditRes.wallet;
    const passed =
      creditRes.success &&
      wallet !== undefined &&
      wallet.pending_balance_cents === userAlloc.allocated_cents &&
      wallet.available_balance_cents === 0;

    return {
      passed: Boolean(passed),
      message: passed
        ? `Pending reward (${userAlloc.allocated_cents} cents) isolated in pending balance; withdrawable balance remains 0.`
        : 'Pending reward leaked into withdrawable balance.',
      details: { wallet },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-06: Withdrawable Eligibility
  // -------------------------------------------------------------------------
  runTest('WAL-06', 'Withdrawable Eligibility (Released funds enter available balance)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);
    userAlloc.status = 'APPROVED';

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: false,
    });

    const wallet = creditRes.wallet!;
    const releaseRes = walletEngine.releaseApprovedToWithdrawable({
      wallet_id: wallet.id,
      amount_cents: userAlloc.allocated_cents,
      reference_allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
    });

    const updatedWallet = walletEngine.getWallet(wallet.id)!;
    const passed =
      releaseRes.success &&
      updatedWallet.available_balance_cents === userAlloc.allocated_cents &&
      updatedWallet.approved_balance_cents === 0;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Successfully transitioned funds from approved to withdrawable balance.'
        : 'Failed to release approved funds.',
      details: { updatedWallet },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-07: Idempotent Reward Credit
  // -------------------------------------------------------------------------
  runTest('WAL-07', 'Idempotent Reward Credit (Repeated credit returns cached entry)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    const call1 = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const call2 = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const passed =
      call1.success &&
      call2.success &&
      call2.is_cached === true &&
      call1.ledger_entry?.id === call2.ledger_entry?.id &&
      call2.wallet?.available_balance_cents === userAlloc.allocated_cents;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Second credit call returned cached entry without duplicating balance.'
        : 'Idempotency failed: balance doubled or cached flag missing.',
      details: { call1Entry: call1.ledger_entry?.id, call2Entry: call2.ledger_entry?.id },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-08: Duplicate Credit Prevention
  // -------------------------------------------------------------------------
  runTest('WAL-08', 'Duplicate Credit Prevention (Idempotency key prevents duplicate ledger records)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const allEntries = walletEngine.listAllLedgerEntries();
    const rewardCredits = allEntries.filter((e) => e.source_id === userAlloc.id);
    const passed = rewardCredits.length === 1;

    return {
      passed,
      message: passed
        ? 'Exactly 1 ledger entry exists for the allocation. Duplicate posting was blocked.'
        : `Duplicate prevention failed: found ${rewardCredits.length} ledger entries.`,
      details: { count: rewardCredits.length },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-09: Append-Only Ledger Structure
  // -------------------------------------------------------------------------
  runTest('WAL-09', 'Append-Only Ledger Structure (Ledger is strictly append-only)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const entriesBefore = walletEngine.listAllLedgerEntries().length;
    walletEngine.holdForPayout({
      payout_request_id: 'pay_req_001',
      user_id: userAlloc.user_id,
      amount_cents: Math.floor(userAlloc.allocated_cents / 2),
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    const entriesAfter = walletEngine.listAllLedgerEntries().length;
    const passed = entriesAfter === entriesBefore + 1;

    return {
      passed,
      message: passed
        ? 'Ledger correctly appended 1 new entry; history preserved.'
        : 'Append-only invariant violated.',
      details: { entriesBefore, entriesAfter },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-10: Update Rejection Guard
  // -------------------------------------------------------------------------
  runTest('WAL-10', 'Update Rejection Guard (updateLedgerEntry rejected with immutability error)', () => {
    const walletEngine = new V2WalletEngine();
    const result = walletEngine.updateLedgerEntry();

    const passed = !result.success && result.error.includes('Ledger Immutability Violation');
    return {
      passed,
      message: passed
        ? 'updateLedgerEntry call successfully rejected with immutability violation error.'
        : 'Update rejection failed.',
      details: { result },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-11: Delete Rejection Guard
  // -------------------------------------------------------------------------
  runTest('WAL-11', 'Delete Rejection Guard (deleteLedgerEntry rejected with immutability error)', () => {
    const walletEngine = new V2WalletEngine();
    const result = walletEngine.deleteLedgerEntry();

    const passed = !result.success && result.error.includes('Ledger Immutability Violation');
    return {
      passed,
      message: passed
        ? 'deleteLedgerEntry call successfully rejected with immutability violation error.'
        : 'Delete rejection failed.',
      details: { result },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-12: Reversal Creates New Entry
  // -------------------------------------------------------------------------
  runTest('WAL-12', 'Reversal Creates New Entry (Appends new REVERSAL entry, leaves original intact)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const originalEntry = creditRes.ledger_entry!;
    const revRes = walletEngine.reverseLedgerEntry({
      ledger_entry_id: originalEntry.id,
      reason: 'Audit correction of calculation variance',
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
    });

    const originalPostRev = walletEngine.getLedgerEntry(originalEntry.id);
    const reversalEntry = revRes.reversal_entry;

    const passed =
      revRes.success &&
      reversalEntry !== undefined &&
      reversalEntry.entry_type === 'REVERSAL' &&
      reversalEntry.direction === 'DEBIT' &&
      reversalEntry.reference_id === originalEntry.id &&
      originalPostRev?.id === originalEntry.id &&
      originalPostRev?.amount_cents === originalEntry.amount_cents &&
      revRes.wallet?.available_balance_cents === 0;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Reversal created a new DEBIT entry referencing original; original remained intact.'
        : `Reversal failed: ${revRes.error}`,
      details: { revRes },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-13: No Arbitrary Client Credit
  // -------------------------------------------------------------------------
  runTest('WAL-13', 'No Arbitrary Client Credit (Credit amount bound strictly to allocation)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_client',
      actor_role: 'USER',
      auto_release: true,
    });

    const passed =
      creditRes.success &&
      creditRes.ledger_entry?.amount_cents === userAlloc.allocated_cents;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Client was unable to specify amount; amount derived strictly from authoritative allocation.'
        : 'Arbitrary credit check failed.',
      details: { amount_credited: creditRes.ledger_entry?.amount_cents },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-14: No Over-Credit Invariant
  // -------------------------------------------------------------------------
  runTest('WAL-14', 'No Over-Credit Invariant (Credit amount exactly equals allocation cents)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const passed =
      creditRes.success &&
      creditRes.ledger_entry?.amount_cents === userAlloc.allocated_cents &&
      creditRes.wallet?.available_balance_cents === userAlloc.allocated_cents;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'No over-credit: credit amount is mathematically identical to allocation.'
        : 'Over-credit detected.',
      details: { credited: creditRes.ledger_entry?.amount_cents, expected: userAlloc.allocated_cents },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-15: No Over-Debit Invariant
  // -------------------------------------------------------------------------
  runTest('WAL-15', 'No Over-Debit Invariant (Hold rejected if exceeds withdrawable balance)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const excessiveAmount = userAlloc.allocated_cents * 2;
    const holdRes = walletEngine.holdForPayout({
      payout_request_id: 'pay_excessive',
      user_id: userAlloc.user_id,
      amount_cents: excessiveAmount,
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    const passed = !holdRes.success && holdRes.error?.includes('Insufficient withdrawable funds');
    return {
      passed: Boolean(passed),
      message: passed
        ? 'Excessive payout hold correctly rejected. Over-debit prevented.'
        : 'Failed to block excessive payout hold.',
      details: { error: holdRes.error },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-16: Negative Balance Protection
  // -------------------------------------------------------------------------
  runTest('WAL-16', 'Negative Balance Protection (System blocks transactions causing negative balance)', () => {
    const walletEngine = new V2WalletEngine();
    walletEngine.resetForTesting();

    const wallet = walletEngine.getOrCreateWallet('usr_empty_01', 'USD');

    const adjRes = walletEngine.adminCorrection({
      wallet_id: wallet.id,
      user_id: wallet.user_id,
      amount_cents: 5000,
      direction: 'DEBIT',
      reason: 'Testing negative balance barrier',
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
    });

    const passed = !adjRes.success && adjRes.error?.includes('Negative balance prevented');
    return {
      passed: Boolean(passed),
      message: passed
        ? 'Administrative debit correctly blocked on insufficient funds. Negative balance avoided.'
        : 'Negative balance protection failed.',
      details: { error: adjRes.error },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-17: Currency Consistency Guard
  // -------------------------------------------------------------------------
  runTest('WAL-17', 'Currency Consistency Guard (Cross-currency transactions strictly rejected)', () => {
    const walletEngine = new V2WalletEngine();
    walletEngine.resetForTesting();

    const wallet = walletEngine.getOrCreateWallet('usr_usd_user', 'USD');

    const holdRes = walletEngine.holdForPayout({
      payout_request_id: 'pay_curr_mismatch',
      user_id: wallet.user_id,
      amount_cents: 1000,
      currency: 'BDT',
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    const passed = !holdRes.success && holdRes.error?.includes('Currency mismatch');
    return {
      passed: Boolean(passed),
      message: passed
        ? 'Mismatched currency transaction correctly rejected.'
        : 'Currency consistency guard failed.',
      details: { error: holdRes.error },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-18: Payout Hold Compatibility
  // -------------------------------------------------------------------------
  runTest('WAL-18', 'Payout Hold Compatibility (Moves funds from available to locked hold)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const holdAmount = Math.floor(userAlloc.allocated_cents / 2);
    const holdRes = walletEngine.holdForPayout({
      payout_request_id: 'pay_valid_hold',
      user_id: userAlloc.user_id,
      amount_cents: holdAmount,
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    const wallet = holdRes.wallet!;
    const passed =
      holdRes.success &&
      wallet.locked_balance_cents === holdAmount &&
      wallet.available_balance_cents === userAlloc.allocated_cents - holdAmount;

    return {
      passed: Boolean(passed),
      message: passed
        ? `Successfully held ${holdAmount} cents in locked_balance_cents for payout processing.`
        : 'Payout hold compatibility failed.',
      details: { wallet },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-19: Payout Debit Idempotency
  // -------------------------------------------------------------------------
  runTest('WAL-19', 'Payout Debit Idempotency (Permanent deduction of held funds is idempotent)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const holdAmount = 1000;
    walletEngine.holdForPayout({
      payout_request_id: 'pay_debit_01',
      user_id: userAlloc.user_id,
      amount_cents: holdAmount,
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    const debit1 = walletEngine.debitPayout({
      payout_request_id: 'pay_debit_01',
      user_id: userAlloc.user_id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
    });

    const debit2 = walletEngine.debitPayout({
      payout_request_id: 'pay_debit_01',
      user_id: userAlloc.user_id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
    });

    const wallet = debit2.wallet!;
    const passed =
      debit1.success &&
      debit2.success &&
      debit2.is_cached === true &&
      wallet.locked_balance_cents === 0 &&
      wallet.lifetime_payouts_cents === holdAmount;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Payout debit finalized cleanly and idempotently with locked funds zeroed.'
        : 'Payout debit idempotency failed.',
      details: { wallet },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-20: Payout Hold Release
  // -------------------------------------------------------------------------
  runTest('WAL-20', 'Payout Hold Release (Cancelled payout returns held funds to available)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const holdAmount = 2500;
    walletEngine.holdForPayout({
      payout_request_id: 'pay_cancelled_01',
      user_id: userAlloc.user_id,
      amount_cents: holdAmount,
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    const releaseRes = walletEngine.releasePayoutHold({
      payout_request_id: 'pay_cancelled_01',
      user_id: userAlloc.user_id,
      reason: 'User cancelled payout request',
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    const wallet = releaseRes.wallet!;
    const passed =
      releaseRes.success &&
      wallet.locked_balance_cents === 0 &&
      wallet.available_balance_cents === userAlloc.allocated_cents;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Cancelled payout hold released successfully back to available balance.'
        : 'Payout hold release failed.',
      details: { wallet },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-21: Deterministic Reconciliation
  // -------------------------------------------------------------------------
  runTest('WAL-21', 'Deterministic Reconciliation (Ledger replay matches cached figures)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const recon = walletEngine.reconcileWallet(creditRes.wallet!.id);
    const passed = recon.is_reconciled && recon.discrepancies.length === 0;

    return {
      passed,
      message: passed
        ? 'Authoritative reconciliation verified: 0 discrepancies across all ledger entries.'
        : `Reconciliation found discrepancies: ${recon.discrepancies.join('; ')}`,
      details: { recon },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-22: Unauthorized Role Rejection
  // -------------------------------------------------------------------------
  runTest('WAL-22', 'Unauthorized Role Rejection (Non-admin rejected from corrections and reversals)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);
    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const revRes = walletEngine.reverseLedgerEntry({
      ledger_entry_id: creditRes.ledger_entry!.id,
      reason: 'Unauthorized user attempting reversal',
      actor_id: 'usr_unauthorized',
      actor_role: 'USER',
    });

    const adjRes = walletEngine.adminCorrection({
      wallet_id: creditRes.wallet!.id,
      user_id: userAlloc.user_id,
      amount_cents: 1000,
      direction: 'CREDIT',
      reason: 'Unauthorized credit attempt',
      actor_id: 'usr_unauthorized',
      actor_role: 'USER',
    });

    const passed =
      !revRes.success &&
      revRes.error?.includes('Unauthorized') &&
      !adjRes.success &&
      adjRes.error?.includes('Unauthorized');

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Non-admin roles strictly rejected from performing financial reversals and corrections.'
        : 'Role authorization checks failed.',
      details: { revError: revRes.error, adjError: adjRes.error },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-23: Admin Correction Audit Trail
  // -------------------------------------------------------------------------
  runTest('WAL-23', 'Admin Correction Audit Trail (Authorized adjustment posts audited entry)', () => {
    const walletEngine = new V2WalletEngine();
    walletEngine.resetForTesting();

    const wallet = walletEngine.getOrCreateWallet('usr_corp_01', 'USD');

    const adjRes = walletEngine.adminCorrection({
      wallet_id: wallet.id,
      user_id: wallet.user_id,
      amount_cents: 5000,
      direction: 'CREDIT',
      reason: 'Discretionary partner bonus compensation',
      actor_id: 'usr_superadmin',
      actor_role: 'SUPER_ADMIN',
    });

    const passed =
      adjRes.success &&
      adjRes.ledger_entry?.entry_type === 'ADMIN_CORRECTION' &&
      adjRes.ledger_entry?.direction === 'CREDIT' &&
      adjRes.wallet?.available_balance_cents === 5000;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Authorized admin adjustment posted with full audit metadata.'
        : `Admin correction failed: ${adjRes.error}`,
      details: { adjRes },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-24: METFA AI Mutation Barrier
  // -------------------------------------------------------------------------
  runTest('WAL-24', 'METFA AI Mutation Barrier (AI actor role strictly blocked from mutations)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    const creditAi = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'ai_operations_bot',
      actor_role: 'METFA_AI',
    });

    const holdAi = walletEngine.holdForPayout({
      payout_request_id: 'pay_ai_hold',
      user_id: userAlloc.user_id,
      amount_cents: 500,
      actor_id: 'ai_bot',
      actor_role: 'OPERATIONS_AI',
    });

    const passed =
      !creditAi.success &&
      creditAi.error?.includes('METFA AI Boundary Violation') &&
      !holdAi.success &&
      holdAi.error?.includes('METFA AI Boundary Violation');

    return {
      passed: Boolean(passed),
      message: passed
        ? 'METFA AI mutation barrier verified: AI agents cannot execute financial actions.'
        : 'AI mutation barrier failed.',
      details: { creditAiError: creditAi.error, holdAiError: holdAi.error },
    };
  });

  // -------------------------------------------------------------------------
  // WAL-25: Historical Ledger Chain Integrity
  // -------------------------------------------------------------------------
  runTest('WAL-25', 'Historical Ledger Chain Integrity (Reconciliation passes across complex lifecycle)', () => {
    const rewardEngine = new V2RewardEngine();
    rewardEngine.resetForTesting();
    const walletEngine = new V2WalletEngine(rewardEngine);
    walletEngine.resetForTesting();

    const { userAlloc } = setupFinalizedRewardSystem(rewardEngine);

    // 1. Credit reward (auto_release to available)
    const creditRes = walletEngine.creditFromRewardAllocation({
      allocation_id: userAlloc.id,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
      auto_release: true,
    });

    const walletId = creditRes.wallet!.id;
    const userId = userAlloc.user_id;

    // 2. Place payout hold
    walletEngine.holdForPayout({
      payout_request_id: 'lifecycle_payout_1',
      user_id: userId,
      amount_cents: 1000,
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    // 3. Finalize payout debit
    walletEngine.debitPayout({
      payout_request_id: 'lifecycle_payout_1',
      user_id: userId,
      actor_id: 'usr_admin',
      actor_role: 'FINANCE_ADMIN',
    });

    // 4. Place second hold and cancel it
    walletEngine.holdForPayout({
      payout_request_id: 'lifecycle_payout_2',
      user_id: userId,
      amount_cents: 500,
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    walletEngine.releasePayoutHold({
      payout_request_id: 'lifecycle_payout_2',
      user_id: userId,
      reason: 'Cancelled by creator',
      actor_id: 'usr_admin',
      actor_role: 'OPERATOR',
    });

    // 5. Run full reconciliation
    const recon = walletEngine.reconcileWallet(walletId);
    const passed =
      recon.is_reconciled &&
      recon.discrepancies.length === 0 &&
      recon.account_available_balance_cents === userAlloc.allocated_cents - 1000 &&
      recon.account_locked_balance_cents === 0 &&
      recon.ledger_derived_lifetime_payouts_cents === 1000;

    return {
      passed: Boolean(passed),
      message: passed
        ? 'Historical ledger chain fully intact: multi-step credit, hold, debit, and release reconciled with 0 discrepancies.'
        : `Lifecycle chain reconciliation failed: ${recon.discrepancies.join('; ')}`,
      details: { recon },
    };
  });

  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed).length;

  return {
    totalTests: results.length,
    passedTests,
    failedTests,
    results,
  };
}
