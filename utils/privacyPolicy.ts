export type ProfilePrivacy = 'public' | 'private';

export type PostAudience = 'public' | 'followers' | 'only_me';

export type RawPostVisibility = PostAudience | 'private' | 'everyone' | null | undefined | (string & {});

export type FollowRelationStatus = 'none' | 'pending' | 'following';

export type FollowRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface FollowRequestRecord {
  id: string;
  requesterId: string;
  targetId: string;
  status: FollowRequestStatus;
  createdAt: string;
  updatedAt?: string;
  respondedAt?: string | null;
  requesterProfile?: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
  };
}

export interface AudienceAccessContext {
  visibility?: RawPostVisibility;
  authorId?: string | null;
  authorProfilePrivacy?: ProfilePrivacy | string | null;
  viewerId?: string | null;
  viewerFollowsAuthor?: boolean;
  viewerIsOwner?: boolean;
}

/**
 * Normalize raw stored visibility/audience into canonical METFA audiences.
 * Legacy `NULL`, empty, or unknown values MUST return `null` (never guessed as 'public')
 * so fail-closed owner-only rules are enforced deterministically.
 */
export function normalizeAudience(raw?: RawPostVisibility): PostAudience | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;

  if (cleaned === 'public' || cleaned === 'everyone') {
    return 'public';
  }
  if (cleaned === 'followers' || cleaned === 'followers_only') {
    return 'followers';
  }
  if (cleaned === 'only_me' || cleaned === 'private' || cleaned === 'owner' || cleaned === 'owner_only') {
    return 'only_me';
  }
  return null;
}

export function normalizeProfilePrivacy(raw?: string | null): ProfilePrivacy {
  return raw === 'private' ? 'private' : 'public';
}

export function normalizeDefaultPostAudience(raw?: string | null): PostAudience {
  const normalized = normalizeAudience(raw);
  return normalized || 'public';
}

export function isLegacyUnspecifiedAudience(raw?: RawPostVisibility): boolean {
  return normalizeAudience(raw) === null;
}

export function resolveViewerIsOwner(
  params: {
    authorId?: string | null;
    postingIdentityId?: string | null;
    postId?: string | null;
    explicitIsOwner?: boolean;
  },
  viewerId?: string | null,
  userScopedOwnedIds?: Set<string> | null
): boolean {
  if (params.explicitIsOwner) return true;
  if (!viewerId || viewerId === 'guest') return false;

  const cleanViewer = String(viewerId).trim();
  if (!cleanViewer) return false;

  if (params.authorId && String(params.authorId).trim() === cleanViewer) {
    return true;
  }
  if (params.postingIdentityId && String(params.postingIdentityId).trim() === cleanViewer) {
    return true;
  }
  if (params.postId && userScopedOwnedIds && userScopedOwnedIds.has(String(params.postId))) {
    return true;
  }
  return false;
}

/**
 * Central Fail-Closed Access Rule matching `public.can_view_post(...)`.
 */
export function canViewerAccessPost(ctx: AudienceAccessContext): boolean {
  const viewerId = ctx.viewerId && ctx.viewerId !== 'guest' ? String(ctx.viewerId).trim() : null;
  const authorId = ctx.authorId ? String(ctx.authorId).trim() : null;

  const isOwner = Boolean(
    ctx.viewerIsOwner || (viewerId && authorId && viewerId === authorId)
  );
  if (isOwner) {
    return true;
  }

  // Legacy NULL or unknown audience: FAIL-CLOSED owner-only
  const audience = normalizeAudience(ctx.visibility);
  if (audience === null) {
    return false;
  }

  // Only Me (including legacy 'private'): strictly owner-only
  if (audience === 'only_me') {
    return false;
  }

  const profilePrivacy = normalizeProfilePrivacy(ctx.authorProfilePrivacy);
  const isApprovedFollower = Boolean(viewerId && ctx.viewerFollowsAuthor);

  // Private profile gates all content (including posts marked 'public') to approved followers
  if (profilePrivacy === 'private') {
    return isApprovedFollower;
  }

  if (audience === 'followers') {
    return isApprovedFollower;
  }

  if (audience === 'public') {
    return true;
  }

  return false;
}

