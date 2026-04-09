import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceTranscript } from "./VoiceTranscript";
import { useVoiceStore } from "@/domains/voice/model";

function setVoiceState(overrides: Partial<ReturnType<typeof useVoiceStore.getState>>) {
  useVoiceStore.setState({
    isVoiceMode: true,
    phase: "processing",
    userTranscript: "",
    finalTranscript: "",
    cleoTranscript: "",
    audioLevel: 0,
    isSpeakingPlayback: false,
    error: null,
    isSupported: true,
    ...overrides,
  });
}

describe("VoiceTranscript", () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
  });

  afterEach(() => {
    useVoiceStore.getState().reset();
  });

  it("renders the interrupt control only in the speaking phase", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "processing" });
    const view = render(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("speaking");
      useVoiceStore.getState().setSpeakingPlayback(true);
    });

    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();
    expect(view.container.firstElementChild).toHaveClass("pointer-events-none");
  });

  it("shows the interrupt control when a mounted session transitions from processing to speaking", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "processing" });
    render(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("speaking");
      useVoiceStore.getState().setSpeakingPlayback(true);
      useVoiceStore.getState().setFinalTranscript("compare that with enterprise");
    });

    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();
    expect(
      screen.getByText("compare that with enterprise"),
    ).toBeInTheDocument();
  });

  it("hides the interrupt control outside the speaking phase", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "listening" });
    const { rerender } = render(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("processing");
    });
    rerender(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("idle");
    });
    rerender(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the interrupt control hidden when phase is speaking but playback has not started", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "speaking", isSpeakingPlayback: false });
    render(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();
  });

  it("hides the interrupt control when no handler is provided", () => {
    setVoiceState({ phase: "speaking" });
    const { rerender } = render(<VoiceTranscript />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("processing");
    });
    rerender(<VoiceTranscript />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the interrupt control visible with transcript text and an error banner", () => {
    const onInterrupt = vi.fn();

    setVoiceState({
      phase: "speaking",
      isSpeakingPlayback: true,
      userTranscript: "compare that with the enterprise plan",
      finalTranscript: "compare that with the enterprise plan",
      cleoTranscript: "This should stay hidden.",
      error: "Temporary voice issue",
    });

    render(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(
      screen.getByText("compare that with the enterprise plan"),
    ).toBeInTheDocument();
    expect(screen.queryByText("This should stay hidden.")).not.toBeInTheDocument();
    expect(screen.getByText("Temporary voice issue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();
  });

  it("fires the interrupt handler exactly once per click", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "speaking", isSpeakingPlayback: true });
    render(<VoiceTranscript onInterrupt={onInterrupt} />);

    fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));

    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });
});
