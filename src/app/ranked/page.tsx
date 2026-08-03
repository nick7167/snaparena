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
import { formatGlobalRank, rankForElo } from "@/engine/ranks";
import { play } from "@/audio/sfx";
import { BotBadge } from "@/game/ui";
import { useNow } from "@/game/usePrefersReducedMotion";
import { Button, ButtonLink } from "@/ui/Button";
import { Card, Chip, Meter, SectionLabel, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";
import { Glyph } from "@/ui/Glyph";
import { AuthDialogButton } from "@/auth/AuthDialogButton";

/**
 * How long a player waits alone before ranked offers them a bot automatically.
 *
 * Long enough that a real opponent had a genuine chance to arrive; short enough that
 * walking away from an empty queue is not the outcome. The manual button is available
 * from the first second regardless — this is the safety net, not the front door.
 */
const BOT_FALLBACK_MS = 90_000;

/** How many recent results the form strip shows. */
const FORM_LENGTH = 5;

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
 * Your standing, and the button that changes it.
 *
 * This page used to open with a paragraph explaining the rules and then hand half its
 * space to a card advertising practice-a-bot — the competitive mode's front door mostly
 * selling the un-rated one. It leads with the rank now: where you are, how far to the next
 * division, how the last few matches went, and then the queue.
 *
 * Every figure here comes from a query that already existed. Nothing was added for it.
 */
function StandingHero() {
  const me = useQuery(api.users.me, {});
  const standing = useQuery(api.users.myStanding, {});

  if (me === undefined) {
    return <Skeleton className="h-56 w-full" />;
  }
  if (!me) return null;

  const rank = rankForElo(me.elo);
  const placing = me.placementsRemaining > 0;
  const position = formatGlobalRank(standing?.position, standing?.approximate);

  return (
    <section className="flex flex-col items-center gap-4 px-4 text-center">
      <RankEmblem
        tierId={rank.tier.id}
        division={rank.tier.divisions > 1 ? rank.division : 1}
        size="xl"
        unranked={placing}
        bloom={placing ? undefined : rank.tier.accent}
      />

      <div className="flex flex-col items-center gap-1">
        <h1
          className="font-display text-display-2 sm:text-display-1 font-extrabold tracking-tight"
          style={{ color: placing ? undefined : rank.tier.accent }}
        >
          {placing ? "Unranked" : rank.label}
        </h1>

        <p className="text-body-lg text-secondary flex flex-wrap items-center justify-center gap-x-2 tabular-nums">
          {!placing && <span className="text-paper font-bold">{me.elo}</span>}
          {!placing && position && (
            <>
              <span className="text-faint" aria-hidden="true">
                ·
              </span>
              <span>{position} global</span>
            </>
          )}
          {placing && (
            <span>
              {me.placementsRemaining} placement match
              {me.placementsRemaining === 1 ? "" : "es"} to go
            </span>
          )}
        </p>
      </div>

      <RankProgress elo={me.elo} placementsRemaining={me.placementsRemaining} />
    </section>
  );
}

/**
 * How far to the next division.
 *
 * `rankForElo` has computed `progress` and `nextAt` since the tier system shipped and
 * nothing in the app has ever rendered either one — the single most motivating number on
 * a ladder was being calculated and thrown away every time. During placements the same
 * bar measures matches played instead, so a new player still has something filling.
 */
function RankProgress({
  elo,
  placementsRemaining,
}: {
  elo: number;
  placementsRemaining: number;
}) {
  const rank = rankForElo(elo);

  if (placementsRemaining > 0) {
    const played = Math.max(0, 5 - placementsRemaining);
    return (
      <div className="flex w-full max-w-sm flex-col gap-1.5">
        <Meter
          value={played}
          max={5}
          tone="gold"
          height="sm"
          label={`${played} of 5 placement matches played`}
        />
        <p className="text-label text-muted tabular-nums">
          {played} of 5 placements played
        </p>
      </div>
    );
  }

  // Legend has no ceiling, so there is nothing to progress toward.
  if (rank.nextAt === null) {
    return (
      <p className="text-label text-gold tracking-[0.12em] uppercase">
        Top of the ladder
      </p>
    );
  }

  const remaining = Math.max(0, rank.nextAt - elo);
  const next = rankForElo(rank.nextAt);

  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <Meter
        value={rank.progress}
        max={1}
        tone="paper"
        height="sm"
        label={`${remaining} rating to ${next.label}`}
      />
      <p className="text-label text-muted tabular-nums">
        {remaining} to <span className="text-secondary font-semibold">{next.label}</span>
      </p>
    </div>
  );
}

/**
 * Recent form.
 *
 * Reads `matches.history`, which the profile already uses. A run of results is the thing
 * a competitive player checks before queueing — it answers "am I on a good day?" faster
 * than a rating that moves eighteen points at a time.
 */
