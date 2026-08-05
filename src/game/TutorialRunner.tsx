"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  REVEAL_BEATS,
  ROUND_DURATION_MS,
  SCORE_TIERS,
  TUTORIAL_ASSIST_MS,
  TUTORIAL_RIVAL_GAP_MS,
  TUTORIAL_RIVAL_MAX_MS,
  TUTORIAL_RIVAL_MIN_MS,
  DUEL_STARTING_HP,
} from "@/engine/config";
import { tierForElapsed } from "@/engine/scoring";
import { normalizeTitle } from "@/engine/normalize";
import { play } from "@/audio/sfx";
import { useRoundAudio } from "./useRoundAudio";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { GuessInput, type GuessResult } from "./GuessInput";
import { Waveform } from "./Waveform";
import { TierChip } from "./ui";
import { Button } from "@/ui/Button";
import { Card, Meter } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { snap } from "@/ui/motion";

/**
 * The coached rounds of the welcome flow.
 *
 * A CLIENT-SIDE SANDBOX. It reuses the presentation layer that the real game is built from
 * — `useRoundAudio`, `GuessInput`, `Waveform`, `TierChip`, `Meter` — but drives its own
 * phase timing rather than subscribing to `matches.state`. There is no match row, no
 * `matchMode` variant, and nothing at stake.
 *
 * That is deliberate, and it is the whole reason the tutorial can teach anything. The real
 * phase machine is server-scheduled precisely so two players cannot disagree about when a
 * round ends; a tutorial needs the opposite — a rival whose timing is known in advance, and
 * beats it can hold on while a coaching line is read. Borrowing the real machine would mean
 * fighting it at every step.
 *
 * THE COST, stated plainly: round pacing now exists in two places. If REVEAL_BEATS or the
 * scoring curve changes, `RoundRunner` and this file both need looking at. Accepted for the
 * control it buys. The numbers themselves are imported rather than copied, so only the
 * *sequencing* is duplicated, not the values.
 */

type Stage = "solo" | "duel" | "done";

