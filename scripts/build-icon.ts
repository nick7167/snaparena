/**
 * Builds every app-icon variant from one generated image.
 *
 * Input is assets/sheets/icon.png — the plate on flat magenta, same as the emblem sheets.
 * Cutting it out rather than baking a background into the generation is what lets one
 * image serve every surface: each variant gets its own fill fraction and is composited
 * onto ink-900 here, at the size that surface actually needs.
 *
 * Outputs:
 *   src/app/icon.png          512  opaque       — favicon; Next serves it from /icon
 *   src/app/apple-icon.png    180  opaque       — iOS composites alpha badly, so pre-flatten
 *   public/icon-192.png       192  opaque       — PWA manifest
 *   public/icon-512.png       512  opaque       — PWA manifest
 *   public/icon-maskable.png  512  opaque       — PWA maskable, plate at 60% inside a safe zone
 *   public/mark.png           256  transparent  — the in-app wordmark, on whatever surface
 *
 * Usage: npm run build-icon
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { extractGroup, findComponents, groupByPosition, keyMagenta } from "./cutout.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "assets/sheets/icon.png");
const APP_DIR = resolve(ROOT, "src/app");
const PUBLIC_DIR = resolve(ROOT, "public");

/** --color-ink-900, the app's darkest surface and the icon's background. */
const INK_900 = { r: 0x0e, g: 0x10, b: 0x17, alpha: 1 };

/**
 * Fraction of the canvas the plate fills.
 *
 * `contain` leaves the icon looking small on a home screen, and `cover` crops the
 * chamfer off. Android's maskable spec can clip up to 20% from each edge, so that
 * variant is deliberately tighter.
 */
const FILL = 0.86;
const MASKABLE_FILL = 0.6;

/**
 * The favicon gets almost the whole tile. At 16px every pixel of padding is ~2px of the
 * mark lost, and unlike the home-screen icons nothing rounds or masks it afterwards.
 */
const FAVICON_FILL = 0.96;

/**
 * The in-app mark sits inside the sidebar's own layout, which supplies its spacing, so
 * it gets the full canvas and no baked background.
 */
const MARK_FILL = 1;

/** Trims the source to the plate and returns it as a square, transparent PNG. */
async function cutPlate() {
  const { data, width, height, keyed } = await keyMagenta(SOURCE);
  const { labels, components } = findComponents(data, width, height);

  // One plate expected. groupByPosition still runs so a stray speck or a detached accent
  // is folded in rather than becoming the crop.
  const [group] = groupByPosition(components, 1);
  const { cut, boxWidth, boxHeight } = extractGroup(data, labels, width, group);

  const side = Math.max(boxWidth, boxHeight);
  const square = await sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp(cut, { raw: { width: boxWidth, height: boxHeight, channels: 4 } })
          .png()
          .toBuffer(),
        left: Math.round((side - boxWidth) / 2),
        top: Math.round((side - boxHeight) / 2),
      },
    ])
    .png()
    .toBuffer();

  return { square, boxWidth, boxHeight, keyed };
}

/** Scales the plate into a canvas, optionally over an opaque background. */
async function render(plate: Buffer, size: number, fill: number, opaque: boolean) {
  const inner = Math.round(size * fill);
  const scaled = await sharp(plate).resize(inner, inner, { fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: opaque ? INK_900 : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const { square, boxWidth, boxHeight, keyed } = await cutPlate();
  const aspect = boxWidth / boxHeight;

  if (aspect < 0.9 || aspect > 1.11) {
    console.warn(
      `  ! plate is ${boxWidth}x${boxHeight} (${aspect.toFixed(2)}:1), not square.\n` +
        `    App icons are square, so it will be letterboxed. Consider regenerating.`,
    );
  }

  await mkdir(PUBLIC_DIR, { recursive: true });

  const outputs: [string, number, number, boolean][] = [
    // Opaque, not transparent. The plate is bone-white, so on a light browser chrome a
    // cut-out favicon is a white shape on a white tab strip — effectively invisible.
    // Baking ink-900 in guarantees contrast wherever the browser puts it.
    [resolve(APP_DIR, "icon.png"), 512, FAVICON_FILL, true],
    [resolve(APP_DIR, "apple-icon.png"), 180, FILL, true],
    [resolve(PUBLIC_DIR, "icon-192.png"), 192, FILL, true],
    [resolve(PUBLIC_DIR, "icon-512.png"), 512, FILL, true],
    [resolve(PUBLIC_DIR, "icon-maskable.png"), 512, MASKABLE_FILL, true],
    [resolve(PUBLIC_DIR, "mark.png"), 256, MARK_FILL, false],
  ];

  console.log(`icon.png (${keyed ? "keyed" : "already transparent"}), plate ${boxWidth}x${boxHeight}`);
  for (const [path, size, fill, opaque] of outputs) {
    await sharp(await render(square, size, fill, opaque)).toFile(path);
    const label = path.replace(`${ROOT}/`, "");
    console.log(`  ${label.padEnd(28)} ${size}x${size}  ${opaque ? "opaque" : "transparent"}`);
  }

  console.log("\nCheck src/app/icon.png at 16px before shipping — that is the size that matters.");
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
