import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  Plus,
  Music,
  FileAudio,
  Radio,
  Trash2,
  Edit,
  CheckCircle,
  AlertCircle,
  Clock,
  Globe,
  DollarSign,
  Search,
  Filter,
  Check,
  Flag,
  ShieldCheck,
} from 'lucide-react';
import { AudioTrack, AudioTrackType, SoundEffectCategory, CopyrightReport, AudioGenre, AudioMood } from '../types/audio';
import {
  getAudioTracks,
  addAudioTrack,
  updateAudioTrack,
  deleteAudioTrack,
  getCopyrightReports,
  resolveCopyrightReport,
  formatDuration,
} from '../utils/audioStore';

interface AdminAudioManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackUpdated?: () => void;
}

export const AdminAudioManagementModal: React.FC<AdminAudioManagementModalProps> = ({
  isOpen,
  onClose,
  onTrackUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'add' | 'reports'>('catalog');
  const [tracks, setTracks] = useState<AudioTrack[]>(() => getAudioTracks());
  const [reports, setReports] = useState<CopyrightReport[]>(() => getCopyrightReports());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form State for Adding/Editing Track
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [trackType, setTrackType] = useState<AudioTrackType>('royalty_free');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioUrl, setAudioUrl] = useState('https://actions.google.com/sounds/v1/science_fiction/scifi_engine_hum.ogg');
  const [coverUrl, setCoverUrl] = useState('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80');
  const [duration, setDuration] = useState(120);
  const [genre, setGenre] = useState<string>('Synthwave');
  const [mood, setMood] = useState<string>('Energetic');
  const [sfxCategory, setSfxCategory] = useState<SoundEffectCategory>('transitions');
  const [rightsHolder, setRightsHolder] = useState('');
  const [licenseType, setLicenseType] = useState('Royalty-Free Commercial');
  const [licenseSource, setLicenseSource] = useState('Metfa Sound Studio');
  const [attributionRequired, setAttributionRequired] = useState(false);
  const [attributionRequirements, setAttributionRequirements] = useState('');
  const [commercialUseAllowed, setCommercialUseAllowed] = useState(true);
  const [permittedTerritories, setPermittedTerritories] = useState('Worldwide');
  const [permittedPlatformUsage, setPermittedPlatformUsage] = useState('Metfa Social In-App Reels & Posts');
  const [monetizationRules, setMonetizationRules] = useState('Full monetization allowed for creators');
  const [licenseStart, setLicenseStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [status, setStatus] = useState<AudioTrack['status']>('active');

  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const refreshData = () => {
    setTracks(getAudioTracks());
    setReports(getCopyrightReports());
    onTrackUpdated?.();
  };

  const handleStartEdit = (track: AudioTrack) => {
    setEditingTrackId(track.id);
    setTrackType(track.track_type);
    setTitle(track.title);
    setArtist(track.artist);
    setAudioUrl(track.audio_url);
    setCoverUrl(track.cover_url);
    setDuration(track.duration);
    setGenre(track.genre);
    setMood(track.mood);
    setSfxCategory(track.sfx_category || 'transitions');
    setRightsHolder(track.rights_holder || '');
    setLicenseType(track.license_type);
    setLicenseSource(track.license_source);
    setAttributionRequired(track.attribution_required);
    setAttributionRequirements(track.attribution_requirements || '');
    setCommercialUseAllowed(track.commercial_use_allowed);
    setPermittedTerritories(Array.isArray(track.territories) ? track.territories.join(', ') : track.territories || 'Worldwide');
    setPermittedPlatformUsage(track.permitted_platform_usage || '');
    setMonetizationRules(track.monetization_rules || '');
    setLicenseStart(track.license_start ? track.license_start.split('T')[0] : '');
    setLicenseExpiry(track.license_expiry ? track.license_expiry.split('T')[0] : '');
    setStatus(track.status);
    setActiveTab('add');
  };

  const handleResetForm = () => {
    setEditingTrackId(null);
    setTitle('');
    setArtist('');
    setRightsHolder('');
    setLicenseExpiry('');
    setStatus('active');
  };

  const handleSaveTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim() || !audioUrl.trim()) return;

    const trackPayload: Partial<AudioTrack> = {
      title: title.trim(),
      artist: artist.trim(),
      audio_url: audioUrl.trim(),
      cover_url: coverUrl.trim() || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      duration: Number(duration) || 30,
      genre,
      mood,
      track_type: trackType,
      sfx_category: trackType === 'sound_effect' ? sfxCategory : undefined,
      rights_holder: rightsHolder.trim() || undefined,
      license_type: licenseType,
      license_source: licenseSource.trim() || 'Metfa Audio Catalog',
      attribution_required: attributionRequired,
      attribution_requirements: attributionRequirements.trim() || undefined,
      commercial_use_allowed: commercialUseAllowed,
      territories: permittedTerritories.split(',').map((s) => s.trim()),
      permitted_platform_usage: permittedPlatformUsage,
      monetization_rules: monetizationRules,
      license_start: licenseStart ? new Date(licenseStart).toISOString() : new Date().toISOString(),
      license_expiry: licenseExpiry ? new Date(licenseExpiry).toISOString() : null,
      status,
      active_status: status === 'active',
    };

    if (editingTrackId) {
      updateAudioTrack(editingTrackId, trackPayload);
      showNotification(`Track "${title}" updated successfully`);
    } else {
      addAudioTrack(trackPayload as any);
      showNotification(`Track "${title}" added to METFA Catalog`);
    }

    refreshData();
    handleResetForm();
    setActiveTab('catalog');
  };

  const handleToggleStatus = (track: AudioTrack) => {
    const nextStatus = track.status === 'active' ? 'restricted' : 'active';
    updateAudioTrack(track.id, { status: nextStatus, active_status: nextStatus === 'active' });
    refreshData();
    showNotification(`Track status updated to ${nextStatus}`);
  };

  const handleDeleteTrack = (id: string, trackTitle: string) => {
    if (window.confirm(`Are you sure you want to remove "${trackTitle}" from the library?`)) {
      deleteAudioTrack(id);
      refreshData();
      showNotification(`Track "${trackTitle}" removed.`);
    }
  };

  const handleResolveReport = (reportId: string, resolution: 'approved_takedown' | 'rejected') => {
    resolveCopyrightReport(reportId, resolution, 'Reviewed by Admin Team');
    refreshData();
    showNotification(
      resolution === 'approved_takedown'
        ? 'Takedown approved: Audio track has been revoked from library.'
        : 'Report rejected.'
    );
  };

  const filteredTracks = tracks.filter((t) => {
    if (typeFilter !== 'all' && t.track_type !== typeFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.license_type.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-purple-500/40 rounded-3xl max-w-4xl w-full p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-lg shadow-purple-600/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Metfa Audio Rights & Admin Console</h3>
                <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/50 text-purple-300 text-[10px] font-mono font-bold">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Manage Royalty-Free Music, Licensed Master Rights, Sound Effects, and DMCA Takedown Queue
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification banner */}
        {notification && (
          <div className="my-2 p-2.5 rounded-xl bg-teal-950/80 border border-teal-500/50 text-teal-300 text-xs flex items-center gap-2 animate-fadeIn shrink-0">
            <CheckCircle className="w-4 h-4 text-teal-400" />
            <span>{notification}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-3 pb-2 border-b border-gray-800 text-xs shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('catalog');
              handleResetForm();
            }}
            className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'catalog'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-800/80 text-gray-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Master Catalog ({tracks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-800/80 text-gray-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingTrackId ? 'Edit Track Terms' : 'Add New Track / SFX'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-gray-800/80 text-gray-400 hover:text-white'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>
              DMCA Takedown Queue ({reports.filter((r) => r.status === 'pending').length})
            </span>
          </button>
        </div>

        {/* Tab 1: Catalog View */}
        {activeTab === 'catalog' && (
          <div className="flex-1 overflow-hidden flex flex-col pt-3 space-y-3">
            {/* Search and Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, artist, rights..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none"
                >
                  <option value="all">All Audio Types</option>
                  <option value="royalty_free">Royalty-Free</option>
                  <option value="licensed">Licensed Music</option>
                  <option value="sound_effect">Sound Effects</option>
                  <option value="original">Original Sounds</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Clearance</option>
                  <option value="expired">Expired</option>
                  <option value="restricted">Restricted</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </div>

            {/* Table / List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  className="p-3 bg-gray-950/70 border border-gray-800 hover:border-purple-500/40 rounded-2xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={track.cover_url}
                      alt={track.title}
                      className="w-11 h-11 rounded-xl object-cover border border-purple-500/30 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white truncate">{track.title}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            track.track_type === 'licensed'
                              ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                              : track.track_type === 'sound_effect'
                              ? 'bg-teal-950 text-teal-300 border border-teal-500/40'
                              : track.track_type === 'original'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-950 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {track.track_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-300 truncate font-mono">
                        {track.artist} • {track.genre} • {formatDuration(track.duration)}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        License: {track.license_type} ({track.license_source})
                        {track.license_expiry && ` • Exp: ${new Date(track.license_expiry).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        track.status === 'active'
                          ? 'bg-teal-950 text-teal-400 border border-teal-500/40'
                          : track.status === 'expired'
                          ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                          : 'bg-amber-950 text-amber-400 border border-amber-500/40'
                      }`}
                    >
                      {track.status.toUpperCase()}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(track)}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-[10px] font-bold transition"
                    >
                      {track.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(track)}
                      className="p-1.5 bg-gray-800 hover:bg-purple-900/50 text-gray-300 hover:text-purple-300 rounded-lg transition"
                      title="Edit Track"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteTrack(track.id, track.title)}
                      className="p-1.5 bg-gray-800 hover:bg-rose-950 text-gray-300 hover:text-rose-400 rounded-lg transition"
                      title="Delete Track"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Add / Edit Track Form */}
        {activeTab === 'add' && (
          <form onSubmit={handleSaveTrack} className="flex-1 overflow-y-auto pr-1 pt-3 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Track Type */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Audio Track Category</label>
                <select
                  value={trackType}
                  onChange={(e) => setTrackType(e.target.value as AudioTrackType)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="royalty_free">METFA Royalty-Free Music Library</option>
                  <option value="licensed">Licensed Commercial Music</option>
                  <option value="sound_effect">Sound Effect (SFX)</option>
                  <option value="original">Original Sound Record</option>
                </select>
              </div>

              {/* SFX Category if SFX */}
              {trackType === 'sound_effect' && (
                <div>
                  <label className="text-gray-300 font-bold block mb-1">SFX Subcategory</label>
                  <select
                    value={sfxCategory}
                    onChange={(e) => setSfxCategory(e.target.value as SoundEffectCategory)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="transitions">Transitions</option>
                    <option value="cinematic">Cinematic</option>
                    <option value="funny">Funny / Comedy</option>
                    <option value="nature">Nature / Weather</option>
                    <option value="action">Action</option>
                    <option value="notification">Notification / UI</option>
                    <option value="ambience">Ambience</option>
                    <option value="applause">Applause / Crowd</option>
                    <option value="impact">Impact / Boom</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Track Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cyber Sunrise (Master Mix)"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Artist / Creator */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Artist / Composer / Creator *</label>
                <input
                  type="text"
                  required
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Metfa Sound Labs"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Audio URL */}
              <div className="md:col-span-2">
                <label className="text-gray-300 font-bold block mb-1">Audio Stream Source URL (.mp3 / .ogg / .wav) *</label>
                <input
                  type="url"
                  required
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Cover Artwork URL */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Artwork / Cover Image URL</label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Duration (Seconds)</label>
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Genre */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Synthwave">Synthwave</option>
                  <option value="Lo-Fi Chill">Lo-Fi Chill</option>
                  <option value="Cyberpunk">Cyberpunk</option>
                  <option value="Cinematic Orchestral">Cinematic Orchestral</option>
                  <option value="Afrobeat">Afrobeat</option>
                  <option value="Ambient Zen">Ambient Zen</option>
                  <option value="Future Bass">Future Bass</option>
                  <option value="Acoustic">Acoustic</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Hip-Hop / Trap">Hip-Hop / Trap</option>
                  <option value="Sound Effects">Sound Effects</option>
                </select>
              </div>

              {/* Mood */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Mood</label>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Energetic">Energetic</option>
                  <option value="Relaxed">Relaxed</option>
                  <option value="Dark & Moody">Dark & Moody</option>
                  <option value="Inspiring">Inspiring</option>
                  <option value="Dreamy">Dreamy</option>
                  <option value="Uplifting">Uplifting</option>
                  <option value="Dramatic">Dramatic</option>
                  <option value="Focus">Focus</option>
                  <option value="Humorous">Humorous</option>
                </select>
              </div>

              {/* Rights Holder (if licensed) */}
              {trackType === 'licensed' && (
                <div>
                  <label className="text-gray-300 font-bold block mb-1">Rights Holder / Publishing Label</label>
                  <input
                    type="text"
                    value={rightsHolder}
                    onChange={(e) => setRightsHolder(e.target.value)}
                    placeholder="e.g. Universal Sync Media / Sony ATV"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* License Type */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">License Framework</label>
                <input
                  type="text"
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value)}
                  placeholder="Royalty-Free Commercial, CC-BY 4.0, Master Sync"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* License Source */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Licensing Authority / Provider</label>
                <input
                  type="text"
                  value={licenseSource}
                  onChange={(e) => setLicenseSource(e.target.value)}
                  placeholder="Metfa Sound Studio, Free Music Archive"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* License Expiry Date */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">License Expiry Date (Leave empty for Perpetual)</label>
                <input
                  type="date"
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Clearance Status */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Catalog Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="active">Active (Available for new Reels)</option>
                  <option value="pending">Pending Clearance</option>
                  <option value="restricted">Restricted Rights</option>
                  <option value="expired">Expired (Prevent new selection)</option>
                  <option value="revoked">Revoked / Taken Down</option>
                </select>
              </div>

              {/* Checkboxes */}
              <div className="md:col-span-2 flex flex-wrap gap-6 py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commercialUseAllowed}
                    onChange={(e) => setCommercialUseAllowed(e.target.checked)}
                    className="rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-gray-300 font-bold">Commercial Monetization Allowed</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attributionRequired}
                    onChange={(e) => setAttributionRequired(e.target.checked)}
                    className="rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-gray-300 font-bold">Attribution Credit Required</span>
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={() => {
                  handleResetForm();
                  setActiveTab('catalog');
                }}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-600/30"
              >
                <Check className="w-4 h-4" />
                <span>{editingTrackId ? 'Save Terms' : 'Publish to Catalog'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Copyright Takedown Queue */}
        {activeTab === 'reports' && (
          <div className="flex-1 overflow-y-auto pr-1 pt-3 space-y-3">
            {reports.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShieldCheck className="w-10 h-10 text-teal-400 mx-auto mb-2" />
                <p className="font-bold">No active copyright complaints</p>
                <p className="text-xs">All audio rights across METFA Social are clear and verified.</p>
              </div>
            ) : (
              reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 bg-gray-950 border border-gray-800 rounded-2xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-rose-950 text-rose-400 border border-rose-500/40 rounded-lg">
                        <Flag className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="font-bold text-white">Target Track: {rep.trackTitle}</h4>
                        <p className="text-[11px] text-gray-400">
                          Claimed by: {rep.copyrightOwner} (Reporter: {rep.reporterName} - {rep.reporterEmail})
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        rep.status === 'pending'
                          ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                          : rep.status === 'approved_takedown'
                          ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>

                  <div className="p-2.5 bg-gray-900/80 rounded-xl space-y-1 text-[11px]">
                    <p className="text-gray-300">
                      <span className="font-bold text-gray-400">Reason:</span> {rep.reason}
                    </p>
                    <p className="text-gray-300">
                      <span className="font-bold text-gray-400">Evidence / Registration:</span> {rep.evidence}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      Reported on: {new Date(rep.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {rep.status === 'pending' && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleResolveReport(rep.id, 'rejected')}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold transition"
                      >
                        Dismiss / Reject Claim
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveReport(rep.id, 'approved_takedown')}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-1 shadow-md shadow-rose-600/30"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Approve Takedown & Revoke Track</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAudioManagementModal;
