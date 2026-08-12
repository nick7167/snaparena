import { ScheduleAt } from "spacetimedb";
import type { ReducerCtx } from "./ctx";
import { publicAvatarUrl } from "./lib";
import { rankForElo } from "../../src/engine/ranks";

/**
 * The global ladder.
 *
 * A REDESIGN, not a port. Convex held the entire ordering as one `ladderSnapshot`
 * document — roughly 415KB at 5,000 players — because its cost was in reading, and one
 * document read beat walking the users table for every visitor. That shape is actively
 * wrong here, where the cost is in replicating: a single rating change would have
 * re-sent all 5,000 entries to every subscriber with the board open.
 *
 * As rows, the board subscribes to `rank <= ROW_DEPTH`, a player's own position is one
 * lookup by `userId`, and a rebuild that moves three people sends three rows. The
 * binary-search-against-a-frozen-field machinery that made the document approach work —
 * `lowerBound`, `ranksAbove`, the `POSITION_EXACT_TO` ceiling — has nothing left to do
 * and is gone with it.
 *
 * What survives unchanged is the eligibility rule and the reason it is written once:
 * the count and the list it refers to have to be measured against the same set of
 * people. Convex had two copies of that rule and they disagreed, so every bot counted
 * zero players above it and every bot profile read "#1 global".
 */

/** How far down the board carries rows. The leaderboard page asks for exactly this. */
export const ROW_DEPTH = 500;

/** Players ranked at all. Past this, a position is reported as a floor. */
export const LADDER_MAX_ENTRIES = 5_000;

/** How often the ladder rebuilds. Shown to players on the board. */
export const LADDER_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Arms the recurring rebuild. Called once from `init`.
 *
 * Guarded on the table being empty so a republish that re-runs `init` cannot leave two
 * intervals racing each other.
 */
export function armLadderRebuild(ctx: ReducerCtx): void {
  if (ctx.db.ladder_rebuild_schedule.count() > 0n) return;

  ctx.db.ladder_rebuild_schedule.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.interval(BigInt(LADDER_INTERVAL_MS) * 1_000n),
  });
}

/**
 * Who appears on the ladder.
 *
 * ONE definition, used by the ordering and the count alike. Placements must be
 * finished; guests keep their full placement count so that clause already excludes
 * them, but it is stated rather than left as a side effect of how placements happen to
 * work. Bots are opponents, never entries — listing them would make the leaderboard
 * partly a ranking of software — except on a dev deployment, where the sixteen rank
 * bots are most of the population and an empty board tells you nothing.
 */
function onBoard(
  user: { placementsRemaining: number; isGuest: boolean; isBot: boolean },
  showRankBots: boolean,
): boolean {
  if (user.placementsRemaining > 0) return false;
  if (user.isGuest) return false;
  if (user.isBot && !showRankBots) return false;
  return true;
}

/**
 * Rebuilds `ladder_entry`, writing only the rows that actually moved.
 *
 * The diff is the point. A rebuild every five minutes that rewrote all 500 rows would
 * push 500 row updates to every subscriber on a board where usually nothing changed;
 * comparing first means a quiet period costs one `checkedAt` write.
 *
 * `showRankBots` is passed in rather than read here. Reading it would mean importing
 * the config module, and `init` lives in the identity module which imports this one —
 * so config → users → ladder → config closed a cycle. This module stays a leaf, which
 * is the same rule the Convex ladder followed and for the same reason.
 */
