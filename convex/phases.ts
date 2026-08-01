import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  PHASE_DURATIONS_MS,
  SONGS_PER_SET,
  type MatchPhase,
} from "../src/engine/config";
import {
  isLastRoundOfSet,
  resolveRankedMatch,
  resolveSet,
  setIndexForRound,
  type SetPlayerResult,
} from "../src/engine/sets";
import { ROUND_DURATION_MS } from "../src/engine/config";

/**
 * Server-driven phase machine.
 *
 * Both players must see identical beats — a reveal that lands a second apart ruins
 * the head-to-head moment — so the *server* owns the clock. Each phase schedules its
 * own successor with `ctx.scheduler.runAfter`, which means no client polling and no
 * drift between opponents.
 *
 * Every transition is guarded on the phase it expects to be leaving. A scheduled job
 * that fires late (or twice) against a match that has already moved on is a no-op
 * rather than a skipped round.
 */

/** Phases whose end is a wall-clock deadline the client can render a countdown from. */
function durationFor(phase: MatchPhase): number | null {
  return phase in PHASE_DURATIONS_MS
    ? PHASE_DURATIONS_MS[phase as keyof typeof PHASE_DURATIONS_MS]
    : null;
}

/**
 * Moves a match into a phase and schedules the follow-up transition.
 *
 * `match_end` and `veto` are terminal here: the former ends the match, the latter
 * waits on player input rather than a timer.
 */
export async function enterPhase(
  ctx: MutationCtx,
  matchId: Id<"matches">,
  phase: MatchPhase,
  patch: Partial<Doc<"matches">> = {},
): Promise<void> {
  const duration = durationFor(phase);
  const now = Date.now();

  await ctx.db.patch(matchId, {
    ...patch,
    phase,
    phaseEndsAt: duration === null ? undefined : now + duration,
    ...(phase === "guessing" ? { roundStartedAt: now } : {}),
  });

  if (duration === null) return;

  await ctx.scheduler.runAfter(duration, internal.phases.advance, {
    matchId,
    expectedPhase: phase,
  });
}

/**
 * Collects per-player results for the set a given round belongs to.
 *
 * Unsolved songs contribute the full round duration to the tiebreak total, so
 * failing to answer can never rank above answering slowly.
 */
async function buildSetResults(
  ctx: MutationCtx,
  match: Doc<"matches">,
  setIndex: number,
): Promise<SetPlayerResult[]> {
  const firstRound = setIndex * SONGS_PER_SET;
  const lastRound = Math.min(firstRound + SONGS_PER_SET, match.trackIds.length);

  const guesses = await ctx.db
    .query("guesses")
    .withIndex("by_match_round", (q) => q.eq("matchId", match._id))
    .collect();

  return match.playerIds.map((userId) => {
    let points = 0;
    let totalElapsedMs = 0;

    for (let round = firstRound; round < lastRound; round++) {
      const solved = guesses.find(
        (guess) => guess.roundIndex === round && guess.userId === userId && guess.correct,
      );
      points += solved?.points ?? 0;
      totalElapsedMs += solved ? solved.clientElapsedMs : ROUND_DURATION_MS;
    }

    return { userId: String(userId), points, totalElapsedMs };
  });
}

/**
 * Round-trips an engine-side string id back to a typed player id.
 *
 * The pure engine works in plain strings so it stays free of Convex types. Casting
 * back would silently accept anything; looking the id up in `playerIds` means an
 * unexpected value becomes `undefined` (a drawn set) rather than a corrupt record.
 */
function toPlayerId(
  match: Doc<"matches">,
  id: string | undefined,
): Id<"users"> | undefined {
  if (id === undefined) return undefined;
  return match.playerIds.find((playerId) => String(playerId) === id);
}

/** Tallies sets won across every closed set. */
function tallySets(
  setResults: NonNullable<Doc<"matches">["setResults"]>,
): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const set of setResults) {
    if (set.winnerId) tally[String(set.winnerId)] = (tally[String(set.winnerId)] ?? 0) + 1;
  }
  return tally;
}

/**
 * Advances a match to its next phase.
 *
 * Internal because only the scheduler and other server code may drive it — letting a
 * client call this would hand it the ability to skip its opponent's guessing window.
 */
export const advance = internalMutation({
  args: { matchId: v.id("matches"), expectedPhase: v.string() },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return;
    if (match.phase !== args.expectedPhase) return; // already moved on
    if (match.status === "complete" || match.status === "abandoned") return;

    switch (match.phase) {
      case "vs_reveal":
        // The ban draft waits on player input, so it has no scheduled successor.
        await enterPhase(ctx, match._id, "veto");
        return;

      case "countdown":
        await enterPhase(ctx, match._id, "guessing");
        return;

      case "guessing":
        await enterPhase(ctx, match._id, "reveal");
        return;

      case "reveal":
        await enterPhase(ctx, match._id, "standings");
        return;

      case "standings":
        await closeRoundAndContinue(ctx, match);
        return;

      case "set_break":
        await startNextSet(ctx, match);
        return;

      default:
        return;
    }
  },
});

/**
 * Called once the standings beat finishes: either start the next song, or close the
 * set and decide whether the match continues.
 */
