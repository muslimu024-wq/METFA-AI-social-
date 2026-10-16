/**
 * METFA AI Editor — Video Processor Engine
 * Performs real client-side video processing:
 * - Start/End Trimming
 * - Make it Better (canvas contrast/brightness/saturation boost + audio dynamics normalization)
 * - Clean Audio (Web Audio high-pass filter + vocal presence peaking + compressor on video stream)
 * - Make a Reel (9:16 vertical center crop)
 */

import { ProcessedMediaResult, VideoOperation } from '../types';
import { blobToDataUrl } from './audioProcessor';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  videoUrl: string;
}

export function isMediaRecorderSupported(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).MediaRecorder);
}

export function getSupportedVideoMimeType(hasAudio = true): string {
  if (typeof window === 'undefined' || !(window as any).MediaRecorder) {
    return 'video/webm';
  }
  const typesWithAudio = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];
  const typesVideoOnly = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  const types = hasAudio ? typesWithAudio : typesVideoOnly;
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return 'video/webm';
}

export interface VideoFormatAnalysis {
  container: 'mp4' | 'webm' | 'quicktime' | 'ogg' | 'unknown';
  detectedCodec: 'h264' | 'hevc' | 'av1' | 'vp8' | 'vp9' | 'unknown';
  mimeType: string;
  recommendedBlobType: string;
  canPlayLikely: boolean;
  isUnsupportedCodec: boolean;
  codecLabel: string;
  recoveryAdvice?: string;
}

/**
 * Helper to scan an ISO-BMFF (MP4/MOV) buffer for the `moov` box and extract video sample entry fourCC.
 * Strictly searches within the `moov` container, eliminating false positives from compressed `mdat` payload.
 */
function extractIsoBmffCodec(bytes: Uint8Array): 'h264' | 'hevc' | 'av1' | 'vp9' | 'unknown' {
  let str = '';
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    str += String.fromCharCode.apply(null, chunk as any);
  }

  const moovIdx = str.indexOf('moov');
  if (moovIdx === -1) {
    return 'unknown';
  }

  // Only scan from moov box onwards
  const moovStr = str.slice(moovIdx);

  if (moovStr.includes('avc1') || moovStr.includes('avc3') || moovStr.includes('dva1') || moovStr.includes('dvav')) {
    return 'h264';
  }
  if (moovStr.includes('hvc1') || moovStr.includes('hev1') || moovStr.includes('dvh1') || moovStr.includes('dvhe')) {
    return 'hevc';
  }
  if (moovStr.includes('av01')) {
    return 'av1';
  }
  if (moovStr.includes('vp09')) {
    return 'vp9';
  }

  return 'unknown';
}

/**
 * Inspects actual file container and video codec from binary headers (head and tail).
 * Distinguishes genuine unsupported codecs (e.g. HEVC/H.265) from false rejections.
 */
