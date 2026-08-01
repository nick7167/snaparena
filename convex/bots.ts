import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser } from "./users";
import { applyGuess } from "./matches";
import { difficultyTierForElo, pickTracksForMatch } from "./tracks";
import { endGuessingEarly, enterPhase } from "./phases";
import {
  DUEL_TRACK_COUNT,
  TOTAL_BANS,
  draftTurnOwner,
  pickVetoPool,
  placeBan,
  startDuelIfDraftDone,
} from "./draft";
import {
  BOT_PERSONAS,
  botBanDelayMs,
  chooseBotBan,
  personaById,
  personaNearestElo,
  planBotRound,
} from "../src/engine/bots";
import { DUEL_STARTING_HP } from "../src/engine/config";

/**
 * Bot opponents for the Practice queue.
 *
 * Ranked is human-only: nobody should ever be surprised by a synthetic opponent in
 * a rated match. Practice is instant, always available, and awards XP and badges
 * but never rating.
 *
 * Bots are ordinary `users` rows flagged `isBot`, so every existing query, join and
 * match flow works on them unchanged.
 */

function assertAdmin(secret: string): void {
  const expected = process.env.ADMIN_IMPORT_SECRET;
  if (!expected) throw new Error("ADMIN_IMPORT_SECRET is not configured on the deployment");
  if (secret !== expected) throw new Error("Bad admin secret");
}

/** Creates or updates the bot roster. Idempotent — safe to re-run after edits. */
export const seed = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(args.secret);

    let created = 0;
    let updated = 0;

    for (const persona of BOT_PERSONAS) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", persona.handle))
        .unique();

      const fields = {
        handle: persona.handle,
        displayName: persona.displayName,
        elo: persona.elo,
        bio: persona.bio,
        isBot: true,
        botPersonaId: persona.id,
        // Bots never sit in placements — they are calibrated by definition.
        placementsRemaining: 0,
        onboardedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, fields);
        updated++;
      } else {
        await ctx.db.insert("users", {
          ...fields,
          // Bots have no Clerk identity; a synthetic subject keeps the field
          // non-null while never colliding with a real one.
          clerkId: `bot:${persona.id}`,
          gamesPlayed: 0,
          createdAt: Date.now(),
          xp: 0,
          level: 1,
        });
        created++;
      }
    }

    return { created, updated, total: BOT_PERSONAS.length };
  },
});

/**
 * Starts a practice match against the bot nearest the player's rating.
 *
 * Runs the full ranked flow — opponent reveal, ban draft, health duel — because a
 * practice mode that skips the draft rehearses a different game from the one it is
 * supposed to prepare you for. The bot drafts for itself; see `draftTurn` below.
 */
export const startPractice = mutation({
  args: {},
  handler: async (ctx): Promise<{ status: string; matchId?: Id<"matches"> }> => {
    const user = await requireUser(ctx);

    const persona = personaNearestElo(user.elo);
    const bot = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", persona.handle))
      .unique();

    if (!bot) return { status: "no-bots-seeded" };

    // Sanity check only. The real selection happens after the bans, in
    // `startDuelIfDraftDone` — this exists so a thin catalogue fails on the button
    // with a readable message instead of starting a match that instantly abandons.
    const available = await pickTracksForMatch(ctx, {
      targetTier: difficultyTierForElo(user.elo),
      bannedCategoryIds: [],
      count: DUEL_TRACK_COUNT,
    });

    if (available.length < DUEL_TRACK_COUNT) return { status: "catalogue-too-small" };

    const matchId = await ctx.db.insert("matches", {
      mode: "practice",
      status: "veto",
      playerIds: [user._id, bot._id],
      // Filled in once the draft closes, so the bans actually shape the songs.
      trackIds: [],
      bannedCategoryIds: [],
      vetoPoolIds: await pickVetoPool(ctx),
      currentRound: 0,
      createdAt: Date.now(),
      // Lower-rated player bans first, exactly as in ranked — which means the bot
      // sometimes opens the draft and sometimes responds to yours.
      banOrder: user.elo <= bot.elo ? [user._id, bot._id] : [bot._id, user._id],
      banTurn: 0,
    });

    for (const player of [user, bot]) {
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId: player._id,
        totalPoints: 0,
        hp: DUEL_STARTING_HP,
        ratingBefore: player.elo,
        forfeited: false,
        lastSeenAt: Date.now(),
      });
    }

    // Meet the bot first — the VS screen is where the BOT badge appears. The phase
    // machine moves this on to the draft.
    await enterPhase(ctx, matchId, "vs_reveal");

    return { status: "started", matchId };
  },
});

