import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./users";
import { difficultyTierForElo, pickTracksForMatch } from "./tracks";
import { enterPhase } from "./phases";
import {
  MAX_SETS,
  RECONNECT_GRACE_MS,
  SONGS_PER_SET,
  STARTING_ELO,
  VETO_BANS_PER_PLAYER,
  VETO_PHASE_MS,
  VETO_POOL_SIZE,
} from "../src/engine/config";

/** Full-distance track count. Ranked may end early at 2-0, but tracks are drawn once. */
const RANKED_TRACK_COUNT = MAX_SETS * SONGS_PER_SET;

/**
 * Elo band for matchmaking, widening with time spent in queue.
 *
 * Starts tight so early matches are fair, then loosens rather than leaving a
 * player queueing forever — which matters a great deal at launch, when the pool
 * is small enough that a strict band would never match anyone.
 */
function eloBandFor(waitMs: number): number {
  const seconds = waitMs / 1_000;
  return Math.min(100 + seconds * 20, 1_000);
}

export const queueStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const entry = await ctx.db
      .query("queue")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const queueSize = (await ctx.db.query("queue").take(100)).length;

    return {
      inQueue: entry !== null,
      waitingMs: entry ? Date.now() - entry.enqueuedAt : 0,
      /** Shown honestly in the UI — an empty pool must not spin forever. */
      playersWaiting: queueSize,
    };
  },
});

export const enqueue = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("queue")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) return { queued: true as const };

    await ctx.db.insert("queue", {
      userId: user._id,
      elo: user.elo,
      enqueuedAt: Date.now(),
    });

    return { queued: true as const };
  },
});

export const dequeue = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const entry = await ctx.db
      .query("queue")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (entry) await ctx.db.delete(entry._id);
  },
});

/** A match this player is already in, so a reload drops them back into it. */
export const activeMatch = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const mine = await ctx.db
      .query("matchPlayers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(5);

    for (const entry of mine) {
      const match = await ctx.db.get(entry.matchId);
      if (match && match.mode === "ranked" && (match.status === "veto" || match.status === "active")) {
        return match._id;
      }
    }
    return null;
  },
});

/**
 * Attempts to pair the calling player with someone in the queue.
 *
 * Runs as a transaction, so two players calling it simultaneously cannot both
 * claim the same opponent: whichever transaction commits second re-reads the
 * queue and finds the entry already gone.
 */
export const tryMatchmake = mutation({
  args: {},
  handler: async (ctx): Promise<{ matched: false } | { matched: true; matchId: Id<"matches"> }> => {
    const user = await requireUser(ctx);

    const myEntry = await ctx.db
      .query("queue")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!myEntry) return { matched: false };

    const band = eloBandFor(Date.now() - myEntry.enqueuedAt);

    const candidates = await ctx.db
      .query("queue")
      .withIndex("by_elo", (q) => q.gte("elo", user.elo - band).lte("elo", user.elo + band))
      .take(25);

    // Prefer the longest-waiting opponent so nobody starves at the back of the pool.
    const opponentEntry = candidates
      .filter((entry) => entry.userId !== user._id)
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt)[0];

    if (!opponentEntry) return { matched: false };

    const opponent = await ctx.db.get(opponentEntry.userId);
    if (!opponent) {
      await ctx.db.delete(opponentEntry._id);
      return { matched: false };
    }

    await ctx.db.delete(myEntry._id);
    await ctx.db.delete(opponentEntry._id);

    const pool = await pickVetoPool(ctx);

    const matchId = await ctx.db.insert("matches", {
      mode: "ranked",
      status: "veto",
      playerIds: [user._id, opponent._id],
      trackIds: [],
      bannedCategoryIds: [],
      vetoPoolIds: pool,
      currentRound: 0,
      currentSet: 0,
      setResults: [],
      createdAt: Date.now(),
    });

    for (const player of [user, opponent]) {
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId: player._id,
        totalPoints: 0,
        setsWon: 0,
        ratingBefore: player.elo,
        forfeited: false,
        lastSeenAt: Date.now(),
      });
    }

    // Meet your opponent before the draft. The scheduler moves this on to veto.
    await enterPhase(ctx, matchId, "vs_reveal");

    return { matched: true, matchId };
  },
});

/** Chooses the categories offered in the ban phase. */
async function pickVetoPool(ctx: MutationCtx): Promise<Id<"categories">[]> {
  const all = await ctx.db.query("categories").collect();
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, VETO_POOL_SIZE).map((category) => category._id);
}

/**
 * Records one player's bans. Both players ban the same number of categories, which
 * is what keeps the phase symmetric and therefore fair for a rated match.
 */
