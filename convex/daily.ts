import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  GUEST_CLERK_PREFIX,
  actingUser,
  currentUser,
  guestByToken,
  isValidGuestToken,
  publicAvatarUrl,
  requireUser,
} from "./users";
import { pickTracksForMatch } from "./tracks";
import { startCountdown } from "./phases";
import { DAILY_SONGS, PLACEMENT_MATCHES, STARTING_ELO } from "../src/engine/config";
import type { Doc } from "./_generated/dataModel";

/** UTC date key. The daily challenge rolls over at midnight UTC for everyone. */
export function todayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Returns today's challenge, creating it on first request.
 *
 * Every player worldwide gets the same five tracks, which is what makes the
 * shared score comparable — and therefore what makes a result card worth posting.
 * Mid-difficulty tier: the daily is the front door, so it must not be brutal.
 */
async function ensureChallenge(ctx: MutationCtx, date: string): Promise<Id<"tracks">[]> {
  const existing = await ctx.db
    .query("dailyChallenges")
    .withIndex("by_date", (q) => q.eq("date", date))
    .unique();

  if (existing) return existing.trackIds;

  const trackIds = await pickTracksForMatch(ctx, {
    targetTier: 2,
    bannedCategoryIds: [],
    count: DAILY_SONGS,
  });

  await ctx.db.insert("dailyChallenges", { date, trackIds });
  return trackIds;
}

/**
 * Finds or creates the guest row for a token.
 *
 * The only place a guest row is ever created, and only as a side effect of actually
 * starting a run — so a token that never plays leaves nothing behind.
 *
 * The handle uses a random suffix rather than `allocateHandle`, which derives from a
 * display name and walks `guest2 … guest50` on collision; with every guest sharing one
 * base name that would degrade immediately.
 */
async function ensureGuest(ctx: MutationCtx, token: string): Promise<Doc<"users">> {
  const existing = await guestByToken(ctx, token);
  if (existing) return existing;

  const id = await ctx.db.insert("users", {
    clerkId: `${GUEST_CLERK_PREFIX}${token}`,
    handle: `guest_${token.slice(0, 8)}`,
    displayName: "Guest",
    elo: STARTING_ELO,
    gamesPlayed: 0,
    // Never reaches 0, which is what keeps guests off the global leaderboard.
    placementsRemaining: PLACEMENT_MATCHES,
    createdAt: Date.now(),
    isGuest: true,
  });

  const guest = await ctx.db.get(id);
  if (!guest) throw new Error("Failed to create guest");
  return guest;
}

