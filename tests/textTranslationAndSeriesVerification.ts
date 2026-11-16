/**
 * METFA SOCIAL — PHASE A RUNTIME GUARDS, MULTILINGUAL TEXT TRANSLATION,
 * & EXPLICIT TEXT SERIES (SERIAL STORY) VERIFICATION SUITE
 */

import * as fs from 'fs';
import { CommunityPost, ReelHighlight } from '../types/community';
import {
  isExplicitSeriesItem,
  isExplicitTextSeriesPost,
  resolveTextSeriesNavigationContext,
  groupCreatorTextSeries,
  recordTextReadingProgress,
  getTextReadingProgressForSeries,
  getContinueReadingForCreator,
} from '../utils/videoSeries';
import {
  computeTextContentHash,
  getCachedTranslation,
  saveCachedTranslation,
  invalidatePostTranslations,
  getPreferredTranslationLanguage,
  setPreferredTranslationLanguage,
  reportPoorTranslation,
  getTranslationReports,
  detectReliableSourceLanguageLabel,
} from '../utils/translationCache';
import { sanitizeAvatarUrl, GUEST_AVATAR } from '../services/authService';
import { getSavedPostIds, getSavedReelIds } from '../utils/bookmarkStore';
import { translatePostText, TranslationServiceError } from '../services/translationService';
import { canViewerAccessPost } from '../utils/privacyPolicy';

// Bind browser-compatible global window/localStorage mock for Node tsx execution
const mockStore: Record<string, string> = {};
const localStorageShim = {
  getItem: (k: string) => (k in mockStore ? mockStore[k] : null),
  setItem: (k: string, v: string) => {
    mockStore[k] = String(v);
  },
  removeItem: (k: string) => {
    delete mockStore[k];
  },
  clear: () => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  },
};
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageShim;
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    localStorage: (globalThis as any).localStorage,
    dispatchEvent: () => true,
  };
}

