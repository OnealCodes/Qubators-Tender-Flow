// PWA install helpers — pure functions over injected values so they are
// unit-testable without a browser. The component (install-prompt.tsx)
// supplies the real navigator/window values.

export type InstallPlatform = "android" | "ios" | "desktop";

/** Coarse platform from a user-agent string. Order matters: Android UA contains "Linux". */
export function detectPlatform(ua: string): InstallPlatform {
  const s = ua.toLowerCase();
  if (/android/.test(s)) return "android";
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  return "desktop";
}

/** True when the app runs as an installed PWA (standalone window). */
export function isStandaloneDisplay(opts: {
  matchMediaStandalone: boolean;
  navigatorStandalone?: boolean;
}): boolean {
  return opts.matchMediaStandalone || opts.navigatorStandalone === true;
}

/**
 * Whether the install control should be visible at all.
 * Hidden only when already installed; without a captured prompt the button
 * opens the manual fallback instructions instead of doing nothing.
 */
export function shouldShowInstall(isStandalone: boolean): boolean {
  return !isStandalone;
}

/** Manual install steps shown when the browser exposes no install prompt. */
export function installInstructions(platform: InstallPlatform): string[] {
  if (platform === "android") {
    return [
      "Open TenderFlow in Chrome on your Android phone.",
      "Tap the ⋮ menu (top right).",
      "Tap “Add to Home screen” or “Install app”.",
      "Confirm — TenderFlow then opens full-screen like a native app.",
    ];
  }
  if (platform === "ios") {
    return [
      "Open TenderFlow in Safari on your iPhone or iPad.",
      "Tap the Share button (square with an arrow).",
      "Tap “Add to Home Screen”, then Add.",
    ];
  }
  return [
    "Open TenderFlow in Chrome or Edge on your computer.",
    "Click the install icon in the address bar (or ⋮ menu → “Install TenderFlow”).",
    "Confirm — TenderFlow then runs in its own window.",
  ];
}
