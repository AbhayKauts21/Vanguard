import { useEffect, useRef, useState } from "react";
import StreamingAvatar, { AvatarQuality, StreamingEvents, TaskType } from "@heygen/streaming-avatar";
import { useAvatarStore } from "../model/avatar-store";
import { env } from "@/lib/env";

export function useHeyGenAvatar() {
  const { setConnectionStatus, setLoading, setState, setError, setSpeakFn } = useAvatarStore();
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const fetchToken = async (): Promise<string> => {
    const res = await fetch("/api/heygen/token", { method: "POST" });
    if (!res.ok) {
      throw new Error("Failed to fetch WebRTC token from internal API");
    }
    const data = await res.json();
    return data.token;
  };

  const initAvatar = async () => {
    if (!env.enableAvatar) return;

    try {
      setLoading(true);
      setError(null);
      setState("idle");

      const token = await fetchToken();
      
      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      // Event Bindings
      avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
        setStream(event.detail);
      });
      
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setStream(null);
        setConnectionStatus(false);
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => setState("speaking"));
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => setState("idle"));

      // Boot stream
      await avatar.createStartAvatar({
        quality: AvatarQuality.High,
        avatarName: env.heygen.avatarId,
        voice: {
          voiceId: env.heygen.voiceId,
        },
      });

      setConnectionStatus(true);
    } catch (err: any) {
      setError(err.message || "Failed to initialize HeyGen Stream");
      setConnectionStatus(false);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (avatarRef.current) {
      await avatarRef.current.stopAvatar();
      avatarRef.current = null;
      setStream(null);
      setConnectionStatus(false);
    }
  };

  const speak = async (text: string) => {
    if (!avatarRef.current || !useAvatarStore.getState().isConnected) return;
    try {
      await avatarRef.current.speak({ text, taskType: TaskType.REPEAT });
    } catch (e: any) {
      console.error("Avatar speech error:", e);
    }
  };

  const interrupt = async () => {
    if (!avatarRef.current || !useAvatarStore.getState().isConnected) return;
    try {
      await avatarRef.current.interrupt();
      setState("idle");
    } catch (e: any) {
      console.error("Failed to interrupt avatar", e);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    setSpeakFn(speak);
    return () => { 
      setSpeakFn(null);
      endSession(); 
    };
  }, []);

  return { stream, initAvatar, endSession, speak, interrupt };
}
