"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import {
  PHASE_DURATIONS_MS,
  REVEAL_BEATS,
  ROUND_DURATION_MS,
  VS_READY_COUNTDOWN_MS,
} from "@/engine/config";
import { formatGlobalRank, isNotable } from "@/engine/ranks";
import { play } from "@/audio/sfx";
import { Avatar, BadgeRow, BotBadge, PhaseTimer, Stage, TierChip, hpTone, nameFor } from "./ui";
import { RankEmblem } from "@/ui/RankEmblem";
import { useNow, usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { Card, Chip, Meter } from "@/ui/Surface";
import { Button } from "@/ui/Button";
import { Glyph } from "@/ui/Glyph";
import { snap } from "@/ui/motion";
import { GuessInput } from "./GuessInput";
import { Waveform } from "./Waveform";
import type { useRoundAudio } from "./useRoundAudio";

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
  rankTierId: string;
  rankDivision: number;
  rankAccent: string;
  placementsRemaining: number;
  level: number;
  wins: number;
  losses: number;
  bestCategory: string | null;
  badges: { id: string; name: string; emoji: string }[];
  globalRank: number | null;
  hp?: number;
  roundsWon?: number;
  streak?: number;
  bestMs?: number | null;
  isBot: boolean;
  bio?: string | null;
  isMe?: boolean;
  /** Pressed Ready on the opponent reveal. Bots never set it — see ReadyBar. */
  vsReady?: boolean;
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
  phaseEndsAt,
  onReady,
}: {
  me: PlayerCardData;
  opponent: PlayerCardData;
  matchup: string | null;
  phaseEndsAt: number | null;
  onReady: () => void;
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("whoosh");
  }, []);

  /**
   * Both sides in. Derived rather than read from the server, using exactly the rule
   * `markVsReady` applies — a bot has no client to press with and counts as ready from the
   * moment it exists — so the clock the player watches and the clock the server is running
   * agree about why it just dropped to three.
   */
  const bothReady =
    (me.isBot || me.vsReady === true) &&
    (opponent.isBot || opponent.vsReady === true);

  /**
   * The opponent pressing Ready is the only thing on this screen that happens because of
   * someone else, and the readiness strip changing colour is easy to miss while you are
   * reading their record. A cue makes it an event.
   */
  const opponentReady = opponent.isBot || opponent.vsReady === true;
  const wasOpponentReady = useRef(opponentReady);
  useEffect(() => {
    if (opponentReady && !wasOpponentReady.current) play("ready");
    wasOpponentReady.current = opponentReady;
  }, [opponentReady]);

  /**
   * Full-bleed, and no cards.
   *
   * Two players in two identical `Card`s with a small italic "VS" between them is a
   * table of two rows — it describes a matchup rather than staging one. The screen is
   * split along the chamfer instead: the same angle the rank emblem is cut on, so the
   * seam between you and them is the app's own geometry rather than a diagonal borrowed
   * from nowhere. Each half carries its player's tier colour, which is the one moment in
   * a duel where both ranks are the subject.
   *
   * The phase now runs up to 30s and ends on Ready rather than on its clock, so this has
   * room to be read: identity above, a scannable head-to-head below. Every beat still
   * lands inside ~2.6s — the composition must be complete long before the phase is, and
   * must never depend on how long the server gives it.
   *
   * It is bound to the viewport (`fit`), because a reveal you have to scroll is a reveal
   * whose Ready button you cannot find. The panels take the slack via `min-h-0 flex-1`,
   * so on a short screen the emblems give up height before anything else does.
   */
  const beat = (delay: number) =>
    reduced
      ? { initial: false as const, animate: { opacity: 1, x: 0, y: 0 } }
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { delay, duration: 0.35, ease: "easeOut" as const },
        };

  return (
    /* Width via the prop, not className: two `max-w-*` utilities on one element resolve
       by stylesheet order, so an override is a coin flip. */
    <Stage keyName="vs" width="max-w-4xl" fit>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-2 sm:gap-3">
        {/* The clock, first and fixed. A HUD element that moves is one players have to
            re-find every time they look at it, so this holds one position for the whole
            phase and never resizes as the digits change. */}
        <VsClock phaseEndsAt={phaseEndsAt} locked={bothReady} reduced={reduced} />

        {/* Two panels and a mark. No tinted halves and no diagonal wash: those were a
            gradient, this design does not have gradients, and a soft wash behind a rank
            emblem was fighting the one object on screen that should be loudest. Colour
            identity now comes from the plate's hairline — flat, hard-edged, and the same
            device the ladder marks your own row with. */}
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 sm:gap-3">
          <VsPanel player={me} reduced={reduced} delay={0.3} youAre />
          <VsMark reduced={reduced} />
          <VsPanel player={opponent} reduced={reduced} delay={0.45} />
        </div>

        {/* The verdict line. The standalone "#N GLOBAL" flag that used to live here is
            gone: both panels carry each player's position now, and printing the
            opponent's a third time within one screen is noise. */}
        {matchup && (
          <motion.p
            {...beat(1.6)}
            className="font-display text-body-lg text-paper text-center font-bold tracking-[0.2em]"
          >
            {matchup}
          </motion.p>
        )}

        {/* The head-to-head. Four rows, one per stat, each bar leaning toward whoever
            leads — the whole point is that you can read who is stronger at a glance
            rather than comparing two columns of numerals yourself. */}
        <CompareStrip me={me} opponent={opponent} reduced={reduced} />

        <ReadyBar me={me} onReady={onReady} locked={bothReady} reduced={reduced} />
      </div>
    </Stage>
  );
}

