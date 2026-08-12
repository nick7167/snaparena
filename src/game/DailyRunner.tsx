"use client";

import { AnimatePresence, motion } from "motion/react";
import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { reducers } from "@/module_bindings";
import { useGuessFeedback, useMatchState, useMe, useMyRoundStatus } from "@/app/db";
import { useConfig } from "@/app/config";
import { track } from "@/analytics";
import { PHASE_DURATIONS_MS } from "@/engine/config";
import { play } from "@/audio/sfx";
import { tierForElapsed } from "@/engine/scoring";
import { useRoundAudio } from "./useRoundAudio";
import { useRoundLifecycle, rejectionMessage } from "./useRoundLifecycle";
import { Stage } from "./ui";
import { GuessingStage, SoloRevealStage } from "./stages";
import { useNow, usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useImmersive } from "@/app/immersive";
import { usePrefetchTrackIndex } from "./track-index";
import { LeaveMatch } from "./LeaveMatch";
import { MATCH_CHROME_HEIGHT, MatchChrome } from "./MatchChrome";
import { Meter } from "@/ui/Surface";
import { snap } from "@/ui/motion";

/**
 * The daily challenge: five songs, alone.
 *
 * A separate runner from the duel arena because the daily is a different game, not a
 * duel with one seat empty. Running it through `RoundRunner` gave a solo player a health
 * bar, an opponent column, "THE SONG WINS — neither of you got it" after every missed
 * round, and a DRAW verdict at 0 HP against nobody.
 *
 * What survives from the duel is the part that is genuinely the same — buffering, the
 * guess instrument, the round protocol — all shared rather than copied, so a fix to
 * either mode lands in both. What is gone is everything that needs a second player: no
 * VS reveal, no HP, no damage, no standings beat, no surrender, no winner.
 *
 * This is also the only mode a signed-out player can reach, hence the guest token on
 * every call.
 */
