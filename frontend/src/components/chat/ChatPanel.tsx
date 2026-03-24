"use client";

import { SessionStatus } from "./SessionStatus";
import { MessageList, type ChatMessage } from "./MessageList";
import { EmptyState } from "./EmptyState";
import { TypingIndicator } from "./TypingIndicator";
import { Composer } from "./Composer";
import { OfflineBanner } from "./OfflineBanner";
import { useChatStore } from "@/domains/chat/model";

interface ChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (message: string) => void;
  disabled?: boolean;
}

/**
 * Error banner component for displaying chat errors
 */
function ErrorBanner({ errorType }: { errorType: string | null }) {
  if (!errorType) return null;
  
  let message = "A system error occurred.";
  let icon = "error";
  
  if (errorType === "network") {
    message = "Cannot reach CLEO Core. Connection offline.";
    icon = "cloud_off";
  } else if (errorType === "server") {
    message = "CLEO Core is experiencing localized anomalies. Try again.";
    icon = "dns";
  } else if (errorType === "rate-limit") {
    message = "Neural link saturated. Too many requests. Please wait.";
    icon = "hourglass_empty";
  }

  return (
    <div className="mx-8 mt-4 mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400/90 shadow-lg shrink-0">
      <span className="material-symbols-outlined shrink-0 text-lg">{icon}</span>
      <span className="text-[13px] font-medium tracking-wide">{message}</span>
    </div>
  );
}

/**
 * Full chat panel — matches original HTML.
 * Biometric neural activity bar on left edge, glass panel container,
 * uplink status, message area, typing indicator, input composer.
 */
export function ChatPanel({ messages, isThinking, onSend, disabled }: ChatPanelProps) {
  const hasMessages = messages.length > 0;
  const errorType = useChatStore((s) => s.errorType);

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
      <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden shadow-2xl panel-boundary transition-all duration-1000 relative">
        <SessionStatus />
        
        <ErrorBanner errorType={errorType} />
        <OfflineBanner />

        {hasMessages ? <MessageList messages={messages} /> : <EmptyState />}

        {isThinking && <TypingIndicator />}

        <Composer onSend={onSend} disabled={disabled} />
      </div>
    </>
  );
}