/**
 * The countdown, as the biggest number on screen.
 *
 * Always visible and always in the same place. The previous version tucked a "starts in
 * 27s" under the button in label type, which is where you put something nobody needs to
 * see — and this is the one figure that tells a player how long they have to read.
 *
 * `tabular-nums` via `font-display` so the digits do not reflow as they count down; a
 * clock that jitters reads as broken.
 */
function VsClock({
  phaseEndsAt,
  locked,
  reduced,
}: {
  phaseEndsAt: number | null;
  /** Both players are in and the server has pulled the deadline in to three seconds. */
  locked: boolean;
  reduced: boolean;
}) {
  const now = useNow(250);
  const remaining = phaseEndsAt ? Math.max(0, phaseEndsAt - now) : 0;
  const seconds = Math.ceil(remaining / 1000);

  /**
   * Red is for a deadline you are running out of, and once both players are ready there is
   * no deadline left to miss — three seconds of `signal` would read as a warning about
   * something that is in fact the good outcome. Gold instead, and the label changes with
   * it, so the state is announced by two things at once.
   */
  const urgent = !locked && seconds <= 5;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? undefined : { duration: 0.3 }}
      className="flex flex-col items-center gap-1"
    >
      <p className="text-label text-muted tracking-[0.3em] uppercase">
        {locked ? "Starting" : "Match starts in"}
      </p>
      <p
        className={`font-display text-display-2 font-extrabold tabular-nums ${
          locked ? "text-gold" : urgent ? "text-signal-text" : "text-paper"
        }`}
      >
        {seconds}
      </p>
      <div className="w-full max-w-xs">
        {/* The denominator has to follow the deadline. Left at the full 30s the bar would
            snap back to a tenth full at the exact moment the match was confirmed. */}
        <PhaseTimer
          endsAt={phaseEndsAt}
          durationMs={locked ? VS_READY_COUNTDOWN_MS : PHASE_DURATIONS_MS.vs_reveal}
        />
      </div>
    </motion.div>
  );
}

/** The struck plate between the two panels. */
function VsMark({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={
        reduced ? undefined : { delay: 0.2, type: "spring", stiffness: 320, damping: 15 }
      }
      className="flex items-center justify-center"
    >
      <span className="relative flex size-11 items-center justify-center sm:size-14">
        <span
          aria-hidden="true"
          className="plate bg-line-strong absolute inset-0 -z-10"
          style={{ ["--plate-cut" as string]: "9px" }}
        />
        <span
          aria-hidden="true"
          className="plate bg-ink-900 absolute inset-[1.5px] -z-10"
          style={{ ["--plate-cut" as string]: "9px" }}
        />
        <span className="font-display text-paper text-base font-extrabold tracking-tight sm:text-xl">
          VS
        </span>
      </span>
    </motion.div>
  );
}

/**
 * One player, as a struck plate.
 *
 * Hierarchy is the whole brief, and it is enforced by contrast rather than by size alone:
 *
 *   1. RANK      the emblem at `xl` and the tier name at display size, in the tier accent.
 *                Brightest, largest, top of the panel.
 *   2. NAME      display-2 in paper. Second loudest, nothing else competing on that line.
 *   3. THE REST  rating, level, badges — `muted`, small, and last.
 *
 * The panel is flat ink-800 inside a hairline of the player's own tier accent. That
 * hairline is the only colour on the panel, which is what lets the rank read from across
 * the room without a wash behind it.
 */
