/**
 * The anonymous player's claim ticket, and nothing else.
 *
 * WHAT CHANGED IN THE PORT. This module used to MINT the identity: a random UUID in
 * localStorage that the browser sent with every daily call, and that the server had to
 * take on trust as a statement of who you were. SpacetimeDB issues an anonymous
 * identity per connection, so the identity half is gone entirely — `ctx.sender` is now
 * as trustworthy for a guest as for a signed-in player.
 *
 * What is left is the one thing the connection cannot carry across a sign-in: after
 * Clerk authenticates you, your identity CHANGES, so the module has no way to tell that
 * the new account and yesterday's guest are the same person. The guest's row carries a
 * server-issued `guestClaimToken`, readable only by that guest through the `me` view;
 * this stores it so the account you create a moment later can present it back and
 * inherit the run.
 *
 * So the token went from being an assertion to being a capability, and this file went
 * from generating one to remembering one.
 *
 * What that does and does not buy, stated plainly because the UI copy depends on it:
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

/**
 * Reads the stored claim token.
 *
 * Returns undefined rather than null so an absent token and an explicitly absent one
 * are the same value at every call site.
 */
export function getGuestToken(): string | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    // Safari in private mode, and any browser with storage blocked, throws on access
    // rather than returning null. A guest who cannot store a token can still play —
    // they simply cannot carry the run onto an account, which is the honest degradation.
    return undefined;
  }
}

/**
 * Remembers the token the module issued to this guest.
 *
 * Called with `me.guestClaimToken` once an anonymous player has a row — never with a
 * value this file invented, which is the whole point of the change.
 */
export function rememberGuestToken(token: string): void {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === token) return;
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Unstorable: the run still plays, it just cannot be claimed later.
  }
}

/** Called once the run has been claimed by a real account. */
export function clearGuestToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage was never writable.
  }
}
