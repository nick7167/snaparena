import { ScheduleAt } from "spacetimedb";
import type { ReducerCtx } from "./ctx";

/**
 * Guest housekeeping.
 *
 * Every anonymous browser that starts a daily leaves a permanent user row behind,
 * plus a match and everything hanging off it. Nothing removes them, so the table
 * grows forever — and because an anonymous identity is free to mint, that growth
 * is also the app's cheapest abuse vector.
 *
 * This is the most dangerous code in the module: it deletes real rows across
 * fourteen tables. The safety properties, in order of importance:
 *
 *   1. Only rows where `user.isGuest === true` are ever touched. A Clerk-backed
 *      account cannot be selected, whatever the state of the rest of the data.
 *      `deleteGuest` re-checks this itself rather than trusting its caller.
 *   2. Only guests older than `GUEST_RETENTION_MS`.
 *   3. Runs claimed by a real account were re-pointed away when the account
 *      claimed them, so claimed history is never reachable from here.
 *   4. Bounded per call and continued with a one-shot, rather than trying to walk
 *      the whole table in a single reducer.
 *
 * WHAT CHANGED FROM CONVEX. The old `guests.ts` deleted four tables: matchPlayers,
 * guesses, dailyRuns and users. That was complete against the Convex schema. It is
 * NOT complete against this one — the port split a match's state across
 * `round_result`, `round_reveal`, `round_log`, `match_track` and `guess_feedback`,
 * and added `account`, `user_badge`, `category_rating`, `user_preference`,
 * `user_avatar`, `handle_probe`, `ladder_entry` and `queue_entry` per user. Porting
 * only what Convex deleted would have left orphans in ten tables, so the delete set
 * is derived from the schema's actual references rather than copied across.
 *
 * Scheduled rows pointing at a deleted match are deliberately left alone. Every
 * scheduled reducer already returns early when its match is missing, so they clear
 * themselves on their next firing — cheaper than scanning six schedule tables that
 * carry no index on `matchId`.
 */

/** How long an unclaimed guest identity is kept. */
export const GUEST_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Guests examined per firing. Deliberately small — each one fans out to a dozen
 * tables, and a sweep that falls behind is continued rather than widened.
 */
const BATCH = 25;

/** How often the sweep runs. Retention is thirty days, so nothing here is urgent. */
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Microseconds per millisecond. */
const MICROS_PER_MS = 1_000n;

/**
 * Arms the recurring sweep. Called once from `init`.
 *
 * Guarded on the table being empty so a republish that re-runs `init` cannot end
 * up with two intervals racing each other.
 */
export function armGuestCleanup(ctx: ReducerCtx): void {
  if (ctx.db.guest_cleanup_schedule.count() > 0n) return;

  ctx.db.guest_cleanup_schedule.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.interval(
      BigInt(CLEANUP_INTERVAL_MS) * MICROS_PER_MS,
    ),
  });
}

/**
 * Deletes one batch of expired guests, and queues a continuation if more remain.
 *
 * The continuation is a one-shot `ScheduleAt.time` row in the same table. Interval
 * rows repeat and are kept; time rows fire once and are removed, so the two can
 * share a schedule without the continuation becoming a second heartbeat.
 */
export function runCleanupGuests(ctx: ReducerCtx): void {
  const cutoffMicros =
    ctx.timestamp.microsSinceUnixEpoch -
    BigInt(GUEST_RETENTION_MS) * MICROS_PER_MS;

  const expired = [];

  for (const guest of ctx.db.user.isGuest.filter(true)) {
    if (guest.createdAt.microsSinceUnixEpoch >= cutoffMicros) continue;
    expired.push(guest);
    if (expired.length >= BATCH) break;
  }

  for (const guest of expired) {
    deleteGuest(ctx, guest.id);
  }

  // A full batch means there may be more behind it. Come back promptly rather
  // than leaving the remainder for tomorrow's interval.
  if (expired.length >= BATCH) {
    ctx.db.guest_cleanup_schedule.insert({
      scheduled_id: 0n,
      scheduled_at: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch),
    });
  }
}

