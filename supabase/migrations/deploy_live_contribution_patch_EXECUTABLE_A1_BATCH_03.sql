-- =====================================================================
-- 6. WALLET ACCOUNTS & WALLET LEDGER
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD',
  available_balance_cents BIGINT NOT NULL DEFAULT 0,
  pending_balance_cents BIGINT NOT NULL DEFAULT 0,
  locked_balance_cents BIGINT NOT NULL DEFAULT 0,
  lifetime_earnings_cents BIGINT NOT NULL DEFAULT 0,
  lifetime_payouts_cents BIGINT NOT NULL DEFAULT 0,
  is_locked_for_audit BOOLEAN NOT NULL DEFAULT false,
  lock_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_wallet_user_id ON public.v2_wallet_accounts(user_id);

ALTER TABLE public.v2_wallet_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wallet account" ON public.v2_wallet_accounts;
CREATE POLICY "Users can view their own wallet account"
ON public.v2_wallet_accounts FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

-- Append-Only Wallet Ledger (Double-entry audit trail)
CREATE TABLE IF NOT EXISTS public.v2_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.v2_wallet_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'REWARD_CREDIT', 'PAYOUT_DEBIT', 'AUDIT_ADJUSTMENT', 'BONUS_CREDIT', 'REVERSAL_DEBIT'
  )),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance_after_cents BIGINT NOT NULL,
  reference_id TEXT, -- e.g. allocation ID or payout request ID
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_wallet_ledger_user ON public.v2_wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_wallet_ledger_wallet ON public.v2_wallet_ledger(wallet_id);

ALTER TABLE public.v2_wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wallet ledger" ON public.v2_wallet_ledger;
CREATE POLICY "Users can view their own wallet ledger"
ON public.v2_wallet_ledger FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

-- =====================================================================
-- 7. PAYOUT REQUESTS & PAYOUT LEDGER
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.v2_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payout_method TEXT NOT NULL CHECK (payout_method IN (
    'BANK_TRANSFER', 'BKASH', 'NAGAD', 'STRIPE_CONNECT', 'WISE', 'OTHER'
  )),
  account_details_masked TEXT NOT NULL, -- Never store raw plain-text banking credentials
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
    'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED'
  )),
  kyc_status_ref TEXT NOT NULL DEFAULT 'VERIFIED',
  risk_score INTEGER NOT NULL DEFAULT 0,
  admin_notes TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  transaction_ref TEXT,
  failure_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_payout_requests_user ON public.v2_payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_payout_requests_status ON public.v2_payout_requests(status);

ALTER TABLE public.v2_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payout requests" ON public.v2_payout_requests;
CREATE POLICY "Users can view their own payout requests"
ON public.v2_payout_requests FOR SELECT
USING (auth.uid() = user_id OR public.v2_is_admin_or_operator());

DROP POLICY IF EXISTS "Users can insert their own payout requests" ON public.v2_payout_requests;
CREATE POLICY "Users can insert their own payout requests"
ON public.v2_payout_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);
