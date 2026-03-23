import { useEffect, useRef, useState, useCallback } from "react";
import StreamingAvatar, { AvatarQuality, StreamingEvents, TaskType } from "@heygen/streaming-avatar";
import { useAvatarStore } from "../model/avatar-store";
import { fetchHeyGenToken } from "../api/avatarApi";
import { env } from "@/lib/env";

/**
 * Locale → HeyGen voice-id mapping.
 * Falls back to the env default when a locale is not mapped.
 */
const VOICE_MAP: Record<string, string> = {
  en: env.heygen.voiceId,
  es: env.heygen.voiceIdEs,
};

/**
 * Resolve voice id for the given locale.
 */
function resolveVoice(locale: string): string {
  return VOICE_MAP[locale] ?? env.heygen.voiceId;
}

export function useHeyGenAvatar(locale: string = "en") {
  const { setConnectionStatus, setLoading, setState, setError, setSpeakFn } = useAvatarStore();
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  /** Gracefully tear down the WebRTC session. */
  const endSession = useCallback(async () => {
    if (avatarRef.current) {
      try {
        await avatarRef.current.stopAvatar();
      } catch {
        /* Best-effort — session may already be closed. */
      }
      avatarRef.current = null;
      setStream(null);
      setConnectionStatus(false);
    }
  }, [setConnectionStatus]);

  const initAvatar = useCallback(async () => {
    if (!env.enableAvatar) return;

    try {
      setLoading(true);
      setError(null);
      setState("idle");

      const token = await fetchHeyGenToken();

      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      // Event bindings
      avatar.on(StreamingEvents.STREAM_READY, (event: { detail: MediaStream }) => {
        setStream(event.detail);
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setStream(null);
        setConnectionStatus(false);
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => setState("speaking"));
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => setState("idle"));

      // Boot stream with locale-aware voice
      await avatar.createStartAvatar({
        quality: AvatarQuality.High,
        avatarName: env.heygen.avatarId,
        voice: {
          voiceId: resolveVoice(locale),
        },
      });

      setConnectionStatus(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to initialize HeyGen Stream";
      setError(message);
      setConnectionStatus(false);
    } finally {
      setLoading(false);
    }
  }, [locale, setConnectionStatus, setLoading, setState, setError]);

  const speak = useCallback(async (text: string) => {
    if (!avatarRef.current || !useAvatarStore.getState().isConnected) return;

    // Respect mute — skip speech but keep state transitions
    if (useAvatarStore.getState().isMuted) return;

    try {
      await avatarRef.current.speak({ text, taskType: TaskType.REPEAT });
    } catch (e: unknown) {
      console.error("Avatar speech error:", e);
    }
  }, []);

  const interrupt = useCallback(async () => {
    if (!avatarRef.current || !useAvatarStore.getState().isConnected) return;
    try {
      await avatarRef.current.interrupt();
      setState("idle");
    } catch (e: unknown) {
      console.error("Failed to interrupt avatar", e);
    }
  }, [setState]);

  // Cleanup on unmount + beforeunload for tab close (prevents WebRTC leak)
  useEffect(() => {
    setSpeakFn(speak);

    const handleBeforeUnload = () => {
      if (avatarRef.current) {
        avatarRef.current.stopAvatar().catch(() => {});
        avatarRef.current = null;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setSpeakFn(null);
      endSession();
    };
  }, [endSession, setSpeakFn, speak]);

  return { stream, initAvatar, endSession, speak, interrupt };
}
