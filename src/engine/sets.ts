/**
 * Set and match resolution for the best-of-3 format.
 *
 * A set is SONGS_PER_SET songs. Ranked is first-to-2-sets, so a match runs 6 songs
 * if someone takes the first two and 9 if it goes the distance. Rooms always play
 * the full three sets — see resolveRoomMatch() for why.
 */

import {
  MAX_SETS,
  ROOM_SETS,
  SETS_TO_WIN,
  SONGS_PER_SET,
} from "./config";

/** One player's performance across the songs of a single set. */
export interface SetPlayerResult {
  readonly userId: string;
  readonly points: number;
  /**
   * Summed reaction time across the set, used only to break a points tie.
   * Unsolved songs should contribute the full round duration so that failing to
   * answer is never rewarded over answering slowly.
   */
  readonly totalElapsedMs: number;
}

export interface SetOutcome {
  /** Undefined when the set is genuinely drawn — possible with 3+ players. */
  readonly winnerId: string | undefined;
  /** Every player, best first. */
  readonly standings: readonly SetPlayerResult[];
  /** True when the points tie was resolved by reaction time rather than score. */
  readonly decidedOnTime: boolean;
}

/**
 * Ranks players within a set: most points wins, and a tie falls to whoever was
 * faster overall.
 *
 * Tier scoring produces far more exact ties than the old continuous curve did, so
 * the time tiebreak is load-bearing rather than a formality.
 */
export function resolveSet(results: readonly SetPlayerResult[]): SetOutcome {
  if (results.length === 0) {
    return { winnerId: undefined, standings: [], decidedOnTime: false };
  }

  const standings = [...results].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.totalElapsedMs - b.totalElapsedMs;
  });

  const [best, runnerUp] = standings;

  // Nobody scored: the set is drawn rather than awarded to whoever idled fastest.
  if (best.points === 0) {
    return { winnerId: undefined, standings, decidedOnTime: false };
  }

  if (!runnerUp) {
    return { winnerId: best.userId, standings, decidedOnTime: false };
  }

  const tiedOnPoints = best.points === runnerUp.points;
  const alsoTiedOnTime = tiedOnPoints && best.totalElapsedMs === runnerUp.totalElapsedMs;

  return {
    winnerId: alsoTiedOnTime ? undefined : best.userId,
    standings,
    decidedOnTime: tiedOnPoints && !alsoTiedOnTime,
  };
}

export interface MatchProgress {
  /** Sets won, keyed by user id. Players with no set wins may be omitted. */
  readonly setsWon: Readonly<Record<string, number>>;
  readonly setsPlayed: number;
}

export type MatchStatus =
  | { readonly kind: "continue"; readonly nextSetIndex: number }
  | { readonly kind: "sudden-death" }
  | { readonly kind: "complete"; readonly winnerId: string | undefined };

/**
 * Decides what happens after a ranked set closes.
 *
 * Reaching SETS_TO_WIN ends the match immediately — there is no point playing a
 * dead third set once someone is 2-0 up.
 */
export function resolveRankedMatch(progress: MatchProgress): MatchStatus {
  const entries = Object.entries(progress.setsWon);

  for (const [userId, won] of entries) {
    if (won >= SETS_TO_WIN) return { kind: "complete", winnerId: userId };
  }

  if (progress.setsPlayed < MAX_SETS) {
    return { kind: "continue", nextSetIndex: progress.setsPlayed };
  }

  // All sets played without anyone reaching the target. This happens when a set is
  // drawn, so 1-1-drawn or 0-0-0 both land here; a single song settles it.
  const ranked = entries.sort((a, b) => b[1] - a[1]);
  const [leader, second] = ranked;

  if (leader && (!second || leader[1] > second[1])) {
    return { kind: "complete", winnerId: leader[0] };
  }

  return { kind: "sudden-death" };
}

/**
 * Rooms play a fixed three sets and rank by sets won.
 *
 * First-to-2 does not work in a free-for-all: with eight players the set wins
 * scatter and the match can run indefinitely without anyone reaching the target.
 * A fixed length also means every player knows exactly how long they are committing
 * to, and a per-set podium gives everyone something to win even if they lose overall.
 */
export function resolveRoomMatch(params: {
  setsWon: Readonly<Record<string, number>>;
  totalPoints: Readonly<Record<string, number>>;
}): { winnerId: string | undefined; standings: readonly string[] } {
  const userIds = new Set([
    ...Object.keys(params.setsWon),
    ...Object.keys(params.totalPoints),
  ]);

  const standings = [...userIds].sort((a, b) => {
    const setsDelta = (params.setsWon[b] ?? 0) - (params.setsWon[a] ?? 0);
    if (setsDelta !== 0) return setsDelta;
    return (params.totalPoints[b] ?? 0) - (params.totalPoints[a] ?? 0);
  });

  const [best, runnerUp] = standings;
  if (!best) return { winnerId: undefined, standings };

  const drawn =
    runnerUp !== undefined &&
    (params.setsWon[best] ?? 0) === (params.setsWon[runnerUp] ?? 0) &&
    (params.totalPoints[best] ?? 0) === (params.totalPoints[runnerUp] ?? 0);

  return { winnerId: drawn ? undefined : best, standings };
}

/** Total songs a mode needs to draw up front. */
export function songsNeededFor(mode: "ranked" | "room" | "daily", dailySongs: number): number {
  if (mode === "daily") return dailySongs;
  // Ranked may finish early at SETS_TO_WIN, but tracks are drawn once at match start
  // so the full-distance count is what must be reserved.
  return (mode === "room" ? ROOM_SETS : MAX_SETS) * SONGS_PER_SET;
}

/** Zero-based set index a given round belongs to. */
export function setIndexForRound(roundIndex: number): number {
  return Math.floor(roundIndex / SONGS_PER_SET);
}

/** True when this round closes a set. */
export function isLastRoundOfSet(roundIndex: number): boolean {
  return (roundIndex + 1) % SONGS_PER_SET === 0;
}
