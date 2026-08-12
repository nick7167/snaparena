import type { ReducerCtx } from "./ctx";
import { resolveConfig } from "./config";
import { gameModeOf } from "./lib";
import { evaluateBadges } from "../../src/engine/badges";
import { wonRound } from "../../src/engine/duel";
import {
  applyCategoryResults,
  applyMatchResult,
  outcomeFromScores,
  type CategoryRoundResult,
  type Outcome,
} from "../../src/engine/elo";
import { tierForElapsed } from "../../src/engine/scoring";
import { awardMatchXp, levelForXp } from "../../src/engine/xp";
import type { ResolvedConfig } from "../../src/engine/config-merge";

/**
 * What a finished match pays out: rating, XP, levels, badges, category ratings.
 *
 * Scheduled rather than inlined into `finishMatch`, so the phase machine stays
 * independent of the progression rules — the machine decides a match is over, this
 * decides what that was worth.
 *
 * Every rule lives in `../../src/engine/`, shared verbatim with the browser. Nothing
 * here computes a rating or an XP figure; it reads rows, hands them to the engine and
 * writes the answer back.
 */

type MatchRow = NonNullable<ReturnType<ReducerCtx["db"]["match"]["id"]["find"]>>;
type PlayerRow = NonNullable<ReturnType<ReducerCtx["db"]["match_player"]["id"]["find"]>>;

