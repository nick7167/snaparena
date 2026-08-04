"use client";

import type { ReactNode } from "react";
import { MuteToggle } from "@/ui/MuteToggle";

/**
 * The controls that belong to a match rather than to a phase.
 *
 * These used to be a pill floating at `fixed top-3 left-3`, which worked on desktop for the
 * wrong reason: the content column is centred there, so there happened to be empty gutter
 * under the pill. On a phone the column fills the viewport and the pill landed directly on
 * top of "Round 1" — the header it was supposed to sit beside.
 *
 * So this is in normal flow and reserves its own height. Nothing can collide with it at any
 * viewport, because nothing is overlaying anything. The float was the bug, not the position.
 *
 * Rendered ABOVE the phase switch by both runners, so it survives every beat — including the
 * VS reveal and the results screen, where the match header renders nothing at all and there
 * was previously no way out.
 */
/**
 * The row's height, as a CSS length.
 *
 * Declared rather than measured, and the row below is given exactly this height, so the
 * two cannot drift. Stages that bind themselves to the viewport subtract it via the
 * `--match-chrome` custom property — see `Stage`'s `fit` branch.
 *
 * 2.75rem is also the minimum comfortable touch target, which is the floor for a row
 * carrying two tap targets anyway.
 */
export const MATCH_CHROME_HEIGHT = "2.75rem";

export function MatchChrome({
  leave,
  meta,
}: {
  /** The leave control. Supplied by the runner so the confirm copy can match the mode. */
  leave: ReactNode;
  /** Round or song counter. Centred, and the one thing here that changes during play. */
  meta?: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-11 w-full max-w-2xl items-center gap-2 px-2">
      {/* The two flanking cells are `flex-1` with a centred `meta` between them, rather than
          `justify-between` — otherwise the counter drifts sideways as the leave label and
          the mute icon change width, and a round number that moves is hard to read. */}
      <div className="flex flex-1 justify-start">{leave}</div>

      {meta && (
        <div className="text-label text-secondary flex shrink-0 items-center gap-2 tracking-[0.1em]">
          {meta}
        </div>
      )}

      <div className="flex flex-1 justify-end">
        <MuteToggle />
      </div>
    </div>
  );
}
