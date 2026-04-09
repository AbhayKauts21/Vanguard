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

  it("renders the interrupt control in processing and speaking phases", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "processing" });
    const view = render(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("speaking");
    });

    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();
    expect(view.container.firstElementChild).toHaveClass("pointer-events-none");
  });

  it("keeps the interrupt control visible across a mounted processing to speaking transition", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "processing" });
    render(<VoiceTranscript onInterrupt={onInterrupt} />);

    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("speaking");
      useVoiceStore.getState().setFinalTranscript("compare that with enterprise");
    });

    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();
    expect(
      screen.getByText("compare that with enterprise"),
    ).toBeInTheDocument();
  });

  it("hides the interrupt control outside interruptible phases", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "listening" });
    const { rerender } = render(<VoiceTranscript onInterrupt={onInterrupt} />);

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

  it("hides the interrupt control when no handler is provided", () => {
    setVoiceState({ phase: "processing" });
    const { rerender } = render(<VoiceTranscript />);

    expect(
      screen.queryByRole("button", { name: "Interrupt" }),
    ).not.toBeInTheDocument();

    act(() => {
      useVoiceStore.getState().setPhase("speaking");
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

    setVoiceState({ phase: "speaking" });
    render(<VoiceTranscript onInterrupt={onInterrupt} />);

    fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));

    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });
});
