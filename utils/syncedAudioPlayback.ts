import { ReelAudioConfig } from '../types/audio';

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Returns the external audio URL only if it is valid and distinct from the video's own URL,
 * preventing double-playback when an original sound simply points to the reel's own video file.
 */
export function resolveDistinctExternalAudioUrl(
  audioUrl?: string | null,
  videoSrc?: string | null
): string | null {
  const cleanAudio = typeof audioUrl === 'string' ? audioUrl.trim() : '';
  if (!cleanAudio) return null;
  const cleanVideo = typeof videoSrc === 'string' ? videoSrc.trim() : '';
  if (cleanVideo && cleanAudio === cleanVideo) return null;
  return cleanAudio;
}

export function computeEffectiveVolumes(params: {
  isMuted: boolean;
  musicVolumePercent?: number;
  originalVideoVolumePercent?: number;
  currentTime: number;
  duration?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
}): {
  videoMuted: boolean;
  videoVolume: number;
  audioVolume: number;
  shouldPlayAudio: boolean;
} {
  if (params.isMuted) {
    return {
      videoMuted: true,
      videoVolume: 0,
      audioVolume: 0,
      shouldPlayAudio: false,
    };
  }

  const origRatio = clamp(params.originalVideoVolumePercent ?? 100, 0, 100) / 100;
  const baseMusicRatio = clamp(params.musicVolumePercent ?? 100, 0, 100) / 100;
  let fadeMultiplier = 1;

  const t = Math.max(0, Number.isFinite(params.currentTime) ? params.currentTime : 0);
  const dur = Number.isFinite(params.duration) && (params.duration || 0) > 0 ? (params.duration as number) : 0;

  if (params.fadeIn && t < 1.5) {
    fadeMultiplier = Math.min(fadeMultiplier, clamp(t / 1.5, 0.05, 1));
  }
  if (params.fadeOut && dur >= 3 && dur - t < 1.5) {
    fadeMultiplier = Math.min(fadeMultiplier, clamp((dur - t) / 1.5, 0, 1));
  }

  const effectiveAudioVol = clamp(baseMusicRatio * fadeMultiplier, 0, 1);
  return {
    videoMuted: origRatio <= 0,
    videoVolume: origRatio,
    audioVolume: effectiveAudioVol,
    shouldPlayAudio: baseMusicRatio > 0,
  };
}

export function computeDesiredAudioTime(params: {
  videoCurrentTime: number;
  startTimeOffset?: number;
  audioDuration?: number;
}): number {
  const videoT = Math.max(0, Number.isFinite(params.videoCurrentTime) ? params.videoCurrentTime : 0);
  const offset = Math.max(0, Number.isFinite(params.startTimeOffset) ? (params.startTimeOffset as number) : 0);
  const raw = offset + videoT;
  const dur = params.audioDuration;
  if (typeof dur === 'number' && Number.isFinite(dur) && dur > 0) {
    return raw % dur;
  }
  return raw;
}

export interface SyncedAudioControllerParams {
  videoEl: HTMLVideoElement | null;
  audioEl: HTMLAudioElement | null;
  isActive: boolean;
  isMuted: boolean;
  audioUrl: string | null;
  audioConfig?: ReelAudioConfig | null;
  onAudioPlayStateChange?: (isPlaying: boolean) => void;
}

/**
 * Synchronizes an external soundtrack <audio> element with a <video> element across
 * play, pause, seek, loop, 2x playbackRate, mute/unmute, and mixer volume/fade changes.
 */
