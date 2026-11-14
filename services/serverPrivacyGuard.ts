import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request } from 'express';
import {
  canViewerAccessPost,
  normalizeAudience,
  normalizeProfilePrivacy,
  type ProfilePrivacy,
} from '../utils/privacyPolicy';
import {
  extractBearerToken,
  getServerSupabaseClient,
  verifySupabaseToken,
} from './serverAuth';

export interface MediaAclEntry {
  fileName: string;
  ownerId: string;
  visibility: string | null;
  postId?: string;
  createdAt: string;
  updatedAt?: string;
}

const ANALYTICS_ADMIN_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATOR',
  'CONTENT_MANAGER',
]);

let cachedHmacSecret: string | null = null;

export function getMediaHmacSecret(dataDir = path.join(process.cwd(), 'data')): string {
  if (cachedHmacSecret) return cachedHmacSecret;

  const envSecret = (
    process.env.MEDIA_HMAC_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  if (envSecret.length >= 16) {
    cachedHmacSecret = crypto.createHash('sha256').update(envSecret).digest('hex');
    return cachedHmacSecret;
  }

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const secretFile = path.join(dataDir, '.media-hmac-secret');
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing.length >= 32) {
        cachedHmacSecret = existing;
        return cachedHmacSecret;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 });
    cachedHmacSecret = generated;
    return cachedHmacSecret;
  } catch {
    // Ephemeral fallback if filesystem is read-only
    cachedHmacSecret = crypto.randomBytes(32).toString('hex');
    return cachedHmacSecret;
  }
}

export function stripMediaSignature(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (!rawUrl.includes('/uploads/')) return rawUrl;
  const qIdx = rawUrl.indexOf('?');
  return qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);
}

export function signMediaUrlForViewer(
  rawUrl?: string | null,
  viewerId?: string | null,
  ttlSeconds = 900,
  dataDir = path.join(process.cwd(), 'data')
): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (!rawUrl.startsWith('/uploads/')) return rawUrl;

  const cleanUrl = stripMediaSignature(rawUrl);
  const fileName = path.basename(cleanUrl);
  if (!fileName) return cleanUrl;

  const uid = viewerId ? String(viewerId).trim() : 'anon';
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const secret = getMediaHmacSecret(dataDir);
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${fileName}:${uid}:${exp}`)
    .digest('hex');

  return `${cleanUrl}?mt=${sig}&exp=${exp}&uid=${encodeURIComponent(uid)}`;
}

export function verifyMediaSignature(
  fileName: string,
  query: Record<string, any> | undefined,
  dataDir = path.join(process.cwd(), 'data')
): { valid: boolean; viewerId: string | null } {
  if (!query || typeof query.mt !== 'string' || typeof query.exp !== 'string') {
    return { valid: false, viewerId: null };
  }

  const exp = Number(query.exp);
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) {
    return { valid: false, viewerId: null };
  }

  const uid = typeof query.uid === 'string' && query.uid.trim() ? query.uid.trim() : 'anon';
  const secret = getMediaHmacSecret(dataDir);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${path.basename(fileName)}:${uid}:${exp}`)
    .digest('hex');

  const provided = query.mt.trim();
  if (provided.length !== expected.length) {
    return { valid: false, viewerId: null };
  }

  try {
    const ok = crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
    return {
      valid: ok,
      viewerId: ok && uid !== 'anon' ? uid : null,
    };
  } catch {
    return { valid: false, viewerId: null };
  }
}

