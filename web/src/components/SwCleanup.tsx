"use client";

import { useEffect } from "react";

/**
 * The preview domain previously served an Expo web build which may have
 * registered a service worker / precache. A stale SW can intercept navigations
 * and serve an old (or blank) app shell, making the new Next.js app appear to
 * "not load". This unregisters any existing service workers and clears caches
 * on first load so returning visitors always get the live app.
 */
export default function SwCleanup() {
  useEffect(() => {
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((r) => r.unregister()))
          .catch(() => {});
      }
      if (typeof window !== "undefined" && "caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    } catch {
      /* no-op */
    }
  }, []);
  return null;
}