export const start = mutation({
  // Optional: signed-in players never send one, and a signed-in session always wins
  // over a token — see actingUser.
  args: { guestToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveDailyPlayer(ctx, args.guestToken);
    const date = todayKey();

    const alreadyPlayed = await ctx.db
      .query("dailyRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();

    if (alreadyPlayed) {
      return { status: "already-played" as const, run: alreadyPlayed };
    }

    /**
     * Resume rather than restart.
     *
     * The `alreadyPlayed` check above only fires once a run has been RECORDED, and a
     * run is only recorded by `complete`. So abandoning a daily part-way and calling
     * start again used to mint a second match over the same five tracks — which is a
     * second attempt at the same songs, having already heard them.
     */
    const live = await findLiveDailyMatch(ctx, user._id, date);
    if (live) return { status: "started" as const, matchId: live, date };

    const trackIds = await ensureChallenge(ctx, date);
    if (trackIds.length < DAILY_SONGS) {
      return { status: "catalogue-too-small" as const };
    }

    const matchId = await ctx.db.insert("matches", {
      mode: "daily",
      status: "active",
      playerIds: [user._id],
      trackIds,
      bannedCategoryIds: [],
      currentRound: 0,
      createdAt: Date.now(),
    });

    await ctx.db.insert("matchPlayers", {
      matchId,
      userId: user._id,
      totalPoints: 0,
      ratingBefore: user.elo,
      forfeited: false,
      lastSeenAt: Date.now(),
    });

    // Solo, so no VS screen — but the countdown, reveal and standings beats still
    // apply. The drama is the point, not the opponent.
    await startCountdown(ctx, matchId, 0);

    return { status: "started" as const, matchId, date };
  },
});

/**
 * This player's unfinished daily match for `date`, if there is one.
 *
 * Bounded scan over recent match memberships — a player's daily is always among their
 * last handful of matches, and there is no index on (userId, mode).
 */
async function findLiveDailyMatch(
  ctx: QueryCtx,
  userId: Id<"users">,
  date: string,
): Promise<Id<"matches"> | null> {
  const recent = await ctx.db
    .query("matchPlayers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(10);

  for (const entry of recent) {
    const match = await ctx.db.get(entry.matchId);
    if (
      match &&
      match.mode === "daily" &&
      match.status === "active" &&
      todayKey(match.createdAt) === date
    ) {
      return match._id;
    }
  }

  return null;
}

/**
 * The run currently in progress, so a reload drops straight back into it.
 *
 * `start` has always resumed rather than restarted, but only when called — and the
 * client holds its match id in component state, so refreshing mid-run dropped the
 * player onto the landing screen looking at a "Start" button with a live match sitting
 * behind it. The resume was there; nothing asked for it.
 *
 * Returns null once the run is recorded, so a finished player falls through to their
 * result rather than being pulled back into a completed match.
 */
export const activeRun = query({
  args: { guestToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await actingUser(ctx, args.guestToken);
    if (!user) return null;

    const date = todayKey();
    const matchId = await findLiveDailyMatch(ctx, user._id, date);
    return matchId ? { matchId, date } : null;
  },
});

/**
 * The player for a daily action: the signed-in user, or the guest for this token,
 * creating the guest row on demand.
 *
 * Throws rather than returning null so callers keep the shape `requireUser` gave them.
 */
async function resolveDailyPlayer(
  ctx: MutationCtx,
  guestToken: string | undefined,
): Promise<Doc<"users">> {
  const signedIn = await currentUser(ctx);
  if (signedIn) return signedIn;

  if (!guestToken) throw new Error("Not signed in");
  if (!isValidGuestToken(guestToken)) throw new Error("Invalid guest token");

  return await ensureGuest(ctx, guestToken);
}

/** Records the finished run. The daily never affects Elo. */
export const complete = mutation({
  args: { matchId: v.id("matches"), guestToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveDailyPlayer(ctx, args.guestToken);
    const match = await ctx.db.get(args.matchId);
    if (!match || match.mode !== "daily") throw new Error("Not a daily match");

    const date = todayKey(match.createdAt);

    return await recordRun(ctx, user, match, date);
  },
});

/**
 * Ends a run early, keeping whatever was earned.
 *
 * Leaving used to abandon the match without recording anything, which left a hole worth
 * closing: phase transitions are driven by client nudges, so an abandoned round never
 * advances. Coming back later resumed that same frozen round with a fresh audio clock —
 * and `validateClientClock` only bounds a claim against how long the server has been
 * waiting, which by then is enormous. You could hear song one, leave, return an hour
 * later and score a SNAP on a track you already knew.
 *
 * Recording the run is what shuts that: `start` checks for a recorded run BEFORE it looks
 * for a live match, so once this has written a row there is nothing to come back to.
 *
 * Unplayed songs score zero, exactly as an unsolved song does — a run left after three of
 * five keeps those three. The alternative, voiding everything, punishes a dropped
 * connection precisely as hard as a deliberate exit, and the server cannot tell them apart.
 */
export const forfeit = mutation({
  args: { matchId: v.id("matches"), guestToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveDailyPlayer(ctx, args.guestToken);
    const match = await ctx.db.get(args.matchId);
    if (!match || match.mode !== "daily") throw new Error("Not a daily match");

    const runId = await recordRun(ctx, user, match, todayKey(match.createdAt));

    // Belt and braces. `start` already refuses on the recorded run above, but leaving a
    // match flagged active would keep it in every "live match" sweep for no reason.
    if (match.status === "active") {
      await ctx.db.patch(args.matchId, { status: "complete" });
    }

    return runId;
  },
});

/**
 * Writes the `dailyRuns` row for a match, scoring every round it contains.
 *
 * Shared by `complete` and `forfeit` rather than copied, because the two must agree on
 * what a run was worth — a second copy of this loop is how the totals start diverging.
 * Idempotent: an existing row for the day wins and is returned untouched.
 */
async function recordRun(
  ctx: MutationCtx,
  user: Doc<"users">,
  match: Doc<"matches">,
  date: string,
): Promise<Id<"dailyRuns">> {
  const existing = await ctx.db
    .query("dailyRuns")
    .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", date))
    .unique();

  if (existing) return existing._id;

  const guesses = await ctx.db
    .query("guesses")
    .withIndex("by_match_round", (q) => q.eq("matchId", match._id))
    .collect();

  const perRoundPoints: number[] = [];
  const perRoundMs: number[] = [];

  // Every round in the match, not every round played — so a run abandoned early is
  // recorded as the full five with zeros on the songs never reached.
  for (let round = 0; round < match.trackIds.length; round++) {
    const solved = guesses.find(
      (guess) => guess.roundIndex === round && guess.userId === user._id && guess.correct,
    );
    perRoundPoints.push(solved?.points ?? 0);
    // -1 marks "never solved", distinct from a genuine 0ms.
    perRoundMs.push(solved ? Math.round(solved.clientElapsedMs) : -1);
  }

  return await ctx.db.insert("dailyRuns", {
    userId: user._id,
    date,
    totalPoints: perRoundPoints.reduce((sum, points) => sum + points, 0),
    perRoundPoints,
    perRoundMs,
    completedAt: Date.now(),
    // Denormalised so the board can exclude guests without a lookup per run.
    isGuest: user.isGuest === true ? true : undefined,
  });
}

/**
 * Moves a guest's runs onto the account that just signed in.
 *
 * This is the payoff for playing without an account: the result you already earned
 * follows you onto the board under your own name, rather than being the price of not
 * having signed up first.
 *
 * Idempotent, and safe to call with a token that has no runs, no guest row, or has
 * already been claimed.
 */
export const claimGuestRun = mutation({
  args: { guestToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const guest = await guestByToken(ctx, args.guestToken);
    if (!guest || guest._id === user._id) return { claimed: 0 };

    const guestRuns = await ctx.db
      .query("dailyRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", guest._id))
      .take(50);

    let claimed = 0;

    for (const run of guestRuns) {
      // The real account's own run always wins — a signed-in result is the record,
      // and silently replacing it with an anonymous one would lose real history.
      const mine = await ctx.db
        .query("dailyRuns")
        .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", run.date))
        .unique();

      if (mine) continue;

      await ctx.db.patch(run._id, { userId: user._id, isGuest: undefined });
      claimed++;
    }

    // Retired rather than deleted: `matches` and `guesses` rows still reference it,
    // and deleting would leave those dangling.
    await ctx.db.patch(guest._id, { guestClaimedAt: Date.now() });

    return { claimed };
  },
});

export const leaderboard = query({
  args: { date: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const date = args.date ?? todayKey();
    const limit = Math.min(args.limit ?? 100, 250);

    const runs = await ctx.db
      .query("dailyRuns")
      .withIndex("by_date_points", (q) => q.eq("date", date))
      // Guests play the daily but do not appear on the board — putting a name up is
      // what signing in buys. Must stay in step with the rank count in `myRun`, or a
      // guest is told a position against a population the board does not show.
      .filter((q) => q.neq(q.field("isGuest"), true))
      .order("desc")
      .take(limit);

    const users = await Promise.all(runs.map((run) => ctx.db.get(run.userId)));

    // `handle` is the name players chose; `displayName` is whatever Clerk got from
    // their Google account and is deliberately not returned — the board should not be
    // the place someone discovers their real name is public.
    return runs.map((run, index) => ({
      rank: index + 1,
      handle: users[index]?.handle ?? "unknown",
      avatarUrl: (() => {
        const player = users[index];
        return player ? publicAvatarUrl(player) : undefined;
      })(),
      totalPoints: run.totalPoints,
      perRoundMs: run.perRoundMs,
    }));
  },
});

/** Ceiling on the players-today count. Past it the landing page says "1,000+". */
const TODAY_COUNT_CEILING = 1_000;

/**
 * How many people have played today, for the landing page.
 *
 * Counts guests as well as signed-in players — the number is social proof that the
 * challenge is live, not a leaderboard population, and a stranger deciding whether to
 * press Play cares that people are playing, not who they are.
 *
 * Bounded with `.take` rather than `.collect()` so this stays cheap on the one page every
 * uncached visitor loads.
 */
export const todayStats = query({
  args: {},
  handler: async (ctx) => {
    const date = todayKey();
    const runs = await ctx.db
      .query("dailyRuns")
      .withIndex("by_date_points", (q) => q.eq("date", date))
      .take(TODAY_COUNT_CEILING + 1);

    return {
      date,
      players: Math.min(runs.length, TODAY_COUNT_CEILING),
      /** True when the real figure is higher than `players`. */
      atLeast: runs.length > TODAY_COUNT_CEILING,
    };
  },
});

/**
 * How far down a day's board `myRun` counts before it stops.
 *
 * Higher than `TODAY_COUNT_CEILING` because that one only has to say "lots"; this one
 * is a position someone reads as their own result.
 */
const DAILY_COUNT_CEILING = 5_000;

/**
 * The current player's own run and standing, for the result card.
 *
 * Works for guests as well as signed-in players — an anonymous run still gets a real
 * score and a real position, which is the whole reason the daily is worth opening up.
 */
export const myRun = query({
  args: { date: v.optional(v.string()), guestToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await actingUser(ctx, args.guestToken);
    if (!user) return null;

    const date = args.date ?? todayKey();

    const run = await ctx.db
      .query("dailyRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", date))
      .unique();

    if (!run) return null;

    // Walks the board in the order `leaderboard` lists it and stops at this run's own
    // slot, so the rank here is the row index that board would give it. Counting better
    // scores instead — the previous approach — hands every tied score the same number
    // while the board numbers them by list position, and two people tying on a
    // five-round daily is ordinary rather than rare.
    let ahead = 0;
    for await (const other of ctx.db
      .query("dailyRuns")
      .withIndex("by_date_points", (q) =>
        q.eq("date", date).gte("totalPoints", run.totalPoints),
      )
      // Guests are excluded here and on the board, so the position is measured against
      // exactly the population the board lists.
      .filter((q) => q.neq(q.field("isGuest"), true))
      .order("desc")) {
      // `_creationTime` is the index's implicit last column, so descending order breaks
      // ties newest-first. Compared by slot rather than `_id` because a guest's own run
      // is filtered out of this stream and would otherwise never terminate the walk.
      if (
        other.totalPoints === run.totalPoints &&
        other._creationTime <= run._creationTime
      ) {
        break;
      }
      if (++ahead > DAILY_COUNT_CEILING) break;
    }

    // Bounded for the same reason as `todayStats`: this used to `.collect()` every run
    // for the date, which is fine at launch and stops being fine without warning.
    const counted = await ctx.db
      .query("dailyRuns")
      .withIndex("by_date_points", (q) => q.eq("date", date))
      .filter((q) => q.neq(q.field("isGuest"), true))
      .take(DAILY_COUNT_CEILING);
    const total = counted.length;

    // A guest is not in the counted population, so their own run has to be added to
    // the total — otherwise "#4 of 3" is possible.
    const isGuest = run.isGuest === true;

    return {
      ...run,
      rank: ahead + 1,
      totalPlayers: isGuest ? total + 1 : total,
      isGuest,
      xpEarned: isGuest ? null : await xpEarnedForRun(ctx, user._id, date),
    };
  },
});

/**
 * XP the daily match on `date` actually paid this player.
 *
 * A read-side join rather than a field on `dailyRuns`, because the two writes race:
 * `complete` is client-triggered and `progression.finalizeMatch` is scheduled from
 * `finishMatch`, so neither can be relied on to land first. Reading it means whichever
 * order they happen in, the number is right once it exists — and null until it does,
 * which the results screen renders as "no line yet" rather than as zero.
 *
 * Bounded scan over the same recent-matches window `start` already uses. Returns the
 * awarded total, not the base rate: correct guesses and snap calls are both in there.
 */
async function xpEarnedForRun(
  ctx: QueryCtx,
  userId: Id<"users">,
  date: string,
): Promise<number | null> {
  const recent = await ctx.db
    .query("matchPlayers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(10);

  for (const entry of recent) {
    if (entry.xpEarned === undefined) continue;
    const match = await ctx.db.get(entry.matchId);
    if (match?.mode === "daily" && todayKey(match.createdAt) === date) {
      return entry.xpEarned;
    }
  }

  return null;
}
