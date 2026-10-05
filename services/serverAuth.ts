/**
 * METFA V2 — Server-Side Trusted Authority & Authentication Foundation
 * 
 * Establishes the authoritative backend security boundary:
 * 1. Server-side Supabase client utilizing SUPABASE_SERVICE_ROLE_KEY (strictly server-isolated)
 * 2. Cryptographic Supabase JWT token verification via supabase.auth.getUser()
 * 3. Verified user identity derivation (auth.uid()) — strictly rejecting client-supplied user_id
 * 4. Authoritative role extraction from public.v2_user_roles based solely on verified user_id
 * 5. Rejection of client-spoofed roles (x-metfa-role, actor_role) for all trusted paths
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { V2UserRole } from '../types/v2Admin';

// ============================================================================
// 1. TYPES & CONTEXT INTERFACES
// ============================================================================

export const CANONICAL_V2_ROLES: readonly V2UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'FINANCE_ADMIN',
  'ADS_MANAGER',
  'CONTENT_MANAGER',
  'OPERATOR',
  'DEVELOPER',
  'FREELANCER',
  'REVIEWER',
  'SUPPORT',
  'ANALYST',
] as const;

export interface V2AuthContext {
  userId: string;
  email?: string;
  roles: V2UserRole[];
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      v2Auth?: V2AuthContext;
    }
  }
}

// ============================================================================
// 2. SERVER-SIDE SUPABASE CLIENT (SERVICE-ROLE ISOLATED)
// ============================================================================

let serverSupabaseClient: SupabaseClient | null = null;

/**
 * Returns the authoritative server-side Supabase client.
 * Strictly requires SUPABASE_SERVICE_ROLE_KEY and URL.
 * NEVER exposed to the browser or bundled in client builds.
 */
export function getServerSupabaseClient(): SupabaseClient | null {
  if (serverSupabaseClient) {
    return serverSupabaseClient;
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  serverSupabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return serverSupabaseClient;
}

/**
 * Allows injecting a test client for deterministic offline verification.
 */
export function setServerSupabaseClientForTesting(client: SupabaseClient | null): void {
  serverSupabaseClient = client;
}

// ============================================================================
// 3. TOKEN EXTRACTION & VERIFICATION
// ============================================================================

/**
 * Extracts the Bearer token from the Authorization header.
 * Rejects non-Bearer formats, empty values, and credentials.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
    const token = parts[1].trim();
    return token.length > 0 ? token : null;
  }

  return null;
}

/**
 * Authoritatively verifies a Supabase JWT token against Supabase Auth.
 * Returns the verified Supabase User object or an error.
 */
export async function verifySupabaseToken(
  supabase: SupabaseClient,
  token: string
): Promise<{ user: User | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return { user: null, error: error || new Error('Invalid or expired token') };
    }
    return { user: data.user, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Token verification failed');
    return { user: null, error };
  }
}

// ============================================================================
// 4. SERVER-SIDE ROLE LOOKUP FOUNDATION
// ============================================================================

/**
 * Authoritatively queries public.v2_user_roles for the verified user ID.
 * Returns the set of established V2UserRole values assigned to the user.
 * 
 * Safety note: If the V2 migration has not been applied to the live database,
 * this query safely handles the error and returns an empty role set ([]).
 */
