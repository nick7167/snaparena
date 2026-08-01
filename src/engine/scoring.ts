/**
 * Scoring and the ping-neutral score clock.
 *
 * A guess scores by *which clip the player had heard when they answered*, not by a
 * continuously draining number. The tier is the thing worth bragging about — "I got
 * it on the 1-second clip" — and that shareable achievement is what a music guessing
 * game spreads on. Exact milliseconds are still recorded, but only to break ties.
 */

import {
  CLIENT_CLOCK_TOLERANCE_MS,
  MIN_HUMAN_REACTION_MS,
  REVEAL_BEATS,
  ROUND_DURATION_MS,
  SCORE_TIERS,
  type RevealBeat,
  type ScoreTier,
  type ScoreTierId,
} from "./config";

/** The reveal beat active at a given point in the round. */
export function revealBeatAt(roundElapsedMs: number): RevealBeat {
  let active = REVEAL_BEATS[0];
  for (const beat of REVEAL_BEATS) {
    if (roundElapsedMs >= beat.atRoundMs) active = beat;
  }
  return active;
}

/**
 * Zero-based index of the active reveal beat. Doubles as the score-tier index —
 * tiers and reveal beats are intentionally the same list, so how much of the song
 * you heard and what you can score are never out of step.
 */
export function revealStageAt(roundElapsedMs: number): number {
  let stage = 0;
  for (let i = 0; i < REVEAL_BEATS.length; i++) {
    if (roundElapsedMs >= REVEAL_BEATS[i].atRoundMs) stage = i;
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
export function scoreForGuess(elapsedMs: number): GuessScore {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : ROUND_DURATION_MS;
  const tier = SCORE_TIERS[revealStageAt(safeElapsed)];

  return {
    tier,
    points: safeElapsed >= ROUND_DURATION_MS ? 0 : tier.points,
    elapsedMs: safeElapsed,
  };
}

/** Tier a given elapsed time falls in, without computing a score. */
export function tierForElapsed(elapsedMs: number): ScoreTier {
  return SCORE_TIERS[revealStageAt(Math.max(0, elapsedMs))];
}

export function tierById(id: ScoreTierId): ScoreTier {
  const tier = SCORE_TIERS.find((candidate) => candidate.id === id);
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
 */
export function validateClientClock(input: ClockValidationInput): ClockValidation {
  const { clientElapsedMs, serverObservedElapsedMs, previousClientElapsedMs } = input;

  if (!Number.isFinite(clientElapsedMs) || clientElapsedMs < MIN_HUMAN_REACTION_MS) {
    return { valid: false, rejection: "below-human-floor" };
  }

  if (clientElapsedMs > serverObservedElapsedMs + CLIENT_CLOCK_TOLERANCE_MS) {
    return { valid: false, rejection: "exceeds-server-window" };
  }

  if (clientElapsedMs >= ROUND_DURATION_MS) {
    return { valid: false, rejection: "round-over" };
  }

  if (previousClientElapsedMs !== undefined && clientElapsedMs <= previousClientElapsedMs) {
    return { valid: false, rejection: "not-monotonic" };
  }

  return { valid: true, elapsedMs: clientElapsedMs };
}

/**
 * Diagnostic for balance tuning: what a cheater gains by identifying the track
 * with an external app instead of knowing it.
 *
 * Surfaced in tests so that retuning SCORE_TIERS immediately shows its effect on
 * cheat viability rather than silently weakening it.
 */
export function shazamMarginReport(externalLookupMs = 8_000) {
  const honestInstant = scoreForGuess(1_000).points;
  const cheated = scoreForGuess(externalLookupMs).points;
  return {
    honestInstant,
    cheated,
    /** Fraction of an honest fast guess that cheating still earns. Lower is better. */
    cheatRatio: cheated / honestInstant,
  };
}
