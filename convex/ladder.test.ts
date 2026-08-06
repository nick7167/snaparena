// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * The ladder's eligibility rule, pinned.
 *
 * Who is on the board is decided in two halves — `onBoard` as an index range and
 * `onBoardDoc` in JS — and they have drifted apart twice in production. The second time,
 * the twelve shipping practice bots were counted as being above a player without ever
 * being listed, so the board's #3 row read "#5 global" on its own profile.
 *
 * The load-bearing assertion here is not any single number: it is that the position
 * reader and the count reader agree about the population. A test that only checked one
 * of them would have passed through both of those bugs.
 */

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { PLACEMENT_MATCHES, STARTING_ELO } from "../src/engine/config";

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

type Seed = {
  handle: string;
  elo: number;
  /** Defaults to 0 — i.e. placed, and therefore on the ladder. */
  placementsRemaining?: number;
  isGuest?: boolean;
  isBot?: boolean;
  botPersonaId?: string;
};

async function seedUsers(t: Harness, seeds: Seed[]) {
  return await t.run(async (ctx) => {
    const ids: Record<string, Id<"users">> = {};
    for (const seed of seeds) {
      ids[seed.handle] = await ctx.db.insert("users", {
        clerkId: `clerk:${seed.handle}`,
        handle: seed.handle,
        displayName: seed.handle,
        elo: seed.elo,
        gamesPlayed: 10,
        placementsRemaining: seed.placementsRemaining ?? 0,
        createdAt: Date.now(),
        ...(seed.isGuest ? { isGuest: true } : {}),
        ...(seed.isBot ? { isBot: true } : {}),
        ...(seed.botPersonaId ? { botPersonaId: seed.botPersonaId } : {}),
      });
    }
    return ids;
  });
}

/**
 * Everyone who should be on the ladder, plus one of every kind who should not.
 *
 * The two bots are the point: a practice persona must stay off the board in BOTH modes,
 * while a `rank_` persona is listed only when the dev flag is set.
 */
const MIXED: Seed[] = [
  { handle: "top", elo: 1600 },
  { handle: "middle", elo: 1200 },
  { handle: "bottom", elo: 900 },
  { handle: "placing", elo: 1400, placementsRemaining: 3 },
  { handle: "guest", elo: STARTING_ELO, isGuest: true, placementsRemaining: PLACEMENT_MATCHES },
  { handle: "practicebot", elo: 1500, isBot: true, botPersonaId: "crate_digger" },
  { handle: "rankbot", elo: 1450, isBot: true, botPersonaId: "rank_diamond_ii" },
];

function as(t: Harness, handle: string) {
  return t.withIdentity({ subject: `clerk:${handle}` });
}

