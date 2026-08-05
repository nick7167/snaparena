// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Characterization tests for the "N played today" figure on the landing page.
 *
 * `todayStats` used to count by reading up to a thousand `dailyRuns` rows, on a query
 * every visitor subscribes to. It now reads a counter document that `recordRun`
 * maintains. These pin the two things that could go wrong: the counter disagreeing with
 * the rows, and the day the counter first appears being undercounted.
 */

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { STARTING_ELO } from "../src/engine/config";
import { dayKey } from "../src/engine/streak";

const modules = import.meta.glob("./**/*.ts");

function harness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof harness>;

const TODAY = dayKey(Date.now());

/** Rows for today, as if left behind by players who finished before this deploy. */
async function seedRuns(t: Harness, count: number) {
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index++) {
      const userId = await ctx.db.insert("users", {
        clerkId: `clerk:prior-${index}`,
        handle: `prior-${index}`,
        displayName: `prior-${index}`,
        elo: STARTING_ELO,
        gamesPlayed: 0,
        placementsRemaining: 0,
        createdAt: Date.now(),
      });
      await ctx.db.insert("dailyRuns", {
        userId,
        date: TODAY,
        totalPoints: 0,
        perRoundPoints: [0],
        perRoundMs: [-1],
        completedAt: Date.now(),
      });
    }
  });
}

/** A playable daily match for one player, ready to be forfeited. */
async function seedDailyMatch(t: Harness, handle: string) {
  return await t.run(async (ctx) => {
    const now = Date.now();

    const userId = await ctx.db.insert("users", {
      clerkId: `clerk:${handle}`,
      handle,
      displayName: handle,
      elo: STARTING_ELO,
      gamesPlayed: 0,
      placementsRemaining: 0,
      createdAt: now,
    });

    const trackId = await ctx.db.insert("tracks", {
      itunesTrackId: 42,
      title: "Track",
      titleNormalized: "track",
      artist: "Artist",
      artistNormalized: "artist",
      artworkUrl: "https://example.test/art.jpg",
      previewUrl: "https://example.test/preview.m4a",
      previewCheckedAt: now,
      categoryIds: [],
      difficulty: 1,
      popularity: 1,
      releaseYear: 2000,
      playable: true,
      solveSampleCount: 0,
    });

    const matchId: Id<"matches"> = await ctx.db.insert("matches", {
      mode: "daily",
      status: "active",
      playerIds: [userId],
      trackIds: [trackId],
      bannedCategoryIds: [],
      currentRound: 0,
      phase: "guessing",
      createdAt: now,
    });

    await ctx.db.insert("matchPlayers", {
      matchId,
      userId,
      totalPoints: 0,
      ratingBefore: STARTING_ELO,
      forfeited: false,
      lastSeenAt: now,
    });

    return { matchId, userId };
  });
}

async function counterFor(t: Harness, date: string) {
  return await t.run(async (ctx) => {
    const row = await ctx.db
      .query("dailyCounts")
      .withIndex("by_date", (q) => q.eq("date", date))
      .unique();
    return row?.players ?? null;
  });
}

describe("daily.todayStats", () => {
  test("falls back to counting rows when no counter exists yet", async () => {
    const t = harness();
    await seedRuns(t, 7);

    // This is the pre-deploy state: rows, no counter. The figure must still be right.
    expect(await counterFor(t, TODAY)).toBeNull();
    expect(await t.query(api.daily.todayStats, {})).toMatchObject({
      date: TODAY,
      players: 7,
      atLeast: false,
    });
  });

  test("the first recorded run seeds the counter from the rows already there", async () => {
    const t = harness();
    await seedRuns(t, 7);

    const { matchId } = await seedDailyMatch(t, "newcomer");
    await t
      .withIdentity({ subject: "clerk:newcomer" })
      .mutation(api.daily.forfeit, { matchId });

    // 7 prior rows plus this one — NOT 1, which is what a naive counter would report.
    expect(await counterFor(t, TODAY)).toBe(8);
    expect(await t.query(api.daily.todayStats, {})).toMatchObject({
      date: TODAY,
      players: 8,
      atLeast: false,
    });
  });

  test("the counter agrees with the rows after further runs", async () => {
    const t = harness();

    for (const handle of ["a", "b", "c"]) {
      const { matchId } = await seedDailyMatch(t, handle);
      await t.withIdentity({ subject: `clerk:${handle}` }).mutation(api.daily.forfeit, { matchId });
    }

    const rowCount = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("dailyRuns")
        .withIndex("by_date_points", (q) => q.eq("date", TODAY))
        .collect();
      return rows.length;
    });

    expect(rowCount).toBe(3);
    expect(await counterFor(t, TODAY)).toBe(3);
    expect((await t.query(api.daily.todayStats, {})).players).toBe(3);
  });

  test("a repeat run for the same player does not double count", async () => {
    // `recordRun` is idempotent per player per day; the counter has to be too.
    const t = harness();
    const { matchId } = await seedDailyMatch(t, "repeater");

    await t.withIdentity({ subject: "clerk:repeater" }).mutation(api.daily.forfeit, { matchId });
    await t.withIdentity({ subject: "clerk:repeater" }).mutation(api.daily.forfeit, { matchId });

    expect(await counterFor(t, TODAY)).toBe(1);
    expect((await t.query(api.daily.todayStats, {})).players).toBe(1);
  });
});

describe("the tally survives deletions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("purging a test account releases its slot in the day's tally", async () => {
    // The e2e suite purges its throwaway account on every run, and the run it purges is
    // today's. A counter that is maintained rather than counted has to be told, or the
    // landing page over-reports by one per suite execution, permanently.
    vi.stubEnv("ADMIN_IMPORT_SECRET", "test-secret");

    const t = harness();

    const real = await seedDailyMatch(t, "realplayer");
    await t
      .withIdentity({ subject: "clerk:realplayer" })
      .mutation(api.daily.forfeit, { matchId: real.matchId });

    const throwaway = await seedDailyMatch(t, "e2e-temp");
    await t
      .withIdentity({ subject: "clerk:e2e-temp" })
      .mutation(api.daily.forfeit, { matchId: throwaway.matchId });

    expect(await counterFor(t, TODAY)).toBe(2);

    await t.mutation(api.admin.purgeTestUser, {
      secret: "test-secret",
      handle: "e2e-temp",
    });

    const rowsLeft = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("dailyRuns")
        .withIndex("by_date_points", (q) => q.eq("date", TODAY))
        .collect();
      return rows.length;
    });

    // The counter and the rows agree again — which is the whole contract.
    expect(rowsLeft).toBe(1);
    expect(await counterFor(t, TODAY)).toBe(1);
    expect((await t.query(api.daily.todayStats, {})).players).toBe(1);
  });

  test("the tally never goes negative", async () => {
    vi.stubEnv("ADMIN_IMPORT_SECRET", "test-secret");

    const t = harness();
    const throwaway = await seedDailyMatch(t, "e2e-only");
    await t
      .withIdentity({ subject: "clerk:e2e-only" })
      .mutation(api.daily.forfeit, { matchId: throwaway.matchId });

    await t.mutation(api.admin.purgeTestUser, { secret: "test-secret", handle: "e2e-only" });

    expect(await counterFor(t, TODAY)).toBe(0);
    expect((await t.query(api.daily.todayStats, {})).players).toBe(0);
  });
});