async function closeRoundAndContinue(ctx: MutationCtx, match: Doc<"matches">): Promise<void> {
  const roundIndex = match.currentRound;
  const isFinalTrack = roundIndex + 1 >= match.trackIds.length;

  // The daily is a flat solo run: no sets, no podium, no set breaks. Falling
  // through to the set logic would chop a 5-song run into a 3+2 "series" against
  // nobody, and resolve it as if the player had won two sets.
  if (match.mode === "daily") {
    if (isFinalTrack) {
      await finishMatch(ctx, match, undefined);
      return;
    }
    await enterPhase(ctx, match._id, "countdown", { currentRound: roundIndex + 1 });
    return;
  }

  // Mid-set: straight on to the next song.
  if (!isLastRoundOfSet(roundIndex) && !isFinalTrack && !match.suddenDeath) {
    await enterPhase(ctx, match._id, "countdown", { currentRound: roundIndex + 1 });
    return;
  }

  // Sudden death is a single decider — whoever took it wins the match outright.
  if (match.suddenDeath) {
    const results = await buildSetResults(ctx, match, setIndexForRound(roundIndex));
    const outcome = resolveSet(results);
    // The engine works in plain strings so it stays free of Convex types; the id
    // is round-tripped from match.playerIds rather than blindly cast.
    await finishMatch(ctx, match, toPlayerId(match, outcome.winnerId));
    return;
  }

  const setIndex = setIndexForRound(roundIndex);
  const results = await buildSetResults(ctx, match, setIndex);
  const outcome = resolveSet(results);

  const setResults = [
    ...(match.setResults ?? []),
    {
      setIndex,
      winnerId: toPlayerId(match, outcome.winnerId),
      decidedOnTime: outcome.decidedOnTime,
      standings: outcome.standings.map((entry) => ({
        userId: toPlayerId(match, entry.userId)!,
        points: entry.points,
        totalElapsedMs: entry.totalElapsedMs,
      })),
    },
  ];

  if (outcome.winnerId) {
    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) =>
        q.eq("matchId", match._id).eq("userId", toPlayerId(match, outcome.winnerId)!),
      )
      .unique();
    if (player) await ctx.db.patch(player._id, { setsWon: (player.setsWon ?? 0) + 1 });
  }

  await ctx.db.patch(match._id, { setResults });

  await enterPhase(ctx, match._id, "set_break", { setResults });
}

/** Decides, after a set break, whether to play on, go to sudden death, or finish. */
async function startNextSet(ctx: MutationCtx, match: Doc<"matches">): Promise<void> {
  const setResults = match.setResults ?? [];

  // Rooms always run the full distance; ranked can end early at SETS_TO_WIN.
  if (match.mode === "room") {
    if (setResults.length * SONGS_PER_SET >= match.trackIds.length) {
      await finishMatch(ctx, match, undefined);
      return;
    }
    await enterPhase(ctx, match._id, "countdown", {
      currentRound: setResults.length * SONGS_PER_SET,
      currentSet: setResults.length,
    });
    return;
  }

  const status = resolveRankedMatch({
    setsWon: tallySets(setResults),
    setsPlayed: setResults.length,
  });

  if (status.kind === "complete") {
    await finishMatch(ctx, match, toPlayerId(match, status.winnerId));
    return;
  }

  if (status.kind === "sudden-death") {
    const nextRound = setResults.length * SONGS_PER_SET;
    if (nextRound >= match.trackIds.length) {
      // Catalogue exhausted — settle on total points rather than stalling forever.
      await finishMatch(ctx, match, undefined);
      return;
    }
    await enterPhase(ctx, match._id, "countdown", {
      currentRound: nextRound,
      suddenDeath: true,
    });
    return;
  }

  await enterPhase(ctx, match._id, "countdown", {
    currentRound: status.nextSetIndex * SONGS_PER_SET,
    currentSet: status.nextSetIndex,
  });
}

/**
 * Ends a match. Rating, XP and badges are applied by `ranked.finalize`, which this
 * schedules rather than inlines so the phase machine stays independent of the
 * progression rules.
 */
async function finishMatch(
  ctx: MutationCtx,
  match: Doc<"matches">,
  winnerId: Id<"users"> | undefined,
): Promise<void> {
  await ctx.db.patch(match._id, {
    status: "complete",
    phase: "match_end",
    phaseEndsAt: undefined,
    winnerId,
    completedAt: Date.now(),
  });

  await ctx.scheduler.runAfter(0, internal.progression.finalizeMatch, {
    matchId: match._id,
  });
}

/**
 * Ends the guessing phase early once every player has solved the current song.
 *
 * Called from `submitGuess`. The scheduled 30s transition still fires later and is
 * harmlessly ignored, because `advance` checks the phase it expects to be leaving.
 */
export async function endGuessingEarly(
  ctx: MutationCtx,
  match: Doc<"matches">,
): Promise<void> {
  if (match.phase !== "guessing") return;

  const guesses = await ctx.db
    .query("guesses")
    .withIndex("by_match_round", (q) =>
      q.eq("matchId", match._id).eq("roundIndex", match.currentRound),
    )
    .collect();

  const solvers = new Set(
    guesses.filter((guess) => guess.correct).map((guess) => String(guess.userId)),
  );

  if (!match.playerIds.every((id) => solvers.has(String(id)))) return;

  await enterPhase(ctx, match._id, "reveal");
}

/**
 * Client-callable nudge for a match whose scheduled transition never landed.
 *
 * Convex's scheduler is reliable, but a match stuck on an expired phase would be
 * unrecoverable without this. It only acts once the deadline has genuinely passed,
 * so it cannot be used to rush an opponent.
 */
export const nudge = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match?.phase || !match.phaseEndsAt) return { nudged: false as const };
    if (Date.now() < match.phaseEndsAt) return { nudged: false as const };

    await ctx.scheduler.runAfter(0, internal.phases.advance, {
      matchId: args.matchId,
      expectedPhase: match.phase,
    });
    return { nudged: true as const };
  },
});
