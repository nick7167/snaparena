import { describe, expect, it } from "vitest";
import {
  ELO_FLOOR,
  ESTABLISHED_AFTER_GAMES,
  K_EARLY,
  K_ESTABLISHED,
  K_PLACEMENT,
  PLACEMENT_MATCHES,
  STARTING_ELO,
} from "./config";
import {
  applyCategoryResults,
  applyMatchResult,
  DRAW,
  expectedScore,
  kFactor,
  LOSS,
  outcomeFromScores,
  WIN,
} from "./elo";

describe("expectedScore", () => {
  it("is 0.5 between equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10);
  });

  it("gives roughly 76% to a 200-point favourite", () => {
    expect(expectedScore(1400, 1200)).toBeCloseTo(0.76, 2);
  });

  it("is symmetric", () => {
    expect(expectedScore(1500, 1300) + expectedScore(1300, 1500)).toBeCloseTo(1, 10);
  });
});

describe("kFactor", () => {
  it("uses the placement K until placements are done", () => {
    expect(kFactor(0)).toBe(K_PLACEMENT);
    expect(kFactor(PLACEMENT_MATCHES - 1)).toBe(K_PLACEMENT);
  });

  it("steps down after placements and again once established", () => {
    expect(kFactor(PLACEMENT_MATCHES)).toBe(K_EARLY);
    expect(kFactor(ESTABLISHED_AFTER_GAMES - 1)).toBe(K_EARLY);
    expect(kFactor(ESTABLISHED_AFTER_GAMES)).toBe(K_ESTABLISHED);
    expect(kFactor(500)).toBe(K_ESTABLISHED);
  });
});

describe("applyMatchResult", () => {
  it("awards half of K for beating an equal opponent", () => {
    const result = applyMatchResult({
      rating: STARTING_ELO,
      opponentRating: STARTING_ELO,
      outcome: WIN,
      gamesPlayed: 50,
    });
    expect(result.delta).toBe(K_ESTABLISHED / 2);
    expect(result.rating).toBe(STARTING_ELO + K_ESTABLISHED / 2);
  });

  it("rewards beating a stronger opponent more than a weaker one", () => {
    const upset = applyMatchResult({
      rating: 1000, opponentRating: 1600, outcome: WIN, gamesPlayed: 50,
    });
    const expected = applyMatchResult({
      rating: 1000, opponentRating: 400, outcome: WIN, gamesPlayed: 50,
    });
    expect(upset.delta).toBeGreaterThan(expected.delta);
  });

  it("punishes losing to a weaker opponent more than to a stronger one", () => {
    const badLoss = applyMatchResult({
      rating: 1600, opponentRating: 1000, outcome: LOSS, gamesPlayed: 50,
    });
    const okLoss = applyMatchResult({
      rating: 1000, opponentRating: 1600, outcome: LOSS, gamesPlayed: 50,
    });
    expect(badLoss.delta).toBeLessThan(okLoss.delta);
  });

  it("moves ratings faster during placements", () => {
    const placement = applyMatchResult({
      rating: STARTING_ELO, opponentRating: STARTING_ELO, outcome: WIN, gamesPlayed: 0,
    });
    const established = applyMatchResult({
      rating: STARTING_ELO, opponentRating: STARTING_ELO, outcome: WIN, gamesPlayed: 50,
    });
    expect(placement.delta).toBeGreaterThan(established.delta);
  });

  it("counts down placements and stops at zero", () => {
    expect(applyMatchResult({
      rating: STARTING_ELO, opponentRating: STARTING_ELO, outcome: WIN, gamesPlayed: 0,
    }).placementsRemaining).toBe(PLACEMENT_MATCHES - 1);

    expect(applyMatchResult({
      rating: STARTING_ELO, opponentRating: STARTING_ELO, outcome: WIN, gamesPlayed: 40,
    }).placementsRemaining).toBe(0);
  });

  it("never drops a rating below the floor", () => {
    const result = applyMatchResult({
      rating: ELO_FLOOR, opponentRating: 2000, outcome: LOSS, gamesPlayed: 50,
    });
    expect(result.rating).toBe(ELO_FLOOR);
  });

  it("reports a delta of zero when the loss was absorbed by the floor", () => {
    // The UI must not show a drop the player did not actually take.
    const result = applyMatchResult({
      rating: ELO_FLOOR, opponentRating: 2000, outcome: LOSS, gamesPlayed: 50,
    });
    expect(result.delta).toBe(0);
  });

  it("is roughly zero-sum between two equal players", () => {
    const winner = applyMatchResult({
      rating: 1200, opponentRating: 1350, outcome: WIN, gamesPlayed: 50,
    });
    const loser = applyMatchResult({
      rating: 1350, opponentRating: 1200, outcome: LOSS, gamesPlayed: 50,
    });
    expect(winner.delta + loser.delta).toBe(0);
  });

  it("treats a draw as no change between equals", () => {
    const result = applyMatchResult({
      rating: 1200, opponentRating: 1200, outcome: DRAW, gamesPlayed: 50,
    });
    expect(result.delta).toBe(0);
  });
});

