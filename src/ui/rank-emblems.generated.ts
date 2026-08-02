/**
 * GENERATED FILE — do not edit by hand. Run `npm run emblem-slice`.
 *
 * Pixel dimensions of every emblem in public/ranks/. Emblems are normalised so the
 * PLATE is a constant 480px wide, not so the whole image is — structure accretes
 * around a fixed plate as rank climbs, so higher ranks are simply larger images.
 * RankEmblem renders them all at one scale, which is what makes a Legend take up more
 * room on screen than a Bronze.
 */

export const EMBLEM_PLATE_WIDTH = 480;

export const EMBLEM_SIZES: Record<string, { w: number; h: number }> = {
  "bronze-1": { w: 480, h: 517 },
  "bronze-2": { w: 480, h: 517 },
  "bronze-3": { w: 480, h: 517 },
  "silver-1": { w: 480, h: 623 },
  "silver-2": { w: 480, h: 623 },
  "silver-3": { w: 480, h: 623 },
  "gold-1": { w: 481, h: 624 },
  "gold-2": { w: 553, h: 625 },
  "gold-3": { w: 540, h: 659 },
  "platinum-1": { w: 503, h: 644 },
  "platinum-2": { w: 503, h: 702 },
  "platinum-3": { w: 552, h: 771 },
  "diamond-1": { w: 503, h: 775 },
  "diamond-2": { w: 503, h: 825 },
  "diamond-3": { w: 576, h: 904 },
  "legend-1": { w: 896, h: 760 },
};
