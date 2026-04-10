import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceTranscript } from "./VoiceTranscript";
import { useVoiceStore } from "@/domains/voice/model";

function setVoiceState(
  overrides: Partial<ReturnType<typeof useVoiceStore.getState>>,
) {
  useVoiceStore.setState({
    isVoiceMode: true,
    phase: "listening",
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

  it("shows phase-specific copy without rendering interrupt controls", () => {
    setVoiceState({ phase: "session_open" });
    const { rerender } = render(<VoiceTranscript onDeactivate={vi.fn()} />);

    expect(
      screen.getByText("Voice session is open. Tap the mic to ask the next question."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Interrupt" })).not.toBeInTheDocument();

    setVoiceState({ phase: "speaking" });
    rerender(<VoiceTranscript onDeactivate={vi.fn()} onInterrupt={vi.fn()} />);
    expect(
      screen.getByText("CLEO is speaking. Interrupt to jump to the next question."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Interrupt" })).toBeInTheDocument();

    setVoiceState({ phase: "processing" });
    rerender(<VoiceTranscript onDeactivate={vi.fn()} />);
    expect(
      screen.getByText("CLEO is preparing your voice reply."),
    ).toBeInTheDocument();

    setVoiceState({ phase: "session_closing" });
    rerender(<VoiceTranscript onDeactivate={vi.fn()} />);
    expect(
      screen.getByText("Closing voice session..."),
    ).toBeInTheDocument();
  });

  it("shows the visible transcript and hides the internal CLEO transcript", () => {
    setVoiceState({
      phase: "speaking",
      userTranscript: "compare pricing with enterprise",
      finalTranscript: "compare pricing with enterprise",
      cleoTranscript: "Internal spoken summary",
    });

    render(<VoiceTranscript onDeactivate={vi.fn()} />);

    expect(
      screen.getByText("compare pricing with enterprise"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Internal spoken summary")).not.toBeInTheDocument();
  });

  it("renders and dismisses the error banner while keeping the end session control", () => {
    const onDeactivate = vi.fn();

    setVoiceState({
      phase: "session_open",
      error: "Microphone access was denied.",
    });

    render(<VoiceTranscript onDeactivate={onDeactivate} />);

    expect(screen.getByText("Microphone access was denied.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss voice error" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End Session" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss voice error" }));

    expect(useVoiceStore.getState().error).toBeNull();
  });

  it("fires the end session handler when requested", () => {
    const onDeactivate = vi.fn();

    setVoiceState({ phase: "listening" });
    render(<VoiceTranscript onDeactivate={onDeactivate} />);

    fireEvent.click(screen.getByRole("button", { name: "End Session" }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it("fires the interrupt handler only while speaking", () => {
    const onInterrupt = vi.fn();

    setVoiceState({ phase: "speaking" });
    const { rerender } = render(
      <VoiceTranscript onDeactivate={vi.fn()} onInterrupt={onInterrupt} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));
    expect(onInterrupt).toHaveBeenCalledTimes(1);

    setVoiceState({ phase: "listening" });
    rerender(<VoiceTranscript onDeactivate={vi.fn()} onInterrupt={onInterrupt} />);

    expect(screen.queryByRole("button", { name: "Interrupt" })).not.toBeInTheDocument();
  });
});