export function attachSyncedAudioController(params: SyncedAudioControllerParams): () => void {
  const {
    videoEl,
    audioEl,
    isActive,
    isMuted,
    audioUrl,
    audioConfig,
    onAudioPlayStateChange,
  } = params;

  if (!videoEl || !audioEl || !audioUrl) {
    if (audioEl) {
      try {
        audioEl.pause();
      } catch {}
    }
    onAudioPlayStateChange?.(false);
    return () => {};
  }

  let disposed = false;

  const musicVolPct = audioConfig?.volume ?? 100;
  const origVolPct = audioConfig?.originalVideoVolume ?? audioConfig?.originalVolume ?? 100;
  const startOffset = audioConfig?.startTime ?? 0;
  const fadeIn = Boolean(audioConfig?.fadeIn);
  const fadeOut = Boolean(audioConfig?.fadeOut);

  const syncState = (forceSeek = false) => {
    if (disposed) return;

    const vols = computeEffectiveVolumes({
      isMuted,
      musicVolumePercent: musicVolPct,
      originalVideoVolumePercent: origVolPct,
      currentTime: videoEl.currentTime || 0,
      duration: videoEl.duration,
      fadeIn,
      fadeOut,
    });

    try {
      videoEl.muted = vols.videoMuted;
      videoEl.volume = vols.videoVolume;
    } catch {}

    try {
      audioEl.muted = isMuted;
      audioEl.volume = vols.audioVolume;
      audioEl.playbackRate = videoEl.playbackRate || 1;
    } catch {}

    const videoCanDriveAudio =
      isActive &&
      vols.shouldPlayAudio &&
      !isMuted &&
      !videoEl.paused &&
      !videoEl.ended &&
      videoEl.readyState >= 2;

    if (!videoCanDriveAudio) {
      if (!audioEl.paused) {
        try {
          audioEl.pause();
        } catch {}
      }
      onAudioPlayStateChange?.(false);
      return;
    }

    const desiredAudioTime = computeDesiredAudioTime({
      videoCurrentTime: videoEl.currentTime || 0,
      startTimeOffset: startOffset,
      audioDuration: audioEl.duration,
    });

    if (forceSeek || Math.abs((audioEl.currentTime || 0) - desiredAudioTime) > 0.35) {
      try {
        if (Number.isFinite(desiredAudioTime)) {
          audioEl.currentTime = desiredAudioTime;
        }
      } catch {}
    }

    if (audioEl.paused) {
      audioEl
        .play()
        .then(() => {
          if (!disposed) {
            onAudioPlayStateChange?.(!audioEl.paused && !isMuted);
          }
        })
        .catch(() => {
          if (!disposed) {
            onAudioPlayStateChange?.(false);
          }
        });
    } else {
      onAudioPlayStateChange?.(true);
    }
  };

  const handleRegularSync = () => syncState(false);
  const handleSeekSync = () => syncState(true);
  const handleAudioEndedOrError = () => {
    if (!disposed) onAudioPlayStateChange?.(false);
  };
  const handleAudioPlaying = () => {
    if (!disposed) {
      onAudioPlayStateChange?.(isActive && !isMuted && !audioEl.paused && !videoEl.paused);
    }
  };

  const videoSyncEvents: (keyof HTMLMediaElementEventMap)[] = [
    'play',
    'playing',
    'pause',
    'waiting',
    'stalled',
    'ended',
    'ratechange',
    'timeupdate',
    'canplay',
    'emptied',
    'error',
  ];
  const videoSeekEvents: (keyof HTMLMediaElementEventMap)[] = ['seeking', 'seeked', 'loadedmetadata'];

  videoSyncEvents.forEach((evt) => videoEl.addEventListener(evt, handleRegularSync));
  videoSeekEvents.forEach((evt) => videoEl.addEventListener(evt, handleSeekSync));

  audioEl.addEventListener('loadedmetadata', handleSeekSync);
  audioEl.addEventListener('playing', handleAudioPlaying);
  audioEl.addEventListener('pause', handleAudioEndedOrError);
  audioEl.addEventListener('ended', handleAudioEndedOrError);
  audioEl.addEventListener('error', handleAudioEndedOrError);

  syncState(true);

  return () => {
    disposed = true;
    videoSyncEvents.forEach((evt) => videoEl.removeEventListener(evt, handleRegularSync));
    videoSeekEvents.forEach((evt) => videoEl.removeEventListener(evt, handleSeekSync));
    audioEl.removeEventListener('loadedmetadata', handleSeekSync);
    audioEl.removeEventListener('playing', handleAudioPlaying);
    audioEl.removeEventListener('pause', handleAudioEndedOrError);
    audioEl.removeEventListener('ended', handleAudioEndedOrError);
    audioEl.removeEventListener('error', handleAudioEndedOrError);
    try {
      audioEl.pause();
    } catch {}
    onAudioPlayStateChange?.(false);
  };
}