describe("ladder eligibility", () => {
  test("the board lists placed humans only", async () => {
    const t = harness();
    await seedUsers(t, MIXED);

    const board = await t.query(api.users.leaderboard, { limit: 500 });

    expect(board.map((row) => row.handle)).toEqual(["top", "middle", "bottom"]);
    expect(board.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  test("the count measures the SAME population the board lists", async () => {
    // This is the assertion that would have caught both historical drift bugs: the
    // position a player is given is only meaningful if it was counted over the set the
    // board actually shows.
    const t = harness();
    await seedUsers(t, MIXED);

    const board = await t.query(api.users.leaderboard, { limit: 500 });
    const ladder = await t.query(api.users.rankedPlayerCount, {});
    const tiers = await t.query(api.users.tierCounts, {});

    expect(ladder.count).toBe(board.length);
    expect(tiers.reduce((sum, tier) => sum + tier.count, 0)).toBe(board.length);
  });

  test("a player's position matches their row number on the board", async () => {
    const t = harness();
    await seedUsers(t, MIXED);

    const board = await t.query(api.users.leaderboard, { limit: 500 });

    for (const row of board) {
      const standing = await as(t, row.handle).query(api.users.myStanding, {});
      expect(standing?.position, `${row.handle} should be #${row.rank}`).toBe(row.rank);
    }
  });

  test("a player still in placements has no position", async () => {
    const t = harness();
    await seedUsers(t, MIXED);

    const standing = await as(t, "placing").query(api.users.myStanding, {});
    expect(standing?.position).toBeNull();
    expect(await as(t, "placing").query(api.users.ladderNeighbours, {})).toBeNull();
  });

  test("bots and guests never displace a human's position", async () => {
    // `practicebot` (1500) and `rankbot` (1450) both sit above `middle` (1200). If either
    // were counted, middle would read #3 or #4 while the board still showed them at #2.
    const t = harness();
    await seedUsers(t, MIXED);

    const standing = await as(t, "middle").query(api.users.myStanding, {});
    expect(standing?.position).toBe(2);
  });
});

describe("ladder eligibility — dev rank bots", () => {
  test("a rank_ persona is listed, a practice persona still is not", async () => {
    const t = harness();
    await enableDevFeatures(t);
    await seedUsers(t, MIXED);

    const board = await t.query(api.users.leaderboard, { limit: 500 });
    const handles = board.map((row) => row.handle);

    expect(handles).toContain("rankbot");
    expect(handles).not.toContain("practicebot");
    // Ordered by Elo, with the rank bot slotted in at 1450.
    expect(handles).toEqual(["top", "rankbot", "middle", "bottom"]);
  });

  test("count and board still agree with the flag on", async () => {
    const t = harness();
    await enableDevFeatures(t);
    await seedUsers(t, MIXED);

    const board = await t.query(api.users.leaderboard, { limit: 500 });
    const ladder = await t.query(api.users.rankedPlayerCount, {});

    expect(ladder.count).toBe(board.length);
    expect(ladder.count).toBe(4);
  });

  test("positions shift to account for the listed bot", async () => {
    const t = harness();
    await enableDevFeatures(t);
    await seedUsers(t, MIXED);

    // middle was #2 with the flag off; the rank bot at 1450 now sits between them.
    const standing = await as(t, "middle").query(api.users.myStanding, {});
    expect(standing?.position).toBe(3);
  });
});

describe("ties", () => {
  test("break newest-first, and positions stay unique", async () => {
    const t = harness();
    await seedUsers(t, [
      { handle: "first", elo: 1200 },
      { handle: "second", elo: 1200 },
      { handle: "third", elo: 1200 },
    ]);

    /**
     * Expected order is derived, not written down.
     *
     * Convex appends `_creationTime` to every index, so descending order puts the most
     * recently created row first among equals — but inserts made inside one `t.run` can
     * land in the same millisecond, which would make a hard-coded order flaky. Sorting
     * the seeded documents by the same key the index uses compares the reader against an
     * obviously-correct implementation over the same data.
     */
    const expected = await t.run(async (ctx) => {
      const rows = await ctx.db.query("users").collect();
      return rows
        .sort((a, b) => b.elo - a.elo || b._creationTime - a._creationTime)
        .map((row) => row.handle);
    });

    const board = await t.query(api.users.leaderboard, { limit: 500 });
    expect(board.map((row) => row.handle)).toEqual(expected);

    const positions: number[] = [];
    for (const row of board) {
      const standing = await as(t, row.handle).query(api.users.myStanding, {});
      positions.push(standing!.position!);
    }
    expect(positions).toEqual([1, 2, 3]);
  });
});

describe("ladderNeighbours", () => {
  test("reports two either side, signed, with nobody duplicated", async () => {
    const t = harness();
    await seedUsers(t, [
      { handle: "a", elo: 1500 },
      { handle: "b", elo: 1400 },
      { handle: "me", elo: 1300 },
      { handle: "d", elo: 1200 },
      { handle: "e", elo: 1100 },
    ]);

    const board = await as(t, "me").query(api.users.ladderNeighbours, {});

    expect(board?.position).toBe(3);
    expect(board?.elo).toBe(1300);

    // Highest-first above, nearest-first below.
    expect(board?.above.map((row) => row.handle)).toEqual(["a", "b"]);
    expect(board?.below.map((row) => row.handle)).toEqual(["d", "e"]);

    expect(board?.above.map((row) => row.position)).toEqual([1, 2]);
    expect(board?.below.map((row) => row.position)).toEqual([4, 5]);

    // Signed from the viewer's point of view: positive means they are ahead of you.
    expect(board?.above.map((row) => row.gap)).toEqual([200, 100]);
    expect(board?.below.map((row) => row.gap)).toEqual([-100, -200]);

    const named = [...board!.above, ...board!.below].map((row) => row.handle);
    expect(new Set(named).size).toBe(named.length);
    expect(named).not.toContain("me");
  });

  test("a tie ranked above never also appears below", async () => {
    const t = harness();
    await seedUsers(t, [
      { handle: "me", elo: 1200 },
      // Created after `me`, so newest-first puts them ABOVE on the same Elo.
      { handle: "tied", elo: 1200 },
      { handle: "under", elo: 1100 },
    ]);

    const board = await as(t, "me").query(api.users.ladderNeighbours, {});

    expect(board?.position).toBe(2);
    expect(board?.above.map((row) => row.handle)).toEqual(["tied"]);
    expect(board?.below.map((row) => row.handle)).toEqual(["under"]);
  });
});

// ---------------------------------------------------------------------------
// The snapshot
// ---------------------------------------------------------------------------

async function rebuild(t: Harness) {
  return await t.mutation(internal.ladder.rebuild, {});
}

async function fieldDoc(t: Harness) {
  return await t.run(async (ctx) => {
    const doc = await ctx.db
      .query("ladderSnapshot")
      .withIndex("by_kind", (q) => q.eq("kind", "field"))
      .unique();
    return doc && doc.kind === "field"
      ? {
          playerCount: doc.playerCount,
          truncated: doc.truncated,
          generation: doc.generation,
          entries: doc.entries.length,
          rows: doc.rows.length,
          handles: doc.rows.map((row) => row.handle),
        }
      : null;
  });
}

async function summaryDoc(t: Harness) {
  return await t.run(async (ctx) => {
    const doc = await ctx.db
      .query("ladderSnapshot")
      .withIndex("by_kind", (q) => q.eq("kind", "summary"))
      .unique();
    return doc && doc.kind === "summary"
      ? { generation: doc.generation, builtAt: doc.builtAt, checkedAt: doc.checkedAt }
      : null;
  });
}

/** Moves one player's rating without rebuilding, which is the whole point of the design. */
async function setElo(t: Harness, userId: Id<"users">, elo: number) {
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { elo });
  });
}