interface AssertionResult {
  testId: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

function makeTextPost(
  overrides: Partial<CommunityPost> & { id: string }
): CommunityPost {
  return {
    id: overrides.id,
    author: {
      id: 'author-1',
      name: 'Nadia Rahman',
      username: 'nadia_writes',
      avatar: 'https://example.com/nadia.jpg',
      isVerified: true,
      profilePrivacy: 'public',
      ...(overrides.author || {}),
    },
    prompt: overrides.caption || 'Sample story text',
    caption: 'Sample story text',
    postType: 'text',
    mediaType: undefined,
    image: undefined,
    videoSrc: undefined,
    likesCount: 0,
    remixCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    createdAt: '10m ago',
    createdAtIso: '2026-11-16T00:00:00.000Z',
    visibility: 'public',
    tags: [],
    comments: [],
    ...overrides,
  };
}

export async function runTextTranslationAndSeriesVerification(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: AssertionResult[];
}> {
  const results: AssertionResult[] = [];
  const assert = (
    testId: string,
    category: string,
    description: string,
    condition: boolean,
    evidence: string
  ) => {
    results.push({
      testId,
      category,
      description,
      status: condition ? 'PASS' : 'FAIL',
      evidence,
    });
  };

  (globalThis as any).window.localStorage.clear();

  const serverCode = fs.readFileSync('server.ts', 'utf-8');
  const communityFeedCode = fs.readFileSync('components/CommunityFeed.tsx', 'utf-8');
  const postCardCode = fs.readFileSync('components/PostCard.tsx', 'utf-8');
  const createPostCode = fs.readFileSync('components/CreatePostModal.tsx', 'utf-8');
  const editPostCode = fs.readFileSync('components/EditPostModal.tsx', 'utf-8');
  const profileViewCode = fs.readFileSync('components/ProfileView.tsx', 'utf-8');
  const translationBarCode = fs.readFileSync('components/TextPostTranslationBar.tsx', 'utf-8');
  const textSeriesBarCode = fs.readFileSync('components/TextSeriesNavigationBar.tsx', 'utf-8');
  const reelsViewCode = fs.readFileSync('components/ReelsFeedView.tsx', 'utf-8');

  // -----------------------------------------------------------------------
  // 1. PHASE A RUNTIME GUARDS & REGRESSION FIXES
  // -----------------------------------------------------------------------
  {
    (globalThis as any).window.localStorage.setItem('metfa_saved_posts_ids_v2', '{"not":"an_array"}');
    (globalThis as any).window.localStorage.setItem('metfa_saved_reels_ids_v2', '{"not":"an_array"}');
    const savedPosts = getSavedPostIds();
    const savedReels = getSavedReelIds();
    assert(
      'RUNTIME-1',
      'Runtime Guards',
      'bookmarkStore handles corrupted non-array JSON cleanly without TypeError',
      Array.isArray(savedPosts) && savedPosts.length === 0 && Array.isArray(savedReels) && savedReels.length === 0,
      `getSavedPostIds()=${savedPosts.length}, getSavedReelIds()=${savedReels.length}`
    );

    const sanitizedEmpty = sanitizeAvatarUrl('');
    const sanitizedNull = sanitizeAvatarUrl(null);
    assert(
      'RUNTIME-2',
      'Runtime Guards',
      'sanitizeAvatarUrl replaces empty/null URLs with safe GUEST_AVATAR',
      sanitizedEmpty === GUEST_AVATAR && sanitizedNull === GUEST_AVATAR && sanitizedEmpty.length > 0,
      `sanitized="${sanitizedEmpty}"`
    );

    const communityCleanOpenReel =
      !communityFeedCode.includes("setTimeout(() => {\n        window.dispatchEvent(new CustomEvent('metfa_open_reel'");
    const noMutatingErrorBoundary = !reelsViewCode.includes('setVideoPlaybackError(null);\n      }');
    assert(
      'RUNTIME-3',
      'Runtime Guards',
      'Reels navigation has no duplicate dispatch loop & static source audit passes',
      communityCleanOpenReel && noMutatingErrorBoundary && serverCode.includes('app.post("/api/ai/translate"'),
      `communityClean=${communityCleanOpenReel}, translateRoutePresent=${serverCode.includes('app.post("/api/ai/translate"')}`
    );
  }

  // -----------------------------------------------------------------------
  // 2. TRANSLATION CACHE HIT, HASH DETERMINISM & EDIT INVALIDATION
  // -----------------------------------------------------------------------
  {
    const textV1 = 'আসসালামু আলাইকুম!\n\nআজকে আমরা নতুন গল্প শুরু করছি ✨ — "ভোরের আলো" @nadia #story';
    const textV2 = 'আসসালামু আলাইকুম!\n\nআজকে আমরা নতুন গল্পের দ্বিতীয় খণ্ড শুরু করছি ✨ — "ভোরের আলো" @nadia #story';

    const h1 = computeTextContentHash(textV1);
    const h1Repeat = computeTextContentHash(textV1);
    const h2 = computeTextContentHash(textV2);

    assert(
      'TRANS-CACHE-1',
      'Text Translation',
      'computeTextContentHash is deterministic and changes when post text changes',
      h1 === h1Repeat && h1 !== h2 && h1.length > 0,
      `h1=${h1}, h2=${h2}`
    );

    saveCachedTranslation({
      postId: 'post-tr-1',
      contentHash: h1,
      targetLanguage: 'en',
      detectedSourceLanguage: 'Bengali',
      translatedText: 'Assalamu Alaikum!\n\nToday we are starting a new story ✨ — "Morning Light" @nadia #story',
      modelUsed: 'gemini-4-hydrogen',
      createdAt: new Date().toISOString(),
    });

    const hitSameHash = getCachedTranslation('post-tr-1', textV1, 'en');
    const missEditedHash = getCachedTranslation('post-tr-1', textV2, 'en');
    const missOtherLang = getCachedTranslation('post-tr-1', textV1, 'ar');

    assert(
      'TRANS-CACHE-2',
      'Text Translation',
      'Cached translation hits for same (postId, text, lang) and auto-invalidates on edited text hash',
      hitSameHash !== null &&
        hitSameHash.translatedText.includes('Morning Light') &&
        missEditedHash === null &&
        missOtherLang === null,
      `hit=${Boolean(hitSameHash)}, missEdited=${missEditedHash === null}, missLang=${missOtherLang === null}`
    );

    invalidatePostTranslations('post-tr-1');
    const afterInvalidate = getCachedTranslation('post-tr-1', textV1, 'en');
    const editCallsInvalidate = editPostCode.includes('invalidatePostTranslations(');

    assert(
      'TRANS-CACHE-3',
      'Text Translation',
      'invalidatePostTranslations clears stale cache entries and is wired into EditPostModal',
      afterInvalidate === null && editCallsInvalidate,
      `cleared=${afterInvalidate === null}, editHook=${editCallsInvalidate}`
    );
  }

  // -----------------------------------------------------------------------
  // 3. REAL AI TRANSLATION ERROR / MISSING API KEY HANDLING (ZERO FAKE FALLBACK)
  // -----------------------------------------------------------------------
  {
    const origFetch = globalThis.fetch;
    let thrownErr: any = null;
    (globalThis as any).fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'Translation is unavailable because no Gemini API key is configured on the server.',
          code: 'AI_KEY_REQUIRED',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );

    try {
      await translatePostText({
        postId: 'post-fail-1',
        text: 'Bonjour tout le monde!\n\nCeci est un test.',
        targetLanguage: 'bn',
      });
    } catch (err) {
      thrownErr = err;
    } finally {
      globalThis.fetch = origFetch;
    }

    const usesGeminiHydrogen = serverCode.includes('"gemini-4-hydrogen"') && serverCode.includes('User-Agent');
    const uiHasRetryAndOriginalPreserved =
      translationBarCode.includes('Retry') &&
      translationBarCode.includes('Show Original') &&
      translationBarCode.includes('See Translation') &&
      translationBarCode.includes('Machine translated');

    assert(
      'TRANS-ERR-1',
      'Text Translation',
      'Missing API key / server failure throws TranslationServiceError (never returns fake translation)',
      thrownErr instanceof TranslationServiceError &&
        thrownErr.code === 'AI_KEY_REQUIRED' &&
        thrownErr.status === 503 &&
        usesGeminiHydrogen &&
        uiHasRetryAndOriginalPreserved,
      `code=${thrownErr?.code}, status=${thrownErr?.status}, usesGemini=${usesGeminiHydrogen}, retryUI=${uiHasRetryAndOriginalPreserved}`
    );
  }

