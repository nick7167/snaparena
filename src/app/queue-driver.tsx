"use client";

import { useUser } from "@clerk/nextjs";
import { useReducer as useStdbReducer } from "spacetimedb/react";
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
import { reducers } from "@/module_bindings";
import { useActiveMatch, useMe, useQueueStatus } from "./db";
import { play } from "@/audio/sfx";
import {
  BOT_FALLBACK_MS,
  BOT_FALLBACK_NOTICE_MS,
  eloBandFor,
} from "@/engine/matchmaking";
import { useNow } from "@/game/usePrefersReducedMotion";
import { track } from "@/analytics";

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
  matchId: bigint | null;
  /**
   * A queue action is in flight.
   *
   * Named rather than boolean so a control can tell "my request" from "some request" —
   * Cancel must not wear a spinner because Find a match is still resolving.
   */
  pending: "enqueue" | "dequeue" | "startBot" | null;
  /**
   * What went wrong with the last queue action, ready to render.
   *
   * These three used to be `() => void mutation({})` — nothing awaited, nothing caught.
   * A rejected enqueue left the loudest control in the app completely inert, which reads
   * as "that did not work" and earns a second press. Same bug `rooms/page.tsx` fixed for
   * room creation; see its docblock.
   */
  error: string | null;
  /** Dismiss the error, so a retry starts from a clean slate. */
  clearError: () => void;
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
  pending: null,
  error: null,
  clearError: () => {},
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
  const me = useMe();
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
  /**
   * One view rather than two subscriptions.
   *
   * The split existed because counting the pool read every queue row, so one person
   * pressing Find a match re-executed that query once per signed-in user, everywhere.
   * `my_queue_status` is materialised per viewer and returns both facts as one row, so
   * the count costs what the membership check already cost.
   */
  const status = useQueueStatus();
  const inQueue = status?.queued === true;
  const pool = status;

  // Subscribed here rather than on the page so the reconciliation below can see it, and
  // so a reload mid-match still drops you back in. Only ever returns a LIVE match.
  const activeMatchRow = useActiveMatch(ready ? me?.id : undefined);
  /**
   * Narrowed to the id here, once. The hook returns the row because other screens want
   * its phase; this provider only ever routes on identity, and threading a whole match
   * through the reconciliation below would be a wider object with no extra meaning.
   */
  const activeMatch =
    activeMatchRow === undefined ? undefined : (activeMatchRow?.id ?? null);

  const enqueueMutation = useStdbReducer(reducers.enqueue);
  const dequeueMutation = useStdbReducer(reducers.dequeue);
  /**
   * `tryMatchmake` is gone. It was a two-second poll each searching client ran for
   * itself; the module sweeps the pool on everyone's behalf and pairs from there, so
   * there is nothing left for a client to ask.
   */
  const startBotMatch = useStdbReducer(reducers.startPractice);

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
  const [held, setHeld] = useState<bigint | null>(null);

  // Ticked client-side from the server's `enqueuedAt`. A Convex query does not re-run on
  // a timer, so anything elapsed has to be computed here or it stands still.
  const now = useNow(1000);
  const waitingMs = status?.enqueuedAtMs ? Math.max(0, now - status.enqueuedAtMs) : 0;

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

  /**
   * Which action is in flight, and what the last one failed with.
   *
   * Both setters are stable, so nothing below re-creates a callback when they fire — which
   * matters because `startBot`'s identity is a dependency of the fallback timer, and an
   * unstable one would re-arm it on every state change.
   */
  const [pending, setPending] = useState<QueueState["pending"]>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Runs a queue mutation with a pending flag and a caught failure.
   *
   * The three actions used to be bare `void mutation({})` calls. A rejection went nowhere:
   * no spinner, no message, no state change — indistinguishable from a control that does
   * not work. `rooms/page.tsx:77-81` documents the same bug and the same fix.
   */
  const run = useCallback(
    async (name: NonNullable<QueueState["pending"]>, action: () => Promise<unknown>) => {
      setPending(name);
      setError(null);
      try {
        await action();
      } catch {
        setError(
          name === "dequeue"
            ? "Could not leave the queue. Try again."
            : "Could not start a match. Check your connection and try again.",
        );
      } finally {
        setPending(null);
      }
    },
    [],
  );

  /**
   * Also called by the automatic fallback below, where there is no control to report to —
   * so the failure has to be caught here rather than at the call site. The banner keeps
   * saying it is matching you with a bot; the error line underneath says it did not.
   */
  const startBot = useCallback(async () => {
    await run("startBot", async () => {
      /**
       * A reducer returns nothing, so the match id no longer comes back from the call.
       * The practice match appears in `activeMatch` a moment later and the
       * reconciliation below routes into it — the same path a paired ranked match takes,
       * rather than a second one that could disagree.
       */
      await startBotMatch();
    });
  }, [run, startBotMatch]);

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
   *
   * The baseline used to be taken from the first non-`undefined` `activeMatch`, but
   * `useActiveMatch` returns `null` — not `undefined` — for as long as `userId` itself is
   * `undefined`, which is exactly the state this provider is in on every mount until
   * Clerk resolves and `ensureUser` has run (see `ready` above). That `null` got baselined
   * as "settled: no match", so the moment `me` resolved into a match that already existed,
   * this saw the id appear for the "first" time and played `match_found` and pushed to
   * `/ranked` — yanking a player out of the daily or a room they had reloaded into. Gating
   * on `ready` as well as on `activeMatch` itself means the baseline is never taken from
   * that placeholder `null`; it waits for a read that actually came from the subscription.
   */
  const announced = useRef<bigint | null | undefined>(undefined);
  useEffect(() => {
    if (!ready || activeMatch === undefined) return;

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
  }, [ready, activeMatch, pathname, router]);

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
  /**
   * The fifteen-second safety net is gone with the poll it called.
   *
   * It existed because the sweeper chain could in principle drop, and a searching player
   * would then wait forever; the client re-asked to restart it. There is no client-side
   * pairing call left to make — `enqueue` starts the chain on the edge where the pool
   * becomes matchable, and the sweep re-arms itself while it is worth running.
   */

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
      pending,
      error,
      clearError: () => setError(null),
      enqueue: () =>
        void run("enqueue", async () => {
          await enqueueMutation();
          track("queue_enqueue");
        }),
      /**
       * `waited_ms` is the number this event exists for.
       *
       * How long people tolerate a queue before giving up is what decides whether
       * BOT_FALLBACK_MS is set correctly — and the fallback currently fires on a constant
       * that was chosen without any way to check it against real patience.
       */
      dequeue: () =>
        void run("dequeue", async () => {
          await dequeueMutation();
          track("queue_cancel", { waited_ms: Math.round(waitingMs) });
        }),
      startBot: () => void startBot(),
      clearMatch: () => setHeld(null),
    }),
    [
      inQueue,
      waitingMs,
      pool?.playersWaiting,
      fallingBack,
      matchId,
      pending,
      error,
      run,
      enqueueMutation,
      dequeueMutation,
      startBot,
    ],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}
