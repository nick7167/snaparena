import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveConfig } from "./config";
import type { ResolvedConfig } from "../src/engine/config-merge";
import {
  applyCategoryResults,
  applyMatchResult,
  outcomeFromScores,
  type CategoryRoundResult,
  type Outcome,
} from "../src/engine/elo";
import { wonRound } from "../src/engine/duel";
import { evaluateBadges } from "../src/engine/badges";
import { awardMatchXp } from "../src/engine/xp";
import { levelForXp } from "../src/engine/xp";
import { tierForElapsed } from "../src/engine/scoring";

/**
 * Applies everything that happens *after* a match: rating, XP, badges.
 *
 * Kept out of the phase machine so match flow and progression rules stay
 * independent — and so this can be re-run safely. Guarded on `ratingAfter` already
 * being set, so a duplicate schedule cannot pay a player twice.
 */
export const finalizeMatch = internalMutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return;

    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();

    if (players.length === 0) return;
    if (players.some((player) => player.xpEarned !== undefined)) return; // already applied

    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_match_round", (q) => q.eq("matchId", args.matchId))
      .collect();

    /**
     * The rules this match was PLAYED under, not the ones in force now.
     *
     * Resolved once here and threaded down, so a config saved between the last round and
     * this scheduled mutation cannot pay out XP the players were never told about.
     */
    const config = await resolveConfig(ctx, match.configVersionId);

    // Ranked rating first, so XP and badges can see the post-match rating.
    if (match.mode === "ranked" && players.length === 2) {
      await applyRanked(ctx, match, players, config);
    }

    for (const player of players) {
      await applyProgression(ctx, match, player, guesses, config);
    }
  },
});

/** Elo and per-category ratings for a completed ranked match. */
async function applyRanked(
  ctx: MutationCtx,
  match: Doc<"matches">,
  players: Doc<"matchPlayers">[],
  config: ResolvedConfig,
): Promise<void> {
  if (players.some((player) => player.ratingAfter !== undefined)) return;

  const [a, b] = players;
  const userA = await ctx.db.get(a.userId);
  const userB = await ctx.db.get(b.userId);
  if (!userA || !userB) return;

  // A forfeit is a full loss; otherwise the match winner decided by sets wins.
  const outcomeA: Outcome = a.forfeited
    ? 0
    : b.forfeited
      ? 1
      : match.winnerId
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

  await ctx.db.patch(userA._id, {
    elo: updateA.rating,
    gamesPlayed: updateA.gamesPlayed,
    placementsRemaining: updateA.placementsRemaining,
    rankedWins: (userA.rankedWins ?? 0) + (outcomeA === 1 ? 1 : 0),
  });
  await ctx.db.patch(userB._id, {
    elo: updateB.rating,
    gamesPlayed: updateB.gamesPlayed,
    placementsRemaining: updateB.placementsRemaining,
    rankedWins: (userB.rankedWins ?? 0) + (outcomeB === 1 ? 1 : 0),
  });

  await ctx.db.patch(a._id, { ratingAfter: updateA.rating, ratingDelta: updateA.delta });
  await ctx.db.patch(b._id, { ratingAfter: updateB.rating, ratingDelta: updateB.delta });

  await applyPerCategoryRatings(ctx, match, a.userId, b.userId, config);
}

/** XP, level and badges for one player. */
async function applyProgression(
  ctx: MutationCtx,
  match: Doc<"matches">,
  player: Doc<"matchPlayers">,
  guesses: Doc<"guesses">[],
  config: ResolvedConfig,
): Promise<void> {
  const user = await ctx.db.get(player.userId);
  if (!user) return;
  // Bots earn nothing. Their rating is a fixed persona property and levelling them
  // up would put synthetic accounts on progression leaderboards.
  if (user.isBot) return;
  // Neither do guests. A guest row is a throwaway identity that can only play the
  // daily, and `claimGuestRun` transfers the RUN to the real account but never the XP —
  // so anything paid here was written to a row nobody will ever see again.
  if (user.isGuest) return;

  const mine = guesses.filter(
    (guess) => guess.userId === player.userId && guess.correct,
  );
  const snapGuesses = mine.filter(
    (guess) => tierForElapsed(guess.clientElapsedMs, config).id === "snap",
  ).length;

  const won = match.winnerId === player.userId;
  const roundsWon = countRoundsWon(match, player.userId, guesses);

  const xpAward = awardMatchXp(
    {
      mode: match.mode,
      won,
      roundsWon,
      correctGuesses: mine.length,
      snapGuesses,
    },
    config,
  );

  const xpBefore = user.xp ?? 0;
  const totalXp = xpBefore + xpAward.total;
  const totalSnaps = (user.snapGuesses ?? 0) + snapGuesses;

  // Captured either side of the patch below: once `users.xp` moves, the level the
  // player held going in is unrecoverable, and that is exactly what the results screen
  // needs to animate from and to detect a level-up against.
  const levelBefore = levelForXp(xpBefore, config).level;
  const levelAfter = levelForXp(totalXp, config).level;

  await ctx.db.patch(user._id, {
    xp: totalXp,
    level: levelAfter,
    snapGuesses: totalSnaps,
  });

  const badges = await awardBadges(
    ctx,
    match,
    player,
    user,
    {
      won,
      totalSnapGuesses: totalSnaps,
      // Finishing on full health means the opponent never once out-scored them.
      tookNoDamage: (player.hp ?? 0) >= startingHpFor(match.mode, config),
      wonFromCritical:
        (player.lowestHp ?? player.hp ?? 0) < startingHpFor(match.mode, config) * 0.25,
      wonSuddenDeath: won && match.suddenDeath === true,
    },
    config,
  );

  await ctx.db.patch(player._id, {
    xpEarned: xpAward.total,
    xpBreakdown: xpAward.breakdown.map((entry) => ({ ...entry })),
    levelBefore,
    levelAfter,
    xpAfter: totalXp,
    badgesEarned: badges,
  });
}

