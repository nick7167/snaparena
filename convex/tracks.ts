import { v } from "convex/values";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  AUTOCOMPLETE_MIN_CHARS,
  MAX_DUEL_ROUNDS,
  TITLE_INDEX_MAX,
} from "../src/engine/config";
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
 *
 * This is now the FALLBACK path. The guess box matches against a locally prefetched
 * copy of the catalogue (see `titleIndex` below and `src/game/track-index.ts`), because
 * a round-trip per keystroke cannot keep up with someone typing at speed. This query
 * still serves the window before that index lands, and forever if it fails to.
 */
export const autocomplete = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Gate on the RAW length, matching the client. Gating on the normalized length
    // meant "The S" measured as one character — `normalizeTitle` strips the leading
    // article — so the query returned nothing and the dropdown never opened.
    if (args.term.trim().length < AUTOCOMPLETE_MIN_CHARS) return [];

    const normalized = normalizeTitle(args.term);
    if (normalized.length === 0) return [];

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
 * The whole catalogue's titles, for the client to search locally.
 *
 * Autocomplete used to cost a server round-trip per keystroke, which is a race the
 * server cannot win: type faster than the round-trip and the list never opens. The
 * catalogue is small enough (~2k titles, ~18 KB gzipped) that shipping it once and
 * matching in-process is both faster and cheaper than asking repeatedly.
 *
 * DO NOT filter by `playable`, and DO NOT add any field beyond the title. Both are the
 * same anti-cheat rule that governs `autocomplete` above: the suggestion set has to be
 * the entire catalogue, and it has to be titles only. Scoping it to the answerable pool
 * would let a player read the answer off the dropdown, and shipping artwork, artist or
 * preview URLs would let a suggestion confirm a guess before it is submitted. Knowing
 * every title in the catalogue reveals nothing about the current round, which only ever
 * exposes an opaque preview URL.
 */
export const titleIndex = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("tracks").take(TITLE_INDEX_MAX);

    // Several recordings share one title. Keep the most popular of each so the client's
    // tie-breaking has something meaningful to order by.
    const best = new Map<string, Doc<"tracks">>();
    for (const track of rows) {
      const held = best.get(track.titleNormalized);
      if (
        !held ||
        track.popularity > held.popularity ||
        (track.popularity === held.popularity && track.title.length < held.title.length)
      ) {
        best.set(track.titleNormalized, track);
      }
    }

    // Popularity order is the payload's second channel: the client ranks ties by array
    // position, so this buys better suggestions for zero extra bytes. Title breaks
    // remaining ties so the ordering is stable between deployments.
    const ordered = [...best.values()].sort(
      (a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title),
    );

    return {
      titles: ordered.map((track) => track.title),
      /**
       * True when the read hit its ceiling and the tail of the catalogue is missing.
       * The client keeps the server-side search armed when this is set, so growing past
       * the cap degrades to slower suggestions rather than to absent ones.
       */
      truncated: rows.length === TITLE_INDEX_MAX,
    };
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
  const count = options.count ?? MAX_DUEL_ROUNDS;
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
