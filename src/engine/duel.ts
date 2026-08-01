/**
 * Health-duel resolution.
 *
 * Both players hear the same song; the lower scorer takes damage equal to the score
 * gap. There is no fixed round count — the duel runs until someone reaches zero,
 * which is what keeps a comeback live and makes dominance actually count for
 * something (winning a round 100-10 hurts far more than 100-55).
 *
 * Rooms use the same machinery with damage measured against the round median
 * instead of a single opponent, so eliminations are gradual rather than a bloodbath.
 */

import {
  DAMAGE_RAMP_EVERY,
  DAMAGE_RAMP_STEP,
  MAX_DUEL_ROUNDS,
  SONG_WINS_DAMAGE,
  TIE_DAMAGE_CAP,
  TIE_DAMAGE_PER_SECOND,
} from "./config";

/** One player's result for a single round. */
export interface RoundScore {
  readonly userId: string;
  readonly points: number;
  /** Summed reaction time, used only to break otherwise-identical outcomes. */
  readonly elapsedMs: number;
}

/**
 * Damage multiplier for a zero-based round index.
 *
 * Rounds 1-2 are x1.0, 3-4 are x1.5, 5-6 are x2.0 and so on. Applied equally to
 * both players, so it escalates the stakes without favouring whoever is ahead.
 */
export function damageMultiplier(roundIndex: number): number {
  const steps = Math.floor(Math.max(0, roundIndex) / DAMAGE_RAMP_EVERY);
  return 1 + steps * DAMAGE_RAMP_STEP;
}

export interface DamageResult {
  readonly userId: string;
  readonly damage: number;
}

/**
 * How a round was decided. Drives the wording the standings beat shows — a health
 * change with no stated reason is confusing when both players clearly got it.
 */
export type RoundOutcome = "tier" | "time" | "song";

export interface RoundResolution {
  readonly outcome: RoundOutcome;
  /** Undefined only when the song beat everyone. */
  readonly winnerId: string | undefined;
  readonly damage: readonly DamageResult[];
  /** Time gap in ms, present only when the round was decided on time. */
  readonly timeGapMs?: number;
}

/**
 * Resolves a head-to-head round.
 *
 * Every round has a loser. A points tie used to deal nothing, which meant most
 * rounds did nothing at all — duels ran the full cap without a knockout. Now:
 *
 *  - different points  → the gap, scaled by the round multiplier
 *  - same points       → the faster player wins; the slower takes time-based damage
 *  - nobody scored     → the song wins and takes a toll from both
 *
 * Every branch scales with the round multiplier, so no round is ever cheap late on.
 */
export function duelDamage(
  scores: readonly RoundScore[],
  roundIndex: number,
): RoundResolution {
  if (scores.length !== 2) {
    return {
      outcome: "song",
      winnerId: undefined,
      damage: scores.map((score) => ({ userId: score.userId, damage: 0 })),
    };
  }

  const [a, b] = scores;
  const multiplier = damageMultiplier(roundIndex);

  // Nobody answered. The song is the only winner; both players pay.
  if (a.points === 0 && b.points === 0) {
    const toll = songWinsDamage(multiplier);
    return {
      outcome: "song",
      winnerId: undefined,
      damage: [
        { userId: a.userId, damage: toll },
        { userId: b.userId, damage: toll },
      ],
    };
  }

  if (a.points !== b.points) {
    const loser = a.points < b.points ? a : b;
    const winner = a.points < b.points ? b : a;
    return {
      outcome: "tier",
      winnerId: winner.userId,
      damage: [
        { userId: winner.userId, damage: 0 },
        { userId: loser.userId, damage: Math.round(Math.abs(a.points - b.points) * multiplier) },
      ],
    };
  }

  // Same tier: settle it on reaction time.
  const faster = a.elapsedMs <= b.elapsedMs ? a : b;
  const slower = a.elapsedMs <= b.elapsedMs ? b : a;
  const timeGapMs = slower.elapsedMs - faster.elapsedMs;

  return {
    outcome: "time",
    winnerId: faster.userId,
    timeGapMs,
    damage: [
      { userId: faster.userId, damage: 0 },
      { userId: slower.userId, damage: tieDamage(timeGapMs, multiplier) },
    ],
  };
}

/**
 * Damage for a round decided on reaction time.
 *
 * Capped before the multiplier is applied, so the cap describes the base severity
 * and late rounds still escalate like every other kind of damage.
 */
export function tieDamage(timeGapMs: number, multiplier: number): number {
  const base = Math.min(TIE_DAMAGE_CAP, (Math.max(0, timeGapMs) / 1_000) * TIE_DAMAGE_PER_SECOND);
  return Math.round(base * multiplier);
}

/**
 * Damage for a round nobody answered.
 *
 * Scaled like every other kind of damage — a dead round late in a duel costs what the
 * round is worth, otherwise a run of hard tracks stalls the match.
 */
export function songWinsDamage(multiplier: number): number {
  return Math.round(SONG_WINS_DAMAGE * multiplier);
}

/**
 * Damage for a room round, measured against the median score.
 *
 * Using the top scorer instead would damage everyone but one player every round and
 * gut an eight-player room inside five rounds. Against the median, roughly half the
 * room takes nothing, so attrition is gradual and the match lasts.
 */
