"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PHASE_DURATIONS_MS, REVEAL_BEATS } from "@/engine/config";
import { play } from "@/audio/sfx";
import { useRoundAudio } from "./useRoundAudio";
import { Visualizer } from "./Visualizer";
import { GuessInput } from "./GuessInput";
import { PhaseTimer, RankBadge, Stage, TierChip } from "./ui";
import {
  Countdown,
  RevealStage,
  SetBreak,
  StandingsStage,
  VsReveal,
  type PlayerCardData,
} from "./stages";
import { MatchEnd, type MatchEndPlayer } from "./MatchEnd";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Renders whatever phase the server says the match is in.
 *
 * The client never decides when a phase ends — that would drift between opponents
 * and ruin the head-to-head reveal. It only renders, and nudges the server if a
 * scheduled transition is overdue.
 */
export function RoundRunner({
  matchId,
  onPlayAgain,
}: {
  matchId: Id<"matches">;
  onPlayAgain?: () => void;
}) {
  const match = useQuery(api.matches.state, { matchId });
  const myStatus = useQuery(api.matches.myRoundStatus, { matchId });
  const submitGuess = useMutation(api.matches.submitGuess);
  const nudge = useMutation(api.phases.nudge);

  const phase = match?.phase ?? "guessing";
  const isGuessing = phase === "guessing";

  const audio = useRoundAudio(match?.currentAudioUrl ?? null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const startedRoundRef = useRef<string | null>(null);

  // Start playback exactly once per round, and only after the clip has buffered —
  // the local half of the barrier that stops anyone racing un-loaded audio.
  useEffect(() => {
    if (!isGuessing || !audio.ready) return;
    const key = `${matchId}:${match?.currentRound}`;
    if (startedRoundRef.current === key) return;

    startedRoundRef.current = key;
    setFeedback(null);
    void audio.start();
  }, [isGuessing, audio, matchId, match?.currentRound]);

  // Stop the audio the moment guessing closes, so the reveal isn't fighting it.
  useEffect(() => {
    if (!isGuessing) audio.stop();
  }, [isGuessing, audio]);

  // Recovery only: acts once a server deadline has genuinely passed, so it cannot
  // be used to rush an opponent.
  useEffect(() => {
    if (!match?.phaseEndsAt) return;
    const id = setInterval(() => {
      if (Date.now() > match.phaseEndsAt! + 1_500) void nudge({ matchId });
    }, 2_000);
    return () => clearInterval(id);
  }, [match?.phaseEndsAt, nudge, matchId]);

  const onGuess = useCallback(
    async (text: string) => {
      const result = await submitGuess({
        matchId,
        roundIndex: match?.currentRound ?? 0,
        text,
        clientElapsedMs: audio.elapsedMs(),
      });

      if (result.status === "correct") {
        play(result.tier === "snap" ? "snap" : "correct");
        setFeedback(`${result.tierLabel} · +${result.points}`);
        audio.stop();
      } else if (result.status === "wrong") {
        play("wrong");
        setFeedback("Not it");
      } else {
        setFeedback(rejectionMessage(result.reason));
      }
      return result;
    },
    [submitGuess, matchId, match?.currentRound, audio],
  );

  if (match === undefined) return <Centered>Loading…</Centered>;
  if (match === null) return <Centered>Match not found.</Centered>;

  const players: PlayerCardData[] = match.scoreboard.map((entry) => ({
    userId: String(entry.userId),
    displayName: entry.displayName ?? "Player",
    handle: entry.handle ?? "",
    avatarUrl: entry.avatarUrl,
    elo: entry.elo ?? 0,
    rankLabel: entry.rankLabel ?? "",
    rankAccent: entry.rankAccent ?? "#888",
    placementsRemaining: entry.placementsRemaining ?? 0,
    level: entry.level ?? 1,
    wins: entry.wins ?? 0,
    losses: entry.losses ?? 0,
    bestCategory: entry.bestCategory ?? null,
    badges: entry.badges ?? [],
    globalRank: entry.globalRank ?? null,
    isMe: entry.isMe,
  }));

  const me = players.find((player) => player.isMe);
  const opponent = players.find((player) => !player.isMe);

  if (match.status === "abandoned") {
    return <Centered>Match abandoned — not enough tracks in the catalogue.</Centered>;
  }

  return (
    <div className="relative">
      <MatchHeader match={match} opponent={opponent} />

      <AnimatePresence mode="wait">
        {phase === "vs_reveal" && me && opponent && (
          <VsReveal key="vs" me={me} opponent={opponent} matchup={match.matchup} />
        )}

        {phase === "countdown" && <Countdown key="countdown" endsAt={match.phaseEndsAt} />}

        {phase === "guessing" && (
          <GuessingStage
            key={`guess-${match.currentRound}`}
            audio={audio}
            match={match}
            solved={myStatus?.solved ?? false}
            tierThisRound={myStatus?.tierThisRound ?? null}
            pointsThisRound={myStatus?.pointsThisRound ?? 0}
            lockedUntil={myStatus?.lockedUntil ?? 0}
            feedback={feedback}
            onGuess={onGuess}
          />
        )}

        {phase === "reveal" && (
          <RevealStage
            key={`reveal-${match.currentRound}`}
            track={match.currentTrack}
            results={match.roundResults.map((result) => ({
              ...result,
              userId: String(result.userId),
            }))}
            players={players}
          />
        )}

        {phase === "standings" && (
          <StandingsStage
            key={`standings-${match.currentRound}`}
            players={players}
            scores={Object.fromEntries(
              match.scoreboard.map((entry) => [String(entry.userId), entry.totalPoints]),
            )}
            setsWon={Object.fromEntries(
              match.scoreboard.map((entry) => [String(entry.userId), entry.setsWon]),
            )}
          />
        )}

        {phase === "set_break" && (
          <SetBreak
            key={`set-${match.setResults.length}`}
            setIndex={match.setResults.length - 1}
            winnerName={
              players.find(
                (player) =>
                  player.userId === String(match.setResults.at(-1)?.winnerId ?? ""),
              )?.displayName ?? null
            }
            decidedOnTime={match.setResults.at(-1)?.decidedOnTime ?? false}
            setsWon={Object.fromEntries(
              match.scoreboard.map((entry) => [String(entry.userId), entry.setsWon]),
            )}
            players={players}
          />
        )}

        {phase === "match_end" && (
          <MatchEnd
            key="end"
            mode={match.mode}
            winnerId={match.winnerId ? String(match.winnerId) : null}
            onPlayAgain={onPlayAgain}
            players={match.scoreboard.map((entry, index) => ({
              ...players[index],
              totalPoints: entry.totalPoints,
              setsWon: entry.setsWon,
              ratingBefore: entry.ratingBefore,
              ratingAfter: entry.ratingAfter,
              ratingDelta: entry.ratingDelta,
              xpEarned: entry.xpEarned,
              badgesEarned: entry.badgesEarned,
              forfeited: entry.forfeited,
            })) as MatchEndPlayer[]}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Keeps the opponent present throughout, so you never forget who you're racing. */
function MatchHeader({
  match,
  opponent,
}: {
  match: NonNullable<ReturnType<typeof useQuery<typeof api.matches.state>>>;
  opponent: PlayerCardData | undefined;
}) {
  if (match.phase === "vs_reveal" || match.phase === "match_end") return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 text-sm">
      <span className="text-white/50">
        {match.suddenDeath ? (
          <span className="font-bold text-rose-400">SUDDEN DEATH</span>
        ) : (
          <>
            Set {(match.currentSet ?? 0) + 1} · Song{" "}
            {(match.currentRound % match.songsPerSet) + 1}/{match.songsPerSet}
          </>
        )}
      </span>

      {opponent && (
        <span className="flex items-center gap-2 text-white/60">
          vs {opponent.displayName}
          <RankBadge
            label={opponent.rankLabel}
            accent={opponent.rankAccent}
            placements={opponent.placementsRemaining}
            size="sm"
          />
        </span>
      )}
    </div>
  );
}

function GuessingStage({
  audio,
  match,
  solved,
  tierThisRound,
  pointsThisRound,
  lockedUntil,
  feedback,
  onGuess,
}: {
  audio: ReturnType<typeof useRoundAudio>;
  match: NonNullable<ReturnType<typeof useQuery<typeof api.matches.state>>>;
  solved: boolean;
  tierThisRound: string | null;
  pointsThisRound: number;
  lockedUntil: number;
  feedback: string | null;
  onGuess: (text: string) => Promise<{ status: string }>;
}) {
  const reduced = usePrefersReducedMotion();
  const beat = REVEAL_BEATS[audio.revealStage];

  if (audio.error === "audio-unavailable") {
    return (
      <Stage keyName="audio-error" className="items-center py-16">
        <p>This track&rsquo;s audio failed to load — the round will be skipped.</p>
      </Stage>
    );
  }

  return (
    <Stage keyName="guessing" className="py-6">
      <Visualizer analyser={audio.analyser} active={audio.phase === "playing"} />

      <div className="flex items-center justify-between text-xs text-white/40">
        <span>{beat.playToMs / 1000}s of the song unlocked</span>
        <span className="tabular-nums">
          {Math.max(0, (30_000 - audio.displayMs) / 1000).toFixed(1)}s
        </span>
      </div>

      <PhaseTimer endsAt={match.phaseEndsAt} durationMs={PHASE_DURATIONS_MS.guessing} />

      {!audio.ready && (
        <p className="text-center text-sm text-white/40">Buffering audio…</p>
      )}

      {solved ? (
        <motion.div
          initial={reduced ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-2 py-4"
        >
          {tierThisRound && <TierChip tierId={tierThisRound} />}
          <p className="text-2xl font-bold text-emerald-400">+{pointsThisRound}</p>
          <p className="text-sm text-white/40">Waiting for the round to end…</p>
        </motion.div>
      ) : (
        <GuessInput
          onGuess={onGuess}
          disabled={!audio.ready || audio.phase === "ended"}
          lockedUntil={lockedUntil}
          suppressSuggestions={audio.revealStage === 0}
        />
      )}

      {feedback && (
        <motion.p
          key={feedback}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-white/70"
        >
          {feedback}
        </motion.p>
      )}
    </Stage>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}

function rejectionMessage(reason: string): string {
  switch (reason) {
    case "locked-out":
      return "Too fast — wait for the lockout";
    case "already-solved":
      return "You already got this one";
    case "too-many-attempts":
      return "No attempts left this round";
    case "not-guessing-phase":
      return "The round has closed";
    case "below-human-floor":
    case "exceeds-server-window":
    case "not-monotonic":
      return "Rejected by the timing check";
    case "stale-round":
      return "The round moved on";
    default:
      return "Guess rejected";
  }
}
