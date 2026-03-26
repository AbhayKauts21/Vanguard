import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { CitationList } from "./CitationList";

const messages = {
  chat: {
    sourcesSummary: "{count} grounded sources",
    sourcesDrawerTitle: "Grounded retrieval",
    expandSources: "View {count} more sources",
    collapseSources: "Collapse",
    viewOriginal: "Open",
  },
};

const primaryCitation = {
  page_id: 101,
  page_title: "CLEO Architecture",
  source_name: "Architecture Guide",
  score: 0.92,
  source_type: "vector" as const,
  source_url: "https://example.com/architecture",
};

const secondaryCitation = {
  page_id: 202,
  page_title: "Retrieval Modes",
  source_name: "RAG Handbook",
  score: 0.81,
  source_type: "vector" as const,
  source_url: "https://example.com/rag",
};

describe("CitationList", () => {
  it("opens a grounded retrieval drawer from the compact summary state", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CitationList primary={[primaryCitation]} secondary={[secondaryCitation]} all={[primaryCitation, secondaryCitation]} />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /2 grounded sources/i }));

    expect(screen.getByText("Grounded retrieval")).toBeInTheDocument();
    expect(screen.getAllByText("CLEO Architecture")).toHaveLength(2);
    expect(screen.getByText("Retrieval Modes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
  });
});
