"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { PHASE_DURATIONS_MS } from "@/engine/config";
import { play } from "@/audio/sfx";
import { BadgeRow, RankBadge, Stage, TierChip } from "./ui";
import { useNow, usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * The between-round beats. These exist because the drama lives in the gaps: a match
 * that cuts straight from one song to the next reads as a blur rather than a contest.
 */

export interface PlayerCardData {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  elo: number;
  rankLabel: string;
  rankAccent: string;
  placementsRemaining: number;
  level: number;
  wins: number;
  losses: number;
  bestCategory: string | null;
  badges: { id: string; name: string; emoji: string }[];
  globalRank: number | null;
  isMe?: boolean;
}

/**
 * Opponent reveal.
 *
 * Deliberately shows no projected rating swing — spending that number before the
 * match spends the reward before it is earned. The delta lands on the results
 * screen instead. The matchup label is qualitative framing over ratings both
 * players can already see.
 */
export function VsReveal({
  me,
  opponent,
  matchup,
}: {
  me: PlayerCardData;
  opponent: PlayerCardData;
  matchup: string | null;
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("whoosh");
  }, []);

  const slam = (fromX: number) =>
    reduced
      ? { initial: false as const, animate: { opacity: 1, x: 0 } }
      : {
          initial: { opacity: 0, x: fromX, scale: 0.85 },
          animate: { opacity: 1, x: 0, scale: 1 },
        };

  return (
    <Stage keyName="vs" className="py-10 text-center">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <motion.div {...slam(-120)} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
          <VsCard player={me} />
        </motion.div>

        <motion.div
          initial={reduced ? false : { scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 14 }}
          className="text-3xl font-black italic text-fuchsia-400 sm:text-5xl"
        >
          VS
        </motion.div>

        <motion.div {...slam(120)} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
          <VsCard player={opponent} />
        </motion.div>
      </div>

      {opponent.globalRank !== null && (
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm font-semibold tracking-wide text-amber-300"
        >
          ⚑ #{opponent.globalRank} GLOBAL
        </motion.p>
      )}

      {matchup && (
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="text-lg font-bold tracking-[0.2em] text-white/70"
        >
          {matchup}
        </motion.p>
      )}
    </Stage>
  );
}

function VsCard({ player }: { player: PlayerCardData }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={player.avatarUrl ?? "/avatar-fallback.svg"}
        alt=""
        className="h-14 w-14 rounded-full bg-white/10 object-cover sm:h-20 sm:w-20"
      />
      <p className="max-w-full truncate text-sm font-semibold sm:text-base">
        {player.displayName}
      </p>
      <RankBadge
        label={player.rankLabel}
        accent={player.rankAccent}
        placements={player.placementsRemaining}
        size="sm"
      />
      <div className="flex gap-3 text-xs text-white/50">
        <span className="tabular-nums">{player.elo}</span>
        <span>L{player.level}</span>
      </div>
      <div className="text-xs tabular-nums text-white/40">
        {player.wins}W · {player.losses}L
      </div>
      <BadgeRow badges={player.badges} max={5} />
      {player.bestCategory && (
        <p className="text-[11px] text-white/40">best: {player.bestCategory}</p>
      )}
    </div>
  );
}

/** "3 · 2 · 1" over a rising tick. */
export function Countdown({ endsAt }: { endsAt: number | null }) {
  const reduced = usePrefersReducedMotion();
  // Same reasoning as PhaseTimer: tick the clock into state rather than reading
  // Date.now() during render or syncing it inside an effect body.
  const now = useNow(80);
  const remaining = endsAt ? Math.max(0, endsAt - now) : PHASE_DURATIONS_MS.countdown;
  const seconds = Math.ceil(remaining / 1000);

  useEffect(() => {
    if (seconds > 0) play("tick");
    else play("go");
  }, [seconds]);

  return (
    <Stage keyName="countdown" className="items-center py-20">
      <motion.div
        key={seconds}
        initial={reduced ? false : { scale: 1.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 20 }}
        className="text-7xl font-black tabular-nums text-cyan-300"
      >
        {seconds > 0 ? seconds : "GO"}
      </motion.div>
      <p className="text-sm uppercase tracking-[0.3em] text-white/40">Get ready</p>
    </Stage>
  );
}

export interface RoundResultEntry {
  userId: string;
  solved: boolean;
  elapsedMs: number | null;
  points: number;
}

/**
 * The reveal. This is the payoff the old build buried in an end-of-match list —
 * "OH, it's THAT song" is the single best moment in a music game.
 */
