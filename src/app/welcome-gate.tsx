"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

/**
 * Sends a brand-new account into the welcome flow.
 *
 * Replaces `OnboardingGate`, which rendered a blocking modal over the whole app. The modal
 * was the wrong instrument for three reasons, and swapping it for a redirect fixes all of
 * them at once: it never contained focus or locked scroll, so everything behind it stayed
 * tabbable while `aria-modal="true"` told assistive tech it was inert; it had to fight the
 * page underneath for a two-minute experience; and it made "has an account" and "has been
 * set up" the same moment, which they are not.
 *
 * THE CONDITION IS `onboardedAt`, NOT `welcomeStep`, and the distinction is what makes the
 * flow skippable. `onboardedAt` is written the instant a username is committed — step one
 * — so this stops firing as soon as the required part is done. Everything after that is
 * optional, and someone who navigates away mid-tutorial has decided they are finished; they
 * are not dragged back. `welcomeStep` is only read by the flow itself, to resume.
 *
 * Renders nothing.
 */
export function WelcomeGate() {
  const me = useQuery(api.users.me, {});
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Still loading, signed out, or the row is not provisioned yet.
    if (!me) return;
    // Already has a username, so the required step is behind them.
    if (me.onboardedAt) return;
    // Already there. Without this the flow would redirect to itself on every render.
    if (pathname === "/welcome") return;

    /**
     * `replace`, not `push`.
     *
     * A new account arrives here straight from signup, and a history entry pointing back
     * at the page they signed up on would put Back in front of someone who has no username
     * yet — bouncing them between the app and the gate.
     */
    router.replace("/welcome");
  }, [me, pathname, router]);

  return null;
}
