/**
 * The anonymous player's identity, and nothing else.
 *
 * A random token in localStorage is what lets someone play today's challenge without
 * an account and still get a real score, a real position, and — crucially — be stopped
 * from replaying it on a refresh.
 *
 * What this does and does not buy, stated plainly because the UI copy depends on it:
 *
 *   stops   refresh, a second tab, closing and coming back, the back button
 *   stops   replay, via the same server-side one-run-per-day rule signed-in players get
 *   does not stop   clearing site data, incognito, or a different browser
 *
 * That last line is not fixable client-side, and it is true of every daily puzzle on
 * the web. The answer to someone who genuinely wants to replay is signing in, not more
 * elaborate fingerprinting — which would break more real players than cheats.
 */

const STORAGE_KEY = "snap.guest";

/** Matches the server's GUEST_TOKEN_PATTERN. A malformed token is discarded. */
const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Reads the existing token without creating one.
 *
 * Returns undefined rather than null so it can be spread straight into Convex args,
 * where an absent optional and an explicit undefined mean the same thing.
 */
export function getGuestToken(): string | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && TOKEN_PATTERN.test(stored) ? stored : undefined;
  } catch {
    // Safari in private mode, and any browser with storage blocked, throws on access
    // rather than returning null. A guest who cannot store a token can still play —
    // they simply get a fresh identity each time, which is the honest degradation.
    return undefined;
  }
}

/** Returns the existing token, creating one on first use. Called only when a run starts. */
export function ensureGuestToken(): string {
  const existing = getGuestToken();
  if (existing) return existing;

  const token = randomToken();
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Unstorable: the token still works for this session's run.
  }
  return token;
}

/** Called once the run has been claimed by a real account. */
export function clearGuestToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage was never writable.
  }
}

/**
 * crypto.randomUUID needs a secure context — true on https and localhost, which covers
 * every real deployment. The fallback keeps the format valid where it is missing.
 */
function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const hex = (length: number) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}
