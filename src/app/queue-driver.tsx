"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { play } from "@/audio/sfx";
import {
  BOT_FALLBACK_MS,
  BOT_FALLBACK_NOTICE_MS,
  eloBandFor,
} from "@/engine/matchmaking";
import { useNow } from "@/game/usePrefersReducedMotion";

/**
 * The matchmaking queue, lifted out of the page that used to own it.
 *
 * All of this — the poll that actually finds the match, the bot fallback, the elapsed
 * clock — lived inside the `Queue` component on /ranked. Navigating away unmounted it,
 * which left the player enqueued on the server with nothing on the client looking for
 * their opponent: the queue row sat there until they came back and re-entered the page.
 * Searching was, in effect, cancelled by opening the leaderboard.
 *
 * It lives in the shell now for the same reason NavRecorder does — the shell is the only
 * thing mounted on every route. Searching survives navigation, the Play button can report
 * it from anywhere, and a match that lands while you are elsewhere pulls you into it.
 */

/** The bullet is doing the work here — a tab strip shows very little else. */
const SEARCHING_TITLE = "● Searching… — Snap";

interface QueueState {
  /** Null until Clerk resolves or while signed out — no queue to speak of. */
  inQueue: boolean;
  /** Milliseconds since enqueue, ticked client-side. Zero when not searching. */
  waitingMs: number;
  /** How many players are in the queue right now, this one included. */
  playersWaiting: number;
  /** Rating either side of yours the server is currently reaching. */
  band: number;
  /** The pool is empty and the automatic bot match is about to fire. */
  fallingBack: boolean;
  /** Set the instant a match is found, ahead of the `activeMatch` subscription. */
  matchId: Id<"matches"> | null;
  enqueue: () => void;
  dequeue: () => void;
  /** Take the bot offer now rather than waiting out the fallback. */
  startBot: () => void;
  /** Clear the local match handle when a match ends. */
  clearMatch: () => void;
}

const QueueContext = createContext<QueueState | null>(null);

/**
 * Read the queue.
 *
 * Returns a dormant state rather than throwing when the provider is absent, so a
 * component can be rendered in the design gallery or a test without the whole shell.
 */
export function useQueue(): QueueState {
  return useContext(QueueContext) ?? DORMANT;
}

const DORMANT: QueueState = {
  inQueue: false,
  waitingMs: 0,
  playersWaiting: 0,
  band: eloBandFor(0),
  fallingBack: false,
  matchId: null,
  enqueue: () => {},
  dequeue: () => {},
  startBot: () => {},
  clearMatch: () => {},
};

