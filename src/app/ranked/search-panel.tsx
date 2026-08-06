"use client";

import { motion } from "motion/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { BOT_FALLBACK_MS } from "@/engine/matchmaking";
import { BotBadge } from "@/game/ui";
import { Button } from "@/ui/Button";
import { Card, Meter, SectionLabel } from "@/ui/Surface";
import { useQueue } from "../queue-driver";

/**
 * The search, as a readout rather than a spinner.
 *
 * A spinner says "wait"; this says what is being done. Both figures on it are real and
 * were already being computed and discarded — `playersWaiting` came back from
 * `queueStatus` and was only ever read as a boolean, and `eloBandFor` is the exact
 * function the server matches on, imported rather than reimplemented so the range drawn
 * here cannot drift from the range being searched.
 *
 * The shape follows the two matchmaking screens that get this right: a meter counting
 * down to whatever happens next (Destiny), and your rating in the centre with the
 * opponent band opening either side of it (chess.com).
 *
 * Lifted out of page.tsx when /ranked was rebuilt around a full-bleed hero. Behaviour is
 * unchanged — the only edit is that it no longer carries its own horizontal padding, so
 * the hero can place it in the same column as the button it replaces. It is the strongest
 * thing on this route and was deliberately left alone.
 *
 * It wears `variant="hero"` because it is now the SUBJECT of the searching screen rather
 * than a card at the foot of a stack. That does not spend a second licensed sheen: this is
 * the searching composition's only hero surface, and the idle composition has none at all
 * since the stakes card became a track (see rank-progress.tsx) — the two never render
 * together anyway, because the hero swaps compositions rather than swapping a slot.
 */
export function SearchPanel() {
  const queue = useQueue();
  const me = useQuery(api.users.me, {});

  const seconds = Math.floor(queue.waitingMs / 1000);
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  // Placements have no rating to open a band around, so the range is simply not shown —
  // the same rule the hero uses to decide whether to print a rating at all.
  const placed = me !== undefined && me !== null && me.placementsRemaining === 0;
  const band = Math.round(queue.band);

  const botIn = Math.max(0, BOT_FALLBACK_MS - queue.waitingMs);
  const botSeconds = Math.ceil(botIn / 1000);

  return (
    /**
     * The floor exists to stop Cancel moving under a finger already reaching for it.
     *
     * Falling back drops the rating-range block and the queue count and adds one short
     * paragraph — about 48px net — and the panel is centred in the viewport now, so that
     * shrink lifts every control on it by half as much again. The number is the measured
     * height of the placed, still-searching branch, which is the tallest this panel gets.
     *
     * Conditional because it is only that branch that changes height mid-search: a player
     * in placements never renders the range block at all, and pinning them to a floor
     * derived from it would just add 70px of empty card under the buttons.
     */
    <Card
      variant="hero"
      className={`flex flex-col gap-4 p-5 ${placed ? "min-h-[16.5rem]" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>{queue.fallingBack ? "No humans found" : "Searching"}</SectionLabel>
        <span className="font-display text-numeral text-paper font-extrabold tabular-nums">
          {elapsed}
        </span>
      </div>

      {/* The one thing on the panel that exists purely to say "this is alive". */}
      <div className="bg-ink-inset h-1 overflow-hidden rounded-full">
        <motion.div
          className="bg-gold h-full w-1/3 rounded-full"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
        />
      </div>

      {queue.fallingBack ? (
        <p className="text-body text-secondary" role="status">
          Matching you with a bot —{" "}
          <span className="text-paper font-medium">this one won&rsquo;t affect your rating.</span>
        </p>
      ) : (
        <>
          {placed && (
            <div className="flex flex-col gap-1.5">
              <div className="font-display flex items-center justify-between gap-3 font-extrabold tabular-nums">
                <span className="text-body-lg text-secondary">{me.elo - band}</span>
                <span className="text-label text-muted tracking-label uppercase">
                  Rating range
                </span>
                <span className="text-body-lg text-secondary">{me.elo + band}</span>
              </div>
              {/* The band as a proportion of its own ceiling: it fills as the search
                  reaches further, which is the honest picture of what widening means. */}
              <Meter
                value={band}
                max={1000}
                tone="gold"
                height="sm"
                label={`Searching ±${band} rating`}
              />
              <p className="text-label text-muted text-center tabular-nums">
                ±{band} and widening
              </p>
            </div>
          )}

          <div className="text-body-sm text-secondary flex flex-wrap items-center justify-between gap-x-4 gap-y-2 tabular-nums">
            <span className="flex items-center gap-2" role="status">
              <span className="bg-teal size-2 rounded-full" aria-hidden="true" />
              {queue.playersWaiting} {queue.playersWaiting === 1 ? "player" : "players"} in
              queue
            </span>
            <span className="text-muted">
              {botSeconds > 0 ? `bot offered in ${botSeconds}s` : "offering a bot"}
            </span>
          </div>
        </>
      )}

      {/* Offered from the first second rather than after an arbitrary wait: an empty
          ladder should hand you a game immediately, not make you earn one by waiting.
          The automatic fallback is the safety net for someone who walks away, not the
          primary route. */}
      {/* Reported here as well as on the idle screen: the fallback fires `startBot` on a
          timer with no control behind it, so this is the only place that failure can
          surface while the search is running. */}
      {queue.error && (
        <p className="text-body-sm text-signal-text" role="alert">
          {queue.error}
        </p>
      )}

      <div className="border-line flex flex-wrap items-center gap-3 border-t pt-4">
        {!queue.fallingBack && (
          <Button
            variant="secondary"
            loading={queue.pending === "startBot"}
            onClick={queue.startBot}
          >
            <BotBadge />
            Play a bot instead
          </Button>
        )}
        <Button
          variant="ghost"
          loading={queue.pending === "dequeue"}
          onClick={queue.dequeue}
        >
          Cancel
        </Button>
        <Link
          href="/daily"
          className="text-secondary hover:text-paper text-body-sm ml-auto rounded-xs underline"
        >
          Today&rsquo;s challenge
        </Link>
      </div>
    </Card>
  );
}
