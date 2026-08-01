import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { currentUser, requireUser } from "./users";
import { endGuessingEarly } from "./phases";
import {
  MAX_GUESSES_PER_ROUND,
  SONGS_PER_SET,
  WRONG_GUESS_LOCKOUT_MS,
} from "../src/engine/config";
import { checkGuess } from "../src/engine/match";
import { normalizeTitle } from "../src/engine/normalize";
import { revealBeatAt, scoreForGuess, validateClientClock } from "../src/engine/scoring";
import { rankForElo, isNotable, matchupLabel } from "../src/engine/ranks";
import { levelForXp } from "../src/engine/xp";
import { sortBadges } from "../src/engine/badges";
import { setIndexForRound } from "../src/engine/sets";

/**
 * A player's public card: everything the VS screen and in-match header need.
 *
 * This is a read-side join over data that already exists — no new writes were added
 * to support it.
 */
async function playerCard(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return null;

  const rank = rankForElo(user.elo);

  const badgeRows = await ctx.db
    .query("userBadges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const categoryRatings = await ctx.db
    .query("categoryRatings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const best = categoryRatings.sort((a, b) => b.rating - a.rating)[0];
  const bestCategory = best ? await ctx.db.get(best.categoryId) : null;

  // Leaderboard position, for the "#N GLOBAL" flag. Bounded read: we only care
  // whether they are inside the notable cutoff, so we never scan the whole table.
  const above = await ctx.db
    .query("users")
    .withIndex("by_elo", (q) => q.gt("elo", user.elo))
    .take(101);
  const position = user.placementsRemaining > 0 ? null : above.length + 1;

  return {
    userId: user._id,
    handle: user.handle,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    elo: user.elo,
    rankLabel: rank.label,
    rankTierId: rank.tier.id,
    rankAccent: rank.tier.accent,
    rankProgress: rank.progress,
    placementsRemaining: user.placementsRemaining,
    level: levelForXp(user.xp ?? 0).level,
    wins: user.rankedWins ?? 0,
    losses: Math.max(0, user.gamesPlayed - (user.rankedWins ?? 0)),
    bestCategory: bestCategory?.name ?? null,
    badges: sortBadges(badgeRows.map((row) => row.badgeId)).map((badge) => ({
      id: badge.id,
      name: badge.name,
      emoji: badge.emoji,
    })),
    globalRank: isNotable(position) ? position : null,
  };
}

/**
 * Live view of a match for the players in it.
 *
 * Deliberately omits the answer for the round in progress — the client is never
 * sent data it could read the answer out of. Rounds that have reached the reveal
 * phase include their track so the UI can show what the song was.
 */
export const state = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return null;

    const me = await currentUser(ctx);

    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();

    const cards = await Promise.all(players.map((player) => playerCard(ctx, player.userId)));

    const roundElapsedMs = match.roundStartedAt ? Date.now() - match.roundStartedAt : 0;
    const phase = match.phase ?? (match.status === "veto" ? "veto" : "guessing");

    // The current track is revealed only once guessing has closed.
    const revealing = phase === "reveal" || phase === "standings" || phase === "set_break";
    const currentTrackDoc =
      match.currentRound < match.trackIds.length
        ? await ctx.db.get(match.trackIds[match.currentRound])
        : null;

    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_match_round", (q) =>
        q.eq("matchId", args.matchId).eq("roundIndex", match.currentRound),
      )
      .collect();

    return {
      matchId: match._id,
      mode: match.mode,
      status: match.status,
      phase,
      phaseEndsAt: match.phaseEndsAt ?? null,
      currentRound: match.currentRound,
      currentSet: match.currentSet ?? setIndexForRound(match.currentRound),
      songsPerSet: SONGS_PER_SET,
      totalRounds: match.trackIds.length,
      suddenDeath: match.suddenDeath === true,
      roundStartedAt: match.roundStartedAt ?? null,
      roundElapsedMs,
      revealBeat: revealBeatAt(roundElapsedMs),
      winnerId: match.winnerId ?? null,
      setResults: match.setResults ?? [],

      /** Audio is needed to play; the title never is until the reveal. */
      currentAudioUrl: currentTrackDoc?.previewUrl ?? null,
      currentTrack: revealing && currentTrackDoc
        ? {
            title: currentTrackDoc.title,
            artist: currentTrackDoc.artist,
            artworkUrl: currentTrackDoc.artworkUrl,
          }
        : null,

      /** Per-player results for the round just played, for the head-to-head reveal. */
      roundResults: players.map((player) => {
        const solved = guesses.find(
          (guess) => guess.userId === player.userId && guess.correct,
        );
        return {
          userId: player.userId,
          solved: solved !== undefined,
          elapsedMs: solved?.clientElapsedMs ?? null,
          points: solved?.points ?? 0,
        };
      }),

      scoreboard: players
        .map((player, index) => ({
          ...cards[index],
          userId: player.userId,
          totalPoints: player.totalPoints,
          setsWon: player.setsWon ?? 0,
          ratingBefore: player.ratingBefore,
          ratingAfter: player.ratingAfter ?? null,
          ratingDelta: player.ratingDelta ?? null,
          xpEarned: player.xpEarned ?? null,
          badgesEarned: player.badgesEarned ?? [],
          forfeited: player.forfeited,
          isMe: me?._id === player.userId,
        }))
        .sort((a, b) => b.setsWon - a.setsWon || b.totalPoints - a.totalPoints),

      /**
       * Matchup framing for the VS screen. Qualitative only — the projected rating
       * swing is deliberately withheld until match_end so the reward is not spent
       * before the match starts.
       */
      matchup:
        match.mode === "ranked" && me && cards.length === 2
          ? (() => {
              const mine = cards.find((card) => card?.userId === me._id);
              const theirs = cards.find((card) => card?.userId !== me._id);
              return mine && theirs ? matchupLabel(mine.elo, theirs.elo) : null;
            })()
          : null,
    };
  },
});

