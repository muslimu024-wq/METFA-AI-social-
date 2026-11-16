import { useEffect, useRef, useState, useCallback } from 'react';

export type VideoReadinessPhase =
  | 'idle'
  | 'loading_metadata'
  | 'buffering'
  | 'ready'
  | 'slow'
  | 'offline'
  | 'error';

export interface VideoPlaybackRecoveryContext {
  reelId: string;
  seriesId?: string;
  partNumber?: number;
  lastPositionSeconds: number;
}

export interface VideoReadinessSnapshot {
  phase: VideoReadinessPhase;
  hasMetadata: boolean;
  isPlayable: boolean;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  context: VideoPlaybackRecoveryContext;
}

export const SLOW_LOAD_TIMEOUT_MS = 7000;
export const MAX_AUTO_RETRIES = 3;

export function getBackoffDelayMs(attempt: number): number {
  const safeAttempt = Math.max(0, Math.min(attempt, 5));
  return Math.min(8000, 1000 * Math.pow(2, safeAttempt));
}

export function isVideoElementReadyForDisplay(video: HTMLVideoElement | null | undefined): boolean {
  if (!video) return false;
  return video.readyState >= 3 && (video.videoWidth > 0 || video.readyState >= 4);
}

export function createInitialReadinessSnapshot(
  context: VideoPlaybackRecoveryContext,
  isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
): VideoReadinessSnapshot {
  return {
    phase: isOnline ? 'loading_metadata' : 'offline',
    hasMetadata: false,
    isPlayable: false,
    retryCount: 0,
    maxRetries: MAX_AUTO_RETRIES,
    errorMessage: null,
    context: {
      reelId: context.reelId,
      seriesId: context.seriesId,
      partNumber: context.partNumber,
      lastPositionSeconds: Math.max(0, context.lastPositionSeconds || 0),
    },
  };
}

/**
 * Pure transition helper for unit-testing genuine HTML5 video readiness & network recovery.
 */
export function reduceVideoReadinessEvent(
  prev: VideoReadinessSnapshot,
  event:
    | { type: 'loadstart' }
    | { type: 'loadedmetadata'; videoWidth?: number; readyState?: number }
    | { type: 'canplay'; videoWidth?: number; readyState?: number }
    | { type: 'playing' }
    | { type: 'waiting' }
    | { type: 'stalled' }
    | { type: 'slow_timeout' }
    | { type: 'offline'; positionSeconds?: number }
    | { type: 'online' }
    | { type: 'error'; message?: string; positionSeconds?: number }
    | { type: 'retry_manual' }
    | { type: 'retry_auto' }
    | { type: 'cancel' }
): VideoReadinessSnapshot {
  const preservePosition = (pos?: number): VideoPlaybackRecoveryContext => ({
    ...prev.context,
    lastPositionSeconds:
      typeof pos === 'number' && Number.isFinite(pos) && pos >= 0
        ? pos
        : prev.context.lastPositionSeconds,
  });

  switch (event.type) {
    case 'loadstart':
      return {
        ...prev,
        phase: 'loading_metadata',
        errorMessage: null,
      };
    case 'loadedmetadata': {
      const canPlayNow =
        (event.readyState ?? 1) >= 3 && ((event.videoWidth ?? 0) > 0 || (event.readyState ?? 0) >= 4);
      return {
        ...prev,
        hasMetadata: true,
        isPlayable: canPlayNow,
        phase: canPlayNow ? 'ready' : 'buffering',
        errorMessage: null,
      };
    }
    case 'canplay': {
      const hasVisualFrame = (event.videoWidth ?? 1) > 0 || (event.readyState ?? 3) >= 3;
      return {
        ...prev,
        hasMetadata: true,
        isPlayable: hasVisualFrame,
        phase: hasVisualFrame ? 'ready' : 'buffering',
        retryCount: 0,
        errorMessage: null,
      };
    }
    case 'playing':
      return {
        ...prev,
        hasMetadata: true,
        isPlayable: true,
        phase: 'ready',
        retryCount: 0,
        errorMessage: null,
      };
    case 'waiting':
    case 'stalled':
      if (prev.phase === 'error' || prev.phase === 'offline') return prev;
      return {
        ...prev,
        phase: prev.hasMetadata ? 'buffering' : 'loading_metadata',
      };
    case 'slow_timeout':
      if (prev.phase === 'ready' || prev.phase === 'error' || prev.phase === 'offline') {
        return prev;
      }
      return {
        ...prev,
        phase: 'slow',
      };
    case 'offline':
      return {
        ...prev,
        phase: 'offline',
        isPlayable: false,
        context: preservePosition(event.positionSeconds),
        errorMessage: 'You appear to be offline.',
      };
    case 'online':
      if (prev.phase !== 'offline') return prev;
      return {
        ...prev,
        phase: prev.hasMetadata ? 'buffering' : 'loading_metadata',
        errorMessage: null,
      };
    case 'error':
      return {
        ...prev,
        phase: 'error',
        isPlayable: false,
        context: preservePosition(event.positionSeconds),
        errorMessage: event.message || 'Unable to load this video right now.',
      };
    case 'retry_auto':
      if (prev.retryCount >= prev.maxRetries) return prev;
      return {
        ...prev,
        retryCount: prev.retryCount + 1,
        phase: 'loading_metadata',
        errorMessage: null,
      };
    case 'retry_manual':
      return {
        ...prev,
        retryCount: 0,
        phase: 'loading_metadata',
        errorMessage: null,
      };
    case 'cancel':
      return {
        ...prev,
        phase: 'idle',
        errorMessage: null,
      };
    default:
      return prev;
  }
}

