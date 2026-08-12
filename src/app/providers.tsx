"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { SpacetimeDBProvider, useSpacetimeDB } from "spacetimedb/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DbConnection } from "@/module_bindings";
import { AnalyticsProvider } from "@/analytics/Provider";
import { ConfigProvider } from "./config";

/**
 * Clerk owns identity; SpacetimeDB receives the Clerk JWT as the connection token
 * and derives an Identity from its `iss` + `sub`. The module then maps that
 * Identity to a player row through its `account` table — the same job
 * `by_clerk_id` did, since Clerk's `sub` is exactly what `clerkId` used to hold.
 */

/**
 * The Clerk JWT template minted for this database.
 *
 * Must exist in the Clerk dashboard under this exact name. It replaces the
 * template named "convex", and the issuer it declares has to be registered on the
 * module with `npm run stdb:auth` — the module refuses tokens from issuers it does
 * not know, which is the same deliberate loud failure `auth.config.ts` had.
 */
export const CLERK_JWT_TEMPLATE = "spacetimedb";

/**
 * How often to pull a fresh token from Clerk.
 *
 * Clerk session tokens are short-lived (about a minute). `getToken` returns a
 * cached one until it is close to expiry and transparently mints a new one after
 * that, so this interval only has to be comfortably under the lifetime — it is not
 * itself doing the refreshing.
 */
const TOKEN_REFRESH_MS = 45_000;

/**
 * The one Clerk surface this app does not draw itself.
 *
 * Sign-in and sign-up are custom forms built from `ui/` primitives, so almost
 * nothing stock-Clerk ships. The exception is `openUserProfile()` behind the
 * account menu's "Manage account" — email, password and connected accounts live
 * there, and it arrived in Clerk's default light theme: a white panel with a grey
 * rail, opening on top of a dark app three rows above "Sign out".
 *
 * Variables rather than a wholesale restyle. These are the same values as
 * globals.css — duplicated because Clerk's iframe-less modal cannot read
 * Tailwind's `@theme`, and hardcoded rather than computed because the palette is
 * deliberately fixed and dark-only.
 */
const CLERK_APPEARANCE = {
  /**
   * PARTIAL, and the limits are worth writing down so the next person does not
   * repeat the two attempts that failed.
   *
   * Attempt one set `colorBackground`, `colorText` and friends with no base theme.
   * The panel went dark while Clerk's internal label shades stayed computed for a
   * light surface, so "Account", "Profile details", "Email addresses" and the whole
   * left rail rendered dark-grey on dark-grey — strictly worse than what it
   * replaced. Attempt two added `baseTheme: dark` on top and reproduced the same
   * fault.
   *
   * What is here is what was verified in a screenshot: `colorPrimary` and
   * `colorDanger` DO apply — the actions render in SNAP's gold instead of Clerk's
   * blue.
   *
   * So this surface is still a light panel in a dark app. That is a knowingly
   * accepted mismatch rather than an oversight: it is the one screen the design
   * system does not own, and a legible light modal beats an illegible dark one.
   */
  variables: {
    colorPrimary: "#f0b429", // --color-gold
    colorDanger: "#ff6b5e", // --color-signal-text
    borderRadius: "12px", // --radius-md
  },
} as const;

/**
 * Keeps the connection builder's token fresh without churning the connection.
 *
 * This is the piece the port had to work out from the SDK rather than the docs,
 * and it turns on two facts:
 *
 *  1. A token is only checked when the socket is OPENED. Once connected, the
 *     identity is settled for the life of that socket, so an expiring Clerk token
 *     cannot interrupt a match in progress. The old Convex comment here — that the
 *     token has to stay refreshed because a match can outlive it — does not
 *     transfer.
 *
 *  2. But the React integration reconnects by calling `build()` on the SAME builder
 *     object it was first given (`ConnectionManager` stores it as `managed.builder`
 *     and reuses it from every reconnect path, including the visibility/focus/online
 *     revival handlers). A builder holding a token minted a minute ago would present
 *     an expired JWT on every reconnect after a backgrounded tab or a dropped
 *     network — and an unauthenticated connect does not fail closed, it succeeds as
 *     a NEW anonymous identity. A player would silently come back as a guest.
 *
 * So the builder instance is stable for the life of the page — the provider keys its
 * connection on (uri, module), so swapping the object would not reconnect anyway —
 * while `withToken` is called on it as Clerk rotates. `withToken` mutates the builder
 * and `build()` reads the token at call time, so the next reconnect picks up whatever
 * is current. (`initialToken` is in the memo's dependencies for correctness, but it
 * arrives from the server render and does not change without a fresh document.)
 */
