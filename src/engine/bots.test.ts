import { describe, expect, it } from "vitest";
import { MIN_HUMAN_REACTION_MS, ROUND_DURATION_MS } from "./config";
import {
  BOT_BAN_MAX_MS,
  BOT_BAN_MIN_MS,
  BOT_MIN_REACTION_MS,
  BOT_PERSONAS,
  PRACTICE_POOL_SIZE,
  botBanDelayMs,
  chooseBotBan,
  knowsTrackProbability,
  personaById,
  personaNearestElo,
  pickPracticePersona,
  practiceCandidates,
  planBotRound,
  sampleReactionMs,
  type Rng,
} from "./bots";

/** Deterministic RNG cycling a fixed sequence, so every test is reproducible. */
function seeded(values: number[]): Rng {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("persona catalogue", () => {
  it("has unique ids and handles", () => {
    expect(new Set(BOT_PERSONAS.map((p) => p.id)).size).toBe(BOT_PERSONAS.length);
    expect(new Set(BOT_PERSONAS.map((p) => p.handle)).size).toBe(BOT_PERSONAS.length);
  });

  it("spans a wide rating range", () => {
    const ratings = BOT_PERSONAS.map((p) => p.elo);
    expect(Math.min(...ratings)).toBeLessThan(800);
    expect(Math.max(...ratings)).toBeGreaterThan(1700);
  });

  it("never lists a category as both strong and weak", () => {
    for (const persona of BOT_PERSONAS) {
      const overlap = persona.strongCategories.filter((slug) =>
        persona.weakCategories.includes(slug),
      );
      expect(overlap).toEqual([]);
    }
  });

  it("looks personas up by id", () => {
    expect(personaById("bot_oracle")?.displayName).toBe("The Oracle");
    expect(personaById("nope")).toBeUndefined();
  });
});

describe("personaNearestElo", () => {
  it("picks the closest rating", () => {
    expect(personaNearestElo(1810).id).toBe("bot_oracle");
    expect(personaNearestElo(500).elo).toBeLessThan(900);
  });

  it("honours exclusions so you don't replay the same bot", () => {
    const first = personaNearestElo(1800);
    const second = personaNearestElo(1800, [first.id]);
    expect(second.id).not.toBe(first.id);
  });

  it("falls back to the full pool if everything is excluded", () => {
    const all = BOT_PERSONAS.map((p) => p.id);
    expect(personaNearestElo(1000, all)).toBeDefined();
  });
});

describe("sampleReactionMs", () => {
  it("never returns a time the anti-cheat clock would reject", () => {
    // Bots submit through the same mutation as humans; anything under the floor
    // would be rejected and the bot would silently fail to score.
    for (let i = 0; i < 500; i++) {
      const ms = sampleReactionMs(1800);
      expect(ms).toBeGreaterThanOrEqual(MIN_HUMAN_REACTION_MS);
      expect(ms).toBeGreaterThanOrEqual(BOT_MIN_REACTION_MS);
    }
  });

  it("makes stronger bots faster on average", () => {
    const mean = (elo: number) => {
      let total = 0;
      for (let i = 0; i < 400; i++) total += sampleReactionMs(elo);
      return total / 400;
    };
    expect(mean(1800)).toBeLessThan(mean(900));
  });

  it("is right-skewed: the mean sits above the median", () => {
    const samples = Array.from({ length: 2000 }, () => sampleReactionMs(1200)).sort(
      (a, b) => a - b,
    );
    const median = samples[Math.floor(samples.length / 2)];
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    expect(mean).toBeGreaterThan(median);
  });

  it("is deterministic under a seeded rng", () => {
    const a = sampleReactionMs(1200, seeded([0.3, 0.7]));
    const b = sampleReactionMs(1200, seeded([0.3, 0.7]));
    expect(a).toBe(b);
  });

  it("survives an rng returning zero", () => {
    // log(0) would be -Infinity without the epsilon guard.
    expect(Number.isFinite(sampleReactionMs(1200, seeded([0, 0])))).toBe(true);
  });
});

describe("knowsTrackProbability", () => {
  const oracle = personaById("bot_oracle")!;
  const seoul = personaById("bot_seoul")!;

  it("stays within bounds across every input", () => {
    for (const elo of [400, 1000, 2200]) {
      for (const difficulty of [1, 2, 3, 4, 5]) {
        const p = knowsTrackProbability({
          elo,
          difficulty,
          categorySlugs: ["rock"],
          persona: oracle,
        });
        expect(p).toBeGreaterThanOrEqual(0.05);
        expect(p).toBeLessThanOrEqual(0.95);
      }
    }
  });

  it("drops as the track gets harder", () => {
    const easy = knowsTrackProbability({
      elo: 1200, difficulty: 1, categorySlugs: ["rock"], persona: oracle,
    });
    const hard = knowsTrackProbability({
      elo: 1200, difficulty: 5, categorySlugs: ["rock"], persona: oracle,
    });
    expect(hard).toBeLessThan(easy);
  });

  it("rises in a persona's strong category", () => {
    const strong = knowsTrackProbability({
      elo: seoul.elo, difficulty: 3, categorySlugs: ["k-pop"], persona: seoul,
    });
    const neutral = knowsTrackProbability({
      elo: seoul.elo, difficulty: 3, categorySlugs: ["rock"], persona: seoul,
    });
    expect(strong).toBeGreaterThan(neutral);
  });

  it("falls in a persona's weak category", () => {
    const weak = knowsTrackProbability({
      elo: seoul.elo, difficulty: 3, categorySlugs: ["country"], persona: seoul,
    });
    const neutral = knowsTrackProbability({
      elo: seoul.elo, difficulty: 3, categorySlugs: ["rock"], persona: seoul,
    });
    expect(weak).toBeLessThan(neutral);
  });
});

describe("planBotRound", () => {
  const persona = personaById("bot_bpm")!;

  it("answers when it knows the track", () => {
    // rng: knows-roll low (knows it), then two for the reaction sample, then no fumble.
    const plan = planBotRound({
      persona,
      difficulty: 1,
      categorySlugs: ["pop-2020s"],
      rng: seeded([0.01, 0.5, 0.5, 0.99]),
    });
    expect(plan.willAnswer).toBe(true);
    expect(plan.correctAtMs).toBeGreaterThan(0);
  });

  it("does not answer when it fails the knowledge roll", () => {
    const plan = planBotRound({
      persona,
      difficulty: 5,
      categorySlugs: ["metal"],
      rng: seeded([0.999, 0.999]),
    });
    expect(plan.willAnswer).toBe(false);
    expect(plan.correctAtMs).toBeNull();
  });

  it("keeps every answer inside the round", () => {
    for (let i = 0; i < 300; i++) {
      const plan = planBotRound({ persona, difficulty: 2, categorySlugs: ["rock"] });
      if (plan.correctAtMs !== null) {
        expect(plan.correctAtMs).toBeLessThan(ROUND_DURATION_MS);
        expect(plan.correctAtMs).toBeGreaterThanOrEqual(BOT_MIN_REACTION_MS);
      }
    }
  });

  it("leaves room for the lockout to clear between a wrong and a right guess", () => {
    // A wrong guess starts a 5s input lockout. If the correct guess landed inside
    // that window the server would reject it and the bot would score nothing.
    for (let i = 0; i < 500; i++) {
      const plan = planBotRound({ persona, difficulty: 1, categorySlugs: ["pop-2020s"] });
      if (plan.wrongAtMs !== null && plan.correctAtMs !== null) {
        expect(plan.correctAtMs - plan.wrongAtMs).toBeGreaterThanOrEqual(5_000);
      }
    }
  });

  it("never schedules a guess before the human reaction floor", () => {
    for (let i = 0; i < 300; i++) {
      const plan = planBotRound({ persona, difficulty: 3, categorySlugs: ["rock"] });
      for (const at of [plan.correctAtMs, plan.wrongAtMs]) {
        if (at !== null) expect(at).toBeGreaterThanOrEqual(MIN_HUMAN_REACTION_MS);
      }
    }
  });

  it("gives up before the clock when it cannot answer", () => {
    // A silent bot used to hold the human on a 30s clock nobody was racing.
    let stumped = 0;

    for (let i = 0; i < 300; i++) {
      const plan = planBotRound({ persona, difficulty: 5, categorySlugs: ["metal"] });
      if (plan.willAnswer) continue; // it knows this one; nothing to give up on

      stumped++;
      expect(plan.giveUpAtMs).toBeGreaterThan(0);
      expect(plan.giveUpAtMs).toBeLessThan(ROUND_DURATION_MS);
      // Never concede before its own wrong guess has landed.
      if (plan.wrongAtMs !== null) {
        expect(plan.giveUpAtMs).toBeGreaterThan(plan.wrongAtMs);
      }
    }

    expect(stumped).toBeGreaterThan(0);
  });

  it("drops a stab that would land after it has already conceded", () => {
    // rng: fails the knowledge roll, decides to guess anyway, then draws a very slow
    // reaction (tiny u1, zero u2 maximises the log-normal). That guess would fire
    // into a round the bot had already passed on, so it must be dropped outright.
    const plan = planBotRound({
      persona: personaById("bot_needle")!,
      difficulty: 5,
      categorySlugs: ["k-pop"],
      rng: seeded([0.999, 0.01, 1e-12, 0, 0.5]),
    });

    expect(plan.willAnswer).toBe(false);
    expect(plan.wrongAtMs).toBeNull();
    expect(plan.giveUpAtMs).toBeLessThan(ROUND_DURATION_MS);
  });

  it("never concedes before its own wrong guess, even for the slowest personas", () => {
    // The slow personas are where this broke: their reaction samples routinely land
    // past the last moment a bot will concede.
    const slow = personaById("bot_needle")!;
    for (let i = 0; i < 2000; i++) {
      const plan = planBotRound({ persona: slow, difficulty: 5, categorySlugs: ["k-pop"] });
      if (plan.wrongAtMs !== null) {
        expect(plan.giveUpAtMs).toBeGreaterThan(plan.wrongAtMs);
      }
    }
  });

  it("does not give up early when it knows the track", () => {
    for (let i = 0; i < 200; i++) {
      const plan = planBotRound({ persona, difficulty: 1, categorySlugs: ["pop-2020s"] });
      if (plan.willAnswer) expect(plan.giveUpAtMs).toBe(ROUND_DURATION_MS);
    }
  });

  it("sometimes guesses wrong even when it doesn't know the song", () => {
    let wrongGuesses = 0;
    for (let i = 0; i < 300; i++) {
      const plan = planBotRound({ persona, difficulty: 5, categorySlugs: ["metal"] });
      if (!plan.willAnswer && plan.wrongAtMs !== null) wrongGuesses++;
    }
    expect(wrongGuesses).toBeGreaterThan(0);
  });
});

describe("chooseBotBan", () => {
  const seoul = personaById("bot_seoul")!; // strong k-pop, weak country + nineties
  const oracle = personaById("bot_oracle")!; // no strengths, no weaknesses

  it("takes away a category it is bad at", () => {
    const ban = chooseBotBan(seoul, ["k-pop", "rock", "country"]);
    expect(ban).toBe("country");
  });

  it("prefers a weakness even when several are on offer", () => {
    for (let i = 0; i < 200; i++) {
      const ban = chooseBotBan(seoul, ["k-pop", "rock", "country", "nineties"]);
      expect(["country", "nineties"]).toContain(ban);
    }
  });

  it("never bans away its own advantage while anything else remains", () => {
    for (let i = 0; i < 200; i++) {
      // No weakness in the pool, so it falls through to the neutral rule.
      const ban = chooseBotBan(seoul, ["k-pop", "rock", "metal"]);
      expect(ban).not.toBe("k-pop");
    }
  });

  it("still bans when the whole pool is its strong suit", () => {
    const bpm = personaById("bot_bpm")!; // strong pop-2020s + pop-2010s
    const ban = chooseBotBan(bpm, ["pop-2020s", "pop-2010s"]);
    expect(["pop-2020s", "pop-2010s"]).toContain(ban);
  });

  it("handles a persona with no declared strengths or weaknesses", () => {
    const ban = chooseBotBan(oracle, ["rock", "metal", "latin"]);
    expect(["rock", "metal", "latin"]).toContain(ban);
  });

  it("always returns a slug from the pool, for every persona", () => {
    const pool = ["k-pop", "rock", "metal", "country", "latin", "hip-hop"];
    for (const p of BOT_PERSONAS) {
      for (let i = 0; i < 50; i++) {
        expect(pool).toContain(chooseBotBan(p, pool));
      }
    }
  });

  it("returns null rather than throwing on an empty pool", () => {
    expect(chooseBotBan(oracle, [])).toBeNull();
  });

  it("survives an rng returning exactly 1", () => {
    // Math.floor(1 * length) would index off the end without the clamp.
    expect(chooseBotBan(oracle, ["rock", "metal"], seeded([1]))).toBe("metal");
  });
});

describe("botBanDelayMs", () => {
  it("stays inside the think-time window", () => {
    for (let i = 0; i < 500; i++) {
      const delay = botBanDelayMs();
      expect(delay).toBeGreaterThanOrEqual(BOT_BAN_MIN_MS);
      expect(delay).toBeLessThanOrEqual(BOT_BAN_MAX_MS);
    }
  });

  it("never bans instantly — that reads as a script, not an opponent", () => {
    expect(botBanDelayMs(seeded([0]))).toBeGreaterThanOrEqual(BOT_BAN_MIN_MS);
  });
});

describe("pickPracticePersona", () => {
  it("draws from the personas nearest the rating", () => {
    // Repeated draws must never wander outside the pool, or practice stops being a
    // fair contest — a Bronze player should not meet The Oracle.
    const nearest = [...BOT_PERSONAS]
      .sort((a, b) => Math.abs(a.elo - 1000) - Math.abs(b.elo - 1000))
      .slice(0, PRACTICE_POOL_SIZE)
      .map((persona) => persona.id);

    for (let draw = 0; draw < 40; draw++) {
      const picked = pickPracticePersona(1000, undefined, seeded([draw / 40]));
      expect(nearest).toContain(picked.id);
    }
  });

  it("never returns the opponent just played", () => {
    // The whole point of the rotation: the deterministic nearest-Elo pick meant every
    // practice match drew the same bot forever.
    const first = pickPracticePersona(1000, undefined, seeded([0]));

    for (let draw = 0; draw < 20; draw++) {
      const next = pickPracticePersona(1000, first.id, seeded([draw / 20]));
      expect(next.id).not.toBe(first.id);
    }
  });

  it("reaches every persona in the pool across draws", () => {
    const seen = new Set<string>();
    for (let draw = 0; draw < 30; draw++) {
      seen.add(pickPracticePersona(1000, undefined, seeded([draw / 30])).id);
    }
    expect(seen.size).toBe(PRACTICE_POOL_SIZE);
  });

  it("still returns someone when the last opponent is the only candidate", () => {
    // Degenerate but reachable if the roster ever shrinks: excluding the last opponent
    // must not leave the caller with nothing to play against.
    const only = BOT_PERSONAS[0];
    const picked = pickPracticePersona(only.elo, only.id, seeded([0]));
    expect(picked).toBeDefined();
  });
});

describe("practiceCandidates", () => {
  it("is exactly the set pickPracticePersona draws from", () => {
    // The practice page shows this list as "you'll face one of these". If the two ever
    // disagree the screen names opponents that cannot turn up, so this is the contract.
    for (const elo of [400, 720, 1000, 1300, 1800, 2400]) {
      for (const last of [undefined, ...BOT_PERSONAS.map((p) => p.id)]) {
        const allowed = practiceCandidates(elo, last).map((p) => p.id);
        for (let draw = 0; draw < 20; draw++) {
          const picked = pickPracticePersona(elo, last, seeded([draw / 20]));
          expect(allowed).toContain(picked.id);
        }
      }
    }
  });

  it("excludes the last opponent so the roster reads as a cast", () => {
    const nearest = practiceCandidates(1000);
    expect(practiceCandidates(1000, nearest[0].id).map((p) => p.id)).not.toContain(
      nearest[0].id,
    );
  });

  it("falls back to the full pool rather than returning nothing", () => {
    // Excluding the last opponent must never empty the list, or the picker has nothing to
    // draw from and practice stops working entirely.
    for (const persona of BOT_PERSONAS) {
      expect(practiceCandidates(persona.elo, persona.id).length).toBeGreaterThan(0);
    }
  });

  it("is ordered nearest first", () => {
    const byDistance = practiceCandidates(1000).map((p) => Math.abs(p.elo - 1000));
    expect([...byDistance].sort((a, b) => a - b)).toEqual(byDistance);
  });
});
