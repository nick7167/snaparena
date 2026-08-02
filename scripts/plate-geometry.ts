/**
 * The plate geometry, in one place.
 *
 * This is a transcription of the clip-path in src/ui/RankEmblem.tsx. It is used to render
 * the app-icon reference, and it is the shape the small (24/36px) rank marks keep using —
 * the generated emblem art is free-form, but the UI still needs something crisp and
 * instantly readable at leaderboard size, and that is the brand plate in the tier accent.
 *
 * If PLATE changes in RankEmblem.tsx, change it here too.
 */

/** The chamfer, as fractions of the box. Sharp cuts top-left and bottom-right. */
export const PLATE: readonly (readonly [number, number])[] = [
  [0.22, 0],
  [1, 0],
  [1, 0.78],
  [0.78, 1],
  [0, 1],
  [0, 0.22],
];

/** The chamfered plate as an SVG points list, positioned at (x,y) with side `size`. */
export function platePoints(x: number, y: number, size: number): string {
  return PLATE.map(([px, py]) => `${round(x + px * size)},${round(y + py * size)}`).join(" ");
}

/** Trims float noise out of generated SVG so the output diffs cleanly. */
export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
