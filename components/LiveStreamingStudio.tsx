import React, { useState, useRef, useEffect } from 'react';
import {
  Radio,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Users,
  Heart,
  Send,
  Sparkles,
  StopCircle,
  Play,
  Share2,
  Wand2
} from 'lucide-react';
import { LiveStream, LiveStreamMessage, UserProfile } from '../types/community';

interface LiveStreamingStudioProps {
  userProfile: UserProfile;
}

export const LiveStreamingStudio: React.FC<LiveStreamingStudioProps> = ({ userProfile }) => {
  const [isLive, setIsLive] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(142);
  const [likesCount, setLikesCount] = useState(620);
  const [messages, setMessages] = useState<LiveStreamMessage[]>([
    {
      id: 'lm_1',
      userId: 'user_marcus',
      userName: 'Marcus Vance',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      text: 'Great stream! Can you show how to blend atmospheric volumetric fog?',
      timestamp: '1m ago',
    },
    {
      id: 'lm_2',
      userId: 'user_ai',
      userName: 'Metfa Social Copilot',
      userAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100',
      text: '🤖 Live Tip: Try including "god rays, morning haze, 50mm f/1.4" in your lighting parameter prompt.',
      timestamp: 'Just now',
      isAI: true,
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const handleStartLive = async () => {
    try {
      localStorage.setItem('has_granted_permissions', 'true');
      localStorage.setItem('metfa_media_permissions_granted', 'granted');
    } catch {
      // ignore
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        handlePermissionsGranted(stream);
        return;
      } catch (err: any) {
        console.warn('getUserMedia video+audio notice, falling back to audio:', err);
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          handlePermissionsGranted(audioOnlyStream);
          return;
        } catch (err2) {
          console.warn('Live stream media access:', err2);
          handlePermissionsGranted();
          return;
        }
      }
    }
    handlePermissionsGranted();
  };

  const handlePermissionsGranted = (stream?: MediaStream) => {
    setIsLive(true);
    if (stream && videoRef.current) {
      mediaStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  };

  const handleStopLive = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg: LiveStreamMessage = {
      id: `lm_${Date.now()}`,
      userId: userProfile.id,
      userName: userProfile.name,
      userAvatar: userProfile.avatar,
      text: chatInput.trim(),
      timestamp: 'Just now',
      isHost: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    setChatInput('');
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Stream Control Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center">
              <Radio className={`w-5 h-5 ${isLive ? 'text-rose-500 animate-pulse' : 'text-gray-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Live Broadcasting Studio</h3>
                {isLive && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase animate-pulse">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">Stream creative workflows and AI tutorials in real time</p>
            </div>
          </div>

          <div>
            {!isLive ? (
              <button
                type="button"
                onClick={handleStartLive}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition transform active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Go Live</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopLive}
                className="px-4 py-2 bg-gray-800 hover:bg-red-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>End Stream</span>
              </button>
            )}
          </div>
        </div>

        {/* Video Stage & Chat Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Video Viewport */}
          <div className="lg:col-span-2 relative rounded-2xl overflow-hidden bg-black border border-gray-800 aspect-video flex items-center justify-center">
            {isLive ? (
              <video ref={videoRef} className="w-full h-full object-cover" muted autoPlay playsInline />
            ) : (
              <div className="text-center p-6 space-y-2">
                <Radio className="w-12 h-12 text-gray-600 mx-auto" />
                <h4 className="text-sm font-bold text-gray-300">Live Broadcast is Offline</h4>
                <p className="text-xs text-gray-500 max-w-xs">
                  Click "Go Live" to grant camera and microphone access and start your stream.
                </p>
              </div>
            )}

            {/* Live Badges Overlay */}
            {isLive && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold text-white flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-teal-400" />
                  <span>{viewerCount} viewers</span>
                </span>
                <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold text-rose-300 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>{likesCount}</span>
                </span>
              </div>
            )}
          </div>

          {/* Live Chat & Copilot Insights */}
          <div className="bg-gray-950 rounded-2xl border border-gray-800 p-3 flex flex-col justify-between h-80 lg:h-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <span className="text-xs font-bold text-gray-300">Live Viewer Chat</span>
              <span className="text-[10px] text-teal-400 flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3" /> AI Copilot Active
              </span>
            </div>

            {/* Chat message stream */}
            <div className="flex-1 overflow-y-auto py-2 space-y-2.5 scrollbar-thin">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-2 rounded-xl text-xs ${
                    m.isAI
                      ? 'bg-purple-950/40 border border-purple-800/40 text-purple-200'
                      : m.isHost
                      ? 'bg-rose-950/30 border border-rose-800/40 text-rose-100'
                      : 'bg-gray-900 text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-[11px] text-white">{m.userName}</span>
                    <span className="text-[9px] text-gray-500">{m.timestamp}</span>
                  </div>
                  <p className="leading-snug">{m.text}</p>
                </div>
              ))}
            </div>

            {/* Message input */}
            <div className="pt-2 border-t border-gray-800 flex items-center gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Chat with viewers..."
                className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs transition"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamingStudio;