function VsPanel({
  player,
  reduced,
  delay,
  youAre = false,
}: {
  player: PlayerCardData;
  reduced: boolean;
  delay: number;
  youAre?: boolean;
}) {
  const placing = player.placementsRemaining > 0;
  // A bot has no client to press with and is ready from the moment it exists — the same
  // rule the server applies in `markVsReady`.
  const ready = player.isBot || player.vsReady === true;

  // `formatGlobalRank` returns null when there is no position to show, which is the same
  // condition the profile uses to decide whether the line exists at all.
  const position = placing ? null : formatGlobalRank(player.globalRank);
  const notable = isNotable(player.globalRank);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced ? undefined : { delay, type: "spring", stiffness: 220, damping: 22 }
      }
      className="relative isolate flex min-h-0 min-w-0 flex-col items-center gap-1.5 px-2 pt-3 pb-2.5 sm:gap-2 sm:px-4 sm:pt-5 sm:pb-3.5"
    >
      {/* The plate, drawn as two stacked fills so the hairline survives the chamfer —
          `clip-path` would cut a border away at the two cut corners. Same construction as
          Card's `you` state and RankEmblem's unranked plate. */}
      <span
        aria-hidden="true"
        className="plate absolute inset-0 -z-10"
        style={{
          ["--plate-cut" as string]: "16px",
          backgroundColor: placing ? "var(--color-line-strong)" : player.rankAccent,
        }}
      />
      <span
        aria-hidden="true"
        className="plate bg-ink-800 absolute inset-[1.5px] -z-10"
        style={{ ["--plate-cut" as string]: "16px" }}
      />

      {/* 1 — RANK.

          The emblem is the one element allowed to shrink, so it is the one wrapped in a
          `min-h-0 flex-1` box: on a short viewport the panel takes its height back from
          the artwork rather than from the rank name, the ladder position or the Ready
          strip, all of which stop being readable the moment they lose a pixel. */}
      {/* No wrapper. `fit` makes the emblem a box that takes the height it is given, so it
          has to BE the flex item — nesting it inside a centring div leaves that div with
          no definite height to hand down and the artwork collapses to nothing. */}
      <RankEmblem
        tierId={player.rankTierId}
        division={player.rankDivision}
        size="xl"
        unranked={placing}
        bloom={placing ? undefined : player.rankAccent}
        fit
        className="min-h-0 w-full flex-1"
      />
      <p
        className="font-display text-body-lg sm:text-display-2 w-full truncate text-center font-extrabold tracking-tight"
        style={{ color: placing ? undefined : player.rankAccent }}
      >
        {placing ? "Unranked" : player.rankLabel}
      </p>

      {/* Ladder position, on both sides and for everyone who has one — bots included.
          It used to appear only above the opponent, only when inside the notable cutoff,
          which meant most duels showed neither player's standing at all. It belongs with
          the rank because it IS rank information: the tier says which band you are in,
          this says where in the world.

          The notable cutoff still decides the treatment rather than the presence: top-100
          is struck in gold with the trophy, everyone else gets the same fact quietly. */}
      {position && (
        <span
          className={`text-label -mt-1 flex items-center gap-1 rounded-xs px-1.5 py-0.5 font-bold tracking-[0.1em] tabular-nums ${
            notable ? "bg-gold text-ink-900" : "text-muted"
          }`}
        >
          {notable && <Glyph name="win" filled />}
          {position} GLOBAL
        </span>
      )}

      {/* 2 — NAME. */}
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <Avatar
          plate
          url={player.avatarUrl}
          name={player.isBot ? player.displayName : player.handle}
          className="size-7 shrink-0 text-xs sm:size-9 sm:text-sm"
        />
        <p className="font-display text-body sm:text-body-lg text-paper min-w-0 truncate font-bold">
          {youAre ? "You" : nameFor(player)}
        </p>
      </div>

      {/* 3 — everything else, quietly. */}
      <div className="text-label text-muted flex flex-wrap items-center justify-center gap-x-2 tabular-nums">
        {!placing && <span>{player.elo}</span>}
        <span>L{player.level}</span>
        {player.isBot && <BotBadge />}
      </div>

      {/* The reserved slot keeps both panels the same height when only one player has
          badges. Reserved above `sm` only — on a phone 24px of deliberate emptiness is
          24px the emblem could have had. */}
      <div className="sm:min-h-6">
        <BadgeRow badges={player.badges} max={4} />
      </div>

      {/* The readiness strip, full width at the foot of the panel. A block of colour is
          read before any word on it — so the state is the colour, and the label only
          confirms what the colour already said. */}
      {/* Sits inside the plate rather than bleeding to its edge: the bottom-right corner
          is chamfered, and a full-bleed bar would hang out through the cut. */}
      {/* Keyed on readiness so the flip re-runs the entry beat: a colour transition alone
          is easy to miss on the half of the screen you are not reading. */}
      <motion.div
        key={ready ? "ready" : "waiting"}
        initial={reduced || !ready ? false : { scale: 0.94 }}
        animate={{ scale: 1 }}
        transition={reduced ? undefined : { type: "spring", stiffness: 460, damping: 17 }}
        className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-xs py-2 transition-colors ${
          ready ? "bg-teal text-ink-900" : "bg-ink-600 text-muted"
        }`}
      >
        <span className="text-sm leading-none">
          <Glyph name={ready ? "win" : "timer"} filled={ready} />
        </span>
        <span className="text-label font-bold tracking-[0.14em] uppercase">
          {ready ? "Ready" : "Not ready"}
        </span>
      </motion.div>
    </motion.div>
  );
}

/**
 * The Ready gate.
 *
 * The reveal is the one phase that ends on player input rather than on its clock. Both
 * players pressing advances it immediately; the timer above is the ceiling for someone who
 * walked away, not a wait anyone should sit through.
 *
 * A bot is counted ready from the start — it has nothing to read and no client to press
 * with, which is the same rule the server applies in `markVsReady`. Showing "1 / 2" against
 * a bot that will never press would be a counter that never completes.
 */
/**
 * The button.
 *
 * The state of both players is already shown on the panels above — that is where a player
 * looks to find out who is waiting on whom — so this is only the control, not a status
 * readout. Once pressed it says so and stops being pressable.
 */
function ReadyBar({
  me,
  onReady,
  locked,
  reduced,
}: {
  me: PlayerCardData;
  onReady: () => void;
  /** Both sides in — the clock above is counting the match in, not waiting on anyone. */
  locked: boolean;
  reduced: boolean;
}) {
  const iAmReady = me.isBot || me.vsReady === true;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? undefined : { delay: 1.85, duration: 0.35 }}
      className="flex flex-col items-center"
    >
      <Button
        size="lg"
        onClick={onReady}
        disabled={iAmReady}
        className="min-w-60 tracking-wide"
      >
        {/* Three labels, because there are three states and the middle one used to have to
            cover two of them: waiting on them, and nobody waiting on anyone. */}
        {locked ? "Starting…" : iAmReady ? "Waiting for opponent…" : "I'm ready"}
      </Button>
    </motion.div>
  );
}

/**
 * Head-to-head comparison.
 *
 * Deliberately not two columns of numbers. Two columns make the reader do the comparing;
 * a bar that leans tells them who is ahead before they have read either figure — which is
 * the whole job of this screen.
 *
 * The leading side is drawn in `paper` and the trailing side in `muted`, rather than in the
 * two players' tier accents: matchmaking pairs on rating, so both accents are usually the
 * same colour and would say nothing at all.
 */
function CompareStrip({
  me,
  opponent,
  reduced,
}: {
  me: PlayerCardData;
  opponent: PlayerCardData;
  reduced: boolean;
}) {
  const winRate = (player: PlayerCardData) => {
    const decided = player.wins + player.losses;
    return decided > 0 ? Math.round((player.wins / decided) * 100) : null;
  };

  // A player still in placements has no rating and no ladder position to compare — those
  // rows show a dash rather than a bar pinned at zero, which would read as "terrible"
  // rather than as "not measured yet".
  const placed = (player: PlayerCardData) => player.placementsRemaining === 0;

  const rows = [
    {
      label: "Rating",
      left: placed(me) ? me.elo : null,
      right: placed(opponent) ? opponent.elo : null,
      format: (value: number) => String(value),
      higherWins: true,
    },
    {
      label: "Level",
      left: me.level,
      right: opponent.level,
      format: (value: number) => `L${value}`,
      higherWins: true,
    },
    {
      label: "Win rate",
      left: winRate(me),
      right: winRate(opponent),
      format: (value: number) => `${value}%`,
      higherWins: true,
    },
  ];

  return (
    <div className="flex flex-col gap-2 sm:gap-2.5">
      {rows.map((row, index) => (
        <CompareRow
          key={row.label}
          {...row}
          reduced={reduced}
          delay={1.15 + index * 0.11}
        />
      ))}

      {/* Best category, in the same shape as the rows above it.
          It used to be a cramped line of three unequal fragments — a dash, a centred
          caption and a genre — that matched neither the comparison rows nor anything
          else on the screen. It is the one stat with no number to compare, so it gets
          chips rather than a bar: same label position, same three-column rhythm, and the
          value reads as a thing you are good at rather than as a missing figure. */}
      {(me.bestCategory || opponent.bestCategory) && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? undefined : { delay: 1.48, duration: 0.3 }}
          className="flex flex-col gap-1"
        >
          <span className="text-label text-muted text-center tracking-[0.14em] uppercase">
            Best category
          </span>
          <div className="flex items-center gap-3">
            <div className="flex w-16 shrink-0 justify-end sm:w-24">
              {me.bestCategory ? (
                <Chip size="sm" className="max-w-full truncate">
                  {me.bestCategory}
                </Chip>
              ) : (
                <span className="font-display text-numeral text-muted font-extrabold">—</span>
              )}
            </div>
            {/* An empty middle column, so the chips land on the same rails as the
                numerals above and the row does not look like a different table. */}
            <div className="min-w-0 flex-1" />
            <div className="flex w-16 shrink-0 justify-start sm:w-24">
              {opponent.bestCategory ? (
                <Chip size="sm" className="max-w-full truncate">
                  {opponent.bestCategory}
                </Chip>
              ) : (
                <span className="font-display text-numeral text-muted font-extrabold">—</span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function CompareRow({
  label,
  left,
  right,
  format,
  higherWins,
  reduced,
  delay,
}: {
  label: string;
  left: number | null;
  right: number | null;
  format: (value: number) => string;
  higherWins: boolean;
  reduced: boolean;
  delay: number;
}) {
  const comparable = left !== null && right !== null;

  /**
   * Where the bar splits.
   *
   * For "higher wins" the left share is its own value over the total. For Global, where a
   * smaller number is better, the shares swap — otherwise #212 would draw a longer bar
   * than #47 and the picture would say the exact opposite of the truth.
   */
  let leftShare = 0.5;
  if (comparable) {
    const total = left + right;
    if (total > 0) leftShare = higherWins ? left / total : right / total;
    // Kept off the extremes so the losing side never vanishes entirely.
    leftShare = Math.min(0.85, Math.max(0.15, leftShare));
  }

  const leftLeads = comparable && (higherWins ? left > right : left < right);
  const rightLeads = comparable && (higherWins ? right > left : right < left);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? undefined : { delay, duration: 0.3 }}
      className="flex flex-col gap-1"
    >
      {/* Label above the pair rather than under the bar. Underneath, it sat between two
          bars and belonged visually to neither; on top it captions the row it heads. */}
      <span className="text-label text-muted text-center tracking-[0.14em] uppercase">
        {label}
      </span>

      <div className="flex items-center gap-3">
        <span
          className={`font-display text-numeral w-16 shrink-0 text-right font-extrabold tabular-nums sm:w-24 ${
            leftLeads ? "text-paper" : "text-muted"
          }`}
        >
          {left === null ? "—" : format(left)}
        </span>

        <div className="bg-ink-inset flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_var(--color-line)]">
          {comparable ? (
            <>
              <motion.span
                className={leftLeads ? "bg-paper" : "bg-muted"}
                initial={reduced ? false : { width: "50%" }}
                animate={{ width: `${leftShare * 100}%` }}
                transition={
                  reduced
                    ? undefined
                    : { delay: delay + 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }
                }
              />
              {/* The divider is what makes the split legible when the two bars are close
                  in value and similar in tone. */}
              <span className="bg-ink-900 w-0.5 shrink-0" />
              <span className={`flex-1 ${rightLeads ? "bg-paper" : "bg-muted"}`} />
            </>
          ) : null}
        </div>

        <span
          className={`font-display text-numeral w-16 shrink-0 font-extrabold tabular-nums sm:w-24 ${
            rightLeads ? "text-paper" : "text-muted"
          }`}
        >
          {right === null ? "—" : format(right)}
        </span>
      </div>
    </motion.div>
  );
}


/**
 * Round intro.
 *
 * A bare "3 · 2 · 1" wastes three seconds a round. This is the natural place to
 * remind players where they stand, warn them when the multiplier has risen, and
 * tell them what is at stake — all information they otherwise have to hunt for.
 */
export function Countdown({
  endsAt,
  roundNumber,
  multiplier,
  players,
  maxHp,
  suddenDeath,
}: {
  endsAt: number | null;
  roundNumber: number;
  multiplier: number;
  players: PlayerCardData[];
  maxHp: number;
  suddenDeath: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const now = useNow(80);
  const remaining = endsAt ? Math.max(0, endsAt - now) : PHASE_DURATIONS_MS.countdown;
  const seconds = Math.ceil(remaining / 1000);

  useEffect(() => {
    if (seconds > 0) play("tick");
    else play("go");
  }, [seconds]);

  const me = players.find((player) => player.isMe);
  const opponent = players.find((player) => !player.isMe);
  const lead = me && opponent ? (me.hp ?? 0) - (opponent.hp ?? 0) : null;

  return (
    <Stage keyName="countdown" className="items-center py-14">
      <p className="text-label text-muted font-semibold tracking-[0.35em] uppercase">
        {suddenDeath ? "Sudden death" : `Round ${roundNumber}`}
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

      {multiplier > 1 && (
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Chip tone="gold">×{multiplier} damage</Chip>
        </motion.p>
      )}

      {lead !== null && (
        <p className="text-body text-secondary">
          {/* The tie branch used to read "Dead level", which was the only one of the three
              that did not name what it was measuring — so the state you see on entering
              every duel, when both players are on full health, was the least legible. */}
          {lead === 0
            ? `Level on ${me?.hp ?? 0} HP`
            : lead > 0
              ? `You lead by ${lead} HP`
              : `Behind by ${Math.abs(lead)} HP`}
        </p>
      )}

      {players.length > 1 && (
        <div className="flex w-full max-w-sm gap-3">
          {players.map((player) => (
            <div key={player.userId} className="flex flex-1 flex-col gap-1">
              <span className="text-label text-muted truncate">
                {player.isMe ? "You" : nameFor(player)}
              </span>
              <Meter
                value={player.hp ?? 0}
                max={maxHp}
                height="sm"
                tone={hpTone(player.hp ?? 0, maxHp)}
                label={`${player.isMe ? "Your" : `${nameFor(player)}'s`} health`}
              />
            </div>
          ))}
        </div>
      )}
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
export interface RevealTrack {
  title: string;
  artist: string;
  artworkUrl: string;
  releaseYear?: number;
  difficulty?: number;
  categoryName?: string | null;
}

export function RevealStage({
  track,
  results,
  players,
}: {
  track: RevealTrack | null;
  results: RoundResultEntry[];
  players: PlayerCardData[];
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("reveal");
  }, []);

  if (!track) return null;

  // Nobody got it. Worth naming explicitly — a silent scoreboard of zeroes reads
  // like a bug rather than a hard song.
  const nobodySolved = results.every((result) => !result.solved);

  return (
    <Stage keyName="reveal" className="items-center py-8 text-center">
      <motion.div
        initial={reduced ? false : { scale: 0.5, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
        className="relative"
      >
        {/* The artwork is the largest thing on screen. This is the payoff of the whole
            round — "oh, it's THAT song" — and it deserves to look like a music product
            rather than a row in a scoreboard. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.artworkUrl}
          alt=""
          className="border-line size-56 rounded-lg border object-cover sm:size-72"
        />
        {track.releaseYear ? (
          <span className="bg-paper text-ink-900 text-label absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-xs px-2 py-0.5 font-bold tabular-nums">
            {track.releaseYear}
          </span>
        ) : null}
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-3 flex flex-col items-center gap-2"
      >
        <h2 className="font-display text-display-2 text-paper font-bold text-balance">
          {track.title}
        </h2>
        <p className="text-body-lg text-secondary">{track.artist}</p>

        <div className="mt-1 flex items-center justify-center gap-2">
          {track.categoryName && (
            <Chip size="sm">{track.categoryName}</Chip>
          )}
          {track.difficulty !== undefined && (
            <Chip size="sm" title={`Difficulty ${track.difficulty} of 5`}>
              <span aria-hidden="true">
                {"●".repeat(track.difficulty)}
                <span className="text-faint">{"●".repeat(5 - track.difficulty)}</span>
              </span>
            </Chip>
          )}
        </div>
      </motion.div>

      {nobodySolved && (
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-body text-muted"
        >
          Nobody got this one.
        </motion.p>
      )}

      <div className="flex w-full flex-col gap-2">
        {results.map((result) => {
          const player = players.find((candidate) => candidate.userId === result.userId);
          return (
            <Card
              key={result.userId}
              you={player?.isMe}
              accent={player?.rankAccent}
              className="text-body flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <span className={player?.isMe ? "text-paper font-semibold" : "text-secondary"}>
                {player?.isMe ? "You" : player ? nameFor(player) : "Player"}
              </span>
              <span className="flex items-center gap-3">
                {result.solved && result.elapsedMs !== null ? (
                  <>
                    <span className="font-display text-secondary font-bold tabular-nums">
                      {(result.elapsedMs / 1000).toFixed(2)}s
                    </span>
                    <TierChip tierId={tierIdFor(result.elapsedMs)} size="sm" />
                    <span className="font-display text-paper w-12 text-right font-bold tabular-nums">
                      +{result.points}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">missed</span>
                )}
              </span>
            </Card>
          );
        })}
      </div>
    </Stage>
  );
}

/**
 * The reveal, for a solo run.
 *
 * The duel's reveal is a head-to-head — it lists every player and says "Nobody got this
 * one" when the round is dead. Neither sentence means anything with one player, so the
 * daily gets its own: what the song was, and whether you had it.
 *
 * This is the only place a daily player ever learns the answer, which is why the daily
 * results screen does not repeat the track list.
 */
export function SoloRevealStage({
  track,
  result,
  roundNumber,
  totalRounds,
}: {
  track: RevealTrack | null;
  result: RoundResultEntry | null;
  roundNumber: number;
  totalRounds: number;
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("reveal");
  }, []);

  if (!track) return null;

  const solved = result?.solved === true && result.elapsedMs !== null;

  return (
    <Stage keyName="solo-reveal" className="items-center py-8 text-center">
      <p className="text-label text-muted font-semibold tracking-[0.35em] uppercase">
        Song {roundNumber} of {totalRounds}
      </p>

      <motion.div
        initial={reduced ? false : { scale: 0.5, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
        className="relative"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.artworkUrl}
          alt=""
          className="border-line size-56 rounded-lg border object-cover sm:size-72"
        />
        {track.releaseYear ? (
          <span className="bg-paper text-ink-900 text-label absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-xs px-2 py-0.5 font-bold tabular-nums">
            {track.releaseYear}
          </span>
        ) : null}
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-3 flex flex-col items-center gap-2"
      >
        <h2 className="font-display text-display-2 text-paper font-bold text-balance">
          {track.title}
        </h2>
        <p className="text-body-lg text-secondary">{track.artist}</p>

        <div className="mt-1 flex items-center justify-center gap-2">
          {track.categoryName && <Chip size="sm">{track.categoryName}</Chip>}
          {track.difficulty !== undefined && (
            <Chip size="sm" title={`Difficulty ${track.difficulty} of 5`}>
              <span aria-hidden="true">
                {"●".repeat(track.difficulty)}
                <span className="text-faint">{"●".repeat(5 - track.difficulty)}</span>
              </span>
            </Chip>
          )}
        </div>
      </motion.div>

      {/* Stated in the second person, because there is nobody else in the run. */}
      <motion.div
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-3"
      >
        {solved ? (
          <>
            <TierChip tierId={tierIdFor(result!.elapsedMs!)} />
            <span className="font-display text-secondary text-body-lg font-bold tabular-nums">
              {(result!.elapsedMs! / 1000).toFixed(2)}s
            </span>
            <span className="font-display text-paper text-display-2 font-extrabold tabular-nums">
              +{result!.points}
            </span>
          </>
        ) : (
          <span className="text-body-lg text-muted">You didn&rsquo;t get this one.</span>
        )}
      </motion.div>
    </Stage>
  );
}

/**
 * The guess instrument.
 *
 * Shared by the duel and the daily — the act of naming a song is identical in both, and
 * this is the one screen where a difference between modes would be felt as a handling
 * bug rather than as a design.
 *
 * Bottom-anchored: the spine owns the middle; the guess field is locked to the bottom so
 * a thumb never travels and the field does not move when the keyboard opens. Every
 * millisecond spent reaching for the input is points lost.
 */
/**
 * Hear the whole song once your round is over.
 *
 * Solving or passing used to kill the audio and leave you on a silent screen until the
 * round closed — the reward for naming a song was to stop hearing it. Deliberately a
 * button rather than autoplay, since the player may not be somewhere sound is welcome,
 * but a big one: a quiet icon would leave the screen just as dead for anyone who missed it.
 */
function FullClipButton({ audio }: { audio: ReturnType<typeof useRoundAudio> }) {
  const playing = audio.phase === "freeplay";

  return (
    <Button
      variant="primary"
      size="lg"
      block
      onClick={audio.playFull}
      disabled={playing || !audio.ready}
    >
      <Glyph name="sound" />
      {playing ? "Playing…" : "Hear the full song"}
    </Button>
  );
}

export function GuessingStage({
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
  const freePlaying = audio.phase === "freeplay";

  return (
    <Stage
      keyName="guessing"
      className="min-h-[calc(100dvh-var(--match-header,7rem))] justify-between gap-4 py-4"
    >
      <div className="flex flex-1 flex-col justify-center gap-4">
        <Waveform
          analyser={audio.analyser}
          active={audio.phase === "playing" || freePlaying}
          // The score clock is correctly stopped during free play, and `displayMs` is that
          // clock — animating it would imply the round is still running for you.
          displayMs={audio.displayMs}
          /**
           * Free play is the whole song, so it renders as fully unlocked. Leaving the stage
           * frozen would draw most of the bar field as locked ghost while the track audibly
           * plays through it.
           */
          revealStage={freePlaying ? REVEAL_BEATS.length - 1 : audio.revealStage}
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
            className="flex flex-col items-center gap-3 py-4"
            role="status"
          >
            {tierThisRound && <TierChip tierId={tierThisRound} />}
            <p className="font-display text-display-1 text-paper font-extrabold tabular-nums">
              +{pointsThisRound}
            </p>
            <p className="text-body-sm text-muted">Waiting for the round to end…</p>
            <FullClipButton audio={audio} />
          </motion.div>
        ) : passed ? (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-body text-muted text-center" role="status">
              Passed. Waiting for the round to end…
            </p>
            <FullClipButton audio={audio} />
          </div>
        ) : (
          <>
            <GuessInput
              onGuess={onGuess}
              disabled={!audio.ready || audio.phase === "ended"}
              lockedUntil={lockedUntil}
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

/** Local mirror of the tier thresholds for display. Scores still come from the server. */
function tierIdFor(elapsedMs: number): string {
  if (elapsedMs < 7_000) return "snap";
  if (elapsedMs < 15_000) return "quick";
  if (elapsedMs < 23_000) return "solid";
  return "late";
}

export interface DamageEntry {
  userId: string;
  damage: number;
  hpAfter: number;
}

/**
 * HP bars draining with the damage number flying off — a fighting-game hit.
 *
 * The information is the same as an ordinary scoreboard, but framed as a
 * consequence rather than a table, which is what makes a duel feel like a fight.
 */
export function StandingsStage({
  players,
  damage,
  maxHp,
  roundWinnerId,
  nextMultiplier,
  multiplier,
  outcome,
  timeGapMs,
}: {
  players: PlayerCardData[];
  damage: DamageEntry[];
  maxHp: number;
  roundWinnerId: string | null;
  nextMultiplier: number;
  multiplier: number;
  outcome: string | null;
  timeGapMs: number | null;
}) {
  const reduced = usePrefersReducedMotion();

  const hpFor = (userId: string) =>
    damage.find((entry) => entry.userId === userId)?.hpAfter ?? maxHp;
  const damageFor = (userId: string) =>
    damage.find((entry) => entry.userId === userId)?.damage ?? 0;

  useEffect(() => {
    if (damage.some((entry) => entry.damage > 0)) play("wrong");
  }, [damage]);

  const ordered = [...players].sort((a, b) => hpFor(b.userId) - hpFor(a.userId));
  const winner = players.find((player) => player.userId === roundWinnerId);
  const me = players.find((player) => player.isMe);
  const opponent = players.find((player) => !player.isMe);
  const lead = me && opponent ? hpFor(me.userId) - hpFor(opponent.userId) : null;

  return (
    <Stage keyName="standings" className="py-10">
      {/* Name the outcome AND the reason. A same-tier loss with a silent bar reads
          as arbitrary when both players clearly got the song. */}
      <motion.div
        initial={reduced ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="text-center"
      >
        {/* The result is stated without softening. A round you lost says so. */}
        {outcome === "song" ? (
          <>
            <p className="font-display text-display-2 text-gold flex items-center justify-center gap-2 font-extrabold">
              <Glyph name="song" />
              THE SONG WINS
            </p>
            <p className="text-body text-secondary mt-1">
              Neither of you got it. It takes a bite out of you both.
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-display-2 font-extrabold">
              {winner ? (
                winner.isMe ? (
                  <span className="text-paper">ROUND WON</span>
                ) : (
                  <span className="text-signal-text">ROUND LOST</span>
                )
              ) : (
                <span className="text-muted">ROUND DRAWN</span>
              )}
            </p>

            <p className="text-body text-secondary mt-1">
              {outcome === "time" && timeGapMs !== null
                ? `Same call — decided by ${(timeGapMs / 1000).toFixed(2)}s`
                : winner && !winner.isMe
                  ? `${nameFor(winner)} was on a faster tier`
                  : "Faster tier wins"}
            </p>
          </>
        )}

        {outcome !== "song" && winner && (winner.streak ?? 0) > 1 && (
          <p className="mt-2 flex items-center justify-center">
            <Chip tone="gold">
              <Glyph name="streak" />
              {winner.streak} in a row
            </Chip>
          </p>
        )}
      </motion.div>

      <div className="flex flex-col gap-5">
        {ordered.map((player) => {
          const hp = hpFor(player.userId);
          const hit = damageFor(player.userId);
          const dead = hp <= 0;
          const pct = Math.max(0, (hp / maxHp) * 100);

          return (
            <motion.div
              key={player.userId}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex flex-col gap-1.5"
            >
              <div className="text-body flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={player.isMe ? "text-paper font-semibold" : "text-secondary"}>
                    {player.isMe ? "You" : nameFor(player)}
                  </span>
                  {player.isBot && <BotBadge />}
                  {dead && (
                    <Chip tone="signal" size="sm">
                      <Glyph name="damage" />
                      ELIMINATED
                    </Chip>
                  )}
                </span>
                <span className="flex items-baseline gap-3">
                  {hit > 0 && (
                    <motion.span
                      initial={reduced ? false : { opacity: 0, y: 0, scale: 1.5 }}
                      animate={{ opacity: [1, 1, 0], y: -22, scale: 1 }}
                      transition={{ duration: 1.2, times: [0, 0.55, 1] }}
                      className="font-display text-display-2 text-signal-text font-extrabold tabular-nums"
                    >
                      −{hit}
                    </motion.span>
                  )}
                  <span className="font-display text-display-2 text-paper font-extrabold tabular-nums">
                    {hp}
                  </span>
                </span>
              </div>

              {/* Health is how brightly you are still burning: full is paper-bright,
                  low is an ember, zero goes out. Both bars use the same ramp — whose
                  row is whose is carried by the label, not by hue. */}
              <div className="bg-ink-inset relative h-4 overflow-hidden rounded-full">
                {/* Ghost bar showing the health that was just lost. */}
                {hit > 0 && !reduced && (
                  <motion.div
                    className="bg-signal absolute inset-y-0 left-0 rounded-full opacity-50"
                    initial={{ width: `${((hp + hit) / maxHp) * 100}%` }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.85, duration: 0.5, ease: "easeIn" }}
                  />
                )}
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    { paper: "bg-paper", gold: "bg-gold", signal: "bg-signal", muted: "bg-muted" }[
                      hpTone(hp, maxHp)
                    ]
                  }`}
                  initial={reduced ? false : { width: `${((hp + hit) / maxHp) * 100}%` }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.25, duration: 0.7, ease: "easeOut" }}
                />
              </div>

              <div className="text-label text-muted flex justify-between gap-3">
                <span>
                  {player.roundsWon ?? 0} round{(player.roundsWon ?? 0) === 1 ? "" : "s"} won
                  {player.bestMs != null && ` · best ${(player.bestMs / 1000).toFixed(2)}s`}
                </span>
                <span className="tabular-nums">{Math.round(pct)}%</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        {lead !== null && (
          <span
            className={`text-body-sm font-semibold ${
              lead > 0 ? "text-paper" : lead < 0 ? "text-signal-text" : "text-muted"
            }`}
          >
            {lead === 0
              ? `Level on ${me ? hpFor(me.userId) : 0} HP`
              : lead > 0
                ? `You lead by ${lead}`
                : `Behind by ${Math.abs(lead)}`}
          </span>
        )}
        {nextMultiplier > multiplier && (
          <Chip tone="gold" size="sm">×{nextMultiplier} next round</Chip>
        )}
      </div>
    </Stage>
  );
}