export function runRebuildLadder(ctx: ReducerCtx, showRankBots: boolean): void {

  const eligible = [];
  for (const user of ctx.db.user.iter()) {
    if (!onBoard(user, showRankBots)) continue;
    eligible.push(user);
  }

  /**
   * Rating descending, oldest account first on a tie.
   *
   * Convex broke ties newest-first, because it appended `_creationTime` to every index
   * and that was simply what fell out. Oldest-first is the defensible rule: of two
   * players on identical ratings, the one who has held it longer is ahead, and it
   * cannot be gamed by making a new account.
   */
  eligible.sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    const aAt = a.createdAt.microsSinceUnixEpoch;
    const bAt = b.createdAt.microsSinceUnixEpoch;
    return aAt < bAt ? -1 : aAt > bAt ? 1 : 0;
  });

  const ranked = eligible.slice(0, LADDER_MAX_ENTRIES);
  const truncated = eligible.length > LADDER_MAX_ENTRIES;

  const seen = new Set<bigint>();
  const tierCounts = new Map<string, number>();
  let changed = false;

  ranked.forEach((user, index) => {
    const rank = index + 1;
    const tierId = rankForElo(user.elo).tier.id;

    tierCounts.set(tierId, (tierCounts.get(tierId) ?? 0) + 1);
    seen.add(user.id);

    // Past ROW_DEPTH a position is a floor rather than an exact placing: those rows
    // are never rendered, only counted and looked up by their owner.
    const approximate = rank > ROW_DEPTH;

    const next = {
      userId: user.id,
      rank,
      elo: user.elo,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: publicAvatarUrl(user),
      gamesPlayed: user.gamesPlayed,
      level: user.level,
      tierId,
      approximate,
    };

    const existing = ctx.db.ladder_entry.userId.find(user.id);

    if (!existing) {
      ctx.db.ladder_entry.insert(next);
      changed = true;
      return;
    }

    if (
      existing.rank === next.rank &&
      existing.elo === next.elo &&
      existing.handle === next.handle &&
      existing.displayName === next.displayName &&
      existing.avatarUrl === next.avatarUrl &&
      existing.gamesPlayed === next.gamesPlayed &&
      existing.level === next.level &&
      existing.tierId === next.tierId &&
      existing.approximate === next.approximate
    ) {
      return;
    }

    ctx.db.ladder_entry.userId.update(next);
    changed = true;
  });

  // Anyone who fell off the board entirely — a reset, a ban, a dev switch flip.
  for (const entry of [...ctx.db.ladder_entry.iter()]) {
    if (seen.has(entry.userId)) continue;
    ctx.db.ladder_entry.userId.delete(entry.userId);
    changed = true;
  }

  syncTierCounts(ctx, tierCounts);
  writeStatus(ctx, ranked.length, truncated, changed);
}

/** Mirrors the tier histogram, again writing only what moved. */
function syncTierCounts(ctx: ReducerCtx, counts: Map<string, number>): void {
  for (const [tierId, count] of counts) {
    const existing = ctx.db.ladder_tier_count.tierId.find(tierId);
    if (existing) {
      if (existing.count !== count) {
        ctx.db.ladder_tier_count.tierId.update({ tierId, count });
      }
      continue;
    }
    ctx.db.ladder_tier_count.insert({ tierId, count });
  }

  for (const row of [...ctx.db.ladder_tier_count.iter()]) {
    if (!counts.has(row.tierId)) ctx.db.ladder_tier_count.tierId.delete(row.tierId);
  }
}

/**
 * Records the rebuild.
 *
 * `builtAt` moves only when the ordering actually changed, and `checkedAt` on every
 * pass. That split is what lets the board say "updated 2m ago" honestly while still
 * proving the rebuild is alive — a frozen board whose `checkedAt` is current means
 * nothing moved, and one whose `checkedAt` is hours old means the schedule died.
 */
function writeStatus(
  ctx: ReducerCtx,
  playerCount: number,
  truncated: boolean,
  changed: boolean,
): void {
  const existing = [...ctx.db.ladder_status.iter()][0];

  if (!existing) {
    ctx.db.ladder_status.insert({
      id: 0n,
      playerCount,
      truncated,
      builtAt: ctx.timestamp,
      checkedAt: ctx.timestamp,
    });
    return;
  }

  ctx.db.ladder_status.id.update({
    ...existing,
    playerCount,
    truncated,
    builtAt: changed ? ctx.timestamp : existing.builtAt,
    checkedAt: ctx.timestamp,
  });
}
