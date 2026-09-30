-- =====================================================================
-- 9. METFA VERIFIED FOUNDATION
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_tier TEXT NOT NULL CHECK (requested_tier IN (
    'INDIVIDUAL_CREATOR', 'BUSINESS', 'PUBLIC_FIGURE', 'BRAND_PAGE', 'ORGANIZATION'
  )),
  legal_full_name TEXT NOT NULL,
  country TEXT NOT NULL,
  id_document_type TEXT NOT NULL CHECK (id_document_type IN (
    'PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE', 'BUSINESS_REGISTRATION'
  )),
  id_document_secure_ref TEXT NOT NULL, -- Secure private storage reference (never public)
  portfolio_links TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'NOT_REQUESTED', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED',
    'APPROVED', 'REJECTED', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'APPEAL_REQUESTED'
  )),
  ai_pre_review_notes TEXT,
  risk_review_notes TEXT,
  admin_decision_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_verification_user ON public.v2_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_verification_status ON public.v2_verification_requests(status);

ALTER TABLE public.v2_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own verification requests" ON public.v2_verification_requests;
CREATE POLICY "Users can view their own verification requests"
ON public.v2_verification_requests FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Users can submit their own verification request" ON public.v2_verification_requests;
CREATE POLICY "Users can submit their own verification request"
ON public.v2_verification_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 10. RISK & FRAUD SIGNALS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'NOTICE' CHECK (severity IN ('INFO', 'NOTICE', 'WARNING', 'HIGH', 'CRITICAL')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  affected_module TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_risk_signals_user ON public.v2_risk_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_risk_signals_severity ON public.v2_risk_signals(severity);

ALTER TABLE public.v2_risk_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only operators can view risk signals" ON public.v2_risk_signals;
CREATE POLICY "Only operators can view risk signals"
ON public.v2_risk_signals FOR SELECT
USING (public.v2_is_admin_or_operator());

-- Canonical Option A: Risk Holds Lifecycle
CREATE TABLE IF NOT EXISTS public.v2_risk_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hold_type TEXT NOT NULL CHECK (hold_type IN ('contribution', 'reward', 'payout')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NOT NULL,
  placed_by UUID REFERENCES public.profiles(id),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_by UUID REFERENCES public.profiles(id),
  lifted_at TIMESTAMPTZ,
  lift_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_risk_holds_user_active ON public.v2_risk_holds(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_v2_risk_holds_type ON public.v2_risk_holds(hold_type);

ALTER TABLE public.v2_risk_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own risk holds" ON public.v2_risk_holds;
CREATE POLICY "Users can view their own risk holds"
ON public.v2_risk_holds FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Operators can modify risk holds" ON public.v2_risk_holds;
CREATE POLICY "Operators can modify risk holds"
ON public.v2_risk_holds FOR ALL
USING (public.v2_is_admin_or_operator());

-- =====================================================================
-- 11. AI HEALTH TELEMETRY (ZERO SECRETS STORED)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_ai_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  health_state TEXT NOT NULL CHECK (health_state IN (
    'HEALTHY', 'DEGRADED', 'MISSING', 'INVALID', 'QUOTA_EXCEEDED',
    'RATE_LIMITED', 'UNAVAILABLE', 'TIMEOUT', 'ERROR', 'RECOVERED', 'UNKNOWN'
  )),
  latency_ms INTEGER NOT NULL DEFAULT 0,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  error_category TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_ai_health_provider_time ON public.v2_ai_health_events(provider, recorded_at DESC);

ALTER TABLE public.v2_ai_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators can view AI health telemetry" ON public.v2_ai_health_events;
CREATE POLICY "Operators can view AI health telemetry"
ON public.v2_ai_health_events FOR SELECT
USING (public.v2_is_admin_or_operator());

-- =====================================================================
-- 12. METFA SIGNAL ENGINE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  why_detected TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'NOTICE', 'WARNING', 'HIGH', 'CRITICAL')),
  affected_module TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis JSONB,
  recommended_action TEXT,
  required_approval TEXT NOT NULL DEFAULT 'operator' CHECK (required_approval IN ('none', 'operator', 'admin', 'superadmin')),
  status TEXT NOT NULL DEFAULT 'DETECTED' CHECK (status IN (
    'DETECTED', 'AI_ANALYZED', 'TASK_CREATED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'RESOLVED', 'DISMISSED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_v2_signals_module_status ON public.v2_signals(affected_module, status);

ALTER TABLE public.v2_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators can view all signals" ON public.v2_signals;
CREATE POLICY "Operators can view all signals"
ON public.v2_signals FOR SELECT
USING (public.v2_is_admin_or_operator());
