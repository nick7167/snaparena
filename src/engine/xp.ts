/**
 * XP and levels.
 *
 * XP is awarded by every mode so that casual play always advances something, and it
 * never decreases — losing a ranked match still moves your level bar, which is what
 * keeps a bad session from feeling wasted.
 */

import { XP_AWARDS, XP_BASE, XP_CURVE_EXPONENT } from "./config";

/** Total XP required to have reached a given level. Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(XP_BASE * Math.pow(level - 1, XP_CURVE_EXPONENT));
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
export function levelForXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));

  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;

  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
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
export function awardMatchXp(params: {
  mode: "ranked" | "room" | "daily";
  won: boolean;
  setsWon: number;
  correctGuesses: number;
  snapGuesses: number;
}): XpAward {
  const breakdown: XpBreakdownEntry[] = [];
  const add = (reason: string, amount: number) => {
    if (amount > 0) breakdown.push({ reason, amount });
  };

  if (params.mode === "daily") {
    add("Daily challenge", XP_AWARDS.dailyComplete);
  } else {
    add("Match complete", XP_AWARDS.matchComplete);
  }

  if (params.mode === "ranked") {
    add(params.won ? "Victory" : "Match played", params.won ? XP_AWARDS.rankedWin : XP_AWARDS.rankedLoss);
  }

  add(`Sets won x${params.setsWon}`, params.setsWon * XP_AWARDS.setWon);
  add(`Correct x${params.correctGuesses}`, params.correctGuesses * XP_AWARDS.perCorrectGuess);
  add(`Snap calls x${params.snapGuesses}`, params.snapGuesses * XP_AWARDS.snapBonus);

  return {
    total: breakdown.reduce((sum, entry) => sum + entry.amount, 0),
    breakdown,
  };
}
