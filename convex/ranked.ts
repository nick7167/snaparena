import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { publicAvatarUrl, requireUser } from "./users";
import { globalPosition } from "./ladder";
import {
  DUEL_STARTING_HP,
  RECONNECT_GRACE_MS,
  SURRENDER_FROM_ROUND,
} from "../src/engine/config";
import { canSurrender } from "../src/engine/duel";
import { eloBandFor } from "../src/engine/matchmaking";
import { armVsCountdown, enterPhase, finishMatch } from "./phases";
import {
  TOTAL_BANS,
  draftTurnOwner,
  pickVetoPool,
  placeBan,
  startDuelIfDraftDone,
} from "./draft";
// DEV ONLY — delete with convex/devbots.ts. See the single call site in `tryMatchmake`.
import { pickDevOpponent } from "./devbots";
import { devRankBotsEnabled } from "../src/engine/dev-rank-bots";

export const queueStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const entry = await ctx.db
      .query("queue")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    /**
     * Humans only.
     *
     * This counted every row, and the dev rank-bot cron keeps sixteen of them stocked — so
     * it read "17 players" permanently, to everyone, on a shared deployment. A number that
     * never moves answers no question. Bots remain matchable; they just do not count as
     * company, which is what this line is actually reporting.
     */
    const queueSize = (await ctx.db.query("queue").take(100)).filter(
      (entry) => entry.isBot !== true,
    ).length;

    return {
      inQueue: entry !== null,
      /**
       * The wall-clock the player joined, NOT an elapsed duration.
       *
       * A `Date.now() - enqueuedAt` computed here is frozen at whatever instant the
       * query last re-ran, and a Convex query only re-runs when the data it read
       * changes — so the elapsed figure this used to return never advanced while
       * waiting. The on-screen "0s — widening the rating range" counter was stuck for
       * that reason. Handing back the timestamp lets the client tick it honestly.
       */
      enqueuedAt: entry?.enqueuedAt ?? null,
      /** Shown honestly in the UI — an empty pool must not spin forever. */
      playersWaiting: queueSize,
    };
  },
});

/**
 * Am I queued, and since when.
 *
 * `queueStatus` above answers this too, but it also counts the pool — and that count
 * reads every queue row, while the whole query is subscribed by every signed-in user on
 * every route. One person joining the queue therefore re-ran it once per signed-in user
 * across the app. Splitting the two halves apart leaves this one reading a single row,
 * so it is invalidated only by your own queue entry changing.
 *
 * `queueStatus` is deliberately left in place and unchanged: browsers running the
 * previous deploy still call it.
 */
export const myQueueEntry = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const entry = await ctx.db
      .query("queue")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return {
      inQueue: entry !== null,
      /** The instant they joined, not an elapsed duration — see `queueStatus`. */
      enqueuedAt: entry?.enqueuedAt ?? null,
    };
  },
});

/**
 * How many humans are waiting.
 *
 * Subscribed only while the searching UI is on screen, which is the only place the
 * number is rendered. Bots are excluded for the reason given on the `by_isBot` index.
 */
