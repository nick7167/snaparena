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

export default crons;
