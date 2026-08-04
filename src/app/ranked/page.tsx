"use client";

import { SignedIn, SignedOut } from "../auth-gate";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { DuelMatch } from "@/game/DuelMatch";
import { LobbyColumn } from "../lobby-column";
import { useQueue } from "../queue-driver";
import { Form, RecentMatches } from "../standing";
import { Beat } from "../dashboard/motion";
import { RankedHero } from "./hero";
import { RankedPitch } from "./pitch";

/**
 * Ranked is sign-in only, and always will be — a ladder needs a persistent identity to
 * mean anything. Only the daily is open to anonymous players.
 */
export default function RankedPage() {
  return (
    <>
      <SignedOut>
        <RankedPitch />
      </SignedOut>

      <SignedIn>
        <RankedHome />
      </SignedIn>
    </>
  );
}

/**
 * Split out from the page so `activeMatch` is only subscribed inside the SignedIn
 * gate. Called above it, the query threw "Not signed in" for every signed-out
 * visitor — harmless to the render but a real error in the console on every load.
 */
function RankedHome() {
  // A reload mid-match must drop you back in, not lose the match. Derived rather
  // than copied into state via an effect — `activeMatch` only returns live
  // matches, so it falls back to null on its own once a match completes.
  const existing = useQuery(api.ranked.activeMatch, {});
  // The driver's id covers the gap between a match being created and `activeMatch`
  // propagating, and is the only source when the match was found on another route.
  const queue = useQueue();
  const matchId = queue.matchId ?? existing ?? null;

  // The match renders outside the lobby column on purpose — see LobbyColumn.
  if (matchId) return <DuelMatch matchId={matchId} onLeave={queue.clearMatch} />;

  return <Lobby />;
}

/**
 * The ranked lobby.
 *
 * Two zones, and the split is structural rather than stylistic. The hero is full-bleed —
 * it is the only screen in the app where the rank emblem is the subject, and `LobbyColumn`
 * exists precisely to keep things that need the viewport out of the 672px reading column.
 * Everything below it is reading material and goes back inside.
 *
 * The hero is now a one-screen contract rather than merely full-bleed: it is bound to the
 * viewport in both its states so that neither the queue button nor, once searching, the
 * Cancel beside it can fall below the fold. `Form` and `RecentMatches` therefore start
 * BELOW the first screen by design. That is the right trade — they answer "am I on a good
 * run?", which is a question you ask before deciding to queue, not one you need in view
 * while the queue is running.
 *
 * `Form` and `RecentMatches` also appear on the dashboard, from this same import. That
 * duplication is a deliberate call rather than an oversight: they answer a pre-match
 * question here ("am I on a good run before I queue?") that they answer as history there,
 * and the two pages no longer look alike — the dashboard states a standing as a horizontal
 * career card, this one as vertical spectacle.
 *
 * The queue itself lives in the shell (see queue-driver.tsx) so it survives navigation.
 * Everything here is presentation.
 */
function Lobby() {
  return (
    // No gap between the two zones: `LobbyColumn` already carries `py-10`, and stacking a
    // gap on top of it put 80px of nothing between the queue button and the form strip —
    // enough that the two halves read as unrelated pages.
    <div className="flex flex-col">
      <RankedHero />

      <LobbyColumn>
        <Beat index={4}>
          <Form />
        </Beat>

        <Beat index={5}>
          <RecentMatches />
        </Beat>

        {/* Practice, demoted. It used to be a card with its own heading and button, which
            gave the un-rated mode roughly equal billing on the ranked page. It is one
            sentence now — the route itself is untouched. */}
        <Beat index={6}>
          <p className="text-body-sm text-muted px-4 text-center">
            Not feeling rated?{" "}
            <Link
              href="/practice"
              className="text-secondary hover:text-paper rounded-xs underline"
            >
              Practice against a bot
            </Link>
            .
          </p>
        </Beat>
      </LobbyColumn>
    </div>
  );
}
