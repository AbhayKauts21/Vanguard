"use client";

import { AppShell, TopBar, FooterStatusBar, SplitPanelLayout } from "@/components/layout";
import { ChatPanel } from "@/components/chat";
import { AvatarPanel } from "@/components/avatar";
import { useChatStore } from "@/domains/chat/model";

/* Main CLEO neural interface — wires layout + chat store. */
export default function CleoInterface() {
  const messages = useChatStore((s) => s.messages);
  const isThinking = useChatStore((s) => s.isThinking);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const setThinking = useChatStore((s) => s.setThinking);
  const addAssistantMessage = useChatStore((s) => s.addAssistantMessage);

  /* Placeholder send — replaced with real API in Phase 4. */
  function handleSend(message: string) {
    addUserMessage(message);
    setThinking(true);

    /* Simulated echo response for static layout testing. */
    setTimeout(() => {
      addAssistantMessage(
        `Echo: "${message}"\n\nThis is a static placeholder. Backend integration coming in the next phase.`,
        [],
      );
    }, 1200);
  }

  return (
    <AppShell>
      <TopBar />
      <SplitPanelLayout
        left={
          <ChatPanel
            messages={messages}
            isThinking={isThinking}
            onSend={handleSend}
          />
        }
        right={<AvatarPanel />}
      />
      <FooterStatusBar />
    </AppShell>
  );
}