export const submitBans = mutation({
  args: { matchId: v.id("matches"), categoryIds: v.array(v.id("categories")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const match = await ctx.db.get(args.matchId);

    if (!match) throw new Error("No such match");
    if (match.status !== "veto") throw new Error("Veto phase is over");
    if (!match.playerIds.some((id) => id === user._id)) throw new Error("Not a player");

    if (args.categoryIds.length !== VETO_BANS_PER_PLAYER) {
      throw new Error(`Ban exactly ${VETO_BANS_PER_PLAYER} categories`);
    }

    const pool = new Set((match.vetoPoolIds ?? []).map(String));
    if (!args.categoryIds.every((id) => pool.has(String(id)))) {
      throw new Error("Category is not in this match's veto pool");
    }

    const already = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) => q.eq("matchId", args.matchId).eq("userId", user._id))
      .unique();

    if (!already) throw new Error("Not a player");
    if (already.bannedCategoryIds) throw new Error("Bans already submitted");

    await ctx.db.patch(already._id, { bannedCategoryIds: args.categoryIds });

    // The deadline only starts once the player reaches the draft, so it is set here
    // rather than when the match was created.
    if (!match.vetoDeadline) {
      await ctx.db.patch(match._id, { vetoDeadline: Date.now() + VETO_PHASE_MS });
    }

    await maybeStartMatch(ctx, args.matchId);
    return { submitted: true as const };
  },
});

/**
 * Starts the match once both players have banned, or once the veto clock expires.
 *
 * A player who never bans simply gets no bans — the alternative (blocking the
 * match) would let someone grief their opponent by idling.
 */
async function maybeStartMatch(ctx: MutationCtx, matchId: Id<"matches">): Promise<void> {
  const match = await ctx.db.get(matchId);
  if (!match || match.status !== "veto") return;

  const players = await ctx.db
    .query("matchPlayers")
    .withIndex("by_match", (q) => q.eq("matchId", matchId))
    .collect();

  const everyoneBanned = players.every((player) => player.bannedCategoryIds !== undefined);
  const deadlinePassed = match.vetoDeadline !== undefined && Date.now() >= match.vetoDeadline;

  if (!everyoneBanned && !deadlinePassed) return;

  const bannedCategoryIds = players.flatMap((player) => player.bannedCategoryIds ?? []);

  const users = await Promise.all(match.playerIds.map((id) => ctx.db.get(id)));
  const ratings = users.map((user) => user?.elo ?? STARTING_ELO);
  const averageElo = ratings.reduce((sum, value) => sum + value, 0) / (ratings.length || 1);

  const trackIds = await pickTracksForMatch(ctx, {
    targetTier: difficultyTierForElo(averageElo),
    bannedCategoryIds,
    count: RANKED_TRACK_COUNT,
  });

  if (trackIds.length < RANKED_TRACK_COUNT) {
    // Not enough catalogue to run the full distance — abandon rather than repeat
    // songs, which would let a player who already heard one score for free.
    await ctx.db.patch(matchId, { status: "abandoned", phase: "match_end" });
    return;
  }

  await ctx.db.patch(matchId, {
    status: "active",
    bannedCategoryIds,
    trackIds,
    currentRound: 0,
    currentSet: 0,
  });

  await enterPhase(ctx, matchId, "countdown");
}

/** Client-driven fallback so an idle opponent cannot stall the veto phase forever. */
export const expireVeto = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    await maybeStartMatch(ctx, args.matchId);
  },
});

/** Heartbeat, used to detect a player who has left mid-match. */
export const heartbeat = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) => q.eq("matchId", args.matchId).eq("userId", user._id))
      .unique();
    if (player) await ctx.db.patch(player._id, { lastSeenAt: Date.now() });
  },
});

/**
 * Forfeits any player who has been silent past the reconnect grace period.
 *
 * Disconnect counts as a full loss. Without this, a player who is behind at set
 * two simply closes the tab — the most-exploited hole in any ranked ladder.
 */
export const claimForfeit = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.status !== "active" || match.mode !== "ranked") {
      return { forfeited: false as const };
    }

    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();

    const cutoff = Date.now() - RECONNECT_GRACE_MS;
    const absent = players.filter((player) => player.lastSeenAt < cutoff);

    if (absent.length === 0 || absent.length === players.length) {
      return { forfeited: false as const };
    }

    for (const player of absent) {
      await ctx.db.patch(player._id, { forfeited: true });
    }

    const survivor = players.find((player) => !absent.includes(player));

    await ctx.db.patch(args.matchId, {
      status: "complete",
      phase: "match_end",
      phaseEndsAt: undefined,
      winnerId: survivor?.userId,
      completedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.progression.finalizeMatch, {
      matchId: args.matchId,
    });

    return { forfeited: true as const };
  },
});
