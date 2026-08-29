import React from 'react';
import { Camera, Video, Images, FileText, X } from 'lucide-react';

export interface ActionSheetOption {
  id: 'camera' | 'video' | 'gallery' | 'document';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  accentColor?: string;
  bgGradient?: string;
}

export interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onRecordVideo: () => void;
  onOpenGallery: () => void;
  onOpenDocuments: () => void;
}

/**
 * Mobile-friendly Bottom Action Sheet for Metfa Social Chat
 * Clean 4-option menu:
 * 1. Camera -> Direct photo capture
 * 2. Video -> Direct video recording
 * 3. Photos & Videos -> Local gallery selection
 * 4. Documents & Files -> Logs, code, documents
 */
export const AttachmentModal: React.FC<AttachmentModalProps> = ({
  isOpen,
  onClose,
  onTakePhoto,
  onRecordVideo,
  onOpenGallery,
  onOpenDocuments,
}) => {
  if (!isOpen) return null;

  const handleTakePhoto = () => {
    onClose();
    onTakePhoto();
  };

  const handleRecordVideo = () => {
    onClose();
    onRecordVideo();
  };

  const handleOpenGallery = () => {
    onClose();
    onOpenGallery();
  };

  const handleOpenDocuments = () => {
    onClose();
    onOpenDocuments();
  };

  // Action Menu Array Structure: 4 dedicated actions
  const actionOptions: ActionSheetOption[] = [
    {
      id: 'camera',
      label: 'Camera',
      description: 'Take a photo directly with camera',
      icon: Camera,
      action: handleTakePhoto,
      accentColor: 'text-teal-600',
      bgGradient: 'from-teal-50 to-emerald-50/60 border-teal-200 hover:border-teal-400',
    },
    {
      id: 'video',
      label: 'Video',
      description: 'Record a video directly with camera',
      icon: Video,
      action: handleRecordVideo,
      accentColor: 'text-indigo-600',
      bgGradient: 'from-indigo-50 to-purple-50/60 border-indigo-200 hover:border-indigo-400',
    },
    {
      id: 'gallery',
      label: 'Photos & Videos',
      description: 'Choose existing photos or videos from device',
      icon: Images,
      action: handleOpenGallery,
      accentColor: 'text-purple-600',
      bgGradient: 'from-purple-50 to-pink-50/60 border-purple-200 hover:border-purple-400',
    },
    {
      id: 'document',
      label: 'Documents & Files',
      description: 'Upload logs, code snippets, or text files',
      icon: FileText,
      action: handleOpenDocuments,
      accentColor: 'text-blue-600',
      bgGradient: 'from-blue-50 to-cyan-50/60 border-blue-200 hover:border-blue-400',
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-sheet-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white border border-gray-200 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-slideUp sm:animate-scaleUp"
      >
        {/* Top Handle bar for mobile touch drag */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div>
            <h3 id="attachment-sheet-title" className="text-base font-bold text-gray-900 tracking-tight">
              Choose an action
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Select media or files to attach to your AI prompt</p>
          </div>
          <button
            type="button"
            id="close-attachment-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Options List */}
        <div className="grid grid-cols-1 gap-2.5 my-2">
          {actionOptions.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                id={`action-sheet-${item.id}-btn`}
                type="button"
                onClick={item.action}
                className={`w-full p-3.5 rounded-2xl bg-gradient-to-r ${item.bgGradient} border flex items-center gap-3.5 text-left transition transform active:scale-[0.98] group`}
              >
                <div
                  className={`p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm ${item.accentColor} shrink-0 group-hover:scale-105 transition-transform`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-600 truncate mt-0.5">{item.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Cancel Button */}
        <button
          type="button"
          id="cancel-attachment-modal-btn"
          onClick={onClose}
          className="w-full mt-3 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 hover:text-gray-900 text-xs font-semibold tracking-wider transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export const ActionSheet = AttachmentModal;
export default AttachmentModal;

