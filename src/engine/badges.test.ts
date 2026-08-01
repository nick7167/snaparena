import { describe, expect, it } from "vitest";
import { BADGES, badgeById, evaluateBadges, sortBadges, type BadgeContext } from "./badges";

const context = (overrides: Partial<BadgeContext> = {}): BadgeContext => ({
  mode: "ranked",
  won: true,
  totalRankedWins: 1,
  totalRankedMatches: 1,
  totalSnapGuesses: 0,
  hadPerfectSet: false,
  wonAfterLosingFirstSet: false,
  wonSuddenDeath: false,
  opponentEloAdvantage: 0,
  ...overrides,
});

describe("badge catalogue", () => {
  it("has unique ids", () => {
    const ids = BADGES.map((badge) => badge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("looks badges up by id", () => {
    expect(badgeById("comeback")?.name).toBe("Comeback King");
    expect(badgeById("nope")).toBeUndefined();
  });
});

describe("sortBadges", () => {
  it("orders by sortOrder regardless of input order", () => {
    expect(sortBadges(["centurion", "snap_10", "first_blood"]).map((b) => b.id)).toEqual([
      "first_blood",
      "snap_10",
      "centurion",
    ]);
  });

  it("drops unknown ids rather than rendering blanks", () => {
    expect(sortBadges(["snap_10", "removed_badge"]).map((b) => b.id)).toEqual(["snap_10"]);
  });
});

describe("evaluateBadges", () => {
  it("awards first blood on a first ranked win", () => {
    expect(evaluateBadges(context())).toContain("first_blood");
  });

  it("awards nothing rank-related for a loss", () => {
    const earned = evaluateBadges(context({ won: false }));
    expect(earned).not.toContain("first_blood");
    expect(earned).not.toContain("comeback");
  });

  it("awards snap milestones at their thresholds", () => {
    expect(evaluateBadges(context({ totalSnapGuesses: 9 }))).not.toContain("snap_10");
    expect(evaluateBadges(context({ totalSnapGuesses: 10 }))).toContain("snap_10");
    expect(evaluateBadges(context({ totalSnapGuesses: 100 }))).toContain("snap_100");
  });

  it("awards both snap tiers once the higher one is reached", () => {
    const earned = evaluateBadges(context({ totalSnapGuesses: 150 }));
    expect(earned).toContain("snap_10");
    expect(earned).toContain("snap_100");
  });

  it("awards the comeback only when the match was actually won", () => {
    expect(
      evaluateBadges(context({ wonAfterLosingFirstSet: true, won: true })),
    ).toContain("comeback");
    expect(
      evaluateBadges(context({ wonAfterLosingFirstSet: true, won: false })),
    ).not.toContain("comeback");
  });

  it("awards giant slayer only above the rating gap", () => {
    expect(evaluateBadges(context({ opponentEloAdvantage: 199 }))).not.toContain("giant_slayer");
    expect(evaluateBadges(context({ opponentEloAdvantage: 200 }))).toContain("giant_slayer");
  });

  it("does not award ranked-only badges in casual rooms", () => {
    const earned = evaluateBadges(
      context({ mode: "room", opponentEloAdvantage: 400, totalRankedMatches: 500 }),
    );
    expect(earned).not.toContain("giant_slayer");
    expect(earned).not.toContain("centurion");
    expect(earned).not.toContain("first_blood");
  });

  it("still awards mode-agnostic badges in rooms", () => {
    expect(evaluateBadges(context({ mode: "room", hadPerfectSet: true }))).toContain(
      "perfect_set",
    );
  });

  it("returns only ids that exist in the catalogue", () => {
    const earned = evaluateBadges(
      context({
        totalSnapGuesses: 500,
        hadPerfectSet: true,
        wonAfterLosingFirstSet: true,
        wonSuddenDeath: true,
        opponentEloAdvantage: 300,
        totalRankedMatches: 200,
      }),
    );
    for (const id of earned) expect(badgeById(id)).toBeDefined();
  });
});
