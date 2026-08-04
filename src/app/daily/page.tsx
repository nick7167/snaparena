"use client";

import { SignedIn, SignedOut } from "../auth-gate";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DailyRunner } from "@/game/DailyRunner";
import { DailyResult } from "@/game/DailyResult";
import { usePrefetchTrackIndex } from "@/game/track-index";
import { DAILY_SONGS } from "@/engine/config";
import { rankForElo } from "@/engine/ranks";
import { Avatar } from "@/game/ui";
import { Button } from "@/ui/Button";
import { Card, Empty, Panel, Skeleton } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { ensureGuestToken, getGuestToken } from "../guest";
import { useNow } from "@/game/usePrefersReducedMotion";
import { Beat, CountUp } from "../dashboard/motion";
import { STREAK_WINDOW_DAYS } from "@/engine/streak";

/**
 * The daily challenge: five tracks, identical worldwide, one attempt per day.
 *
 * This is the growth surface, and the only mode playable without an account. A sign-in
 * wall here was asking strangers to commit before they had heard a second of the game.
 *
 * Anonymous players are held to the same one-run-per-day rule as everyone else, enforced
 * server-side against a token in localStorage — see src/app/guest.ts for exactly what
 * that does and does not prevent.
 *
 * NOTE for anyone adding copy here: this is a SOLO mode and `guest-daily.spec.ts` asserts
 * the body never matches /\bHP\b/, nor any of a list of duel-only phrases. Health, draws
 * and opponents do not exist on this route and must not appear in its vocabulary.
 */
export default function DailyPage() {
  return (
    // `useSearchParams` suspends during prerender; the board is the only thing that reads
    // it, but the boundary has to sit above anything that could.
    <Suspense fallback={null}>
      <Daily />
    </Suspense>
  );
}

function Daily() {
  // Read rather than created: visiting the page must not mint an identity, only starting
  // a run does.
  const guestToken = getGuestToken();

  // Warm the local suggestion catalogue while the player reads the intro. The run itself
  // opens on a 3-second countdown, which is not long enough to fetch it from scratch.
  usePrefetchTrackIndex();

  const myRun = useQuery(api.daily.myRun, { guestToken });
  // A run left in progress — from a refresh, a closed tab, or a second visit today.
  const activeRun = useQuery(api.daily.activeRun, { guestToken });
  const start = useMutation(api.daily.start);
  const complete = useMutation(api.daily.complete);

  const [matchId, setMatchId] = useState<Id<"matches"> | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const match = useQuery(api.matches.state, matchId ? { matchId, guestToken } : "skip");

  // Record the run once the final round closes.
  useEffect(() => {
    if (!matchId || match?.status !== "complete") return;
    void complete({ matchId, guestToken });
  }, [matchId, match?.status, complete, guestToken]);

  async function begin() {
    setStarting(true);
    // The one place a guest identity is created. Signed-in players still send a token if
    // they have a stale one; the server ignores it in favour of the session.
    const result = await start({ guestToken: ensureGuestToken() });
    if (result.status === "started") setMatchId(result.matchId);
    else setStatus(result.status);
    setStarting(false);
  }

  const runningId = matchId ?? activeRun?.matchId ?? null;
  if (runningId && !myRun) return <DailyRunner matchId={runningId} />;

  /**
   * Loading is its own state, and it used to be rendered as the landing.
   *
   * Both queries resolve to `undefined` first, and the old render treated that exactly
   * like "no run" — so a player who had already played, and anyone refreshing mid-run,
   * was shown "Five songs… / Start" for a beat before it corrected itself. Inviting
   * someone to start a run they cannot start is the worst thing this page can say.
   */
  const loading = myRun === undefined || activeRun === undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <Beat index={0} className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-display-1 font-extrabold">
          Today&rsquo;s challenge
        </h1>
        <SignedIn>
          <StreakBadge />
        </SignedIn>
      </Beat>

      <Beat index={1}>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : myRun ? (
          <DailyResult run={myRun} />
        ) : status === "catalogue-too-small" ? (
          <Empty
            title="The catalogue is too small"
            body="There aren't enough tracks to build today's set yet."
          />
        ) : (
          <Landing starting={starting} resuming={activeRun !== null} onStart={begin} />
        )}
      </Beat>

      <Beat index={2}>
        <DailyBoard myRank={myRun?.rank ?? null} myPoints={myRun?.totalPoints ?? null} />
      </Beat>
    </div>
  );
}

/** The pitch, the deadline, and the one control. */
function Landing({
  starting,
  resuming,
  onStart,
}: {
  starting: boolean;
  resuming: boolean;
  onStart: () => Promise<void>;
}) {
  const stats = useQuery(api.daily.todayStats, {});
  const now = useNow(60_000);

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-body-lg text-secondary">
        {DAILY_SONGS} songs. Everyone in the world gets the same {DAILY_SONGS} today. One
        attempt.
      </p>

      {/* Two facts that were computed and shown anywhere but here: how many people have
          played, and how long is left. `todayStats` was rendered only on the landing
          page; the rollover was a static "come back tomorrow". */}
      <p className="text-body-sm text-muted flex flex-wrap items-center gap-x-2 tabular-nums">
        {stats && stats.players > 0 && (
          <>
            <span>
              {stats.atLeast ? "over " : ""}
              {stats.players.toLocaleString()}{" "}
              {stats.players === 1 ? "player" : "players"} today
            </span>
            <span className="text-faint" aria-hidden="true">
              ·
            </span>
          </>
        )}
        <span>resets in {untilRollover(now)}</span>
      </p>

      <SignedOut>
        <p className="text-body-sm text-muted">
          No account needed. Sign in afterwards to put your score on the board.
        </p>
      </SignedOut>

      {/* The accessible name stays exactly "Start" — three specs find this button by it. */}
      <Button size="lg" className="w-fit" loading={starting} onClick={() => void onStart()}>
        {resuming ? "Resume today's run" : "Start"}
      </Button>

      {resuming && (
        <p className="text-body-sm text-secondary">
          You left today&rsquo;s run unfinished — this picks it up where it stopped.
        </p>
      )}
    </div>
  );
}