  // -----------------------------------------------------------------------
  // 4. TARGET LANGUAGE PERSISTENCE, SOURCE LABEL DETECTION & REPORT LOGGING
  // -----------------------------------------------------------------------
  {
    setPreferredTranslationLanguage('ar');
    const persistedLang = getPreferredTranslationLanguage();

    assert(
      'TRANS-PREF-1',
      'Text Translation',
      'Target language preference persists in localStorage across navigation',
      persistedLang === 'ar' &&
        (globalThis as any).window.localStorage.getItem('metfa_preferred_translation_lang_v1') === 'ar',
      `persisted=${persistedLang}`
    );

    const bnLabel = detectReliableSourceLanguageLabel('আমার সোনার বাংলা');
    const arLabel = detectReliableSourceLanguageLabel('مرحبا بكم في القصة');
    const enLabel = detectReliableSourceLanguageLabel('This is a clear English sentence for translation.');
    const ambiguousLatin = detectReliableSourceLanguageLabel('Hola amigos y bonjour!');

    assert(
      'TRANS-SCRIPT-1',
      'Text Translation',
      'Reliable script detection labels Bengali/Arabic/English cleanly and avoids guessing mixed Latin',
      bnLabel === 'Bengali' && arLabel === 'Arabic' && enLabel === 'English' && ambiguousLatin === null,
      `bn=${bnLabel}, ar=${arLabel}, en=${enLabel}, mixedLatin=${String(ambiguousLatin)}`
    );

    const origText = 'একটি নতুন সকাল।';
    reportPoorTranslation({
      postId: 'post-rep-1',
      contentHash: computeTextContentHash(origText),
      targetLanguage: 'en',
      originalText: origText,
      translatedText: 'A new morning.',
    });
    const reports = getTranslationReports();

    assert(
      'TRANS-REPORT-1',
      'Text Translation',
      'Poor translation feedback is recorded locally cleanly without duplicates crashing',
      reports.length === 1 && reports[0].postId === 'post-rep-1' && reports[0].targetLanguage === 'en',
      `reportsCount=${reports.length}`
    );
  }