export const queueSize = query({
  args: {},
  handler: async (ctx) => {
    const humans = await ctx.db
      .query("queue")
      .withIndex("by_isBot", (q) => q.eq("isBot", undefined))
      .take(100);

    return { playersWaiting: humans.length };
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

    const before = await queueSnapshot(ctx);

    await ctx.db.insert("queue", {
      userId: user._id,
      elo: user.elo,
      enqueuedAt: Date.now(),
      isBot: user.isBot === true ? true : undefined,
    });

    /**
     * Start the sweeper, but only on the edge where the pool becomes matchable.
     *
     * `sweep` re-arms itself for as long as it is worth running and stops otherwise, so
     * exactly one chain should exist. Kicking one off unconditionally here would start a
     * second every time somebody joined a queue that was already being swept, and each
     * would keep the other alive. Checking the transition — not matchable before, matchable
     * now — means the chain is started by whoever makes a pairing possible and by nobody
     * else.
     */
    if (!sweepable(before) && sweepable(await queueSnapshot(ctx))) {
      await ctx.scheduler.runAfter(0, internal.ranked.sweep, {});
    }

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
 * Attempts to pair one queued player with someone else in the queue.
 *
 * Runs inside a transaction, so two callers cannot both claim the same opponent:
 * whichever commits second re-reads the queue and finds the entry already gone.
 *
 * Extracted so the server-side `sweep` and the legacy `tryMatchmake` endpoint apply
 * exactly the same rules — the widening band, the longest-waiting preference and the
 * dev-bot branch are decided here and nowhere else.
 */
async function pairFor(
  ctx: MutationCtx,
  user: Doc<"users">,
  myEntry: Doc<"queue">,
): Promise<Id<"matches"> | null> {
  const waitMs = Date.now() - myEntry.enqueuedAt;
  const band = eloBandFor(waitMs);

  const candidates = await ctx.db
    .query("queue")
    .withIndex("by_elo", (q) => q.gte("elo", user.elo - band).lte("elo", user.elo + band))
    .take(25);

  const others = candidates.filter((entry) => entry.userId !== user._id);

  // Prefer the longest-waiting opponent so nobody starves at the back of the pool.
  // DEV ONLY — the branch: with the rank bots seeded, "longest waiting" would return
  // the same bot every time. See `pickDevOpponent`; it still prefers a queued human,
  // so this line is the only thing to revert.
  const opponentEntry = devRankBotsEnabled()
    ? await pickDevOpponent(ctx, user, others, waitMs)
    : others.sort((a, b) => a.enqueuedAt - b.enqueuedAt)[0];

  if (!opponentEntry) return null;

  const opponent = await ctx.db.get(opponentEntry.userId);
  if (!opponent) {
    await ctx.db.delete(opponentEntry._id);
    return null;
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
    // Frozen here so `matches.state` never has to touch the ladder — see the field's note
    // in schema.ts. One stored-field read each, not a walk.
    const { position } = await globalPosition(ctx, player);

    await ctx.db.insert("matchPlayers", {
      matchId,
      userId: player._id,
      totalPoints: 0,
      hp: DUEL_STARTING_HP,
      ratingBefore: player.elo,
      globalRankAtStart: position ?? undefined,
      forfeited: false,
    });

    /**
     * Seeded at creation, not left to the first heartbeat.
     *
     * Somebody who is paired and closes the tab before their client ever beats has to
     * forfeit after the grace period like anyone else — and `lastSeenFor` treats a
     * missing record as present, so without this row that player would be immortal.
     * Ranked only: no other mode reads presence.
     */
    await ctx.db.insert("presence", {
      matchId,
      userId: player._id,
      lastSeenAt: Date.now(),
    });
  }

  // Meet your opponent before the draft. The scheduler moves this on to veto.
  await enterPhase(ctx, matchId, "vs_reveal");

  return matchId;
}

/**
 * Pair me now, if you can.
 *
 * The server sweeper does this on everyone's behalf, so current clients never call it.
 * Kept exported and behaving exactly as before because browsers running the previous
 * deploy still poll it every two seconds, and because it remains the honest answer to
 * "am I matchable right now" for anything that needs one.
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

    const matchId = await pairFor(ctx, user, myEntry);
    return matchId ? { matched: true, matchId } : { matched: false };
  },
});

/** How often the server re-checks the pool while anyone could be paired. */
const SWEEP_INTERVAL_MS = 2_000;

/**
 * Is there anything for a sweep to do?
 *
 * At least one human — bots pair with people, not with each other — and at least two
 * rows, since one entry has nobody to be matched against. This is what stops the chain
 * running forever: the sixteen dev rank bots hold the row count at sixteen permanently,
 * so a sweeper that only checked "is the queue non-empty" would re-arm itself every two
 * seconds for the rest of time, on a deployment where nobody is even playing.
 */
function sweepable(rows: Doc<"queue">[]): boolean {
  return rows.length >= 2 && rows.some((row) => row.isBot !== true);
}

async function queueSnapshot(ctx: MutationCtx): Promise<Doc<"queue">[]> {
  return await ctx.db.query("queue").take(64);
}

/**
 * Pairs everyone who can be paired, then re-arms itself while the pool still could.
 *
 * This replaces a two-second poll that every searching client ran for itself. With N
 * people queued that was N mutations every two seconds, each one reading an overlapping
 * slice of the same `by_elo` range — so write conflicts grew with the square of the
 * queue and the pool contended with itself hardest exactly when it was busiest. One
 * server-side pass does the same work once.
 *
 * Self-scheduling rather than a cron: a two-second cron is 1.3M calls a month on its own,
 * whereas this costs nothing at all while nobody is searching.
 */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await queueSnapshot(ctx);

    /**
     * Humans initiate; bots are only ever chosen as opponents.
     *
     * Not a nicety — a bot's queue row is hours old, so `pairFor` would compute a maxed
     * out rating band for it, and `pickDevOpponent` hands back a waiting human without
     * consulting `DEV_BOT_MIN_WAIT_MS` (that floor gates picking a BOT, not being one).
     * Letting bots drive would therefore pair them with a human on the first sweep and
     * skip the search entirely. Nothing is waiting on a bot's behalf, so nothing is lost.
     *
     * Oldest first, so the longest wait gets first pick of the pool — the same ordering
     * `pairFor` applies when choosing between candidates.
     */
    const ordered = rows
      .filter((row) => row.isBot !== true)
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);

    for (const row of ordered) {
      // An earlier pairing in this same pass may already have consumed this row.
      const entry = await ctx.db.get(row._id);
      if (!entry) continue;

      const user = await ctx.db.get(entry.userId);
      if (!user) {
        // The account went away while queued; drop the orphan rather than trip over it
        // on every future pass.
        await ctx.db.delete(entry._id);
        continue;
      }

      await pairFor(ctx, user, entry);
    }

    if (sweepable(await queueSnapshot(ctx))) {
      await ctx.scheduler.runAfter(SWEEP_INTERVAL_MS, internal.ranked.sweep, {});
    }
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
            avatarUrl: publicAvatarUrl(opponentDoc) ?? null,
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
    /**
     * The early-round gate is about protecting a RATING, so it does not apply to practice.
     *
     * It exists to stop someone bailing out of a rated duel the moment it turns against
     * them. Practice moves no rating, so the gate bought nothing there — and it cost
     * something real: leaving early neither resigned nor got swept (`sweepForfeits` only
     * looks at ranked), so the match stayed `active` forever. `ranked.activeMatch` counts
     * practice, so that corpse then re-routed the player straight back into it on every
     * load, with no way out.
     */
    if (match.mode !== "practice" && !canSurrender(match.currentRound, SURRENDER_FROM_ROUND)) {
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

/**
 * "I have read this, start the match."
 *
 * The opponent reveal is the one phase that ends on player input rather than on its clock:
 * its 30 seconds are a ceiling for someone who walked away, and two players who have both
 * sized each other up should not sit through the remainder.
 *
 * Bots are excluded from the count for the same reason `waitForReady` excludes them — a bot
 * has nothing to read and no client to press with, so requiring its consent would mean
 * every practice match always waited the full 30 seconds. In practice this makes a bot
 * match advance the instant the human presses.
 *
 * Idempotent: pressing twice re-stamps a timestamp nobody reads for ordering, and the phase
 * guard means a press that lands after the match has already moved on does nothing.
 */
export const markVsReady = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const match = await ctx.db.get(args.matchId);

    // Guarded on the phase, so this can never be used to skip a round the player is
    // simply losing.
    if (!match || match.phase !== "vs_reveal") return { ready: false as const };

    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();

    const mine = players.find((player) => player.userId === user._id);
    if (!mine) return { ready: false as const };

    if (mine.vsReadyAt === undefined) {
      await ctx.db.patch(mine._id, { vsReadyAt: Date.now() });
    }

    let everyoneReady = true;
    for (const player of players) {
      if (player.userId === user._id) continue;
      const other = await ctx.db.get(player.userId);
      if (other?.isBot) continue;
      if (player.vsReadyAt === undefined) everyoneReady = false;
    }

    // Re-read rather than reusing `match`: the branch above patched a row, and the
    // transition should act on the state as it stands now.
    //
    // Collapses the clock to three seconds rather than leaving the phase outright. The
    // phase still exits through `advance` → `leaveVsReveal`, so readying and timing out
    // take the same route into the draft — see armVsCountdown.
    if (everyoneReady) {
      const current = await ctx.db.get(args.matchId);
      if (current?.phase === "vs_reveal") await armVsCountdown(ctx, current);
    }

    return { ready: true as const, everyoneReady };
  },
});

