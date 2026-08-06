// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Tests for the two places the phase machine could stop and never start again.
 *
 * Both were real: a draft between two humans had no server-side timer at all, so a match
 * whose players both closed their tab sat in `phase: "veto"` forever — unforfeitable,
 * because the sweep only looks at `status: "active"`, and unreachable by `nudge`, which
 * refuses to act on a phase with no deadline. And the countdown's transition into guessing
 * was owned by a single self-rescheduling chain with `advance` deliberately no-oping, so
 * if that chain ever died the match froze on "GO" with both clients nudging a mutation
 * that did nothing.
 *
 * Written against observable state — what phase the match is in, what is on the scheduler
 * — rather than against the internals of either rescue, so they survive a rewrite of how
 * the timers are armed.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  DUEL_STARTING_HP,
  MAX_DUEL_ROUNDS,
  PHASE_DURATIONS_MS,
  READY_TIMEOUT_MS,
  STARTING_ELO,
  SURRENDER_FROM_ROUND,
  VETO_BANS_PER_PLAYER,
  VETO_PHASE_MS,
} from "../src/engine/config";

const modules = import.meta.glob("./**/*.ts");

/**
 * The harness, carrying the schema through.
 *
 * Inferred from a real call rather than written out, for the reason forfeit.test.ts
 * documents: `ReturnType<typeof convexTest>` instantiates the generic with its default and
 * every `ctx.db.query` inside `t.run` then resolves against the system tables.
 */
function harness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof harness>;

const TOTAL_BANS = VETO_BANS_PER_PLAYER * 2;

/**
 * Enough catalogue for `startDuelIfDraftDone` to actually draw a full duel.
 *
 * It refuses to start a match it cannot run to the distance, so a thin catalogue would
 * abandon the match and every draft assertion below would pass for the wrong reason.
 */
async function seedCatalogue(t: Harness) {
  return await t.run(async (ctx) => {
    const now = Date.now();

    const categoryIds: Id<"categories">[] = [];
    for (let i = 0; i < 8; i++) {
      categoryIds.push(
        await ctx.db.insert("categories", {
          slug: `cat-${i}`,
          name: `Category ${i}`,
          sortOrder: i,
        }),
      );
    }

    // Comfortably more than the duel needs, spread across the pool so bans cannot starve it.
    for (let i = 0; i < MAX_DUEL_ROUNDS * 3; i++) {
      await ctx.db.insert("tracks", {
        itunesTrackId: 1_000 + i,
        title: `Song ${i}`,
        titleNormalized: `song ${i}`,
        artist: `Artist ${i}`,
        artistNormalized: `artist ${i}`,
        artworkUrl: `https://example.test/art/${i}.jpg`,
        previewUrl: `https://example.test/preview/${i}.m4a`,
        previewCheckedAt: now,
        categoryIds: [categoryIds[i % categoryIds.length]],
        difficulty: 3,
        popularity: 50,
        releaseYear: 2000,
        playable: true,
        solveSampleCount: 0,
      });
    }

    return categoryIds;
  });
}

/** A two-human match parked mid-draft, with the deadline placed relative to now. */
async function seedDraft(
  t: Harness,
  opts: {
    deadlineMsFromNow: number | null;
    banTurn?: number;
    status?: "veto" | "active" | "complete" | "abandoned";
    phase?: "veto" | "veto_reveal" | "countdown";
  },
) {
  const categoryIds = await seedCatalogue(t);

  return await t.run(async (ctx) => {
    const now = Date.now();

    const userIds: Id<"users">[] = [];
    for (const handle of ["alice", "bob"]) {
      userIds.push(
        await ctx.db.insert("users", {
          clerkId: `clerk:${handle}`,
          handle,
          displayName: handle,
          elo: STARTING_ELO,
          gamesPlayed: 0,
          placementsRemaining: 0,
          createdAt: now,
        }),
      );
    }

    const matchId = await ctx.db.insert("matches", {
      mode: "ranked",
      status: opts.status ?? "veto",
      playerIds: userIds,
      trackIds: [],
      bannedCategoryIds: [],
      vetoPoolIds: categoryIds,
      banOrder: userIds,
      banTurn: opts.banTurn ?? 0,
      currentRound: 0,
      phase: opts.phase ?? "veto",
      createdAt: now,
      ...(opts.deadlineMsFromNow === null
        ? {}
        : { vetoDeadline: now + opts.deadlineMsFromNow }),
    });

    for (const userId of userIds) {
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId,
        totalPoints: 0,
        hp: DUEL_STARTING_HP,
        ratingBefore: STARTING_ELO,
        forfeited: false,
      });
    }

    return { matchId, userIds, categoryIds };
  });
}