export function TutorialRunner({
  track,
  rivalName,
  rivalAvatar,
  onComplete,
  onSkip,
}: {
  track: { title: string; artist: string; artworkUrl: string; previewUrl: string };
  rivalName: string;
  rivalAvatar?: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [stage, setStage] = useState<Stage>("solo");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4">
      <AnimatePresence mode="wait">
        {stage === "solo" && (
          <CoachedRound
            key="solo"
            track={track}
            mode="solo"
            onDone={() => setStage("duel")}
            onSkip={onSkip}
          />
        )}
        {stage === "duel" && (
          <CoachedRound
            key="duel"
            track={track}
            mode="duel"
            rivalName={rivalName}
            rivalAvatar={rivalAvatar}
            onDone={onComplete}
            onSkip={onSkip}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * One coached round.
 *
 * Runs the same shape twice: solo teaches the core loop, duel adds the rival and the health
 * bars. Sharing one component rather than writing two keeps the second round feeling like
 * the first with something added, which is the point of doing them in that order.
 */
function CoachedRound({
  track,
  mode,
  rivalName,
  rivalAvatar,
  onDone,
  onSkip,
}: {
  track: { title: string; artist: string; artworkUrl: string; previewUrl: string };
  mode: "solo" | "duel";
  rivalName?: string;
  rivalAvatar?: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const audio = useRoundAudio(track.previewUrl);
  const reduced = usePrefersReducedMotion();

  const [started, setStarted] = useState(false);
  const [solvedMs, setSolvedMs] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  /** How far the assist has escalated. Indexes conceptually into TUTORIAL_ASSIST_MS. */
  const [assist, setAssist] = useState<0 | 1 | 2 | 3>(0);

  const solved = solvedMs !== null;

  /**
   * The assist ladder.
   *
   * Escalates on a wall clock from the moment the round starts, and stops the instant the
   * player solves. A player who recognises the track never sees rung 1 — which is the
   * entire reason this is staged rather than simply pinning the answer from the start.
   * The recognition moment is what the product is selling; handing over the title on beat
   * one would spend it for a guarantee we get anyway by rung 3.
   */
  useEffect(() => {
    if (!started || solved) return;

    const timers = [
      setTimeout(() => setAssist(1), TUTORIAL_ASSIST_MS.suggest),
      setTimeout(() => setAssist(2), TUTORIAL_ASSIST_MS.highlight),
      setTimeout(() => setAssist(3), TUTORIAL_ASSIST_MS.reveal),
    ];
    return () => timers.forEach(clearTimeout);
  }, [started, solved]);

  /**
   * Starts the round, and carries the user gesture.
   *
   * This press is load-bearing beyond starting the clip: an AudioContext created before a
   * user gesture starts suspended, so without a real click here the tutorial would open
   * silently into `playback-blocked` — which is a fatal way to begin a game about music.
   */
  const begin = useCallback(async () => {
    setStarted(true);
    await audio.start();
  }, [audio]);

  /**
   * Judged locally, because there is no server round to judge against.
   *
   * `normalizeTitle` is the SAME function `convex/matches.ts` runs a real guess through,
   * so casing, punctuation, "(Remastered)" suffixes and featured-artist credits are all
   * forgiven here exactly as they are in a rated duel. Reusing it matters more than it
   * looks: a tutorial stricter than the game teaches players to distrust their own answers
   * at the precise moment they are learning what counts.
   *
   * The one thing this does NOT reuse is the alias table, which lives in the database. A
   * player who types a well-known alternative title gets "Not it" here where the real game
   * would accept it — a small unfairness, bounded by the assist ladder, which puts the
   * canonical title one keystroke away.
   */
  const onGuess = useCallback(
    async (text: string): Promise<GuessResult> => {
      const elapsed = audio.elapsedMs();

      if (normalizeTitle(text) !== normalizeTitle(track.title)) {
        play("wrong");
        setFeedback("Not it — keep going");
        return { status: "wrong" };
      }

      const tier = tierForElapsed(elapsed);
      play(tier.id === "snap" ? "snap" : "correct");
      setSolvedMs(elapsed);
      setFeedback(null);
      audio.stop();
      return { status: "correct" };
    },
    [audio, track.title],
  );

  const tier = solvedMs === null ? null : tierForElapsed(solvedMs);

  /**
   * The rival's time, derived from the player's.
   *
   * Scripted to lose by a visible margin, so the health bars actually move and "the gap is
   * the damage" is something you watch rather than something you are told. Floored and
   * capped so the margin is neither invisible nor absurd.
   *
   * A deliberate and small lie — see TUTORIAL_RIVAL_GAP_MS for how to make it honest.
   */
  const rivalMs =
    solvedMs === null
      ? null
      : Math.min(
          TUTORIAL_RIVAL_MAX_MS,
          Math.max(TUTORIAL_RIVAL_MIN_MS, solvedMs + TUTORIAL_RIVAL_GAP_MS),
        );

  const damage =
    solvedMs === null || rivalMs === null
      ? 0
      : Math.max(1, Math.round(tierForElapsed(solvedMs).points - tierForElapsed(rivalMs).points));

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: -12 }}
      transition={snap}
      className="flex flex-col gap-4"
    >
      {mode === "duel" && (
        <DuelBars
          rivalName={rivalName ?? "Rival"}
          rivalAvatar={rivalAvatar}
          damage={solved ? damage : 0}
        />
      )}

      {!started ? (
        <Opening mode={mode} rivalName={rivalName} onBegin={() => void begin()} />
      ) : (
        <>
          <Waveform
            analyser={audio.analyser}
            active={audio.phase === "playing"}
            displayMs={audio.displayMs}
            revealStage={audio.revealStage}
            beats={REVEAL_BEATS}
            roundDurationMs={ROUND_DURATION_MS}
          />

          {solved ? (
            <Solved
              mode={mode}
              tierId={tier?.id ?? "solid"}
              points={tier?.points ?? 0}
              elapsedMs={solvedMs}
              rivalMs={rivalMs}
              rivalName={rivalName}
              damage={damage}
              title={track.title}
              artist={track.artist}
              artworkUrl={track.artworkUrl}
              onNext={onDone}
            />
          ) : (
            <Playing
              assist={assist}
              feedback={feedback}
              title={track.title}
              audioError={audio.error}
              onRetryAudio={audio.retry}
              onGuess={onGuess}
              onSkip={onSkip}
            />
          )}
        </>
      )}
    </motion.div>
  );
}

/** What the player reads before the sound starts, and the gesture that unlocks audio. */
function Opening({
  mode,
  rivalName,
  onBegin,
}: {
  mode: "solo" | "duel";
  rivalName?: string;
  onBegin: () => void;
}) {
  const snapTier = SCORE_TIERS[0];

  return (
    <Card variant="hero" className="flex flex-col items-start gap-4 p-6">
      <p className="text-label text-muted tracking-[0.14em] uppercase">
        {mode === "solo" ? "Your first song" : "Now with someone else"}
      </p>

      <h2 className="font-display text-display-2 font-extrabold">
        {mode === "solo"
          ? "You'll hear one second"
          : `${rivalName ?? "Someone"} is playing the same song`}
      </h2>

      <p className="text-body text-secondary">
        {mode === "solo" ? (
          <>
            Name it as fast as you can. The clip grows every few seconds — and every second
            you wait costs you points. Guess on the first clip and it&rsquo;s a{" "}
            <span className="text-paper font-semibold">
              {snapTier.label}, worth {snapTier.points}
            </span>
            .
          </>
        ) : (
          <>
            Same rules, but now it matters who is faster. Whoever names it later loses
            health equal to the gap between you — that is how a duel ends.
          </>
        )}
      </p>

      {/* The press that unlocks audio. An AudioContext created without a user gesture
          starts suspended, so this button is doing real work beyond starting the round. */}
      <Button size="lg" onClick={onBegin}>
        <Glyph name="tier" filled />
        {mode === "solo" ? "Play the song" : "Start the duel"}
      </Button>
    </Card>
  );
}

/** The live round: the field, the coaching, and the way past it. */
function Playing({
  assist,
  feedback,
  title,
  audioError,
  onRetryAudio,
  onGuess,
  onSkip,
}: {
  assist: 0 | 1 | 2 | 3;
  feedback: string | null;
  title: string;
  audioError: string | null;
  onRetryAudio: () => void;
  onGuess: (text: string) => Promise<GuessResult>;
  onSkip: () => void;
}) {
  if (audioError !== null) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-body-lg text-paper">
          {audioError === "playback-blocked"
            ? "Your browser blocked the sound."
            : "That song wouldn't load."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRetryAudio}>
            <Glyph name="sound" />
            {audioError === "playback-blocked" ? "Allow sound" : "Try again"}
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Skip the tutorial
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
       * The coaching line, which escalates rather than opening with the answer.
       *
       * "Tap the field" rather than assuming the keyboard is up: `GuessInput` focuses in an
       * effect, and on iOS a programmatic focus outside a gesture handler does not raise
       * the keyboard — so a player on a phone can be focused with nothing to type into.
       */}
      <p className="text-body text-secondary text-center" role="status">
        {assist === 0 && "Heard it? Tap the field and start typing."}
        {assist === 1 && "Type any letter — we'll show you the list."}
        {assist === 2 && "That's the one, highlighted below."}
        {assist === 3 && (
          <>
            It&rsquo;s <span className="text-paper font-semibold">{title}</span> — type the
            first few letters and pick it.
          </>
        )}
      </p>

      <GuessInput
        onGuess={onGuess}
        disabled={false}
        lockedUntil={0}
        // The scaffold. Teaches the technique that actually wins rounds — type two or three
        // characters and pick from the list — rather than handing over a title to type out.
        pinnedSuggestion={assist >= 1 ? title : undefined}
        highlightPinned={assist >= 2}
      />

      {feedback && (
        <p className="text-body-sm text-muted text-center" role="alert">
          {feedback}
        </p>
      )}

      <button
        onClick={onSkip}
        className="text-body-sm text-muted hover:text-paper mx-auto rounded-xs px-3 py-2 transition-colors"
      >
        Skip the tutorial
      </button>
    </div>
  );
}

