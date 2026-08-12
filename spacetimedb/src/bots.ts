import { spacetimedb } from "./schema";
import type { ReducerCtx } from "./ctx";
import { applyGuess } from "./guesses";
import {
  closeDraft,
  endGuessingEarly,
  leaveVsReveal,
  queueBotAction,
} from "./phases";
import { TOTAL_BANS, draftTurnOwner, placeBan } from "./draft";
import { reject, toMs } from "./lib";
import { requireFullAccount, requireOwnerOrAdmin } from "./users";
import { requireCatalogue } from "./catalogue";
import { createDuel } from "./matchmaking";
import { seedBotProfiles } from "./botprofiles";
import {
  BOT_PERSONAS,
  botBanDelayMs,
  chooseBotBan,
  personaById,
  pickPracticePersona,
  planBotRound,
} from "../../src/engine/bots";
import { MAX_DUEL_ROUNDS } from "../../src/engine/config";

/**
 * What a bot does when its turn comes round.
 *
 * ONE reducer with a `kind`, rather than the five internal mutations Convex used.
 * Convex could name any internal function from the scheduler; here a scheduled row
 * belongs to exactly one reducer, so the alternative was five scheduled tables that
 * differ only in payload. The dispatch below is what that buys back.
 *
 * Every action is guarded on the state it was scheduled against — the phase, the round,
 * the draft turn — so a late or duplicated job is a no-op rather than a second ban or a
 * stray guess. That is the same discipline the phase machine uses, and for the same
 * reason: nothing here cancels a timer, so stale ones have to land harmlessly.
 *
 * Bots get NO privileged write. Guesses go through `applyGuess`, the same pipeline
 * humans use, so they are subject to identical phase checks, lockouts, attempt limits
 * and clock validation.
 */

type Action = {
  matchId: bigint;
  userId: bigint;
  kind: string;
  roundIndex: number;
  expectedTurn: number;
  text: string;
  clientElapsedMs: number;
};

/** How often the draft turn is re-checked while a human is still deciding. */
const DRAFT_POLL_MS = 600;