/** A match sitting in the countdown, with the phase deadline placed relative to now. */
async function seedCountdown(t: Harness, opts: { endsAtMsFromNow: number }) {
  await seedCatalogue(t);

  return await t.run(async (ctx) => {
    const now = Date.now();

    const userIds: Id<"users">[] = [];
    for (const handle of ["carol", "dave"]) {
      userIds.push(
        await ctx.db.insert("users", {
          clerkId: `clerk:${handle}`,
          handle,
          displayName: handle,
          elo: STARTING_ELO,
          gamesPlayed: 0,
          placementsRemaining: 0,
          createdAt: now,
        }),
      );
    }

    const trackIds = await ctx.db
      .query("tracks")
      .take(MAX_DUEL_ROUNDS)
      .then((rows) => rows.map((row) => row._id));

    const matchId = await ctx.db.insert("matches", {
      mode: "ranked",
      status: "active",
      playerIds: userIds,
      trackIds,
      bannedCategoryIds: [],
      currentRound: 0,
      phase: "countdown",
      phaseEndsAt: now + opts.endsAtMsFromNow,
      createdAt: now,
    });

    for (const userId of userIds) {
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId,
        totalPoints: 0,
        hp: DUEL_STARTING_HP,
        ratingBefore: STARTING_ELO,
        forfeited: false,
      });
    }

    return { matchId, userIds };
  });
}

async function readMatch(t: Harness, matchId: Id<"matches">) {
  return await t.run(async (ctx) => ctx.db.get(matchId));
}

/** Scheduled jobs, newest last. Names let a test tell the watchdog from the bot driver. */
async function scheduled(t: Harness) {
  return await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    return jobs.map((job) => ({ name: job.name, scheduledTime: job.scheduledTime }));
  });
}

describe("draftWatchdog", () => {
  test("1. closes a draft whose deadline has passed, forfeiting the unplaced bans", async () => {
    const t = harness();
    const { matchId } = await seedDraft(t, { deadlineMsFromNow: -1_000, banTurn: 0 });

    await t.mutation(internal.phases.draftWatchdog, { matchId });

    const match = await readMatch(t, matchId);
    // The existing expiry semantics: start with what was placed rather than block forever.
    expect(match?.phase).toBe("veto_reveal");
    expect(match?.status).toBe("active");
    expect(match?.trackIds).toHaveLength(MAX_DUEL_ROUNDS);
    expect(match?.bannedCategoryIds).toHaveLength(0);
  });

  test("2. leaves a live draft alone and re-arms itself exactly once", async () => {
    const t = harness();
    const { matchId } = await seedDraft(t, { deadlineMsFromNow: VETO_PHASE_MS });

    const before = await scheduled(t);
    await t.mutation(internal.phases.draftWatchdog, { matchId });
    const after = await scheduled(t);

    const match = await readMatch(t, matchId);
    expect(match?.phase).toBe("veto");
    expect(match?.trackIds).toHaveLength(0);

    const added = after.slice(before.length);
    expect(added).toHaveLength(1);
    expect(added[0].name).toContain("draftWatchdog");
  });

  /**
   * The case that rules out the obvious wrong design.
   *
   * A single timer armed for VETO_PHASE_MS at phase entry looks correct and is not:
   * `placeBan` pushes the deadline out on every ban, so that timer fires mid-draft, finds
   * the deadline moved, and — having already spent itself — leaves nothing scheduled at
   * all. Worse than no watchdog, because it looks like one.
   */
  test("3. does not close a draft whose deadline was pushed out by a ban", async () => {
    const t = harness();
    const { matchId } = await seedDraft(t, { deadlineMsFromNow: -1_000 });

    // A ban lands just before the watchdog runs, moving the deadline into the future.
    await t.run(async (ctx) => {
      await ctx.db.patch(matchId, {
        banTurn: 1,
        vetoDeadline: Date.now() + VETO_PHASE_MS,
      });
    });

    const before = await scheduled(t);
    await t.mutation(internal.phases.draftWatchdog, { matchId });
    const after = await scheduled(t);

    const match = await readMatch(t, matchId);
    expect(match?.phase).toBe("veto");
    expect(after.slice(before.length)).toHaveLength(1);
  });

  test("4. closes a completed draft even while its deadline is still in the future", async () => {
    const t = harness();
    const { matchId } = await seedDraft(t, {
      deadlineMsFromNow: VETO_PHASE_MS,
      banTurn: TOTAL_BANS,
    });

    // The watchdog re-arms rather than acting; the draft being done is what closes it.
    await t.mutation(internal.phases.draftWatchdog, { matchId });
    expect((await readMatch(t, matchId))?.phase).toBe("veto");

    await t.run(async (ctx) => {
      await ctx.db.patch(matchId, { vetoDeadline: Date.now() - 1_000 });
    });
    await t.mutation(internal.phases.draftWatchdog, { matchId });

    expect((await readMatch(t, matchId))?.phase).toBe("veto_reveal");
  });

  test("5. stops chaining once the draft is over", async () => {
    const t = harness();
    const { matchId } = await seedDraft(t, {
      deadlineMsFromNow: -1_000,
      phase: "veto_reveal",
      status: "active",
    });

    const before = await scheduled(t);
    await t.mutation(internal.phases.draftWatchdog, { matchId });
    const after = await scheduled(t);

    expect(after).toHaveLength(before.length);
  });

  test("6. stops chaining on an abandoned match", async () => {
    const t = harness();
    const { matchId } = await seedDraft(t, {
      deadlineMsFromNow: -1_000,
      status: "abandoned",
    });

    const before = await scheduled(t);
    await t.mutation(internal.phases.draftWatchdog, { matchId });
    const after = await scheduled(t);

    expect(after).toHaveLength(before.length);
    expect((await readMatch(t, matchId))?.phase).toBe("veto");
  });

  test("7. stamps a deadline on a draft that somehow has none, rather than giving up", async () => {
    const t = harness();
    const { matchId } = await seedDraft(t, { deadlineMsFromNow: null });

    await t.mutation(internal.phases.draftWatchdog, { matchId });

    const match = await readMatch(t, matchId);
    expect(match?.phase).toBe("veto");
    expect(match?.vetoDeadline).toBeGreaterThan(Date.now());
  });

  test("8. is idempotent — a second run does not redraw the duel", async () => {
    const t = harness();
    const { matchId } = await seedDraft(t, { deadlineMsFromNow: -1_000 });

    await t.mutation(internal.phases.draftWatchdog, { matchId });
    const first = await readMatch(t, matchId);

    await t.mutation(internal.phases.draftWatchdog, { matchId });
    const second = await readMatch(t, matchId);

    expect(second?.phase).toBe(first?.phase);
    expect(second?.trackIds).toEqual(first?.trackIds);
  });
});

