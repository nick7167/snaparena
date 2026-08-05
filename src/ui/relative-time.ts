/**
 * Relative time, in words, for the whole app.
 *
 * THERE WERE THREE OF THESE, and they disagreed. `dashboard/last-result.tsx` counted from
 * "just now" through minutes and hours; `u/[handle]/page.tsx` started at whole days, said
 * "today" in lower case, and printed a bare `3 Aug` with no year; `m/[matchId]/page.tsx`
 * started at whole days, said "Today" in title case, and printed `3 Aug 2025`. The last of
 * those carried a comment claiming it matched the history list, which it did not.
 *
 * The player-visible cost was that one match read three different ways depending on which
 * screen you were looking at — "2 hours ago" on the dashboard, "today" on the profile,
 * "Today" on its own page — and a match older than a year was undatable on the profile,
 * because the year was missing.
 *
 * Pure functions with an explicit `now`, deliberately. Every caller already ticks a clock
 * through `useNow`, and reading `Date.now()` in here would make the output depend on when
 * a component happened to render rather than on the clock it is sharing.
 */

/** Rendered when a timestamp is older than the relative window. */
const ABSOLUTE = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * How long ago, in words.
 *
 * Ticked from `useNow` rather than read once at render: this sits on screens a player
 * leaves open, and "just now" still claiming to be just now twenty minutes later is worse
 * than no timestamp at all.
 *
 * Past 30 days it becomes a date rather than "14 months ago", because at that distance the
 * actual day is the more useful fact — and the date ALWAYS carries its year. The profile
 * used to omit it, which made every match in an account's second year ambiguous.
 */
export function timeAgo(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  return ABSOLUTE.format(new Date(then));
}

/**
 * The same thing, capitalised, for somewhere it opens a sentence or stands alone as a
 * label. One implementation rather than a second set of thresholds — the previous split
 * was where "today" and "Today" came from.
 */
export function timeAgoCapitalized(then: number, now: number): string {
  const text = timeAgo(then, now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * How long until a deadline, in the coarsest unit that is still true.
 *
 * The forward-looking counterpart, and the same "A · B" line uses both — the leaderboard's
 * "updated 2m ago · next in 3m". Lives beside it so the pair cannot drift into two
 * different ideas of how long a minute is.
 *
 * Clamped at zero: a deadline that has passed reads "now" rather than counting negative,
 * which is what a viewer sees in the seconds between a due rebuild and its arrival.
 */
export function timeUntil(deadline: number, now: number): string {
  const minutes = Math.max(0, Math.round((deadline - now) / 60_000));
  if (minutes < 1) return "now";

  const hours = Math.floor(minutes / 60);
  if (hours >= 1) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