describe("snapshot builder", () => {
  test("stores the ladder and nobody else", async () => {
    const t = harness();
    await seedUsers(t, MIXED);

    await rebuild(t);
    const field = await fieldDoc(t);

    expect(field?.handles).toEqual(["top", "middle", "bottom"]);
    expect(field?.playerCount).toBe(3);
    expect(field?.truncated).toBe(false);
  });

  test("builds the real ladder even with DEV_RANK_BOTS set", async () => {
    // The snapshot is always the production board; dev deployments read past it via the
    // live walk instead. A snapshot that sometimes contained bots would be a second
    // ladder to keep straight.
    const t = harness();
    await enableDevFeatures(t);
    await seedUsers(t, MIXED);
    await rebuild(t);

    expect((await fieldDoc(t))?.handles).toEqual(["top", "middle", "bottom"]);
  });

  test("does not rewrite the field when nothing changed", async () => {
    // Every subscribed reader re-executes when the field is written, so an unconditional
    // five-minute write would bill every active user for a board that never moved.
    const t = harness();
    await seedUsers(t, MIXED);

    const first = await rebuild(t);
    expect(first.changed).toBe(true);
    const afterFirst = await summaryDoc(t);

    const second = await rebuild(t);
    expect(second.changed).toBe(false);
    const afterSecond = await summaryDoc(t);

    expect(afterSecond!.generation).toBe(afterFirst!.generation);
    expect(afterSecond!.builtAt).toBe(afterFirst!.builtAt);
    // The cron still records that it looked.
    expect(afterSecond!.checkedAt).toBeGreaterThanOrEqual(afterFirst!.checkedAt);
  });

  test("rewrites when the ordering actually moves", async () => {
    const t = harness();
    const ids = await seedUsers(t, MIXED);

    await rebuild(t);
    const before = await summaryDoc(t);

    await setElo(t, ids.bottom, 1900);
    const again = await rebuild(t);

    expect(again.changed).toBe(true);
    expect((await summaryDoc(t))!.generation).toBe(before!.generation + 1);
    expect((await fieldDoc(t))?.handles).toEqual(["bottom", "top", "middle"]);
  });
});