export function RevealStage({
  track,
  results,
  players,
}: {
  track: { title: string; artist: string; artworkUrl: string } | null;
  results: RoundResultEntry[];
  players: PlayerCardData[];
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("reveal");
  }, []);

  if (!track) return null;

  return (
    <Stage keyName="reveal" className="items-center py-10 text-center">
      <motion.img
        src={track.artworkUrl}
        alt=""
        initial={reduced ? false : { scale: 0.5, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
        className="h-40 w-40 rounded-xl shadow-2xl shadow-fuchsia-500/20 sm:h-52 sm:w-52"
      />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-2xl font-bold sm:text-3xl">{track.title}</h2>
        <p className="text-white/50">{track.artist}</p>
      </motion.div>

      <div className="flex w-full flex-col gap-2">
        {results.map((result) => {
          const player = players.find((candidate) => candidate.userId === result.userId);
          return (
            <div
              key={result.userId}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
            >
              <span className={player?.isMe ? "font-semibold text-cyan-300" : ""}>
                {player?.displayName ?? "Player"}
              </span>
              <span className="flex items-center gap-3">
                {result.solved && result.elapsedMs !== null ? (
                  <>
                    <span className="tabular-nums text-white/60">
                      {(result.elapsedMs / 1000).toFixed(2)}s
                    </span>
                    <TierChip tierId={tierIdFor(result.elapsedMs)} size="sm" />
                    <span className="w-10 text-right tabular-nums font-semibold">
                      +{result.points}
                    </span>
                  </>
                ) : (
                  <span className="text-white/30">missed</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Stage>
  );
}

/** Local mirror of the tier thresholds for display. Scores still come from the server. */
function tierIdFor(elapsedMs: number): string {
  if (elapsedMs < 7_000) return "snap";
  if (elapsedMs < 15_000) return "quick";
  if (elapsedMs < 23_000) return "solid";
  return "late";
}

/** Animated standings, so a lead change is something you watch happen. */
export function StandingsStage({
  players,
  scores,
  setsWon,
}: {
  players: PlayerCardData[];
  scores: Record<string, number>;
  setsWon: Record<string, number>;
}) {
  const max = Math.max(1, ...Object.values(scores));
  const ordered = [...players].sort(
    (a, b) => (scores[b.userId] ?? 0) - (scores[a.userId] ?? 0),
  );

  return (
    <Stage keyName="standings" className="py-14">
      <h2 className="text-center text-sm uppercase tracking-[0.3em] text-white/40">
        Standings
      </h2>

      <div className="flex flex-col gap-3">
        {ordered.map((player) => (
          <motion.div
            key={player.userId}
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex flex-col gap-1"
          >
            <div className="flex justify-between text-sm">
              <span className={player.isMe ? "font-semibold text-cyan-300" : ""}>
                {player.displayName}
                {(setsWon[player.userId] ?? 0) > 0 && (
                  <span className="ml-2 text-amber-300">
                    {"●".repeat(setsWon[player.userId] ?? 0)}
                  </span>
                )}
              </span>
              <span className="tabular-nums">{scores[player.userId] ?? 0}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500"
                initial={{ width: 0 }}
                animate={{ width: `${((scores[player.userId] ?? 0) / max) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </Stage>
  );
}

/** Set podium — the moment that makes best-of-3 feel like a series rather than a list. */
export function SetBreak({
  setIndex,
  winnerName,
  decidedOnTime,
  setsWon,
  players,
}: {
  setIndex: number;
  winnerName: string | null;
  decidedOnTime: boolean;
  setsWon: Record<string, number>;
  players: PlayerCardData[];
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("podium");
  }, []);

  return (
    <Stage keyName={`set-${setIndex}`} className="items-center py-16 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-white/40">
        Set {setIndex + 1} complete
      </p>

      <motion.h2
        initial={reduced ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="text-3xl font-black text-amber-300"
      >
        {winnerName ? `${winnerName} takes it` : "Set drawn"}
      </motion.h2>

      {decidedOnTime && (
        <p className="text-xs text-white/40">Decided on reaction time</p>
      )}

      <div className="flex gap-6">
        {players.map((player) => (
          <div key={player.userId} className="flex flex-col items-center gap-1">
            <span className="text-sm text-white/70">{player.displayName}</span>
            <span className="text-2xl font-bold tabular-nums text-white">
              {setsWon[player.userId] ?? 0}
            </span>
          </div>
        ))}
      </div>
    </Stage>
  );
}
