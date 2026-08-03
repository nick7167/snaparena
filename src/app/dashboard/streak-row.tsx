"use client";

import type { Streak } from "@/engine/streak";
import { Glyph } from "@/ui/Glyph";

/** Initials by `getUTCDay`, which counts from Sunday. */
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * The week, Monday to Sunday.
 *
 * The row is the part a number cannot do. A count says how long the run is; the row says
 * which day is about to break it, which is the only version a player can act on. Today
 * reads as an open slot rather than a miss right up until midnight — that is the whole
 * reason the walk treats it separately.
 *
 * Fixed to the calendar week rather than the last seven days: a rolling window puts a
 * different weekday under each column every morning, so the letters rotate and nobody can
 * find yesterday in it.
 *
 * A forgiven day is drawn as a marked gap rather than hidden. Duolingo's finding is that
 * the repair has to be applied silently and DISCOVERED afterwards: a player who never
 * learns they were carried does not feel carried, and one who is asked to spend
 * something at the moment of failure simply does not spend it.
 */
export function StreakRow({ streak }: { streak: Streak }) {
  return (
    /* No count and no flame here: the stat strip above already carries the number, and
       stating it twice inside one card made the card look like two cards. This is the
       week itself — the part a number cannot show. */
    // Caption underneath, like the two meters beside it. With the label on top the days
    // sat a line lower than the bars they share a row with, so three cells that are the
    // same kind of thing read as two things and a stray one.
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex items-center gap-1">
          {streak.days.map((day) => {
            const weekday = WEEKDAY[new Date(`${day.date}T00:00:00.000Z`).getUTCDay()];

            /**
             * Five states, and the distinctions between them are the whole point of
             * drawing a week rather than a number. A day you skipped and got away with is
             * not a day you failed; a day that has not arrived is neither.
             */
            const tone = day.played
              ? "bg-gold text-ink-900"
              : day.forgiven
                ? "bg-ink-600 text-secondary"
                : day.today
                  ? "border-line-strong text-muted border border-dashed"
                  : day.future
                    ? "bg-ink-inset/50 text-faint"
                    : "bg-ink-inset text-faint";

            return (
              <span
                key={day.date}
                title={
                  day.played
                    ? `${day.date} — played`
                    : day.forgiven
                      ? `${day.date} — missed, streak held`
                      : day.today
                        ? "Today — still open"
                        : day.future
                          ? `${day.date} — still to come`
                          : `${day.date} — missed`
                }
                className={`text-label flex size-5 items-center justify-center rounded-xs
                            font-bold tabular-nums ${tone}`}
              >
                {day.forgiven ? <Glyph name="skip" /> : weekday}
              </span>
            );
          })}
      </span>
      <span className="text-label text-muted tracking-[0.14em] uppercase">This week</span>
    </div>
  );
}