/**
 * The payoff.
 *
 * Names the tier they got AND the one above it. The round is paced so an assisted guess
 * lands around QUICK — a tutorial that hands over a SNAP makes the first real round feel
 * like a demotion, and leaves nothing to chase.
 */
function Solved({
  mode,
  tierId,
  points,
  elapsedMs,
  rivalMs,
  rivalName,
  damage,
  title,
  artist,
  artworkUrl,
  onNext,
}: {
  mode: "solo" | "duel";
  tierId: string;
  points: number;
  elapsedMs: number;
  rivalMs: number | null;
  rivalName?: string;
  damage: number;
  title: string;
  artist: string;
  artworkUrl: string;
  onNext: () => void;
}) {
  const snapTier = SCORE_TIERS[0];
  const isSnap = tierId === "snap";

  return (
    <Card variant="hero" className="flex flex-col items-center gap-4 p-6 text-center">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artworkUrl}
          alt=""
          className="border-line size-14 shrink-0 rounded-sm border object-cover"
        />
        <div className="flex flex-col items-start text-left">
          <p className="text-body text-paper font-semibold">{title}</p>
          <p className="text-body-sm text-muted">{artist}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <TierChip tierId={tierId} />
        <p className="font-display text-display-1 text-paper font-extrabold tabular-nums">
          +{points}
        </p>
        <p className="text-body-sm text-muted tabular-nums">
          {(elapsedMs / 1000).toFixed(1)}s
        </p>
      </div>

      {/*
       * The ceiling they did not hit.
       *
       * This is the closing beat of onboarding, and it ends on a number to chase rather
       * than a participation trophy. Suppressed if they actually snapped — telling someone
       * who hit the maximum what the maximum is would be absurd, and the assist ladder must
       * never cap a player who beat it.
       */}
      {!isSnap && (
        <p className="text-body text-secondary">
          Name it in the first second and that&rsquo;s a{" "}
          <span className="text-gold font-semibold">
            {snapTier.label} — {snapTier.points}
          </span>
          .
        </p>
      )}

      {mode === "duel" && rivalMs !== null && (
        <div className="border-line flex w-full flex-col gap-1 border-t pt-4">
          <p className="text-body text-secondary">
            {rivalName ?? "They"} got it in{" "}
            <span className="text-paper tabular-nums">{(rivalMs / 1000).toFixed(1)}s</span>{" "}
            — {((rivalMs - elapsedMs) / 1000).toFixed(1)}s behind you.
          </p>
          <p className="text-body text-paper font-semibold">
            That gap cost them {damage} health.
          </p>
        </div>
      )}

      <Button size="lg" onClick={onNext}>
        {mode === "solo" ? "Now try it against someone" : "I'm ready"}
      </Button>
    </Card>
  );
}

