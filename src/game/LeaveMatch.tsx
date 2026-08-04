"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SURRENDER_FROM_ROUND } from "@/engine/config";
import { useQueue } from "@/app/queue-driver";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Glyph } from "@/ui/Glyph";
import { MuteToggle } from "@/ui/MuteToggle";

export type LeaveMode = "ranked" | "practice" | "room" | "daily";

/** Where each mode goes when you leave it. */
const EXIT_HREF: Record<LeaveMode, string> = {
  ranked: "/ranked",
  practice: "/practice",
  room: "/rooms",
  daily: "/daily",
};

/**
 * What leaving actually costs, per mode. Stated plainly rather than softened — a confirm
 * that undersells the consequence is worse than no confirm at all.
 */
const CONSEQUENCE: Record<LeaveMode, { title: string; body: string; action: string }> = {
  ranked: {
    title: "Leave this duel?",
    body: "This counts as a loss and your rating will drop.",
    action: "Leave and forfeit",
  },
  practice: {
    title: "Leave this match?",
    body: "The match ends here. Nothing is rated, so nothing is lost.",
    action: "Leave match",
  },
  room: {
    title: "Leave this room?",
    body: "The others keep playing without you. You can rejoin from the room list.",
    action: "Leave room",
  },
  daily: {
    title: "Leave today's run?",
    body: "Your progress is kept — you can pick the run up where you left it.",
    action: "Leave run",
  },
};

/**
 * The way out of a match.
 *
 * A match hides the entire app shell — sidebar, tab bar, back link and all — which left
 * several screens with no exit whatsoever: the thirty-second VS reveal, the first two
 * rounds of a duel (the surrender control is gated until round three), the whole daily
 * run, and the results screen. The only reliable escape was the browser's back button,
 * which silently forfeited rated matches.
 *
 * So this is deliberately rendered OUTSIDE the phase switch and pinned to the viewport:
 * it has to survive every beat, including the loading and error dead-ends, because those
 * are exactly where being stuck is worst. The mute toggle rides along for the same reason
 * — the shell was also the only place to silence a game that is entirely about sound.
 */
export function LeaveMatch({
  mode,
  matchId,
  currentRound,
  live,
}: {
  mode: LeaveMode;
  /** Absent for the daily, which has no surrender path. */
  matchId?: Id<"matches">;
  /** Zero-indexed. Decides whether the server will accept a clean resignation. */
  currentRound?: number;
  /** False once the match is over — nothing is at stake, so leaving needs no confirm. */
  live: boolean;
}) {
  const router = useRouter();
  const queue = useQueue();
  const surrender = useMutation(api.ranked.surrender);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Lets the unload guard stand down for a departure the player already agreed to. */
  const departing = useRef(false);

  const rated = mode === "ranked" || mode === "practice";

  const leave = useCallback(async () => {
    setLeaving(true);
    departing.current = true;

    /**
     * Resign properly when the server will take it, so the opponent is released
     * immediately rather than waiting out the presence grace period.
     *
     * Before `SURRENDER_FROM_ROUND` the server refuses — the gate is deliberate and not
     * ours to loosen — so leaving early just stops the heartbeat and the forfeit resolves
     * on its own. Either way it is a loss, which is what the confirm said.
     */
    if (rated && matchId && (currentRound ?? 0) >= SURRENDER_FROM_ROUND && live) {
      try {
        await surrender({ matchId });
      } catch {
        // A refused resignation still means leaving; the forfeit path covers it.
      }
    }

    // Ranked holds the match id in the queue driver so a reload drops you back in. Without
    // clearing it, navigating to /ranked would put you straight back into the match.
    queue.clearMatch();
    router.push(EXIT_HREF[mode]);
  }, [rated, matchId, currentRound, live, surrender, queue, router, mode]);

  // Only rated, in-progress matches have anything to lose to a stray Back press.
  useDepartureWarning(rated && live, departing, () => setConfirming(true));

  const copy = CONSEQUENCE[mode];

  return (
    <>
      {/*
        Fixed rather than placed in the header: the header is hidden during the VS reveal
        and the results screen, and several stages size themselves to the viewport, so
        anything in normal flow can end up off-screen at exactly the wrong moment.
      */}
      <div
        className="border-line bg-ink-800/80 fixed top-3 left-3 z-40 flex items-center gap-1
                   rounded-full border p-1 backdrop-blur"
      >
        <button
          onClick={() => (live ? setConfirming(true) : void leave())}
          aria-label={live ? copy.title : "Leave match"}
          className="text-muted hover:text-paper flex items-center gap-1.5 rounded-full px-2.5
                     py-1 text-xl transition-colors"
        >
          <Glyph name="leave" />
          <span className="text-body-sm sr-only sm:not-sr-only">Leave</span>
        </button>
        <MuteToggle />
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={copy.title}
        description={copy.body}
      >
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant={mode === "ranked" ? "destructive" : "primary"}
            block
            disabled={leaving}
            onClick={() => void leave()}
          >
            {copy.action}
          </Button>
          <Button variant="ghost" block onClick={() => setConfirming(false)}>
            Keep playing
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/**
 * Warns before a Back press or a tab close throws away a live rated match.
 *
 * Backing out used to unmount the match silently, which stopped the presence heartbeat
 * and forfeited the duel with no indication that anything had happened.
 *
 * Every dependency here is deliberately a ref or a primitive. The match tree re-renders
 * on every animation frame, and an unstable dependency would re-run this effect sixty
 * times a second — pushing sixty history entries and burying the player's real history.
 */
function useDepartureWarning(
  active: boolean,
  departing: React.RefObject<boolean>,
  onBack: () => void,
) {
  const intercept = useRef(onBack);
  useEffect(() => {
    intercept.current = onBack;
  });

  useEffect(() => {
    if (!active) return;

    const warnOnUnload = (event: BeforeUnloadEvent) => {
      if (departing.current) return;
      event.preventDefault();
    };

    /**
     * A sentinel entry absorbs the first Back press so it can be turned into a question.
     *
     * Safe here because every mode renders its match inline on its own route, so the
     * sentinel's URL is the page the player is already on — leaving does not strand an
     * entry pointing somewhere stale.
     */
    const pushSentinel = () => history.pushState({ matchGuard: true }, "", location.href);
    pushSentinel();

    const onPopState = () => {
      if (departing.current) return;
      // Put the sentinel back before asking, so a second Back press while the dialog is
      // open does not slip past it.
      pushSentinel();
      intercept.current();
    };

    window.addEventListener("beforeunload", warnOnUnload);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", warnOnUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [active, departing]);
}
