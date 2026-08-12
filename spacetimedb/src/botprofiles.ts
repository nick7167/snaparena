import { spacetimedb } from "./schema";
import type { ReducerCtx } from "./ctx";
import { timestampAtMs, toMs } from "./lib";
import { requireOwnerOrAdmin } from "./users";
import { currentVersionId, resolveConfig } from "./config";
import {
  seededRng,
  simulateRoster,
  type BotCareer,
  type SimulatedMatch,
  type TrackSample,
} from "../../src/engine/bot-career";
import { BOT_PERSONAS, type BotPersona } from "../../src/engine/bots";
import { DEV_RANK_BOT_PERSONAS } from "../../src/engine/dev-rank-bots";
import { AVATAR_COLOURS } from "../../src/engine/config";

/**
 * Bot profiles — the stats, avatar, badges and match history that make a bot account
 * look like an account.
 *
 * Seeding a bot writes a name, a bio and a rating, which leaves every bot profile reading
 * `Level 1 · 0W · 0L`, no badges, no categories and a grey initial where a picture goes.
 * That is fine for an opponent you meet for ninety seconds and useless for judging what
 * the leaderboard, the VS screen or a profile look like against a real population.
 *
 * THE NUMBERS ARE NOT MADE UP. `src/engine/bot-career.ts` plays each persona's whole
 * career through the same functions a live match runs on — `planBotRound` for what a
 * persona does in a round, `scoreForGuess` for the points, `resolveDuel` for the health
 * duel, `applyMatchResult` for the rating, `awardMatchXp` for the XP, `evaluateBadges` for
 * the badges — and reports what it left behind. This module is only the write side. A
 * bot's level always matches its XP, its record always matches its rating movement, and
 * its strongest categories are genuinely the ones it scored in.
 *
 * Its own file rather than living in ./devbots, which is built to be deleted wholesale
 * before launch: the twelve shipping practice bots need their profiles to survive that.
 *
 * WHAT CHANGED FROM CONVEX. The Convex row carried the setlist and the whole round log as
 * arrays on the match document. Here the log is `round_log` rows and the songs a player
 * is allowed to have seen are `round_reveal` rows — a table with no Convex counterpart,
 * and the one this port had to add: without it a seeded round renders as a result with no
 * song attached, which is invisible until you actually open a bot's match.
 *
 * The setlist is NOT written. See `writeMatch` for why, and for the other table a live
 * match keeps that a finished one has no reader for.
 */

/**
 * How much of the catalogue the simulation draws on.
 *
 * A duel takes up to `MAX_DUEL_ROUNDS` tracks and bans four categories before it starts,
 * so the pool has to be comfortably wider than one match or every bot's history is the
 * same eighteen songs.
 */
const TRACK_POOL_SIZE = 240;

/** Below this the pool cannot fill a duel, and a seeded history would render blank rounds. */
const MIN_TRACK_POOL = 24;

/** Difficulty tiers, so the pool is drawn across all of them rather than off the front. */
const DIFFICULTY_TIERS = [1, 2, 3, 4, 5] as const;

// ---------------------------------------------------------------------------
// The writer
// ---------------------------------------------------------------------------

/**
 * Gives every persona on a roster a career.
 *
 * Called by `seedBots` and `seedDevRankBots` once their user rows exist, so the two
 * rosters cannot drift apart on what a bot profile contains. Idempotent: re-running
 * replaces the previously seeded history rather than stacking a second copy on it.
 *
 * Returns silently when the catalogue is too thin. Seeding a roster is worth doing on its
 * own — the bots are playable opponents without a past — so a missing catalogue must not
 * cost you the accounts. The Convex version threw here, which meant `bots.seed` failed
 * outright on a fresh deployment where the natural order is seed-then-import.
 */
