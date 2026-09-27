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
EXCEPTION
  WHEN OTHERS THEN
    -- If profiles table or constraint is not yet available, pass gracefully
    NULL;
END $$;

-- Step 2: Replace blanket immutable trigger with field-level dual-layer trigger
DROP TRIGGER IF EXISTS trg_v2_contribution_ledger_immutable ON public.v2_contribution_ledger;
DROP TRIGGER IF EXISTS trg_v2_contribution_ledger_protect ON public.v2_contribution_ledger;

CREATE OR REPLACE FUNCTION public.v2_protect_contribution_ledger_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Step 5: Master Ingest RPC Implementation
CREATE OR REPLACE FUNCTION public.v2_ingest_contribution(
  p_action TEXT,
  p_source_ref TEXT,
  p_client_payload JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_auth_uid UUID;
  v_effective_user_id UUID;
  v_feature_enabled BOOLEAN;
  v_kill_switch_active BOOLEAN;
  v_existing_id UUID;
  v_existing_points INTEGER;
  v_existing_status TEXT;
  v_policy RECORD;
  v_user_tier TEXT := 'STANDARD';
  v_is_verified BOOLEAN := false;
  v_last_action_at TIMESTAMPTZ;
  v_elapsed_seconds NUMERIC;
  v_today_points INTEGER := 0;
  v_quality_multiplier NUMERIC(3,2) := 1.00;
  v_risk_score INTEGER := 0;
  v_qualification_reason TEXT := 'Passed quality verification';
  v_raw_calculated_points INTEGER;
  v_available_points_room INTEGER;
  v_final_points INTEGER;
  v_status TEXT;
  v_new_id UUID;

  -- Payload parsing variables
  v_watch_duration NUMERIC;
  v_min_duration NUMERIC;
  v_completion_ratio NUMERIC;
  v_min_ratio NUMERIC;
  v_content_text TEXT;
  v_min_length INTEGER;
  v_tx_status TEXT;
BEGIN
  -- A. Authentication & User Identity Validation
  v_caller_role := COALESCE(auth.role(), 'anon');
  v_auth_uid := auth.uid();

  IF v_caller_role = 'anon' OR (v_auth_uid IS NULL AND v_caller_role <> 'service_role') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'UNAUTHENTICATED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Authentication required. Anonymous requests are rejected.'
    );
  END IF;

  IF v_caller_role = 'service_role' THEN
    IF p_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'REJECTED',
        'points_awarded', 0,
        'is_duplicate', false,
        'rejection_reason', 'Backend service_role caller must specify p_user_id.'
      );
    END IF;
    v_effective_user_id := p_user_id;
  ELSE
    -- Authenticated client caller
    IF p_user_id IS NOT NULL AND p_user_id <> v_auth_uid THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'UNAUTHORIZED',
        'points_awarded', 0,
        'is_duplicate', false,
        'rejection_reason', 'Unauthorized: Caller cannot submit contribution for another user.'
      );
    END IF;
    v_effective_user_id := v_auth_uid;
  END IF;

  -- Verify user profile exists
  SELECT is_verified INTO v_is_verified
  FROM public.profiles
  WHERE id = v_effective_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'User profile not found in public.profiles.'
    );
  END IF;

  -- Determine user tier from profile verification
  IF v_is_verified IS TRUE THEN
    v_user_tier := 'VERIFIED';
  ELSE
    v_user_tier := 'STANDARD';
  END IF;

  -- B. Feature Flag & Emergency Kill Switch Check
  SELECT enabled INTO v_feature_enabled
  FROM public.v2_feature_flags
  WHERE key = 'contribution_enabled';

  IF v_feature_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'DISABLED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Feature flag contribution_enabled is inactive. Contributions paused.'
    );
  END IF;

  SELECT is_active INTO v_kill_switch_active
  FROM public.v2_kill_switches
  WHERE key = 'contribution_paused';

  IF v_kill_switch_active IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'DISABLED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Emergency kill switch contribution_paused is active. Ingestion paused.'
    );
  END IF;

  -- Basic input sanity
  IF p_action IS NULL OR trim(p_action) = '' OR p_source_ref IS NULL OR trim(p_source_ref) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Missing required activity parameters: action or source_ref.'
    );
  END IF;

  -- C. Self-Farming Protection
  IF COALESCE((p_client_payload->>'is_self_action')::boolean, false) IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Self-farming detected: Users cannot earn contribution points on their own content/actions.'
    );
  END IF;

  -- D. Event Idempotency Check (Primary: user_id + action + source_ref)
  SELECT id, final_points, status INTO v_existing_id, v_existing_points, v_existing_status
  FROM public.v2_contribution_ledger
  WHERE user_id = v_effective_user_id
    AND action = p_action
    AND source_ref = p_source_ref
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'DUPLICATE',
      'contribution_id', v_existing_id,
      'points_awarded', v_existing_points,
      'is_duplicate', true,
      'rejection_reason', NULL
    );
  END IF;

  -- Secondary replay check: explicit idempotency_key in metadata
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id, final_points, status INTO v_existing_id, v_existing_points, v_existing_status
    FROM public.v2_contribution_ledger
    WHERE metadata->>'idempotency_key' = p_idempotency_key
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'DUPLICATE',
        'contribution_id', v_existing_id,
        'points_awarded', v_existing_points,
        'is_duplicate', true,
        'rejection_reason', NULL
      );
    END IF;
  END IF;

  -- E. Policy Resolution
  SELECT * INTO v_policy
  FROM public.v2_contribution_policies
  WHERE action = p_action
    AND status = 'ACTIVE'
    AND effective_from <= NOW()
    AND (effective_until IS NULL OR effective_until >= NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_policy.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', format('No active policy configured for action %s.', p_action)
    );
  END IF;

  -- Tier Requirement Check
  IF v_policy.eligibility_tier_required = 'VERIFIED' AND v_user_tier <> 'VERIFIED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'REJECTED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', format('User tier %s does not meet required tier %s.', v_user_tier, v_policy.eligibility_tier_required)
    );
  END IF;

  -- F. Cooldown Verification
  SELECT created_at INTO v_last_action_at
  FROM public.v2_contribution_ledger
  WHERE user_id = v_effective_user_id
    AND action = p_action
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_action_at IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_last_action_at));
    IF v_elapsed_seconds < v_policy.cooldown_seconds THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'COOLDOWN',
        'points_awarded', 0,
        'is_duplicate', false,
        'rejection_reason', format('Cooldown active: Must wait %s seconds before next %s.', ceil(v_policy.cooldown_seconds - v_elapsed_seconds), p_action)
      );
    END IF;
  END IF;

  -- G. Daily Limit Verification
  SELECT COALESCE(SUM(final_points), 0) INTO v_today_points
  FROM public.v2_contribution_ledger
  WHERE user_id = v_effective_user_id
    AND action = p_action
    AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
    AND status IN ('QUALIFIED', 'RECORDED');

  IF v_today_points >= v_policy.daily_limit_points THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'RATE_LIMITED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', format('Daily limit of %s CP reached for %s.', v_policy.daily_limit_points, p_action)
    );
  END IF;

  -- H. Qualification Rules & Quality Multiplier Scaling
  CASE p_action
    WHEN 'QUALIFIED_VIEW' THEN
      v_watch_duration := COALESCE((p_client_payload->>'watch_duration_seconds')::numeric, 0);
      v_min_duration := COALESCE((v_policy.configuration->>'min_view_duration_seconds')::numeric, 5);
      IF v_watch_duration < v_min_duration THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('View duration of %ss below threshold of %ss.', v_watch_duration, v_min_duration)
        );
      END IF;

    WHEN 'QUALIFIED_WATCH', 'VOICE_POST_LISTEN' THEN
      v_watch_duration := COALESCE((p_client_payload->>'watch_duration_seconds')::numeric, 0);
      v_completion_ratio := COALESCE((p_client_payload->>'completion_ratio')::numeric, 0);
      v_min_duration := COALESCE((v_policy.configuration->>'min_watch_duration_seconds')::numeric, 15);
      v_min_ratio := COALESCE((v_policy.configuration->>'min_completion_ratio')::numeric, 0.60);

      IF v_watch_duration < v_min_duration THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('Watch duration (%ss) below minimum policy requirement (%ss).', v_watch_duration, v_min_duration)
        );
      END IF;

      IF v_completion_ratio < v_min_ratio THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('Completion ratio (%s%%) below minimum policy required (%s%%).', (v_completion_ratio * 100)::int, (v_min_ratio * 100)::int)
        );
      END IF;

      IF v_completion_ratio >= 0.90 THEN
        v_quality_multiplier := LEAST(v_policy.quality_multiplier_max, 1.80);
      ELSIF v_completion_ratio >= 0.75 THEN
        v_quality_multiplier := LEAST(v_policy.quality_multiplier_max, 1.40);
      END IF;

    WHEN 'ORIGINAL_CONTENT' THEN
      v_content_text := COALESCE(p_client_payload->>'content_text', '');
      v_min_length := COALESCE((v_policy.configuration->>'min_content_length')::int, 20);

      IF length(v_content_text) < v_min_length THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('Original content length (%s chars) below required threshold (%s chars).', length(v_content_text), v_min_length)
        );
      END IF;

      -- Check for repetitive spam sequences
      IF (v_content_text ~ '(.)\1{6,}') THEN
        v_risk_score := 85;
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', 'Content flagged for repetitive character sequences.'
        );
      END IF;

      IF COALESCE((p_client_payload->>'is_original')::boolean, false) IS TRUE THEN
        v_quality_multiplier := LEAST(v_policy.quality_multiplier_max, 1.50);
      END IF;

    WHEN 'MEANINGFUL_ENGAGEMENT' THEN
      v_content_text := COALESCE(p_client_payload->>'content_text', '');
      v_min_length := COALESCE((v_policy.configuration->>'min_content_length')::int, 5);

      IF length(v_content_text) < v_min_length THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', 'Engagement comment does not meet meaningful length standards.'
        );
      END IF;

    WHEN 'MARKETPLACE_CONTRIBUTION' THEN
      v_tx_status := COALESCE(p_client_payload->>'transaction_status', '');
      IF COALESCE((v_policy.configuration->>'require_verified_transaction')::boolean, false) IS TRUE AND v_tx_status <> 'COMPLETED' THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', format('Marketplace contribution requires COMPLETED transaction status. Received: %s.', v_tx_status)
        );
      END IF;
      v_quality_multiplier := LEAST(v_policy.quality_multiplier_max, 1.25);

    WHEN 'AUDIO_USAGE', 'AUDIO_ATTRIBUTION' THEN
      IF COALESCE((v_policy.configuration->>'require_audio_license_verified')::boolean, false) IS TRUE
         AND COALESCE((p_client_payload->>'audio_attribution_valid')::boolean, false) IS NOT TRUE THEN
        RETURN jsonb_build_object(
          'success', false,
          'status', 'REJECTED',
          'points_awarded', 0,
          'is_duplicate', false,
          'rejection_reason', 'Audio contribution requires valid attribution and license verification.'
        );
      END IF;

    ELSE
      v_quality_multiplier := 1.00;
  END CASE;

  -- I. Calculate Server-Authoritative Points
  v_raw_calculated_points := FLOOR(v_policy.base_points * v_quality_multiplier);
  v_available_points_room := GREATEST(0, v_policy.daily_limit_points - v_today_points);
  v_final_points := LEAST(v_raw_calculated_points, v_available_points_room);

  IF v_final_points <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'RATE_LIMITED',
      'points_awarded', 0,
      'is_duplicate', false,
      'rejection_reason', 'Available daily points capacity exhausted.'
    );
  END IF;

  -- J. Risk Threshold Evaluation (Risk > 75 -> FLAGGED_RISK)
  IF v_risk_score > 75 THEN
    v_status := 'FLAGGED_RISK';
  ELSE
    v_status := 'QUALIFIED';
  END IF;

  -- K. Database Ledger Insertion (Concurrently safe)
  INSERT INTO public.v2_contribution_ledger (
    user_id,
    action,
    policy_id,
    base_points,
    quality_multiplier,
    final_points,
    source_ref,
    risk_score,
    status,
    revenue_period_id,
    entry_type,
    original_entry_id,
    metadata
  ) VALUES (
    v_effective_user_id,
    p_action,
    v_policy.id,
    v_policy.base_points,
    v_quality_multiplier,
    v_final_points,
    p_source_ref,
    v_risk_score,
    v_status,
    NULL,
    'AWARD',
    NULL,
    jsonb_build_object(
      'payload_summary', p_client_payload,
      'qualification_reason', v_qualification_reason,
      'idempotency_key', p_idempotency_key
    )
  )
  RETURNING id INTO v_new_id;

  -- L. Integrate with Risk Signals if Flagged (Step 6)
  IF v_status = 'FLAGGED_RISK' THEN
    BEGIN
      INSERT INTO public.v2_risk_signals (
        user_id,
        signal_type,
        severity,
        risk_score,
        affected_module,
        evidence,
        status
      ) VALUES (
        v_effective_user_id,
        'CONTRIBUTION_ANOMALY',
        'WARNING',
        v_risk_score,
        'contribution',
        jsonb_build_object(
          'contribution_id', v_new_id,
          'action', p_action,
          'risk_score', v_risk_score,
          'reason', v_qualification_reason
        ),
        'ACTIVE'
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Non-blocking if risk_signals table is not ready
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'contribution_id', v_new_id,
    'points_awarded', v_final_points,
    'is_duplicate', false,
    'rejection_reason', NULL
  );

EXCEPTION
  WHEN unique_violation THEN
    -- In case of concurrent insert race on uq_v2_contribution_idempotency
    SELECT id, final_points, status INTO v_existing_id, v_existing_points, v_existing_status
    FROM public.v2_contribution_ledger
    WHERE user_id = v_effective_user_id
      AND action = p_action
      AND source_ref = p_source_ref
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'DUPLICATE',
      'contribution_id', v_existing_id,
      'points_awarded', v_existing_points,
      'is_duplicate', true,
      'rejection_reason', NULL
    );
END;
$$;

-- Revoke execute from public; grant explicitly to authenticated and service_role
REVOKE ALL ON FUNCTION public.v2_ingest_contribution(TEXT, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_ingest_contribution(TEXT, TEXT, JSONB, TEXT, UUID) TO authenticated, service_role;