function useFreshTokenBuilder(initialToken: string | undefined) {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  /**
   * Seeded synchronously, which is the whole point of `initialToken`.
   *
   * `useMemo` runs during render, before any effect and therefore before the
   * provider below mounts and opens its socket. So the first connection carries the
   * player's token rather than being anonymous and needing to be replaced.
   */
  const builder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(process.env.NEXT_PUBLIC_SPACETIMEDB_URI!)
        .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIMEDB_DB!)
        .withToken(initialToken),
    [initialToken],
  );

  /**
   * Bumped whenever the builder crosses between holding a token and not.
   *
   * NOT on every refresh. A token replaced by a newer one changes nothing about the
   * live socket — identity is settled at connect — so churning the connection every
   * 45 seconds would drop every subscription in the app for no reason. Only the
   * crossing matters, because only the crossing means the open socket is the wrong
   * identity.
   */
  const [tokenEpoch, setTokenEpoch] = useState(0);
  /**
   * Starts from what the server already put on the builder, so the client's first
   * refresh — which fetches the same token for the same session — is not read as a
   * crossing and does not rebuild the connection it just seeded.
   */
  const hasToken = useRef(initialToken !== undefined);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    const apply = async () => {
      // Signed-out play is a real state, not a degraded one: the daily is playable
      // anonymously, and SpacetimeDB hands an anonymous connection its own
      // persistent identity. So no token means a guest session rather than a
      // failure — no `account` row, not no connection.
      const token = isSignedIn
        ? ((await getToken({ template: CLERK_JWT_TEMPLATE })) ?? undefined)
        : undefined;
      if (cancelled) return;

      builder.withToken(token);

      const nowHasToken = token !== undefined;
      if (nowHasToken !== hasToken.current) {
        hasToken.current = nowHasToken;
        setTokenEpoch((epoch) => epoch + 1);
      }
    };

    void apply();
    const timer = setInterval(() => void apply(), TOKEN_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [builder, isLoaded, isSignedIn, getToken]);

  return { builder, tokenEpoch };
}

function SpacetimeBridge({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken: string | undefined;
}) {
  const { builder, tokenEpoch } = useFreshTokenBuilder(initialToken);

  /**
   * The token epoch the mounted provider was built for.
   *
   * When it falls behind, the provider is unmounted for one tick and remounted —
   * see `IdentitySwitchGuard` for why that, and not `disconnect()`, is what
   * actually replaces a connection.
   */
  const [live, setLive] = useState(0);

  useEffect(() => {
    if (live === tokenEpoch) return;

    /**
     * One tick is enough, and the ordering is guaranteed rather than lucky.
     *
     * Unmounting runs the provider's cleanup, which calls `release()`, which defers
     * its own teardown with `setTimeout(0)`. React runs cleanups before it runs the
     * effects of the same commit, so `release`'s timer is always scheduled before
     * this one — and timers fire in scheduling order. By the time this fires, the
     * old connection is closed and its pool entry deleted, so the remount's
     * `retain()` has nothing to hand back and builds afresh from the builder, which
     * by now holds the token.
     */
    const handle = setTimeout(() => setLive(tokenEpoch), 0);
    return () => clearTimeout(handle);
  }, [live, tokenEpoch]);

  // The one-tick gap. Rendering nothing here is deliberate: every hook below needs
  // the provider, and this only ever happens after hydration, on a sign-in or
  // sign-out, for a single frame.
  if (live !== tokenEpoch) return null;

  return (
    <SpacetimeDBProvider connectionBuilder={builder}>
      <ConnectionMonitor />
      {/* Inside the SpacetimeDB provider because it identifies against the module's
          user row, not the Clerk one — every other system in the app keys on that
          id. Renders nothing, and is inert unless NEXT_PUBLIC_POSTHOG_KEY is set. */}
      <AnalyticsProvider />
      {/* Tuning values, live from the module. Falls back to the shipped defaults
          until the subscription lands rather than holding the first paint. */}
      <ConfigProvider>{children}</ConfigProvider>
    </SpacetimeDBProvider>
  );
}

