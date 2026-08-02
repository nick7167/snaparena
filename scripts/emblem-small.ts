/**
 * Downscaled emblem variants for the dense parts of the UI.
 *
 * The emblems in public/ranks/ are trophy-sized — 300KB to 1.1MB each, normalised to a
 * 480px plate. That is right for a profile at 112px and wrong for a leaderboard, where a
 * single screen can pull every distinct rank at once and the artwork renders at 28px.
 *
 * These are the same images at a 96px plate: roughly 2.5x the density they are displayed
 * at, so they stay crisp on a retina panel, at a twentieth of the bytes. Derived from the
 * sliced output rather than from the sheets, so running this can never shift the artwork
 * itself — it only ever produces a smaller copy of whatever shipped.
 *
 * Usage: npm run emblem-small
 *        (also runs automatically at the end of `npm run emblem-slice`)
 */

import { mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { EMBLEM_PLATE_WIDTH } from "../src/ui/rank-emblems.generated.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FULL_DIR = resolve(ROOT, "public/ranks");
const SMALL_DIR = resolve(FULL_DIR, "sm");

/**
 * Plate width of the small variants, in pixels.
 *
 * RankEmblem draws these at 28px (sm) and 40px (md) inside a fixed box, so 96 leaves
 * better than 2x on the larger of the two. Raising it costs bytes on the leaderboard for
 * detail nobody can resolve at that size.
 */
export const SMALL_PLATE_WIDTH = 96;

/** Regenerates public/ranks/sm/ from public/ranks/. Returns how many were written. */
export async function writeSmallVariants(): Promise<number> {
  await mkdir(SMALL_DIR, { recursive: true });

  const files = (await readdir(FULL_DIR)).filter((name) => name.endsWith(".png"));
  const scale = SMALL_PLATE_WIDTH / EMBLEM_PLATE_WIDTH;

  for (const name of files) {
    const source = sharp(resolve(FULL_DIR, name));
    const { width } = await source.metadata();
    if (!width) throw new Error(`${name}: could not read dimensions`);

    await source
      .resize({ width: Math.max(1, Math.round(width * scale)) })
      .png({ compressionLevel: 9 })
      .toFile(resolve(SMALL_DIR, name));
  }

  return files.length;
}

// Only when invoked directly — slice-emblems.ts imports the function instead.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeSmallVariants()
    .then((count) => console.log(`Wrote ${count} small emblem(s) to public/ranks/sm/`))
    .catch((error) => {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    });
}
