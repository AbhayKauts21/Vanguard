import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "@/domains/chat/model";
import { useAvatarStore } from "../model/avatar-store";
import { ENERGY_CORE_SPEECH_HOLD_MS, useEnergyCoreState } from "./useEnergyCoreState";

describe("useEnergyCoreState", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.stubGlobal(
      "requestAnimationFrame",
      ((callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 0)) as typeof window.requestAnimationFrame,
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      ((id: number) => window.clearTimeout(id)) as typeof window.cancelAnimationFrame,
    );

    useChatStore.setState({
      messages: [],
      isThinking: false,
      streamingMessageId: null,
      errorType: null,
      conversationId: "session-cleo",
    });

    useAvatarStore.setState({
      isConnected: false,
      isLoading: false,
      isMuted: false,
      currentState: "disconnected",
      error: null,
      speakFn: null,
      interruptFn: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("stays idle when no request lifecycle is active", () => {
    const { result } = renderHook(() => useEnergyCoreState());

    expect(result.current).toBe("idle");
  });

  it("switches to syncing while CLEO is thinking", () => {
    const { result } = renderHook(() => useEnergyCoreState());

    act(() => {
      useChatStore.getState().setThinking(true);
    });

    expect(result.current).toBe("syncing");
  });

  it("switches to speech while an answer is streaming", () => {
    const { result } = renderHook(() => useEnergyCoreState());

    act(() => {
      useChatStore.getState().startAssistantMessage();
    });

    expect(result.current).toBe("speech");
  });

  it("holds speech briefly after a completed response then settles back to idle", () => {
    const { result } = renderHook(() => useEnergyCoreState());

    act(() => {
      useChatStore.getState().addAssistantMessage("Response ready", []);
    });

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(result.current).toBe("speech");

    act(() => {
      vi.advanceTimersByTime(ENERGY_CORE_SPEECH_HOLD_MS);
    });

    expect(result.current).toBe("idle");
  });

  it("treats the avatar listening state as syncing", () => {
    const { result } = renderHook(() => useEnergyCoreState());

    act(() => {
      useAvatarStore.getState().setState("listening");
    });

    expect(result.current).toBe("syncing");
  });
});
