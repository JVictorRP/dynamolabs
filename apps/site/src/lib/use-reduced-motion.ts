"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** `true` quando o sistema pede para reduzir movimento (no servidor e na hidratação, `false`). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(QUERY);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