/**
 * React hook bound to an active HTML5 video element for genuine readiness tracking,
 * 6–8s slow-load UX, offline recovery, and bounded exponential backoff retry.
 */
export function useVideoReadiness(params: {
  videoEl: HTMLVideoElement | null;
  reelId: string;
  seriesId?: string;
  partNumber?: number;
  isActive: boolean;
  onPositionSample?: (positionSeconds: number, durationSeconds?: number) => void;
}) {
  const { videoEl, reelId, seriesId, partNumber, isActive, onPositionSample } = params;

  const [snapshot, setSnapshot] = useState<VideoReadinessSnapshot>(() =>
    createInitialReadinessSnapshot({
      reelId,
      seriesId,
      partNumber,
      lastPositionSeconds: 0,
    })
  );

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleSlowWarning = useCallback(() => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      setSnapshot((prev) => reduceVideoReadinessEvent(prev, { type: 'slow_timeout' }));
    }, SLOW_LOAD_TIMEOUT_MS);
  }, []);

  const triggerReload = useCallback(
    (isManual: boolean) => {
      clearTimers();
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!online) {
        setSnapshot((prev) =>
          reduceVideoReadinessEvent(prev, {
            type: 'offline',
            positionSeconds: videoEl?.currentTime || prev.context.lastPositionSeconds,
          })
        );
        return;
      }

      setSnapshot((prev) =>
        reduceVideoReadinessEvent(prev, { type: isManual ? 'retry_manual' : 'retry_auto' })
      );

      if (videoEl) {
        const savedPos = snapshotRef.current.context.lastPositionSeconds;
        try {
          videoEl.load();
          if (savedPos > 0) {
            const restoreSeek = () => {
              try {
                videoEl.currentTime = savedPos;
              } catch {}
            };
            videoEl.addEventListener('loadedmetadata', restoreSeek, { once: true });
          }
          if (isActive) {
            videoEl.play().catch(() => {});
          }
        } catch {}
      }
      scheduleSlowWarning();
    },
    [clearTimers, isActive, scheduleSlowWarning, videoEl]
  );

  useEffect(() => {
    setSnapshot(
      createInitialReadinessSnapshot({
        reelId,
        seriesId,
        partNumber,
        lastPositionSeconds: 0,
      })
    );
  }, [reelId, seriesId, partNumber]);

  useEffect(() => {
    if (!isActive || !videoEl) {
      clearTimers();
      return;
    }

    if (isVideoElementReadyForDisplay(videoEl)) {
      setSnapshot((prev) =>
        reduceVideoReadinessEvent(prev, {
          type: 'canplay',
          videoWidth: videoEl.videoWidth,
          readyState: videoEl.readyState,
        })
      );
    } else {
      scheduleSlowWarning();
    }

    const onLoadStart = () => {
      setSnapshot((prev) => reduceVideoReadinessEvent(prev, { type: 'loadstart' }));
      scheduleSlowWarning();
    };
    const onLoadedMetadata = () => {
      setSnapshot((prev) =>
        reduceVideoReadinessEvent(prev, {
          type: 'loadedmetadata',
          videoWidth: videoEl.videoWidth,
          readyState: videoEl.readyState,
        })
      );
    };
    const onCanPlay = () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setSnapshot((prev) =>
        reduceVideoReadinessEvent(prev, {
          type: 'canplay',
          videoWidth: videoEl.videoWidth,
          readyState: videoEl.readyState,
        })
      );
    };
    const onPlaying = () => {
      clearTimers();
      setSnapshot((prev) => reduceVideoReadinessEvent(prev, { type: 'playing' }));
    };
    const onWaiting = () => {
      setSnapshot((prev) => reduceVideoReadinessEvent(prev, { type: 'waiting' }));
      scheduleSlowWarning();
    };
    const onStalled = () => {
      setSnapshot((prev) => reduceVideoReadinessEvent(prev, { type: 'stalled' }));
      scheduleSlowWarning();
    };
    const onError = () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      const isOnlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const pos = Number.isFinite(videoEl.currentTime) ? videoEl.currentTime : 0;

      if (!isOnlineNow) {
        setSnapshot((prev) => reduceVideoReadinessEvent(prev, { type: 'offline', positionSeconds: pos }));
        return;
      }

      const code = videoEl.error?.code;
      const msg =
        code === 2
          ? 'Network error interrupted video loading.'
          : code === 3
          ? 'Video decoding issue detected.'
          : code === 4
          ? 'Video format or source could not be loaded.'
          : 'Unable to load this video right now.';

      const currentRetry = snapshotRef.current.retryCount;
      if (currentRetry < MAX_AUTO_RETRIES) {
        const delay = getBackoffDelayMs(currentRetry);
        setSnapshot((prev) => ({
          ...prev,
          context: { ...prev.context, lastPositionSeconds: pos || prev.context.lastPositionSeconds },
          phase: 'buffering',
          errorMessage: msg,
        }));
        retryTimerRef.current = setTimeout(() => {
          triggerReload(false);
        }, delay);
      } else {
        setSnapshot((prev) =>
          reduceVideoReadinessEvent(prev, {
            type: 'error',
            message: msg,
            positionSeconds: pos,
          })
        );
      }
    };
    const onTimeUpdate = () => {
      const pos = videoEl.currentTime || 0;
      const dur = Number.isFinite(videoEl.duration) ? videoEl.duration : undefined;
      if (pos > 0) {
        snapshotRef.current.context.lastPositionSeconds = pos;
        onPositionSample?.(pos, dur);
      }
    };

    const handleOffline = () => {
      clearTimers();
      setSnapshot((prev) =>
        reduceVideoReadinessEvent(prev, {
          type: 'offline',
          positionSeconds: videoEl.currentTime || prev.context.lastPositionSeconds,
        })
      );
    };

    const handleOnline = () => {
      setSnapshot((prev) => reduceVideoReadinessEvent(prev, { type: 'online' }));
      triggerReload(true);
    };

    videoEl.addEventListener('loadstart', onLoadStart);
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    videoEl.addEventListener('canplay', onCanPlay);
    videoEl.addEventListener('playing', onPlaying);
    videoEl.addEventListener('waiting', onWaiting);
    videoEl.addEventListener('stalled', onStalled);
    videoEl.addEventListener('error', onError);
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimers();
      videoEl.removeEventListener('loadstart', onLoadStart);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.removeEventListener('canplay', onCanPlay);
      videoEl.removeEventListener('playing', onPlaying);
      videoEl.removeEventListener('waiting', onWaiting);
      videoEl.removeEventListener('stalled', onStalled);
      videoEl.removeEventListener('error', onError);
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [isActive, videoEl, clearTimers, scheduleSlowWarning, triggerReload, onPositionSample]);

  return {
    snapshot,
    retry: () => triggerReload(true),
    cancelLoading: () => {
      clearTimers();
      setSnapshot((prev) => reduceVideoReadinessEvent(prev, { type: 'cancel' }));
    },
  };
}
