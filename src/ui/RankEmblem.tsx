/**
 * The rank emblem — the app's signature object.
 *
 * Every size renders the generated artwork from public/ranks/. It used to render the
 * artwork only at lg/xl and a CSS chamfer plate below that, which meant the leaderboard
 * and the sidebar — the two places a rank is seen most often — showed a different object
 * than the profile did. One rank, one picture.
 *
 * Two asset sets, chosen by size, because the trophy-sized files are 300KB–1.1MB each and
 * a leaderboard can pull every distinct rank at once:
 *
 *   sm / md   public/ranks/sm/, a 96px plate. Drawn inside a fixed square box so a row of
 *             mixed ranks stays aligned — see below.
 *
 *   lg / xl   the full artwork, sized on the plate so higher ranks physically grow.
 *
 * The one thing still drawn in CSS is the unranked state, which has no artwork to show:
 * a ghosted chamfer plate in --color-faint, the token reserved for decoration that is
 * never content.
 */

import { EMBLEM_PLATE_WIDTH, EMBLEM_SIZES } from "./rank-emblems.generated";

export type EmblemSize = "sm" | "md" | "lg" | "xl";

/**
 * `px` is the box for the small sizes and the PLATE WIDTH for the large ones. The two
 * are deliberately different measurements — see the sizing note on each branch below.
 */
const SIZES: Record<EmblemSize, { px: number; box: string }> = {
  sm: { px: 28, box: "size-7" },
  md: { px: 40, box: "size-10" },
  lg: { px: 56, box: "size-14" },
  xl: { px: 112, box: "size-28" },
};

/**
 * Large sizes only: `size` sets how wide the PLATE renders, not how big the whole emblem
 * is.
 *
 * Every rank is the same chamfered plate with structure accreting around it as you climb,
 * so sizing on the image would shrink the plate at higher ranks — Silver's plinth alone
 * cost it 30% against Bronze. Sizing on the plate keeps the core constant and lets the
 * emblem grow, which is the reward: a Legend physically occupies more room than a Bronze.
 *
 * The dimensions come from rank-emblems.generated.ts, written by `npm run emblem-slice`.
 */
function artSize(tierId: string, division: number, px: number) {
  const asset = EMBLEM_SIZES[`${tierId}-${division}`];
  if (!asset) return null;
  const scale = px / EMBLEM_PLATE_WIDTH;
  return { width: Math.round(asset.w * scale), height: Math.round(asset.h * scale) };
}

/** The chamfer. Sharp cuts at top-left and bottom-right — asymmetric, so it reads as
 *  struck rather than as a hexagon. */
const PLATE = "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)";

export function RankEmblem({
  tierId,
  division = 1,
  size = "md",
  unranked = false,
  className = "",
}: {
  /** Tier id from RANK_TIERS, e.g. "gold". Selects the artwork. */
  tierId: string;
  /** 1–3, ascending. Legend is always 1. */
  division?: number;
  size?: EmblemSize;
  /**
   * Still in placement matches. A rating before placements are done is noise, and
   * rankForElo happily turns the 1000 everyone starts on into "Silver II" — so without
   * this a brand-new player is shown a Silver emblem next to the word "Unranked".
   */
  unranked?: boolean;
  className?: string;
}) {
  const spec = SIZES[size];
  const count = Math.max(1, Math.min(3, division));
  const known = EMBLEM_SIZES[`${tierId}-${count}`] !== undefined;

  // No rank to depict, or a tier id with no artwork behind it. The second case should be
  // unreachable, but a broken image in place of a rank is a worse failure than a plate.
  if (unranked || !known) {
    return (
      <span
        className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
        style={{ width: spec.px, height: spec.px }}
        aria-hidden="true"
      >
        <span
          className="absolute inset-0"
          style={{ clipPath: PLATE, backgroundColor: "var(--color-faint)" }}
        />
        <span
          className="absolute inset-[1.5px]"
          style={{ clipPath: PLATE, backgroundColor: "var(--color-ink-800)" }}
        />
      </span>
    );
  }

  /*
   * Small sizes: a fixed square box with the art contained inside it.
   *
   * Sized on the box rather than on the plate, which is the opposite of what the large
   * sizes do, and deliberate. Emblem widths run from 480 to 896 at a constant plate, so
   * plate-normalised sizing here would make every leaderboard row a different width and
   * shove the handles around. Row alignment is worth more than grow-with-rank at 28px —
   * and the rank is named in text beside the mark at every one of these call sites.
   */
  if (size === "sm" || size === "md") {
    return (
      // Plain <img>, not next/image: fixed-size decorative art already exported at the
      // right resolution, next/image is used nowhere else in this codebase, and the
      // optimiser would cost a round trip to save nothing.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/ranks/sm/${tierId}-${count}.png`}
        alt=""
        aria-hidden="true"
        className={`shrink-0 select-none object-contain ${spec.box} ${className}`}
      />
    );
  }

  const art = artSize(tierId, count, spec.px)!;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/ranks/${tierId}-${count}.png`}
      alt=""
      aria-hidden="true"
      className={`shrink-0 select-none ${className}`}
      style={{ width: art.width, height: art.height }}
    />
  );
}
