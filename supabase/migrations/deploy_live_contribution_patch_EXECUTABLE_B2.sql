-- =====================================================================
-- 13. AUDIO ECONOMY & LICENSING (NON-SOCIAL VOICE POST)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_audio_economy_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL CHECK (license_type IN (
    'CREATIVE_COMMONS_BY', 'PLATFORM_FREE_USE', 'COMMERCIAL_REV_SHARE', 'EXCLUSIVE_CREATOR'
  )),
  creator_revenue_split_percentage NUMERIC(5,2) NOT NULL CHECK (
    creator_revenue_split_percentage >= 0.00
    AND creator_revenue_split_percentage <= 100.00
  ),
  total_usages_in_reels INTEGER NOT NULL DEFAULT 0,
  total_usages_in_videos INTEGER NOT NULL DEFAULT 0,
  total_qualified_plays BIGINT NOT NULL DEFAULT 0,
  generated_ad_pool_revenue_cents BIGINT NOT NULL DEFAULT 0,
  copyright_claim_status TEXT NOT NULL DEFAULT 'CLEAN' CHECK (copyright_claim_status IN (
    'CLEAN', 'FLAGGED', 'DISPUTED', 'DMCA_TAKEDOWN'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_audio_owner ON public.v2_audio_economy_tracks(owner_user_id);

ALTER TABLE public.v2_audio_economy_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view audio catalog tracks" ON public.v2_audio_economy_tracks;
CREATE POLICY "Public can view audio catalog tracks"
ON public.v2_audio_economy_tracks FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Owners can update their audio tracks" ON public.v2_audio_economy_tracks;
CREATE POLICY "Owners can update their audio tracks"
ON public.v2_audio_economy_tracks FOR UPDATE
USING (auth.uid() = owner_user_id OR public.v2_is_admin_or_operator());

-- Protect financial, accounting, and licensing authority fields on audio tracks
CREATE OR REPLACE FUNCTION public.v2_protect_audio_track_accounting()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Privileged admin or operator can perform administrative updates
  IF public.v2_is_admin_or_operator() THEN
    RETURN NEW;
  END IF;

  -- Client-owner updates cannot modify accounting or licensing authority fields
  IF NEW.creator_revenue_split_percentage IS DISTINCT FROM OLD.creator_revenue_split_percentage
     OR NEW.total_usages_in_reels IS DISTINCT FROM OLD.total_usages_in_reels
     OR NEW.total_usages_in_videos IS DISTINCT FROM OLD.total_usages_in_videos
     OR NEW.total_qualified_plays IS DISTINCT FROM OLD.total_qualified_plays
     OR NEW.generated_ad_pool_revenue_cents IS DISTINCT FROM OLD.generated_ad_pool_revenue_cents
     OR NEW.copyright_claim_status IS DISTINCT FROM OLD.copyright_claim_status
     OR NEW.license_type IS DISTINCT FROM OLD.license_type
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Track owners can only update editable metadata (title, artist_name). Financial and accounting fields are protected.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v2_protect_audio_track_accounting ON public.v2_audio_economy_tracks;
CREATE TRIGGER trg_v2_protect_audio_track_accounting
BEFORE UPDATE ON public.v2_audio_economy_tracks
FOR EACH ROW
EXECUTE FUNCTION public.v2_protect_audio_track_accounting();

-- =====================================================================
-- 14. IMMUTABLE AUDIT LOG & COMPLIANCE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'FINANCIAL_SETTLEMENT', 'PAYOUT_APPROVAL', 'REWARD_POLICY_CHANGE',
    'VERIFICATION_GRANTED', 'VERIFICATION_REVOKED', 'RISK_RULE_MODIFIED',
    'ADMIN_ACCESS_CHANGED', 'SIGNAL_DISMISSAL', 'SYSTEM_MAINTENANCE'
  )),
  actor_id UUID REFERENCES public.profiles(id),
  actor_role TEXT NOT NULL DEFAULT 'USER',
  target_entity_id TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  previous_state_masked JSONB,
  new_state_masked JSONB NOT NULL,
  ip_address_masked TEXT,
  reason_notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_audit_logs_target ON public.v2_audit_logs(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_v2_audit_logs_timestamp ON public.v2_audit_logs(timestamp DESC);

ALTER TABLE public.v2_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs are append-only. Only admins can read, nobody can update or delete.
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.v2_audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.v2_audit_logs FOR SELECT
USING (public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Disallow audit log update or delete" ON public.v2_audit_logs;
CREATE POLICY "Disallow audit log update or delete"
ON public.v2_audit_logs FOR UPDATE
USING (false);

-- =====================================================================
-- DATABASE-LEVEL LEDGER IMMUTABILITY ENFORCEMENT
-- =====================================================================

CREATE OR REPLACE FUNCTION public.v2_prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger records are strictly immutable and cannot be updated or deleted from %', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_v2_revenue_ledger_immutable ON public.v2_revenue_ledger;
CREATE TRIGGER trg_v2_revenue_ledger_immutable
BEFORE UPDATE OR DELETE ON public.v2_revenue_ledger
FOR EACH ROW
EXECUTE FUNCTION public.v2_prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_v2_wallet_ledger_immutable ON public.v2_wallet_ledger;
CREATE TRIGGER trg_v2_wallet_ledger_immutable
BEFORE UPDATE OR DELETE ON public.v2_wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.v2_prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_v2_audit_logs_immutable ON public.v2_audit_logs;
CREATE TRIGGER trg_v2_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.v2_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.v2_prevent_ledger_mutation();

-- =====================================================================
-- 15. PRIVATE STORAGE BUCKETS CONFIGURATION (EXTERNAL PREREQUISITE)
-- NOTE: Storage buckets ('v2-verification-private') must be provisioned
-- via the Supabase Dashboard or Storage Admin API to avoid direct mutation
-- of internal storage.* system catalog tables in DDL migrations.
-- =====================================================================

-- =====================================================================
-- 16. TARGETED DATABASE PRIVILEGES & LEAST-PRIVILEGE DATA API GRANTS
-- =====================================================================

GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;

-- A. Backend / Service Role: Full administrative privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.v2_user_roles,
  public.v2_admin_policies,
  public.v2_feature_flags,
  public.v2_kill_switches,
  public.v2_approval_items,
  public.v2_audit_logs,
  public.v2_revenue_periods,
  public.v2_revenue_ledger,
  public.v2_contribution_policies,
  public.v2_contribution_ledger,
  public.v2_reward_settlements,
  public.v2_reward_allocations,
  public.v2_wallet_accounts,
  public.v2_wallet_ledger,
  public.v2_payout_requests,
  public.v2_ads_campaigns,
  public.v2_ads_creatives,
  public.v2_ads_targeting,
  public.v2_ads_events,
  public.v2_verification_requests,
  public.v2_risk_signals,
  public.v2_risk_holds,
  public.v2_ai_health_events,
  public.v2_signals,
  public.v2_audio_economy_tracks
TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- B. Authenticated Users: Least-privilege SELECT access (row visibility strictly governed by RLS)
-- Note: Direct client INSERT/UPDATE/DELETE on financial & contribution ledgers remain strictly forbidden.
GRANT SELECT ON
  public.v2_user_roles,
  public.v2_admin_policies,
  public.v2_feature_flags,
  public.v2_kill_switches,
  public.v2_approval_items,
  public.v2_audit_logs,
  public.v2_revenue_periods,
  public.v2_revenue_ledger,
  public.v2_contribution_policies,
  public.v2_contribution_ledger,
  public.v2_reward_settlements,
  public.v2_reward_allocations,
  public.v2_wallet_accounts,
  public.v2_wallet_ledger,
  public.v2_payout_requests,
  public.v2_ads_campaigns,
  public.v2_ads_creatives,
  public.v2_ads_targeting,
  public.v2_ads_events,
  public.v2_verification_requests,
  public.v2_risk_signals,
  public.v2_risk_holds,
  public.v2_ai_health_events,
  public.v2_signals,
  public.v2_audio_economy_tracks
TO authenticated;

-- C. Explicit client write privileges strictly permitted by corresponding RLS policies:
GRANT INSERT ON public.v2_payout_requests TO authenticated;
GRANT INSERT ON public.v2_verification_requests TO authenticated;
GRANT UPDATE ON public.v2_audio_economy_tracks TO authenticated;

-- D. Anonymous Users: Strictly read-only for public catalog, policies, and system status
GRANT SELECT ON
  public.v2_feature_flags,
  public.v2_kill_switches,
  public.v2_contribution_policies,
  public.v2_audio_economy_tracks
TO anon;

-- End of METFA V2 Master Database Foundation


-- >>> SECTION 2: CONTRIBUTION SYSTEM INTEGRITY & SAFETY <<<
-- =====================================================================
-- METFA V2 — CONTRIBUTION SYSTEM FOUNDATION & INGEST RPC (SAFE / NON-DESTRUCTIVE)
-- Migration Reference: 20260925_v2_contribution_ingest_foundation.sql
-- =====================================================================
-- PRODUCTION SAFETY VERIFICATION:
-- 1. Existing live table "public.v2_contribution_ledger" already contains all
--    production columns (id, user_id, action, policy_id, base_points,
--    quality_multiplier, final_points, source_ref, status, revenue_period_id,
--    risk_score, metadata, entry_type, original_entry_id, created_at)
--    and contains active live records.
--    To guarantee zero disruption and preserve existing production state:
--    - NO ALTER TABLE column additions or modifications are executed.
--    - NO foreign key constraints are dropped.
--    - NO production triggers are dropped or replaced on v2_contribution_ledger.
--    - All existing production data, columns, indexes, and triggers remain 100% UNTOUCHED.
-- 2. Schema mismatch detected on "public.v2_contribution_policies":
--    Live table schema uses (id, policy_name, version, is_active, rules,
--    scoring_config, effective_from, effective_until, created_at) rather than
--    the legacy unversioned action columns.
--    Per safety protocol, legacy INSERT statements are STOPPED to prevent schema errors.
-- =====================================================================

-- Ensure RLS is active on public.v2_contribution_ledger without modifying existing policies
ALTER TABLE public.v2_contribution_ledger ENABLE ROW LEVEL SECURITY;
