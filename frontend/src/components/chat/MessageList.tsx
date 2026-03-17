"use client";

import { cn } from "@/lib/utils";
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

/* Scrollable list of chat messages. */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to latest message. */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={cn("flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4")}>
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          citations={msg.citations}
          isStreaming={msg.isStreaming}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
