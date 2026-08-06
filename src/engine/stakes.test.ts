import { describe, expect, it } from "vitest";
import {
  ESTABLISHED_AFTER_GAMES,
  K_EARLY,
  K_ESTABLISHED,
  K_PLACEMENT,
  PLACEMENT_MATCHES,
  RANK_TIERS,
} from "./config";
import { rankForElo } from "./ranks";
import { openingRange, stakesFor as stakesForWith } from "./stakes";
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

const stakesFor = (input: Parameters<typeof stakesForWith>[0]) => stakesForWith(input, config);


/** An established player: past placements, past the K drop. */
function established(elo: number, extra: Partial<Parameters<typeof stakesFor>[0]> = {}) {
  return stakesFor({
    elo,
    gamesPlayed: ESTABLISHED_AFTER_GAMES + 10,
    placementsRemaining: 0,
    ...extra,
  });
}

describe("swing figures", () => {
  it("uses the K-factor the rating system will actually apply", () => {
    expect(stakesFor({ elo: 1_000, gamesPlayed: 0, placementsRemaining: 5 }).k).toBe(
      K_PLACEMENT,
    );
    expect(
      stakesFor({ elo: 1_000, gamesPlayed: PLACEMENT_MATCHES, placementsRemaining: 0 }).k,
    ).toBe(K_EARLY);
    expect(established(1_000).k).toBe(K_ESTABLISHED);
  });

  it("puts an even pairing at half the K-factor", () => {
    // outcome 1, expected 0.5 -> delta = k/2. This is the match the queue is trying to
    // make, so it is the figure the screen leads with.
    expect(established(1_000).evenSwing).toBe(K_ESTABLISHED / 2);
  });

  it("never lets reach exceed the K-factor", () => {
    // |delta| = k * |outcome - expected| and expected is strictly between 0 and 1, so k
    // is the hard ceiling on any single match regardless of who turns up.
    for (const gamesPlayed of [0, 3, 10, 29, 30, 200]) {
      const stakes = stakesFor({ elo: 1_000, gamesPlayed, placementsRemaining: 0 });
      expect(stakes.reach).toBeLessThanOrEqual(stakes.k);
      expect(stakes.reach).toBeGreaterThan(stakes.evenSwing);
    }
  });
});

describe("placements", () => {
  it("has no headline and nothing at risk", () => {
    // No rank to promote, no position to pass, nothing below to fall into.
    const stakes = stakesFor({ elo: 1_000, gamesPlayed: 2, placementsRemaining: 3 });
    expect(stakes.headline).toBeNull();
    expect(stakes.atRisk).toBeNull();
  });

  it("still reports a swing, because the rating is moving fastest here", () => {
    const stakes = stakesFor({ elo: 1_000, gamesPlayed: 2, placementsRemaining: 3 });
    expect(stakes.evenSwing).toBe(K_PLACEMENT / 2);
  });
});

describe("promotion headlines", () => {
  it("calls a tier boundary a tier promotion", () => {
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    // One point below Gold: the next division is in another tier entirely.
    const stakes = established(gold.minElo - 1);
    expect(stakes.headline).toMatchObject({ kind: "tier-promotion", label: "Gold I" });
  });

  it("calls a division boundary a division promotion", () => {
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    const rank = rankForElo(gold.minElo);
    const stakes = established(rank.nextAt! - 1);
    expect(stakes.headline).toMatchObject({ kind: "division-promotion", label: "Gold II" });
  });

  it("never claims a promotion a single win cannot reach", () => {
    // The claim is the whole point of `reach`. If this ever fires on a gap wider than one
    // win can close, the card is lying at the exact moment a player is deciding to queue.
    for (let elo = 0; elo <= 2_000; elo += 3) {
      const stakes = established(elo);
      const kind = stakes.headline?.kind;
      if (kind !== "tier-promotion" && kind !== "division-promotion") continue;
      expect(stakes.rank.nextAt! - elo).toBeLessThanOrEqual(stakes.reach);
    }
  });

  it("prefers the promotion over the rival when both are in reach", () => {
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    const stakes = established(gold.minElo - 1, { rivalGap: 1, rivalHandle: "rival" });
    expect(stakes.headline?.kind).toBe("tier-promotion");
  });
});

