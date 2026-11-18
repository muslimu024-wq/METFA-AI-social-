/**
 * METFA SOCIAL — TRANSLATION & UNIVERSAL MUSIC REUSE VERIFICATION SUITE
 * Verifies post translation error/UI/menu/persistence fixes, audio rights gating,
 * zero fabricated copyright/audio, synced dual-stream <audio> playback math & wiring,
 * video container validation (including MKV vs WebM & AVI rejection), and mixer continuity.
 */

import * as fs from 'fs';

// Node test shims for browser globals
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
if (typeof (globalThis as any).FileReader === 'undefined') {
  (globalThis as any).FileReader = class MockFileReader {
    result: string | ArrayBuffer | null = null;
    error: Error | null = null;
    onload: ((ev?: any) => void) | null = null;
    onerror: ((ev?: any) => void) | null = null;
    onabort: ((ev?: any) => void) | null = null;
    readAsArrayBuffer(blob: Blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          this.result = buf;
          this.onload?.({});
        })
        .catch((err) => {
          this.error = err;
          this.onerror?.({});
        });
    }
  };
}

import { translatePostText, TranslationServiceError } from '../services/translationService';
import { saveStoredApiKeys, clearStoredApiKeys } from '../utils/apiKeysStore';
import {
  SUPPORTED_TRANSLATION_LANGUAGES,
  getPreferredTranslationLanguage,
  setPreferredTranslationLanguage,
} from '../utils/translationCache';
import {
  verifyTrackSelectionAllowed,
  packAudioTrackWithConfig,
  unpackStoredAudioTrack,
  createOriginalSoundRecord,
} from '../utils/audioStore';
import {
  resolveDistinctExternalAudioUrl,
  computeEffectiveVolumes,
  computeDesiredAudioTime,
} from '../utils/syncedAudioPlayback';
import {
  detectVideoMimeFromBytes,
  validateAndPrepareVideoFile,
  MAX_SERVER_UPLOAD_BYTES,
} from '../services/storageService';
import { createPersistentReel } from '../services/reelService';
import { AudioTrack, ReelAudioConfig } from '../types/audio';

