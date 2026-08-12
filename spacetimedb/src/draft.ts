import { t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { ReducerCtx } from "./ctx";
import { reject, timestampFrom } from "./lib";
import { requireFullAccount } from "./users";
import { closeDraft } from "./phases";
import {
  MAX_DUEL_ROUNDS,
  VETO_BANS_PER_PLAYER,
  VETO_PHASE_MS,
  VETO_POOL_SIZE,
} from "../../src/engine/config";

/**
 * The ban draft, shared by every duel mode.
 *
 * Ranked and practice run the SAME draft — practice is meant to rehearse ranked, so a
 * practice match that skipped straight to the first song would be rehearsing a
 * different game. Kept in its own module rather than in the matchmaking one so a bot's
 * turn can reach it without practice code importing ranked code.
 *
 * This module depends on `./phases` and nothing depends on it, which is what keeps the
 * direction one-way: `closeDraft` owns what happens when the draft ends, and the last
 * ban simply tells it the draft ended.
 */

/** Total bans placed across the whole draft, both players combined. */
export const TOTAL_BANS = VETO_BANS_PER_PLAYER * 2;

/**
 * Tracks drawn per duel.
 *
 * A duel has no fixed length, so enough is reserved for the worst case: two players
 * trading rounds until `MAX_DUEL_ROUNDS` forces a decision.
 */
export const DUEL_TRACK_COUNT = MAX_DUEL_ROUNDS;

/**
 * Chooses the categories offered in the ban phase.
 *
 * `ctx.random` rather than `Math.random` for the reason given in the catalogue module:
 * the platform seeds it per execution, so a reducer that ran twice would otherwise
 * shuffle identically and the "random" pool would be the same pool.
 */
export function pickVetoPool(ctx: ReducerCtx): bigint[] {
  const all = [...ctx.db.category.iter()];

  for (let i = all.length - 1; i > 0; i--) {
    const j = ctx.random.integerInRange(0, i);
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(0, VETO_POOL_SIZE).map((category) => category.id);
}

/** Whose turn it is, or `undefined` once the draft is closed. */
export function draftTurnOwner(match: {
  banOrder: bigint[];
  banTurn: number;
}): bigint | undefined {
  if (match.banOrder.length === 0) return undefined;
  if (match.banTurn >= TOTAL_BANS) return undefined;

  // Turn order alternates through banOrder, wrapping for the second round of bans.
  return match.banOrder[match.banTurn % match.banOrder.length];
}

/**
 * Writes one ban and hands the turn over.
 *
 * Split from the reducer because a human's ban is rejected loudly while a bot's is
 * simply skipped — the validation differs, the write does not.
 */
export function placeBan(
  ctx: ReducerCtx,
  matchId: bigint,
  categoryId: bigint,
): void {
  const match = ctx.db.match.id.find(matchId);
  if (!match) return;

  ctx.db.match.id.update({
    ...match,
    bannedCategoryIds: [...match.bannedCategoryIds, categoryId],
    banTurn: match.banTurn + 1,
    // Each turn gets its own clock, so a slow opponent cannot burn the whole draft.
    vetoDeadline: timestampFrom(ctx.timestamp, VETO_PHASE_MS),
  });

  const after = ctx.db.match.id.find(matchId);
  if (after && after.banTurn >= TOTAL_BANS) closeDraft(ctx, after);
}

/**
 * Bans a category, on your turn.
 *
 * Every rejection here is a genuine client bug or a race with the watchdog, so they
 * are loud rather than silent — a ban that quietly did nothing would leave the player
 * staring at a turn indicator that never moved.
 */
export const submitBan = spacetimedb.reducer(
  { matchId: t.u64(), categoryId: t.u64() },
  (ctx, { matchId, categoryId }) => {
    const player = requireFullAccount(ctx);

    const match = ctx.db.match.id.find(matchId);
    if (!match) reject("No such match");
    if (match.phase !== "veto") reject("The draft is closed");

    if (draftTurnOwner(match) !== player.id) reject("Not your turn");

    if (!match.vetoPoolIds.includes(categoryId)) {
      reject("That category is not in this draft");
    }
    if (match.bannedCategoryIds.includes(categoryId)) {
      reject("That category is already banned");
    }

    placeBan(ctx, matchId, categoryId);
  },
);
