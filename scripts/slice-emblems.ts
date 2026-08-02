/**
 * Slices generated emblem sheets into individual rank assets.
 *
 * Drop a generated sheet at assets/sheets/<tier>.png and run this. Each sheet holds the
 * three divisions of one tier side by side (Legend holds one), on a flat magenta
 * background. Out come transparent PNGs in public/ranks/, all the same height and each
 * keeping its own width — emblems are free to be whatever shape suits their rank.
 *
 * Emblems are located by connected-component labelling on the keyed alpha, so emblems
 * whose bounding boxes overlap still separate correctly. If a sheet does not yield the
 * expected number this throws — a silently bad crop is how a wrong emblem ships.
 *
 * Usage: npm run emblem-slice            (every sheet present)
 *        npm run emblem-slice -- gold    (one tier)
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { extractGroup, findComponents, groupByPosition, keyMagenta } from "./cutout.ts";
import { writeSmallVariants } from "./emblem-small.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHEET_DIR = resolve(ROOT, "assets/sheets");
const OUT_DIR = resolve(ROOT, "public/ranks");
const SIZES_FILE = resolve(ROOT, "src/ui/rank-emblems.generated.ts");

/**
 * Divisions per tier, left to right on the sheet. Ascending, matching rankForElo:
 * division I is the entry rank and III is the top of the tier.
 *
 * `plate` overrides the automatic plate-width measurement, in source pixels. Detection is
 * reliable while structure sits beside or below the plate, but a full-height outer frame
 * spans as many rows as the plate does and wins the vote — Gold III measured 848 against
 * its siblings' 784 and would have rendered 7% small. Set the override to the value the
 * other divisions in that tier agree on; the script warns whenever they disagree.
 */
const SHEETS: Record<string, { divisions: number[]; plate?: number }> = {
  bronze: { divisions: [1, 2, 3] },
  silver: { divisions: [1, 2, 3] },
  gold: { divisions: [1, 2, 3], plate: 784 },
  platinum: { divisions: [1, 2, 3], plate: 784 },
  diamond: { divisions: [1, 2, 3], plate: 784 },
  // Legend's plate is buried inside its wings and gold frame, so neither the modal-width
  // measurement nor a luminance test isolates it — the former catches the wingspan, the
  // latter the plate's interior. This value was converged by rendering Legend beside
  // Diamond at identical scale and matching the plates by eye.
  legend: { divisions: [1], plate: 938 },
};

/**
 * Emblems are normalised so the PLATE is this wide, not so the whole emblem is.
 *
 * Every rank is the same chamfered plate with structure accreting around it, so
 * normalising the bounding box would shrink the plate as the ladder climbs — Silver's
 * plinth alone made its plate 30% smaller than Bronze's. Sizing on the plate instead
 * keeps the core constant and lets the emblem grow, which is the point: a higher rank
 * physically takes up more room.
 */
const PLATE_WIDTH = 480;

/**
 * Row widths are bucketed to this many pixels before taking the mode, so the chamfer's
 * one-pixel steps do not each count as their own distinct width.
 */
const WIDTH_BUCKET = 8;

/** Above this width-to-height ratio the UI has to scale an emblem down to fit. */
const MAX_ASPECT = 1.6;

/**
 * The plate's width, found as the most common row width in the emblem.
 *
 * Not the widest row: wings and supports sit at the vertical midpoint on the higher tiers,
 * so any measurement of "how wide is it across the middle" measures plate plus wings and
 * scales the emblem down — shrinking the very thing that is supposed to stay constant.
 * The plate is the only part spanning most of the emblem's height, so the width that
 * recurs most often is the plate's, whatever is bolted to its sides.
 */
function plateWidth(cut: Buffer, width: number, height: number): number {
  const histogram = new Map<number, number>();

  for (let y = 0; y < height; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x++) {
      if (cut[(y * width + x) * 4 + 3] >= 128) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left < 0) continue;
    const bucket = Math.round((right - left + 1) / WIDTH_BUCKET) * WIDTH_BUCKET;
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
  }

  let best = width;
  let bestCount = 0;
  for (const [bucket, count] of histogram) {
    // Ties go to the wider bucket: the chamfered corners taper, so a plate contributes a
    // spread of narrower widths that should never outvote its full width.
    if (count > bestCount || (count === bestCount && bucket > best)) {
      best = bucket;
      bestCount = count;
    }
  }
  return best || width;
}

/** Emitted dimensions, so the component can render every emblem at one scale. */
const sizes: string[] = [];

