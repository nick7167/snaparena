"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Tracks the OS reduced-motion setting, live.
 *
 * Uses `useSyncExternalStore` rather than an effect: matchMedia is exactly the kind
 * of external store that hook exists for, and reading it via setState-in-an-effect
 * causes a cascading render on every mount.
 *
 * Every animated surface reads this. It doubles as the low-power path — the branch
 * that removes parallax and particles also stops the visualiser's animation loop,
 * the most expensive thing on the match screen.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** The server can't know the preference; assume motion is fine and correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * A clock that ticks on an interval.
 *
 * Countdowns need the current time, but calling `Date.now()` during render is an
 * impure read — React may render at any moment, and two components rendering in the
 * same commit would disagree. Ticking it into state keeps render pure.
 */
export function useNow(intervalMs = 200): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // setState lives inside the interval callback, not the effect body — this is
    // the "subscribe to an external system" case, which is what effects are for.
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
