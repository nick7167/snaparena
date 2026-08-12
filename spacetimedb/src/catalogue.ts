import { t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { AnonymousViewCtx, ReducerCtx } from "./ctx";
import { reject } from "./lib";
import { requireModuleOwner, requireOwnerOrAdmin } from "./users";
import { MAX_DUEL_ROUNDS, TITLE_INDEX_MAX } from "../../src/engine/config";

/**
 * The song catalogue, the autocomplete index, and track selection.
 *
 * `track` and `track_alias` are private tables — see the note on them in
 * schema.ts. Nothing in this module hands a client a track row; the only two
 * things that ever leave are the whole-catalogue title list (which is safe by
 * construction, and explained at `track_index`) and the per-round reveal the phase
 * machine writes.
 *
 * `tracks.autocomplete` is gone. Convex backed it with a full-text search index,
 * SpacetimeDB has none, and the client had already stopped using it as anything but
 * a cold-start fallback — a round trip per keystroke cannot keep up with typing, so
 * the guess box matches locally against `track_index`. Dropping the search path
 * costs nothing and removes the last reader of a now-private table.
 */

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const CategoryInput = t.object("CategoryInput", {
  slug: t.string(),
  name: t.string(),
  sortOrder: t.i32(),
});

const TrackInput = t.object("TrackInput", {
  itunesTrackId: t.i64(),
  title: t.string(),
  titleNormalized: t.string(),
  artist: t.string(),
  artistNormalized: t.string(),
  artworkUrl: t.string(),
  previewUrl: t.string(),
  categorySlugs: t.array(t.string()),
  difficulty: t.i32(),
  popularity: t.i32(),
  releaseYear: t.i32(),
  playable: t.bool(),
});

/**
 * Upserts categories by slug. Owner only.
 *
 * The old `secret: v.string()` first argument is gone — the caller is the identity
 * that published the database, which the CLI already knows how to be.
 */
export const upsertCategories = spacetimedb.reducer(
  { categories: t.array(CategoryInput) },
  (ctx, { categories }) => {
    requireModuleOwner(ctx);

    for (const input of categories) {
      const existing = ctx.db.category.slug.find(input.slug);
      if (existing) {
        ctx.db.category.id.update({
          ...existing,
          name: input.name,
          sortOrder: input.sortOrder,
        });
      } else {
        ctx.db.category.insert({
          id: 0n,
          slug: input.slug,
          name: input.name,
          sortOrder: input.sortOrder,
        });
      }
    }
  },
);

/**
 * Upserts a batch of tracks, then refreshes the autocomplete list. Owner only.
 *
 * Convex scheduled the rebuild rather than inlining it, to keep the import's own
 * transaction small. Here it is inline, because the rebuild's write-if-changed
 * guard already collapses ~20 batches into one write and a scheduled row would be
 * a second transaction doing the same read. The invariant the original wanted is
 * preserved either way: an import cannot finish with a stale index, and nobody has
 * to remember a step.
 */
export const upsertTracks = spacetimedb.reducer(
  { tracks: t.array(TrackInput) },
  (ctx, { tracks }) => {
    requireModuleOwner(ctx);

    // Resolve slugs once per batch rather than once per track.
    const categoryBySlug = new Map<string, bigint>();
    for (const row of ctx.db.category.iter()) categoryBySlug.set(row.slug, row.id);

    for (const input of tracks) {
      const categoryIds: bigint[] = [];
      for (const slug of input.categorySlugs) {
        const id = categoryBySlug.get(slug);
        // An unknown slug is dropped rather than fatal, exactly as before: a
        // catalogue that gained a genre the seeds do not name should import, not
        // fail. `catalogueStats` is where a thin category shows up.
        if (id !== undefined) categoryIds.push(id);
      }

      const existing = ctx.db.track.itunesTrackId.find(input.itunesTrackId);

      if (existing) {
        // Preserve learned difficulty data across re-imports: medianSolveMs and
        // solveSampleCount are measured from play, not from the source catalogue.
        ctx.db.track.id.update({
          ...existing,
          title: input.title,
          titleNormalized: input.titleNormalized,
          artist: input.artist,
          artistNormalized: input.artistNormalized,
          artworkUrl: input.artworkUrl,
          previewUrl: input.previewUrl,
          previewCheckedAt: ctx.timestamp,
          categoryIds,
          difficulty: input.difficulty,
          popularity: input.popularity,
          releaseYear: input.releaseYear,
          playable: input.playable,
        });
      } else {
        ctx.db.track.insert({
          id: 0n,
          itunesTrackId: input.itunesTrackId,
          title: input.title,
          titleNormalized: input.titleNormalized,
          artist: input.artist,
          artistNormalized: input.artistNormalized,
          artworkUrl: input.artworkUrl,
          previewUrl: input.previewUrl,
          previewCheckedAt: ctx.timestamp,
          categoryIds,
          difficulty: input.difficulty,
          popularity: input.popularity,
          releaseYear: input.releaseYear,
          playable: input.playable,
          medianSolveMs: undefined,
          solveSampleCount: 0,
        });
      }
    }

    rebuildTitleIndexIn(ctx);
  },
);

/** Explicit rebuild, for the operator console. */
export const rebuildTitleIndex = spacetimedb.reducer((ctx) => {
  requireOwnerOrAdmin(ctx);
  rebuildTitleIndexIn(ctx);
});

/**
 * Recomputes the stored title list, writing only when it actually changed.
 *
 * The write-if-changed guard mattered in Convex because a write invalidated every
 * subscriber's cached query and made them all re-read. It matters at least as much
 * here for a more direct reason: `track_index.titles` is a single row holding the
 * whole list, so rewriting it re-sends the entire list to every connected client.
 * An import re-upserts every track, and most runs find nothing new.
 */
function rebuildTitleIndexIn(ctx: ReducerCtx): void {
  const built = buildTitleIndex(ctx);
  const existing = [...ctx.db.track_index.iter()][0];

  if (existing && sameTitles(existing.titles, built.titles)) return;

  if (existing) {
    ctx.db.track_index.id.update({
      ...existing,
      titles: built.titles,
      truncated: built.truncated,
      trackCount: built.scanned,
      builtAt: ctx.timestamp,
    });
    return;
  }

  ctx.db.track_index.insert({
    id: 0n,
    titles: built.titles,
    truncated: built.truncated,
    trackCount: built.scanned,
    builtAt: ctx.timestamp,
  });
}

/** The list itself. Unchanged in behaviour from the Convex original. */
function buildTitleIndex(ctx: ReducerCtx): {
  titles: string[];
  truncated: boolean;
  scanned: number;
} {
  const rows = [...ctx.db.track.iter()].slice(0, TITLE_INDEX_MAX);

  // Several recordings share one title. Keep the most popular of each, so the
  // client's tie-breaking has something meaningful to order by.
  const best = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const held = best.get(row.titleNormalized);
    if (
      !held ||
      row.popularity > held.popularity ||
      (row.popularity === held.popularity && row.title.length < held.title.length)
    ) {
      best.set(row.titleNormalized, row);
    }
  }

  // Popularity order is the payload's second channel: the client ranks ties by
  // array position, so this buys better suggestions for zero extra bytes. Title
  // breaks remaining ties so the ordering is stable between deployments.
  const ordered = [...best.values()].sort(
    (a, b) => b.popularity - a.popularity || a.title.localeCompare(b.title),
  );

  return {
    titles: ordered.map((row) => row.title),
    /**
     * True when the read hit its ceiling and the tail of the catalogue is missing.
     * The client shows a degraded-suggestions state rather than silently offering
     * a partial list.
     */
    truncated: rows.length >= TITLE_INDEX_MAX,
    scanned: rows.length,
  };
}

