"use client";

/**
 * Whether the desktop sidebar is collapsed to its icon rail.
 *
 * The sidebar is present on every screen now, matches included, so it needs a way to get
 * out of the way that belongs to the player rather than to the app. Collapsing narrows it
 * to glyphs rather than removing it: navigation stays one click away and the content does
 * not reflow between "hidden" and "back".
 *
 * Deliberately the same shape as the mute preference in `src/audio/sfx.ts` — a module-level
 * value, a listener set, and the three functions `useSyncExternalStore` wants. Two stores
 * with the same job should not be two different patterns.
 */

const COLLAPSED_KEY = "songrace:sidebar-collapsed";

function readStored(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    // Private-mode storage failures must not cost you the navigation.
    return false;
  }
}

// Read once at module load. Guarded because Next.js also renders client components on the
// server, where localStorage does not exist.
let collapsed = typeof window !== "undefined" ? readStored() : false;

const listeners = new Set<() => void>();

export function subscribeSidebarCollapsed(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getSidebarCollapsedSnapshot(): boolean {
  return collapsed;
}

/**
 * The server cannot read localStorage, so it renders the expanded sidebar and the client
 * corrects on hydration. Expanded is the right guess: a collapsed rail that flashes wide
 * is a smaller error than a nav that flashes missing.
 */
export function getSidebarCollapsedServerSnapshot(): boolean {
  return false;
}

export function setSidebarCollapsed(next: boolean): void {
  collapsed = next;
  try {
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    // Ignore: the in-memory value still applies for this session.
  }
  for (const listener of listeners) listener();
}