async function sliceSheet(tier: string, spec: { divisions: number[]; plate?: number }, file: string) {
  const { divisions, plate: plateOverride } = spec;
  const sheetPath = resolve(SHEET_DIR, file);
  const { data, width, height, keyed } = await keyMagenta(sheetPath);
  const { labels, components } = findComponents(data, width, height);

  let groups;
  try {
    groups = groupByPosition(components, divisions.length);
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`);
  }

  const results: string[] = [];
  const measurements: number[] = [];

  /*
   * Each emblem is trimmed to its own bounds and normalised to a common HEIGHT, keeping
   * its own aspect ratio. Nothing is padded to a square — that is what lets every rank be
   * whatever shape suits it, since the UI renders these at a fixed height with automatic
   * width.
   */
  for (const [index, division] of divisions.entries()) {
    const { cut, boxWidth, boxHeight } = extractGroup(data, labels, width, groups[index]);
    const aspect = boxWidth / boxHeight;

    if (aspect > MAX_ASPECT) {
      console.warn(
        `  ! ${tier} ${division}: ${boxWidth}x${boxHeight} (${aspect.toFixed(2)}:1) is wider than ` +
          `${MAX_ASPECT}:1.\n    The UI caps emblem width, so this one will render shorter ` +
          `than its neighbours.`,
      );
    }

    const measured = plateWidth(cut, boxWidth, boxHeight);
    const plate = plateOverride ?? measured;
    const scale = PLATE_WIDTH / plate;
    measurements.push(measured);

    const name = `${tier}-${division}.png`;
    const out = await sharp(cut, { raw: { width: boxWidth, height: boxHeight, channels: 4 } })
      .resize({ width: Math.round(boxWidth * scale) })
      .png({ compressionLevel: 9 })
      .toFile(resolve(OUT_DIR, name));

    sizes.push(`  "${tier}-${division}": { w: ${out.width}, h: ${out.height} },`);
    const parts = groups[index].length > 1 ? `, ${groups[index].length} parts` : "";
    results.push(
      `  ${name.padEnd(16)} ${out.width}x${out.height}  plate ${plate}\u2192${PLATE_WIDTH} (${scale.toFixed(2)}x${parts})`,
    );
  }

  console.log(`${file} (${keyed ? "keyed" : "already transparent"})`);
  console.log(results.join("\n"));

  // The plate is identical in every division, so a spread means detection was fooled —
  // usually by a full-height frame outvoting the plate. Silently scaling on that would
  // shrink one division's plate against its siblings.
  const spread = Math.max(...measurements) - Math.min(...measurements);
  if (!plateOverride && spread > Math.min(...measurements) * 0.03) {
    console.warn(
      `  ! plate measured inconsistently across ${tier}: ${measurements.join(", ")}.\n` +
        `    Set \`plate\` for ${tier} in SHEETS to the value the divisions agree on.`,
    );
  }
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  await mkdir(OUT_DIR, { recursive: true });

  const present = new Map<string, string>();
  try {
    // Only files named after a known tier are considered, so assets/sheets/archive/,
    // icon.png and any working files are ignored rather than half-matched into a slice.
    // The generator hands back JPEGs as often as PNGs, so accept either and remember
    // which extension each tier actually arrived as.
    for (const file of await readdir(SHEET_DIR)) {
      const match = /^(.+)\.(png|jpe?g)$/i.exec(file);
      if (match) present.set(match[1], file);
    }
  } catch {
    throw new Error("No assets/sheets/ directory yet — drop generated sheets there first.");
  }

  const targets = Object.keys(SHEETS).filter(
    (tier) => present.has(tier) && (only.length === 0 || only.includes(tier)),
  );

  if (targets.length === 0) {
    throw new Error(
      `No sheets to slice.\n  Found in assets/sheets/: ${[...present.values()].join(", ") || "nothing"}\n` +
        `  Expected any of: ${Object.keys(SHEETS).join(", ")}`,
    );
  }

  for (const tier of targets) await sliceSheet(tier, SHEETS[tier], present.get(tier)!);

  // Merge with whatever is already recorded, so slicing one tier does not drop the rest.
  const existing = new Map<string, string>();
  try {
    const previous = await readFile(SIZES_FILE, "utf8");
    for (const line of previous.split("\n")) {
      const match = /^\s*"([a-z]+-\d)": \{ w: \d+, h: \d+ \},$/.exec(line);
      if (match) existing.set(match[1], line);
    }
  } catch {
    // First run — nothing to merge.
  }
  for (const line of sizes) {
    const key = /"([a-z]+-\d)"/.exec(line)![1];
    existing.set(key, line);
  }

  const order = Object.keys(SHEETS);
  const merged = [...existing.entries()].sort(([a], [b]) => {
    const [at, ad] = a.split("-");
    const [bt, bd] = b.split("-");
    return order.indexOf(at) - order.indexOf(bt) || Number(ad) - Number(bd);
  });

  await writeFile(
    SIZES_FILE,
    `/**\n` +
      ` * GENERATED FILE — do not edit by hand. Run \`npm run emblem-slice\`.\n` +
      ` *\n` +
      ` * Pixel dimensions of every emblem in public/ranks/. Emblems are normalised so the\n` +
      ` * PLATE is a constant ${PLATE_WIDTH}px wide, not so the whole image is — structure accretes\n` +
      ` * around a fixed plate as rank climbs, so higher ranks are simply larger images.\n` +
      ` * RankEmblem renders them all at one scale, which is what makes a Legend take up more\n` +
      ` * room on screen than a Bronze.\n` +
      ` */\n\n` +
      `export const EMBLEM_PLATE_WIDTH = ${PLATE_WIDTH};\n\n` +
      `export const EMBLEM_SIZES: Record<string, { w: number; h: number }> = {\n` +
      merged.map(([, line]) => line).join("\n") +
      `\n};\n`,
  );

  // The dense parts of the UI render from public/ranks/sm/, so a slice that did not also
  // refresh those would leave the leaderboard showing the previous artwork.
  const small = await writeSmallVariants();

  const done = targets.reduce((n, tier) => n + SHEETS[tier].divisions.length, 0);
  const remaining = Object.keys(SHEETS).filter((t) => !present.has(t));
  console.log(`\nWrote ${done} emblem(s) to public/ranks/ and ${merged.length} size(s) to src/ui/`);
  console.log(`Wrote ${small} small variant(s) to public/ranks/sm/`);
  if (remaining.length > 0) console.log(`Still missing: ${remaining.join(", ")}`);
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
