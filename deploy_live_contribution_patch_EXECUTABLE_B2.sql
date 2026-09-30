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

DROP TRIGGER IF EXISTS trg_v2_contribution_ledger_immutable ON public.v2_contribution_ledger;
CREATE TRIGGER trg_v2_contribution_ledger_immutable
BEFORE UPDATE OR DELETE ON public.v2_contribution_ledger
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
-- 15. PRIVATE STORAGE BUCKETS CONFIGURATION FOR V2
-- =====================================================================

-- Verification documents bucket (Strictly PRIVATE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('v2-verification-private', 'v2-verification-private', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "v2_verification_users_upload" ON storage.objects;
CREATE POLICY "v2_verification_users_upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'v2-verification-private'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "v2_verification_users_and_admins_view" ON storage.objects;
CREATE POLICY "v2_verification_users_and_admins_view" ON storage.objects
FOR SELECT USING (
  bucket_id = 'v2-verification-private'
  AND auth.uid() IS NOT NULL
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.v2_is_admin_or_operator())
);

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


-- >>> SECTION 2: CONTRIBUTION INGESTION & RPC <<<
-- =====================================================================
-- METFA V2 — CONTRIBUTION SYSTEM FOUNDATION & INGEST RPC
-- Migration: 20260925_v2_contribution_ingest_foundation.sql
-- =====================================================================

-- Step 1: Ensure public.v2_contribution_ledger has required first-class columns
-- and foreign key constraints updated to ON DELETE RESTRICT
DO $$
BEGIN
  -- Add entry_type column if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'v2_contribution_ledger'
      AND column_name = 'entry_type'
  ) THEN
    ALTER TABLE public.v2_contribution_ledger
      ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'AWARD'
      CHECK (entry_type IN ('AWARD', 'REVERSAL', 'ADJUSTMENT'));
  END IF;

  -- Add original_entry_id column if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'v2_contribution_ledger'
      AND column_name = 'original_entry_id'
  ) THEN
    ALTER TABLE public.v2_contribution_ledger
      ADD COLUMN original_entry_id UUID NULL
      REFERENCES public.v2_contribution_ledger(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Index for original_entry_id self-reference
CREATE INDEX IF NOT EXISTS idx_v2_contribution_original_entry
ON public.v2_contribution_ledger(original_entry_id);

-- Enforce ON DELETE RESTRICT on user_id foreign key (replacing CASCADE)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'v2_contribution_ledger_user_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'v2_contribution_ledger'
  ) THEN
    ALTER TABLE public.v2_contribution_ledger
      DROP CONSTRAINT v2_contribution_ledger_user_id_fkey;
  END IF;

  ALTER TABLE public.v2_contribution_ledger
    ADD CONSTRAINT v2_contribution_ledger_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE RESTRICT;
END $$;

-- Step 2: Replace blanket immutable trigger with field-level dual-layer trigger
DROP TRIGGER IF EXISTS trg_v2_contribution_ledger_immutable ON public.v2_contribution_ledger;
DROP TRIGGER IF EXISTS trg_v2_contribution_ledger_protect ON public.v2_contribution_ledger;

CREATE OR REPLACE FUNCTION public.v2_protect_contribution_ledger_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Unconditionally block any physical DELETE operation
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Deleting records from public.v2_contribution_ledger is strictly forbidden';
  END IF;

  -- 2. On UPDATE, verify immutable fields have not been altered
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'Field id in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Field user_id in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.action <> OLD.action THEN
      RAISE EXCEPTION 'Field action in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.policy_id IS DISTINCT FROM OLD.policy_id THEN
      RAISE EXCEPTION 'Field policy_id in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.base_points <> OLD.base_points THEN
      RAISE EXCEPTION 'Field base_points in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.quality_multiplier <> OLD.quality_multiplier THEN
      RAISE EXCEPTION 'Field quality_multiplier in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.final_points <> OLD.final_points THEN
      RAISE EXCEPTION 'Field final_points in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.source_ref IS DISTINCT FROM OLD.source_ref THEN
      RAISE EXCEPTION 'Field source_ref in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Field created_at in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.entry_type <> OLD.entry_type THEN
      RAISE EXCEPTION 'Field entry_type in public.v2_contribution_ledger is immutable';
    END IF;

    IF NEW.original_entry_id IS DISTINCT FROM OLD.original_entry_id THEN
      RAISE EXCEPTION 'Field original_entry_id in public.v2_contribution_ledger is immutable';
    END IF;

    -- 3. Write-once rule for revenue_period_id: once set, it can never be changed or cleared
    IF OLD.revenue_period_id IS NOT NULL AND (NEW.revenue_period_id IS DISTINCT FROM OLD.revenue_period_id) THEN
      RAISE EXCEPTION 'Field revenue_period_id is write-once and cannot be updated once bound';
    END IF;

    -- 4. Terminal states check
    IF OLD.status = 'SETTLED' AND NEW.status <> 'SETTLED' THEN
      RAISE EXCEPTION 'Settled contribution records cannot transition out of SETTLED status';
    END IF;

    IF OLD.status = 'DISCARDED' AND NEW.status <> 'DISCARDED' THEN
      RAISE EXCEPTION 'Discarded contribution records cannot transition out of DISCARDED status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_v2_contribution_ledger_protect
