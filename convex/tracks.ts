import { v } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { AUTOCOMPLETE_MIN_CHARS, MAX_SETS, SONGS_PER_SET } from "../src/engine/config";
import { normalizeTitle } from "../src/engine/normalize";

/**
 * Autocomplete for the guess box.
 *
 * Searches the ENTIRE catalogue, including tracks that are not in the playable
 * pool. This is a deliberate anti-cheat requirement, not an oversight: if the
 * suggestion list were scoped to the tracks in the current match, a player could
 * type two characters and read the answer straight off the dropdown.
 *
 * Returns titles only — never artwork or artist — so a suggestion cannot confirm
 * a guess before it is submitted.
 */
export const autocomplete = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const normalized = normalizeTitle(args.term);
    if (normalized.length < AUTOCOMPLETE_MIN_CHARS) return [];

    const results = await ctx.db
      .query("tracks")
      .withSearchIndex("search_title", (q) => q.search("titleNormalized", normalized))
      .take(Math.min(args.limit ?? 8, 15));

    // De-duplicate by normalized title: several recordings share one title and
    // showing them repeatedly wastes the player's very limited reading time.
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const track of results) {
      if (seen.has(track.titleNormalized)) continue;
      seen.add(track.titleNormalized);
      suggestions.push(track.title);
    }
    return suggestions;
  },
});

/**
 * Fisher-Yates shuffle.
 *
 * Math.random() is seeded per-execution inside Convex, so a mutation that retries
 * produces the same shuffle — which is what keeps track selection reproducible.
 */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Maps an Elo rating onto a difficulty tier (1 easiest .. 5 hardest). */
export function difficultyTierForElo(elo: number): number {
  if (elo < 900) return 1;
  if (elo < 1100) return 2;
  if (elo < 1300) return 3;
  if (elo < 1500) return 4;
  return 5;
}

/**
 * Picks the tracks for one match.
 *
 * Difficulty comes from the players' ratings; category comes from what survived
 * the veto phase. The two axes are independent, which is what lets the ban phase
 * exist without distorting difficulty.
 *
 * Widens outward through adjacent tiers when a tier is too thin to fill a match —
 * important while the catalogue is still small.
 */
export async function pickTracksForMatch(
  ctx: QueryCtx | MutationCtx,
  options: {
    targetTier: number;
    bannedCategoryIds: Id<"categories">[];
    count?: number;
    excludeTrackIds?: Id<"tracks">[];
  },
): Promise<Id<"tracks">[]> {
  const count = options.count ?? MAX_SETS * SONGS_PER_SET;
  const banned = new Set(options.bannedCategoryIds.map(String));
  const excluded = new Set((options.excludeTrackIds ?? []).map(String));

  // Search order: target tier first, then alternating neighbours outward.
  const tierOrder: number[] = [options.targetTier];
  for (let offset = 1; offset <= 4; offset++) {
    if (options.targetTier - offset >= 1) tierOrder.push(options.targetTier - offset);
    if (options.targetTier + offset <= 5) tierOrder.push(options.targetTier + offset);
  }

  const chosen: Doc<"tracks">[] = [];
  const chosenTitles = new Set<string>();

  for (const tier of tierOrder) {
    if (chosen.length >= count) break;

    const candidates = await ctx.db
      .query("tracks")
      .withIndex("by_playable_difficulty", (q) => q.eq("playable", true).eq("difficulty", tier))
      .take(200);

    for (const track of shuffle(candidates)) {
      if (chosen.length >= count) break;
      if (excluded.has(String(track._id))) continue;
      // Never show two recordings of the same song in one match.
      if (chosenTitles.has(track.titleNormalized)) continue;
      if (track.categoryIds.some((id) => banned.has(String(id)))) continue;

      chosen.push(track);
      chosenTitles.add(track.titleNormalized);
    }
  }

  return chosen.map((track) => track._id);
}

export const categories = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("categories").collect();
    return all.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Catalogue health check, surfaced on an admin/debug page. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const tracks = await ctx.db.query("tracks").take(5_000);
    const playable = tracks.filter((track) => track.playable);

    const byDifficulty: Record<number, number> = {};
    for (const track of playable) {
      byDifficulty[track.difficulty] = (byDifficulty[track.difficulty] ?? 0) + 1;
    }

    return {
      total: tracks.length,
      playable: playable.length,
      byDifficulty,
      /** Tiers with too few tracks to fill matches without repetition. */
      thinTiers: [1, 2, 3, 4, 5].filter((tier) => (byDifficulty[tier] ?? 0) < 50),
    };
  },
});
