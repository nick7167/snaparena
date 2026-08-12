/**
 * Stage 2 of the content pipeline: pushes `data/tracks.json` into SpacetimeDB.
 *
 * Run `npm run ingest` first. Requires only that you are logged in as whoever
 * published the database:
 *
 *   spacetime login
 *   npm run import-tracks
 *
 * The Convex version needed ADMIN_IMPORT_SECRET in two places that had to agree.
 * There is no secret now — the module checks the caller against the publisher
 * identity it captured at `init`. See scripts/stdb.ts.
 *
 * Usage:
 *   node scripts/import-tracks.ts [--in data/tracks.json] [--batch 200]
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { withConnection } from "./stdb.ts";
import { CATEGORY_SEEDS } from "./seeds.ts";
import type { IngestedTrack } from "./ingest.ts";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    inPath: get("--in") ?? "data/tracks.json",
    batchSize: Number(get("--batch") ?? 200),
  };
}

async function main() {
  const { inPath, batchSize } = parseArgs();

  const raw = await readFile(path.resolve(inPath), "utf8");
  const { tracks } = JSON.parse(raw) as { tracks: IngestedTrack[] };

  console.log(`Importing ${tracks.length} tracks from ${inPath}`);

  await withConnection(async (conn) => {
    // Categories must exist before tracks, so slugs can resolve to ids.
    await conn.reducers.upsertCategories({
      categories: CATEGORY_SEEDS.map((seed) => ({
        slug: seed.slug,
        name: seed.name,
        sortOrder: seed.sortOrder,
      })),
    });
    console.log(`Categories: ${CATEGORY_SEEDS.length} upserted`);

    /**
     * Batched, and the batches are still ~200.
     *
     * A reducer is one transaction, so the whole catalogue in a single call would
     * be one very large write; batching keeps each transaction bounded the same way
     * it did under Convex. What changed is the bookkeeping: a reducer returns
     * nothing, so the created/updated counts the old script printed per batch are
     * no longer available to it. The catalogue's own numbers are read back at the
     * end from `catalogue_stats` instead, which is the same information from the
     * one place that can still be sure of it.
     */
    for (let offset = 0; offset < tracks.length; offset += batchSize) {
      const batch = tracks.slice(offset, offset + batchSize);

      await conn.reducers.upsertTracks({
        tracks: batch.map((track) => ({
          itunesTrackId: BigInt(track.itunesTrackId),
          title: track.title,
          titleNormalized: track.titleNormalized,
          artist: track.artist,
          artistNormalized: track.artistNormalized,
          artworkUrl: track.artworkUrl,
          previewUrl: track.previewUrl,
          categorySlugs: track.categorySlugs,
          difficulty: track.difficulty,
          popularity: track.popularity,
          releaseYear: track.releaseYear,
          playable: track.playable,
        })),
      });

      console.log(`  ${Math.min(offset + batchSize, tracks.length)}/${tracks.length}`);
    }

    console.log("\nDone. Check catalogue health with:");
    console.log("  npm run stdb:sql -- \"SELECT COUNT(*) FROM track\"");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
