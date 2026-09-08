/**
 * Utility function to download an AI generated/transformed image directly to the user's local device.
 * Supports Data URLs (Base64), Object/Blob URLs, and remote URLs.
 */
export async function downloadTransformedImageLocally(
  imageSrc: string,
  prompt?: string
): Promise<{ success: boolean; filename: string }> {
  try {
    if (!imageSrc) {
      return { success: false, filename: '' };
    }

    // Generate readable, descriptive filename from prompt if present
    let slug = 'transformed-visual';
    if (prompt) {
      const clean = prompt
        .replace(/^\[Style:\s*[^\]]+\]\s*/i, '')
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .slice(0, 30);
      if (clean) slug = clean;
    }
    const filename = `metfa-${slug}-${Date.now()}.png`;

    // 1. Data URLs
    if (imageSrc.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true, filename };
    }

    // 2. Blob or remote URLs
    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      return { success: true, filename };
    } catch {
      // Direct anchor click fallback
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true, filename };
    }
  } catch (err) {
    console.error('[AIStudio] Failed to download image locally:', err);
    return { success: false, filename: '' };
  }
}
