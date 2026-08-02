/**
 * Builds contact sheets of whatever emblems currently exist in public/ranks/.
 *
 * Written to assets/preview/ so they can be opened directly rather than described. Both
 * are rendered on --color-ink-700, the card fill the emblems actually sit on in the app,
 * because judging cut-out art on white tells you nothing useful about how it will look.
 *
 *   ladder.png   every rank at hero size, one row per tier — the escalation at a glance
 *   sizes.png    every rank at 24 / 36 / 56 / 112px — what survives where
 *
 * Usage: npm run emblem-preview
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { EMBLEM_PLATE_WIDTH } from "../src/ui/rank-emblems.generated.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RANKS_DIR = resolve(ROOT, "public/ranks");
const OUT_DIR = resolve(ROOT, "assets/preview");

/** Ladder order. Anything present but unlisted is appended, so nothing is silently lost. */
const TIER_ORDER = ["bronze", "silver", "gold", "platinum", "diamond", "legend"];

/** The card fill the emblems sit on in the app. */
const INK_700 = "#1d2230";

/** Sizes RankEmblem renders at. 24/36 use the CSS mark, but seeing the art there is useful. */
const UI_SIZES = [24, 36, 56, 112];

type Emblem = { tier: string; division: number; file: string; width: number; height: number };

async function loadEmblems(): Promise<Emblem[]> {
  let files: string[];
  try {
    files = (await readdir(RANKS_DIR)).filter((f) => f.endsWith(".png"));
  } catch {
    throw new Error("No public/ranks/ yet — run `npm run emblem-slice` first.");
  }
  if (files.length === 0) throw new Error("public/ranks/ is empty — run `npm run emblem-slice`.");

  const emblems: Emblem[] = [];
  for (const file of files) {
    const [tier, divisionRaw] = file.replace(/\.png$/, "").split("-");
    const meta = await sharp(resolve(RANKS_DIR, file)).metadata();
    emblems.push({
      tier,
      division: Number(divisionRaw),
      file: resolve(RANKS_DIR, file),
      width: meta.width!,
      height: meta.height!,
    });
  }

  const rank = (tier: string) => {
    const i = TIER_ORDER.indexOf(tier);
    return i === -1 ? TIER_ORDER.length : i;
  };
  return emblems.sort((a, b) => rank(a.tier) - rank(b.tier) || a.division - b.division);
}

/**
 * Emblems are sized by their PLATE, exactly as RankEmblem does — `px` is how wide the
 * plate renders, and the emblem grows around it. Scaling these previews by image height
 * instead would hide the very thing the ladder is built on.
 */
const scaleAt = (e: Emblem, px: number) => px / EMBLEM_PLATE_WIDTH;
const widthAt = (e: Emblem, px: number) => Math.round(e.width * scaleAt(e, px));
const heightAt = (e: Emblem, px: number) => Math.round(e.height * scaleAt(e, px));

async function ladder(emblems: Emblem[]) {
  const H = 190;
  const pad = 20;
  const gap = 16;

  const tiers = [...new Set(emblems.map((e) => e.tier))];
  const rows = tiers.map((t) => emblems.filter((e) => e.tier === t));
  const rowWidth = (row: Emblem[]) =>
    row.reduce((sum, e) => sum + widthAt(e, H) + gap, 0) - gap;

  const width = pad * 2 + Math.max(...rows.map(rowWidth));
  // 1.6x headroom: higher tiers are taller than their plate, and the tallest must fit.
  const height = pad * (rows.length + 1) + rows.length * Math.round(H * 1.6);

  const layers = [];
  for (const [i, row] of rows.entries()) {
    let x = pad;
    const y = pad + i * (Math.round(H * 1.6) + pad);
    for (const e of row) {
      layers.push({
        input: await sharp(e.file).resize({ width: widthAt(e, H) }).png().toBuffer(),
        left: x,
        top: y + Math.round((H * 1.6 - heightAt(e, H)) / 2),
      });
      x += widthAt(e, H) + gap;
    }
  }

  return sharp({ create: { width, height, channels: 4, background: INK_700 } })
    .composite(layers)
    .png()
    .toBuffer();
}

async function sizes(emblems: Emblem[]) {
  const pad = 18;
  const gap = 10;
  const groupGap = 26;
  const rowH = Math.round(Math.max(...UI_SIZES) * 1.6);

  const layers = [];
  let maxX = 0;
  for (const [i, size] of UI_SIZES.entries()) {
    let x = pad;
    const centre = pad + i * (rowH + pad) + rowH / 2;
    let previousTier = emblems[0]?.tier;
    for (const e of emblems) {
      if (e.tier !== previousTier) {
        x += groupGap;
        previousTier = e.tier;
      }
      layers.push({
        input: await sharp(e.file).resize({ width: widthAt(e, size) }).png().toBuffer(),
        left: x,
        top: Math.round(centre - heightAt(e, size) / 2),
      });
      x += widthAt(e, size) + gap;
    }
    maxX = Math.max(maxX, x);
  }

  return sharp({
    create: {
      width: maxX + pad,
      height: pad * (UI_SIZES.length + 1) + UI_SIZES.length * rowH,
      channels: 4,
      background: INK_700,
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

async function main() {
  const emblems = await loadEmblems();
  await mkdir(OUT_DIR, { recursive: true });

  for (const [name, build] of [
    ["ladder.png", ladder],
    ["sizes.png", sizes],
  ] as const) {
    const png = await build(emblems);
    await writeFile(resolve(OUT_DIR, name), png);
    const meta = await sharp(png).metadata();
    console.log(`assets/preview/${name.padEnd(12)} ${meta.width}x${meta.height}`);
  }

  const tiers = [...new Set(emblems.map((e) => e.tier))];
  console.log(`\n${emblems.length} emblem(s) across ${tiers.length} tier(s): ${tiers.join(", ")}`);
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
