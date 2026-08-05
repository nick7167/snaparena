// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Characterization tests for the presence / forfeit rule.
 *
 * These pin CURRENT behaviour before the `lastSeenAt` field moves off `matchPlayers`
 * onto a dedicated `presence` table. They are deliberately written against observable
 * outcomes — who is marked forfeited, who wins, whether the match closes — rather than
 * against the storage layout, so they keep their meaning after the migration.
 *
 * The bot cases are the important ones. `claimForfeit` filters bots out BEFORE the
 * cutoff comparison, and that filter is load-bearing twice over: bots never heartbeat
 * (so they always read as absent), and the filter also sets the denominator in the
 * "everyone gone" guard. Both were real production bugs. See ranked.ts:429-433.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { RECONNECT_GRACE_MS, DUEL_STARTING_HP, STARTING_ELO } from "../src/engine/config";

const modules = import.meta.glob("./**/*.ts");

/**
 * The harness, carrying the schema through.
 *
 * Inferred from a real call rather than written out: `ReturnType<typeof convexTest>`
 * instantiates the generic with its default, and every `ctx.db.query` inside `t.run`
 * then resolves against the system tables instead of ours.
 */
function harness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof harness>;

/** Comfortably outside the grace window. */
const STALE = RECONNECT_GRACE_MS + 5_000;
/** Comfortably inside it — the reconnecting player. */
const FRESH = 1_000;

type SeedPlayer = {
  handle: string;
  /**
   * Milliseconds ago the LEGACY `matchPlayers.lastSeenAt` says they were seen.
   * `null` writes no record at all.
   */
  seenMsAgo: number | null;
  /**
   * Milliseconds ago the `presence` row says they were seen. Omitted writes no presence
   * row, which is how a match that predates the migration looks.
   */
  presenceMsAgo?: number;
  isBot?: boolean;
};

/**
 * Builds a two-player match with the given presence ages.
 *
 * Returns the ids the assertions need. `lastSeenAt` is written relative to a single
 * `now` captured here so the tests do not race the clock.
 */
async function seedMatch(
  t: Harness,
  opts: {
    mode: "ranked" | "practice" | "room" | "daily";
    status: "veto" | "active" | "complete" | "abandoned";
    players: SeedPlayer[];
  },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();

    const userIds: Id<"users">[] = [];
    for (const player of opts.players) {
      userIds.push(
        await ctx.db.insert("users", {
          clerkId: `clerk:${player.handle}`,
          handle: player.handle,
          displayName: player.handle,
          elo: STARTING_ELO,
          gamesPlayed: 0,
          placementsRemaining: 0,
          createdAt: now,
          ...(player.isBot ? { isBot: true } : {}),
        }),
      );
    }

    const matchId = await ctx.db.insert("matches", {
      mode: opts.mode,
      status: opts.status,
      playerIds: userIds,
      trackIds: [],
      bannedCategoryIds: [],
      currentRound: 0,
      phase: "guessing",
      createdAt: now,
    });

    const playerRowIds: Id<"matchPlayers">[] = [];
    for (const [index, player] of opts.players.entries()) {
      playerRowIds.push(
        await ctx.db.insert("matchPlayers", {
          matchId,
          userId: userIds[index],
          totalPoints: 0,
          hp: DUEL_STARTING_HP,
          ratingBefore: STARTING_ELO,
          forfeited: false,
          ...(player.seenMsAgo === null ? {} : { lastSeenAt: now - player.seenMsAgo }),
        }),
      );

      if (player.presenceMsAgo !== undefined) {
        await ctx.db.insert("presence", {
          matchId,
          userId: userIds[index],
          lastSeenAt: now - player.presenceMsAgo,
        });
      }
    }

    return { matchId, userIds, playerRowIds };
  });
}

async function readMatch(t: Harness, matchId: Id<"matches">) {
  return await t.run(async (ctx) => {
    const match = await ctx.db.get(matchId);
    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .collect();
    return { match, players };
  });
}

/**
 * Presence timestamps for a match, keyed by player. The live source of truth.
 *
 * The Map is built out here: `t.run` has to hand back a Convex value, and a Map is not
 * one.
 */
async function presenceByUser(t: Harness, matchId: Id<"matches">) {
  const rows = await t.run(async (ctx) => {
    const found = await ctx.db
      .query("presence")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .collect();
    return found.map((row) => ({ userId: row.userId, lastSeenAt: row.lastSeenAt }));
  });

  return new Map(rows.map((row) => [row.userId, row.lastSeenAt]));
}

async function scheduledCount(t: Harness) {
  return await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    return jobs.length;
  });
}

