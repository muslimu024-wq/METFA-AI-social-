import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Mic,
  Volume2,
  Download,
  Share2,
  RotateCcw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Music,
} from 'lucide-react';
import { ProcessedMediaResult, AudioOperation, ProcessingState } from '../types';
import {
  decodeAudioFile,
  trimAudioBuffer,
  cleanVoiceAudioBuffer,
  improveSoundAudioBuffer,
  exportAudioBufferResult,
  blobToDataUrl,
  isWebAudioSupported,
} from '../utils/audioProcessor';

interface AudioEditorViewProps {
  originalFile: File;
  onBack: () => void;
  onPostToSocial: (processedResult: ProcessedMediaResult) => void;
}

export const AudioEditorView: React.FC<AudioEditorViewProps> = ({
  originalFile,
  onBack,
  onPostToSocial,
}) => {
  // Audio playback source (initialized with direct object URL for instant, low-memory playback)
  const [audioSrc, setAudioSrc] = useState<string>('');
  const [originalBlobUrl, setOriginalBlobUrl] = useState<string>('');

  // AudioBuffer representations (loaded asynchronously)
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [currentBuffer, setCurrentBuffer] = useState<AudioBuffer | null>(null);
  const [currentResult, setCurrentResult] = useState<ProcessedMediaResult | null>(null);
  const [isEdited, setIsEdited] = useState(false);
  const [isDecodingAudio, setIsDecodingAudio] = useState(false);

  // Playback state via HTML5 Audio element
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Trim Panel State
  const [showTrimPanel, setShowTrimPanel] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Processing & Feedback State
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    operationName: '',
    progressPercent: 0,
    statusText: '',
    error: null,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize source audio with lightweight object URL first
  useEffect(() => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(originalFile);
      setOriginalBlobUrl(objectUrl);
      setAudioSrc(objectUrl);

      if (!isWebAudioSupported()) {
        setProcessing((p) => ({
          ...p,
          error: 'Web Audio API is not supported in this browser. You can still preview your sound.',
        }));
        return;
      }

      // Asynchronously decode audio in the background without heavy WAV re-encoding
      setIsDecodingAudio(true);
      decodeAudioFile(originalFile)
        .then((decoded) => {
          setOriginalBuffer(decoded);
          setCurrentBuffer(decoded);
          const d = decoded.duration;
          if (isFinite(d) && !isNaN(d) && d > 0) {
            setDuration(d);
            setTrimEnd(Math.max(1, d));
          }
          setIsDecodingAudio(false);
        })
        .catch((err) => {
          console.warn('[AudioEditor] Background audio decoding note:', err);
          setIsDecodingAudio(false);
          // Keep audioSrc active so user can still listen via HTML5 audio element
        });
    } catch (err: any) {
      setProcessing((p) => ({
        ...p,
        error: 'Error reading audio file: ' + (err.message || 'Unknown error'),
      }));
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [originalFile]);

  // Audio time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      const d = audioRef.current.duration;
      if ((duration === 0 || !isFinite(duration)) && isFinite(d) && !isNaN(d) && d > 0) {
        setDuration(d);
        if (trimEnd === 0 || trimEnd > d) setTrimEnd(d);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) {
        setDuration(d);
        if (trimEnd === 0 || trimEnd > d) setTrimEnd(d);
      }
    }
  };

  const togglePlayPause = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Execute a real audio operation (Trim, Clean Voice, Improve Sound)
  const handleExecuteOperation = async (operation: AudioOperation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!currentBuffer) {
      // If still decoding or decode failed
      if (isDecodingAudio) {
        setProcessing((p) => ({
          ...p,
          error: 'Audio decoding is in progress. Please wait a moment...',
        }));
      } else {
        setProcessing((p) => ({
          ...p,
          error: 'Could not decode audio track for processing. Format may be unsupported by Web Audio.',
        }));
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    const opLabels: Record<AudioOperation, string> = {
      trim: 'Trimming audio',
      clean_voice: 'Filtering voice & reducing rumble',
      improve_sound: 'Optimizing dynamic balance & tone',
    };

    setProcessing({
      isProcessing: true,
      operationName: opLabels[operation],
      progressPercent: 30,
      statusText: 'Processing with Web Audio API...',
      error: null,
    });

    try {
      let nextBuffer: AudioBuffer;

      if (operation === 'trim') {
        const safeStart = Math.max(0, trimStart);
        const safeEnd = Math.max(safeStart + 0.1, trimEnd || duration);
        nextBuffer = await trimAudioBuffer(currentBuffer, safeStart, safeEnd);
      } else if (operation === 'clean_voice') {
        nextBuffer = await cleanVoiceAudioBuffer(currentBuffer);
      } else {
        nextBuffer = await improveSoundAudioBuffer(currentBuffer);
      }

      setProcessing((p) => ({
        ...p,
        progressPercent: 75,
        statusText: 'Encoding 16-bit WAV...',
      }));

      const exported = await exportAudioBufferResult(
        nextBuffer,
        originalFile.name,
        [...(currentResult?.appliedOperations || []), operation]
      );

      // Update state
      setCurrentBuffer(nextBuffer);
      setCurrentResult(exported);
      setAudioSrc(exported.dataUrl);
      setIsEdited(true);
      setShowTrimPanel(false);

      const newDur = nextBuffer.duration;
      setDuration(newDur);
      setTrimStart(0);
      setTrimEnd(newDur);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }

      setProcessing({
        isProcessing: false,
        operationName: '',
        progressPercent: 100,
        statusText: '',
        error: null,
      });

      showToast(`🎙️ ${opLabels[operation]} applied successfully!`);
    } catch (err: any) {
      console.error('[AudioEditor] Operation failed:', err);
      setProcessing({
        isProcessing: false,
        operationName: '',
        progressPercent: 0,
        statusText: '',
        error: `Audio operation failed: ${err.message || 'Unknown error'}. Original audio preserved.`,
      });
    }
  };

  // Revert back to original audio
  const handleRevertToOriginal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    setCurrentBuffer(originalBuffer);
    setCurrentResult(null);
    setAudioSrc(originalBlobUrl);
    setIsEdited(false);
    setShowTrimPanel(false);

    if (originalBuffer) {
      setDuration(originalBuffer.duration);
      setTrimStart(0);
      setTrimEnd(originalBuffer.duration);
    }
    showToast('Reverted to original audio.');
  };

  // Download locally
  const handleSaveToDevice = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let blobToSave: Blob = originalFile;
      let filename = originalFile.name;

      if (currentResult?.blob) {
        blobToSave = currentResult.blob;
        filename = currentResult.name;
      } else if (currentBuffer) {
        const exp = await exportAudioBufferResult(currentBuffer, originalFile.name);
        blobToSave = exp.blob;
        filename = exp.name;
      }

      const downloadUrl = URL.createObjectURL(blobToSave);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'audio.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        try {
          URL.revokeObjectURL(downloadUrl);
        } catch {}
      }, 4000);

      showToast('💾 Audio saved to downloads!');
    } catch (err: any) {
      showToast('Error saving audio: ' + err.message);
    }
  };

  // Post to METFA Social
  const handlePost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let resultToPost = currentResult;
      if (!resultToPost) {
        if (currentBuffer) {
          resultToPost = await exportAudioBufferResult(currentBuffer, originalFile.name);
        } else {
          // Direct fallback from originalFile
          const dataUrl = await blobToDataUrl(originalFile);
          resultToPost = {
            type: 'audio',
            blob: originalFile,
            dataUrl,
            name: originalFile.name,
            sizeBytes: originalFile.size,
            mimeType: originalFile.type || 'audio/wav',
            durationSeconds: duration || 1,
            appliedOperations: [],
          };
        }
      }
      onPostToSocial(resultToPost);
    } catch (err: any) {
      setProcessing((p) => ({
        ...p,
        error: 'Failed to prepare audio for posting: ' + err.message,
      }));
    }
  };

  const safeDuration = isFinite(duration) && !isNaN(duration) && duration >= 0 ? duration : 0;
  const safeCurrentTime =
    isFinite(currentTime) && !isNaN(currentTime) && currentTime >= 0 ? currentTime : 0;

  return (
    <div
      className="flex flex-col h-full w-full bg-slate-900 text-white select-none overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
            🎙 Audio Editor
          </span>
          {isEdited && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
              Edited
            </span>
          )}
        </div>

        {isEdited && (
          <button
            type="button"
            onClick={handleRevertToOriginal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition cursor-pointer"
            title="Revert all edits to original audio"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Main Audio Waveform Viewport */}
      <div className="relative flex-1 min-h-[220px] max-h-[360px] bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 border-b border-slate-800">
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Ambient Pulsing Glow Circle */}
        <div
          className={`w-32 h-32 rounded-full flex items-center justify-center transition-transform duration-300 ${
            isPlaying
              ? 'scale-110 bg-teal-500/20 border-2 border-teal-400 shadow-2xl shadow-teal-500/40 animate-pulse'
              : 'bg-slate-800/80 border border-slate-700'
          }`}
        >
          <Music className={`w-12 h-12 ${isPlaying ? 'text-teal-300' : 'text-slate-400'}`} />
        </div>

        {/* Big Central Play/Pause Touch Target */}
        <button
          type="button"
          onClick={togglePlayPause}
          className="mt-6 w-16 h-16 rounded-full bg-teal-500 hover:bg-teal-400 flex items-center justify-center text-slate-950 font-bold transition transform active:scale-90 cursor-pointer shadow-xl shadow-teal-500/30 z-10"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 fill-slate-950" />
          ) : (
            <Play className="w-7 h-7 fill-slate-950 ml-1" />
          )}
        </button>

        {/* Time Progress */}
        <div className="mt-4 px-3 py-1 rounded-lg bg-black/60 text-xs font-mono font-bold text-slate-200 border border-white/10 z-10">
          {safeCurrentTime.toFixed(1)}s / {safeDuration.toFixed(1)}s
        </div>

        {/* Processing Spinner Overlay */}
        {processing.isProcessing && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
            <Loader2 className="w-10 h-10 text-teal-400 animate-spin mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">
              {processing.operationName}
            </h4>
            <p className="text-xs text-slate-300 mb-3">{processing.statusText}</p>
            <div className="w-48 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-teal-500 to-purple-400 h-full transition-all duration-200"
                style={{ width: `${processing.progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Notifications & Error Banners */}
      {processing.error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="flex-1">{processing.error}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setProcessing((p) => ({ ...p, error: null }));
            }}
            className="text-xs underline text-rose-300 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {toastMessage && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Trim Adjustment Drawer */}
      {showTrimPanel && !processing.isProcessing && (
        <div className="m-4 p-4 rounded-2xl bg-slate-800/90 border border-teal-500/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
              <Scissors className="w-4 h-4" />
              <span>Trim Audio Duration</span>
            </span>
            <span className="text-xs font-mono text-slate-300">
              {trimStart.toFixed(1)}s — {trimEnd.toFixed(1)}s (Duration: {(trimEnd - trimStart).toFixed(1)}s)
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Start Point</span>
                <span>{trimStart.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(0.1, safeDuration - 0.5)}
                step="0.1"
                value={trimStart}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTrimStart(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                className="w-full accent-teal-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>End Point</span>
                <span>{trimEnd.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={trimStart + 0.2}
                max={Math.max(1, safeDuration)}
                step="0.1"
                value={trimEnd}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTrimEnd(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                className="w-full accent-teal-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={(e) => handleExecuteOperation('trim', e)}
              className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold text-xs text-white transition active:scale-95 cursor-pointer shadow-md"
            >
              Apply Trim
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTrimPanel(false);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 3 Large One-Tap Action Buttons (Nokia 1100 Simplicity) */}
      <div className="p-4 grid grid-cols-3 gap-2 shrink-0">
        {/* 1. Trim */}
        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={(e) => {
            e.stopPropagation();
            setShowTrimPanel((prev) => !prev);
          }}
          className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer ${
            showTrimPanel
              ? 'bg-teal-900/40 border-teal-500 text-teal-200'
              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white'
          }`}
        >
          <div className="p-2 rounded-xl bg-teal-600/30 text-teal-400">
            <Scissors className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold">Trim</span>
          <span className="text-[10px] text-slate-400">Cut ends</span>
        </button>

        {/* 2. Clean Voice */}
        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={(e) => handleExecuteOperation('clean_voice', e)}
          className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-center flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
            <Mic className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold">Clean Voice</span>
          <span className="text-[10px] text-slate-400">Speech EQ</span>
        </button>

        {/* 3. Improve Sound */}
        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={(e) => handleExecuteOperation('improve_sound', e)}
          className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-center flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
            <Volume2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold">Improve</span>
          <span className="text-[10px] text-slate-400">Sweeten tone</span>
        </button>
      </div>

      {/* Bottom Output Row (3 Big Primary Action Buttons) */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 mt-auto flex flex-col sm:flex-row gap-2 shrink-0">
        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={togglePlayPause}
          className="flex-1 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-200 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isPlaying ? 'Pause' : 'Preview'}</span>
        </button>

        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={handleSaveToDevice}
          className="flex-1 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-200 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <Download className="w-4 h-4 text-teal-400" />
          <span>Save (.wav)</span>
        </button>

        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={handlePost}
          className="flex-[1.5] py-3 px-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 font-bold text-xs text-slate-950 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-lg"
        >
          <Share2 className="w-4 h-4" />
          <span>Post to METFA Social</span>
        </button>
      </div>
    </div>
  );
};
