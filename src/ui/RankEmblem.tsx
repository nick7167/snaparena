/**
 * The rank emblem — the app's signature object.
 *
 * Two renditions, chosen by size:
 *
 *   sm / md   a chamfered plate in the tier accent, drawn in CSS. This is the same
 *             sharp-cornered shape as the wordmark, and it is the ONLY sharp-cornered
 *             thing in the product — every surface, button, input and chip is 4–16px
 *             rounded. That exclusivity is what makes it read as a trophy.
 *
 *   lg / xl   the generated artwork in public/ranks/. Sixteen bespoke emblems, one per
 *             rank, escalating from crude bronze slabs to the Legend crest.
 *
 * The split exists because the artwork is intricate and turns to mush below about 48px,
 * and five of the eight places this component is used are 24 or 36px. The plate stays
 * legible at any size and keeps the brand shape present in the dense parts of the UI.
 *
 * The chevron count on the CSS mark encodes the division, and divisions ascend — I is
 * the entry rank, III the top of a tier (see rankForElo). Legend has one division and
 * renders as a plain plate.
 */

import { EMBLEM_PLATE_WIDTH, EMBLEM_SIZES } from "./rank-emblems.generated";

export type EmblemSize = "sm" | "md" | "lg" | "xl";

const SIZES: Record<EmblemSize, { px: number; box: string; chevron: number; gap: number }> = {
  sm: { px: 24, box: "size-6", chevron: 5, gap: 1 },
  md: { px: 36, box: "size-9", chevron: 7, gap: 1.5 },
  // `box` is only used by the CSS mark and the unranked state; the artwork sizes itself
  // from the generated dimensions so it can grow with rank.
  lg: { px: 56, box: "size-14", chevron: 11, gap: 2 },
  xl: { px: 112, box: "size-28", chevron: 22, gap: 4 },
};

/**
 * `size` sets how wide the PLATE renders, not how big the whole emblem is.
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
  accent,
  size = "md",
  unranked = false,
  className = "",
}: {
  /** Tier id from RANK_TIERS, e.g. "gold". Selects the artwork. */
  tierId: string;
  /** 1–3, ascending. Legend is always 1. */
  division?: number;
  /** Hex from RANK_TIERS[].accent, delivered via the scoreboard payload. */
  accent: string;
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

  // A ghosted plate, no chevrons and no artwork: there is no rank to depict yet. Drawn
  // in --color-faint, which the design tokens reserve for decoration that is never
  // content.
  if (unranked) {
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

  const art = size === "lg" || size === "xl" ? artSize(tierId, count, spec.px) : null;
  if (art) {
    // Plain <img>, not next/image: fixed-size decorative art already exported at the
    // right resolution, next/image is used nowhere else in this codebase, and the
    // optimiser would cost a round trip to save nothing.
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

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${spec.box} ${className}`}
      // The mark is decorative; the rank is always named in text beside it.
      aria-hidden="true"
    >
      {/* Plate */}
      <span
        className="absolute inset-0"
        style={{ clipPath: PLATE, backgroundColor: accent, opacity: 0.16 }}
      />
      {/* Rim. Drawn as a second clipped plate inset by 1.5px rather than a border,
          because clip-path crops borders. */}
      <span className="absolute inset-0" style={{ clipPath: PLATE, backgroundColor: accent }} />
      <span
        className="absolute inset-[1.5px]"
        style={{ clipPath: PLATE, backgroundColor: "var(--color-ink-800)" }}
      />

      <span className="relative flex flex-col items-center" style={{ gap: `${spec.gap}px` }}>
        {Array.from({ length: count }, (_, index) => (
          <Chevron key={index} width={spec.chevron} accent={accent} />
        ))}
      </span>
    </span>
  );
}

function Chevron({ width, accent }: { width: number; accent: string }) {
  return (
    <svg
      width={width}
      height={width * 0.6}
      viewBox="0 0 10 6"
      fill={accent}
      aria-hidden="true"
      className="block"
    >
      <path d="M5 0l5 6H7.2L5 3.2 2.8 6H0z" />
    </svg>
  );
}
