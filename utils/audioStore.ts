import { AudioTrack, CopyrightReport, AudioGenre, AudioMood, SoundEffectCategory } from '../types/audio';

const STORAGE_KEY = 'metfa_audio_tracks_catalog_v2';
const SAVED_SOUNDS_KEY = 'metfa_user_saved_sounds_v1';
const COPYRIGHT_REPORTS_KEY = 'metfa_copyright_reports_v1';

// Initial curated catalog of licensed audio tracks, original sounds, and sound effects
export const DEFAULT_AUDIO_TRACKS: AudioTrack[] = [
  // 1. ROYALTY-FREE MUSIC
  {
    id: 'track_synth_01',
    title: 'Neon Odyssey (Synthwave Drive)',
    artist: 'Metfa Sound Labs',
    audio_url: 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_hum.ogg',
    cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&q=80',
    duration: 142,
    genre: 'Synthwave',
    mood: 'Energetic',
    track_type: 'royalty_free',
    license_type: 'Royalty-Free Commercial',
    license_source: 'Metfa Sound Studio',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: null, // Perpetual
    status: 'active',
    active_status: true,
    bpm: 124,
    tags: ['retro', 'cyber', 'synth', 'driving', 'night', 'for_you'],
    playsCount: 14820,
    useCount: 382,
    waveform: [20, 35, 45, 60, 80, 95, 75, 85, 90, 65, 70, 85, 100, 90, 60, 45, 30, 50, 70, 85, 95, 80, 60, 40, 25],
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'track_lofi_02',
    title: 'Midnight Rain & Warm Coffee',
    artist: 'ChillHop Syndicate',
    audio_url: 'https://actions.google.com/sounds/v1/water/rain_heavy.ogg',
    cover_url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80',
    duration: 168,
    genre: 'Lo-Fi Chill',
    mood: 'Relaxed',
    track_type: 'royalty_free',
    license_type: 'CC-BY 4.0',
    license_source: 'Free Music Archive',
    attribution_required: true,
    attribution_requirements: 'Must credit ChillHop Syndicate in Reel description',
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2024-06-15T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    bpm: 82,
    tags: ['chill', 'study', 'rain', 'relax', 'piano', 'for_you'],
    playsCount: 28450,
    useCount: 719,
    waveform: [15, 25, 40, 45, 50, 55, 60, 65, 55, 50, 45, 50, 60, 55, 45, 40, 35, 45, 50, 45, 40, 35, 30, 20, 15],
    created_at: '2024-06-15T00:00:00.000Z',
  },
  {
    id: 'track_cinema_04',
    title: 'Celestial Awakening (Epic Rise)',
    artist: 'Starlight Ensemble',
    audio_url: 'https://actions.google.com/sounds/v1/weather/wind_arctic_howling.ogg',
    cover_url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&q=80',
    duration: 195,
    genre: 'Cinematic Orchestral',
    mood: 'Inspiring',
    track_type: 'royalty_free',
    license_type: 'Royalty-Free Commercial',
    license_source: 'Incompetech Creative License',
    attribution_required: true,
    attribution_requirements: 'Credit: Starlight Ensemble under RF-Commercial',
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2024-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    bpm: 110,
    tags: ['epic', 'strings', 'trailer', 'space', 'triumph', 'for_you'],
    playsCount: 34120,
    useCount: 914,
    waveform: [10, 15, 20, 30, 45, 55, 65, 75, 85, 95, 100, 100, 90, 80, 70, 60, 50, 65, 80, 90, 95, 80, 60, 35, 15],
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'track_afro_05',
    title: 'Golden Sunset Grooves',
    artist: 'Lagos Rhythm Crew',
    audio_url: 'https://actions.google.com/sounds/v1/crowds/outdoor_festival.ogg',
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
    duration: 154,
    genre: 'Afrobeat',
    mood: 'Uplifting',
    track_type: 'royalty_free',
    license_type: 'CC-BY 4.0',
    license_source: 'Open Sound Project',
    attribution_required: true,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2024-09-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    bpm: 106,
    tags: ['dance', 'percussion', 'summer', 'happy', 'horns'],
    playsCount: 22100,
    useCount: 560,
    waveform: [25, 45, 60, 75, 80, 85, 90, 85, 80, 75, 70, 85, 90, 85, 75, 65, 60, 75, 85, 80, 70, 55, 40, 30, 20],
    created_at: '2024-09-01T00:00:00.000Z',
  },
  {
    id: 'track_ambient_06',
    title: 'Eternal Horizons (Zen Meditation)',
    artist: 'Nirvana Acoustic',
    audio_url: 'https://actions.google.com/sounds/v1/water/ocean_waves.ogg',
    cover_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=800&q=80',
    duration: 210,
    genre: 'Ambient Zen',
    mood: 'Relaxed',
    track_type: 'royalty_free',
    license_type: 'Public Domain (CC0)',
    license_source: 'Creative Commons Free Audio',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2023-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    bpm: 65,
    tags: ['peaceful', 'meditation', 'yoga', 'calm', 'nature'],
    playsCount: 41200,
    useCount: 1104,
    waveform: [10, 15, 20, 25, 30, 35, 40, 45, 40, 35, 30, 35, 40, 35, 30, 25, 20, 25, 30, 25, 20, 15, 12, 10, 8],
    created_at: '2023-01-01T00:00:00.000Z',
  },
  {
    id: 'track_future_07',
    title: 'Hyperdrive Starlight',
    artist: 'HyperDrive X',
    audio_url: 'https://actions.google.com/sounds/v1/science_fiction/teleport.ogg',
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    duration: 130,
    genre: 'Future Bass',
    mood: 'Energetic',
    track_type: 'royalty_free',
    license_type: 'Royalty-Free Commercial',
    license_source: 'Metfa Audio Catalog',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-15T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    bpm: 145,
    tags: ['drop', 'vibrant', 'edm', 'synth', 'hype', 'for_you'],
    playsCount: 17900,
    useCount: 462,
    waveform: [20, 30, 45, 60, 80, 95, 100, 90, 85, 70, 75, 90, 100, 95, 80, 60, 50, 75, 95, 90, 80, 60, 45, 30, 20],
    created_at: '2025-01-15T00:00:00.000Z',
  },

  // 2. LICENSED MUSIC
  {
    id: 'track_licensed_cyber_01',
    title: 'Glitch in the Matrix',
    artist: 'BytePulse',
    audio_url: 'https://actions.google.com/sounds/v1/ambiences/humming_room.ogg',
    cover_url: 'https://images.unsplash.com/photo-1515260268569-9271009adfdb?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1515260268569-9271009adfdb?w=800&q=80',
    duration: 115,
    genre: 'Cyberpunk',
    mood: 'Dark & Moody',
    track_type: 'licensed',
    rights_holder: 'Universal Sync Publishing / BytePulse Music',
    license_type: 'Metfa Creator Sync License',
    license_source: 'Universal Sync Publishing',
    permitted_territories: ['Worldwide'],
    permitted_platform_usage: 'Metfa Social in-app reels, stories, feed posts',
    commercial_usage_allowed: true,
    monetization_rules: 'Creator retains 70% in-app ad revenue split',
    attribution_required: true,
    attribution_requirements: 'Track licensed from Universal Sync. "Glitch in the Matrix" by BytePulse.',
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: '2030-12-31T23:59:59.000Z',
    status: 'active',
    active_status: true,
    bpm: 138,
    tags: ['dystopian', 'future', 'industrial', 'dark', 'bass', 'licensed', 'for_you'],
    playsCount: 9340,
    useCount: 245,
    waveform: [30, 50, 70, 85, 90, 100, 80, 95, 90, 85, 70, 90, 100, 95, 75, 60, 50, 80, 95, 90, 75, 50, 40, 30, 20],
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'track_licensed_cinema_02',
    title: 'Neon Velocity (Official Soundtrack)',
    artist: 'Apex Horizon',
    audio_url: 'https://actions.google.com/sounds/v1/science_fiction/alien_hum.ogg',
    cover_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80',
    duration: 135,
    genre: 'Electronic',
    mood: 'Energetic',
    track_type: 'licensed',
    rights_holder: 'Sony ATV Global / Apex Horizon',
    license_type: 'Commercial Master Sync',
    license_source: 'Sony ATV Master Rights',
    permitted_territories: ['US', 'EU', 'CA', 'JP', 'UK', 'Worldwide'],
    permitted_platform_usage: 'Short-form social video synchronized sync',
    commercial_usage_allowed: true,
    monetization_rules: 'Allowed for verified Metfa creators and brand collaborations',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-02-01T00:00:00.000Z',
    license_expiry: '2029-12-31T23:59:59.000Z',
    status: 'active',
    active_status: true,
    bpm: 128,
    tags: ['speed', 'electronic', 'drive', 'gaming', 'licensed'],
    playsCount: 12100,
    useCount: 310,
    waveform: [25, 40, 55, 70, 85, 95, 90, 80, 70, 85, 95, 100, 90, 75, 60, 45, 60, 75, 90, 85, 70, 55, 40, 30, 20],
    created_at: '2025-02-01T00:00:00.000Z',
  },
  {
    id: 'track_licensed_expired_demo',
    title: 'Vintage Retro 1999 (Expired Sync Archive)',
    artist: 'Vintage Masters Ltd',
    audio_url: 'https://actions.google.com/sounds/v1/foley/cassette_tape_insert.ogg',
    cover_url: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=80',
    duration: 90,
    genre: 'Pop / Dance',
    mood: 'Dramatic',
    track_type: 'licensed',
    rights_holder: 'Vintage Rights Media Group',
    license_type: 'Term-Limited Master Sync',
    license_source: 'Vintage Rights Media',
    permitted_territories: ['Worldwide'],
    permitted_platform_usage: 'Expired license demonstration',
    commercial_usage_allowed: false,
    monetization_rules: 'No monetization permitted',
    attribution_required: true,
    commercial_use_allowed: false,
    territories: ['Worldwide'],
    license_start: '2023-01-01T00:00:00.000Z',
    license_expiry: '2024-01-01T00:00:00.000Z', // Expired!
    status: 'expired',
    active_status: false,
    bpm: 120,
    tags: ['vintage', 'demo', 'expired'],
    playsCount: 520,
    useCount: 12,
    waveform: [10, 20, 30, 40, 30, 20, 10, 20, 30, 40, 50, 40, 30, 20, 10, 10, 20, 30, 20, 10, 10, 10, 5, 5, 5],
    created_at: '2023-01-01T00:00:00.000Z',
  },

  // 3. ORIGINAL SOUNDS
  {
    id: 'original_sound_sarah_01',
    title: 'Original sound — @sarah_vison',
    artist: 'Sarah Jenkins',
    creator_username: 'sarah_vison',
    creator_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
    user_id: 'user_sarah_101',
    reel_id: 'reel_1',
    audio_url: 'https://actions.google.com/sounds/v1/science_fiction/scifi_laser_charging.ogg',
    cover_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
    artwork_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
    duration: 15,
    genre: 'Electronic',
    mood: 'Energetic',
    track_type: 'original',
    license_type: 'Metfa Creator Original Audio',
    license_source: 'Creator Original Upload',
    attribution_required: true,
    attribution_requirements: 'Original sound created by @sarah_vison on Metfa Reels',
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-02-10T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    tags: ['original', 'laser', 'synth', 'viral', 'for_you'],
    playsCount: 42100,
    useCount: 1420,
    waveform: [20, 40, 60, 80, 95, 100, 90, 80, 70, 60, 50, 60, 70, 85, 95, 100, 90, 80, 70, 60, 40, 30, 20, 15, 10],
    created_at: '2025-02-10T14:20:00.000Z',
  },
  {
    id: 'original_sound_cyber_02',
    title: 'Original sound — @alex_tech',
    artist: 'Alex Rivera',
    creator_username: 'alex_tech',
    creator_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    user_id: 'user_alex_102',
    reel_id: 'reel_2',
    audio_url: 'https://actions.google.com/sounds/v1/science_fiction/alien_transmission.ogg',
    cover_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    duration: 18,
    genre: 'Cyberpunk',
    mood: 'Inspiring',
    track_type: 'original',
    license_type: 'Metfa Creator Original Audio',
    license_source: 'Creator Original Upload',
    attribution_required: true,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-02-14T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    tags: ['original', 'cyber', 'tech', 'voiceover', 'for_you'],
    playsCount: 29800,
    useCount: 890,
    waveform: [15, 30, 50, 70, 85, 90, 80, 70, 60, 50, 45, 55, 65, 75, 85, 90, 75, 60, 45, 35, 25, 20, 15, 10, 5],
    created_at: '2025-02-14T10:15:00.000Z',
  },

  // 4. SOUND EFFECTS (SFX)
  {
    id: 'sfx_transition_woosh_01',
    title: 'Cinematic High-Speed Whoosh',
    artist: 'Metfa SFX Studio',
    audio_url: 'https://actions.google.com/sounds/v1/foley/whoosh_fast.ogg',
    cover_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
    duration: 3,
    genre: 'Sound Effects',
    mood: 'Dramatic',
    track_type: 'sound_effect',
    sfx_category: 'transitions',
    license_type: 'Royalty-Free SFX',
    license_source: 'Metfa Sound Design Library',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    tags: ['sfx', 'whoosh', 'transition', 'cinematic', 'fast'],
    playsCount: 65200,
    useCount: 3410,
    waveform: [10, 30, 70, 100, 80, 40, 15, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sfx_impact_boom_02',
    title: 'Deep Sub-Bass Cinema Boom',
    artist: 'Metfa SFX Studio',
    audio_url: 'https://actions.google.com/sounds/v1/science_fiction/teleport_arrival.ogg',
    cover_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80',
    duration: 5,
    genre: 'Sound Effects',
    mood: 'Dramatic',
    track_type: 'sound_effect',
    sfx_category: 'impact',
    license_type: 'Royalty-Free SFX',
    license_source: 'Metfa Sound Design Library',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    tags: ['sfx', 'impact', 'sub', 'bass', 'boom', 'hit'],
    playsCount: 51200,
    useCount: 2890,
    waveform: [90, 100, 85, 70, 55, 40, 30, 20, 15, 10, 5, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sfx_applause_cheer_03',
    title: 'Audience Cheering & Applause',
    artist: 'Metfa SFX Studio',
    audio_url: 'https://actions.google.com/sounds/v1/crowds/outdoor_festival.ogg',
    cover_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80',
    duration: 8,
    genre: 'Sound Effects',
    mood: 'Uplifting',
    track_type: 'sound_effect',
    sfx_category: 'applause',
    license_type: 'Royalty-Free SFX',
    license_source: 'Metfa Sound Design Library',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    tags: ['sfx', 'applause', 'cheer', 'crowd', 'win', 'celebration'],
    playsCount: 38900,
    useCount: 1950,
    waveform: [40, 60, 75, 80, 85, 80, 85, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sfx_funny_boing_04',
    title: 'Cartoon Comedy Boing & Pop',
    artist: 'Metfa SFX Studio',
    audio_url: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg',
    cover_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
    duration: 2,
    genre: 'Sound Effects',
    mood: 'Humorous',
    track_type: 'sound_effect',
    sfx_category: 'funny',
    license_type: 'Royalty-Free SFX',
    license_source: 'Metfa Sound Design Library',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    tags: ['sfx', 'funny', 'comedy', 'boing', 'meme', 'cartoon'],
    playsCount: 44300,
    useCount: 2210,
    waveform: [15, 85, 100, 60, 30, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sfx_nature_thunder_05',
    title: 'Distant Thunder & Forest Rain',
    artist: 'Metfa Nature Audio',
    audio_url: 'https://actions.google.com/sounds/v1/weather/rain_heavy.ogg',
    cover_url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=400&q=80',
    duration: 12,
    genre: 'Sound Effects',
    mood: 'Relaxed',
    track_type: 'sound_effect',
    sfx_category: 'nature',
    license_type: 'Royalty-Free SFX',
    license_source: 'Metfa Sound Design Library',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    tags: ['sfx', 'nature', 'rain', 'thunder', 'ambience'],
    playsCount: 26400,
    useCount: 1140,
    waveform: [20, 30, 40, 50, 70, 90, 100, 85, 60, 45, 35, 40, 45, 50, 45, 40, 35, 30, 25, 20, 15, 10, 8, 5, 2],
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'sfx_notification_chime_06',
    title: 'Holographic UI Bell Notification',
    artist: 'Metfa SFX Studio',
    audio_url: 'https://actions.google.com/sounds/v1/household/doorbell.ogg',
    cover_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&q=80',
    duration: 2,
    genre: 'Sound Effects',
    mood: 'Inspiring',
    track_type: 'sound_effect',
    sfx_category: 'notification',
    license_type: 'Royalty-Free SFX',
    license_source: 'Metfa Sound Design Library',
    attribution_required: false,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: '2025-01-01T00:00:00.000Z',
    license_expiry: null,
    status: 'active',
    active_status: true,
    tags: ['sfx', 'notification', 'bell', 'ui', 'ping'],
    playsCount: 31000,
    useCount: 1620,
    waveform: [70, 95, 80, 50, 25, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    created_at: '2025-01-01T00:00:00.000Z',
  },
];

/**
 * Retrieve all audio tracks from persistent store or default catalog
 */
export const getAudioTracks = (): AudioTrack[] => {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_TRACKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AUDIO_TRACKS));
      return DEFAULT_AUDIO_TRACKS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_AUDIO_TRACKS;
  } catch (err) {
    console.error('Failed to load audio tracks from localStorage:', err);
    return DEFAULT_AUDIO_TRACKS;
  }
};

/**
 * Save audio tracks array to persistence
 */
export const saveAudioTracks = (tracks: AudioTrack[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
  } catch (err) {
    console.error('Failed to save audio tracks:', err);
  }
};

/**
 * Find track by its unique ID
 */
export const getAudioTrackById = (id: string): AudioTrack | undefined => {
  const tracks = getAudioTracks();
  return tracks.find((t) => t.id === id);
};

/**
 * Search & filter tracks across categories (for_you, original, royalty_free, licensed, sound_effect, saved)
 */
export const searchAudioTracks = (params: {
  category?: 'for_you' | 'original' | 'royalty_free' | 'licensed' | 'sound_effect' | 'saved';
  query?: string;
  genre?: string;
  mood?: string;
  sfxCategory?: string;
  commercialOnly?: boolean;
  status?: string;
  userId?: string;
}): AudioTrack[] => {
  const allTracks = getAudioTracks();
  const q = (params.query || '').trim().toLowerCase();
  const category = params.category || 'for_you';
  const genre = params.genre || 'all';
  const mood = params.mood || 'all';
  const sfxCategory = params.sfxCategory || 'all';
  const status = params.status || 'all';
  const commercialOnly = params.commercialOnly ?? false;
  const savedIds = params.userId ? getSavedSoundIds(params.userId) : [];

  return allTracks.filter((t) => {
    // 1. Category Filter
    if (category === 'for_you') {
      // Show curated high-engagement tracks or trending sounds
    } else if (category === 'original') {
      if (t.track_type !== 'original') return false;
    } else if (category === 'royalty_free') {
      if (t.track_type !== 'royalty_free') return false;
    } else if (category === 'licensed') {
      if (t.track_type !== 'licensed') return false;
    } else if (category === 'sound_effect') {
      if (t.track_type !== 'sound_effect') return false;
      if (sfxCategory !== 'all' && t.sfx_category !== sfxCategory) return false;
    } else if (category === 'saved') {
      if (!savedIds.includes(t.id)) return false;
    }

    // 2. Status filter
    if (status !== 'all' && t.status !== status) return false;

    // 3. Commercial filter
    if (commercialOnly && !t.commercial_use_allowed) return false;

    // 4. Genre filter
    if (genre !== 'all' && t.genre.toLowerCase() !== genre.toLowerCase()) return false;

    // 5. Mood filter
    if (mood !== 'all' && t.mood.toLowerCase() !== mood.toLowerCase()) return false;

    // 6. Search query filter (title, artist, genre, mood, creator username, tags, sfx category)
    if (q) {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchArtist = t.artist.toLowerCase().includes(q);
      const matchGenre = t.genre.toLowerCase().includes(q);
      const matchMood = t.mood.toLowerCase().includes(q);
      const matchCreator = t.creator_username?.toLowerCase().includes(q) ?? false;
      const matchLicense = t.license_type.toLowerCase().includes(q);
      const matchSfx = t.sfx_category?.toLowerCase().includes(q) ?? false;
      const matchTags = t.tags?.some((tag) => tag.toLowerCase().includes(q)) ?? false;
      return (
        matchTitle ||
        matchArtist ||
        matchGenre ||
        matchMood ||
        matchCreator ||
        matchLicense ||
        matchSfx ||
        matchTags
      );
    }

    return true;
  });
};

/**
 * Check if a track can be selected for creating a NEW Reel.
 * Expired, revoked, or inactive tracks are strictly blocked from selection.
 */
export const verifyTrackSelectionAllowed = (track: AudioTrack): {
  canSelect: boolean;
  reason?: string;
} => {
  if (track.status === 'expired') {
    return {
      canSelect: false,
      reason: 'This licensed audio track has expired and cannot be attached to new Reels.',
    };
  }
  if (track.status === 'revoked') {
    return {
      canSelect: false,
      reason: 'This audio license was revoked and is restricted from new creations.',
    };
  }
  if (track.status === 'restricted') {
    return {
      canSelect: false,
      reason: 'This track has restricted territorial or platform clearance.',
    };
  }
  if (track.license_expiry) {
    const expiry = new Date(track.license_expiry);
    if (!isNaN(expiry.getTime()) && expiry <= new Date()) {
      return {
        canSelect: false,
        reason: `License expired on ${expiry.toLocaleDateString()}. Cannot be selected for new Reels.`,
      };
    }
  }

  return { canSelect: true };
};

/**
 * Add a new licensed audio track to the catalog
 */
export const addAudioTrack = (trackData: Omit<AudioTrack, 'id'> & { id?: string }): AudioTrack => {
  const tracks = getAudioTracks();
  const newTrack: AudioTrack = {
    ...trackData,
    id: trackData.id || `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    playsCount: trackData.playsCount || 0,
    useCount: trackData.useCount || 0,
    status: trackData.status || 'active',
    active_status: trackData.active_status ?? true,
    waveform: trackData.waveform || Array.from({ length: 25 }, () => Math.floor(Math.random() * 80) + 20),
    created_at: trackData.created_at || new Date().toISOString(),
  };

  const updated = [newTrack, ...tracks];
  saveAudioTracks(updated);
  return newTrack;
};

/**
 * Automatically create an Original Sound record when a user uploads/creates a Reel with original audio
 */
export const createOriginalSoundRecord = (params: {
  userId: string;
  username: string;
  userAvatar: string;
  reelId: string;
  audioUrl?: string;
  videoSrc?: string;
  title?: string;
  duration?: number;
}): AudioTrack => {
  const tracks = getAudioTracks();
  
  // Check if original sound for this reel already exists
  const existing = tracks.find((t) => t.reel_id === params.reelId && t.track_type === 'original');
  if (existing) return existing;

  const originalSoundTitle = params.title || `Original sound — @${params.username.replace('@', '')}`;
  const audioSource = params.audioUrl || params.videoSrc || 'https://actions.google.com/sounds/v1/science_fiction/scifi_engine_hum.ogg';

  const newOriginalSound: AudioTrack = {
    id: `orig_sound_${params.reelId}_${Date.now()}`,
    title: originalSoundTitle,
    artist: `@${params.username.replace('@', '')}`,
    creator_username: params.username.replace('@', ''),
    creator_avatar: params.userAvatar,
    user_id: params.userId,
    reel_id: params.reelId,
    audio_url: audioSource,
    cover_url: params.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
    duration: params.duration || 15,
    genre: 'Sound Effects',
    mood: 'Energetic',
    track_type: 'original',
    license_type: 'Metfa Creator Original Sound',
    license_source: 'Metfa Reels Original Audio',
    attribution_required: true,
    attribution_requirements: `Original audio recorded by @${params.username.replace('@', '')}`,
    commercial_use_allowed: true,
    territories: ['Worldwide'],
    license_start: new Date().toISOString(),
    license_expiry: null,
    status: 'active',
    active_status: true,
    playsCount: 1,
    useCount: 1,
    tags: ['original', 'reel', params.username.replace('@', '')],
    waveform: Array.from({ length: 25 }, () => Math.floor(Math.random() * 70) + 30),
    created_at: new Date().toISOString(),
  };

  const updated = [newOriginalSound, ...tracks];
  saveAudioTracks(updated);
  return newOriginalSound;
};

/**
 * Update an existing track's metadata or licensing terms (Admin or Owner)
 */
export const updateAudioTrack = (id: string, updates: Partial<AudioTrack>): AudioTrack | null => {
  const tracks = getAudioTracks();
  const index = tracks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  tracks[index] = {
    ...tracks[index],
    ...updates,
  };

  saveAudioTracks(tracks);
  return tracks[index];
};

/**
 * Delete a track from catalog
 */
export const deleteAudioTrack = (id: string): boolean => {
  const tracks = getAudioTracks();
  const filtered = tracks.filter((t) => t.id !== id);
  if (filtered.length === tracks.length) return false;
  saveAudioTracks(filtered);
  return true;
};

/**
 * Increment use counter when a creator attaches the track to a post or reel
 */
export const recordTrackUsage = (id: string): void => {
  const tracks = getAudioTracks();
  const track = tracks.find((t) => t.id === id);
  if (track) {
    track.useCount = (track.useCount || 0) + 1;
    saveAudioTracks(tracks);
  }
};

/**
 * ============================================================================
 * SAVED SOUNDS SYSTEM
 * ============================================================================
 */
export const getSavedSoundIds = (userId: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${SAVED_SOUNDS_KEY}_${userId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const isSoundSaved = (userId: string, trackId: string): boolean => {
  const ids = getSavedSoundIds(userId);
  return ids.includes(trackId);
};

export const toggleSaveSound = (userId: string, trackId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const ids = getSavedSoundIds(userId);
    let updated: string[];
    let isNowSaved = false;

    if (ids.includes(trackId)) {
      updated = ids.filter((id) => id !== trackId);
      isNowSaved = false;
    } else {
      updated = [trackId, ...ids];
      isNowSaved = true;
    }

    localStorage.setItem(`${SAVED_SOUNDS_KEY}_${userId}`, JSON.stringify(updated));
    return isNowSaved;
  } catch (err) {
    console.error('Failed to toggle sound save:', err);
    return false;
  }
};

/**
 * ============================================================================
 * COPYRIGHT TAKEDOWN & COMPLAINTS SYSTEM
 * ============================================================================
 */
export const getCopyrightReports = (): CopyrightReport[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COPYRIGHT_REPORTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const submitCopyrightReport = (report: Omit<CopyrightReport, 'id' | 'createdAt' | 'status'>): CopyrightReport => {
  const reports = getCopyrightReports();
  const newReport: CopyrightReport = {
    ...report,
    id: `dmca_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const updated = [newReport, ...reports];
  if (typeof window !== 'undefined') {
    localStorage.setItem(COPYRIGHT_REPORTS_KEY, JSON.stringify(updated));
  }
  return newReport;
};

export const resolveCopyrightReport = (
  reportId: string,
  resolution: 'approved_takedown' | 'rejected',
  adminNotes?: string
): CopyrightReport | null => {
  const reports = getCopyrightReports();
  const report = reports.find((r) => r.id === reportId);
  if (!report) return null;

  report.status = resolution;
  report.resolvedAt = new Date().toISOString();
  report.adminNotes = adminNotes;

  if (resolution === 'approved_takedown') {
    // Revoke or deactivate track
    updateAudioTrack(report.trackId, { status: 'revoked', active_status: false });
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(COPYRIGHT_REPORTS_KEY, JSON.stringify(reports));
  }
  return report;
};

/**
 * Helper to format duration seconds to mm:ss
 */
export const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * Check if the track's license is active and valid right now
 */
export const verifyTrackLicense = (track: AudioTrack): {
  isValid: boolean;
  isExpired: boolean;
  isCommercial: boolean;
  attributionString: string;
  territoriesDisplay: string;
  statusBadge: { text: string; bg: string; textCol: string };
} => {
  const now = new Date();
  const startDate = new Date(track.license_start);
  const isStarted = isNaN(startDate.getTime()) || startDate <= now;
  const isExpired = track.license_expiry ? new Date(track.license_expiry) <= now : false;
  const isValid = track.status === 'active' && isStarted && !isExpired;

  const territoriesDisplay = Array.isArray(track.territories)
    ? track.territories.join(', ')
    : track.territories || 'Worldwide';

  const attributionString = track.attribution_required
    ? `Music: "${track.title}" by ${track.artist} (${track.license_source}) licensed under ${track.license_type}.`
    : `Music: "${track.title}" by ${track.artist} (${track.license_type} - No attribution required).`;

  let statusBadge = {
    text: 'Active License',
    bg: 'bg-teal-950/80 border-teal-500/40 text-teal-300',
    textCol: 'text-teal-400',
  };

  if (track.status === 'expired' || isExpired) {
    statusBadge = {
      text: 'License Expired',
      bg: 'bg-rose-950/80 border-rose-500/40 text-rose-300',
      textCol: 'text-rose-400',
    };
  } else if (track.status === 'restricted') {
    statusBadge = {
      text: 'Restricted Rights',
      bg: 'bg-amber-950/80 border-amber-500/40 text-amber-300',
      textCol: 'text-amber-400',
    };
  } else if (track.status === 'pending') {
    statusBadge = {
      text: 'Pending Clearance',
      bg: 'bg-purple-950/80 border-purple-500/40 text-purple-300',
      textCol: 'text-purple-400',
    };
  } else if (track.status === 'revoked') {
    statusBadge = {
      text: 'License Revoked',
      bg: 'bg-red-950/80 border-red-500/40 text-red-300',
      textCol: 'text-red-400',
    };
  }

  return {
    isValid,
    isExpired,
    isCommercial: track.commercial_use_allowed,
    attributionString,
    territoriesDisplay,
    statusBadge,
  };
};
