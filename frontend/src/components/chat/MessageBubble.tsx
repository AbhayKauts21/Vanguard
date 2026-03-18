"use client";

import { useTranslations } from "next-intl";
import { fireNeuralLink } from "@/components/effects/NeuralSvgOverlay";
import type { Citation } from "@/types";
import { useRef } from "react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  delay?: number;
}

/**
 * Single chat message — matches original HTML exactly.
 * CLEO messages: waveform icon + left-aligned rounded-tl-none bubble.
 * Operator messages: diamond icon + right-aligned rounded-tr-none bubble.
 */
export function MessageBubble({ role, content, citations, isStreaming, delay = 0 }: MessageBubbleProps) {
  const t = useTranslations("chat");
  const isUser = role === "user";

  return (
    <div
      className="flex flex-col gap-3 max-w-[95%] message-bloom message-echo"
      style={{
        animationDelay: `${delay}s`,
        ...(isUser ? { marginLeft: "auto", alignItems: "flex-end" } : {}),
      }}
    >
      {/* Sender label row */}
      <div className={`flex items-center gap-3 mb-0.5 ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar icon */}
        <div className="size-6 rounded-full glass-panel flex items-center justify-center border border-white/20 bg-white/5">
          {isUser ? (
            /* Diamond shape for operator */
            <div className="w-3 h-3 rotate-45 border border-white/40" />
          ) : (
            /* Waveform bars for CLEO */
            <div className="flex items-end h-3 gap-[1px]">
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.1s" }} />
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.3s" }} />
              <div className="waveform-bar animate-waveform" style={{ animationDelay: "0.2s" }} />
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
          {isUser ? "Operator" : "CLEO Core"}
        </span>
      </div>

      {/* Message bubble */}
      <div
        className={`border border-white/10 p-5 text-white/80 text-[13px] leading-relaxed shadow-sm hover:border-white/20 transition-colors inline-block w-fit ${
          isUser
            ? "bg-white/[0.08] rounded-2xl rounded-tr-none text-white/90"
            : "bg-white/[0.03] rounded-2xl rounded-tl-none"
        }`}
      >
        {content}

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-[2px] h-4 bg-white/60 ml-0.5 animate-pulse" />
        )}

        {/* Citations / source cards */}
        {citations && citations.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-2.5">
            {citations.map((c) => (
              <SourceCard key={c.page_id} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Source card with chevron and neural link fire — matches original HTML. */
function SourceCard({ citation }: { citation: Citation }) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick() {
    if (ref.current) fireNeuralLink(ref.current);
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className="source-card flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/30 transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-white/40 group-hover:text-white/80 transition-colors text-lg">
          database
        </span>
        <div>
          <p className="text-[11px] font-semibold text-white/90 leading-tight">
            {citation.page_title}
          </p>
          <p className="text-[9px] text-white/30 tracking-wider">
            Page {citation.page_id}
          </p>
        </div>
      </div>
      <span className="material-symbols-outlined text-sm text-white/30 group-hover:translate-x-0.5 transition-transform">
        chevron_right
      </span>
    </div>
  );
}
