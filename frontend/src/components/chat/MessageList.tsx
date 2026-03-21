"use client";

import { useRef, useEffect, useState, UIEvent } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Citation } from "@/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  primary_citations?: Citation[];
  secondary_citations?: Citation[];
  all_citations?: Citation[];
  hidden_sources_count?: number;
  modeUsed?: 'rag' | 'uncertain' | 'azure_fallback';
  maxConfidence?: number;
  whatIFound?: { page_title: string; score: number }[];
  isStreaming?: boolean;
}

/**
 * Scrollable message list with auto-scroll.
 * Matches original HTML: space-y-12 spacing, thread layer backdrop.
 */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Auto-scroll logic
  useEffect(() => {
    if (!isScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isScrolledUp]);

  // Handle manual scroll to detect if user has scrolled up
  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 20;
    setIsScrolledUp(!isAtBottom);
  };

  const scrollToBottom = () => {
    setIsScrolledUp(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const isStreamingOrNew = messages.length > 0 && messages[messages.length - 1].isStreaming;

  return (
    <div 
      className="flex-1 overflow-y-auto p-8 space-y-12 scroll-smooth relative" 
      id="message-container"
      onScroll={handleScroll}
      ref={containerRef}
    >
      {/* Thread synapse backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-20" id="thread-layer" />

      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          primary_citations={msg.primary_citations}
          secondary_citations={msg.secondary_citations}
          all_citations={msg.all_citations}
          hidden_sources_count={msg.hidden_sources_count}
          modeUsed={msg.modeUsed}
          maxConfidence={msg.maxConfidence}
          whatIFound={msg.whatIFound}
          isStreaming={msg.isStreaming}
          delay={i * 0.2}
        />
      ))}
      <div ref={bottomRef} className="h-1 lg:h-4 w-full" />

      {/* Floating button for new messages when scrolled up */}
      {isScrolledUp && isStreamingOrNew && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full border border-white/20 bg-black/60 backdrop-blur-md px-4 py-2 text-white/90 text-[13px] shadow-xl flex items-center gap-2 hover:bg-white/10 transition-colors tracking-wide font-medium"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
          New messages
        </button>
      )}
    </div>
  );
}
