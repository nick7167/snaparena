"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Page visibility, and the moment of coming back.
 *
 * A live match is full of things that quietly stop when a phone locks or the player
 * switches apps: `requestAnimationFrame` is suspended outright, `setInterval` is throttled
 * to about once a minute and then stops too. Nothing in the match code was watching for
 * that, so a backgrounded round came back with a frozen clock, a clip that had been
 * playing unbounded the whole time, and a heartbeat that was seconds away from being swept
 * into a forfeit.
 *
 * Everything here is about the *return*. The freeze itself is unavoidable and mostly
 * harmless — nobody is looking at a hidden tab — but coming back has to reconcile.
 */

function subscribe(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function getSnapshot(): boolean {
  return document.visibilityState === "visible";
}

/**
 * A server render has no tab to hide. Assuming hidden would make the first client paint
 * take the recovery branch on every load.
 */
function getServerSnapshot(): boolean {
  return true;
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Runs a callback when the page becomes visible again, and only then.
 *
 * Listens to `pageshow` as well as `visibilitychange`, because iOS restoring a page from
 * the back/forward cache does not reliably fire the latter — and a bfcache restore is
 * precisely the case where the most state has gone stale.
 *
 * The callback is held in a ref and refreshed on every render, the same way
 * `useRoundLifecycle` holds `onRoundStart`, so a caller passing an inline arrow does not
 * re-arm the listeners and re-fire the resync on every render.
 */
export function useOnForeground(callback: () => void): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    // Tracked rather than inferred from the event: `pageshow` and `visibilitychange` can
    // both fire for a single return, and the callers here send mutations.
    let hidden = document.visibilityState === "hidden";

    const onVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      if (visible && hidden) callbackRef.current();
      hidden = !visible;
    };

    const onPageShow = () => {
      if (document.visibilityState !== "visible") return;
      if (!hidden) return;
      hidden = false;
      callbackRef.current();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
}
