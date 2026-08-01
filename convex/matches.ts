import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { actingUser, currentUser } from "./users";
import { endGuessingEarly } from "./phases";
import { MAX_GUESSES_PER_ROUND, WRONG_GUESS_LOCKOUT_MS } from "../src/engine/config";
import { checkGuess } from "../src/engine/match";
import { normalizeTitle } from "../src/engine/normalize";
import { revealBeatAt, scoreForGuess, validateClientClock } from "../src/engine/scoring";
import { rankForElo, isNotable, matchupLabel } from "../src/engine/ranks";
import { levelForXp } from "../src/engine/xp";
import { sortBadges } from "../src/engine/badges";
import { damageMultiplier, wonRound } from "../src/engine/duel";

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
    isBot: user.isBot === true,
    bio: user.bioHidden ? null : (user.bio ?? null),
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
/**
 * The single choke point confining guests to the daily.
 *
 * Every function that accepts a `guestToken` passes it through here first, so a token
 * is simply discarded on a ranked, practice or room match and the call falls back to
 * the Clerk identity. Ranked and practice therefore remain sign-in only by
 * construction rather than by remembering to check in five separate places.
 */
function dailyOnly(mode: string, guestToken: string | undefined): string | undefined {
  return mode === "daily" ? guestToken : undefined;
}

/** As above, but for mutations that must have an actor. */
async function requirePlayer(
  ctx: MutationCtx,
  mode: string,
  guestToken: string | undefined,
): Promise<Doc<"users">> {
  const user = await actingUser(ctx, dailyOnly(mode, guestToken));
  if (!user) throw new Error("Not signed in");
  return user;
}

