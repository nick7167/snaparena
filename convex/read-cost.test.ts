// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * The reads that scale with players.
 *
 * These cover three optimisations that exist purely to cut database I/O, and the risk
 * with all three is the same: an optimisation that quietly returns something different
 * from what it replaced. So the important tests here are EQUIVALENCE tests — a row
 * carrying the denormalised summary and a row that predates it must produce byte-identical
 * output, because both will exist in the table at once until the backfill has run.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { STARTING_ELO } from "../src/engine/config";

const modules = import.meta.glob("./**/*.ts");

function harness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof harness>;

async function seedUser(t: Harness, handle: string, extra: Record<string, unknown> = {}) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: `clerk:${handle}`,
      handle,
      displayName: handle,
      elo: STARTING_ELO,
      gamesPlayed: 0,
      placementsRemaining: 0,
      createdAt: Date.now(),
      ...extra,
    }),
  );
}

/**
 * One finished head-to-head.
 *
 * `denormalised` decides whether the winner's `matchPlayers` row carries the summary
 * fields — which is exactly the difference between a match finished today and one
 * finished before those fields existed.
 */
async function seedFinishedMatch(
  t: Harness,
  opts: {
    me: Id<"users">;
    opponent: Id<"users">;
    mode: "ranked" | "practice";
    winner: Id<"users"> | undefined;
    completedAt: number;
    denormalised: boolean;
  },
) {
  return await t.run(async (ctx) => {
    const matchId = await ctx.db.insert("matches", {
      mode: opts.mode,
      status: "complete",
      playerIds: [opts.me, opts.opponent],
      trackIds: [],
      bannedCategoryIds: [],
      currentRound: 0,
      createdAt: opts.completedAt,
      completedAt: opts.completedAt,
      winnerId: opts.winner,
    });

    for (const userId of [opts.me, opts.opponent]) {
      const summary = opts.denormalised
        ? {
            mode: opts.mode,
            completedAt: opts.completedAt,
            outcome:
              opts.winner === undefined
                ? ("draw" as const)
                : opts.winner === userId
                  ? ("win" as const)
                  : ("loss" as const),
            opponentId: userId === opts.me ? opts.opponent : opts.me,
          }
        : {};

      await ctx.db.insert("matchPlayers", {
        matchId,
        userId,
        totalPoints: 100,
        ratingBefore: STARTING_ELO,
        forfeited: false,
        ...summary,
      });
    }

    return matchId;
  });
}

describe("matches.history", () => {
  /**
   * The test this whole change rests on. Both row shapes are in the table at once until
   * the backfill finishes, and a player must not see their history change shape because
   * of when a match happened.
   */
  test("a denormalised row and a legacy row produce identical output", async () => {
    const t = harness();
    const me = await seedUser(t, "me");
    const foe = await seedUser(t, "foe");

    await seedFinishedMatch(t, {
      me,
      opponent: foe,
      mode: "ranked",
      winner: me,
      completedAt: 2_000,
      denormalised: true,
    });
    await seedFinishedMatch(t, {
      me,
      opponent: foe,
      mode: "ranked",
      winner: me,
      completedAt: 1_000,
      denormalised: false,
    });

    const history = await t.query(api.matches.history, { userId: me });
    expect(history).toHaveLength(2);

    const [fresh, legacy] = history;
    // Everything except the identifiers and the timestamp must agree.
    const shape = (row: (typeof history)[number]) => ({
      mode: row.mode,
      won: row.won,
      drawn: row.drawn,
      opponent: row.opponent?.handle ?? null,
    });
    expect(shape(fresh)).toEqual(shape(legacy));
    expect(shape(fresh)).toEqual({ mode: "ranked", won: true, drawn: false, opponent: "foe" });
  });

  test("reports a loss and a draw correctly from the row", async () => {
    const t = harness();
    const me = await seedUser(t, "me");
    const foe = await seedUser(t, "foe");

    await seedFinishedMatch(t, {
      me,
      opponent: foe,
      mode: "ranked",
      winner: foe,
      completedAt: 2_000,
      denormalised: true,
    });
    await seedFinishedMatch(t, {
      me,
      opponent: foe,
      mode: "ranked",
      winner: undefined,
      completedAt: 1_000,
      denormalised: true,
    });

    const history = await t.query(api.matches.history, { userId: me });
    expect(history.map((row) => [row.won, row.drawn])).toEqual([
      [false, false],
      [false, true],
    ]);
  });

  test("still excludes the daily", async () => {
    const t = harness();
    const me = await seedUser(t, "me");

    await t.run(async (ctx) => {
      const matchId = await ctx.db.insert("matches", {
        mode: "daily",
        status: "complete",
        playerIds: [me],
        trackIds: [],
        bannedCategoryIds: [],
        currentRound: 0,
        createdAt: 1_000,
        completedAt: 1_000,
      });
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId: me,
        totalPoints: 10,
        ratingBefore: STARTING_ELO,
        forfeited: false,
        mode: "daily",
        completedAt: 1_000,
        outcome: "win",
      });
    });

    expect(await t.query(api.matches.history, { userId: me })).toEqual([]);
  });

  /** An unfinished match has no summary and no `complete` status; it must not appear. */
  test("excludes a match that never finished", async () => {
    const t = harness();
    const me = await seedUser(t, "me");
    const foe = await seedUser(t, "foe");

    await t.run(async (ctx) => {
      const matchId = await ctx.db.insert("matches", {
        mode: "ranked",
        status: "abandoned",
        playerIds: [me, foe],
        trackIds: [],
        bannedCategoryIds: [],
        currentRound: 0,
        createdAt: 1_000,
      });
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId: me,
        totalPoints: 0,
        ratingBefore: STARTING_ELO,
        forfeited: false,
      });
    });

    expect(await t.query(api.matches.history, { userId: me })).toEqual([]);
  });
});