export function signPostMediaUrls<T extends Record<string, any>>(
  post: T,
  viewerId: string | null,
  dataDir = path.join(process.cwd(), 'data')
): T {
  if (!post || typeof post !== 'object') return post;
  const cloned: Record<string, any> = { ...post };
  if (typeof cloned.imageSrc === 'string') {
    cloned.imageSrc = signMediaUrlForViewer(cloned.imageSrc, viewerId, 900, dataDir);
  }
  if (typeof cloned.videoSrc === 'string') {
    cloned.videoSrc = signMediaUrlForViewer(cloned.videoSrc, viewerId, 900, dataDir);
  }
  if (typeof cloned.videoThumbnail === 'string') {
    cloned.videoThumbnail = signMediaUrlForViewer(cloned.videoThumbnail, viewerId, 900, dataDir);
  }
  if (Array.isArray(cloned.imageGallery)) {
    cloned.imageGallery = cloned.imageGallery.map((url: any) =>
      typeof url === 'string' ? signMediaUrlForViewer(url, viewerId, 900, dataDir) : url
    );
  }
  return cloned as T;
}

export function sanitizePostMediaUrlsForStorage<T extends Record<string, any>>(post: T): T {
  if (!post || typeof post !== 'object') return post;
  const cloned: Record<string, any> = { ...post };
  if (typeof cloned.imageSrc === 'string') {
    cloned.imageSrc = stripMediaSignature(cloned.imageSrc);
  }
  if (typeof cloned.videoSrc === 'string') {
    cloned.videoSrc = stripMediaSignature(cloned.videoSrc);
  }
  if (typeof cloned.videoThumbnail === 'string') {
    cloned.videoThumbnail = stripMediaSignature(cloned.videoThumbnail);
  }
  if (Array.isArray(cloned.imageGallery)) {
    cloned.imageGallery = cloned.imageGallery.map((url: any) =>
      typeof url === 'string' ? stripMediaSignature(url) : url
    );
  }
  return cloned as T;
}

function getMediaAclPath(dataDir = path.join(process.cwd(), 'data')): string {
  return path.join(dataDir, 'media-acl.json');
}

export function readMediaAcl(dataDir = path.join(process.cwd(), 'data')): Record<string, MediaAclEntry> {
  try {
    const p = getMediaAclPath(dataDir);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[MediaACL] Error reading media-acl.json:', err);
  }
  return {};
}

export function writeMediaAcl(
  acl: Record<string, MediaAclEntry>,
  dataDir = path.join(process.cwd(), 'data')
): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(getMediaAclPath(dataDir), JSON.stringify(acl, null, 2), 'utf8');
  } catch (err) {
    console.warn('[MediaACL] Error writing media-acl.json:', err);
  }
}

export function registerUploadedMediaAcl(
  entry: {
    fileName: string;
    ownerId: string;
    visibility?: string | null;
    postId?: string;
  },
  dataDir = path.join(process.cwd(), 'data')
): void {
  const cleanName = path.basename(entry.fileName);
  if (!cleanName || !entry.ownerId) return;
  const acl = readMediaAcl(dataDir);
  acl[cleanName] = {
    fileName: cleanName,
    ownerId: entry.ownerId,
    visibility: entry.visibility ?? null,
    postId: entry.postId,
    createdAt: new Date().toISOString(),
  };
  writeMediaAcl(acl, dataDir);
}

export function extractLocalUploadFilenamesFromPost(post: Record<string, any>): string[] {
  const candidates: string[] = [];
  const pushUrl = (u: any) => {
    if (typeof u === 'string' && u.startsWith('/uploads/')) {
      const name = path.basename(stripMediaSignature(u));
      if (name) candidates.push(name);
    }
  };
  pushUrl(post?.imageSrc);
  pushUrl(post?.videoSrc);
  pushUrl(post?.videoThumbnail);
  if (Array.isArray(post?.imageGallery)) {
    for (const u of post.imageGallery) pushUrl(u);
  }
  return Array.from(new Set(candidates));
}

