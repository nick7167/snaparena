"use client";

import { AnimatePresence } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DUEL_STARTING_HP, ROOM_STARTING_HP } from "@/engine/config";
import { play } from "@/audio/sfx";
import { useRoundAudio } from "./useRoundAudio";
import { useRoundLifecycle, rejectionMessage } from "./useRoundLifecycle";
import { BotBadge, RankBadge, hpTone, nameFor } from "./ui";
import {
  Countdown,
  GuessingStage,
  MilestoneStage,
  RevealStage,
  StandingsStage,
  VsReveal,
  type PlayerCardData,
} from "./stages";
import { MatchEnd, type MatchEndPlayer } from "./MatchEnd";
import { useImmersive } from "@/app/immersive";
import { usePrefetchTrackIndex } from "./track-index";
import { LeaveMatch } from "./LeaveMatch";
import { Chip, Meter } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";

type MatchState = NonNullable<ReturnType<typeof useQuery<typeof api.matches.state>>>;

/**
 * The duel arena: ranked, practice and rooms.
 *
 * Deliberately NOT the daily. This component and everything it renders assume two or
 * more players and a health bar — an opponent to lose HP to, a round winner, a
 * standings beat, a VICTORY/DEFEAT verdict. Pointing it at a solo run produced exactly
 * the nonsense you would expect: "neither of you got it" and a DRAW at 0 HP against
 * nobody. The daily has its own runner; see DailyRunner.tsx.
 *
 * The client never decides when a phase ends — that would drift between opponents
 * and ruin the head-to-head reveal. It only renders, reports readiness, and nudges
 * the server if a scheduled transition is overdue.
 */
