import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VoiceTranscript } from "./VoiceTranscript";
import { useVoiceStore } from "@/domains/voice/model";

describe("VoiceTranscript", () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
  });

  afterEach(() => {
    useVoiceStore.getState().reset();
  });

  it("shows a compact HUD without rendering the spoken summary text", () => {
    useVoiceStore.setState({
      isVoiceMode: true,
      phase: "speaking",
      userTranscript: "compare that with the enterprise plan",
      finalTranscript: "compare that with the enterprise plan",
      cleoTranscript: "This should stay hidden.",
      error: null,
    });

    const { container } = render(<VoiceTranscript />);

    expect(
      screen.getByText("compare that with the enterprise plan"),
    ).toBeInTheDocument();
    expect(screen.queryByText("This should stay hidden.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /interrupt & listen/i })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("pointer-events-none");
  });
});