describe("advance: countdown backstop", () => {
  /**
   * The anti-truncation gate. While the readiness barrier could still legitimately be
   * working, `advance` must not act — starting the round early is exactly the bug that
   * barrier exists to prevent.
   */
  test("9. refuses to rescue while the readiness barrier could still be alive", async () => {
    const t = harness();
    const { matchId } = await seedCountdown(t, { endsAtMsFromNow: -1_000 });

    await t.mutation(internal.phases.advance, {
      matchId,
      expectedPhase: "countdown",
      expectedRound: 0,
    });

    expect((await readMatch(t, matchId))?.phase).toBe("countdown");
  });

  test("10. rescues a countdown stuck past the readiness timeout", async () => {
    const t = harness();
    const { matchId } = await seedCountdown(t, {
      endsAtMsFromNow: -(READY_TIMEOUT_MS + 1_000),
    });

    await t.mutation(internal.phases.advance, {
      matchId,
      expectedPhase: "countdown",
      expectedRound: 0,
    });

    const match = await readMatch(t, matchId);
    expect(match?.phase).toBe("guessing");
    expect(match?.roundStartedAt).toBeGreaterThan(0);
  });

  /**
   * Guards the regression that would matter most: a second transition into guessing
   * re-stamps `roundStartedAt`, which hands everyone a fresh scoring window mid-round.
   */
  test("11. cannot rescue twice — the round clock is not restarted", async () => {
    const t = harness();
    const { matchId } = await seedCountdown(t, {
      endsAtMsFromNow: -(READY_TIMEOUT_MS + 1_000),
    });

    await t.mutation(internal.phases.advance, {
      matchId,
      expectedPhase: "countdown",
      expectedRound: 0,
    });
    const first = await readMatch(t, matchId);

    await t.mutation(internal.phases.advance, {
      matchId,
      expectedPhase: "countdown",
      expectedRound: 0,
    });
    const second = await readMatch(t, matchId);

    expect(second?.roundStartedAt).toBe(first?.roundStartedAt);
    expect(second?.phase).toBe("guessing");
  });

  test("12. ignores a timer armed for a different round", async () => {
    const t = harness();
    const { matchId } = await seedCountdown(t, {
      endsAtMsFromNow: -(READY_TIMEOUT_MS + 1_000),
    });

    await t.mutation(internal.phases.advance, {
      matchId,
      expectedPhase: "countdown",
      expectedRound: 3,
    });

    expect((await readMatch(t, matchId))?.phase).toBe("countdown");
  });
});

