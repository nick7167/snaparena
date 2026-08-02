import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./users";
import { finishMatch } from "./phases";
import { PLACEMENT_MATCHES, STARTING_ELO } from "../src/engine/config";
import {
  DEV_RANK_BOT_PERSONAS,
  devRankBotsEnabled,
  isDevRankBotPersona,
} from "../src/engine/dev-rank-bots";

/**
 * DEV ONLY — sixteen rated bot opponents, one per rank. DELETE BEFORE PUBLISHING.
 *
 * Everything dev-only lives in this one file so the teardown is a deletion rather than
 * an archaeology exercise. What it cannot contain is listed at the bottom, next to the
 * removal checklist.
 *
 * Unlike `convex/bots.ts`, these bots play REAL ranked matches: they sit in the `queue`
 * table, so `ranked.tryMatchmake` pairs them through its ordinary path and inserts
 * `mode: "ranked"` — which means `progression.applyRanked` moves both players' Elo,
 * burns placements, and awards XP and badges exactly as a human opponent would. That is
 * the entire point: the placement gate, promotions and a populated leaderboard cannot be
 * tested against a `mode: "practice"` opponent that by design cannot move rating.
 *
 * The safety property that replaces `bots.ts`'s "always practice" is the flag below plus
 * `purge`: nothing here does anything unless DEV_RANK_BOTS is set on the deployment.
 */

/** Lets the client show dev-only controls without a second flag to keep in sync. */
export const enabled = query({
  args: {},
  handler: async () => {
    return { enabled: devRankBotsEnabled() };
  },
});

function assertAdmin(secret: string): void {
  const expected = process.env.ADMIN_IMPORT_SECRET;
  if (!expected) throw new Error("ADMIN_IMPORT_SECRET is not configured on the deployment");
  if (secret !== expected) throw new Error("Bad admin secret");
}

async function userByHandle(ctx: MutationCtx, handle: string): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique();
}

/** True if this user is one of ours — never one of the twelve shipping practice bots. */
function isDevRankBot(user: Doc<"users"> | null): boolean {
  return user?.isBot === true && isDevRankBotPersona(user.botPersonaId);
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/**
 * Creates or updates the sixteen rank bots. Idempotent, and doubles as a rating reset —
 * re-running puts every bot back on its anchor.
 */
export const seed = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(args.secret);

    let created = 0;
    let updated = 0;

    for (const persona of DEV_RANK_BOT_PERSONAS) {
      const existing = await userByHandle(ctx, persona.handle);

      const fields = {
        handle: persona.handle,
        displayName: persona.displayName,
        elo: persona.elo,
        bio: persona.bio,
        isBot: true,
        botPersonaId: persona.id,
        // Zero so they clear the leaderboard's placement filter and appear immediately —
        // a rank bot that has to play five matches before it shows a rank is useless.
        placementsRemaining: 0,
        onboardedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, fields);
        updated++;
      } else {
        await ctx.db.insert("users", {
          ...fields,
          clerkId: `bot:${persona.id}`,
          gamesPlayed: 0,
          createdAt: Date.now(),
          xp: 0,
          level: 1,
        });
        created++;
      }
    }

    return { created, updated, total: DEV_RANK_BOT_PERSONAS.length };
  },
});

/**
 * Puts every bot back on its anchor rating.
 *
 * These bots drift — `applyRanked` moves them exactly as it moves a player — so farming
 * one repeatedly drags it out of its band and the board stops showing one bot per rank.
 * Run this whenever that happens.
 */
export const resetRoster = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(args.secret);

    let reset = 0;

    for (const persona of DEV_RANK_BOT_PERSONAS) {
      const bot = await userByHandle(ctx, persona.handle);
      if (!bot) continue;

      await ctx.db.patch(bot._id, {
        elo: persona.elo,
        gamesPlayed: 0,
        rankedWins: 0,
        placementsRemaining: 0,
      });

      // The queue row carries its own Elo snapshot, used for band matching. Left stale
      // it would keep matching the bot at a rating it no longer holds.
      const queued = await ctx.db
        .query("queue")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .unique();
      if (queued) await ctx.db.patch(queued._id, { elo: persona.elo });

      reset++;
    }

    return { reset };
  },
});

