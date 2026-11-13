/**
 * METFA SOCIAL — Video Watch Tracker & Analytics Client
 * 
 * Provides production-grade, real-time client watch telemetry for videos & reels.
 * Accurately measures playback duration without fabrication or simulated intervals.
 */

import { VideoAnalyticsSummary, CreatorInsightsSummary } from '../services/videoAnalyticsEngine';

export interface VideoSessionPayload {
  videoId: string;
  videoType: 'reel' | 'post_video' | 'premium_content';
  creatorId: string;
  viewerId?: string | null;
  watchDurationSeconds: number;
  videoDurationSeconds: number;
  playbackSpeed: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  startedAt: string;
  endedAt: string;
}

export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined' || !window.navigator) return 'desktop';
  const ua = window.navigator.userAgent.toLowerCase();
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua);
  if (isTablet) return 'tablet';
  const isMobile = /(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo ds)/.test(ua) || window.innerWidth < 768;
  if (isMobile) return 'mobile';
  return 'desktop';
}

/**
 * Sends a real-time watch session heartbeat to the server
 */
export async function sendVideoWatchSession(payload: VideoSessionPayload): Promise<boolean> {
  // Discard meaningless micro-glitches (< 0.5 seconds)
  if (payload.watchDurationSeconds < 0.5) return false;

  const body = JSON.stringify(payload);

  // 1. If page is unloading/navigating away, prefer sendBeacon with blob
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/analytics/video-session', blob);
      if (sent) {
        // Also trigger local integration bridge for real-time reactivity
        dispatchLocalBridgeEvent(payload);
        return true;
      }
    } catch {}
  }

  // 2. Standard fetch with keepalive
  try {
    const res = await fetch('/api/analytics/video-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });

    if (res.ok) {
      dispatchLocalBridgeEvent(payload);
      return true;
    }
  } catch (err) {
    console.warn('[VideoTracker] Telemetry delivery caught non-blocking error:', err);
  }

  return false;
}

/**
 * Dispatches local event for v2IntegrationAdapter
 */
function dispatchLocalBridgeEvent(payload: VideoSessionPayload) {
  if (typeof window === 'undefined') return;
  try {
    const completionRatio = Math.min(1.0, payload.watchDurationSeconds / Math.max(1, payload.videoDurationSeconds));
    window.dispatchEvent(
      new CustomEvent('metfa_reel_watched', {
        detail: {
          viewerUserId: payload.viewerId || 'anonymous_viewer',
          creatorId: payload.creatorId,
          reelId: payload.videoId,
          watchDurationSeconds: payload.watchDurationSeconds,
          completionRatio,
          playbackSpeedRatio: payload.playbackSpeed,
        },
      })
    );
  } catch {}
}

/**
 * Fetches real analytics for a specific video
 */
export async function fetchVideoAnalytics(videoId: string): Promise<VideoAnalyticsSummary | null> {
  try {
    const res = await fetch(`/api/analytics/video/${encodeURIComponent(videoId)}`);
    if (res.ok) {
      const data = await res.json();
      return data.analytics || null;
    }
  } catch (err) {
    console.warn('[VideoTracker] Failed to fetch video analytics:', err);
  }
  return null;
}

/**
 * Fetches real aggregated insights for a creator
 */
export async function fetchCreatorInsights(creatorId: string): Promise<CreatorInsightsSummary | null> {
  try {
    const res = await fetch(`/api/analytics/creator/${encodeURIComponent(creatorId)}`);
    if (res.ok) {
      const data = await res.json();
      return data.insights || null;
    }
  } catch (err) {
    console.warn('[VideoTracker] Failed to fetch creator insights:', err);
  }
  return null;
}

/**
 * Class-based active session tracker attached to an HTMLVideoElement
 */
export class VideoPlaybackSessionTracker {
  private videoEl: HTMLVideoElement | null = null;
  private videoId: string;
  private videoType: 'reel' | 'post_video' | 'premium_content';
  private creatorId: string;
  private viewerId?: string | null;