export function runFinalizeMatch(ctx: ReducerCtx, matchId: bigint): void {
  const match = ctx.db.match.id.find(matchId);
  if (!match) return;

  const players = [...ctx.db.match_player.matchId.filter(matchId)];
  if (players.length === 0) return;

  /**
   * Idempotency, on `completedAt` rather than on the XP figure.
   *
   * The Convex version tested `xpEarned !== undefined`, which worked because the
   * column was optional. Here it is a plain `f64` that starts at zero, and zero is a
   * legitimate payout — a bot match, or a guest's daily — so it cannot distinguish
   * "not yet run" from "ran and paid nothing". `completedAt` is unset until this
   * function writes it, and is never zero.
   */
  if (players.some((player) => player.completedAt !== undefined)) return;

  /**
   * The rules this match was PLAYED under, not the ones in force now.
   *
   * Resolved once here and threaded down, so a config saved between the last round
   * and this scheduled reducer cannot pay out XP the players were never told about.
   */
  const config = resolveConfig(ctx, match.configVersionId);

  // Ranked rating first, so XP and badges can see the post-match rating.
  if (match.mode === "ranked" && players.length === 2) {
    applyRanked(ctx, match, players, config);
  }

  for (const player of players) {
    applyProgression(ctx, match, player, config);
  }
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

/** Elo and per-category ratings for a completed ranked match. */
function applyRanked(
  ctx: ReducerCtx,
  match: MatchRow,
  players: PlayerRow[],
  config: ResolvedConfig,
): void {
  if (players.some((player) => player.ratingAfter !== undefined)) return;

  const [a, b] = players;
  const userA = ctx.db.user.id.find(a.userId);
  const userB = ctx.db.user.id.find(b.userId);
  if (!userA || !userB) return;

  // A forfeit is a full loss; otherwise the match winner decided by sets wins.
  const outcomeA: Outcome = a.forfeited
    ? 0
    : b.forfeited
      ? 1
      : match.winnerId !== undefined
        ? match.winnerId === a.userId
          ? 1
          : 0
        : outcomeFromScores(a.totalPoints, b.totalPoints);
  const outcomeB: Outcome = (1 - outcomeA) as Outcome;

  const updateA = applyMatchResult(
    {
      rating: userA.elo,
      opponentRating: userB.elo,
      outcome: outcomeA,
      gamesPlayed: userA.gamesPlayed,
    },
    config,
  );
  const updateB = applyMatchResult(
    {
      rating: userB.elo,
      opponentRating: userA.elo,
      outcome: outcomeB,
      gamesPlayed: userB.gamesPlayed,
    },
    config,
  );

  ctx.db.user.id.update({
    ...userA,
    elo: updateA.rating,
    gamesPlayed: updateA.gamesPlayed,
    placementsRemaining: updateA.placementsRemaining,
    rankedWins: userA.rankedWins + (outcomeA === 1 ? 1 : 0),
  });
  ctx.db.user.id.update({
    ...userB,
    elo: updateB.rating,
    gamesPlayed: updateB.gamesPlayed,
    placementsRemaining: updateB.placementsRemaining,
    rankedWins: userB.rankedWins + (outcomeB === 1 ? 1 : 0),
  });

  ctx.db.match_player.id.update({
    ...a,
    ratingAfter: updateA.rating,
    ratingDelta: updateA.delta,
  });
  ctx.db.match_player.id.update({
    ...b,
    ratingAfter: updateB.rating,
    ratingDelta: updateB.delta,
  });

  applyPerCategoryRatings(ctx, match, a.userId, b.userId, config);
}

// ---------------------------------------------------------------------------
// XP, levels and badges
// ---------------------------------------------------------------------------

/** XP, level and badges for one player. */
function applyProgression(
  ctx: ReducerCtx,
  match: MatchRow,
  player: PlayerRow,
  config: ResolvedConfig,
): void {
  const user = ctx.db.user.id.find(player.userId);
  if (!user) return;

  // Bots earn nothing. Their rating is a fixed persona property, and levelling them
  // up would put synthetic accounts on progression leaderboards.
  //
  // Neither do guests. A guest row is a throwaway identity that can only play the
  // daily, and claiming a run transfers the RUN to the real account but never the XP —
  // so anything paid here would be written to a row nobody will ever see again.
  //
  // The denormalised fields below are still written for both, because the history and
  // roster readers depend on them and a bot's match list is real.
  const earns = !user.isBot && !user.isGuest;

  const mine = [...ctx.db.guess.matchId.filter(match.id)].filter(
    (guess) => guess.userId === player.userId && guess.correct,
  );
  const snapGuesses = mine.filter(
    (guess) => tierForElapsed(guess.clientElapsedMs, config).id === "snap",
  ).length;

  const won = match.winnerId === player.userId;
  const roundsWon = countRoundsWon(ctx, match, player.userId);

  const xpAward = awardMatchXp(
    {
      mode: gameModeOf(match.mode),
      won,
      roundsWon,
      correctGuesses: mine.length,
      snapGuesses,
    },
    config,
  );

  const xpBefore = user.xp;
  const totalXp = earns ? xpBefore + xpAward.total : xpBefore;
  const totalSnaps = user.snapGuesses + (earns ? snapGuesses : 0);

  // Captured either side of the write below: once `user.xp` moves, the level the
  // player held going in is unrecoverable, and that is exactly what the results
  // screen needs to animate from and to detect a level-up against.
  const levelBefore = levelForXp(xpBefore, config).level;
  const levelAfter = levelForXp(totalXp, config).level;

  if (earns) {
    ctx.db.user.id.update({
      ...user,
      xp: totalXp,
      level: levelAfter,
      snapGuesses: totalSnaps,
    });
  }

  const badges = earns
    ? awardBadges(ctx, match, player, user, config, {
        won,
        totalSnapGuesses: totalSnaps,
        // Finishing on full health means the opponent never once out-scored them.
        tookNoDamage: player.hp >= startingHpFor(match.mode, config),
        wonFromCritical: player.lowestHp < startingHpFor(match.mode, config) * 0.25,
        wonSuddenDeath: won && match.suddenDeath,
      })
    : [];

  const current = ctx.db.match_player.id.find(player.id);
  if (!current) return;

  ctx.db.match_player.id.update({
    ...current,
    xpEarned: earns ? xpAward.total : 0,
    xpBreakdown: earns ? xpAward.breakdown.map((entry) => ({ ...entry })) : [],
    levelBefore,
    levelAfter,
    xpAfter: totalXp,
    badgesEarned: badges,
    /**
     * Denormalised so the history and practice-roster readers never open the match.
     * Written here because this runs exactly once per player per finished match, next
     * to writes that already happen.
     */
    mode: match.mode,
    completedAt: match.completedAt ?? ctx.timestamp,
    outcome: match.winnerId === undefined ? "draw" : won ? "win" : "loss",
  });
}

/** Starting health for the mode, so badge thresholds compare against the right baseline. */
function startingHpFor(mode: string, config: ResolvedConfig): number {
  return mode === "room" ? config.ROOM_STARTING_HP : config.DUEL_STARTING_HP;
}

/**
 * Rounds in which this player out-scored every opponent.
 *
 * A round win is the natural unit of progress to pay XP on. The "did I take this
 * round" rule itself lives in `wonRound` — see there for why the no-opponent case is
 * explicit.
 */
function countRoundsWon(ctx: ReducerCtx, match: MatchRow, userId: bigint): number {
  const guesses = [...ctx.db.guess.matchId.filter(match.id)];
  const rounds = [...ctx.db.match_track.matchId.filter(match.id)].length;

  let won = 0;

  for (let round = 0; round < rounds; round++) {
    const pointsFor = (id: bigint) =>
      guesses
        .filter((g) => g.roundIndex === round && g.userId === id && g.correct)
        .reduce((sum, g) => sum + g.points, 0);

    const others = match.playerIds.filter((id) => id !== userId).map(pointsFor);
    if (wonRound(pointsFor(userId), others)) won++;
  }

  return won;
}

/** Evaluates badges and inserts only the ones the player does not already hold. */
function awardBadges(
  ctx: ReducerCtx,
  match: MatchRow,
  player: PlayerRow,
  user: NonNullable<ReturnType<ReducerCtx["db"]["user"]["id"]["find"]>>,
  config: ResolvedConfig,
  facts: {
    won: boolean;
    totalSnapGuesses: number;
    tookNoDamage: boolean;
    wonFromCritical: boolean;
    wonSuddenDeath: boolean;
  },
): string[] {
  const opponentId = match.playerIds.find((id) => id !== player.userId);
  const opponent = opponentId === undefined ? undefined : ctx.db.user.id.find(opponentId);
  const opponentElo = opponent?.elo ?? 0;

  const candidates = evaluateBadges({
    mode: gameModeOf(match.mode),
    won: facts.won,
    totalRankedWins: user.rankedWins,
    totalRankedMatches: user.gamesPlayed,
    totalSnapGuesses: facts.totalSnapGuesses,
    tookNoDamage: facts.tookNoDamage,
    wonFromCritical: facts.wonFromCritical,
    wonSuddenDeath: facts.wonSuddenDeath,
    // Compare against the rating the opponent held going in, not after this match.
    opponentEloAdvantage:
      player.ratingBefore < opponentElo ? opponentElo - player.ratingBefore : 0,
  });

  const newlyEarned: string[] = [];

  for (const badgeId of candidates) {
    const held = [...ctx.db.user_badge.by_user_badge.filter([player.userId, badgeId])][0];
    if (held) continue;

    ctx.db.user_badge.insert({
      id: 0n,
      userId: player.userId,
      badgeId,
      earnedAt: ctx.timestamp,
    });
    newlyEarned.push(badgeId);
  }

  return newlyEarned;
}

// ---------------------------------------------------------------------------
// Per-category ratings
// ---------------------------------------------------------------------------

/**
 * Per-track head-to-heads feeding the per-category ratings. One song is a tiny
 * sample, so these move at a deliberately low K.
 */
function applyPerCategoryRatings(
  ctx: ReducerCtx,
  match: MatchRow,
  userAId: bigint,
  userBId: bigint,
  config: ResolvedConfig,
): void {
  const guesses = [...ctx.db.guess.matchId.filter(match.id)];
  const setlist = [...ctx.db.match_track.matchId.filter(match.id)].sort(
    (x, y) => x.roundIndex - y.roundIndex,
  );

  const resultsA: CategoryRoundResult[] = [];
  const resultsB: CategoryRoundResult[] = [];

  for (const entry of setlist) {
    const track = ctx.db.track.id.find(entry.trackId);
    if (!track) continue;

    const pointsFor = (userId: bigint) =>
      guesses
        .filter(
          (g) => g.roundIndex === entry.roundIndex && g.userId === userId && g.correct,
        )
        .reduce((sum, g) => sum + g.points, 0);

    const pointsA = pointsFor(userAId);
    const pointsB = pointsFor(userBId);

    // Rounds nobody reached (the match ended early) carry no signal.
    if (pointsA === 0 && pointsB === 0) continue;

    for (const categoryId of track.categoryIds) {
      resultsA.push({
        categoryId: String(categoryId),
        playerPoints: pointsA,
        opponentPoints: pointsB,
      });
      resultsB.push({
        categoryId: String(categoryId),
        playerPoints: pointsB,
        opponentPoints: pointsA,
      });
    }
  }

  persistCategoryRatings(ctx, userAId, userBId, resultsA, config);
  persistCategoryRatings(ctx, userBId, userAId, resultsB, config);
}

function persistCategoryRatings(
  ctx: ReducerCtx,
  userId: bigint,
  opponentId: bigint,
  results: CategoryRoundResult[],
  config: ResolvedConfig,
): void {
  if (results.length === 0) return;

  const load = (id: bigint) => {
    const ratings: Record<string, { rating: number; games: number }> = {};
    for (const row of ctx.db.category_rating.userId.filter(id)) {
      ratings[String(row.categoryId)] = { rating: row.rating, games: row.games };
    }
    return ratings;
  };

  const updates = applyCategoryResults(
    {
      results,
      currentRatings: load(userId),
      opponentRatings: load(opponentId),
      defaultRating: config.STARTING_ELO,
    },
    config,
  );

  for (const update of updates) {
    const categoryId = BigInt(update.categoryId);
    const existing = [
      ...ctx.db.category_rating.by_user_category.filter([userId, categoryId]),
    ][0];

    if (existing) {
      ctx.db.category_rating.id.update({
        ...existing,
        rating: update.rating,
        games: update.games,
      });
      continue;
    }

    ctx.db.category_rating.insert({
      id: 0n,
      userId,
      categoryId,
      rating: update.rating,
      games: update.games,
    });
  }
}
