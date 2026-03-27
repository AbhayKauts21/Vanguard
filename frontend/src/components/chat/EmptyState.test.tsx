import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

const messages = {
  chat: {
    initialMessage:
      "Initializing neural synchronization. All systems nominal. I have processed the latest data grid from the central archive. How shall we proceed with your objectives?",
    promptArchitecture: "Summarize CLEO architecture",
    promptCapabilities: "What can CLEO do right now?",
    promptKnowledgeBase: "What is in the knowledge base?",
  },
};

describe("EmptyState", () => {
  it("renders quick-start prompts and sends them when clicked", () => {
    const onSend = vi.fn();

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <EmptyState onSend={onSend} />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Summarize CLEO architecture" }));

    expect(onSend).toHaveBeenCalledWith("Summarize CLEO architecture");
    expect(screen.getByText("What can CLEO do right now?")).toBeInTheDocument();
    expect(screen.getByText("What is in the knowledge base?")).toBeInTheDocument();
  });
});
