import { describe, it, expect } from "vitest";
import { env } from "@/lib/env";

describe("env config", () => {
  it("has default app name", () => {
    expect(env.appName).toBe("CLEO");
  });

  it("has default locale set to en", () => {
    expect(env.defaultLocale).toBe("en");
  });

  it("has supported locales array", () => {
    expect(env.supportedLocales).toContain("en");
    expect(env.supportedLocales).toContain("es");
  });

  it("has api base url", () => {
    expect(env.apiBaseUrl).toMatch(/^https?:\/\//);
  });
});