describe("passing a rival", () => {
  /** A rating comfortably mid-division, so no promotion claim can pre-empt the rival. */
  const MID = 1_150;

  it("names the player directly ahead when one win clears them", () => {
    const stakes = established(MID, { rivalGap: 4, rivalHandle: "rival" });
    expect(stakes.headline).toEqual({ kind: "pass-rival", handle: "rival", away: 4 });
  });

  it("ignores a rival further ahead than one win reaches", () => {
    const reach = established(MID).reach;
    const stakes = established(MID, { rivalGap: reach + 1, rivalHandle: "rival" });
    expect(stakes.headline?.kind).not.toBe("pass-rival");
  });

  it("ignores a player you are already level with", () => {
    // `ladderNeighbours` reports a signed gap and a tie comes back as 0. A win does not
    // move you past someone you are drawn with, so claiming it would be simply false.
    const stakes = established(MID, { rivalGap: 0, rivalHandle: "rival" });
    expect(stakes.headline?.kind).not.toBe("pass-rival");
  });

  it("ignores a gap with nobody attached to it", () => {
    expect(established(MID, { rivalGap: 4 }).headline?.kind).not.toBe("pass-rival");
    expect(
      established(MID, { rivalGap: 4, rivalHandle: null }).headline?.kind,
    ).not.toBe("pass-rival");
  });

  it("survives the absent neighbour entirely", () => {
    expect(() => established(MID, { rivalGap: null, rivalHandle: null })).not.toThrow();
    expect(established(MID).headline).not.toBeNull();
  });
});

describe("a settling rating", () => {
  it("mentions the K drop only when it is close", () => {
    const stakes = stakesFor({
      elo: 1_150,
      gamesPlayed: ESTABLISHED_AFTER_GAMES - 2,
      placementsRemaining: 0,
    });
    expect(stakes.headline).toEqual({ kind: "settling", games: 2 });
  });

  it("says nothing about it 20 games out", () => {
    const stakes = stakesFor({
      elo: 1_150,
      gamesPlayed: 10,
      placementsRemaining: 0,
    });
    expect(stakes.headline?.kind).not.toBe("settling");
  });

  it("says nothing about it once it has already happened", () => {
    const stakes = stakesFor({
      elo: 1_150,
      gamesPlayed: ESTABLISHED_AFTER_GAMES,
      placementsRemaining: 0,
    });
    expect(stakes.headline?.kind).not.toBe("settling");
  });
});

describe("the fallback", () => {
  it("always has something true to say", () => {
    // The card must never render empty. A panel that vanishes depending on how close a
    // player happens to sit to a boundary is worse than one that always states a fact.
    for (let elo = 0; elo <= 2_500; elo += 3) {
      expect(established(elo).headline).not.toBeNull();
    }
  });

  it("states the distance to the next division when nothing is imminent", () => {
    const stakes = established(1_150);
    expect(stakes.headline).toMatchObject({ kind: "baseline", label: "Gold II" });
  });

  it("reports the summit for Legend, which has no next division", () => {
    const legend = RANK_TIERS.find((tier) => tier.id === "legend")!;
    expect(established(legend.minElo + 500).headline).toEqual({ kind: "summit" });
    expect(established(legend.minElo + 500).rank.nextAt).toBeNull();
  });

  it("still lets a Legend pass a rival", () => {
    // Nothing above to be promoted into does not mean nothing to play for.
    const legend = RANK_TIERS.find((tier) => tier.id === "legend")!;
    const stakes = established(legend.minElo + 500, { rivalGap: 3, rivalHandle: "rival" });
    expect(stakes.headline?.kind).toBe("pass-rival");
  });
});

describe("what is at risk", () => {
  it("warns when the division floor is within one loss", () => {
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    const stakes = established(gold.minElo);
    expect(stakes.atRisk).toEqual({ gap: 0, label: "Silver III" });
  });

  it("stays quiet with comfortable headroom", () => {
    expect(established(1_150).atRisk).toBeNull();
  });

  it("never warns at the bottom of the ladder, where there is nothing below", () => {
    // Bronze I's floor IS the floor. rankForElo clamps everything under it, so walking a
    // point below returns the same rank and the branch declines on its own.
    for (const elo of [0, 1, 5, 20]) {
      expect(established(elo).atRisk).toBeNull();
    }
  });

  it("names a rank genuinely below the one held", () => {
    for (let elo = 0; elo <= 2_000; elo += 3) {
      const stakes = established(elo);
      if (!stakes.atRisk) continue;
      expect(stakes.atRisk.label).not.toBe(stakes.rank.label);
      expect(stakes.atRisk.gap).toBeGreaterThanOrEqual(0);
      expect(stakes.atRisk.gap).toBeLessThanOrEqual(stakes.reach);
    }
  });

  it("can be at risk and in reach at once inside a narrow division", () => {
    // Both are true near a tier floor when the division is short. Neither suppresses the
    // other — they are different questions about the same match.
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    const placing = stakesFor({
      elo: gold.minElo,
      gamesPlayed: PLACEMENT_MATCHES,
      placementsRemaining: 0,
    });
    expect(placing.atRisk).not.toBeNull();
    expect(placing.headline).not.toBeNull();
  });
});

describe("openingRange", () => {
  it("opens symmetrically around the player's rating", () => {
    const { low, high } = openingRange(1_000);
    expect(1_000 - low).toBe(high - 1_000);
    expect(low).toBeLessThan(1_000);
  });
});
