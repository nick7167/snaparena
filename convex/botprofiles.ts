import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  CAREER_TAIL_LENGTH,
  seededRng,
  simulateRoster,
  type BotCareer,
  type SimulatedMatch,
  type TrackSample,
} from "../src/engine/bot-career";
import { BOT_PERSONAS, type BotPersona } from "../src/engine/bots";
import { DEV_RANK_BOT_PERSONAS } from "../src/engine/dev-rank-bots";
import { AVATAR_COLOURS } from "../src/engine/config";
import { resolveConfig } from "./config";

/**
 * Bot profiles — the stats, avatar, badges and match history that make a bot account
 * look like an account.
 *
 * Seeding a bot used to write a name, a bio and a rating, which left every bot profile
 * reading `Level 1 · 0W · 0L`, no badges, no categories and a grey initial where a picture
 * goes. That is fine for an opponent you meet for ninety seconds and useless for judging
 * what the leaderboard, the VS screen or a profile look like against a real population.
 *
 * The numbers are not made up. `src/engine/bot-career.ts` plays each persona's whole
 * career through the same engine a live match runs on and reports what it left behind;
 * this module is only the write side. The last few matches of that career are persisted
 * in full, so a bot's history is browsable and every row opens a real results screen.
 *
 * Deliberately its own file rather than living in `convex/devbots.ts`: that one is built
 * to be deleted wholesale before launch, and the twelve shipping practice bots need their
 * profiles to survive it.
 */

function assertAdmin(secret: string): void {
  const expected = process.env.ADMIN_IMPORT_SECRET;
  if (!expected) throw new Error("ADMIN_IMPORT_SECRET is not configured on the deployment");
  if (secret !== expected) throw new Error("Bad admin secret");
}

/**
 * How much of the catalogue the simulation draws on.
 *
 * A duel takes up to `MAX_DUEL_ROUNDS` tracks and bans four categories before it starts,
 * so the pool has to be comfortably wider than one match to avoid every bot's history
 * being the same eighteen songs.
 */
const TRACK_POOL_SIZE = 240;

/** Below this the pool cannot fill a duel, and a seeded history would render blank rounds. */
const MIN_TRACK_POOL = 24;

// ---------------------------------------------------------------------------
// The writer
// ---------------------------------------------------------------------------

/**
 * Gives every persona on a roster a career.
 *
 * Called by `bots.seed` and `devbots.seed` once their user rows exist, so the two rosters
 * cannot drift apart on what a bot profile contains. Idempotent: re-running replaces the
 * previously seeded history rather than stacking a second copy on top of it.
 */
export async function seedBotProfiles(
  ctx: MutationCtx,
  personas: readonly BotPersona[],
): Promise<{ profiles: number; matches: number }> {
  const bots = await loadBots(ctx, personas);
  if (bots.size === 0) return { profiles: 0, matches: 0 };

  const { tracks, trackIds } = await loadTrackPool(ctx);
  const categoryIdBySlug = await loadCategories(ctx);

  const config = await resolveConfig(ctx);
  const careers = simulateRoster({ personas, tracks, now: Date.now(), config });

  // Clear first, so a re-seed cannot leave one bot carrying two overlapping histories.
  await clearSeededMatches(ctx, [...bots.values()].map((bot) => bot._id));

  let matchesWritten = 0;

  for (const persona of personas) {
    const bot = bots.get(persona.id);
    const career = careers.get(persona.id);
    if (!bot || !career) continue;

    await writeCareerStats(ctx, bot, persona, career);
    await writeCategoryRatings(ctx, bot._id, career, categoryIdBySlug);
    await writeBadges(ctx, bot._id, career);

    for (const match of career.tail) {
      const opponent = bots.get(match.players[1].personaId);
      // The simulator is asserted to only ever name a roster persona, but a partially
      // seeded deployment can still be missing the row.
      if (!opponent) continue;
      await writeMatch(ctx, { match, bot, opponent, trackIds, categoryIdBySlug });
      matchesWritten++;
    }
  }

  return { profiles: bots.size, matches: matchesWritten };
}

/** Career totals, avatar and account age. */
async function writeCareerStats(
  ctx: MutationCtx,
  bot: Doc<"users">,
  persona: BotPersona,
  career: BotCareer,
): Promise<void> {
  await ctx.db.patch(bot._id, {
    elo: career.elo,
    gamesPlayed: career.gamesPlayed,
    rankedWins: career.rankedWins,
    xp: career.xp,
    level: career.level,
    snapGuesses: career.snapGuesses,
    createdAt: career.createdAt,
    // The same six colours the onboarding picker offers, so a bot's avatar is the
    // identical artefact a real account carries rather than a bot-shaped stand-in.
    avatarUrl: `color:${AVATAR_COLOURS[Math.floor(seededRng(`avatar:${persona.id}`)() * AVATAR_COLOURS.length)]}`,
  });
}