/**
 * The surrender gate, which is the only thing that can end an unrated match early.
 *
 * `sweepForfeits` ignores anything that is not ranked, so a practice match that is not
 * resigned is never closed by anything — and `ranked.activeMatch` counts practice, so it
 * keeps routing the player back into it. The gate is about protecting a rating, and
 * practice has none to protect.
 */
describe("surrender", () => {
  async function seedDuel(t: Harness, mode: "ranked" | "practice", currentRound: number) {
    await seedCatalogue(t);

    return await t.run(async (ctx) => {
      const now = Date.now();
      const userIds: Id<"users">[] = [];
      for (const handle of ["erin", "frank"]) {
        userIds.push(
          await ctx.db.insert("users", {
            clerkId: `clerk:${handle}`,
            handle,
            displayName: handle,
            elo: STARTING_ELO,
            gamesPlayed: 0,
            placementsRemaining: 0,
            createdAt: now,
          }),
        );
      }

      const matchId = await ctx.db.insert("matches", {
        mode,
        status: "active",
        playerIds: userIds,
        trackIds: [],
        bannedCategoryIds: [],
        currentRound,
        phase: "guessing",
        createdAt: now,
      });

      for (const userId of userIds) {
        await ctx.db.insert("matchPlayers", {
          matchId,
          userId,
          totalPoints: 0,
          hp: DUEL_STARTING_HP,
          ratingBefore: STARTING_ELO,
          forfeited: false,
        });
      }

      return { matchId, userIds };
    });
  }

  test("14. a practice match can be resigned from the very first round", async () => {
    const t = harness();
    const { matchId, userIds } = await seedDuel(t, "practice", 0);

    const result = await t
      .withIdentity({ subject: "clerk:erin" })
      .mutation(api.ranked.surrender, { matchId });

    expect(result.surrendered).toBe(true);
    const match = await readMatch(t, matchId);
    // The whole point: it is CLOSED, so nothing routes anyone back into it.
    expect(match?.status).toBe("complete");
    expect(match?.winnerId).toBe(userIds[1]);
  });

  test("15. a ranked match still refuses before SURRENDER_FROM_ROUND", async () => {
    const t = harness();
    const { matchId } = await seedDuel(t, "ranked", 0);

    const result = await t
      .withIdentity({ subject: "clerk:erin" })
      .mutation(api.ranked.surrender, { matchId });

    expect(result.surrendered).toBe(false);
    expect((await readMatch(t, matchId))?.status).toBe("active");
  });

  test("16. a ranked match can be resigned from SURRENDER_FROM_ROUND onward", async () => {
    const t = harness();
    const { matchId } = await seedDuel(t, "ranked", SURRENDER_FROM_ROUND);

    const result = await t
      .withIdentity({ subject: "clerk:erin" })
      .mutation(api.ranked.surrender, { matchId });

    expect(result.surrendered).toBe(true);
    expect((await readMatch(t, matchId))?.status).toBe("complete");
  });
});

describe("startCountdown", () => {
  /**
   * Driven through `advance` leaving `veto_reveal`, which is how a real round begins —
   * rather than through a test-only entry point, so the arming this asserts is the arming
   * production actually does.
   */
  test("13. arms the readiness chain and an independent backstop behind it", async () => {
    const t = harness();
    const { matchId } = await seedCountdown(t, { endsAtMsFromNow: -1 });
    await t.run(async (ctx) => {
      await ctx.db.patch(matchId, { phase: "veto_reveal" });
    });

    const before = await scheduled(t);
    await t.mutation(internal.phases.advance, {
      matchId,
      expectedPhase: "veto_reveal",
      expectedRound: 0,
    });
    const added = (await scheduled(t)).slice(before.length);

    expect((await readMatch(t, matchId))?.phase).toBe("countdown");

    // The readiness poll, enterPhase's own advance at the countdown duration, and the
    // backstop that lands after the barrier's hard stop.
    const names = added.map((job) => job.name);
    expect(names.filter((name) => name.includes("waitForReady"))).toHaveLength(1);
    expect(names.filter((name) => name.includes("advance"))).toHaveLength(2);

    const advances = added
      .filter((job) => job.name.includes("advance"))
      .map((job) => job.scheduledTime)
      .sort((a, b) => a - b);

    // The early one cannot act on arrival; the late one lands past the readiness timeout,
    // which is exactly what makes it a backstop rather than a race.
    expect(advances[1] - advances[0]).toBeGreaterThanOrEqual(READY_TIMEOUT_MS);
    expect(advances[0]).toBeLessThanOrEqual(Date.now() + PHASE_DURATIONS_MS.countdown + 1_000);
  });
});