describe("claimForfeit", () => {
  test("1. forfeits a human silent past the grace period and awards the survivor", async () => {
    const t = harness();
    const { matchId, userIds } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "present", seenMsAgo: FRESH },
        { handle: "absent", seenMsAgo: STALE },
      ],
    });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(true);

    const { match, players } = await readMatch(t, matchId);
    expect(match?.status).toBe("complete");
    expect(match?.phase).toBe("match_end");
    expect(match?.winnerId).toBe(userIds[0]);
    expect(match?.completedAt).toBeTypeOf("number");

    const byUser = new Map(players.map((p) => [p.userId, p]));
    expect(byUser.get(userIds[1])?.forfeited).toBe(true);
    expect(byUser.get(userIds[0])?.forfeited).toBe(false);

    // Rating/XP settlement is handed to the scheduler, not done inline.
    expect(await scheduledCount(t)).toBe(1);
  });

  test("2. does not forfeit a player still inside the grace period", async () => {
    const t = harness();
    const { matchId } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "present", seenMsAgo: FRESH },
        // One second short of the cutoff — the reconnect case.
        { handle: "reconnecting", seenMsAgo: RECONNECT_GRACE_MS - 1_000 },
      ],
    });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(false);

    const { match, players } = await readMatch(t, matchId);
    expect(match?.status).toBe("active");
    expect(players.every((p) => p.forfeited === false)).toBe(true);
    expect(await scheduledCount(t)).toBe(0);
  });

  test("3. does not forfeit when every human is gone", async () => {
    const t = harness();
    const { matchId } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "gone-a", seenMsAgo: STALE },
        { handle: "gone-b", seenMsAgo: STALE },
      ],
    });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(false);

    const { match, players } = await readMatch(t, matchId);
    expect(match?.status).toBe("active");
    expect(players.every((p) => p.forfeited === false)).toBe(true);
  });

  test("4. never forfeits a bot, however stale its timestamp", async () => {
    // The documented regression: bots have no client, so `lastSeenAt` is frozen at
    // match creation. Counting them as absent handed the human a free win ~20s in.
    const t = harness();
    const { matchId, userIds } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "human", seenMsAgo: FRESH },
        { handle: "bot", seenMsAgo: STALE, isBot: true },
      ],
    });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(false);

    const { match, players } = await readMatch(t, matchId);
    expect(match?.status).toBe("active");
    const byUser = new Map(players.map((p) => [p.userId, p]));
    expect(byUser.get(userIds[1])?.forfeited).toBe(false);
  });

  test("5. a bot cannot win by forfeit when the only human leaves", async () => {
    // The undocumented half of the same filter: excluding bots also sets the
    // denominator in the everyone-gone guard. With the bot counted as a live player,
    // `absent.length !== humans.length` and the bot would be awarded the match.
    const t = harness();
    const { matchId, userIds } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "human", seenMsAgo: STALE },
        { handle: "bot", seenMsAgo: FRESH, isBot: true },
      ],
    });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(false);

    const { match, players } = await readMatch(t, matchId);
    expect(match?.status).toBe("active");
    expect(match?.winnerId).toBeUndefined();
    expect(players.every((p) => p.forfeited === false)).toBe(true);
    expect(userIds).toHaveLength(2);
  });

  test("6. only ranked matches forfeit on silence", async () => {
    for (const mode of ["practice", "room", "daily"] as const) {
      const t = harness();
      const { matchId } = await seedMatch(t, {
        mode,
        status: "active",
        players: [
          { handle: "present", seenMsAgo: FRESH },
          { handle: "absent", seenMsAgo: STALE },
        ],
      });

      const result = await t.mutation(api.ranked.claimForfeit, { matchId });
      expect(result.forfeited, `${mode} must not forfeit`).toBe(false);

      const { match } = await readMatch(t, matchId);
      expect(match?.status).toBe("active");
    }
  });

  test("10. a player with no presence record at all counts as present", async () => {
    // Absence of evidence is not evidence of absence: a row carrying neither a presence
    // entry nor a legacy timestamp must never cost somebody a rated match. This is what
    // keeps every intermediate deploy of the presence migration safe.
    const t = harness();
    const { matchId } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "present", seenMsAgo: FRESH },
        { handle: "unknown", seenMsAgo: null },
      ],
    });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(false);

    const { match, players } = await readMatch(t, matchId);
    expect(match?.status).toBe("active");
    expect(players.every((p) => p.forfeited === false)).toBe(true);
  });

  test("11. a fresh presence row rescues a stale legacy timestamp", async () => {
    // The normal state after the migration: `matchPlayers.lastSeenAt` has stopped being
    // refreshed and is arbitrarily old, while the presence row is current.
    const t = harness();
    const { matchId } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "present", seenMsAgo: FRESH, presenceMsAgo: FRESH },
        { handle: "playing", seenMsAgo: STALE, presenceMsAgo: FRESH },
      ],
    });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(false);
    expect((await readMatch(t, matchId)).match?.status).toBe("active");
  });

  test("12. a stale presence row is NOT rescued by a fresh legacy timestamp", async () => {
    // Presence wins outright — it is not the newer of the two. Taking `Math.max` here
    // would be the tempting shortcut and it is wrong in exactly this direction: a player
    // who has genuinely gone would keep being propped up by whatever `matchPlayers` last
    // happened to record, including the piggybacked write on their final guess.
    const t = harness();
    const { matchId, userIds } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "present", seenMsAgo: FRESH, presenceMsAgo: FRESH },
        { handle: "gone", seenMsAgo: FRESH, presenceMsAgo: STALE },
      ],
    });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(true);

    const { match, players } = await readMatch(t, matchId);
    expect(match?.winnerId).toBe(userIds[0]);
    expect(players.find((p) => p.userId === userIds[1])?.forfeited).toBe(true);
  });

  test("7. only active matches forfeit on silence", async () => {
    for (const status of ["veto", "complete", "abandoned"] as const) {
      const t = harness();
      const { matchId } = await seedMatch(t, {
        mode: "ranked",
        status,
        players: [
          { handle: "present", seenMsAgo: FRESH },
          { handle: "absent", seenMsAgo: STALE },
        ],
      });

      const result = await t.mutation(api.ranked.claimForfeit, { matchId });
      expect(result.forfeited, `status ${status} must not forfeit`).toBe(false);

      const { players } = await readMatch(t, matchId);
      expect(players.every((p) => p.forfeited === false)).toBe(true);
    }
  });
});

