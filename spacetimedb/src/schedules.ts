/**
 * The scheduled reducers.
 *
 * These are the SpacetimeDB replacement for Convex's `ctx.scheduler.runAfter`, and
 * they are deliberately thin: each one unwraps its schedule row and hands off to
 * the domain module that owns the work. Keeping them here, rather than beside that
 * work, is what resolves the cycle described below.
 *
 * MODULE ORDER MATTERS. `schema.ts` names these in its `scheduled: (): any => …`
 * thunks, so the two files form a cycle. The thunks defer, which is what makes the
 * cycle legal, but only if this module finishes evaluating before anything calls
 * them — hence `index.ts` imports this file before `./schema`.
 */
import {
  spacetimedb,
  phase_advance_schedule,
  ready_wait_schedule,
  draft_watchdog_schedule,
  bot_action_schedule,
  matchmaking_sweep_schedule,
  forfeit_sweep_schedule,
  finalize_schedule,
  guest_cleanup_schedule,
  ladder_rebuild_schedule,
  devbot_refill_schedule,
} from "./schema";
import { runAdvancePhase, runDraftWatchdog, runWaitForReady } from "./phases";
import { runCleanupGuests } from "./guests";
import { runSweepMatchmaking } from "./matchmaking";

export const advancePhase = spacetimedb.reducer(
  { row: phase_advance_schedule.rowType },
  (ctx, { row }) => runAdvancePhase(ctx, row),
);

export const waitForReady = spacetimedb.reducer(
  { row: ready_wait_schedule.rowType },
  (ctx, { row }) => runWaitForReady(ctx, row),
);

export const draftWatchdog = spacetimedb.reducer(
  { row: draft_watchdog_schedule.rowType },
  (ctx, { row }) => runDraftWatchdog(ctx, row),
);

export const runBotAction = spacetimedb.reducer(
  { row: bot_action_schedule.rowType },
  (_ctx, { row }) => {
    // Owned by the bot module, ported in a later step.
    void row;
  },
);

export const sweepMatchmaking = spacetimedb.reducer(
  { row: matchmaking_sweep_schedule.rowType },
  (ctx, { row }) => {
    void row;
    runSweepMatchmaking(ctx);
  },
);

export const sweepForfeits = spacetimedb.reducer(
  { row: forfeit_sweep_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const finalizeMatch = spacetimedb.reducer(
  { row: finalize_schedule.rowType },
  (_ctx, { row }) => {
    void row;
  },
);

export const cleanupGuests = spacetimedb.reducer(
  { row: guest_cleanup_schedule.rowType },
  (ctx, { row }) => {
    void row;
    runCleanupGuests(ctx);
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