/**
 * External sharing, native Web Share, reshare, and Copy Link MUST be disabled for
 * followers-only, only_me, legacy private/NULL, and Private-Profile-authored posts.
 */
export function canSharePost(params: {
  visibility?: RawPostVisibility;
  authorProfilePrivacy?: ProfilePrivacy | string | null;
}): boolean {
  const audience = normalizeAudience(params.visibility);
  if (audience !== 'public') return false;
  if (normalizeProfilePrivacy(params.authorProfilePrivacy) === 'private') return false;
  return true;
}

export function canViewPrivateProfileContent(params: {
  targetUserId?: string | null;
  profilePrivacy?: ProfilePrivacy | string | null;
  viewerId?: string | null;
  viewerFollowsTarget?: boolean;
}): boolean {
  const viewerId = params.viewerId && params.viewerId !== 'guest' ? String(params.viewerId).trim() : null;
  const targetId = params.targetUserId ? String(params.targetUserId).trim() : null;

  if (viewerId && targetId && viewerId === targetId) {
    return true;
  }
  if (normalizeProfilePrivacy(params.profilePrivacy) === 'private') {
    return Boolean(viewerId && params.viewerFollowsTarget);
  }
  return true;
}

export function canViewFollowList(params: {
  targetUserId?: string | null;
  profilePrivacy?: ProfilePrivacy | string | null;
  viewerId?: string | null;
  viewerFollowsTarget?: boolean;
}): boolean {
  return canViewPrivateProfileContent(params);
}

export interface AudienceDisplayMeta {
  code: PostAudience | 'legacy_restricted';
  label: string;
  shortLabel: string;
  description: string;
  iconKey: 'globe' | 'users' | 'lock' | 'shield';
  isLegacyRestricted: boolean;
  isShareable: boolean;
}

export function formatAudienceMeta(
  visibility?: RawPostVisibility,
  authorProfilePrivacy?: ProfilePrivacy | string | null
): AudienceDisplayMeta {
  const audience = normalizeAudience(visibility);
  const shareable = canSharePost({ visibility, authorProfilePrivacy });

  if (audience === null) {
    return {
      code: 'legacy_restricted',
      label: 'Restricted (Owner Only)',
      shortLabel: 'Owner Only (Unset)',
      description: 'Legacy post with unset audience — only you can view it until you choose an audience.',
      iconKey: 'shield',
      isLegacyRestricted: true,
      isShareable: false,
    };
  }

  if (audience === 'only_me') {
    return {
      code: 'only_me',
      label: 'Only Me',
      shortLabel: 'Only Me',
      description: 'Only you can view this post. Sharing is disabled.',
      iconKey: 'lock',
      isLegacyRestricted: false,
      isShareable: false,
    };
  }

  if (audience === 'followers') {
    return {
      code: 'followers',
      label: 'Followers',
      shortLabel: 'Followers',
      description: 'Only approved followers can view this post. External sharing is disabled.',
      iconKey: 'users',
      isLegacyRestricted: false,
      isShareable: false,
    };
  }

  if (normalizeProfilePrivacy(authorProfilePrivacy) === 'private') {
    return {
      code: 'public',
      label: 'Approved Followers (Private Profile)',
      shortLabel: 'Followers Only',
      description: 'Your profile is Private, so only approved followers can see this post.',
      iconKey: 'users',
      isLegacyRestricted: false,
      isShareable: false,
    };
  }

  return {
    code: 'public',
    label: 'Public / Everyone',
    shortLabel: 'Public',
    description: 'Anyone on METFA Social can view and share this post.',
    iconKey: 'globe',
    isLegacyRestricted: false,
    isShareable: shareable,
  };
}
