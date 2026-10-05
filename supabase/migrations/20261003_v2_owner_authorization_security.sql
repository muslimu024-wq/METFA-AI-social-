-- =====================================================================
-- METFA V2 — Live Server Role Authorization & Grants
-- Migration: 20261003_v2_owner_authorization_security.sql
-- 
-- Fixes PostgreSQL 42501 permission denied for table public.v2_user_roles:
-- Grants minimum required SELECT privileges to service_role so that
-- authoritative backend services can verify user roles without bypassing RLS.
-- =====================================================================

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON TABLE public.v2_user_roles TO service_role;

-- Ensure RLS is active
ALTER TABLE public.v2_user_roles ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if current authenticated user has an administrative role
CREATE OR REPLACE FUNCTION public.v2_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.v2_user_roles
    WHERE user_id = auth.uid()
      AND (role = required_role OR role = 'SUPER_ADMIN')
  );
END;
$$;

-- Helper security function: Check if current user has any admin/operator role
CREATE OR REPLACE FUNCTION public.v2_is_admin_or_operator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.v2_user_roles
    WHERE user_id = auth.uid()
      AND role IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'OPERATOR')
  );
END;
$$;

-- Ensure public execution privileges on security definer helper functions
GRANT EXECUTE ON FUNCTION public.v2_has_role(TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.v2_is_admin_or_operator() TO authenticated, service_role, anon;
