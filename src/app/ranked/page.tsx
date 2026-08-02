"use client";

import { SignedIn, SignedOut } from "../auth-gate";
import { motion } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DuelMatch } from "@/game/DuelMatch";
import { DUEL_STARTING_HP, VETO_BANS_PER_PLAYER } from "@/engine/config";
import { play } from "@/audio/sfx";
import { BotBadge } from "@/game/ui";
import { useNow } from "@/game/usePrefersReducedMotion";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Surface";
import { AuthDialogButton } from "@/auth/AuthDialogButton";

/**
 * How long a player waits alone before ranked offers them a bot automatically.
 *
 * Long enough that a real opponent had a genuine chance to arrive; short enough that
 * walking away from an empty queue is not the outcome. The manual button is available
 * from the first second regardless — this is the safety net, not the front door.
 */
const BOT_FALLBACK_MS = 90_000;

/**
 * Ranked is sign-in only, and always will be — a ladder needs a persistent identity to
 * mean anything. Only the daily is open to anonymous players.
 */
export default function RankedPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <SignedOut>
        <div className="flex flex-col items-start gap-4 px-4">
          <h1 className="font-display text-display-1 font-extrabold">Ranked 1v1</h1>
          <p className="text-body-lg text-secondary">
            Sign in to play ranked and earn a rating.
          </p>
          <AuthDialogButton mode="sign-up" size="lg">
            Create an account
          </AuthDialogButton>
          <p className="text-body-sm text-muted">
            Want to play right now without an account? Today&rsquo;s challenge is open
            to everyone.
          </p>
          <ButtonLink variant="secondary" href="/daily">
            Play today&rsquo;s challenge
          </ButtonLink>
        </div>
      </SignedOut>

      <SignedIn>
        <RankedHome />
      </SignedIn>
    </div>
  );
}

/**
 * Split out from the page so `activeMatch` is only subscribed inside the SignedIn
 * gate. Called above it, the query threw "Not signed in" for every signed-out
 * visitor — harmless to the render but a real error in the console on every load.
 */
function RankedHome() {
  const [joined, setJoined] = useState<Id<"matches"> | null>(null);
  // A reload mid-match must drop you back in, not lose the match. Derived rather
  // than copied into state via an effect — `activeMatch` only returns live
  // matches, so it falls back to null on its own once a match completes.
  const existing = useQuery(api.ranked.activeMatch, {});
  const matchId = joined ?? existing ?? null;
  const setMatchId = setJoined;

  return matchId ? (
    <DuelMatch matchId={matchId} onLeave={() => setMatchId(null)} />
  ) : (
    <Queue onMatched={setMatchId} />
  );
}

/**
 * Matchmaking queue.
 *
 * Deliberately honest about an empty pool: ranked shipped before there is a
 * population to match against, so an empty queue says so and points at the daily
 * rather than spinning forever.
 */
