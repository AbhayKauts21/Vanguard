import { describe, expect, it } from "vitest";
import {
  extractInterruptContinuation,
  INTERRUPT_KEYWORD_PHRASES,
  isInterruptIntent,
  normalizeInterruptTranscript,
  transcriptLooksLikeEcho,
} from "./interrupt-intent";

describe("interrupt intent heuristics", () => {
  it.each(INTERRUPT_KEYWORD_PHRASES)(
    "accepts the supported interrupt keyword %s",
    (keyword) => {
      expect(
        isInterruptIntent({
          transcript: keyword,
          spokenText: "Here is the answer I found.",
          isFinal: true,
          stableMs: 0,
        }),
      ).toBe(true);
    },
  );

  it("accepts explicit interrupt keywords once they are stable enough", () => {
    expect(
      isInterruptIntent({
        transcript: "stop",
        spokenText: "Here is the answer I found.",
        isFinal: true,
        stableMs: 0,
      }),
    ).toBe(true);
  });

  it("covers the required keyword set", () => {
    expect(INTERRUPT_KEYWORD_PHRASES).toEqual(
      expect.arrayContaining([
        "stop",
        "okay cleo",
        "cleo stop",
        "pause",
        "wait",
        "hold on",
      ]),
    );
  });

  it("ignores single filler acknowledgements", () => {
    expect(
      isInterruptIntent({
        transcript: "okay",
        spokenText: "Here is the answer I found.",
        isFinal: true,
        stableMs: 400,
      }),
    ).toBe(false);
  });

  it("accepts keyword-prefixed follow-up requests", () => {
    expect(
      isInterruptIntent({
        transcript: "okay cleo can you compare that with pricing",
        spokenText: "Here is the answer I found.",
        isFinal: false,
        stableMs: 240,
      }),
    ).toBe(true);
  });

  it("extracts the follow-up from a keyword-prefixed interruption", () => {
    expect(
      extractInterruptContinuation("okay cleo can you compare that with pricing"),
    ).toBe("can you compare that with pricing");
    expect(extractInterruptContinuation("stop")).toBe("");
  });

  it("strips softeners and control filler when extracting a follow-up", () => {
    expect(
      extractInterruptContinuation("stop there please compare that with pricing"),
    ).toBe("compare that with pricing");
    expect(extractInterruptContinuation("hold on one second")).toBe("");
  });

  it("rejects likely speaker echo when there is no takeover cue", () => {
    expect(
      transcriptLooksLikeEcho(
        normalizeInterruptTranscript("reset your password from settings"),
        "You can reset your password from settings.",
      ),
    ).toBe(true);

    expect(
      isInterruptIntent({
        transcript: "reset your password from settings",
        spokenText: "You can reset your password from settings.",
        isFinal: true,
        stableMs: 500,
      }),
    ).toBe(false);
  });

  it("still accepts an explicit keyword even when the remainder overlaps spoken text", () => {
    expect(
      isInterruptIntent({
        transcript: "stop reset your password from settings",
        spokenText: "You can reset your password from settings.",
        isFinal: true,
        stableMs: 0,
      }),
    ).toBe(true);
  });

  it("rejects unstable one-word fragments", () => {
    expect(
      isInterruptIntent({
        transcript: "wait",
        spokenText: "Here is the answer I found.",
        isFinal: false,
        stableMs: 90,
      }),
    ).toBe(false);
  });

  it("rejects background-noise-like filler fragments", () => {
    expect(
      isInterruptIntent({
        transcript: "mm",
        spokenText: "Here is the answer I found.",
        isFinal: true,
        stableMs: 300,
      }),
    ).toBe(false);
  });

  it("rejects unsupported partial keyword fragments", () => {
    expect(
      isInterruptIntent({
        transcript: "hol",
        spokenText: "Here is the answer I found.",
        isFinal: false,
        stableMs: 200,
      }),
    ).toBe(false);
  });

  it("accepts explicit interruption words faster on interim speech", () => {
    expect(
      isInterruptIntent({
        transcript: "stop",
        spokenText: "Here is the answer I found.",
        isFinal: false,
        stableMs: 140,
      }),
    ).toBe(true);
  });

  it("accepts multi-word interrupt phrases on interim speech", () => {
    expect(
      isInterruptIntent({
        transcript: "stop talking please",
        spokenText: "Here is the answer I found.",
        isFinal: false,
        stableMs: 120,
      }),
    ).toBe(true);
  });
});