export function syncPostMediaAcl(
  post: Record<string, any>,
  dataDir = path.join(process.cwd(), 'data')
): void {
  const files = extractLocalUploadFilenamesFromPost(post);
  if (files.length === 0) return;

  const ownerId = String(post.author?.id || post.author_id || post.userId || '').trim();
  const acl = readMediaAcl(dataDir);
  const now = new Date().toISOString();

  for (const fileName of files) {
    const existing = acl[fileName];
    acl[fileName] = {
      fileName,
      ownerId: existing?.ownerId || ownerId,
      visibility: post.visibility !== undefined ? post.visibility : (existing?.visibility ?? null),
      postId: post.id ? String(post.id) : existing?.postId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  }
  writeMediaAcl(acl, dataDir);
}

export function removePostMediaAcl(
  postId: string,
  dataDir = path.join(process.cwd(), 'data')
): void {
  if (!postId) return;
  const acl = readMediaAcl(dataDir);
  let changed = false;
  for (const [k, entry] of Object.entries(acl)) {
    if (entry.postId === postId) {
      delete acl[k];
      changed = true;
    }
  }
  if (changed) writeMediaAcl(acl, dataDir);
}

export interface ServerViewerContext {
  viewerId: string | null;
  roles: string[];
  privacyMap: Map<string, ProfilePrivacy>;
  followedSet: Set<string> | null;
}

export async function resolveOptionalViewerContext(req: Request): Promise<ServerViewerContext> {
  const token = extractBearerToken(req);
  let viewerId: string | null = null;
  let roles: string[] = [];

  if (token) {
    const supabase = getServerSupabaseClient();
    if (supabase) {
      try {
        const { user } = await verifySupabaseToken(supabase, token);
        if (user?.id) {
          viewerId = user.id;
          const metaRoles = [
            user.app_metadata?.role,
            ...(Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : []),
          ].filter((r): r is string => typeof r === 'string');
          roles = metaRoles;
        }
      } catch {}
    }
  }

  return {
    viewerId,
    roles,
    privacyMap: new Map<string, ProfilePrivacy>(),
    followedSet: null,
  };
}

async function resolveAuthorPrivacyOnServer(
  authorId: string | null,
  inlinePrivacy: string | null | undefined,
  ctx: ServerViewerContext
): Promise<ProfilePrivacy> {
  if (inlinePrivacy === 'private' || inlinePrivacy === 'public') {
    if (authorId) ctx.privacyMap.set(authorId, inlinePrivacy);
    return inlinePrivacy;
  }
  if (!authorId) return 'public';
  if (ctx.privacyMap.has(authorId)) {
    return ctx.privacyMap.get(authorId)!;
  }

  const supabase = getServerSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_privacy')
        .eq('id', authorId)
        .maybeSingle();
      if (!error && data) {
        const priv = normalizeProfilePrivacy((data as any).profile_privacy);
        ctx.privacyMap.set(authorId, priv);
        return priv;
      }
      if (supabase.auth?.admin) {
        const { data: uData } = await supabase.auth.admin.getUserById(authorId);
        if (uData?.user?.user_metadata?.profile_privacy) {
          const priv = normalizeProfilePrivacy(uData.user.user_metadata.profile_privacy);
          ctx.privacyMap.set(authorId, priv);
          return priv;
        }
      }
    } catch {}
  }

  ctx.privacyMap.set(authorId, 'public');
  return 'public';
}

async function resolveViewerFollowedSetOnServer(ctx: ServerViewerContext): Promise<Set<string>> {
  if (ctx.followedSet) return ctx.followedSet;
  const followed = new Set<string>();
  if (ctx.viewerId) {
    const supabase = getServerSupabaseClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', ctx.viewerId);
        if (Array.isArray(data)) {
          for (const row of data as any[]) {
            if (row?.following_id) followed.add(String(row.following_id));
          }
        }
      } catch {}
    }
  }
  ctx.followedSet = followed;
  return followed;
}

