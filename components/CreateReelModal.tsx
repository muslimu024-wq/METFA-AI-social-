import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Film,
  X,
  Sparkles,
  Video,
  Music,
  ShieldCheck,
  Play,
  Pause,
  Trash2,
  Plus,
  Sliders,
  Volume2,
  Clock,
  Radio,
  Loader2,
  AlertCircle,
  Globe,
  Users,
  Lock,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { PostAudience, ReelHighlight, UserProfile, VideoSeriesMeta } from '../types/community';
import { AudioTrack } from '../types/audio';
import { normalizeDefaultPostAudience } from '../utils/privacyPolicy';
import { recordTrackUsage, createOriginalSoundRecord } from '../utils/audioStore';
import { compressImageDataUrl } from '../utils/storageUtils';
import { createPersistentReel } from '../services/reelService';
import {
  uploadMediaItem,
  validateAndPrepareVideoFile,
  UploadProgressInfo,
} from '../services/storageService';
import {
  fetchCreatorVideoSeries,
  createCreatorVideoSeries,
} from '../services/seriesService';
import type { VideoSeriesDefinition } from '../utils/videoSeries';
import AudioTrackPickerModal from './AudioTrackPickerModal';
import AudioLicenseInfoModal from './AudioLicenseInfoModal';

export type ReelVideoUploadPhase =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'error';

interface CreateReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onReelCreated: (reel: ReelHighlight) => void;
  initialVideoSrc?: string;
  initialAudioTrack?: AudioTrack | null;
  onOpenAiEditor?: () => void;
}