  // -----------------------------------------------------------------------
  // 5. EXPLICIT TEXT SERIES ISOLATION, ZERO AUTO-GROUPING & ONGOING BADGE
  // -----------------------------------------------------------------------
  {
    const seriesId = 'tseries_dawn_01';
    const p1 = makeTextPost({
      id: 'txt-p1',
      caption: 'Part 1: The silent harbor at dawn.',
      createdAtIso: '2026-11-16T01:00:00.000Z',
      series: {
        seriesId,
        seriesTitle: 'Chronicles of Dawn',
        creatorId: 'author-1',
        partNumber: 1,
        totalParts: 3,
        seriesType: 'text',
        isOngoing: true,
      },
    });
    const p2 = makeTextPost({
      id: 'txt-p2',
      caption: 'Part 2: Footsteps on wet cobblestones.',
      createdAtIso: '2026-11-16T02:00:00.000Z',
      series: {
        seriesId,
        seriesTitle: 'Chronicles of Dawn',
        creatorId: 'author-1',
        partNumber: 2,
        totalParts: 3,
        seriesType: 'text',
        isOngoing: true,
      },
    });
    // Unrelated text post from SAME author without explicit series link
    const unrelatedSameAuthor = makeTextPost({
      id: 'txt-unrelated',
      caption: 'Chronicles of Dawn Part 99 — random coffee thoughts!',
      createdAtIso: '2026-11-16T03:00:00.000Z',
    });
    // Video post carrying a video series (MUST NOT appear in text series!)
    const videoSeriesPost = makeTextPost({
      id: 'vid-p1',
      postType: 'media',
      mediaType: 'video',
      videoSrc: 'https://cdn.example.com/ep1.mp4',
      caption: 'Video episode 1',
      series: {
        seriesId,
        seriesTitle: 'Chronicles of Dawn',
        creatorId: 'author-1',
        partNumber: 3,
        totalParts: 3,
        seriesType: 'video',
        isOngoing: true,
      },
    });
    const videoReelItem: ReelHighlight = {
      id: 'reel-v-1',
      title: 'Vid Ep 1',
      caption: 'Vid',
      author: p1.author,
      videoSrc: 'https://cdn.example.com/ep1.mp4',
      duration: 15,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: 'Now',
      series: {
        seriesId,
        seriesTitle: 'Chronicles of Dawn',
        creatorId: 'author-1',
        partNumber: 1,
        seriesType: 'text', // Even if mis-labeled, video reel must NOT pass as text series; video checker rejects seriesType='text'
      },
    };

    const allMixed = [p2, unrelatedSameAuthor, videoSeriesPost, p1];

    const navCtx = resolveTextSeriesNavigationContext(p1, allMixed, () => true);

    assert(
      'SERIES-ISO-1',
      'Text Series Isolation',
      'Only explicitly linked text series posts are grouped; unrelated posts & video posts never mix',
      isExplicitTextSeriesPost(p1) &&
        !isExplicitTextSeriesPost(unrelatedSameAuthor) &&
        !isExplicitTextSeriesPost(videoSeriesPost) &&
        !isExplicitSeriesItem(videoReelItem) &&
        navCtx !== null &&
        navCtx.accessibleParts.length === 2 &&
        navCtx.accessibleParts.map((p) => p.id).join(',') === 'txt-p1,txt-p2',
      `parts=${navCtx?.accessibleParts.map((p) => p.id).join(',')}`
    );

    assert(
      'SERIES-ONGOING-1',
      'Text Series Badge',
      'isOngoing=true reflects ongoing badge; false/omitted disables More parts coming soon',
      navCtx?.isOngoing === true &&
        textSeriesBarCode.includes('More parts coming soon') &&
        textSeriesBarCode.includes('nav.isOngoing'),
      `navIsOngoing=${navCtx?.isOngoing}`
    );

    const finishedP1 = makeTextPost({
      id: 'fin-p1',
      series: {
        seriesId: 'tseries_fin',
        seriesTitle: 'Completed Mini Essay',
        creatorId: 'author-1',
        partNumber: 1,
        seriesType: 'text',
        isOngoing: false,
      },
    });
    const finCtx = resolveTextSeriesNavigationContext(finishedP1, [finishedP1], () => true);
    assert(
      'SERIES-ONGOING-2',
      'Text Series Badge',
      'Completed/non-ongoing text series reports isOngoing=false and omits unknown total count',
      finCtx !== null && finCtx.isOngoing === false && finCtx.totalDisplayParts === undefined,
      `isOngoing=${finCtx?.isOngoing}, totalDisplayParts=${String(finCtx?.totalDisplayParts)}`
    );
  }

