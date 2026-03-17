"use client";

import { AppShell, TopBar, FooterStatusBar, SplitPanelLayout } from "@/components/layout";
import { ChatPanel } from "@/components/chat";
import { AvatarPanel } from "@/components/avatar";
import { useChatStore } from "@/domains/chat/model";
import { useChat } from "@/domains/chat/hooks";

/* Main CLEO neural interface — wires layout + chat + backend. */
export default function CleoInterface() {
  const messages = useChatStore((s) => s.messages);
  const isThinking = useChatStore((s) => s.isThinking);
  const streamingId = useChatStore((s) => s.streamingMessageId);
  const { send } = useChat();

  return (
    <AppShell>
      <TopBar />
      <SplitPanelLayout
        left={
          <ChatPanel
            messages={messages}
            isThinking={isThinking}
            onSend={send}
            disabled={isThinking || !!streamingId}
          />
        }
        right={<AvatarPanel />}
      />
      <FooterStatusBar />
    </AppShell>
  );
}