/**
 * Drives a bot's side of the ban draft.
 *
 * Armed whenever a match enters the veto phase, and re-armed after every ban. Polls
 * rather than waiting on a callback while the human is choosing, for the same reason
 * `waitForReady` does: a dropped mutation must not be able to hang the draft. The
 * turn clock bounds the polling, and `expireVeto` closes the draft if it lapses.
 */
export const draftTurn = internalMutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.phase !== "veto") return;

    const currentId = draftTurnOwner(match);
    if (!currentId) return; // draft is over

    const current = await ctx.db.get(currentId);

    if (current?.isBot) {
      // Think about it. An instant ban reads as a script running, not an opponent.
      await ctx.scheduler.runAfter(botBanDelayMs(), internal.bots.placeBotBan, {
        matchId: args.matchId,
        expectedTurn: match.banTurn ?? 0,
      });
      return;
    }

    // The human's turn. Once their clock runs out, close the draft here rather than
    // waiting on the client's `expireVeto` poll — a bot match should not need the
    // player's browser to be open to make progress.
    if (match.vetoDeadline !== undefined && Date.now() >= match.vetoDeadline) {
      await startDuelIfDraftDone(ctx, args.matchId);
      return;
    }

    await ctx.scheduler.runAfter(600, internal.bots.draftTurn, args);
  },
});

/**
 * Places one bot ban.
 *
 * Guarded on the turn it was scheduled for, so a duplicate or late job is a no-op
 * rather than a second ban — the same guard `phases.advance` uses on `expectedRound`.
 */
export const placeBotBan = internalMutation({
  args: { matchId: v.id("matches"), expectedTurn: v.number() },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.phase !== "veto") return;
    if ((match.banTurn ?? 0) !== args.expectedTurn) return;
    if (args.expectedTurn >= TOTAL_BANS) return;

    const currentId = draftTurnOwner(match);
    if (!currentId) return;

    const bot = await ctx.db.get(currentId);
    if (!bot?.isBot || !bot.botPersonaId) return;

    const persona = personaById(bot.botPersonaId);
    if (!persona) return;

    const banned = new Set(match.bannedCategoryIds.map(String));
    const available: { id: Id<"categories">; slug: string }[] = [];
    for (const categoryId of match.vetoPoolIds ?? []) {
      if (banned.has(String(categoryId))) continue;
      const category = await ctx.db.get(categoryId);
      if (category) available.push({ id: category._id, slug: category.slug });
    }

    const slug = chooseBotBan(persona, available.map((entry) => entry.slug));
    const choice = available.find((entry) => entry.slug === slug);
    if (!choice) return;

    await placeBan(ctx, match, choice.id);
    await startDuelIfDraftDone(ctx, args.matchId);

    // Hand the turn back. A no-op if that ban closed the draft.
    await ctx.scheduler.runAfter(0, internal.bots.draftTurn, { matchId: args.matchId });
  },
});

/**
 * Plans and schedules a bot's guesses for the round that just started.
 *
 * Everything is decided up front and scheduled, matching how the phase machine
 * already works. Called from `enterPhase` whenever a match enters `guessing`.
 */
