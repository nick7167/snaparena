"use client";

import { SignedIn, SignedOut } from "../auth-gate";
import { useUser } from "@clerk/nextjs";
import { useReducer as useStdbReducer } from "spacetimedb/react";
import { track } from "@/analytics";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { reducers } from "@/module_bindings";
import {
  useActiveDailyMatch,
  useDailyLeaderboard,
  useMyDailyPlacing,
  useDailyStreak,
  useMatchState,
  useMe,
  useTodayStats,
} from "../db";
import { useConfig } from "../config";
import { DailyRunner } from "@/game/DailyRunner";
import { DailyResult } from "@/game/DailyResult";
import { usePrefetchTrackIndex } from "@/game/track-index";
import { DAILY_SONGS } from "@/engine/config";
import { rankForElo } from "@/engine/ranks";
import { Avatar } from "@/game/ui";
import { Button } from "@/ui/Button";
import { Card, Empty, Panel, Skeleton } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { rememberGuestToken } from "../guest";
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
  // Only for the analytics split. `isSignedIn` is undefined until Clerk resolves, and by
  // the time anyone can press Start it has.
  const { isSignedIn } = useUser();

  // Warm the local suggestion catalogue while the player reads the intro. The run itself
  // opens on a 3-second countdown, which is not long enough to fetch it from scratch.
  usePrefetchTrackIndex();

  const config = useConfig();
  const me = useMe();
  const myRun = useMyDailyPlacing(me?.id);
  // A run left in progress — from a refresh, a closed tab, or a second visit today.
  const activeRun = useActiveDailyMatch(me?.id);
  const start = useStdbReducer(reducers.startDaily);
  const complete = useStdbReducer(reducers.completeDaily);

  /**
   * Remember the claim ticket the module issued this guest.
   *
   * Written server-side onto the guest's own row and readable only through `me`, so
   * this stores what we were given rather than inventing one. It is what lets the
   * account created later inherit today's run.
   */
  useEffect(() => {
    if (me?.isGuest && me.guestClaimToken) rememberGuestToken(me.guestClaimToken);
  }, [me]);

  const [matchId, setMatchId] = useState<bigint | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const match = useMatchState(matchId ?? undefined, config);

  /**
   * Mount the live run as soon as the subscription names one.
   *
   * This is what replaces the id the start call used to return, and it covers the
   * reload case for free: a run left unfinished is picked up on load without the page
   * needing to ask for it.
   */
  useEffect(() => {
    if (activeRun && matchId !== activeRun.id) setMatchId(activeRun.id);
  }, [activeRun, matchId]);

  // Record the run once the final round closes.
  useEffect(() => {
    if (!matchId || match?.status !== "complete") return;
    void complete({ matchId });
    // Fired here rather than on the result screen, which also renders for a run finished
    // hours ago on a revisit — that would count one completion every time someone came
    // back to look at their score.
    track("daily_finish", { is_guest: !isSignedIn });
  }, [matchId, match?.status, complete, isSignedIn]);

  /**
   * Starts, or resumes, today's run.
   *
   * The `finally` is load-bearing. This used to be a bare `await` with `setStarting(false)`
   * as the last statement, so a rejected mutation skipped it and left the button in its
   * loading state — which `Button` also renders as disabled — with a page reload as the
   * only way out. That is the single entry point to the only mode a guest can play.
   */
  async function begin() {
    setStarting(true);
    setError(null);
    try {
      /**
       * The one place a guest identity is created — the module mints it for the
       * anonymous connection when this runs, so there is no token to send.
       *
       * A reducer returns nothing, so the match id does not come back either.
       * `startDaily` resumes an unfinished run rather than minting a second one, so
       * whatever appears in `activeRun` is the right match whether it was just created
       * or was already there, and the effect below mounts it.
       */
      await start();

      // `is_guest` is the denominator of the guest-to-signup funnel, and nothing in the
      // app could previously report it.
      track("daily_start", { is_guest: !isSignedIn, resumed: activeRun !== null });
    } catch {
      setError("Could not start today's run. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  const runningId = matchId ?? activeRun?.id ?? null;
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
        ) : status === "already-played" ? (
          /**
           * Handled explicitly rather than falling through to `Landing`.
           *
           * `myRun` normally resolves first and renders the result, so this is a race
           * — a second tab, or a slow subscription. It used to land on "Five songs… /
           * Start", which invites someone to start a run the server has already refused.
           */
          <Empty
            title="You've already played today"
            body="Your result is on its way — refresh if it doesn't appear."
          />
        ) : (
          <Landing
            starting={starting}
            resuming={activeRun !== null}
            error={error}
            onStart={begin}
          />
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
  error,
  onStart,
}: {
  starting: boolean;
  resuming: boolean;
  error: string | null;
  onStart: () => Promise<void>;
}) {
  const stats = useTodayStats();
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

      {error && (
        <p className="text-body-sm text-signal-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** The run you are on, on the page that decides whether it survives the night. */
function StreakBadge() {
  const streak = useDailyStreak(useMe()?.id);
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
      <span className="text-label text-muted tracking-label uppercase">
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

  const board = useDailyLeaderboard(date, 25);
  const me = useMe();

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
