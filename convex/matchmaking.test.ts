// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Characterization tests for ranked pairing.
 *
 * `tryMatchmake` is the only thing in the app that pairs two players, and until now the
 * only exercise it got was one Playwright spec that requires the dev roster enabled —
 * so the PRODUCTION branch (`others.sort(by enqueuedAt)[0]`) had no coverage at all.
 * These pin it before the pairing body is lifted out into a helper the server-side
 * sweeper shares.
 *
 * The dev-roster branch is driven by `settings.devFeaturesEnabled`, a database row, so
 * `enableDevFeatures` below writes it rather than stubbing an environment variable.
 */

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { STARTING_ELO } from "../src/engine/config";
import { eloBandFor } from "../src/engine/matchmaking";

const modules = import.meta.glob("./**/*.ts");

function harness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof harness>;

/**
 * Turns the operator surfaces on for a test.
 *
 * The switch used to be the `DEV_RANK_BOTS` environment variable, which `vi.stubEnv`
 * could drive from here. It is a database row now — `settings.devFeaturesEnabled` — so
 * enabling it means writing that row.
 */
async function enableDevFeatures(t: Harness) {
  await t.run(async (ctx) => {
    const existing = await ctx.db.query("settings").first();
    if (existing) {
      await ctx.db.patch(existing._id, { devFeaturesEnabled: true });
      return;
    }
    await ctx.db.insert("settings", { devFeaturesEnabled: true, updatedAt: Date.now() });
  });
}


afterEach(() => {
  vi.unstubAllEnvs();
});

type SeedEntry = {
  handle: string;
  elo?: number;
  /** How long they have already been waiting. Drives the widening band. */
  waitingMs?: number;
  isBot?: boolean;
  /** Queued by default; false seeds the user without a queue row. */
  queued?: boolean;
};

async function seedQueue(t: Harness, entries: SeedEntry[]) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userIds: Record<string, Id<"users">> = {};

    for (const entry of entries) {
      const userId = await ctx.db.insert("users", {
        clerkId: `clerk:${entry.handle}`,
        handle: entry.handle,
        displayName: entry.handle,
        elo: entry.elo ?? STARTING_ELO,
        gamesPlayed: 0,
        placementsRemaining: 0,
        createdAt: now,
        ...(entry.isBot ? { isBot: true } : {}),
      });
      userIds[entry.handle] = userId;

      if (entry.queued === false) continue;

      await ctx.db.insert("queue", {
        userId,
        elo: entry.elo ?? STARTING_ELO,
        enqueuedAt: now - (entry.waitingMs ?? 0),
        isBot: entry.isBot ? true : undefined,
      });
    }

    return userIds;
  });
}

async function queueUserIds(t: Harness) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("queue").collect();
    return rows.map((row) => row.userId);
  });
}

async function matchCount(t: Harness) {
  return await t.run(async (ctx) => (await ctx.db.query("matches").collect()).length);
}

function as(t: Harness, handle: string) {
  return t.withIdentity({ subject: `clerk:${handle}` });
}

/** Pending `ranked.sweep` jobs — how the self-perpetuating chain is observed. */
async function pendingSweeps(t: Harness) {
  return await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").take(100);
    return jobs.filter(
      (job) => job.name.includes("sweep") && job.state.kind === "pending",
    ).length;
  });
}