describe("heartbeat", () => {
  test("8. a heartbeat clears the caller's own staleness", async () => {
    const t = harness();
    const { matchId } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "present", seenMsAgo: FRESH },
        { handle: "returning", seenMsAgo: STALE },
      ],
    });

    // Without this the next sweep would forfeit them — test 1 proves that.
    await t
      .withIdentity({ subject: "clerk:returning" })
      .mutation(api.ranked.heartbeat, { matchId });

    const result = await t.mutation(api.ranked.claimForfeit, { matchId });
    expect(result.forfeited).toBe(false);

    const { match } = await readMatch(t, matchId);
    expect(match?.status).toBe("active");
  });

  test("9. a heartbeat touches only the caller's presence", async () => {
    const t = harness();
    const { matchId, userIds } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "caller", seenMsAgo: null, presenceMsAgo: STALE },
        { handle: "other", seenMsAgo: null, presenceMsAgo: STALE },
      ],
    });

    const before = await presenceByUser(t, matchId);
    await t.withIdentity({ subject: "clerk:caller" }).mutation(api.ranked.heartbeat, { matchId });
    const after = await presenceByUser(t, matchId);

    // The caller is refreshed...
    expect(after.get(userIds[0])!).toBeGreaterThan(before.get(userIds[0])!);
    // ...and the opponent is untouched, so one client cannot keep another alive by
    // beating on their behalf.
    expect(after.get(userIds[1])!).toBe(before.get(userIds[1])!);
  });

  test("13. one player's heartbeat forfeits the other", async () => {
    // The fold: the client no longer polls `claimForfeit` separately, so the survivor's
    // own heartbeat has to be what closes the match.
    const t = harness();
    const { matchId, userIds } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "present", seenMsAgo: FRESH, presenceMsAgo: FRESH },
        { handle: "gone", seenMsAgo: STALE, presenceMsAgo: STALE },
      ],
    });

    const result = await t
      .withIdentity({ subject: "clerk:present" })
      .mutation(api.ranked.heartbeat, { matchId });

    expect(result.forfeited).toBe(true);

    const { match, players } = await readMatch(t, matchId);
    expect(match?.status).toBe("complete");
    expect(match?.winnerId).toBe(userIds[0]);
    expect(players.find((p) => p.userId === userIds[1])?.forfeited).toBe(true);
    expect(await scheduledCount(t)).toBe(1);
  });

  test("14. the departing player's own heartbeat cannot forfeit them", async () => {
    // The presence write must land before the sweep reads it, or a client returning
    // after a lag spike would forfeit itself on its own first beat back.
    const t = harness();
    const { matchId } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "present", seenMsAgo: FRESH, presenceMsAgo: FRESH },
        { handle: "returning", seenMsAgo: STALE, presenceMsAgo: STALE },
      ],
    });

    const result = await t
      .withIdentity({ subject: "clerk:returning" })
      .mutation(api.ranked.heartbeat, { matchId });

    expect(result.forfeited).toBe(false);
    expect((await readMatch(t, matchId)).match?.status).toBe("active");
  });

  test("9b. a heartbeat from a non-participant changes nothing", async () => {
    const t = harness();
    const { matchId } = await seedMatch(t, {
      mode: "ranked",
      status: "active",
      players: [
        { handle: "a", seenMsAgo: null, presenceMsAgo: STALE },
        { handle: "b", seenMsAgo: null, presenceMsAgo: STALE },
      ],
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "clerk:stranger",
        handle: "stranger",
        displayName: "stranger",
        elo: STARTING_ELO,
        gamesPlayed: 0,
        placementsRemaining: 0,
        createdAt: Date.now(),
      });
    });

    const before = await presenceByUser(t, matchId);
    await t.withIdentity({ subject: "clerk:stranger" }).mutation(api.ranked.heartbeat, { matchId });
    const after = await presenceByUser(t, matchId);

    // No row minted for the stranger, and nobody else's touched.
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort());
    expect(after.size).toBe(2);
  });
});
