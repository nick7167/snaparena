// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * The guards on runtime configuration.
 *
 * Two things here are worth more than the rest. The first is that `save` refuses a caller
 * who is not an admin and a value outside its declared bounds — the form checks both, but
 * a mutation is reachable from a console without the page ever being loaded, so the tests
 * that matter are the ones that go straight at the mutation.
 *
 * The second is the snapshot: a match resolves the config it was created under for as long
 * as it lives. That is the property the whole design rests on, and it is invisible from
 * the outside until somebody saves a value mid-duel.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { DUEL_STARTING_HP, STARTING_ELO, XP_AWARDS } from "../src/engine/config";

const modules = import.meta.glob("./**/*.ts");

function harness() {
  return convexTest(schema, modules);
}
type Harness = ReturnType<typeof harness>;

async function seedUser(t: Harness, handle: string, role?: "admin"): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: `clerk:${handle}`,
      handle,
      displayName: handle,
      elo: STARTING_ELO,
      gamesPlayed: 0,
      placementsRemaining: 5,
      createdAt: Date.now(),
      ...(role ? { role } : {}),
    }),
  );
}

function as(t: Harness, handle: string) {
  return t.withIdentity({ subject: `clerk:${handle}` });
}

describe("config.save — who may write", () => {
  test("refuses an anonymous caller", async () => {
    const t = harness();
    await expect(
      t.mutation(api.config.save, { values: [{ key: "DUEL_STARTING_HP", value: 400 }] }),
    ).rejects.toThrow();
  });

  test("refuses a signed-in player who is not an admin", async () => {
    const t = harness();
    await seedUser(t, "player");

    await expect(
      as(t, "player").mutation(api.config.save, {
        values: [{ key: "DUEL_STARTING_HP", value: 400 }],
      }),
    ).rejects.toThrow(/not an admin/i);
  });

  test("accepts an admin", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    const result = await as(t, "boss").mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: 400 }],
    });

    expect(result.applied).toBe(1);
    expect((await t.query(api.config.current, {})).config.DUEL_STARTING_HP).toBe(400);
  });
});

describe("config.save — what it will write", () => {
  test("rejects a value above its declared maximum", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    await expect(
      as(t, "boss").mutation(api.config.save, {
        values: [{ key: "DUEL_STARTING_HP", value: 999_999 }],
      }),
    ).rejects.toThrow(/between/i);
  });

  test("rejects a value below its declared minimum", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    await expect(
      as(t, "boss").mutation(api.config.save, {
        values: [{ key: "MAX_DUEL_ROUNDS", value: 0 }],
      }),
    ).rejects.toThrow(/between/i);
  });

  /** The console never renders a field for these, but the mutation is reachable anyway. */
  test("rejects a locked field", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    await expect(
      as(t, "boss").mutation(api.config.save, {
        values: [{ key: "K_ESTABLISHED", value: 32 }],
      }),
    ).rejects.toThrow(/not editable/i);
  });

  test("rejects an anti-cheat floor outright", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    await expect(
      as(t, "boss").mutation(api.config.save, {
        values: [{ key: "MIN_HUMAN_REACTION_MS", value: 0 }],
      }),
    ).rejects.toThrow(/not editable/i);
  });

  test("rejects a key that does not exist", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    await expect(
      as(t, "boss").mutation(api.config.save, {
        values: [{ key: "NOT_A_SETTING", value: 1 }],
      }),
    ).rejects.toThrow(/unknown/i);
  });

  test("writes nothing at all when one value in the set is bad", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    await expect(
      as(t, "boss").mutation(api.config.save, {
        values: [
          { key: "DUEL_STARTING_HP", value: 400 },
          { key: "MAX_DUEL_ROUNDS", value: 0 },
        ],
      }),
    ).rejects.toThrow();

    // The good value must not have landed: a mutation is a transaction.
    expect((await t.query(api.config.current, {})).config.DUEL_STARTING_HP).toBe(
      DUEL_STARTING_HP,
    );
  });

  /** Storing only differences is what makes an added constant need no migration. */
  test("does not store a value that merely restates the default", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    const result = await as(t, "boss").mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: DUEL_STARTING_HP }],
    });

    expect(result.applied).toBe(0);
    expect((await as(t, "boss").query(api.config.overrides, {})).values).toEqual([]);
  });

  test("nested keys resolve", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    await as(t, "boss").mutation(api.config.save, {
      values: [{ key: "XP_AWARDS.rankedWin", value: 200 }],
    });

    const { config } = await t.query(api.config.current, {});
    expect(config.XP_AWARDS.rankedWin).toBe(200);
    expect(config.XP_AWARDS.rankedLoss).toBe(XP_AWARDS.rankedLoss);
  });
});