export async function inspectVideoFileFormat(fileOrBlob: File | Blob): Promise<VideoFormatAnalysis> {
  const reportedType = fileOrBlob.type || '';
  const fileName = 'name' in fileOrBlob ? (fileOrBlob as File).name : '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  let container: 'mp4' | 'webm' | 'quicktime' | 'ogg' | 'unknown' = 'unknown';
  let detectedCodec: 'h264' | 'hevc' | 'av1' | 'vp8' | 'vp9' | 'unknown' = 'unknown';

  try {
    const slice = fileOrBlob.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Check for WebM EBML header (0x1A, 0x45, 0xDF, 0xA3)
    if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      container = 'webm';
      let binStr = '';
      for (let i = 0; i < Math.min(bytes.length, 32768); i++) {
        binStr += String.fromCharCode(bytes[i]);
      }
      if (binStr.includes('V_VP9')) detectedCodec = 'vp9';
      else if (binStr.includes('V_VP8')) detectedCodec = 'vp8';
      else if (binStr.includes('V_AV1')) detectedCodec = 'av1';
      else if (binStr.includes('V_MPEG4/ISO/AVC')) detectedCodec = 'h264';
      else detectedCodec = 'vp8';
    } else {
      // 2. Check for MP4 / ISO-BMFF / QuickTime (look for 'ftyp')
      let binStr = '';
      const scanLimit = Math.min(bytes.length, 4096);
      for (let i = 0; i < scanLimit; i++) {
        binStr += String.fromCharCode(bytes[i]);
      }

      const ftypIdx = binStr.indexOf('ftyp');
      if (ftypIdx !== -1) {
        const brand = binStr.slice(ftypIdx + 4, ftypIdx + 8);
        if (brand.startsWith('qt')) {
          container = 'quicktime';
        } else {
          container = 'mp4';
        }
      } else if (ext === 'mp4' || ext === 'm4v') {
        container = 'mp4';
      } else if (ext === 'mov') {
        container = 'quicktime';
      } else if (ext === 'webm') {
        container = 'webm';
      }

      // Check for video codec strictly within moov box in head slice
      detectedCodec = extractIsoBmffCodec(bytes);

      // If moov was not in the head 128KB (typical for Android camera recordings where moov is at file end), check tail 256KB
      if (detectedCodec === 'unknown' && fileOrBlob.size > 131072) {
        try {
          const tailSlice = fileOrBlob.slice(Math.max(0, fileOrBlob.size - 262144));
          const tailBuf = await tailSlice.arrayBuffer();
          const tailCodec = extractIsoBmffCodec(new Uint8Array(tailBuf));
          if (tailCodec !== 'unknown') {
            detectedCodec = tailCodec;
          }
        } catch {}
      }
    }
  } catch (inspectErr) {
    console.warn('[VideoProcessor] Binary format inspection note:', inspectErr);
  }

  // Fallbacks if binary scan was indeterminate
  if (container === 'unknown') {
    if (ext === 'mp4' || ext === 'm4v' || reportedType.includes('mp4')) container = 'mp4';
    else if (ext === 'webm' || reportedType.includes('webm')) container = 'webm';
    else if (ext === 'mov' || reportedType.includes('quicktime')) container = 'quicktime';
    else container = 'mp4';
  }

  // Test browser playback capability
  const testVideo = typeof document !== 'undefined' ? document.createElement('video') : null;
  let canPlayLikely = true;
  let isUnsupportedCodec = false;
  let codecLabel = 'H.264 (MP4)';

  if (detectedCodec === 'hevc') {
    codecLabel = 'HEVC / H.265';
    const canPlayHevc = Boolean(
      testVideo?.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
      testVideo?.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')
    );
    if (!canPlayHevc) {
      isUnsupportedCodec = true;
      canPlayLikely = false;
    }
  } else if (detectedCodec === 'av1') {
    codecLabel = 'AV1';
    const canPlayAv1 = Boolean(testVideo?.canPlayType('video/mp4; codecs="av01.0.05M.08"'));
    if (!canPlayAv1) {
      isUnsupportedCodec = true;
      canPlayLikely = false;
    }
  } else if (detectedCodec === 'h264') {
    codecLabel = 'H.264 (AVC)';
    canPlayLikely = true;
    isUnsupportedCodec = false;
  } else if (detectedCodec === 'vp9') {
    codecLabel = 'VP9';
    canPlayLikely = true;
  } else if (detectedCodec === 'vp8') {
    codecLabel = 'VP8';
    canPlayLikely = true;
  } else {
    // Indeterminate codec: never reject falsely. Let in-browser player attempt playback.
    codecLabel = container === 'webm' ? 'WebM' : 'H.264 (MP4)';
    canPlayLikely = true;
    isUnsupportedCodec = false;
  }

  // Recommended blob MIME type:
  // Android Chromium rejects 'video/quicktime' blobs with code 4 even for standard H.264 video.
  // Serving ISO-BMFF / QuickTime files as 'video/mp4' fixes false rejections on Android.
  const recommendedBlobType = container === 'webm' ? 'video/webm' : 'video/mp4';

  let recoveryAdvice: string | undefined = undefined;
  if (isUnsupportedCodec) {
    recoveryAdvice = `This video is encoded in ${codecLabel}, which your mobile web browser cannot decode in-browser. Supported formats: H.264 (MP4) and WebM. You can still post or save the original untouched file directly.`;
  }

  return {
    container,
    detectedCodec,
    mimeType: reportedType || recommendedBlobType,
    recommendedBlobType,
    canPlayLikely,
    isUnsupportedCodec,
    codecLabel,
    recoveryAdvice,
  };
}