/** The run you are on, on the page that decides whether it survives the night. */
function StreakBadge() {
  const streak = useQuery(api.users.dailyStreak, {});
  if (!streak || streak.current === 0) return null;

  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-gold text-lg leading-none">
        <Glyph name="streak" filled />
      </span>
      <CountUp
        value={streak.current}
        className="font-display text-numeral text-paper font-extrabold"
      />
      <span className="text-label text-muted tracking-[0.14em] uppercase">
        day{streak.current === 1 ? "" : "s"}
      </span>
    </span>
  );
}

/**
 * The daily board.
 *
 * The date lives in the URL now (`?d=YYYY-MM-DD`), bounded to a week. It was component
 * state before, so a past board was neither shareable nor linkable, and "‹ Earlier" paged
 * backwards without limit into an unbounded run of empty days with only repeated clicks
 * to get home.
 */
function DailyBoard({
  myRank,
  myPoints,
}: {
  myRank: number | null;
  myPoints: number | null;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const now = useNow(60_000);

  const today = dateKeyFor(now, 0);
  const requested = params.get("d");
  // Clamped to the window rather than trusted: a hand-typed date outside it would ask the
  // server for a board this UI has no way back from.
  const date = isWithinWindow(requested, now) ? requested! : today;
  const isToday = date === today;

  const board = useQuery(api.daily.leaderboard, { date, limit: 25 });
  const me = useQuery(api.users.me, {});

  const setDate = (next: string) => {
    router.replace(next === today ? "/daily" : `/daily?d=${next}`, { scroll: false });
  };

  // Only meaningful for today's board — `myRun` is today's run.
  const onBoard = board?.some((entry) => entry.handle === me?.handle) ?? false;
  const showMyRow = isToday && !!me && myRank !== null && myPoints !== null && !onBoard;
  const accent = me ? rankForElo(me.elo).tier.accent : undefined;

  return (
    <Panel
      title={isToday ? "Today's board" : formatDate(date)}
      aside={
        !isToday && (
          <button
            onClick={() => setDate(today)}
            className="text-label text-secondary hover:text-paper rounded-xs uppercase transition-colors"
          >
            Today
          </button>
        )
      }
    >
      {/* A week of days, so the reachable range is visible rather than something you
          discover by clicking until the boards go empty. */}
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: STREAK_WINDOW_DAYS }, (_, index) => {
          const key = dateKeyFor(now, STREAK_WINDOW_DAYS - 1 - index);
          const active = key === date;
          return (
            <button
              key={key}
              onClick={() => setDate(key)}
              aria-current={active ? "date" : undefined}
              className={`text-label rounded-xs px-2 py-1 font-bold tabular-nums transition-colors ${
                active
                  ? "bg-ink-600 text-paper"
                  : "text-muted hover:bg-ink-700 hover:text-secondary"
              }`}
            >
              {key === today ? "Today" : shortDate(key)}
            </button>
          );
        })}
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
          {board.map((entry) => {
            const isMe = entry.handle === me?.handle;
            return (
              <Card
                as="li"
                key={entry.handle}
                you={isMe}
                accent={isMe ? accent : undefined}
                className="text-body flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-display text-muted w-6 shrink-0 text-right font-bold tabular-nums">
                    {entry.rank}
                  </span>
                  {/* The server has always returned this and the board always threw it
                      away — a list of handles reads as a database, a list of faces reads
                      as people. */}
                  <Avatar
                    url={entry.avatarUrl}
                    name={entry.handle}
                    className="size-7 shrink-0 text-xs"
                  />
                  <Link
                    href={`/u/${entry.handle}`}
                    className="truncate rounded-xs hover:underline"
                  >
                    @{entry.handle}
                  </Link>
                </span>
                <span className="font-display text-paper shrink-0 font-bold tabular-nums">
                  {entry.totalPoints}
                </span>
              </Card>
            );
          })}
        </ol>
      )}

      {/* Pinned when you finished outside the visible page. Your own rank was on this
          same screen the whole time and the board had no way to show you where you were. */}
      {showMyRow && (
        <div className="border-line border-t pt-3">
          <Card
            you
            accent={accent}
            className="text-body flex items-center justify-between gap-3 px-3 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="font-display text-paper w-6 shrink-0 text-right font-bold tabular-nums">
                {myRank}
              </span>
              <Avatar
                url={me.avatarUrl}
                name={me.handle}
                className="size-7 shrink-0 text-xs"
              />
              <span className="truncate font-semibold">You</span>
            </span>
            <span className="font-display text-paper shrink-0 font-bold tabular-nums">
              {myPoints}
            </span>
          </Card>
        </div>
      )}
    </Panel>
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

/** Inside the browsable week, and not in the future. */
function isWithinWindow(key: string | null, now: number): boolean {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return key <= dateKeyFor(now, 0) && key >= dateKeyFor(now, STREAK_WINDOW_DAYS - 1);
}

/** How long until the board resets, in the coarsest unit that is still true. */
function untilRollover(now: number): string {
  const next = Date.parse(`${dateKeyFor(now + 86_400_000, 0)}T00:00:00.000Z`);
  const minutes = Math.max(0, Math.round((next - now) / 60_000));
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function shortDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
  });
}

function formatDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  });
}
