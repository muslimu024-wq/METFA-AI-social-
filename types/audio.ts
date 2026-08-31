export type AudioTrackType = 'original' | 'royalty_free' | 'licensed' | 'sound_effect';

export type SoundEffectCategory =
  | 'transitions'
  | 'cinematic'
  | 'funny'
  | 'nature'
  | 'action'
  | 'notification'
  | 'ambience'
  | 'applause'
  | 'impact'
  | 'other';

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  cover_url: string;
  artwork_url?: string;
  duration: number; // in seconds
  genre: string;
  mood: string;
  track_type: AudioTrackType;
  sfx_category?: SoundEffectCategory;
  
  // Original Sound Metadata
  user_id?: string;
  reel_id?: string;
  creator_username?: string;
  creator_avatar?: string;

  // Licensing & Rights Metadata
  rights_holder?: string;
  license_type: string; // e.g. 'CC-BY 4.0', 'Royalty-Free Commercial', 'Public Domain (CC0)', 'Metfa Creator Sync License'
  license_source: string; // e.g. 'Metfa Sound Studio', 'Free Music Archive', 'Incompetech', 'Universal Rights Catalog'
  attribution_required: boolean;
  attribution_requirements?: string;
  commercial_use_allowed: boolean;
  commercial_usage_allowed?: boolean;
  permitted_territories?: string[] | string;
  permitted_platform_usage?: string;
  monetization_rules?: string;
  territories: string[] | string; // e.g. ['Worldwide'] or 'Worldwide'
  license_start: string; // ISO date string (e.g. '2025-01-01T00:00:00Z')
  license_expiry: string | null; // ISO date string or null for Perpetual
  status: 'active' | 'pending' | 'expired' | 'revoked' | 'restricted';
  active_status?: boolean;

  bpm?: number;
  tags?: string[];
  waveform?: number[];
  playsCount?: number;
  useCount?: number;
  is_saved?: boolean;
  created_at?: string;
}

export interface ReelAudioConfig {
  track?: AudioTrack;
  startTime?: number; // start offset in seconds
  volume?: number; // 0 to 100 or 0 to 1
  originalVolume?: number;
  originalVideoVolume?: number; // 0 to 100
  duration?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
}

export interface CopyrightReport {
  id: string;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  reporterName: string;
  reporterEmail: string;
  copyrightOwner: string;
  infringingUrl?: string;
  reason: string;
  evidence: string;
  status: 'pending' | 'investigating' | 'approved_takedown' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  adminNotes?: string;
}

export type AudioGenre =
  | 'Synthwave'
  | 'Lo-Fi Chill'
  | 'Cyberpunk'
  | 'Cinematic Orchestral'
  | 'Afrobeat'
  | 'Ambient Zen'
  | 'Future Bass'
  | 'Acoustic'
  | 'Electronic'
  | 'Hip-Hop / Trap'
  | 'Pop / Dance'
  | 'Rock / Indie'
  | 'Sound Effects';

export type AudioMood =
  | 'Energetic'
  | 'Relaxed'
  | 'Dark & Moody'
  | 'Inspiring'
  | 'Dreamy'
  | 'Uplifting'
  | 'Dramatic'
  | 'Focus'
  | 'Humorous'
  | 'Suspenseful';

