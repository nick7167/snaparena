import { describe, expect, it } from "vitest";
import { MIN_HUMAN_REACTION_MS, ROUND_DURATION_MS, SCORE_TIERS } from "./config";
import {
  revealBeatAt,
  revealStageAt,
  scoreForGuess,
  shazamMarginReport,
  tierById,
  tierForElapsed,
  validateClientClock,
} from "./scoring";

describe("scoreForGuess", () => {
  it("awards the top tier on the 1-second clip", () => {
    const result = scoreForGuess(1_000);
    expect(result.tier.id).toBe("snap");
    expect(result.points).toBe(100);
  });

  it("steps down a tier at each reveal beat", () => {
    expect(scoreForGuess(6_999).tier.id).toBe("snap");
    expect(scoreForGuess(7_000).tier.id).toBe("quick");
    expect(scoreForGuess(15_000).tier.id).toBe("solid");
    expect(scoreForGuess(23_000).tier.id).toBe("late");
  });

  it("scores identically anywhere inside a tier", () => {
    // The whole point of tiers: 1.1s and 6.9s are the same brag.
    expect(scoreForGuess(1_100).points).toBe(scoreForGuess(6_900).points);
  });

  it("keeps exact elapsed time for tiebreaking even though it doesn't score", () => {
    expect(scoreForGuess(1_100).elapsedMs).toBe(1_100);
    expect(scoreForGuess(6_900).elapsedMs).toBe(6_900);
  });

  it("never increases with time", () => {
    let previous = Infinity;
    for (let t = 0; t < ROUND_DURATION_MS; t += 250) {
      const points = scoreForGuess(t).points;
      expect(points).toBeLessThanOrEqual(previous);
      previous = points;
    }
  });

  it("scores zero once the round is over", () => {
    expect(scoreForGuess(ROUND_DURATION_MS).points).toBe(0);
    expect(scoreForGuess(ROUND_DURATION_MS + 5_000).points).toBe(0);
  });

  it("clamps negative and non-finite input", () => {
    expect(scoreForGuess(-500).points).toBe(100);
    expect(scoreForGuess(Number.NaN).points).toBe(0);
  });
});

describe("shazamMarginReport", () => {
  it("beats the continuous curve it replaced", () => {
    // The old curve let an ~8s external lookup keep 64% of an honest fast guess.
    // Tiers must do better, not worse — this is the whole justification for the
    // steep 100/55/25/10 spread over a gentler one.
    const report = shazamMarginReport(8_000);
    expect(report.cheatRatio).toBeLessThanOrEqual(0.55);
    expect(report.cheatRatio).toBeLessThan(0.64);
  });
});

describe("tier helpers", () => {
  it("resolves a tier without scoring it", () => {
    expect(tierForElapsed(2_000).id).toBe("snap");
    expect(tierForElapsed(20_000).id).toBe("solid");
  });

  it("looks tiers up by id", () => {
    expect(tierById("quick").points).toBe(55);
  });

  it("throws on an unknown tier id", () => {
    // @ts-expect-error deliberately invalid
    expect(() => tierById("nope")).toThrow();
  });

  it("keeps tiers aligned 1:1 with reveal beats", () => {
    // If these ever drift, players would score for audio they never heard.
    expect(SCORE_TIERS).toHaveLength(4);
    expect(revealStageAt(0)).toBe(0);
    expect(revealStageAt(29_999)).toBe(SCORE_TIERS.length - 1);
  });
});

describe("revealStageAt / revealBeatAt", () => {
  it("starts on the 1-second snippet", () => {
    expect(revealStageAt(0)).toBe(0);
    expect(revealBeatAt(0).playToMs).toBe(1_000);
  });

  it("advances at each configured beat", () => {
    expect(revealStageAt(6_999)).toBe(0);
    expect(revealStageAt(7_000)).toBe(1);
    expect(revealBeatAt(7_000).playToMs).toBe(3_000);
    expect(revealStageAt(15_000)).toBe(2);
    expect(revealStageAt(23_000)).toBe(3);
    expect(revealBeatAt(23_000).playToMs).toBe(30_000);
  });
});

describe("validateClientClock", () => {
  const base = { clientElapsedMs: 2_000, serverObservedElapsedMs: 2_150 };

  it("accepts an honest reading", () => {
    expect(validateClientClock(base)).toEqual({ valid: true, elapsedMs: 2_000 });
  });

  it("rejects a time below the human reaction floor", () => {
    expect(
      validateClientClock({
        clientElapsedMs: MIN_HUMAN_REACTION_MS - 1,
        serverObservedElapsedMs: 500,
      }),
    ).toEqual({ valid: false, rejection: "below-human-floor" });
  });

  it("rejects a client claiming more time than the server observed", () => {
    expect(
      validateClientClock({ clientElapsedMs: 9_000, serverObservedElapsedMs: 4_000 }),
    ).toEqual({ valid: false, rejection: "exceeds-server-window" });
  });

  it("tolerates normal network latency", () => {
    expect(
      validateClientClock({ clientElapsedMs: 2_000, serverObservedElapsedMs: 2_400 }).valid,
    ).toBe(true);
  });

  it("rejects non-monotonic sequences within a round", () => {
    expect(validateClientClock({ ...base, previousClientElapsedMs: 2_500 })).toEqual({
      valid: false,
      rejection: "not-monotonic",
    });
  });

  it("accepts a later guess after an earlier wrong one", () => {
    expect(
      validateClientClock({
        clientElapsedMs: 6_000,
        serverObservedElapsedMs: 6_200,
        previousClientElapsedMs: 2_000,
      }).valid,
    ).toBe(true);
  });

  it("rejects a submission arriving after the round ended", () => {
    expect(
      validateClientClock({
        clientElapsedMs: ROUND_DURATION_MS + 10,
        serverObservedElapsedMs: ROUND_DURATION_MS + 200,
      }),
    ).toEqual({ valid: false, rejection: "round-over" });
  });
});
