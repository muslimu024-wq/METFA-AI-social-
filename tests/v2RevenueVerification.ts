/**
 * METFA V2 — Revenue Engine Comprehensive Verification Suite
 * 
 * Tests the 18 specific requirements from User Request Section 33:
 * 1. Revenue period creation
 * 2. Revenue entry validation
 * 3. Duplicate/idempotency protection
 * 4. Refund entry
 * 5. Processing fee entry
 * 6. Tax entry
 * 7. Eligible cost entry
 * 8. Adjustment/reversal
 * 9. Reconciliation
 * 10. Material variance protection
 * 11. Policy version reference
 * 12. Period locking
 * 13. Finalization rules
 * 14. Finalized record immutability
 * 15. Unauthorized financial operation rejection
 * 16. Audit event creation
 * 17. Multi-currency protection
 * 18. AI cannot finalize financial records
 */

import { V2RevenueEngine } from '../services/v2RevenueEngine';

export function runV2RevenueEngineVerification(): { passed: boolean; results: Record<string, boolean>; details: string[] } {
  const engine = new V2RevenueEngine();
  const results: Record<string, boolean> = {};
  const details: string[] = [];

  const logTest = (name: string, ok: boolean, msg: string) => {
    results[name] = ok;
    details.push(`[${ok ? 'PASS' : 'FAIL'}] ${name}: ${msg}`);
  };

  // 1. Revenue Period Creation
  const period = engine.createRevenuePeriod({
    period_name: '2026-Q3-TEST',
    period_start: '2026-07-01T00:00:00.000Z',
    period_end: '2026-09-30T23:59:59.000Z',
    currency: 'USD',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  logTest('1_period_creation', Boolean(period && period.id && period.status === 'OPEN'), `Created period ${period.id}`);

  // 2. Revenue Entry Validation
  const entry1 = engine.recordRevenueEntry({
    period_id: period.id,
    source: 'ADS',
    entry_type: 'GROSS_INCOME',
    amount_cents: 100000, // $1,000.00
    currency: 'USD',
    reference_id: 'ad_invoice_001',
    description: 'Ad revenue batch 001',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
    auto_verify: true,
  });
  logTest('2_entry_validation', Boolean(entry1.success && entry1.entry?.amount_cents === 100000), 'Recorded verified gross income');

  // 3. Duplicate/Idempotency Protection
  const entry1Dup = engine.recordRevenueEntry({
    period_id: period.id,
    source: 'ADS',
    entry_type: 'GROSS_INCOME',
    amount_cents: 100000,
    currency: 'USD',
    reference_id: 'ad_invoice_001', // Same ref
    description: 'Duplicate batch',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  logTest('3_idempotency_protection', Boolean(entry1Dup.success && entry1Dup.is_duplicate), 'Prevented duplicate external reference entry');

  // 4. Refund Entry
  const refund = engine.recordRevenueEntry({
    period_id: period.id,
    source: 'ADS',
    entry_type: 'REFUND',
    amount_cents: 5000, // $50.00
    currency: 'USD',
    reference_id: 'ref_001',
    description: 'Advertiser chargeback refund',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
    auto_verify: true,
  });
  logTest('4_refund_entry', Boolean(refund.success && refund.entry?.entry_type === 'REFUND'), 'Recorded refund entry');

  // 5. Processing Fee Entry
  const fee = engine.recordRevenueEntry({
    period_id: period.id,
    source: 'ADS',
    entry_type: 'PROCESSING_FEE',
    amount_cents: 2900, // $29.00
    currency: 'USD',
    reference_id: 'fee_001',
    description: 'Merchant processing fee',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
    auto_verify: true,
  });
  logTest('5_processing_fee_entry', Boolean(fee.success && fee.entry?.entry_type === 'PROCESSING_FEE'), 'Recorded processing fee');

  // 6. Tax Entry
  const tax = engine.recordRevenueEntry({
    period_id: period.id,
    source: 'ADS',
    entry_type: 'TAX_WITHHOLDING',
    amount_cents: 5000, // $50.00
    currency: 'USD',
    reference_id: 'tax_001',
    description: 'Digital services tax',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
    auto_verify: true,
  });
  logTest('6_tax_entry', Boolean(tax.success && tax.entry?.entry_type === 'TAX_WITHHOLDING'), 'Recorded tax withholding');

  // 7. Eligible Cost Entry
  const cost = engine.recordRevenueEntry({
    period_id: period.id,
    source: 'ADS',
    entry_type: 'COST_DEDUCTION',
    amount_cents: 10000, // $100.00
    currency: 'USD',
    reference_id: 'cost_001',
    description: 'Direct infrastructure CDN delivery cost',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
    auto_verify: true,
  });
  logTest('7_eligible_cost_entry', Boolean(cost.success && cost.entry?.entry_type === 'COST_DEDUCTION'), 'Recorded eligible cost');

  // 8. Adjustment/Reversal
  const adj = engine.recordRevenueEntry({
    period_id: period.id,
    source: 'ADS',
    entry_type: 'ADJUSTMENT',
    amount_cents: 1000, // $10.00 positive reconciliation adjustment
    currency: 'USD',
    reference_id: 'adj_001',
    description: 'Reconciliation round-up adjustment',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
    auto_verify: true,
  });
  logTest('8_adjustment_entry', Boolean(adj.success && adj.entry?.entry_type === 'ADJUSTMENT'), 'Recorded accounting adjustment');

  // Check Net Calculation:
  // Gross = 100,000
  // Deductions = 5,000 (refund) + 2,900 (fee) + 5,000 (tax) + 10,000 (cost) = 22,900
  // Adjustments = +1,000
  // Expected Net = 100,000 - 22,900 + 1,000 = 78,100 cents ($781.00)
  // Expected Pool (25% = 2500 bps) = floor(78,100 * 2500 / 10000) = 19,525 cents ($195.25)
  const currentPeriod = engine.getPeriod(period.id);
  const netAccurate = currentPeriod?.eligible_net_revenue_cents === 78100 && currentPeriod?.reward_pool_cents === 19525;
  logTest('deterministic_net_and_pool', netAccurate, `Eligible Net=${currentPeriod?.eligible_net_revenue_cents} cents, Reward Pool=${currentPeriod?.reward_pool_cents} cents`);

  // 9. Reconciliation (Matched)
  engine.submitSourceReport({
    source: 'ADS',
    provider_id: 'ad_network_primary',
    period_id: period.id,
    reported_gross_cents: 100000,
    reported_refunds_cents: 5000,
    reported_fees_cents: 2900,
    currency: 'USD',
    external_batch_id: 'batch_sept_01',
    report_timestamp: new Date().toISOString(),
  });
  const recon = engine.reconcileRevenuePeriod({
    period_id: period.id,
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  logTest('9_reconciliation_matched', recon.is_approved && recon.variance_status === 'MATCHED', 'Reconciliation approved with MATCHED variance');

  // 10. Material Variance Protection
  const badPeriod = engine.createRevenuePeriod({
    period_name: '2026-BAD-VARIANCE',
    period_start: '2026-08-01T00:00:00.000Z',
    period_end: '2026-08-31T23:59:59.000Z',
    currency: 'USD',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  engine.recordRevenueEntry({
    period_id: badPeriod.id,
    source: 'ADS',
    entry_type: 'GROSS_INCOME',
    amount_cents: 50000, // $500.00
    currency: 'USD',
    reference_id: 'bad_var_001',
    description: 'Internal gross',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
    auto_verify: true,
  });
  engine.submitSourceReport({
    source: 'ADS',
    provider_id: 'ad_network_primary',
    period_id: badPeriod.id,
    reported_gross_cents: 1000000, // $10,000.00 (Huge variance!)
    reported_refunds_cents: 0,
    reported_fees_cents: 0,
    currency: 'USD',
    external_batch_id: 'batch_bad',
    report_timestamp: new Date().toISOString(),
  });
  const badRecon = engine.reconcileRevenuePeriod({
    period_id: badPeriod.id,
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  logTest('10_material_variance_protection', !badRecon.is_approved && badRecon.variance_status === 'MATERIAL_VARIANCE', 'Material variance rejected auto-approval');

  // 11. Policy Version Reference
  logTest('11_policy_version_reference', currentPeriod?.applied_policy_version === 1 && currentPeriod?.reward_pool_percentage_basis_points === 2500, 'Period retains explicit policy version and bps');

  // 12. Period Locking
  const lockResult = engine.lockRevenuePeriod({
    period_id: period.id,
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  logTest('12_period_locking', lockResult.success && lockResult.period?.status === 'LOCKED', 'Period successfully transitioned to LOCKED');

  // 13. Finalization Rules
  const finResult = engine.finalizeRevenuePeriod({
    period_id: period.id,
    actor_id: 'test_super_admin',
    actor_role: 'SUPER_ADMIN',
  });
  logTest('13_finalization_rules', finResult.success && finResult.period?.status === 'FINALIZED', 'Period successfully transitioned to FINALIZED by authorized SUPER_ADMIN');

  // 14. Finalized Record Immutability (Reject new entries)
  const rejectPostFinalize = engine.recordRevenueEntry({
    period_id: period.id,
    source: 'ADS',
    entry_type: 'GROSS_INCOME',
    amount_cents: 50000,
    currency: 'USD',
    reference_id: 'illegal_post_finalize',
    description: 'Late entry',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  logTest('14_finalized_record_immutability', !rejectPostFinalize.success, 'Rejected new ledger entry on finalized period');

  // 15. Unauthorized Financial Operation Rejection
  const testUnauthorizedPeriod = engine.createRevenuePeriod({
    period_name: '2026-UNAUTH-TEST',
    period_start: '2026-09-01T00:00:00.000Z',
    period_end: '2026-09-30T23:59:59.000Z',
    currency: 'USD',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  const unauthFinalize = engine.finalizeRevenuePeriod({
    period_id: testUnauthorizedPeriod.id,
    actor_id: 'normal_user_123',
    actor_role: 'USER', // Standard user cannot finalize!
  });
  logTest('15_unauthorized_rejection', !unauthFinalize.success, 'Rejected unauthorized finalization attempt by normal USER');

  // 16. Audit Event Creation
  const audits = engine.getAuditLogs(period.id);
  logTest('16_audit_event_creation', audits.length >= 3, `Recorded ${audits.length} audit trail entries for period ${period.id}`);

  // 17. Multi-Currency Protection
  const wrongCurrency = engine.recordRevenueEntry({
    period_id: testUnauthorizedPeriod.id,
    source: 'ADS',
    entry_type: 'GROSS_INCOME',
    amount_cents: 10000,
    currency: 'EUR', // Mismatched with period currency USD!
    reference_id: 'eur_bad_001',
    description: 'Euro entry into USD period',
    actor_id: 'test_admin_1',
    actor_role: 'FINANCE_ADMIN',
  });
  logTest('17_multi_currency_protection', !wrongCurrency.success, 'Rejected foreign currency entry without conversion policy');

  // 18. AI Cannot Finalize Records (Architectural gate test)
  const aiFinalize = engine.finalizeRevenuePeriod({
    period_id: testUnauthorizedPeriod.id,
    actor_id: 'metfa_ai_agent',
    actor_role: 'AI_ASSISTANT', // Role check strictly prohibits AI from finalizing
  });
  logTest('18_ai_cannot_finalize', !aiFinalize.success, 'Strict role check prevents AI assistant role from finalizing financial records');

  const allPassed = Object.values(results).every(Boolean);
  return { passed: allPassed, results, details };
}
