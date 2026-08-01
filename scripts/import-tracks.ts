/**
 * Stage 2 of the content pipeline: pushes `data/tracks.json` into Convex.
 *
 * Run `npm run ingest` first. Requires:
 *   NEXT_PUBLIC_CONVEX_URL   from `npx convex dev`
 *   ADMIN_IMPORT_SECRET      set both locally and on the Convex deployment
 *
 * Usage:
 *   node scripts/import-tracks.ts [--in data/tracks.json] [--batch 200]
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
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

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.ADMIN_IMPORT_SECRET;

  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set — run `npx convex dev` first");
  if (!secret) throw new Error("ADMIN_IMPORT_SECRET is not set locally");

  const client = new ConvexHttpClient(convexUrl);

  const raw = await readFile(path.resolve(inPath), "utf8");
  const { tracks } = JSON.parse(raw) as { tracks: IngestedTrack[] };

  console.log(`Importing ${tracks.length} tracks from ${inPath}`);

  // Categories must exist before tracks, so slugs can resolve to ids.
  const categoryResult = await client.mutation(api.admin.upsertCategories, {
    secret,
    categories: CATEGORY_SEEDS.map((seed) => ({
      slug: seed.slug,
      name: seed.name,
      sortOrder: seed.sortOrder,
    })),
  });
  console.log(`Categories: +${categoryResult.created} created, ${categoryResult.updated} updated`);

  let created = 0;
  let updated = 0;
  const unknownSlugs = new Set<string>();

  for (let offset = 0; offset < tracks.length; offset += batchSize) {
    const batch = tracks.slice(offset, offset + batchSize);
    const result = await client.mutation(api.admin.upsertTracks, { secret, tracks: batch });

    created += result.created;
    updated += result.updated;
    for (const slug of result.unknownSlugs) unknownSlugs.add(slug);

    console.log(
      `  ${Math.min(offset + batchSize, tracks.length)}/${tracks.length}` +
        ` (+${result.created} new, ${result.updated} updated)`,
    );
  }

  console.log(`\nDone: ${created} created, ${updated} updated`);
  if (unknownSlugs.size > 0) {
    console.warn(`Unknown category slugs (not in seeds.ts): ${[...unknownSlugs].join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
