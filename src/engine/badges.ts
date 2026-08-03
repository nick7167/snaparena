import type { GameMode } from "./config";

/**
 * Badges.
 *
 * Every badge is derived from data already written during normal play — guesses,
 * match results, set outcomes — so earning one never needs its own bookkeeping.
 * They surface on the VS screen, where a stacked row is the fastest read of who
 * you are up against.
 */

/**
 * The colour a badge is drawn in.
 *
 * Five tones, not eight — drawn from the palette the rest of the app already uses, with
 * the meanings it already assigns. Colour carries information here: gold is reward,
 * signal is damage, paper is the top of every ladder. Giving each badge its own invented
 * hue would look livelier and would quietly break all of that, so badges borrow meaning
 * rather than adding to it.
 *
 *   signal   pressure and blood — the ones won under threat
 *   gold     reward and momentum
 *   paper    the brightest achievements, the same tone SNAP and Legend hold
 *   teal     clean, untouched
 *   neutral  endurance; earned by volume rather than brilliance
 */
export type BadgeTone = "signal" | "gold" | "paper" | "teal" | "neutral";

export interface BadgeDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly emoji: string;
  readonly tone: BadgeTone;
  /** Ordering on a player card; lower shows first. */
  readonly sortOrder: number;
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    id: "first_blood",
    name: "First Blood",
    description: "Win your first ranked match",
    emoji: "🩸",
    tone: "signal",
    sortOrder: 10,
  },
  {
    id: "snap_10",
    name: "Snap Caller",
    description: "Land 10 guesses on the 1-second clip",
    emoji: "⚡",
    tone: "gold",
    sortOrder: 20,
  },
  {
    id: "snap_100",
    name: "Perfect Pitch",
    description: "Land 100 guesses on the 1-second clip",
    emoji: "🎯",
    tone: "paper",
    sortOrder: 21,
  },
  {
    id: "flawless",
    name: "Flawless",
    description: "Win a duel without losing a single point of health",
    emoji: "🔥",
    tone: "teal",
    sortOrder: 30,
  },
  {
    id: "comeback",
    name: "Comeback King",
    description: "Win a duel after dropping below a quarter health",
    emoji: "👑",
    tone: "gold",
    sortOrder: 40,
  },
  {
    id: "sudden_death",
    name: "Nerves of Steel",
    description: "Win a sudden-death decider",
    emoji: "🥶",
    tone: "signal",
    sortOrder: 50,
  },
  {
    id: "giant_slayer",
    name: "Giant Slayer",
    description: "Beat an opponent rated 200+ above you",
    emoji: "🗡️",
    tone: "paper",
    sortOrder: 60,
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Play 100 ranked matches",
    emoji: "🏅",
    tone: "neutral",
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
  readonly mode: GameMode;
  readonly won: boolean;
  /** Career totals *including* this match. */
  readonly totalRankedWins: number;
  readonly totalRankedMatches: number;
  readonly totalSnapGuesses: number;
  /** True if the player finished the duel on full health. */
  readonly tookNoDamage: boolean;
  /** True if the player dropped below a quarter health and still won. */
  readonly wonFromCritical: boolean;
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
  if (context.won && context.tookNoDamage) earned.push("flawless");
  if (context.won && context.wonFromCritical) earned.push("comeback");
  if (context.won && context.wonSuddenDeath) earned.push("sudden_death");
  if (context.mode === "ranked" && context.won && context.opponentEloAdvantage >= 200) {
    earned.push("giant_slayer");
  }
  if (context.mode === "ranked" && context.totalRankedMatches >= 100) {
    earned.push("centurion");
  }

  return earned;
}