  // -----------------------------------------------------------------------
  // 6. PRIVACY-SAFE SERIAL READER NAVIGATION & CONTINUE READING
  // -----------------------------------------------------------------------
  {
    const seriesId = 'tseries_secret_02';
    const p1 = makeTextPost({
      id: 'sec-p1',
      visibility: 'public',
      series: {
        seriesId,
        seriesTitle: 'Midnight Letters',
        creatorId: 'author-1',
        partNumber: 1,
        totalParts: 3,
        seriesType: 'text',
        isOngoing: false,
      },
    });
    const p2Followers = makeTextPost({
      id: 'sec-p2',
      visibility: 'followers',
      series: {
        seriesId,
        seriesTitle: 'Midnight Letters',
        creatorId: 'author-1',
        partNumber: 2,
        totalParts: 3,
        seriesType: 'text',
        isOngoing: false,
      },
    });
    const p3OnlyMe = makeTextPost({
      id: 'sec-p3',
      visibility: 'only_me',
      series: {
        seriesId,
        seriesTitle: 'Midnight Letters',
        creatorId: 'author-1',
        partNumber: 3,
        totalParts: 3,
        seriesType: 'text',
        isOngoing: false,
      },
    });

    const allParts = [p3OnlyMe, p1, p2Followers];

    const strangerPredicate = (post: CommunityPost) =>
      canViewerAccessPost({
        visibility: post.visibility,
        authorId: post.author?.id,
        authorProfilePrivacy: post.author?.profilePrivacy,
        viewerId: 'stranger-1',
        viewerFollowsAuthor: false,
      });

    const followerPredicate = (post: CommunityPost) =>
      canViewerAccessPost({
        visibility: post.visibility,
        authorId: post.author?.id,
        authorProfilePrivacy: post.author?.profilePrivacy,
        viewerId: 'follower-1',
        viewerFollowsAuthor: true,
      });

    const strangerCtx = resolveTextSeriesNavigationContext(p1, allParts, strangerPredicate);
    const followerCtx = resolveTextSeriesNavigationContext(p1, allParts, followerPredicate);

    recordTextReadingProgress({
      seriesId,
      postId: p2Followers.id,
      creatorId: 'author-1',
      partNumber: 2,
    });
    const savedProgress = getTextReadingProgressForSeries(seriesId);
    const ctxAtP1AfterProgress = resolveTextSeriesNavigationContext(p1, allParts, followerPredicate);
    const accessibleFollowerPosts = allParts.filter(followerPredicate);
    const continueMatch = getContinueReadingForCreator(accessibleFollowerPosts, 'author-1');

    assert(
      'SERIES-PRIV-1',
      'Serial Navigation & Privacy',
      'Unauthorized viewers never see followers-only or only_me parts in navigation/drawer',
      strangerCtx !== null &&
        strangerCtx.accessibleParts.length === 1 &&
        strangerCtx.nextPart === null &&
        followerCtx !== null &&
        followerCtx.accessibleParts.length === 2 &&
        followerCtx.nextPart?.id === 'sec-p2',
      `strangerParts=${strangerCtx?.accessibleParts.length}, followerParts=${followerCtx?.accessibleParts.length}`
    );

    assert(
      'SERIES-PROG-1',
      'Serial Navigation & Privacy',
      'Reading progress persists cleanly and surfaces Continue Reading target on Part 1 and Profile',
      savedProgress?.postId === 'sec-p2' &&
        savedProgress?.partNumber === 2 &&
        ctxAtP1AfterProgress?.continueReadingPart?.id === 'sec-p2' &&
        continueMatch?.post.id === 'sec-p2',
      `lastRead=${savedProgress?.postId}, continueOnPart1=${ctxAtP1AfterProgress?.continueReadingPart?.id}, profileContinue=${continueMatch?.post.id}`
    );
  }

