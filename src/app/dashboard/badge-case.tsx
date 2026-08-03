"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BADGES } from "@/engine/badges";
import { BadgeMark } from "@/ui/Glyph";
import { Meter, SectionLabel, Skeleton } from "@/ui/Surface";

/**
 * Counters for the badges that have one.
 *
 * Four of the eight are thresholds over a number the user row already carries, so their
 * progress is free. The other four are situational — win from below a quarter health,
 * beat someone 200 points above you — and have no counter anywhere, which is correct:
 * inventing a "0 / 1" for them would dress a thing that either happens or does not up as
 * a task you are partway through.
 */
const COUNTED: Record<string, (me: Me) => { have: number; need: number }> = {
  first_blood: (me) => ({ have: Math.min(me.rankedWins ?? 0, 1), need: 1 }),
  snap_10: (me) => ({ have: Math.min(me.snapGuesses ?? 0, 10), need: 10 }),
  snap_100: (me) => ({ have: Math.min(me.snapGuesses ?? 0, 100), need: 100 }),
  centurion: (me) => ({ have: Math.min(me.gamesPlayed, 100), need: 100 }),
};

type Me = NonNullable<ReturnType<typeof useQuery<typeof api.users.me>>>;

/**
 * The badge case.
 *
 * All eight, always — earned ones lit and unearned ones ghosted. Showing only what has
 * been earned turns an empty case into an empty space and tells a new player nothing
 * about what the game rewards; showing all eight turns the same panel into a list of
 * things to go and do, which is what it should be on day one and what it stops being
 * once it is full.
 *
 * "Next up" picks the countable badge nearest completion, so it always names something
 * the player can actually move.
 */
export function BadgeCase() {
  const me = useQuery(api.users.me, {});
  const card = useQuery(api.matches.card, me ? { userId: me._id } : "skip");

  if (me === undefined || card === undefined) return <Skeleton className="h-32 w-full" />;
  if (!me || !card) return null;

  const earned = new Set(card.badges.map((badge) => badge.id));

  const next = BADGES.filter((badge) => !earned.has(badge.id) && COUNTED[badge.id])
    .map((badge) => ({ badge, ...COUNTED[badge.id](me) }))
    .sort((a, b) => b.have / b.need - a.have / a.need)[0];

  return (
    <section className="border-line bg-ink-800 flex flex-col gap-4 rounded-md border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>Badges</SectionLabel>
        <span className="text-label text-muted tabular-nums">
          {earned.size} of {BADGES.length}
        </span>
      </div>

      {/* A grid, not wrapped flex. Eight items over `flex-1 basis-*` leaves the last row
          stretching its one or two survivors across the full width, which reads as a
          different kind of thing rather than as the same case continued. */}
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {BADGES.map((badge) => {
          const has = earned.has(badge.id);
          return (
            <li
              key={badge.id}
              title={`${badge.name} — ${badge.description}`}
              className={`flex min-w-0 flex-col items-center gap-1.5 rounded-sm px-1 py-2.5 transition-colors ${
                has ? "bg-ink-700" : "bg-ink-inset"
              }`}
            >
              {/* `muted` rather than an opacity filter: BadgeMark already owns the
                  locked tone, and every other surface that draws a badge gets its
                  colour from there. */}
              <span className="text-xl leading-none">
                <BadgeMark id={badge.id} muted={!has} />
              </span>
              <span
                className={`text-label w-full truncate text-center font-semibold ${
                  has ? "text-secondary" : "text-faint"
                }`}
              >
                {badge.name}
              </span>
            </li>
          );
        })}
      </ul>

      {next && (
        <div className="border-line flex flex-col gap-1.5 border-t pt-3">
          <div className="text-label flex items-baseline justify-between gap-3">
            <span className="text-secondary">
              Next up — <span className="text-paper font-semibold">{next.badge.name}</span>
            </span>
            <span className="text-muted tabular-nums">
              {next.have} / {next.need}
            </span>
          </div>
          <Meter
            value={next.have}
            max={next.need}
            tone="gold"
            height="sm"
            label={`${next.badge.name}: ${next.have} of ${next.need}`}
          />
          <p className="text-label text-muted">{next.badge.description}</p>
        </div>
      )}
    </section>
  );
}