function Queue({ onMatched }: { onMatched: (id: Id<"matches">) => void }) {
  const status = useQuery(api.ranked.queueStatus, {});
  const enqueue = useMutation(api.ranked.enqueue);
  const dequeue = useMutation(api.ranked.dequeue);
  const tryMatchmake = useMutation(api.ranked.tryMatchmake);
  const startBotMatch = useMutation(api.bots.startBotMatch);

  // Ticked client-side from the server's `enqueuedAt`. A Convex query does not re-run
  // on a timer, so anything elapsed has to be computed here or it stands still.
  const now = useNow(1000);

  const startBot = useCallback(async () => {
    const result = await startBotMatch({});
    if (result.status === "started" && result.matchId) {
      play("whoosh");
      onMatched(result.matchId);
    }
  }, [startBotMatch, onMatched]);

  useEffect(() => {
    if (!status?.inQueue) return;
    const id = setInterval(async () => {
      const result = await tryMatchmake({});
      if (result.matched) {
        play("whoosh");
        onMatched(result.matchId);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [status?.inQueue, tryMatchmake, onMatched]);

  const waitingMs = status?.enqueuedAt ? Math.max(0, now - status.enqueuedAt) : 0;

  /**
   * Automatic bot fallback.
   *
   * A queue with nobody in it is a mode that does not exist, and at launch that is
   * every queue. 90 seconds is long enough that a real opponent genuinely had a chance
   * to arrive first — the point is to make ranked playable, not to quietly replace it
   * with bot matches.
   *
   * Derived rather than stored, so the banner and the timer below can never disagree
   * about whether the fallback is running.
   */
  const fallingBack =
    status?.inQueue === true &&
    status.playersWaiting <= 1 &&
    waitingMs >= BOT_FALLBACK_MS;

  /**
   * Announced for three seconds before it fires. Being dropped into a match against
   * software without warning is precisely what the human-only rule existed to prevent,
   * and this notice is what replaces that rule.
   */
  useEffect(() => {
    if (!fallingBack) return;
    const id = setTimeout(() => void startBot(), 3000);
    return () => clearTimeout(id);
  }, [fallingBack, startBot]);

  if (!status) return <p className="text-body text-muted px-4">Loading…</p>;

  if (status.inQueue) {
    const waitingSeconds = Math.floor(waitingMs / 1000);

    return (
      <div className="flex flex-col gap-4 px-4">
        <h1 className="font-display text-display-1 font-extrabold">
          {fallingBack ? "No humans found" : "Searching…"}
        </h1>
        <p className="text-body text-secondary tabular-nums" role="status">
          {fallingBack
            ? "Matching you with a bot — this one won't affect your rating."
            : `${waitingSeconds}s — widening the rating range`}
        </p>

        <div className="bg-ink-inset h-1 overflow-hidden rounded-full">
          <motion.div
            className="bg-gold h-full w-1/3 rounded-full"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          />
        </div>

        {/* Offered from the first second rather than after an arbitrary wait: an empty
            ladder should hand you a game immediately, not make you earn one by
            waiting. The automatic fallback above is the safety net for someone who
            walks away, not the primary route. */}
        {!fallingBack && (
          <Card className="flex flex-col items-start gap-3 p-4">
            <p className="text-body text-secondary">
              Don&rsquo;t want to wait? Play a bot near your rating right now.{" "}
              <span className="text-paper font-medium">
                XP and badges count; rating does not.
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => void startBot()}>
                <BotBadge />
                Play a bot instead
              </Button>
              <Link href="/daily" className="text-paper rounded-xs font-semibold underline">
                Today&rsquo;s challenge
              </Link>
            </div>
          </Card>
        )}

        <Button variant="secondary" className="w-fit" onClick={() => void dequeue({})}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <h1 className="font-display text-display-1 font-extrabold">Ranked 1v1</h1>
      <p className="text-body text-secondary">
        Both players start on {DUEL_STARTING_HP} HP. Whoever is slower on a song loses
        health equal to the gap — and the duel runs until someone hits zero. You each
        ban {VETO_BANS_PER_PLAYER} categories first, taking turns.
      </p>
      <Button size="lg" className="w-fit" onClick={() => void enqueue({})}>
        Find a match
      </Button>

      {/* Practice has its own route now — it is a mode, not a footnote on this page.
          The pointer stays because "I don't want a rated game right now" is a decision
          made here, at the moment you are looking at the queue. */}
      <Card className="mt-4 flex flex-col items-start gap-3 p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-body-lg font-semibold">Not feeling rated?</h2>
          <BotBadge />
        </div>
        <p className="text-body text-secondary">
          Practice is the same ban draft and health duel against a bot near your rating.{" "}
          <span className="text-paper font-medium">XP and badges count; rating does not.</span>
        </p>
        <ButtonLink variant="secondary" href="/practice">
          Practice a bot
        </ButtonLink>
      </Card>
    </div>
  );
}
