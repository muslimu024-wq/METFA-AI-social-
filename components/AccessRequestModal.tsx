import React, { useState } from 'react';
import { Camera, Mic, ShieldCheck, X, AlertTriangle, ArrowRight, UploadCloud } from 'lucide-react';

interface AccessRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: (stream?: MediaStream) => void;
  onFallbackToFileUpload?: () => void;
  title?: string;
  description?: string;
}

export const AccessRequestModal: React.FC<AccessRequestModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  onFallbackToFileUpload,
  title = 'Allow Camera & Microphone Access',
  description = 'Metfa AI Studio requires device permissions to stream video, record voice notes, and capture photos directly.',
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPermissions = async () => {
    setIsRequesting(true);
    setErrorMessage(null);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        localStorage.setItem('metfa_media_permissions_granted', 'granted');
        setIsRequesting(false);
        onClose();
        onPermissionGranted(stream);
      } else {
        throw new Error('Media devices are not supported in this browser environment.');
      }
    } catch (err: any) {
      console.warn('getUserMedia permission failed or was denied:', err);
      setIsRequesting(false);
      localStorage.setItem('metfa_media_permissions_granted', 'fallback');
      
      // Close modal gracefully and trigger fallback if available
      onClose();
      if (onFallbackToFileUpload) {
        onFallbackToFileUpload();
      } else {
        onPermissionGranted();
      }
    }
  };

  const handleUseFilePicker = () => {
    onClose();
    if (onFallbackToFileUpload) {
      onFallbackToFileUpload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-600/20 rounded-full blur-3xl pointer-events-none" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full bg-gray-800/60 hover:bg-gray-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-teal-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">{title}</h3>
            <span className="text-xs text-purple-400 font-semibold">Device Permission Request</span>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-6 leading-relaxed">{description}</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3.5 bg-gray-950/80 border border-gray-800 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800 flex items-center justify-center">
              <Camera className="w-4 h-4 text-purple-300" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Camera</h5>
              <p className="text-[11px] text-gray-400">Live Video & Snaps</p>
            </div>
          </div>

          <div className="p-3.5 bg-gray-950/80 border border-gray-800 rounded-2xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-950/80 border border-teal-800 flex items-center justify-center">
              <Mic className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Microphone</h5>
              <p className="text-[11px] text-gray-400">Voice Notes & Prompts</p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            id="access-request-apply-btn"
            type="button"
            disabled={isRequesting}
            onClick={handleApplyPermissions}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition transform active:scale-95 disabled:opacity-50"
          >
            <span>{isRequesting ? 'Requesting Permissions...' : 'Allow Access'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleUseFilePicker}
            className="w-full py-2.5 px-4 bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white font-semibold text-xs rounded-xl border border-gray-700/60 flex items-center justify-center gap-2 transition"
          >
            <UploadCloud className="w-4 h-4 text-gray-400" />
            <span>Upload File From Device Instead</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessRequestModal;
