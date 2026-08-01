import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Content-import mutations, called by `scripts/import-tracks.ts`.
 *
 * These are ordinary public mutations guarded by a shared secret rather than by
 * user auth, because the importer runs from a terminal with no Clerk session.
 * Set ADMIN_IMPORT_SECRET in the Convex dashboard before running an import.
 */
function assertAdmin(secret: string): void {
  const expected = process.env.ADMIN_IMPORT_SECRET;
  if (!expected) throw new Error("ADMIN_IMPORT_SECRET is not configured on the deployment");
  if (secret !== expected) throw new Error("Bad admin secret");
}

export const upsertCategories = mutation({
  args: {
    secret: v.string(),
    categories: v.array(
      v.object({ slug: v.string(), name: v.string(), sortOrder: v.number() }),
    ),
  },
  handler: async (ctx, args) => {
    assertAdmin(args.secret);

    let created = 0;
    let updated = 0;

    for (const category of args.categories) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", category.slug))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { name: category.name, sortOrder: category.sortOrder });
        updated++;
      } else {
        await ctx.db.insert("categories", category);
        created++;
      }
    }

    return { created, updated };
  },
});

/**
 * Upserts a batch of tracks.
 *
 * Batched because a single mutation has a bounded transaction size — the importer
 * chunks the file and calls this repeatedly.
 */
export const upsertTracks = mutation({
  args: {
    secret: v.string(),
    tracks: v.array(
      v.object({
        itunesTrackId: v.number(),
        title: v.string(),
        titleNormalized: v.string(),
        artist: v.string(),
        artistNormalized: v.string(),
        artworkUrl: v.string(),
        previewUrl: v.string(),
        categorySlugs: v.array(v.string()),
        difficulty: v.number(),
        popularity: v.number(),
        releaseYear: v.number(),
        playable: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    assertAdmin(args.secret);

    // Resolve category slugs once per batch rather than once per track.
    const allCategories = await ctx.db.query("categories").collect();
    const categoryBySlug = new Map<string, Id<"categories">>(
      allCategories.map((category) => [category.slug, category._id]),
    );

    let created = 0;
    let updated = 0;
    const unknownSlugs = new Set<string>();

    for (const track of args.tracks) {
      const categoryIds: Id<"categories">[] = [];
      for (const slug of track.categorySlugs) {
        const id = categoryBySlug.get(slug);
        if (id) categoryIds.push(id);
        else unknownSlugs.add(slug);
      }

      const existing = await ctx.db
        .query("tracks")
        .withIndex("by_itunes_id", (q) => q.eq("itunesTrackId", track.itunesTrackId))
        .unique();

      const fields = {
        itunesTrackId: track.itunesTrackId,
        title: track.title,
        titleNormalized: track.titleNormalized,
        artist: track.artist,
        artistNormalized: track.artistNormalized,
        artworkUrl: track.artworkUrl,
        previewUrl: track.previewUrl,
        previewCheckedAt: Date.now(),
        categoryIds,
        difficulty: track.difficulty,
        popularity: track.popularity,
        releaseYear: track.releaseYear,
        playable: track.playable,
      };

      if (existing) {
        // Preserve learned difficulty data across re-imports.
        await ctx.db.patch(existing._id, fields);
        updated++;
      } else {
        await ctx.db.insert("tracks", { ...fields, solveSampleCount: 0 });
        created++;
      }
    }

    return { created, updated, unknownSlugs: [...unknownSlugs] };
  },
});