/**
 * "I am still here."
 *
 * Writes the `presence` row and then sweeps for anyone who has stopped writing theirs.
 * Presence lives in its own table because this runs every five seconds per player and
 * `matchPlayers` is read by half the app — see the note on the table in `schema.ts`.
 */
export const heartbeat = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) => q.eq("matchId", args.matchId).eq("userId", user._id))
      .unique();
    // Not in this match, so nothing to report and nothing to sweep on their behalf.
    if (!player) return { forfeited: false as const };

    const now = Date.now();

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_match_user", (q) => q.eq("matchId", args.matchId).eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    } else {
      await ctx.db.insert("presence", { matchId: args.matchId, userId: user._id, lastSeenAt: now });
    }

    /**
     * Folded in from the separate `claimForfeit` poll the client used to run alongside
     * this one, halving the presence traffic. Ordered after the write above so a caller
     * can never sweep against its own stale timestamp.
     */
    return await sweepForfeits(ctx, args.matchId);
  },
});

/**
 * When a player was last seen in this match.
 *
 * A `presence` row wins whenever one exists; `matchPlayers.lastSeenAt` is the fallback
 * for matches that began before presence rows were written. `undefined` means there is
 * no evidence either way, and callers must read that as PRESENT — nobody should lose a
 * rated match because we have nothing on file for them.
 *
 * Deliberately not `Math.max` of the two. Once the heartbeat stopped writing
 * `matchPlayers.lastSeenAt`, a match predating the move carries a frozen value there, and
 * taking the larger of the two would keep picking that frozen instant and forfeit a
 * player who is sitting right in front of the screen.
 */
