import { t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { ReducerCtx } from "./ctx";
import { reject, toMs } from "./lib";
import { ensureGuestUser, requireSenderUser, senderUser } from "./users";
import { currentVersionId } from "./config";
import { pickTracksForMatch } from "./catalogue";
import { startCountdown } from "./phases";
import { DAILY_SONGS } from "../../src/engine/config";

/**
 * The daily challenge.
 *
 * The front door: one set of five songs a day, identical worldwide, playable without
 * an account. That last part is what shapes this module — every other mode goes
 * through `requireFullAccount`, and this one deliberately does not.
 *
 * WHAT CHANGED FROM CONVEX. The guest bearer token is gone. Convex required a JWT for
 * every call, so anonymous play had to present *something*, and that something was a
 * client-supplied string the server had to treat as an assertion about who you were.
 * SpacetimeDB mints an anonymous identity per connection, so a guest is now simply a
 * caller whose account is flagged — `ctx.sender` is as trustworthy for them as for a
 * signed-in player, and every `guestToken` argument disappears with it.
 *
 * The reads are gone too. `activeRun`, `leaderboard`, `todayStats` and `myRun` were
 * queries; `daily_run` and `daily_count` are public tables the client subscribes to
 * and composes itself.
 */

/** The UTC date key for a timestamp. Matches `todayKey` in the engine's streak module. */
export function todayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Returns today's challenge, creating it on first request.
 *
 * Every player worldwide gets the same five tracks, which is what makes the shared
 * score comparable — and therefore what makes a result card worth posting.
 * Mid-difficulty tier: the daily is the front door, so it must not be brutal.
 */
function ensureChallenge(ctx: ReducerCtx, date: string): bigint[] {
  const existing = ctx.db.daily_challenge.date.find(date);
  if (existing) return existing.trackIds;

  const trackIds = pickTracksForMatch(ctx, {
    targetTier: 2,
    bannedCategoryIds: [],
    count: DAILY_SONGS,
  });

  // Not stored when short, so the first request of a day that happens to arrive
  // against a thin catalogue does not freeze a broken setlist in for 24 hours.
  if (trackIds.length < DAILY_SONGS) return trackIds;

  ctx.db.daily_challenge.insert({ id: 0n, date, trackIds });
  return trackIds;
}

/**
 * The player for a daily action: the signed-in user, or a guest created on demand.
 *
 * The only place a guest row is ever created, and only as a side effect of actually
 * starting a run — so a visitor who never plays leaves nothing behind.
 */
function resolveDailyPlayer(ctx: ReducerCtx) {
  return senderUser(ctx) ?? ensureGuestUser(ctx);
}

/** This player's unfinished daily match for `date`, if there is one. */
function findLiveDailyMatch(
  ctx: ReducerCtx,
  userId: bigint,
  date: string,
): bigint | undefined {
  for (const membership of ctx.db.match_player.userId.filter(userId)) {
    const match = ctx.db.match.id.find(membership.matchId);
    if (!match) continue;
    if (match.mode !== "daily") continue;
    if (match.status !== "active") continue;
    if (todayKey(toMs(match.createdAt)) !== date) continue;
    return match.id;
  }
  return undefined;
}

export const startDaily = spacetimedb.reducer({}, (ctx) => {
  const player = resolveDailyPlayer(ctx);
  const date = todayKey(toMs(ctx.timestamp));

  // A recorded run closes the day. Checked before the live match below, which is what
  // makes `forfeitDaily` final.
  for (const run of ctx.db.daily_run.by_user_date.filter([player.id, date])) {
    void run;
    return;
  }

  /**
   * Resume rather than restart.
   *
   * The recorded-run check above only fires once a run has been written, and a run is
   * only written by finishing or leaving. So abandoning a daily part-way and starting
   * again used to mint a second match over the same five tracks — a second attempt at
   * songs already heard.
   */
  if (findLiveDailyMatch(ctx, player.id, date) !== undefined) return;

  const trackIds = ensureChallenge(ctx, date);
  if (trackIds.length < DAILY_SONGS) reject("Not enough playable songs yet");

  const match = ctx.db.match.insert({
    id: 0n,
    mode: "daily",
    status: "active",
    playerIds: [player.id],
    totalRounds: DAILY_SONGS,
    bannedCategoryIds: [],
    vetoPoolIds: [],
    vetoDeadline: undefined,
    banOrder: [],
    banTurn: 0,
    currentRound: 0,
    roundStartedAt: undefined,
    phase: "countdown",
    phaseEndsAt: undefined,
    suddenDeath: false,
    roomId: undefined,
    winnerId: undefined,
    createdAt: ctx.timestamp,
    completedAt: undefined,
    /**
     * Freeze the rules this run is played under, so a config saved mid-run cannot
     * change the scoring underneath the player.
     */
    configVersionId: currentVersionId(ctx),
  });

  trackIds.forEach((trackId, roundIndex) => {
    ctx.db.match_track.insert({ id: 0n, matchId: match.id, roundIndex, trackId });
  });

  ctx.db.match_player.insert({
    id: 0n,
    matchId: match.id,
    userId: player.id,
    totalPoints: 0,
    ratingBefore: player.elo,
    globalRankAtStart: undefined,
    ratingAfter: undefined,
    ratingDelta: undefined,
    bannedCategoryIds: [],
    hasBanned: false,
    hp: 0,
    lowestHp: 0,
    eliminatedAtRound: undefined,
    readyForRound: -1,
    vsReadyAt: undefined,
    passedRound: undefined,
    xpEarned: 0,
    xpBreakdown: [],
    levelBefore: undefined,
    levelAfter: undefined,
    xpAfter: undefined,
    badgesEarned: [],
    forfeited: false,
    mode: "daily",
    completedAt: undefined,
    outcome: undefined,
    opponentId: undefined,
  });

  // Solo, so no VS screen — but the countdown, reveal and standings beats still apply.
  // The drama is the point, not the opponent.
  startCountdown(ctx, match.id, 0);
});

/** Records the finished run. The daily never affects rating. */
export const completeDaily = spacetimedb.reducer(
  { matchId: t.u64() },
  (ctx, { matchId }) => {
    const player = requireSenderUser(ctx);
    const match = ctx.db.match.id.find(matchId);
    if (!match || match.mode !== "daily") reject("Not a daily match");
    if (!match.playerIds.includes(player.id)) reject("Not your run");

    recordRun(ctx, player.id, match.id, todayKey(toMs(match.createdAt)));
  },
);

/**
 * Ends a run early, keeping whatever was earned.
 *
 * Leaving used to abandon the match without recording anything, which left a hole
 * worth closing: an abandoned round never advances, so coming back later resumed that
 * same frozen round with a fresh audio clock — and the clock validator only bounds a
 * claim against how long the server has been waiting, which by then is enormous. You
 * could hear song one, leave, return an hour later and score a snap on a track you
 * already knew.
 *
 * Recording the run is what shuts that: `startDaily` checks for a recorded run BEFORE
 * it looks for a live match, so once this has written a row there is nothing to come
 * back to.
 *
 * Unplayed songs score zero, exactly as an unsolved song does — a run left after three
 * of five keeps those three. Voiding everything would punish a dropped connection
 * precisely as hard as a deliberate exit, and the server cannot tell them apart.
 */
export const forfeitDaily = spacetimedb.reducer(
  { matchId: t.u64() },
  (ctx, { matchId }) => {
    const player = requireSenderUser(ctx);
    const match = ctx.db.match.id.find(matchId);
    if (!match || match.mode !== "daily") reject("Not a daily match");
    if (!match.playerIds.includes(player.id)) reject("Not your run");

    recordRun(ctx, player.id, match.id, todayKey(toMs(match.createdAt)));

    // Belt and braces. `startDaily` already refuses on the recorded run, but leaving
    // the match active would keep it in every live-match scan for no reason.
    const current = ctx.db.match.id.find(matchId);
    if (current && current.status === "active") {
      ctx.db.match.id.update({
        ...current,
        status: "complete",
        phase: "match_end",
        phaseEndsAt: undefined,
        completedAt: ctx.timestamp,
      });
    }
  },
);

/**
 * Writes the `daily_run` row for a match, scoring every round it contains.
 *
 * Shared by finishing and leaving rather than copied, because the two must agree on
 * what a run was worth — a second copy of this loop is how the totals start diverging.
 * Idempotent: an existing row for the day wins and is left untouched.
 */
function recordRun(
  ctx: ReducerCtx,
  userId: bigint,
  matchId: bigint,
  date: string,
): void {
  for (const existing of ctx.db.daily_run.by_user_date.filter([userId, date])) {
    void existing;
    return;
  }

  const user = ctx.db.user.id.find(userId);
  if (!user) return;

  const guesses = [...ctx.db.guess.matchId.filter(matchId)];
  const rounds = [...ctx.db.match_track.matchId.filter(matchId)].length;

  const perRoundPoints: number[] = [];
  const perRoundMs: number[] = [];

  // Every round in the match, not every round played — so a run abandoned early is
  // recorded as the full five with zeros on the songs never reached.
  for (let round = 0; round < rounds; round++) {
    const solved = guesses.find(
      (guess) => guess.roundIndex === round && guess.userId === userId && guess.correct,
    );
    perRoundPoints.push(solved?.points ?? 0);
    // -1 marks "never solved", distinct from a genuine 0ms.
    perRoundMs.push(solved ? Math.round(solved.clientElapsedMs) : -1);
  }

  claimDailyCount(ctx, date);

  ctx.db.daily_run.insert({
    id: 0n,
    userId,
    date,
    totalPoints: perRoundPoints.reduce((sum, points) => sum + points, 0),
    perRoundPoints,
    perRoundMs,
    completedAt: ctx.timestamp,
    // Denormalised so the board can exclude guests without a lookup per run.
    isGuest: user.isGuest,
  });
}

/**
 * Keeps the day's tally in step, so the landing page reads one row instead of
 * counting a thousand.
 *
 * A missing row is seeded by counting what is already stored rather than starting at
 * one — otherwise the day this counter first ran would report only the runs that
 * happened after it.
 */
function claimDailyCount(ctx: ReducerCtx, date: string): void {
  const counter = ctx.db.daily_count.date.find(date);

  if (counter) {
    ctx.db.daily_count.id.update({ ...counter, players: counter.players + 1 });
    return;
  }

  let alreadyToday = 0;
  for (const run of ctx.db.daily_run.date.filter(date)) {
    void run;
    alreadyToday++;
  }

  ctx.db.daily_count.insert({ id: 0n, date, players: alreadyToday + 1 });
}

/**
 * Moves a guest's runs onto the account that just signed in.
 *
 * This is the payoff for playing without an account: the result you already earned
 * follows you onto the board under your own name, rather than being the price of not
 * having signed up first.
 *
 * The token is a capability the guest already held — written by `ensureGuestUser` and
 * readable only through the `me` view — rather than a name the caller invents. That is
 * the difference from the Convex version, where the token arrived from the browser and
 * had to be trusted on the client's word.
 *
 * Idempotent, and safe to call with a token that has no runs or has already been
 * claimed.
 */
export const claimGuestRuns = spacetimedb.reducer(
  { token: t.string() },
  (ctx, { token }) => {
    const player = requireSenderUser(ctx);
    if (player.isGuest) reject("Sign in to claim a guest run");

    const guest = [...ctx.db.user.isGuest.filter(true)].find(
      (row) => row.guestClaimToken === token,
    );
    if (!guest || guest.id === player.id) return;
    if (guest.guestClaimedAt !== undefined) return;

    for (const run of [...ctx.db.daily_run.userId.filter(guest.id)]) {
      // The real account's own run always wins — a signed-in result is the record,
      // and silently replacing it with an anonymous one would lose real history.
      let mine = false;
      for (const own of ctx.db.daily_run.by_user_date.filter([player.id, run.date])) {
        void own;
        mine = true;
        break;
      }
      if (mine) continue;

      ctx.db.daily_run.id.update({ ...run, userId: player.id, isGuest: false });
    }

    // Retired rather than deleted: matches and guesses still reference it, and
    // deleting would leave those dangling. Guest expiry reaps it later.
    ctx.db.user.id.update({
      ...guest,
      guestClaimedAt: ctx.timestamp,
      guestClaimToken: undefined,
    });
  },
);