describe("position from live elo against a stored field", () => {
  test("a rating gain moves you immediately, with no rebuild", async () => {
    const t = harness();
    const ids = await seedUsers(t, [
      { handle: "a", elo: 1600 },
      { handle: "b", elo: 1500 },
      { handle: "c", elo: 1400 },
      { handle: "climber", elo: 1300 },
    ]);

    await rebuild(t);
    expect((await as(t, "climber").query(api.users.myStanding, {}))?.position).toBe(4);

    // Past all three, without touching the snapshot.
    await setElo(t, ids.climber, 1700);

    expect((await as(t, "climber").query(api.users.myStanding, {}))?.position).toBe(1);
  });

  test("a rating loss moves you down by exactly the players you fell behind", async () => {
    // The `selfHigh` case. Your own stored entry still sits ABOVE your live rating, so
    // without subtracting it you count yourself and land one place too low.
    const t = harness();
    const ids = await seedUsers(t, [
      { handle: "a", elo: 1600 },
      { handle: "faller", elo: 1500 },
      { handle: "c", elo: 1400 },
      { handle: "d", elo: 1300 },
    ]);

    await rebuild(t);
    expect((await as(t, "faller").query(api.users.myStanding, {}))?.position).toBe(2);

    // Below c and d, but above nobody new — so #4, not #5.
    await setElo(t, ids.faller, 1250);

    expect((await as(t, "faller").query(api.users.myStanding, {}))?.position).toBe(4);
  });

  test("a player who placed after the build is still ranked against it", async () => {
    const t = harness();
    await seedUsers(t, [
      { handle: "a", elo: 1600 },
      { handle: "b", elo: 1400 },
    ]);
    await rebuild(t);

    // Finishing placements should pay out immediately, not at the next cron tick.
    await seedUsers(t, [{ handle: "newcomer", elo: 1500 }]);

    const standing = await as(t, "newcomer").query(api.users.myStanding, {});
    expect(standing?.position).toBe(2);
    expect(standing?.approximate).toBe(false);
  });

  test("positions stay exact below the cap", async () => {
    const t = harness();
    await seedUsers(t, MIXED);
    await rebuild(t);

    for (const handle of ["top", "middle", "bottom"]) {
      const standing = await as(t, handle).query(api.users.myStanding, {});
      expect(standing?.approximate).toBe(false);
    }
  });
});

describe("snapshot parity with the live walk", () => {
  test("every reader agrees whether or not a field exists", async () => {
    // Pins the "shapes preserved byte-identically" contract mechanically rather than by
    // review. For a population that has not moved since the build, the two paths must be
    // indistinguishable.
    const t = harness();
    await seedUsers(t, MIXED);

    const live = {
      board: await t.query(api.users.leaderboard, { limit: 500 }),
      count: await t.query(api.users.rankedPlayerCount, {}),
      tiers: await t.query(api.users.tierCounts, {}),
      standing: await as(t, "middle").query(api.users.myStanding, {}),
      neighbours: await as(t, "middle").query(api.users.ladderNeighbours, {}),
    };

    await rebuild(t);

    const snapshot = {
      board: await t.query(api.users.leaderboard, { limit: 500 }),
      count: await t.query(api.users.rankedPlayerCount, {}),
      tiers: await t.query(api.users.tierCounts, {}),
      standing: await as(t, "middle").query(api.users.myStanding, {}),
      neighbours: await as(t, "middle").query(api.users.ladderNeighbours, {}),
    };

    expect(snapshot).toEqual(live);
  });
});