BEFORE UPDATE OR DELETE ON public.v2_contribution_ledger
FOR EACH ROW
EXECUTE FUNCTION public.v2_protect_contribution_ledger_fields();

-- Enforce strict RLS boundaries: clients have SELECT only; direct INSERT/UPDATE/DELETE are blocked
ALTER TABLE public.v2_contribution_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Disallow client direct insert on contribution ledger" ON public.v2_contribution_ledger;
CREATE POLICY "Disallow client direct insert on contribution ledger"
ON public.v2_contribution_ledger FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Disallow client direct update on contribution ledger" ON public.v2_contribution_ledger;
CREATE POLICY "Disallow client direct update on contribution ledger"
ON public.v2_contribution_ledger FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "Disallow client direct delete on contribution ledger" ON public.v2_contribution_ledger;
CREATE POLICY "Disallow client direct delete on contribution ledger"
ON public.v2_contribution_ledger FOR DELETE
USING (false);

-- Step 3: Event Idempotency Constraint
-- Unique canonical identity (user_id + action + source_ref) when source_ref is present
CREATE UNIQUE INDEX IF NOT EXISTS uq_v2_contribution_idempotency
ON public.v2_contribution_ledger (user_id, action, source_ref)
WHERE (source_ref IS NOT NULL);

-- Step 4: Seed Canonical Versioned Policies if not present
INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'ORIGINAL_CONTENT', 25, 2.00, 150, 300, 'STANDARD', 0.80, '{"min_content_length": 20}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'ORIGINAL_CONTENT');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'QUALIFIED_VIEW', 1, 1.00, 50, 15, 'STANDARD', 0.50, '{"min_view_duration_seconds": 5}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'QUALIFIED_VIEW');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'QUALIFIED_WATCH', 5, 2.00, 100, 30, 'STANDARD', 0.60, '{"min_watch_duration_seconds": 15, "min_completion_ratio": 0.60}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'QUALIFIED_WATCH');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'MEANINGFUL_ENGAGEMENT', 3, 1.50, 60, 20, 'STANDARD', 0.70, '{"min_content_length": 5}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'MEANINGFUL_ENGAGEMENT');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'COMMUNITY_CONTRIBUTION', 20, 2.00, 100, 180, 'STANDARD', 0.50, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'COMMUNITY_CONTRIBUTION');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'VERIFIED_ACTIVITY', 15, 1.50, 75, 60, 'VERIFIED', 0.30, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'VERIFIED_ACTIVITY');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'MARKETPLACE_CONTRIBUTION', 50, 1.50, 250, 300, 'STANDARD', 0.90, '{"require_verified_transaction": true}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'MARKETPLACE_CONTRIBUTION');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'BUSINESS_ACTIVITY', 40, 1.50, 200, 300, 'BUSINESS', 0.60, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'BUSINESS_ACTIVITY');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'AUDIO_USAGE', 10, 1.50, 50, 120, 'STANDARD', 0.50, '{"require_audio_license_verified": true}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'AUDIO_USAGE');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'AUDIO_ATTRIBUTION', 10, 1.20, 50, 120, 'STANDARD', 0.40, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'AUDIO_ATTRIBUTION');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'VOICE_POST_LISTEN', 4, 1.50, 40, 60, 'STANDARD', 0.50, '{"min_watch_duration_seconds": 10, "min_completion_ratio": 0.50}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'VOICE_POST_LISTEN');

INSERT INTO public.v2_contribution_policies (
  action, base_points, quality_multiplier_max, daily_limit_points,
  cooldown_seconds, eligibility_tier_required, fraud_weight, configuration, status, effective_from
)
SELECT 'CREATOR_ACTIVITY', 30, 2.00, 150, 300, 'CREATOR_PRO', 0.40, '{}'::jsonb, 'ACTIVE', '2026-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.v2_contribution_policies WHERE action = 'CREATOR_ACTIVITY');