export function DailyRunner({ matchId }: { matchId: bigint }) {
  // Hides the app chrome for the duration. Clears on unmount, so finishing or
  // navigating away always restores the navigation — the daily used to have no way out
  // at all because nothing ever unmounted this.
  useImmersive();
  // Safety net for the resume-an-active-run path; the daily page warms this earlier.
  usePrefetchTrackIndex();

  const config = useConfig();
  const match = useMatchState(matchId, config);
  const myStatus = useMyRoundStatus(matchId);
  const submitGuess = useStdbReducer(reducers.submitGuess);
  const passRound = useStdbReducer(reducers.passRound);
  const viewer = useMe();
  const verdict = useGuessFeedback(matchId, viewer?.id);

  const phase = match?.phase ?? "guessing";
  const isGuessing = phase === "guessing";

  const audio = useRoundAudio(match?.currentAudioUrl ?? null);
  const [feedback, setFeedback] = useState<string | null>(null);

  /**
   * One event per song closed, carrying which song it was.
   *
   * The rate of finished runs was always derivable; WHERE people stop was not, and that is
   * the actionable half — a cliff at song 2 is a difficulty problem, a slow bleed across
   * all five is a length problem, and they need opposite fixes.
   *
   * Keyed on the reveal phase rather than `currentRound` advancing, because the last song
   * of a run never advances a round: it goes straight to complete, so counting transitions
   * would silently drop song five from every funnel.
   */
  const reported = useRef(-1);
  useEffect(() => {
    if (match?.phase !== "reveal") return;
    const round = match.currentRound;
    if (reported.current === round) return;
    reported.current = round;
    track("daily_round_complete", { round, solved: myStatus?.solved ?? false });
  }, [match?.phase, match?.currentRound, myStatus?.solved]);

  useRoundLifecycle({
    matchId,
    currentRound: match?.currentRound,
    phaseEndsAt: match?.phaseEndsAt,
    isGuessing,
    nextAudioUrl: match?.nextAudioUrl ?? null,
    audio,
    onRoundStart: () => setFeedback(null),
  });

  /**
   * Same shape, and same `catch`, as the duel's `onGuess` in RoundRunner.
   *
   * Both were uncaught `await`s, so a submission that failed to reach the server left the
   * typed text in place with no feedback and no indication anything had happened. It
   * matters at least as much here: the daily is one attempt per day, so a guess silently
   * lost to a dropped connection is not recoverable by playing again.
   */
  /** Narrowed to the number for the same reason as RoundRunner — see the note there. */
  const currentRound = match?.currentRound ?? 0;

  /** The elapsed time the guess claimed, so the verdict can be labelled. See RoundRunner. */
  const lastElapsedRef = useRef(0);

  const onGuess = useCallback(
    async (text: string) => {
      try {
        lastElapsedRef.current = audio.elapsedMs();
        await submitGuess({
          matchId,
          roundIndex: currentRound,
          text,
          clientElapsedMs: lastElapsedRef.current,
        });
        return { status: "sent" as const, keepText: false };
      } catch {
        setFeedback("That didn't send — try again");
        return { status: "error" as const, keepText: true };
      }
    },
    [submitGuess, matchId, currentRound, audio],
  );

  /**
   * The verdict, which arrives rather than being returned — the same mechanism the duel
   * uses, for the same reason. See the long note in RoundRunner.
   */
  const seenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!verdict) return;
    if (verdict.roundIndex !== currentRound) return;

    const key = `${verdict.roundIndex}:${verdict.outcome}:${verdict.points}:${verdict.rejectionReason ?? ""}`;
    if (seenRef.current === key) return;
    seenRef.current = key;

    if (verdict.outcome === "correct") {
      const tier = tierForElapsed(lastElapsedRef.current, config);
      play(tier.id === "snap" ? "snap" : "correct");
      setFeedback(`${tier.label} · +${Math.round(verdict.points)}`);
      audio.stop();
      return;
    }

    if (verdict.outcome === "wrong") {
      play("wrong");
      setFeedback("Not it");
      return;
    }

    setFeedback(rejectionMessage(verdict.rejectionReason ?? "unknown"));
  }, [verdict, currentRound, config, audio]);

  if (match === undefined) return <Centered>Loading…</Centered>;
  if (match === null) return <Centered>Run not found.</Centered>;

  if (match.status === "abandoned") {
    return <Centered>Run abandoned — not enough tracks in the catalogue.</Centered>;
  }

  // Solo, so there is exactly one row in each of these — but they are still keyed by
  // user id rather than taken at [0], because a guest and a signed-in player resolve
  // through different identities and only the id says which one this is.
  const me = match.scoreboard.find((entry) => entry.isMe);
  const myResult =
    match.roundResults.find((result) => me && result.userId === me.userId) ?? null;

  return (
    <div className="relative" style={{ ["--match-chrome" as string]: MATCH_CHROME_HEIGHT }}>
      {/* The run hides the app navigation, and until now offered nothing in its place —
          the only way out of a daily was the browser's back button.

          No `meta`, unlike the duel: `RunHeader` below already carries the song counter,
          the named tally and a progress meter. The duel's chrome took the round number
          because its header gave that row up; this one never did. */}
      <MatchChrome
        leave={<LeaveMatch mode="daily" matchId={matchId} live={phase !== "match_end"} />}
      />

      <RunHeader
        roundNumber={match.currentRound + 1}
        totalRounds={match.totalRounds}
        points={me?.totalPoints ?? 0}
        solved={me?.solved ?? 0}
      />

      <AnimatePresence mode="wait">
        {phase === "countdown" && (
          <SongCountdown
            key="countdown"
            endsAt={match.phaseEndsAt}
            roundNumber={match.currentRound + 1}
            totalRounds={match.totalRounds}
          />
        )}

        {phase === "guessing" && (
          <GuessingStage
            key={`guess-${match.currentRound}`}
            audio={audio}
            solved={myStatus?.solved ?? false}
            passed={me?.passedRound === match.currentRound}
            tierThisRound={null}
            pointsThisRound={myStatus?.pointsThisRound ?? 0}
            lockedUntil={
              myStatus?.lockedUntil === undefined
                ? 0
                : Number(myStatus.lockedUntil.microsSinceUnixEpoch / 1_000n)
            }
            feedback={feedback}
            onGuess={onGuess}
            onPass={() => {
              audio.stop();
              void passRound({
                matchId,
                roundIndex: match.currentRound,
              }).catch(() => setFeedback("Couldn't pass — try again"));
            }}
          />
        )}

        {phase === "reveal" && (
          <SoloRevealStage
            key={`reveal-${match.currentRound}`}
            track={match.currentTrack}
            result={
              myResult
                ? {
                    userId: String(myResult.userId),
                    solved: myResult.solved,
                    elapsedMs: myResult.elapsedMs,
                    points: myResult.points,
                  }
                : null
            }
            roundNumber={match.currentRound + 1}
            totalRounds={match.totalRounds}
          />
        )}

        {/* The run is over but `daily.complete` has not written the row yet. The page
            swaps to the results screen the moment it lands; this is the half-second in
            between, and it says so rather than showing a dead screen. */}
        {phase === "match_end" && (
          <Stage keyName="tallying" className="items-center py-20 text-center">
            <p className="font-display text-display-1 text-paper font-extrabold">
              RUN COMPLETE
            </p>
            <p className="text-body text-muted" role="status">
              Tallying your score…
            </p>
          </Stage>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Progress through the five, and the score so far.
 *
 * This is what replaces the duel's health bars. A solo run still needs to answer "how
 * far in am I" and "how am I doing" — it just answers them with progress and points
 * rather than with two draining bars.
 */
function RunHeader({
  roundNumber,
  totalRounds,
  points,
  solved,
}: {
  roundNumber: number;
  totalRounds: number;
  points: number;
  solved: number;
}) {
  return (
    <div className="border-line mx-auto flex w-full max-w-2xl flex-col gap-2.5 border-b px-4 py-3">
      <div className="text-body-sm flex items-center justify-between gap-3">
        <span className="text-secondary">
          Song <span className="text-paper font-semibold tabular-nums">{roundNumber}</span> of{" "}
          <span className="tabular-nums">{totalRounds}</span>
        </span>
        <span className="flex items-baseline gap-3">
          <span className="text-muted tabular-nums">
            {solved}/{totalRounds} named
          </span>
          <span className="font-display text-paper text-body-lg font-bold tabular-nums">
            {points}
            <span className="text-body-sm text-muted ml-1 font-normal">pts</span>
          </span>
        </span>
      </div>

      <Meter
        value={roundNumber - 1}
        max={totalRounds}
        height="sm"
        tone="paper"
        label={`Song ${roundNumber} of ${totalRounds}`}
      />
    </div>
  );
}

/**
 * Round intro.
 *
 * The duel's countdown reports HP leads and damage multipliers, none of which exist
 * here. This one just counts.
 */
function SongCountdown({
  endsAt,
  roundNumber,
  totalRounds,
}: {
  endsAt: number | null;
  roundNumber: number;
  totalRounds: number;
}) {
  const reduced = usePrefersReducedMotion();
  const now = useNow(80);
  const remaining = endsAt ? Math.max(0, endsAt - now) : PHASE_DURATIONS_MS.countdown;
  const seconds = Math.ceil(remaining / 1000);

  useEffect(() => {
    if (seconds > 0) play("tick");
    else play("go");
  }, [seconds]);

  return (
    <Stage keyName="countdown" className="items-center py-14">
      <p className="text-label text-muted font-semibold tracking-widest-label uppercase">
        Song {roundNumber} of {totalRounds}
      </p>

      <motion.div
        key={seconds}
        initial={reduced ? false : { scale: 1.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={snap}
        className="font-display text-display-hero text-paper font-extrabold tabular-nums"
      >
        {seconds > 0 ? seconds : "GO"}
      </motion.div>
    </Stage>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-body text-secondary flex min-h-[50vh] items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}
