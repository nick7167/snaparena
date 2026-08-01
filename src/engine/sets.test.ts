import { describe, expect, it } from "vitest";
import { MAX_SETS, ROOM_SETS, SONGS_PER_SET } from "./config";
import {
  isLastRoundOfSet,
  resolveRankedMatch,
  resolveRoomMatch,
  resolveSet,
  setIndexForRound,
  songsNeededFor,
  type SetPlayerResult,
} from "./sets";

const player = (userId: string, points: number, totalElapsedMs: number): SetPlayerResult => ({
  userId,
  points,
  totalElapsedMs,
});

describe("resolveSet", () => {
  it("awards the set to the highest score", () => {
    const outcome = resolveSet([player("a", 155, 9_000), player("b", 80, 6_000)]);
    expect(outcome.winnerId).toBe("a");
    expect(outcome.decidedOnTime).toBe(false);
  });

  it("breaks a points tie on total reaction time", () => {
    // Tier scoring produces exact ties far more often than the old continuous
    // curve did, so this path is load-bearing rather than a formality.
    const outcome = resolveSet([player("a", 100, 9_000), player("b", 100, 4_500)]);
    expect(outcome.winnerId).toBe("b");
    expect(outcome.decidedOnTime).toBe(true);
  });

  it("returns no winner when points and time both tie", () => {
    const outcome = resolveSet([player("a", 100, 5_000), player("b", 100, 5_000)]);
    expect(outcome.winnerId).toBeUndefined();
  });

  it("draws the set when nobody scored", () => {
    // Otherwise the set would be handed to whoever idled with the lower clock.
    const outcome = resolveSet([player("a", 0, 90_000), player("b", 0, 90_000)]);
    expect(outcome.winnerId).toBeUndefined();
  });

  it("ranks all players best-first", () => {
    const outcome = resolveSet([
      player("c", 20, 9_000),
      player("a", 155, 8_000),
      player("b", 80, 7_000),
    ]);
    expect(outcome.standings.map((entry) => entry.userId)).toEqual(["a", "b", "c"]);
  });

  it("handles a single player", () => {
    expect(resolveSet([player("a", 55, 3_000)]).winnerId).toBe("a");
  });

  it("handles an empty set", () => {
    expect(resolveSet([]).winnerId).toBeUndefined();
  });
});

describe("resolveRankedMatch", () => {
  it("ends the match as soon as someone takes two sets", () => {
    // 2-0 must not play a dead third set.
    expect(resolveRankedMatch({ setsWon: { a: 2, b: 0 }, setsPlayed: 2 })).toEqual({
      kind: "complete",
      winnerId: "a",
    });
  });

  it("continues while the match is live", () => {
    expect(resolveRankedMatch({ setsWon: { a: 1, b: 0 }, setsPlayed: 1 })).toEqual({
      kind: "continue",
      nextSetIndex: 1,
    });
  });

  it("continues to a decider at one set each", () => {
    expect(resolveRankedMatch({ setsWon: { a: 1, b: 1 }, setsPlayed: 2 })).toEqual({
      kind: "continue",
      nextSetIndex: 2,
    });
  });

  it("goes to sudden death when all sets are played and nobody leads", () => {
    // Reachable via drawn sets: 1-1 with the decider drawn.
    expect(
      resolveRankedMatch({ setsWon: { a: 1, b: 1 }, setsPlayed: MAX_SETS }),
    ).toEqual({ kind: "sudden-death" });
  });

  it("awards the match on set count when the distance is run without a 2-set win", () => {
    expect(
      resolveRankedMatch({ setsWon: { a: 1, b: 0 }, setsPlayed: MAX_SETS }),
    ).toEqual({ kind: "complete", winnerId: "a" });
  });

  it("goes to sudden death when every set was drawn", () => {
    expect(resolveRankedMatch({ setsWon: {}, setsPlayed: MAX_SETS })).toEqual({
      kind: "sudden-death",
    });
  });
});

describe("resolveRoomMatch", () => {
  it("ranks by sets won", () => {
    const result = resolveRoomMatch({
      setsWon: { a: 2, b: 1, c: 0 },
      totalPoints: { a: 300, b: 400, c: 100 },
    });
    // Sets outrank raw points, so b's higher total does not overtake a.
    expect(result.winnerId).toBe("a");
    expect(result.standings).toEqual(["a", "b", "c"]);
  });

  it("breaks a set tie on total points", () => {
    const result = resolveRoomMatch({
      setsWon: { a: 1, b: 1 },
      totalPoints: { a: 200, b: 350 },
    });
    expect(result.winnerId).toBe("b");
  });

  it("returns no winner when sets and points both tie", () => {
    const result = resolveRoomMatch({
      setsWon: { a: 1, b: 1 },
      totalPoints: { a: 200, b: 200 },
    });
    expect(result.winnerId).toBeUndefined();
  });

  it("includes players who won no sets at all", () => {
    const result = resolveRoomMatch({ setsWon: { a: 3 }, totalPoints: { a: 300, b: 50 } });
    expect(result.standings).toContain("b");
  });
});

describe("round/set indexing", () => {
  it("maps rounds onto sets", () => {
    expect(setIndexForRound(0)).toBe(0);
    expect(setIndexForRound(SONGS_PER_SET - 1)).toBe(0);
    expect(setIndexForRound(SONGS_PER_SET)).toBe(1);
    expect(setIndexForRound(SONGS_PER_SET * 2)).toBe(2);
  });

  it("identifies the closing round of each set", () => {
    expect(isLastRoundOfSet(0)).toBe(false);
    expect(isLastRoundOfSet(SONGS_PER_SET - 1)).toBe(true);
    expect(isLastRoundOfSet(SONGS_PER_SET)).toBe(false);
    expect(isLastRoundOfSet(SONGS_PER_SET * 2 - 1)).toBe(true);
  });
});

describe("songsNeededFor", () => {
  it("reserves the full distance for ranked even though it can end early", () => {
    expect(songsNeededFor("ranked", 5)).toBe(MAX_SETS * SONGS_PER_SET);
  });

  it("reserves every room set", () => {
    expect(songsNeededFor("room", 5)).toBe(ROOM_SETS * SONGS_PER_SET);
  });

  it("leaves the daily as a flat run", () => {
    expect(songsNeededFor("daily", 5)).toBe(5);
  });
});
