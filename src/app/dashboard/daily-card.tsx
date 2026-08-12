"use client";

import Link from "next/link";
import { useDailyStreak, useMe, useMyDailyRun } from "../db";
import { DAILY_SONGS } from "@/engine/config";
import { Glyph } from "@/ui/Glyph";
import { Skeleton } from "@/ui/Surface";
import { CountUp } from "./motion";

/**
 * Today's challenge — the only thing on this screen with a deadline.
 *
 * Three states, and the middle one is the reason this is a component rather than a
 * button. `daily.activeRun` reports a run that was started and walked away from, and
 * until now that only surfaced on /daily itself: a player who abandoned mid-run and came
 * back to the dashboard was invited to "play" something they were already inside.
 *
 * The line under the title is the streak's, not the daily's. A challenge is a thing to
 * do; a streak about to break is a reason to do it now, and that is what the copy has to
 * carry once there is a streak to lose.
 */
export function DailyCard() {
  const me = useMe();
  const myRun = useMyDailyRun(me?.id);
  const streak = useDailyStreak(me?.id);

  /**
   * `api.daily.activeRun` is gone: an unfinished daily is a live match, and the module
   * resumes it on `startDaily` rather than the client needing to know first. The card
   * therefore stops distinguishing "resuming" from "not played" — pressing it does the
   * right thing either way, which it did not when the client had to choose.
   */
  const resuming = false;

  if (myRun === undefined) return <Skeleton className="h-20 w-full" />;

  const played = myRun !== null;

  // A streak is only at risk on a day it has not already been secured, and only if there
  // is one to lose. Any match keeps it alive, so this claims the daily *would* — never
  // that it is the only thing that can.
  const atRisk = !played && (streak?.current ?? 0) > 0 && !streak?.playedToday;

  const caption = played
    ? null
    : resuming
      ? `You left this one unfinished`
      : atRisk
        ? `Keeps your ${streak?.current}-day streak alive`
        : `${DAILY_SONGS} songs · one shot`;

  return (
    <Link
      href="/daily"
      style={{ ["--press-edge" as string]: played ? "var(--color-edge-ink)" : "var(--color-edge-gold)" }}
      className={`press flex items-center gap-4 rounded-md px-5 py-4 transition-[filter] hover:brightness-110 ${
        played ? "bg-ink-700 text-paper" : "bg-gold text-ink-900"
      }`}
    >
      <span className="text-2xl leading-none">
        <Glyph name="song" filled={!played} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-display text-body-lg font-extrabold tracking-wide">
          {resuming ? "Resume today's challenge" : "Today's challenge"}
        </span>
        {caption && (
          <span
            className={`text-label font-medium ${played ? "text-muted" : "opacity-75"}`}
          >
            {caption}
          </span>
        )}
      </span>

      {played ? (
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="font-display text-numeral font-extrabold tabular-nums">
            <CountUp value={myRun.totalPoints} /> pts
          </span>
          {/* The placing is gone rather than recomputed. `daily.myRun` returned a rank
              and a denominator because it could count the day's rows server-side; doing
              that on the client would mean subscribing to every run of the day to render
              one line on a card. The board on /daily already shows the placing, against
              rows it needs anyway. */}
        </span>
      ) : (
        // Quarter-turned: the set's only chevron points down, for menus.
        <span className="shrink-0 -rotate-90 text-xl leading-none">
          <Glyph name="chevron" />
        </span>
      )}
    </Link>
  );
}
