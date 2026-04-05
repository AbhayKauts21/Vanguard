import { describe, expect, it } from "vitest";
import {
  isInterruptIntent,
  normalizeInterruptTranscript,
  transcriptLooksLikeEcho,
} from "./interrupt-intent";

describe("interrupt intent heuristics", () => {
  it("accepts explicit takeover cues once they are stable enough", () => {
    expect(
      isInterruptIntent({
        transcript: "stop",
        spokenText: "Here is the answer I found.",
        isFinal: true,
        stableMs: 0,
      }),
    ).toBe(true);
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

  it("accepts natural continuation requests beyond keyword-only triggers", () => {
    expect(
      isInterruptIntent({
        transcript: "okay can you compare that with pricing",
        spokenText: "Here is the answer I found.",
        isFinal: false,
        stableMs: 240,
      }),
    ).toBe(true);
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
});