export const CreateReelModal: React.FC<CreateReelModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onReelCreated,
  initialVideoSrc,
  initialAudioTrack = null,
  onOpenAiEditor,
}) => {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [promptUsed, setPromptUsed] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState(initialVideoSrc || '');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(() =>
    initialVideoSrc && !initialVideoSrc.startsWith('blob:') && !initialVideoSrc.startsWith('data:')
      ? initialVideoSrc
      : null
  );
  const [uploadedVideoMeta, setUploadedVideoMeta] = useState<{
    fileName: string;
    sizeBytes: number;
    mimeType: string;
  } | null>(null);
  const [videoPreviewNotice, setVideoPreviewNotice] = useState<string | null>(null);

  const [thumbnailSrc, setThumbnailSrc] = useState('');
  const [duration, setDuration] = useState(0);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(initialAudioTrack);
  const [visibility, setVisibility] = useState<PostAudience>(() =>
    normalizeDefaultPostAudience(userProfile?.defaultPostAudience)
  );

  // Explicit Creator-Linked Video Series state (strictly optional, never auto-grouped)
  const [isSeriesEnabled, setIsSeriesEnabled] = useState(false);
  const [creatorSeriesList, setCreatorSeriesList] = useState<VideoSeriesDefinition[]>([]);
  const [seriesMode, setSeriesMode] = useState<'existing' | 'new'>('new');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [seriesPartNumber, setSeriesPartNumber] = useState<number>(1);
  const [seriesTotalParts, setSeriesTotalParts] = useState<string>('');

  // Separated Upload/Processing vs Publishing state
  const [uploadPhase, setUploadPhase] = useState<ReelVideoUploadPhase>('idle');
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadStageLabel, setUploadStageLabel] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState<string>('');
  const [publishError, setPublishError] = useState<string | null>(null);

  // Audio Mixer & Alignment settings
  const [showAudioMixer, setShowAudioMixer] = useState(false);
  const [musicVolume, setMusicVolume] = useState(100);
  const [originalAudioVolume, setOriginalAudioVolume] = useState(100);
  const [audioStartTime, setAudioStartTime] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [isAudioPreviewPlaying, setIsAudioPreviewPlaying] = useState(false);

  // Modals for Audio selection & Rights inspector
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [isLicenseInfoOpen, setIsLicenseInfoOpen] = useState(false);

  // Refs for lifecycle control, cancellation, duplicate prevention & resource cleanup
  const wasOpenRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const publishAbortRef = useRef<AbortController | null>(null);
  const uploadInFlightRef = useRef<boolean>(false);
  const activeUploadIdRef = useRef<number>(0);
  const blobUrlRef = useRef<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const revokePreviewBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      try {
        URL.revokeObjectURL(blobUrlRef.current);
      } catch {}
      blobUrlRef.current = null;
    }
  }, []);

  const stopAudioPreview = useCallback(() => {
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      } catch {}
      previewAudioRef.current = null;
    }
    setIsAudioPreviewPlaying(false);
  }, []);

  const abortAllOperations = useCallback(() => {
    activeUploadIdRef.current += 1;
    uploadInFlightRef.current = false;
    if (uploadAbortRef.current) {
      try {
        uploadAbortRef.current.abort();
      } catch {}
      uploadAbortRef.current = null;
    }
    if (publishAbortRef.current) {
      try {
        publishAbortRef.current.abort();
      } catch {}
      publishAbortRef.current = null;
    }
  }, []);

  // Only initialize/reset composer state on closed -> open transition (never mid-upload on profile refresh)
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    const justClosed = !isOpen && wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      setVisibility(normalizeDefaultPostAudience(userProfile?.defaultPostAudience));
      setUploadError(null);
      setPublishError(null);
      setUploadPhase(initialVideoSrc ? 'ready' : 'idle');
      setUploadPercent(initialVideoSrc ? 100 : 0);
      setUploadStageLabel(initialVideoSrc ? 'Video ready' : '');
      setIsPublishing(false);
      setPublishStep('');
      setVideoPreviewNotice(null);
      setIsSeriesEnabled(false);
      setNewSeriesTitle('');
      setNewSeriesDescription('');
      setSeriesPartNumber(1);
      setSeriesTotalParts('');

      if (initialAudioTrack) {
        setSelectedAudioTrack(initialAudioTrack);
      }

      if (initialVideoSrc) {
        setVideoSrc(initialVideoSrc);
        setUploadedVideoUrl(
          !initialVideoSrc.startsWith('blob:') && !initialVideoSrc.startsWith('data:')
            ? initialVideoSrc
            : null
        );
      } else {
        setVideoFile(null);
        setVideoSrc('');
        setUploadedVideoUrl(null);
        setUploadedVideoMeta(null);
        setThumbnailSrc('');
      }

      if (userProfile?.id && userProfile.id !== 'guest') {
        fetchCreatorVideoSeries(userProfile.id).then((list) => {
          setCreatorSeriesList(list);
          if (list.length > 0) {
            setSeriesMode('existing');
            setSelectedSeriesId(list[0].seriesId);
          } else {
            setSeriesMode('new');
            setSelectedSeriesId('');
          }
        });
      }
    } else if (justClosed) {
      abortAllOperations();
      stopAudioPreview();
      revokePreviewBlobUrl();
    }
  }, [
    isOpen,
    initialVideoSrc,
    initialAudioTrack,
    userProfile?.id,
    userProfile?.defaultPostAudience,
    abortAllOperations,
    stopAudioPreview,
    revokePreviewBlobUrl,
  ]);

  // Sync canonical soundtrack if initialAudioTrack arrives while open without wiping selected video
  useEffect(() => {
    if (isOpen && initialAudioTrack) {
      setSelectedAudioTrack(initialAudioTrack);
    }
  }, [isOpen, initialAudioTrack]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      abortAllOperations();
      stopAudioPreview();
      revokePreviewBlobUrl();
    };
  }, [abortAllOperations, stopAudioPreview, revokePreviewBlobUrl]);

  const isUploadBusy =
    uploadPhase === 'validating' || uploadPhase === 'uploading' || uploadPhase === 'processing';

  const runVideoUpload = useCallback(
    async (fileToUpload: File) => {
      if (uploadInFlightRef.current) {
        return;
      }

      const uploadToken = ++activeUploadIdRef.current;
      uploadInFlightRef.current = true;
      const controller = new AbortController();
      uploadAbortRef.current = controller;

      setUploadError(null);
      setPublishError(null);
      setUploadedVideoUrl(null);
      setUploadPhase('uploading');
      setUploadPercent(5);
      setUploadStageLabel('Uploading video...');

      try {
        const result = await uploadMediaItem(fileToUpload, {
          userId: userProfile?.id,
          type: 'video',
          fileName: fileToUpload.name,
          signal: controller.signal,
          visibility,
          onProgress: (info: UploadProgressInfo) => {
            if (activeUploadIdRef.current !== uploadToken) return;
            if (info.stage === 'preparing') {
              setUploadPhase('uploading');
              setUploadPercent(info.percent);
              setUploadStageLabel(`Preparing video... ${info.percent}%`);
            } else if (info.stage === 'uploading') {
              setUploadPhase('uploading');
              setUploadPercent(info.percent);
              setUploadStageLabel(`Uploading video... ${info.percent}%`);
            } else if (info.stage === 'processing') {
              setUploadPhase('processing');
              setUploadPercent(info.percent);
              setUploadStageLabel('Processing video...');
            } else if (info.stage === 'done') {
              setUploadPhase('ready');
              setUploadPercent(100);
              setUploadStageLabel('Video uploaded and ready');
            }
          },
        });

        if (activeUploadIdRef.current !== uploadToken) return;

        setUploadedVideoUrl(result.url);
        setUploadPhase('ready');
        setUploadPercent(100);
        setUploadStageLabel('Video uploaded and ready');
      } catch (err: any) {
        if (activeUploadIdRef.current !== uploadToken) return;
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          setUploadPhase('idle');
          setUploadPercent(0);
          setUploadStageLabel('');
          return;
        }
        setUploadPhase('error');
        setUploadError(err?.message || 'Video upload failed. Please check your connection and retry.');
      } finally {
        if (activeUploadIdRef.current === uploadToken) {
          uploadInFlightRef.current = false;
          if (uploadAbortRef.current === controller) {
            uploadAbortRef.current = null;
          }
        }
      }
    },
    [userProfile?.id, visibility]
  );

  if (!isOpen) return null;

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFile = e.target.files?.[0];
    // Always reset input so user can re-pick the exact same gallery file after error/cancel
    e.target.value = '';
    if (!pickedFile) return;

    // Abort any prior active upload cleanly before starting the newly selected video
    if (uploadAbortRef.current) {
      activeUploadIdRef.current += 1;
      uploadInFlightRef.current = false;
      try {
        uploadAbortRef.current.abort();
      } catch {}
      uploadAbortRef.current = null;
    }

    revokePreviewBlobUrl();
    setUploadError(null);
    setPublishError(null);
    setUploadedVideoUrl(null);
    setVideoPreviewNotice(null);
    setDuration(0);
    setUploadPhase('validating');
    setUploadPercent(0);
    setUploadStageLabel('Validating selected video...');

    try {
      const prepared = await validateAndPrepareVideoFile(pickedFile);
      const nextBlobUrl = URL.createObjectURL(prepared.file);
      blobUrlRef.current = nextBlobUrl;

      setVideoFile(prepared.file);
      setVideoSrc(nextBlobUrl);
      setUploadedVideoMeta({
        fileName: prepared.file.name,
        sizeBytes: prepared.sizeBytes,
        mimeType: prepared.mimeType,
      });

      await runVideoUpload(prepared.file);
    } catch (valErr: any) {
      setUploadPhase('error');
      setUploadPercent(0);
      setUploadStageLabel('');
      setUploadError(valErr?.message || 'Selected video could not be processed.');
    }
  };

  const handleRetryUpload = () => {
    if (!videoFile || uploadInFlightRef.current) return;
    runVideoUpload(videoFile);
  };

  const handleCancelUpload = () => {
    activeUploadIdRef.current += 1;
    uploadInFlightRef.current = false;
    if (uploadAbortRef.current) {
      try {
        uploadAbortRef.current.abort();
      } catch {}
      uploadAbortRef.current = null;
    }
    revokePreviewBlobUrl();
    setVideoFile(null);
    setVideoSrc('');
    setUploadedVideoUrl(null);
    setUploadedVideoMeta(null);
    setVideoPreviewNotice(null);
    setDuration(0);
    setUploadPhase('idle');
    setUploadPercent(0);
    setUploadStageLabel('');
    setUploadError(null);
  };

  const handleCloseModal = () => {
    abortAllOperations();
    stopAudioPreview();
    revokePreviewBlobUrl();
    setIsPublishing(false);
    setPublishStep('');
    setUploadPhase('idle');
    setUploadError(null);
    setPublishError(null);
    onClose();
  };

  const handleToggleAudioPreview = () => {
    if (!selectedAudioTrack?.audio_url) return;
    if (isAudioPreviewPlaying && previewAudioRef.current) {
      stopAudioPreview();
      return;
    }
    stopAudioPreview();
    try {
      const audio = new Audio(selectedAudioTrack.audio_url);
      audio.volume = Math.max(0, Math.min(1, musicVolume / 100));
      audio.onended = () => setIsAudioPreviewPlaying(false);
      audio.onerror = () => setIsAudioPreviewPlaying(false);
      previewAudioRef.current = audio;
      audio
        .play()
        .then(() => setIsAudioPreviewPlaying(true))
        .catch(() => setIsAudioPreviewPlaying(false));
    } catch {
      setIsAudioPreviewPlaying(false);
    }
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    let d = video.duration;
    if (!isFinite(d) || isNaN(d) || d <= 0) {
      if (video.seekable && video.seekable.length > 0) {
        try {
          const sEnd = video.seekable.end(video.seekable.length - 1);
          if (isFinite(sEnd) && sEnd > 0) d = sEnd;
        } catch {}
      }
    }
    if (isFinite(d) && !isNaN(d) && d > 0) {
      setDuration(Math.round(d));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;

    if (isUploadBusy) {
      setPublishError('Video upload is still in progress. Please wait for it to finish or cancel upload.');
      return;
    }

    if (!uploadedVideoUrl && !videoSrc && !videoFile) {
      setPublishError('Please select a video file before publishing your Reel.');
      return;
    }

    if (uploadPhase === 'error' && !uploadedVideoUrl && !initialVideoSrc) {
      setPublishError(
        uploadError || 'Video upload did not complete. Tap Retry Upload before publishing.'
      );
      return;
    }

    if (!title.trim() && !caption.trim()) {
      setPublishError('Please add a title or caption for your Reel.');
      return;
    }

    const controller = new AbortController();
    publishAbortRef.current = controller;
    setIsPublishing(true);
    setPublishError(null);
    setPublishStep(
      uploadedVideoUrl
        ? 'Attaching uploaded video & soundtrack...'
        : 'Preparing video and audio soundtrack...'
    );

    try {
      const compressedThumb = thumbnailSrc
        ? await compressImageDataUrl(thumbnailSrc, 600, 800, 0.7)
        : '';
      const tempReelId = `reel_${Date.now()}`;

      // Preserve canonical selectedAudioTrack without duplicating or re-uploading its audio file
      let resolvedTrack = selectedAudioTrack;
      const finalDuration = duration > 0 ? duration : 15;

      if (resolvedTrack) {
        recordTrackUsage(resolvedTrack.id);
      } else {
        resolvedTrack = createOriginalSoundRecord({
          userId: userProfile.id,
          username: userProfile.username,
          userAvatar: userProfile.avatar,
          reelId: tempReelId,
          videoSrc: uploadedVideoUrl || videoSrc,
          duration: finalDuration,
          title: `Original sound — @${userProfile.username.replace('@', '')}`,
        });
      }

      const musicTrackName = resolvedTrack
        ? `${resolvedTrack.title} • ${resolvedTrack.artist}`
        : `Original sound — @${userProfile.username.replace('@', '')}`;

      // Optional explicit creator-linked Video Series metadata
      let seriesMeta: VideoSeriesMeta | undefined;
      if (isSeriesEnabled) {
        const parsedTotal = seriesTotalParts.trim()
          ? Math.max(1, Math.floor(Number(seriesTotalParts)))
          : undefined;
        const normalizedPart = Math.max(1, Math.floor(Number(seriesPartNumber) || 1));

        if (seriesMode === 'existing' && selectedSeriesId) {
          const matchedSeries = creatorSeriesList.find((s) => s.seriesId === selectedSeriesId);
          if (matchedSeries) {
            seriesMeta = {
              seriesId: matchedSeries.seriesId,
              seriesTitle: matchedSeries.title,
              seriesDescription: matchedSeries.description,
              creatorId: userProfile.id,
              partNumber: normalizedPart,
              totalParts: parsedTotal || matchedSeries.totalParts,
              visibility,
              isPublished: true,
              seriesType: 'video',
            };
          }
        } else if (newSeriesTitle.trim()) {
          const createdSeries = await createCreatorVideoSeries({
            creatorId: userProfile.id,
            title: newSeriesTitle.trim(),
            description: newSeriesDescription.trim() || undefined,
            totalParts: parsedTotal,
            visibility,
          });
          seriesMeta = {
            seriesId: createdSeries.seriesId,
            seriesTitle: createdSeries.title,
            seriesDescription: createdSeries.description,
            creatorId: userProfile.id,
            partNumber: normalizedPart,
            totalParts: createdSeries.totalParts || parsedTotal,
            visibility,
            isPublished: true,
            seriesType: 'video',
          };
        }
      }

      const result = await createPersistentReel(
        {
          title: title.trim() || 'AI Creation Reel',
          caption: caption.trim() || 'Created with Metfa Studio #AI',
          promptUsed: promptUsed.trim() || undefined,
          videoSource: uploadedVideoUrl || videoSrc || videoFile!,
          thumbnailSource: compressedThumb,
          duration: finalDuration,
          musicTrack: musicTrackName,
          audioTrack: resolvedTrack || undefined,
          visibility,
          series: seriesMeta,
          author: {
            id: userProfile.id,
            name: userProfile.name,
            username: userProfile.username,
            avatar: userProfile.avatar,
            isVerified: userProfile.isVerified,
            profilePrivacy: userProfile.profilePrivacy || 'public',
          },
        },
        (step) => setPublishStep(step),
        { signal: controller.signal }
      );

      if (controller.signal.aborted || result.aborted) {
        return;
      }

      if (result.success && result.reel) {
        stopAudioPreview();
        revokePreviewBlobUrl();
        onReelCreated(result.reel);
        onClose();
      } else {
        setPublishError(result.error || 'Failed to publish reel. Please try again.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      console.error('[CreateReelModal] Publish error:', err);
      setPublishError(err?.message || 'Unexpected error occurred while publishing your Reel.');
    } finally {
      if (publishAbortRef.current === controller) {
        publishAbortRef.current = null;
      }
      setIsPublishing(false);
    }
  };

  const formattedFileSizeMb = uploadedVideoMeta?.sizeBytes
    ? `${(uploadedVideoMeta.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <>
      <div
        onClick={handleCloseModal}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 border border-purple-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-950 text-purple-300">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create AI Reel</h3>
                <p className="text-xs text-gray-400">
                  Post short video highlights with licensed audio & original sounds
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseModal}
              className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
              aria-label="Close Create Reel dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 pt-3 flex-1">
            {/* Video Upload Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300 block uppercase tracking-wider">
                  Upload Video Clip (MP4 / WebM)
                </label>
                {onOpenAiEditor && (
                  <button
                    type="button"
                    onClick={onOpenAiEditor}
                    className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Video Editor</span>
                  </button>
                )}
              </div>
              <label className="border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-950/60 transition group">
                <input
                  ref={fileInputRef}
                  data-testid="create-reel-video-input"
                  type="file"
                  accept="video/*,.mp4,.webm,.mov,.m4v,.3gp"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                <Video className="w-7 h-7 text-purple-400 mb-1.5" />
                <span className="text-xs font-bold text-gray-300 group-hover:text-white">
                  {videoFile ? 'Choose Different Video File' : 'Choose Video File'}
                </span>
                <span className="text-[10px] text-gray-500">MP4, WebM, or MOV video</span>
              </label>

              {/* Upload / Processing Status Banner (Strictly separated from Publish state) */}
              {(isUploadBusy || uploadPhase === 'ready' || uploadPhase === 'error') && (
                <div className="mt-2.5 space-y-2">
                  {isUploadBusy && (
                    <div
                      data-testid="reel-video-upload-progress"
                      className="p-3 bg-purple-950/40 border border-purple-700/60 rounded-xl space-y-2 text-xs text-purple-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
                          <span className="font-semibold truncate">
                            {uploadStageLabel || 'Uploading video...'}
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid="cancel-video-upload-btn"
                          onClick={handleCancelUpload}
                          className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                          Cancel Upload
                        </button>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-teal-400 transition-all duration-150"
                          style={{ width: `${Math.max(4, Math.min(100, uploadPercent))}%` }}
                        />
                      </div>
                      {uploadedVideoMeta && (
                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                          <span className="truncate">{uploadedVideoMeta.fileName}</span>
                          {formattedFileSizeMb && <span className="shrink-0">{formattedFileSizeMb}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {uploadPhase === 'ready' && (
                    <div
                      data-testid="reel-video-upload-ready"
                      className="p-2.5 bg-teal-950/40 border border-teal-500/40 rounded-xl flex items-center justify-between gap-2 text-xs text-teal-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                        <span className="font-semibold truncate">
                          {uploadStageLabel || 'Video uploaded and ready'}
                        </span>
                      </div>
                      {formattedFileSizeMb && (
                        <span className="text-[10px] font-mono text-teal-300 shrink-0">
                          {formattedFileSizeMb}
                        </span>
                      )}
                    </div>
                  )}

                  {uploadPhase === 'error' && uploadError && (
                    <div
                      data-testid="reel-video-upload-error"
                      className="p-3 bg-rose-950/50 border border-rose-700/60 rounded-xl space-y-2 text-xs text-rose-200"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{uploadError}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {videoFile && (
                          <button
                            type="button"
                            data-testid="retry-video-upload-btn"
                            onClick={handleRetryUpload}
                            className="px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry Upload</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleCancelUpload}
                          className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-bold cursor-pointer"
                        >
                          Clear Video
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Video preview (strictly for real selected or editor-provided video) */}
              {videoSrc ? (
                <div className="mt-2.5 rounded-2xl overflow-hidden border border-gray-800 bg-black aspect-video flex items-center justify-center relative">
                  <video
                    src={videoSrc}
                    controls
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    onError={() =>
                      setVideoPreviewNotice(
                        'Preview codec is limited on this browser, but the selected video file can still upload.'
                      )
                    }
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="mt-2.5 rounded-2xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-center text-[11px] text-gray-400">
                  Select a real video clip above to preview and publish your Reel.
                </div>
              )}

              {videoPreviewNotice && (
                <p className="mt-1 text-[10px] text-amber-300">{videoPreviewNotice}</p>
              )}
            </div>

            {/* Audio Soundtrack Picker Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-purple-400" />
                  <span>Audio Soundtrack</span>
                </label>
                <div className="flex items-center gap-2">
                  {selectedAudioTrack && (
                    <button
                      type="button"
                      onClick={() => setShowAudioMixer(!showAudioMixer)}
                      className={`text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                        showAudioMixer ? 'text-purple-400' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Sliders className="w-3 h-3" />
                      <span>{showAudioMixer ? 'Hide Mixer' : 'Audio Mixer'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAudioPickerOpen(true)}
                    className="text-[11px] font-bold text-teal-400 hover:text-teal-300 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{selectedAudioTrack ? 'Change Sound' : 'Add Sound'}</span>
                  </button>
                </div>
              </div>

              {selectedAudioTrack ? (
                <div
                  data-testid="create-reel-attached-soundtrack"
                  className="p-3 bg-purple-950/30 border border-purple-500/40 rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        {selectedAudioTrack.cover_url ? (
                          <img
                            src={selectedAudioTrack.cover_url}
                            alt={selectedAudioTrack.title}
                            className="w-10 h-10 rounded-xl object-cover border border-purple-500/30"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-900/60 border border-purple-500/30 flex items-center justify-center">
                            <Music className="w-4 h-4 text-teal-300" />
                          </div>
                        )}
                        {selectedAudioTrack.audio_url && (
                          <button
                            type="button"
                            data-testid="create-reel-audio-preview-btn"
                            onClick={handleToggleAudioPreview}
                            className="absolute inset-0 bg-black/45 hover:bg-black/65 rounded-xl flex items-center justify-center text-white transition cursor-pointer"
                            title={isAudioPreviewPlaying ? 'Pause soundtrack preview' : 'Preview soundtrack'}
                            aria-label={isAudioPreviewPlaying ? 'Pause soundtrack preview' : 'Preview soundtrack'}
                          >
                            {isAudioPreviewPlaying ? (
                              <Pause className="w-4 h-4 text-teal-300" />
                            ) : (
                              <Play className="w-4 h-4 text-white fill-white" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white truncate">
                            {selectedAudioTrack.title}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded bg-teal-950 border border-teal-500/40 text-teal-300 text-[8px] font-bold shrink-0">
                            ATTACHED
                          </span>
                          {selectedAudioTrack.track_type === 'original' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-500/40 text-amber-300 text-[8px] font-bold shrink-0">
                              ORIGINAL
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-purple-300 truncate font-mono">
                          {selectedAudioTrack.artist} • {selectedAudioTrack.genre}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsLicenseInfoOpen(true)}
                          className="text-[9px] text-teal-400 font-bold hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>{selectedAudioTrack.license_type}</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        stopAudioPreview();
                        setSelectedAudioTrack(null);
                      }}
                      className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 transition shrink-0 cursor-pointer"
                      title="Remove soundtrack"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Audio Mixer Controls */}
                  {showAudioMixer && (
                    <div className="pt-2 border-t border-purple-500/20 space-y-2.5 text-xs">
                      {/* Music Volume */}
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                          <span className="flex items-center gap-1 font-bold">
                            <Volume2 className="w-3 h-3 text-purple-400" />
                            <span>Soundtrack Volume</span>
                          </span>
                          <span className="font-mono text-purple-300">{musicVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={musicVolume}
                          onChange={(e) => setMusicVolume(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>

                      {/* Original Video Volume */}
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                          <span className="flex items-center gap-1 font-bold">
                            <Volume2 className="w-3 h-3 text-teal-400" />
                            <span>Original Clip Audio</span>
                          </span>
                          <span className="font-mono text-teal-300">{originalAudioVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={originalAudioVolume}
                          onChange={(e) => setOriginalAudioVolume(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                        />
                      </div>

                      {/* Audio Trim / Start Time */}
                      <div>
                        <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                          <span className="flex items-center gap-1 font-bold">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Audio Start Offset</span>
                          </span>
                          <span className="font-mono text-amber-300">{audioStartTime}s</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, (selectedAudioTrack.duration || 60) - duration)}
                          value={audioStartTime}
                          onChange={(e) => setAudioStartTime(Number(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      {/* Fade in / Fade out */}
                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-300">
                          <input
                            type="checkbox"
                            checked={fadeIn}
                            onChange={(e) => setFadeIn(e.target.checked)}
                            className="rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                          />
                          <span>Fade In</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-300">
                          <input
                            type="checkbox"
                            checked={fadeOut}
                            onChange={(e) => setFadeOut(e.target.checked)}
                            className="rounded border-gray-700 text-purple-600 focus:ring-purple-500"
                          />
                          <span>Fade Out</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAudioPickerOpen(true)}
                    className="w-full p-3 bg-gray-950 border border-gray-800 hover:border-purple-500/50 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:text-purple-300 transition text-xs font-medium cursor-pointer"
                  >
                    <Music className="w-4 h-4 text-purple-400" />
                    <span>Add Sound (Royalty-Free, Licensed, SFX, or Saved)</span>
                  </button>
                  <p className="text-[10px] text-gray-500 text-center flex items-center justify-center gap-1">
                    <Radio className="w-3 h-3 text-amber-400" />
                    <span>
                      Without music, your clip audio will be saved as "Original sound — @{userProfile.username.replace('@', '')}"
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
                Reel Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cyberpunk City Inpainting 10s"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Caption */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
                Caption & Tags
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="#MetfaAI #GenerativeVision #Reels"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Prompt */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5 uppercase tracking-wider">
                AI Prompt Used (Optional)
              </label>
              <textarea
                value={promptUsed}
                onChange={(e) => setPromptUsed(e.target.value)}
                placeholder="The prompt used to create this scene..."
                rows={2}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Explicit Creator-Linked Video Series Assignment (Optional) */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Part of a Video Series
                </label>
                <button
                  type="button"
                  onClick={() => setIsSeriesEnabled((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    isSeriesEnabled
                      ? 'bg-teal-600 text-white border-teal-500'
                      : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-white'
                  }`}
                >
                  {isSeriesEnabled ? 'Enabled' : 'Standalone Video'}
                </button>
              </div>

              {isSeriesEnabled && (
                <div className="space-y-2.5 pt-1 border-t border-gray-800/80">
                  {creatorSeriesList.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSeriesMode('existing')}
                        className={`py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          seriesMode === 'existing'
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-gray-900 text-gray-300 border-gray-800'
                        }`}
                      >
                        Existing Series
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeriesMode('new')}
                        className={`py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          seriesMode === 'new'
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-gray-900 text-gray-300 border-gray-800'
                        }`}
                      >
                        Create New Series
                      </button>
                    </div>
                  )}

                  {seriesMode === 'existing' && creatorSeriesList.length > 0 ? (
                    <select
                      value={selectedSeriesId}
                      onChange={(e) => setSelectedSeriesId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      {creatorSeriesList.map((s) => (
                        <option key={s.seriesId} value={s.seriesId}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newSeriesTitle}
                        onChange={(e) => setNewSeriesTitle(e.target.value)}
                        placeholder="Series Title (e.g. Dhaka Night Walks)"
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="text"
                        value={newSeriesDescription}
                        onChange={(e) => setNewSeriesDescription(e.target.value)}
                        placeholder="Short series description (optional)"
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">
                        Part Number
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={seriesPartNumber}
                        onChange={(e) => setSeriesPartNumber(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">
                        Total Parts (Optional)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={seriesTotalParts}
                        onChange={(e) => setSeriesTotalParts(e.target.value)}
                        placeholder="Ongoing"
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reel Audience Selector */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-3 space-y-2">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Who can view this Reel?</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'public' as PostAudience, label: 'Public', icon: Globe },
                  { id: 'followers' as PostAudience, label: 'Followers', icon: Users },
                  { id: 'only_me' as PostAudience, label: 'Only Me', icon: Lock },
                ].map((opt) => {
                  const IconComp = opt.icon;
                  const active = visibility === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVisibility(opt.id)}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                        active
                          ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                          : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-700 hover:text-white'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {userProfile.profilePrivacy === 'private' && visibility === 'public' && (
                <p className="text-[10px] text-amber-300 bg-amber-950/50 border border-amber-500/30 rounded-xl px-2.5 py-1.5">
                  Your profile is Private — only approved followers can watch this Reel while private.
                </p>
              )}
            </div>

            {/* Publishing Status & Error Feedback (Separate from Video Upload Status) */}
            {isPublishing && (
              <div
                data-testid="reel-publish-progress"
                className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl flex items-center gap-2.5 text-xs text-purple-200"
              >
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
                <span className="font-medium">{publishStep || 'Publishing Reel...'}</span>
              </div>
            )}

            {publishError && (
              <div
                data-testid="reel-publish-error"
                className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{publishError}</span>
              </div>
            )}

            {/* Submit & Always-Enabled Cancel */}
            <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                data-testid="create-reel-cancel-btn"
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="create-reel-publish-btn"
                disabled={isPublishing || isUploadBusy}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : isUploadBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading {uploadPercent}%...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Publish Reel</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Audio Track Picker Modal */}
      <AudioTrackPickerModal
        isOpen={isAudioPickerOpen}
        onClose={() => setIsAudioPickerOpen(false)}
        onSelectTrack={(track) => {
          stopAudioPreview();
          setSelectedAudioTrack(track);
        }}
        selectedTrackId={selectedAudioTrack?.id}
        userProfile={userProfile}
      />

      {/* Audio License Certificate Modal */}
      {selectedAudioTrack && isLicenseInfoOpen && (
        <AudioLicenseInfoModal
          isOpen={isLicenseInfoOpen}
          track={selectedAudioTrack}
          onClose={() => setIsLicenseInfoOpen(false)}
        />
      )}
    </>
  );
};

export default CreateReelModal;
