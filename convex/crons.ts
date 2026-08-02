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
 * timer rather than a one-off seed. Every minute because a minute is the longest you
 * want to wait between test matches, and the job no-ops in a single read when the
 * DEV_RANK_BOTS flag is unset — which is where the gating lives, so turning the flag off
 * is enough and no redeploy is needed.
 */
crons.interval(
  "refill dev rank bot queue",
  { minutes: 1 },
  internal.devbots.refillQueue,
  {},
);

export default crons;
