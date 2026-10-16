/**
 * METFA AI Editor — Web Audio API Audio Processor
 * Performs real client-side audio operations:
 * - Start/End Trimming
 * - Clean Voice (vocal presence boost, high-pass rumble cutoff, hiss attenuation, dynamics compression)
 * - Improve Sound (balanced frequency enhancement, loudness optimization)
 */

import { audioBufferToWavBlob } from './wavEncoder';
import { ProcessedMediaResult } from '../types';

export function isWebAudioSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || (window as any).webkitAudioContext);
}

function getAudioContext(): AudioContext {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  return new AudioCtx();
}

/**
 * Decodes an Audio File or Blob into a Web Audio API AudioBuffer.
 * Supports Promise-based and legacy callback-based decodeAudioData implementations.
 */
export async function decodeAudioFile(file: File | Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();

  try {
    // Some mobile browsers require resume() before decoding
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    // Modern Promise vs legacy callback support
    const bufferCopy = arrayBuffer.slice(0);
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      let isSettled = false;
      const res = (b: AudioBuffer) => {
        if (!isSettled) {
          isSettled = true;
          resolve(b);
        }
      };
      const rej = (err: any) => {
        if (!isSettled) {
          isSettled = true;
          reject(err || new Error('Audio decoding failed'));
        }
      };

      try {
        const promise = ctx.decodeAudioData(bufferCopy, res, rej);
        if (promise && typeof promise.then === 'function') {
          promise.then(res).catch(rej);
        }
      } catch (callErr) {
        rej(callErr);
      }
    });

    return audioBuffer;
  } finally {
    if (ctx.state !== 'closed') {
      try {
        await ctx.close();
      } catch {}
    }
  }
}

/**
 * Trims an AudioBuffer between startTime and endTime (in seconds).
 */
export async function trimAudioBuffer(
  sourceBuffer: AudioBuffer,
  startTime: number,
  endTime: number
): Promise<AudioBuffer> {
  const sampleRate = sourceBuffer.sampleRate;
  const numChannels = sourceBuffer.numberOfChannels;
  const totalDuration = sourceBuffer.duration;

  const validStart = Math.max(0, Math.min(startTime, totalDuration));
  const validEnd = Math.max(validStart + 0.1, Math.min(endTime, totalDuration));

  const startSample = Math.floor(validStart * sampleRate);
  const endSample = Math.min(Math.floor(validEnd * sampleRate), sourceBuffer.length);
  const newLength = Math.max(1, endSample - startSample);

  const ctx = getAudioContext();
  try {
    const trimmedBuffer = ctx.createBuffer(numChannels, newLength, sampleRate);

    for (let c = 0; c < numChannels; c++) {
      const channelData = sourceBuffer.getChannelData(c);
      const sub = channelData.subarray(startSample, endSample);
      trimmedBuffer.copyToChannel(sub, c);
    }

    return trimmedBuffer;
  } finally {
    if (ctx.state !== 'closed') {
      try {
        await ctx.close();
      } catch {}
    }
  }
}

/**
 * Clean Voice: Applies real audio filtering using OfflineAudioContext:
 * 1. High-pass filter at 85 Hz to cut mic rumbles and wind
 * 2. Peaking filter at 2.5 kHz (+3.5 dB) for vocal presence
 * 3. Low-pass filter at 12 kHz to reduce harsh hiss
 * 4. Dynamics compressor to normalize vocal peaks
 */
export async function cleanVoiceAudioBuffer(sourceBuffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    sourceBuffer.sampleRate
  );

  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = sourceBuffer;

  // 1. Highpass filter (cuts low-frequency background hum and handling noise)
  const highpass = offlineCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 85;

  // 2. Peaking vocal presence filter (enhances dialogue intelligibility)
  const vocalPresence = offlineCtx.createBiquadFilter();
  vocalPresence.type = 'peaking';
  vocalPresence.frequency.value = 2500;
  vocalPresence.Q.value = 1.2;
  vocalPresence.gain.value = 3.5;

  // 3. Lowpass filter (cuts ultra-high background hiss)
  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 12000;

  // 4. Dynamics Compressor (levels out quiet and loud vocal sections)
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 20;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // Chain nodes
  sourceNode.connect(highpass);
  highpass.connect(vocalPresence);
  vocalPresence.connect(lowpass);
  lowpass.connect(compressor);
  compressor.connect(offlineCtx.destination);

  sourceNode.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

/**
 * Improve Sound: Applies balanced acoustic sweetening using OfflineAudioContext:
 * 1. Low-shelf warmth boost at 120 Hz (+2 dB)
 * 2. Peaking mid-clarity at 1.2 kHz (+1.5 dB)
 * 3. High-shelf brilliance boost at 8 kHz (+2.5 dB)
 * 4. Gentle loudness compression
 */
export async function improveSoundAudioBuffer(sourceBuffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    sourceBuffer.sampleRate
  );

  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = sourceBuffer;

  // 1. Low-shelf filter for warmth
  const lowShelf = offlineCtx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 120;
  lowShelf.gain.value = 2.0;

  // 2. Peaking mid filter for body
  const midPeak = offlineCtx.createBiquadFilter();
  midPeak.type = 'peaking';
  midPeak.frequency.value = 1200;
  midPeak.Q.value = 1.0;
  midPeak.gain.value = 1.5;

  // 3. High-shelf filter for sparkle
  const highShelf = offlineCtx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8000;
  highShelf.gain.value = 2.5;

  // 4. Dynamics Compressor for loudness polish
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 15;
  compressor.ratio.value = 3.5;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.2;

  // Chain nodes
  sourceNode.connect(lowShelf);
  lowShelf.connect(midPeak);
  midPeak.connect(highShelf);
  highShelf.connect(compressor);
  compressor.connect(offlineCtx.destination);

  sourceNode.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer;
}

/**
 * Converts an AudioBuffer into a ProcessedMediaResult with real WAV blob and DataURL.
 */
export async function exportAudioBufferResult(
  buffer: AudioBuffer,
  baseName = 'edited_audio',
  appliedOperations: string[] = []
): Promise<ProcessedMediaResult> {
  const wavBlob = audioBufferToWavBlob(buffer);
  const dataUrl = await blobToDataUrl(wavBlob);
  const cleanName = `${baseName.replace(/\.[^/.]+$/, '')}_edited.wav`;

  return {
    type: 'audio',
    blob: wavBlob,
    dataUrl,
    name: cleanName,
    sizeBytes: wavBlob.size,
    mimeType: 'audio/wav',
    durationSeconds: buffer.duration,
    appliedOperations,
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
