import { ScheduleAt } from "spacetimedb";
import { Range, t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { ReducerCtx } from "./ctx";
import { microsFrom, reject, toMs } from "./lib";
import { requireFullAccount } from "./users";
import { currentVersionId, devFeaturesEnabled, resolveConfig } from "./config";
import { enterPhase, finishMatch } from "./phases";
import { pickVetoPool } from "./draft";
import { requireCatalogue } from "./catalogue";
import { eloBandFor } from "../../src/engine/matchmaking";
import { canSurrender } from "../../src/engine/duel";
import { DUEL_STARTING_HP, MAX_DUEL_ROUNDS } from "../../src/engine/config";

/**
 * The ranked queue, and the pairing that empties it.
 *
 * WHAT CHANGED FROM CONVEX. The old module carried four queries — `queueStatus`,
 * `myQueueEntry`, `queueSize`, `activeMatch` — that exist here as subscriptions
 * instead: `queue_entry` is a table the client watches, and `activeMatch` is a
 * `match_player` lookup the client already has. What is left is the writes.
 *
 * `tryMatchmake` is gone rather than ported. It existed because browsers running the
 * previous deploy still polled it every two seconds; there is no previous deploy to
 * be compatible with here, and the sweeper does the same work on everyone's behalf.
 *
 * `heartbeat` and the `presence` table are gone too, and that is the port's one real
 * behavioural improvement in this area: presence was inferred from a beat that had
 * stopped arriving, so the forfeit clock could not start until a beat was already
 * overdue. `onDisconnect` arms the sweep from the disconnection itself.
 */

/** How often the server re-checks the pool while anyone could be paired. */
const SWEEP_INTERVAL_MS = 2_000;

/** Queue rows read per pass. Well above any pool this game will see. */
const QUEUE_SCAN = 64;

/** Candidates considered inside the rating band before preference is applied. */
const CANDIDATE_SCAN = 25;

// ---------------------------------------------------------------------------
// Joining and leaving
// ---------------------------------------------------------------------------

export const enqueue = spacetimedb.reducer({}, (ctx) => {
  const player = requireFullAccount(ctx);

  if (ctx.db.queue_entry.userId.find(player.id)) return;

  // Refuse at the door rather than pairing two people into a match that cannot
  // fill its setlist and abandons itself on the far side of the draft.
  requireCatalogue(ctx, MAX_DUEL_ROUNDS);

  const wasSweepable = sweepable(ctx);

  ctx.db.queue_entry.insert({
    userId: player.id,
    elo: player.elo,
    enqueuedAt: ctx.timestamp,
    isBot: player.isBot,
  });

  /**
   * Start the sweeper, but only on the edge where the pool becomes matchable.
   *
   * `sweepMatchmaking` re-arms itself for as long as it is worth running and stops
   * otherwise, so exactly one chain should exist. Arming unconditionally here would
   * start a second every time somebody joined a queue that was already being swept,
   * and each would keep the other alive. Checking the transition — not matchable
   * before, matchable now — means the chain is started by whoever makes a pairing
   * possible and by nobody else.
   */
  if (!wasSweepable && sweepable(ctx)) {
    ctx.db.matchmaking_sweep_schedule.insert({
      scheduled_id: 0n,
      scheduled_at: ScheduleAt.time(microsFrom(ctx.timestamp, 0)),
    });
  }
});

export const dequeue = spacetimedb.reducer({}, (ctx) => {
  const player = requireFullAccount(ctx);
  ctx.db.queue_entry.userId.delete(player.id);
});

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/**
 * Is there anything for a sweep to do?
 *
 * At least one human — bots pair with people, not with each other — and at least two
 * rows, since one entry has nobody to be matched against. This is what stops the
 * chain running forever: the sixteen dev rank bots hold the row count at sixteen
 * permanently, so a sweeper that only asked "is the queue non-empty" would re-arm
 * itself every two seconds for the rest of time, on a deployment where nobody is
 * even playing.
 */
function sweepable(ctx: ReducerCtx): boolean {
  let rows = 0;
  let humans = 0;

  for (const row of ctx.db.queue_entry.iter()) {
    rows++;
    if (!row.isBot) humans++;
    if (rows >= 2 && humans >= 1) return true;
    if (rows >= QUEUE_SCAN) break;
  }

  return false;
}

/**
 * Pairs everyone who can be paired, then re-arms itself while the pool still could.
 *
 * This replaces a two-second poll that every searching client ran for itself. With N
 * people queued that was N mutations every two seconds, each one reading an
 * overlapping slice of the same rating range — so write conflicts grew with the
 * square of the queue and the pool contended with itself hardest exactly when it was
 * busiest. One server-side pass does the same work once.
 *
 * Self-scheduling rather than an interval: a two-second interval is 1.3M calls a
 * month on its own, whereas this costs nothing at all while nobody is searching.
 */
export function runSweepMatchmaking(ctx: ReducerCtx): void {
  /**
   * Humans initiate; bots are only ever chosen as opponents.
   *
   * Not a nicety — a bot's queue row is hours old, so `pairFor` would compute a
   * maxed-out rating band for it and hand back a waiting human immediately, pairing
   * them on the first sweep and skipping the search entirely. Nothing is waiting on
   * a bot's behalf, so nothing is lost.
   *
   * Oldest first, so the longest wait gets first pick of the pool — the same
   * ordering `pairFor` applies when choosing between candidates.
   */
  const ordered = [...ctx.db.queue_entry.iter()]
    .filter((row) => !row.isBot)
    .sort((a, b) => toMs(a.enqueuedAt) - toMs(b.enqueuedAt))
    .slice(0, QUEUE_SCAN);

  for (const row of ordered) {
    // An earlier pairing in this same pass may already have consumed this row.
    const entry = ctx.db.queue_entry.userId.find(row.userId);
    if (!entry) continue;

    const player = ctx.db.user.id.find(entry.userId);
    if (!player) {
      // The account went away while queued; drop the orphan rather than trip over
      // it on every future pass.
      ctx.db.queue_entry.userId.delete(entry.userId);
      continue;
    }

    pairFor(ctx, player.id);
  }

  if (sweepable(ctx)) {
    ctx.db.matchmaking_sweep_schedule.insert({
      scheduled_id: 0n,
      scheduled_at: ScheduleAt.time(microsFrom(ctx.timestamp, SWEEP_INTERVAL_MS)),
    });
  }
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

/**
 * Attempts to pair one queued player with someone else in the queue.
 *
 * A reducer is a transaction, so two callers cannot both claim the same opponent —
 * the queue rows are deleted here, and a second pass finds them already gone.
 *
 * Takes an id rather than rows so every read happens inside the pairing itself:
 * `runSweepMatchmaking` walks a snapshot, and a row it captured may have been
 * consumed by an earlier pairing in the same pass.
 */
function pairFor(ctx: ReducerCtx, userId: bigint): bigint | undefined {
  const player = ctx.db.user.id.find(userId);
  const myEntry = ctx.db.queue_entry.userId.find(userId);
  if (!player || !myEntry) return undefined;

  const waitMs = toMs(ctx.timestamp) - toMs(myEntry.enqueuedAt);
  const band = eloBandFor(waitMs);

  const candidates: typeof myEntry[] = [];
  for (const entry of ctx.db.queue_entry.elo.filter(
    new Range(
      { tag: "included", value: player.elo - band },
      { tag: "included", value: player.elo + band },
    ),
  )) {
    if (entry.userId === userId) continue;
    candidates.push(entry);
    if (candidates.length >= CANDIDATE_SCAN) break;
  }

  if (candidates.length === 0) return undefined;

  /**
   * Prefer the longest-waiting opponent so nobody starves at the back of the pool.
   *
   * DEV ONLY — the bot branch. With the rank bots seeded, "longest waiting" would
   * return the same bot every time, because their rows are hours old. Preferring a
   * queued human keeps the dev pool usable without changing what ranked does when
   * the switch is off, which is the only state that ships.
   */
  candidates.sort((a, b) => toMs(a.enqueuedAt) - toMs(b.enqueuedAt));

  const opponentEntry = devFeaturesEnabled(ctx)
    ? candidates.find((entry) => !entry.isBot) ?? candidates[0]
    : candidates[0];

  const opponent = ctx.db.user.id.find(opponentEntry.userId);
  if (!opponent) {
    ctx.db.queue_entry.userId.delete(opponentEntry.userId);
    return undefined;
  }

  ctx.db.queue_entry.userId.delete(myEntry.userId);
  ctx.db.queue_entry.userId.delete(opponentEntry.userId);

  return createDuel(ctx, player, opponent, "ranked");
}

/**
 * Creates a duel between two players and moves it to the meet-your-opponent beat.
 *
 * Shared by ranked pairing and the practice module, because a practice match is a
 * ranked match with the rating left alone — see the draft, which both run.
 */
export function createDuel(
  ctx: ReducerCtx,
  a: { id: bigint; elo: number },
  b: { id: bigint; elo: number },
  mode: "ranked" | "practice",
): bigint {
  const pool = pickVetoPool(ctx);

  const match = ctx.db.match.insert({
    id: 0n,
    mode,
    status: "veto",
    playerIds: [a.id, b.id],
    totalRounds: MAX_DUEL_ROUNDS,
    bannedCategoryIds: [],
    vetoPoolIds: pool,
    vetoDeadline: undefined,
    // Lower-rated player bans first: a small, legible equaliser that is never
    // arbitrary, unlike a coin flip.
    banOrder: a.elo <= b.elo ? [a.id, b.id] : [b.id, a.id],
    banTurn: 0,
    currentRound: 0,
    roundStartedAt: undefined,
    phase: "vs_reveal",
    phaseEndsAt: undefined,
    suddenDeath: false,
    roomId: undefined,
    winnerId: undefined,
    createdAt: ctx.timestamp,
    completedAt: undefined,
    /**
     * Freeze the rules this match will be played under.
     *
     * Everything downstream — scoring, damage, phase durations, the XP paid at the
     * end — resolves through this id rather than through whatever is current, so a
     * config saved mid-match cannot change the game underneath the players.
     */
    configVersionId: currentVersionId(ctx),
  });

  for (const player of [a, b]) {
    // Frozen at creation so nothing downstream has to touch the ladder to render a
    // scoreboard. Undefined until the ladder has been built at least once.
    const ladderRow = ctx.db.ladder_entry.userId.find(player.id);

    ctx.db.match_player.insert({
      id: 0n,
      matchId: match.id,
      userId: player.id,
      totalPoints: 0,
      ratingBefore: player.elo,
      globalRankAtStart: ladderRow?.rank,
      ratingAfter: undefined,
      ratingDelta: undefined,
      bannedCategoryIds: [],
      hasBanned: false,
      hp: DUEL_STARTING_HP,
      lowestHp: DUEL_STARTING_HP,
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
      mode,
      completedAt: undefined,
      outcome: undefined,
      opponentId: player.id === a.id ? b.id : a.id,
    });
  }

  // Meet your opponent before the draft. The phase machine moves this on to veto.
  enterPhase(ctx, match.id, "vs_reveal");

  return match.id;
}

// ---------------------------------------------------------------------------
// Leaving a duel
// ---------------------------------------------------------------------------

/**
 * Concedes the duel.
 *
 * A ten-minute duel that is already lost is a long time to sit through, and without
 * this the losing player simply closes the tab — leaving the winner waiting out a
 * reconnect grace period for nothing. The rating loss is identical to playing it out.
 */
export const surrender = spacetimedb.reducer({ matchId: t.u64() }, (ctx, { matchId }) => {
  const player = requireFullAccount(ctx);

  const match = ctx.db.match.id.find(matchId);
  if (!match) reject("No such match");
  if (match.status !== "active") return;

  // Rooms eliminate rather than concede; the daily has no opponent.
  if (match.mode === "daily" || match.mode === "room") return;

  /**
   * The early-round gate protects a RATING, so it does not apply to practice.
   *
   * It exists to stop someone bailing out of a rated duel the moment it turns
   * against them. Practice moves no rating, so the gate bought nothing there — and
   * it cost something real: leaving early neither resigned nor got swept, so the
   * match stayed active forever and routed the player straight back into the corpse
   * on every load, with no way out.
   */
  if (match.mode !== "practice") {
    const config = resolveConfig(ctx, match.configVersionId);
    if (!canSurrender(match.currentRound, config.SURRENDER_FROM_ROUND)) return;
  }

  const entry = [...ctx.db.match_player.by_match_user.filter([matchId, player.id])][0];
  if (!entry) return;

  ctx.db.match_player.id.update({ ...entry, forfeited: true, hp: 0 });

  const opponentId = match.playerIds.find((id) => id !== player.id);
  finishMatch(ctx, match, opponentId);
});
