import { describe, expect, it } from "vitest";
import { PRACTICE_XP_MULTIPLIER, XP_AWARDS } from "./config";
import {
  awardMatchXp as awardMatchXpWith,
  levelForXp as levelForXpWith,
  xpForLevel as xpForLevelWith,
} from "./xp";
import { mergeConfig } from "./config-merge";

/**
 * These tests exercise the SHIPPED defaults.
 *
 * Each engine function now takes its config as a parameter, so rather than threading it
 * through every call the module-level bindings below curry it in once. The tests then read
 * as tests of behaviour rather than of plumbing, and a test that wants different values
 * can still call the underlying function directly with its own config.
 */
const config = mergeConfig();

const xpForLevel = (level: number) => xpForLevelWith(level, config);
const levelForXp = (totalXp: number) => levelForXpWith(totalXp, config);
const awardMatchXp = (params: Parameters<typeof awardMatchXpWith>[0]) =>
  awardMatchXpWith(params, config);


describe("xpForLevel", () => {
  it("starts level 1 at zero", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(0)).toBe(0);
  });

  it("increases monotonically", () => {
    let previous = -1;
    for (let level = 1; level <= 100; level++) {
      const required = xpForLevel(level);
      expect(required).toBeGreaterThan(previous);
      previous = required;
    }
  });

  it("costs more per level as you climb", () => {
    const early = xpForLevel(6) - xpForLevel(5);
    const late = xpForLevel(51) - xpForLevel(50);
    expect(late).toBeGreaterThan(early);
  });
});

describe("levelForXp", () => {
  it("round-trips against the curve", () => {
    // Guards the two directions against drifting apart.
    for (let level = 1; level <= 60; level++) {
      expect(levelForXp(xpForLevel(level)).level).toBe(level);
    }
  });

  it("stays on the current level one XP short of the next", () => {
    for (let level = 2; level <= 40; level++) {
      expect(levelForXp(xpForLevel(level) - 1).level).toBe(level - 1);
    }
  });

  it("reports progress within the level", () => {
    const atFloor = levelForXp(xpForLevel(5));
    expect(atFloor.level).toBe(5);
    expect(atFloor.xpIntoLevel).toBe(0);
    expect(atFloor.progress).toBe(0);

    const midway = levelForXp(xpForLevel(5) + Math.floor((xpForLevel(6) - xpForLevel(5)) / 2));
    expect(midway.progress).toBeGreaterThan(0.4);
    expect(midway.progress).toBeLessThan(0.6);
  });

  it("clamps junk input to level 1", () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(-500).level).toBe(1);
  });
});

describe("awardMatchXp", () => {
  const base = {
    mode: "ranked" as const,
    won: true,
    roundsWon: 2,
    correctGuesses: 5,
    snapGuesses: 2,
  };

  it("sums its own breakdown", () => {
    const award = awardMatchXp(base);
    const summed = award.breakdown.reduce((total, entry) => total + entry.amount, 0);
    expect(award.total).toBe(summed);
  });

  it("pays more for a win than a loss", () => {
    const win = awardMatchXp(base);
    const loss = awardMatchXp({ ...base, won: false, roundsWon: 0 });
    expect(win.total).toBeGreaterThan(loss.total);
  });

  it("still pays for a loss", () => {
    // Paying nothing for a loss would push losing players to quit mid-match —
    // exactly the behaviour the disconnect-forfeit rule exists to discourage.
    const loss = awardMatchXp({
      mode: "ranked",
      won: false,
      roundsWon: 0,
      correctGuesses: 0,
      snapGuesses: 0,
    });
    expect(loss.total).toBeGreaterThan(0);
  });

  it("rewards snap calls on top of correct guesses", () => {
    const withSnaps = awardMatchXp({ ...base, snapGuesses: 5 });
    const withoutSnaps = awardMatchXp({ ...base, snapGuesses: 0 });
    expect(withSnaps.total - withoutSnaps.total).toBe(5 * XP_AWARDS.snapBonus);
  });

  it("gives ranked-only bonuses to ranked only", () => {
    const room = awardMatchXp({ ...base, mode: "room" });
    expect(room.breakdown.some((entry) => entry.reason === "Victory")).toBe(false);
  });

  it("pays the daily its own flat award", () => {
    const daily = awardMatchXp({
      mode: "daily",
      won: false,
      roundsWon: 0,
      correctGuesses: 5,
      snapGuesses: 0,
    });
    expect(daily.breakdown[0]).toEqual({
      reason: "Daily challenge",
      amount: XP_AWARDS.dailyComplete,
    });
  });

  it("omits zero-value lines from the breakdown", () => {
    const award = awardMatchXp({ ...base, roundsWon: 0, snapGuesses: 0 });
    expect(award.breakdown.every((entry) => entry.amount > 0)).toBe(true);
  });
});

describe("awardMatchXp — practice discount", () => {
  const base = {
    won: true,
    roundsWon: 3,
    correctGuesses: 6,
    snapGuesses: 2,
  };

  it("pays practice roughly half of the equivalent ranked match", () => {
    // The defect this guards: practice used to out-earn a ranked LOSS while being
    // instant, unlimited, risk-free and against software — so farming bots was the
    // fastest way to level and nothing rewarded queueing for a human.
    const practice = awardMatchXp({ ...base, mode: "practice" });
    const ranked = awardMatchXp({ ...base, mode: "ranked" });

    expect(practice.total).toBeLessThan(ranked.total * PRACTICE_XP_MULTIPLIER + 10);
    expect(practice.total).toBeGreaterThan(0);
  });

  it("never lets practice out-earn a ranked loss", () => {
    const practice = awardMatchXp({ ...base, mode: "practice" });
    const rankedLoss = awardMatchXp({ ...base, mode: "ranked", won: false });
    expect(practice.total).toBeLessThan(rankedLoss.total);
  });

  it("still sums its own breakdown once discounted", () => {
    // Scaling the total without scaling the lines would print an itemised list that
    // visibly disagrees with the number beside it.
    const award = awardMatchXp({ ...base, mode: "practice" });
    const summed = award.breakdown.reduce((total, entry) => total + entry.amount, 0);
    expect(award.total).toBe(summed);
  });

  it("leaves every other mode at full rate", () => {
    for (const mode of ["ranked", "daily", "room"] as const) {
      const award = awardMatchXp({ ...base, mode });
      const summed = award.breakdown.reduce((total, entry) => total + entry.amount, 0);
      expect(award.total).toBe(summed);
    }
    expect(awardMatchXp({ ...base, mode: "room" }).total).toBeGreaterThan(
      awardMatchXp({ ...base, mode: "practice" }).total,
    );
  });
});
