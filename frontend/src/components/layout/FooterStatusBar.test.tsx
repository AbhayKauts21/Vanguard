import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { FooterStatusBar } from "./FooterStatusBar";

const messages = {
  footer: {
    buildInfo: "CLEO Systems // Build 5.0.0-Dynamic // Protocol 99",
  },
};

describe("FooterStatusBar", () => {
  it("renders the minimal build strip without telemetry pills", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FooterStatusBar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("CLEO Systems // Build 5.0.0-Dynamic // Protocol 99")).toBeInTheDocument();
  });
});
