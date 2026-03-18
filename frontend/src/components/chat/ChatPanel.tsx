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

/**
 * Full chat panel — matches original HTML.
 * Biometric neural activity bar on left edge, glass panel container,
 * uplink status, message area, typing indicator, input composer.
 */
export function ChatPanel({ messages, isThinking, onSend, disabled }: ChatPanelProps) {
  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Biometric neural activity bar on left edge */}
      <div className="absolute left-0 top-[15%] bottom-[15%] w-[1px] bg-white/5 z-10 overflow-hidden rounded-full">
        <div
          className="w-full bg-white/40 shadow-[0_0_8px_white] animate-neural-pulse h-0 opacity-0 transition-all duration-300"
          id="neural-activity-bar"
        />
      </div>

      {/* Main glass container */}
      <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden shadow-2xl panel-boundary transition-all duration-1000">
        <SessionStatus />

        {hasMessages ? <MessageList messages={messages} /> : <EmptyState />}

        {isThinking && <TypingIndicator />}

        <Composer onSend={onSend} disabled={disabled} />
      </div>
    </>
  );
}
