import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { currentUser, requireUser } from "./users";
import { pickTracksForMatch } from "./tracks";
import { enterPhase } from "./phases";
import { DAILY_SONGS } from "../src/engine/config";

/** UTC date key. The daily challenge rolls over at midnight UTC for everyone. */
export function todayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Returns today's challenge, creating it on first request.
 *
 * Every player worldwide gets the same five tracks, which is what makes the
 * shared score comparable — and therefore what makes a result card worth posting.
 * Mid-difficulty tier: the daily is the front door, so it must not be brutal.
 */
async function ensureChallenge(ctx: MutationCtx, date: string): Promise<Id<"tracks">[]> {
  const existing = await ctx.db
    .query("dailyChallenges")
    .withIndex("by_date", (q) => q.eq("date", date))
    .unique();

  if (existing) return existing.trackIds;

  const trackIds = await pickTracksForMatch(ctx, {
    targetTier: 2,
    bannedCategoryIds: [],
    count: DAILY_SONGS,
  });

  await ctx.db.insert("dailyChallenges", { date, trackIds });
  return trackIds;
}

export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const date = todayKey();

    const alreadyPlayed = await ctx.db
      .query("dailyRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();

    if (alreadyPlayed) {
      return { status: "already-played" as const, run: alreadyPlayed };
    }

    const trackIds = await ensureChallenge(ctx, date);
    if (trackIds.length < DAILY_SONGS) {
      return { status: "catalogue-too-small" as const };
    }

    const matchId = await ctx.db.insert("matches", {
      mode: "daily",
      status: "active",
      playerIds: [user._id],
      trackIds,
      bannedCategoryIds: [],
      currentRound: 0,
      currentSet: 0,
      setResults: [],
      createdAt: Date.now(),
    });

    await ctx.db.insert("matchPlayers", {
      matchId,
      userId: user._id,
      totalPoints: 0,
      ratingBefore: user.elo,
      forfeited: false,
      lastSeenAt: Date.now(),
    });

    // Solo, so no VS screen — but the countdown, reveal and standings beats still
    // apply. The drama is the point, not the opponent.
    await enterPhase(ctx, matchId, "countdown");

    return { status: "started" as const, matchId, date };
  },
});

/** Records the finished run. The daily never affects Elo. */
export const complete = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match || match.mode !== "daily") throw new Error("Not a daily match");

    const date = todayKey(match.createdAt);

    const existing = await ctx.db
      .query("dailyRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();

    if (existing) return existing._id; // idempotent

    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_match_round", (q) => q.eq("matchId", args.matchId))
      .collect();

    const perRoundPoints: number[] = [];
    const perRoundMs: number[] = [];

    for (let round = 0; round < match.trackIds.length; round++) {
      const solved = guesses.find(
        (guess) => guess.roundIndex === round && guess.userId === user._id && guess.correct,
      );
      perRoundPoints.push(solved?.points ?? 0);
      // -1 marks "never solved", distinct from a genuine 0ms.
      perRoundMs.push(solved ? Math.round(solved.clientElapsedMs) : -1);
    }

    return await ctx.db.insert("dailyRuns", {
      userId: user._id,
      date,
      totalPoints: perRoundPoints.reduce((sum, points) => sum + points, 0),
      perRoundPoints,
      perRoundMs,
      completedAt: Date.now(),
    });
  },
});

export const leaderboard = query({
  args: { date: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const date = args.date ?? todayKey();
    const limit = Math.min(args.limit ?? 100, 250);

    const runs = await ctx.db
      .query("dailyRuns")
      .withIndex("by_date_points", (q) => q.eq("date", date))
      .order("desc")
      .take(limit);

    const users = await Promise.all(runs.map((run) => ctx.db.get(run.userId)));

    return runs.map((run, index) => ({
      rank: index + 1,
      handle: users[index]?.handle ?? "unknown",
      displayName: users[index]?.displayName ?? "Unknown",
      avatarUrl: users[index]?.avatarUrl,
      totalPoints: run.totalPoints,
      perRoundMs: run.perRoundMs,
    }));
  },
});

/** The signed-in player's own run and standing, for the result card. */
export const myRun = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    const date = args.date ?? todayKey();

    const run = await ctx.db
      .query("dailyRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();

    if (!run) return null;

    // Rank by counting better scores. Fine at launch scale; if the daily grows
    // past a few thousand players this should become a stored rank.
    const better = await ctx.db
      .query("dailyRuns")
      .withIndex("by_date_points", (q) => q.eq("date", date).gt("totalPoints", run.totalPoints))
      .collect();

    const total = (await ctx.db
      .query("dailyRuns")
      .withIndex("by_date_points", (q) => q.eq("date", date))
      .collect()).length;

    return { ...run, rank: better.length + 1, totalPlayers: total };
  },
});
