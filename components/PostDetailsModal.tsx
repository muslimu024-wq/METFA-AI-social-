import React from 'react';
import {
  X,
  User,
  Globe,
  Users,
  Lock,
  ShieldCheck,
  Tag,
  Clock,
  Music,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ProfilePrivacy } from '../types/community';
import { RawPostVisibility, formatAudienceMeta } from '../utils/privacyPolicy';

export interface PostDetailsInfo {
  id: string;
  contentTypeLabel: string;
  authorId?: string | null;
  authorName: string;
  authorUsername?: string | null;
  authorAvatar: string;
  identityBadge?: string | null;
  createdAt: string;
  visibility?: RawPostVisibility;
  authorProfilePrivacy?: ProfilePrivacy | string | null;
  stylePreset?: string | null;
  tags?: string[] | null;
  musicLabel?: string | null;
  caption?: string | null;
}

export interface PostDetailsModalProps {
  isOpen: boolean;
  details: PostDetailsInfo | null;
  onClose: () => void;
  onViewProfile?: (authorId: string) => void;
}

export const PostDetailsModal: React.FC<PostDetailsModalProps> = ({
  isOpen,
  details,
  onClose,
  onViewProfile,
}) => {
  if (!isOpen || !details) return null;

  const audienceMeta = formatAudienceMeta(details.visibility, details.authorProfilePrivacy);
  const cleanHandle = details.authorUsername ? details.authorUsername.replace(/^@/, '') : '';
  const hasProfileTarget = Boolean(details.authorId && details.authorId.trim().length > 0);

  const handleOpenProfile = () => {
    if (!details.authorId) return;
    onClose();
    if (onViewProfile) {
      onViewProfile(details.authorId);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metfa_view_profile', { detail: { userId: details.authorId } }));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-details-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 id="post-details-modal-title" className="text-sm font-bold text-slate-900">
            Post &amp; Creator Details
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close post details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Creator Identity Card (Surfaces @username cleanly out of the feed header) */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={details.authorAvatar}
                alt={details.authorName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{details.authorName}</p>
                {cleanHandle ? (
                  <p className="text-xs font-mono text-slate-600 truncate">@{cleanHandle}</p>
                ) : (
                  <p className="text-xs text-slate-500">Creator</p>
                )}
              </div>
            </div>

            {hasProfileTarget && (
              <button
                type="button"
                onClick={handleOpenProfile}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Public Post Metadata List */}
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="text-slate-500 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Published</span>
              </span>
              <span className="font-medium text-slate-800">{details.createdAt}</span>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="text-slate-500 flex items-center gap-2">
                {audienceMeta.iconKey === 'globe' ? (
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                ) : audienceMeta.iconKey === 'users' ? (
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                ) : audienceMeta.iconKey === 'shield' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>Audience</span>
              </span>
              <span className="font-medium text-slate-800">{audienceMeta.label}</span>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="text-slate-500">Format</span>
              <span className="font-medium text-slate-800">{details.contentTypeLabel}</span>
            </div>

            {details.stylePreset && (
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>Style / Category</span>
                </span>
                <span className="font-medium text-slate-800">{details.stylePreset}</span>
              </div>
            )}

            {details.identityBadge && (
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500">Creator Role</span>
                <span className="font-medium text-slate-800">{details.identityBadge}</span>
              </div>
            )}

            {details.musicLabel && (
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500 flex items-center gap-2 shrink-0">
                  <Music className="w-3.5 h-3.5 text-teal-600" />
                  <span>Audio</span>
                </span>
                <span className="font-medium text-slate-800 truncate">{details.musicLabel}</span>
              </div>
            )}
          </div>

          {/* Creator Tags (moved out of header badges cleanly) */}
          {details.tags && details.tags.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Content Tags</span>
              </span>
              <div className="flex flex-wrap gap-2 text-xs text-slate-700">
                {details.tags.map((tag, i) => (
                  <span key={`${tag}_${i}`} className="text-teal-700 font-medium">
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Privacy explanation footer */}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {audienceMeta.description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PostDetailsModal;