/** What the current player is allowed to do right now. */
export const myRoundStatus = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    const match = await ctx.db.get(args.matchId);
    if (!match) return null;

    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_match_round_user", (q) =>
        q.eq("matchId", args.matchId).eq("roundIndex", match.currentRound).eq("userId", user._id),
      )
      .collect();

    const solved = guesses.find((guess) => guess.correct);
    const lastWrong = guesses.filter((guess) => !guess.correct).at(-1);
    const lockedUntil = lastWrong ? lastWrong.serverReceivedAt + WRONG_GUESS_LOCKOUT_MS : 0;

    return {
      solved: solved !== undefined,
      attempts: guesses.length,
      attemptsRemaining: Math.max(0, MAX_GUESSES_PER_ROUND - guesses.length),
      lockedUntil,
      lockedNow: solved === undefined && Date.now() < lockedUntil,
      pointsThisRound: solved?.points ?? 0,
      tierThisRound: solved ? scoreForGuess(solved.clientElapsedMs).tier.id : null,
    };
  },
});

export type SubmitOutcome =
  | { status: "correct"; points: number; tier: string; tierLabel: string; elapsedMs: number }
  | { status: "wrong"; lockedUntil: number }
  | { status: "rejected"; reason: string };

/**
 * Submits a guess. The single most contended mutation in the game.
 *
 * Convex mutations are serializable transactions, so two players submitting in the
 * same instant are ordered by the database rather than racing — the second
 * transaction observes the first one's write. That is what makes "first correct
 * guess wins" correct without any explicit locking.
 *
 * Scoring uses the CLIENT's measured elapsed time, not arrival order, so a
 * high-latency player is not structurally disadvantaged. That number is untrusted
 * and is bounded by validateClientClock() before it is allowed to score.
 */
