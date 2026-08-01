"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  DUEL_STARTING_HP,
  REVEAL_BEATS,
  ROOM_STARTING_HP,
  ROUND_DURATION_MS,
  SURRENDER_FROM_ROUND,
} from "@/engine/config";
import { play } from "@/audio/sfx";
import { useRoundAudio } from "./useRoundAudio";
import { GuessInput } from "./GuessInput";
import { BotBadge, RankBadge, Stage, TierChip } from "./ui";
import {
  Countdown,
  MilestoneStage,
  RevealStage,
  StandingsStage,
  VsReveal,
  type PlayerCardData,
} from "./stages";
import { MatchEnd, type MatchEndPlayer } from "./MatchEnd";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useImmersive } from "@/app/immersive";
import { getGuestToken } from "@/app/guest";
import { Button } from "@/ui/Button";
import { Card, Chip, Meter } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { Waveform } from "./Waveform";

type MatchState = NonNullable<ReturnType<typeof useQuery<typeof api.matches.state>>>;

/**
 * Renders whatever phase the server says the match is in.
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

  // Undefined for signed-in players, so every existing call is byte-identical. The
  // server ignores it on any match that is not the daily.
  const guestToken = getGuestToken();

  const match = useQuery(api.matches.state, { matchId, guestToken });
  const myStatus = useQuery(api.matches.myRoundStatus, { matchId, guestToken });
  const submitGuess = useMutation(api.matches.submitGuess);
  const reportReady = useMutation(api.matches.reportReady);
  const passRound = useMutation(api.matches.pass);
  const nudge = useMutation(api.phases.nudge);

  const phase = match?.phase ?? "guessing";
  const isGuessing = phase === "guessing";

  const audio = useRoundAudio(match?.currentAudioUrl ?? null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const startedRoundRef = useRef<string | null>(null);
  const reportedRoundRef = useRef<string | null>(null);

  const { ready: audioReady, start: startAudio, stop: stopAudio } = audio;
  const currentRound = match?.currentRound;

  // Buffer the NEXT clip during the between-round beats. Without this the client
  // only learns the URL when the 3s countdown starts, which is rarely enough time.
  usePrefetch(match?.nextAudioUrl ?? null);

  /**
   * Tell the server this client is buffered. The guessing clock does not start
   * until every player has reported, which is what stops a slow connection
   * producing a song that cuts off mid-play.
   */
  useEffect(() => {
    if (currentRound === undefined || !audioReady) return;
    const key = `${matchId}:${currentRound}`;
    if (reportedRoundRef.current === key) return;

    reportedRoundRef.current = key;
    void reportReady({ matchId, roundIndex: currentRound, guestToken });
  }, [audioReady, currentRound, matchId, reportReady, guestToken]);

  useEffect(() => {
    if (!isGuessing || !audioReady) return;
    const key = `${matchId}:${currentRound}`;
    if (startedRoundRef.current === key) return;

    startedRoundRef.current = key;
    setFeedback(null);
    void startAudio();
  }, [isGuessing, audioReady, startAudio, matchId, currentRound]);

  useEffect(() => {
    if (!isGuessing) stopAudio();
  }, [isGuessing, stopAudio]);

  // Recovery only: acts once a server deadline has genuinely passed.
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
        guestToken,
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
    [submitGuess, matchId, match?.currentRound, audio, guestToken],
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
  }));

  const me = players.find((player) => player.isMe);
  const opponent = players.find((player) => !player.isMe);

  if (match.status === "abandoned") {
    return <Centered>Match abandoned — not enough tracks in the catalogue.</Centered>;
  }

  return (
    <div className="relative">
      <MatchHeader match={match} opponent={opponent} maxHp={maxHp} matchId={matchId} />

      <AnimatePresence mode="wait">
        {phase === "vs_reveal" && me && opponent && (
          <VsReveal key="vs" me={me} opponent={opponent} matchup={match.matchup} />
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
              void passRound({ matchId, roundIndex: match.currentRound, guestToken });
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
            mode={match.mode}
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
 * Buffers a clip ahead of time.
 *
 * The bytes land in the HTTP cache, so when the real audio element requests the
 * same URL a moment later it is already there.
 */
function usePrefetch(url: string | null) {
  useEffect(() => {
    if (!url) return;
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.src = url;
    audio.load();
    return () => {
      audio.src = "";
    };
  }, [url]);
}

/** Live HP, the opponent, and the surrender control. */
function MatchHeader({
  match,
  opponent,
  maxHp,
  matchId,
}: {
  match: MatchState;
  opponent: PlayerCardData | undefined;
  maxHp: number;
  matchId: Id<"matches">;
}) {
  const surrender = useMutation(api.ranked.surrender);
  const [confirming, setConfirming] = useState(false);

  if (match.phase === "vs_reveal" || match.phase === "match_end") return null;

  const canSurrender =
    (match.mode === "ranked" || match.mode === "practice") &&
    match.currentRound >= SURRENDER_FROM_ROUND;

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
              <span className="text-muted truncate">vs {opponent.displayName}</span>
              {opponent.isBot && <BotBadge />}
              <RankBadge
                label={opponent.rankLabel}
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
      {match.mode !== "daily" && (
        <div className="flex gap-3">
          {match.scoreboard.map((entry) => (
            <div key={String(entry.userId)} className="flex flex-1 flex-col gap-1">
              <div className="text-label flex justify-between">
                <span className={entry.isMe ? "text-paper font-semibold" : "text-muted"}>
                  {entry.isMe ? "You" : entry.displayName}
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
                label={`${entry.isMe ? "Your" : `${entry.displayName}'s`} health: ${entry.hp} of ${maxHp}`}
              />
            </div>
          ))}
        </div>
      )}

      {canSurrender && (
        <div className="flex justify-end">
          {confirming ? (
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-body-sm text-secondary">Concede the duel?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void surrender({ matchId })}
              >
                Yes, I resign
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Keep playing
              </Button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-body-sm text-muted hover:text-paper rounded-xs px-2 py-1 transition-colors"
            >
              Surrender
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Health as heat.
 *
 * Full health burns bright, low health cools to an ember, zero goes out entirely. This
 * is the one place colour is derived rather than passed, because it means the same
 * thing on every bar in the app.
 */
export function hpTone(hp: number, maxHp: number): "paper" | "gold" | "signal" | "muted" {
  if (hp <= 0) return "muted";
  const pct = maxHp > 0 ? hp / maxHp : 0;
  if (pct < 0.25) return "signal";
  if (pct < 0.6) return "gold";
  return "paper";
}

// `match` is no longer a prop: the only thing it supplied was `phaseEndsAt` for the
// separate PhaseTimer, and the round clock now lives inside the waveform spine.
function GuessingStage({
  audio,
  solved,
  passed,
  tierThisRound,
  pointsThisRound,
  lockedUntil,
  feedback,
  onGuess,
  onPass,
}: {
  audio: ReturnType<typeof useRoundAudio>;
  solved: boolean;
  passed: boolean;
  tierThisRound: string | null;
  pointsThisRound: number;
  lockedUntil: number;
  feedback: string | null;
  onGuess: (text: string) => Promise<{ status: string }>;
  onPass: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const beat = REVEAL_BEATS[audio.revealStage];
  const nextBeat = REVEAL_BEATS[audio.revealStage + 1];

  if (audio.error !== null) {
    return (
      <Stage keyName="audio-error" className="items-center py-16 text-center">
        <Card className="flex flex-col gap-2 p-6">
          <p className="text-body-lg text-paper">
            {audio.error === "audio-timeout"
              ? "This track took too long to load."
              : audio.error === "playback-blocked"
                ? "Your browser blocked audio playback."
                : "This track's audio failed to load."}
          </p>
          <p className="text-body-sm text-muted">The round moves on shortly.</p>
        </Card>
      </Stage>
    );
  }

  const secondsToNextBeat = nextBeat
    ? Math.max(0, Math.ceil((nextBeat.atRoundMs - audio.displayMs) / 1000))
    : null;
  const secondsLeft = Math.max(0, (ROUND_DURATION_MS - audio.displayMs) / 1000);

  /**
   * Bottom-anchored instrument.
   *
   * The spine owns the middle; the guess field is locked to the bottom so a thumb never
   * travels and the field does not move when the keyboard opens. Every millisecond
   * spent reaching for the input is points lost.
   */
  return (
    <Stage keyName="guessing" className="min-h-[calc(100dvh-var(--match-header,7rem))] justify-between gap-4 py-4">
      <div className="flex flex-1 flex-col justify-center gap-4">
        <Waveform
          analyser={audio.analyser}
          active={audio.phase === "playing"}
          displayMs={audio.displayMs}
          revealStage={audio.revealStage}
          beats={REVEAL_BEATS}
          roundDurationMs={ROUND_DURATION_MS}
        />

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body-sm text-secondary">
            <span className="font-display text-paper font-bold tabular-nums">
              {beat.playToMs / 1000}s
            </span>{" "}
            unlocked
            {secondsToNextBeat !== null && (
              <span className="text-muted"> · more in {secondsToNextBeat}s</span>
            )}
          </span>
          <span
            className={`font-display text-display-2 font-extrabold tabular-nums ${
              secondsLeft <= 5 ? "text-signal-text" : "text-paper"
            }`}
          >
            {secondsLeft.toFixed(1)}
          </span>
        </div>

        {/* The clip is silent between unlocks. Saying so — and letting players
            re-hear it — stops the silence reading as a fault. */}
        {audio.phase === "playing" && !solved && !passed && (
          <div className="flex justify-center">
            <Button variant="secondary" size="sm" onClick={audio.replay}>
              <Glyph name="sound" />
              Replay {beat.playToMs / 1000}s
            </Button>
          </div>
        )}

        {!audio.ready && (
          <p className="text-body-sm text-muted text-center" role="status">
            Buffering audio…
          </p>
        )}
      </div>

      {/* Thumb zone. */}
      <div className="flex flex-col gap-3">
        {feedback && (
          <motion.p
            key={feedback}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            // Assertive: this is the answer to something the player just did, and it is
            // only useful before the round moves on.
            role="alert"
            className="text-body text-paper text-center font-medium"
          >
            {feedback}
          </motion.p>
        )}

        {solved ? (
          <motion.div
            initial={reduced ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-2 py-4"
            role="status"
          >
            {tierThisRound && <TierChip tierId={tierThisRound} />}
            <p className="font-display text-display-1 text-paper font-extrabold tabular-nums">
              +{pointsThisRound}
            </p>
            <p className="text-body-sm text-muted">Waiting for the round to end…</p>
          </motion.div>
        ) : passed ? (
          <p className="text-body text-muted py-6 text-center" role="status">
            Passed. Waiting for the round to end…
          </p>
        ) : (
          <>
            <GuessInput
              onGuess={onGuess}
              disabled={!audio.ready || audio.phase === "ended"}
              lockedUntil={lockedUntil}
              suppressSuggestions={audio.revealStage === 0}
            />
            <button
              onClick={onPass}
              disabled={!audio.ready}
              className="text-body-sm text-muted hover:text-paper mx-auto rounded-xs px-3 py-2
                         transition-colors disabled:opacity-40"
            >
              I don&rsquo;t know this one
            </button>
          </>
        )}
      </div>
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
