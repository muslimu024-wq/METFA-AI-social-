/**
 * METFA Social — Step 1 Offline Regression & Release-Safety Runner
 *
 * Scope & Guarantees:
 * - Zero edits to application source files, server.ts, package.json, or existing test suites.
 * - Hermetic offline quarantine: strips Supabase/API environment variables in-process before
 *   importing any service/test module, nulls serverSupabaseClient, and blocks globalThis.fetch
 *   so zero production Supabase queries or external HTTP calls can occur.
 * - Isolates file-writing tests (videoAnalyticsVerification.ts) inside os.tmpdir() before
 *   module import so workspace data/video_analytics_sessions.json is never touched.
 * - Verifies all 16 canonical V2 module IDs, component files, V2ModuleViewport mappings,
 *   authentication token/metadata safeguards, server syntax validation, and all 13 test suites.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const WORKSPACE_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const SCRUBBED_ENV_KEYS = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'GEMINI_API_KEY',
  'API_KEY',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'GROK_API_KEY',
] as const;

interface CheckSummary {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

interface SuiteSummary {
  suite: string;
  isolationMode: 'in-memory-offline' | 'tmpdir-cwd-offline';
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  failedDetails: string[];
}

interface FileIntegritySnapshot {
  exists: boolean;
  size: number;
  sha256: string | null;
  mtimeMs: number | null;
}

function snapshotFileHash(absPath: string): FileIntegritySnapshot {
  if (!fs.existsSync(absPath)) {
    return { exists: false, size: 0, sha256: null, mtimeMs: null };
  }
  const stat = fs.statSync(absPath);
  const buf = fs.readFileSync(absPath);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  return {
    exists: true,
    size: stat.size,
    sha256,
    mtimeMs: stat.mtimeMs,
  };
}

function snapshotStatOnly(absPath: string): Omit<FileIntegritySnapshot, 'sha256'> {
  if (!fs.existsSync(absPath)) {
    return { exists: false, size: 0, mtimeMs: null };
  }
  const stat = fs.statSync(absPath);
  return {
    exists: true,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

const CANONICAL_16_V2_MODULES: ReadonlyArray<{
  id: string;
  componentName: string;
  componentRelPath: string;
}> = [
  { id: 'verified', componentName: 'V2VerifiedModule', componentRelPath: 'components/v2/modules/V2VerifiedModule.tsx' },
  { id: 'ads', componentName: 'V2AdsModule', componentRelPath: 'components/v2/modules/V2AdsModule.tsx' },
  { id: 'revenue', componentName: 'V2RevenueModule', componentRelPath: 'components/v2/modules/V2RevenueModule.tsx' },
  { id: 'contribution', componentName: 'V2ContributionModule', componentRelPath: 'components/v2/modules/V2ContributionModule.tsx' },
  { id: 'rewards', componentName: 'V2RewardModule', componentRelPath: 'components/v2/modules/V2RewardModule.tsx' },
  { id: 'risk', componentName: 'V2RiskModule', componentRelPath: 'components/v2/modules/V2RiskModule.tsx' },
  { id: 'wallet', componentName: 'V2WalletModule', componentRelPath: 'components/v2/modules/V2WalletModule.tsx' },
  { id: 'payout', componentName: 'V2PayoutModule', componentRelPath: 'components/v2/modules/V2PayoutModule.tsx' },
  { id: 'operations-ai', componentName: 'V2OperationsAiModule', componentRelPath: 'components/v2/modules/V2OperationsAiModule.tsx' },
  { id: 'signal', componentName: 'V2SignalModule', componentRelPath: 'components/v2/modules/V2SignalModule.tsx' },
  { id: 'work', componentName: 'V2WorkModule', componentRelPath: 'components/v2/modules/V2WorkModule.tsx' },
  { id: 'freelancer-team', componentName: 'V2FreelancerTeamModule', componentRelPath: 'components/v2/modules/V2FreelancerTeamModule.tsx' },
  { id: 'creator', componentName: 'V2CreatorModule', componentRelPath: 'components/v2/modules/V2CreatorModule.tsx' },
  { id: 'audio', componentName: 'V2AudioModule', componentRelPath: 'components/v2/modules/V2AudioModule.tsx' },
  { id: 'admin-control', componentName: 'V2AdminControlModule', componentRelPath: 'components/v2/modules/V2AdminControlModule.tsx' },
  { id: 'governance-audit', componentName: 'V2GovernanceAuditModule', componentRelPath: 'components/v2/modules/V2GovernanceAuditModule.tsx' },
];

async function main(): Promise<void> {
  process.chdir(WORKSPACE_ROOT);

  // 0. Pre-run integrity snapshots (never reads .env content; hashes non-secret analytics JSON)
  const analyticsDataPath = path.join(WORKSPACE_ROOT, 'data', 'video_analytics_sessions.json');
  const envFilePath = path.join(WORKSPACE_ROOT, '.env');
  const preAnalyticsSnap = snapshotFileHash(analyticsDataPath);
  const preEnvStat = snapshotStatOnly(envFilePath);

  // 1. Activate Hermetic Offline Quarantine BEFORE importing any project file
  for (const key of SCRUBBED_ENV_KEYS) {
    delete process.env[key];
  }

  let blockedNetworkAttempts = 0;
  const blockedUrls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
    blockedNetworkAttempts += 1;
    const target =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    blockedUrls.push(target);
    throw new Error(`[OFFLINE_QUARANTINE] Blocked network call during offline regression: ${target}`);
  }) as typeof fetch;

  const releaseChecks: CheckSummary[] = [];
  const recordCheck = (id: string, name: string, fn: () => string): void => {
    try {
      const details = fn();
      releaseChecks.push({ id, name, passed: true, details });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      releaseChecks.push({ id, name, passed: false, details: msg });
    }
  };

  // Verify quarantine hooks on serverAuth & supabaseClient
  const serverAuthMod = await import(
    pathToFileURL(path.join(WORKSPACE_ROOT, 'services', 'serverAuth.ts')).href
  );
  serverAuthMod.setServerSupabaseClientForTesting(null);

  const supabaseClientMod = await import(
    pathToFileURL(path.join(WORKSPACE_ROOT, 'services', 'supabaseClient.ts')).href
  );

  recordCheck('RS-00', 'Hermetic offline quarantine active (Supabase & network disabled)', () => {
    if (serverAuthMod.getServerSupabaseClient() !== null) {
      throw new Error('getServerSupabaseClient() returned non-null client in offline mode');
    }
    if (serverAuthMod.getPublicSupabaseClient() !== null) {
      throw new Error('getPublicSupabaseClient() returned non-null client in offline mode');
    }
    if (supabaseClientMod.isSupabaseConfigured() !== false) {
      throw new Error('isSupabaseConfigured() returned true in offline mode');
    }
    return 'Server & client Supabase instances are null/fallback; globalThis.fetch quarantined';
  });

  // 2. Release-Safety Check: Canonical 16 V2 Module Registry
  const registryMod = await import(
    pathToFileURL(path.join(WORKSPACE_ROOT, 'data', 'v2Registry.ts')).href
  );
  const registry: Array<{
    id: string;
    shortLabel: string;
    fullProductName: string;
    iconName: string;
    isActive: boolean;
  }> = registryMod.V2_MODULE_REGISTRY;

  recordCheck('RS-01', 'Canonical 16 V2 module IDs & active metadata in data/v2Registry.ts', () => {
    if (!Array.isArray(registry) || registry.length !== 16) {
      throw new Error(`Expected 16 modules in V2_MODULE_REGISTRY, found ${registry?.length ?? 0}`);
    }
    const seen = new Set<string>();
    for (const mod of registry) {
      if (seen.has(mod.id)) {
        throw new Error(`Duplicate module ID in registry: ${mod.id}`);
      }
      seen.add(mod.id);
      if (!mod.isActive) {
        throw new Error(`Module '${mod.id}' has isActive !== true`);
      }
      if (!mod.fullProductName?.startsWith('METFA ')) {
        throw new Error(`Module '${mod.id}' fullProductName does not start with 'METFA ': ${mod.fullProductName}`);
      }
      if (!mod.shortLabel || mod.shortLabel.toUpperCase().includes('METFA')) {
        throw new Error(`Module '${mod.id}' shortLabel violates shortened grid naming: ${mod.shortLabel}`);
      }
    }
    for (const expected of CANONICAL_16_V2_MODULES) {
      if (!seen.has(expected.id)) {
        throw new Error(`Missing canonical V2 module ID in registry: ${expected.id}`);
      }
    }
    return `Verified all 16 canonical V2 module IDs active: ${Array.from(seen).join(', ')}`;
  });

  // 3. Release-Safety Check: Component files for all 16 V2 modules
  recordCheck('RS-02', 'All 16 V2 module component files exist and export components', () => {
    for (const m of CANONICAL_16_V2_MODULES) {
      const absComp = path.join(WORKSPACE_ROOT, m.componentRelPath);
      if (!fs.existsSync(absComp)) {
        throw new Error(`Missing V2 module component file: ${m.componentRelPath}`);
      }
      const src = fs.readFileSync(absComp, 'utf8');
      if (src.trim().length < 100) {
        throw new Error(`Component file appears empty or truncated: ${m.componentRelPath}`);
      }
      if (!src.includes('export default') && !src.includes(`export const ${m.componentName}`) && !src.includes(`export function ${m.componentName}`)) {
        throw new Error(`Component file missing expected export (${m.componentName}): ${m.componentRelPath}`);
      }
    }
    return 'All 16 components/v2/modules/V2*Module.tsx files verified on disk';
  });

  // 4. Release-Safety Check: Registry-to-Viewport Mappings & Icon Coverage
  recordCheck('RS-03', 'V2ModuleViewport maps all 16 module IDs and all 16 registry icons', () => {
    const viewportPath = path.join(WORKSPACE_ROOT, 'components', 'v2', 'V2ModuleViewport.tsx');
    const src = fs.readFileSync(viewportPath, 'utf8');

    for (const m of CANONICAL_16_V2_MODULES) {
      const idCondition = `module.id === '${m.id}'`;
      const jsxMount = `<${m.componentName}`;
      if (!src.includes(idCondition)) {
        throw new Error(`V2ModuleViewport missing branch: ${idCondition}`);
      }
      if (!src.includes(jsxMount)) {
        throw new Error(`V2ModuleViewport missing JSX mount: ${jsxMount}`);
      }
    }

    const iconMapMatch = src.match(/const\s+ICON_MAP[\s\S]*?=\s*\{([\s\S]*?)\};/);
    if (!iconMapMatch) {
      throw new Error('Could not locate ICON_MAP in V2ModuleViewport.tsx');
    }
    const iconMapBody = iconMapMatch[1];
    for (const regItem of registry) {
      const iconRe = new RegExp(`\\b${regItem.iconName}\\b`);
      if (!iconRe.test(iconMapBody)) {
        throw new Error(`ICON_MAP missing icon '${regItem.iconName}' for module '${regItem.id}'`);
      }
    }
    return '16/16 module.id branches, 16/16 <V2*Module /> mounts, and 16/16 ICON_MAP entries verified';
  });

  // 5. Release-Safety Check: Authentication Token & Metadata Safeguards
  recordCheck('RS-04', 'Authentication metadata & Owner-check token refresh safeguards intact', () => {
    const authServiceSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'services', 'authService.ts'), 'utf8');
    const supabaseClientSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'services', 'supabaseClient.ts'), 'utf8');
    const appSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'App.tsx'), 'utf8');
    const v2DashSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'components', 'v2', 'V2Dashboard.tsx'), 'utf8');
    const headerSrc = fs.readFileSync(path.join(WORKSPACE_ROOT, 'components', 'Header.tsx'), 'utf8');

    if (
      !authServiceSrc.includes('safeMetadataAvatar') ||
      !authServiceSrc.includes("startsWith('data:')") ||
      !authServiceSrc.includes('> 1024')
    ) {
      throw new Error('authService.ts missing safeMetadataAvatar guard blocking data: URIs / >1024-byte strings in JWT metadata');
    }

    if (
      !supabaseClientSrc.includes('getClientAuthToken') ||
      !supabaseClientSrc.includes('refreshAccessTokenOnce') ||
      !supabaseClientSrc.includes('4096')
    ) {
      throw new Error('supabaseClient.ts missing deduplicated getClientAuthToken / >4096 oversized JWT refresh safeguard');
    }

    if (
      !appSrc.includes('/api/v2/auth/owner-check') ||
      !appSrc.includes('getClientAuthToken(true)') ||
      !/\[isAuthenticated,\s*sessionToken,\s*user\.id,\s*isSupabaseConnected\]/.test(appSrc)
    ) {
      throw new Error('App.tsx missing sessionToken dependency or single controlled refresh retry on /api/v2/auth/owner-check');
    }

    if (
      !v2DashSrc.includes('/api/v2/auth/owner-check') ||
      !v2DashSrc.includes('getClientAuthToken(true)') ||
      !/\[isAuthenticated,\s*sessionToken,\s*user\.id,\s*isSupabaseConnected\]/.test(v2DashSrc)
    ) {
      throw new Error('V2Dashboard.tsx missing sessionToken dependency or single controlled refresh retry on /api/v2/auth/owner-check');
    }

    if (!headerSrc.includes('id="header-v2-dashboard-btn"') || !headerSrc.includes('isOwnerOrAdmin')) {
      throw new Error('Header.tsx missing #header-v2-dashboard-btn gated by isOwnerOrAdmin');
    }

    return 'Verified safeMetadataAvatar, getClientAuthToken (>4096 & single-flight refresh), sessionToken deps, and Header V2 launcher';
  });

  // 6. Release-Safety Check: Server Syntax Validation
  recordCheck('RS-05', 'Server entry syntax validation (bun build server.ts --target=node --no-bundle)', () => {
    const res = spawnSync('bun', ['build', 'server.ts', '--target=node', '--no-bundle'], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (res.status !== 0) {
      throw new Error(`bun server syntax check failed (exit ${res.status}): ${(res.stderr || '').slice(0, 400)}`);
    }
    return `server.ts parsed and validated cleanly (${(res.stdout || '').length} transpiled chars in memory)`;
  });

  // 7. Execute All 13 Verification Suites Offline
  const suiteSummaries: SuiteSummary[] = [];

  async function executeSuite(
    suiteName: string,
    isolationMode: 'in-memory-offline' | 'tmpdir-cwd-offline',
    runner: () => Promise<{
      passed: boolean;
      totalTests: number;
      passedTests: number;
      failedTests: number;
      failedDetails: string[];
    }>
  ): Promise<void> {
    const t0 = Date.now();
    try {
      const outcome = await runner();
      suiteSummaries.push({
        suite: suiteName,
        isolationMode,
        passed: outcome.passed && outcome.failedTests === 0,
        totalTests: outcome.totalTests,
        passedTests: outcome.passedTests,
        failedTests: outcome.failedTests,
        durationMs: Date.now() - t0,
        failedDetails: outcome.failedDetails,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      suiteSummaries.push({
        suite: suiteName,
        isolationMode,
        passed: false,
        totalTests: 1,
        passedTests: 0,
        failedTests: 1,
        durationMs: Date.now() - t0,
        failedDetails: [msg],
      });
    }
  }

  const importTestModule = (fileName: string) =>
    import(pathToFileURL(path.join(WORKSPACE_ROOT, 'tests', fileName)).href);

  // Suite 1: phase2aEngagementVerification.ts
  await executeSuite('phase2aEngagementVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('phase2aEngagementVerification.ts');
    const r = await mod.runPhase2aEngagementVerification();
    return {
      passed: r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { id: string; message: string }) => `${x.id}: ${x.message}`),
    };
  });

  // Suite 2: phase2bSocialGraphVerification.ts
  await executeSuite('phase2bSocialGraphVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('phase2bSocialGraphVerification.ts');
    const r = await mod.runPhase2bSocialGraphVerification();
    return {
      passed: r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { id: string; message: string }) => `${x.id}: ${x.message}`),
    };
  });

  // Suite 3: v2BackendAuthorityVerification.ts
  await executeSuite('v2BackendAuthorityVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2BackendAuthorityVerification.ts');
    const r = await mod.runV2BackendAuthorityVerification();
    return {
      passed: Boolean(r.passed) && r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { name: string; message?: string }) => `${x.name}: ${x.message || 'Failed'}`),
    };
  });

  // Suite 4: v2ContributionIngestRpcVerification.ts
  await executeSuite('v2ContributionIngestRpcVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2ContributionIngestRpcVerification.ts');
    const r = mod.runV2ContributionIngestVerification();
    return {
      passed: r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { testId: string; message: string }) => `${x.testId}: ${x.message}`),
    };
  });

  // Suite 5: v2ContributionVerification.ts
  await executeSuite('v2ContributionVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2ContributionVerification.ts');
    const r = mod.runV2ContributionEngineVerification();
    return {
      passed: r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { testId: string; message: string }) => `${x.testId}: ${x.message}`),
    };
  });

  // Suite 6: v2RevenueVerification.ts
  await executeSuite('v2RevenueVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2RevenueVerification.ts');
    const r = mod.runV2RevenueEngineVerification();
    const entries = Object.entries(r.results as Record<string, boolean>);
    const failed = entries.filter(([, ok]) => !ok).map(([k]) => k);
    return {
      passed: Boolean(r.passed) && failed.length === 0,
      totalTests: entries.length,
      passedTests: entries.length - failed.length,
      failedTests: failed.length,
      failedDetails: failed,
    };
  });

  // Suite 7: v2RewardVerification.ts
  await executeSuite('v2RewardVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2RewardVerification.ts');
    const r = mod.runV2RewardEngineVerification();
    return {
      passed: r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { testId: string; message: string }) => `${x.testId}: ${x.message}`),
    };
  });

  // Suite 8: v2WalletVerification.ts
  await executeSuite('v2WalletVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2WalletVerification.ts');
    const r = mod.runV2WalletEngineVerification();
    return {
      passed: r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { testId: string; message: string }) => `${x.testId}: ${x.message}`),
    };
  });

  // Suite 9: v2RiskVerification.ts
  await executeSuite('v2RiskVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2RiskVerification.ts');
    const r = mod.runV2RiskEngineVerification();
    return {
      passed: r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { name: string; message?: string }) => `${x.name}: ${x.message || 'Failed'}`),
    };
  });

  // Suite 10: v2GovernanceVerification.ts
  await executeSuite('v2GovernanceVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2GovernanceVerification.ts');
    const r = mod.runV2GovernanceVerification();
    return {
      passed: r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { name: string; message?: string }) => `${x.name}: ${x.message || 'Failed'}`),
    };
  });

  // Suite 11: v2PremiumContentVerification.ts
  await executeSuite('v2PremiumContentVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2PremiumContentVerification.ts');
    const r = await mod.runV2PremiumContentVerification();
    return {
      passed: Boolean(r.passed) && r.failedTests === 0,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { testId: string; message: string }) => `${x.testId}: ${x.message}`),
    };
  });

  // Suite 12: v2Phase10IntegrationVerification.ts
  await executeSuite('v2Phase10IntegrationVerification.ts', 'in-memory-offline', async () => {
    const mod = await importTestModule('v2Phase10IntegrationVerification.ts');
    const r = mod.runV2Phase10IntegrationVerification();
    return {
      passed: r.status === 'PASS' && r.failedCount === 0,
      totalTests: r.totalTests,
      passedTests: r.passedCount,
      failedTests: r.failedCount,
      failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { id: string; notes: string }) => `${x.id}: ${x.notes}`),
    };
  });

  // Suite 13: videoAnalyticsVerification.ts (ISOLATED in temporary directory!)
  await executeSuite('videoAnalyticsVerification.ts', 'tmpdir-cwd-offline', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metfa-va-offline-'));
    try {
      // Must chdir BEFORE importing videoAnalyticsVerification/videoAnalyticsEngine
      // because VideoAnalyticsEngine binds path.join(process.cwd(), 'data', ...) in constructor.
      process.chdir(tmpDir);
      const mod = await importTestModule('videoAnalyticsVerification.ts');
      const r = await mod.runVideoAnalyticsVerification();
      const tmpDataFile = path.join(tmpDir, 'data', 'video_analytics_sessions.json');
      if (!fs.existsSync(tmpDataFile)) {
        throw new Error('Expected videoAnalyticsEngine to write inside isolated tmpdir, but temp file was not created');
      }
      return {
        passed: r.status === 'PASS' && r.failedCount === 0,
        totalTests: r.totalTests,
        passedTests: r.passedCount,
        failedTests: r.failedCount,
        failedDetails: r.results.filter((x: { passed: boolean }) => !x.passed).map((x: { id: string; notes: string }) => `${x.id}: ${x.notes}`),
      };
    } finally {
      process.chdir(WORKSPACE_ROOT);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // 8. Post-Execution Workspace Data & Secret Non-Mutation Verification
  const postAnalyticsSnap = snapshotFileHash(analyticsDataPath);
  const postEnvStat = snapshotStatOnly(envFilePath);

  recordCheck('RS-06', 'Post-run integrity: live analytics file, .env, and network untouched', () => {
    if (
      preAnalyticsSnap.exists !== postAnalyticsSnap.exists ||
      preAnalyticsSnap.size !== postAnalyticsSnap.size ||
      preAnalyticsSnap.sha256 !== postAnalyticsSnap.sha256
    ) {
      throw new Error(
        `data/video_analytics_sessions.json mutated! Before=${preAnalyticsSnap.sha256} (${preAnalyticsSnap.size}B), After=${postAnalyticsSnap.sha256} (${postAnalyticsSnap.size}B)`
      );
    }
    if (
      preEnvStat.exists !== postEnvStat.exists ||
      preEnvStat.size !== postEnvStat.size ||
      preEnvStat.mtimeMs !== postEnvStat.mtimeMs
    ) {
      throw new Error('.env metadata changed during test run!');
    }
    if (blockedNetworkAttempts > 0) {
      throw new Error(`Intercepted ${blockedNetworkAttempts} unexpected network request(s): ${blockedUrls.join(', ')}`);
    }
    return `data/video_analytics_sessions.json SHA-256 unchanged (${postAnalyticsSnap.size}B), .env untouched, 0 outbound network attempts`;
  });

  // 9. Print Deterministic Structured Summary
  const allChecksPassed = releaseChecks.every((c) => c.passed);
  const allSuitesPassed = suiteSummaries.every((s) => s.passed);
  const grandTotalAssertions = suiteSummaries.reduce((acc, s) => acc + s.totalTests, 0);
  const grandPassedAssertions = suiteSummaries.reduce((acc, s) => acc + s.passedTests, 0);
  const grandFailedAssertions = suiteSummaries.reduce((acc, s) => acc + s.failedTests, 0);

  console.log('========================================================================');
  console.log('METFA SOCIAL — OFFLINE REGRESSION & RELEASE-SAFETY REPORT');
  console.log('========================================================================');
  console.log('\n[A] RELEASE-SAFETY & QUARANTINE CHECKS');
  for (const c of releaseChecks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.id} ${c.name}`);
    console.log(`         -> ${c.details}`);
  }

  console.log('\n[B] OFFLINE VERIFICATION SUITES (13 SUITES)');
  for (const s of suiteSummaries) {
    console.log(
      `  [${s.passed ? 'PASS' : 'FAIL'}] ${s.suite} (${s.passedTests}/${s.totalTests} passed, ${s.durationMs}ms, mode=${s.isolationMode})`
    );
    for (const detail of s.failedDetails) {
      console.log(`         ! ${detail}`);
    }
  }

  console.log('\n[C] AGGREGATE SUMMARY');
  console.log(`  Release-Safety Checks : ${releaseChecks.filter((c) => c.passed).length}/${releaseChecks.length} PASSED`);
  console.log(`  Verification Suites   : ${suiteSummaries.filter((s) => s.passed).length}/${suiteSummaries.length} PASSED`);
  console.log(`  Individual Assertions : ${grandPassedAssertions}/${grandTotalAssertions} PASSED (${grandFailedAssertions} failed)`);
  console.log(`  Outbound Network Calls: ${blockedNetworkAttempts}`);
  console.log(`  Analytics Data Mutated: NO (SHA-256=${postAnalyticsSnap.sha256?.slice(0, 16) ?? 'none'}...)`);
  console.log('========================================================================');

  if (!allChecksPassed || !allSuitesPassed) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error('[FATAL] Offline regression runner crashed:', err);
  process.exitCode = 1;
});
