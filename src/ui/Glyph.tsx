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
  | "leave";

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
};

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
      {PATHS[name]}
    </svg>
  );
}
