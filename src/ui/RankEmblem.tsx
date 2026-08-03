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

/**
 * The chamfer. Sharp cuts at top-left and bottom-right — asymmetric, so it reads as
 * struck rather than as a hexagon.
 *
 * Exported because it is the app's signature geometry and more than this file wears it
 * now. This percentage form is for square plates only; anything with a non-square aspect
 * uses the `.plate` utility in globals.css, which cuts a fixed length instead.
 */
export const PLATE = "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)";

export function RankEmblem({
  tierId,
  division = 1,
  size = "md",
  unranked = false,
  bloom,
  fit = false,
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
  /**
   * The tier's accent, which lights an ambient bloom behind the artwork.
   *
   * One of the three licensed exceptions to the no-glow law (see globals.css), and
   * deliberately opt-in: it is for the two screens that make the emblem the subject —
   * the profile hero and the VS reveal — not for every emblem in a list. Ignored at
   * sm/md, where the mark is an inline marker rather than the thing you are looking at.
   */
  bloom?: string;
  /**
   * Let the emblem cap itself to the height it is given, instead of always rendering at
   * its natural plate-normalised size. Large sizes only.
   *
   * The VS reveal is bound to the viewport, and the emblem is the element chosen to give
   * up height first — but `size` writes a fixed pixel width and height inline, which no
   * class on a parent can override. This keeps the natural size as the ceiling and adds a
   * `max-height: 100%` floor beneath it, so a tall screen still shows a Legend physically
   * larger than a Bronze and a short one simply fits them both.
   */
  fit?: boolean;
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
        className={`relative inline-flex items-center justify-center ${
          // The fitting variant must not force a height on the box it sits in, or a
          // placements panel would lay out differently from a ranked one beside it.
          fit ? "max-h-full max-w-full" : "shrink-0"
        } ${className}`}
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

  /*
   * The fitting variant, drawn as an absolutely-positioned child of a box it fills.
   *
   * The obvious version — natural height with `max-height: 100%` — silently does nothing.
   * A percentage max-height resolves against the parent's height, and a parent sized by
   * `flex-1` or by its own `max-height` has no DEFINITE height to resolve against, so the
   * cap is dropped and the artwork renders at full size straight through whatever sits
   * below it. On the VS reveal that was the rank name, with the plinth printed over it.
   *
   * Taking the image out of flow removes the question: `inset-0` gives it the box's real
   * height to work with, the two pixel maxima stop it ever growing past the size the
   * plate normalisation asked for, `margin: auto` centres it once those bite, and
   * `object-contain` keeps the aspect ratio at every size in between.
   */
  /* eslint-disable @next/next/no-img-element */
  const image = fit ? (
    <img
      src={`/ranks/${tierId}-${count}.png`}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 m-auto size-full select-none object-contain"
      style={{ maxWidth: art.width, maxHeight: art.height }}
    />
  ) : (
    <img
      src={`/ranks/${tierId}-${count}.png`}
      alt=""
      aria-hidden="true"
      className={`shrink-0 select-none ${bloom ? "" : className}`}
      style={{ width: art.width, height: art.height }}
    />
  );
  /* eslint-enable @next/next/no-img-element */

  // Out of flow, so it needs a positioned box to fill. The box contributes no intrinsic
  // height of its own — that is the point: it takes the height it is given and the
  // artwork follows, rather than the artwork dictating the layout.
  if (fit) {
    return (
      <span
        className={`relative block min-h-0 w-full ${bloom ? "bloom-tier" : ""} ${className}`}
        style={bloom ? { ["--tier-accent" as string]: bloom } : undefined}
      >
        {image}
      </span>
    );
  }

  if (!bloom) return image;

  // Wrapped rather than applied to the <img> itself: the bloom draws on a ::before at
  // z-index -1, which needs a positioned parent that is not the transparent artwork.
  return (
    <span
      className={`bloom-tier inline-flex ${fit ? "min-h-0 max-h-full" : "shrink-0"} ${className}`}
      style={{ ["--tier-accent" as string]: bloom }}
    >
      {image}
    </span>
  );
}
