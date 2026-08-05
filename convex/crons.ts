import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled jobs.
 *
 * Only one so far: expiring anonymous guest identities. See convex/guests.ts for what
 * it deletes and the guards around it — and run `guests:previewCleanup` first if you
 * want to see what a run would remove before it removes it.
 *
 * Daily rather than hourly: the retention window is 30 days, so nothing is urgent, and
 * a quiet job is easier to reason about than a chatty one.
 */
const crons = cronJobs();

crons.interval(
  "expire anonymous guests",
  { hours: 24 },
  internal.guests.runCleanup,
  {},
);

/**
 * DEV ONLY — delete with convex/devbots.ts.
 *
 * Keeps the sixteen rank bots sitting in the ranked queue so a lone developer can
 * actually match. Their queue rows are consumed when matched, so this is a refill on a
 * timer rather than a one-off seed. The job no-ops in a single read when the
 * DEV_RANK_BOTS flag is unset — which is where the gating lives, so turning the flag off
 * is enough and no redeploy is needed.
 *
 * Five minutes rather than one. A no-op still costs a function call, and at a minute
 * that was ~43,000 a month spent doing nothing on a deployment where the flag is off —
 * about four percent of the free tier. Sixteen bots is sixteen test matches before the
 * pool is empty, so the shorter interval was never what made one available.
 */
crons.interval(
  "refill dev rank bot queue",
  { minutes: 5 },
  internal.devbots.refillQueue,
  {},
);

/**
 * Rebuilds the stored ladder field.
 *
 * A cron rather than a self-scheduling chain: `ranked.sweep`'s pattern is for work that
 * should cost nothing while idle, and this has to run whether or not anybody is playing.
 * The builder's write-if-changed guard recovers most of that benefit anyway — an idle
 * ladder costs the cron's own calls and nothing downstream.
 *
 * Five minutes: 8,640 calls a month, under one percent of the free tier, against a term
 * that otherwise grows with the SQUARE of concurrent players. A one-minute interval would
 * be 43,200 and re-execute every subscribed reader five times as often for a board that
 * moves once a match.
 */
crons.interval(
  "rebuild ladder snapshot",
  { minutes: 5 },
  internal.ladder.rebuild,
  {},
);

export default crons;
