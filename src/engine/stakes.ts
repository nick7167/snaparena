/**
 * What a ranked match can change, worked out before there is an opponent.
 *
 * The obvious version of this screen prints "WIN +18 / LOSE −16" above the queue button.
 * It cannot: Elo delta is `k * (outcome − expected)` and `expected` needs an opponent
 * rating, which does not exist until matchmaking has already run. Any figure shown before
 * that press would be invented.
 *
 * So the stake is expressed as JEOPARDY instead — what is within reach and what is at
 * risk — every part of which is derivable from the player's own row:
 *
 *   |delta| = k * |outcome − expected|
 *
 * and `expectedScore` depends only on the rating GAP, never on the absolute ratings. The
 * queue opens at a fixed band either side of you, so the extremes of that gap are known
 * constants, and therefore so are the extremes of the swing. No opponent required.
 *
 * Pure and separate from the view for the same reason `streak.ts` is: the priority order
 * below has five branches and three boundary conditions, and none of that is testable
 * through a rendered component.
 */

import { rankForElo, type Rank } from "./ranks";
import { expectedScore, kFactor } from "./elo";
import { eloBandFor } from "./matchmaking";
import { ESTABLISHED_AFTER_GAMES } from "./config";

/**
 * The band the queue opens at, and the edge case it implies.
 *
 * `eloBandFor(0)` is what the server searches the instant you enqueue, imported rather
 * than restated so the number here cannot drift from the number being searched.
 *
 * `BAND_EDGE` is the fraction of k you take from the most lopsided pairing that band
 * allows — beating someone at the top of it, or losing to someone at the bottom. Both come
 * out at the same fraction because `expectedScore` is symmetric about the gap, which is
 * why one constant covers gain and loss alike.
 */
const OPENING_BAND = eloBandFor(0);
const BAND_EDGE = 1 - expectedScore(0, OPENING_BAND);

/** How close to the K drop we start mentioning that a rating is about to settle. */
const SETTLING_NOTICE_GAMES = 5;

/**
 * The single most interesting true thing about the next match.
 *
 * A discriminated union rather than a formatted string: the engine decides WHICH fact
 * wins and supplies its numbers, the view decides how to say it. Copy that lives in here
 * cannot be adjusted without re-running the tests that pin the priority order.
 */
export type Headline =
  /** The next division is in another tier — the biggest jump on the ladder. */
  | { kind: "tier-promotion"; label: string; away: number }
  | { kind: "division-promotion"; label: string; away: number }
  /** A named player directly ahead, close enough that one win clears them. */
  | { kind: "pass-rival"; handle: string; away: number }
  /** The K-factor is about to drop, so swings are about to shrink for good. */
  | { kind: "settling"; games: number }
  /** Nothing is imminent. Still true, still worth stating. */
  | { kind: "baseline"; label: string; away: number }
  /** Legend. There is no next division. */
  | { kind: "summit" };

export interface Stakes {
  /** The rank the rest of this was derived from, so callers need not recompute it. */
  readonly rank: Rank;
  /** The K-factor governing this player's next match. */
  readonly k: number;
  /** What an EVEN pairing moves you — what the matchmaker is actually trying to make. */
  readonly evenSwing: number;
  /**
   * The most a single win inside the opening band can gain.
   *
   * This is the threshold behind every "within one win" claim, which makes those claims
   * mean ACHIEVABLE rather than guaranteed — you get this much from beating the strongest
   * opponent the band allows, and `evenSwing` from a fair one. The view's copy has to
   * carry that distinction; see the note on `pickHeadline`.
   */
  readonly reach: number;
  /** Null during placements, where there is no rank to move. */
  readonly headline: Headline | null;
  /** What a loss could cost, when it is close enough to be worth saying. */
  readonly atRisk: { readonly gap: number; readonly label: string } | null;
}

export interface StakesInput {
  readonly elo: number;
  readonly gamesPlayed: number;
  readonly placementsRemaining: number;
  /**
   * Rating gap to the nearest player ahead on the ladder, and who they are.
   *
   * Optional because `ladderNeighbours` returns null during placements and can legitimately
   * find nobody above a first-placed player.
   */
  readonly rivalGap?: number | null;
  readonly rivalHandle?: string | null;
}

