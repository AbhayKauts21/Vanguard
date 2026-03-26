import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { FooterStatusBar } from "./FooterStatusBar";
import { useTelemetryStore } from "@/domains/system/model/telemetry-store";

const messages = {
  footer: {
    vectorsLabel: "Vectors",
    backendLabel: "Backend",
    latencyLabel: "Avg Latency",
    buildInfo: "CLEO Systems // Build 5.0.0-Dynamic // Protocol 99",
  },
  status: {
    online: "Online",
    degraded: "Degraded",
    offline: "Offline",
  },
};

describe("FooterStatusBar", () => {
  beforeEach(() => {
    useTelemetryStore.setState({
      vectorCount: 162,
      avgLatencyMs: 842,
      backendStatus: "online",
      lastLatencyMs: 842,
      _latencyHistory: [842],
    });
  });

  it("renders live footer metrics instead of placeholder copy", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FooterStatusBar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Vectors")).toBeInTheDocument();
    expect(screen.getByText("162")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Avg Latency")).toBeInTheDocument();
    expect(screen.getByText("842ms")).toBeInTheDocument();
  });
});
