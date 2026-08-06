"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the viewport is in the tablet band — wide enough for a sidebar, too narrow for
 * the full one.
 *
 * The shell had exactly one breakpoint, `lg` at 1024px, so everything from 768 to 1023
 * rendered the phone layout: a bottom tab bar, a top bar, and a 672px content column
 * adrift on a screen nearly a third wider than it. An iPad in portrait — the single most
 * common tablet case — got a blown-up phone.
 *
 * The rail already existed for the collapsed desktop sidebar, so this band reuses it
 * rather than inventing a third layout: 64px of glyph navigation, the gold play button,
 * and the account menu, with the tab bar gone. Below 768 nothing changes.
 *
 * Same shape as `usePrefersReducedMotion` and the sidebar-collapsed store — matchMedia is
 * the external store `useSyncExternalStore` exists for, and three stores doing the same
 * job should not be three different patterns.
 */

// Tailwind's own `md` and `lg`. Written out because this has to agree with the class
// names in app-shell.tsx exactly, and a mismatch would show as a frame of the wrong
// layout rather than as an error.
const TABLET_BAND = "(min-width: 48rem) and (max-width: 63.999rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(TABLET_BAND);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(TABLET_BAND).matches;
}

/**
 * The server has no viewport. `false` means it renders the expanded sidebar, which the
 * client corrects on hydration — the same guess, for the same reason, as the collapsed
 * store: a rail that flashes wide is a smaller error than a nav that flashes missing.
 */
function getServerSnapshot(): boolean {
  return false;
}

export function useIsTabletBand(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
