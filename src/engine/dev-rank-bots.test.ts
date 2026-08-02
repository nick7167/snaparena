import { describe, expect, it } from "vitest";
import { ELO_FLOOR, RANK_TIERS } from "./config";
import { rankForElo } from "./ranks";
import { BOT_PERSONAS, personaById } from "./bots";
import {
  DEV_RANK_BOT_PERSONAS,
  DEV_RANK_BOT_PREFIX,
  isDevRankBotPersona,
} from "./dev-rank-bots";

/**
 * DEV ONLY — delete alongside `dev-rank-bots.ts`.
 *
 * The roster's whole job is "one bot visibly parked in every rank". That claim is a
 * function of anchors chosen here and thresholds owned by RANK_TIERS, in two files that
 * have no other reason to move together — so it is asserted rather than eyeballed.
 */

/** How many distinct ranks the ladder can display. */
function totalRankCount(): number {
  return RANK_TIERS.reduce((sum, tier) => sum + tier.divisions, 0);
}

describe("dev rank bot roster", () => {
  it("covers all sixteen ranks, one bot each", () => {
    const labels = DEV_RANK_BOT_PERSONAS.map((persona) => rankForElo(persona.elo).label);

    expect(labels).toEqual([
      "Bronze I",
      "Bronze II",
      "Bronze III",
      "Silver I",
      "Silver II",
      "Silver III",
      "Gold I",
      "Gold II",
      "Gold III",
      "Platinum I",
      "Platinum II",
      "Platinum III",
      "Diamond I",
      "Diamond II",
      "Diamond III",
      "Legend",
    ]);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toHaveLength(totalRankCount());
  });

  it("anchors every bot clear of its division edges", () => {
    // Ratings drift — a ranked result moves a bot exactly as it moves a player. An
    // anchor sitting on a boundary would change rank after one match, which is the one
    // thing the roster must not do.
    for (const persona of DEV_RANK_BOT_PERSONAS) {
      const rank = rankForElo(persona.elo);
      if (rank.tier.divisions === 1) continue; // Legend has no ceiling to fall off
      expect(rank.progress).toBeGreaterThan(0.15);
      expect(rank.progress).toBeLessThan(0.85);
    }
  });

  it("keeps the lowest anchor above the rating floor", () => {
    // A bot pinned at ELO_FLOOR could only ever lose rating in one direction, and
    // `applyMatchResult` would silently clamp its deltas away.
    const lowest = Math.min(...DEV_RANK_BOT_PERSONAS.map((persona) => persona.elo));
    expect(lowest).toBeGreaterThan(ELO_FLOOR);
  });

  it("stays out of the shipping practice roster", () => {
    // `pickPracticePersona` and `bots.seed` both iterate BOT_PERSONAS. A dev bot in
    // there would be served as a practice opponent and seeded by `npm run seed-bots`.
    const shipping = new Set(BOT_PERSONAS.map((persona) => persona.id));
    const shippingHandles = new Set(BOT_PERSONAS.map((persona) => persona.handle));

    for (const persona of DEV_RANK_BOT_PERSONAS) {
      expect(shipping.has(persona.id)).toBe(false);
      expect(shippingHandles.has(persona.handle)).toBe(false);
      expect(persona.id.startsWith(DEV_RANK_BOT_PREFIX)).toBe(true);
      expect(isDevRankBotPersona(persona.id)).toBe(true);
    }

    for (const persona of BOT_PERSONAS) {
      expect(isDevRankBotPersona(persona.id)).toBe(false);
    }
  });

  it("resolves through personaById so the bots can guess and ban", () => {
    // `bots.playRound` and `bots.placeBotBan` return early on an unresolvable persona.
    // Without this fallback a dev bot joins the match and then does nothing at all.
    for (const persona of DEV_RANK_BOT_PERSONAS) {
      expect(personaById(persona.id)).toEqual(persona);
    }
  });

  it("has unique ids and handles", () => {
    expect(new Set(DEV_RANK_BOT_PERSONAS.map((p) => p.id)).size).toBe(
      DEV_RANK_BOT_PERSONAS.length,
    );
    expect(new Set(DEV_RANK_BOT_PERSONAS.map((p) => p.handle)).size).toBe(
      DEV_RANK_BOT_PERSONAS.length,
    );
  });
});
