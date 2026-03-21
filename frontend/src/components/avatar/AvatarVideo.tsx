import { useEffect, useRef } from "react";
import { useHeyGenAvatar } from "@/domains/avatar/hooks/useHeyGenAvatar";
import { useAvatarStore } from "@/domains/avatar/model/avatar-store";
import { AvatarSphere } from "./AvatarSphere";
import { env } from "@/lib/env";

export function AvatarVideo() {
  const { stream, initAvatar } = useHeyGenAvatar();
  const { isConnected, isLoading, error } = useAvatarStore();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Start WebRTC connection on mount if it's enabled
    if (env.enableAvatar) {
      initAvatar();
    }
  }, []);

  useEffect(() => {
    // Pipe the React stream state directly into the HTML5 video element source map
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!env.enableAvatar || (!isConnected && !stream && !isLoading)) {
    // Fall back to the ambient sphere when waiting for a stream or if disabled
    return <AvatarSphere />;
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-6 lg:p-12 overflow-hidden">
      {/* Container sizing the avatar within bounds while hiding internal SDK overflows */}
      <div className="relative aspect-[3/4] w-full max-w-[400px] overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-3xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            stream ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Loading overlay gracefully sits while the WebRTC packet handshake occurs */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-10 transition-opacity">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
            <span className="mt-4 text-xs tracking-widest text-indigo-300 uppercase animate-pulse">
              Establishing Connect...
            </span>
          </div>
        )}

        {/* Failed network rendering logic */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/20 backdrop-blur-md p-6 text-center z-10 transition-opacity">
            <span className="material-symbols-outlined text-red-500 text-3xl mb-2">error</span>
            <span className="text-sm font-medium text-red-400">{error}</span>
            <span className="text-xs text-white/50 mt-2">Falling back to ambient sphere...</span>
          </div>
        )}
      </div>
    </div>
  );
}