/**
 * Momentum beat every few rounds, which also announces the multiplier stepping up.
 *
 * The escalating multiplier is what guarantees a duel ends, so it deserves to be
 * announced rather than silently applied.
 */
export function MilestoneStage({
  roundNumber,
  multiplier,
  players,
  maxHp,
}: {
  roundNumber: number;
  multiplier: number;
  players: PlayerCardData[];
  maxHp: number;
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("podium");
  }, []);

  return (
    <Stage keyName={`milestone-${roundNumber}`} className="items-center py-16 text-center">
      <p className="text-label text-muted font-semibold tracking-[0.3em] uppercase">
        {roundNumber} rounds in
      </p>

      <motion.h2
        initial={reduced ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={snap}
        className="font-display text-display-1 text-gold font-extrabold tabular-nums"
      >
        ×{multiplier} DAMAGE
      </motion.h2>
      <p className="text-body text-secondary">Every mistake costs more from here.</p>

      {/* Match stats so far. A milestone that only announces a number is a pause;
          one that shows how the duel is actually going is a moment. */}
      <div className="flex w-full flex-col gap-3">
        {[...players]
          .sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0))
          .map((player) => (
            <Card
              key={player.userId}
              you={player.isMe}
              accent={player.rankAccent}
              className="flex flex-col gap-2.5 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-body flex min-w-0 items-center gap-2 font-semibold">
                  <span className="truncate">
                    {player.isMe ? "You" : nameFor(player)}
                  </span>
                  {player.isBot && <BotBadge />}
                </span>
                <span className="font-display text-display-2 font-extrabold tabular-nums">
                  {player.hp ?? 0}
                  <span className="text-body-sm text-muted ml-1 font-normal">HP</span>
                </span>
              </div>

              <Meter
                value={player.hp ?? 0}
                max={maxHp}
                tone={hpTone(player.hp ?? 0, maxHp)}
                label={`${player.isMe ? "Your" : `${nameFor(player)}'s`} health`}
              />

              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Rounds won" value={String(player.roundsWon ?? 0)} />
                <Metric
                  label="Fastest"
                  value={player.bestMs != null ? `${(player.bestMs / 1000).toFixed(2)}s` : "—"}
                />
                <Metric
                  label="Streak"
                  value={(player.streak ?? 0) > 0 ? String(player.streak) : "—"}
                />
              </div>
            </Card>
          ))}
      </div>
    </Stage>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-label text-muted font-semibold tracking-wider uppercase">{label}</span>
      <span className="font-display text-body text-paper font-bold tabular-nums">{value}</span>
    </div>
  );
}