// ---------------------------------------------------------------------------
// Queue presence
// ---------------------------------------------------------------------------

/**
 * How long a match containing a rank bot may sit unfinished before it is abandoned.
 *
 * Comfortably longer than a real duel: 18 rounds at ~45s of phases each is about
 * thirteen minutes. This only ever catches a match whose human walked away — without it
 * that bot is parked in a dead match forever and never returns to the queue.
 */
const STALE_BOT_MATCH_MS = 30 * 60_000;

/** Matches scanned per status per run. Bounded so the cron stays a cheap transaction. */
const REAP_SCAN = 50;

async function matchHasDevRankBot(ctx: MutationCtx, match: Doc<"matches">): Promise<boolean> {
  for (const playerId of match.playerIds) {
    if (isDevRankBot(await ctx.db.get(playerId))) return true;
  }
  return false;
}

async function reapStaleBotMatches(ctx: MutationCtx): Promise<number> {
  const cutoff = Date.now() - STALE_BOT_MATCH_MS;
  let reaped = 0;

  for (const status of ["veto", "active"] as const) {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_status", (q) => q.eq("status", status))
      .take(REAP_SCAN);

    for (const match of matches) {
      if (match.createdAt > cutoff) continue;
      if (!(await matchHasDevRankBot(ctx, match))) continue;

      // Abandoned rather than finished: `finalizeMatch` never runs on an abandoned
      // match, so walking out of a losing duel against a bot costs no rating. That is
      // the right call for a dev fixture — awarding the bot a win on a match nobody
      // watched would corrupt the ladder being tested.
      await ctx.db.patch(match._id, {
        status: "abandoned",
        phase: "match_end",
        phaseEndsAt: undefined,
      });
      reaped++;
    }
  }

  return reaped;
}

/** True if this user is currently in a match, so a bot is never pulled into two at once. */
async function inLiveMatch(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  const recent = await ctx.db
    .query("matchPlayers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(5);

  for (const entry of recent) {
    const match = await ctx.db.get(entry.matchId);
    if (match && (match.status === "veto" || match.status === "active")) return true;
  }
  return false;
}

/**
 * Keeps the sixteen bots sitting in the ranked queue.
 *
 * Ranked has no server-side matchmaker — `tryMatchmake` only runs while a client is
 * polling it — so the queue has to be pre-populated for a lone developer to ever match.
 * A bot's queue row is consumed when it is matched, hence a refill on a timer rather
 * than a one-off seed.
 *
 * Gated inside the handler rather than at the cron registration so turning the flag off
 * is enough to stop it; no redeploy needed.
 */
export const refillQueue = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!devRankBotsEnabled()) return { skipped: true as const };

    const reaped = await reapStaleBotMatches(ctx);

    let added = 0;

    for (const persona of DEV_RANK_BOT_PERSONAS) {
      const bot = await userByHandle(ctx, persona.handle);
      if (!bot) continue;

      const queued = await ctx.db
        .query("queue")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .unique();

      if (queued) {
        // Re-read the bot's live rating rather than trusting the snapshot: these ratings
        // drift, and band matching reads the queue row, not the user.
        if (queued.elo !== bot.elo) await ctx.db.patch(queued._id, { elo: bot.elo });
        continue;
      }

      if (await inLiveMatch(ctx, bot._id)) continue;

      await ctx.db.insert("queue", {
        userId: bot._id,
        elo: bot.elo,
        enqueuedAt: Date.now(),
      });
      added++;
    }

    return { skipped: false as const, added, reaped };
  },
});

/**
 * Chooses an opponent when the dev roster is live.
 *
 * Two departures from `tryMatchmake`'s ordinary longest-waiting rule, both deliberate:
 *
 * A queued human always wins, ranked by longest wait — production semantics, untouched,
 * so two real players in the queue still find each other rather than each being handed a
 * bot. Only when there is no human does the bot rule apply, and there it picks the
 * NEAREST rating rather than the longest wait. Longest-waiting would hand back whichever
 * bot happened to hold the oldest queue row, which is the same opponent every time;
 * nearest-Elo means you fight your own rank, and climbing walks you up the roster one
 * rank at a time — which is the thing being tested.
 */
