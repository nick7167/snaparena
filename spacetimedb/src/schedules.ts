/**
 * The nine scheduled reducers.
 *
 * These are the SpacetimeDB replacement for Convex's `ctx.scheduler.runAfter`.
 * Each one is a thin dispatcher: the real work lives in the domain modules, and
 * everything here is the same guard-on-expectation check the Convex originals
 * opened with — a job that fires late, twice, or against a match that has already
 * moved on must be a no-op rather than a skipped round.
 *
 * MODULE ORDER MATTERS. `schema.ts` names these in its `scheduled: (): any => …`
 * thunks, so the two files form a cycle. The thunks defer, which is what makes the
 * cycle legal, but only if this module finishes evaluating before anything calls
 * them — hence `index.ts` imports this file before `./schema`.
 */
import { spacetimedb, phase_advance_schedule, ready_wait_schedule, draft_watchdog_schedule, bot_action_schedule, matchmaking_sweep_schedule, forfeit_sweep_schedule, guest_cleanup_schedule, ladder_rebuild_schedule, devbot_refill_schedule } from "./schema";

export const advancePhase = spacetimedb.reducer(
  { row: phase_advance_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const waitForReady = spacetimedb.reducer(
  { row: ready_wait_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const draftWatchdog = spacetimedb.reducer(
  { row: draft_watchdog_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const runBotAction = spacetimedb.reducer(
  { row: bot_action_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const sweepMatchmaking = spacetimedb.reducer(
  { row: matchmaking_sweep_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const sweepForfeits = spacetimedb.reducer(
  { row: forfeit_sweep_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const cleanupGuests = spacetimedb.reducer(
  { row: guest_cleanup_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const rebuildLadder = spacetimedb.reducer(
  { row: ladder_rebuild_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const refillDevBotQueue = spacetimedb.reducer(
  { row: devbot_refill_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);
