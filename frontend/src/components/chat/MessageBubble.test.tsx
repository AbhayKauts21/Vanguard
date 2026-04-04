import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { MessageBubble } from "./MessageBubble";

const messages = {
  chat: {
    uncertainTitle: "Not fully confident",
    uncertainDesc: "I found some info but I am not 100% sure.",
    whatIFound: "What I found",
    sourcesSummary: "{count} sources",
  },
};

describe("MessageBubble", () => {
  it("does not render the uncertain banner when modeUsed is 'rag'", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MessageBubble 
          role="assistant" 
          content="Hello! I am CLEO." 
          modeUsed="rag" 
        />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByText("Not fully confident")).not.toBeInTheDocument();
    expect(screen.getByText("Hello! I am CLEO.")).toBeInTheDocument();
  });

  it("renders the uncertain banner when modeUsed is 'uncertain'", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MessageBubble 
          role="assistant" 
          content="I think it works like this..." 
          modeUsed="uncertain" 
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Not fully confident")).toBeInTheDocument();
  });
});
