"use client";

import { SignInButton } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "../auth-gate";
import { motion } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { RoundRunner } from "@/game/RoundRunner";
import { DUEL_STARTING_HP, VETO_BANS_PER_PLAYER, VETO_PHASE_MS } from "@/engine/config";
import { play } from "@/audio/sfx";
import { Avatar, BotBadge, PhaseTimer, nameFor } from "@/game/ui";
import { useNow } from "@/game/usePrefersReducedMotion";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Surface";

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
          <SignInButton mode="modal">
            <Button size="lg">Sign in</Button>
          </SignInButton>
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
    <RankedMatch matchId={matchId} onLeave={() => setMatchId(null)} />
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

      <PracticeCard onStarted={onMatched} />
    </div>
  );
}

/**
 * Practice against a bot.
 *
 * Kept strictly separate from ranked so nobody is ever surprised by a synthetic
 * opponent in a rated match — the trade is stated up front, and you choose it.
 */
function PracticeCard({ onStarted }: { onStarted: (id: Id<"matches">) => void }) {
  const startPractice = useMutation(api.bots.startPractice);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  return (
    <Card className="mt-4 flex flex-col items-start gap-3 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-body-lg font-semibold">Practice</h2>
        <BotBadge />
      </div>
      <p className="text-body text-secondary">
        No queue — a bot near your rating, right now. Same ban draft and health duel as
        ranked. <span className="text-paper font-medium">XP and badges count; rating does not.</span>
      </p>
      <Button
        variant="secondary"
        loading={starting}
        onClick={async () => {
          setStarting(true);
          setError(null);
          const result = await startPractice({});
          if (result.status === "started" && result.matchId) {
            play("whoosh");
            onStarted(result.matchId);
          } else {
            setError(
              result.status === "no-bots-seeded"
                ? "No bots seeded yet — run `npm run seed-bots`."
                : "Not enough tracks in the catalogue.",
            );
            setStarting(false);
          }
        }}
      >
        Play a bot
      </Button>
      {error && (
        <p className="text-body-sm text-signal-text" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

function RankedMatch({ matchId, onLeave }: { matchId: Id<"matches">; onLeave: () => void }) {
  const match = useQuery(api.matches.state, { matchId });
  const heartbeat = useMutation(api.ranked.heartbeat);
  const claimForfeit = useMutation(api.ranked.claimForfeit);

  // Presence: silence past the grace period forfeits, which is what stops a losing
  // player from simply closing the tab.
  useEffect(() => {
    const id = setInterval(() => {
      void heartbeat({ matchId });
      void claimForfeit({ matchId });
    }, 5000);
    return () => clearInterval(id);
  }, [matchId, heartbeat, claimForfeit]);

  if (!match) return <p className="text-body text-muted px-4">Loading…</p>;

  return (
    <>
      <DevResolveBar matchId={matchId} />
      {match.phase === "veto" ? (
        <VetoPhase matchId={matchId} />
      ) : (
        <RoundRunner matchId={matchId} onPlayAgain={onLeave} />
      )}
    </>
  );
}

/**
 * DEV ONLY — delete with convex/devbots.ts.
 *
 * A duel runs nine to twelve songs, so clearing five placement matches is the better
 * part of an hour. This ends the current one instantly through the real `finishMatch`
 * path, so rating, placements, XP, badges and the results screen all behave exactly as
 * if it had been played out.
 *
 * Renders nothing at all unless DEV_RANK_BOTS is set on the Convex deployment — the flag
 * is read from the server rather than a NEXT_PUBLIC_ variable, so there is nothing to
 * keep in sync with Vercel.
 */
function DevResolveBar({ matchId }: { matchId: Id<"matches"> }) {
  const dev = useQuery(api.devbots.enabled, {});
  const resolveNow = useMutation(api.devbots.resolveNow);

  if (!dev?.enabled) return null;

  return (
    // Top right, clear of the guess combobox and the HP bars — this is a scaffold, and a
    // scaffold that covers the thing you are testing is worse than no scaffold.
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full border border-dashed border-white/25 bg-black/80 px-3 py-2 backdrop-blur">
      <span className="text-body-sm text-muted px-1 font-mono uppercase">dev</span>
      {(["win", "loss", "random"] as const).map((outcome) => (
        <Button
          key={outcome}
          variant="secondary"
          size="sm"
          onClick={() => void resolveNow({ matchId, outcome })}
        >
          {outcome === "win" ? "Win" : outcome === "loss" ? "Lose" : "Random"}
        </Button>
      ))}
    </div>
  );
}

/**
 * Turn-based ban draft.
 *
 * Alternating rather than simultaneous, so each ban is a read on your opponent.
 * The lower-rated player bans first.
 */
function VetoPhase({ matchId }: { matchId: Id<"matches"> }) {
  const draft = useQuery(api.ranked.draftState, { matchId });
  const submitBan = useMutation(api.ranked.submitBan);
  const expireVeto = useMutation(api.ranked.expireVeto);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  // Someone has to close the phase if a player idles; the client drives it.
  useEffect(() => {
    const id = setInterval(() => void expireVeto({ matchId }), 2000);
    return () => clearInterval(id);
  }, [matchId, expireVeto]);

  if (!draft) return <p className="text-body text-muted px-4">Loading draft…</p>;

  const opponentName = draft.opponent ? nameFor(draft.opponent) : "Opponent";

  async function ban(categoryId: Id<"categories">) {
    setPlacing(true);
    setError(null);
    try {
      // Awaited BEFORE any optimistic UI change. Flipping state first is what left
      // the old build stuck on "Waiting for opponent…" with the error invisible.
      await submitBan({ matchId, categoryId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not place that ban");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {!draft.isMyTurn && draft.opponent && (
            <Avatar url={draft.opponent.avatarUrl} name={opponentName} className="h-8 w-8" />
          )}
          <h1 className="font-display text-display-2 truncate font-extrabold">
            {draft.isMyTurn ? "Ban a category" : `${opponentName} is banning…`}
          </h1>
          {!draft.isMyTurn && draft.opponent?.isBot && <BotBadge />}
        </div>
        <span className="font-display text-body text-secondary shrink-0 font-bold tabular-nums">
          {draft.bansPlaced}/{draft.totalBans}
        </span>
      </div>

      {/* The turn clock, so "their turn ends automatically" is something you can
          watch rather than something we promise. */}
      <PhaseTimer endsAt={draft.deadline} durationMs={VETO_PHASE_MS} />

      <p className="text-body text-secondary">
        {draft.isMyTurn
          ? "Take away something they are good at. Whatever survives is what you both play."
          : "Watch what they take — you ban next."}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {draft.pool.map((category) => {
          const banned = category.banned;
          return (
            <motion.button
              key={category.id}
              whileTap={draft.isMyTurn && !banned ? { scale: 0.95 } : undefined}
              onClick={() => {
                play("wrong");
                void ban(category.id);
              }}
              disabled={!draft.isMyTurn || banned || placing}
              className={`text-body min-h-16 rounded-md border px-3 py-4 font-medium
                          transition-colors disabled:cursor-not-allowed ${
                            banned
                              ? "border-signal bg-ink-700 text-muted line-through"
                              : draft.isMyTurn
                                ? "border-line-strong bg-ink-700 hover:bg-ink-600 text-paper"
                                : "border-line text-muted"
                          }`}
            >
              {category.name}
            </motion.button>
          );
        })}
      </div>

      {error && (
        <p className="text-body-sm text-signal-text" role="alert">
          {error}
        </p>
      )}

      {!draft.isMyTurn && (
        <p className="text-body-sm text-muted">
          Their turn ends automatically if they take too long.
        </p>
      )}

      {draft.opponent?.isBot && (
        <p className="text-body-sm text-muted">
          Bots draft too — they take away the categories they are worst at.
        </p>
      )}
    </div>
  );
}
