// PWA install helpers — pure functions, no browser, no network.
import { describe, expect, it } from "vitest";
import {
  detectPlatform,
  installInstructions,
  isStandaloneDisplay,
  shouldShowInstall,
} from "../install";

describe("detectPlatform", () => {
  it("detects Android", () => {
    expect(
      detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")
    ).toBe("android");
  });
  it("detects iOS", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1")).toBe(
      "ios"
    );
    expect(detectPlatform("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe("ios");
  });
  it("defaults to desktop", () => {
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe("desktop");
    expect(detectPlatform("")).toBe("desktop");
  });
});

describe("isStandaloneDisplay", () => {
  it("is true via matchMedia or iOS standalone", () => {
    expect(isStandaloneDisplay({ matchMediaStandalone: true })).toBe(true);
    expect(isStandaloneDisplay({ matchMediaStandalone: false, navigatorStandalone: true })).toBe(true);
    expect(isStandaloneDisplay({ matchMediaStandalone: false })).toBe(false);
    expect(isStandaloneDisplay({ matchMediaStandalone: false, navigatorStandalone: false })).toBe(false);
  });
});

describe("shouldShowInstall", () => {
  it("hides only when already installed", () => {
    expect(shouldShowInstall(true)).toBe(false);
    expect(shouldShowInstall(false)).toBe(true);
  });
});

describe("installInstructions", () => {
  it("gives Android steps mentioning Chrome menu", () => {
    const steps = installInstructions("android");
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.join(" ")).toMatch(/Chrome/i);
  });
  it("gives iOS steps mentioning Safari share", () => {
    const steps = installInstructions("ios");
    expect(steps.join(" ")).toMatch(/Safari/i);
  });
  it("gives desktop steps", () => {
    expect(installInstructions("desktop").length).toBeGreaterThanOrEqual(2);
  });
});
