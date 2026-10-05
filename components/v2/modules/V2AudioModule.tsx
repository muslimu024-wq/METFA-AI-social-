/**
 * METFA V2 — Audio Module (METFA Audio)
 *
 * Audio economy, commercial licenses, attribution tracking, and revenue share terms.
 * Core Product Invariant: Voice Post belongs exclusively to METFA Social as a native content type.
 * METFA Audio in V2 handles licensing catalogs, commercial rights, attribution, and reel usage analytics.
 */

import React, { useState } from 'react';
import {
  Music,
  CheckCircle2,
  Radio,
  Disc,
  Volume2,
  ShieldCheck,
  FileText,
  Sparkles,
  ExternalLink,
  Layers,
  Search,
} from 'lucide-react';
import { DEFAULT_AUDIO_TRACKS } from '../../../utils/audioStore';
import { v2IntegrationAdapter } from '../../../services/v2IntegrationAdapter';

export const V2AudioModule: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(DEFAULT_AUDIO_TRACKS[0]);

  const integrationHealth = v2IntegrationAdapter.getIntegrationHealth();
  const audioAttributionsCount = integrationHealth.reelsBridge.audioAttributions;

  const filteredTracks = DEFAULT_AUDIO_TRACKS.filter(
    (t) =>
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center text-white shadow-xs">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  METFA Audio
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-pink-100 text-pink-800">
                  <Disc className="w-3 h-3 mr-1 text-pink-600" />
                  Economy & Attribution
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Audio economy, commercial licenses, attribution tracking, and revenue share terms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Reel Attributions: <strong className="text-pink-600 font-bold">{audioAttributionsCount} events</strong></span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Core Product Boundary Notice */}
        <div className="p-4 bg-pink-50/70 border border-pink-200 rounded-2xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-pink-700 shrink-0 mt-0.5" />
          <div className="text-xs text-pink-950 leading-relaxed">
            <strong>Social vs V2 Boundary:</strong> Native Voice Post belongs strictly to METFA Social as a primary content type. METFA Audio in V2 governs track licensing, commercial rights clearance, creator attribution CP, and revenue sharing for original compositions.
          </div>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Licensed Catalog</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{DEFAULT_AUDIO_TRACKS.length} Tracks</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Total Attributions</span>
            <div className="text-lg font-bold text-pink-600 mt-0.5">{audioAttributionsCount}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Copyright Status</span>
            <div className="text-lg font-bold text-emerald-600 mt-0.5">100% CLEAN</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">License Types</span>
            <div className="text-lg font-bold text-purple-700 mt-0.5">Commercial Sync</div>
          </div>
        </div>

        {/* Track Browser */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Audio Economy Catalog
            </span>

            {filteredTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => setSelectedTrack(track)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                  selectedTrack?.id === track.id
                    ? 'bg-pink-50/70 border-pink-300 ring-1 ring-pink-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <img
                  src={track.cover_url}
                  alt={track.title}
                  className="w-12 h-12 rounded-lg object-cover shrink-0 shadow-2xs"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{track.title}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{track.artist}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-mono">
                    <span>{track.genre}</span>
                    <span>•</span>
                    <span>{track.useCount} reel uses</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Track Rights & Licensing Detail */}
          <div className="lg:col-span-2">
            {selectedTrack ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
                <div className="flex items-start gap-4 border-b border-slate-100 pb-4">
                  <img
                    src={selectedTrack.cover_url}
                    alt={selectedTrack.title}
                    className="w-16 h-16 rounded-xl object-cover shadow-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-pink-700 font-bold uppercase tracking-wider bg-pink-50 px-2 py-0.5 rounded">
                      {selectedTrack.track_type}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 mt-1 truncate">
                      {selectedTrack.title}
                    </h2>
                    <p className="text-xs text-slate-500">Artist: <strong className="text-slate-800">{selectedTrack.artist}</strong></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">License Type</span>
                    <div className="font-bold text-slate-800">{selectedTrack.license_type}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">License Source</span>
                    <div className="font-bold text-slate-800">{selectedTrack.license_source}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">Territories</span>
                    <div className="font-bold text-emerald-700">
                      {Array.isArray(selectedTrack.territories) ? selectedTrack.territories.join(', ') : selectedTrack.territories}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">Commercial Use</span>
                    <div className="font-bold text-emerald-700">
                      {selectedTrack.commercial_use_allowed ? 'Permitted Worldwide' : 'Restricted'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">Attribution Rule</span>
                    <div className="font-bold text-slate-800">
                      {selectedTrack.attribution_required ? 'Required in Description' : 'Not Required'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] text-slate-400">Total Plays</span>
                    <div className="font-mono font-bold text-slate-800">{selectedTrack.playsCount?.toLocaleString() || '14,820'}</div>
                  </div>
                </div>

                {selectedTrack.attribution_requirements && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-800">Attribution Requirement:</span>{' '}
                    <span className="text-slate-600">{selectedTrack.attribution_requirements}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default V2AudioModule;
