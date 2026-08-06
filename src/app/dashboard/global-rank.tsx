"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatGlobalRank, isNotable } from "@/engine/ranks";
import { Glyph } from "@/ui/Glyph";

/**
 * Where you sit on the ladder, as a struck chip.
 *
 * Lifted from the VS reveal, which solved this first ([stages.tsx] `VsPanel`): the notable
 * cutoff decides the TREATMENT rather than the presence. Everyone with a position gets it
 * quietly; the top hundred get it struck in gold with the trophy. Sharing `isNotable` with
 * the duel is the point — two screens disagreeing about what counts as notable would make
 * the distinction meaningless.
 *
 * The percentile is what turns a position into an answer. "#142" has no scale attached;
 * "#142 · TOP 12%" says the same thing and settles it. `rankedPlayerCount` is bounded, so
 * when it reports `approximate` the percentage is suppressed rather than guessed — a
 * percentile computed against a truncated population is a wrong number that looks right.
 */
/**
 * Below this many ranked players, a percentile is arithmetic without meaning.
 *
 * 100 so that every percentage point is at least one person. Under it the chip shows the
 * position alone, which is the whole truth at that scale anyway.
 */
const PERCENTILE_MIN_POPULATION = 100;

export function GlobalRank({
  position,
  approximate = false,
}: {
  position: number | null | undefined;
  /** The POSITION is a bucket floor, not an exact place. */
  approximate?: boolean;
}) {
  const ladder = useQuery(api.users.rankedPlayerCount, {});

  const label = formatGlobalRank(position, approximate);
  if (!label) return null;

  const notable = isNotable(position);

  /**
   * Suppressed rather than guessed in three cases.
   *
   * Two are correctness: a percentage of an unknown denominator, or of a position that is
   * itself a bucket floor, is not a percentage.
   *
   * The third is judgement. Below PERCENTILE_MIN_POPULATION the figure is arithmetically
   * true and useless — fourteenth of eighteen is "TOP 78%", which reads as an insult and
   * tells the reader nothing they could not get from "#14". A percentile earns its place
   * only once the population is big enough for a proportion to mean something.
   */
  const percentile =
    !approximate &&
    ladder &&
    !ladder.approximate &&
    ladder.count >= PERCENTILE_MIN_POPULATION &&
    position
      ? Math.max(1, Math.round((position / ladder.count) * 100))
      : null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={`text-label flex items-center gap-1 rounded-xs px-1.5 py-0.5 font-bold tracking-label tabular-nums ${
          notable ? "bg-gold text-ink-900" : "text-muted"
        }`}
      >
        {notable && <Glyph name="win" filled />}
        {label} GLOBAL
      </span>

      {percentile !== null && (
        <span className="text-label text-secondary font-bold tracking-label tabular-nums">
          TOP {percentile}%
        </span>
      )}
    </p>
  );
}
