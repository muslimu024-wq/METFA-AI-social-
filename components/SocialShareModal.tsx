import React, { useState } from 'react';
import {
  Share2,
  X,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Send,
  Sparkles,
  Smartphone,
  Link2,
  Mail,
  Globe
} from 'lucide-react';
import { SharePayload, getSocialShareLinks, getAppBaseUrl } from '../utils/shareUtils';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload | null;
  onSharePerformed?: () => void;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  payload,
  onSharePerformed,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !payload) return null;

  const currentUrl =
    payload.url ||
    (typeof window !== 'undefined' ? window.location.href : getAppBaseUrl());

  const links = getSocialShareLinks(payload);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = currentUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      onSharePerformed?.();
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleOpenSocial = (url: string) => {
    onSharePerformed?.();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShareAgain = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: payload.title || 'Metfa Social',
          text: payload.text || 'Check this out on Metfa Social!',
          url: currentUrl,
        });
        onSharePerformed?.();
        onClose();
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          onSharePerformed?.();
        }
      }
    }
  };

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const socialPlatforms = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      color: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: MessageCircle,
      action: () => handleOpenSocial(links.whatsapp),
    },
    {
      id: 'facebook',
      name: 'Facebook',
      color: 'bg-blue-600 hover:bg-blue-500 text-white',
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      icon: Globe,
      action: () => handleOpenSocial(links.facebook),
    },
    {
      id: 'messenger',
      name: 'Messenger',
      color: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:opacity-90 text-white',
      badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      icon: Send,
      action: () => {
        // Try messenger app uri on mobile or web share
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        if (isMobile) {
          handleOpenSocial(links.messenger);
        } else {
          handleOpenSocial(links.messengerWeb);
        }
      },
    },
    {
      id: 'telegram',
      name: 'Telegram',
      color: 'bg-sky-500 hover:bg-sky-400 text-white',
      badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      icon: Send,
      action: () => handleOpenSocial(links.telegram),
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      color: 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700',
      badgeBg: 'bg-gray-800 text-gray-200 border-gray-700',
      icon: ExternalLink,
      action: () => handleOpenSocial(links.twitter),
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      color: 'bg-blue-700 hover:bg-blue-600 text-white',
      badgeBg: 'bg-blue-700/20 text-blue-300 border-blue-600/40',
      icon: Globe,
      action: () => handleOpenSocial(links.linkedin),
    },
    {
      id: 'email',
      name: 'Email',
      color: 'bg-amber-600 hover:bg-amber-500 text-white',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: Mail,
      action: () => handleOpenSocial(links.email),
    },
  ];

  return (
    <div
      id="social-share-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden text-left animate-slideUp sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-teal-950 text-teal-300 border border-teal-500/30">
              <Share2 className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>Share Content</span>
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              </h3>
              <p className="text-xs text-gray-400">
                Share to social apps or copy link
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-share-modal-btn"
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Preview Snippet */}
        <div className="bg-gray-950/80 border border-gray-800 rounded-2xl p-3 mb-5 flex items-center gap-3">
          {payload.imageSrc ? (
            <img
              src={payload.imageSrc}
              alt="Share thumbnail"
              className="w-14 h-14 rounded-xl object-cover border border-gray-800 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate">
              {payload.title}
            </h4>
            <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">
              {payload.text || 'Created with Metfa Social'}
            </p>
            {payload.authorUsername && (
              <span className="inline-block text-[10px] text-teal-400 font-semibold mt-1">
                @{payload.authorUsername}
              </span>
            )}
          </div>
        </div>

        {/* Native Mobile Sheet Button (if available) */}
        {hasNativeShare && (
          <div className="mb-4">
            <button
              type="button"
              id="native-device-share-btn"
              onClick={handleNativeShareAgain}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Smartphone className="w-4 h-4" />
              <span>Open Device Native Share Sheet</span>
            </button>
          </div>
        )}

        {/* Quick Social Share Grid */}
        <div className="space-y-2 mb-5">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Direct Share
          </label>
          <div className="grid grid-cols-4 gap-2.5">
            {socialPlatforms.map((platform) => {
              const IconComp = platform.icon;
              return (
                <button
                  key={platform.id}
                  type="button"
                  id={`share-btn-${platform.id}`}
                  onClick={platform.action}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-gray-950 border border-gray-800/90 hover:border-teal-500/50 hover:bg-gray-850 transition group active:scale-95"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition group-hover:scale-105 ${platform.color}`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium text-gray-300 group-hover:text-white truncate max-w-full">
                    {platform.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Copy Link Section */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Page Link
          </label>
          <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl p-1.5 pl-3">
            <Link2 className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="bg-transparent text-xs text-gray-300 w-full focus:outline-none truncate selection:bg-teal-500/30"
            />
            <button
              type="button"
              id="copy-share-link-btn"
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-md ${
                copied
                  ? 'bg-teal-500 text-black'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialShareModal;
