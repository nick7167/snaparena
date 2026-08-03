"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { BADGES } from "@/engine/badges";
import { Avatar } from "@/game/ui";
import { useNow } from "@/game/usePrefersReducedMotion";
import { Chip, SectionLabel } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";

/**
 * How long ago, in words.
 *
 * Ticked from `useNow` rather than read once at render: this sits on a screen a player
 * leaves open, and "just now" that is still claiming to be just now twenty minutes later
 * is worse than no timestamp at all.
 */
function timeAgo(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/**
 * Your most recent match, and what it paid.
 *
 * The reward moment. Everything here was shown once already, on the results screen, at a
 * point where the player had just spent nine songs earning it and was mostly reading the
 * scoreboard. Restating it here is not repetition — it is the difference between a thing
 * that happened and a thing you have.
 *
 * The verdict is the loudest element, struck on the app's own chamfer in the tone of the
 * outcome. That is the ordering a player actually reads in: did I win, by how much, and
 * against whom. An earlier version led with the rating delta and buried "beat @rival" in
 * secondary text, which asked them to work out the result from the sign of a number.
 *
 * Renders nothing when there is no news. A panel saying "no recent activity" is a panel
 * arguing for its own existence; this one simply is not there until the first match,
 * which is also exactly what a first-week player should see.
 *
 * Costs no query of its own: `matches.history` is already subscribed by `RecentMatches`
 * further down the page, and Convex dedupes identical subscriptions.
 */
export function LastResult() {
  const me = useQuery(api.users.me, {});
  const matches = useQuery(api.matches.history, me ? { userId: me._id } : "skip");
  const now = useNow(60_000);

  const last = matches?.[0];
  if (!me || !last) return null;

  const promoted =
    last.levelBefore !== null &&
    last.levelAfter !== null &&
    last.levelAfter > last.levelBefore;

  const badges = last.badgesEarned
    .map((id) => BADGES.find((badge) => badge.id === id))
    .filter((badge): badge is (typeof BADGES)[number] => badge !== undefined);

  // A practice match moves no rating, so without a badge or a level-up it has nothing to
  // report and the panel stays out of the way.
  const hasNews = last.ratingDelta !== null || promoted || badges.length > 0;
  if (!hasNews) return null;

  const verdict = last.drawn ? "Draw" : last.won ? "Won" : "Lost";
  const tone = last.drawn
    ? { plate: "var(--color-line-strong)", text: "text-secondary" }
    : last.won
      ? { plate: "var(--color-gold)", text: "text-gold" }
      : { plate: "var(--color-signal)", text: "text-signal-text" };

  const rewards = promoted || badges.length > 0;

  return (
    <Link
      href={`/m/${last.matchId}?p=${me._id}`}
      className="border-line bg-ink-800 hover:border-line-strong group flex flex-col gap-4
                 rounded-md border px-5 py-4 transition-colors"
    >
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>Your last match</SectionLabel>
        <span className="text-label text-muted shrink-0">
          {timeAgo(last.completedAt, now)}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* The verdict, struck on the same chamfer the rank emblem is cut on. Two stacked
            fills because `clip-path` would cut a border away at the two cut corners. */}
        <span className="relative isolate flex shrink-0 items-center justify-center px-4 py-2">
          <span
            aria-hidden="true"
            className="plate absolute inset-0 -z-10"
            style={{ ["--plate-cut" as string]: "10px", backgroundColor: tone.plate }}
          />
          <span
            aria-hidden="true"
            className="plate bg-ink-900 absolute inset-[1.5px] -z-10"
            style={{ ["--plate-cut" as string]: "10px" }}
          />
          <span
            className={`font-display text-body-lg font-extrabold tracking-wide uppercase ${tone.text}`}
          >
            {verdict}
          </span>
        </span>

        {/* Zero is its own case, not a small win — a loss at the rating floor reports a
            delta of 0, and colouring that gold would be a lie told by a symbol. */}
        {last.ratingDelta !== null && (
          <span className="flex shrink-0 flex-col">
            <span
              className={`font-display text-numeral flex items-center gap-1 font-extrabold tabular-nums ${
                last.ratingDelta > 0
                  ? "text-gold"
                  : last.ratingDelta < 0
                    ? "text-signal-text"
                    : "text-muted"
              }`}
            >
              {last.ratingDelta !== 0 && (
                <span className={last.ratingDelta > 0 ? "" : "rotate-180"}>
                  <Glyph name="win" filled />
                </span>
              )}
              {last.ratingDelta > 0 ? "+" : ""}
              {last.ratingDelta}
            </span>
            <span className="text-label text-muted tracking-[0.14em] uppercase">
              Rating
            </span>
          </span>
        )}

        {last.opponent && (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-label text-faint shrink-0 uppercase">vs</span>
            <Avatar
              url={last.opponent.avatarUrl}
              name={last.opponent.handle || last.opponent.displayName}
              className="size-6 shrink-0 text-[10px]"
            />
            <span className="text-body-sm text-paper min-w-0 truncate font-medium">
              {last.opponent.isBot
                ? last.opponent.displayName
                : `@${last.opponent.handle}`}
            </span>
            {/* Named, because a practice match reports no rating and a player is
                otherwise left wondering why the number did not move. */}
            {last.mode === "practice" && (
              <span className="text-label text-muted shrink-0">practice</span>
            )}
          </span>
        )}

        {/* The one chevron in the set points down, for menus. Turned a quarter so it
            reads as "go to the match" rather than "expand this". */}
        <span className="text-muted group-hover:text-paper shrink-0 -rotate-90 text-lg leading-none transition-colors">
          <Glyph name="chevron" />
        </span>
      </div>

      {rewards && (
        <div className="border-line flex flex-wrap items-center gap-2 border-t pt-3">
          {promoted && (
            <Chip tone="teal" size="sm">
              <Glyph name="tier" filled />
              Level {last.levelBefore} → {last.levelAfter}
            </Chip>
          )}
          {badges.map((badge) => (
            <Chip key={badge.id} tone="gold" size="sm">
              <span aria-hidden="true">{badge.emoji}</span>
              {badge.name}
            </Chip>
          ))}
        </div>
      )}
    </Link>
  );
}