describe("history and revert", () => {
  test("history is admin-only", async () => {
    const t = harness();
    await seedUser(t, "player");
    await expect(as(t, "player").query(api.config.history, {})).rejects.toThrow(
      /not an admin/i,
    );
  });

  test("revert restores the earlier values as a new version", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");
    const boss = as(t, "boss");

    const first = await boss.mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: 400 }],
    });
    await boss.mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: 900 }],
    });

    expect((await t.query(api.config.current, {})).config.DUEL_STARTING_HP).toBe(900);

    await boss.mutation(api.config.revert, { versionId: first.versionId });

    expect((await t.query(api.config.current, {})).config.DUEL_STARTING_HP).toBe(400);

    // Append-only: three versions exist, and the newest is the revert rather than the
    // original being repointed at. Matches referencing the old ones stay meaningful.
    const history = await boss.query(api.config.history, {});
    expect(history).toHaveLength(3);
    expect(history[0].isCurrent).toBe(true);
    expect(history[0].versionId).not.toBe(first.versionId);
  });

  test("resetAll puts every value back to the shipped one", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");
    const boss = as(t, "boss");

    await boss.mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: 400 }],
    });
    await boss.mutation(api.config.resetAll, {});

    expect((await t.query(api.config.current, {})).config.DUEL_STARTING_HP).toBe(
      DUEL_STARTING_HP,
    );
  });
});

describe("developer features flag", () => {
  test("defaults to off with no settings row", async () => {
    const t = harness();
    expect((await t.query(api.config.current, {})).devFeaturesEnabled).toBe(false);
    expect(await t.query(api.devbots.enabled, {})).toEqual({ enabled: false });
  });

  test("only an admin may change it", async () => {
    const t = harness();
    await seedUser(t, "player");
    await expect(
      as(t, "player").mutation(api.config.setDevFeatures, { enabled: true }),
    ).rejects.toThrow(/not an admin/i);
  });

  test("an admin can turn it on and off", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    await as(t, "boss").mutation(api.config.setDevFeatures, { enabled: true });
    expect(await t.query(api.devbots.enabled, {})).toEqual({ enabled: true });

    await as(t, "boss").mutation(api.config.setDevFeatures, { enabled: false });
    expect(await t.query(api.devbots.enabled, {})).toEqual({ enabled: false });
  });

  /** The flag and the config share one settings row; neither may clobber the other. */
  test("toggling the flag does not disturb saved config", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");
    const boss = as(t, "boss");

    await boss.mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: 400 }],
    });
    await boss.mutation(api.config.setDevFeatures, { enabled: true });

    const live = await t.query(api.config.current, {});
    expect(live.config.DUEL_STARTING_HP).toBe(400);
    expect(live.devFeaturesEnabled).toBe(true);
  });

  test("saving config does not disturb the flag", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");
    const boss = as(t, "boss");

    await boss.mutation(api.config.setDevFeatures, { enabled: true });
    await boss.mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: 400 }],
    });

    expect((await t.query(api.config.current, {})).devFeaturesEnabled).toBe(true);
  });
});

/**
 * The property the whole design rests on.
 *
 * A duel that is already running must keep the rules it started with. Without this, a save
 * between two rounds would change the score curve, the damage ramp or a phase duration
 * underneath two players who are halfway through the match.
 */
describe("a match keeps the config it started with", () => {
  test("an unstamped match resolves to the shipped defaults", async () => {
    const t = harness();

    const matchId = await t.run(async (ctx) =>
      ctx.db.insert("matches", {
        mode: "daily",
        status: "active",
        playerIds: [],
        trackIds: [],
        bannedCategoryIds: [],
        currentRound: 0,
        createdAt: Date.now(),
      }),
    );

    const resolved = await t.run(async (ctx) => {
      const { resolveConfig } = await import("./config");
      const match = await ctx.db.get(matchId);
      return await resolveConfig(ctx, match?.configVersionId);
    });

    expect(resolved.DUEL_STARTING_HP).toBe(DUEL_STARTING_HP);
  });

  test("a stamped match ignores a config saved after it began", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");
    const boss = as(t, "boss");

    // The rules at kick-off.
    const opening = await boss.mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: 400 }],
    });

    const matchId = await t.run(async (ctx) =>
      ctx.db.insert("matches", {
        mode: "ranked",
        status: "active",
        playerIds: [],
        trackIds: [],
        bannedCategoryIds: [],
        currentRound: 0,
        createdAt: Date.now(),
        configVersionId: opening.versionId,
      }),
    );

    // Somebody retunes mid-duel.
    await boss.mutation(api.config.save, {
      values: [{ key: "DUEL_STARTING_HP", value: 900 }],
    });

    const [live, forTheMatch] = await t.run(async (ctx) => {
      const { resolveConfig } = await import("./config");
      const match = await ctx.db.get(matchId);
      return [await resolveConfig(ctx), await resolveConfig(ctx, match?.configVersionId)];
    });

    expect(live.DUEL_STARTING_HP).toBe(900);
    expect(forTheMatch.DUEL_STARTING_HP).toBe(400);
  });

  test("new matches are stamped with whatever is current", async () => {
    const t = harness();
    await seedUser(t, "boss", "admin");

    const saved = await as(t, "boss").mutation(api.config.save, {
      values: [{ key: "DAILY_SONGS", value: 3 }],
    });

    const stamped = await t.run(async (ctx) => {
      const { currentVersionId } = await import("./config");
      return await currentVersionId(ctx);
    });

    expect(stamped).toBe(saved.versionId);
  });
});
