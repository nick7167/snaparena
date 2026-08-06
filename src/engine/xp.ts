/**
 * XP and levels.
 *
 * XP is awarded by every mode so that casual play always advances something, and it
 * never decreases — losing a ranked match still moves your level bar, which is what
 * keeps a bad session from feeling wasted.
 */

import type { GameMode } from "./config";
import type { ResolvedConfig } from "./config-merge";

/**
 * Config arrives as a parameter rather than an import.
 *
 * These values are editable from the admin console at runtime, so a module-scope import
 * would freeze whatever was shipped. Required rather than defaulted on purpose: a caller
 * that forgets to thread it through is a caller silently scoring against stale numbers,
 * and a required parameter makes that a typecheck failure instead of a quiet one.
 */

/** Total XP required to have reached a given level. Level 1 starts at 0. */
export function xpForLevel(level: number, config: ResolvedConfig): number {
  if (level <= 1) return 0;
  return Math.round(config.XP_BASE * Math.pow(level - 1, config.XP_CURVE_EXPONENT));
}

export interface LevelProgress {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  /** 0..1 across the current level, for the progress bar. */
  readonly progress: number;
}

/**
 * Resolves total XP to a level and progress within it.
 *
 * Walks upward rather than inverting the curve so the two directions can never
 * disagree — `levelForXp(xpForLevel(n)).level === n` holds by construction.
 */
export function levelForXp(totalXp: number, config: ResolvedConfig): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));

  let level = 1;
  while (xpForLevel(level + 1, config) <= xp) level++;

  const floor = xpForLevel(level, config);
  const ceiling = xpForLevel(level + 1, config);
  const span = ceiling - floor;

  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNextLevel: span,
    progress: span > 0 ? (xp - floor) / span : 0,
  };
}

export interface XpBreakdownEntry {
  readonly reason: string;
  readonly amount: number;
}

export interface XpAward {
  readonly total: number;
  /** Itemised so the results screen can show *why* the bar moved. */
  readonly breakdown: readonly XpBreakdownEntry[];
}

/**
 * Computes the XP earned from a finished match.
 *
 * Losing still pays (`rankedLoss`), because a system that pays nothing for a loss
 * pushes players to quit mid-match rather than finish — the same incentive the
 * disconnect-forfeit rule exists to remove.
 */
export function awardMatchXp(
  params: {
    mode: GameMode;
    won: boolean;
    roundsWon: number;
    correctGuesses: number;
    snapGuesses: number;
  },
  config: ResolvedConfig,
): XpAward {
  const awards = config.XP_AWARDS;
  const breakdown: XpBreakdownEntry[] = [];
  const add = (reason: string, amount: number) => {
    if (amount > 0) breakdown.push({ reason, amount });
  };

  if (params.mode === "daily") {
    add("Daily challenge", awards.dailyComplete);
  } else {
    add("Match complete", awards.matchComplete);
  }

  if (params.mode === "ranked") {
    add(params.won ? "Victory" : "Match played", params.won ? awards.rankedWin : awards.rankedLoss);
  }

  add(`Rounds won x${params.roundsWon}`, params.roundsWon * awards.roundWon);
  add(`Correct x${params.correctGuesses}`, params.correctGuesses * awards.perCorrectGuess);
  add(`Snap calls x${params.snapGuesses}`, params.snapGuesses * awards.snapBonus);

  // Scale every LINE rather than the total, so the itemised breakdown the results
  // screen shows still adds up to the number next to it. Scaling only the total would
  // print a list that visibly disagrees with its own sum.
  const scale = params.mode === "practice" ? config.PRACTICE_XP_MULTIPLIER : 1;
  const scaled =
    scale === 1
      ? breakdown
      : breakdown
          .map((entry) => ({ reason: entry.reason, amount: Math.round(entry.amount * scale) }))
          .filter((entry) => entry.amount > 0);

  return {
    total: scaled.reduce((sum, entry) => sum + entry.amount, 0),
    breakdown: scaled,
  };
}