/** Starting health for the mode, so badge thresholds compare against the right baseline. */
function startingHpFor(mode: Doc<"matches">["mode"], config: ResolvedConfig): number {
  return mode === "room" ? config.ROOM_STARTING_HP : config.DUEL_STARTING_HP;
}

/**
 * Rounds in which this player out-scored every opponent.
 *
 * Replaces the old set count: with no sets, a round win is the natural unit of
 * progress to pay XP on. The "did I take this round" rule itself lives in
 * `wonRound` — see there for why the no-opponent case is explicit.
 */
function countRoundsWon(
  match: Doc<"matches">,
  userId: Id<"users">,
  guesses: Doc<"guesses">[],
): number {
  let won = 0;

  for (let round = 0; round < match.trackIds.length; round++) {
    const pointsFor = (id: Id<"users">) =>
      guesses
        .filter((g) => g.roundIndex === round && g.userId === id && g.correct)
        .reduce((sum, g) => sum + g.points, 0);

    const others = match.playerIds.filter((id) => id !== userId).map(pointsFor);
    if (wonRound(pointsFor(userId), others)) won++;
  }

  return won;
}

/** Evaluates badges and inserts only the ones the player does not already hold. */
async function awardBadges(
  ctx: MutationCtx,
  match: Doc<"matches">,
  player: Doc<"matchPlayers">,
  user: Doc<"users">,
  facts: {
    won: boolean;
    totalSnapGuesses: number;
    tookNoDamage: boolean;
    wonFromCritical: boolean;
    wonSuddenDeath: boolean;
  },
  config: ResolvedConfig,
): Promise<string[]> {
  const opponent = match.playerIds.find((id) => id !== player.userId);
  const opponentDoc = opponent ? await ctx.db.get(opponent) : null;

  const candidates = evaluateBadges({
    mode: match.mode,
    won: facts.won,
    totalRankedWins: user.rankedWins ?? 0,
    totalRankedMatches: user.gamesPlayed,
    totalSnapGuesses: facts.totalSnapGuesses,
    tookNoDamage: facts.tookNoDamage,
    wonFromCritical: facts.wonFromCritical,
    wonSuddenDeath: facts.wonSuddenDeath,
    // Compare against the rating the opponent held going in, not after this match.
    opponentEloAdvantage: (player.ratingBefore ?? config.STARTING_ELO) < (opponentDoc?.elo ?? 0)
      ? (opponentDoc?.elo ?? 0) - (player.ratingBefore ?? config.STARTING_ELO)
      : 0,
  });

  const newlyEarned: string[] = [];

  for (const badgeId of candidates) {
    const existing = await ctx.db
      .query("userBadges")
      .withIndex("by_user_badge", (q) =>
        q.eq("userId", player.userId).eq("badgeId", badgeId),
      )
      .unique();

    if (existing) continue;

    await ctx.db.insert("userBadges", {
      userId: player.userId,
      badgeId,
      earnedAt: Date.now(),
    });
    newlyEarned.push(badgeId);
  }

  return newlyEarned;
}

/**
 * Per-track head-to-heads feeding the per-category ratings. One song is a tiny
 * sample, so these move at a deliberately low K.
 */
async function applyPerCategoryRatings(
  ctx: MutationCtx,
  match: Doc<"matches">,
  userAId: Id<"users">,
  userBId: Id<"users">,
  config: ResolvedConfig,
): Promise<void> {
  const guesses = await ctx.db
    .query("guesses")
    .withIndex("by_match_round", (q) => q.eq("matchId", match._id))
    .collect();

  const resultsA: CategoryRoundResult[] = [];
  const resultsB: CategoryRoundResult[] = [];

  for (let round = 0; round < match.trackIds.length; round++) {
    const track = await ctx.db.get(match.trackIds[round]);
    if (!track) continue;

    const pointsFor = (userId: Id<"users">) =>
      guesses
        .filter((g) => g.roundIndex === round && g.userId === userId && g.correct)
        .reduce((sum, g) => sum + g.points, 0);

    const pointsA = pointsFor(userAId);
    const pointsB = pointsFor(userBId);

    // Rounds nobody reached (match ended early at 2-0) carry no signal.
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

  await persistCategoryRatings(ctx, userAId, userBId, resultsA, config);
  await persistCategoryRatings(ctx, userBId, userAId, resultsB, config);
}

async function persistCategoryRatings(
  ctx: MutationCtx,
  userId: Id<"users">,
  opponentId: Id<"users">,
  results: CategoryRoundResult[],
  config: ResolvedConfig,
): Promise<void> {
  if (results.length === 0) return;

  const load = async (id: Id<"users">) => {
    const rows = await ctx.db
      .query("categoryRatings")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .collect();
    return Object.fromEntries(
      rows.map((row) => [String(row.categoryId), { rating: row.rating, games: row.games }]),
    );
  };

  const updates = applyCategoryResults(
    {
      results,
      currentRatings: await load(userId),
      opponentRatings: await load(opponentId),
      defaultRating: config.STARTING_ELO,
    },
    config,
  );

  for (const update of updates) {
    const categoryId = update.categoryId as Id<"categories">;
    const existing = await ctx.db
      .query("categoryRatings")
      .withIndex("by_user_category", (q) =>
        q.eq("userId", userId).eq("categoryId", categoryId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { rating: update.rating, games: update.games });
    } else {
      await ctx.db.insert("categoryRatings", {
        userId,
        categoryId,
        rating: update.rating,
        games: update.games,
      });
    }
  }
}


