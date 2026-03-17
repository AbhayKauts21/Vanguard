"use client";

import { AppShell, TopBar, FooterStatusBar, SplitPanelLayout } from "@/components/layout";
import { ChatPanel } from "@/components/chat";
import { AvatarPanel } from "@/components/avatar";
import { useChatStore } from "@/domains/chat/model";
import { useChat, useChatStream } from "@/domains/chat/hooks";
import { env } from "@/lib/env";

/* Main CLEO neural interface — wires layout + chat + backend. */
export default function CleoInterface() {
  const messages = useChatStore((s) => s.messages);
  const isThinking = useChatStore((s) => s.isThinking);
  const streamingId = useChatStore((s) => s.streamingMessageId);

  const { send } = useChat();
  const { sendStream } = useChatStream();

  /* Use streaming when enabled via env. */
  const handleSend = env.enableStreaming ? sendStream : send;

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
          />
        }
        right={<AvatarPanel />}
      />
      <FooterStatusBar />
    </AppShell>
  );
}