/**
 * Everything at stake in the next ranked match.
 *
 * Deliberately total: there is no input for which this returns nothing to say. The
 * `baseline` branch exists so the card never renders empty, because a panel that appears
 * and disappears depending on how close a player happens to be to a boundary is worse than
 * one that always states the same shape of fact.
 */
export function stakesFor(input: StakesInput): Stakes {
  const { elo, gamesPlayed, placementsRemaining } = input;

  const rank = rankForElo(elo);
  const k = kFactor(gamesPlayed);
  const evenSwing = Math.round(k / 2);
  const reach = Math.round(k * BAND_EDGE);

  // Placements have no rank to promote, no position to pass and nothing to lose — the
  // rating is still finding its level. The view shows the placement run instead.
  if (placementsRemaining > 0) {
    return { rank, k, evenSwing, reach, headline: null, atRisk: null };
  }

  return {
    rank,
    k,
    evenSwing,
    reach,
    headline: pickHeadline(input, rank, reach, gamesPlayed),
    atRisk: pickRisk(elo, rank, reach),
  };
}

/**
 * The priority order, which is the whole design.
 *
 * Ordered by how much the fact would change what a player does next, not by how easy it is
 * to compute. A tier promotion outranks a division one because crossing from Silver to
 * Gold changes the emblem; passing a named person outranks both kinds of "your rating is
 * fine" because a rival is a reason to play one more.
 *
 * Every branch above `baseline` is gated on `reach`, so none of them can claim something a
 * single win cannot actually deliver.
 */
function pickHeadline(
  input: StakesInput,
  rank: Rank,
  reach: number,
  gamesPlayed: number,
): Headline {
  const { elo, rivalGap, rivalHandle } = input;

  if (rank.nextAt !== null) {
    const away = rank.nextAt - elo;
    if (away <= reach) {
      const next = rankForElo(rank.nextAt);
      // A tier change and a division change are the same arithmetic and completely
      // different events. The emblem itself changes at a tier boundary.
      const kind = next.tier.id === rank.tier.id ? "division-promotion" : "tier-promotion";
      return { kind, label: next.label, away };
    }
  }

  /**
   * Someone to pass.
   *
   * `> 0` is load-bearing rather than defensive. `ladderNeighbours` reports a SIGNED gap,
   * and a tie reports 0 — a player you are already level with is not someone a win moves
   * you past, and announcing "within one win of @rival" about somebody you are drawn with
   * would be the one claim on this card that is false.
   */
  if (
    typeof rivalGap === "number" &&
    rivalGap > 0 &&
    rivalGap <= reach &&
    rivalHandle
  ) {
    return { kind: "pass-rival", handle: rivalHandle, away: rivalGap };
  }

  // The rating is about to stop moving as fast as it does now. Only worth saying when it
  // is close — "25 games until your swings shrink" is not news.
  const untilSettled = ESTABLISHED_AFTER_GAMES - gamesPlayed;
  if (untilSettled > 0 && untilSettled <= SETTLING_NOTICE_GAMES) {
    return { kind: "settling", games: untilSettled };
  }

  if (rank.nextAt === null) return { kind: "summit" };

  return {
    kind: "baseline",
    label: rankForElo(rank.nextAt).label,
    away: rank.nextAt - elo,
  };
}

/**
 * How close the floor is.
 *
 * Never the headline — this page exists to get someone to press a button, and opening with
 * what they could lose is the wrong instrument. It renders as a second line, and only when
 * a single loss could genuinely reach it.
 *
 * "Is there anything below?" is asked by walking one point under the floor and seeing
 * whether the rank changes, rather than by comparing against a floor constant. At the very
 * bottom of the ladder `rankForElo` clamps, so the bottom division answers this correctly
 * by itself and needs no special case.
 */
function pickRisk(
  elo: number,
  rank: Rank,
  reach: number,
): { gap: number; label: string } | null {
  const below = rankForElo(rank.floorAt - 1);
  if (below.label === rank.label) return null;

  const gap = elo - rank.floorAt;
  if (gap > reach) return null;

  return { gap, label: below.label };
}

/**
 * The rating range the queue opens against, for display beside the button.
 *
 * Same band the stake figures are derived from, so the two cannot disagree about how far
 * the search reaches at the moment you press.
 */
export function openingRange(elo: number): { low: number; high: number } {
  return { low: Math.round(elo - OPENING_BAND), high: Math.round(elo + OPENING_BAND) };
}
