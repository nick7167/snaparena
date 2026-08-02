/**
 * Turning a flat-magenta generation into transparent art.
 *
 * Shared by the rank-emblem slicer and the app-icon builder, because both start from the
 * same thing: an image model's output on #FF00FF, which has to become clean alpha before
 * anything else can happen to it.
 */

import sharp from "sharp";

/** Distance from pure magenta below which a pixel is certainly background. */
const KEY_INNER = 90;
/** Distance above which a pixel is certainly foreground. Between the two, feathered. */
const KEY_OUTER = 150;

/** Alpha above which a pixel counts as part of the art. */
export const SOLID = 128;

/** Blobs smaller than this fraction of the largest are compression specks, not art. */
const SPECK = 0.005;

function magentaDistance(r: number, g: number, b: number): number {
  const dr = 255 - r;
  const db = 255 - b;
  return Math.sqrt(dr * dr + g * g + db * db);
}

/**
 * Keys the magenta out and erodes the resulting alpha by one pixel.
 *
 * The erosion is what removes the pink fringe. The obvious alternative — a colour-space
 * despill — is unsafe here: bronze and diamond both sit on the wrong side of a
 * green-versus-red-and-blue test and would get desaturated by it.
 *
 * If the image already carries real transparency the generator did the work for us, and
 * it is returned untouched.
 */
export async function keyMagenta(input: string) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = width * height;

  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent++;
  if (transparent > pixels * 0.05) {
    return { data, width, height, keyed: false };
  }

  const alpha = new Uint8Array(pixels);
  for (let p = 0; p < pixels; p++) {
    const o = p * 4;
    const d = magentaDistance(data[o], data[o + 1], data[o + 2]);
    alpha[p] =
      d <= KEY_INNER
        ? 0
        : d >= KEY_OUTER
          ? 255
          : Math.round(((d - KEY_INNER) / (KEY_OUTER - KEY_INNER)) * 255);
  }

  // Erode: a pixel keeps the minimum alpha of its 3x3 neighbourhood.
  const eroded = new Uint8Array(pixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let min = 255;
      for (let dy = -1; dy <= 1 && min > 0; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const a = alpha[ny * width + nx];
          if (a < min) min = a;
          if (min === 0) break;
        }
      }
      eroded[y * width + x] = min;
    }
  }

  for (let p = 0; p < pixels; p++) data[p * 4 + 3] = eroded[p];
  return { data, width, height, keyed: true };
}

export interface Component {
  id: number;
  size: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Connected blobs of art, found by flood fill.
 *
 * This replaced a scan for empty columns, which cannot separate shapes whose bounding
 * boxes overlap — Gold's orbital rings sweep sideways far enough to span the gaps between
 * emblems, so every column was occupied and all three read as one mass. Pixels that touch
 * belong together; pixels that do not, do not. Horizontal position is irrelevant.
 */
export function findComponents(data: Buffer, width: number, height: number) {
  const labels = new Int32Array(width * height);
  const components: Component[] = [];
  const stack: number[] = [];
  let next = 0;

  const solid = (p: number) => data[p * 4 + 3] >= SOLID;

  for (let seed = 0; seed < labels.length; seed++) {
    if (!solid(seed) || labels[seed] !== 0) continue;

    next++;
    let size = 0;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;

    labels[seed] = next;
    stack.push(seed);

    while (stack.length > 0) {
      const p = stack.pop()!;
      size++;
      const x = p % width;
      const y = (p / width) | 0;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;

      if (x > 0 && solid(p - 1) && labels[p - 1] === 0) {
        labels[p - 1] = next;
        stack.push(p - 1);
      }
      if (x < width - 1 && solid(p + 1) && labels[p + 1] === 0) {
        labels[p + 1] = next;
        stack.push(p + 1);
      }
      if (y > 0 && solid(p - width) && labels[p - width] === 0) {
        labels[p - width] = next;
        stack.push(p - width);
      }
      if (y < height - 1 && solid(p + width) && labels[p + width] === 0) {
        labels[p + width] = next;
        stack.push(p + width);
      }
    }

    components.push({ id: next, size, left, right, top, bottom });
  }

  return { labels, components };
}

/** Drops compression specks, keeping only blobs big enough to be real art. */
export function withoutSpecks(components: Component[]): Component[] {
  const largest = Math.max(...components.map((c) => c.size));
  return components.filter((c) => c.size >= largest * SPECK);
}

/**
 * Groups components into clusters, splitting at the widest horizontal gaps.
 *
 * A shape is usually a single blob, but it does not have to be — a detached ring or a
 * floating accent is still part of its emblem, and grouping by position keeps it rather
 * than discarding it as a stray.
 */
export function groupByPosition(components: Component[], expected: number): Component[][] {
  const kept = withoutSpecks(components).sort((a, b) => a.left + a.right - (b.left + b.right));

  if (kept.length < expected) {
    throw new Error(
      `found ${kept.length} shape(s), expected at least ${expected}.\n` +
        `  Shapes may be touching each other, or the background is not flat magenta.`,
    );
  }
  if (kept.length === expected) return kept.map((c) => [c]);

  const gaps: { at: number; gap: number }[] = [];
  let reach = kept[0].right;
  for (let i = 1; i < kept.length; i++) {
    gaps.push({ at: i, gap: kept[i].left - reach });
    reach = Math.max(reach, kept[i].right);
  }

  const splits = gaps
    .sort((a, b) => b.gap - a.gap)
    .slice(0, expected - 1)
    .map((g) => g.at)
    .sort((a, b) => a - b);

  const groups: Component[][] = [];
  let start = 0;
  for (const end of [...splits, kept.length]) {
    groups.push(kept.slice(start, end));
    start = end;
  }
  return groups;
}

/**
 * Copies one group of components out of the sheet, cropped to their shared bounds.
 *
 * Masks by component rather than simply cropping the bounding box: shapes with sweeping
 * elements have overlapping boxes, so a plain crop would drag a piece of the neighbour
 * in with it. Anti-aliased edge pixels fall below SOLID and carry no label, so they are
 * kept unconditionally — dropping them turns every outline to jaggies.
 */
export function extractGroup(
  data: Buffer,
  labels: Int32Array,
  width: number,
  group: Component[],
) {
  const ids = new Set(group.map((c) => c.id));
  const left = Math.min(...group.map((c) => c.left));
  const right = Math.max(...group.map((c) => c.right));
  const top = Math.min(...group.map((c) => c.top));
  const bottom = Math.max(...group.map((c) => c.bottom));
  const boxWidth = right - left + 1;
  const boxHeight = bottom - top + 1;

  const cut = Buffer.alloc(boxWidth * boxHeight * 4);
  for (let y = 0; y < boxHeight; y++) {
    for (let x = 0; x < boxWidth; x++) {
      const src = ((top + y) * width + (left + x)) * 4;
      const dst = (y * boxWidth + x) * 4;
      const owned = ids.has(labels[(top + y) * width + (left + x)]);
      cut[dst] = data[src];
      cut[dst + 1] = data[src + 1];
      cut[dst + 2] = data[src + 2];
      cut[dst + 3] = owned || data[src + 3] < SOLID ? data[src + 3] : 0;
    }
  }

  return { cut, boxWidth, boxHeight };
}
