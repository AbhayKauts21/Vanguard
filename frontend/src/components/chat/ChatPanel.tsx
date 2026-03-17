"use client";

import { SessionStatus } from "./SessionStatus";
import { MessageList, type ChatMessage } from "./MessageList";
import { EmptyState } from "./EmptyState";
import { TypingIndicator } from "./TypingIndicator";
import { Composer } from "./Composer";

interface ChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (message: string) => void;
  disabled?: boolean;
}

/* Full chat panel — status + messages + composer. */
export function ChatPanel({ messages, isThinking, onSend, disabled }: ChatPanelProps) {
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <SessionStatus />

      {hasMessages ? <MessageList messages={messages} /> : <EmptyState />}

      {isThinking && <TypingIndicator />}

      <Composer onSend={onSend} disabled={disabled} />
    </div>
  );
}
