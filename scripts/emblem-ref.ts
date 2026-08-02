/**
 * Renders the app-icon reference.
 *
 * The rank emblems no longer get a geometry reference — their art is generated free-form
 * from a written brief, because handing the model a finished silhouette is exactly what
 * kept producing competent, lifeless badges. The icon is different: it is the brand mark,
 * it has to match the wordmark in the sidebar exactly, and there is nothing to invent.
 *
 * Usage: npm run emblem-ref
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { platePoints } from "./plate-geometry.ts";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/ref");

const INK_900 = "#0e1017";
const PAPER = "#ffffff";

/** The bare plate, solid and empty, on ink-900 at 62% of the canvas. */
function iconRef(): Buffer {
  const box = 1024;
  const size = box * 0.62;
  const o = (box - size) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}">` +
      `<rect width="${box}" height="${box}" fill="${INK_900}"/>` +
      `<polygon points="${platePoints(o, o, size)}" fill="${PAPER}"/></svg>`,
  );
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const png = await sharp(iconRef()).png().toBuffer();
  await writeFile(resolve(OUT_DIR, "plate-icon-ref.png"), png);

  const { width, height } = await sharp(png).metadata();
  console.log(`plate-icon-ref.png  ${width}x${height}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
