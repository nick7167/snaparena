"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { track } from "@/analytics";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { TierChip } from "./ui";
import { tierForElapsed } from "@/engine/scoring";
import type { ScoreTierId } from "@/engine/config";
import { AuthDialogButton } from "@/auth/AuthDialogButton";

/** A capability cannot change mid-session, so there is nothing to subscribe to. */
const NEVER_CHANGES = () => () => {};

/**
 * One square per scoring tier, so the shared grid says the same thing the screen does.
 *
 * This screen used to grade the same five rounds on THREE disagreeing scales: the row
 * chips against local literals that silently copied REVEAL_BEATS, the share emoji against
 * 2s/8s thresholds that matched nothing at all, and the points against SCORE_TIERS on the
 * server. A player reading 🟨 beside a QUICK chip beside +55 was looking at three
 * different opinions about one guess. Everything derives from `tierForElapsed` now.
 */
const SHARE_SQUARE: Record<ScoreTierId, string> = {
  snap: "🟩",
  quick: "🟨",
  solid: "🟧",
  late: "🟥",
};

/**
 * The daily results screen.
 *
 * Solo, so there is nothing here that needs an opponent. The duel's results screen was
 * being used for this and reported a DRAW at 0 HP, a round-by-round damage timeline and
 * a "costliest round" — all of it meaningless for one player, and the whole screen was
 * a dead end besides, because the arena hides the app navigation and nothing here ever
 * gave it back.
 *
 * What a daily player actually wants to know, in order: what did I score, how fast was
 * I on each song, where does that put me, and can I show someone. Then a way out.
 *
 * Deliberately does NOT list the tracks. Each song is revealed during the run, at the
 * moment it lands, which is where "oh, it's THAT song" belongs — repeating the list here
 * would spend the same payoff twice.
 */
