"use client";

import { SessionStatus } from "./SessionStatus";
import { MessageList, type ChatMessage } from "./MessageList";
import { EmptyState } from "./EmptyState";
import { TypingIndicator } from "./TypingIndicator";
import { Composer } from "./Composer";
import { OfflineBanner } from "./OfflineBanner";
import { SuggestedPromptRail } from "./SuggestedPromptRail";
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
  const shouldShowPromptRail = hasMessages && messages.length <= 4 && !isThinking;

  return (
    <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden shadow-2xl panel-boundary transition-all duration-1000 relative">
      <div className="pointer-events-none absolute inset-px rounded-[inherit]">
        <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-xl border-l border-t border-white/20" />
      </div>

      <SessionStatus />

      <ErrorBanner errorType={errorType} />
      <OfflineBanner />

      {hasMessages ? <MessageList messages={messages} /> : <EmptyState onSend={onSend} disabled={disabled} />}

      {shouldShowPromptRail && (
        <SuggestedPromptRail
          onSend={onSend}
          disabled={disabled}
          className="px-8 pb-4"
        />
      )}

      {isThinking && <TypingIndicator />}

      <Composer onSend={onSend} disabled={disabled} />
    </div>
  );
}