/**
 * WHY THE PROVIDER IS REMOUNTED RATHER THAN THE SOCKET DISCONNECTED.
 *
 * Identity is settled at CONNECT. A socket opened without a token is anonymous for
 * its whole life, no matter what the builder holds afterwards, so any crossing
 * between token and no-token leaves the connection speaking as the wrong identity.
 * The first connection of every page load is one of these: `SpacetimeDBProvider`
 * calls `ConnectionManager.retain()` in its own effect, React runs child effects
 * before parent ones, and `getToken` is asynchronous on top of that — so the first
 * connect cannot carry a token even in principle.
 *
 * Two attempts got this wrong, and the second is the interesting one.
 *
 * The first watched `isSignedIn` for a TRANSITION, which never happens for a player
 * who was already signed in when the page loaded. The connection stayed anonymous
 * for the whole session, `ensureUser` rejected it with "Not signed in", and every
 * screen that reads `me` rendered blank.
 *
 * The second watched the token instead — correct — and called `disconnect()` to
 * force a rebuild, on the strength of a comment claiming the manager reconnects from
 * `onDisconnect`. It does not, and says so:
 *
 *     // The application asked this connection to close; don't fight it. A
 *     // subsequent retain() will still build a fresh connection.
 *     if (connection?.isDisconnectRequested) return;
 *
 * An explicit disconnect is honoured as final. So the app connected, dropped itself,
 * and sat there — which the console showed exactly: active true, then active false,
 * with no error and no third attempt.
 *
 * `ConnectionManager.rebuild()` exists for precisely this and its own docstring
 * names the case ("swapping an anonymous session for a signed-in one after an auth
 * change"), but it is not exported from `spacetimedb/sdk` and the React layer never
 * wires it up. What IS supported is the sentence in the comment above: a subsequent
 * `retain()` builds fresh. So the provider is unmounted and remounted, which is
 * release-then-retain, which is that path.
 */

/**
 * Reports the connection's state to the console, once per transition.
 *
 * The SDK is nearly silent: it logs "Connecting to SpacetimeDB WS..." from the
 * constructor — BEFORE the socket exists — and then says nothing at all unless the
 * open outright rejects. So a page that renders every panel as a loading skeleton
 * looks identical whether the socket is still opening, opened and idle, or was
 * refused; and the one message you do get is the least informative of the three,
 * because it is printed before anything has been attempted.
 *
 * That ambiguity cost a diagnosis, so the app says it plainly instead. Three or
 * four lines per page load, and they distinguish the cases that matter:
 *
 *   active:false, error:null    still connecting, or hung
 *   active:false, error:"..."   refused, and by what
 *   active:true,  identity:...  connected; anything still blank is a subscription
 *
 * `console.info` rather than a debug flag nobody knows to set. This is the log an
 * operator needs at the moment they discover they need it, and by then a rebuild to
 * turn it on is the expensive part.
 */
function ConnectionMonitor() {
  const { isActive, identity, connectionError } = useSpacetimeDB();

  useEffect(() => {
    /**
     * ONE FLAT STRING, not an object.
     *
     * The first version logged an object and Chrome rendered it as the word
     * "Object" — collapsed, needing a click per line to read. A log nobody can read
     * at a glance is not a log; it is another round trip. Interpolated so the whole
     * state is visible in the console's own listing.
     */
    console.info(
      `[snap] spacetimedb — active=${isActive}` +
        ` identity=${identity?.toHexString() ?? "none"}` +
        ` error=${connectionError?.message ?? "none"}`,
    );
  }, [isActive, identity, connectionError]);

  return null;
}

export function Providers({
  children,
  initialToken,
}: {
  children: ReactNode;
  /**
   * The player's Clerk token, minted on the server. Undefined for a signed-out
   * visitor, which is a state rather than a failure. See `connectionToken` in
   * layout.tsx for why this crosses the server boundary at all.
   */
  initialToken?: string;
}) {
  return (
    <ClerkProvider appearance={CLERK_APPEARANCE}>
      <SpacetimeBridge initialToken={initialToken}>{children}</SpacetimeBridge>
    </ClerkProvider>
  );
}
