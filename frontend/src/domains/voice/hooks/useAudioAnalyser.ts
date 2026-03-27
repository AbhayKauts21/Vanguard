"use client";

import { useRef, useCallback, useEffect } from "react";
import { AudioQueue, type AudioQueueCallbacks } from "@/domains/voice/engine";
import { useVoiceStore } from "@/domains/voice/model";

/**
 * Hook that manages the AudioQueue for TTS playback and exposes
 * real-time audio level data for avatar energy core sync.
 *
 * The audioLevel (0-1) drives the energy core's noise intensity and scale
 * during the "speaking" phase, creating the heartbeat/breathing sync effect.
 */
export function useAudioAnalyser() {
  const queueRef = useRef<AudioQueue | null>(null);
  const setAudioLevel = useVoiceStore((s) => s.setAudioLevel);

  /** Get or create the audio queue singleton for this hook instance. */
  const getQueue = useCallback((): AudioQueue => {
    if (!queueRef.current) {
      const callbacks: AudioQueueCallbacks = {
        onAudioLevel: (level) => {
          setAudioLevel(level);
        },
        onQueueDrained: () => {
          setAudioLevel(0);
        },
        onChunkStart: () => {
          // Could trigger per-sentence UI updates here
        },
        onError: (error) => {
          console.error("[AudioQueue]", error);
          setAudioLevel(0);
        },
      };

      queueRef.current = new AudioQueue(callbacks);
    }

    return queueRef.current;
  }, [setAudioLevel]);

  /** Enqueue an audio blob for sequential playback. */
  const enqueueAudio = useCallback(
    (blob: Blob) => {
      getQueue().enqueue(blob);
    },
    [getQueue],
  );

  /** Stop all playback and clear the queue. */
  const stopAudio = useCallback(() => {
    queueRef.current?.stop();
    setAudioLevel(0);
  }, [setAudioLevel]);

  /** Reset the queue for a new voice turn. */
  const resetAudio = useCallback(() => {
    queueRef.current?.reset();
    setAudioLevel(0);
  }, [setAudioLevel]);

  /** Resume the audio context (required for autoplay policy). */
  const resumeAudio = useCallback(async () => {
    await getQueue().resume();
  }, [getQueue]);

  /** Whether audio is currently playing or queued. */
  const isPlaying = useCallback((): boolean => {
    return queueRef.current?.active ?? false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      queueRef.current?.stop();
      queueRef.current = null;
    };
  }, []);

  return {
    enqueueAudio,
    stopAudio,
    resetAudio,
    resumeAudio,
    isPlaying,
  };
}