describe("tryMatchmake — production branch", () => {
  test("11. pairs two humans inside the band and consumes both queue rows", async () => {
    const t = harness();
    const ids = await seedQueue(t, [
      { handle: "alpha", elo: 1000 },
      { handle: "beta", elo: 1050 },
    ]);

    const result = await as(t, "alpha").mutation(api.ranked.tryMatchmake, {});
    expect(result.matched).toBe(true);

    expect(await queueUserIds(t)).toEqual([]);
    expect(await matchCount(t)).toBe(1);

    const { match, players } = await t.run(async (ctx) => {
      const match = (await ctx.db.query("matches").collect())[0];
      const players = await ctx.db
        .query("matchPlayers")
        .withIndex("by_match", (q) => q.eq("matchId", match._id))
        .collect();
      return { match, players };
    });

    expect(match.mode).toBe("ranked");
    expect(match.phase).toBe("vs_reveal");
    expect(new Set(match.playerIds)).toEqual(new Set([ids.alpha, ids.beta]));
    expect(players).toHaveLength(2);

    // The lower-rated player bans first — deliberate, not a coin flip.
    expect(match.banOrder?.[0]).toBe(ids.alpha);
  });

  test("12. prefers the longest-waiting opponent so nobody starves", async () => {
    const t = harness();
    const ids = await seedQueue(t, [
      { handle: "seeker", elo: 1000 },
      { handle: "recent", elo: 1000, waitingMs: 1_000 },
      { handle: "patient", elo: 1000, waitingMs: 30_000 },
      { handle: "middling", elo: 1000, waitingMs: 10_000 },
    ]);

    await as(t, "seeker").mutation(api.ranked.tryMatchmake, {});

    const match = await t.run(async (ctx) => (await ctx.db.query("matches").collect())[0]);
    expect(match.playerIds).toContain(ids.patient);
    expect(match.playerIds).not.toContain(ids.recent);
    expect(match.playerIds).not.toContain(ids.middling);

    // The two who were not chosen are still waiting.
    expect(new Set(await queueUserIds(t))).toEqual(new Set([ids.recent, ids.middling]));
  });

  test("13. will not reach outside the band, but the band widens with the wait", async () => {
    // 400 points apart: outside eloBandFor(0) = 100, inside the band once the seeker has
    // been waiting long enough for it to open up.
    const gap = 400;
    expect(eloBandFor(0)).toBeLessThan(gap);

    const tooSoon = harness();
    await seedQueue(tooSoon, [
      { handle: "seeker", elo: 1000 },
      { handle: "distant", elo: 1000 + gap },
    ]);

    expect(await as(tooSoon, "seeker").mutation(api.ranked.tryMatchmake, {})).toEqual({
      matched: false,
    });
    expect(await matchCount(tooSoon)).toBe(0);

    const waited = harness();
    const waitingMs = 30_000;
    expect(eloBandFor(waitingMs)).toBeGreaterThan(gap);

    await seedQueue(waited, [
      { handle: "seeker", elo: 1000, waitingMs },
      { handle: "distant", elo: 1000 + gap },
    ]);

    expect((await as(waited, "seeker").mutation(api.ranked.tryMatchmake, {})).matched).toBe(true);
    expect(await matchCount(waited)).toBe(1);
  });

  test("a caller who is not in the queue never matches", async () => {
    const t = harness();
    await seedQueue(t, [
      { handle: "browsing", queued: false },
      { handle: "waiting" },
    ]);

    expect(await as(t, "browsing").mutation(api.ranked.tryMatchmake, {})).toEqual({
      matched: false,
    });
    expect(await matchCount(t)).toBe(0);
  });

  test("an empty pool leaves the caller queued", async () => {
    const t = harness();
    const ids = await seedQueue(t, [{ handle: "alone" }]);

    expect(await as(t, "alone").mutation(api.ranked.tryMatchmake, {})).toEqual({
      matched: false,
    });
    expect(await queueUserIds(t)).toEqual([ids.alone]);
  });
});

