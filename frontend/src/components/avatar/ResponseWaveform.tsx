"use client";

import { useChatStore } from "@/domains/chat/model";

const BAR_DELAYS = [0.05, 0.18, 0.32, 0.14, 0.28, 0.38];

export function ResponseWaveform() {
  const { streamingMessageId, streamingLength } = useChatStore((state) => {
    const streamingMessage = state.streamingMessageId
      ? state.messages.find((message) => message.id === state.streamingMessageId)
      : null;

    return {
      streamingMessageId: state.streamingMessageId,
      streamingLength: streamingMessage?.content.length ?? 0,
    };
  });

  const isActive = Boolean(streamingMessageId);
  const pulseKey = `${streamingMessageId ?? "idle"}:${streamingLength}`;

  return (
    <div className="relative mt-3 flex items-end gap-[3px] rounded-full border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-md">
      {BAR_DELAYS.map((delay, index) => (
        <span
          key={`${pulseKey}:${index}`}
          className={`waveform-bar ${isActive ? "animate-waveform bg-emerald-300" : "bg-white/30"}`}
          style={{
            animationDelay: `${delay}s`,
            height: isActive ? undefined : `${4 + (index % 3) * 2}px`,
          }}
        />
      ))}

      {isActive && (
        <span
          key={pulseKey}
          className="pointer-events-none absolute inset-0 rounded-full border border-emerald-400/20 animate-token-pulse"
        />
      )}
    </div>
  );
}