describe("bots.beaten", () => {
  test("agrees across denormalised and legacy rows", async () => {
    const t = harness();
    const me = await seedUser(t, "me");
    const botA = await seedUser(t, "bot_a", { isBot: true, botPersonaId: "persona-a" });
    const botB = await seedUser(t, "bot_b", { isBot: true, botPersonaId: "persona-b" });

    await seedFinishedMatch(t, {
      me,
      opponent: botA,
      mode: "practice",
      winner: me,
      completedAt: 2_000,
      denormalised: true,
    });
    await seedFinishedMatch(t, {
      me,
      opponent: botB,
      mode: "practice",
      winner: me,
      completedAt: 1_000,
      denormalised: false,
    });

    const result = await t
      .withIdentity({ subject: "clerk:me" })
      .query(api.bots.beaten, {});

    expect(new Set(result.beaten)).toEqual(new Set(["persona-a", "persona-b"]));
    expect(result.played).toBe(2);
  });

  test("a loss counts as played but not as beaten", async () => {
    const t = harness();
    const me = await seedUser(t, "me");
    const bot = await seedUser(t, "bot_a", { isBot: true, botPersonaId: "persona-a" });

    await seedFinishedMatch(t, {
      me,
      opponent: bot,
      mode: "practice",
      winner: bot,
      completedAt: 1_000,
      denormalised: true,
    });

    const result = await t
      .withIdentity({ subject: "clerk:me" })
      .query(api.bots.beaten, {});

    expect(result.beaten).toEqual([]);
    expect(result.played).toBe(1);
  });

  test("ignores ranked matches", async () => {
    const t = harness();
    const me = await seedUser(t, "me");
    const bot = await seedUser(t, "bot_a", { isBot: true, botPersonaId: "persona-a" });

    await seedFinishedMatch(t, {
      me,
      opponent: bot,
      mode: "ranked",
      winner: me,
      completedAt: 1_000,
      denormalised: true,
    });

    const result = await t
      .withIdentity({ subject: "clerk:me" })
      .query(api.bots.beaten, {});

    expect(result.beaten).toEqual([]);
    expect(result.played).toBe(0);
  });
});

