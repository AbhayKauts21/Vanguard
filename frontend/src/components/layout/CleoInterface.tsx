"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

import { AppShell, TopBar, FooterStatusBar, SplitPanelLayout } from "@/components/layout";
import { ChatPanel } from "@/components/chat";
import { AvatarPanel } from "@/components/avatar";
import { useChatStore } from "@/domains/chat/model";
import { useChat, useChatHistory, useChatStream } from "@/domains/chat/hooks";
import { useAuthStore } from "@/domains/auth/model";
import { useVoiceMode } from "@/domains/voice/hooks";
import { useVoiceStore } from "@/domains/voice/model";
import { env } from "@/lib/env";

/* Main CLEO neural interface — wires layout + chat + backend. */
export default function CleoInterface() {
  const messages = useChatStore((s) => s.messages);
  const isThinking = useChatStore((s) => s.isThinking);
  const streamingId = useChatStore((s) => s.streamingMessageId);
  const chatSummaries = useChatStore((s) => s.chatSummaries);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const isLoadingChats = useChatStore((s) => s.isLoadingChats);
  const isLoadingOlderMessages = useChatStore((s) => s.isLoadingOlderMessages);
  const messagePageInfo = useChatStore((s) => s.messagePageInfo);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  const { send } = useChat();
  const { sendStream } = useChatStream();
  const { createNewChat, loadChat, loadOlderMessages } = useChatHistory();

  /* Use streaming when enabled via env. */
  const handleSend = env.enableStreaming ? sendStream : send;

  /* Voice mode orchestration. */
  const { activate, deactivate, interruptCurrentTurn, sendVoiceMessage } = useVoiceMode();
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const voicePhase = useVoiceStore((s) => s.phase);
  const isSupported = useVoiceStore((s) => s.isSupported);

  const voiceProps = {
    isVoiceMode,
    isSupported,
    phase: voicePhase,
    onActivate: activate,
    onDeactivate: deactivate,
    onInterrupt: () => {
      void interruptCurrentTurn();
    },
    onSendVoiceMessage: sendVoiceMessage,
  };

  if (isHydrated && !isAuthenticated) return null;

  return (
    <AppShell>
      <TopBar />
      <SplitPanelLayout
        left={
          <ChatPanel
            messages={messages}
            isThinking={isThinking}
            onSend={handleSend}
            disabled={isThinking || !!streamingId}
            history={{
              isVisible: isAuthenticated,
              chats: chatSummaries,
              activeChatId,
              isLoading: isLoadingChats,
              hasMoreMessages: activeChatId ? (messagePageInfo[activeChatId]?.hasMore ?? false) : false,
              isLoadingOlderMessages,
              onSelectChat: loadChat,
              onLoadOlderMessages: () => {
                void loadOlderMessages();
              },
              onDeleteChat: (id) => void deleteConversation(id),
              onCreateChat: () => {
                void createNewChat();
              },
            }}
            voice={voiceProps}
          />
        }
        right={<AvatarPanel />}
      />

      <FooterStatusBar />
    </AppShell>
  );
}