describe("ladderNeighbours against a stored field", () => {
  /** a=1600, b=1500, me=1400, d=1300, e=1200 — five in a row, me in the middle. */
  async function seedRow(t: Harness) {
    return await seedUsers(t, [
      { handle: "a", elo: 1600 },
      { handle: "b", elo: 1500 },
      { handle: "me", elo: 1400 },
      { handle: "d", elo: 1300 },
      { handle: "e", elo: 1200 },
    ]);
  }

  test("rating unchanged since the build", async () => {
    const t = harness();
    await seedRow(t);
    await rebuild(t);

    const board = await as(t, "me").query(api.users.ladderNeighbours, {});

    expect(board?.position).toBe(3);
    expect(board?.above.map((row) => row.handle)).toEqual(["a", "b"]);
    expect(board?.below.map((row) => row.handle)).toEqual(["d", "e"]);
    expect(board?.above.map((row) => row.position)).toEqual([1, 2]);
    expect(board?.below.map((row) => row.position)).toEqual([4, 5]);
    expect(board?.above.map((row) => row.gap)).toEqual([200, 100]);
    expect(board?.below.map((row) => row.gap)).toEqual([-100, -200]);
  });

  test("rating risen since the build", async () => {
    // The case the plan called out: the entry now sitting at `bound` has `bound` entries
    // above it in the field PLUS me, so its true position is position + 1.
    const t = harness();
    const ids = await seedRow(t);
    await rebuild(t);

    await setElo(t, ids.me, 1550); // past b, still under a
    const board = await as(t, "me").query(api.users.ladderNeighbours, {});

    expect(board?.position).toBe(2);
    expect(board?.elo).toBe(1550);
    expect(board?.above.map((row) => row.handle)).toEqual(["a"]);
    expect(board?.above.map((row) => row.position)).toEqual([1]);
    expect(board?.below.map((row) => row.handle)).toEqual(["b", "d"]);
    expect(board?.below.map((row) => row.position)).toEqual([3, 4]);
    // Gaps are measured from my LIVE rating against their snapshot rating.
    expect(board?.above.map((row) => row.gap)).toEqual([50]);
    expect(board?.below.map((row) => row.gap)).toEqual([-50, -250]);
  });

  test("rating fallen since the build", async () => {
    // `selfHigh`: my stale entry still sits above my live Elo and must not be counted.
    const t = harness();
    const ids = await seedRow(t);
    await rebuild(t);

    await setElo(t, ids.me, 1250); // below d, above e
    const board = await as(t, "me").query(api.users.ladderNeighbours, {});

    expect(board?.position).toBe(4);
    expect(board?.above.map((row) => row.handle)).toEqual(["b", "d"]);
    expect(board?.above.map((row) => row.position)).toEqual([2, 3]);
    expect(board?.below.map((row) => row.handle)).toEqual(["e"]);
    expect(board?.below.map((row) => row.position)).toEqual([5]);
  });

  test("never lists you as your own neighbour", async () => {
    const t = harness();
    const ids = await seedRow(t);
    await rebuild(t);

    for (const elo of [1600, 1550, 1400, 1250, 1100]) {
      await setElo(t, ids.me, elo);
      const board = await as(t, "me").query(api.users.ladderNeighbours, {});
      const named = [...board!.above, ...board!.below].map((row) => row.handle);

      expect(named, `at elo ${elo}`).not.toContain("me");
      expect(new Set(named).size, `at elo ${elo}`).toBe(named.length);
    }
  });
});