export function RoundRunner({
  matchId,
  onPlayAgain,
}: {
  matchId: Id<"matches">;
  onPlayAgain?: () => void;
}) {
  // Hides the app chrome for the duration. Presentation only — clears on unmount, so
  // finishing, forfeiting or navigating all restore the navigation.
  useImmersive();
  // Warm the local suggestion catalogue while the VS reveal is on screen, so the first
  // keystroke of round one already has something to match against.
  usePrefetchTrackIndex();

  const match = useQuery(api.matches.state, { matchId });
  const myStatus = useQuery(api.matches.myRoundStatus, { matchId });
  const submitGuess = useMutation(api.matches.submitGuess);
  const passRound = useMutation(api.matches.pass);
  const markVsReady = useMutation(api.ranked.markVsReady);

  const phase = match?.phase ?? "guessing";
  const isGuessing = phase === "guessing";

  const audio = useRoundAudio(match?.currentAudioUrl ?? null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useRoundLifecycle({
    matchId,
    currentRound: match?.currentRound,
    phaseEndsAt: match?.phaseEndsAt,
    isGuessing,
    nextAudioUrl: match?.nextAudioUrl ?? null,
    audio,
    guestToken: undefined,
    onRoundStart: () => setFeedback(null),
  });

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

  const maxHp = match.mode === "room" ? ROOM_STARTING_HP : DUEL_STARTING_HP;

  const players: PlayerCardData[] = match.scoreboard.map((entry) => ({
    userId: String(entry.userId),
    displayName: entry.displayName ?? "Player",
    handle: entry.handle ?? "",
    avatarUrl: entry.avatarUrl,
    elo: entry.elo ?? 0,
    rankLabel: entry.rankLabel ?? "",
    rankTierId: entry.rankTierId ?? "bronze",
    rankDivision: entry.rankDivision ?? 1,
    rankAccent: entry.rankAccent ?? "#888",
    placementsRemaining: entry.placementsRemaining ?? 0,
    level: entry.level ?? 1,
    wins: entry.wins ?? 0,
    losses: entry.losses ?? 0,
    bestCategory: entry.bestCategory ?? null,
    badges: entry.badges ?? [],
    globalRank: entry.globalRank ?? null,
    hp: entry.hp,
    roundsWon: entry.roundsWon,
    streak: entry.streak,
    bestMs: entry.bestMs,
    isBot: entry.isBot ?? false,
    bio: entry.bio ?? null,
    isMe: entry.isMe,
    vsReady: entry.vsReady ?? false,
  }));

  const me = players.find((player) => player.isMe);
  const opponent = players.find((player) => !player.isMe);

  if (match.status === "abandoned") {
    return <Centered>Match abandoned — not enough tracks in the catalogue.</Centered>;
  }

  return (
    <div className="relative">
      {/* Outside the phase switch on purpose — every beat needs a way out, including the
          VS reveal and the results screen, where the header below renders nothing. */}
      <LeaveMatch
        mode={match.mode === "room" ? "room" : match.mode === "practice" ? "practice" : "ranked"}
        matchId={matchId}
        currentRound={match.currentRound}
        live={phase !== "match_end"}
      />

      <MatchHeader match={match} opponent={opponent} maxHp={maxHp} />

      <AnimatePresence mode="wait">
        {phase === "vs_reveal" && me && opponent && (
          <VsReveal
            key="vs"
            me={me}
            opponent={opponent}
            matchup={match.matchup}
            phaseEndsAt={match.phaseEndsAt}
            onReady={() => void markVsReady({ matchId })}
          />
        )}

        {phase === "countdown" && (
          <Countdown
            key="countdown"
            endsAt={match.phaseEndsAt}
            roundNumber={match.currentRound + 1}
            multiplier={match.multiplier}
            players={players}
            maxHp={maxHp}
            suddenDeath={match.suddenDeath}
          />
        )}

        {phase === "guessing" && (
          <GuessingStage
            key={`guess-${match.currentRound}`}
            audio={audio}
            solved={myStatus?.solved ?? false}
            passed={me !== undefined && hasPassed(match, me.userId)}
            tierThisRound={myStatus?.tierThisRound ?? null}
            pointsThisRound={myStatus?.pointsThisRound ?? 0}
            lockedUntil={myStatus?.lockedUntil ?? 0}
            feedback={feedback}
            onGuess={onGuess}
            onPass={() => {
              audio.stop();
              void passRound({ matchId, roundIndex: match.currentRound });
            }}
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
            maxHp={maxHp}
            damage={match.lastRoundDamage.map((entry) => ({
              ...entry,
              userId: String(entry.userId),
            }))}
            roundWinnerId={match.roundWinnerId ? String(match.roundWinnerId) : null}
            multiplier={match.multiplier}
            nextMultiplier={match.nextMultiplier}
            outcome={match.lastRoundOutcome}
            timeGapMs={match.lastRoundTimeGapMs}
          />
        )}

        {phase === "milestone" && (
          <MilestoneStage
            key={`milestone-${match.currentRound}`}
            roundNumber={match.currentRound}
            multiplier={match.multiplier}
            players={players}
            maxHp={maxHp}
          />
        )}

        {phase === "match_end" && (
          <MatchEnd
            key="end"
            maxHp={maxHp}
            matchId={matchId}
            winnerId={match.winnerId ? String(match.winnerId) : null}
            onPlayAgain={onPlayAgain}
            // No cast: a stale field here should fail the typecheck, not reach
            // the screen. That cast is exactly why "undefined sets" shipped.
            players={match.scoreboard.map(
              (entry, index): MatchEndPlayer => ({
                ...players[index],
                totalPoints: entry.totalPoints,
                hp: entry.hp,
                ratingBefore: entry.ratingBefore,
                ratingAfter: entry.ratingAfter,
                ratingDelta: entry.ratingDelta,
                xpEarned: entry.xpEarned,
                xpBreakdown: entry.xpBreakdown,
                levelBefore: entry.levelBefore,
                levelAfter: entry.levelAfter,
                xpAfter: entry.xpAfter,
                badgesEarned: entry.badgesEarned,
                forfeited: entry.forfeited,
              }),
            )}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function hasPassed(match: MatchState, userId: string): boolean {
  const entry = match.scoreboard.find((row) => String(row.userId) === userId);
  return entry?.passedRound === match.currentRound;
}

/**
 * Live HP and the opponent.
 *
 * No longer carries the surrender control: leaving is now a persistent affordance that
 * outlives every phase (see LeaveMatch), rather than a quiet link that vanished during
 * the VS reveal and the results screen — the two places it was needed most.
 */
function MatchHeader({
  match,
  opponent,
  maxHp,
}: {
  match: MatchState;
  opponent: PlayerCardData | undefined;
  maxHp: number;
}) {
  if (match.phase === "vs_reveal" || match.phase === "match_end") return null;

  return (
    <div className="border-line mx-auto flex w-full max-w-2xl flex-col gap-2.5 border-b px-4 py-3">
      <div className="text-body-sm flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {match.suddenDeath ? (
            <Chip tone="signal" size="sm">
              <Glyph name="damage" />
              SUDDEN DEATH
            </Chip>
          ) : (
            <>
              <span className="text-secondary">Round {match.currentRound + 1}</span>
              {match.multiplier > 1 && (
                <Chip tone="gold" size="sm">×{match.multiplier}</Chip>
              )}
            </>
          )}
        </span>

        <span className="flex min-w-0 items-center gap-2">
          {opponent && (
            <>
              <span className="text-muted truncate">vs {nameFor(opponent)}</span>
              {opponent.isBot && <BotBadge />}
              <RankBadge
                label={opponent.rankLabel}
                tierId={opponent.rankTierId}
                division={opponent.rankDivision}
                accent={opponent.rankAccent}
                placements={opponent.placementsRemaining}
                size="sm"
              />
            </>
          )}
        </span>
      </div>

      {/* Both bars use the same ramp — brightness is how much health is left, not who
          you are. Whose row is whose is carried by the label, not by hue. */}
      <div className="flex gap-3">
        {match.scoreboard.map((entry) => {
          const name = entry.isMe ? "You" : nameFor(entry);
          return (
            <div key={String(entry.userId)} className="flex flex-1 flex-col gap-1">
              <div className="text-label flex justify-between">
                <span className={entry.isMe ? "text-paper font-semibold" : "text-muted"}>
                  {name}
                </span>
                <span className="font-display text-secondary font-bold tabular-nums">
                  {entry.hp}
                </span>
              </div>
              <Meter
                value={entry.hp}
                max={maxHp}
                height="sm"
                tone={hpTone(entry.hp, maxHp)}
                label={`${entry.isMe ? "Your" : `${name}'s`} health: ${entry.hp} of ${maxHp}`}
              />
            </div>
          );
        })}
      </div>

    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-body text-secondary flex min-h-[50vh] items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}
