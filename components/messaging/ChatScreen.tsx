import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Mic,
  Check,
  CheckCheck,
  ExternalLink,
  ShieldCheck,
  Paperclip,
  X,
  Play,
  Loader2,
  FileVideo,
} from 'lucide-react';
import { Conversation, Message, MessageType } from '../../types/messaging';
import { UserProfile } from '../../types/community';
import {
  fetchConversationMessages,
  sendMessage,
  markConversationAsRead,
  subscribeToConversationMessages,
} from '../../services/messagingService';
import AudioMessagePlayer from './AudioMessagePlayer';
import VoiceRecorder from './VoiceRecorder';

interface ChatScreenProps {
  conversationId: string;
  partnerProfile?: UserProfile;
  partnerId?: string;
  currentUserId: string;
  currentUserProfile?: UserProfile;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  conversationId,
  partnerProfile,
  partnerId,
  currentUserId,
  currentUserProfile,
  onBack,
  onViewProfile,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // File attachment preview state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null);
  const [pendingFileType, setPendingFileType] = useState<MessageType>('image');

  // Zoomed image modal
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Scroll smoothly to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Initial Load of Messages & Mark as Read
  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const { messages: fetched } = await fetchConversationMessages(conversationId);
        if (isMounted) {
          setMessages(fetched);
          setIsLoading(false);
          setTimeout(() => scrollToBottom('auto'), 100);
        }
      } catch (err) {
        console.warn('[ChatScreen] Load error:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadMessages();
    markConversationAsRead(conversationId, currentUserId);

    // 2. Real-time Subscription
    const unsubscribe = subscribeToConversationMessages(conversationId, (newMsg) => {
      if (!isMounted) return;
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(() => scrollToBottom('smooth'), 100);
      markConversationAsRead(conversationId, currentUserId);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [conversationId, currentUserId]);

  // Handle Text Send
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Optimistic message
    const optimisticId = `optimistic_${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      conversationId,
      senderId: currentUserId,
      content: textToSend,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      isRead: false,
      senderProfile: currentUserProfile,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const { message, error } = await sendMessage({
        conversationId,
        senderId: currentUserId,
        content: textToSend,
        messageType: 'text',
        senderProfile: currentUserProfile,
      });

      if (message) {
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? message : m)));
      } else if (error) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, isPending: false, error } : m))
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId ? { ...m, isPending: false, error: 'Failed to deliver' } : m
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  // Handle Voice Message Send
  const handleSendVoice = async (audioBlob: Blob, durationSeconds: number) => {
    setIsRecordingVoice(false);
    setIsSending(true);

    const optimisticId = `optimistic_voice_${Date.now()}`;
    const optimisticUrl = URL.createObjectURL(audioBlob);

    const optimisticMsg: Message = {
      id: optimisticId,
      conversationId,
      senderId: currentUserId,
      content: 'Voice note',
      messageType: 'voice',
      mediaUrl: optimisticUrl,
      mediaMetadata: { duration: durationSeconds, mimeType: audioBlob.type },
      createdAt: new Date().toISOString(),
      isRead: false,
      senderProfile: currentUserProfile,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
        type: audioBlob.type || 'audio/webm',
      });

      const { message, error } = await sendMessage({
        conversationId,
        senderId: currentUserId,
        content: 'Voice note',
        messageType: 'voice',
        mediaFile: audioFile,
        mediaMetadata: { duration: durationSeconds, mimeType: audioBlob.type },
        senderProfile: currentUserProfile,
      });

      if (message) {
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? message : m)));
      } else if (error) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, isPending: false, error } : m))
        );
      }
    } catch (err) {
      console.warn('[ChatScreen] Send voice error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle File Selection (Photo / Video)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    setPendingFileType(isVideo ? 'video' : 'image');
    setPendingFile(file);

    const previewUrl = URL.createObjectURL(file);
    setPendingFilePreview(previewUrl);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cancel Pending File
  const handleCancelPendingFile = () => {
    if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview);
    setPendingFile(null);
    setPendingFilePreview(null);
  };

  // Send Pending File (Photo / Video)
  const handleSendPendingFile = async () => {
    if (!pendingFile || isSending) return;

    setIsSending(true);
    const optimisticId = `optimistic_media_${Date.now()}`;
    const optimisticUrl = pendingFilePreview || '';

    const optimisticMsg: Message = {
      id: optimisticId,
      conversationId,
      senderId: currentUserId,
      content: inputText.trim(),
      messageType: pendingFileType,
      mediaUrl: optimisticUrl,
      mediaMetadata: {
        fileName: pendingFile.name,
        size: pendingFile.size,
        mimeType: pendingFile.type,
      },
      createdAt: new Date().toISOString(),
      isRead: false,
      senderProfile: currentUserProfile,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    const fileToUpload = pendingFile;
    const textCaption = inputText.trim();
    const mediaType = pendingFileType;

    // Reset preview
    setPendingFile(null);
    setPendingFilePreview(null);
    setInputText('');

    try {
      const { message, error } = await sendMessage({
        conversationId,
        senderId: currentUserId,
        content: textCaption,
        messageType: mediaType,
        mediaFile: fileToUpload,
        mediaMetadata: {
          fileName: fileToUpload.name,
          size: fileToUpload.size,
          mimeType: fileToUpload.type,
        },
        senderProfile: currentUserProfile,
      });

      if (message) {
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? message : m)));
      } else if (error) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, isPending: false, error } : m))
        );
      }
    } catch (err) {
      console.warn('[ChatScreen] Media send error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Format message time
  const formatMessageTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const partnerName = partnerProfile?.name || 'Metfa Creator';
  const partnerUsername = partnerProfile?.username ? `@${partnerProfile.username}` : '';
  const partnerAvatar =
    partnerProfile?.avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerId || 'partner'}`;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* 1. Chat Header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            title="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Partner Avatar & Info */}
          <div
            className="flex items-center gap-2.5 min-w-0 cursor-pointer"
            onClick={() => {
              if (onViewProfile && (partnerProfile?.id || partnerId)) {
                onViewProfile(partnerProfile?.id || partnerId || '');
              }
            }}
          >
            <div className="relative shrink-0">
              <img
                src={partnerAvatar}
                alt={partnerName}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerId || 'partner'}`;
                }}
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-slate-900 truncate">
                  {partnerName}
                </span>
                {partnerProfile?.isVerified && (
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                )}
              </div>
              <span className="text-xs text-slate-500 truncate">
                {partnerUsername || 'Active now'}
              </span>
            </div>
          </div>
        </div>

        {/* View Profile Action */}
        {onViewProfile && (partnerProfile?.id || partnerId) && (
          <button
            type="button"
            onClick={() => onViewProfile(partnerProfile?.id || partnerId || '')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-xl transition border border-teal-200"
          >
            <span>View Profile</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. Messages Scroll Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            <span className="text-xs font-medium">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-center p-6 text-slate-500">
            <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center mb-3">
              <img
                src={partnerAvatar}
                alt={partnerName}
                className="w-12 h-12 rounded-full object-cover"
              />
            </div>
            <h4 className="font-bold text-slate-800 text-base">{partnerName}</h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Start a real-time 1-to-1 conversation. Send a text, photo, video, or voice recording.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-xs transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-br-xs'
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  {/* Photo Attachment */}
                  {msg.messageType === 'image' && msg.mediaUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden cursor-pointer border border-black/10">
                      <img
                        src={msg.mediaUrl}
                        alt="Photo attachment"
                        className="max-h-72 w-full object-cover hover:opacity-95 transition"
                        onClick={() => setZoomedImageUrl(msg.mediaUrl || null)}
                      />
                    </div>
                  )}

                  {/* Video Attachment */}
                  {msg.messageType === 'video' && msg.mediaUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-black/10 bg-black">
                      <video
                        src={msg.mediaUrl}
                        controls
                        className="max-h-72 w-full rounded-xl"
                        playsInline
                      />
                    </div>
                  )}

                  {/* Voice Note Attachment */}
                  {msg.messageType === 'voice' && msg.mediaUrl && (
                    <AudioMessagePlayer
                      src={msg.mediaUrl}
                      duration={msg.mediaMetadata?.duration}
                      isCurrentUser={isMe}
                    />
                  )}

                  {/* Text Content */}
                  {msg.content && msg.content !== 'Voice note' && (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  )}

                  {/* Metadata Row: Timestamp + Read Status */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isMe ? 'text-teal-100/80' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatMessageTime(msg.createdAt)}</span>

                    {isMe && (
                      <span className="ml-0.5">
                        {msg.isPending ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : msg.isRead ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                        ) : (
                          <Check className="w-3 h-3 text-white/70" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delivery Error Indicator */}
                {msg.error && (
                  <span className="text-[10px] text-rose-500 font-semibold mt-1">
                    {msg.error}
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Pending File Attachment Preview Modal Bar */}
      {pendingFile && pendingFilePreview && (
        <div className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3 min-w-0">
            {pendingFileType === 'video' ? (
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-700">
                <FileVideo className="w-6 h-6 text-teal-400" />
              </div>
            ) : (
              <img
                src={pendingFilePreview}
                alt="Upload preview"
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-700"
              />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white truncate">
                {pendingFile.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {(pendingFile.size / 1024 / 1024).toFixed(2)} MB • Ready to send
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancelPendingFile}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSendPendingFile}
              disabled={isSending}
              className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Send Media'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Voice Recorder Bar (When active) */}
      {isRecordingVoice ? (
        <div className="p-3 bg-white border-t border-slate-200">
          <VoiceRecorder
            onSendVoice={handleSendVoice}
            onCancel={() => setIsRecordingVoice(false)}
            isSending={isSending}
          />
        </div>
      ) : (
        /* 5. Standard Message Composer Bar */
        <div className="bg-white border-t border-slate-200 px-3 py-2.5 shrink-0">
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              className="hidden"
            />

            {/* Media Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-xl transition shrink-0"
              title="Attach photo or video"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message ${partnerName}...`}
              className="flex-1 bg-slate-100 border border-slate-200/80 focus:border-teal-500 focus:bg-white text-slate-900 text-sm rounded-2xl px-3.5 py-2.5 outline-none transition placeholder:text-slate-400"
            />

            {/* If there is text, show Send button; otherwise show Mic for Voice note */}
            {inputText.trim().length > 0 ? (
              <button
                type="submit"
                disabled={isSending}
                className="w-10 h-10 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition disabled:opacity-50"
                title="Send message"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 ml-0.5" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 flex items-center justify-center shrink-0 transition active:scale-95"
                title="Record voice note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        </div>
      )}

      {/* 6. Image Zoom Lightbox Modal */}
      {zoomedImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setZoomedImageUrl(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedImageUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={zoomedImageUrl}
            alt="Zoomed attachment"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default ChatScreen;
