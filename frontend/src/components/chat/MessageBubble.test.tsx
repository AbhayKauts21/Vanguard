import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import { MessageBubble } from "./MessageBubble";
import { useVoiceStore } from "@/domains/voice/model";

const citation = {
  page_id: 1,
  page_title: "Reset password",
  source_url: "https://docs.example.com/reset-password",
  source_type: "bookstack",
  source_name: "Docs",
  chunk_text: "Use the reset flow.",
  score: 0.94,
};

function renderWithIntl(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("MessageBubble", () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
  });

  it("hides citations while voice playback is active", () => {
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

    renderWithIntl(
      <MessageBubble
        role="assistant"
        content="Use the reset flow in settings."
        modeUsed="rag"
        primary_citations={[citation]}
        secondary_citations={[]}
        all_citations={[citation]}
        hidden_sources_count={0}
      />,
    );

    expect(
      screen.queryByText(/grounded retrieval/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Reset password")).not.toBeInTheDocument();
  });

  it("shows citations again when voice playback is inactive", () => {
    renderWithIntl(
      <MessageBubble
        role="assistant"
        content="Use the reset flow in settings."
        modeUsed="rag"
        primary_citations={[citation]}
        secondary_citations={[]}
        all_citations={[citation]}
        hidden_sources_count={0}
      />,
    );

    expect(screen.getByText(/grounded retrieval/i)).toBeInTheDocument();
    expect(screen.getAllByText("Reset password").length).toBeGreaterThan(0);
  });

  it("keeps the full written answer visible while speaking", () => {
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

    renderWithIntl(
      <MessageBubble
        role="assistant"
        content="Full written answer stays visible."
        modeUsed="uncertain"
        whatIFound={[{ page_title: "Related doc", score: 0.42 }]}
      />,
    );

    expect(
      screen.getByText("Full written answer stays visible."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/what i found anyway/i)).not.toBeInTheDocument();
  });
});