/** The two health bars, so the duel round has something to visibly move. */
function DuelBars({
  rivalName,
  rivalAvatar,
  damage,
}: {
  rivalName: string;
  rivalAvatar?: string;
  damage: number;
}) {
  const rivalHp = Math.max(0, DUEL_STARTING_HP - damage);

  return (
    <div className="border-line flex gap-3 border-b pb-3">
      <Bar label="You" hp={DUEL_STARTING_HP} />
      <Bar label={rivalName} hp={rivalHp} avatar={rivalAvatar} />
    </div>
  );
}

function Bar({ label, hp, avatar }: { label: string; hp: number; avatar?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="text-label flex items-center justify-between gap-1.5">
        <span className="text-secondary flex min-w-0 items-center gap-1.5 truncate">
          {avatar && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatar} alt="" className="size-4 shrink-0 rounded-full object-cover" />
          )}
          {label}
        </span>
        <span className="font-display text-secondary shrink-0 font-bold tabular-nums">
          {hp}
        </span>
      </div>
      <Meter
        value={hp}
        max={DUEL_STARTING_HP}
        height="sm"
        tone="gold"
        label={`${label}: ${hp} of ${DUEL_STARTING_HP} health`}
      />
    </div>
  );
}

/** Kept so the runner can be rendered in the design gallery without a live catalogue. */
export const TUTORIAL_FIXTURE_TRACK = {
  title: "Blinding Lights",
  artist: "The Weeknd",
  artworkUrl: "",
  previewUrl: "",
};
