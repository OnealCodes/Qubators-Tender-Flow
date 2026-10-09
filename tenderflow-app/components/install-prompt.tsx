"use client";

import { useCallback, useEffect, useState } from "react";
import {
  detectPlatform,
  installInstructions,
  shouldShowInstall,
  type InstallPlatform,
} from "../lib/install";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || ios;
}

/** Visible "Install TenderFlow" control with prompt + manual fallback. */
export default function InstallPrompt({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => readStandalone());
  const [helpOpen, setHelpOpen] = useState(false);
  const [platform] = useState<InstallPlatform>(() =>
    typeof window === "undefined" ? "desktop" : detectPlatform(window.navigator.userAgent)
  );
  const [busy, setBusy] = useState(false);

  // Effect only subscribes to browser events; initial state is computed
  // lazily above, later changes arrive through these listeners.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onChange = () => setInstalled(readStandalone());
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mq?.addEventListener?.("change", onChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", onChange);
    };
  }, []);

  const onClick = useCallback(async () => {
    if (deferred) {
      setBusy(true);
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } finally {
        setDeferred(null);
        setBusy(false);
      }
      return;
    }
    setHelpOpen(true);
  }, [deferred]);

  if (!shouldShowInstall(installed)) return null;

  return (
    <>
      <button
        onClick={onClick}
        disabled={busy}
        className={
          compact
            ? "rounded-lg border border-[#1D4C8D] px-3 py-2 text-sm font-bold text-[#0A2C4E] hover:bg-[#EEF1F4] disabled:opacity-50"
            : "rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-bold text-[#0A2C4E] hover:bg-[#FFF6DE] disabled:opacity-50"
        }
        title={deferred ? "Install TenderFlow on this device" : "How to install TenderFlow on this device"}
      >
        {busy ? "Installing…" : "Install TenderFlow"}
      </button>
      {helpOpen && (
        <div role="dialog" aria-modal="true" aria-label="How to install TenderFlow" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[10px] bg-white p-5">
            <h2 className="text-base font-extrabold text-[#0A2C4E]">Install TenderFlow</h2>
            <p className="mt-1 text-sm text-[#5B6472]">
              {deferred
                ? "Use the install prompt to add TenderFlow to your device."
                : "Your browser didn’t offer an automatic install, but you can still add TenderFlow in seconds:"}
            </p>
            <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm">
              {installInstructions(platform).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-3 text-[13px] text-[#5B6472]">
              TenderFlow needs a connection for sign-in, tenders, uploads and AI — the installed app opens faster but works online.
            </p>
            <button onClick={() => setHelpOpen(false)} className="mt-4 w-full rounded-lg bg-[#1D4C8D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14365F]">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