describe("tryMatchmake — dev rank bots", () => {
  test("14. a queued human is preferred over a bot, and bots wait out the floor", async () => {
    const t = harness();
    await enableDevFeatures(t);
    const ids = await seedQueue(t, [
      // No wait at all, so the bot floor has definitely not elapsed.
      { handle: "seeker", elo: 1000 },
      { handle: "bot-a", elo: 1000, isBot: true },
      { handle: "human", elo: 1000, waitingMs: 2_000 },
    ]);

    await as(t, "seeker").mutation(api.ranked.tryMatchmake, {});

    const match = await t.run(async (ctx) => (await ctx.db.query("matches").collect())[0]);
    expect(match.playerIds).toContain(ids.human);
    expect(match.playerIds).not.toContain(ids["bot-a"]);
  });

  test("14b. with only bots available, none is offered until the floor has passed", async () => {
    const t = harness();
    await enableDevFeatures(t);
    await seedQueue(t, [
      { handle: "seeker", elo: 1000 },
      { handle: "bot-a", elo: 1000, isBot: true },
    ]);

    expect(await as(t, "seeker").mutation(api.ranked.tryMatchmake, {})).toEqual({
      matched: false,
    });
    expect(await matchCount(t)).toBe(0);
  });

  test("14c. with the flag off, a bot in the pool is just another opponent", async () => {
    // The production branch does not know about bots at all — `startBotMatch` is the
    // only sanctioned route to one, and it goes nowhere near the queue band search.
    const t = harness();
    const ids = await seedQueue(t, [
      { handle: "seeker", elo: 1000 },
      { handle: "bot-a", elo: 1000, isBot: true, waitingMs: 5_000 },
    ]);

    expect((await as(t, "seeker").mutation(api.ranked.tryMatchmake, {})).matched).toBe(true);

    const match = await t.run(async (ctx) => (await ctx.db.query("matches").collect())[0]);
    expect(match.playerIds).toContain(ids["bot-a"]);
  });
});

describe("ranked.sweep", () => {
  test("pairs everyone pairable in a single pass", async () => {
    const t = harness();
    await seedQueue(t, [
      { handle: "a", elo: 1000, waitingMs: 40_000 },
      { handle: "b", elo: 1000, waitingMs: 30_000 },
      { handle: "c", elo: 1000, waitingMs: 20_000 },
      { handle: "d", elo: 1000, waitingMs: 10_000 },
    ]);

    await t.mutation(internal.ranked.sweep, {});

    // Two matches from four players, and nobody left waiting.
    expect(await matchCount(t)).toBe(2);
    expect(await queueUserIds(t)).toEqual([]);
  });

  test("pairs oldest-first, so the longest wait is served first", async () => {
    const t = harness();
    const ids = await seedQueue(t, [
      { handle: "oldest", elo: 1000, waitingMs: 60_000 },
      { handle: "second", elo: 1000, waitingMs: 50_000 },
      { handle: "newest", elo: 1000, waitingMs: 1_000 },
    ]);

    await t.mutation(internal.ranked.sweep, {});

    expect(await matchCount(t)).toBe(1);
    const match = await t.run(async (ctx) => (await ctx.db.query("matches").collect())[0]);
    expect(new Set(match.playerIds)).toEqual(new Set([ids.oldest, ids.second]));
    // The newcomer keeps its place rather than displacing anyone.
    expect(await queueUserIds(t)).toEqual([ids.newest]);
  });

  test("re-arms itself while the pool can still produce a pairing", async () => {
    const t = harness();
    // Far enough apart that today's band cannot bridge them, so they stay queued.
    await seedQueue(t, [
      { handle: "low", elo: 400 },
      { handle: "high", elo: 2400 },
    ]);

    await t.mutation(internal.ranked.sweep, {});

    expect(await matchCount(t)).toBe(0);
    expect(await pendingSweeps(t)).toBe(1);
  });

  test("stops once the queue is drained", async () => {
    const t = harness();
    await seedQueue(t, [
      { handle: "a", elo: 1000 },
      { handle: "b", elo: 1000 },
    ]);

    await t.mutation(internal.ranked.sweep, {});

    expect(await matchCount(t)).toBe(1);
    expect(await pendingSweeps(t)).toBe(0);
  });

  test("stops when only bots remain, however many there are", async () => {
    // The guard that matters most. The dev roster keeps sixteen bots queued
    // permanently, so a sweeper that re-armed on "queue is not empty" would run every
    // two seconds forever on a deployment where nobody is playing at all.
    const t = harness();
    await seedQueue(t, [
      { handle: "bot-a", elo: 1000, isBot: true },
      { handle: "bot-b", elo: 1100, isBot: true },
      { handle: "bot-c", elo: 1200, isBot: true },
    ]);

    await t.mutation(internal.ranked.sweep, {});

    expect(await pendingSweeps(t)).toBe(0);
  });

  test("stops when a lone human is waiting with nobody to face", async () => {
    const t = harness();
    await seedQueue(t, [{ handle: "alone" }]);

    await t.mutation(internal.ranked.sweep, {});

    expect(await pendingSweeps(t)).toBe(0);
  });

  test("drops a queue row whose account has gone", async () => {
    const t = harness();
    const ids = await seedQueue(t, [
      { handle: "ghost", elo: 1000 },
      { handle: "real", elo: 1000 },
    ]);

    await t.run(async (ctx) => {
      await ctx.db.delete(ids.ghost);
    });

    await t.mutation(internal.ranked.sweep, {});

    // The orphan is cleared rather than tripping the pass on every future run.
    expect(await queueUserIds(t)).toEqual([ids.real]);
    expect(await matchCount(t)).toBe(0);
  });
});

