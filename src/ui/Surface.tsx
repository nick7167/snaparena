import type { ReactNode } from "react";

/**
 * Surfaces, chips and meters.
 *
 * These three replace the copy-paste that had accumulated across the build: roughly
 * fifteen `rounded-xl border border-white/10 bg-white/5` divs, and five separately
 * hand-rolled progress bars that had drifted apart in height, radius and colour.
 */

/** A raised panel. The default container for anything grouped. */
export function Card({
  children,
  className = "",
  /** Draws attention without colour — used for "this row is you". */
  emphasis = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  emphasis?: boolean;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      className={`rounded-md ${
        emphasis ? "bg-ink-600 border-teal border-l-4" : "bg-ink-700 border-line border"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Section heading. The only place uppercase tracking is used. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-label text-muted font-semibold tracking-[0.12em] uppercase">
      {children}
    </h2>
  );
}

export type ChipTone = "neutral" | "gold" | "signal" | "teal" | "paper";

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "bg-ink-600 text-secondary",
  gold: "bg-gold text-ink-900",
  signal: "bg-signal text-paper",
  teal: "bg-teal text-ink-900",
  // Pure paper is reserved for SNAP and Legend — the top of every ladder in this app is
  // the absence of hue, so nothing else may use this tone.
  paper: "bg-paper text-ink-900",
};

export function Chip({
  children,
  tone = "neutral",
  size = "md",
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: ChipTone;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-xs font-semibold whitespace-nowrap
                  ${CHIP_TONES[tone]}
                  ${size === "sm" ? "text-label px-1.5 py-0.5" : "text-body-sm px-2 py-1"}
                  ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Progress / health meter.
 *
 * One implementation for HP, XP and the veto clock. `tone` is passed rather than
 * derived so the caller owns the meaning — HP colours by remaining health, XP is always
 * gold, and the meter itself stays dumb.
 *
 * Announced via role="progressbar" so a screen reader user can hear health drain; the
 * label is required for that reason.
 */
export function Meter({
  value,
  max,
  tone = "teal",
  height = "md",
  label,
  className = "",
  children,
}: {
  value: number;
  max: number;
  tone?: "teal" | "gold" | "signal" | "paper" | "muted";
  height?: "xs" | "sm" | "md" | "lg";
  /** Required — this is the accessible name for the progressbar. */
  label: string;
  className?: string;
  /** Overlay content, e.g. the ghost bar showing health just lost. */
  children?: ReactNode;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  const fills = {
    teal: "bg-teal",
    gold: "bg-gold",
    signal: "bg-signal",
    paper: "bg-paper",
    muted: "bg-muted",
  } as const;

  const heights = { xs: "h-1", sm: "h-1.5", md: "h-2.5", lg: "h-4" } as const;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      /**
       * The hairline is what makes an EMPTY meter legible.
       *
       * `--color-ink-inset` is #0a0c12 against an #0f1219 page, so a bar at 0% used to
       * render as nothing at all — a new player at 0/300 XP saw no progress track, only
       * a gap between two labels. Drawn as an inset shadow rather than a border so it
       * costs no layout at any of the four heights; `h-1` has no room to give.
       */
      className={`bg-ink-inset relative overflow-hidden rounded-full
                  shadow-[inset_0_0_0_1px_var(--color-line)]
                  ${heights[height]} ${className}`}
    >
      {children}
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${fills[tone]}`}
        style={{ width: `${pct}%`, transition: "width 700ms var(--ease-drain)" }}
      />
    </div>
  );
}

/**
 * Loading placeholder.
 *
 * Replaces five bare "Loading…" strings that had four different tones between them. A
 * shape that matches what is coming reads as the page arriving; a word reads as a stall.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-ink-600 animate-pulse rounded-sm ${className}`}
    />
  );
}

/**
 * Empty state.
 *
 * Every list in the app needed one and none had a consistent shape. Deliberately has no
 * illustration — the "line-art robot" empty state is exactly the corporate-SaaS default
 * this design is avoiding.
 */
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-12 text-center">
      <p className="text-body-lg text-paper font-semibold">{title}</p>
      {body && <p className="text-body text-muted max-w-sm">{body}</p>}
      {action}
    </div>
  );
}