describe("admin.backfillMatchSummary", () => {
  test("fills legacy rows and is idempotent", async () => {
    const t = harness();
    const me = await seedUser(t, "me");
    const foe = await seedUser(t, "foe");

    await seedFinishedMatch(t, {
      me,
      opponent: foe,
      mode: "ranked",
      winner: me,
      completedAt: 1_000,
      denormalised: false,
    });

    const missingBefore = await t.run(async (ctx) => {
      const rows = await ctx.db.query("matchPlayers").collect();
      return rows.filter((row) => row.mode === undefined).length;
    });
    expect(missingBefore).toBe(2);

    await t.mutation(internal.admin.backfillMatchSummary, {});

    const rows = await t.run(async (ctx) => ctx.db.query("matchPlayers").collect());
    expect(rows.every((row) => row.mode === "ranked")).toBe(true);
    expect(rows.find((row) => row.userId === me)?.outcome).toBe("win");
    expect(rows.find((row) => row.userId === foe)?.outcome).toBe("loss");
    expect(rows.find((row) => row.userId === me)?.opponentId).toBe(foe);

    // Second run changes nothing.
    const again = await t.mutation(internal.admin.backfillMatchSummary, {});
    expect(again.filled).toBe(0);
  });

  test("leaves a row alone when its match never completed", async () => {
    const t = harness();
    const me = await seedUser(t, "me");

    await t.run(async (ctx) => {
      const matchId = await ctx.db.insert("matches", {
        mode: "ranked",
        status: "active",
        playerIds: [me],
        trackIds: [],
        bannedCategoryIds: [],
        currentRound: 0,
        createdAt: 1_000,
      });
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId: me,
        totalPoints: 0,
        ratingBefore: STARTING_ELO,
        forfeited: false,
      });
    });

    const result = await t.mutation(internal.admin.backfillMatchSummary, {});
    expect(result.filled).toBe(0);
  });
});

describe("tracks.titleIndex", () => {
  async function seedTracks(t: Harness, titles: string[]) {
    await t.run(async (ctx) => {
      for (const [i, title] of titles.entries()) {
        await ctx.db.insert("tracks", {
          itunesTrackId: 1000 + i,
          title,
          titleNormalized: title.toLowerCase(),
          artist: "someone",
          artistNormalized: "someone",
          artworkUrl: "https://example.test/a.jpg",
          previewUrl: "https://example.test/a.m4a",
          previewCheckedAt: 0,
          categoryIds: [],
          difficulty: 1,
          popularity: titles.length - i,
          releaseYear: 2000,
          playable: true,
          solveSampleCount: 0,
        });
      }
    });
  }

  test("falls back to a live scan before anything is built", async () => {
    const t = harness();
    await seedTracks(t, ["Alpha", "Beta"]);

    const result = await t.query(api.tracks.titleIndex, {});
    expect(result.titles).toEqual(["Alpha", "Beta"]);
  });

  test("serves the stored row once built, and matches what the scan produced", async () => {
    const t = harness();
    await seedTracks(t, ["Alpha", "Beta"]);

    const scanned = await t.query(api.tracks.titleIndex, {});
    await t.mutation(internal.tracks.rebuildTitleIndex, {});
    const stored = await t.query(api.tracks.titleIndex, {});

    expect(stored).toEqual(scanned);

    // And it is genuinely coming from the row now, not the table.
    const rows = await t.run(async (ctx) => ctx.db.query("trackIndex").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].titles).toEqual(["Alpha", "Beta"]);
  });

  /** A rebuild that finds nothing new must not invalidate every subscriber's cache. */
  test("does not rewrite the row when the list is unchanged", async () => {
    const t = harness();
    await seedTracks(t, ["Alpha"]);

    await t.mutation(internal.tracks.rebuildTitleIndex, {});
    const first = await t.run(async (ctx) => ctx.db.query("trackIndex").first());

    const second = await t.mutation(internal.tracks.rebuildTitleIndex, {});
    expect(second.changed).toBe(false);

    const after = await t.run(async (ctx) => ctx.db.query("trackIndex").first());
    expect(after?.builtAt).toBe(first?.builtAt);
  });

  test("picks up a new track on rebuild", async () => {
    const t = harness();
    await seedTracks(t, ["Alpha"]);
    await t.mutation(internal.tracks.rebuildTitleIndex, {});

    await seedTracks(t, ["Zulu"]);
    const stale = await t.query(api.tracks.titleIndex, {});
    expect(stale.titles).toEqual(["Alpha"]);

    const rebuilt = await t.mutation(internal.tracks.rebuildTitleIndex, {});
    expect(rebuilt.changed).toBe(true);
    expect((await t.query(api.tracks.titleIndex, {})).titles).toContain("Zulu");
  });
});
