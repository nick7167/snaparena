/**
 * The rank emblem — the app's signature object.
 *
 * This is the ONLY sharp-cornered thing in the entire product. Every surface, button,
 * input and chip is 4–16px rounded; the emblem is a hard chamfered plate. That
 * exclusivity is the whole idea: it reads as a trophy because nothing else is shaped
 * like it.
 *
 * The chevron count encodes the division. The rank system already has three divisions
 * per tier (see RANK_TIERS in src/engine/config.ts) but the old text badge threw that
 * away — "Gold II" told you nothing you could see. Now climbing is visible between
 * promotions, which is the point of having divisions at all.
 *
 * Colour comes in as a prop rather than being looked up here, because the accent is
 * resolved server-side and arrives on the scoreboard payload as `rankAccent`.
 */

export type EmblemSize = "sm" | "md" | "lg" | "xl";

const SIZES: Record<EmblemSize, { box: string; chevron: number; gap: number }> = {
  sm: { box: "h-6 w-5", chevron: 5, gap: 1 },
  md: { box: "h-9 w-7.5", chevron: 7, gap: 1.5 },
  lg: { box: "h-14 w-12", chevron: 11, gap: 2 },
  xl: { box: "h-28 w-24", chevron: 22, gap: 4 },
};

/** The chamfer. Sharp cuts at top-left and bottom-right — asymmetric, so it reads as
 *  struck rather than as a hexagon. */
const PLATE = "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)";

export function RankEmblem({
  accent,
  divisions = 1,
  size = "md",
  className = "",
}: {
  /** Hex from RANK_TIERS[].accent, delivered via the scoreboard payload. */
  accent: string;
  /** 1–3. Legend has a single division and renders as a solid plate instead. */
  divisions?: number;
  size?: EmblemSize;
  className?: string;
}) {
  const spec = SIZES[size];
  const count = Math.max(1, Math.min(3, divisions));

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${spec.box} ${className}`}
      // The plate is decorative; the rank is always named in text beside it.
      aria-hidden="true"
    >
      {/* Plate */}
      <span
        className="absolute inset-0"
        style={{ clipPath: PLATE, backgroundColor: accent, opacity: 0.16 }}
      />
      {/* Rim. Drawn as a second clipped plate inset by 1.5px rather than a border,
          because clip-path crops borders. */}
      <span
        className="absolute inset-0"
        style={{ clipPath: PLATE, backgroundColor: accent }}
      />
      <span
        className="absolute inset-[1.5px]"
        style={{ clipPath: PLATE, backgroundColor: "var(--color-ink-800)" }}
      />

      <span
        className="relative flex flex-col items-center"
        style={{ gap: `${spec.gap}px` }}
      >
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
