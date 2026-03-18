"use client";

import { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Citation } from "@/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

/**
 * Scrollable message list with auto-scroll.
 * Matches original HTML: space-y-12 spacing, thread layer backdrop.
 */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-12 scroll-smooth relative" id="message-container">
      {/* Thread synapse backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-20" id="thread-layer" />

      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          citations={msg.citations}
          isStreaming={msg.isStreaming}
          delay={i * 0.2}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