export async function pickDevOpponent(
  ctx: MutationCtx,
  user: Doc<"users">,
  candidates: Doc<"queue">[],
): Promise<Doc<"queue"> | undefined> {
  const humans: Doc<"queue">[] = [];
  const bots: { entry: Doc<"queue">; elo: number }[] = [];

  for (const entry of candidates) {
    const candidate = await ctx.db.get(entry.userId);
    if (!candidate) continue;
    if (candidate.isBot) bots.push({ entry, elo: candidate.elo });
    else humans.push(entry);
  }

  if (humans.length > 0) {
    return humans.sort((a, b) => a.enqueuedAt - b.enqueuedAt)[0];
  }

  return bots.sort(
    (a, b) => Math.abs(a.elo - user.elo) - Math.abs(b.elo - user.elo),
  )[0]?.entry;
}

// ---------------------------------------------------------------------------
// Instant resolve
// ---------------------------------------------------------------------------

/**
 * Ends the caller's current match immediately with a chosen result.
 *
 * A duel runs nine to twelve songs at thirty seconds each, so clearing five placement
 * matches is roughly forty minutes of play — long enough that the placement gate, the
 * promotion animation and the leaderboard transition would go untested in practice.
 *
 * Routed through the real `finishMatch`, which schedules `progression.finalizeMatch`, so
 * Elo, placements, per-category ratings, XP, level-ups, badges and the results screen all
 * run through the genuine path. The only thing skipped is the songs.
 */
export const resolveNow = mutation({
  args: {
    matchId: v.id("matches"),
    outcome: v.union(v.literal("win"), v.literal("loss"), v.literal("random")),
  },
  handler: async (ctx, args) => {
    if (!devRankBotsEnabled()) {
      throw new Error("DEV_RANK_BOTS is not enabled on this deployment");
    }

    const user = await requireUser(ctx);
    const match = await ctx.db.get(args.matchId);

    if (!match) throw new Error("No such match");
    // Derived from the caller's identity, never taken as an argument — otherwise this
    // would be a mutation for ending someone else's ranked match.
    if (!match.playerIds.some((id) => id === user._id)) throw new Error("Not your match");
    if (match.status === "complete" || match.status === "abandoned") {
      return { resolved: false as const };
    }

    const opponentId = match.playerIds.find((id) => id !== user._id);
    const iWin = args.outcome === "random" ? Math.random() < 0.5 : args.outcome === "win";
    const winnerId = iWin ? user._id : opponentId;
    const loserId = iWin ? opponentId : user._id;

    // Zeroed so the results screen reads coherently. `applyRanked` decides the rating
    // from `match.winnerId`, so this is presentation only.
    if (loserId) {
      const loser = await ctx.db
        .query("matchPlayers")
        .withIndex("by_match_user", (q) =>
          q.eq("matchId", args.matchId).eq("userId", loserId),
        )
        .unique();
      if (loser) await ctx.db.patch(loser._id, { hp: 0 });
    }

    await finishMatch(ctx, match, winnerId);

    return { resolved: true as const, won: iWin };
  },
});

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

/** Matches cleaned per call. Convex mutations are transactions with read/write limits. */
const PURGE_MATCH_BATCH = 25;

/**
 * Removes the roster and everything it touched. Re-runnable — call until `done`.
 *
 * Deletes the matches themselves, not just the bot accounts. `admin.purgeTestUser`
 * deliberately leaves matches behind because an orphaned daily match is inert, but a
 * duel is not: `matches.summary` and `matches.card` join back to both players, so a
 * deleted opponent would surface as a null in your own match history.
 *
 * `resetHandle` scrubs the account that played them back to a fresh signup, so no Elo,
 * level or badge earned against a bot survives into launch.
 */
