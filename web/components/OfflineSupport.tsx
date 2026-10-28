"use client";
import { useEffect } from "react";

/** Registers the offline shell. Failure is harmless: session mode still queues reactions without it. */
export default function OfflineSupport() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
