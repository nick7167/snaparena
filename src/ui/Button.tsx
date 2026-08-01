import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The press.
 *
 * A solid fill and a hard, blur-free bottom edge. Pressing travels the control down by
 * exactly the edge height and collapses the edge, so it reads as an object pushed into
 * the page. There is no blurred shadow anywhere in this design — depth is this and
 * nothing else.
 *
 * The travel is worth the pixels: this game is played by stabbing at controls under a
 * 30-second clock, and a control that visibly moves confirms the hit without waiting
 * for the network.
 *
 * `--press-edge` is set inline per variant and consumed by the `.press` utility in
 * globals.css, which also drops the travel under prefers-reduced-motion.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, { className: string; edge: string }> = {
  // Gold rather than a brand tint: the primary action and the reward colour being the
  // same thing is the point — pressing this is how you get the gold.
  primary: {
    className: "bg-gold text-ink-900 hover:brightness-110",
    edge: "#9E7414",
  },
  secondary: {
    className: "bg-ink-600 text-paper border-line-strong border hover:bg-ink-500",
    edge: "#171B25",
  },
  // No fill, no edge — the only control type without mass, for genuinely minor actions.
  ghost: {
    className: "text-secondary hover:text-paper hover:bg-ink-700",
    edge: "transparent",
  },
  destructive: {
    className: "bg-signal text-paper hover:brightness-110",
    edge: "#8E211A",
  },
};

const SIZES: Record<ButtonSize, string> = {
  // min-h values keep every control at or above the 44px touch target on mobile,
  // except `sm`, which is only ever used inline next to text on desktop.
  sm: "min-h-9 px-3 text-body-sm gap-1.5",
  md: "min-h-11 px-5 text-body gap-2",
  lg: "min-h-13 px-7 text-body-lg gap-2.5",
};

/** Shared between the button and link forms so they are visually identical. */
function shape(variant: ButtonVariant, size: ButtonSize, block: boolean, extra: string) {
  const tone = VARIANTS[variant];
  const press = variant === "ghost" ? "" : size === "sm" ? "press-sm" : "press";

  return `inline-flex shrink-0 items-center justify-center rounded-md
          font-semibold whitespace-nowrap select-none
          disabled:pointer-events-none disabled:opacity-40
          ${tone.className} ${SIZES[size]} ${press}
          ${block ? "w-full" : ""} ${extra}`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and blocks interaction without changing the control's width. */
  loading?: boolean;
  /** Stretches to the container. Used for the primary action on phone layouts. */
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const tone = VARIANTS[variant];

  return (
    <button
      // A loading button that stays clickable is how you get double submissions on a
      // slow connection — which in this game means a duplicate mutation mid-round.
      disabled={disabled || loading}
      // Signalled rather than merely disabled: a screen reader user needs to know the
      // control is working, not that it vanished.
      aria-busy={loading || undefined}
      style={{ "--press-edge": tone.edge } as React.CSSProperties}
      className={shape(variant, size, block, className)}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/**
 * Navigation that looks like a control.
 *
 * A separate component rather than a polymorphic `as` prop: a link and a button differ
 * in more than their tag — a link has no disabled or loading state, and conflating them
 * is how you end up with an anchor that swallows clicks while "submitting".
 */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const tone = VARIANTS[variant];

  return (
    <Link
      href={href}
      style={{ "--press-edge": tone.edge } as React.CSSProperties}
      className={shape(variant, size, block, className)}
    >
      {children}
    </Link>
  );
}

/**
 * Deliberately a rotating arc rather than a pulsing dot: a spinner has to look like
 * time passing, and this one inherits currentColor so it works on every variant.
 */
function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4 shrink-0 animate-spin"
      fill="none"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