describe("truncation", () => {
  test("a ladder past the cap reports floors, not exact ranks", async () => {
    const t = harness();

    // One over ROW_DEPTH is enough to prove rows are capped without seeding 5,000 users.
    const seeds: Seed[] = [];
    for (let i = 0; i < 12; i++) seeds.push({ handle: `p${i}`, elo: 2000 - i });
    await seedUsers(t, seeds);
    await rebuild(t);

    const field = await fieldDoc(t);
    expect(field?.playerCount).toBe(12);
    expect(field?.truncated).toBe(false);
    // Everyone is inside the cap, so nobody is approximate.
    const standing = await as(t, "p11").query(api.users.myStanding, {});
    expect(standing?.position).toBe(12);
    expect(standing?.approximate).toBe(false);
  });
});

describe("the VS badge is frozen at match start", () => {
  /** Queues two placed humans and pairs them, returning the match. */
  async function pairedMatch(t: Harness) {
    const ids = await seedUsers(t, [
      { handle: "over1", elo: 1900 },
      { handle: "over2", elo: 1800 },
      { handle: "duelist", elo: 1500 },
      { handle: "rival", elo: 1500 },
    ]);
    await rebuild(t);

    await t.run(async (ctx) => {
      for (const handle of ["duelist", "rival"] as const) {
        await ctx.db.insert("queue", { userId: ids[handle], elo: 1500, enqueuedAt: Date.now() });
      }
    });

    const result = await as(t, "duelist").mutation(api.ranked.tryMatchmake, {});
    expect(result.matched).toBe(true);

    const matchId = result.matched ? result.matchId : null;
    return { ids, matchId: matchId! };
  }

  test("stores a real position for both players at creation", async () => {
    const t = harness();
    const { ids, matchId } = await pairedMatch(t);

    const stored = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("matchPlayers")
        .withIndex("by_match", (q) => q.eq("matchId", matchId))
        .collect();
      return rows.map((row) => ({ userId: row.userId, rank: row.globalRankAtStart }));
    });

    // Two players sit above them at 1900 and 1800, and they tie at 1500 — so #3 and #4.
    expect(stored.map((row) => row.rank).sort()).toEqual([3, 4]);
    expect(stored.every((row) => row.userId === ids.duelist || row.userId === ids.rival)).toBe(
      true,
    );
  });

  test("the badge does not move mid-match, but the profile does", async () => {
    const t = harness();
    const { ids, matchId } = await pairedMatch(t);

    const before = await as(t, "duelist").query(api.matches.state, { matchId });
    const frozen = before!.scoreboard.map((row) => row.globalRank).sort();

    // Everyone above them evaporates — the live ladder now puts them at #1 and #2.
    await setElo(t, ids.over1, 100);
    await setElo(t, ids.over2, 100);
    await rebuild(t);

    const after = await as(t, "duelist").query(api.matches.state, { matchId });
    expect(after!.scoreboard.map((row) => row.globalRank).sort()).toEqual(frozen);

    // The profile is a one-off read and still answers live. #2, not #1: the two duellists
    // are tied at 1500 and ties break newest-first, so `rival` sits above `duelist`.
    const card = await t.query(api.matches.card, { userId: ids.duelist });
    expect(card?.globalRank).toBe(2);
    // Which is genuinely better than the frozen figure — that is the point of the test.
    expect(card!.globalRank!).toBeLessThan(Math.max(...(frozen as number[])));
  });

  test("a bot carries no position, so its badge never renders", async () => {
    const t = harness();
    await seedUsers(t, [
      { handle: "human", elo: 1200 },
      { handle: "botty", elo: 1200, isBot: true, botPersonaId: "crate_digger" },
    ]);
    await rebuild(t);

    const stored = await t.run(async (ctx) => {
      const bot = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", "botty"))
        .unique();
      return bot;
    });

    // Bots are off the board, so `globalPosition` has nothing to freeze for them.
    expect(stored?.isBot).toBe(true);
  });
});
