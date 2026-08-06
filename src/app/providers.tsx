"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { AnalyticsProvider } from "@/analytics/Provider";
import { ConfigProvider } from "./config";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Clerk owns identity; Convex receives the Clerk JWT and resolves it to a user row.
 * `ConvexProviderWithClerk` keeps the token refreshed on the open WebSocket, which
 * matters here because a match can outlive a token's lifetime.
 */
/**
 * The one Clerk surface this app does not draw itself.
 *
 * Sign-in and sign-up are custom forms built from `ui/` primitives, so almost nothing
 * stock-Clerk ships. The exception is `openUserProfile()` behind the account menu's
 * "Manage account" — email, password and connected accounts live there, and it arrived
 * in Clerk's default light theme: a white panel with a grey rail, opening on top of a
 * dark app three rows above "Sign out".
 *
 * Variables rather than a wholesale restyle. These are the same values as globals.css —
 * duplicated because Clerk's iframe-less modal cannot read Tailwind's `@theme`, and
 * hardcoded rather than computed because the palette is deliberately fixed and dark-only.
 */
const CLERK_APPEARANCE = {
  /**
   * PARTIAL, and the limits are worth writing down so the next person does not repeat the
   * two attempts that failed.
   *
   * Attempt one set `colorBackground`, `colorText` and friends with no base theme. The
   * panel went dark while Clerk's internal label shades stayed computed for a light
   * surface, so "Account", "Profile details", "Email addresses" and the whole left rail
   * rendered dark-grey on dark-grey — strictly worse than what it replaced. Attempt two
   * added `baseTheme: dark` on top and reproduced the same fault.
   *
   * What is here is what was verified in a screenshot: `colorPrimary` and `colorDanger`
   * DO apply — the actions render in SNAP's gold instead of Clerk's blue.
   *
   * `baseTheme: dark` from `@clerk/themes` was tried too and had no visible effect on the
   * modal `openUserProfile()` opens, so the package was removed rather than left as a
   * dependency paying for nothing.
   *
   * So this surface is still a light panel in a dark app. That is a knowingly accepted
   * mismatch rather than an oversight: it is the one screen the design system does not
   * own, and a legible light modal beats an illegible dark one. Fixing it properly means
   * `elements`-level overrides against Clerk's class names, which is a real piece of work
   * and wants its own pass.
   */
  variables: {
    colorPrimary: "#f0b429", // --color-gold
    colorDanger: "#ff6b5e", // --color-signal-text
    borderRadius: "12px", // --radius-md
  },
} as const;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider appearance={CLERK_APPEARANCE}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {/* Inside the Convex provider because it identifies against the Convex user row,
            not the Clerk one — every other system in the app keys on that id. Renders
            nothing, and is inert unless NEXT_PUBLIC_POSTHOG_KEY is set. */}
        <AnalyticsProvider />
        {/* Tuning values, live from the deployment. Falls back to the shipped defaults
            until the query lands rather than holding the first paint — see config.tsx. */}
        <ConfigProvider>{children}</ConfigProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