export const purge = mutation({
  args: { secret: v.string(), resetHandle: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertAdmin(args.secret);

    const bots: Doc<"users">[] = [];
    for (const persona of DEV_RANK_BOT_PERSONAS) {
      const bot = await userByHandle(ctx, persona.handle);
      if (bot) bots.push(bot);
    }

    // Queue rows first: a bot removed from the queue cannot be pulled into a new match
    // while the rest of the purge is still running.
    let queueRemoved = 0;
    for (const bot of bots) {
      const queued = await ctx.db
        .query("queue")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .unique();
      if (queued) {
        await ctx.db.delete(queued._id);
        queueRemoved++;
      }
    }

    const matchIds = new Map<string, Id<"matches">>();
    for (const bot of bots) {
      if (matchIds.size >= PURGE_MATCH_BATCH) break;
      const rows = await ctx.db
        .query("matchPlayers")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .take(PURGE_MATCH_BATCH);
      for (const row of rows) {
        matchIds.set(String(row.matchId), row.matchId);
        if (matchIds.size >= PURGE_MATCH_BATCH) break;
      }
    }

    for (const matchId of matchIds.values()) {
      const guesses = await ctx.db
        .query("guesses")
        .withIndex("by_match_round", (q) => q.eq("matchId", matchId))
        .collect();
      for (const guess of guesses) await ctx.db.delete(guess._id);

      const players = await ctx.db
        .query("matchPlayers")
        .withIndex("by_match", (q) => q.eq("matchId", matchId))
        .collect();
      for (const player of players) await ctx.db.delete(player._id);

      const match = await ctx.db.get(matchId);
      if (match) await ctx.db.delete(matchId);
    }

    // Another pass is needed if any bot still holds a match row.
    for (const bot of bots) {
      const remaining = await ctx.db
        .query("matchPlayers")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .take(1);
      if (remaining.length > 0) {
        return {
          done: false as const,
          matchesRemoved: matchIds.size,
          queueRemoved,
          botsRemoved: 0,
          accountReset: false as const,
        };
      }
    }

    for (const bot of bots) {
      const ratings = await ctx.db
        .query("categoryRatings")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .collect();
      for (const rating of ratings) await ctx.db.delete(rating._id);

      const badges = await ctx.db
        .query("userBadges")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .collect();
      for (const badge of badges) await ctx.db.delete(badge._id);

      await ctx.db.delete(bot._id);
    }

    const accountReset = args.resetHandle
      ? await resetAccount(ctx, args.resetHandle.toLowerCase())
      : false;

    return {
      done: true as const,
      matchesRemoved: matchIds.size,
      queueRemoved,
      botsRemoved: bots.length,
      accountReset,
    };
  },
});

/** Returns a real account to fresh-signup state. Refuses to touch a bot or a guest. */
async function resetAccount(ctx: MutationCtx, handle: string): Promise<boolean> {
  const user = await userByHandle(ctx, handle);
  if (!user) return false;
  if (user.isBot || user.isGuest) return false;

  await ctx.db.patch(user._id, {
    elo: STARTING_ELO,
    gamesPlayed: 0,
    placementsRemaining: PLACEMENT_MATCHES,
    rankedWins: 0,
    xp: 0,
    level: 1,
    snapGuesses: 0,
  });

  const badges = await ctx.db
    .query("userBadges")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  for (const badge of badges) await ctx.db.delete(badge._id);

  const ratings = await ctx.db
    .query("categoryRatings")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  for (const rating of ratings) await ctx.db.delete(rating._id);

  return true;
}

/**
 * REMOVAL CHECKLIST — what this file cannot delete for you.
 *
 *   npm run dev-bots purge <your-handle>   # repeat until it reports done
 *   npx convex env remove DEV_RANK_BOTS
 *   rm convex/devbots.ts
 *   rm src/engine/dev-rank-bots.ts src/engine/dev-rank-bots.test.ts
 *   rm scripts/dev-rank-bots.ts            # and its "dev-bots" package.json script
 *   rm e2e/dev-rank-bots.spec.ts
 *
 * Then revert the six call sites, each marked with a "DEV ONLY" comment:
 *   - convex/crons.ts          the refillQueue interval
 *   - convex/ranked.ts         the pickDevOpponent branch in tryMatchmake
 *   - convex/users.ts          the bot visibility branch in leaderboard
 *   - src/engine/bots.ts       the personaById fallback
 *   - src/app/ranked/page.tsx  DevResolveBar
 *   - playwright.config.ts     dev-rank-bots in the authed project's testMatch
 *
 * KEEP the `claimForfeit` bot fix in convex/ranked.ts. That one is a genuine bug — bots
 * have no client and can never heartbeat, so the reconnect check would forfeit them
 * twenty seconds into any rated match — and it is not dev-only.
 */
