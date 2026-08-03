"use client";

import { useUser } from "@clerk/nextjs";
import { Landing } from "./landing";
import { Hub } from "./hub";

/**
 * Which home you get, reconciled between the server and Clerk.
 *
 * The server decides first, from the session cookie, and that decision is load-bearing:
 * it is what puts the pitch into the server-rendered HTML for crawlers and link previews.
 * See page.tsx for why gating on `<SignedIn>` alone does not work here.
 *
 * But the server can be wrong in one direction. A session token lives about a minute and
 * is refreshed continuously by Clerk's client; if a request arrives with an expired one,
 * `clerkMiddleware` normally issues a handshake and the visitor comes back refreshed. When
 * that handshake cannot re-issue — no refresh cookie, a revoked session, a browser
 * blocking the third-party hop — the server renders the signed-out page while Clerk on the
 * client still knows perfectly well who you are. The result is a player looking at "Sign
 * up and save your score" with their own rank and rating in the sidebar beside it.
 *
 * So the server's answer is treated as the opening bid rather than the verdict: it holds
 * until Clerk has loaded, and Clerk wins after that.
 *
 * The order matters for hydration. `isLoaded` is false on the client's first render, so
 * that render uses `signedInOnServer` and matches the HTML the server sent exactly. The
 * correction only happens on the re-render after Clerk resolves, which is a state change
 * rather than a mismatch.
 */
export function HomeSwitch({ signedInOnServer }: { signedInOnServer: boolean }) {
  const { isLoaded, isSignedIn } = useUser();
  const signedIn = isLoaded ? isSignedIn : signedInOnServer;

  if (!signedIn) return <Landing />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12">
      <Hub />
    </div>
  );
}
