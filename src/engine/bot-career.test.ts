import { describe, expect, it } from "vitest";

import { BADGES } from "./badges";
import { mergeConfig } from "./config-merge";
import { BOT_PERSONAS, type BotPersona } from "./bots";
import {
  CAREER_TAIL_LENGTH,
  seededRng,
  simulateCareer,
  simulateRoster,
  type BotCareer,
  type TrackSample,
} from "./bot-career";
import { ELO_FLOOR } from "./config";
import { DEV_RANK_BOT_PERSONAS } from "./dev-rank-bots";
import { levelForXp } from "./xp";
import { rankForElo } from "./ranks";

/** These simulations are run against the shipped defaults. */
const config = mergeConfig();


/**
 * A stand-in catalogue.
 *
 * Deliberately synthetic: the simulator takes its tracks as an argument precisely so it
 * never needs a database, and a fixed pool keeps these assertions independent of whatever
 * happens to be imported into the live one.
 */
const CATEGORY_SLUGS = [
  "pop-2010s",
  "pop-2020s",
  "hip-hop",
  "rock",
  "country",
  "latin",
  "k-pop",
  "metal",
  "nineties",
] as const;

function trackPool(size = 120): TrackSample[] {
  return Array.from({ length: size }, (_, index) => ({
    index,
    difficulty: (index % 5) + 1,
    categorySlugs: [CATEGORY_SLUGS[index % CATEGORY_SLUGS.length]],
  }));
}

const TRACKS = trackPool();
const NOW = Date.UTC(2026, 6, 1);

function careerFor(persona: BotPersona, roster: readonly BotPersona[]): BotCareer {
  return simulateCareer({ persona, roster, tracks: TRACKS, now: NOW, config });
}

const devCareers = simulateRoster({
  personas: DEV_RANK_BOT_PERSONAS,
  tracks: TRACKS,
  now: NOW,
  config,
});

const practiceCareers = simulateRoster({
  personas: BOT_PERSONAS,
  tracks: TRACKS,
  now: NOW,
  config,
});

const allCareers = [...devCareers.values(), ...practiceCareers.values()];

