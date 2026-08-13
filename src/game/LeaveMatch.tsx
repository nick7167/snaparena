"use client";

import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { reducers } from "@/module_bindings";
import { SURRENDER_FROM_ROUND } from "@/engine/config";
import { useQueue } from "@/app/queue-driver";
import { useMe, useMyRooms } from "@/app/db";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Glyph } from "@/ui/Glyph";

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
const CONSEQUENCE: Record<
  LeaveMode | "rankedEarly",
  { title: string; body: string; action: string }
> = {
  ranked: {
    title: "Leave this duel?",
    body: "This counts as a loss and your rating will drop.",
    action: "Leave and forfeit",
  },
  /**
   * Rounds 0-1 of a ranked duel, where `surrender` no-ops server-side (see `canSurrender`
   * in matchmaking.ts). "Leave and forfeit" was a lie here: no reducer ran, the match
   * stayed live, and the player was routed to `/ranked` — the page that was already
   * showing the match — so it kept showing it. Closing the connection is the only thing
   * that starts the forfeit clock this early.
   */
  rankedEarly: {
    title: "Leave this duel?",
    body:
      `You can't resign before round ${SURRENDER_FROM_ROUND + 1} — the server ignores it. ` +
      "The match stays live and this screen keeps showing it. Close the tab if you need to " +
      "go; it counts as a loss once the forfeit sweep notices you're gone.",
    action: "Leave anyway",
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
    body:
      "Your run ends here and is scored as it stands — songs you have not played count " +
      "zero. The daily can only be played once a day, so there is no coming back to it.",
    action: "End my run",
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
 * So this is deliberately rendered OUTSIDE the phase switch, by `MatchChrome`: it has to
 * survive every beat, including the loading and error dead-ends, because those are exactly
 * where being stuck is worst.
 *
 * This component is the button and its confirm only. Where it sits is `MatchChrome`'s job —
 * it used to place itself `fixed`, and that is what put it on top of the match header on
 * every phone-width screen.
 */
export function LeaveMatch({
  mode,
  matchId,
  currentRound,
  live,
}: {
  mode: LeaveMode;
  /** Needed by every mode that writes something on the way out — resigning, or recording
      an abandoned daily. Optional only so a caller with no match yet can still render. */
  matchId?: bigint;
  /** Zero-indexed. Decides whether the server will accept a clean resignation. Duels only. */
  currentRound?: number;
  /** False once the match is over — nothing is at stake, so leaving needs no confirm. */
  live: boolean;
}) {
  const router = useRouter();
  const queue = useQueue();
  const surrender = useStdbReducer(reducers.surrender);
  const forfeitDaily = useStdbReducer(reducers.forfeitDaily);
  const leaveRoom = useStdbReducer(reducers.leaveRoom);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Lets the unload guard stand down for a departure the player already agreed to. */
  const departing = useRef(false);

  const rated = mode === "ranked" || mode === "practice";

  /**
   * Ranked keeps the early-round gate: before `SURRENDER_FROM_ROUND` the server ignores
   * `surrender` outright (see `canSurrender` in matchmaking.ts), and there is no other
   * write that ends the match — closing the connection is what actually starts the
   * forfeit clock this early. Practice has no such gate: the forfeit sweep only looks
   * at ranked matches, so an unresigned practice match would stay `active` forever and
   * keep routing the player back into it. Practice moves no rating, so resigning
   * immediately costs nothing and is the only thing that ends it.
   */
  const canResign = mode === "practice" || (currentRound ?? 0) >= SURRENDER_FROM_ROUND;

  /**
   * `leaveRoom` takes the room's own id, not the match id this component is handed —
   * they are different sequences. There is no prop carrying it (the match row's
   * `roomId` is not surfaced by `useMatchState`), so it is recovered from the rooms the
   * player is currently in, matched by which one's match is this one.
   */
  const me = useMe();
  const myRooms = useMyRooms(mode === "room" ? me?.id : undefined, 20);
  const roomId = myRooms?.find((room) => room.activeMatchId === matchId)?.roomId;

  const leave = useCallback(async () => {
    setLeaving(true);
    departing.current = true;

    // A resignation the server accepts is a loss, which is what the confirm says from
    // round `SURRENDER_FROM_ROUND` on. Before that it is not attempted at all — the
    // `rankedEarly` copy says so instead of promising a forfeit that will not happen.
    if (rated && matchId && canResign && live) {
      try {
        await surrender({ matchId });
      } catch {
        // A refused resignation still means leaving; the forfeit path covers it.
      }
    }

    /**
     * Rooms have no concede — `surrender` no-ops for `mode === "room"` on the server,
     * because a room eliminates rather than concedes. `leaveRoom` is the only write that
     * records the departure; it drops the player from the room's roster (and hands off
     * the host, or closes the room, if that was the last seat) without touching the
     * match itself, which keeps running for whoever is left.
     */
    if (mode === "room" && roomId !== undefined) {
      try {
        await leaveRoom({ roomId });
      } catch {
        // Nothing useful to retry from a confirm dialog; the player is leaving either way.
      }
    }

    /**
     * The daily is recorded on the way out, which is what makes leaving final.
     *
     * Without this the run stays live and resumable — and because an unwatched round never
     * advances, resuming means picking up the same song with a fresh clock. See
     * `daily.forfeit` for the whole shape of that hole.
     */
    if (mode === "daily" && matchId && live) {
      try {
        // No token: an anonymous caller is identified by its own connection now.
        await forfeitDaily({ matchId });
      } catch {
        // Never trap someone in a run because the write failed. The server-side round
        // expiry still denies the replay this was protecting against.
      }
    }

    // Ranked holds the match id in the queue driver so a reload drops you back in. Without
    // clearing it, navigating to /ranked would put you straight back into the match — and
    // for an early-round ranked leave, where nothing above actually ended the match, the
    // driver's own reconciliation re-adopts it anyway; see queue-driver.tsx's `announced`
    // effect for why that no longer forces navigation back onto whatever page this was.
    queue.clearMatch();
    router.push(EXIT_HREF[mode]);
  }, [
    rated,
    matchId,
    canResign,
    live,
    surrender,
    forfeitDaily,
    mode,
    roomId,
    leaveRoom,
    queue,
    router,
  ]);

  // Only rated, in-progress matches have anything to lose to a stray Back press.
  useDepartureWarning(rated && live, departing, () => setConfirming(true));

  // Rounds 0-1 of a ranked duel get the honest variant: "Leave and forfeit" implies a
  // write happens on confirm, and here none does.
  const copy =
    mode === "ranked" && live && !canResign ? CONSEQUENCE.rankedEarly : CONSEQUENCE[mode];

  return (
    <>
      {/* Placed by `MatchChrome`, in normal flow. This used to position itself `fixed`,
          which put it on top of the match header on any viewport narrow enough for the
          content column to reach the screen edge — i.e. every phone. */}
      <button
        onClick={() => (live ? setConfirming(true) : void leave())}
        aria-label={live ? copy.title : "Leave match"}
        className="text-muted hover:text-paper -m-1 flex items-center gap-1.5 rounded-full p-1
                   text-xl transition-colors"
      >
        <Glyph name="leave" />
        <span className="text-label font-semibold tracking-label">LEAVE</span>
      </button>

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