export const state = query({
  args: { matchId: v.id("matches"), guestToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return null;

    // A token is only honoured for the daily, so it can never surface another
    // player's `isMe` in a ranked or room match.
    const me = await actingUser(ctx, dailyOnly(match.mode, args.guestToken));

    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();

    const cards = await Promise.all(players.map((player) => playerCard(ctx, player.userId)));

    const roundElapsedMs = match.roundStartedAt ? Date.now() - match.roundStartedAt : 0;
    const phase = match.phase ?? (match.status === "veto" ? "veto" : "guessing");

    // The current track is revealed only once guessing has closed.
    const revealing =
      phase === "reveal" || phase === "standings" || phase === "milestone";
    const currentTrackDoc =
      match.currentRound < match.trackIds.length
        ? await ctx.db.get(match.trackIds[match.currentRound])
        : null;

    const nextTrackDoc =
      match.currentRound + 1 < match.trackIds.length
        ? await ctx.db.get(match.trackIds[match.currentRound + 1])
        : null;

    const currentTrackCategory =
      revealing && currentTrackDoc?.categoryIds[0]
        ? await ctx.db.get(currentTrackDoc.categoryIds[0])
        : null;

    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_match_round", (q) =>
        q.eq("matchId", args.matchId).eq("roundIndex", match.currentRound),
      )
      .collect();

    // Every guess in the match, for the running stats the between-round beats show.
    const allGuesses = await ctx.db
      .query("guesses")
      .withIndex("by_match_round", (q) => q.eq("matchId", args.matchId))
      .collect();

    /**
     * Running per-player stats.
     *
     * These are what give the between-round beats something to say beyond a bare
     * number — a round win, a streak, a personal best are all things worth showing.
     */
    const statsFor = (userId: Id<"users">) => {
      let roundsWon = 0;
      let streak = 0;
      let bestMs: number | null = null;
      let solved = 0;

      for (let round = 0; round <= match.currentRound; round++) {
        const pointsFor = (id: Id<"users">) =>
          allGuesses
            .filter((g) => g.roundIndex === round && g.userId === id && g.correct)
            .reduce((sum, g) => sum + g.points, 0);

        const mine = pointsFor(userId);
        const mySolve = allGuesses.find(
          (g) => g.roundIndex === round && g.userId === userId && g.correct,
        );

        if (mySolve) {
          solved++;
          bestMs = bestMs === null ? mySolve.clientElapsedMs : Math.min(bestMs, mySolve.clientElapsedMs);
        }

        const others = match.playerIds.filter((id) => id !== userId).map(pointsFor);

        if (wonRound(mine, others)) {
          roundsWon++;
          streak++;
        } else if (others.some((points) => points > mine)) {
          streak = 0;
        }
      }

      return { roundsWon, streak, bestMs, solved };
    };

    return {
      matchId: match._id,
      mode: match.mode,
      status: match.status,
      phase,
      phaseEndsAt: match.phaseEndsAt ?? null,
      currentRound: match.currentRound,
      totalRounds: match.trackIds.length,
      /** Derived from the log so it can never disagree with the recorded history. */
      lastRoundDamage: (match.roundLog ?? []).at(-1)?.damage ?? [],
      lastRoundOutcome: (match.roundLog ?? []).at(-1)?.outcome ?? null,
      lastRoundTimeGapMs: (match.roundLog ?? []).at(-1)?.timeGapMs ?? null,
      multiplier: damageMultiplier(match.currentRound),
      nextMultiplier: damageMultiplier(match.currentRound + 1),
      suddenDeath: match.suddenDeath === true,
      roundStartedAt: match.roundStartedAt ?? null,
      roundElapsedMs,
      revealBeat: revealBeatAt(roundElapsedMs),
      winnerId: match.winnerId ?? null,

      /** Audio is needed to play; the title never is until the reveal. */
      currentAudioUrl: currentTrackDoc?.previewUrl ?? null,
      /**
       * The next round's clip, exposed during the between-round beats so the client
       * can buffer it before the countdown. Without this the client first learns the
       * URL when the countdown starts and has only 3s to load ~1MB.
       */
      nextAudioUrl: revealing ? (nextTrackDoc?.previewUrl ?? null) : null,
      currentTrack: revealing && currentTrackDoc
        ? {
            title: currentTrackDoc.title,
            artist: currentTrackDoc.artist,
            artworkUrl: currentTrackDoc.artworkUrl,
            releaseYear: currentTrackDoc.releaseYear,
            difficulty: currentTrackDoc.difficulty,
            categoryName: currentTrackCategory?.name ?? null,
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

      /** Who took the round just played, for the standings callout. */
      roundWinnerId: (() => {
        const scored = players
          .map((player) => ({
            userId: player.userId,
            points: guesses
              .filter((g) => g.userId === player.userId && g.correct)
              .reduce((sum, g) => sum + g.points, 0),
          }))
          .sort((a, b) => b.points - a.points);
        if (scored.length === 0 || scored[0].points === 0) return null;
        if (scored[1] && scored[1].points === scored[0].points) return null;
        return scored[0].userId;
      })(),

      scoreboard: players
        .map((player, index) => ({
          ...cards[index],
          ...statsFor(player.userId),
          userId: player.userId,
          totalPoints: player.totalPoints,
          hp: player.hp ?? 0,
          eliminatedAtRound: player.eliminatedAtRound ?? null,
          passedRound: player.passedRound ?? null,
          ratingBefore: player.ratingBefore,
          ratingAfter: player.ratingAfter ?? null,
          ratingDelta: player.ratingDelta ?? null,
          xpEarned: player.xpEarned ?? null,
          xpBreakdown: player.xpBreakdown ?? [],
          // Null until `progression.finalizeMatch` has run. The results screen treats
          // that as "still settling" rather than as a level of zero.
          levelBefore: player.levelBefore ?? null,
          levelAfter: player.levelAfter ?? null,
          xpAfter: player.xpAfter ?? null,
          badgesEarned: player.badgesEarned ?? [],
          forfeited: player.forfeited,
          isMe: me?._id === player.userId,
        }))
        .sort((a, b) => b.hp - a.hp || b.totalPoints - a.totalPoints),

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
  args: { matchId: v.id("matches"), guestToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return null;

    const user = await actingUser(ctx, dailyOnly(match.mode, args.guestToken));
    if (!user) return null;

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
 * The authoritative guess pipeline, shared by human and bot submissions.
 *
 * Bots call this through an internal mutation rather than getting a privileged
 * write path, so they are subject to exactly the same phase checks, lockouts,
 * attempt limits and clock validation a human is. A bot that reports an impossible
 * reaction time is rejected like any other client.
 */
export async function applyGuess(
  ctx: MutationCtx,
  params: {
    matchId: Id<"matches">;
    roundIndex: number;
    userId: Id<"users">;
    text: string;
    clientElapsedMs: number;
  },
): Promise<SubmitOutcome> {
  const { matchId, roundIndex, userId, text, clientElapsedMs } = params;
  const now = Date.now();

  const match = await ctx.db.get(matchId);
  if (!match) return { status: "rejected", reason: "no-such-match" };
  if (match.status !== "active") return { status: "rejected", reason: "match-not-active" };
  // Guessing is only open during its own phase — a guess landing during the
  // reveal or countdown must not score.
  if ((match.phase ?? "guessing") !== "guessing") {
    return { status: "rejected", reason: "not-guessing-phase" };
  }
  if (roundIndex !== match.currentRound) {
    return { status: "rejected", reason: "stale-round" };
  }
  if (!match.playerIds.some((id) => id === userId)) {
    return { status: "rejected", reason: "not-a-player" };
  }
  if (!match.roundStartedAt) return { status: "rejected", reason: "round-not-started" };

  const priorGuesses = await ctx.db
    .query("guesses")
    .withIndex("by_match_round_user", (q) =>
      q.eq("matchId", matchId).eq("roundIndex", roundIndex).eq("userId", userId),
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
    clientElapsedMs,
    serverObservedElapsedMs: now - match.roundStartedAt,
    previousClientElapsedMs: priorGuesses.at(-1)?.clientElapsedMs,
  });

  if (!clock.valid) {
    await ctx.db.insert("guesses", {
      matchId,
      roundIndex,
      userId,
      rawText: text,
      normalizedText: normalizeTitle(text),
      correct: false,
      clientElapsedMs,
      serverReceivedAt: now,
      accepted: false,
      rejectionReason: clock.rejection,
      points: 0,
    });
    return { status: "rejected", reason: clock.rejection };
  }

  const track = await ctx.db.get(match.trackIds[roundIndex]);
  if (!track) return { status: "rejected", reason: "no-such-track" };

  const aliases = await ctx.db
    .query("trackAliases")
    .withIndex("by_track", (q) => q.eq("trackId", track._id))
    .collect();

  const verdict = checkGuess(text, {
    titleNormalized: track.titleNormalized,
    aliasesNormalized: aliases.map((alias) => alias.aliasNormalized),
  });

  const score = scoreForGuess(clock.elapsedMs);
  const points = verdict.correct ? score.points : 0;

  await ctx.db.insert("guesses", {
    matchId,
    roundIndex,
    userId,
    rawText: text,
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
    .withIndex("by_match_user", (q) => q.eq("matchId", matchId).eq("userId", userId))
    .unique();

  if (player) {
    await ctx.db.patch(player._id, {
      totalPoints: player.totalPoints + points,
      lastSeenAt: now,
    });
  }

  // Everyone solved? Cut the round short rather than making them watch the clock.
  const refreshed = await ctx.db.get(matchId);
  if (refreshed) await endGuessingEarly(ctx, refreshed);

  return {
    status: "correct",
    points,
    tier: score.tier.id,
    tierLabel: score.tier.label,
    elapsedMs: clock.elapsedMs,
  };
}

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
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SubmitOutcome> => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error("Match not found");

    const user = await requirePlayer(ctx, match.mode, args.guestToken);
    return applyGuess(ctx, {
      matchId: args.matchId,
      roundIndex: args.roundIndex,
      text: args.text,
      clientElapsedMs: args.clientElapsedMs,
      userId: user._id,
    });
  },
});

/**
 * Reports that this client has buffered the round's clip.
 *
 * The guessing clock does not start until every player has reported, which is what
 * stops a slow connection producing a song that cuts off mid-play.
 */
export const reportReady = mutation({
  args: {
    matchId: v.id("matches"),
    roundIndex: v.number(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return;

    const user = await actingUser(ctx, dailyOnly(match.mode, args.guestToken));
    if (!user) return;

    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) => q.eq("matchId", args.matchId).eq("userId", user._id))
      .unique();

    if (!player) return;
    // Monotonic: a late report for an old round must not un-ready the current one.
    if ((player.readyForRound ?? -1) >= args.roundIndex) return;

    await ctx.db.patch(player._id, { readyForRound: args.roundIndex });
  },
});

/**
 * Gives up on the current song.
 *
 * Sitting out a full 30 seconds on a track you will never get is the deadest time in
 * a match. Passing locks in zero, and once everyone has solved or passed the round
 * ends immediately.
 */
export const pass = mutation({
  args: {
    matchId: v.id("matches"),
    roundIndex: v.number(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return { passed: false as const };

    const user = await requirePlayer(ctx, match.mode, args.guestToken);

    if (match.phase !== "guessing") return { passed: false as const };
    if (match.currentRound !== args.roundIndex) return { passed: false as const };

    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) => q.eq("matchId", args.matchId).eq("userId", user._id))
      .unique();

    if (!player) return { passed: false as const };

    await ctx.db.patch(player._id, { passedRound: args.roundIndex });

    const refreshed = await ctx.db.get(args.matchId);
    if (refreshed) await endGuessingEarly(ctx, refreshed);

    return { passed: true as const };
  },
});

/**
 * Everything the results screen needs.
 *
 * A separate query from `state` on purpose: `state` is subscribed to continuously
 * during play, and loading every round's track detail into it would re-run that
 * join on every tick of every round for data only ever read once, at the end.
 */
export const summary = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const me = await currentUser(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match) return null;

    const log = match.roundLog ?? [];

    const rounds = await Promise.all(
      log.map(async (entry) => {
        const track = await ctx.db.get(entry.trackId);
        return {
          roundIndex: entry.roundIndex,
          outcome: entry.outcome,
          winnerId: entry.winnerId ?? null,
          timeGapMs: entry.timeGapMs ?? null,
          multiplier: entry.multiplier,
          damage: entry.damage,
          results: entry.results,
          track: track
            ? {
                title: track.title,
                artist: track.artist,
                artworkUrl: track.artworkUrl,
                releaseYear: track.releaseYear,
              }
            : null,
        };
      }),
    );

    // Best and worst calls, from this player's perspective.
    let fastest: { roundIndex: number; elapsedMs: number } | null = null;
    let costliest: { roundIndex: number; damage: number } | null = null;

    if (me) {
      for (const entry of log) {
        const mine = entry.results.find((result) => result.userId === me._id);
        if (mine?.solved && mine.elapsedMs !== undefined) {
          if (!fastest || mine.elapsedMs < fastest.elapsedMs) {
            fastest = { roundIndex: entry.roundIndex, elapsedMs: mine.elapsedMs };
          }
        }

        const hit = entry.damage.find((d) => d.userId === me._id)?.damage ?? 0;
        if (hit > 0 && (!costliest || hit > costliest.damage)) {
          costliest = { roundIndex: entry.roundIndex, damage: hit };
        }
      }
    }

    return {
      mode: match.mode,
      winnerId: match.winnerId ?? null,
      rounds,
      fastest,
      costliest,
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