describe("outcomeFromScores", () => {
  it("maps point totals to an outcome", () => {
    expect(outcomeFromScores(320, 210)).toBe(WIN);
    expect(outcomeFromScores(210, 320)).toBe(LOSS);
    expect(outcomeFromScores(250, 250)).toBe(DRAW);
  });
});

describe("applyCategoryResults", () => {
  const empty = {};

  it("raises a category rating after out-scoring the opponent on it", () => {
    const [update] = applyCategoryResults({
      results: [{ categoryId: "rock", playerPoints: 80, opponentPoints: 20 }],
      currentRatings: empty,
      opponentRatings: empty,
      defaultRating: STARTING_ELO,
    });
    expect(update.categoryId).toBe("rock");
    expect(update.delta).toBeGreaterThan(0);
  });

  it("moves category ratings more slowly than overall Elo", () => {
    const [category] = applyCategoryResults({
      results: [{ categoryId: "rock", playerPoints: 80, opponentPoints: 20 }],
      currentRatings: empty,
      opponentRatings: empty,
      defaultRating: STARTING_ELO,
    });
    const overall = applyMatchResult({
      rating: STARTING_ELO, opponentRating: STARTING_ELO, outcome: WIN, gamesPlayed: 50,
    });
    expect(Math.abs(category.delta)).toBeLessThan(Math.abs(overall.delta));
  });

  it("accumulates several tracks from the same category in one match", () => {
    const [update] = applyCategoryResults({
      results: [
        { categoryId: "pop", playerPoints: 90, opponentPoints: 10 },
        { categoryId: "pop", playerPoints: 70, opponentPoints: 30 },
        { categoryId: "pop", playerPoints: 60, opponentPoints: 55 },
      ],
      currentRatings: empty,
      opponentRatings: empty,
      defaultRating: STARTING_ELO,
    });
    expect(update.games).toBe(3);
    expect(update.delta).toBeGreaterThan(0);
  });

  it("returns one update per distinct category", () => {
    const updates = applyCategoryResults({
      results: [
        { categoryId: "pop", playerPoints: 90, opponentPoints: 10 },
        { categoryId: "rock", playerPoints: 10, opponentPoints: 90 },
      ],
      currentRatings: empty,
      opponentRatings: empty,
      defaultRating: STARTING_ELO,
    });
    expect(updates).toHaveLength(2);
    expect(updates.find((u) => u.categoryId === "pop")!.delta).toBeGreaterThan(0);
    expect(updates.find((u) => u.categoryId === "rock")!.delta).toBeLessThan(0);
  });

  it("treats an equal-points track as a draw", () => {
    const [update] = applyCategoryResults({
      results: [{ categoryId: "pop", playerPoints: 50, opponentPoints: 50 }],
      currentRatings: empty,
      opponentRatings: empty,
      defaultRating: STARTING_ELO,
    });
    expect(update.delta).toBe(0);
  });

  it("respects the rating floor", () => {
    const [update] = applyCategoryResults({
      results: [{ categoryId: "metal", playerPoints: 0, opponentPoints: 100 }],
      currentRatings: { metal: { rating: ELO_FLOOR, games: 10 } },
      opponentRatings: { metal: { rating: 2000, games: 10 } },
      defaultRating: STARTING_ELO,
    });
    expect(update.rating).toBeGreaterThanOrEqual(ELO_FLOOR);
  });
});
