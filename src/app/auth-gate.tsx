"use client";

import { useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";

/**
 * Client-side auth gates.
 *
 * Clerk v7 removed the `<SignedIn>` / `<SignedOut>` components and replaced them
 * with `<Show when="signed-in">`. The `Show` exported from `@clerk/nextjs` is the
 * *async server component* version, which cannot be used inside the "use client"
 * pages here — every game screen is a client component because it subscribes to
 * Convex queries.
 *
 * Building the gate on `useUser()` keeps the call site readable and confines the
 * version-specific detail to this one file.
 */

export function SignedIn({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || !isSignedIn) return null;
  return <>{children}</>;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  // Render nothing until Clerk resolves, so the signed-out state never flashes
  // for a player who is in fact signed in.
  if (!isLoaded || isSignedIn) return null;
  return <>{children}</>;
}
