import { ChatAttachment } from '../types/chat';

export const fileToAttachment = (file: File): Promise<ChatAttachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      const base64Clean = result.includes(',') ? result.split(',')[1] : result;
      let type: ChatAttachment['type'] = 'document';

      if (file.type.startsWith('image/')) {
        type = 'image';
      } else if (file.type.startsWith('video/')) {
        type = 'video';
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
      } else if (
        file.name.endsWith('.js') ||
        file.name.endsWith('.ts') ||
        file.name.endsWith('.tsx') ||
        file.name.endsWith('.py') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.html') ||
        file.name.endsWith('.css')
      ) {
        type = 'code';
      }

      resolve({
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        name: file.name,
        size: file.size,
        mimeType: file.type || (type === 'image' ? 'image/png' : 'application/octet-stream'),
        previewUrl: result,
        base64: base64Clean,
      });
    };

    reader.onerror = (err) => reject(err);

    if (file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.py')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
};

export const formatBytes = (bytes: number, decimals = 1): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
