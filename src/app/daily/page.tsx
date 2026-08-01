"use client";

import { SignedOut } from "../auth-gate";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DailyRunner } from "@/game/DailyRunner";
import { DailyResult } from "@/game/DailyResult";
import { Button } from "@/ui/Button";
import { Card, Empty, SectionLabel, Skeleton } from "@/ui/Surface";
import { ensureGuestToken, getGuestToken } from "../guest";
import { useNow } from "@/game/usePrefersReducedMotion";

/**
 * The daily challenge: five tracks, identical worldwide, one attempt per day.
 *
 * This is the growth surface, and the only mode playable without an account. A
 * sign-in wall here was asking strangers to commit before they had heard a single
 * second of the game.
 *
 * Anonymous players are held to the same one-run-per-day rule as everyone else,
 * enforced server-side against a token in localStorage — see src/app/guest.ts for
 * exactly what that does and does not prevent.
 */
export default function DailyPage() {
  // Read rather than created: visiting the page must not mint an identity, only
  // starting a run does.
  const guestToken = getGuestToken();

  const myRun = useQuery(api.daily.myRun, { guestToken });
  // A run left in progress — from a refresh, a closed tab, or a second visit today.
  const activeRun = useQuery(api.daily.activeRun, { guestToken });
  const start = useMutation(api.daily.start);
  const complete = useMutation(api.daily.complete);

  const [matchId, setMatchId] = useState<Id<"matches"> | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const match = useQuery(
    api.matches.state,
    matchId ? { matchId, guestToken } : "skip",
  );

  // Record the run once the final round closes.
  useEffect(() => {
    if (!matchId || match?.status !== "complete") return;
    void complete({ matchId, guestToken });
  }, [matchId, match?.status, complete, guestToken]);

  async function begin() {
    // The one place a guest identity is created. Signed-in players still send a
    // token if they have a stale one; the server ignores it in favour of the session.
    const result = await start({ guestToken: ensureGuestToken() });
    if (result.status === "started") setMatchId(result.matchId);
    else if (result.status === "already-played") setStatus("already-played");
    else setStatus("catalogue-too-small");
  }

  /**
   * Which run is on screen, if any.
   *
   * Two sources, both derived — no effect writes this. `matchId` is the run started in
   * this session; `activeRun` is one already in progress on the server, which is what
   * makes a mid-run refresh land back in the game instead of on the landing screen
   * showing a "Start" button.
   *
   * `myRun` wins over both: it only becomes non-null once `complete` has written the
   * row, so the runner stays mounted across that gap and then falls away on its own.
   * Unmounting is what releases immersive mode and brings the navigation back.
   */
  const runningId = matchId ?? activeRun?.matchId ?? null;
  if (runningId && !myRun) return <DailyRunner matchId={runningId} />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6 px-4 py-12">
      <h1 className="font-display text-display-1 font-extrabold">Today&rsquo;s challenge</h1>

      {myRun ? (
        <DailyResult run={myRun} />
      ) : status === "catalogue-too-small" ? (
        <Empty
          title="The catalogue is too small"
          body="There aren't enough tracks to build today's set yet."
        />
      ) : (
        <>
          <p className="text-body-lg text-secondary">
            Five songs. Everyone in the world gets the same five today. One attempt.
          </p>
          <SignedOut>
            <p className="text-body-sm text-muted">
              No account needed. Sign in afterwards to put your score on the board.
            </p>
          </SignedOut>
          <Button size="lg" className="w-fit" onClick={() => void begin()}>
            Start
          </Button>
        </>
      )}

      <DailyLeaderboard />
    </div>
  );
}

/**
 * The daily board, with date navigation.
 *
 * `daily.leaderboard` has always accepted a `date` argument that nothing ever passed —
 * so every past day's board was already being built and was simply unreachable. This
 * just gives it a way in.
 */
function DailyLeaderboard() {
  // Offset in days back from today. Read from state rather than a URL param so the
  // board can be browsed without losing your place on the page.
  const [daysBack, setDaysBack] = useState(0);
  // Ticked through useNow rather than reading the clock in render, which is impure and
  // would also miss the midnight-UTC rollover while the page sits open.
  const now = useNow(60_000);
  const date = dateKeyFor(now, daysBack);

  const board = useQuery(api.daily.leaderboard, { date, limit: 25 });
  const isToday = daysBack === 0;

  return (
    <section className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{isToday ? "Today's board" : formatDate(date)}</SectionLabel>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous day"
            onClick={() => setDaysBack((current) => current + 1)}
          >
            ‹ Earlier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next day"
            // Bounded at today — there is no future board to browse to.
            disabled={isToday}
            onClick={() => setDaysBack((current) => Math.max(0, current - 1))}
          >
            Later ›
          </Button>
        </div>
      </div>

      {board === undefined ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : board.length === 0 ? (
        <Empty
          title={isToday ? "Nobody has played yet today" : "No scores that day"}
          body={isToday ? "Be the first one on the board." : undefined}
        />
      ) : (
        <ol className="flex flex-col gap-1.5">
          {board.map((entry) => (
            <Card
              as="li"
              key={entry.handle}
              className="text-body flex justify-between gap-3 px-3 py-2.5"
            >
              <span className="flex min-w-0 gap-3">
                <span className="font-display text-muted w-6 shrink-0 text-right font-bold tabular-nums">
                  {entry.rank}
                </span>
                <Link href={`/u/${entry.handle}`} className="truncate rounded-xs hover:underline">
                  @{entry.handle}
                </Link>
              </span>
              <span className="font-display text-paper font-bold tabular-nums">
                {entry.totalPoints}
              </span>
            </Card>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * UTC date key N days back, matching `todayKey` on the server.
 *
 * UTC rather than local: the daily rolls over at midnight UTC for everyone, so a local
 * date would ask for the wrong board either side of the boundary.
 */
function dateKeyFor(now: number, daysBack: number): string {
  return new Date(now - daysBack * 86_400_000).toISOString().slice(0, 10);
}

function formatDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  });
}