export function DailyResult({
  run,
}: {
  run: {
    totalPoints: number;
    perRoundMs: number[];
    perRoundPoints: number[];
    rank: number;
    totalPlayers: number;
    isGuest?: boolean;
    /** Null for guests, and until progression has settled. */
    xpEarned?: number | null;
  };
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * "Copied" used to latch for the rest of the session, so a second attempt confirmed
   * nothing — the button already said it had worked. Same two-second reset as RoomCode.
   */
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  /**
   * Does this platform have a share sheet?
   *
   * `navigator.share` does not exist on the server, so testing it during render would
   * produce a different tree than the HTML the server sent — a hydration mismatch, which
   * `sweep.spec.ts` fails the whole route for. Read through `useSyncExternalStore` with a
   * `false` server snapshot, which is exactly the shape this is for: the capability never
   * changes, so the subscribe function has nothing to do. Same pattern as the mute store.
   */
  const canShare = useSyncExternalStore(
    NEVER_CHANGES,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  const solved = run.perRoundMs.filter((ms) => ms >= 0).length;

  // Times, not tiers: with continuous scoring there is no "I got it in the 1s tier"
  // to brag about, so the shareable unit is how fast you were. The URL is on the
  // share because a result someone can't act on is just a boast.
  const shareText = [
    `SNAP — ${run.totalPoints} pts`,
    run.perRoundMs
      .map((ms) => (ms < 0 ? "⬜" : SHARE_SQUARE[tierForElapsed(ms).id]))
      .join(""),
    `#${run.rank} of ${run.totalPlayers}`,
    typeof window === "undefined" ? "" : `${window.location.origin}/daily`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="flex flex-col items-start gap-4 p-6">
        <div className="flex w-full items-end justify-between gap-4">
          <div className="flex flex-col">
            <p className="font-display text-display-1 font-extrabold tabular-nums">
              {run.totalPoints}
              <span className="text-body text-muted ml-2 font-normal">points</span>
            </p>
            <p className="text-body text-secondary tabular-nums">
              Rank {run.rank} of {run.totalPlayers} today
            </p>
          </div>
          <p className="text-body-sm text-muted shrink-0 tabular-nums">
            {solved}/{run.perRoundMs.length} named
          </p>
        </div>

        {/* Per-song times. The tier chip is what makes a row worth reading — 1.8s and
            7.9s are both "under eight seconds" and feel nothing alike. */}
        <ul className="border-line flex w-full flex-col gap-1.5 border-t pt-4">
          {run.perRoundMs.map((ms, index) => (
            <li key={index} className="text-body flex items-center justify-between gap-3">
              <span className="text-muted tabular-nums">Song {index + 1}</span>
              {ms < 0 ? (
                <span className="text-muted">missed</span>
              ) : (
                <span className="flex items-center gap-3">
                  <TierChip tierId={tierForElapsed(ms).id} size="sm" />
                  <span className="font-display text-secondary font-bold tabular-nums">
                    {(ms / 1000).toFixed(2)}s
                  </span>
                  <span className="font-display text-paper w-12 text-right font-bold tabular-nums">
                    +{run.perRoundPoints[index] ?? 0}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* One quiet line. The daily pays XP, but the level bar lives in the sidebar —
            a full progress panel here would compete with the score for attention.
            The real awarded figure, not the base rate: correct guesses and snap calls
            are both in there, so a printed constant would usually be wrong. */}
        {typeof run.xpEarned === "number" && (
          <p className="text-body-sm text-gold tabular-nums">+{run.xpEarned} XP</p>
        )}

        {/*
         * Two controls, because they are two different acts.
         *
         * Share is where this result actually wants to go — the daily is played on a phone
         * and the reason to finish it is to send the grid to someone. It appears only when
         * the platform has `navigator.share`, so it is absent on desktop rather than a
         * button that does nothing.
         *
         * Copy keeps its exact label: `guest-daily.spec.ts` finds this button by the name
         * "Copy result", and it is the only path on a desktop or an insecure origin.
         */}
        <div className="flex flex-wrap items-center gap-2">
          {canShare && (
            <Button
              onClick={async () => {
                try {
                  await navigator.share({ text: shareText });
                } catch {
                  // A dismissed share sheet rejects. That is a decision, not a failure.
                }
              }}
            >
              <Glyph name="song" />
              Share
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={async () => {
              /**
               * `writeText` rejects on an insecure origin and under a denied clipboard
               * permission. The rejection was already caught — but the catch set `copied`
               * to the value it already held, so the screen did not change and the player
               * had no idea it had failed.
               *
               * That matters more here than almost anywhere: `Share` only renders where
               * `navigator.share` exists, so on a desktop this button is the ONLY route to
               * the grid the whole run was played to produce.
               *
               * Same shape as RoomCode in rooms/[code]/page.tsx, which got this right.
               */
              try {
                await navigator.clipboard.writeText(shareText);
                setCopied(true);
                setFailed(false);
              } catch {
                setFailed(true);
              }
            }}
          >
            {copied
              ? "Copied"
              : failed
                ? "Copy failed — select the text above"
                : "Copy result"}
          </Button>
        </div>

        <p className="text-body-sm text-muted">Come back tomorrow for a new set.</p>
      </Card>

      {run.isGuest && <SaveScore run={run} />}

      {/* The way out. The run hides the app navigation, so without these the daily was
          a room with no door — which is exactly how it was reported. */}
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/" variant="secondary">
          Home
        </ButtonLink>
        <ButtonLink href="/leaderboard" variant="secondary">
          Leaderboard
        </ButtonLink>
        <ButtonLink href="/ranked" variant="secondary">
          <Glyph name="rank" />
          Play ranked
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * The conversion moment.
 *
 * This existed as four quiet lines at the foot of the score card, below the share button,
 * where it read as a footnote on a screen that had already ended. It is its own panel now,
 * directly beneath the score and above the way out, because it is the most valuable thing
 * on this screen: a stranger who just had a good time and has something to lose.
 *
 * The score is restated rather than referred to. "This score" is abstract; "284 points,
 * 12th today" is the thing they are about to throw away, and naming it is the argument.
 */
function SaveScore({
  run,
}: {
  run: { totalPoints: number; rank: number; totalPlayers: number };
}) {
  /**
   * The denominator, fired on mount.
   *
   * `save_score_clicked / save_score_shown` is the conversion rate of the single most
   * valuable screen in the product, and neither half of that fraction existed before. It
   * carries the score because the panel's own argument is built on it — if the pitch only
   * works for players who did well, that is worth being able to see.
   */
  useEffect(() => {
    track("save_score_shown", { points: run.totalPoints, rank: run.rank });
  }, [run.totalPoints, run.rank]);

  return (
    <Card variant="hero" className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        {/* Flex with an explicit gap, not a text space: `Glyph` is an inline-block sized
            in `em`, so it sat hard against the "Y" and read as "▲You're". */}
        <p className="font-display text-body-lg text-paper flex items-center gap-2 font-bold">
          <Glyph name="win" filled />
          You&rsquo;re not on the board yet
        </p>
        <p className="text-body text-secondary tabular-nums">
          <span className="text-paper font-semibold">{run.totalPoints} points</span>, good
          for {ordinal(run.rank)} of {run.totalPlayers} today — and it disappears when you
          clear this browser.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {/* `mode` rides along because the two buttons answer different questions: one is
            acquisition, the other is a returning player who happened to play signed out. */}
        <AuthDialogButton
          mode="sign-up"
          size="lg"
          className="flex-1"
          redirectTo="/daily"
          onOpen={() => track("save_score_clicked", { mode: "sign-up" })}
        >
          Save my score
        </AuthDialogButton>
        <AuthDialogButton
          mode="sign-in"
          variant="secondary"
          size="lg"
          className="flex-1"
          redirectTo="/daily"
          onOpen={() => track("save_score_clicked", { mode: "sign-in" })}
        >
          I already have an account
        </AuthDialogButton>
      </div>

      <p className="text-body-sm text-muted">
        This run comes with you either way — your name, this score, today&rsquo;s board.
      </p>
    </Card>
  );
}

/** 1st, 2nd, 3rd, 4th — including the 11th/12th/13th exceptions. */
function ordinal(value: number): string {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}

/** Local mirror of the tier thresholds for display. Scores still come from the server. */