export const submitGuess = mutation({
  args: {
    matchId: v.id("matches"),
    roundIndex: v.number(),
    text: v.string(),
    clientElapsedMs: v.number(),
  },
  handler: async (ctx, args): Promise<SubmitOutcome> => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const match = await ctx.db.get(args.matchId);
    if (!match) return { status: "rejected", reason: "no-such-match" };
    if (match.status !== "active") return { status: "rejected", reason: "match-not-active" };
    // Guessing is only open during its own phase — a guess landing during the
    // reveal or countdown must not score.
    if ((match.phase ?? "guessing") !== "guessing") {
      return { status: "rejected", reason: "not-guessing-phase" };
    }
    if (args.roundIndex !== match.currentRound) {
      return { status: "rejected", reason: "stale-round" };
    }
    if (!match.playerIds.some((id) => id === user._id)) {
      return { status: "rejected", reason: "not-a-player" };
    }
    if (!match.roundStartedAt) return { status: "rejected", reason: "round-not-started" };

    const priorGuesses = await ctx.db
      .query("guesses")
      .withIndex("by_match_round_user", (q) =>
        q.eq("matchId", args.matchId).eq("roundIndex", args.roundIndex).eq("userId", user._id),
      )
      .collect();

    if (priorGuesses.some((guess) => guess.correct)) {
      return { status: "rejected", reason: "already-solved" };
    }
    if (priorGuesses.length >= MAX_GUESSES_PER_ROUND) {
      return { status: "rejected", reason: "too-many-attempts" };
    }

    const lastWrong = priorGuesses.at(-1);
    if (lastWrong && now < lastWrong.serverReceivedAt + WRONG_GUESS_LOCKOUT_MS) {
      return { status: "rejected", reason: "locked-out" };
    }

    const clock = validateClientClock({
      clientElapsedMs: args.clientElapsedMs,
      serverObservedElapsedMs: now - match.roundStartedAt,
      previousClientElapsedMs: priorGuesses.at(-1)?.clientElapsedMs,
    });

    if (!clock.valid) {
      await ctx.db.insert("guesses", {
        matchId: args.matchId,
        roundIndex: args.roundIndex,
        userId: user._id,
        rawText: args.text,
        normalizedText: normalizeTitle(args.text),
        correct: false,
        clientElapsedMs: args.clientElapsedMs,
        serverReceivedAt: now,
        accepted: false,
        rejectionReason: clock.rejection,
        points: 0,
      });
      return { status: "rejected", reason: clock.rejection };
    }

    const track = await ctx.db.get(match.trackIds[args.roundIndex]);
    if (!track) return { status: "rejected", reason: "no-such-track" };

    const aliases = await ctx.db
      .query("trackAliases")
      .withIndex("by_track", (q) => q.eq("trackId", track._id))
      .collect();

    const verdict = checkGuess(args.text, {
      titleNormalized: track.titleNormalized,
      aliasesNormalized: aliases.map((alias) => alias.aliasNormalized),
    });

    const score = scoreForGuess(clock.elapsedMs);
    const points = verdict.correct ? score.points : 0;

    await ctx.db.insert("guesses", {
      matchId: args.matchId,
      roundIndex: args.roundIndex,
      userId: user._id,
      rawText: args.text,
      normalizedText: verdict.normalizedGuess,
      correct: verdict.correct,
      clientElapsedMs: clock.elapsedMs,
      serverReceivedAt: now,
      accepted: true,
      points,
    });

    if (!verdict.correct) {
      return { status: "wrong", lockedUntil: now + WRONG_GUESS_LOCKOUT_MS };
    }

    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) => q.eq("matchId", args.matchId).eq("userId", user._id))
      .unique();

    if (player) {
      await ctx.db.patch(player._id, {
        totalPoints: player.totalPoints + points,
        lastSeenAt: now,
      });
    }

    // Everyone solved? Cut the round short rather than making them watch the clock.
    await endGuessingEarly(ctx, (await ctx.db.get(args.matchId))!);

    return {
      status: "correct",
      points,
      tier: score.tier.id,
      tierLabel: score.tier.label,
      elapsedMs: clock.elapsedMs,
    };
  },
});

/** Public profile card, reused by the lobby roster and profile pages. */
export const card = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => playerCard(ctx, args.userId),
});

export type PlayerCard = NonNullable<Awaited<ReturnType<typeof playerCard>>>;

/** Kept for callers that only need the doc type. */
export type MatchDoc = Doc<"matches">;
