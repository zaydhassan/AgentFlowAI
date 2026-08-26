"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook built on useSyncExternalStore. Returns `false`
 * during SSR (and the first client render before hydration commits), then the
 * real match thereafter. The deterministic server/initial snapshot avoids
 * hydration mismatches — pair it with CSS (Tailwind `md:`/`lg:`) for layout
 * that must be correct on first paint, and use the hook only for behaviour
 * that fires after a user interaction (e.g. opening a drawer below a
 * breakpoint).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}