"use client";

import { AppShell, TopBar, FooterStatusBar, SplitPanelLayout } from "@/components/layout";
import { ChatPanel } from "@/components/chat";
import { AvatarPanel } from "@/components/avatar";
import { VoiceTranscript } from "@/components/voice";
import { useChatStore } from "@/domains/chat/model";
import { useChat, useChatStream } from "@/domains/chat/hooks";
import { useVoiceMode } from "@/domains/voice/hooks";
import { useVoiceStore } from "@/domains/voice/model";
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

  /* Voice mode orchestration. */
  const { activate, deactivate, sendVoiceMessage, isSupported } = useVoiceMode();
  const isVoiceMode = useVoiceStore((s) => s.isVoiceMode);
  const voicePhase = useVoiceStore((s) => s.phase);
  const userTranscript = useVoiceStore((s) => s.userTranscript);
  const cleoTranscript = useVoiceStore((s) => s.cleoTranscript);

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
            voice={voiceProps}
          />
        }
        right={<AvatarPanel />}
      />

      {/* Voice transcript overlay — floats above the interface during voice mode */}
      {isVoiceMode && (
        <VoiceTranscript
          phase={voicePhase}
          userTranscript={userTranscript}
          cleoTranscript={cleoTranscript}
        />
      )}

      <FooterStatusBar />
    </AppShell>
  );
}
