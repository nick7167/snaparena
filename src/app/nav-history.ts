/**
 * Where you came from.
 *
 * The app had no back-navigation system at all: clicking a name on the ladder dropped you
 * on a profile with no way out but the browser button, and the two places that did offer a
 * way back — the match recap and the room lobby — each hand-rolled their own link at the
 * BOTTOM of the page. This is the shared answer.
 *
 * Deliberately one step, not a stack. A stack has to be reconciled with the browser's own
 * history on every back/forward press, and getting that wrong produces a control that lies
 * about where it goes — which is worse than no control. One step is always truthful: it
 * names the page you were on immediately before this one.
 *
 * When there is no previous route — a shared link, a cold load, a refresh — the caller
 * falls back to the page's declared parent, so the control is never absent and never dead.
 */

const CURRENT_KEY = "snap.nav.current";
const PREVIOUS_KEY = "snap.nav.previous";

/**
 * sessionStorage rather than localStorage: "where I came from" is meaningless in a tab
 * opened tomorrow, and per-tab is exactly right for a per-tab journey. Every access is
 * wrapped because Safari in private mode throws on access rather than returning null —
 * the same hazard guest.ts documents.
 */
function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Unstorable. The back control falls back to the declared parent, which is the same
    // behaviour as a cold load — degraded, but never broken.
  }
}

/**
 * Records a navigation. Called from the shell on every pathname change.
 *
 * Re-recording the same pathname is ignored, so a re-render or a query-string change
 * cannot make a page its own "previous" and produce a back control that goes nowhere.
 */
export function recordVisit(pathname: string): void {
  if (typeof window === "undefined") return;

  const current = read(CURRENT_KEY);
  if (current === pathname) return;

  if (current) write(PREVIOUS_KEY, current);
  write(CURRENT_KEY, pathname);
}

/** The route visited immediately before this one, or null on a cold load. */
export function previousRoute(): string | null {
  return read(PREVIOUS_KEY);
}

/**
 * What to call a route in a back control.
 *
 * Ordered most specific first. Returns null for anything unrecognised, which the caller
 * treats as "no usable previous route" — a back button reading "← /u/some-handle" is
 * worse than one reading "← Leaderboard" via the declared parent.
 */
export function labelForRoute(pathname: string): string | null {
  if (pathname === "/") return "Home";
  if (pathname === "/leaderboard") return "Leaderboard";
  if (pathname === "/daily") return "Daily";
  if (pathname === "/ranked") return "Ranked";
  if (pathname === "/practice") return "Practice";
  if (pathname === "/rooms") return "Rooms";
  if (pathname === "/settings") return "Settings";

  // A profile is named by its handle — "← @nova" says far more than "← Profile" when you
  // are two profiles deep.
  const profile = pathname.match(/^\/u\/([^/]+)$/);
  if (profile) return `@${profile[1]}`;

  if (/^\/m\/[^/]+$/.test(pathname)) return "Match";

  const room = pathname.match(/^\/rooms\/([^/]+)$/);
  if (room) return `Room ${room[1].toUpperCase()}`;

  return null;
}

/**
 * The back target for a page: where you actually came from, or the page's declared parent.
 *
 * Pure, and takes `previous` rather than reading storage itself, so the caller can source
 * it through `useSyncExternalStore` — which is how a browser-only value gets read after
 * hydration without a setState-in-effect. See PageHeader.
 *
 * `parent` is required rather than optional on purpose — a page that adopts the header has
 * to have decided where "up" is, and leaving that to chance is how you get a dead control
 * on the one route someone shared.
 */
export function backTarget(
  previous: string | null,
  parent: { href: string; label: string },
): { href: string; label: string } {
  if (!previous) return parent;

  const label = labelForRoute(previous);
  if (!label) return parent;

  return { href: previous, label };
}

/**
 * No-op subscribe for `useSyncExternalStore`.
 *
 * The previous route is fixed for as long as a given page is mounted — it only changes on
 * a navigation, which unmounts and remounts the header with it. There is nothing to
 * subscribe to, but the hook requires a subscribe function, and this is the honest one.
 */
export function subscribeNavHistory(): () => void {
  return () => {};
}

/** Hydration-safe snapshot: the server has no session, so it always sees "no history". */
export function getNavHistoryServerSnapshot(): string | null {
  return null;
}