/**
 * Removes one guest and every row that points at them, dependents first.
 *
 * Takes an id rather than a row so the guest guard below reads from the table at
 * the moment of deletion, not from a value the caller captured earlier.
 */
function deleteGuest(ctx: ReducerCtx, userId: bigint): void {
  const guest = ctx.db.user.id.find(userId);
  if (!guest) return;

  // Belt and braces. This is only ever called with a guest, and if that ever stops
  // being true it must do nothing rather than delete a real account.
  if (!guest.isGuest) return;

  // --- Matches this guest was in ------------------------------------------
  const matchIds = new Set<bigint>();

  for (const membership of ctx.db.match_player.userId.filter(userId)) {
    matchIds.add(membership.matchId);
  }

  for (const matchId of matchIds) {
    // The guest's own rows go first, whether or not the match itself survives.
    for (const row of ctx.db.round_result.matchId.filter(matchId)) {
      if (row.userId === userId) ctx.db.round_result.id.delete(row.id);
    }
    for (const row of ctx.db.guess.matchId.filter(matchId)) {
      if (row.userId === userId) ctx.db.guess.id.delete(row.id);
    }
    for (const row of ctx.db.match_player.matchId.filter(matchId)) {
      if (row.userId === userId) ctx.db.match_player.id.delete(row.id);
    }

    // Only remove the match itself once nobody else is in it. A guest never shares
    // a daily, but this keeps the rule true rather than assuming it.
    let occupied = false;
    for (const _ of ctx.db.match_player.matchId.filter(matchId)) {
      occupied = true;
      break;
    }
    if (occupied) continue;

    for (const row of ctx.db.round_result.matchId.filter(matchId)) {
      ctx.db.round_result.id.delete(row.id);
    }
    for (const row of ctx.db.guess.matchId.filter(matchId)) {
      ctx.db.guess.id.delete(row.id);
    }
    for (const row of ctx.db.round_log.matchId.filter(matchId)) {
      ctx.db.round_log.id.delete(row.id);
    }
    for (const row of ctx.db.round_reveal.matchId.filter(matchId)) {
      ctx.db.round_reveal.id.delete(row.id);
    }
    for (const row of ctx.db.match_track.matchId.filter(matchId)) {
      ctx.db.match_track.id.delete(row.id);
    }

    ctx.db.match.id.delete(matchId);
  }

  // --- Daily runs, and the counter that tracks them ------------------------
  for (const run of ctx.db.daily_run.userId.filter(userId)) {
    // Retention only ever reaches dates well past the one the landing page reads,
    // but the counter is maintained rather than counted, so every deletion has to
    // report itself.
    releaseDailyCount(ctx, run.date);
    ctx.db.daily_run.id.delete(run.id);
  }

  // --- Everything else keyed by the user -----------------------------------
  // `guess_feedback` carries no primary key, so it is cleared through its index
  // rather than row by row.
  ctx.db.guess_feedback.userId.delete(userId);

  for (const row of ctx.db.user_badge.userId.filter(userId)) {
    ctx.db.user_badge.id.delete(row.id);
  }
  for (const row of ctx.db.category_rating.userId.filter(userId)) {
    ctx.db.category_rating.id.delete(row.id);
  }

  ctx.db.user_preference.userId.delete(userId);
  ctx.db.user_avatar.userId.delete(userId);
  ctx.db.handle_probe.userId.delete(userId);
  ctx.db.ladder_entry.userId.delete(userId);
  ctx.db.queue_entry.userId.delete(userId);
  ctx.db.account.userId.delete(userId);

  ctx.db.user.id.delete(userId);
}

/**
 * Decrements the running total for a date, and removes the row at zero.
 *
 * Kept here rather than in the daily module because this is currently its only
 * caller; it moves when `daily.ts` is ported.
 */
function releaseDailyCount(ctx: ReducerCtx, date: string): void {
  const row = ctx.db.daily_count.date.find(date);
  if (!row) return;

  if (row.players <= 1) {
    ctx.db.daily_count.id.delete(row.id);
    return;
  }

  ctx.db.daily_count.id.update({ ...row, players: row.players - 1 });
}
