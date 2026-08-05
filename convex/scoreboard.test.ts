// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Golden test for the running per-player stats on `matches.state`.
 *
 * `statsFor` currently recomputes `roundsWon` / `streak` / `bestMs` / `solved` by
 * collecting EVERY guess in the match on every re-execution. That collect is unbounded
 * and about to be replaced by `match.roundLog`, which already records the same figures
 * per round.
 *
 * Both sources are seeded consistently here, so these expectations hold before the
 * change and after it. That is the whole point: if the two ever disagree, this fails.
 *
 * The two phase windows matter independently. During `guessing` the log lags
 * `currentRound` by one and the current round has to come from the loose `guesses`
 * rows; by `standings` the log has caught up and the guesses are redundant. Both must
 * produce identical stats.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { DUEL_STARTING_HP, STARTING_ELO } from "../src/engine/config";

const modules = import.meta.glob("./**/*.ts");

/** Inferred from a real call so `ctx.db` inside `t.run` resolves against our schema. */
function harness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof harness>;

/** One player's outcome in one round. `null` means they never solved it. */
type Solve = { points: number; elapsedMs: number } | null;

/**
 * Round 0 — A solves fast, B never does.
 * Round 1 — B solves faster and scores higher than A.
 * Round 2 — A solves, B has not yet.
 *
 * Chosen so the streak resets and rebuilds for A, which is the part of `statsFor`
 * most likely to break under a rewrite.
 */
const SCRIPT: Solve[][] = [
  [{ points: 60, elapsedMs: 3_000 }, null],
  [
    { points: 40, elapsedMs: 5_000 },
    { points: 80, elapsedMs: 2_000 },
  ],
  [{ points: 100, elapsedMs: 1_500 }, null],
];

/**
 * Seeds a two-player match mid-script.
 *
 * `loggedRounds` is how many rounds have reached `applyRoundDamage` and therefore
 * appear in `roundLog`; guesses are always written for every round in the script, which
 * is what the live game does too.
 */
async function seedScriptedMatch(
  t: Harness,
  opts: { currentRound: number; loggedRounds: number; phase: "guessing" | "standings" },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();

    const userIds: Id<"users">[] = [];
    for (const handle of ["alpha", "beta"]) {
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

    const trackIds: Id<"tracks">[] = [];
    for (const [index] of SCRIPT.entries()) {
      trackIds.push(
        await ctx.db.insert("tracks", {
          itunesTrackId: 1_000 + index,
          title: `Track ${index}`,
          titleNormalized: `track ${index}`,
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
        }),
      );
    }

    const roundLog = SCRIPT.slice(0, opts.loggedRounds).map((round, roundIndex) => {
      const solvers = round
        .map((solve, seat) => ({ solve, seat }))
        .filter((entry) => entry.solve !== null);
      const best = solvers.sort((a, b) => b.solve!.points - a.solve!.points)[0];

      return {
        roundIndex,
        trackId: trackIds[roundIndex],
        outcome: "tier",
        winnerId: best ? userIds[best.seat] : undefined,
        multiplier: 1,
        damage: [],
        results: round.map((solve, seat) => ({
          userId: userIds[seat],
          points: solve?.points ?? 0,
          elapsedMs: solve?.elapsedMs,
          solved: solve !== null,
        })),
      };
    });

    const matchId = await ctx.db.insert("matches", {
      mode: "ranked",
      status: "active",
      playerIds: userIds,
      trackIds,
      bannedCategoryIds: [],
      currentRound: opts.currentRound,
      phase: opts.phase,
      roundLog,
      roundStartedAt: now,
      createdAt: now,
    });

    for (const [seat, userId] of userIds.entries()) {
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId,
        totalPoints: SCRIPT.reduce((sum, round) => sum + (round[seat]?.points ?? 0), 0),
        hp: DUEL_STARTING_HP,
        ratingBefore: STARTING_ELO,
        forfeited: false,
        lastSeenAt: now,
      });
    }

    // Every solve in the script becomes a real `guesses` row, exactly as play would.
    for (const [roundIndex, round] of SCRIPT.entries()) {
      if (roundIndex > opts.currentRound) continue;
      for (const [seat, solve] of round.entries()) {
        if (!solve) continue;
        await ctx.db.insert("guesses", {
          matchId,
          roundIndex,
          userId: userIds[seat],
          rawText: `Track ${roundIndex}`,
          normalizedText: `track ${roundIndex}`,
          correct: true,
          clientElapsedMs: solve.elapsedMs,
          serverReceivedAt: now,
          accepted: true,
          points: solve.points,
        });
      }
    }

    return { matchId, userIds };
  });
}

/** Just the four running-stat fields, keyed by handle, so the assertion reads clearly. */
async function statsByHandle(
  t: Harness,
  matchId: Id<"matches">,
): Promise<Record<string, unknown>> {
  const state = await t
    .withIdentity({ subject: "clerk:alpha" })
    .query(api.matches.state, { matchId });

  const stats: Record<string, unknown> = {};
  for (const row of state!.scoreboard) {
    stats[row.handle!] = {
      roundsWon: row.roundsWon,
      streak: row.streak,
      bestMs: row.bestMs,
      solved: row.solved,
    };
  }
  return stats;
}

/**
 * Hand-computed from SCRIPT against `wonRound` (src/engine/duel.ts:319 — strictly
 * greater than every opponent, and never on zero points).
 *
 *   alpha  r0 win (60>0) → streak 1 · r1 loss (40<80) → streak 0 · r2 win (100>0) → streak 1
 *   beta   r0 loss       → streak 0 · r1 win (80>40)  → streak 1 · r2 loss (0<100) → streak 0
 */
const EXPECTED = {
  alpha: { roundsWon: 2, streak: 1, bestMs: 1_500, solved: 3 },
  beta: { roundsWon: 1, streak: 0, bestMs: 2_000, solved: 1 },
};

describe("matches.state running stats", () => {
  test("during guessing, with the round log one behind the current round", async () => {
    const t = harness();
    const { matchId } = await seedScriptedMatch(t, {
      currentRound: 2,
      loggedRounds: 2, // rounds 0 and 1 closed; round 2 still open
      phase: "guessing",
    });

    expect(await statsByHandle(t, matchId)).toEqual(EXPECTED);
  });

  test("during standings, with the round log caught up", async () => {
    const t = harness();
    const { matchId } = await seedScriptedMatch(t, {
      currentRound: 2,
      loggedRounds: 3, // round 2 has closed too
      phase: "standings",
    });

    expect(await statsByHandle(t, matchId)).toEqual(EXPECTED);
  });

  test("the first round of a match reports only that round", async () => {
    const t = harness();
    const { matchId } = await seedScriptedMatch(t, {
      currentRound: 0,
      loggedRounds: 0,
      phase: "guessing",
    });

    expect(await statsByHandle(t, matchId)).toEqual({
      alpha: { roundsWon: 1, streak: 1, bestMs: 3_000, solved: 1 },
      beta: { roundsWon: 0, streak: 0, bestMs: null, solved: 0 },
    });
  });
});
