"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { AnalyticsProvider } from "@/analytics/Provider";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Clerk owns identity; Convex receives the Clerk JWT and resolves it to a user row.
 * `ConvexProviderWithClerk` keeps the token refreshed on the open WebSocket, which
 * matters here because a match can outlive a token's lifetime.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {/* Inside the Convex provider because it identifies against the Convex user row,
            not the Clerk one — every other system in the app keys on that id. Renders
            nothing, and is inert unless NEXT_PUBLIC_POSTHOG_KEY is set. */}
        <AnalyticsProvider />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
