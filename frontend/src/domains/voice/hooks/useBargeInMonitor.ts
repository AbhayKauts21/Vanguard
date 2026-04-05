"use client";

import { useEffect, useRef } from "react";

interface UseBargeInMonitorOptions {
  active: boolean;
  speaking: boolean;
  onBargeIn: () => void;
  threshold?: number;
  holdMs?: number;
  cooldownMs?: number;
}

const DEFAULT_THRESHOLD = 0.12;
const DEFAULT_HOLD_MS = 220;
const DEFAULT_COOLDOWN_MS = 1200;

function computeRms(data: Uint8Array): number {
  let sum = 0;

  for (let index = 0; index < data.length; index += 1) {
    const normalized = (data[index] - 128) / 128;
    sum += normalized * normalized;
  }

  return Math.sqrt(sum / data.length);
}

export function useBargeInMonitor({
  active,
  speaking,
  onBargeIn,
  threshold = DEFAULT_THRESHOLD,
  holdMs = DEFAULT_HOLD_MS,
  cooldownMs = DEFAULT_COOLDOWN_MS,
}: UseBargeInMonitorOptions) {
  const speakingRef = useRef(speaking);
  const onBargeInRef = useRef(onBargeIn);
  const holdStartRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<number>(0);

  useEffect(() => {
    speakingRef.current = speaking;
    if (!speaking) {
      holdStartRef.current = null;
    }
  }, [speaking]);

  useEffect(() => {
    onBargeInRef.current = onBargeIn;
  }, [onBargeIn]);

  useEffect(() => {
    if (!active || typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const stop = async () => {
      cancelled = true;

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      holdStartRef.current = null;

      source?.disconnect();
      analyser?.disconnect();

      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }

      if (audioContext && audioContext.state !== "closed") {
        try {
          await audioContext.close();
        } catch {
          // Best-effort cleanup.
        }
      }
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (error) {
        console.warn("[VoiceMode] Barge-in monitor unavailable:", error);
        return;
      }

      if (cancelled) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextCtor) {
        return;
      }

      audioContext = new AudioContextCtor();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (cancelled || !analyser) {
          return;
        }

        analyser.getByteTimeDomainData(data);
        const rms = computeRms(data);
        const now = performance.now();

        if (speakingRef.current && rms >= threshold) {
          holdStartRef.current ??= now;
          const exceededHold = now - holdStartRef.current >= holdMs;
          const cooledDown = now - lastTriggerRef.current >= cooldownMs;

          if (exceededHold && cooledDown) {
            lastTriggerRef.current = now;
            holdStartRef.current = null;
            onBargeInRef.current();
          }
        } else {
          holdStartRef.current = null;
        }

        animationFrameId = requestAnimationFrame(tick);
      };

      animationFrameId = requestAnimationFrame(tick);
    };

    void start();

    return () => {
      void stop();
    };
  }, [active, cooldownMs, holdMs, threshold]);
}
