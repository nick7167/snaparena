import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Guest housekeeping.
 *
 * Every anonymous browser that starts a daily leaves a permanent user row behind, plus
 * a match, a matchPlayers row and a handful of guesses. Nothing removed them, so the
 * users table grows forever — and `daily.start` creating a row from a client-supplied
 * token means that growth is also the app's cheapest abuse vector.
 *
 * This is the riskiest code in the feature: it deletes real rows across five tables. It
 * is therefore built so the dangerous half can be inspected before it ever runs — see
 * `previewCleanup`, which counts exactly what `runCleanup` would remove and deletes
 * nothing.
 *
 * Safety properties, in order of importance:
 *
 *   1. Only rows where `user.isGuest === true` are ever touched. A Clerk-backed account
 *      cannot be selected, whatever the state of the rest of the data.
 *   2. Only guests older than RETENTION_MS.
 *   3. Runs claimed by a real account were re-pointed away by `daily.claimGuestRun`
 *      before this ever sees them, so claimed history is not reachable from here.
 *   4. Bounded per transaction and rescheduled, because a mutation that tries to delete
 *      everything at once will exceed Convex's transaction limits and roll back.
 */

/** How long an unclaimed guest identity is kept. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Guests examined per transaction. Deliberately small — each fans out to several tables. */
const BATCH = 25;

/**
 * Counts what a cleanup would delete, without deleting anything.
 *
 * Run this before enabling the cron, and any time the retention window changes:
 *   npx convex run guests:previewCleanup '{}'
 */
export const previewCleanup = query({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // The clock comes in as an argument rather than being read here: a query is not
    // rerun because time passed, so a wall-clock read inside one goes stale.
    const cutoff = (args.now ?? 0) - RETENTION_MS;

    const guests = await ctx.db
      .query("users")
      .withIndex("by_clerk_id")
      .filter((q) => q.eq(q.field("isGuest"), true))
      .take(500);

    const stale = args.now === undefined
      ? []
      : guests.filter((guest) => guest.createdAt < cutoff);

    return {
      retentionDays: RETENTION_MS / 86_400_000,
      guestsTotal: guests.length,
      guestsStale: stale.length,
      claimed: guests.filter((guest) => guest.guestClaimedAt !== undefined).length,
      // Named so it is obvious this call is inert.
      wouldDelete: stale.map((guest) => guest.handle),
      note:
        args.now === undefined
          ? "Pass { now: Date.now() } to evaluate the cutoff — queries must not read the clock."
          : "Nothing was deleted. This is a count only.",
    };
  },
});

/**
 * Deletes one batch of expired guests and everything that references them, then
 * reschedules itself while work remains.
 *
 * Deleting the user row alone would leave `matchPlayers.userId` and `guesses.userId`
 * pointing at nothing, and any scoreboard reading those rows would break — so the
 * dependents go first, in reverse dependency order.
 */
export const runCleanup = internalMutation({
  args: { cursorHandled: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ deleted: number; done: boolean }> => {
    const cutoff = Date.now() - RETENTION_MS;

    const guests = await ctx.db
      .query("users")
      .withIndex("by_clerk_id")
      .filter((q) => q.eq(q.field("isGuest"), true))
      .take(BATCH * 4);

    const expired = guests.filter((guest) => guest.createdAt < cutoff).slice(0, BATCH);

    for (const guest of expired) {
      await deleteGuest(ctx, guest);
    }

    const handled = (args.cursorHandled ?? 0) + expired.length;
    const done = expired.length < BATCH;

    // A fresh transaction for the next batch, rather than trying to fit the whole
    // table into this one.
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.guests.runCleanup, {
        cursorHandled: handled,
      });
    }

    return { deleted: handled, done };
  },
});

/** Removes one guest and every row that points at them, dependents first. */
async function deleteGuest(ctx: MutationCtx, guest: Doc<"users">): Promise<void> {
  // Belt and braces. This function is only ever called with a guest, and if that ever
  // stops being true it must fail rather than delete a real account.
  if (guest.isGuest !== true) {
    throw new Error(`Refusing to delete non-guest user ${guest._id}`);
  }

  const memberships = await ctx.db
    .query("matchPlayers")
    .withIndex("by_user", (q) => q.eq("userId", guest._id))
    .take(100);

  const matchIds = new Set<Id<"matches">>();

  for (const membership of memberships) {
    matchIds.add(membership.matchId);
    await ctx.db.delete(membership._id);
  }

  for (const matchId of matchIds) {
    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_match_round", (q) => q.eq("matchId", matchId))
      .take(200);

    for (const guess of guesses) {
      await ctx.db.delete(guess._id);
    }

    // Only remove the match itself once nobody else is in it. A guest never shares a
    // daily, but this keeps the rule true rather than assuming it.
    const others = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .take(1);

    if (others.length === 0) {
      await ctx.db.delete(matchId);
    }
  }

  const runs = await ctx.db
    .query("dailyRuns")
    .withIndex("by_user_date", (q) => q.eq("userId", guest._id))
    .take(100);

  for (const run of runs) {
    await ctx.db.delete(run._id);
  }

  await ctx.db.delete(guest._id);
}