export function runBotAction(ctx: ReducerCtx, action: Action): void {
  switch (action.kind) {
    case "draft_turn":
      draftTurn(ctx, action.matchId);
      return;
    case "place_ban":
      placeBotBan(ctx, action.matchId, action.expectedTurn);
      return;
    case "plan_round":
      planRound(ctx, action.matchId, action.userId, action.roundIndex);
      return;
    case "guess":
      submitBotGuess(ctx, action);
      return;
    case "pass":
      passForBot(ctx, action.matchId, action.userId, action.roundIndex);
      return;
    case "skip_vs":
      skipVsReveal(ctx, action.matchId);
      return;
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

function draftTurn(ctx: ReducerCtx, matchId: bigint): void {
  const match = ctx.db.match.id.find(matchId);
  if (!match || match.phase !== "veto") return;

  const currentId = draftTurnOwner(match);
  if (currentId === undefined) return; // the draft is over

  const current = ctx.db.user.id.find(currentId);

  if (current?.isBot) {
    // Think about it. An instant ban reads as a script running, not an opponent.
    queueBotAction(
      ctx,
      matchId,
      currentId,
      "place_ban",
      0,
      match.banTurn,
      botBanDelayMs(() => ctx.random.integerInRange(0, 1_000_000) / 1_000_000),
    );
    return;
  }

  /**
   * The human's turn. Once their clock runs out, close the draft here rather than
   * waiting on the client — a bot match should not need the player's browser to be
   * open in order to make progress.
   */
  if (match.vetoDeadline !== undefined && toMs(ctx.timestamp) >= toMs(match.vetoDeadline)) {
    closeDraft(ctx, match);
    return;
  }

  queueBotAction(ctx, matchId, 0n, "draft_turn", 0, match.banTurn, DRAFT_POLL_MS);
}

/**
 * Places one bot ban.
 *
 * Guarded on the turn it was scheduled for, so a duplicate or late job is a no-op
 * rather than a second ban — the same guard the phase machine uses on `expectedRound`.
 */
function placeBotBan(ctx: ReducerCtx, matchId: bigint, expectedTurn: number): void {
  const match = ctx.db.match.id.find(matchId);
  if (!match || match.phase !== "veto") return;
  if (match.banTurn !== expectedTurn) return;
  if (expectedTurn >= TOTAL_BANS) return;

  const currentId = draftTurnOwner(match);
  if (currentId === undefined) return;

  const bot = ctx.db.user.id.find(currentId);
  if (!bot?.isBot || bot.botPersonaId === undefined) return;

  const persona = personaById(bot.botPersonaId);
  if (!persona) return;

  const banned = new Set(match.bannedCategoryIds);
  const available: { id: bigint; slug: string }[] = [];

  for (const categoryId of match.vetoPoolIds) {
    if (banned.has(categoryId)) continue;
    const category = ctx.db.category.id.find(categoryId);
    if (category) available.push({ id: category.id, slug: category.slug });
  }

  const slug = chooseBotBan(
    persona,
    available.map((entry) => entry.slug),
  );
  const choice = available.find((entry) => entry.slug === slug);
  if (!choice) return;

  // `placeBan` closes the draft itself once the last ban lands.
  placeBan(ctx, matchId, choice.id);

  // Hand the turn back. A no-op if that ban closed the draft.
  queueBotAction(ctx, matchId, 0n, "draft_turn", 0, 0, 0);
}

// ---------------------------------------------------------------------------
// Playing a round
// ---------------------------------------------------------------------------

/**
 * Plans and schedules a bot's guesses for the round that just started.
 *
 * Everything is decided up front and scheduled, matching how the phase machine already
 * works — so a bot's timing is fixed the moment the round opens and cannot drift with
 * whatever else the module is doing.
 */
function planRound(
  ctx: ReducerCtx,
  matchId: bigint,
  userId: bigint,
  roundIndex: number,
): void {
  const match = ctx.db.match.id.find(matchId);
  if (!match || match.status !== "active") return;
  if (match.currentRound !== roundIndex) return;

  const entry = [...ctx.db.match_track.by_match_round.filter([matchId, roundIndex])][0];
  if (!entry) return;

  const track = ctx.db.track.id.find(entry.trackId);
  if (!track) return;

  const player = ctx.db.user.id.find(userId);
  if (!player?.isBot || player.botPersonaId === undefined) return;

  const persona = personaById(player.botPersonaId);
  if (!persona) return;

  const categorySlugs: string[] = [];
  for (const categoryId of track.categoryIds) {
    const category = ctx.db.category.id.find(categoryId);
    if (category) categorySlugs.push(category.slug);
  }

  const plan = planBotRound({
    persona,
    difficulty: track.difficulty,
    categorySlugs,
    rng: () => ctx.random.integerInRange(0, 1_000_000) / 1_000_000,
  });

  if (plan.wrongAtMs !== null) {
    queueBotAction(
      ctx,
      matchId,
      userId,
      "guess",
      roundIndex,
      0,
      plan.wrongAtMs,
      // A plausible-looking miss rather than gibberish, so the guess log reads like a
      // real player's mistake.
      wrongGuessText(track.title),
      plan.wrongAtMs,
    );
  }

  if (plan.correctAtMs !== null) {
    queueBotAction(
      ctx,
      matchId,
      userId,
      "guess",
      roundIndex,
      0,
      plan.correctAtMs,
      track.title,
      plan.correctAtMs,
    );
    return;
  }

  /**
   * A bot that does not know the track used to sit silent for the full thirty
   * seconds, dragging out every round it could not answer. Passing ends the round as
   * soon as the human is also done — the same courtesy a human player extends.
   */
  queueBotAction(ctx, matchId, userId, "pass", roundIndex, 0, plan.giveUpAtMs);
}

/** Submits one bot guess, through the pipeline humans use. */
function submitBotGuess(ctx: ReducerCtx, action: Action): void {
  applyGuess(ctx, {
    matchId: action.matchId,
    roundIndex: action.roundIndex,
    userId: action.userId,
    text: action.text,
    clientElapsedMs: action.clientElapsedMs,
  });
}

/**
 * A bot giving up on a track it does not know.
 *
 * Writes the same `passedRound` a human pass writes, so the round-end check treats
 * both identically.
 */
function passForBot(
  ctx: ReducerCtx,
  matchId: bigint,
  userId: bigint,
  roundIndex: number,
): void {
  const match = ctx.db.match.id.find(matchId);
  if (!match || match.phase !== "guessing") return;
  if (match.currentRound !== roundIndex) return;

  const player = [...ctx.db.match_player.by_match_user.filter([matchId, userId])][0];
  if (!player) return;

  ctx.db.match_player.id.update({ ...player, passedRound: roundIndex });

  const refreshed = ctx.db.match.id.find(matchId);
  if (refreshed) endGuessingEarly(ctx, refreshed);
}

/**
 * Leaves the VS reveal on a bot's behalf.
 *
 * A bot cannot press Ready, and the human's ready call only runs the "is everyone in"
 * check when a human makes it — so a bot-vs-bot duel, which the dev rank bots make
 * possible, would stall for the full reveal with nobody watching.
 */
function skipVsReveal(ctx: ReducerCtx, matchId: bigint): void {
  const match = ctx.db.match.id.find(matchId);
  if (!match || match.phase !== "vs_reveal") return;

  const humans = match.playerIds.filter((id) => !ctx.db.user.id.find(id)?.isBot);
  if (humans.length > 0) return;

  // The same exit a human's Ready takes, so a bot-only duel cannot reach the draft by
  // a route the phase machine does not know about.
  leaveVsReveal(ctx, match);
}

/**
 * A wrong-but-plausible guess.
 *
 * Derived from the real title so it looks like a genuine near-miss in the guess log,
 * then mangled enough that the fuzzy matcher will definitely reject it.
 */
function wrongGuessText(title: string): string {
  const words = title.split(/\s+/);
  if (words.length > 1) return words.slice(0, -1).join(" ");
  return `${title}xx`;
}

// ---------------------------------------------------------------------------
// Seeding and practice
// ---------------------------------------------------------------------------

/**
 * Creates or refreshes the bot roster from the personas.
 *
 * Owner or admin, replacing the shared secret the Convex version checked. The personas
 * are the source of truth: re-running this brings existing rows back in line with them
 * rather than adding duplicates.
 */
export const seedBots = spacetimedb.reducer({}, (ctx) => {
  requireOwnerOrAdmin(ctx);

  for (const persona of BOT_PERSONAS) {
    const existing = ctx.db.user.handle.find(persona.handle);

    /**
     * Refuses to seed over an account a person actually signed up for.
     *
     * Nothing reserves the persona handles — the handle pattern accepts every one of
     * them — so a player could be holding `dustbowl` or `needledrop` before this ever
     * runs. Matching on handle alone would then overwrite THEIR row: flagged as a bot,
     * rating and display name replaced, with a fabricated career on top. Cheap to
     * check, and the failure it prevents is not recoverable.
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
      // Bots never sit in placements — they are calibrated by definition.
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
     * No `account` row, and that is the point.
     *
     * Convex needed a synthetic `clerkId` to keep a non-null field from colliding with
     * a real one. Here identity lives in its own table, so a bot simply has no identity
     * — which means there is no `ctx.sender` that could ever resolve to one, and the
     * "log in as a bot" question does not arise.
     */
  }

  /**
   * Careers, avatars, badges and history — written after the rows exist, because the
   * writer looks each persona up by handle.
   *
   * A no-op while the catalogue is empty, deliberately: seeding the roster is worth
   * doing on its own, and the natural order on a fresh deployment is seed-then-import.
   * Re-run this once tracks are in and the histories appear.
   */
  seedBotProfiles(ctx, BOT_PERSONAS);
});

/**
 * Starts a practice duel against a bot.
 *
 * `mode: "practice"`, so the rating pass cannot see it and nothing moves on the ladder.
 * The player is told that before they accept, and the opponent is badged throughout —
 * the ladder stays a measure of play against humans.
 */
export const startPractice = spacetimedb.reducer({}, (ctx) => {
  const player = requireFullAccount(ctx);

  const persona = pickPracticePersona(
    player.elo,
    player.lastPracticePersonaId,
    () => ctx.random.integerInRange(0, 1_000_000) / 1_000_000,
  );

  const bot = ctx.db.user.handle.find(persona.handle);
  if (!bot || !bot.isBot) reject("No practice opponents seeded yet");

  /**
   * Sanity check only. The real selection happens after the bans, in `closeDraft` —
   * this exists so a thin catalogue fails on the button with a readable message
   * instead of starting a match that instantly abandons itself.
   */
  requireCatalogue(ctx, MAX_DUEL_ROUNDS);

  /**
   * Leave the queue first. Without this the player stays enqueued through the whole
   * practice match and the sweeper could pair them with a human they are not watching.
   */
  ctx.db.queue_entry.userId.delete(player.id);

  // Remembered so the "random" opponent rotates rather than repeating.
  ctx.db.user.id.update({ ...player, lastPracticePersonaId: persona.id });

  createDuel(ctx, player, bot, "practice");
});