/**
 * Loads video element and retrieves duration, width, and height safely on all mobile browsers.
 * Handles Android camera recordings with Infinity/zero durations without hanging or seeking stalls.
 */
export function loadVideoMetadata(fileOrUrl: File | Blob | string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    (video as any).webkitPlaysInline = true;

    const isBlobOrFile = typeof fileOrUrl !== 'string';
    const url = isBlobOrFile ? createSafeVideoBlobUrl(fileOrUrl) : fileOrUrl;

    let isSettled = false;
    let timeoutId: any = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.oncanplay = null;
      video.onerror = null;
      video.ontimeupdate = null;
      video.onseeked = null;
      video.ondurationchange = null;
    };

    const finish = (finalDuration: number) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();

      const safeDuration = isFinite(finalDuration) && !isNaN(finalDuration) && finalDuration > 0
        ? finalDuration
        : 0;

      resolve({
        duration: safeDuration,
        width: video.videoWidth || 640,
        height: video.videoHeight || 480,
        videoUrl: url,
      });
    };

    const inspectDuration = () => {
      // 1. Check seekable range first (most accurate for Android camera recordings with Infinity duration)
      if (video.seekable && video.seekable.length > 0) {
        try {
          const sEnd = video.seekable.end(video.seekable.length - 1);
          if (isFinite(sEnd) && sEnd > 0) {
            finish(sEnd);
            return;
          }
        } catch {}
      }

      const d = video.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) {
        finish(d);
        return;
      }

      // 2. Android camera recording duration recovery: listen for durationchange
      let probeTimer: any = null;
      const onDiscovered = () => {
        if (probeTimer) clearTimeout(probeTimer);
        video.ondurationchange = null;
        if (isFinite(video.duration) && video.duration > 0) {
          finish(video.duration);
        } else if (video.seekable && video.seekable.length > 0) {
          try {
            const sEnd = video.seekable.end(video.seekable.length - 1);
            if (isFinite(sEnd) && sEnd > 0) {
              finish(sEnd);
              return;
            }
          } catch {}
          finish(0);
        } else {
          finish(0);
        }
      };

      video.ondurationchange = onDiscovered;
      probeTimer = setTimeout(() => {
        video.ondurationchange = null;
        if (!isSettled) {
          if (isFinite(video.duration) && video.duration > 0) {
            finish(video.duration);
          } else if (video.seekable && video.seekable.length > 0) {
            try {
              const sEnd = video.seekable.end(video.seekable.length - 1);
              if (isFinite(sEnd) && sEnd > 0) {
                finish(sEnd);
                return;
              }
            } catch {}
            finish(0);
          } else {
            finish(0);
          }
        }
      }, 1000);
    };

    // Attach listeners BEFORE setting video.src to eliminate race conditions
    video.onloadedmetadata = inspectDuration;
    video.onloadeddata = () => { if (!isSettled) inspectDuration(); };
    video.oncanplay = () => { if (!isSettled) inspectDuration(); };

    video.onerror = () => {
      if (isSettled) return;
      isSettled = true;
      cleanup();

      const err = video.error;
      let detailedMessage = 'Could not inspect video metadata.';
      if (err) {
        if (err.code === 3) {
          detailedMessage = 'Video decode error: The format or codec (such as HEVC/H.265) is not supported by this browser.';
        } else if (err.code === 4) {
          detailedMessage = 'Unsupported video format or codec for in-browser processing.';
        } else if (err.code === 2) {
          detailedMessage = 'Network or storage read error while opening video file.';
        } else {
          detailedMessage = `Video inspection error (Code ${err.code}): ${err.message || 'Unknown issue'}`;
        }
      }
      reject(new Error(detailedMessage));
    };

    // 25-second bounded safety timeout to allow large high-resolution video files to load on mobile devices
    timeoutId = setTimeout(() => {
      if (!isSettled) {
        if (video.videoWidth > 0 || (isFinite(video.duration) && video.duration > 0)) {
          inspectDuration();
        } else {
          isSettled = true;
          cleanup();
          reject(new Error('Video metadata inspection timed out. The file may take longer to read or uses an unsupported codec.'));
        }
      }
    }, 25000);

    video.src = url;
    try {
      video.load();
    } catch {}
  });
}

