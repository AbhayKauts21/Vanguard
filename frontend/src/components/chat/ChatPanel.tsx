"use client";

import { useEffect } from "react";

import { SessionStatus } from "./SessionStatus";
import { ChatHistoryRail } from "./ChatHistoryRail";
import { MessageList, type ChatMessage } from "./MessageList";
import { EmptyState } from "./EmptyState";
import { TypingIndicator } from "./TypingIndicator";
import { Composer } from "./Composer";
import { OfflineBanner } from "./OfflineBanner";
import { SuggestedPromptRail } from "./SuggestedPromptRail";
import { VoiceTranscript } from "@/components/voice";
import { useChatStore } from "@/domains/chat/model";
import type { ChatSummary } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (message: string) => void;
  disabled?: boolean;
  history?: {
    isVisible: boolean;
    chats: ChatSummary[];
    activeChatId: string | null;
    isLoading?: boolean;
    hasMoreMessages?: boolean;
    isLoadingOlderMessages?: boolean;
    onSelectChat: (chatId: string) => void;
    onLoadOlderMessages: () => void;
    onCreateChat: () => void;
    onDeleteChat: (chatId: string) => void;
  };
  /** Voice mode controls forwarded to Composer. */
  voice?: {
    isVoiceMode: boolean;
    isSupported: boolean;
    phase: string;
    onActivate: () => void;
    onDeactivate: () => void;
    onSendVoiceMessage: () => void;
  };
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
export function ChatPanel({ messages, isThinking, onSend, disabled, history, voice }: ChatPanelProps) {
  const hasMessages = messages.length > 0;
  const errorType = useChatStore((s) => s.errorType);
  const isHistoryCollapsed = useChatStore((s) => s.isHistoryCollapsed);
  const toggleHistory = useChatStore((s) => s.toggleHistory);
  const setHistoryCollapsed = useChatStore((s) => s.setHistoryCollapsed);
  
  const shouldShowPromptRail = hasMessages && messages.length <= 4 && !isThinking;

  useEffect(() => {
    if (!history?.isVisible) {
      setHistoryCollapsed(false);
    }
  }, [history?.isVisible, setHistoryCollapsed]);

  return (
    <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden shadow-2xl panel-boundary relative">
      <div className="pointer-events-none absolute inset-px rounded-[inherit]">
        <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-xl border-l border-t border-white/20" />
      </div>

      <SessionStatus 
        onNewChat={history?.onCreateChat} 
        isHistoryVisible={history?.isVisible}
        isHistoryCollapsed={isHistoryCollapsed}
        onToggleHistory={toggleHistory}
      />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {history?.isVisible && !isHistoryCollapsed ? (
          <ChatHistoryRail
            chats={history.chats}
            activeChatId={history.activeChatId}
            isLoading={history.isLoading}
            onSelectChat={history.onSelectChat}
            onCreateChat={history.onCreateChat}
            onDeleteChat={history.onDeleteChat}
            onToggleCollapse={() => setHistoryCollapsed(true)}
          />
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">

          <ErrorBanner errorType={errorType} />
          <OfflineBanner />
          {hasMessages ? (
            <MessageList
              messages={messages}
              hasMoreHistory={history?.hasMoreMessages}
              isLoadingOlder={history?.isLoadingOlderMessages}
              onLoadOlder={history?.onLoadOlderMessages}
            />
          ) : (
            <EmptyState onSend={onSend} disabled={disabled} />
          )}

          {shouldShowPromptRail && (
            <SuggestedPromptRail
              onSend={onSend}
              disabled={disabled}
              className="px-8 pb-4"
            />
          )}

          {isThinking && <TypingIndicator />}

          <Composer onSend={onSend} disabled={disabled} voice={voice} />
        </div>
      </div>

      {/* Voice transcript overlay — localized to chat panel now */}
      {voice?.isVoiceMode && <VoiceTranscript onDeactivate={voice.onDeactivate} />}
    </div>
  );
}
