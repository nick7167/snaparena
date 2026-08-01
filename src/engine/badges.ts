/**
 * Badges.
 *
 * Every badge is derived from data already written during normal play — guesses,
 * match results, set outcomes — so earning one never needs its own bookkeeping.
 * They surface on the VS screen, where a stacked row is the fastest read of who
 * you are up against.
 */

export interface BadgeDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly emoji: string;
  /** Ordering on a player card; lower shows first. */
  readonly sortOrder: number;
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: "first_blood",
    name: "First Blood",
    description: "Win your first ranked match",
    emoji: "🩸",
    sortOrder: 10,
  },
  {
    id: "snap_10",
    name: "Snap Caller",
    description: "Land 10 guesses on the 1-second clip",
    emoji: "⚡",
    sortOrder: 20,
  },
  {
    id: "snap_100",
    name: "Perfect Pitch",
    description: "Land 100 guesses on the 1-second clip",
    emoji: "🎯",
    sortOrder: 21,
  },
  {
    id: "perfect_set",
    name: "Perfect Set",
    description: "Win every song in a set",
    emoji: "🔥",
    sortOrder: 30,
  },
  {
    id: "comeback",
    name: "Comeback King",
    description: "Win a match after losing the first set",
    emoji: "👑",
    sortOrder: 40,
  },
  {
    id: "sudden_death",
    name: "Nerves of Steel",
    description: "Win a sudden-death decider",
    emoji: "🥶",
    sortOrder: 50,
  },
  {
    id: "giant_slayer",
    name: "Giant Slayer",
    description: "Beat an opponent rated 200+ above you",
    emoji: "🗡️",
    sortOrder: 60,
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Play 100 ranked matches",
    emoji: "🏅",
    sortOrder: 70,
  },
] as const;

export function badgeById(id: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.id === id);
}

/** Sorts a player's earned badge ids into display order, dropping unknown ids. */
export function sortBadges(ids: readonly string[]): BadgeDefinition[] {
  return ids
    .map(badgeById)
    .filter((badge): badge is BadgeDefinition => badge !== undefined)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Everything needed to decide which badges a completed match earned. */
export interface BadgeContext {
  readonly mode: "ranked" | "room" | "daily";
  readonly won: boolean;
  /** Career totals *including* this match. */
  readonly totalRankedWins: number;
  readonly totalRankedMatches: number;
  readonly totalSnapGuesses: number;
  /** True if any set was won with a clean sweep of its songs. */
  readonly hadPerfectSet: boolean;
  /** True if the player lost set 1 and still won the match. */
  readonly wonAfterLosingFirstSet: boolean;
  readonly wonSuddenDeath: boolean;
  readonly opponentEloAdvantage: number;
}

/**
 * Returns badge ids the match qualifies for.
 *
 * Callers filter against what the player already holds — this deliberately does not
 * know about prior awards, so it stays a pure function of the match.
 */
export function evaluateBadges(context: BadgeContext): string[] {
  const earned: string[] = [];

  if (context.mode === "ranked" && context.won && context.totalRankedWins >= 1) {
    earned.push("first_blood");
  }
  if (context.totalSnapGuesses >= 10) earned.push("snap_10");
  if (context.totalSnapGuesses >= 100) earned.push("snap_100");
  if (context.hadPerfectSet) earned.push("perfect_set");
  if (context.won && context.wonAfterLosingFirstSet) earned.push("comeback");
  if (context.won && context.wonSuddenDeath) earned.push("sudden_death");
  if (context.mode === "ranked" && context.won && context.opponentEloAdvantage >= 200) {
    earned.push("giant_slayer");
  }
  if (context.mode === "ranked" && context.totalRankedMatches >= 100) {
    earned.push("centurion");
  }

  return earned;
}
