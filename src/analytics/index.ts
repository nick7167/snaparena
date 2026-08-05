"use client";

import posthog from "posthog-js";
import type { EventName, EventProps } from "./events";

export type { EventName, EventProps } from "./events";

/**
 * Product analytics, behind one door.
 *
 * Nothing outside this folder imports `posthog-js`. That is not tidiness — it is what
 * makes the vendor replaceable, keeps every call site typed against `EventName`, and
 * means the whole system can be turned off by not setting one environment variable.
 *
 * BEFORE THIS EXISTED THE APP MEASURED NOTHING. Not conversion, not onboarding, not queue
 * abandonment, not the audio failures the audit's §3.5 hinges on. Every design decision in
 * the product was being made against zero evidence, which is why this ships ahead of the
 * welcome flow rather than alongside it: a tutorial you cannot measure is a tutorial you
 * cannot iterate on.
 */

/**
 * Disabled unless a key is present.
 *
 * Local development, CI and the e2e suite all run without one, so `track` is a no-op there
 * rather than a source of noise in the production project — or worse, a crash on a machine
 * that has no network. Read at module scope: Next inlines NEXT_PUBLIC_* at build time, so
 * this is a constant, not a lookup.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * EU by default.
 *
 * The overridable host exists because the choice is a compliance decision rather than a
 * technical one, and the wrong default is the one that silently ships EU player data to
 * a US region.
 */
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let started = false;

/** Called once from the provider. Safe to call again; it will not re-initialise. */
export function initAnalytics(): void {
  if (!KEY || started || typeof window === "undefined") return;
  started = true;

  posthog.init(KEY, {
    api_host: HOST,
    /**
     * Manual, not automatic.
     *
     * Next's App Router navigates on the client, so PostHog's automatic pageview capture
     * fires on the initial load and then never again — every route change after the first
     * would be invisible. `AnalyticsRouteTracker` sends them instead.
     */
    capture_pageview: false,
    /**
     * Off deliberately. Autocapture records every click in the DOM, which on a game whose
     * core loop is stabbing at controls under a clock is an enormous volume of events that
     * answer no question anyone is asking. The named events above are the questions.
     */
    autocapture: false,
    /**
     * The one thing that must never happen: analytics delaying the first paint of a game
     * people arrive at to play. Loading is deferred and failure is silent.
     */
    loaded: () => {},
  });
}

/**
 * Records an event.
 *
 * Never throws and never rejects — a call site in a round handler must not be able to
 * break the round because a third-party script is blocked, offline, or missing. Every
 * caller can treat this as free.
 */
export function track(name: EventName, props?: EventProps): void {
  if (!KEY || !started) return;
  try {
    posthog.capture(name, props);
  } catch {
    // Analytics must never be load-bearing.
  }
}

/**
 * Ties events to a player.
 *
 * Identified by the CONVEX user id, not the Clerk id. Every other system in the app —
 * matches, ratings, the ladder, badges — keys on the Convex row, so using anything else
 * here would make an analytics funnel impossible to join against game data later.
 */
export function identify(convexUserId: string, props?: EventProps): void {
  if (!KEY || !started) return;
  try {
    posthog.identify(convexUserId, props);
  } catch {
    /* see above */
  }
}

/** Ends the session's association on sign-out, so a shared browser does not blend players. */
export function resetIdentity(): void {
  if (!KEY || !started) return;
  try {
    posthog.reset();
  } catch {
    /* see above */
  }
}

/** A client-side route change. Called by the tracker in the shell. */
export function trackPageview(path: string): void {
  if (!KEY || !started) return;
  try {
    posthog.capture("$pageview", { $current_url: window.location.origin + path });
  } catch {
    /* see above */
  }
}
