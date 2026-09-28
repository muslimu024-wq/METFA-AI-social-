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
