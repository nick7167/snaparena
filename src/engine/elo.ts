/**
 * Rating system: overall Elo from match results, plus a slower per-category
 * rating derived from head-to-head performance on individual tracks.
 */

import {
  ELO_FLOOR,
  ESTABLISHED_AFTER_GAMES,
  K_CATEGORY,
  K_EARLY,
  K_ESTABLISHED,
  K_PLACEMENT,
  PLACEMENT_MATCHES,
} from "./config";

/** Outcome from one player's perspective. */
export type Outcome = 1 | 0.5 | 0;

export const WIN: Outcome = 1;
export const DRAW: Outcome = 0.5;
export const LOSS: Outcome = 0;

/** Probability that a player rated `rating` beats one rated `opponentRating`. */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

/**
 * K-factor for a player's next match. High during placements so ratings converge
 * quickly from the starting value, then progressively damped.
 */
export function kFactor(gamesPlayed: number): number {
  if (gamesPlayed < PLACEMENT_MATCHES) return K_PLACEMENT;
  if (gamesPlayed < ESTABLISHED_AFTER_GAMES) return K_EARLY;
  return K_ESTABLISHED;
}

export interface RatingUpdate {
  readonly rating: number;
  readonly delta: number;
  readonly gamesPlayed: number;
  /** Placement matches still owed. No rank badge is shown while this is > 0. */
  readonly placementsRemaining: number;
}

/**
 * Applies one match result to a player's overall rating.
 *
 * A forfeit (disconnect) is passed through as a normal LOSS — without full Elo
 * loss on disconnect, players simply close the tab when behind.
 */
export function applyMatchResult(params: {
  rating: number;
  opponentRating: number;
  outcome: Outcome;
  gamesPlayed: number;
}): RatingUpdate {
  const { rating, opponentRating, outcome, gamesPlayed } = params;

  const k = kFactor(gamesPlayed);
  const expected = expectedScore(rating, opponentRating);
  const rawDelta = k * (outcome - expected);

  const unflooredRating = rating + rawDelta;
  const nextRating = Math.max(ELO_FLOOR, Math.round(unflooredRating));
  const nextGamesPlayed = gamesPlayed + 1;

  return {
    rating: nextRating,
    // Report the delta actually applied, so a floored loss doesn't display a
    // drop the player never took.
    delta: nextRating - rating,
    gamesPlayed: nextGamesPlayed,
    placementsRemaining: Math.max(0, PLACEMENT_MATCHES - nextGamesPlayed),
  };
}

export interface CategoryRoundResult {
  readonly categoryId: string;
  /** This player's points on the track. */
  readonly playerPoints: number;
  /** The opponent's points on the same track. */
  readonly opponentPoints: number;
}

export interface CategoryRatingUpdate {
  readonly categoryId: string;
  readonly rating: number;
  readonly delta: number;
  readonly games: number;
}

/**
 * Updates per-category ratings from a completed match.
 *
 * Each of the match's tracks is treated as its own head-to-head at low K — one
 * track is a tiny sample, so these ratings are deliberately slow to move. Several
 * tracks in a match may share a category; each contributes an update in sequence.
 */
export function applyCategoryResults(params: {
  results: readonly CategoryRoundResult[];
  currentRatings: Readonly<Record<string, { rating: number; games: number }>>;
  opponentRatings: Readonly<Record<string, { rating: number; games: number }>>;
  defaultRating: number;
}): CategoryRatingUpdate[] {
  const { results, currentRatings, opponentRatings, defaultRating } = params;

  const working = new Map<string, { rating: number; games: number; startRating: number }>();

  for (const result of results) {
    const existing =
      working.get(result.categoryId) ??
      (() => {
        const start = currentRatings[result.categoryId]?.rating ?? defaultRating;
        const entry = {
          rating: start,
          games: currentRatings[result.categoryId]?.games ?? 0,
          startRating: start,
        };
        working.set(result.categoryId, entry);
        return entry;
      })();

    const opponentRating = opponentRatings[result.categoryId]?.rating ?? defaultRating;

    const outcome: Outcome =
      result.playerPoints > result.opponentPoints
        ? WIN
        : result.playerPoints < result.opponentPoints
          ? LOSS
          : DRAW;

    const expected = expectedScore(existing.rating, opponentRating);
    existing.rating = Math.max(ELO_FLOOR, existing.rating + K_CATEGORY * (outcome - expected));
    existing.games += 1;
  }

  return [...working.entries()].map(([categoryId, entry]) => ({
    categoryId,
    rating: Math.round(entry.rating),
    delta: Math.round(entry.rating) - Math.round(entry.startRating),
    games: entry.games,
  }));
}

/**
 * Decides a match from per-round points. Used for both ranked and rooms.
 * Returns the outcome from player A's perspective.
 */
export function outcomeFromScores(scoreA: number, scoreB: number): Outcome {
  if (scoreA > scoreB) return WIN;
  if (scoreA < scoreB) return LOSS;
  return DRAW;
}