async function writeCategoryRatings(
  ctx: MutationCtx,
  userId: Id<"users">,
  career: BotCareer,
  categoryIdBySlug: Map<string, Id<"categories">>,
): Promise<void> {
  for (const entry of career.categoryRatings) {
    const categoryId = categoryIdBySlug.get(entry.slug);
    if (!categoryId) continue;

    const existing = await ctx.db
      .query("categoryRatings")
      .withIndex("by_user_category", (q) => q.eq("userId", userId).eq("categoryId", categoryId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { rating: entry.rating, games: entry.games });
    } else {
      await ctx.db.insert("categoryRatings", {
        userId,
        categoryId,
        rating: entry.rating,
        games: entry.games,
      });
    }
  }
}

/** Inserts only badges the bot does not already hold, matching `awardBadges`. */
async function writeBadges(
  ctx: MutationCtx,
  userId: Id<"users">,
  career: BotCareer,
): Promise<void> {
  for (const badgeId of career.badgeIds) {
    const existing = await ctx.db
      .query("userBadges")
      .withIndex("by_user_badge", (q) => q.eq("userId", userId).eq("badgeId", badgeId))
      .unique();
    if (existing) continue;

    await ctx.db.insert("userBadges", {
      userId,
      badgeId,
      // Somewhere in the career rather than all at the same instant.
      earnedAt: career.createdAt + Math.floor((Date.now() - career.createdAt) * 0.6),
    });
  }
}

/**
 * Persists one simulated match as a completed duel.
 *
 * Written directly as `status: "complete"` rather than replayed through the phase machine:
 * the outcome, the health timeline and the rating movement are already decided, and
 * driving them through `enterPhase` would schedule thirty seconds of real time per round.
 * `finalizeMatch` is deliberately never scheduled — progression has already been applied
 * to the user rows by `writeCareerStats`, and running it again would pay for the same
 * match twice.
 */
