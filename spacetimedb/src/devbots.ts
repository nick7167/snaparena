import { ScheduleAt } from "spacetimedb";
import { t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { ReducerCtx } from "./ctx";
import { microsFrom, reject, toMs } from "./lib";
import { requireAdmin, requireOwnerOrAdmin } from "./users";
import { DEV_BOT_REFILL_INTERVAL_MS, devFeaturesEnabled } from "./config";
import { finishMatch } from "./phases";
import {
  DEV_BOT_MIN_WAIT_MS,
  DEV_RANK_BOT_PERSONAS,
  isDevRankBotPersona,
} from "../../src/engine/dev-rank-bots";
import { PLACEMENT_MATCHES, STARTING_ELO } from "../../src/engine/config";

/**
 * DEV ONLY — sixteen rated bot opponents, one per rank. DELETE BEFORE PUBLISHING.
 *
 * Everything dev-only lives in this one file so the teardown is a deletion rather than
 * an archaeology exercise. The removal checklist is at the bottom.
 *
 * Unlike `bots.ts`, these play REAL ranked matches: they sit in `queue_entry`, so the
 * matchmaking sweep pairs them through its ordinary path and creates a `mode: "ranked"`
 * duel — which means the progression pass moves both players' Elo, burns placements, and
 * awards XP and badges exactly as a human opponent would. That is the entire point: the
 * placement gate, promotions and a populated leaderboard cannot be tested against a
 * `mode: "practice"` opponent that by design cannot move rating.
 *
 * WHAT CHANGED FROM CONVEX. Three things, all consequences of the platform:
 *
 *   - `assertAdmin(secret)` is gone. ADMIN_IMPORT_SECRET was a password shared between
 *     `.env.local` and the deployment; here the publisher's identity is in `module_owner`
 *     and the admin role is in `user.role`, so `requireOwnerOrAdmin` is the whole check.
 *   - `purge` is one transaction rather than a batch the caller re-runs until `done`.
 *     The batching existed for Convex's per-mutation read/write limits, and a reducer
 *     returns nothing anyway — there is no `done` it could hand back.
 *   - The refill is an interval ROW, armed and disarmed by `setDevFeatures` rather than
 *     declared in a crons file. Turning developer features off deletes the row, so a
 *     deployment with the switch off pays nothing for this file existing.
 */

// ---------------------------------------------------------------------------
// Identifying our own
// ---------------------------------------------------------------------------

type UserRow = ReturnType<ReducerCtx["db"]["user"]["id"]["find"]>;

/** True if this user is one of ours — never one of the twelve shipping practice bots. */
function isDevRankBot(user: UserRow): boolean {
  return user?.isBot === true && isDevRankBotPersona(user.botPersonaId);
}

/** Every seeded rank bot, in persona order. Missing personas are simply absent. */
function roster(ctx: ReducerCtx): NonNullable<UserRow>[] {
  const found: NonNullable<UserRow>[] = [];
  for (const persona of DEV_RANK_BOT_PERSONAS) {
    const bot = ctx.db.user.handle.find(persona.handle);
    if (bot) found.push(bot);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/**
 * Creates or refreshes the sixteen rank bots. Idempotent, and doubles as a rating reset —
 * re-running puts every bot back on its anchor.
 *
 * The reset is not a separate reducer, for the same reason the practice roster has only
 * `seedBots`: "reset" means "make the row match the persona again", which is exactly what
 * seeding does. Two reducers doing that would be two chances to disagree.
 *
 * Gated on developer features as well as the role. Sixteen bot accounts appearing on a
 * live deployment is precisely what that switch is for, and the admin screen already
 * disables the buttons while it is off.
 */
export const seedDevRankBots = spacetimedb.reducer({}, (ctx) => {
  requireOwnerOrAdmin(ctx);
  requireDevFeatures(ctx);

  for (const persona of DEV_RANK_BOT_PERSONAS) {
    const existing = ctx.db.user.handle.find(persona.handle);

    /**
     * Never seed over an account a person signed up for.
     *
     * Nothing reserves these handles — `rank_gold_2` passes the handle pattern like any
     * other — so a player could be holding one before this ever runs. Matching on handle
     * alone would then overwrite THEIR row, and the purge below would later delete it.
     */
    if (existing && !existing.isBot) {
      reject(`Handle ${persona.handle} belongs to a real player`);
    }

    if (existing) {
      ctx.db.user.id.update({
        ...existing,
        displayName: persona.displayName,
        elo: persona.elo,
        bio: persona.bio,
        botPersonaId: persona.id,
        placementsRemaining: 0,
      });

      /**
       * The queue row carries its own rating snapshot, used for band matching. Left
       * stale it would keep matching the bot at a rating it no longer holds — which is
       * the whole failure mode a re-anchor is meant to fix.
       */
      const queued = ctx.db.queue_entry.userId.find(existing.id);
      if (queued) {
        ctx.db.queue_entry.userId.update({ ...queued, elo: persona.elo, isBot: true });
      }
      continue;
    }

    ctx.db.user.insert({
      id: 0n,
      handle: persona.handle,
      displayName: persona.displayName,
      avatarUrl: undefined,
      avatarHidden: false,
      elo: persona.elo,
      gamesPlayed: 0,
      /**
       * Zero, so they clear the ladder's placement filter and appear immediately. A rank
       * bot that has to play five matches before it shows a rank is useless — the board
       * being populated is the thing being tested.
       */
      placementsRemaining: 0,
      createdAt: ctx.timestamp,
      role: undefined,
      xp: 0,
      level: 1,
      rankedWins: 0,
      snapGuesses: 0,
      onboardedAt: ctx.timestamp,
      welcomeStep: undefined,
      tutorialCompletedAt: undefined,
      bio: persona.bio,
      bioHidden: false,
      isBot: true,
      botPersonaId: persona.id,
      lastPracticePersonaId: undefined,
      isGuest: false,
      guestClaimedAt: undefined,
      guestClaimToken: undefined,
    });

    /**
     * No `account` row, and no career either.
     *
     * The account is deliberate — see `seedBots`. The career is a GAP: Convex called
     * `seedBotProfiles` here, which played out a simulated past so a bot read as an
     * account rather than a placeholder, and `convex/botprofiles.ts` has not been
     * ported. `src/engine/bot-career.ts` — the pure half, and the part with the tests —
     * is untouched and still generates the same careers, so the port is a writer over
     * these tables rather than a rewrite. Until then every bot shows `0W · 0L`, Level 1
     * and no badges, which affects how the profile and VS screens LOOK and nothing at
     * all about how ranked BEHAVES.
     */
  }

  // Seeding a roster while the refill is disarmed would leave them out of the queue
  // until the next toggle. Cheap to arm here; the guard makes a second call a no-op.
  armDevBotRefill(ctx);
});

// ---------------------------------------------------------------------------
// Queue presence
// ---------------------------------------------------------------------------

/**
 * How long a match containing a rank bot may sit unfinished before it is abandoned.
 *
 * Comfortably longer than a real duel: 18 rounds at ~45s of phases each is about
 * thirteen minutes. This only ever catches a match whose human walked away — without it
 * that bot is parked in a dead match forever and never returns to the queue.
 */
const STALE_BOT_MATCH_MS = 30 * 60_000;

/** Arms the recurring refill. Idempotent, so seeding twice is not two intervals. */
function armDevBotRefill(ctx: ReducerCtx): void {
  if (ctx.db.devbot_refill_schedule.count() > 0n) return;

  ctx.db.devbot_refill_schedule.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.interval(BigInt(DEV_BOT_REFILL_INTERVAL_MS) * 1_000n),
  });
}

/**
 * Stops the refill entirely.
 *
 * Convex gated its cron inside the handler and let the schedule keep firing, because a
 * cron there is a declaration in a file rather than a row. Here the interval is a row,
 * so switching developer features off can delete it — and a deployment with the switch
 * off runs no dev code at all rather than running a guard clause every minute forever.
 */
function disarmDevBotRefill(ctx: ReducerCtx): void {
  for (const row of ctx.db.devbot_refill_schedule.iter()) {
    ctx.db.devbot_refill_schedule.scheduled_id.delete(row.scheduled_id);
  }
}

/**
 * Keeps the sixteen bots sitting in the ranked queue.
 *
 * A bot's queue row is CONSUMED when it is matched, so this is a refill on a timer
 * rather than a one-off seed. Without it, testing ranked alone works exactly once.
 *
 * Still gated on the flag despite `disarmDevBotRefill`, because the two can disagree for
 * one tick: an interval that has already been handed to the scheduler fires once more
 * after its row is deleted. This makes that firing a no-op, and cleans up after itself.
 */
export function runRefillDevBotQueue(ctx: ReducerCtx): void {
  if (!devFeaturesEnabled(ctx)) {
    disarmDevBotRefill(ctx);
    return;
  }

  reapStaleBotMatches(ctx);

  for (const bot of roster(ctx)) {
    const queued = ctx.db.queue_entry.userId.find(bot.id);

    if (queued) {
      /**
       * Re-read the bot's live rating rather than trusting the snapshot: these ratings
       * drift with every rated result, and band matching reads the queue row.
       */
      if (queued.elo !== bot.elo || !queued.isBot) {
        ctx.db.queue_entry.userId.update({ ...queued, elo: bot.elo, isBot: true });
      }
      continue;
    }

    // Never pull a bot into a second match. It is already busy in the first.
    if (inLiveMatch(ctx, bot.id)) continue;

    ctx.db.queue_entry.insert({
      userId: bot.id,
      elo: bot.elo,
      enqueuedAt: ctx.timestamp,
      /**
       * Keeps the roster out of the "players waiting" readout, and out of the sweeper's
       * matchability test — sixteen permanent rows would otherwise keep the sweep chain
       * re-arming every two seconds forever, on a deployment where nobody is playing.
       */
      isBot: true,
    });
  }
}

/** True if this player is in a match right now, so a bot is never pulled into two. */
function inLiveMatch(ctx: ReducerCtx, userId: bigint): boolean {
  for (const entry of ctx.db.match_player.userId.filter(userId)) {
    const match = ctx.db.match.id.find(entry.matchId);
    if (match && (match.status === "veto" || match.status === "active")) return true;
  }
  return false;
}

/**
 * Abandons matches a rank bot is stuck in.
 *
 * ABANDONED RATHER THAN FINISHED, deliberately. The progression pass never runs on an
 * abandoned match, so walking out of a losing duel against a bot costs no rating — the
 * right call for a dev fixture, since awarding the bot a win on a match nobody watched
 * would corrupt the very ladder being tested. A human who quits a match against another
 * HUMAN still forfeits; that is the forfeit sweep, and it is untouched.
 */
function reapStaleBotMatches(ctx: ReducerCtx): void {
  const cutoff = toMs(ctx.timestamp) - STALE_BOT_MATCH_MS;

  for (const status of ["veto", "active"] as const) {
    for (const match of ctx.db.match.by_status.filter(status)) {
      if (toMs(match.createdAt) > cutoff) continue;
      if (!match.playerIds.some((id) => isDevRankBot(ctx.db.user.id.find(id)))) continue;

      ctx.db.match.id.update({
        ...match,
        status: "abandoned",
        phase: "match_end",
        phaseEndsAt: undefined,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

/**
 * Chooses an opponent for `player` when the dev roster is live.
 *
 * Two departures from the ordinary longest-waiting rule, both deliberate:
 *
 * A queued HUMAN always wins, ranked by longest wait — production semantics, untouched,
 * so two real players in the queue still find each other rather than each being handed a
 * bot. Only when there is no human does the bot rule apply, and there it picks the
 * NEAREST RATING rather than the longest wait. Longest-waiting would hand back whichever
 * bot happened to hold the oldest queue row, which is the same opponent every time;
 * nearest-Elo means you fight your own rank, and climbing walks you up the roster one
 * rank at a time — which is the thing being tested.
 *
 * `candidates` is expected sorted oldest-first, which is how the caller already has it.
 */
export function pickDevOpponent<Entry extends { userId: bigint; isBot: boolean }>(
  ctx: ReducerCtx,
  player: { elo: number },
  candidates: Entry[],
  waitMs: number,
): Entry | undefined {
  const human = candidates.find((entry) => !entry.isBot);
  if (human) return human;

  /**
   * The bots are always there, so without a floor the search is over before it is
   * legible — you press Find a match and are in a duel before the screen has drawn.
   * Humans above are matched on the first sweep regardless.
   */
  if (waitMs < DEV_BOT_MIN_WAIT_MS) return undefined;

  let best: Entry | undefined;
  let bestGap = Number.POSITIVE_INFINITY;

  for (const entry of candidates) {
    const bot = ctx.db.user.id.find(entry.userId);
    if (!bot) continue;

    const gap = Math.abs(bot.elo - player.elo);
    if (gap < bestGap) {
      best = entry;
      bestGap = gap;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Instant resolve
// ---------------------------------------------------------------------------

/**
 * Ends the caller's current match immediately with a chosen result.
 *
 * A duel runs nine to twelve songs at thirty seconds each, so clearing five placement
 * matches is roughly forty minutes of play — long enough that the placement gate, the
 * promotion animation and the leaderboard transition would go untested in practice.
 *
 * Routed through the real `finishMatch`, which schedules the progression pass, so Elo,
 * placements, per-category ratings, XP, level-ups, badges and the results screen all run
 * through the genuine path. The only thing skipped is the songs.
 *
 * ADMIN ONLY, and the deployment flag is not enough on its own. This project points
 * local development and the live site at ONE database, so developer features being on
 * means they are on in production too. With only that check, any signed-in player could
 * call this reducer directly — the UI is irrelevant, a reducer is reachable from a
 * console — and hand themselves a rated win through the genuine rating path, while their
 * opponent took a real loss. The role is what distinguishes an operator from a player.
 */
export const devResolveNow = spacetimedb.reducer(
  { matchId: t.u64(), outcome: t.string() },
  (ctx, { matchId, outcome }) => {
    requireDevFeatures(ctx);
    const admin = requireAdmin(ctx);

    const match = ctx.db.match.id.find(matchId);
    if (!match) reject("No such match");

    // Derived from the caller's identity, never taken as an argument — otherwise this
    // would be a reducer for ending somebody else's ranked match.
    if (!match.playerIds.some((id) => id === admin.id)) reject("Not your match");
    if (match.status === "complete" || match.status === "abandoned") return;

    const opponentId = match.playerIds.find((id) => id !== admin.id);

    const iWin =
      outcome === "random" ? ctx.random.integerInRange(0, 1) === 1 : outcome === "win";
    const winnerId = iWin ? admin.id : opponentId;
    const loserId = iWin ? opponentId : admin.id;

    /**
     * Zeroed so the results screen reads coherently — a duel that ends with both players
     * on full health looks like a bug. Presentation only: the rating pass decides from
     * `match.winnerId`, not from HP.
     */
    if (loserId !== undefined) {
      const loser = [...ctx.db.match_player.by_match_user.filter([matchId, loserId])][0];
      if (loser) ctx.db.match_player.id.update({ ...loser, hp: 0 });
    }

    finishMatch(ctx, match, winnerId);
  },
);

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

/**
 * Removes the roster and everything it touched.
 *
 * Deletes the MATCHES, not just the bot accounts. An orphaned daily run is inert, but a
 * duel is not: the match history and summary screens join back to both players, so a
 * deleted opponent would surface as a hole in your own record.
 *
 * `resetHandle` scrubs the account that played them back to a fresh signup, so no Elo,
 * level or badge earned against a bot survives into launch. Empty to skip it.
 *
 * ONE TRANSACTION, unlike the Convex version's re-run-until-done batching — that existed
 * for per-mutation read/write limits, and a reducer has no return value to report `done`
 * through anyway.
 */
export const purgeDevRankBots = spacetimedb.reducer(
  { resetHandle: t.string() },
  (ctx, { resetHandle }) => {
    requireOwnerOrAdmin(ctx);

    const bots = roster(ctx);

    /**
     * Queue rows first. A bot that is out of the queue cannot be pulled into a new match
     * by a sweep that lands while the rest of this is still running — and disarming the
     * refill is what stops it being put straight back.
     */
    disarmDevBotRefill(ctx);
    for (const bot of bots) ctx.db.queue_entry.userId.delete(bot.id);

    const matchIds = new Set<bigint>();
    for (const bot of bots) {
      for (const entry of ctx.db.match_player.userId.filter(bot.id)) {
        matchIds.add(entry.matchId);
      }
    }

    for (const matchId of matchIds) {
      /**
       * Every table that keys off a match. Missing one would leave rows pointing at an
       * id that no longer resolves — invisible until something iterates the table and
       * finds a match that is not there.
       */
      deleteBy(ctx.db.guess.matchId.filter(matchId), (row) => ctx.db.guess.id.delete(row.id));
      deleteBy(ctx.db.round_result.matchId.filter(matchId), (row) =>
        ctx.db.round_result.id.delete(row.id),
      );
      deleteBy(ctx.db.round_log.matchId.filter(matchId), (row) =>
        ctx.db.round_log.id.delete(row.id),
      );
      deleteBy(ctx.db.round_reveal.matchId.filter(matchId), (row) =>
        ctx.db.round_reveal.id.delete(row.id),
      );
      deleteBy(ctx.db.match_track.matchId.filter(matchId), (row) =>
        ctx.db.match_track.id.delete(row.id),
      );
      deleteBy(ctx.db.match_player.matchId.filter(matchId), (row) =>
        ctx.db.match_player.id.delete(row.id),
      );
      ctx.db.match.id.delete(matchId);
    }

    for (const bot of bots) {
      deleteBy(ctx.db.category_rating.userId.filter(bot.id), (row) =>
        ctx.db.category_rating.id.delete(row.id),
      );
      deleteBy(ctx.db.user_badge.userId.filter(bot.id), (row) =>
        ctx.db.user_badge.id.delete(row.id),
      );
      ctx.db.ladder_entry.userId.delete(bot.id);
      ctx.db.user.id.delete(bot.id);
    }

    if (resetHandle !== "") resetAccount(ctx, resetHandle.toLowerCase());
  },
);

/**
 * Collects before deleting.
 *
 * Deleting out of a live iterator is the kind of thing that works until it does not, and
 * the cost of materialising a match's worth of rows is nothing next to being sure.
 */
function deleteBy<Row>(rows: Iterable<Row>, remove: (row: Row) => void): void {
  for (const row of [...rows]) remove(row);
}

/** Returns a real account to fresh-signup state. Refuses to touch a bot or a guest. */
function resetAccount(ctx: ReducerCtx, handle: string): void {
  const user = ctx.db.user.handle.find(handle);
  if (!user) reject(`No account with handle ${handle}`);
  if (user.isBot || user.isGuest) reject("Refusing to reset a bot or guest account");

  ctx.db.user.id.update({
    ...user,
    elo: STARTING_ELO,
    gamesPlayed: 0,
    placementsRemaining: PLACEMENT_MATCHES,
    rankedWins: 0,
    xp: 0,
    level: 1,
    snapGuesses: 0,
  });

  deleteBy(ctx.db.user_badge.userId.filter(user.id), (row) =>
    ctx.db.user_badge.id.delete(row.id),
  );
  deleteBy(ctx.db.category_rating.userId.filter(user.id), (row) =>
    ctx.db.category_rating.id.delete(row.id),
  );
  ctx.db.ladder_entry.userId.delete(user.id);
}

// ---------------------------------------------------------------------------

/** The switch, as a guard. Every reducer in this file goes through it. */
function requireDevFeatures(ctx: ReducerCtx): void {
  if (!devFeaturesEnabled(ctx)) reject("Developer features are off for this deployment");
}

/**
 * REMOVAL CHECKLIST — what this file cannot delete for you.
 *
 *   npm run dev-bots purge <your-handle>
 *   /admin → developer features → turn off
 *   rm spacetimedb/src/devbots.ts
 *   rm src/engine/dev-rank-bots.ts src/engine/dev-rank-bots.test.ts
 *   rm scripts/dev-rank-bots.ts            # and its "dev-bots" package.json script
 *   rm e2e/dev-rank-bots.spec.ts
 *
 * Then revert the call sites, each marked with a "DEV ONLY" comment:
 *   - spacetimedb/src/schema.ts      the devbot_refill_schedule table
 *   - spacetimedb/src/schedules.ts   the refillDevBotQueue reducer
 *   - spacetimedb/src/config.ts      the arm/disarm in setDevFeatures
 *   - spacetimedb/src/matchmaking.ts the pickDevOpponent branch in pairFor
 *   - spacetimedb/src/ladder.ts      the showRankBots branch in onBoard
 *   - spacetimedb/src/index.ts       the exports from this file
 *   - src/engine/bots.ts             the personaById fallback
 *   - src/app/admin/dev-controls.tsx the roster buttons
 *   - src/game/DuelMatch.tsx         DevResolveBar
 *   - playwright.config.ts           dev-rank-bots in the authed project's testMatch
 */