export function roomDamage(
  scores: readonly RoundScore[],
  roundIndex: number,
): RoundResolution {
  if (scores.length === 0) {
    return { outcome: "song", winnerId: undefined, damage: [] };
  }

  const multiplier = damageMultiplier(roundIndex);

  // Nobody scored: the song beats the whole room rather than the round stalling.
  if (scores.every((score) => score.points === 0)) {
    const toll = songWinsDamage(multiplier);
    return {
      outcome: "song",
      winnerId: undefined,
      damage: scores.map((score) => ({ userId: score.userId, damage: toll })),
    };
  }

  const median = medianOf(scores.map((score) => score.points));

  // Total ordering: points first, then time. Without the time component, players on
  // identical points would be indistinguishable and the room could stall on ties.
  const ranked = [...scores].sort(
    (a, b) => b.points - a.points || a.elapsedMs - b.elapsedMs,
  );

  return {
    outcome: ranked[0].points > median ? "tier" : "time",
    winnerId: ranked[0].userId,
    damage: scores.map((score) => {
      if (score.points > median) return { userId: score.userId, damage: 0 };
      if (score.points < median) {
        return {
          userId: score.userId,
          damage: Math.round((median - score.points) * multiplier),
        };
      }
      // Exactly on the median: settle against the fastest player on that score.
      const fastestAtMedian = ranked.find((entry) => entry.points === median)!;
      return {
        userId: score.userId,
        damage: tieDamage(score.elapsedMs - fastestAtMedian.elapsedMs, multiplier),
      };
    }),
  };
}

/** Median of a numeric list. Even-length lists average the middle pair. */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export interface DuelPlayerState {
  readonly userId: string;
  readonly hp: number;
  readonly totalPoints: number;
  /** Round at which they hit zero, or null while still alive. */
  readonly eliminatedAtRound: number | null;
}

export type DuelStatus =
  | { readonly kind: "continue" }
  | { readonly kind: "complete"; readonly winnerId: string | undefined }
  | { readonly kind: "sudden-death" };

/**
 * Decides whether a duel is over after a round has been applied.
 *
 * At `MAX_DUEL_ROUNDS` the duel is forced to resolve: highest HP, then highest total
 * points, then sudden death. Without this, two players who tie every round would
 * never finish.
 */
export function resolveDuel(
  players: readonly DuelPlayerState[],
  roundsPlayed: number,
): DuelStatus {
  const alive = players.filter((player) => player.hp > 0);

  // Someone is dead: the duel is decided.
  if (alive.length === 1) return { kind: "complete", winnerId: alive[0].userId };

  // Both hit zero in the same round — fall through to the tiebreak below.
  if (alive.length === 0) return decideOnTiebreak(players);

  if (roundsPlayed >= MAX_DUEL_ROUNDS) return decideOnTiebreak(players);

  return { kind: "continue" };
}

function decideOnTiebreak(players: readonly DuelPlayerState[]): DuelStatus {
  const ranked = [...players].sort(
    (a, b) => b.hp - a.hp || b.totalPoints - a.totalPoints,
  );
  const [best, runnerUp] = ranked;

  if (!best) return { kind: "complete", winnerId: undefined };
  if (!runnerUp) return { kind: "complete", winnerId: best.userId };

  const dead = best.hp === runnerUp.hp && best.totalPoints === runnerUp.totalPoints;
  return dead ? { kind: "sudden-death" } : { kind: "complete", winnerId: best.userId };
}

/**
 * Decides whether a room match is over.
 *
 * Eliminated players keep guessing for placing, so "over" means one survivor rather
 * than everyone else having left.
 */
export function resolveRoom(players: readonly DuelPlayerState[], roundsPlayed: number): DuelStatus {
  const alive = players.filter((player) => player.hp > 0);

  if (alive.length === 1) return { kind: "complete", winnerId: alive[0].userId };
  if (alive.length === 0) return decideOnTiebreak(players);
  if (roundsPlayed >= MAX_DUEL_ROUNDS) return decideOnTiebreak(players);

  return { kind: "continue" };
}

/**
 * Final placing for a room.
 *
 * Survivors rank above everyone eliminated. Among the eliminated, whoever lasted
 * longest ranks higher, and points break ties within a round — which is what makes
 * playing on after elimination worth doing.
 */
export function roomPlacings(players: readonly DuelPlayerState[]): string[] {
  return [...players]
    .sort((a, b) => {
      const aAlive = a.hp > 0;
      const bAlive = b.hp > 0;
      if (aAlive !== bAlive) return aAlive ? -1 : 1;
      if (aAlive && bAlive) return b.hp - a.hp || b.totalPoints - a.totalPoints;
      // Both eliminated: later elimination is a better result.
      return (
        (b.eliminatedAtRound ?? 0) - (a.eliminatedAtRound ?? 0) ||
        b.totalPoints - a.totalPoints
      );
    })
    .map((player) => player.userId);
}

/** True once a player has played enough rounds to be allowed to surrender. */
/**
 * Did this player take the round?
 *
 * A round is won by out-scoring every opponent — which means a player with no opponents
 * cannot win one. That sounds pedantic and is not: `[].every(...)` is vacuously TRUE, so
 * both callers of this rule (XP in convex/progression.ts, running stats in
 * convex/matches.ts) counted every solved round of the SOLO daily as a round "won"
 * against nobody. A perfect daily quietly paid 90 XP of round-win bonuses it had not
 * earned, on top of the completion award.
 *
 * Extracted to one predicate so the two call sites cannot disagree about it again.
 */
export function wonRound(myPoints: number, opponentPoints: readonly number[]): boolean {
  if (opponentPoints.length === 0) return false;
  return myPoints > 0 && opponentPoints.every((points) => myPoints > points);
}

export function canSurrender(roundIndex: number, fromRound: number): boolean {
  return roundIndex >= fromRound;
}

/** True when a longer momentum beat should play after this round. */
export function isMilestoneRound(roundIndex: number, every: number): boolean {
  return every > 0 && (roundIndex + 1) % every === 0;
}