  private isTracking = false;
  private accumulatedWatchSeconds = 0;
  private lastPlayTimestamp: number | null = null;
  private sessionStartedAt: string | null = null;

  constructor(config: {
    videoId: string;
    videoType: 'reel' | 'post_video' | 'premium_content';
    creatorId: string;
    viewerId?: string | null;
  }) {
    this.videoId = config.videoId;
    this.videoType = config.videoType;
    this.creatorId = config.creatorId;
    this.viewerId = config.viewerId;
  }

  public attach(videoElement: HTMLVideoElement | null): void {
    if (this.videoEl === videoElement) return;
    this.detach();
    if (!videoElement) return;

    this.videoEl = videoElement;
    this.isTracking = true;

    this.videoEl.addEventListener('play', this.handlePlay);
    this.videoEl.addEventListener('pause', this.handlePause);
    this.videoEl.addEventListener('ended', this.handleEnded);
    this.videoEl.addEventListener('seeking', this.handleSeeking);
    this.videoEl.addEventListener('seeked', this.handleSeeked);

    // If already playing when attached
    if (!this.videoEl.paused && !this.videoEl.seeking) {
      this.handlePlay();
    }
  }

  public detach(): void {
    if (!this.videoEl) return;
    this.flush();

    this.videoEl.removeEventListener('play', this.handlePlay);
    this.videoEl.removeEventListener('pause', this.handlePause);
    this.videoEl.removeEventListener('ended', this.handleEnded);
    this.videoEl.removeEventListener('seeking', this.handleSeeking);
    this.videoEl.removeEventListener('seeked', this.handleSeeked);

    this.videoEl = null;
    this.isTracking = false;
  }

  private handlePlay = (): void => {
    if (!this.sessionStartedAt) {
      this.sessionStartedAt = new Date().toISOString();
    }
    this.lastPlayTimestamp = performance.now();
  };

  private handlePause = (): void => {
    this.accumulateCurrentSegment();
  };

  private handleEnded = (): void => {
    this.accumulateCurrentSegment();
    this.flush();
  };

  private handleSeeking = (): void => {
    this.accumulateCurrentSegment();
  };

  private handleSeeked = (): void => {
    if (this.videoEl && !this.videoEl.paused) {
      this.lastPlayTimestamp = performance.now();
    }
  };

  private accumulateCurrentSegment(): void {
    if (this.lastPlayTimestamp !== null) {
      const now = performance.now();
      const elapsedSeconds = (now - this.lastPlayTimestamp) / 1000;
      if (elapsedSeconds > 0 && elapsedSeconds < 3600) {
        this.accumulatedWatchSeconds += elapsedSeconds;
      }
      this.lastPlayTimestamp = null;
    }
  }

  public flush(): void {
    this.accumulateCurrentSegment();

    const duration = this.accumulatedWatchSeconds;
    const videoDuration = this.videoEl?.duration || 0;

    // Only transmit if >= 0.5s of real playback occurred
    if (duration >= 0.5 && videoDuration > 0) {
      const playbackSpeed = this.videoEl?.playbackRate || 1.0;
      const deviceType = detectDeviceType();
      const startedAt = this.sessionStartedAt || new Date(Date.now() - duration * 1000).toISOString();
      const endedAt = new Date().toISOString();

      sendVideoWatchSession({
        videoId: this.videoId,
        videoType: this.videoType,
        creatorId: this.creatorId,
        viewerId: this.viewerId,
        watchDurationSeconds: Math.round(duration * 10) / 10,
        videoDurationSeconds: Math.round(videoDuration * 10) / 10,
        playbackSpeed,
        deviceType,
        startedAt,
        endedAt,
      });
    }

    // Reset session
    this.accumulatedWatchSeconds = 0;
    this.lastPlayTimestamp = null;
    this.sessionStartedAt = null;
  }
}
