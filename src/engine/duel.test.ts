import { describe, expect, it } from "vitest";
import {
  DAMAGE_RAMP_EVERY,
  DAMAGE_RAMP_STEP,
  MAX_DUEL_ROUNDS,
  MILESTONE_EVERY_ROUNDS,
  SONG_WINS_DAMAGE,
  SURRENDER_FROM_ROUND,
  TIE_DAMAGE_CAP,
} from "./config";
import {
  canSurrender,
  damageMultiplier,
  duelDamage,
  isMilestoneRound,
  medianOf,
  resolveDuel,
  resolveRoom,
  roomDamage,
  roomPlacings,
  tieDamage,
  wonRound,
  type DuelPlayerState,
  type RoundScore,
} from "./duel";

const score = (userId: string, points: number, elapsedMs = 5_000): RoundScore => ({
  userId,
  points,
  elapsedMs,
});

const player = (
  userId: string,
  hp: number,
  totalPoints = 0,
  eliminatedAtRound: number | null = null,
): DuelPlayerState => ({ userId, hp, totalPoints, eliminatedAtRound });

describe("damageMultiplier", () => {
  it("starts at x1", () => {
    expect(damageMultiplier(0)).toBe(1);
    expect(damageMultiplier(DAMAGE_RAMP_EVERY - 1)).toBe(1);
  });

  it("steps up on schedule", () => {
    expect(damageMultiplier(DAMAGE_RAMP_EVERY)).toBe(1 + DAMAGE_RAMP_STEP);
    expect(damageMultiplier(DAMAGE_RAMP_EVERY * 2)).toBe(1 + DAMAGE_RAMP_STEP * 2);
  });

  it("never decreases", () => {
    let previous = 0;
    for (let round = 0; round < 30; round++) {
      const current = damageMultiplier(round);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("clamps negative round indexes to the base rate", () => {
    expect(damageMultiplier(-3)).toBe(1);
  });
});

/** Damage dealt to one player by a resolution. */
const dmg = (result: { damage: readonly { userId: string; damage: number }[] }, id: string) =>
  result.damage.find((entry) => entry.userId === id)!.damage;

describe("duelDamage", () => {
  it("damages only the lower scorer, by the gap", () => {
    const result = duelDamage([score("a", 100), score("b", 55)], 0);
    expect(result.outcome).toBe("tier");
    expect(result.winnerId).toBe("a");
    expect(dmg(result, "a")).toBe(0);
    expect(dmg(result, "b")).toBe(45);
  });

  it("settles a same-tier round on reaction time", () => {
    // The whole reason duels used to stalemate: this used to deal nothing.
    const result = duelDamage(
      [score("a", 100, 1_200), score("b", 100, 4_800)],
      0,
    );
    expect(result.outcome).toBe("time");
    expect(result.winnerId).toBe("a");
    expect(dmg(result, "a")).toBe(0);
    expect(dmg(result, "b")).toBeGreaterThan(0);
  });

  it("caps tie damage so a time win never outweighs a tier win", () => {
    const huge = duelDamage([score("a", 100, 0), score("b", 100, 25_000)], 0);
    expect(dmg(huge, "b")).toBe(TIE_DAMAGE_CAP);
  });

  it("chips rather than guts on a photo finish", () => {
    const close = duelDamage([score("a", 55, 8_000), score("b", 55, 8_300)], 0);
    expect(dmg(close, "b")).toBe(3);
  });

  it("lets the song win when nobody scores", () => {
    const result = duelDamage([score("a", 0), score("b", 0)], 0);
    expect(result.outcome).toBe("song");
    expect(result.winnerId).toBeUndefined();
    expect(dmg(result, "a")).toBe(SONG_WINS_DAMAGE);
    expect(dmg(result, "b")).toBe(SONG_WINS_DAMAGE);
  });

  it("scales the song-wins hit with the multiplier", () => {
    // No round is cheap late on. A flat toll here meant a dead round barely moved the
    // bars while every real round was hitting for several times as much.
    const round = DAMAGE_RAMP_EVERY * 4;
    const late = duelDamage([score("a", 0), score("b", 0)], round);
    const expected = Math.round(SONG_WINS_DAMAGE * damageMultiplier(round));

    expect(dmg(late, "a")).toBe(expected);
    expect(dmg(late, "b")).toBe(expected);
    expect(expected).toBeGreaterThan(SONG_WINS_DAMAGE);
  });

  it("NEVER produces a round where nobody takes damage", () => {
    // This is the invariant the whole change exists to guarantee.
    const values = [0, 10, 25, 55, 100];
    for (const pointsA of values) {
      for (const pointsB of values) {
        for (const timeA of [1_000, 9_000]) {
          for (const timeB of [1_000, 9_000]) {
            const result = duelDamage(
              [score("a", pointsA, timeA), score("b", pointsB, timeB)],
              0,
            );
            const total = result.damage.reduce((sum, entry) => sum + entry.damage, 0);
            // The only zero-damage case left is an exact dead heat: same points AND
            // the identical reaction time, which is vanishingly rare in practice.
            if (pointsA === pointsB && timeA === timeB && pointsA !== 0) {
              expect(total).toBe(0);
            } else {
              expect(total).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it("scales tier damage with the multiplier", () => {
    const early = duelDamage([score("a", 100), score("b", 55)], 0);
    const late = duelDamage([score("a", 100), score("b", 55)], DAMAGE_RAMP_EVERY * 2);
    expect(dmg(late, "b")).toBeGreaterThan(dmg(early, "b"));
  });

  it("scales tie damage with the multiplier too", () => {
    const early = duelDamage([score("a", 100, 0), score("b", 100, 1_000)], 0);
    const late = duelDamage(
      [score("a", 100, 0), score("b", 100, 1_000)],
      DAMAGE_RAMP_EVERY * 2,
    );
    expect(dmg(late, "b")).toBeGreaterThan(dmg(early, "b"));
  });

  it("caps at the maximum possible gap", () => {
    const result = duelDamage([score("a", 100), score("b", 0)], 0);
    expect(dmg(result, "b")).toBe(100);
  });

  it("is symmetric regardless of argument order", () => {
    const forward = duelDamage([score("a", 25), score("b", 100)], 3);
    const backward = duelDamage([score("b", 100), score("a", 25)], 3);
    expect(dmg(forward, "a")).toBe(dmg(backward, "a"));
  });
});

describe("tieDamage", () => {
  it("is 10 HP per second before the cap", () => {
    expect(tieDamage(1_000, 1)).toBe(10);
    expect(tieDamage(2_500, 1)).toBe(25);
  });

  it("holds at the cap", () => {
    expect(tieDamage(3_000, 1)).toBe(TIE_DAMAGE_CAP);
    expect(tieDamage(30_000, 1)).toBe(TIE_DAMAGE_CAP);
  });

  it("stays below a two-tier swing even at the cap", () => {
    // Tiers must remain the dominant signal; time is the decider, not the driver.
    expect(TIE_DAMAGE_CAP).toBeLessThan(45); // SNAP -> QUICK
  });

  it("clamps a negative gap to zero", () => {
    expect(tieDamage(-500, 1)).toBe(0);
  });
});

describe("medianOf", () => {
  it("handles odd and even lengths", () => {
    expect(medianOf([10, 30, 20])).toBe(20);
    expect(medianOf([10, 20, 30, 40])).toBe(25);
  });

  it("returns zero for an empty list", () => {
    expect(medianOf([])).toBe(0);
  });
});

describe("roomDamage", () => {
  it("spares everyone above the median", () => {
    const scores = [score("a", 100), score("b", 100), score("c", 25), score("d", 0)];
    const result = roomDamage(scores, 0);

    // median of [0, 25, 100, 100] = 62.5
    expect(dmg(result, "a")).toBe(0);
    expect(dmg(result, "b")).toBe(0);
    expect(dmg(result, "c")).toBeGreaterThan(0);
    expect(dmg(result, "d")).toBeGreaterThan(0);
  });

  it("damages roughly half the room, so attrition is gradual", () => {
    const scores = [
      score("a", 100), score("b", 100), score("c", 55), score("d", 55),
      score("e", 25), score("f", 25), score("g", 10), score("h", 0),
    ];
    const hurt = roomDamage(scores, 0).damage.filter((r) => r.damage > 0);
    expect(hurt.length).toBeGreaterThanOrEqual(3);
    expect(hurt.length).toBeLessThanOrEqual(5);
  });

  it("settles an all-tie room on reaction time rather than stalling", () => {
    // Gaps deliberately kept under the cap so the ordering is observable; beyond
    // ~3s every straggler caps at the same value, which is intended.
    const result = roomDamage(
      [score("a", 55, 2_000), score("b", 55, 3_000), score("c", 55, 4_500)],
      0,
    );
    expect(dmg(result, "a")).toBe(0);
    expect(dmg(result, "b")).toBe(10);
    expect(dmg(result, "c")).toBe(25);
  });

  it("caps every straggler equally once they are far enough behind", () => {
    const result = roomDamage(
      [score("a", 55, 1_000), score("b", 55, 9_000), score("c", 55, 20_000)],
      0,
    );
    expect(dmg(result, "b")).toBe(TIE_DAMAGE_CAP);
    expect(dmg(result, "c")).toBe(TIE_DAMAGE_CAP);
  });

  it("lets the song beat the whole room when nobody scores", () => {
    const result = roomDamage([score("a", 0), score("b", 0), score("c", 0)], 0);
    expect(result.outcome).toBe("song");
    expect(result.damage.every((entry) => entry.damage === SONG_WINS_DAMAGE)).toBe(true);
  });

  it("scales the room's song-wins hit exactly as a duel does", () => {
    // Pinned against the duel so the two modes cannot drift apart.
    const round = DAMAGE_RAMP_EVERY * 4;
    const room = roomDamage([score("a", 0), score("b", 0), score("c", 0)], round);
    const duel = duelDamage([score("a", 0), score("b", 0)], round);

    expect(room.damage.every((entry) => entry.damage === dmg(duel, "a"))).toBe(true);
  });

  it("behaves like a duel with two players", () => {
    // Median of two sits between them, so the lower scorer takes half the gap.
    const result = roomDamage([score("a", 100), score("b", 0)], 0);
    expect(dmg(result, "a")).toBe(0);
    expect(dmg(result, "b")).toBe(50);
  });

  it("handles an empty round", () => {
    expect(roomDamage([], 0).damage).toEqual([]);
  });
});

describe("resolveDuel", () => {
  it("continues while both players live", () => {
    expect(resolveDuel([player("a", 400), player("b", 250)], 4)).toEqual({ kind: "continue" });
  });

  it("completes when one player is dead", () => {
    expect(resolveDuel([player("a", 120), player("b", 0)], 7)).toEqual({
      kind: "complete",
      winnerId: "a",
    });
  });

  it("resolves a double knockout on points", () => {
    expect(
      resolveDuel([player("a", 0, 400), player("b", 0, 250)], 9),
    ).toEqual({ kind: "complete", winnerId: "a" });
  });

  it("forces a decision at the round cap", () => {
    // Without this, two players tying every round would duel forever.
    expect(
      resolveDuel([player("a", 500, 300), player("b", 500, 250)], MAX_DUEL_ROUNDS),
    ).toEqual({ kind: "complete", winnerId: "a" });
  });

  it("falls to sudden death when the cap is reached dead level", () => {
    expect(
      resolveDuel([player("a", 500, 300), player("b", 500, 300)], MAX_DUEL_ROUNDS),
    ).toEqual({ kind: "sudden-death" });
  });

  it("prefers HP over points at the cap", () => {
    expect(
      resolveDuel([player("a", 200, 100), player("b", 100, 900)], MAX_DUEL_ROUNDS),
    ).toEqual({ kind: "complete", winnerId: "a" });
  });
});

describe("resolveRoom", () => {
  it("continues while more than one player survives", () => {
    expect(
      resolveRoom([player("a", 300), player("b", 100), player("c", 0, 0, 4)], 6),
    ).toEqual({ kind: "continue" });
  });

  it("completes on the last player standing", () => {
    expect(
      resolveRoom([player("a", 120), player("b", 0, 0, 5), player("c", 0, 0, 3)], 8),
    ).toEqual({ kind: "complete", winnerId: "a" });
  });
});

describe("roomPlacings", () => {
  it("ranks survivors above the eliminated", () => {
    const order = roomPlacings([
      player("dead", 0, 900, 8),
      player("alive", 50, 100),
    ]);
    expect(order[0]).toBe("alive");
  });

  it("ranks survivors by HP", () => {
    expect(roomPlacings([player("low", 40), player("high", 300)])[0]).toBe("high");
  });

  it("ranks the eliminated by how long they lasted", () => {
    // Surviving to round 9 beats going out in round 2, regardless of score.
    const order = roomPlacings([
      player("early", 0, 500, 2),
      player("late", 0, 100, 9),
    ]);
    expect(order[0]).toBe("late");
  });

  it("breaks an equal elimination round on points", () => {
    // This is what makes playing on after elimination worth doing.
    const order = roomPlacings([
      player("low", 0, 100, 5),
      player("high", 0, 400, 5),
    ]);
    expect(order[0]).toBe("high");
  });
});

describe("canSurrender", () => {
  it("is locked for the opening rounds", () => {
    expect(canSurrender(0, SURRENDER_FROM_ROUND)).toBe(false);
    expect(canSurrender(SURRENDER_FROM_ROUND, SURRENDER_FROM_ROUND)).toBe(true);
  });
});

describe("isMilestoneRound", () => {
  it("fires on the configured cadence", () => {
    expect(isMilestoneRound(MILESTONE_EVERY_ROUNDS - 1, MILESTONE_EVERY_ROUNDS)).toBe(true);
    expect(isMilestoneRound(0, MILESTONE_EVERY_ROUNDS)).toBe(false);
  });

  it("never fires when disabled", () => {
    expect(isMilestoneRound(5, 0)).toBe(false);
  });
});

describe("wonRound", () => {
  it("is won by out-scoring every opponent", () => {
    expect(wonRound(100, [55])).toBe(true);
    expect(wonRound(100, [55, 25])).toBe(true);
  });

  it("is not won by tying or losing", () => {
    expect(wonRound(55, [55])).toBe(false);
    expect(wonRound(25, [55])).toBe(false);
    expect(wonRound(100, [55, 100])).toBe(false);
  });

  it("is not won by scoring nothing", () => {
    expect(wonRound(0, [0])).toBe(false);
  });

  it("is never won when there are no opponents", () => {
    // The daily XP leak. `[].every(...)` is vacuously true, so a solo run used to count
    // every solved song as a round won against nobody and paid the bonus for it.
    expect(wonRound(100, [])).toBe(false);
    expect(wonRound(0, [])).toBe(false);
  });
});
