/**
 * Scoring and the ping-neutral score clock.
 *
 * A guess scores by *which clip the player had heard when they answered*, not by a
 * continuously draining number. The tier is the thing worth bragging about — "I got
 * it on the 1-second clip" — and that shareable achievement is what a music guessing
 * game spreads on. Exact milliseconds are still recorded, but only to break ties.
 */

import type { RevealBeat, ScoreTier, ScoreTierId } from "./config";
import type { ResolvedConfig } from "./config-merge";

/**
 * Config is a parameter, not an import — see the note in `xp.ts`.
 *
 * It matters more here than anywhere else: a match resolves its config ONCE, at creation,
 * and every round of that match scores through the same object. Reading module scope
 * instead would let a save mid-duel change the score curve between two rounds of the same
 * game, which is precisely what the snapshot exists to prevent.
 */

/** The reveal beat active at a given point in the round. */
export function revealBeatAt(roundElapsedMs: number, config: ResolvedConfig): RevealBeat {
  let active = config.REVEAL_BEATS[0];
  for (const beat of config.REVEAL_BEATS) {
    if (roundElapsedMs >= beat.atRoundMs) active = beat;
  }
  return active;
}

/**
 * Zero-based index of the active reveal beat. Doubles as the score-tier index —
 * tiers and reveal beats are intentionally the same list, so how much of the song
 * you heard and what you can score are never out of step.
 */
export function revealStageAt(roundElapsedMs: number, config: ResolvedConfig): number {
  let stage = 0;
  for (let i = 0; i < config.REVEAL_BEATS.length; i++) {
    if (roundElapsedMs >= config.REVEAL_BEATS[i].atRoundMs) stage = i;
  }
  return stage;
}

export interface GuessScore {
  readonly tier: ScoreTier;
  readonly points: number;
  /** Kept for tiebreaks and stats. Never shown as the score itself. */
  readonly elapsedMs: number;
}

/**
 * Scores a correct guess submitted `elapsedMs` into the round.
 *
 * Returns zero points past the round clock so a late-arriving submission cannot
 * score, but still reports the tier it would have fallen in for display.
 */
export function scoreForGuess(elapsedMs: number, config: ResolvedConfig): GuessScore {
  const safeElapsed = Number.isFinite(elapsedMs)
    ? Math.max(0, elapsedMs)
    : config.ROUND_DURATION_MS;
  const tier = config.SCORE_TIERS[revealStageAt(safeElapsed, config)];

  return {
    tier,
    points: safeElapsed >= config.ROUND_DURATION_MS ? 0 : tier.points,
    elapsedMs: safeElapsed,
  };
}

/** Tier a given elapsed time falls in, without computing a score. */
export function tierForElapsed(elapsedMs: number, config: ResolvedConfig): ScoreTier {
  return config.SCORE_TIERS[revealStageAt(Math.max(0, elapsedMs), config)];
}

export function tierById(id: ScoreTierId, config: ResolvedConfig): ScoreTier {
  const tier = config.SCORE_TIERS.find((candidate) => candidate.id === id);
  if (!tier) throw new Error(`Unknown score tier: ${id}`);
  return tier;
}

export type ClockRejection =
  | "below-human-floor"
  | "exceeds-server-window"
  | "not-monotonic"
  | "round-over";

export interface ClockValidationInput {
  /** Elapsed time the client measured locally, via performance.now(). */
  readonly clientElapsedMs: number;
  /**
   * Elapsed time the *server* observed between dispatching the round and
   * receiving this guess. Always >= the client's figure in honest play, because
   * it includes network latency in both directions.
   */
  readonly serverObservedElapsedMs: number;
  /** Highest clientElapsedMs already accepted from this player this round. */
  readonly previousClientElapsedMs?: number;
}

export type ClockValidation =
  | { readonly valid: true; readonly elapsedMs: number }
  | { readonly valid: false; readonly rejection: ClockRejection };

/**
 * Validates a client-reported reaction time before it is allowed to score.
 *
 * The client measures its own elapsed time so that network latency does not
 * decide who wins — otherwise a 200ms player structurally cannot beat a 40ms
 * player, and Elo partly measures geography. The trade is that the value is
 * self-reported, so it is bounded from both directions here.
 *
 * The lower bound is an ABSOLUTE floor, not one relative to the round's start, and that is
 * deliberate. `serverObservedElapsedMs` is measured from the moment `enterPhase("guessing")`
 * committed — before the subscription reached the client, before the clip decoded — so on a
 * slow mobile connection an honest first guess legitimately sits seconds behind it. A
 * relative lower bound here would reject real players. What it therefore cannot catch is a
 * player who delays the START of their own clock; that is bounded on the client instead, by
 * STARTUP_GRACE_MS in useRoundAudio, where the delay is actually observable.
 */
export function validateClientClock(
  input: ClockValidationInput,
  config: ResolvedConfig,
): ClockValidation {
  const { clientElapsedMs, serverObservedElapsedMs, previousClientElapsedMs } = input;

  if (!Number.isFinite(clientElapsedMs) || clientElapsedMs < config.MIN_HUMAN_REACTION_MS) {
    return { valid: false, rejection: "below-human-floor" };
  }

  if (clientElapsedMs > serverObservedElapsedMs + config.CLIENT_CLOCK_TOLERANCE_MS) {
    return { valid: false, rejection: "exceeds-server-window" };
  }

  if (clientElapsedMs >= config.ROUND_DURATION_MS) {
    return { valid: false, rejection: "round-over" };
  }

  if (previousClientElapsedMs !== undefined && clientElapsedMs <= previousClientElapsedMs) {
    return { valid: false, rejection: "not-monotonic" };
  }

  return { valid: true, elapsedMs: clientElapsedMs };
}

/**
 * Whether a round is over by the SERVER's clock, regardless of what any client claims.
 *
 * `validateClientClock` cannot answer this and was never able to. It bounds a claim
 * against how long the server has been waiting, and that window only ever grows — so it
 * catches a client claiming to be faster than physically possible, and waves through a
 * client claiming a fresh two seconds against a window an hour wide.
 *
 * That gap was reachable whenever a round outlived the transition meant to close it. Hear
 * the song, close the tab, come back later, and the round is still open with the audio
 * clock starting again from zero — full marks for a track you already knew. Measuring from
 * the server's clock closes it for every way of leaving.
 *
 * Note this bounds only the round as a whole. A late FIRST anchor inside a still-live round
 * is a different move through the same door, and is bounded on the client by
 * STARTUP_GRACE_MS in useRoundAudio — see the note on the lower bound below.
 */
export function roundHasExpired(
  serverObservedElapsedMs: number,
  config: ResolvedConfig,
): boolean {
  return serverObservedElapsedMs > config.ROUND_DURATION_MS + config.CLIENT_CLOCK_TOLERANCE_MS;
}

/**
 * Diagnostic for balance tuning: what a cheater gains by identifying the track
 * with an external app instead of knowing it.
 *
 * Surfaced in tests so that retuning SCORE_TIERS immediately shows its effect on
 * cheat viability rather than silently weakening it.
 */
export function shazamMarginReport(config: ResolvedConfig, externalLookupMs = 8_000) {
  const honestInstant = scoreForGuess(1_000, config).points;
  const cheated = scoreForGuess(externalLookupMs, config).points;
  return {
    honestInstant,
    cheated,
    /** Fraction of an honest fast guess that cheating still earns. Lower is better. */
    cheatRatio: cheated / honestInstant,
  };
}