function Form() {
  const me = useQuery(api.users.me, {});
  const matches = useQuery(api.matches.history, me ? { userId: me._id } : "skip");

  if (matches === undefined) return <Skeleton className="mx-4 h-10" />;

  /**
   * Rated matches only.
   *
   * `matches.history` returns practice alongside ranked, and a form strip built from all
   * of it is a lie on this page: practice moves no rating, so a run of practice losses
   * would show as terrible ranked form while your rating had not moved a point. The
   * recent list below still shows practice, because it is labelled there.
   */
  const rated = matches.filter((match) => match.mode !== "practice");
  if (rated.length === 0) return null;

  const recent = rated.slice(0, FORM_LENGTH);

  // Counted from the most recent backwards, stopping at the first result that breaks it.
  let streak = 0;
  for (const match of rated) {
    if (match.drawn || !match.won) break;
    streak += 1;
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4">
      <div className="flex items-center gap-2">
        <SectionLabel>Form</SectionLabel>
        <div className="flex items-center gap-1">
          {recent.map((match) => {
            const result = match.drawn ? "draw" : match.won ? "won" : "lost";
            return (
              <span
                key={match.matchId}
                title={result}
                className={`font-display flex size-6 items-center justify-center rounded-xs text-label font-bold ${
                  result === "won"
                    ? "bg-gold text-ink-900"
                    : result === "lost"
                      ? "bg-signal text-paper"
                      : "bg-ink-600 text-secondary"
                }`}
              >
                {result === "won" ? "W" : result === "lost" ? "L" : "D"}
              </span>
            );
          })}
        </div>
      </div>

      {streak >= 2 && (
        <Chip tone="gold" size="sm">
          <Glyph name="streak" />
          {streak} win streak
        </Chip>
      )}
    </div>
  );
}

/**
 * The last few rated matches, with the rating they moved.
 *
 * Same query and the same route as the profile's history list, so a result opens the real
 * results screen rather than a summary of it.
 */
function RecentMatches() {
  const me = useQuery(api.users.me, {});
  const matches = useQuery(api.matches.history, me ? { userId: me._id } : "skip");

  if (matches === undefined || matches.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 px-4">
      <SectionLabel>Recent</SectionLabel>
      <ul className="flex flex-col gap-1.5">
        {matches.slice(0, FORM_LENGTH).map((match) => {
          const result = match.drawn ? "draw" : match.won ? "won" : "lost";
          return (
            <li key={match.matchId}>
              <Link
                href={`/m/${match.matchId}${me ? `?p=${me._id}` : ""}`}
                className="border-line bg-ink-800 hover:bg-ink-700 flex items-center gap-3
                           rounded-md border px-3 py-2 transition-colors"
              >
                <span
                  aria-hidden
                  className={`flex size-7 shrink-0 items-center justify-center text-base ${
                    result === "won"
                      ? "text-gold"
                      : result === "lost"
                        ? "text-signal-text"
                        : "text-muted"
                  }`}
                >
                  <Glyph
                    name={result === "won" ? "win" : result === "lost" ? "loss" : "draw"}
                    filled={result === "won"}
                  />
                </span>

                <span className="text-body min-w-0 flex-1 truncate font-medium">
                  {match.opponent
                    ? match.opponent.isBot
                      ? match.opponent.displayName
                      : `@${match.opponent.handle}`
                    : "Unknown opponent"}
                </span>

                {match.mode === "practice" && (
                  <span className="text-label text-muted shrink-0">practice</span>
                )}

                {/* Zero is its own case, not a small win — a loss at the rating floor
                    reports a delta of 0 and colouring that gold would read as a gain. */}
                {match.ratingDelta !== null && (
                  <span
                    className={`text-body-sm shrink-0 font-semibold tabular-nums ${
                      match.ratingDelta > 0
                        ? "text-gold"
                        : match.ratingDelta < 0
                          ? "text-signal-text"
                          : "text-muted"
                    }`}
                  >
                    {match.ratingDelta > 0 ? "+" : ""}
                    {match.ratingDelta}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
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
    <div className="flex flex-col gap-7">
      <StandingHero />

      <Form />

      <div className="flex flex-col gap-2 px-4">
        <Button size="lg" block onClick={() => void enqueue({})}>
          <Glyph name="tier" filled />
          Find a match
        </Button>
        {/* The rules, compressed to one line and put under the button rather than above
            it. Someone who has played knows them; someone who has not can read them
            while the queue spins. */}
        <p className="text-label text-muted text-center">
          Both start on {DUEL_STARTING_HP} HP · ban {VETO_BANS_PER_PLAYER} categories each ·
          the slower player loses health equal to the gap
        </p>
      </div>

      <RecentMatches />

      {/* Practice, demoted. It used to be a card with its own heading and button, which
          gave the un-rated mode roughly equal billing on the ranked page. It is one
          sentence now — the route itself is untouched. */}
      <p className="text-body-sm text-muted px-4 text-center">
        Not feeling rated?{" "}
        <Link href="/practice" className="text-secondary hover:text-paper rounded-xs underline">
          Practice against a bot
        </Link>
        .
      </p>
    </div>
  );
}
