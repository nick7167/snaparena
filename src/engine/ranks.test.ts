import { describe, expect, it } from "vitest";
import { NOTABLE_RANK_CUTOFF, RANK_TIERS, STARTING_ELO } from "./config";
import { isNotable, matchupLabel, rankChange, rankForElo } from "./ranks";

describe("rankForElo", () => {
  it("puts a new account in a sensible mid tier", () => {
    expect(rankForElo(STARTING_ELO).tier.id).toBe("silver");
  });

  it("floors at the lowest tier", () => {
    expect(rankForElo(0).tier.id).toBe("bronze");
    expect(rankForElo(-500).tier.id).toBe("bronze");
  });

  it("reaches the top tier and stays there", () => {
    expect(rankForElo(1_750).tier.id).toBe("legend");
    expect(rankForElo(9_999).tier.id).toBe("legend");
  });

  it("counts divisions downward as the player climbs", () => {
    // Entering a tier starts at its lowest division; III -> II -> I going up.
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    expect(rankForElo(gold.minElo).division).toBe(3);
    expect(rankForElo(gold.minElo).label).toBe("Gold III");

    const platinum = RANK_TIERS.find((tier) => tier.id === "platinum")!;
    expect(rankForElo(platinum.minElo - 1).label).toBe("Gold I");
  });

  it("drops the division from the single-division top tier", () => {
    expect(rankForElo(2_000).label).toBe("Legend");
  });

  it("never emits a division outside its tier's range", () => {
    for (let elo = 0; elo <= 2_000; elo += 7) {
      const rank = rankForElo(elo);
      expect(rank.division).toBeGreaterThanOrEqual(1);
      expect(rank.division).toBeLessThanOrEqual(rank.tier.divisions);
    }
  });

  it("reports progress within the division as a 0..1 fraction", () => {
    for (let elo = 0; elo <= 2_000; elo += 13) {
      const { progress } = rankForElo(elo);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });

  it("never ranks a higher rating below a lower one", () => {
    let previousTierIndex = -1;
    for (let elo = 0; elo <= 2_000; elo += 5) {
      const index = RANK_TIERS.findIndex((t) => t.id === rankForElo(elo).tier.id);
      expect(index).toBeGreaterThanOrEqual(previousTierIndex);
      previousTierIndex = index;
    }
  });
});

describe("rankChange", () => {
  it("detects a tier promotion", () => {
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    const change = rankChange(gold.minElo - 10, gold.minElo + 10);
    expect(change.promotion).toBe("tier");
    expect(change.demotion).toBeNull();
  });

  it("detects a division promotion inside one tier", () => {
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    const change = rankChange(gold.minElo, gold.minElo + 80);
    expect(change.promotion).toBe("division");
  });

  it("does not fire for a rating change inside the same division", () => {
    // The celebration must not trigger on every won match.
    const change = rankChange(1_150, 1_155);
    expect(change.promotion).toBeNull();
    expect(change.demotion).toBeNull();
  });

  it("detects demotions", () => {
    const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
    expect(rankChange(gold.minElo + 10, gold.minElo - 10).demotion).toBe("tier");
  });
});

describe("isNotable", () => {
  it("flags top-100 players", () => {
    expect(isNotable(1)).toBe(true);
    expect(isNotable(NOTABLE_RANK_CUTOFF)).toBe(true);
  });

  it("ignores everyone else", () => {
    expect(isNotable(NOTABLE_RANK_CUTOFF + 1)).toBe(false);
    expect(isNotable(0)).toBe(false);
    expect(isNotable(null)).toBe(false);
    expect(isNotable(undefined)).toBe(false);
  });
});

describe("matchupLabel", () => {
  it("labels a clear rating gap", () => {
    expect(matchupLabel(1_000, 1_400)).toBe("UNDERDOG");
    expect(matchupLabel(1_400, 1_000)).toBe("FAVOURITE");
  });

  it("labels close ratings as even", () => {
    expect(matchupLabel(1_200, 1_210)).toBe("EVEN MATCH");
    expect(matchupLabel(1_200, 1_200)).toBe("EVEN MATCH");
  });

  it("returns no numbers", () => {
    // The projected rating swing is deliberately withheld until match_end, so the
    // reward is not spent before the match starts.
    for (const pair of [[1_000, 1_500], [1_500, 1_000], [1_200, 1_200]] as const) {
      expect(matchupLabel(pair[0], pair[1])).not.toMatch(/\d/);
    }
  });
});
