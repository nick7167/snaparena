import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { DUEL_STARTING_HP, ROOM_STARTING_HP, STARTING_ELO } from "../src/engine/config";
import {
  applyCategoryResults,
  applyMatchResult,
  outcomeFromScores,
  type CategoryRoundResult,
  type Outcome,
} from "../src/engine/elo";
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

    // Ranked rating first, so XP and badges can see the post-match rating.
    if (match.mode === "ranked" && players.length === 2) {
      await applyRanked(ctx, match, players);
    }

    for (const player of players) {
      await applyProgression(ctx, match, player, guesses);
    }
  },
});

/** Elo and per-category ratings for a completed ranked match. */
async function applyRanked(
  ctx: MutationCtx,
  match: Doc<"matches">,
  players: Doc<"matchPlayers">[],
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

  const updateA = applyMatchResult({
    rating: userA.elo,
    opponentRating: userB.elo,
    outcome: outcomeA,
    gamesPlayed: userA.gamesPlayed,
  });
  const updateB = applyMatchResult({
    rating: userB.elo,
    opponentRating: userA.elo,
    outcome: outcomeB,
    gamesPlayed: userB.gamesPlayed,
  });

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

  await applyPerCategoryRatings(ctx, match, a.userId, b.userId);
}

/** XP, level and badges for one player. */
async function applyProgression(
  ctx: MutationCtx,
  match: Doc<"matches">,
  player: Doc<"matchPlayers">,
  guesses: Doc<"guesses">[],
): Promise<void> {
  const user = await ctx.db.get(player.userId);
  if (!user) return;
  // Bots earn nothing. Their rating is a fixed persona property and levelling them
  // up would put synthetic accounts on progression leaderboards.
  if (user.isBot) return;

  const mine = guesses.filter(
    (guess) => guess.userId === player.userId && guess.correct,
  );
  const snapGuesses = mine.filter(
    (guess) => tierForElapsed(guess.clientElapsedMs).id === "snap",
  ).length;

  const won = match.winnerId === player.userId;
  const roundsWon = countRoundsWon(match, player.userId, guesses);

  const xpAward = awardMatchXp({
    mode: match.mode,
    won,
    roundsWon,
    correctGuesses: mine.length,
    snapGuesses,
  });

  const totalXp = (user.xp ?? 0) + xpAward.total;
  const totalSnaps = (user.snapGuesses ?? 0) + snapGuesses;

  await ctx.db.patch(user._id, {
    xp: totalXp,
    level: levelForXp(totalXp).level,
    snapGuesses: totalSnaps,
  });

  const badges = await awardBadges(ctx, match, player, user, {
    won,
    totalSnapGuesses: totalSnaps,
    // Finishing on full health means the opponent never once out-scored them.
    tookNoDamage: (player.hp ?? 0) >= startingHpFor(match.mode),
    wonFromCritical:
      (player.lowestHp ?? player.hp ?? 0) < startingHpFor(match.mode) * 0.25,
    wonSuddenDeath: won && match.suddenDeath === true,
  });

  await ctx.db.patch(player._id, { xpEarned: xpAward.total, badgesEarned: badges });
}

/** Starting health for the mode, so badge thresholds compare against the right baseline. */
function startingHpFor(mode: Doc<"matches">["mode"]): number {
  return mode === "room" ? ROOM_STARTING_HP : DUEL_STARTING_HP;
}

/**
 * Rounds in which this player out-scored every opponent.
 *
 * Replaces the old set count: with no sets, a round win is the natural unit of
 * progress to pay XP on.
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

    const mine = pointsFor(userId);
    if (mine === 0) continue;

    const others = match.playerIds.filter((id) => id !== userId).map(pointsFor);
    if (others.every((points) => mine > points)) won++;
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
    opponentEloAdvantage: (player.ratingBefore ?? STARTING_ELO) < (opponentDoc?.elo ?? 0)
      ? (opponentDoc?.elo ?? 0) - (player.ratingBefore ?? STARTING_ELO)
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

  await persistCategoryRatings(ctx, userAId, userBId, resultsA);
  await persistCategoryRatings(ctx, userBId, userAId, resultsB);
}

async function persistCategoryRatings(
  ctx: MutationCtx,
  userId: Id<"users">,
  opponentId: Id<"users">,
  results: CategoryRoundResult[],
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

  const updates = applyCategoryResults({
    results,
    currentRatings: await load(userId),
    opponentRatings: await load(opponentId),
    defaultRating: STARTING_ELO,
  });

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