  // -----------------------------------------------------------------------
  // 7. PROFILE TEXT SERIES GROUPING & SEARCH + UI INTEGRATION
  // -----------------------------------------------------------------------
  {
    const g1p1 = makeTextPost({
      id: 'grp-1',
      caption: 'Episode 1 of Desert Star',
      series: {
        seriesId: 's_desert',
        seriesTitle: 'Desert Star',
        creatorId: 'author-1',
        partNumber: 1,
        seriesType: 'text',
        isOngoing: true,
      },
    });
    const g2p1 = makeTextPost({
      id: 'grp-2',
      caption: 'Episode 1 of Ocean Song',
      series: {
        seriesId: 's_ocean',
        seriesTitle: 'Ocean Song',
        creatorId: 'author-1',
        partNumber: 1,
        seriesType: 'text',
        isOngoing: false,
      },
    });
    const standalone = makeTextPost({ id: 'grp-solo', caption: 'Regular text thought' });

    const allGrouped = groupCreatorTextSeries([g1p1, g2p1, standalone]);
    const searchFiltered = groupCreatorTextSeries([g1p1, g2p1, standalone], {
      searchQuery: 'Ocean',
    });

    const uiWired =
      createPostCode.includes('Text Series / Serial Story') &&
      communityFeedCode.includes('<TextSeriesNavigationBar') &&
      communityFeedCode.includes('<TextPostTranslationBar') &&
      postCardCode.includes('<TextSeriesNavigationBar') &&
      postCardCode.includes('<TextPostTranslationBar') &&
      profileViewCode.includes('Text Series') &&
      profileViewCode.includes('Continue Reading');

    assert(
      'SERIES-PROF-1',
      'Profile & UI Integration',
      'Profile Text Series grouping excludes standalone posts, filters by search, and UI components are wired',
      allGrouped.textSeriesGroups.length === 2 &&
        allGrouped.filteredSeriesPosts.length === 2 &&
        !allGrouped.filteredSeriesPosts.some((p) => p.id === 'grp-solo') &&
        searchFiltered.textSeriesGroups.length === 1 &&
        searchFiltered.textSeriesGroups[0].seriesTitle === 'Ocean Song' &&
        uiWired,
      `groups=${allGrouped.textSeriesGroups.length}, filteredPosts=${allGrouped.filteredSeriesPosts.length}, searchMatch=${searchFiltered.textSeriesGroups[0]?.seriesTitle}, uiWired=${uiWired}`
    );
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log('\n=============================================================');
  console.log('METFA SOCIAL — TRANSLATION & TEXT SERIES VERIFICATION REPORT');
  console.log('=============================================================');
  for (const r of results) {
    console.log(`[${r.status}] ${r.testId} (${r.category}): ${r.description}`);
    console.log(`       Evidence: ${r.evidence}`);
  }
  console.log('-------------------------------------------------------------');
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

runTextTranslationAndSeriesVerification().catch((err) => {
  console.error('Verification suite error:', err);
  process.exitCode = 1;
});
