import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Video as VideoIcon,
  Mic as MicIcon,
  X,
  Sparkles,
  UploadCloud,
  FileVideo,
  FileAudio,
} from 'lucide-react';
import { EditorScreen, ProcessedMediaResult } from '../types';
import { VideoEditorView } from './VideoEditorView';
import { AudioEditorView } from './AudioEditorView';

export interface AiEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostVideo: (dataUrl: string, isReel: boolean, title: string) => void;
  onPostAudio: (result: ProcessedMediaResult) => void;
}

export const AiEditorModal: React.FC<AiEditorModalProps> = ({
  isOpen,
  onClose,
  onPostVideo,
  onPostAudio,
}) => {
  const [screen, setScreen] = useState<EditorScreen>('select');
  const [selectedVideoFiles, setSelectedVideoFiles] = useState<File[]>([]);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setSelectedVideoFiles(files);
      setScreen('video_edit');
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAudioFile(file);
      setScreen('audio_edit');
    }
  };

  const handleResetHome = () => {
    setSelectedVideoFiles([]);
    setSelectedAudioFile(null);
    setScreen('select');
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const handleModalClose = () => {
    handleResetHome();
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn touch-auto"
      onClick={(e) => {
        // Prevent clicking backdrop from penetrating into underlying tabs
        e.stopPropagation();
      }}
    >
      <div
        className="relative w-full max-w-lg h-[94vh] max-h-[840px] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen 1: Selection Home (Two Large Choices) */}
        {screen === 'select' && (
          <div className="flex-1 flex flex-col h-full bg-slate-900 text-white select-none">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-teal-500 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    METFA AI Editor
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Simple • Private • 100% In-Browser
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleModalClose();
                }}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content: Two Large Touch Choices */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
              <p className="text-xs text-slate-400 text-center font-medium max-w-xs">
                Select your media to begin. All trimming, enhancement, and audio filtering run safely on your device.
              </p>

              {/* Hidden file inputs */}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = '';
                }}
                onChange={handleVideoSelect}
                className="hidden"
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = '';
                }}
                onChange={handleAudioSelect}
                className="hidden"
              />

              {/* Choice 1: Video */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoInputRef.current) {
                    videoInputRef.current.value = '';
                    videoInputRef.current.click();
                  }
                }}
                className="w-full max-w-sm p-6 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-850 hover:from-purple-950/60 hover:to-slate-800 border-2 border-slate-700/80 hover:border-purple-500/80 text-left transition transform active:scale-98 cursor-pointer shadow-xl group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-600/20 group-hover:bg-purple-600/30 text-purple-400 flex items-center justify-center border border-purple-500/30 shrink-0">
                    <VideoIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Video</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                        Single or Multi-Clip
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      Select one or multiple clips. Trim unwanted parts, boost visual clarity, clean audio, or crop to a 9:16 Reel.
                    </p>
                  </div>
                </div>
              </button>

              {/* Choice 2: Audio */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (audioInputRef.current) {
                    audioInputRef.current.value = '';
                    audioInputRef.current.click();
                  }
                }}
                className="w-full max-w-sm p-6 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-850 hover:from-teal-950/60 hover:to-slate-800 border-2 border-slate-700/80 hover:border-teal-500/80 text-left transition transform active:scale-98 cursor-pointer shadow-xl group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-teal-500/20 group-hover:bg-teal-500/30 text-teal-400 flex items-center justify-center border border-teal-500/30 shrink-0">
                    <MicIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Audio</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold">
                        Original Sound
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      Trim silence, clean speech with vocal EQ, reduce background noise, or improve sound.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 text-center shrink-0">
              <span className="text-[11px] text-slate-500">
                Nokia 1100 Simplicity: No complicated timelines or menus. Select, touch, export.
              </span>
            </div>
          </div>
        )}

        {/* Screen 2: Video Editor View */}
        {screen === 'video_edit' && selectedVideoFiles.length > 0 && (
          <VideoEditorView
            initialFiles={selectedVideoFiles}
            onBack={handleResetHome}
            onPostToSocial={(dataUrl, isReel, title) => {
              onPostVideo(dataUrl, isReel, title);
              handleModalClose();
            }}
          />
        )}

        {/* Screen 3: Audio Editor View */}
        {screen === 'audio_edit' && selectedAudioFile && (
          <AudioEditorView
            originalFile={selectedAudioFile}
            onBack={handleResetHome}
            onPostToSocial={(result) => {
              onPostAudio(result);
              handleModalClose();
            }}
          />
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
