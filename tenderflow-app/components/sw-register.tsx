"use client";

import { useEffect } from "react";

/** Registers the TenderFlow service worker once (static assets only). */
export default function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Fire and forget: a failed registration must never break the app.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
