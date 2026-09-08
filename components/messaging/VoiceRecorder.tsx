import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, AlertCircle, RefreshCw } from 'lucide-react';

interface VoiceRecorderProps {
  onSendVoice: (audioBlob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
  isSending?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSendVoice,
  onCancel,
  isSending = false,
}) => {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Clean up media streams and players on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Request mic and start recording automatically on mount
  useEffect(() => {
    startRecording();
  }, []);

  const startRecording = async () => {
    setPermissionError(null);
    setAudioChunksRef([]);
    setDuration(0);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError('Microphone audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported audio mime type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        setRecordingState('preview');

        // Stop mic tracks once recording stops
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(250); // Collect data slices every 250ms
      setRecordingState('recording');

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('[VoiceRecorder] Mic error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Microphone access was denied. Please allow microphone permissions in your browser to record voice notes.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('No microphone was detected on this device.');
      } else {
        setPermissionError(err.message || 'Could not access microphone.');
      }
      setRecordingState('idle');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    onCancel();
  };

  const handleSend = () => {
    if (!audioBlob) return;
    onSendVoice(audioBlob, duration);
  };

  const togglePlayPreview = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingPreview) {
      audioPlayerRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPlayerRef.current.play().then(() => {
        setIsPlayingPreview(true);
      }).catch((e) => {
        console.warn('Playback error:', e);
      });
    }
  };

  const setAudioChunksRef = (val: any) => {
    audioChunksRef.current = val;
  };

  if (permissionError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-start gap-2.5 text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold">Microphone Unavailable</p>
            <p className="mt-0.5 text-rose-600">{permissionError}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold rounded-xl"
          >
            Close
          </button>
          <button
            type="button"
            onClick={startRecording}
            className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-lg border border-slate-800 flex items-center justify-between gap-3 animate-fadeIn">
      {/* 1. Recording Live State */}
      {recordingState === 'recording' && (
        <>
          <div className="flex items-center gap-3 min-w-0">
            {/* Blinking recording indicator */}
            <div className="relative flex items-center justify-center w-7 h-7 shrink-0">
              <span className="absolute w-full h-full rounded-full bg-rose-500/40 animate-ping" />
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500" />
            </div>

            {/* Timer */}
            <div className="flex flex-col">
              <span className="font-mono text-xs sm:text-sm font-bold tracking-wider text-rose-400">
                {formatTime(duration)}
              </span>
              <span className="text-[10px] text-slate-400">Recording voice note...</span>
            </div>

            {/* Animated Waveform Bars */}
            <div className="hidden sm:flex items-center gap-1 ml-2">
              <span className="w-1 h-3 bg-teal-400 rounded-full animate-pulse" />
              <span className="w-1 h-5 bg-teal-400 rounded-full animate-pulse delay-75" />
              <span className="w-1 h-7 bg-teal-400 rounded-full animate-pulse delay-150" />
              <span className="w-1 h-4 bg-teal-400 rounded-full animate-pulse delay-100" />
              <span className="w-1 h-6 bg-teal-400 rounded-full animate-pulse delay-200" />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Stop and Preview Button */}
            <button
              type="button"
              onClick={stopRecording}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Done</span>
            </button>
          </div>
        </>
      )}

      {/* 2. Audio Preview State */}
      {recordingState === 'preview' && (
        <>
          <audio
            ref={audioPlayerRef}
            src={audioUrl || undefined}
            onTimeUpdate={() => {
              if (audioPlayerRef.current) {
                setPreviewCurrentTime(audioPlayerRef.current.currentTime);
              }
            }}
            onEnded={() => {
              setIsPlayingPreview(false);
              setPreviewCurrentTime(0);
            }}
          />

          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlayPreview}
              className="w-9 h-9 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md transition active:scale-95"
              title={isPlayingPreview ? 'Pause preview' : 'Play preview'}
            >
              {isPlayingPreview ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Playback progress & duration */}
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span>{formatTime(previewCurrentTime)}</span>
                <span className="text-slate-400">{formatTime(duration)}</span>
              </div>
              {/* Progress track */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-teal-400 h-full transition-all duration-100"
                  style={{
                    width: duration > 0 ? `${(previewCurrentTime / duration) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Discard recording */}
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              title="Discard recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Send Voice Message */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Send'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceRecorder;
