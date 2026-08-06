/**
 * The glyph set.
 *
 * The previous build carried its identity in emoji and stray unicode — ⚡ 🔥 🎵 ◆ ▲ ▼ ■
 * ☠ ⚑ ⚙ 🔇 🔊 — which renders differently on every OS and never sat on the same optical
 * weight as the type around it.
 *
 * These are the twelve marks the app actually needs, drawn on one 16×16 grid with one
 * stroke weight, sized in `em` so they scale with whatever text they sit in. No
 * dependency, no icon font, no network request.
 */

import { badgeById, type BadgeTone } from "@/engine/badges";

export type GlyphName =
  | "tier" // a scoring tier was earned
  | "rank" // rank / ladder
  | "bot" // synthetic opponent
  | "streak" // consecutive wins
  | "damage" // health lost
  | "skip" // pass on a round
  | "mute"
  | "sound"
  | "timer"
  | "win"
  | "loss"
  | "draw"
  | "song"
  | "settings"
  | "leave"
  | "user" // the player themselves — profile, account
  | "chevron"; // a menu that opens

const PATHS: Record<GlyphName, React.ReactNode> = {
  // A struck spark — the SNAP mark.
  tier: <path d="M9 1.5 3.5 9h3.2l-.7 5.5L12.5 7H9.3z" />,
  // The emblem silhouette, so the chevron plate has a inline-size counterpart.
  rank: <path d="M8 1.5l5.5 3v7L8 14.5 2.5 11.5v-7z" />,
  // A blunt machine head: flat top, square eyes. Reads as "not a person" at 12px.
  bot: (
    <>
      <path d="M3.5 5.5h9v7h-9z" />
      <path d="M8 2v3.5" />
      <path d="M6 8.5h.01M10 8.5h.01" strokeWidth="2" />
    </>
  ),
  // Stacked ascending bars — momentum without borrowing a flame.
  streak: <path d="M3 12.5V10m4.5 2.5v-5M12 12.5v-8" strokeWidth="2" />,
  // A downward strike.
  damage: <path d="M8 2.5v9m0 0 3.5-3.5M8 11.5 4.5 8" />,
  skip: <path d="M4 4l5 4-5 4zm7 0v8" />,
  mute: (
    <>
      <path d="M8 3.5 4.5 6.5H2.5v3h2L8 12.5z" />
      <path d="M11 6.5l3 3m0-3-3 3" />
    </>
  ),
  sound: (
    <>
      <path d="M8 3.5 4.5 6.5H2.5v3h2L8 12.5z" />
      <path d="M10.5 6a3 3 0 0 1 0 4" />
    </>
  ),
  timer: (
    <>
      <circle cx="8" cy="9" r="5" />
      <path d="M8 6.5V9l2 1.5M6.5 2h3" />
    </>
  ),
  win: <path d="M8 3.5 13 12H3z" />,
  loss: <path d="M8 12.5 3 4h10z" />,
  draw: <path d="M3 6.5h10M3 9.5h10" strokeWidth="2" />,
  // A record: the disc and the spindle hole.
  song: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.25" />
    </>
  ),
  // Sliders rather than a gear — a gear reads as machinery, sliders read as preferences.
  settings: (
    <>
      <path d="M2.5 5h11M2.5 11h11" />
      <circle cx="6" cy="5" r="1.6" />
      <circle cx="10.5" cy="11" r="1.6" />
    </>
  ),
  // Door with an arrow leaving it.
  leave: (
    <>
      <path d="M9.5 2.5h-6v11h6" />
      <path d="M12.5 8h-6m6 0-2.2-2.2M12.5 8l-2.2 2.2" />
    </>
  ),
  // Head and shoulders. The one mark that means "you" rather than "your standing".
  user: (
    <>
      <circle cx="8" cy="5.5" r="2.75" />
      <path d="M2.75 14c0-2.9 2.35-5 5.25-5s5.25 2.1 5.25 5" />
    </>
  ),
  // Direction of travel for a disclosure. Rotated by the caller when it points up.
  chevron: <path d="M4 6.5 8 10.5l4-4" />,
};

/**
 * Marks that cannot be filled, because they enclose no area.
 *
 * `filled` swaps `stroke` for `fill`, which works for the solid silhouettes it was written
 * for — `tier`, `win`, `loss` and `rank` are all closed polygons. `damage` and `streak` are
 * open strokes: an arrow and three bars. Filling them paints nothing at all, so the mark
 * silently disappears and the caller is left with an empty 1em box.
 *
 * That shipped in three places — the third rule on the public landing page, the icon on the
 * error screen that is supposed to signal something broke, and the daily streak badge — and
 * no test could see it, because an SVG that renders nothing still renders.
 *
 * Honouring the request would be wrong here, so it is ignored rather than obeyed: these
 * names always stroke.
 */
