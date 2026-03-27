"use client";

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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { send } = useChat();
  const { sendStream } = useChatStream();
  const { createNewChat, loadChat } = useChatHistory();

  /* Use streaming when enabled via env. */
  const handleSend = env.enableStreaming ? sendStream : send;

  /* Voice mode orchestration. */
  const { activate, deactivate, sendVoiceMessage } = useVoiceMode();
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const voicePhase = useVoiceStore((s) => s.phase);
  const isSupported = useVoiceStore((s) => s.isSupported);

  const voiceProps = {
    isVoiceMode,
    isSupported,
    phase: voicePhase,
    onActivate: activate,
    onDeactivate: deactivate,
    onSendVoiceMessage: sendVoiceMessage,
  };

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
              onSelectChat: loadChat,
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
