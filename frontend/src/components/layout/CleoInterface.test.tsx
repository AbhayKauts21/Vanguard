import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CleoInterface from "./CleoInterface";
import { useAuthStore } from "@/domains/auth/model";
import { useChatStore } from "@/domains/chat/model";
import { useVoiceStore } from "@/domains/voice/model";

const mocks = vi.hoisted(() => ({
  chatPanelProps: null as
    | {
        voice?: {
          phase: string;
          isVoiceMode: boolean;
          onDeactivate?: () => void;
          onInterrupt?: () => void;
          onSendVoiceMessage?: () => void;
        };
      }
    | null,
  activate: vi.fn(),
  deactivate: vi.fn(),
  interruptCurrentTurn: vi.fn(),
  sendVoiceMessage: vi.fn(),
  send: vi.fn(),
  sendStream: vi.fn(),
  createNewChat: vi.fn(),
  loadChat: vi.fn(),
  loadOlderMessages: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/components/layout", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TopBar: () => <div data-testid="topbar" />,
  FooterStatusBar: () => <div data-testid="footer-status" />,
  SplitPanelLayout: ({
    left,
    right,
  }: {
    left: ReactNode;
    right: ReactNode;
  }) => (
    <div>
      <div data-testid="left-panel">{left}</div>
      <div data-testid="right-panel">{right}</div>
    </div>
  ),
}));

vi.mock("@/components/chat", () => ({
  ChatPanel: (props: unknown) => {
    mocks.chatPanelProps = props as {
      voice?: {
        phase: string;
        isVoiceMode: boolean;
        onDeactivate?: () => void;
        onInterrupt?: () => void;
        onSendVoiceMessage?: () => void;
      };
    };
    return <div data-testid="chat-panel" />;
  },
}));

vi.mock("@/components/avatar", () => ({
  AvatarPanel: () => <div data-testid="avatar-panel" />,
}));

vi.mock("@/domains/chat/hooks", () => ({
  useChat: () => ({ send: mocks.send }),
  useChatStream: () => ({ sendStream: mocks.sendStream }),
  useChatHistory: () => ({
    createNewChat: mocks.createNewChat,
    loadChat: mocks.loadChat,
    loadOlderMessages: mocks.loadOlderMessages,
  }),
}));

vi.mock("@/domains/voice/hooks", () => ({
  useVoiceMode: () => ({
    activate: mocks.activate,
    deactivate: mocks.deactivate,
    interruptCurrentTurn: mocks.interruptCurrentTurn,
    sendVoiceMessage: mocks.sendVoiceMessage,
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    enableStreaming: false,
  },
}));

describe("CleoInterface voice wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatPanelProps = null;

    useAuthStore.setState({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: "user-1",
        email: "user@example.com",
        is_active: true,
        created_at: new Date().toISOString(),
        roles: [],
        permissions: [],
      },
      isAuthenticated: true,
    });

    useChatStore.setState({
      mode: "user",
      messages: [],
      guestMessages: [],
      chatSummaries: [],
      activeChatId: null,
      messageCache: {},
      messagePageInfo: {},
      isThinking: false,
      streamingMessageId: null,
      errorType: null,
      conversationId: "session-user",
      guestConversationId: "guest-session",
      isLoadingChats: false,
      isLoadingMessages: false,
      isLoadingOlderMessages: false,
      isHistoryCollapsed: false,
    });

    useVoiceStore.setState({
      isVoiceMode: true,
      phase: "speaking",
      userTranscript: "",
      finalTranscript: "",
      cleoTranscript: "",
      audioLevel: 0,
      error: null,
      isSupported: true,
    });
  });

  it("passes the persistent session voice controls to the chat panel", async () => {
    render(<CleoInterface />);

    await waitFor(() => {
      expect(mocks.chatPanelProps?.voice?.isVoiceMode).toBe(true);
    });

    expect(mocks.chatPanelProps?.voice?.phase).toBe("speaking");
    expect(typeof mocks.chatPanelProps?.voice?.onDeactivate).toBe("function");
    expect(typeof mocks.chatPanelProps?.voice?.onInterrupt).toBe("function");
    expect(typeof mocks.chatPanelProps?.voice?.onSendVoiceMessage).toBe("function");
  });
});
