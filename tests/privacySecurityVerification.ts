/**
 * METFA SOCIAL — Phase 1 Privacy & Security Verification Suite
 *
 * Verifies:
 * 1. Full post audience & profile privacy matrix across Public/Private profiles
 * 2. Legacy NULL & unknown audience fail-closed owner-only enforcement
 * 3. External Share & Copy Link blocking on restricted & Private-Profile content
 * 4. Follow-based privacy model (no Friends / Friend Request / Mutual Friends)
 * 5. Logout & account-switch user-scoped cache isolation & cross-device sync replacement
 * 6. Bookmark visibility filtering when audience / profile privacy / follow changes
 * 7. Express server privacy guard (HMAC signed URLs, expiry/tamper checks, fail-closed uploads ACL, cross-user analytics blocking)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Install minimal browser globals for Node execution so localStorage & CustomEvent paths execute end-to-end
function installNodeBrowserShim() {
  const store = new Map<string, string>();
  const storageShim = {
    get length() {
      return store.size;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };

  if (typeof (globalThis as any).CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class CustomEventShim {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }

  if (typeof (globalThis as any).localStorage === 'undefined') {
    (globalThis as any).localStorage = storageShim;
  }

  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = {
      localStorage: (globalThis as any).localStorage,
      sessionStorage: storageShim,
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  }
}

installNodeBrowserShim();

import {
  normalizeAudience,
  normalizeProfilePrivacy,
  normalizeDefaultPostAudience,
  isLegacyUnspecifiedAudience,
  resolveViewerIsOwner,
  canViewerAccessPost,
  canSharePost,
  canViewPrivateProfileContent,
  canViewFollowList,
  formatAudienceMeta,
} from '../utils/privacyPolicy';
import {
  clearFollowCache,
  replaceFollowedUsersCache,
  replacePendingFollowRequestsCache,
  syncFollowCache,
  syncPendingFollowRequestCache,
  isUserFollowed,
  isFollowRequestPending,
  getFollowedUsers,
  getPendingFollowRequestTargetIds,
} from '../utils/followStore';
import {
  filterVisibleSavedPosts,
  filterVisibleSavedReels,
  clearBookmarkCache,
  saveSavedPostIds,
  getSavedPostIds,
} from '../utils/bookmarkStore';
import {
  isContentOwner,
  recordOwnedPostId,
  isLocallyOwnedPost,
  clearCommunityLocalCache,
} from '../utils/communityStore';
import { clearAllUserScopedCaches } from '../services/authService';
import {
  signMediaUrlForViewer,
  verifyMediaSignature,
  stripMediaSignature,
  signPostMediaUrls,
  sanitizePostMediaUrlsForStorage,
  registerUploadedMediaAcl,
  syncPostMediaAcl,
  authorizeMediaUploadAccess,
  canServerViewerAccessPost,
  canAccessCreatorAnalytics,
  type ServerViewerContext,
} from '../services/serverPrivacyGuard';
import type { CommunityPost, ReelHighlight } from '../types/community';

interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const FOLLOWER_ID = '22222222-2222-4222-8222-222222222222';
const STRANGER_ID = '33333333-3333-4333-8333-333333333333';

async function runSuite() {
  const results: TestCaseResult[] = [];

  const test = async (id: string, name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ id, name, passed: true });
      console.log(`PASS [${id}] ${name}`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      results.push({ id, name, passed: false, error: msg });
      console.error(`FAIL [${id}] ${name}: ${msg}`);
    }
  };

  // 1. Normalization & Legacy NULL fail-closed behavior
  await test('PRIV-01', 'normalizeAudience preserves canonical values and returns null for legacy/unknown values', () => {
    assert.equal(normalizeAudience('public'), 'public');
    assert.equal(normalizeAudience('EVERYONE'), 'public');
    assert.equal(normalizeAudience('followers'), 'followers');
    assert.equal(normalizeAudience('followers_only'), 'followers');
    assert.equal(normalizeAudience('only_me'), 'only_me');
    assert.equal(normalizeAudience('private'), 'only_me');
    assert.equal(normalizeAudience(null), null);
    assert.equal(normalizeAudience(undefined), null);
    assert.equal(normalizeAudience(''), null);
    assert.equal(normalizeAudience('friends_only'), null);
    assert.equal(normalizeAudience('custom_unknown'), null);
    assert.equal(isLegacyUnspecifiedAudience(null), true);
    assert.equal(isLegacyUnspecifiedAudience(''), true);
    assert.equal(isLegacyUnspecifiedAudience('public'), false);
    assert.equal(normalizeProfilePrivacy('private'), 'private');
    assert.equal(normalizeProfilePrivacy(null), 'public');
    assert.equal(normalizeDefaultPostAudience(null), 'public');
  });

  // 2. Full access matrix across Public Profile and Private Profile
  await test('PRIV-02', 'Public Profile audience matrix (public, followers, only_me, NULL)', () => {
    const audiences: Array<{
      vis: any;
      owner: boolean;
      follower: boolean;
      stranger: boolean;
      anon: boolean;
    }> = [
      { vis: 'public', owner: true, follower: true, stranger: true, anon: true },
      { vis: 'followers', owner: true, follower: true, stranger: false, anon: false },
      { vis: 'only_me', owner: true, follower: false, stranger: false, anon: false },
      { vis: 'private', owner: true, follower: false, stranger: false, anon: false },
      { vis: null, owner: true, follower: false, stranger: false, anon: false },
      { vis: 'legacy_unknown', owner: true, follower: false, stranger: false, anon: false },
    ];

    for (const row of audiences) {
      assert.equal(
        canViewerAccessPost({
          visibility: row.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'public',
          viewerId: OWNER_ID,
          viewerFollowsAuthor: false,
        }),
        row.owner,
        `Public profile owner access failed for visibility=${String(row.vis)}`
      );
      assert.equal(
        canViewerAccessPost({
          visibility: row.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'public',
          viewerId: FOLLOWER_ID,
          viewerFollowsAuthor: true,
        }),
        row.follower,
        `Public profile follower access failed for visibility=${String(row.vis)}`
      );
      assert.equal(
        canViewerAccessPost({
          visibility: row.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'public',
          viewerId: STRANGER_ID,
          viewerFollowsAuthor: false,
        }),
        row.stranger,
        `Public profile stranger access failed for visibility=${String(row.vis)}`
      );
      assert.equal(
        canViewerAccessPost({
          visibility: row.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'public',
          viewerId: null,
          viewerFollowsAuthor: false,
        }),
        row.anon,
        `Public profile anon access failed for visibility=${String(row.vis)}`
      );
      assert.equal(
        canViewerAccessPost({
          visibility: row.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'public',
          viewerId: 'guest',
          viewerFollowsAuthor: true,
        }),
        row.anon,
        `Public profile guest access failed for visibility=${String(row.vis)}`
      );
    }
  });

  await test('PRIV-03', 'Private Profile gates even public posts to approved followers and keeps only_me/NULL owner-only', () => {
    const cases: Array<{ vis: any; follower: boolean; stranger: boolean; anon: boolean }> = [
      { vis: 'public', follower: true, stranger: false, anon: false },
      { vis: 'followers', follower: true, stranger: false, anon: false },
      { vis: 'only_me', follower: false, stranger: false, anon: false },
      { vis: 'private', follower: false, stranger: false, anon: false },
      { vis: null, follower: false, stranger: false, anon: false },
    ];

    for (const c of cases) {
      assert.equal(
        canViewerAccessPost({
          visibility: c.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'private',
          viewerId: OWNER_ID,
          viewerFollowsAuthor: false,
        }),
        true
      );
      assert.equal(
        canViewerAccessPost({
          visibility: c.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'private',
          viewerId: FOLLOWER_ID,
          viewerFollowsAuthor: true,
        }),
        c.follower,
        `Private profile follower failed for ${String(c.vis)}`
      );
      assert.equal(
        canViewerAccessPost({
          visibility: c.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'private',
          viewerId: STRANGER_ID,
          viewerFollowsAuthor: false,
        }),
        c.stranger,
        `Private profile stranger failed for ${String(c.vis)}`
      );
      assert.equal(
        canViewerAccessPost({
          visibility: c.vis,
          authorId: OWNER_ID,
          authorProfilePrivacy: 'private',
          viewerId: null,
          viewerFollowsAuthor: false,
        }),
        c.anon,
        `Private profile anon failed for ${String(c.vis)}`
      );
    }
  });

  // 3. External sharing & Copy Link blocking
  await test('PRIV-04', 'canSharePost blocks external share & Copy Link for followers, only_me, private, NULL, and Private Profile posts', () => {
    assert.equal(canSharePost({ visibility: 'public', authorProfilePrivacy: 'public' }), true);
    assert.equal(canSharePost({ visibility: 'public', authorProfilePrivacy: 'private' }), false);
    assert.equal(canSharePost({ visibility: 'followers', authorProfilePrivacy: 'public' }), false);
    assert.equal(canSharePost({ visibility: 'only_me', authorProfilePrivacy: 'public' }), false);
    assert.equal(canSharePost({ visibility: 'private', authorProfilePrivacy: 'public' }), false);
    assert.equal(canSharePost({ visibility: null, authorProfilePrivacy: 'public' }), false);
    assert.equal(canSharePost({ visibility: 'unknown', authorProfilePrivacy: 'public' }), false);

    assert.equal(formatAudienceMeta(null, 'public').isLegacyRestricted, true);
    assert.equal(formatAudienceMeta(null, 'public').isShareable, false);
    assert.equal(formatAudienceMeta('public', 'private').isShareable, false);
    assert.equal(formatAudienceMeta('public', 'public').isShareable, true);
  });

  // 4. Profile privacy content & Follow list visibility
  await test('PRIV-05', 'Private profile content & follower/following lists locked to owner + approved followers', () => {
    assert.equal(
      canViewPrivateProfileContent({
        targetUserId: OWNER_ID,
        profilePrivacy: 'private',
        viewerId: OWNER_ID,
        viewerFollowsTarget: false,
      }),
      true
    );
    assert.equal(
      canViewPrivateProfileContent({
        targetUserId: OWNER_ID,
        profilePrivacy: 'private',
        viewerId: FOLLOWER_ID,
        viewerFollowsTarget: true,
      }),
      true
    );
    assert.equal(
      canViewPrivateProfileContent({
        targetUserId: OWNER_ID,
        profilePrivacy: 'private',
        viewerId: STRANGER_ID,
        viewerFollowsTarget: false,
      }),
      false
    );
    assert.equal(
      canViewFollowList({
        targetUserId: OWNER_ID,
        profilePrivacy: 'private',
        viewerId: null,
        viewerFollowsTarget: false,
      }),
      false
    );
    assert.equal(
      canViewFollowList({
        targetUserId: OWNER_ID,
        profilePrivacy: 'public',
        viewerId: null,
        viewerFollowsTarget: false,
      }),
      true
    );
  });

  // 5. Logout & account switch cache isolation + authoritative replacement
  await test('PRIV-06', 'Logout & account switch purge all user-scoped caches and isolate owned post IDs', () => {
    clearAllUserScopedCaches();

    // User A creates a follow & local owned post & bookmark
    syncFollowCache({ id: FOLLOWER_ID, name: 'Follower User', username: 'follower_u' }, true);
    syncPendingFollowRequestCache(STRANGER_ID, true);
    saveSavedPostIds(['post-a-1']);
    recordOwnedPostId('post-a-1', OWNER_ID);

    assert.equal(isUserFollowed(FOLLOWER_ID), true);
    assert.equal(isFollowRequestPending(STRANGER_ID), true);
    assert.deepEqual(getSavedPostIds(), ['post-a-1']);
    assert.equal(isLocallyOwnedPost('post-a-1', OWNER_ID), true);
    // Account B must not inherit Account A's scoped local ownership
    assert.equal(isLocallyOwnedPost('post-a-1', FOLLOWER_ID), false);
    assert.equal(isContentOwner({ id: OWNER_ID }, { id: 'guest' }, null, undefined, 'post-a-1'), false);
    assert.equal(
      isContentOwner({ id: OWNER_ID }, { id: FOLLOWER_ID, username: 'follower_u' }, { id: FOLLOWER_ID }, undefined, 'post-a-1'),
      false
    );

    // Authoritative replacement clears cross-device unfollowed users
    replaceFollowedUsersCache([STRANGER_ID]);
    assert.equal(isUserFollowed(FOLLOWER_ID), false);
    assert.equal(isUserFollowed(STRANGER_ID), true);

    replacePendingFollowRequestsCache([]);
    assert.equal(getPendingFollowRequestTargetIds().length, 0);

    // Full logout purge
    clearAllUserScopedCaches();
    clearFollowCache();
    clearBookmarkCache();
    clearCommunityLocalCache();

    assert.equal(getFollowedUsers().length, 0);
    assert.equal(getPendingFollowRequestTargetIds().length, 0);
    assert.equal(getSavedPostIds().length, 0);
    assert.equal(isLocallyOwnedPost('post-a-1', OWNER_ID), false);
    assert.equal(resolveViewerIsOwner({ authorId: OWNER_ID }, 'guest'), false);
  });

  // 6. Bookmarks re-validation when privacy / audience / follow changes
  await test('PRIV-07', 'Saved Posts and Saved Reels filter out unfollowed/private/only_me/NULL items dynamically', () => {
    const samplePosts: CommunityPost[] = [
      {
        id: 'p-public',
        author: { id: OWNER_ID, name: 'A', username: 'a', avatar: '', profilePrivacy: 'public' },
        prompt: 'pub',
        tags: [],
        likesCount: 0,
        remixCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        isLiked: false,
        comments: [],
        createdAt: 'now',
        visibility: 'public',
      },
      {
        id: 'p-followers',
        author: { id: OWNER_ID, name: 'A', username: 'a', avatar: '', profilePrivacy: 'public' },
        prompt: 'fol',
        tags: [],
        likesCount: 0,
        remixCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        isLiked: false,
        comments: [],
        createdAt: 'now',
        visibility: 'followers',
      },
      {
        id: 'p-onlyme',
        author: { id: OWNER_ID, name: 'A', username: 'a', avatar: '', profilePrivacy: 'public' },
        prompt: 'onlyme',
        tags: [],
        likesCount: 0,
        remixCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        isLiked: false,
        comments: [],
        createdAt: 'now',
        visibility: 'only_me',
      },
      {
        id: 'p-legacy-null',
        author: { id: OWNER_ID, name: 'A', username: 'a', avatar: '', profilePrivacy: 'public' },
        prompt: 'legacy',
        tags: [],
        likesCount: 0,
        remixCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        isLiked: false,
        comments: [],
        createdAt: 'now',
        visibility: null,
      },
    ];

    const nonFollowerVisible = filterVisibleSavedPosts(samplePosts, {
      viewerId: STRANGER_ID,
      followedUserIds: new Set<string>(),
      profilesPrivacyMap: new Map([[OWNER_ID, 'public']]),
    });
    assert.deepEqual(
      nonFollowerVisible.map((p) => p.id),
      ['p-public']
    );

    // If owner flips profile privacy to private, non-follower loses access to p-public too
    const privateAuthorNonFollower = filterVisibleSavedPosts(samplePosts, {
      viewerId: STRANGER_ID,
      followedUserIds: new Set<string>(),
      profilesPrivacyMap: new Map([[OWNER_ID, 'private']]),
    });
    assert.deepEqual(privateAuthorNonFollower, []);

    const sampleReels: ReelHighlight[] = [
      {
        id: 'r-fol',
        author: { id: OWNER_ID, name: 'A', username: 'a', avatar: '' },
        videoSrc: 'https://example.com/v.mp4',
        thumbnailSrc: '',
        title: 'Follower Reel',
        caption: 'Followers only caption',
        duration: 10,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: 'now',
        visibility: 'followers',
      },
      {
        id: 'r-null',
        author: { id: OWNER_ID, name: 'A', username: 'a', avatar: '' },
        videoSrc: 'https://example.com/v2.mp4',
        thumbnailSrc: '',
        title: 'Legacy Reel',
        caption: 'Legacy null caption',
        duration: 10,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: 'now',
        visibility: null,
      },
    ];

    const followerReels = filterVisibleSavedReels(sampleReels, {
      viewerId: FOLLOWER_ID,
      followedUserIds: new Set([OWNER_ID]),
      profilesPrivacyMap: new Map([[OWNER_ID, 'private']]),
    });
    assert.deepEqual(
      followerReels.map((r) => r.id),
      ['r-fol']
    );
  });

  // 7. Server privacy guard: Signed URLs, Media ACL, Fail-Closed Uploads, and Analytics Access
  await test('PRIV-08', 'Server media HMAC signature minting, tampering rejection, and storage sanitization', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metfa-privacy-test-'));
    try {
      const signed = signMediaUrlForViewer('/uploads/secret-clip.mp4', OWNER_ID, 300, tmpDir);
      assert.ok(signed.includes('mt=') && signed.includes('exp=') && signed.includes(`uid=${OWNER_ID}`));

      const parsedUrl = new URL(`http://localhost${signed}`);
      const query = Object.fromEntries(parsedUrl.searchParams.entries());
      const okCheck = verifyMediaSignature('secret-clip.mp4', query, tmpDir);
      assert.equal(okCheck.valid, true);
      assert.equal(okCheck.viewerId, OWNER_ID);

      // Tampering filename or uid or mt must fail
      assert.equal(verifyMediaSignature('other-clip.mp4', query, tmpDir).valid, false);
      assert.equal(verifyMediaSignature('secret-clip.mp4', { ...query, uid: STRANGER_ID }, tmpDir).valid, false);
      assert.equal(verifyMediaSignature('secret-clip.mp4', { ...query, exp: '1' }, tmpDir).valid, false);

      assert.equal(stripMediaSignature(signed), '/uploads/secret-clip.mp4');

      const signedPost = signPostMediaUrls(
        {
          id: 'p1',
          imageSrc: '/uploads/a.jpg',
          videoSrc: '/uploads/b.mp4',
          imageGallery: ['/uploads/c.jpg', 'https://cdn.example.com/ext.jpg'],
        },
        FOLLOWER_ID,
        tmpDir
      );
      assert.ok(signedPost.imageSrc.includes('mt='));
      assert.ok(signedPost.videoSrc.includes('mt='));
      assert.ok(signedPost.imageGallery[0].includes('mt='));
      assert.equal(signedPost.imageGallery[1], 'https://cdn.example.com/ext.jpg');

      const sanitized = sanitizePostMediaUrlsForStorage(signedPost);
      assert.equal(sanitized.imageSrc, '/uploads/a.jpg');
      assert.equal(sanitized.videoSrc, '/uploads/b.mp4');
      assert.equal(sanitized.imageGallery[0], '/uploads/c.jpg');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await test('PRIV-09', 'Server /uploads ACL fails closed on unreferenced/private/NULL media and allows authorized signed viewer', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metfa-acl-test-'));
    try {
      // Unknown file (not in ACL, not in posts) -> fail-closed 401
      const unknownRes = await authorizeMediaUploadAccess({
        req: { headers: {}, query: {} } as any,
        fileName: 'orphan-legacy.jpg',
        posts: [],
        dataDir: tmpDir,
      });
      assert.equal(unknownRes.allowed, false);
      assert.equal(unknownRes.status, 401);

      // Unattached private upload recorded in ACL
      registerUploadedMediaAcl(
        { fileName: 'draft-private.jpg', ownerId: OWNER_ID, visibility: 'only_me' },
        tmpDir
      );
      const signedDraft = signMediaUrlForViewer('/uploads/draft-private.jpg', OWNER_ID, 300, tmpDir);
      const draftQuery = Object.fromEntries(new URL(`http://localhost${signedDraft}`).searchParams.entries());

      const ownerDraftRes = await authorizeMediaUploadAccess({
        req: { headers: {}, query: draftQuery } as any,
        fileName: 'draft-private.jpg',
        posts: [],
        dataDir: tmpDir,
      });
      assert.equal(ownerDraftRes.allowed, true);

      const strangerDraftRes = await authorizeMediaUploadAccess({
        req: { headers: {}, query: {} } as any,
        fileName: 'draft-private.jpg',
        posts: [],
        dataDir: tmpDir,
      });
      assert.equal(strangerDraftRes.allowed, false);

      // Attached post media with visibility='followers' from public profile
      const restrictedPost = {
        id: 'post-fol-1',
        author: { id: OWNER_ID, profilePrivacy: 'public' },
        visibility: 'followers',
        imageSrc: '/uploads/followers-only.jpg',
      };
      syncPostMediaAcl(restrictedPost, tmpDir);

      const signedForOwner = signMediaUrlForViewer('/uploads/followers-only.jpg', OWNER_ID, 300, tmpDir);
      const ownerQuery = Object.fromEntries(new URL(`http://localhost${signedForOwner}`).searchParams.entries());

      const postOwnerRes = await authorizeMediaUploadAccess({
        req: { headers: {}, query: ownerQuery } as any,
        fileName: 'followers-only.jpg',
        posts: [restrictedPost],
        dataDir: tmpDir,
      });
      assert.equal(postOwnerRes.allowed, true);

      const postAnonRes = await authorizeMediaUploadAccess({
        req: { headers: {}, query: {} } as any,
        fileName: 'followers-only.jpg',
        posts: [restrictedPost],
        dataDir: tmpDir,
      });
      assert.equal(postAnonRes.allowed, false);

      // Server post guard enforces follow/privacy/NULL
      const ctxFollower: ServerViewerContext = {
        viewerId: FOLLOWER_ID,
        roles: [],
        privacyMap: new Map([[OWNER_ID, 'private']]),
        followedSet: new Set([OWNER_ID]),
      };
      const ctxStranger: ServerViewerContext = {
        viewerId: STRANGER_ID,
        roles: [],
        privacyMap: new Map([[OWNER_ID, 'private']]),
        followedSet: new Set<string>(),
      };

      assert.equal(await canServerViewerAccessPost(restrictedPost, ctxFollower), true);
      assert.equal(await canServerViewerAccessPost(restrictedPost, ctxStranger), false);
      assert.equal(
        await canServerViewerAccessPost(
          { id: 'legacy', author: { id: OWNER_ID }, visibility: null },
          ctxFollower
        ),
        false
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await test('PRIV-10', 'Analytics endpoint guard prevents cross-user data read while allowing owner and admins', () => {
    assert.equal(canAccessCreatorAnalytics(undefined, OWNER_ID), false);
    assert.equal(canAccessCreatorAnalytics({ userId: STRANGER_ID, roles: ['USER'] }, OWNER_ID), false);
    assert.equal(canAccessCreatorAnalytics({ userId: OWNER_ID, roles: ['USER'] }, OWNER_ID), true);
    assert.equal(canAccessCreatorAnalytics({ userId: STRANGER_ID, roles: ['ADMIN'] }, OWNER_ID), true);
    assert.equal(canAccessCreatorAnalytics({ userId: OWNER_ID, roles: ['USER'] }, null), false);
  });

  // 8. Non-Friend-Model terminology check across privacy policy & reviewable SQL migration
  await test('PRIV-11', 'Follow-based terminology enforced cleanly (no Friend / Friend Request / Mutual Friends)', () => {
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20261114_privacy_follow_requests_post_audience.sql'),
      'utf8'
    );
    const forbidden = /\b(friend_request|mutual_friends|add friend|friendships)\b/i;
    assert.equal(forbidden.test(migrationSql), false, 'SQL migration must not include Friends model terminology');
    assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.follow_requests'));
    assert.ok(migrationSql.includes("CHECK (status IN ('pending', 'approved', 'declined', 'cancelled'))"));
    assert.ok(migrationSql.includes('p_visibility IS NULL OR p_visibility NOT IN'));
  });

  const failed = results.filter((r) => !r.passed);
  console.log(`\nPrivacy Security Verification Summary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

runSuite().catch((err) => {
  console.error('Fatal test suite error:', err);
  process.exitCode = 1;
});