export const playRound = internalMutation({
  args: { matchId: v.id("matches"), roundIndex: v.number() },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.status !== "active") return;
    if (match.currentRound !== args.roundIndex) return;

    const track = await ctx.db.get(match.trackIds[args.roundIndex]);
    if (!track) return;

    const categorySlugs = await categorySlugsFor(ctx, track);

    for (const playerId of match.playerIds) {
      const player = await ctx.db.get(playerId);
      if (!player?.isBot || !player.botPersonaId) continue;

      const persona = personaById(player.botPersonaId);
      if (!persona) continue;

      const plan = planBotRound({
        persona,
        difficulty: track.difficulty,
        categorySlugs,
      });

      if (plan.wrongAtMs !== null) {
        await ctx.scheduler.runAfter(plan.wrongAtMs, internal.bots.submitBotGuess, {
          matchId: args.matchId,
          roundIndex: args.roundIndex,
          userId: playerId,
          // A plausible-looking miss rather than gibberish, so the guess log reads
          // like a real player's mistake.
          text: wrongGuessText(track.title),
          clientElapsedMs: plan.wrongAtMs,
        });
      }

      if (plan.correctAtMs !== null) {
        await ctx.scheduler.runAfter(plan.correctAtMs, internal.bots.submitBotGuess, {
          matchId: args.matchId,
          roundIndex: args.roundIndex,
          userId: playerId,
          text: track.title,
          clientElapsedMs: plan.correctAtMs,
        });
      } else {
        // A bot that does not know the track used to sit silent for the full 30s,
        // dragging every round it could not answer. Passing ends the round as soon
        // as the human is also done — the same courtesy a human player extends.
        await ctx.scheduler.runAfter(plan.giveUpAtMs, internal.bots.passRound, {
          matchId: args.matchId,
          roundIndex: args.roundIndex,
          userId: playerId,
        });
      }
    }
  },
});

/**
 * Submits one bot guess.
 *
 * Routed through the same `applyGuess` pipeline humans use, so bots are subject to
 * identical phase checks, lockouts, attempt limits and clock validation. They get
 * no privileged write.
 */
export const submitBotGuess = internalMutation({
  args: {
    matchId: v.id("matches"),
    roundIndex: v.number(),
    userId: v.id("users"),
    text: v.string(),
    clientElapsedMs: v.number(),
  },
  handler: async (ctx, args) => {
    await applyGuess(ctx, {
      matchId: args.matchId,
      roundIndex: args.roundIndex,
      userId: args.userId,
      text: args.text,
      clientElapsedMs: args.clientElapsedMs,
    });
  },
});

/**
 * A bot giving up on a track it does not know.
 *
 * Writes the same `passedRound` a human pass writes, so the round-end check treats
 * both identically.
 */
export const passRound = internalMutation({
  args: { matchId: v.id("matches"), roundIndex: v.number(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.phase !== "guessing") return;
    if (match.currentRound !== args.roundIndex) return;

    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) =>
        q.eq("matchId", args.matchId).eq("userId", args.userId),
      )
      .unique();
    if (!player) return;

    await ctx.db.patch(player._id, { passedRound: args.roundIndex });

    const refreshed = await ctx.db.get(args.matchId);
    if (refreshed) await endGuessingEarly(ctx, refreshed);
  },
});

/** True if any player in the match is a bot — used to decide whether to schedule. */
export async function matchHasBot(ctx: MutationCtx, match: Doc<"matches">): Promise<boolean> {
  for (const playerId of match.playerIds) {
    const player = await ctx.db.get(playerId);
    if (player?.isBot) return true;
  }
  return false;
}

async function categorySlugsFor(ctx: MutationCtx, track: Doc<"tracks">): Promise<string[]> {
  const slugs: string[] = [];
  for (const categoryId of track.categoryIds) {
    const category = await ctx.db.get(categoryId);
    if (category) slugs.push(category.slug);
  }
  return slugs;
}

/**
 * A wrong-but-plausible guess.
 *
 * Derived from the real title so it looks like a genuine near-miss in the guess
 * log, then mangled enough that the fuzzy matcher will definitely reject it.
 */
function wrongGuessText(title: string): string {
  const words = title.split(/\s+/);
  if (words.length > 1) return words.slice(0, -1).join(" ");
  return `${title}xx`;
}