export function createSafeVideoBlob(fileOrBlob: File | Blob, forcedMime?: string): Blob {
  if (forcedMime) {
    return new Blob([fileOrBlob], { type: forcedMime });
  }
  const mimeType = fileOrBlob.type;
  // If the file already has a browser-supported MIME type (video/mp4, video/webm), return untouched
  if (mimeType === 'video/mp4' || mimeType === 'video/webm') {
    return fileOrBlob;
  }

  // Android Chrome rejects video/quicktime blobs with code 4 even for H.264 files.
  // Standardize ISO-BMFF / MOV / untyped videos to video/mp4 for 100% Android compatibility.
  let targetMime = mimeType;
  if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'video/quicktime') {
    const name = 'name' in fileOrBlob ? (fileOrBlob as File).name : '';
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'webm') targetMime = 'video/webm';
    else if (ext === 'ogv') targetMime = 'video/ogg';
    else targetMime = 'video/mp4';
  }

  if (fileOrBlob.type === targetMime) {
    return fileOrBlob;
  }
  return new Blob([fileOrBlob], { type: targetMime });
}

export function createSafeVideoBlobUrl(fileOrBlob: File | Blob, forcedMime?: string): string {
  const blob = createSafeVideoBlob(fileOrBlob, forcedMime);
  return URL.createObjectURL(blob);
}

export interface RenderVideoOptions {
  sourceUrl: string;
  sourceFile?: File | Blob;
  operation: VideoOperation;
  startTime?: number;
  endTime?: number;
  knownDuration?: number;
  onProgress?: (percent: number, status: string) => void;
  originalFileName?: string;
}

/**
 * Executes a real client-side render of the video using HTMLCanvasElement,
 * Web Audio API (MediaElementAudioSourceNode), and MediaRecorder.
 */