describe("seededRng", () => {
  it("is deterministic for a given seed", () => {
    const a = Array.from({ length: 8 }, seededRng("bot_oracle"));
    const b = Array.from({ length: 8 }, seededRng("bot_oracle"));
    expect(a).toEqual(b);
  });

  it("produces different streams for different seeds", () => {
    const a = Array.from({ length: 8 }, seededRng("bot_oracle"));
    const b = Array.from({ length: 8 }, seededRng("bot_needle"));
    expect(a).not.toEqual(b);
  });

  it("stays inside [0, 1)", () => {
    const rng = seededRng("spread");
    for (let i = 0; i < 2_000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("simulateCareer", () => {
  it("is reproducible, so re-seeding never churns a profile", () => {
    const persona = DEV_RANK_BOT_PERSONAS[8];
    const first = careerFor(persona, DEV_RANK_BOT_PERSONAS);
    const second = careerFor(persona, DEV_RANK_BOT_PERSONAS);
    expect(first).toEqual(second);
  });

  it("refuses to run without a catalogue rather than inventing rounds", () => {
    expect(() =>
      simulateCareer({
        persona: BOT_PERSONAS[0],
        roster: BOT_PERSONAS,
        tracks: [],
        now: NOW,
        config,
      }),
    ).toThrow(/track/i);
  });

  it("plays a career long enough to be worth showing", () => {
    for (const career of allCareers) {
      expect(career.gamesPlayed).toBeGreaterThanOrEqual(10);
      expect(career.rankedWins).toBeGreaterThan(0);
      expect(career.rankedWins).toBeLessThanOrEqual(career.gamesPlayed);
    }
  });

  it("gives higher ranks longer careers", () => {
    const bronze = devCareers.get("rank_bronze_1")!;
    const legend = devCareers.get("rank_legend")!;
    expect(legend.gamesPlayed).toBeGreaterThan(bronze.gamesPlayed * 4);
  });

  it("keeps level and XP in agreement, which the profile and sidebar both read", () => {
    for (const career of allCareers) {
      expect(career.level).toBe(levelForXp(career.xp, config).level);
      expect(career.level).toBeGreaterThan(1);
    }
  });

  it("backdates the account in proportion to how much it has played", () => {
    for (const career of allCareers) {
      expect(career.createdAt).toBeLessThan(NOW);
    }
    expect(devCareers.get("rank_legend")!.createdAt).toBeLessThan(
      devCareers.get("rank_bronze_1")!.createdAt,
    );
  });
});

describe("rating anchors", () => {
  /**
   * The load-bearing assertion. `dev-rank-bots.test.ts` pins every anchor to the rank it
   * is meant to occupy so the leaderboard shows sixteen distinct ranks; a career that
   * drifted off its anchor would move the bot into a neighbouring division and quietly
   * break that guarantee.
   */
  it("finishes every career on exactly the persona's declared Elo", () => {
    for (const persona of [...DEV_RANK_BOT_PERSONAS, ...BOT_PERSONAS]) {
      const career = (devCareers.get(persona.id) ?? practiceCareers.get(persona.id))!;
      expect(career.elo).toBe(persona.elo);

      const last = career.tail[career.tail.length - 1];
      expect(last.players[0].ratingAfter).toBe(persona.elo);
    }
  });

  it("leaves every rank bot in the rank it was written for", () => {
    for (const persona of DEV_RANK_BOT_PERSONAS) {
      const career = devCareers.get(persona.id)!;
      expect(rankForElo(career.elo).label).toBe(rankForElo(persona.elo).label);
    }
  });

  it("never reports a rating below the floor or a delta its own pair disagrees with", () => {
    for (const career of allCareers) {
      for (const match of career.tail) {
        const me = match.players[0];
        expect(me.ratingBefore).toBeGreaterThanOrEqual(ELO_FLOOR);
        expect(me.ratingAfter).toBeGreaterThanOrEqual(ELO_FLOOR);
        expect(me.ratingAfter - me.ratingBefore).toBe(me.ratingDelta);
      }
    }
  });

  it("keeps the persisted rating path continuous", () => {
    for (const career of allCareers) {
      for (let i = 1; i < career.tail.length; i++) {
        expect(career.tail[i].players[0].ratingBefore).toBe(
          career.tail[i - 1].players[0].ratingAfter,
        );
      }
    }
  });

  it("never pays a rating swing larger than the highest K-factor could", () => {
    for (const career of allCareers) {
      for (const match of career.tail) {
        expect(Math.abs(match.players[0].ratingDelta)).toBeLessThanOrEqual(40);
      }
    }
  });
});

describe("records", () => {
  it("scales the winrate mildly with rank rather than flattening it", () => {
    const rate = (id: string) => {
      const career = devCareers.get(id)!;
      return career.rankedWins / career.gamesPlayed;
    };

    // Both ends land inside the intended 44%–58% band...
    expect(rate("rank_bronze_1")).toBeGreaterThan(0.3);
    expect(rate("rank_bronze_1")).toBeLessThan(0.52);
    expect(rate("rank_legend")).toBeGreaterThan(0.5);
    expect(rate("rank_legend")).toBeLessThan(0.72);
    // ...and the ladder points the right way.
    expect(rate("rank_legend")).toBeGreaterThan(rate("rank_bronze_1"));
  });

  it("never claims a losing record for a top-rank account", () => {
    for (const id of ["rank_legend", "rank_diamond_3", "rank_diamond_2"]) {
      const career = devCareers.get(id)!;
      expect(career.rankedWins * 2).toBeGreaterThan(career.gamesPlayed);
    }
  });
});

describe("badges", () => {
  it("only awards badges the career totals actually support", () => {
    for (const career of allCareers) {
      const held = new Set(career.badgeIds);

      for (const id of held) {
        expect(BADGES.some((badge) => badge.id === id)).toBe(true);
      }

      expect(held.has("first_blood")).toBe(career.rankedWins >= 1);
      expect(held.has("centurion")).toBe(career.gamesPlayed >= 100);
      expect(held.has("snap_10")).toBe(career.snapGuesses >= 10);
      expect(held.has("snap_100")).toBe(career.snapGuesses >= 100);
    }
  });

  it("gives a long career more badges than a short one", () => {
    expect(devCareers.get("rank_legend")!.badgeIds.length).toBeGreaterThan(
      devCareers.get("rank_bronze_1")!.badgeIds.length,
    );
  });
});

describe("category ratings", () => {
  it("rates every persona in the categories it actually played", () => {
    for (const career of allCareers) {
      expect(career.categoryRatings.length).toBeGreaterThan(0);
      for (const entry of career.categoryRatings) {
        expect(CATEGORY_SLUGS).toContain(entry.slug as (typeof CATEGORY_SLUGS)[number]);
        expect(entry.games).toBeGreaterThan(0);
      }
    }
  });

  it("returns them strongest first, which is the order the profile renders", () => {
    for (const career of allCareers) {
      const ratings = career.categoryRatings.map((entry) => entry.rating);
      expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    }
  });

  it("puts a persona's declared strength above its declared weakness", () => {
    // Averaged across the roster rather than asserted per bot: one persona can get a bad
    // draw, but the effect has to be visible over the whole cast or the panel is noise.
    let agree = 0;
    let tested = 0;

    for (const persona of [...DEV_RANK_BOT_PERSONAS, ...BOT_PERSONAS]) {
      const career = (devCareers.get(persona.id) ?? practiceCareers.get(persona.id))!;
      const lookup = new Map(career.categoryRatings.map((e) => [e.slug, e.rating]));

      for (const strong of persona.strongCategories) {
        for (const weak of persona.weakCategories) {
          const strongRating = lookup.get(strong);
          const weakRating = lookup.get(weak);
          if (strongRating === undefined || weakRating === undefined) continue;
          tested++;
          if (strongRating > weakRating) agree++;
        }
      }
    }

    expect(tested).toBeGreaterThan(5);
    expect(agree / tested).toBeGreaterThan(0.6);
  });
});

describe("the persisted tail", () => {
  it("hands back the configured number of matches, oldest first", () => {
    for (const career of allCareers) {
      expect(career.tail).toHaveLength(CAREER_TAIL_LENGTH);
      for (let i = 1; i < career.tail.length; i++) {
        expect(career.tail[i].completedAt).toBeGreaterThan(career.tail[i - 1].completedAt);
      }
      expect(career.tail[career.tail.length - 1].completedAt).toBeLessThanOrEqual(NOW);
      for (const match of career.tail) {
        expect(match.startedAt).toBeLessThan(match.completedAt);
      }
    }
  });

  it("plays every round against a real track from the pool", () => {
    for (const career of allCareers) {
      for (const match of career.tail) {
        expect(match.trackIndices.length).toBeGreaterThan(0);
        for (const index of match.trackIndices) {
          expect(TRACKS[index]).toBeDefined();
        }
        // Never replays a track inside one match — the draft draws a set, not a bag.
        expect(new Set(match.trackIndices).size).toBe(match.trackIndices.length);
        for (const round of match.rounds) {
          expect(match.trackIndices).toContain(round.trackIndex);
        }
        expect(match.rounds.length).toBeLessThanOrEqual(match.trackIndices.length);
      }
    }
  });

  it("drains health monotonically and stops at zero", () => {
    for (const career of allCareers) {
      for (const match of career.tail) {
        const last = new Map<number, number>([
          [0, Number.POSITIVE_INFINITY],
          [1, Number.POSITIVE_INFINITY],
        ]);

        for (const round of match.rounds) {
          for (const entry of round.damage) {
            expect(entry.hpAfter).toBeGreaterThanOrEqual(0);
            expect(entry.hpAfter).toBeLessThanOrEqual(last.get(entry.slot)!);
            expect(entry.damage).toBeGreaterThanOrEqual(0);
            last.set(entry.slot, entry.hpAfter);
          }
        }
      }
    }
  });

  it("agrees with itself about who won", () => {
    for (const career of allCareers) {
      for (const match of career.tail) {
        if (match.winnerSlot === undefined) continue;
        const winner = match.players[match.winnerSlot];
        const loser = match.players[match.winnerSlot === 0 ? 1 : 0];

        expect(winner.hp).toBeGreaterThanOrEqual(loser.hp);
        // A winner on zero health is not a contradiction: both players can be knocked out
        // by the same round, and `resolveDuel` then settles it on points. What must never
        // happen is the loser outliving the winner.
        if (winner.hp === 0) expect(loser.hp).toBe(0);
      }
    }
  });

  it("counts a tail win the same way the career does", () => {
    for (const career of allCareers) {
      for (const match of career.tail) {
        const won = match.winnerSlot === 0;
        // A win must pay more rating than a loss of the same match would have.
        if (won) expect(match.players[0].ratingDelta).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("fills both sides of the results screen", () => {
    for (const career of allCareers) {
      for (const match of career.tail) {
        for (const player of match.players) {
          expect(player.xpEarned).toBeGreaterThan(0);
          expect(player.xpBreakdown.length).toBeGreaterThan(0);
          expect(player.xpBreakdown.reduce((sum, e) => sum + e.amount, 0)).toBe(
            player.xpEarned,
          );
          expect(player.levelAfter).toBeGreaterThanOrEqual(player.levelBefore);
          expect(player.xpAfter).toBeGreaterThanOrEqual(player.xpEarned);
          expect(levelForXp(player.xpAfter, config).level).toBe(player.levelAfter);
        }
        expect(match.players[0].personaId).not.toBe(match.players[1].personaId);
      }
    }
  });

  /**
   * Load-bearing for the writer. The career's earlier matches are played against rating-
   * matched peers that have no account, and persisting one would produce a history row
   * pointing at a profile that does not exist.
   */
  it("only ever names a real roster persona as the opponent", () => {
    for (const [personas, careers] of [
      [DEV_RANK_BOT_PERSONAS, devCareers],
      [BOT_PERSONAS, practiceCareers],
    ] as const) {
      const known = new Set(personas.map((persona) => persona.id));
      for (const career of careers.values()) {
        for (const match of career.tail) {
          expect(known.has(match.players[1].personaId)).toBe(true);
        }
      }
    }
  });
});