describe("ranked.enqueue chain start", () => {
  test("starts a chain when joining makes the pool matchable", async () => {
    const t = harness();
    await seedQueue(t, [
      { handle: "waiting", elo: 1000 },
      { handle: "joiner", elo: 1000, queued: false },
    ]);

    expect(await pendingSweeps(t)).toBe(0);
    await as(t, "joiner").mutation(api.ranked.enqueue, {});
    expect(await pendingSweeps(t)).toBe(1);
  });

  test("does not start a second chain when one is already running", async () => {
    // Two humans already queued means a chain is live; a third joining must not add
    // another, or the two would keep each other alive indefinitely.
    const t = harness();
    await seedQueue(t, [
      { handle: "a", elo: 1000 },
      { handle: "b", elo: 1000 },
      { handle: "c", elo: 1000, queued: false },
    ]);

    await as(t, "c").mutation(api.ranked.enqueue, {});
    expect(await pendingSweeps(t)).toBe(0);
  });

  test("the first player into an empty queue starts nothing", async () => {
    const t = harness();
    await seedQueue(t, [{ handle: "first", queued: false }]);

    await as(t, "first").mutation(api.ranked.enqueue, {});

    expect(await pendingSweeps(t)).toBe(0);
  });
});

describe("ranked.sweep — bots never initiate", () => {
  test("a bot does not pair itself with a waiting human before the floor", async () => {
    // `pickDevOpponent` returns a waiting human without consulting DEV_BOT_MIN_WAIT_MS —
    // that floor gates picking a bot, not being one. A bot's queue row is also hours old,
    // so its band is maxed. If bots initiated, the human's search would end on the first
    // sweep instead of running its course.
    const t = harness();
    await enableDevFeatures(t);
    await seedQueue(t, [
      { handle: "bot-a", elo: 1000, isBot: true, waitingMs: 3_600_000 },
      { handle: "bot-b", elo: 1100, isBot: true, waitingMs: 3_600_000 },
      { handle: "searcher", elo: 1000, waitingMs: 500 },
    ]);

    await t.mutation(internal.ranked.sweep, {});

    expect(await matchCount(t)).toBe(0);
  });

  test("a bot is still offered once the human has waited out the floor", async () => {
    const t = harness();
    await enableDevFeatures(t);
    const ids = await seedQueue(t, [
      { handle: "bot-a", elo: 1000, isBot: true, waitingMs: 3_600_000 },
      { handle: "searcher", elo: 1000, waitingMs: 60_000 },
    ]);

    await t.mutation(internal.ranked.sweep, {});

    expect(await matchCount(t)).toBe(1);
    const match = await t.run(async (ctx) => (await ctx.db.query("matches").collect())[0]);
    expect(new Set(match.playerIds)).toEqual(new Set([ids.searcher, ids["bot-a"]]));
  });

  test("two humans still pair with bots sitting in the pool", async () => {
    const t = harness();
    await enableDevFeatures(t);
    const ids = await seedQueue(t, [
      { handle: "bot-a", elo: 1000, isBot: true, waitingMs: 3_600_000 },
      { handle: "one", elo: 1000, waitingMs: 5_000 },
      { handle: "two", elo: 1000, waitingMs: 4_000 },
    ]);

    await t.mutation(internal.ranked.sweep, {});

    const match = await t.run(async (ctx) => (await ctx.db.query("matches").collect())[0]);
    expect(new Set(match.playerIds)).toEqual(new Set([ids.one, ids.two]));
    expect(await queueUserIds(t)).toEqual([ids["bot-a"]]);
  });
});