async function writeMatch(
  ctx: MutationCtx,
  params: {
    match: SimulatedMatch;
    bot: Doc<"users">;
    opponent: Doc<"users">;
    trackIds: Id<"tracks">[];
    categoryIdBySlug: Map<string, Id<"categories">>;
  },
): Promise<void> {
  const { match, bot, opponent, trackIds, categoryIdBySlug } = params;

  const userIdFor = (slot: 0 | 1) => (slot === 0 ? bot._id : opponent._id);
  const matchTrackIds = match.trackIndices.map((index) => trackIds[index]);

  const bannedCategoryIds = match.bannedCategorySlugs
    .map((slug) => categoryIdBySlug.get(slug))
    .filter((id): id is Id<"categories"> => id !== undefined);

  const matchId = await ctx.db.insert("matches", {
    // Ranked, not practice: a bot's record is a ranked record, and `matchPlayers.ratingDelta`
    // is what the history row shows. A practice match would carry no rating movement at all.
    mode: "ranked",
    status: "complete",
    phase: "match_end",
    playerIds: [bot._id, opponent._id],
    trackIds: matchTrackIds,
    bannedCategoryIds,
    currentRound: Math.max(0, match.rounds.length - 1),
    winnerId: match.winnerSlot === undefined ? undefined : userIdFor(match.winnerSlot),
    suddenDeath: match.suddenDeath || undefined,
    roundLog: match.rounds.map((round) => ({
      roundIndex: round.roundIndex,
      trackId: trackIds[round.trackIndex],
      outcome: round.outcome,
      winnerId: round.winnerSlot === undefined ? undefined : userIdFor(round.winnerSlot),
      timeGapMs: round.timeGapMs,
      multiplier: round.multiplier,
      damage: round.damage.map((entry) => ({
        userId: userIdFor(entry.slot),
        damage: entry.damage,
        hpAfter: entry.hpAfter,
      })),
      results: round.results.map((entry) => ({
        userId: userIdFor(entry.slot),
        points: entry.points,
        // Absent rather than zero when nobody answered — the results screen reads the
        // absence as "never solved", and a 0ms solve would render as an impossible time.
        elapsedMs: entry.elapsedMs ?? undefined,
        solved: entry.solved,
      })),
    })),
    createdAt: match.startedAt,
    completedAt: match.completedAt,
  });

  for (const slot of [0, 1] as const) {
    const player = match.players[slot];
    await ctx.db.insert("matchPlayers", {
      matchId,
      userId: userIdFor(slot),
      totalPoints: player.totalPoints,
      hp: player.hp,
      lowestHp: player.lowestHp,
      ratingBefore: player.ratingBefore,
      ratingAfter: player.ratingAfter,
      ratingDelta: player.ratingDelta,
      bannedCategoryIds: [],
      xpEarned: player.xpEarned,
      xpBreakdown: player.xpBreakdown.map((entry) => ({ ...entry })),
      levelBefore: player.levelBefore,
      levelAfter: player.levelAfter,
      xpAfter: player.xpAfter,
      badgesEarned: [...player.badgesEarned],
      forfeited: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** The bot rows for a roster, keyed by persona id. */
async function loadBots(
  ctx: MutationCtx,
  personas: readonly BotPersona[],
): Promise<Map<string, Doc<"users">>> {
  const bots = new Map<string, Doc<"users">>();

  for (const persona of personas) {
    const bot = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", persona.handle))
      .unique();
    // Only ever touch an actual bot row. A real account that happens to hold a persona
    // handle must never be handed a fabricated career.
    if (bot?.isBot) bots.set(persona.id, bot);
  }

  return bots;
}

/**
 * The catalogue the careers are played against.
 *
 * Real tracks rather than invented ones, because the round log stores a `trackId` and the
 * results screen joins on it — a fabricated id renders a round with no song.
 */
async function loadTrackPool(
  ctx: MutationCtx,
): Promise<{ tracks: TrackSample[]; trackIds: Id<"tracks">[] }> {
  const rows = await ctx.db
    .query("tracks")
    .withIndex("by_playable_difficulty", (q) => q.eq("playable", true))
    .take(TRACK_POOL_SIZE);

  if (rows.length < MIN_TRACK_POOL) {
    throw new Error(
      `Cannot seed bot histories: only ${rows.length} playable tracks in the catalogue. ` +
        `Run \`npm run import-tracks\` first.`,
    );
  }

  const slugById = new Map<string, string>();
  for (const category of await ctx.db.query("categories").collect()) {
    slugById.set(String(category._id), category.slug);
  }

  return {
    tracks: rows.map((row, index) => ({
      index,
      difficulty: row.difficulty,
      categorySlugs: row.categoryIds
        .map((id) => slugById.get(String(id)))
        .filter((slug): slug is string => slug !== undefined),
    })),
    trackIds: rows.map((row) => row._id),
  };
}

async function loadCategories(ctx: MutationCtx): Promise<Map<string, Id<"categories">>> {
  const map = new Map<string, Id<"categories">>();
  for (const category of await ctx.db.query("categories").collect()) {
    map.set(category.slug, category._id);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Clearing
// ---------------------------------------------------------------------------

/**
 * Deletes the matches a previous seed wrote for these bots.
 *
 * Only matches in which *every* player is a bot are touched. A practice or ranked match a
 * real player actually played against one of these bots is their history too, and deleting
 * it to make room for a synthetic one would be the wrong trade entirely.
 */
async function clearSeededMatches(
  ctx: MutationCtx,
  botIds: readonly Id<"users">[],
): Promise<number> {
  const botIdSet = new Set(botIds.map(String));
  const seen = new Set<string>();
  let deleted = 0;

  for (const botId of botIds) {
    const rows = await ctx.db
      .query("matchPlayers")
      .withIndex("by_user", (q) => q.eq("userId", botId))
      // Bounded: a bot only ever carries a tail plus whatever humans played against it.
      .take(CAREER_TAIL_LENGTH * 8);

    for (const row of rows) {
      if (seen.has(String(row.matchId))) continue;
      seen.add(String(row.matchId));

      const match = await ctx.db.get(row.matchId);
      if (!match) continue;
      if (!match.playerIds.every((id) => botIdSet.has(String(id)))) continue;

      for (const player of await ctx.db
        .query("matchPlayers")
        .withIndex("by_match", (q) => q.eq("matchId", match._id))
        .collect()) {
        await ctx.db.delete(player._id);
      }

      await ctx.db.delete(match._id);
      deleted++;
    }
  }

  return deleted;
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

/**
 * Strips seeded careers back off both rosters.
 *
 * The twelve practice bots ship, so their fabricated history reaches production — that is
 * a deliberate call, but it is not one that should be one-way. `devbots.purge` covers the
 * dev roster only, and it deletes the accounts entirely rather than just their past.
 */
export const reset = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(args.secret);

    const personas = [...BOT_PERSONAS, ...DEV_RANK_BOT_PERSONAS];
    const bots = await loadBots(ctx, personas);
    const botIds = [...bots.values()].map((bot) => bot._id);

    const matches = await clearSeededMatches(ctx, botIds);

    for (const bot of bots.values()) {
      await ctx.db.patch(bot._id, {
        gamesPlayed: 0,
        rankedWins: 0,
        xp: 0,
        level: 1,
        snapGuesses: 0,
        avatarUrl: undefined,
      });

      for (const rating of await ctx.db
        .query("categoryRatings")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .collect()) {
        await ctx.db.delete(rating._id);
      }

      for (const badge of await ctx.db
        .query("userBadges")
        .withIndex("by_user", (q) => q.eq("userId", bot._id))
        .collect()) {
        await ctx.db.delete(badge._id);
      }
    }

    return { profiles: bots.size, matchesDeleted: matches };
  },
});

