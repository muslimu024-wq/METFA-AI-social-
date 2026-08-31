import React, { useState } from 'react';
import { ShieldAlert, X, Flag, CheckCircle, AlertTriangle } from 'lucide-react';
import { AudioTrack } from '../types/audio';
import { submitCopyrightReport } from '../utils/audioStore';

interface ReportCopyrightModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: AudioTrack;
  onReportSubmitted?: () => void;
}

export const ReportCopyrightModal: React.FC<ReportCopyrightModalProps> = ({
  isOpen,
  onClose,
  track,
  onReportSubmitted,
}) => {
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [copyrightOwner, setCopyrightOwner] = useState('');
  const [reason, setReason] = useState('Unauthorized commercial usage of copyrighted music');
  const [evidence, setEvidence] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterName.trim() || !reporterEmail.trim() || !evidence.trim()) return;

    submitCopyrightReport({
      trackId: track.id,
      trackTitle: track.title,
      trackArtist: track.artist,
      reporterName: reporterName.trim(),
      reporterEmail: reporterEmail.trim(),
      copyrightOwner: copyrightOwner.trim() || reporterName.trim(),
      reason,
      evidence: evidence.trim(),
    });

    setIsSubmitted(true);
    setTimeout(() => {
      onReportSubmitted?.();
      setIsSubmitted(false);
      onClose();
    }, 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-950/80 text-rose-400 border border-rose-500/40">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Report Copyright Complaint</h3>
              <p className="text-xs text-gray-400">DMCA & Rights Ownership Takedown Notice</p>
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

        {isSubmitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-teal-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Complaint Submitted</h4>
            <p className="text-xs text-gray-300 max-w-xs mx-auto">
              Your report has been logged in the Metfa Rights Management Queue. Our legal team will review this track within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Target Track info */}
            <div className="p-3 bg-gray-950 rounded-2xl border border-gray-800 flex items-center gap-3">
              <img
                src={track.cover_url}
                alt={track.title}
                className="w-10 h-10 rounded-xl object-cover border border-purple-500/30 shrink-0"
              />
              <div className="min-w-0">
                <h4 className="font-bold text-white truncate">{track.title}</h4>
                <p className="text-[11px] text-purple-300 font-mono truncate">{track.artist}</p>
                <p className="text-[10px] text-gray-500 font-mono">ID: {track.id}</p>
              </div>
            </div>

            {/* Reporter Full Name */}
            <div>
              <label className="text-gray-300 font-bold block mb-1">
                Your Full Name / Legal Representative <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="e.g. John Doe (Copyright Agent)"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="text-gray-300 font-bold block mb-1">
                Contact Email <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="rights@yourcompany.com"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Copyright Owner */}
            <div>
              <label className="text-gray-300 font-bold block mb-1">
                Original Copyright Holder / Publisher
              </label>
              <input
                type="text"
                value={copyrightOwner}
                onChange={(e) => setCopyrightOwner(e.target.value)}
                placeholder="e.g. Universal Music Group / Self"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="text-gray-300 font-bold block mb-1">Complaint Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Unauthorized commercial usage of copyrighted music">
                  Unauthorized commercial usage of copyrighted music
                </option>
                <option value="Audio was scraped or re-uploaded without master sync rights">
                  Audio was scraped or re-uploaded without master sync rights
                </option>
                <option value="Original creator audio was stolen/unattributed">
                  Original creator audio was stolen/unattributed
                </option>
                <option value="Expired license still appearing in circulation">
                  Expired license still appearing in circulation
                </option>
                <option value="Other copyright infringement">Other copyright infringement</option>
              </select>
            </div>

            {/* Evidence & Details */}
            <div>
              <label className="text-gray-300 font-bold block mb-1">
                Evidence / Registered Work URL <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Provide official registration number, ISRCs, or verified publication links..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-xl flex items-start gap-2 text-[10px] text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>
                Filing a fraudulent DMCA notice may incur legal penalties. Metfa will review original upload records and licensing agreements.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Submit Takedown Notice</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportCopyrightModal;