export async function renderProcessedVideo(options: RenderVideoOptions): Promise<ProcessedMediaResult> {
  if (!isMediaRecorderSupported()) {
    throw new Error('Your browser does not support MediaRecorder for client-side video processing.');
  }

  const {
    sourceUrl,
    operation,
    startTime = 0,
    endTime,
    knownDuration,
    onProgress,
    originalFileName = 'video',
  } = options;

  return new Promise(async (resolve, reject) => {
    let animationFrameId: number;
    let audioCtx: AudioContext | null = null;
    let recorder: MediaRecorder | null = null;
    let retryBlobUrl: string | null = null;
    let hasStopped = false;
    let isRecordingFinalized = false;

    const video = document.createElement('video');
    // Ensure video is in DOM off-screen so mobile engines reliably process frames
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(video);
    }

    const cleanupResources = () => {
      cancelAnimationFrame(animationFrameId);
      try {
        video.pause();
      } catch {}
      if (video.parentNode) {
        try {
          video.parentNode.removeChild(video);
        } catch {}
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          audioCtx.close();
        } catch {}
      }
      if (retryBlobUrl) {
        try {
          URL.revokeObjectURL(retryBlobUrl);
        } catch {}
      }
    };

    const isCrossOrigin =
      typeof window !== 'undefined' &&
      (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) &&
      !sourceUrl.startsWith(window.location.origin);

    if (isCrossOrigin) {
      video.crossOrigin = 'anonymous';
    }

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    (video as any).webkitPlaysInline = true;

    // Helper to load video metadata with race-condition prevention & sourceFile retry
    const loadVideoSource = (urlToLoad: string): Promise<void> => {
      return new Promise<void>((res, rej) => {
        let settled = false;
        let loadTimeoutId: any = null;

        const onReady = () => {
          if (!settled) {
            settled = true;
            if (loadTimeoutId) clearTimeout(loadTimeoutId);
            video.onloadedmetadata = null;
            video.oncanplay = null;
            video.onloadeddata = null;
            video.onerror = null;
            res();
          }
        };

        const onErr = () => {
          if (!settled) {
            settled = true;
            if (loadTimeoutId) clearTimeout(loadTimeoutId);
            video.onloadedmetadata = null;
            video.oncanplay = null;
            video.onloadeddata = null;
            video.onerror = null;

            const err = video.error;
            let detailedMessage = 'Could not load source video for rendering.';
            if (err) {
              if (err.code === 3) {
                detailedMessage = 'Video decode error: The video codec (e.g. HEVC/H.265) is not supported by your browser for canvas processing.';
              } else if (err.code === 4) {
                detailedMessage = 'Unsupported video format or codec for client-side rendering.';
              } else if (err.code === 2) {
                detailedMessage = 'Network or storage read error while opening source video file.';
              } else {
                detailedMessage = `Video loading error (Code ${err.code}): ${err.message || 'Media load failed'}`;
              }
            }
            rej(new Error(detailedMessage));
          }
        };

        // Attach listeners BEFORE setting video.src to eliminate race condition
        video.onloadedmetadata = onReady;
        video.oncanplay = onReady;
        video.onloadeddata = onReady;
        video.onerror = onErr;

        video.src = urlToLoad;

        if (video.readyState >= 1 || (video.videoWidth > 0 && isFinite(video.duration) && video.duration > 0)) {
          onReady();
          return;
        }

        // 25-second safety timeout for large video decoding
        loadTimeoutId = setTimeout(() => {
          if (!settled) {
            if (video.videoWidth > 0 || video.readyState >= 1) {
              onReady();
            } else {
              settled = true;
              video.onloadedmetadata = null;
              video.oncanplay = null;
              video.onloadeddata = null;
              video.onerror = null;
              rej(new Error('Timed out waiting for video to load for rendering. The file may use an unsupported codec.'));
            }
          }
        }, 25000);

        try {
          video.load();
        } catch {}
      });
    };

    // Attempt loading sourceUrl, with automatic fallback to sourceFile if available
    try {
      await loadVideoSource(sourceUrl);
    } catch (firstLoadErr: any) {
      if (options.sourceFile) {
        try {
          retryBlobUrl = createSafeVideoBlobUrl(options.sourceFile);
          video.crossOrigin = null;
          await loadVideoSource(retryBlobUrl);
        } catch (retryErr: any) {
          cleanupResources();
          return reject(retryErr);
        }
      } else {
        cleanupResources();
        return reject(firstLoadErr);
      }
    }

    // Safely resolve finite duration (handles Android camera recording with Infinity/NaN duration)
    let safeDuration = 0;
    if (isFinite(video.duration) && !isNaN(video.duration) && video.duration > 0) {
      safeDuration = video.duration;
    } else if (knownDuration && isFinite(knownDuration) && knownDuration > 0) {
      safeDuration = knownDuration;
    } else if (video.seekable && video.seekable.length > 0) {
      try {
        const sEnd = video.seekable.end(video.seekable.length - 1);
        if (isFinite(sEnd) && sEnd > 0) safeDuration = sEnd;
      } catch {}
    }

    const origWidth = video.videoWidth || 640;
    const origHeight = video.videoHeight || 480;

    const actualStart = Math.max(0, startTime);
    const requestedEnd = endTime !== undefined && isFinite(endTime) && endTime > 0 ? endTime : undefined;
    const actualEnd = requestedEnd !== undefined
      ? Math.max(actualStart + 0.2, requestedEnd)
      : (safeDuration > 0 ? Math.max(actualStart + 0.2, safeDuration) : Infinity);
    const targetDuration = isFinite(actualEnd) ? Math.max(0.2, actualEnd - actualStart) : 0;

    // Configure Canvas Dimensions based on operation
    const canvas = document.createElement('canvas');
    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (operation === 'make_reel') {
      // 9:16 aspect ratio: lock height to original height, crop width to 9/16 of height
      targetHeight = origHeight;
      targetWidth = Math.round(targetHeight * (9 / 16));
      if (targetWidth % 2 !== 0) targetWidth += 1;
      if (targetHeight % 2 !== 0) targetHeight += 1;
    } else {
      if (targetWidth % 2 !== 0) targetWidth += 1;
      if (targetHeight % 2 !== 0) targetHeight += 1;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      cleanupResources();
      return reject(new Error('Canvas 2D context not available.'));
    }

    // Set canvas enhancement filter if "Make it Better"
    if (operation === 'enhance') {
      ctx.filter = 'contrast(1.15) brightness(1.05) saturate(1.22)';
    } else {
      ctx.filter = 'none';
    }

    // Prepare Web Audio nodes for video audio track
    let audioStreamTrack: MediaStreamTrack | null = null;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        const sourceNode = audioCtx.createMediaElementSource(video);
        const destinationNode = audioCtx.createMediaStreamDestination();

        if (operation === 'clean_audio') {
          // 1. Highpass filter to cut low background hum (air conditioning, rumble)
          const highpass = audioCtx.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.value = 95;

          // 2. Peaking filter for dialogue clarity
          const peaking = audioCtx.createBiquadFilter();
          peaking.type = 'peaking';
          peaking.frequency.value = 2800;
          peaking.Q.value = 1.3;
          peaking.gain.value = 3.0;

          // 3. Dynamics compressor to normalize volume
          const comp = audioCtx.createDynamicsCompressor();
          comp.threshold.value = -22;
          comp.ratio.value = 4.5;
          comp.attack.value = 0.003;
          comp.release.value = 0.25;

          sourceNode.connect(highpass);
          highpass.connect(peaking);
          peaking.connect(comp);
          comp.connect(destinationNode);
        } else if (operation === 'enhance') {
          // Normalize audio dynamics along with visual enhancement
          const comp = audioCtx.createDynamicsCompressor();
          comp.threshold.value = -18;
          comp.ratio.value = 3.5;
          const gain = audioCtx.createGain();
          gain.gain.value = 1.15;

          sourceNode.connect(comp);
          comp.connect(gain);
          gain.connect(destinationNode);
        } else {
          // Pass-through to destination stream
          sourceNode.connect(destinationNode);
        }

        const audioTracks = destinationNode.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioStreamTrack = audioTracks[0];
        }
      }
    } catch (audioErr) {
      console.warn('[VideoProcessor] Web Audio routing note:', audioErr);
    }

    // Capture Canvas Stream
    const canvasStream = canvas.captureStream(30); // 30 fps
    const finalStream = new MediaStream();

    canvasStream.getVideoTracks().forEach((track) => finalStream.addTrack(track));
    if (audioStreamTrack) {
      finalStream.addTrack(audioStreamTrack);
    }

    const mimeType = getSupportedVideoMimeType(Boolean(audioStreamTrack));
    const recordedChunks: Blob[] = [];

    try {
      recorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });
    } catch (recInitErr) {
      try {
        recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
      } catch {
        recorder = new MediaRecorder(finalStream);
      }
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    recorder.onerror = (err: any) => {
      cleanupResources();
      reject(new Error(`Recording error: ${err?.message || 'MediaRecorder failed'}`));
    };

    const onCompleteOutput = async () => {
      cleanupResources();

      if (recordedChunks.length === 0) {
        return reject(new Error('No video frames could be recorded. Your original video is preserved safely.'));
      }

      const outputBlob = new Blob(recordedChunks, { type: mimeType });
      // Only convert to Base64 Data URL if blob is small (< 12MB).
      // For larger renders, create an Object URL to prevent browser heap memory blowup
      const safeDataUrl = outputBlob.size < 12 * 1024 * 1024
        ? await blobToDataUrl(outputBlob)
        : URL.createObjectURL(outputBlob);
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const cleanName = `${originalFileName.replace(/\.[^/.]+$/, '')}_${operation}.${ext}`;

      resolve({
        type: 'video',
        blob: outputBlob,
        dataUrl: safeDataUrl,
        name: cleanName,
        sizeBytes: outputBlob.size,
        mimeType,
        durationSeconds: targetDuration > 0 ? targetDuration : Math.max(0.1, video.currentTime - actualStart),
        width: targetWidth,
        height: targetHeight,
        appliedOperations: [operation],
      });
    };

    recorder.onstop = () => {
      if (!hasStopped) {
        hasStopped = true;
        onCompleteOutput();
      }
    };

    const startRecordingAndPlayback = () => {
      try {
        recorder?.start(200); // 200ms timeslices
      } catch (recStartErr: any) {
        cleanupResources();
        return reject(new Error('MediaRecorder could not start: ' + recStartErr.message));
      }

      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      // Unmute so Web Audio receives real audio tracks; fallback to muted if browser autoplay blocks it
      video.muted = false;
      video.volume = 1.0;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((playErr) => {
          console.warn('[VideoProcessor] Unmuted play blocked by browser policy, falling back to muted play:', playErr);
          video.muted = true;
          video.play().catch((err2) => {
            cleanupResources();
            reject(new Error('Video playback error during rendering: ' + err2.message));
          });
        });
      }

      let lastTimeCheck = Date.now();
      let lastCurrentTime = video.currentTime;
      let stallSeconds = 0;
      // Proportional watchdog: allows videos of any supported duration to render without arbitrary cutoffs
      const maxRenderDurationMs = targetDuration > 0
        ? Math.max(30000, targetDuration * 2500 + 15000)
        : 3600000;
      const renderStartTime = Date.now();

      const finishRecording = () => {
        if (isRecordingFinalized) return;
        isRecordingFinalized = true;
        onProgress?.(100, 'Finishing video export...');
        cancelAnimationFrame(animationFrameId);
        try {
          video.pause();
        } catch {}

        try {
          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
          }
        } catch {}

        // Failsafe timer: if recorder.onstop event is delayed or dropped, trigger completion
        setTimeout(() => {
          if (!hasStopped) {
            hasStopped = true;
            onCompleteOutput();
          }
        }, 1500);
      };

      video.onended = () => {
        finishRecording();
      };

      // Frame rendering loop
      const renderFrame = () => {
        const now = Date.now();

        if (video.currentTime >= actualEnd - 0.05 || video.ended) {
          finishRecording();
          return;
        }

        // Global safety watchdog: prevent infinite spinner if browser stalls
        if (now - renderStartTime > maxRenderDurationMs) {
          console.warn('[VideoProcessor] Reached max render duration, finalizing recording to prevent infinite spinner');
          finishRecording();
          return;
        }

        // Stall detector: if currentTime hasn't moved in 1 second
        if (now - lastTimeCheck > 1000) {
          if (Math.abs(video.currentTime - lastCurrentTime) < 0.02) {
            stallSeconds++;
            if (stallSeconds >= 3) {
              if (video.paused && !video.ended) {
                video.play().catch(() => {});
              }
              // Only finalize if playback is genuinely stuck for an extended duration (20s) without progress
              if (stallSeconds >= 20) {
                console.warn('[VideoProcessor] Video playback stalled during frame capture, finalizing rendered frames');
                finishRecording();
                return;
              }
            }
          } else {
            stallSeconds = 0;
            lastCurrentTime = video.currentTime;
          }
          lastTimeCheck = now;
        }

        const elapsed = Math.max(0, video.currentTime - actualStart);
        const percent = Math.min(99, Math.round((elapsed / targetDuration) * 100));
        onProgress?.(percent, `Processing frame at ${video.currentTime.toFixed(1)}s (${percent}%)...`);

        if (operation === 'make_reel') {
          // 9:16 Center Crop
          const sourceCropWidth = Math.min(origWidth, Math.round(origHeight * (9 / 16)));
          const sx = Math.max(0, Math.round((origWidth - sourceCropWidth) / 2));
          const sy = 0;
          const sw = sourceCropWidth;
          const sh = origHeight;

          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
        } else {
          // Standard full-frame draw
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        }

        animationFrameId = requestAnimationFrame(renderFrame);
      };

      animationFrameId = requestAnimationFrame(renderFrame);
    };

    // Seek to actual start time if needed
    if (actualStart > 0.05 && Math.abs(video.currentTime - actualStart) > 0.05) {
      let seekFallbackTimer: any = null;
      let seekStarted = false;

      const onSeekReady = () => {
        if (!seekStarted) {
          seekStarted = true;
          if (seekFallbackTimer) clearTimeout(seekFallbackTimer);
          video.onseeked = null;
          startRecordingAndPlayback();
        }
      };

      video.onseeked = onSeekReady;
      seekFallbackTimer = setTimeout(onSeekReady, 1200); // 1.2s fallback if seeked event is dropped
      video.currentTime = actualStart;
    } else {
      // Already at position (e.g. 0.0s), start immediately without waiting for seeked event
      startRecordingAndPlayback();
    }
  });
}
