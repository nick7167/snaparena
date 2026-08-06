"use client";

/**
 * Which developer tools are switched on, per browser.
 *
 * THE PROBLEM THIS SOLVES: this project runs one shared Convex deployment — local
 * development and the live app talk to the same backend. So the flag that licenses every
 * dev-only control is a property of the DEPLOYMENT rather than of a person. It applies to
 * everyone at once, and it is all-or-nothing: the instant-win bar sat over the match screen
 * whether or not you were currently using it.
 *
 * The fix is two gates rather than one. The server flag stays the master switch and still
 * decides whether dev tools may exist AT ALL; these local toggles decide which of them are
 * actually on, in this browser, right now. On the live app with the flag unset, nothing
 * here can turn anything on — the panel does not even render.
 *
 * Same shape as `sidebar-collapsed.ts` and the mute store in `src/audio/sfx.ts`: a
 * module-level value, a listener set, and the three functions `useSyncExternalStore` wants.
 * Three stores doing the same job should not be three different patterns.
 */

const STORAGE_KEY = "songrace:dev-tools";

/**
 * Every switchable tool.
 *
 * Adding one means adding a key here and a row in `DevPanel` — the panel renders from this
 * record, so the two cannot drift apart.
 */
export interface DevToolState {
  /** The win / lose / random bar over a live duel. */
  resolveBar: boolean;
  /** Outline layout boxes, for checking spacing against the design system. */
  layoutOutlines: boolean;
}

/**
 * Only things that are genuinely switchable from a browser belong here.
 *
 * Notably ABSENT: showing the dev rank bots on the ladder. That is decided server-side by
 * `devRankBotsEnabled()`, and `users.leaderboard` is deliberately impersonal — it makes no
 * `currentUser` call so the whole board stays one cache entry shared by everybody. Adding a
 * per-viewer argument would fork that cache per identity, which is precisely what its
 * docblock warns against. The panel reports it as deployment state instead of offering a
 * switch that would not work.
 */
export const DEV_TOOLS: {
  key: keyof DevToolState;
  label: string;
  help: string;
}[] = [
  {
    key: "resolveBar",
    label: "Instant win",
    help: "Show the win / lose / random bar over a live duel. Ends it through the real finish path, so rating, XP and badges all behave as if it were played out.",
  },
  {
    key: "layoutOutlines",
    label: "Layout outlines",
    help: "Draw a hairline around every element, for checking spacing and alignment.",
  },
];

/**
 * Off by default, every one of them.
 *
 * A dev tool that is on until you turn it off is a dev tool that ends up in a screenshot.
 */
const DEFAULTS: DevToolState = {
  resolveBar: false,
  layoutOutlines: false,
};

function readStored(): DevToolState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DevToolState>;
    // Merged over the defaults rather than trusted, so a stored blob written before a new
    // tool existed does not leave that tool `undefined`.
    return { ...DEFAULTS, ...parsed };
  } catch {
    // Malformed JSON, or storage blocked entirely. Neither is worth a crash.
    return DEFAULTS;
  }
}

let state: DevToolState = typeof window !== "undefined" ? readStored() : DEFAULTS;

const listeners = new Set<() => void>();

export function subscribeDevTools(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getDevToolsSnapshot(): DevToolState {
  return state;
}

/**
 * The server cannot read localStorage, and must not guess.
 *
 * A stable frozen object rather than a fresh one: `useSyncExternalStore` compares snapshots
 * by identity, so returning a new object each call is an infinite render loop.
 */
const SERVER_SNAPSHOT: DevToolState = Object.freeze({ ...DEFAULTS });

export function getDevToolsServerSnapshot(): DevToolState {
  return SERVER_SNAPSHOT;
}

export function setDevTool(key: keyof DevToolState, value: boolean): void {
  state = { ...state, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore: the in-memory value still applies for this session.
  }
  for (const listener of listeners) listener();
}

/** Turns everything off in one press — the "get it out of my way" control. */
export function resetDevTools(): void {
  state = { ...DEFAULTS };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
  for (const listener of listeners) listener();
}
