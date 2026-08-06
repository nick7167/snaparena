"use client";

import type { Stakes } from "@/engine/stakes";
import { rankForElo } from "@/engine/ranks";
import { Meter } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";

/**
 * How far through your rank you are, and what the next match can change.
 *
 * This replaced a bordered card that sat between the rating and the Find a match button.
 * The information was right and the instrument was wrong: a three-line panel is a second
 * surface competing with the primary control, and on a screen bound to one viewport it was
 * taking its height from the emblem — the only element allowed to grow, and the subject of
 * the page.
 *
 * As a track it belongs to the emblem instead of interrupting the column, states the same
 * distance as a position rather than a sentence, and costs a fraction of the height.
 *
 * What it deliberately does NOT show is a projected rating swing — "win +18, lose −16".
 * Elo delta needs an opponent's rating, which does not exist until matchmaking has run, so
 * any figure here would be invented and would be wrong the moment a stronger or weaker
 * player answered the queue. See `stakes.ts` for what is derivable instead.
 */
export function RankProgress({ elo, stakes }: { elo: number; stakes: Stakes }) {
  const rank = rankForElo(elo);
  const { headline, atRisk } = stakes;

  // Null at the summit, which is the only state with nothing above it to measure against.
  const next =
    rank.nextAt === null
      ? null
      : { label: rankForElo(rank.nextAt).label, away: rank.nextAt - elo };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Only the destination is labelled. The rank you are leaving is the heading directly
          above this, and naming it again here just said "Silver I" twice in two lines. */}
      <div className="text-label flex items-baseline justify-end tracking-label">
        {next ? (
          <span className="text-muted font-bold tabular-nums">
            <span className="text-paper">{next.away}</span> TO {next.label.toUpperCase()}
          </span>
        ) : (
          <span className="text-gold font-bold">TOP OF THE LADDER</span>
        )}
      </div>

      <Meter
        // A summit player has nothing above them, so the track reads as complete rather
        // than as a bar that can never fill.
        value={next ? rank.progress : 1}
        max={1}
        height="sm"
        tone={next ? "teal" : "gold"}
        label={
          next
            ? `${rank.label}, ${next.away} rating from ${next.label}`
            : `${rank.label} — top of the ladder`
        }
      />

      {/* Only what the bar cannot already say. A promotion gap is the track itself; a rival
          or an unsettled rating is not, and would be lost without a line of its own. */}
      {headline?.kind === "pass-rival" && (
        <p className="text-body-sm text-secondary tabular-nums">
          {headline.away} to pass @{headline.handle} — a good win covers it.
        </p>
      )}
      {headline?.kind === "settling" && (
        <p className="text-body-sm text-secondary tabular-nums">
          {headline.games} {headline.games === 1 ? "match" : "matches"} until your rating
          settles. Swings drop to ±{stakes.evenSwing} once it does.
        </p>
      )}

      {/**
       * What a loss could cost — a line of its own, never the headline.
       *
       * This page exists to get someone to press a button, and leading with what they stand
       * to lose is the wrong instrument. `stakes.ts` only fills this in when a single loss
       * could genuinely reach the floor, so it is absent for most players most of the time
       * rather than a permanent warning nobody reads.
       */}
      {atRisk && (
        <p className="text-body-sm text-signal-text flex items-center gap-1.5 tabular-nums">
          <Glyph name="loss" />
          {atRisk.gap === 0
            ? `On the ${atRisk.label} line — a loss drops you.`
            : `${atRisk.gap} above the ${atRisk.label} line.`}
        </p>
      )}
    </div>
  );
}
