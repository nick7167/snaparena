"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";
import { identify, initAnalytics, resetIdentity, trackPageview } from "./index";

/**
 * Starts analytics and keeps the identity attached.
 *
 * Mounted inside `Providers` rather than at the root, because it reads `users.me` and so
 * has to sit under the Convex provider. Renders nothing.
 */
export function AnalyticsProvider() {
  /**
   * Safe for signed-out visitors: `users.me` is `currentUser(ctx)`, which returns null
   * rather than throwing for an anonymous request — unlike the queries built on
   * `requireUser`. That matters because the most valuable thing this measures is the guest
   * funnel, which happens entirely before an account exists.
   */
  const me = useQuery(api.users.me, {});
  const pathname = usePathname();
  const identified = useRef<string | null>(null);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    // Still resolving — say nothing rather than guessing at anonymity.
    if (me === undefined) return;

    if (me === null) {
      // Signed out, or signed in a beat before provisioning finished. Only reset if we had
      // actually identified someone, so a guest browsing anonymously is left alone.
      if (identified.current !== null) {
        identified.current = null;
        resetIdentity();
      }
      return;
    }

    // Guarded so this fires once per player rather than on every `me` invalidation —
    // which, on a query this widely subscribed, is a great many times per session.
    if (identified.current === me._id) return;
    identified.current = me._id;

    /**
     * Handle and level only. No email, no display name, no avatar URL: the handle is
     * already public on every leaderboard in the app, and anything beyond it would be
     * putting personal data into a third party for no analytical gain.
     */
    identify(me._id, { handle: me.handle, level: me.level ?? 1 });
  }, [me]);

  /**
   * Pageviews, sent manually.
   *
   * `capture_pageview` is off in init because the App Router navigates client-side: the
   * automatic capture would record the first load and then nothing, so every route change
   * in a session would be invisible.
   */
  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

  return null;
}