export function seedBotProfiles(ctx: ReducerCtx, personas: readonly BotPersona[]): void {
  const bots = loadBots(ctx, personas);
  if (bots.size === 0) return;

  const pool = loadTrackPool(ctx);
  if (pool.tracks.length < MIN_TRACK_POOL) return;

  const categoryIdBySlug = loadCategories(ctx);
  const now = toMs(ctx.timestamp);

  /**
   * Simulated under whatever the deployment is currently tuned to, and stamped with that
   * same version below.
   *
   * The two have to agree. These are fictional pasts, so the only thing the config
   * affects is whether a seeded record reads consistently with how the game plays today
   * — but a career played under the live scoring curve and then stamped as "the shipped
   * defaults" would be read back through a different curve than it was written with.
   */
  const configVersionId = currentVersionId(ctx);

  const careers = simulateRoster({
    personas,
    tracks: pool.tracks,
    now,
    config: resolveConfig(ctx, configVersionId),
  });

  // Cleared first, so a re-seed cannot leave one bot carrying two overlapping histories.
  clearSeededMatches(ctx, [...bots.values()]);

  for (const persona of personas) {
    const bot = bots.get(persona.id);
    const career = careers.get(persona.id);
    if (!bot || !career) continue;

    writeCareerStats(ctx, bot.id, persona, career);
    writeCategoryRatings(ctx, bot.id, career, categoryIdBySlug);
    writeBadges(ctx, bot.id, career, now);

    for (const match of career.tail) {
      const opponent = bots.get(match.players[1].personaId);
      // The simulator only ever names a roster persona, but a partially seeded
      // deployment can still be missing the row.
      if (!opponent) continue;

      writeMatch(ctx, {
        match,
        botId: bot.id,
        opponentId: opponent.id,
        trackIds: pool.trackIds,
        categoryIdBySlug,
        configVersionId,
      });
    }
  }
}

/** Career totals, avatar and account age. */
function writeCareerStats(
  ctx: ReducerCtx,
  userId: bigint,
  persona: BotPersona,
  career: BotCareer,
): void {
  const user = ctx.db.user.id.find(userId);
  if (!user) return;

  const colour =
    AVATAR_COLOURS[
      Math.floor(seededRng(`avatar:${persona.id}`)() * AVATAR_COLOURS.length)
    ];

  ctx.db.user.id.update({
    ...user,
    elo: career.elo,
    gamesPlayed: career.gamesPlayed,
    rankedWins: career.rankedWins,
    xp: career.xp,
    level: career.level,
    snapGuesses: career.snapGuesses,
    createdAt: timestampAtMs(career.createdAt),
    // The same six colours the onboarding picker offers, so a bot's avatar is the
    // identical artefact a real account carries rather than a bot-shaped stand-in.
    avatarUrl: `color:${colour}`,
  });
}

function writeCategoryRatings(
  ctx: ReducerCtx,
  userId: bigint,
  career: BotCareer,
  categoryIdBySlug: Map<string, bigint>,
): void {
  for (const entry of career.categoryRatings) {
    const categoryId = categoryIdBySlug.get(entry.slug);
    if (categoryId === undefined) continue;

    const existing = [...ctx.db.category_rating.by_user_category.filter([userId, categoryId])][0];

    if (existing) {
      ctx.db.category_rating.id.update({
        ...existing,
        rating: entry.rating,
        games: entry.games,
      });
      continue;
    }

    ctx.db.category_rating.insert({
      id: 0n,
      userId,
      categoryId,
      rating: entry.rating,
      games: entry.games,
    });
  }
}

/** Inserts only badges the bot does not already hold, matching the live award path. */
function writeBadges(
  ctx: ReducerCtx,
  userId: bigint,
  career: BotCareer,
  now: number,
): void {
  for (const badgeId of career.badgeIds) {
    const held = [...ctx.db.user_badge.by_user_badge.filter([userId, badgeId])][0];
    if (held) continue;

    ctx.db.user_badge.insert({
      id: 0n,
      userId,
      badgeId,
      // Somewhere in the career rather than all at the same instant.
      earnedAt: timestampAtMs(career.createdAt + Math.floor((now - career.createdAt) * 0.6)),
    });
  }
}

