import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { difficultyTierForElo, pickTracksForMatch } from "./tracks";
import {
  MAX_DUEL_ROUNDS,
  STARTING_ELO,
  VETO_BANS_PER_PLAYER,
  VETO_PHASE_MS,
  VETO_POOL_SIZE,
} from "../src/engine/config";
import { enterPhase } from "./phases";

/**
 * The ban draft, shared by every duel mode.
 *
 * Ranked and practice run the *same* draft — practice is meant to rehearse ranked, so
 * a practice match that skipped straight to the first song was rehearsing a different
 * game. Kept in its own module rather than in `ranked.ts` so the bot's turn can reach
 * it without practice code importing ranked code.
 */

/** Total bans placed across the whole draft, both players combined. */
export const TOTAL_BANS = VETO_BANS_PER_PLAYER * 2;

/**
 * Tracks drawn per duel.
 *
 * A duel has no fixed length, so we reserve enough for the worst case: two players
 * trading rounds until MAX_DUEL_ROUNDS forces a decision.
 */
export const DUEL_TRACK_COUNT = MAX_DUEL_ROUNDS;

/** Chooses the categories offered in the ban phase. */
export async function pickVetoPool(ctx: QueryCtx | MutationCtx): Promise<Id<"categories">[]> {
  const all = await ctx.db.query("categories").collect();
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, VETO_POOL_SIZE).map((category) => category._id);
}

/** Whose turn it is, and whether the draft is still open. */
export function draftTurnOwner(match: Doc<"matches">): Id<"users"> | null {
  const order = match.banOrder ?? [];
  const turn = match.banTurn ?? 0;
  if (order.length === 0 || turn >= TOTAL_BANS) return null;
  // Turn order alternates through banOrder, wrapping for the second round of bans.
  return order[turn % order.length];
}

/**
 * Writes one ban and hands the turn over.
 *
 * Validation lives with the caller, because a human ban is rejected loudly while a
 * bot's is simply skipped.
 */
export async function placeBan(
  ctx: MutationCtx,
  match: Doc<"matches">,
  categoryId: Id<"categories">,
): Promise<void> {
  await ctx.db.patch(match._id, {
    bannedCategoryIds: [...match.bannedCategoryIds, categoryId],
    banTurn: (match.banTurn ?? 0) + 1,
    // Each turn gets its own clock, so a slow opponent cannot burn the whole draft.
    vetoDeadline: Date.now() + VETO_PHASE_MS,
  });
}

/**
 * Starts the duel once the draft is complete, or once the turn clock expires.
 *
 * An idle player forfeits their remaining bans rather than blocking the match — the
 * alternative lets someone grief their opponent by never picking.
 *
 * Tracks are chosen *here* rather than at match creation, which is what makes the
 * bans mean anything: a banned category is banned because it never reaches this call.
 */
export async function startDuelIfDraftDone(
  ctx: MutationCtx,
  matchId: Id<"matches">,
): Promise<void> {
  const match = await ctx.db.get(matchId);
  if (!match || match.phase !== "veto") return;

  const draftComplete = (match.banTurn ?? 0) >= TOTAL_BANS;
  const deadlinePassed = match.vetoDeadline !== undefined && Date.now() >= match.vetoDeadline;

  if (!draftComplete && !deadlinePassed) return;

  const bannedCategoryIds = match.bannedCategoryIds;

  const users = await Promise.all(match.playerIds.map((id) => ctx.db.get(id)));
  const ratings = users.map((user) => user?.elo ?? STARTING_ELO);
  const averageElo = ratings.reduce((sum, value) => sum + value, 0) / (ratings.length || 1);

  const trackIds = await pickTracksForMatch(ctx, {
    targetTier: difficultyTierForElo(averageElo),
    bannedCategoryIds,
    count: DUEL_TRACK_COUNT,
  });

  if (trackIds.length < DUEL_TRACK_COUNT) {
    // Not enough catalogue to run the full distance — abandon rather than repeat
    // songs, which would let a player who already heard one score for free.
    await ctx.db.patch(matchId, { status: "abandoned", phase: "match_end" });
    return;
  }

  await ctx.db.patch(matchId, {
    status: "active",
    bannedCategoryIds,
    trackIds,
    currentRound: 0,
  });

  /**
   * A beat to show what the draft produced, before the countdown takes over.
   *
   * This used to call `startCountdown` directly, so the four surviving categories — the
   * one thing both players just decided together — were never shown. The tracks are
   * already picked by the time we get here, so the reveal is showing a settled fact
   * rather than holding anything up.
   */
  await enterPhase(ctx, matchId, "veto_reveal", { currentRound: 0 });
}
