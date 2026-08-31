import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Search,
  Plus,
  Play,
  Pause,
  ShieldCheck,
  Check,
  X,
  Volume2,
  Filter,
  Sparkles,
  Award,
  Globe,
  Calendar,
  AlertCircle,
  FileAudio,
  Radio,
  Bookmark,
  Flag,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sliders,
  VolumeX,
} from 'lucide-react';
import { AudioTrack, AudioGenre, AudioMood, SoundEffectCategory } from '../types/audio';
import { UserProfile } from '../types/community';
import {
  getAudioTracks,
  searchAudioTracks,
  formatDuration,
  verifyTrackLicense,
  verifyTrackSelectionAllowed,
  toggleSaveSound,
  isSoundSaved,
  getSavedSoundIds,
} from '../utils/audioStore';
import AudioLicenseInfoModal from './AudioLicenseInfoModal';
import ReportCopyrightModal from './ReportCopyrightModal';
import AdminAudioManagementModal from './AdminAudioManagementModal';

export type SoundPickerCategoryTab =
  | 'for_you'
  | 'original'
  | 'royalty_free'
  | 'licensed'
  | 'sound_effect'
  | 'saved';

interface AudioTrackPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack: (track: AudioTrack) => void;
  selectedTrackId?: string;
  userProfile?: UserProfile;
}

const SFX_CATEGORIES: { id: SoundEffectCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All SFX' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'funny', label: 'Funny / Meme' },
  { id: 'nature', label: 'Nature' },
  { id: 'action', label: 'Action' },
  { id: 'notification', label: 'Notifications' },
  { id: 'ambience', label: 'Ambience' },
  { id: 'applause', label: 'Applause' },
  { id: 'impact', label: 'Impact / Boom' },
];

const GENRES: AudioGenre[] = [
  'Synthwave',
  'Lo-Fi Chill',
  'Cyberpunk',
  'Cinematic Orchestral',
  'Afrobeat',
  'Ambient Zen',
  'Future Bass',
  'Acoustic',
  'Electronic',
  'Hip-Hop / Trap',
];

const MOODS: AudioMood[] = [
  'Energetic',
  'Relaxed',
  'Dark & Moody',
  'Inspiring',
  'Dreamy',
  'Uplifting',
  'Dramatic',
  'Focus',
];

const ITEMS_PER_PAGE = 8;

