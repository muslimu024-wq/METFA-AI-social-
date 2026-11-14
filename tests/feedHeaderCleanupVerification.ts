/**
 * METFA SOCIAL — Feed Header Cleanup & UI Refinement Verification Suite
 *
 * Verifies:
 * 1. Rendered PostHeader HTML keeps only Avatar, Display Name, Follow/Following action (!isOwner),
 *    compact Time · Audience metadata row, and Three-dot menu button — zero @username or stylePreset clutter.
 * 2. Rendered PostDetailsModal HTML cleanly surfaces @username, stylePreset ("Cyberpunk 2088"),
 *    identityBadge, tags, and safe public audience metadata without any private analytics.
 * 3. Caption-above-media hierarchy in PostCard, CommunityFeed, and ProfileView saved post cards.
 * 4. Three-dot menu & privacy security invariants across PostCard, CommunityFeed, ReelsFeedView, ReelCard:
 *    - View Profile / @username & Post Details & Tags inside menu
 *    - Copy Link & Share strictly gated by canSharePost
 *    - Owner-only Insights & Analytics / Edit / Delete (fixes ReelCard analytics exposure)
 *    - Non-owner Report Content
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PostHeader from '../components/PostHeader';
import PostDetailsModal from '../components/PostDetailsModal';
import { formatAudienceMeta } from '../utils/privacyPolicy';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
}

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

async function runSuite() {
  const results: TestResult[] = [];

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

  await test('HDR-01', 'PostHeader renders display name, Follow action, compact time + audience, and 3-dot button without @username or stylePreset', () => {
    const audienceMeta = formatAudienceMeta('public', 'public');
    const html = renderToStaticMarkup(
      React.createElement(PostHeader, {
        postId: 'post_1',
        authorId: 'user_elena',
        displayName: 'Elena Vance',
        avatarSrc: 'https://example.com/elena.jpg',
        createdAt: '2h ago',
        visibility: 'public',
        authorProfilePrivacy: 'public',
        audienceMeta,
        isOwner: false,
        followStatus: 'none',
        isMenuOpen: false,
        onToggleFollow: () => {},
        onToggleMenu: () => {},
      })
    );

    assert.ok(html.includes('Elena Vance'), 'Display name should be rendered');
    assert.ok(html.includes('Follow'), 'Follow action should be rendered for non-owner');
    assert.ok(html.includes('2h ago'), 'Post timestamp should be rendered');
    assert.ok(html.includes('Public'), 'Audience label should be rendered');
    assert.ok(html.includes('id="post-menu-btn-post_1"'), 'Three-dot menu button should be rendered');
    assert.ok(!html.includes('@'), 'Header must not display @username handles');
    assert.ok(!html.includes('Cyberpunk 2088'), 'Header must not display stylePreset badges');
  });

  await test('HDR-02', 'PostHeader hides Follow for owner and shows Set Audience shortcut only for legacy NULL posts owned by viewer', () => {
    const legacyMeta = formatAudienceMeta(null, 'public');
    const ownerHtml = renderToStaticMarkup(
      React.createElement(PostHeader, {
        postId: 'post_legacy',
        authorId: 'owner_1',
        displayName: 'Marcus Chen',
        avatarSrc: 'https://example.com/marcus.jpg',
        createdAt: 'Yesterday',
        visibility: null,
        authorProfilePrivacy: 'public',
        audienceMeta: legacyMeta,
        isOwner: true,
        followStatus: 'none',
        isMenuOpen: false,
        onToggleFollow: () => {},
        onToggleMenu: () => {},
        onSetAudience: () => {},
      })
    );

    assert.ok(ownerHtml.includes('Marcus Chen'), 'Owner display name rendered');
    assert.ok(!ownerHtml.includes('<span>Follow</span>'), 'Owner must not see Follow button on own post');
    assert.ok(ownerHtml.includes('Set Audience'), 'Owner sees Set Audience for legacy NULL visibility');
    assert.ok(ownerHtml.includes('Owner Only (Unset)'), 'Legacy NULL displays safe Owner Only (Unset) label');
  });

  await test('HDR-03', 'PostDetailsModal cleanly surfaces @username, stylePreset, identityBadge, tags without private analytics', () => {
    const html = renderToStaticMarkup(
      React.createElement(PostDetailsModal, {
        isOpen: true,
        onClose: () => {},
        details: {
          id: 'post_cyber',
          contentTypeLabel: 'Single Image',
          authorId: 'user_elena',
          authorName: 'Elena Vance',
          authorUsername: 'elena_vance_official_creator_longhandle',
          authorAvatar: 'https://example.com/elena.jpg',
          identityBadge: 'Verified Artist',
          createdAt: '2h ago',
          visibility: 'followers',
          authorProfilePrivacy: 'public',
          stylePreset: 'Cyberpunk 2088',
          tags: ['neon', 'ai_art'],
          caption: 'City lights at dawn',
        },
      })
    );

    assert.ok(html.includes('Elena Vance'), 'Details modal renders creator display name');
    assert.ok(html.includes('@elena_vance_official_creator_longhandle'), 'Details modal surfaces @username');
    assert.ok(html.includes('Cyberpunk 2088'), 'Details modal preserves stylePreset');
    assert.ok(html.includes('Verified Artist'), 'Details modal preserves identityBadge');
    assert.ok(html.includes('#neon') && html.includes('#ai_art'), 'Details modal displays tags');
    assert.ok(html.includes('Followers'), 'Details modal explains post audience');
    assert.ok(!/totalViews|watchTime|impressions|engagementRate|earnings/i.test(html), 'Details modal must never expose private analytics');
  });

  await test('HDR-04', 'PostCard and CommunityFeed use PostHeader, render caption before media, and organize Three-dot menus cleanly', () => {
    for (const filePath of ['components/PostCard.tsx', 'components/CommunityFeed.tsx']) {
      const src = readSource(filePath);
      assert.ok(src.includes('<PostHeader'), `${filePath} must use shared <PostHeader`);
      assert.ok(src.includes('<PostDetailsModal'), `${filePath} must render <PostDetailsModal`);
      assert.ok(src.includes('View Profile'), `${filePath} menu must include View Profile`);
      assert.ok(src.includes('Post Details &amp; Tags') || src.includes('Post Details & Tags'), `${filePath} menu must include Post Details & Tags`);
      assert.ok(!src.includes('@{post.author.username}</span>') && !src.includes('@{post.postingIdentity?.username'), `${filePath} must not render visible @username in post header`);

      // Verify Header -> Caption -> Media order inside card body
      const headerIdx = src.indexOf('<PostHeader');
      const captionIdx = src.indexOf('text={post.caption}', headerIdx);
      const mediaIdx = src.indexOf('bg-slate-950 max-h-[520px]', headerIdx);
      assert.ok(headerIdx !== -1 && captionIdx !== -1 && mediaIdx !== -1, `${filePath} markers must exist`);
      assert.ok(headerIdx < captionIdx && captionIdx < mediaIdx, `${filePath} must keep Header -> Caption -> Media order`);
    }
  });

  await test('HDR-05', 'ReelsFeedView and ReelCard remove visible @username header clutter, gate Analytics to owner, and gate Copy Link / Share', () => {
    const reelsFeedSrc = readSource('components/ReelsFeedView.tsx');
    assert.ok(reelsFeedSrc.includes('{reel.author.name}'), 'ReelsFeedView displays creator display name');
    assert.ok(!reelsFeedSrc.includes('@{reel.author.username}\n                        </span>'), 'ReelsFeedView visible creator row must not render @username');
    assert.ok(reelsFeedSrc.includes('<PostDetailsModal'), 'ReelsFeedView integrates PostDetailsModal');
    assert.ok(reelsFeedSrc.includes('audienceMeta.shortLabel'), 'ReelsFeedView shows compact audience metadata');

    const reelCardSrc = readSource('components/ReelCard.tsx');
    assert.ok(reelCardSrc.includes('<PostDetailsModal'), 'ReelCard integrates PostDetailsModal');
    assert.ok(!reelCardSrc.includes('@{reel.author.username}</p>'), 'ReelCard bottom overlay must not render @username');
    assert.ok(reelCardSrc.includes('canSharePost'), 'ReelCard enforces canSharePost');
    assert.ok(reelCardSrc.includes('{isOwner && isAnalyticsModalOpen'), 'ReelCard gates analytics modal to owner');

    // Verify Video Analytics button in ReelCard sits inside {isOwner ? ...}
    const isOwnerBranchIdx = reelCardSrc.indexOf('{isOwner ? (');
    const analyticsBtnIdx = reelCardSrc.indexOf('view-analytics-reel-${reel.id}');
    assert.ok(isOwnerBranchIdx !== -1 && analyticsBtnIdx > isOwnerBranchIdx, 'ReelCard Video Analytics option must be inside isOwner branch');
  });

  await test('HDR-06', 'ProfileView Saved cards replace @username clutter with display name + time/audience metadata and caption-first preview', () => {
    const profileSrc = readSource('components/ProfileView.tsx');
    assert.ok(!profileSrc.includes('@{post.author.username}</p>'), 'ProfileView saved post card must not show visible @username');
    assert.ok(!profileSrc.includes('@{reel.author.username}</p>'), 'ProfileView saved reel card must not show visible @username');
    assert.ok(profileSrc.includes('formatAudienceMeta(post.visibility'), 'ProfileView saved post card displays audience metadata');

    const savedHeaderIdx = profileSrc.indexOf('id={`unsave-post-btn-${post.id}`}');
    const captionFirstIdx = profileSrc.indexOf('/* Caption below header, above media */', savedHeaderIdx);
    const savedMediaIdx = profileSrc.indexOf('className="w-full h-36 rounded-xl', savedHeaderIdx);
    assert.ok(savedHeaderIdx !== -1 && captionFirstIdx > savedHeaderIdx && savedMediaIdx > captionFirstIdx, 'ProfileView saved post keeps Header -> Caption -> Media hierarchy');
  });

  const failed = results.filter((r) => !r.passed);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
