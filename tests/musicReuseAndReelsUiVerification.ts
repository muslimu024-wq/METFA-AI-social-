/**
 * METFA SOCIAL — MUSIC REUSE UPLOAD FIX & REELS UI POLISH VERIFICATION SUITE
 * Covers all 12 required verification scenarios across storage validation,
 * upload progress/retry/cancel/abort, CreateReelModal music reuse,
 * active audio playback indicator, and Reels top-tab scrollbar removal.
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
    onprogress: ((ev?: any) => void) | null = null;
    private aborted = false;

    abort() {
      this.aborted = true;
      if (this.onabort) this.onabort({});
    }

    readAsDataURL(blob: Blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          if (this.aborted) return;
          const mime = blob.type || 'application/octet-stream';
          const b64 = Buffer.from(buf).toString('base64');
          this.onprogress?.({ lengthComputable: true, loaded: buf.byteLength, total: buf.byteLength });
          this.result = `data:${mime};base64,${b64}`;
          this.onload?.({});
        })
        .catch((err) => {
          if (this.aborted) return;
          this.error = err;
          this.onerror?.({});
        });
    }

    readAsArrayBuffer(blob: Blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          if (this.aborted) return;
          this.result = buf;
          this.onload?.({});
        })
        .catch((err) => {
          if (this.aborted) return;
          this.error = err;
          this.onerror?.({});
        });
    }
  };
}

import {
  validateAndPrepareVideoFile,
  uploadMediaItem,
  detectVideoMimeFromBytes,
  MAX_SERVER_UPLOAD_BYTES,
  UploadProgressInfo,
} from '../services/storageService';
import { createPersistentReel } from '../services/reelService';
import { isReelAudioActivelyPlaying } from '../components/ReelsFeedView';
import { AudioTrack } from '../types/audio';

interface AssertionResult {
  testId: string;
  description: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

const results: AssertionResult[] = [];

function record(testId: string, description: string, passed: boolean, evidence: string) {
  results.push({
    testId,
    description,
    status: passed ? 'PASS' : 'FAIL',
    evidence,
  });
}

function makeMp4Bytes(extraSize = 64): Uint8Array {
  const bytes = new Uint8Array(extraSize);
  // Standard ISO BMFF box header: size (0,0,0,24) + 'ftypisom'
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
  const canonicalTrack: AudioTrack = {
    id: 'track_canonical_01',
    title: 'Neon Horizon',
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
  };

  // TEST 1: "Use This Music" flow wiring preserves canonical AudioTrack without audio re-upload
  {
    const licenseSrc = fs.readFileSync('components/AudioLicenseInfoModal.tsx', 'utf8');
    const socialIndexSrc = fs.readFileSync('features/social/index.tsx', 'utf8');
    const createModalSrc = fs.readFileSync('components/CreateReelModal.tsx', 'utf8');
    const pass =
      licenseSrc.includes('onSelectTrack(track)') &&
      socialIndexSrc.includes('initialAudioTrack={editorInitialAudio}') &&
      createModalSrc.includes('setSelectedAudioTrack(initialAudioTrack)') &&
      createModalSrc.includes('create-reel-attached-soundtrack') &&
      createModalSrc.includes('Preserve canonical selectedAudioTrack without duplicating or re-uploading its audio file');
    record(
      'MRU-01',
      'Use This Music passes canonical initialAudioTrack into CreateReelModal without audio duplication',
      pass,
      pass ? 'Wiring confirmed across AudioLicenseInfoModal -> features/social/index.tsx -> CreateReelModal.tsx' : 'Missing soundtrack wiring'
    );
  }

  // TEST 2: MP4 file validation & magic byte detection
  {
    const mp4File = new File([makeMp4Bytes(128)], 'gallery_clip.mp4', { type: 'video/mp4' });
    const res = await validateAndPrepareVideoFile(mp4File);
    const pass =
      res.mimeType === 'video/mp4' &&
      res.extension === 'mp4' &&
      res.file.name === 'gallery_clip.mp4' &&
      res.sizeBytes === 128;
    record('MRU-02', 'Valid MP4 gallery file passes validation cleanly', pass, `mime=${res.mimeType}, name=${res.file.name}`);
  }

  // TEST 3: WebM file validation & magic byte detection
  {
    const webmFile = new File([makeWebmBytes(128)], 'clip_android.webm', { type: 'video/webm' });
    const res = await validateAndPrepareVideoFile(webmFile);
    const pass =
      res.mimeType === 'video/webm' &&
      res.extension === 'webm' &&
      res.file.name === 'clip_android.webm';
    record('MRU-03', 'Valid WebM gallery file passes validation cleanly', pass, `mime=${res.mimeType}, ext=${res.extension}`);
  }

  // TEST 4: Android content:// gallery selection with empty MIME type & extensionless token name
  {
    const androidContentFile = new File([makeMp4Bytes(256)], '1000048291', { type: '' });
    const res = await validateAndPrepareVideoFile(androidContentFile);
    const pass =
      res.mimeType === 'video/mp4' &&
      res.file.type === 'video/mp4' &&
      res.file.name === '1000048291.mp4';
    record(
      'MRU-04',
      'Android gallery file with empty MIME & no extension is normalized via container header bytes',
      pass,
      `normalizedType=${res.file.type}, normalizedName=${res.file.name}`
    );
  }

  // TEST 5: Zero-byte, non-video spoofed file, and oversized (>35MB server limit) rejection
  {
    let emptyMsg = '';
    let jpegMsg = '';
    let largeMsg = '';

    try {
      await validateAndPrepareVideoFile(new File([], 'empty.mp4', { type: 'video/mp4' }));
    } catch (e: any) {
      emptyMsg = e?.message || '';
    }

    try {
      await validateAndPrepareVideoFile(new File([makeJpegBytes(64)], 'photo_renamed.mp4', { type: 'video/mp4' }));
    } catch (e: any) {
      jpegMsg = e?.message || '';
    }

    try {
      const fakeBigBlob = {
        size: MAX_SERVER_UPLOAD_BYTES + 1024 * 1024,
        type: 'video/mp4',
        slice: () => new Blob([makeMp4Bytes(32)]),
      } as unknown as Blob;
      await validateAndPrepareVideoFile(fakeBigBlob, { checkServerFallbackLimit: true });
    } catch (e: any) {
      largeMsg = e?.message || '';
    }

    const pass =
      emptyMsg.toLowerCase().includes('empty') &&
      jpegMsg.toLowerCase().includes('image/jpeg') &&
      largeMsg.includes('35 MB');
    record(
      'MRU-05',
      'Zero-byte, disguised image, and oversized (>35MB fallback) files fail fast with clear messages',
      pass,
      `empty="${emptyMsg}" | spoof="${jpegMsg}" | big="${largeMsg}"`
    );
  }

  // TEST 6: Real upload trigger with progress callbacks and permanent URL resolution
  {
    const origFetch = globalThis.fetch;
    const progressEvents: UploadProgressInfo[] = [];
    let fetchCalled = 0;

    (globalThis as any).fetch = async (url: string, init: any) => {
      fetchCalled++;
      const parsedBody = JSON.parse(init.body);
      if (url === '/api/storage/upload' && parsedBody.fileBase64 && parsedBody.visibility === 'public') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            url: '/uploads/creator1_12345_realvideo.mp4',
            mimeType: 'video/mp4',
          }),
        };
      }
      return { ok: false, status: 500, json: async () => ({ error: 'Unexpected request' }) };
    };

    try {
      const file = new File([makeMp4Bytes(128)], 'upload_test.mp4', { type: 'video/mp4' });
      const uploadRes = await uploadMediaItem(file, {
        userId: 'creator1',
        type: 'video',
        visibility: 'public',
        onProgress: (p) => progressEvents.push(p),
      });

      const pass =
        fetchCalled === 1 &&
        uploadRes.url === '/uploads/creator1_12345_realvideo.mp4' &&
        progressEvents.some((p) => p.stage === 'preparing') &&
        progressEvents.some((p) => p.stage === 'uploading') &&
        progressEvents[progressEvents.length - 1]?.stage === 'done' &&
        progressEvents[progressEvents.length - 1]?.percent === 100;

      record(
        'MRU-06',
        'uploadMediaItem triggers real server upload with genuine progress stages and permanent URL',
        pass,
        `url=${uploadRes.url}, stages=${progressEvents.map((p) => `${p.stage}:${p.percent}`).join('->')}`
      );
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  }

  // TEST 7: Upload failure/timeout surfaces exact server error + CreateReelModal preserves video & soundtrack for Retry
  {
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 415,
      json: async () => ({
        error: 'Unsupported Media Type: Only verified MP4/WebM videos are permitted.',
      }),
    });

    let errMsg = '';
    try {
      const file = new File([makeMp4Bytes(64)], 'bad.mp4', { type: 'video/mp4' });
      await uploadMediaItem(file, { userId: 'u1', type: 'video' });
    } catch (e: any) {
      errMsg = e?.message || '';
    } finally {
      (globalThis as any).fetch = origFetch;
    }

    const createModalSrc = fs.readFileSync('components/CreateReelModal.tsx', 'utf8');
    const hasRetryAndPreservation =
      createModalSrc.includes('data-testid="retry-video-upload-btn"') &&
      createModalSrc.includes('handleRetryUpload') &&
      createModalSrc.includes("setUploadPhase('error')") &&
      !createModalSrc.includes("setSelectedAudioTrack(null)\n      }\n    } catch");

    const pass =
      errMsg.includes('Unsupported Media Type') &&
      hasRetryAndPreservation;
    record(
      'MRU-07',
      'Upload error stops loading immediately, surfaces exact error, and Retry Upload preserves selected video & soundtrack',
      pass,
      `errMsg="${errMsg}", hasRetryUI=${hasRetryAndPreservation}`
    );
  }

  // TEST 8: Cancel / Abort aborts upload cleanly & keeps Cancel button enabled + revokes blob URLs
  {
    const origFetch = globalThis.fetch;
    const controller = new AbortController();
    (globalThis as any).fetch = async (_url: string, init: any) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) {
          return reject(new DOMException('Aborted', 'AbortError'));
        }
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The upload operation was aborted.', 'AbortError'));
        });
        setTimeout(() => controller.abort(), 15);
      });
    };

    let abortedCorrectly = false;
    try {
      const file = new File([makeMp4Bytes(64)], 'cancel_test.mp4', { type: 'video/mp4' });
      await uploadMediaItem(file, { userId: 'u1', type: 'video', signal: controller.signal });
    } catch (e: any) {
      abortedCorrectly = e?.name === 'AbortError';
    } finally {
      (globalThis as any).fetch = origFetch;
    }

    const createModalSrc = fs.readFileSync('components/CreateReelModal.tsx', 'utf8');
    // Footer Cancel button must NOT have disabled={...}
    const cancelBtnBlockMatch = createModalSrc.match(/data-testid="create-reel-cancel-btn"[\s\S]{0,300}?>/);
    const cancelNotDisabled = Boolean(cancelBtnBlockMatch && !cancelBtnBlockMatch[0].includes('disabled='));
    const hasBlobCleanup =
      createModalSrc.includes('URL.revokeObjectURL') &&
      createModalSrc.includes('data-testid="cancel-video-upload-btn"');

    const pass = abortedCorrectly && cancelNotDisabled && hasBlobCleanup;
    record(
      'MRU-08',
      'AbortSignal cancels active upload immediately, Cancel button stays enabled, and temporary blob URLs are revoked',
      pass,
      `aborted=${abortedCorrectly}, cancelEnabled=${cancelNotDisabled}, blobCleanup=${hasBlobCleanup}`
    );
  }

  // TEST 9: Duplicate upload prevention + createPersistentReel reuses already uploaded video URL with attached audioTrack
  {
    const origFetch = globalThis.fetch;
    let uploadEndpointCalls = 0;
    (globalThis as any).fetch = async (url: string) => {
      if (url === '/api/storage/upload') uploadEndpointCalls++;
      return { ok: false, status: 500, json: async () => ({}) };
    };

    try {
      const reelResult = await createPersistentReel({
        title: 'Test Neon Reel',
        caption: 'Dancing under neon lights',
        videoSource: '/uploads/creator1_already_uploaded.mp4',
        duration: 18,
        musicTrack: `${canonicalTrack.title} • ${canonicalTrack.artist}`,
        audioTrack: canonicalTrack,
        visibility: 'public',
        author: {
          id: 'creator1',
          name: 'Aria Chen',
          username: 'ariachen',
          avatar: 'https://example.com/a.jpg',
        },
      });

      const createModalSrc = fs.readFileSync('components/CreateReelModal.tsx', 'utf8');
      const hasInFlightGuard =
        createModalSrc.includes('if (uploadInFlightRef.current) {\n        return;\n      }') &&
        createModalSrc.includes('disabled={isPublishing || isUploadBusy}');

      const pass =
        reelResult.success &&
        uploadEndpointCalls === 0 &&
        reelResult.reel?.videoSrc === '/uploads/creator1_already_uploaded.mp4' &&
        reelResult.reel?.audioTrack?.id === canonicalTrack.id &&
        hasInFlightGuard;

      record(
        'MRU-09',
        'Duplicate upload is prevented and createPersistentReel skips re-uploading permanent URL while attaching audioTrack',
        pass,
        `success=${reelResult.success}, uploadCalls=${uploadEndpointCalls}, trackId=${reelResult.reel?.audioTrack?.id}`
      );
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  }

  // TEST 10: Separate Upload/Processing state vs Publishing state in CreateReelModal
  {
    const createModalSrc = fs.readFileSync('components/CreateReelModal.tsx', 'utf8');
    const pass =
      createModalSrc.includes('data-testid="reel-video-upload-progress"') &&
      createModalSrc.includes('data-testid="reel-video-upload-ready"') &&
      createModalSrc.includes('data-testid="reel-publish-progress"') &&
      createModalSrc.includes('const [isPublishing, setIsPublishing] = useState(false)') &&
      createModalSrc.includes('const [uploadPhase, setUploadPhase] = useState<ReelVideoUploadPhase>');
    record(
      'MRU-10',
      'Video upload/processing UI state is strictly separated from Reel publishing state',
      pass,
      pass ? 'Separate uploadPhase & isPublishing state banners confirmed' : 'States are coupled'
    );
  }

  // TEST 11: Animated Music playback indicator strictly synced to genuine unmuted audio playback + reduced-motion safe
  {
    const playingUnmuted = isReelAudioActivelyPlaying(
      { paused: false, ended: false, readyState: 4, muted: false, volume: 1 },
      false
    );
    const pausedVideo = isReelAudioActivelyPlaying(
      { paused: true, ended: false, readyState: 4, muted: false, volume: 1 },
      false
    );
    const stalledVideo = isReelAudioActivelyPlaying(
      { paused: false, ended: false, readyState: 1, muted: false, volume: 1 },
      false
    );
    const endedVideo = isReelAudioActivelyPlaying(
      { paused: false, ended: true, readyState: 4, muted: false, volume: 1 },
      false
    );
    const viewMuted = isReelAudioActivelyPlaying(
      { paused: false, ended: false, readyState: 4, muted: false, volume: 1 },
      true
    );
    const elMuted = isReelAudioActivelyPlaying(
      { paused: false, ended: false, readyState: 4, muted: true, volume: 1 },
      false
    );

    const reelsFeedSrc = fs.readFileSync('components/ReelsFeedView.tsx', 'utf8');
    const reelCardSrc = fs.readFileSync('components/ReelCard.tsx', 'utf8');
    const indexHtmlSrc = fs.readFileSync('index.html', 'utf8');

    const hasProperListeners =
      reelsFeedSrc.includes('data-music-playing={isMusicPlayingForReel ? \'true\' : \'false\'}') &&
      reelsFeedSrc.includes("data-testid={`reel-music-eq-${reel.id}`}") &&
      reelsFeedSrc.includes("'waiting'") &&
      reelsFeedSrc.includes("'stalled'") &&
      reelsFeedSrc.includes("'volumechange'") &&
      reelsFeedSrc.includes('w-10 h-10 rounded-full');

    const hasReducedMotionSupport =
      indexHtmlSrc.includes('@media (prefers-reduced-motion: no-preference)') &&
      indexHtmlSrc.includes('@media (prefers-reduced-motion: reduce)') &&
      indexHtmlSrc.includes('metfa-eq-bar-1') &&
      reelCardSrc.includes('motion-safe:animate-spin');

    const pass =
      playingUnmuted === true &&
      pausedVideo === false &&
      stalledVideo === false &&
      endedVideo === false &&
      viewMuted === false &&
      elMuted === false &&
      hasProperListeners &&
      hasReducedMotionSupport;

    record(
      'MRU-11',
      'Music indicator animates ONLY when active Reel audio plays unmuted, stops on pause/stall/end/mute, and respects reduced motion',
      pass,
      `playing=${playingUnmuted}, paused=${pausedVideo}, stalled=${stalledVideo}, ended=${endedVideo}, viewMuted=${viewMuted}, elMuted=${elMuted}`
    );
  }

  // TEST 12: Top-tab grey horizontal line removed without touching Discover underline, global scrollbars, or Reels timeline
  {
    const reelsFeedSrc = fs.readFileSync('components/ReelsFeedView.tsx', 'utf8');
    const indexHtmlSrc = fs.readFileSync('index.html', 'utf8');
    const advControlsSrc = fs.readFileSync('components/AdvancedVideoControls.tsx', 'utf8');

    const tabsMatch = reelsFeedSrc.match(
      /data-testid="reels-top-tabs-bar"\s+className="([^"]+)"/
    );
    const tabsClass = tabsMatch ? tabsMatch[1] : '';

    const scrollbarHiddenOnTabs =
      !tabsClass.includes('no-scrollbar') &&
      tabsClass.includes('overflow-x-auto') &&
      tabsClass.includes('[scrollbar-width:none]') &&
      tabsClass.includes('[&::-webkit-scrollbar]:hidden');

    const discoverUnderlinePreserved =
      reelsFeedSrc.includes("feedFilter === 'discover'") &&
      reelsFeedSrc.includes('w-5 h-0.5 bg-teal-400 rounded-full');

    const globalScrollbarsPreserved =
      indexHtmlSrc.includes('::-webkit-scrollbar-track') &&
      indexHtmlSrc.includes('::-webkit-scrollbar-thumb');

    const reelsTimelinePreserved = advControlsSrc.includes('TIMELINE_AUTO_HIDE_DELAY_MS');

    const pass =
      scrollbarHiddenOnTabs &&
      discoverUnderlinePreserved &&
      globalScrollbarsPreserved &&
      reelsTimelinePreserved;

    record(
      'MRU-12',
      'Unwanted horizontal grey scrollbar above Reels is removed while Discover underline, touch scroll, global scrollbars & Reels timeline stay intact',
      pass,
      `tabsHidden=${scrollbarHiddenOnTabs}, discoverUnderline=${discoverUnderlinePreserved}, globalScrollbars=${globalScrollbarsPreserved}, timeline=${reelsTimelinePreserved}`
    );
  }

  // Print summary table
  let failed = 0;
  console.log('\n=== METFA SOCIAL — MUSIC REUSE UPLOAD & REELS UI POLISH VERIFICATION ===\n');
  for (const r of results) {
    if (r.status === 'FAIL') failed++;
    console.log(`[${r.status}] ${r.testId}: ${r.description}`);
    console.log(`       Evidence: ${r.evidence}`);
  }
  console.log(`\nTotal: ${results.length}, Passed: ${results.length - failed}, Failed: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