/**
 * Persists one simulated match as a completed duel.
 *
 * Written directly as `status: "complete"` rather than replayed through the phase
 * machine: the outcome, the health timeline and the rating movement are already decided,
 * and driving them through `enterPhase` would schedule thirty seconds of real time per
 * round. `finalize_schedule` is deliberately never armed — progression has already been
 * applied to the user rows by `writeCareerStats`, and running it again would pay for the
 * same match twice and move the bot off its anchor.
 */
function writeMatch(
  ctx: ReducerCtx,
  params: {
    match: SimulatedMatch;
    botId: bigint;
    opponentId: bigint;
    trackIds: bigint[];
    categoryIdBySlug: Map<string, bigint>;
    configVersionId: bigint | undefined;
  },
): void {
  const { match, botId, opponentId, trackIds, categoryIdBySlug, configVersionId } = params;

  const userIdFor = (slot: 0 | 1) => (slot === 0 ? botId : opponentId);

  const bannedCategoryIds: bigint[] = [];
  for (const slug of match.bannedCategorySlugs) {
    const id = categoryIdBySlug.get(slug);
    if (id !== undefined) bannedCategoryIds.push(id);
  }

  const winnerId = match.winnerSlot === undefined ? undefined : userIdFor(match.winnerSlot);
  const completedAt = timestampAtMs(match.completedAt);

  const row = ctx.db.match.insert({
    id: 0n,
    /**
     * Ranked, not practice. A bot's record is a ranked record, and the history row shows
     * `ratingDelta` — a practice match carries no rating movement at all, so a career
     * written as practice would render as a list of blanks.
     */
    mode: "ranked",
    status: "complete",
    playerIds: [botId, opponentId],
    totalRounds: match.trackIndices.length,
    bannedCategoryIds,
    // The draft is over and its pool is not recoverable from the simulation. Nothing
    // reads it on a finished match.
    vetoPoolIds: [],
    vetoDeadline: undefined,
    banOrder: [botId, opponentId],
    banTurn: bannedCategoryIds.length,
    currentRound: Math.max(0, match.rounds.length - 1),
    roundStartedAt: undefined,
    phase: "match_end",
    phaseEndsAt: undefined,
    suddenDeath: match.suddenDeath,
    roomId: undefined,
    winnerId,
    createdAt: timestampAtMs(match.startedAt),
    completedAt,
    // The version the career above was simulated under, so the results screen resolves
    // these rounds through the same numbers that produced them.
    configVersionId,
  });

  /**
   * NO `match_track` AND NO `round_result`, deliberately — the two tables a live match
   * writes that a finished one has no reader for.
   *
   * `match_track` is the private setlist. It exists so that subscribing to a match in
   * progress cannot reveal what is coming, and it is read by the phase machine and by
   * `finalizeMatch`. A seeded match is born complete and is never advanced or finalised,
   * so the only thing writing it would achieve is hiding songs from nobody.
   *
   * `round_result` is the per-round scoring state the between-round beats read, through
   * `useMatchState` — a hook only the live match screen calls, and a completed match
   * routes to the results screen instead. The results screen reads `round_log` and
   * `round_reveal`, which are written below.
   *
   * This is not a shortcut for its own sake: together they are about 2,800 rows per
   * roster, in a transaction that also simulates every career. Rows nothing reads are
   * the first thing to cut when the concern is how much one reducer does at once.
   */
  for (const round of match.rounds) {
    ctx.db.round_log.insert({
      id: 0n,
      matchId: row.id,
      roundIndex: round.roundIndex,
      entry: {
        roundIndex: round.roundIndex,
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
          /**
           * Absent rather than zero when nobody answered. The results screen reads the
           * absence as "never solved"; a 0ms solve would render as an impossible time.
           */
          elapsedMs: entry.elapsedMs ?? undefined,
          solved: entry.solved,
        })),
      },
    });

    /**
     * The reveal, which has no Convex counterpart.
     *
     * On a live match the phase reducers write this twice — the preview URL when the
     * round opens, the title and artwork when it closes. A seeded round is closed by
     * definition, so it is written once, fully revealed. Without it the round timeline
     * on a bot's results screen is a list of songs with no names.
     */
    const track = ctx.db.track.id.find(trackIds[round.trackIndex]);
    if (track) {
      const firstCategory =
        track.categoryIds.length > 0 ? ctx.db.category.id.find(track.categoryIds[0]) : null;

      ctx.db.round_reveal.insert({
        id: 0n,
        matchId: row.id,
        roundIndex: round.roundIndex,
        previewUrl: track.previewUrl,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
        categoryName: firstCategory?.name,
        revealedAt: completedAt,
      });
    }

  }

  for (const slot of [0, 1] as const) {
    const player = match.players[slot];
    const userId = userIdFor(slot);
    const eliminated = match.rounds.find((round) =>
      round.damage.some((entry) => entry.slot === slot && entry.hpAfter <= 0),
    );

    ctx.db.match_player.insert({
      id: 0n,
      matchId: row.id,
      userId,
      totalPoints: player.totalPoints,
      ratingBefore: player.ratingBefore,
      globalRankAtStart: undefined,
      ratingAfter: player.ratingAfter,
      ratingDelta: player.ratingDelta,
      bannedCategoryIds: [],
      hasBanned: true,
      hp: player.hp,
      lowestHp: player.lowestHp,
      eliminatedAtRound: eliminated?.roundIndex,
      // Every round is long since buffered and the reveal long since acknowledged.
      readyForRound: Math.max(0, match.rounds.length - 1),
      vsReadyAt: timestampAtMs(match.startedAt),
      passedRound: undefined,
      xpEarned: player.xpEarned,
      xpBreakdown: player.xpBreakdown.map((entry) => ({ ...entry })),
      levelBefore: player.levelBefore,
      levelAfter: player.levelAfter,
      xpAfter: player.xpAfter,
      badgesEarned: [...player.badgesEarned],
      forfeited: false,
      /**
       * The denormalised trio the live path writes in `finalizeMatch`. A history row is
       * rendered from these without opening the match, so omitting them would give every
       * seeded match a blank result in the one place it is most likely to be seen.
       */
      mode: "ranked",
      completedAt,
      outcome:
        winnerId === undefined ? "draw" : winnerId === userId ? "win" : "loss",
      opponentId: slot === 0 ? opponentId : botId,
    });
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

type UserRow = NonNullable<ReturnType<ReducerCtx["db"]["user"]["id"]["find"]>>;

/** The bot rows for a roster, keyed by persona id. */
function loadBots(
  ctx: ReducerCtx,
  personas: readonly BotPersona[],
): Map<string, UserRow> {
  const bots = new Map<string, UserRow>();

  for (const persona of personas) {
    const bot = ctx.db.user.handle.find(persona.handle);
    // Only ever touch an actual bot row. A real account that happens to hold a persona
    // handle must never be handed a fabricated career.
    if (bot?.isBot) bots.set(persona.id, bot);
  }

  return bots;
}

/**
 * The catalogue the careers are played against.
 *
 * Real tracks rather than invented ones, because the round log stores a track id and the
 * results screen joins on it — a fabricated id renders a round with no song.
 *
 * DRAWN ACROSS THE DIFFICULTY TIERS, which the Convex version did not do. It took the
 * first 240 rows of an index ordered `(playable, difficulty)`, and there are 405 tracks at
 * difficulty 1, so the pool was entirely difficulty 1 and every simulated career was
 * played on the easiest songs in the catalogue. Sampling each tier in turn costs nothing
 * and makes the reaction times, and therefore the records, mean something.
 */
function loadTrackPool(ctx: ReducerCtx): { tracks: TrackSample[]; trackIds: bigint[] } {
  const slugById = new Map<bigint, string>();
  for (const category of ctx.db.category.iter()) slugById.set(category.id, category.slug);

  const perTier = Math.ceil(TRACK_POOL_SIZE / DIFFICULTY_TIERS.length);
  const tracks: TrackSample[] = [];
  const trackIds: bigint[] = [];

  for (const tier of DIFFICULTY_TIERS) {
    let taken = 0;
    for (const row of ctx.db.track.by_playable_difficulty.filter([true, tier])) {
      if (taken >= perTier) break;

      const categorySlugs: string[] = [];
      for (const id of row.categoryIds) {
        const slug = slugById.get(id);
        if (slug !== undefined) categorySlugs.push(slug);
      }

      tracks.push({ index: tracks.length, difficulty: row.difficulty, categorySlugs });
      trackIds.push(row.id);
      taken++;
    }
  }

  return { tracks, trackIds };
}

function loadCategories(ctx: ReducerCtx): Map<string, bigint> {
  const map = new Map<string, bigint>();
  for (const category of ctx.db.category.iter()) map.set(category.slug, category.id);
  return map;
}

// ---------------------------------------------------------------------------
// Clearing
// ---------------------------------------------------------------------------

/**
 * Deletes the matches a previous seed wrote for these bots.
 *
 * ONLY MATCHES IN WHICH EVERY PLAYER IS A BOT are touched. A practice or ranked match a
 * real player actually played against one of these bots is that player's history too, and
 * deleting it to make room for a synthetic one would be the wrong trade entirely.
 */
function clearSeededMatches(ctx: ReducerCtx, bots: readonly UserRow[]): void {
  const botIds = new Set(bots.map((bot) => bot.id));
  const matchIds = new Set<bigint>();

  for (const bot of bots) {
    for (const entry of ctx.db.match_player.userId.filter(bot.id)) {
      if (matchIds.has(entry.matchId)) continue;

      const match = ctx.db.match.id.find(entry.matchId);
      if (!match) continue;
      if (!match.playerIds.every((id) => botIds.has(id))) continue;

      matchIds.add(entry.matchId);
    }
  }

  for (const matchId of matchIds) {
    deleteAll(ctx.db.round_result.matchId.filter(matchId), (row) =>
      ctx.db.round_result.id.delete(row.id),
    );
    deleteAll(ctx.db.round_log.matchId.filter(matchId), (row) =>
      ctx.db.round_log.id.delete(row.id),
    );
    deleteAll(ctx.db.round_reveal.matchId.filter(matchId), (row) =>
      ctx.db.round_reveal.id.delete(row.id),
    );
    deleteAll(ctx.db.match_track.matchId.filter(matchId), (row) =>
      ctx.db.match_track.id.delete(row.id),
    );
    deleteAll(ctx.db.match_player.matchId.filter(matchId), (row) =>
      ctx.db.match_player.id.delete(row.id),
    );
    ctx.db.match.id.delete(matchId);
  }
}

/** Collects before deleting, so nothing is written to an index while it is being walked. */
function deleteAll<Row>(rows: Iterable<Row>, remove: (row: Row) => void): void {
  for (const row of [...rows]) remove(row);
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

/**
 * Strips seeded careers off both rosters, leaving the accounts.
 *
 * The twelve practice bots ship, so their fabricated history reaches production — that is
 * a deliberate call, but it should not be a one-way one. `purgeDevRankBots` covers the dev
 * roster only, and it deletes the accounts entirely rather than just their past; this
 * leaves twelve playable opponents reading `0W · 0L` again.
 */
export const clearBotCareers = spacetimedb.reducer({}, (ctx) => {
  requireOwnerOrAdmin(ctx);
  clearBotProfiles(ctx, [...BOT_PERSONAS, ...DEV_RANK_BOT_PERSONAS]);
});

function clearBotProfiles(ctx: ReducerCtx, personas: readonly BotPersona[]): void {
  const bots = loadBots(ctx, personas);

  clearSeededMatches(ctx, [...bots.values()]);

  for (const bot of bots.values()) {
    const current = ctx.db.user.id.find(bot.id);
    if (!current) continue;

    ctx.db.user.id.update({
      ...current,
      gamesPlayed: 0,
      rankedWins: 0,
      xp: 0,
      level: 1,
      snapGuesses: 0,
      avatarUrl: undefined,
    });

    deleteAll(ctx.db.category_rating.userId.filter(bot.id), (row) =>
      ctx.db.category_rating.id.delete(row.id),
    );
    deleteAll(ctx.db.user_badge.userId.filter(bot.id), (row) =>
      ctx.db.user_badge.id.delete(row.id),
    );
  }
}
