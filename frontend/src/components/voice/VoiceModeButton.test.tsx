import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceModeButton } from "./VoiceModeButton";
import { useVoiceStore } from "@/domains/voice/model";

describe("VoiceModeButton", () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
  });

  afterEach(() => {
    useVoiceStore.getState().reset();
  });

  it("renders the dedicated voice button and never shows interrupt text", () => {
    render(
      <VoiceModeButton onActivate={vi.fn()} onSend={vi.fn()} disabled={false} />,
    );

    expect(screen.getByRole("button", { name: "Start voice mode" })).toBeInTheDocument();
    expect(screen.queryByText("Interrupt")).not.toBeInTheDocument();
  });

  it("starts listening from idle and sends while listening", () => {
    const onActivate = vi.fn();
    const onSend = vi.fn();
    const { rerender } = render(
      <VoiceModeButton onActivate={onActivate} onSend={onSend} disabled={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start voice mode" }));
    expect(onActivate).toHaveBeenCalledTimes(1);

    useVoiceStore.setState({
      isVoiceMode: true,
      phase: "listening",
      userTranscript: "",
      finalTranscript: "",
      cleoTranscript: "",
      audioLevel: 0,
      error: null,
      isSupported: true,
    });
    rerender(
      <VoiceModeButton onActivate={onActivate} onSend={onSend} disabled={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop listening and send" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("restarts listening from an open session without reopening the session", () => {
    const onActivate = vi.fn();
    const onSend = vi.fn();

    useVoiceStore.setState({
      isVoiceMode: true,
      phase: "session_open",
      userTranscript: "",
      finalTranscript: "",
      cleoTranscript: "",
      audioLevel: 0,
      error: null,
      isSupported: true,
    });

    render(
      <VoiceModeButton onActivate={onActivate} onSend={onSend} disabled={false} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Start listening in voice session" }),
    );

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("stays non-interactive while processing or speaking", () => {
    const onActivate = vi.fn();
    const onSend = vi.fn();

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

    render(
      <VoiceModeButton onActivate={onActivate} onSend={onSend} disabled={false} />,
    );

    const button = screen.getByRole("button", { name: "CLEO is speaking" });
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(onActivate).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("stays disabled while the session is closing", () => {
    const onActivate = vi.fn();
    const onSend = vi.fn();

    useVoiceStore.setState({
      isVoiceMode: true,
      phase: "session_closing",
      userTranscript: "",
      finalTranscript: "",
      cleoTranscript: "",
      audioLevel: 0,
      error: null,
      isSupported: true,
    });

    render(
      <VoiceModeButton onActivate={onActivate} onSend={onSend} disabled={false} />,
    );

    const button = screen.getByRole("button", { name: "Voice session is closing" });
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(onActivate).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });
});
