import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Sparkles,
  Volume2,
  Film,
  Download,
  Share2,
  RotateCcw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Trash2,
  Layers,
} from 'lucide-react';
import { ProcessedMediaResult, VideoOperation, ProcessingState, VideoClipItem } from '../types';
import {
  renderProcessedVideo,
  isMediaRecorderSupported,
  createSafeVideoBlobUrl,
  inspectVideoFileFormat,
  VideoFormatAnalysis,
} from '../utils/videoProcessor';
import { blobToDataUrl } from '../utils/audioProcessor';

interface VideoEditorViewProps {
  initialFiles: File[];
  originalFile?: File; // backwards-compatibility
  onBack: () => void;
  onPostToSocial: (dataUrl: string, isReel: boolean, name: string) => void;
}

export const VideoEditorView: React.FC<VideoEditorViewProps> = ({
  initialFiles,
  originalFile,
  onBack,
  onPostToSocial,
}) => {
  // Guard handed-off object URLs from being revoked when this editor unmounts
  const handedOffUrlsRef = useRef<Set<string>>(new Set());
  const [activeFormatAnalysis, setActiveFormatAnalysis] = useState<VideoFormatAnalysis | null>(null);

  // Clips state (supports 1 or multiple video clips in a single session)
  const [clips, setClips] = useState<VideoClipItem[]>(() => {
    const incoming =
      initialFiles && initialFiles.length > 0
        ? initialFiles
        : originalFile
        ? [originalFile]
        : [];
    return incoming.map((f, i) => {
      const url = createSafeVideoBlobUrl(f);
      return {
        id: `clip_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        name: f.name,
        originalUrl: url,
        currentUrl: url,
        result: null,
        isEdited: false,
        durationSeconds: 0,
      };
    });
  });

  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const activeClip = clips[activeClipIndex] || clips[0];

  // Video playback
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const addClipInputRef = useRef<HTMLInputElement | null>(null);
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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Preview playback & loading states
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Sync active clip changes into player state
  useEffect(() => {
    if (!activeClip) return;

    setPreviewLoading(true);
    setPreviewError(null);

    // Fast binary format inspection to detect container & codec without decoder competition
    inspectVideoFileFormat(activeClip.file)
      .then((analysis) => {
        setActiveFormatAnalysis(analysis);
        if (analysis.isUnsupportedCodec) {
          setPreviewLoading(false);
          setPreviewError(analysis.recoveryAdvice || 'Unsupported video format or codec for in-browser playback.');
        }
      })
      .catch((err) => {
        console.warn('[VideoEditor] Binary format inspection note:', err);
      });

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
      setIsPlaying(false);
    }
    setCurrentTime(0);

    // Bounded safety timer: ensure preview loading spinner never spins indefinitely
    const previewSafetyTimer = setTimeout(() => {
      setPreviewLoading(false);
    }, 3500);

    // If duration already cached, update immediately
    if (activeClip.durationSeconds > 0) {
      setDuration(activeClip.durationSeconds);
      setTrimStart(0);
      setTrimEnd(activeClip.durationSeconds);
    }

    return () => {
      clearTimeout(previewSafetyTimer);
    };
  }, [activeClipIndex, activeClip?.currentUrl]);

  // Clean up object URLs on component unmount, while preserving handed-off URLs
  useEffect(() => {
    return () => {
      clips.forEach((c) => {
        try {
          if (c.originalUrl && !handedOffUrlsRef.current.has(c.originalUrl)) {
            URL.revokeObjectURL(c.originalUrl);
          }
          if (
            c.currentUrl &&
            c.currentUrl !== c.originalUrl &&
            c.currentUrl.startsWith('blob:') &&
            !handedOffUrlsRef.current.has(c.currentUrl)
          ) {
            URL.revokeObjectURL(c.currentUrl);
          }
        } catch {}
      });
    };
  }, []);

  // Time tracking on player
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      let d = videoRef.current.duration;
      if (!isFinite(d) || isNaN(d) || d <= 0) {
        if (videoRef.current.seekable && videoRef.current.seekable.length > 0) {
          try {
            const sEnd = videoRef.current.seekable.end(videoRef.current.seekable.length - 1);
            if (isFinite(sEnd) && sEnd > 0) d = sEnd;
          } catch {}
        }
      }
      if (
        (duration === 0 || !isFinite(duration)) &&
        isFinite(d) &&
        !isNaN(d) &&
        d > 0
      ) {
        setDuration(d);
        if (trimEnd === 0 || trimEnd > d) setTrimEnd(d);
      }
    }
  };

  // Video element loaded metadata handler (mobile-first source of truth)
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setPreviewLoading(false);
      let d = videoRef.current.duration;
      // Android camera recording duration recovery: check seekable range first
      if (!isFinite(d) || isNaN(d) || d <= 0) {
        if (videoRef.current.seekable && videoRef.current.seekable.length > 0) {
          try {
            const sEnd = videoRef.current.seekable.end(videoRef.current.seekable.length - 1);
            if (isFinite(sEnd) && sEnd > 0) d = sEnd;
          } catch {}
        }
      }

      const w = videoRef.current.videoWidth || 640;
      const h = videoRef.current.videoHeight || 480;

      if (isFinite(d) && !isNaN(d) && d > 0) {
        setDuration(d);
        if (trimEnd === 0 || trimEnd > d) setTrimEnd(d);
        setClips((prev) =>
          prev.map((c, idx) =>
            idx === activeClipIndex ? { ...c, durationSeconds: d, width: w, height: h } : c
          )
        );
      } else {
        // Android camera recording duration recovery: listen for durationchange
        const onProbe = () => {
          if (videoRef.current) {
            let discovered = videoRef.current.duration;
            if (!isFinite(discovered) || discovered <= 0) {
              if (videoRef.current.seekable && videoRef.current.seekable.length > 0) {
                try {
                  const sEnd = videoRef.current.seekable.end(videoRef.current.seekable.length - 1);
                  if (isFinite(sEnd) && sEnd > 0) discovered = sEnd;
                } catch {}
              }
            }
            if (isFinite(discovered) && discovered > 0) {
              setDuration(discovered);
              if (trimEnd === 0 || trimEnd > discovered) setTrimEnd(discovered);
              setClips((prev) =>
                prev.map((c, idx) =>
                  idx === activeClipIndex ? { ...c, durationSeconds: discovered, width: w, height: h } : c
                )
              );
            }
          }
        };
        videoRef.current.addEventListener('durationchange', onProbe, { once: true });
      }
    }
  };

  const togglePlayPause = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current || previewError) return;
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((playErr: any) => {
          setIsPlaying(false);
          const err = videoRef.current?.error;
          if (err) {
            const msg =
              err.code === 3
                ? 'Video decode error: The video codec (such as HEVC/H.265 or 10-bit color) is not supported by your browser.'
                : err.code === 4
                ? 'Unsupported video format or codec for in-browser playback.'
                : `Playback error: ${err.message || 'Cannot decode video'}`;
            setPreviewError(msg);
          } else {
            showToast('Playback note: ' + (playErr?.message || 'Tap to play'));
          }
        });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Switch to another clip in the multi-clip list
  const handleSelectClip = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === activeClipIndex || processing.isProcessing) return;
    setShowTrimPanel(false);
    setActiveClipIndex(index);
  };

  // Add more video clips to the current session
  const handleAddClips = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newFiles = e.target.files ? Array.from(e.target.files) : [];
    if (newFiles.length === 0) return;

    const newClipItems: VideoClipItem[] = newFiles.map((f, i) => {
      const url = createSafeVideoBlobUrl(f);
      return {
        id: `clip_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        name: f.name,
        originalUrl: url,
        currentUrl: url,
        result: null,
        isEdited: false,
        durationSeconds: 0,
      };
    });

    setClips((prev) => [...prev, ...newClipItems]);
    showToast(`Added ${newClipItems.length} video clip${newClipItems.length > 1 ? 's' : ''}`);
    if (addClipInputRef.current) addClipInputRef.current.value = '';
  };

  // Remove a clip from multi-clip session
  const handleRemoveClip = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (clips.length <= 1) return;
    const clipToRemove = clips[index];
    try {
      if (clipToRemove.originalUrl) URL.revokeObjectURL(clipToRemove.originalUrl);
    } catch {}

    const remaining = clips.filter((_, i) => i !== index);
    setClips(remaining);
    if (activeClipIndex >= remaining.length) {
      setActiveClipIndex(remaining.length - 1);
    }
    showToast('Removed clip from session.');
  };

  // Execute a real video operation on the active clip
  const handleExecuteOperation = async (
    operation: VideoOperation,
    optStart?: number,
    optEnd?: number
  ) => {
    if (!activeClip) return;

    if (previewError) {
      showToast('⚠️ This clip uses an unsupported codec and cannot be processed in-browser.');
      return;
    }

    if (!isMediaRecorderSupported()) {
      setProcessing((prev) => ({
        ...prev,
        error:
          'Your browser does not support client-side MediaRecorder. Your original video is preserved safely.',
      }));
      return;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    const opLabels: Record<VideoOperation, string> = {
      trim: 'Trimming video',
      enhance: 'Enhancing visual clarity & audio levels',
      clean_audio: 'Filtering background noise & vocal clarity',
      make_reel: 'Cropping to 9:16 vertical Reel',
    };

    setProcessing({
      isProcessing: true,
      operationName: opLabels[operation],
      progressPercent: 0,
      statusText: 'Preparing video frames...',
      error: null,
    });

    try {
      const sourceToProcess = activeClip.currentUrl || activeClip.originalUrl;
      const effectiveStart = optStart ?? (operation === 'trim' ? trimStart : 0);
      const effectiveEnd = optEnd ?? (operation === 'trim' ? (trimEnd > 0 ? trimEnd : undefined) : undefined);

      const result = await renderProcessedVideo({
        sourceUrl: sourceToProcess,
        sourceFile: activeClip.file,
        operation,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        knownDuration: duration > 0 ? duration : (activeClip.durationSeconds > 0 ? activeClip.durationSeconds : undefined),
        originalFileName: activeClip.name,
        onProgress: (percent, status) => {
          setProcessing((prev) => ({
            ...prev,
            progressPercent: percent,
            statusText: status,
          }));
        },
      });

      // Create an efficient Blob URL for playback instead of huge base64 dataUrl
      const editedBlobUrl = URL.createObjectURL(result.blob);

      // Clean up previous edited blob URL if it was created
      if (
        activeClip.currentUrl &&
        activeClip.currentUrl !== activeClip.originalUrl &&
        activeClip.currentUrl.startsWith('blob:')
      ) {
        try {
          URL.revokeObjectURL(activeClip.currentUrl);
        } catch {}
      }

      // Update active clip state
      setClips((prev) =>
        prev.map((c, idx) =>
          idx === activeClipIndex
            ? {
                ...c,
                currentUrl: editedBlobUrl,
                result,
                isEdited: true,
                durationSeconds: result.durationSeconds,
              }
            : c
        )
      );

      setShowTrimPanel(false);
      setDuration(result.durationSeconds);
      setTrimStart(0);
      setTrimEnd(result.durationSeconds);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }

      setProcessing({
        isProcessing: false,
        operationName: '',
        progressPercent: 100,
        statusText: '',
        error: null,
      });

      showToast(`✨ ${opLabels[operation]} applied to clip!`);
    } catch (err: any) {
      console.error('[VideoEditor] Processing failed:', err);
      setProcessing({
        isProcessing: false,
        operationName: '',
        progressPercent: 0,
        statusText: '',
        error: `Processing failed: ${err.message || 'Unknown error'}. Original video preserved.`,
      });
    }
  };

  // Revert active clip back to original untouched file
  const handleRevertToOriginal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeClip) return;
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }

    if (
      activeClip.currentUrl &&
      activeClip.currentUrl !== activeClip.originalUrl &&
      activeClip.currentUrl.startsWith('blob:')
    ) {
      try {
        URL.revokeObjectURL(activeClip.currentUrl);
      } catch {}
    }

    setClips((prev) =>
      prev.map((c, idx) =>
        idx === activeClipIndex
          ? {
              ...c,
              currentUrl: c.originalUrl,
              result: null,
              isEdited: false,
            }
          : c
      )
    );
    setShowTrimPanel(false);
    showToast('Reverted active clip to original.');
  };

  // Download active clip to device
  const handleSaveToDevice = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeClip) return;
    const blobToSave = activeClip.result?.blob || activeClip.file;
    const downloadUrl = URL.createObjectURL(blobToSave);
    const filename = activeClip.result?.name || activeClip.name;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(downloadUrl);
      } catch {}
    }, 4000);

    showToast(`💾 Saved "${filename}" to downloads!`);
  };

  // Sequential Save All clips
  const handleSaveAllClips = (e: React.MouseEvent) => {
    e.stopPropagation();
    clips.forEach((c, idx) => {
      setTimeout(() => {
        const blobToSave = c.result?.blob || c.file;
        const downloadUrl = URL.createObjectURL(blobToSave);
        const filename = c.result?.name || c.name;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          try {
            URL.revokeObjectURL(downloadUrl);
          } catch {}
        }, 4000);
      }, idx * 400);
    });
    showToast(`💾 Saving all ${clips.length} clips to downloads!`);
  };

  // Post active clip to METFA Social
  const handlePost = async (isReel: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeClip) return;
    if (previewError && !activeFormatAnalysis?.isUnsupportedCodec) {
      showToast('⚠️ Cannot post this clip due to playback error.');
      return;
    }
    try {
      let finalUrl = activeClip.result?.dataUrl;
      if (!finalUrl) {
        // Zero-copy object URL provides instant handoff for videos of any duration and size
        finalUrl = URL.createObjectURL(activeClip.file);
      }
      handedOffUrlsRef.current.add(finalUrl);
      const finalName = activeClip.result?.name || activeClip.name;
      onPostToSocial(finalUrl, isReel, finalName);
    } catch (err: any) {
      showToast('Error preparing video for posting: ' + (err?.message || 'Unknown error'));
    }
  };

  // Direct handoff for original unedited video when codec is unsupported for in-browser editing
  const handlePostOriginalDirectly = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeClip) return;
    try {
      const finalUrl = URL.createObjectURL(activeClip.file);
      handedOffUrlsRef.current.add(finalUrl);
      onPostToSocial(finalUrl, false, activeClip.name);
    } catch (err: any) {
      showToast('Error preparing video for posting: ' + (err?.message || 'Unknown error'));
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
      {/* Hidden input for adding more clips */}
      <input
        ref={addClipInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleAddClips}
        className="hidden"
      />

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
          <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
            🎥 Video Editor
          </span>
          {activeClip?.isEdited && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
              Edited
            </span>
          )}
        </div>

        {activeClip?.isEdited && (
          <button
            type="button"
            onClick={handleRevertToOriginal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition cursor-pointer"
            title="Revert active clip to original"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Multi-Clip List Bar (Simple, Touch-Friendly Clip Switcher) */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 shrink-0 mr-1">
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span>Clips ({clips.length}):</span>
        </div>

        {clips.map((clip, idx) => {
          const isActive = idx === activeClipIndex;
          const clipDurationStr =
            clip.durationSeconds > 0 ? `${clip.durationSeconds.toFixed(1)}s` : '';

          return (
            <div
              key={clip.id}
              onClick={(e) => handleSelectClip(idx, e)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-purple-600/30 border-purple-500 text-white shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300'
              }`}
            >
              <span>Clip {idx + 1}</span>
              {clipDurationStr && (
                <span className="text-[10px] opacity-70 font-mono">({clipDurationStr})</span>
              )}
              {clip.isEdited && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
              )}
              {clips.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveClip(idx, e)}
                  className="ml-1 text-slate-400 hover:text-rose-400 transition"
                  title="Remove this clip"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addClipInputRef.current?.click();
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 text-purple-300 text-xs font-semibold transition shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Clip</span>
        </button>
      </div>

      {/* Main Video Viewport */}
      <div className="relative flex-1 min-h-[220px] max-h-[420px] bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={activeClip?.currentUrl}
          preload="metadata"
          playsInline
          webkit-playsinline="true"
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={() => {
            setPreviewLoading(false);
          }}
          onCanPlay={() => {
            setPreviewLoading(false);
          }}
          onError={() => {
            setPreviewLoading(false);
            const err = videoRef.current?.error;
            let msg = 'Could not load video preview.';
            if (activeFormatAnalysis?.isUnsupportedCodec) {
              msg = activeFormatAnalysis.recoveryAdvice || 'Unsupported video format or codec for in-browser playback.';
            } else if (err) {
              if (err.code === 3) {
                msg = `Video decode error: This video uses an unsupported codec (${activeFormatAnalysis?.codecLabel || 'HEVC/H.265 or 10-bit color'}) that your mobile browser cannot decode in-browser. Supported formats: H.264 (MP4) and WebM.`;
              } else if (err.code === 4) {
                msg = `Unsupported video format or codec (${activeFormatAnalysis?.codecLabel || 'unsupported'}) for in-browser playback. Supported formats: H.264 (MP4) and WebM.`;
              } else if (err.code === 2) {
                msg = 'Network or storage read error while opening video file.';
              } else {
                msg = `Video load error (${err.code}): ${err.message || 'Format unsupported'}`;
              }
            }
            setPreviewError(msg);
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="max-h-full max-w-full object-contain"
        />

        {/* Big Central Play/Pause Touch Target */}
        {!processing.isProcessing && !previewError && (
          <button
            type="button"
            onClick={togglePlayPause}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white border border-white/20 transition transform active:scale-90 cursor-pointer shadow-xl z-10"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-white" />
            ) : (
              <Play className="w-7 h-7 fill-white ml-1" />
            )}
          </button>
        )}

        {/* Video Time Indicator */}
        <div className="absolute bottom-3 left-4 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[11px] font-mono font-bold text-slate-200 border border-white/10 z-10">
          {safeCurrentTime.toFixed(1)}s / {safeDuration.toFixed(1)}s
        </div>

        {/* Preview Loading Indicator (Bounded timeout, never spins indefinitely) */}
        {previewLoading && !processing.isProcessing && !previewError && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md text-xs text-slate-200 border border-white/10 shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span>Loading preview...</span>
            </div>
          </div>
        )}

        {/* Actionable Error Overlay for Unsupported Codec / Black Preview */}
        {previewError && (
          <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1.5">
              {activeFormatAnalysis?.isUnsupportedCodec
                ? `Unsupported Codec (${activeFormatAnalysis.codecLabel})`
                : 'Unsupported Video Format'}
            </h4>
            <p className="text-xs text-slate-300 max-w-xs mb-4 leading-relaxed">
              {previewError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewError(null);
                  if (videoRef.current) {
                    try {
                      videoRef.current.load();
                    } catch {}
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer border border-slate-700 transition active:scale-95"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={handlePostOriginalDirectly}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white cursor-pointer shadow-md transition active:scale-95"
                title="Post original untouched video directly to social feed"
              >
                Post Original File
              </button>
              <button
                type="button"
                onClick={handleSaveToDevice}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-300 cursor-pointer border border-teal-500/30 transition active:scale-95"
                title="Save untouched original video file to downloads"
              >
                Save Original
              </button>
              {clips.length > 1 ? (
                <button
                  type="button"
                  onClick={(e) => handleRemoveClip(activeClipIndex, e)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/30 text-rose-300 hover:bg-rose-600/40 text-xs font-semibold cursor-pointer border border-rose-500/40 transition active:scale-95"
                >
                  Remove Clip
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBack();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-400 cursor-pointer border border-slate-700 transition active:scale-95"
                >
                  Change Video
                </button>
              )}
            </div>
          </div>
        )}

        {/* Processing Spinner Overlay */}
        {processing.isProcessing && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">
              {processing.operationName}
            </h4>
            <p className="text-xs text-slate-300 mb-3">{processing.statusText}</p>
            <div className="w-48 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-purple-500 to-teal-400 h-full transition-all duration-200"
                style={{ width: `${processing.progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-2">
              {processing.progressPercent}%
            </span>
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
        <div className="m-4 p-4 rounded-2xl bg-slate-800/90 border border-purple-500/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Scissors className="w-4 h-4" />
              <span>Trim Start & End Times</span>
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
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="w-full accent-purple-500 cursor-pointer"
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
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleExecuteOperation('trim', trimStart, trimEnd);
              }}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white transition active:scale-95 cursor-pointer shadow-md"
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

      {/* 4 Large One-Tap Action Buttons (Nokia 1100 Simplicity) */}
      <div className="p-4 grid grid-cols-2 gap-2.5 shrink-0">
        {/* 1. Trim */}
        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={(e) => {
            e.stopPropagation();
            setShowTrimPanel((prev) => !prev);
          }}
          className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition active:scale-95 cursor-pointer ${
            showTrimPanel
              ? 'bg-purple-900/40 border-purple-500 text-purple-200'
              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-600/30 text-purple-400">
              <Scissors className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Remove Unwanted</span>
          </div>
          <span className="text-[11px] text-slate-400">Trim start or end points</span>
        </button>

        {/* 2. Make it Better */}
        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={(e) => {
            e.stopPropagation();
            handleExecuteOperation('enhance');
          }}
          className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left flex flex-col gap-1 transition active:scale-95 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Make it Better</span>
          </div>
          <span className="text-[11px] text-slate-400">Boost clarity & balance</span>
        </button>

        {/* 3. Clean Audio */}
        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={(e) => {
            e.stopPropagation();
            handleExecuteOperation('clean_audio');
          }}
          className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left flex flex-col gap-1 transition active:scale-95 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Volume2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Clean Audio</span>
          </div>
          <span className="text-[11px] text-slate-400">Filter noise & voice EQ</span>
        </button>

        {/* 4. Make a Reel */}
        <button
          type="button"
          disabled={processing.isProcessing}
          onClick={(e) => {
            e.stopPropagation();
            handleExecuteOperation('make_reel');
          }}
          className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left flex flex-col gap-1 transition active:scale-95 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <Film className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Make a Reel</span>
          </div>
          <span className="text-[11px] text-slate-400">9:16 vertical crop</span>
        </button>
      </div>

      {/* Bottom Output Row */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 mt-auto flex flex-col gap-2 shrink-0">
        <div className="flex gap-2">
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
            <span>Save Clip</span>
          </button>

          {clips.length > 1 && (
            <button
              type="button"
              disabled={processing.isProcessing}
              onClick={handleSaveAllClips}
              className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-teal-300 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border border-teal-500/30"
              title="Save all clips to device"
            >
              <Download className="w-4 h-4" />
              <span>All ({clips.length})</span>
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={processing.isProcessing}
            onClick={(e) => handlePost(false, e)}
            className="flex-1 py-3 px-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Post to Feed</span>
          </button>

          <button
            type="button"
            disabled={processing.isProcessing}
            onClick={(e) => handlePost(true, e)}
            className="flex-1 py-3 px-2 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Post Reel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