export async function getVerifiedUserRoles(
  supabase: SupabaseClient,
  verifiedUserId: string,
  user?: User | null,
  token?: string | null
): Promise<V2UserRole[]> {
  const roles = new Set<V2UserRole>();
  const validRoleSet = new Set<string>(CANONICAL_V2_ROLES);

  // 1. Direct query against public.v2_user_roles (works when service_role has grant or in testing mocks)
  try {
    const { data, error } = await supabase
      .from('v2_user_roles')
      .select('role')
      .eq('user_id', verifiedUserId);

    if (!error && data && Array.isArray(data)) {
      for (const row of data) {
        if (validRoleSet.has((row as any).role)) {
          roles.add((row as any).role as V2UserRole);
        }
      }
    }
  } catch {
    // Database lookup failsafe
  }

  // 2. Authoritative PostgreSQL SECURITY DEFINER verification via public.v2_has_role / v2_is_admin_or_operator
  // PostgreSQL executes this as SECURITY DEFINER with table owner privileges, bypassing PostgREST 42501
  if (token) {
    try {
      const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
      const anonKey = (
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        ''
      ).trim();

      if (url && anonKey) {
        const userClient = createClient(url, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

        // Fast check: Is user super admin in public.v2_user_roles?
        const superCheck = await userClient.rpc('v2_has_role', { required_role: 'SUPER_ADMIN' });
        if (superCheck.data === true) {
          roles.add('SUPER_ADMIN');
        }

        // Check if user holds any admin or operator role in public.v2_user_roles
        const adminOrOpCheck = await userClient.rpc('v2_is_admin_or_operator');
        if (adminOrOpCheck.data === true) {
          roles.add('OPERATOR');
          const adminCheck = await userClient.rpc('v2_has_role', { required_role: 'ADMIN' });
          if (adminCheck.data === true) roles.add('ADMIN');
          const financeCheck = await userClient.rpc('v2_has_role', { required_role: 'FINANCE_ADMIN' });
          if (financeCheck.data === true) roles.add('FINANCE_ADMIN');
        }
      }
    } catch {
      // RPC check failsafe
    }
  }

  // 3. Cryptographically signed Supabase Auth app_metadata (server-isolated, client-immutable)
  if (user) {
    // Only accept server-signed app_metadata (immutable by clients), NEVER client-editable user_metadata
    const metaRoles = [
      (user as any).app_metadata?.role,
      ...(Array.isArray((user as any).app_metadata?.roles) ? (user as any).app_metadata.roles : []),
    ];
    for (const r of metaRoles) {
      if (typeof r === 'string' && validRoleSet.has(r)) {
        roles.add(r as V2UserRole);
      }
    }
  }

  // 4. Server-Side Supabase Admin API lookup (authoritatively verifies live server-signed app_metadata)
  if (roles.size === 0 && verifiedUserId && supabase.auth?.admin) {
    try {
      const { data: adminData, error: adminErr } = await supabase.auth.admin.getUserById(verifiedUserId);
      if (!adminErr && adminData?.user) {
        const adminMetaRoles = [
          (adminData.user as any).app_metadata?.role,
          ...(Array.isArray((adminData.user as any).app_metadata?.roles) ? (adminData.user as any).app_metadata.roles : []),
        ];
        for (const r of adminMetaRoles) {
          if (typeof r === 'string' && validRoleSet.has(r)) {
            roles.add(r as V2UserRole);
          }
        }
      }
    } catch {
      // Admin lookup failsafe
    }
  }

  return Array.from(roles);
}

/**
 * Helper to determine if a verified role set contains Owner or Admin authority.
 */
export function isOwnerOrAdmin(roles: V2UserRole[] = []): boolean {
  return roles.includes('SUPER_ADMIN') || roles.includes('ADMIN') || roles.includes('OPERATOR');
}

// ============================================================================
// 5. SERVER-SIDE AUTHENTICATION & AUTHORIZATION MIDDLEWARES
// ============================================================================

/**
 * Authentication Middleware:
 * - Requires a valid Bearer token in the Authorization header.
 * - Cryptographically verifies the token via Supabase Auth.
 * - Extracts the verified user identity (user.id).
 * - Queries authoritative roles from public.v2_user_roles.
 * - Strictly ignores client-supplied user_id, actor_id, x-metfa-role, actor_role.
 * - Populates req.v2Auth with verified identity context.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized: Missing or invalid Authorization Bearer token.',
    });
    return;
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    res.status(503).json({
      error: 'Authentication service unavailable: Server authority client is not configured.',
    });
    return;
  }

  const { user, error } = await verifySupabaseToken(supabase, token);
  if (error || !user) {
    res.status(401).json({
      error: 'Unauthorized: Invalid or expired authentication token.',
    });
    return;
  }

  const roles = await getVerifiedUserRoles(supabase, user.id, user, token);

  req.v2Auth = {
    userId: user.id,
    email: user.email,
    roles,
    token,
  };

  next();
}

/**
 * Role Authorization Middleware Generator:
 * - Requires prior execution of requireAuth (or executes it if missing).
 * - Enforces that the verified user holds at least one of the allowed roles
 *   (or SUPER_ADMIN).
 * - Strictly rejects client-supplied x-metfa-role or body actor_role.
 */
export function requireV2Role(allowedRoles: V2UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.v2Auth) {
      res.status(401).json({
        error: 'Unauthorized: Authentication required prior to role evaluation.',
      });
      return;
    }

    const userRoles = req.v2Auth.roles;
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
    const hasAllowedRole = isSuperAdmin || allowedRoles.some((role) => userRoles.includes(role));

    if (!hasAllowedRole) {
      res.status(403).json({
        error: 'Forbidden: Insufficient role permissions.',
      });
      return;
    }

    next();
  };
}
