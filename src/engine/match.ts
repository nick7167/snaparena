/**
 * Answer matching: decides whether what a player typed counts as the song title.
 *
 * Correctness is a *server* decision. The client may run this for optimistic UI,
 * but the authoritative call always happens inside a Convex mutation.
 */

import type { ResolvedConfig } from "./config-merge";
import { normalizeTitle } from "./normalize";

/** Config is a parameter, not an import — see the note in `xp.ts`. */

export interface MatchTarget {
  /** Output of normalizeTitle() on the track's real title, stored at ingest. */
  readonly titleNormalized: string;
  /** Extra accepted spellings, already normalized. e.g. "pink" for "P!nk" titles. */
  readonly aliasesNormalized?: readonly string[];
}

export type MatchReason = "exact" | "alias" | "fuzzy" | "too-short" | "no-match";

export interface MatchResult {
  readonly correct: boolean;
  readonly reason: MatchReason;
  /** Edit distance to whichever candidate matched (or was closest). */
  readonly distance: number;
  /** The normalized form of what the player typed, for logging and tuning. */
  readonly normalizedGuess: string;
}

/**
 * Optimal String Alignment distance — Levenshtein plus adjacent transposition,
 * so "blidning" -> "blinding" costs 1 rather than 2. Transposition is by far the
 * most common error type when typing fast, which is the whole context here.
 *
 * `maxDistance` enables an early bail: once every cell in a row exceeds the
 * budget, no completion can come back under it.
 */
export function damerauLevenshtein(a: string, b: string, maxDistance = Infinity): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let twoRowsBack: number[] = [];
  let previousRow: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let currentRow: number[] = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    currentRow[0] = i;
    let rowMinimum = currentRow[0];

    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

      let value = Math.min(
        currentRow[j - 1] + 1, // insertion
        previousRow[j] + 1, // deletion
        previousRow[j - 1] + substitutionCost, // substitution
      );

      // Adjacent transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoRowsBack[j - 2] + 1);
      }

      currentRow[j] = value;
      if (value < rowMinimum) rowMinimum = value;
    }

    if (rowMinimum > maxDistance) return maxDistance + 1;

    twoRowsBack = previousRow;
    previousRow = currentRow;
    currentRow = new Array(b.length + 1);
  }

  return previousRow[b.length];
}

/**
 * Edit-distance budget for a target of the given length.
 *
 * Short titles demand an exact match — the budget would otherwise be a larger
 * fraction of the word than any real typo.
 */
export function distanceThresholdFor(length: number, config: ResolvedConfig): number {
  if (length <= config.FUZZY_EXACT_MAX_LEN) return 0;
  return Math.max(1, Math.floor(length / config.FUZZY_LENGTH_DIVISOR));
}

/**
 * Authoritative correctness check for a submitted guess.
 *
 * Only the title is matched — artist is never required, per the v1 answer rules.
 */
export function checkGuess(
  rawGuess: string,
  target: MatchTarget,
  config: ResolvedConfig,
): MatchResult {
  const normalizedGuess = normalizeTitle(rawGuess);

  if (normalizedGuess.length < config.MIN_GUESS_LENGTH) {
    return { correct: false, reason: "too-short", distance: Infinity, normalizedGuess };
  }

  const candidates = [target.titleNormalized, ...(target.aliasesNormalized ?? [])];

  // Exact / alias pass first — cheap, and the overwhelmingly common case.
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i] && candidates[i] === normalizedGuess) {
      return {
        correct: true,
        reason: i === 0 ? "exact" : "alias",
        distance: 0,
        normalizedGuess,
      };
    }
  }

  // Fuzzy pass.
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const threshold = distanceThresholdFor(candidate.length, config);
    const distance = damerauLevenshtein(normalizedGuess, candidate, threshold);
    if (distance < bestDistance) bestDistance = distance;
    if (distance <= threshold) {
      return { correct: true, reason: "fuzzy", distance, normalizedGuess };
    }
  }

  return { correct: false, reason: "no-match", distance: bestDistance, normalizedGuess };
}
