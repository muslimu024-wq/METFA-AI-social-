import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isDestructive?: boolean;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant,
  isDestructive = true,
}) => {
  const finalVariant = variant || (isDestructive ? 'danger' : 'primary');
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDanger = finalVariant === 'danger';

  return (
    <div
      id="confirm-action-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="confirm-action-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl ${
                isDanger
                  ? 'bg-rose-950/80 border border-rose-800/60 text-rose-400'
                  : 'bg-amber-950/80 border border-amber-800/60 text-amber-400'
              }`}
            >
              {isDanger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-bold text-white leading-snug">
                {title}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">This action cannot be undone.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-900 transition"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed bg-gray-900/50 p-3.5 rounded-2xl border border-gray-800/80">
          {message}
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 font-semibold text-xs rounded-xl transition active:scale-95"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
            }`}
          >
            {isDanger && <Trash2 className="w-3.5 h-3.5" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
