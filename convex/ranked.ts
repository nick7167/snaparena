import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./users";
import {
  DUEL_STARTING_HP,
  RECONNECT_GRACE_MS,
  SURRENDER_FROM_ROUND,
} from "../src/engine/config";
import { canSurrender } from "../src/engine/duel";
import { enterPhase, finishMatch } from "./phases";
import {
  TOTAL_BANS,
  draftTurnOwner,
  pickVetoPool,
  placeBan,
  startDuelIfDraftDone,
} from "./draft";

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
      // Practice counts too — a reload mid-bot-match should drop you back in.
      const isDuel = match?.mode === "ranked" || match?.mode === "practice";
      if (match && isDuel && (match.status === "veto" || match.status === "active")) {
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
      createdAt: Date.now(),
      // Lower-rated player bans first: a small, legible equaliser that is never
      // arbitrary, unlike a coin flip.
      banOrder:
        user.elo <= opponent.elo ? [user._id, opponent._id] : [opponent._id, user._id],
      banTurn: 0,
    });

    for (const player of [user, opponent]) {
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId: player._id,
        totalPoints: 0,
        hp: DUEL_STARTING_HP,
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

/**
 * Everything the draft screen needs: the pool, what is gone, and whose turn it is.
 *
 * Whose turn is decided server-side so the two clients can never disagree about it.
 */
export const draftState = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) return null;

    const turn = match.banTurn ?? 0;
    const banned = new Set(match.bannedCategoryIds.map(String));

    const pool = await Promise.all(
      (match.vetoPoolIds ?? []).map(async (categoryId) => {
        const category = await ctx.db.get(categoryId);
        return category
          ? { id: category._id, name: category.name, banned: banned.has(String(categoryId)) }
          : null;
      }),
    );

    // Named rather than "your opponent": watching Seoul Search take away country is
    // a read on who you are about to play, which is the entire point of a draft.
    const opponentId = match.playerIds.find((id) => id !== user._id);
    const opponentDoc = opponentId ? await ctx.db.get(opponentId) : null;

    return {
      pool: pool.filter((entry) => entry !== null),
      bansPlaced: turn,
      totalBans: TOTAL_BANS,
      isMyTurn: draftTurnOwner(match) === user._id,
      deadline: match.vetoDeadline ?? null,
      opponent: opponentDoc
        ? {
            displayName: opponentDoc.displayName,
            handle: opponentDoc.handle,
            avatarUrl: opponentDoc.avatarUrl ?? null,
            elo: opponentDoc.elo,
            isBot: opponentDoc.isBot === true,
          }
        : null,
    };
  },
});

/**
 * Places a single ban in the turn-based draft.
 *
 * Alternating rather than simultaneous, so each ban is a read on the opponent —
 * you see what they took away before choosing your own. The lower-rated player bans
 * first, which is a small legible equaliser.
 */
export const submitBan = mutation({
  args: { matchId: v.id("matches"), categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const match = await ctx.db.get(args.matchId);

    if (!match) throw new Error("No such match");
    if (match.phase !== "veto") throw new Error("The draft is over");

    if ((match.banTurn ?? 0) >= TOTAL_BANS) throw new Error("The draft is over");
    if (draftTurnOwner(match) !== user._id) throw new Error("Not your turn");

    const pool = new Set((match.vetoPoolIds ?? []).map(String));
    if (!pool.has(String(args.categoryId))) {
      throw new Error("Category is not in this match's pool");
    }
    if (match.bannedCategoryIds.some((id) => id === args.categoryId)) {
      throw new Error("That category is already banned");
    }

    await placeBan(ctx, match, args.categoryId);
    await startDuelIfDraftDone(ctx, args.matchId);
    return { placed: true as const };
  },
});

/**
 * Concedes the duel.
 *
 * A ten-minute duel that is already lost is a long time to sit through, and without
 * this the losing player simply closes the tab — leaving the winner waiting out a
 * reconnect grace period for nothing. The Elo loss is identical to playing it out.
 */
export const surrender = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const match = await ctx.db.get(args.matchId);

    if (!match || match.status !== "active") return { surrendered: false as const };
    if (match.mode === "daily" || match.mode === "room") {
      // Rooms eliminate rather than concede; the daily has no opponent.
      return { surrendered: false as const };
    }
    if (!canSurrender(match.currentRound, SURRENDER_FROM_ROUND)) {
      return { surrendered: false as const };
    }

    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) => q.eq("matchId", args.matchId).eq("userId", user._id))
      .unique();
    if (!player) return { surrendered: false as const };

    await ctx.db.patch(player._id, { forfeited: true, hp: 0 });

    const opponentId = match.playerIds.find((id) => id !== user._id);
    await finishMatch(ctx, match, opponentId);

    return { surrendered: true as const };
  },
});

/** Client-driven fallback so an idle opponent cannot stall the veto phase forever. */
export const expireVeto = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    await startDuelIfDraftDone(ctx, args.matchId);
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