interface AssertionResult {
  testId: string;
  category: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

const results: AssertionResult[] = [];

function record(
  testId: string,
  category: string,
  description: string,
  passed: boolean,
  evidence: string
) {
  results.push({
    testId,
    category,
    description,
    status: passed ? 'PASS' : 'FAIL',
    evidence,
  });
}

function makeMp4Bytes(extraSize = 64): Uint8Array {
  const bytes = new Uint8Array(extraSize);
  bytes[3] = 24;
  bytes[4] = 0x66; // f
  bytes[5] = 0x74; // t
  bytes[6] = 0x79; // y
  bytes[7] = 0x70; // p
  bytes[8] = 0x69; // i
  bytes[9] = 0x73; // s
  bytes[10] = 0x6f; // o
  bytes[11] = 0x6d; // m
  return bytes;
}

function makeWebmBytes(extraSize = 64): Uint8Array {
  const bytes = new Uint8Array(extraSize);
  bytes[0] = 0x1a;
  bytes[1] = 0x45;
  bytes[2] = 0xdf;
  bytes[3] = 0xa3;
  const tag = 'webm';
  for (let i = 0; i < tag.length; i++) bytes[16 + i] = tag.charCodeAt(i);
  return bytes;
}

function makeMkvBytes(extraSize = 64): Uint8Array {
  const bytes = new Uint8Array(extraSize);
  bytes[0] = 0x1a;
  bytes[1] = 0x45;
  bytes[2] = 0xdf;
  bytes[3] = 0xa3;
  const tag = 'matroska';
  for (let i = 0; i < tag.length; i++) bytes[16 + i] = tag.charCodeAt(i);
  return bytes;
}

function makeAviBytes(extraSize = 64): Uint8Array {
  const bytes = new Uint8Array(extraSize);
  bytes[0] = 0x52; // R
  bytes[1] = 0x49; // I
  bytes[2] = 0x46; // F
  bytes[3] = 0x46; // F
  bytes[8] = 0x41; // A
  bytes[9] = 0x56; // V
  bytes[10] = 0x49; // I
  bytes[11] = 0x20;
  return bytes;
}

function makeJpegBytes(extraSize = 32): Uint8Array {
  const bytes = new Uint8Array(extraSize);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  return bytes;
}

async function runTests() {
  (globalThis as any).window.localStorage.clear();

  const validTrack: AudioTrack = {
    id: 'track_valid_01',
    title: 'Neon Odyssey',
    artist: 'Metfa Sound',
    audio_url: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_hum.ogg',
    cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
    duration: 30,
    genre: 'Synthwave',
    mood: 'Energetic',
    track_type: 'royalty_free',
    license_type: 'Royalty-Free Commercial',
    license_source: 'Metfa Audio Catalog',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
  };

  // =========================================================================
  // 1. TRANSLATION FIXES (TR-01 .. TR-05)
  // =========================================================================
  {
    const origFetch = globalThis.fetch;
    let err: any = null;
    (globalThis as any).fetch = async () =>
      new Response('<!doctype html><html><body>SPA Fallback</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    try {
      await translatePostText({
        postId: 'post-html-200',
        text: 'আজ আকাশ খুব সুন্দর।',
        targetLanguage: 'en',
      });
    } catch (e) {
      err = e;
    } finally {
      globalThis.fetch = origFetch;
    }

    const pass =
      err instanceof TranslationServiceError &&
      err.message.toLowerCase().includes('html instead of json') &&
      !err.message.includes('Translation request failed (200)');
    record(
      'TR-01',
      'Translation',
      'HTTP 200 HTML response throws explicit actionable error (never "Translation request failed (200)")',
      pass,
      `msg="${err?.message}"`
    );
  }

  {
    const origFetch = globalThis.fetch;
    let invalidJsonErr: any = null;
    let emptyFieldErr: any = null;

    (globalThis as any).fetch = async () =>
      new Response('not-valid-json{{{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      await translatePostText({
        postId: 'post-badjson-200',
        text: 'Hello friends!',
        targetLanguage: 'bn',
      });
    } catch (e) {
      invalidJsonErr = e;
    }

    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ success: true, detectedSourceLanguage: 'English', translatedText: '   ' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      await translatePostText({
        postId: 'post-emptytext-200',
        text: 'Hello friends!',
        targetLanguage: 'bn',
      });
    } catch (e) {
      emptyFieldErr = e;
    } finally {
      globalThis.fetch = origFetch;
    }

    const pass =
      invalidJsonErr instanceof TranslationServiceError &&
      invalidJsonErr.message.includes('invalid JSON response') &&
      emptyFieldErr instanceof TranslationServiceError &&
      emptyFieldErr.message.includes('did not return translated text') &&
      !invalidJsonErr.message.includes('Translation request failed (200)') &&
      !emptyFieldErr.message.includes('Translation request failed (200)');

    record(
      'TR-02',
      'Translation',
      'HTTP 200 malformed JSON or missing translatedText throws clean TranslationServiceError',
      pass,
      `badJson="${invalidJsonErr?.message}" | emptyField="${emptyFieldErr?.message}"`
    );
  }

  {
    const origFetch = globalThis.fetch;
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = {};
    saveStoredApiKeys({ geminiApiKey: 'AIzaTestSessionKey123' });

    (globalThis as any).fetch = async (_url: string, init: any) => {
      capturedHeaders = init?.headers || {};
      capturedBody = JSON.parse(init?.body || '{}');
      return new Response(
        JSON.stringify({
          success: true,
          detectedSourceLanguage: 'Bengali',
          translatedText: 'Good morning everyone!',
          modelUsed: 'gemini-4-hydrogen',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const originalText = 'সবাইকে শুভ সকাল!';
      const res = await translatePostText({
        postId: 'post-ok-1',
        text: originalText,
        targetLanguage: 'en',
      });
      const pass =
        capturedHeaders['x-gemini-api-key'] === 'AIzaTestSessionKey123' &&
        capturedBody.geminiApiKey === 'AIzaTestSessionKey123' &&
        res.result.translatedText === 'Good morning everyone!' &&
        originalText === 'সবাইকে শুভ সকাল!';

      record(
        'TR-03',
        'Translation',
        'translatePostText forwards session geminiApiKey and returns clean translation without altering original text',
        pass,
        `headerKeySent=${Boolean(capturedHeaders['x-gemini-api-key'])}, translated="${res.result.translatedText}"`
      );
    } finally {
      clearStoredApiKeys();
      globalThis.fetch = origFetch;
    }
  }

  {
    const barSrc = fs.readFileSync('components/TextPostTranslationBar.tsx', 'utf8');
    const postCardSrc = fs.readFileSync('components/PostCard.tsx', 'utf8');
    const feedSrc = fs.readFileSync('components/CommunityFeed.tsx', 'utf8');

    const barHidesWhenIdleOrEmpty =
      barSrc.includes('if (!sourceText || !sourceText.trim()) return null;') &&
      barSrc.includes('if (!isLoading && !isShowingTranslation && !errorMsg) {') &&
      barSrc.includes('Show Original') &&
      barSrc.includes('See Translation') &&
      barSrc.includes('Retry');

    const threeDotMenusHaveTranslation =
      postCardSrc.includes('`menu-translate-toggle-btn-${post.id}`') &&
      postCardSrc.includes('`menu-translate-lang-select-${post.id}`') &&
      postCardSrc.includes(".trim().length > 0 &&") &&
      feedSrc.includes('`menu-translate-toggle-btn-${post.id}`') &&
      feedSrc.includes('`menu-translate-lang-select-${post.id}`') &&
      feedSrc.includes('translationCommandsMap');

    record(
      'TR-04',
      'Translation UI',
      'Language selector & Translate/See Translation/Show Original live inside Three-dot menus and bar hides when idle or empty',
      barHidesWhenIdleOrEmpty && threeDotMenusHaveTranslation,
      `barIdleHide=${barHidesWhenIdleOrEmpty}, threeDotMenus=${threeDotMenusHaveTranslation}`
    );
  }

  {
    setPreferredTranslationLanguage('bn');
    const langBn = getPreferredTranslationLanguage();
    setPreferredTranslationLanguage('en');
    const langEn = getPreferredTranslationLanguage();
    const codes = SUPPORTED_TRANSLATION_LANGUAGES.map((l) => l.code);
    const hasRequiredLanguages = ['bn', 'en', 'ar', 'hi', 'es', 'fr', 'ur'].every((c) => codes.includes(c as any));

    record(
      'TR-05',
      'Translation',
      'Supported language catalog includes bn/en/ar/hi/es/fr/ur and persists last chosen target language',
      hasRequiredLanguages && langBn === 'bn' && langEn === 'en',
      `langs=${codes.join(',')}, persistedBn=${langBn}, persistedEn=${langEn}`
    );
  }

  // =========================================================================
  // 2. AUDIO RIGHTS & NO FABRICATED ATTRIBUTION (MU-01 .. MU-04)
  // =========================================================================
  {
    const checks = [
      verifyTrackSelectionAllowed({ ...validTrack, status: 'pending' }),
      verifyTrackSelectionAllowed({ ...validTrack, status: 'expired' }),
      verifyTrackSelectionAllowed({ ...validTrack, status: 'revoked' }),
      verifyTrackSelectionAllowed({ ...validTrack, status: 'restricted' }),
      verifyTrackSelectionAllowed({ ...validTrack, active_status: false }),
      verifyTrackSelectionAllowed({ ...validTrack, license_start: '2099-01-01T00:00:00.000Z' }),
      verifyTrackSelectionAllowed({ ...validTrack, audio_url: '' }),
      verifyTrackSelectionAllowed({ ...validTrack, artist: '', license_source: '' }),
    ];
    const allowedOk = verifyTrackSelectionAllowed(validTrack);

    const allBlocked = checks.every((c) => !c.canSelect && Boolean(c.reason));
    record(
      'MU-01',
      'Rights Gating',
      'verifyTrackSelectionAllowed blocks pending, expired, revoked, restricted, inactive, future-dated, missing URL, and missing attribution tracks',
      allBlocked && allowedOk.canSelect,
      `blockedCount=${checks.filter((c) => !c.canSelect).length}/8, validAllowed=${allowedOk.canSelect}`
    );
  }

  {
    const emptyOrig = createOriginalSoundRecord({
      userId: 'u1',
      username: 'creator',
      userAvatar: 'https://example.com/a.jpg',
      reelId: 'reel_empty_1',
    });
    const realOrig = createOriginalSoundRecord({
      userId: 'u1',
      username: 'creator',
      userAvatar: 'https://example.com/a.jpg',
      reelId: 'reel_real_1',
      videoSrc: '/uploads/creator_real_clip.mp4',
      duration: 20,
    });

    const pass =
      emptyOrig === null &&
      realOrig !== null &&
      realOrig.commercial_use_allowed === false &&
      realOrig.commercial_usage_allowed === false &&
      realOrig.audio_url === '/uploads/creator_real_clip.mp4' &&
      !realOrig.license_type.toLowerCase().includes('royalty-free');

    record(
      'MU-02',
      'No Fabricated Data',
      'createOriginalSoundRecord returns null without real media and sets commercial_use_allowed=false (no Royalty-Free fabrication)',
      pass,
      `emptyIsNull=${emptyOrig === null}, commercial=${realOrig?.commercial_use_allowed}, license="${realOrig?.license_type}"`
    );
  }

  {
    const reelsFeedSrc = fs.readFileSync('components/ReelsFeedView.tsx', 'utf8');
    const reelCardSrc = fs.readFileSync('components/ReelCard.tsx', 'utf8');
    const audioStoreSrc = fs.readFileSync('utils/audioStore.ts', 'utf8');
    const origFnSlice = audioStoreSrc.slice(audioStoreSrc.indexOf('export const createOriginalSoundRecord'));

    const noFakeTrackSynthesis =
      !reelsFeedSrc.includes('scifi_engine_hum.ogg') &&
      !reelsFeedSrc.includes('Royalty-Free Commercial') &&
      !reelCardSrc.includes('scifi_engine_hum.ogg') &&
      !reelCardSrc.includes('Royalty-Free Commercial') &&
      !origFnSlice.includes('scifi_engine_hum.ogg') &&
      !origFnSlice.includes('Copyright-Free') &&
      !origFnSlice.includes('Royalty-Free Commercial');

    record(
      'MU-03',
      'No Fabricated Data',
      'ReelsFeedView, ReelCard, and createOriginalSoundRecord contain zero synthetic scifi_engine_hum.ogg or fabricated Royalty-Free licenses',
      noFakeTrackSynthesis,
      noFakeTrackSynthesis ? 'Zero synthetic fallback tracks found' : 'Synthetic audio fallback still present'
    );
  }

  {
    const blockedRes = await createPersistentReel({
      title: 'Blocked Track Test',
      caption: 'Should fail validation',
      videoSource: '/uploads/clip.mp4',
      duration: 15,
      audioTrack: { ...validTrack, status: 'revoked' },
      author: { id: 'u1', name: 'Test', username: 'test', avatar: '' },
    });

    const licenseSrc = fs.readFileSync('components/AudioLicenseInfoModal.tsx', 'utf8');
    const pickerSrc = fs.readFileSync('components/AudioTrackPickerModal.tsx', 'utf8');
    const createReelSrc = fs.readFileSync('components/CreateReelModal.tsx', 'utf8');
    const createPostSrc = fs.readFileSync('components/CreatePostModal.tsx', 'utf8');
    const socialSrc = fs.readFileSync('features/social/index.tsx', 'utf8');

    const uiEnforcesGate =
      licenseSrc.includes('verifyTrackSelectionAllowed(track)') &&
      pickerSrc.includes('verifyTrackSelectionAllowed(track)') &&
      createReelSrc.includes('verifyTrackSelectionAllowed(') &&
      createPostSrc.includes('verifyTrackSelectionAllowed(') &&
      socialSrc.includes('verifyTrackSelectionAllowed(track)');

    record(
      'MU-04',
      'Rights Gating',
      'createPersistentReel rejects revoked/ineligible tracks and all music selection modals/flows enforce verifyTrackSelectionAllowed',
      !blockedRes.success && Boolean(blockedRes.error) && uiEnforcesGate,
      `blockedMsg="${blockedRes.error}", uiEnforcesGate=${uiEnforcesGate}`
    );
  }

  // =========================================================================
  // 3. SYNCED AUDIO MATH, MIXER CONTINUITY & UI WIRING (MU-05 .. MU-09)
  // =========================================================================
  {
    const sameUrl = resolveDistinctExternalAudioUrl(
      'https://cdn.example.com/clip.mp4',
      'https://cdn.example.com/clip.mp4'
    );
    const blankUrl = resolveDistinctExternalAudioUrl('   ', 'https://cdn.example.com/clip.mp4');
    const distinctUrl = resolveDistinctExternalAudioUrl(
      'https://cdn.example.com/song.ogg',
      'https://cdn.example.com/clip.mp4'
    );

    record(
      'MU-05',
      'Synced Audio',
      'resolveDistinctExternalAudioUrl prevents double playback when audio_url equals videoSrc',
      sameUrl === null && blankUrl === null && distinctUrl === 'https://cdn.example.com/song.ogg',
      `same=${String(sameUrl)}, blank=${String(blankUrl)}, distinct=${distinctUrl}`
    );
  }

  {
    const muted = computeEffectiveVolumes({
      isMuted: true,
      musicVolumePercent: 80,
      originalVideoVolumePercent: 60,
      currentTime: 2,
      duration: 10,
    });
    const mixed = computeEffectiveVolumes({
      isMuted: false,
      musicVolumePercent: 75,
      originalVideoVolumePercent: 40,
      currentTime: 5,
      duration: 10,
    });
    const fadeInStart = computeEffectiveVolumes({
      isMuted: false,
      musicVolumePercent: 100,
      originalVideoVolumePercent: 0,
      currentTime: 0.3,
      duration: 10,
      fadeIn: true,
    });
    const fadeOutEnd = computeEffectiveVolumes({
      isMuted: false,
      musicVolumePercent: 100,
      originalVideoVolumePercent: 100,
      currentTime: 9.7,
      duration: 10,
      fadeOut: true,
    });

    const pass =
      muted.videoMuted &&
      !muted.shouldPlayAudio &&
      muted.audioVolume === 0 &&
      Math.abs(mixed.audioVolume - 0.75) < 0.001 &&
      Math.abs(mixed.videoVolume - 0.4) < 0.001 &&
      fadeInStart.audioVolume < 0.25 &&
      fadeOutEnd.audioVolume < 0.25 &&
      mixed.shouldPlayAudio;

    record(
      'MU-06',
      'Synced Audio',
      'computeEffectiveVolumes enforces mute, original/music volume percentages, fadeIn & fadeOut envelopes',
      pass,
      `mixed=(vid:${mixed.videoVolume},aud:${mixed.audioVolume}), fadeIn=${fadeInStart.audioVolume.toFixed(2)}, fadeOut=${fadeOutEnd.audioVolume.toFixed(2)}`
    );
  }

  {
    const tNormal = computeDesiredAudioTime({ videoCurrentTime: 4.5, startTimeOffset: 10, audioDuration: 30 });
    const tWrapped = computeDesiredAudioTime({ videoCurrentTime: 12, startTimeOffset: 25, audioDuration: 30 });
    const tNoDur = computeDesiredAudioTime({ videoCurrentTime: 6, startTimeOffset: 3 });

    record(
      'MU-07',
      'Synced Audio',
      'computeDesiredAudioTime applies startTimeOffset and modulo wraps within soundtrack duration',
      Math.abs(tNormal - 14.5) < 0.001 && Math.abs(tWrapped - 7) < 0.001 && Math.abs(tNoDur - 9) < 0.001,
      `normal=${tNormal}, wrapped=${tWrapped}, noDur=${tNoDur}`
    );
  }

  {
    const cfg: ReelAudioConfig = {
      track: validTrack,
      volume: 82,
      originalVideoVolume: 25,
      startTime: 6,
      fadeIn: true,
      fadeOut: false,
    };
    const packed = packAudioTrackWithConfig(validTrack, cfg);
    const unpacked = unpackStoredAudioTrack(packed);

    const pass =
      packed !== null &&
      unpacked.audioTrack?.id === validTrack.id &&
      (unpacked.audioTrack as any)._mixerConfig === undefined &&
      unpacked.audioConfig?.volume === 82 &&
      unpacked.audioConfig?.originalVideoVolume === 25 &&
      unpacked.audioConfig?.startTime === 6 &&
      unpacked.audioConfig?.fadeIn === true &&
      unpacked.audioConfig?.fadeOut === false;

    record(
      'MU-08',
      'Mixer Continuity',
      'packAudioTrackWithConfig & unpackStoredAudioTrack preserve mixer config cleanly across persistence',
      pass,
      `vol=${unpacked.audioConfig?.volume}, origVol=${unpacked.audioConfig?.originalVideoVolume}, start=${unpacked.audioConfig?.startTime}`
    );
  }

  {
    const createReelSrc = fs.readFileSync('components/CreateReelModal.tsx', 'utf8');
    const reelsFeedSrc = fs.readFileSync('components/ReelsFeedView.tsx', 'utf8');
    const reelCardSrc = fs.readFileSync('components/ReelCard.tsx', 'utf8');
    const communityPostCardSrc = fs.readFileSync('components/CommunityPostCard.tsx', 'utf8');
    const postCardSrc = fs.readFileSync('components/PostCard.tsx', 'utf8');
    const socialSrc = fs.readFileSync('features/social/index.tsx', 'utf8');

    const wired =
      createReelSrc.includes('attachSyncedAudioController') &&
      createReelSrc.includes('data-testid="create-reel-replace-sound-btn"') &&
      createReelSrc.includes('data-testid="create-reel-remove-sound-btn"') &&
      reelsFeedSrc.includes('attachSyncedAudioController') &&
      reelsFeedSrc.includes('<audio') &&
      reelCardSrc.includes('attachSyncedAudioController') &&
      reelCardSrc.includes('<audio') &&
      communityPostCardSrc.includes('attachSyncedAudioController') &&
      communityPostCardSrc.includes('<audio') &&
      postCardSrc.includes('attachSyncedAudioController') &&
      postCardSrc.includes('<audio') &&
      socialSrc.includes('audioConfig');

    record(
      'MU-09',
      'Synced Audio UI',
      'CreateReelModal, ReelsFeedView, ReelCard, CommunityPostCard, PostCard, and social state wire synced <audio> playback & sound Replace/Remove',
      wired,
      wired ? 'All playback surfaces and mixer controls wired' : 'Missing synced <audio> wiring on one or more surfaces'
    );
  }

  // =========================================================================
  // 4. VIDEO CONTAINER & SERVER TRANSLATION HARDENING (VID-01, SRV-01)
  // =========================================================================
  {
    const webmDetect = detectVideoMimeFromBytes(makeWebmBytes(64));
    const mkvDetect = detectVideoMimeFromBytes(makeMkvBytes(64));
    const aviDetect = detectVideoMimeFromBytes(makeAviBytes(64));
    const mp4Detect = detectVideoMimeFromBytes(makeMp4Bytes(64));
    const jpegDetect = detectVideoMimeFromBytes(makeJpegBytes(32));

    let mkvErr = '';
    let aviErr = '';
    let bigErr = '';

    try {
      await validateAndPrepareVideoFile(new File([makeMkvBytes(64) as unknown as BlobPart], 'video.mkv', { type: 'video/x-matroska' }));
    } catch (e: any) {
      mkvErr = e?.message || '';
    }
    try {
      await validateAndPrepareVideoFile(new File([makeAviBytes(64) as unknown as BlobPart], 'clip.avi', { type: 'video/x-msvideo' }));
    } catch (e: any) {
      aviErr = e?.message || '';
    }
    try {
      const bigBlob = {
        size: MAX_SERVER_UPLOAD_BYTES + 2048,
        type: 'video/mp4',
        slice: () => new Blob([makeMp4Bytes(32) as unknown as BlobPart]),
      } as unknown as Blob;
      await validateAndPrepareVideoFile(bigBlob, { checkServerFallbackLimit: true });
    } catch (e: any) {
      bigErr = e?.message || '';
    }

    const pass =
      webmDetect?.mimeType === 'video/webm' &&
      !webmDetect?.isUnsupportedContainer &&
      mkvDetect?.isUnsupportedContainer === true &&
      aviDetect?.isUnsupportedContainer === true &&
      mp4Detect?.mimeType === 'video/mp4' &&
      jpegDetect?.isNonVideoSignature === true &&
      mkvErr.toLowerCase().includes('unsupported') &&
      aviErr.toLowerCase().includes('unsupported') &&
      bigErr.includes('35 MB');

    record(
      'VID-01',
      'Video Validation',
      'Distinguishes WebM vs Matroska (.mkv), rejects .mkv/.avi/JPEG/oversized files while passing MP4 & WebM',
      pass,
      `webm=${webmDetect?.mimeType}, mkvBlocked=${Boolean(mkvErr)}, aviBlocked=${Boolean(aviErr)}, capBlocked=${bigErr.includes('35 MB')}`
    );
  }

  {
    const serverSrc = fs.readFileSync('server.ts', 'utf8');
    const hasExtractor =
      serverSrc.includes('normalized?.translatedText') &&
      serverSrc.includes('normalized?.translated_text') &&
      serverSrc.includes('normalized?.translation') &&
      serverSrc.includes('jsonBlockMatch');
    const hasJsonHeader = serverSrc.includes('res.setHeader("Content-Type", "application/json")');
    const pass =
      hasExtractor &&
      hasJsonHeader &&
      serverSrc.includes('"gemini-4-hydrogen"') &&
      serverSrc.includes('User-Agent');

    record(
      'SRV-01',
      'Server Route',
      '/api/ai/translate enforces JSON Content-Type, resilient JSON payload extraction, and gemini-4-hydrogen User-Agent',
      pass,
      `hasExtractor=${hasExtractor}, hasJsonHeader=${hasJsonHeader}`
    );
  }

  let failed = 0;
  console.log('\n=== METFA SOCIAL — TRANSLATION & UNIVERSAL MUSIC REUSE VERIFICATION ===\n');
  for (const r of results) {
    if (r.status === 'FAIL') failed++;
    console.log(`[${r.status}] ${r.testId} (${r.category}): ${r.description}`);
    console.log(`       Evidence: ${r.evidence}`);
  }
  console.log(`\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Verification runner crashed:', err);
  process.exit(1);
});
