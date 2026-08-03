/**
 * Named rank tiers layered over Elo.
 *
 * This is presentation only. No rating maths reads any of it, so the bands can be
 * retuned without touching a single player's actual rating.
 */

import { NOTABLE_RANK_CUTOFF, RANK_TIERS, type RankTier } from "./config";

export interface Rank {
  readonly tier: RankTier;
  /** 1 is the highest division within a tier, counting down as you climb. */
  readonly division: number;
  /** e.g. "Gold II", or just "Legend" for the single-division top tier. */
  readonly label: string;
  /** 0..1 progress toward the next division. 1 at the top of the ladder. */
  readonly progress: number;
  /** Elo needed for the next division, or null at the top. */
  readonly nextAt: number | null;
  /**
   * The lowest Elo still inside this division — drop below it and the rank does.
   *
   * The mirror of `nextAt`, and computed here for the same reason: the value already
   * existed as a local and was thrown away, so every caller that wanted to know how much
   * headroom a player had above a demotion had to reverse-engineer the division maths.
   * `/ranked` states what is at risk before you queue, which needs exactly this.
   *
   * Rounded UP so `rankForElo(floorAt)` lands back in this same division. Divisions do
   * not fall on integers — Silver's three split a 200-point span into 66.67 each — and
   * flooring would name a rating that belongs to the division below.
   */
  readonly floorAt: number;
}

/** Highest tier whose threshold the rating clears. */
function tierFor(elo: number): { tier: RankTier; index: number } {
  let index = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (elo >= RANK_TIERS[i].minElo) index = i;
  }
  return { tier: RANK_TIERS[index], index };
}

/**
 * Maps a rating onto a tier and division.
 *
 * A tier's Elo span is split evenly across its divisions, so climbing shows visible
 * movement between full promotions rather than a number that means nothing.
 */
export function rankForElo(elo: number): Rank {
  const { tier, index } = tierFor(elo);
  const next = RANK_TIERS[index + 1];

  // Top tier has no ceiling, so there is no division maths to do.
  if (!next) {
    return {
      tier,
      division: 1,
      label: tier.name,
      progress: 1,
      nextAt: null,
      // The top tier is one division, so its floor is the tier's own threshold. Falling
      // below this is a tier demotion rather than a division one.
      floorAt: tier.minElo,
    };
  }

  const span = next.minElo - tier.minElo;
  const into = Math.max(0, Math.min(elo - tier.minElo, span - 1));
  const divisionSize = span / tier.divisions;

  const stepsClimbed = Math.floor(into / divisionSize);
  // Divisions ascend: entering a tier is I, the top of it is III. The emblem draws one
  // chevron per division, so counting downward meant the weakest rank in every tier wore
  // the most chevrons — the numeral and the pips disagreed about which way was up.
  const division = stepsClimbed + 1;

  const divisionFloor = tier.minElo + stepsClimbed * divisionSize;
  const nextAt = Math.ceil(divisionFloor + divisionSize);

  return {
    tier,
    division,
    label: tier.divisions > 1 ? `${tier.name} ${toRoman(division)}` : tier.name,
    progress: (into - stepsClimbed * divisionSize) / divisionSize,
    nextAt,
    floorAt: Math.ceil(divisionFloor),
  };
}

export type PromotionKind = "tier" | "division" | null;

export interface RankChange {
  readonly before: Rank;
  readonly after: Rank;
  /** "tier" outranks "division" — a tier jump gets the full celebration. */
  readonly promotion: PromotionKind;
  readonly demotion: PromotionKind;
}

/**
 * Compares two ratings and reports whether the player crossed a rank boundary.
 * Drives the post-match celebration, so it must not fire on a rating change that
 * stayed inside the same division.
 */
export function rankChange(eloBefore: number, eloAfter: number): RankChange {
  const before = rankForElo(eloBefore);
  const after = rankForElo(eloAfter);

  const tierBefore = RANK_TIERS.findIndex((t) => t.id === before.tier.id);
  const tierAfter = RANK_TIERS.findIndex((t) => t.id === after.tier.id);

  if (tierAfter > tierBefore) {
    return { before, after, promotion: "tier", demotion: null };
  }
  if (tierAfter < tierBefore) {
    return { before, after, promotion: null, demotion: "tier" };
  }
  if (after.division > before.division) {
    return { before, after, promotion: "division", demotion: null };
  }
  if (after.division < before.division) {
    return { before, after, promotion: null, demotion: "division" };
  }
  return { before, after, promotion: null, demotion: null };
}

/**
 * Whether a leaderboard position earns the "#N GLOBAL" flag on the VS screen.
 * `position` is 1-based; null or 0 means unranked.
 */
export function isNotable(position: number | null | undefined): boolean {
  return typeof position === "number" && position > 0 && position <= NOTABLE_RANK_CUTOFF;
}

/** Positions are reported exactly up to here, and as a bucket floor beyond it. */
const RANK_BUCKET = 500;

/**
 * A global position as it should be read.
 *
 * A ladder's first job is answering "where am I?", and for everyone outside the visible
 * board the honest answer is a magnitude rather than a number — "1,500+" is both true and
 * useful, where a precise 1,847th implies a precision the bounded count does not have.
 *
 * `approximate` comes from the server, which knows whether it counted to the end or gave
 * up at the ceiling. Returns null when there is no rank to show at all.
 */
export function formatGlobalRank(
  position: number | null | undefined,
  approximate = false,
): string | null {
  if (typeof position !== "number" || position <= 0) return null;
  if (!approximate) return `#${position.toLocaleString()}`;

  // Floors to the bucket below, so the label is a claim the player definitely clears.
  const bucket = Math.floor(position / RANK_BUCKET) * RANK_BUCKET;
  return `${bucket.toLocaleString()}+`;
}

export type MatchupLabel = "UNDERDOG" | "EVEN MATCH" | "FAVOURITE";

/**
 * Qualitative framing for the VS screen.
 *
 * Deliberately returns no numbers: showing the projected rating swing before a match
 * spends the reward before it is earned. The delta belongs on the results screen.
 */
export function matchupLabel(myElo: number, opponentElo: number): MatchupLabel {
  const gap = myElo - opponentElo;
  if (gap <= -100) return "UNDERDOG";
  if (gap >= 100) return "FAVOURITE";
  return "EVEN MATCH";
}

const ROMAN = ["", "I", "II", "III", "IV", "V"];

function toRoman(value: number): string {
  return ROMAN[value] ?? String(value);
}
