import { describe, expect, it } from "vitest";
import { XP_AWARDS } from "./config";
import { awardMatchXp, levelForXp, xpForLevel } from "./xp";

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
    setsWon: 2,
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
    const loss = awardMatchXp({ ...base, won: false, setsWon: 0 });
    expect(win.total).toBeGreaterThan(loss.total);
  });

  it("still pays for a loss", () => {
    // Paying nothing for a loss would push losing players to quit mid-match —
    // exactly the behaviour the disconnect-forfeit rule exists to discourage.
    const loss = awardMatchXp({
      mode: "ranked",
      won: false,
      setsWon: 0,
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
      setsWon: 0,
      correctGuesses: 5,
      snapGuesses: 0,
    });
    expect(daily.breakdown[0]).toEqual({
      reason: "Daily challenge",
      amount: XP_AWARDS.dailyComplete,
    });
  });

  it("omits zero-value lines from the breakdown", () => {
    const award = awardMatchXp({ ...base, setsWon: 0, snapGuesses: 0 });
    expect(award.breakdown.every((entry) => entry.amount > 0)).toBe(true);
  });
});