export const AudioTrackPickerModal: React.FC<AudioTrackPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTrack,
  selectedTrackId,
  userProfile,
}) => {
  const [activeCategoryTab, setActiveCategoryTab] = useState<SoundPickerCategoryTab>('for_you');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedSfxCategory, setSelectedSfxCategory] = useState<string>('all');
  const [commercialOnly, setCommercialOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Audio Playback Preview State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Modals
  const [inspectingTrack, setInspectingTrack] = useState<AudioTrack | null>(null);
  const [reportingTrack, setReportingTrack] = useState<AudioTrack | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const userId = userProfile?.id || 'current_user';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch filtered tracks
  const tracks = React.useMemo(() => {
    return searchAudioTracks({
      category: activeCategoryTab,
      query: searchQuery,
      genre: selectedGenre,
      mood: selectedMood,
      sfxCategory: selectedSfxCategory,
      commercialOnly,
      userId,
    });
  }, [activeCategoryTab, searchQuery, selectedGenre, selectedMood, selectedSfxCategory, commercialOnly, userId]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategoryTab, searchQuery, selectedGenre, selectedMood, selectedSfxCategory, commercialOnly]);

  // Handle Play/Pause Audio Preview
  const handleTogglePlay = (track: AudioTrack) => {
    if (playingTrackId === track.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setPlayingTrackId(null);
      }
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(track.audio_url);
    audioPlayerRef.current = audio;
    setPlayingTrackId(track.id);
    setPlaybackProgress(0);
    setCurrentTime(0);

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setCurrentTime(audio.currentTime);
        setAudioDuration(audio.duration);
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.onended = () => {
      setPlayingTrackId(null);
      setPlaybackProgress(0);
      setCurrentTime(0);
    };

    audio.onerror = () => {
      showToast('Audio preview stream could not be loaded');
      setPlayingTrackId(null);
    };

    audio.play().catch(() => {
      setPlayingTrackId(null);
    });
  };

  // Stop audio on close or unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const handleSelectSound = (track: AudioTrack) => {
    const check = verifyTrackSelectionAllowed(track);
    if (!check.canSelect) {
      showToast(check.reason || 'This track is restricted and cannot be attached to new Reels.');
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    onSelectTrack(track);
    onClose();
  };

  const handleToggleSave = (e: React.MouseEvent, track: AudioTrack) => {
    e.stopPropagation();
    const isNowSaved = toggleSaveSound(userId, track.id);
    showToast(isNowSaved ? `Saved "${track.title}" to your sounds` : `Removed "${track.title}" from saved`);
  };

  // Paginated slice
  const totalPages = Math.ceil(tracks.length / ITEMS_PER_PAGE) || 1;
  const paginatedTracks = tracks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br from-purple-600 to-teal-500 text-white shadow-lg shadow-purple-600/30">
                <Music className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Add Sound</h3>
                <p className="text-[11px] sm:text-xs text-gray-400">
                  Select background audio from verified catalogs, original sounds, or SFX
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Admin Audio Management Button */}
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-bold flex items-center gap-1 transition"
                title="Admin Audio Management"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Catalog</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toast message banner */}
          {toastMessage && (
            <div className="my-2 p-2.5 rounded-xl bg-purple-950/90 border border-purple-500/60 text-purple-200 text-xs flex items-center gap-2 animate-fadeIn shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Top Category Tabs: For You | Original Sounds | Music | Licensed Music | Sound Effects | Saved */}
          <div className="flex items-center gap-1.5 pt-3 pb-2 border-b border-gray-800 overflow-x-auto no-scrollbar shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setActiveCategoryTab('for_you')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeCategoryTab === 'for_you'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-800/80 text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>For You</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryTab('original')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeCategoryTab === 'original'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-800/80 text-gray-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Original Sounds</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryTab('royalty_free')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeCategoryTab === 'royalty_free'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-800/80 text-gray-400 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Music</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryTab('licensed')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeCategoryTab === 'licensed'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-800/80 text-gray-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
              <span>Licensed Music</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryTab('sound_effect')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeCategoryTab === 'sound_effect'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-800/80 text-gray-400 hover:text-white'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Sound Effects</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryTab('saved')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeCategoryTab === 'saved'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-gray-800/80 text-gray-400 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved</span>
            </button>
          </div>

          {/* SFX Subcategory Chips (when on Sound Effects tab) */}
          {activeCategoryTab === 'sound_effect' && (
            <div className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar shrink-0 text-[11px]">
              {SFX_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedSfxCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition ${
                    selectedSfxCategory === cat.id
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-800/70 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2.5 pb-2 shrink-0 text-xs">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, artist, genre, mood, creator..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 placeholder:text-gray-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Genre Filter */}
            {activeCategoryTab !== 'sound_effect' && (
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-2 text-xs text-gray-300 focus:outline-none"
              >
                <option value="all">All Genres</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}

            {/* Mood Filter */}
            {activeCategoryTab !== 'sound_effect' && (
              <select
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-2 text-xs text-gray-300 focus:outline-none"
              >
                <option value="all">All Moods</option>
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Track List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 py-2">
            {paginatedTracks.length === 0 ? (
              <div className="text-center py-12 text-gray-500 space-y-2">
                <Music className="w-10 h-10 mx-auto text-gray-600" />
                <p className="text-xs font-bold text-gray-400">No audio tracks found</p>
                <p className="text-[11px]">Try adjusting your search query or switching categories.</p>
              </div>
            ) : (
              paginatedTracks.map((track) => {
                const isPlaying = playingTrackId === track.id;
                const isSelected = selectedTrackId === track.id;
                const isSaved = isSoundSaved(userId, track.id);
                const licenseCheck = verifyTrackLicense(track);
                const selectionCheck = verifyTrackSelectionAllowed(track);

                return (
                  <div
                    key={track.id}
                    className={`p-3 rounded-2xl border transition group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/10'
                        : !selectionCheck.canSelect
                        ? 'bg-rose-950/15 border-rose-500/30 opacity-75'
                        : 'bg-gray-950/80 border-gray-800 hover:border-purple-500/40'
                    }`}
                  >
                    {/* Left: Thumbnail & Details */}
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      {/* Play/Pause Button over Album Cover */}
                      <div className="relative shrink-0">
                        <img
                          src={track.cover_url}
                          alt={track.title}
                          className="w-12 h-12 rounded-xl object-cover border border-purple-500/30 shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => handleTogglePlay(track)}
                          className="absolute inset-0 bg-black/40 hover:bg-black/60 rounded-xl flex items-center justify-center text-white transition cursor-pointer"
                          title={isPlaying ? 'Pause Preview' : 'Play Preview'}
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 text-teal-400" />
                          ) : (
                            <Play className="w-5 h-5 text-purple-300 fill-purple-300 ml-0.5" />
                          )}
                        </button>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[240px]">
                            {track.title}
                          </h4>
                          {track.track_type === 'original' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-500/40 text-amber-300 text-[9px] font-bold">
                              ORIGINAL
                            </span>
                          )}
                          {track.track_type === 'sound_effect' && (
                            <span className="px-1.5 py-0.2 rounded bg-teal-950 border border-teal-500/40 text-teal-300 text-[9px] font-bold uppercase">
                              {track.sfx_category || 'SFX'}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-purple-300 truncate font-mono">
                          {track.artist} • {formatDuration(track.duration)} • {track.genre}
                        </p>

                        {/* Interactive Waveform / Playback Progress if playing */}
                        {isPlaying && (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="w-24 sm:w-36 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-teal-400 transition-all duration-100"
                                style={{ width: `${playbackProgress}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-teal-300 font-mono">
                              {formatDuration(Math.floor(currentTime))} / {formatDuration(track.duration)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-800/60">
                      {/* Save Sound Toggle */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleSave(e, track)}
                        className={`p-2 rounded-xl transition ${
                          isSaved
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                        title={isSaved ? 'Unsave sound' : 'Save sound to collection'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                      </button>

                      {/* License Info Button */}
                      <button
                        type="button"
                        onClick={() => setInspectingTrack(track)}
                        className="px-2 py-1.5 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition"
                        title="Inspect license terms and rights certificate"
                      >
                        <ShieldCheck className="w-3 h-3 text-teal-400" />
                        <span className="max-w-[80px] truncate">{track.license_type}</span>
                      </button>

                      {/* Report Copyright */}
                      <button
                        type="button"
                        onClick={() => setReportingTrack(track)}
                        className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                        title="Report Copyright / DMCA complaint"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>

                      {/* "Use this sound" button */}
                      <button
                        type="button"
                        onClick={() => handleSelectSound(track)}
                        disabled={!selectionCheck.canSelect}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md ${
                          !selectionCheck.canSelect
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-rose-500/30'
                            : isSelected
                            ? 'bg-teal-600 text-white'
                            : 'bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Attached</span>
                          </>
                        ) : !selectionCheck.canSelect ? (
                          <span>Expired</span>
                        ) : (
                          <span>Use this sound</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-800 shrink-0 text-xs text-gray-400">
              <span>
                Page {currentPage} of {totalPages} ({tracks.length} tracks)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rights Details Modal */}
      {inspectingTrack && (
        <AudioLicenseInfoModal
          isOpen={!!inspectingTrack}
          track={inspectingTrack}
          onClose={() => setInspectingTrack(null)}
        />
      )}

      {/* Copyright Report Modal */}
      {reportingTrack && (
        <ReportCopyrightModal
          isOpen={!!reportingTrack}
          track={reportingTrack}
          onClose={() => setReportingTrack(null)}
          onReportSubmitted={() => showToast('Copyright notice logged with Metfa Legal Registry')}
        />
      )}

      {/* Admin Audio Management Modal */}
      {isAdminModalOpen && (
        <AdminAudioManagementModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
        />
      )}
    </>
  );
};

export default AudioTrackPickerModal;