export async function canServerViewerAccessPost(
  post: Record<string, any>,
  ctx: ServerViewerContext
): Promise<boolean> {
  if (!post || typeof post !== 'object') return false;

  const authorId = (post.author?.id || post.author_id || post.userId || null) as string | null;
  if (ctx.viewerId && authorId && ctx.viewerId === authorId) {
    return true;
  }

  const normalized = normalizeAudience(post.visibility);
  // Legacy NULL / unknown / only_me / private -> fail-closed owner-only
  if (normalized === null || normalized === 'only_me') {
    return false;
  }

  const authorProfilePrivacy = await resolveAuthorPrivacyOnServer(
    authorId,
    post.authorProfilePrivacy || post.author?.profilePrivacy || post.author?.profile_privacy,
    ctx
  );

  let viewerFollowsAuthor = false;
  if (authorProfilePrivacy === 'private' || normalized === 'followers') {
    if (!ctx.viewerId || !authorId) return false;
    const followedSet = await resolveViewerFollowedSetOnServer(ctx);
    viewerFollowsAuthor = followedSet.has(authorId);
  }

  return canViewerAccessPost({
    visibility: post.visibility ?? null,
    authorId,
    authorProfilePrivacy,
    viewerId: ctx.viewerId,
    viewerFollowsAuthor,
  });
}

export async function authorizeMediaUploadAccess(params: {
  req: Request;
  fileName: string;
  posts: Record<string, any>[];
  dataDir?: string;
}): Promise<{ allowed: boolean; status: 200 | 401 | 403 | 404; reason?: string }> {
  const dataDir = params.dataDir || path.join(process.cwd(), 'data');
  const cleanFileName = path.basename(params.fileName);
  if (!cleanFileName || cleanFileName === '.' || cleanFileName === '..') {
    return { allowed: false, status: 404, reason: 'Invalid filename' };
  }

  const acl = readMediaAcl(dataDir);
  const aclEntry = acl[cleanFileName];
  const matchedPosts = params.posts.filter((p) =>
    extractLocalUploadFilenamesFromPost(p).includes(cleanFileName)
  );

  // Determine effective viewer: Bearer token takes priority, otherwise verified non-expired HMAC uid
  const ctx = await resolveOptionalViewerContext(params.req);
  const sigCheck = verifyMediaSignature(cleanFileName, params.req.query as any, dataDir);
  if (!ctx.viewerId && sigCheck.valid && sigCheck.viewerId) {
    ctx.viewerId = sigCheck.viewerId;
  }

  // Case A: Referenced by one or more posts in persistent store -> check post access
  if (matchedPosts.length > 0) {
    for (const post of matchedPosts) {
      const accessible = await canServerViewerAccessPost(post, ctx);
      if (accessible) {
        return { allowed: true, status: 200 };
      }
    }
    return {
      allowed: false,
      status: ctx.viewerId ? 403 : 401,
      reason: 'Access denied to restricted post media',
    };
  }

  // Case B: Unattached upload recorded in media-acl.json
  if (aclEntry) {
    if (ctx.viewerId && aclEntry.ownerId && ctx.viewerId === aclEntry.ownerId) {
      return { allowed: true, status: 200 };
    }
    if (normalizeAudience(aclEntry.visibility) === 'public') {
      return { allowed: true, status: 200 };
    }
    return {
      allowed: false,
      status: ctx.viewerId ? 403 : 401,
      reason: 'Access denied to private uploaded media',
    };
  }

  // Case C: Unknown legacy file in /uploads with no public post & no ACL entry -> fail-closed owner-only (401/403)
  return {
    allowed: false,
    status: ctx.viewerId ? 403 : 401,
    reason: 'Media ownership & visibility unspecified (fail-closed)',
  };
}

export function canAccessCreatorAnalytics(
  v2Auth: { userId: string; roles: string[] } | undefined,
  targetCreatorId?: string | null
): boolean {
  if (!v2Auth || !v2Auth.userId) return false;
  if (v2Auth.roles.some((r) => ANALYTICS_ADMIN_ROLES.has(r))) {
    return true;
  }
  if (!targetCreatorId) return false;
  return v2Auth.userId === String(targetCreatorId).trim();
}