async function lastSeenFor(
  ctx: QueryCtx | MutationCtx,
  matchId: Id<"matches">,
  player: Doc<"matchPlayers">,
): Promise<number | undefined> {
  const row = await ctx.db
    .query("presence")
    .withIndex("by_match_user", (q) => q.eq("matchId", matchId).eq("userId", player.userId))
    .unique();

  return row?.lastSeenAt ?? player.lastSeenAt;
}

/**
 * Forfeits any player who has been silent past the reconnect grace period.
 *
 * Disconnect counts as a full loss. Without this, a player who is behind at set
 * two simply closes the tab — the most-exploited hole in any ranked ladder.
 *
 * Driven by `heartbeat`, so the sweep costs no call of its own: whoever is still here is
 * exactly who should be reporting that the other side is not. Both players drive it for
 * each other, which is the same topology as the client polling it separately — and if
 * both are gone, nobody sweeps, also as before. Such a match is reaped elsewhere.
 */
async function sweepForfeits(ctx: MutationCtx, matchId: Id<"matches">) {
  const match = await ctx.db.get(matchId);
  if (!match || match.status !== "active" || match.mode !== "ranked") {
    return { forfeited: false as const };
  }

  const players = await ctx.db
    .query("matchPlayers")
    .withIndex("by_match", (q) => q.eq("matchId", matchId))
    .collect();

  const cutoff = Date.now() - RECONNECT_GRACE_MS;

  // Bots have no client and therefore never heartbeat: `lastSeenAt` is written once
  // when the match is created and never again. Counting them as absent forfeited the
  // bot twenty seconds into every rated match against one — the human's own poll
  // handing them a free win before the first song finished. A bot cannot disconnect,
  // so it can never be the absent player.
  //
  // This filter also sets the denominator in the everyone-gone guard below, which is the
  // less obvious half of why it has to stay. Counting the bot as a live player would make
  // `absent.length !== humans.length` when the only human walks away, and the bot would
  // be awarded the match.
  const humans: Doc<"matchPlayers">[] = [];
  for (const player of players) {
    const user = await ctx.db.get(player.userId);
    if (user?.isBot) continue;
    humans.push(player);
  }

  // No record at all counts as present — see `lastSeenFor`.
  const absent: Doc<"matchPlayers">[] = [];
  for (const player of humans) {
    const lastSeen = await lastSeenFor(ctx, matchId, player);
    if (lastSeen !== undefined && lastSeen < cutoff) absent.push(player);
  }

  // Everyone gone is nobody to award it to — that match is reaped elsewhere, not
  // decided here.
  if (absent.length === 0 || absent.length === humans.length) {
    return { forfeited: false as const };
  }

  for (const player of absent) {
    await ctx.db.patch(player._id, { forfeited: true });
  }

  const survivor = players.find((player) => !absent.includes(player));

  await ctx.db.patch(matchId, {
    status: "complete",
    phase: "match_end",
    phaseEndsAt: undefined,
    winnerId: survivor?.userId,
    completedAt: Date.now(),
  });

  await ctx.scheduler.runAfter(0, internal.progression.finalizeMatch, { matchId });

  return { forfeited: true as const };
}

/**
 * The sweep as its own endpoint.
 *
 * `heartbeat` runs it now, so current clients never call this. It stays exported and
 * unchanged because browsers on the previous deploy still do, and it is idempotent —
 * running it twice on the same match is a no-op the second time.
 */
export const claimForfeit = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => await sweepForfeits(ctx, args.matchId),
});