export function QueueProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();

  /**
   * Signed in is not enough — the Convex row has to exist too.
   *
   * Both queries below call `requireUser`, which throws for an identity with no row, and
   * a query that throws takes the render down with it. Clerk resolves a brand-new account
   * a beat before `ensureUser` has created its row, so gating on `isSignedIn` alone put a
   * hard error on the first screen of every new player's first session — the one screen
   * that has to work. `users.me` returns null rather than throwing in exactly that window,
   * which is the same signal the provisioner uses, and it is already subscribed elsewhere
   * so this costs nothing.
   */
  const me = useQuery(api.users.me, isLoaded && isSignedIn ? {} : "skip");
  const ready = me !== undefined && me !== null;

  /**
   * Split deliberately.
   *
   * This provider wraps the whole app, so whatever it subscribes to is live on every
   * route for every signed-in user. `queueStatus` bundled "am I queued" together with a
   * count of the pool, and counting the pool reads every queue row — so one person
   * pressing Find a match re-executed that query once per signed-in user, everywhere.
   *
   * `myQueueEntry` reads one row and so is invalidated only by your own entry. The count
   * is subscribed only while you are actually searching, which is the only time it is
   * rendered.
   */
  const status = useQuery(api.ranked.myQueueEntry, ready ? {} : "skip");
  const inQueue = status?.inQueue === true;
  const pool = useQuery(api.ranked.queueSize, ready && inQueue ? {} : "skip");

  // Subscribed here rather than on the page so the reconciliation below can see it, and
  // so a reload mid-match still drops you back in. Only ever returns a LIVE match.
  const activeMatch = useQuery(api.ranked.activeMatch, ready ? {} : "skip");

  const enqueueMutation = useMutation(api.ranked.enqueue);
  const dequeueMutation = useMutation(api.ranked.dequeue);
  const tryMatchmake = useMutation(api.ranked.tryMatchmake);
  const startBotMatch = useMutation(api.bots.startBotMatch);

  const router = useRouter();
  const pathname = usePathname();

  /**
   * The match, held locally as well as subscribed.
   *
   * `activeMatch` goes null the moment a match completes, but the results screen has to
   * survive that — so the local id is what keeps the arena mounted while you read your
   * rating change, exactly as the page's own state used to. It is cleared by pressing
   * Play again, and by the reconciliation below.
   */
  const [held, setHeld] = useState<Id<"matches"> | null>(null);

  // Ticked client-side from the server's `enqueuedAt`. A Convex query does not re-run on
  // a timer, so anything elapsed has to be computed here or it stands still.
  const now = useNow(1000);
  const waitingMs = status?.enqueuedAt ? Math.max(0, now - status.enqueuedAt) : 0;

  /**
   * Landing a match, from either route.
   *
   * The id is held here as well as being derivable from `activeMatch` so the arena can
   * mount on the same tick the match is created, rather than a round trip later.
   */
  const onMatched = useCallback(
    (id: Id<"matches">) => {
      play("match_found");
      setHeld(id);
      // Ranked is where a duel is rendered. Arriving from anywhere else — the ladder, a
      // profile, settings — has to end up there or the match plays out unwatched.
      if (pathname !== "/ranked") router.push("/ranked");
    },
    [pathname, router],
  );

  /**
   * Let go of a match that is over and behind you.
   *
   * Holding it forever is the cost of the id outliving the page it used to live on:
   * finish a duel, wander off to the ladder without pressing Play again, come back, and
   * without this you would be looking at the results of a match you had already read
   * instead of the queue.
   *
   * Adjusted during render on a route change rather than in an effect — this is the
   * "reset state when something changes" case, and doing it in an effect would render the
   * stale match once before correcting itself. React re-runs this component immediately
   * and commits nothing in between.
   *
   * A match the server still calls live is never dropped: the whole point is to put you
   * back into a duel in progress. That also makes this safe in the instant after a match
   * is found, when the push to /ranked has been issued but `pathname` is still the old
   * route.
   */
  const [heldRoute, setHeldRoute] = useState(pathname);
  if (heldRoute !== pathname) {
    setHeldRoute(pathname);
    if (held !== null && activeMatch !== held) setHeld(null);
  }

  /**
   * Adopt whatever the server currently calls live.
   *
   * `held` is what keeps the results screen mounted after `activeMatch` goes null, so it
   * has to be set while the match is still running. The poll used to do this from its
   * own callback; with the server pairing instead, the id arrives through the
   * subscription and is adopted here.
   *
   * During render rather than in an effect, for the same reason as the reset above: an
   * effect would mount the queue for one frame before swapping to the arena.
   */
  if (activeMatch && held !== activeMatch) setHeld(activeMatch);

  const matchId = held ?? activeMatch ?? null;

  const startBot = useCallback(async () => {
    const result = await startBotMatch({});
    if (result.status === "started" && result.matchId) onMatched(result.matchId);
  }, [startBotMatch, onMatched]);

  /**
   * Landing a match the server paired for us.
   *
   * This used to be a two-second `tryMatchmake` poll per searching client, and that poll
   * was the only thing that paired anyone — N searchers meant N mutations every two
   * seconds, all reading overlapping slices of the same rating range, so write conflicts
   * grew with the square of the queue. A server-side sweeper does that work once for
   * everybody now, and the match arrives down the `activeMatch` subscription that was
   * already open on every route.
   *
   * Only the side effects live here; `held` is adopted during render above, because
   * setting state from an effect renders the wrong thing once before correcting itself.
   *
   * The ref keeps this to once per match. `activeMatch` stays set for the whole duel, so
   * without it every re-render would re-fire the sound and the navigation. It also
   * adopts whatever is already live on the first resolution after mount: reloading
   * mid-duel is not a match being found, and should be silent.
   */
  const announced = useRef<Id<"matches"> | null | undefined>(undefined);
  useEffect(() => {
    if (activeMatch === undefined) return;

    if (announced.current === undefined) {
      announced.current = activeMatch;
      return;
    }

    if (announced.current === activeMatch) return;
    announced.current = activeMatch;
    if (!activeMatch) return;

    play("match_found");
    // Ranked is where a duel is rendered. Arriving from anywhere else — the ladder, a
    // profile, settings — has to end up there or the match plays out unwatched.
    if (pathname !== "/ranked") router.push("/ranked");
  }, [activeMatch, pathname, router]);

  /**
   * Safety net, not the mechanism.
   *
   * The server sweeper re-arms itself and is started by whoever makes the pool matchable,
   * so in the normal case this never finds anything the sweep has not already done. But
   * the sweeper is now the only thing that pairs anyone, and a self-scheduling chain has
   * exactly one failure mode — if a link is ever lost, nothing restarts it until the next
   * player happens to join at the transition point, and everyone already queued waits
   * forever.
   *
   * Fifteen seconds rather than the two this used to run at: frequent enough that a
   * broken chain costs a searching player one wait cycle instead of their whole session,
   * rare enough that it is a rounding error against what the poll used to cost.
   */
  useEffect(() => {
    if (!inQueue) return;
    const id = setInterval(() => void tryMatchmake({}), 15_000);
    return () => clearInterval(id);
  }, [inQueue, tryMatchmake]);

  /**
   * Automatic bot fallback.
   *
   * A queue with nobody in it is a mode that does not exist, and at launch that is every
   * queue. Derived rather than stored, so the banner and the timer can never disagree
   * about whether the fallback is running.
   */
  const fallingBack =
    inQueue && (pool?.playersWaiting ?? 0) <= 1 && waitingMs >= BOT_FALLBACK_MS;

  useEffect(() => {
    if (!fallingBack) return;
    const id = setTimeout(() => void startBot(), BOT_FALLBACK_NOTICE_MS);
    return () => clearTimeout(id);
  }, [fallingBack, startBot]);

  /**
   * The tab title, while searching.
   *
   * Only worth doing because the search now outlives the page: a player who queues and
   * switches tab has no other way to know their match has started, and a duel is lost by
   * not being there.
   *
   * Keyed on the route as well as the queue, because Next rewrites `document.title` from
   * the new route's metadata on every navigation. Keyed on the queue alone this ran once,
   * on /ranked, and the very next click put the ladder's title back — so the one case it
   * exists for, a player who queues and then goes and looks at something else, was the one
   * case it did not cover.
   *
   * The title to restore is re-read per route for the same reason: the right thing to put
   * back is whatever this route calls itself, not whatever the page was called when the
   * search started.
   */
  const routeTitle = useRef<string | null>(null);
  useEffect(() => {
    if (!inQueue) {
      if (routeTitle.current !== null) {
        document.title = routeTitle.current;
        routeTitle.current = null;
      }
      return;
    }
    // Never capture our own title as the thing to restore, which is what a second run on
    // the same route would otherwise do.
    if (document.title !== SEARCHING_TITLE) routeTitle.current = document.title;
    document.title = SEARCHING_TITLE;
  }, [inQueue, pathname]);

  const value = useMemo<QueueState>(
    () => ({
      inQueue,
      waitingMs,
      playersWaiting: pool?.playersWaiting ?? 0,
      band: eloBandFor(waitingMs),
      fallingBack,
      matchId,
      enqueue: () => void enqueueMutation({}),
      dequeue: () => void dequeueMutation({}),
      startBot: () => void startBot(),
      clearMatch: () => setHeld(null),
    }),
    [
      inQueue,
      waitingMs,
      pool?.playersWaiting,
      fallingBack,
      matchId,
      enqueueMutation,
      dequeueMutation,
      startBot,
    ],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}
