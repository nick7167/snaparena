"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { SpacetimeDBProvider, useSpacetimeDB } from "spacetimedb/react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
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
const CLERK_JWT_TEMPLATE = "spacetimedb";

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
 * So the builder instance is deliberately stable — created once, never replaced,
 * because the provider keys its connection on (uri, module) and swapping the object
 * would not reconnect anyway — while `withToken` is called on it as Clerk rotates.
 * `withToken` mutates the builder and `build()` reads the token at call time, so the
 * next reconnect picks up whatever is current.
 */
function useFreshTokenBuilder() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const builder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(process.env.NEXT_PUBLIC_SPACETIMEDB_URI!)
        .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIMEDB_DB!),
    [],
  );

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
    };

    void apply();
    const timer = setInterval(() => void apply(), TOKEN_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [builder, isLoaded, isSignedIn, getToken]);

  return builder;
}

function SpacetimeBridge({ children }: { children: ReactNode }) {
  const builder = useFreshTokenBuilder();

  return (
    <SpacetimeDBProvider connectionBuilder={builder}>
      <IdentitySwitchGuard />
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
 * Forces a reconnect when the player signs in or out.
 *
 * Everything else about a token change is handled by mutating the builder, but
 * identity is settled at connect: a socket opened anonymously stays anonymous no
 * matter what token the builder holds afterwards. Without this, signing in would
 * leave the player connected as their guest identity until they happened to
 * reload — the daily run would claim, but `me` would keep returning the guest row.
 *
 * Dropping the socket is enough — the connection manager's `onDisconnect` schedules
 * a rebuild from the builder, which by then holds the new token. A page reload
 * would also work and is what a first attempt did, but it fires in the middle of
 * the one flow that matters most: a guest signing in to claim the daily run they
 * just finished, with their score on screen.
 */
function IdentitySwitchGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  // No type argument: the docs show `useSpacetimeDB<DbConnection>()`, but the
  // shipped 2.8 typings declare it without one.
  const { getConnection } = useSpacetimeDB();
  const lastSignedIn = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    const now = isSignedIn ?? false;

    if (lastSignedIn.current === null) {
      lastSignedIn.current = now;
      return;
    }
    if (lastSignedIn.current === now) return;
    lastSignedIn.current = now;

    // Deferred a tick so the token effect above has written the new token onto the
    // builder before the manager rebuilds from it.
    const handle = setTimeout(() => getConnection()?.disconnect(), 0);
    return () => clearTimeout(handle);
  }, [isLoaded, isSignedIn, getConnection]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider appearance={CLERK_APPEARANCE}>
      <SpacetimeBridge>{children}</SpacetimeBridge>
    </ClerkProvider>
  );
}
