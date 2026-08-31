import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Music,
  Play,
  Pause,
  Copy,
  Check,
  X,
  Globe,
  Calendar,
  AlertCircle,
  Award,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';
import { AudioTrack } from '../types/audio';
import { formatDuration, verifyTrackLicense } from '../utils/audioStore';

interface AudioLicenseInfoModalProps {
  track: AudioTrack | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack?: (track: AudioTrack) => void;
}

export const AudioLicenseInfoModal: React.FC<AudioLicenseInfoModalProps> = ({
  track,
  isOpen,
  onClose,
  onSelectTrack,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedAttribution, setCopiedAttribution] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Reset playback when modal opens or closes
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    }
  }, [isOpen]);

  if (!isOpen || !track) return null;

  const licenseInfo = verifyTrackLicense(track);

  const togglePlay = () => {
    if (!audioRef.current) {
      const audio = new Audio(track.audio_url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const handleCopyAttribution = () => {
    navigator.clipboard.writeText(licenseInfo.attributionString);
    setCopiedAttribution(true);
    setTimeout(() => setCopiedAttribution(false), 2000);
  };

  const formattedStart = track.license_start
    ? new Date(track.license_start).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  const formattedExpiry = track.license_expiry
    ? new Date(track.license_expiry).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Perpetual (No Expiration)';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Music Licensing & Rights Certificate</span>
              </h3>
              <p className="text-xs text-gray-400">Verified sync and broadcast rights metadata</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-5 overflow-y-auto py-4 pr-1 text-xs">
          {/* Track Summary Banner */}
          <div className="p-4 rounded-2xl bg-gray-950/80 border border-gray-800 flex items-center gap-4">
            <div className="relative group shrink-0">
              <img
                src={track.cover_url}
                alt={track.title}
                className="w-16 h-16 rounded-xl object-cover border border-purple-500/30 shadow-md"
              />
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 bg-black/40 hover:bg-black/60 rounded-xl flex items-center justify-center text-white transition"
              >
                {isPlaying ? <Pause className="w-6 h-6 text-teal-400" /> : <Play className="w-6 h-6 text-purple-300 fill-purple-300" />}
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${licenseInfo.statusBadge.bg}`}>
                  {licenseInfo.statusBadge.text}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {formatDuration(track.duration)}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white truncate mt-1">{track.title}</h4>
              <p className="text-xs text-purple-300 truncate font-mono">by {track.artist}</p>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                <span className="bg-gray-800 px-1.5 py-0.5 rounded">{track.genre}</span>
                <span className="bg-gray-800 px-1.5 py-0.5 rounded">{track.mood}</span>
                {track.bpm && <span className="bg-gray-800 px-1.5 py-0.5 rounded font-mono">{track.bpm} BPM</span>}
              </div>
            </div>
          </div>

          {/* Rights Highlights Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-gray-950/50 border border-gray-800">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <Award className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-bold uppercase tracking-wider text-[10px]">License Type</span>
              </div>
              <p className="text-xs font-bold text-white">{track.license_type}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Source: {track.license_source}</p>
            </div>

            <div className="p-3 rounded-xl bg-gray-950/50 border border-gray-800">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-bold uppercase tracking-wider text-[10px]">Commercial Use</span>
              </div>
              <p className={`text-xs font-bold ${track.commercial_use_allowed ? 'text-teal-300' : 'text-amber-400'}`}>
                {track.commercial_use_allowed ? 'Allowed (Monetization OK)' : 'Non-Commercial Only'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {track.attribution_required ? 'Attribution Required' : 'No Attribution Required'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-gray-950/50 border border-gray-800">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-bold uppercase tracking-wider text-[10px]">Territories</span>
              </div>
              <p className="text-xs font-bold text-white">{licenseInfo.territoriesDisplay}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Global digital streaming & sync</p>
            </div>

            <div className="p-3 rounded-xl bg-gray-950/50 border border-gray-800">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold uppercase tracking-wider text-[10px]">Validity Period</span>
              </div>
              <p className="text-xs font-bold text-white">{formattedExpiry}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Effective from {formattedStart}</p>
            </div>
          </div>

          {/* Full Attribution String Box */}
          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                <Info className="w-3 h-3 text-purple-400" />
                Creator Attribution Notice
              </span>
              <button
                type="button"
                onClick={handleCopyAttribution}
                className="flex items-center gap-1 text-[11px] font-bold text-teal-400 hover:text-teal-300 transition"
              >
                {copiedAttribution ? (
                  <>
                    <Check className="w-3 h-3 text-teal-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-300 font-mono bg-gray-950/90 p-2 rounded-lg border border-gray-800 break-words select-all">
              {licenseInfo.attributionString}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-gray-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition"
          >
            Close
          </button>

          {onSelectTrack && (
            <button
              type="button"
              onClick={() => {
                onSelectTrack(track);
                onClose();
              }}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <Music className="w-3.5 h-3.5" />
              <span>Use This Soundtrack</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioLicenseInfoModal;