function sameTitles(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates, seeded from the reducer's deterministic RNG.
 *
 * The Convex version used `Math.random()` and noted that Convex seeds it per
 * execution, so a retried mutation reshuffled identically. `ctx.random` gives the
 * same property by design rather than by implementation detail.
 */
function shuffle<T>(ctx: ReducerCtx, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = ctx.random.integerInRange(0, i);
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
 * Difficulty comes from the players' ratings; category comes from what survived the
 * veto phase. The two axes are independent, which is what lets the ban phase exist
 * without distorting difficulty.
 *
 * Widens outward through adjacent tiers when one is too thin to fill a match —
 * important while the catalogue is still small, and the reason a duel does not
 * simply fail when a heavily-banned tier runs dry.
 */
export function pickTracksForMatch(
  ctx: ReducerCtx,
  options: {
    targetTier: number;
    bannedCategoryIds: bigint[];
    count?: number;
    excludeTrackIds?: bigint[];
  },
): bigint[] {
  const count = options.count ?? MAX_DUEL_ROUNDS;
  const banned = new Set(options.bannedCategoryIds);
  const excluded = new Set(options.excludeTrackIds ?? []);

  // Search order: target tier first, then alternating neighbours outward.
  const tierOrder: number[] = [options.targetTier];
  for (let offset = 1; offset <= 4; offset++) {
    if (options.targetTier - offset >= 1) tierOrder.push(options.targetTier - offset);
    if (options.targetTier + offset <= 5) tierOrder.push(options.targetTier + offset);
  }

  const chosen: bigint[] = [];
  const chosenTitles = new Set<string>();

  for (const tier of tierOrder) {
    if (chosen.length >= count) break;

    const candidates = [
      ...ctx.db.track.by_playable_difficulty.filter([true, tier]),
    ].slice(0, 200);

    for (const row of shuffle(ctx, candidates)) {
      if (chosen.length >= count) break;
      if (excluded.has(row.id)) continue;
      // Never show two recordings of the same song in one match.
      if (chosenTitles.has(row.titleNormalized)) continue;
      if (row.categoryIds.some((id) => banned.has(id))) continue;

      chosen.push(row.id);
      chosenTitles.add(row.titleNormalized);
    }
  }

  return chosen;
}

/** Resolves a normalized guess to the track it names, aliases included. */
export function trackMatchesGuess(
  ctx: ReducerCtx,
  trackId: bigint,
  normalizedGuess: string,
): boolean {
  const row = ctx.db.track.id.find(trackId);
  if (!row) return false;
  if (row.titleNormalized === normalizedGuess) return true;

  for (const alias of ctx.db.track_alias.trackId.filter(trackId)) {
    if (alias.aliasNormalized === normalizedGuess) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Operator views
// ---------------------------------------------------------------------------

const CatalogueHealth = t.row("CatalogueHealth", {
  total: t.i32(),
  playable: t.i32(),
  /** Playable counts for difficulty 1..5, in order. */
  byDifficulty: t.array(t.i32()),
  /** Tiers with too few playable tracks to fill a duel. */
  thinTiers: t.array(t.i32()),
  indexedTitles: t.i32(),
  indexTruncated: t.bool(),
});

/**
 * Catalogue health for /admin.
 *
 * Anonymous: the answer is the same for every operator, so SpacetimeDB materialises
 * it once and shares it rather than computing it per subscriber. Nothing here names
 * a track, so exposing it does not widen the answer surface — it is counts only.
 */
export const catalogueStats = spacetimedb.anonymousView(
  { name: "catalogue_stats", public: true },
  t.option(CatalogueHealth),
  (ctx: AnonymousViewCtx) => {
    const byDifficulty = [0, 0, 0, 0, 0];
    let total = 0;
    let playable = 0;

    for (let tier = 1; tier <= 5; tier++) {
      let tierCount = 0;
      for (const _row of ctx.db.track.by_playable_difficulty.filter([true, tier])) {
        tierCount++;
      }
      byDifficulty[tier - 1] = tierCount;
      playable += tierCount;
    }
    for (let tier = 1; tier <= 5; tier++) {
      let tierCount = 0;
      for (const _row of ctx.db.track.by_playable_difficulty.filter([false, tier])) {
        tierCount++;
      }
      total += tierCount;
    }
    total += playable;

    const index = [...ctx.db.track_index.iter()][0];

    return {
      total,
      playable,
      byDifficulty,
      thinTiers: byDifficulty
        .map((count, i) => ({ count, tier: i + 1 }))
        .filter((entry) => entry.count < MAX_DUEL_ROUNDS)
        .map((entry) => entry.tier),
      indexedTitles: index ? index.titles.length : 0,
      indexTruncated: index ? index.truncated : false,
    };
  },
);

/** Guard so a match is never started against a catalogue that cannot fill it. */
export function catalogueCanFill(ctx: ReducerCtx, count: number): boolean {
  let seen = 0;
  for (let tier = 1; tier <= 5; tier++) {
    for (const _row of ctx.db.track.by_playable_difficulty.filter([true, tier])) {
      seen++;
      if (seen >= count) return true;
    }
  }
  return false;
}

/** Refuses rather than starting a match that would run out of songs. */
export function requireCatalogue(ctx: ReducerCtx, count: number): void {
  if (!catalogueCanFill(ctx, count)) reject("Not enough playable songs yet");
}