const UNFILLABLE: ReadonlySet<GlyphName> = new Set(["damage", "streak"]);

export function Glyph({
  name,
  className = "",
  filled = false,
}: {
  name: GlyphName;
  className?: string;
  /** Solid marks (win/loss/rank/tier) read better filled at small sizes. */
  filled?: boolean;
}) {
  return (
    <Mark className={className} filled={filled && !UNFILLABLE.has(name)}>
      {PATHS[name]}
    </Mark>
  );
}

/** The shared 16×16 shell. One viewBox, one stroke weight, sized in `em`. */
function Mark({
  children,
  className,
  filled,
}: {
  children: React.ReactNode;
  className: string;
  filled: boolean;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={`inline-block size-[1em] shrink-0 ${className}`}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/**
 * Badge art.
 *
 * Kept apart from `GlyphName` deliberately: those are UI affordances that carry a
 * `filled` convention and appear in navigation, and these are awards. Same grid and same
 * stroke weight, so they sit on the app's optical weight — but a badge is never a button.
 *
 * Keyed by the badge id from engine/badges.ts. These replace the emoji set
 * (🩸⚡🎯🔥👑🥶🗡️🏅) that survived the last icon pass: emoji render as a different
 * illustration on every operating system, which is precisely the objection Glyph was
 * created to answer, and the badge case was the last place they were left.
 */
const BADGE_PATHS: Record<string, React.ReactNode> = {
  // A droplet. The first blood drawn.
  first_blood: <path d="M8 2.25c0 0-4.25 5.05-4.25 7.5a4.25 4.25 0 0 0 8.5 0c0-2.45-4.25-7.5-4.25-7.5z" />,
  // The SNAP spark — the same struck mark the score tier uses, because this badge is
  // literally a count of SNAPs.
  snap_10: <path d="M9 1.5 3.5 9h3.2l-.7 5.5L12.5 7H9.3z" />,
  // The same spark, ringed. Mastery of the thing above it, not a different thing.
  snap_100: (
    <>
      <path d="M9.1 3.5 5.6 8.4h2l-.4 3.6 3.4-5.1H8.5z" />
      <circle cx="8" cy="8" r="6.25" />
    </>
  ),
  // An unbroken shield. Flawless is "took no damage", so the mark must have no gap.
  flawless: <path d="M8 2.25 13.25 4.4v4.3c0 3.05-2.5 4.85-5.25 5.35-2.75-.5-5.25-2.3-5.25-5.35V4.4z" />,
  // Round the bottom and back up. A comeback is a shape, not a crown.
  comeback: (
    <>
      <path d="M3.25 3v4.75a4.25 4.25 0 0 0 4.25 4.25h4.25" />
      <path d="m9.5 9.5 2.5 2.5-2.5 2.5" />
    </>
  ),
  // A pulse holding steady, then spiking. Nerves under sudden death.
  sudden_death: <path d="M1.75 9h3l1.6-4.5L8.9 13l1.6-4h3.75" />,
  // A struck peak: the giant, and the line through it.
  giant_slayer: (
    <>
      <path d="M2.5 13 7 4.5 11.5 13z" />
      <path d="M13.5 3 9 14" />
    </>
  ),
  // A tally. One hundred matches is a count, so the mark counts.
  centurion: (
    <>
      <path d="M3.5 4v8M6.25 4v8M9 4v8M11.75 4v8" />
      <path d="M2.25 12.75 13 3.25" />
    </>
  ),
};

/**
 * Badge colour, keyed by the tone on the definition.
 *
 * `signal-text` rather than `signal` because a badge mark is small and `signal` is only
 * legal at 24px and up — the same substitution the profile's match rows make.
 */
const BADGE_TONES: Record<BadgeTone, string> = {
  signal: "text-signal-text",
  gold: "text-gold",
  paper: "text-paper",
  teal: "text-teal",
  neutral: "text-secondary",
};

export function BadgeMark({
  id,
  className = "",
  muted = false,
}: {
  id: string;
  className?: string;
  /** Locked, or otherwise not earned — drawn in the decorative tone instead. */
  muted?: boolean;
}) {
  const badge = badgeById(id);
  // An unknown id is a data problem, not a rendering one — draw nothing rather than a
  // broken box. `badgeById` has already dropped unknown ids everywhere this is called.
  const art = BADGE_PATHS[id];
  if (!art) return null;

  // Colour resolved here rather than at each call site, so a badge is the same colour on
  // the VS panel, the profile case and the post-match celebration without three files
  // having to agree about it.
  const tone = muted ? "text-faint" : BADGE_TONES[badge?.tone ?? "neutral"];

  return (
    <Mark className={`${tone} ${className}`} filled={false}>
      {art}
    </Mark>
  );
}
