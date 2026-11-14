import React from 'react';
import {
  Check,
  Clock,
  Globe,
  Lock,
  MoreHorizontal,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { ProfilePrivacy } from '../types/community';
import {
  AudienceDisplayMeta,
  FollowRelationStatus,
  RawPostVisibility,
  formatAudienceMeta,
} from '../utils/privacyPolicy';

export interface PostHeaderProps {
  postId: string;
  authorId?: string | null;
  displayName: string;
  avatarSrc: string;
  createdAt: string;
  visibility?: RawPostVisibility;
  authorProfilePrivacy?: ProfilePrivacy | string | null;
  audienceMeta?: AudienceDisplayMeta;
  isOwner: boolean;
  followStatus: FollowRelationStatus;
  isFollowLoading?: boolean;
  isMenuOpen: boolean;
  priority?: boolean;
  followButtonId?: string;
  menuButtonId?: string;
  menuDataAttr?: 'data-post-menu' | 'data-menu-root';
  onToggleFollow?: (e: React.MouseEvent) => void;
  onToggleMenu: (e: React.MouseEvent) => void;
  onViewProfile?: (authorId: string) => void;
  onSetAudience?: (e: React.MouseEvent) => void;
  renderMenuDropdown?: () => React.ReactNode;
}

export const PostHeader: React.FC<PostHeaderProps> = ({
  postId,
  authorId,
  displayName,
  avatarSrc,
  createdAt,
  visibility,
  authorProfilePrivacy,
  audienceMeta: providedMeta,
  isOwner,
  followStatus,
  isFollowLoading = false,
  isMenuOpen,
  priority = false,
  followButtonId,
  menuButtonId,
  menuDataAttr = 'data-post-menu',
  onToggleFollow,
  onToggleMenu,
  onViewProfile,
  onSetAudience,
  renderMenuDropdown,
}) => {
  const audienceMeta = providedMeta || formatAudienceMeta(visibility, authorProfilePrivacy);
  const canNavigateProfile = Boolean(authorId && authorId.trim().length > 0);

  const handleProfileClick = (e: React.MouseEvent) => {
    if (!canNavigateProfile || !authorId) return;
    e.stopPropagation();
    if (onViewProfile) {
      onViewProfile(authorId);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metfa_view_profile', { detail: { userId: authorId } }));
    }
  };

  const renderAudienceIcon = () => {
    if (audienceMeta.iconKey === 'globe') return <Globe className="w-3 h-3 shrink-0" aria-hidden="true" />;
    if (audienceMeta.iconKey === 'users') return <Users className="w-3 h-3 shrink-0" aria-hidden="true" />;
    if (audienceMeta.iconKey === 'shield') return <ShieldCheck className="w-3 h-3 shrink-0 text-amber-600" aria-hidden="true" />;
    return <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />;
  };

  const menuWrapperProps =
    menuDataAttr === 'data-menu-root'
      ? { 'data-menu-root': 'true' }
      : { 'data-post-menu': postId };

  return (
    <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between gap-3">
      {/* Left: Avatar + Name/Follow + Compact Time & Audience row */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={handleProfileClick}
          disabled={!canNavigateProfile}
          className={`shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-purple-600 ${
            canNavigateProfile ? 'cursor-pointer' : 'cursor-default'
          }`}
          aria-label={`View ${displayName}'s profile`}
        >
          <img
            src={avatarSrc}
            alt={displayName}
            referrerPolicy="no-referrer"
            loading={priority ? undefined : 'lazy'}
            decoding="async"
            className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
          />
        </button>

        <div className="min-w-0 flex-1">
          {/* Row 1: Display Name + Follow / Following inline action */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleProfileClick}
              disabled={!canNavigateProfile}
              className={`text-[15px] font-semibold text-slate-900 truncate leading-snug text-left ${
                canNavigateProfile ? 'hover:underline cursor-pointer' : 'cursor-default'
              }`}
            >
              {displayName}
            </button>

            {!isOwner && onToggleFollow && (
              <>
                <span className="text-slate-300 text-xs select-none" aria-hidden="true">·</span>
                <button
                  type="button"
                  id={followButtonId || `follow-btn-${postId}`}
                  onClick={onToggleFollow}
                  disabled={isFollowLoading}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
                    followStatus === 'following'
                      ? 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                      : followStatus === 'pending'
                      ? 'text-amber-700 hover:text-rose-600 hover:bg-amber-50'
                      : 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                  title={
                    followStatus === 'following'
                      ? 'Following (Click to Unfollow)'
                      : followStatus === 'pending'
                      ? 'Follow request pending (Click to cancel)'
                      : 'Follow Creator'
                  }
                >
                  {followStatus === 'following' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span>Following</span>
                    </>
                  ) : followStatus === 'pending' ? (
                    <>
                      <Clock className="w-3 h-3 text-amber-600 shrink-0" aria-hidden="true" />
                      <span>Requested</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Row 2: Compact metadata — Time · Audience icon/label (+ owner-only Set Audience for legacy NULL) */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 leading-tight">
            <span className="whitespace-nowrap">{createdAt}</span>
            <span aria-hidden="true">·</span>
            <span
              title={audienceMeta.description}
              className={`inline-flex items-center gap-1 whitespace-nowrap ${
                audienceMeta.isLegacyRestricted
                  ? 'text-amber-700 font-medium'
                  : 'text-slate-500'
              }`}
            >
              {renderAudienceIcon()}
              <span>{audienceMeta.shortLabel}</span>
            </span>

            {audienceMeta.isLegacyRestricted && isOwner && onSetAudience && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onSetAudience}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 hover:underline cursor-pointer whitespace-nowrap"
                >
                  Set Audience
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Three-dot Menu */}
      <div className="relative shrink-0" {...menuWrapperProps}>
        <button
          type="button"
          id={menuButtonId || `post-menu-btn-${postId}`}
          onClick={onToggleMenu}
          className={`p-2 rounded-full transition cursor-pointer ${
            isMenuOpen
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="More options"
          aria-label="More options"
          aria-expanded={isMenuOpen}
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {isMenuOpen && renderMenuDropdown?.()}
      </div>
    </div>
  );
};

export default PostHeader;
