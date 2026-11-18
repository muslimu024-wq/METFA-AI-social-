/**
 * Regression & Forensic Verification Suite:
 * - Issue A: Text Post Translation API Routing, HTTP 200 HTML Prevention & Original Text Preservation
 * - Issue B: Verified vs Original vs Native Video Audio Classification & Server Privacy Signing
 *
 * Run via: npx tsx tests/translationAndAudioMetadataVerification.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_AUDIO_TRACKS,
  classifyReelAudioState,
  createOriginalSoundRecord,
  isVerifiedAudioTrack,
  packAudioTrackWithConfig,
  resolveReelAudioTrackMetadata,
  unpackStoredAudioTrack,
} from '../utils/audioStore';
import {
  extractLocalUploadFilenamesFromPost,
  sanitizePostMediaUrlsForStorage,
  signPostMediaUrls,
} from '../services/serverPrivacyGuard';
import {
  TranslationServiceError,
  translatePostText,
} from '../services/translationService';

let passed = 0;
let failed = 0;

function record(id: string, title: string, ok: boolean, detail: string) {
  if (ok) {
    passed++;
    console.log(`[PASS] ${id}: ${title}\n       ${detail}`);
  } else {
    failed++;
    console.error(`[FAIL] ${id}: ${title}\n       ${detail}`);
  }
}

async function run() {
  console.log('=== METFA SOCIAL — TRANSLATION & VERIFIED AUDIO METADATA VERIFICATION ===');

  // 1. Live Server API Boundary Verification (HTTP 200 HTML Trap Prevention)
  const baseUrl = 'http://localhost:3000';
  let serverReachable = true;
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    record(
      'TR-LIVE-01',
      'Live /api/health returns structured JSON',
      healthJson.status === 'ok',
      `status=${healthJson.status}, hasGeminiKey=${healthJson.hasGeminiKey}`
    );
  } catch (err: any) {
    serverReachable = false;
    record('TR-LIVE-01', 'Live /api/health check', false, err?.message || 'Unreachable');
  }

  if (serverReachable) {
    // Verify GET /api/ai/translate returns 405 JSON instead of HTTP 200 HTML SPA fallback
    const getRes = await fetch(`${baseUrl}/api/ai/translate`);
    const getCt = (getRes.headers.get('content-type') || '').toLowerCase();
    const getBody = await getRes.text();
    const isHtml = getBody.trim().toLowerCase().startsWith('<!doctype') || getCt.includes('text/html');
    let parsedGet: any = null;
    try {
      parsedGet = JSON.parse(getBody);
    } catch {}
    record(
      'TR-LIVE-02',
      'GET /api/ai/translate returns 405 JSON (never HTTP 200 HTML)',
      getRes.status === 405 && !isHtml && parsedGet?.code === 'METHOD_NOT_ALLOWED',
      `status=${getRes.status}, contentType=${getCt}, code=${parsedGet?.code}`
    );

    // Verify unknown /api/* path returns 404 JSON instead of SPA HTML
    const unknownRes = await fetch(`${baseUrl}/api/ai/does-not-exist`);
    const unknownCt = (unknownRes.headers.get('content-type') || '').toLowerCase();
    const unknownBody = await unknownRes.json().catch(() => null);
    record(
      'TR-LIVE-03',
      'Unmatched /api/* path returns 404 JSON (never HTTP 200 HTML)',
      unknownRes.status === 404 && unknownCt.includes('application/json') && unknownBody?.code === 'API_NOT_FOUND',
      `status=${unknownRes.status}, contentType=${unknownCt}, code=${unknownBody?.code}`
    );

    // Verify malformed JSON to /api/ai/translate returns 400 JSON instead of Express HTML error
    const badJsonRes = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"text": ',
    });
    const badJsonCt = (badJsonRes.headers.get('content-type') || '').toLowerCase();
    const badJsonBody = await badJsonRes.json().catch(() => null);
    record(
      'TR-LIVE-04',
      'Malformed JSON body on /api/ai/translate returns 400 JSON error',
      badJsonRes.status === 400 && badJsonCt.includes('application/json') && badJsonBody?.code === 'INVALID_JSON',
      `status=${badJsonRes.status}, contentType=${badJsonCt}, code=${badJsonBody?.code}`
    );

    // Verify OPTIONS preflight allows x-gemini-api-key header
    const optRes = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-gemini-api-key',
      },
    });
    const allowedHeaders = (optRes.headers.get('access-control-allow-headers') || '').toLowerCase();
    record(
      'TR-LIVE-05',
      'CORS preflight permits x-gemini-api-key header',
      optRes.status === 204 && allowedHeaders.includes('x-gemini-api-key'),
      `status=${optRes.status}, allowHeaders=${allowedHeaders}`
    );

    // Verify POST /api/ai/translate with empty text returns 400 JSON
    const emptyPostRes = await fetch(`${baseUrl}/api/ai/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '   ', targetLanguage: 'en' }),
    });
    const emptyPostBody = await emptyPostRes.json().catch(() => null);
    record(
      'TR-LIVE-06',
      'POST /api/ai/translate validates empty input with 400 JSON',
      emptyPostRes.status === 400 && emptyPostBody?.code === 'INVALID_INPUT',
      `status=${emptyPostRes.status}, code=${emptyPostBody?.code}`
    );
  }

  // 2. Static & Client Guard Checks for Issue A
  const serverSrc = fs.readFileSync('server.ts', 'utf8');
  const translateBlockStart = serverSrc.indexOf('app.post("/api/ai/translate"');
  const translateBlockEnd = serverSrc.indexOf('app.all("/api/ai/translate"', translateBlockStart);
  const translateRouteSrc = serverSrc.slice(translateBlockStart, translateBlockEnd);
  record(
    'TR-CODE-01',
    '/api/ai/translate avoids deprecated temperature parameter on gemini-4-hydrogen and strips sampling args',
    !translateRouteSrc.includes('temperature:') &&
      serverSrc.includes('model.startsWith("gemini-4-")') &&
      serverSrc.includes('redirectStatus=isApiPath?308:301'),
    'gemini-4-* sampling strip + 308 API redirect + temperature removed'
  );

  // Mocked HTML fallback test in translatePostText
  const origFetch = globalThis.fetch;
  try {
    (globalThis as any).fetch = async () =>
      new Response('<!DOCTYPE html><html><body>SPA Fallback</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });

    let caught: any = null;
    try {
      await translatePostText({
        postId: 'test-html-200',
        text: 'Original Bengali Post বাংলা টেক্সট',
        targetLanguage: 'en',
        forceRefresh: true,
      });
    } catch (e) {
      caught = e;
    }
    record(
      'TR-CLIENT-01',
      'Client translatePostText rejects HTTP 200 HTML without overwriting original text',
      caught instanceof TranslationServiceError &&
        caught.message.includes('returned HTML instead of JSON (HTTP 200)') &&
        caught.message.includes('Original text has been preserved'),
      caught?.message || 'no error thrown'
    );
  } finally {
    globalThis.fetch = origFetch;
  }

  // 3. Issue B: Honest Audio Track Verification & Classification Tests
  const verifiedCatalogTrack = DEFAULT_AUDIO_TRACKS.find((t) => t.id === 'track_synth_01')!;
  const expiredCatalogTrack = DEFAULT_AUDIO_TRACKS.find((t) => t.id === 'track_licensed_expired_demo')!;
  const originalSound = createOriginalSoundRecord({
    userId: 'creator_1',
    username: 'creator_one',
    userAvatar: 'https://example.com/avatar.jpg',
    reelId: 'reel_orig_1',
    videoSrc: '/uploads/creator_1_sample.mp4',
  })!;

  record(
    'AU-01',
    'isVerifiedAudioTrack strictly separates verified catalog tracks from unverified original & expired tracks',
    isVerifiedAudioTrack(verifiedCatalogTrack) === true &&
      isVerifiedAudioTrack(originalSound) === false &&
      isVerifiedAudioTrack(expiredCatalogTrack) === false &&
      isVerifiedAudioTrack(null) === false,
    `verifiedCatalog=${isVerifiedAudioTrack(verifiedCatalogTrack)}, original=${isVerifiedAudioTrack(originalSound)}, expired=${isVerifiedAudioTrack(expiredCatalogTrack)}`
  );

  // Ordinary Feed video / legacy Reel with NULL/undefined audio_track
  const nativeVideoReel = {
    videoSrc: 'https://cdn.example.com/ordinary_video.mp4',
    audioTrack: undefined,
    audioConfig: undefined,
    musicTrack: undefined,
  };
  const nativeClass = classifyReelAudioState(nativeVideoReel);
  record(
    'AU-02',
    'Ordinary video without attached soundtrack classifies honestly as native_video_audio (no fabricated IDs/verified status)',
    nativeClass.status === 'native_video_audio' &&
      nativeClass.track === null &&
      nativeClass.isVerified === false &&
      nativeClass.label === 'Original video audio',
    `status=${nativeClass.status}, track=${nativeClass.track}, isVerified=${nativeClass.isVerified}`
  );

  // Reel with audioConfig.track only (e.g. restored from partial state) resolves cleanly
  const configOnlyReel = {
    videoSrc: 'https://cdn.example.com/video.mp4',
    audioTrack: undefined,
    audioConfig: {
      track: verifiedCatalogTrack,
      volume: 80,
      originalVideoVolume: 50,
      startTime: 4,
    },
    musicTrack: `${verifiedCatalogTrack.title} • ${verifiedCatalogTrack.artist}`,
  };
  const resolvedFromConfig = resolveReelAudioTrackMetadata(configOnlyReel);
  const verifiedClass = classifyReelAudioState(configOnlyReel);
  record(
    'AU-03',
    'resolveReelAudioTrackMetadata resolves embedded audioConfig.track & classifies verified track accurately',
    resolvedFromConfig?.id === verifiedCatalogTrack.id &&
      verifiedClass.status === 'verified_track' &&
      verifiedClass.isVerified === true,
    `resolvedId=${resolvedFromConfig?.id}, status=${verifiedClass.status}`
  );

  // Original creator audio classifies as original_track (not verified)
  const originalClass = classifyReelAudioState({
    videoSrc: originalSound.audio_url,
    audioTrack: originalSound,
    musicTrack: `${originalSound.title} • ${originalSound.artist}`,
  });
  record(
    'AU-04',
    'Creator original audio classifies as original_track with isVerified=false',
    originalClass.status === 'original_track' &&
      originalClass.isVerified === false &&
      originalClass.track?.id === originalSound.id,
    `status=${originalClass.status}, isVerified=${originalClass.isVerified}`
  );

  // Missing metadata referenced by musicTrack label handles gracefully without fabricating IDs
  const brokenRefClass = classifyReelAudioState({
    videoSrc: 'https://cdn.example.com/video.mp4',
    audioTrack: undefined,
    musicTrack: 'Unknown Deleted Track • Unknown Artist',
  });
  record(
    'AU-05',
    'Missing referenced soundtrack classifies cleanly as unavailable_metadata without fabricating track IDs or verified status',
    brokenRefClass.status === 'unavailable_metadata' &&
      brokenRefClass.track === null &&
      brokenRefClass.isVerified === false,
    `status=${brokenRefClass.status}, track=${brokenRefClass.track}`
  );

  // Pack / Unpack Supabase JSONB round-trip preserves original vs verified classification
  const packedOriginal = packAudioTrackWithConfig(originalSound, {
    track: originalSound,
    volume: 100,
    originalVideoVolume: 100,
    startTime: 0,
  });
  const unpackedOriginal = unpackStoredAudioTrack(packedOriginal);
  record(
    'AU-06',
    'Supabase JSONB pack/unpack round-trip preserves track_type and non-verified status',
    unpackedOriginal.audioTrack?.id === originalSound.id &&
      unpackedOriginal.audioTrack?.track_type === 'original' &&
      isVerifiedAudioTrack(unpackedOriginal.audioTrack) === false,
    `unpackedId=${unpackedOriginal.audioTrack?.id}, type=${unpackedOriginal.audioTrack?.track_type}`
  );

  // Server privacy guard handles /uploads/ audioTrack.audio_url & cover_url signing/sanitization
  const postWithLocalAudio = {
    id: 'post_audio_1',
    visibility: 'public',
    author_id: 'creator_1',
    videoSrc: '/uploads/creator_1_vid.mp4?mt=stale&exp=1&uid=creator_1',
    audioTrack: {
      ...originalSound,
      audio_url: '/uploads/creator_1_vid.mp4?mt=stale&exp=1&uid=creator_1',
      cover_url: '/uploads/creator_1_cov.jpg?mt=stale&exp=1&uid=creator_1',
    },
  };
  const sanitized = sanitizePostMediaUrlsForStorage(postWithLocalAudio);
  const signed = signPostMediaUrls(sanitized, 'viewer_2');
  const extracted = extractLocalUploadFilenamesFromPost(sanitized);
  record(
    'AU-07',
    'serverPrivacyGuard sanitizes and re-signs /uploads/ audioTrack URLs and extracts ACL filenames',
    sanitized.audioTrack.audio_url === '/uploads/creator_1_vid.mp4' &&
      signed.audioTrack.audio_url.includes('mt=') &&
      signed.audioTrack.audio_url.includes('uid=viewer_2') &&
      extracted.includes('creator_1_vid.mp4') &&
      extracted.includes('creator_1_cov.jpg'),
    `sanitized=${sanitized.audioTrack.audio_url}, signedHasToken=${signed.audioTrack.audio_url.includes('mt=')}, files=${extracted.join(',')}`
  );

  // Modal & UI audit: AudioLicenseInfoModal does not unconditionally show verified text for original audio
  const modalSrc = fs.readFileSync('components/AudioLicenseInfoModal.tsx', 'utf8');
  const reelsViewSrc = fs.readFileSync('components/ReelsFeedView.tsx', 'utf8');
  const reelCardSrc = fs.readFileSync('components/ReelCard.tsx', 'utf8');
  record(
    'AU-08',
    'Audio UI gates verified copy/icons strictly behind isVerifiedAudioTrack and removes false error on native-audio Reels',
    modalSrc.includes('isVerifiedAudioTrack(track)') &&
      modalSrc.includes('Creator Original Audio Details') &&
      !reelsViewSrc.includes('Verified audio track metadata is unavailable for this reel.') &&
      !reelCardSrc.includes('Verified audio track metadata is unavailable for this reel.') &&
      reelsViewSrc.includes('reel-native-audio-modal'),
    'Verified gating & native audio modal verified across AudioLicenseInfoModal, ReelsFeedView, ReelCard'
  );

  console.log(`\nTotal: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
