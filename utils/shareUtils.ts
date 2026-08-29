export interface SharePayload {
  id?: string;
  type?: 'post' | 'reel' | 'artwork' | 'general';
  title: string;
  text?: string;
  url?: string;
  imageSrc?: string;
  authorName?: string;
  authorUsername?: string;
}

/**
 * Triggers native Web Share API (navigator.share) when supported on mobile or desktop.
 * If not supported or if an unexpected error occurs, triggers fallback callback.
 */
export async function executeNativeShare(
  payload: SharePayload,
  callbacks?: {
    onSuccess?: () => void;
    onFallback?: () => void;
  }
): Promise<boolean> {
  const currentUrl =
    payload.url ||
    (typeof window !== 'undefined' ? window.location.href : 'https://metfa.ai');

  const shareTitle = payload.title || 'Metfa Social';
  const shareText =
    payload.text ||
    `Check out this creation by ${payload.authorName || payload.authorUsername || 'Metfa Creator'} on Metfa Social!`;

  const shareData: ShareData = {
    title: shareTitle,
    text: shareText,
    url: currentUrl,
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      callbacks?.onSuccess?.();
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User voluntarily dismissed the native sheet - count the intent or complete safely
        callbacks?.onSuccess?.();
        return true;
      }
      console.warn('Native share failed, using custom modal fallback:', err);
      callbacks?.onFallback?.();
      return false;
    }
  } else {
    // Native share not supported on this browser/environment
    callbacks?.onFallback?.();
    return false;
  }
}

/**
 * Generate quick social share URLs
 */
export function getSocialShareLinks(payload: SharePayload) {
  const url = payload.url || (typeof window !== 'undefined' ? window.location.href : 'https://metfa.ai');
  const text = payload.text ? `${payload.text} - ${url}` : `Metfa Social: ${payload.title} ${url}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(payload.title || 'Metfa Social');

  return {
    whatsapp: `https://api.whatsapp.com/send?text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    messenger: `fb-messenger://share/?link=${encodedUrl}`,
    messengerWeb: `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=291494419107518&redirect_uri=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedText}`,
  };
}
