import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  MILESTONE_EVERY_ROUNDS,
  PHASE_DURATIONS_MS,
  READY_TIMEOUT_MS,
  ROUND_DURATION_MS,
  VETO_PHASE_MS,
  VS_READY_COUNTDOWN_MS,
  type MatchPhase,
} from "../src/engine/config";
import {
  damageMultiplier,
  duelDamage,
  isMilestoneRound,
  resolveDuel,
  resolveRoom,
  roomDamage,
  type DuelPlayerState,
  type RoundScore,
} from "../src/engine/duel";
import { matchHasBot } from "./bots";

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

  // Bots plan their whole round the moment guessing opens, take their draft turns the
  // moment the draft opens, and cannot press Ready at all. This is the single place any
  // of those phases is ever entered, so scheduling here cannot be missed.
  if (phase === "guessing" || phase === "veto" || phase === "vs_reveal") {
    const match = await ctx.db.get(matchId);
    if (match && (await matchHasBot(ctx, match))) {
      if (phase === "veto") {
        await ctx.scheduler.runAfter(0, internal.bots.draftTurn, { matchId });
      } else if (phase === "guessing") {
        await ctx.scheduler.runAfter(0, internal.bots.playRound, {
          matchId,
          roundIndex: match.currentRound,
        });
      } else {
        // Ready is what ends the reveal, and `markVsReady` only runs the "is everyone in"
        // check when a human calls it. With no human in the match nobody ever calls it, so
        // a bot-vs-bot duel — which the dev rank bots make possible, since they sit in the
        // real queue — stalls here for the full thirty seconds with nobody watching.
        // Gated on there being a bot at all: a duel between two humans cannot hit this.
        await ctx.scheduler.runAfter(0, internal.phases.skipVsIfNoHumans, { matchId });
      }
    }
  }

  if (duration === null) return;

  // Read back the round we just committed, so the timer is bound to it and cannot
  // fire against a later round that happens to share this phase name.
  const committed = await ctx.db.get(matchId);

  await ctx.scheduler.runAfter(duration, internal.phases.advance, {
    matchId,
    expectedPhase: phase,
    expectedRound: committed?.currentRound ?? 0,
  });
}

/**
 * Starts the guessing round once every client has buffered its clip.
 *
 * This is the barrier the audio bug needed. Previously the guessing clock started on
 * a fixed 3s countdown regardless of whether the audio had loaded, so a slow buffer
 * silently ate part of the round and the song appeared to cut off mid-play.
 *
 * `startedWaitingAt` bounds the wait: one broken client cannot stall a match forever.
 */
export const waitForReady = internalMutation({
  args: { matchId: v.id("matches"), roundIndex: v.number(), startedWaitingAt: v.number() },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.phase !== "countdown") return;
    if (match.currentRound !== args.roundIndex) return;

    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();

    // Bots have no audio to buffer, so they are always ready.
    const humanPlayers: Doc<"matchPlayers">[] = [];
    for (const player of players) {
      const user = await ctx.db.get(player.userId);
      if (!user?.isBot) humanPlayers.push(player);
    }

    const everyoneReady = humanPlayers.every(
      (player) => (player.readyForRound ?? -1) >= args.roundIndex,
    );
    const timedOut = Date.now() - args.startedWaitingAt >= READY_TIMEOUT_MS;

    if (everyoneReady || timedOut) {
      await enterPhase(ctx, args.matchId, "guessing");
      return;
    }

    // Poll rather than wait on a client callback, so a dropped mutation cannot hang
    // the match; the timeout above is the hard stop.
    await ctx.scheduler.runAfter(300, internal.phases.waitForReady, args);
  },
});

function toPlayerId(
  match: Doc<"matches">,
  id: string | undefined,
): Id<"users"> | undefined {
  if (id === undefined) return undefined;
  return match.playerIds.find((playerId) => String(playerId) === id);
}

/**
 * Advances a match to its next phase.
 *
 * Internal because only the scheduler and other server code may drive it — letting a
 * client call this would hand it the ability to skip its opponent's guessing window.
 */
export const advance = internalMutation({
  args: {
    matchId: v.id("matches"),
    expectedPhase: v.string(),
    /**
     * The round this timer was armed for.
     *
     * Guarding on the phase NAME alone is not enough, and the omission was a real
     * bug: solving a round early jumps straight to the reveal, but that round's
     * 30-second guessing timer stays armed. It later fires against the *next*
     * round — which is also called "guessing" — and killed it mid-song. Round 1
     * always looked fine because it is the first round to leave a stale timer.
     */
    expectedRound: v.number(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return;
    if (match.phase !== args.expectedPhase) return; // already moved on
    if (match.currentRound !== args.expectedRound) return; // timer from an older round
    if (match.status === "complete" || match.status === "abandoned") return;

    switch (match.phase) {
      case "vs_reveal":
        await leaveVsReveal(ctx, match);
        return;

      case "countdown":
        // Handled by waitForReady, which owns the transition into guessing.
        return;

      case "guessing":
        await enterPhase(ctx, match._id, "reveal");
        return;

      case "reveal":
        await applyRoundDamage(ctx, match);
        return;

      case "standings":
        await continueOrFinish(ctx, match);
        return;

      case "milestone":
        await startCountdown(ctx, match._id, match.currentRound);
        return;

      default:
        return;
    }
  },
});

/**
 * Everyone is ready — bring the reveal's clock in to three seconds.
 *
 * Not a transition. The phase still ends the way it always did, through `advance` and
 * then `leaveVsReveal`, so the early path and the timeout path remain the same path —
 * only the deadline moves. Jumping straight into the draft here would give a match that
 * was readied a different route in than one that timed out, which is exactly what
 * `leaveVsReveal`'s docblock exists to prevent.
 *
 * Monotonic on purpose: it only ever pulls the deadline in, never pushes it out. Ready is
 * idempotent by design — the button is disabled after a press but the mutation is not —
 * and without this guard a second call would restart the three seconds every time.
 *
 * The original 30-second timer stays armed and lands later against a match that has moved
 * on, where `advance`'s phase guard makes it a no-op. There is nothing to cancel.
 */
export async function armVsCountdown(
  ctx: MutationCtx,
  match: Doc<"matches">,
): Promise<void> {
  const endsAt = Date.now() + VS_READY_COUNTDOWN_MS;
  if (match.phaseEndsAt !== undefined && match.phaseEndsAt <= endsAt) return;

  await ctx.db.patch(match._id, { phaseEndsAt: endsAt });

  await ctx.scheduler.runAfter(VS_READY_COUNTDOWN_MS, internal.phases.advance, {
    matchId: match._id,
    expectedPhase: "vs_reveal",
    expectedRound: match.currentRound,
  });
}

/**
 * Skips the reveal's wait when there is nobody there to read it.
 *
 * Goes through `armVsCountdown` rather than straight to `leaveVsReveal` so a bot-vs-bot
 * match still plays the three-second beat — anyone spectating sees the same sequence a
 * real duel shows, just without the wait.
 */
export const skipVsIfNoHumans = internalMutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.phase !== "vs_reveal") return;

    const players = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .collect();

    for (const player of players) {
      const user = await ctx.db.get(player.userId);
      if (!user?.isBot) return; // a human is here; let them read it
    }

    await armVsCountdown(ctx, match);
  },
});

/**
 * What follows the opponent reveal.
 *
 * Exported and shared by the two paths that can end that phase — the scheduled timeout in
 * `advance`, and both players pressing Ready via `ranked.markVsReady`. Keeping the decision
 * in one function is the point: if the early path and the timeout path each decided for
 * themselves, a match that skipped the reveal could take a different route into the duel
 * than one that waited it out.
 *
 * Whether there is a draft is decided by whether a pool was built for this match, not by an
 * allowlist of modes — ranked and practice both build one, rooms and the daily never do.
 * Gating on the mode is what used to leave practice without a draft at all.
 */
export async function leaveVsReveal(ctx: MutationCtx, match: Doc<"matches">): Promise<void> {
  if ((match.vetoPoolIds?.length ?? 0) > 0) {
    await enterPhase(ctx, match._id, "veto", {
      vetoDeadline: Date.now() + VETO_PHASE_MS,
    });
    return;
  }
  await startCountdown(ctx, match._id, match.currentRound);
}

/** Enters the countdown and arms the readiness barrier for the given round. */
export async function startCountdown(
  ctx: MutationCtx,
  matchId: Id<"matches">,
  roundIndex: number,
): Promise<void> {
  await enterPhase(ctx, matchId, "countdown", { currentRound: roundIndex });

  await ctx.scheduler.runAfter(PHASE_DURATIONS_MS.countdown, internal.phases.waitForReady, {
    matchId,
    roundIndex,
    startedWaitingAt: Date.now(),
  });
}

/** Per-player points and reaction time for the round that just closed. */
async function roundScores(
  ctx: MutationCtx,
  match: Doc<"matches">,
): Promise<RoundScore[]> {
  const guesses = await ctx.db
    .query("guesses")
    .withIndex("by_match_round", (q) =>
      q.eq("matchId", match._id).eq("roundIndex", match.currentRound),
    )
    .collect();

  return match.playerIds.map((userId) => {
    const solved = guesses.find((guess) => guess.userId === userId && guess.correct);
    return {
      userId: String(userId),
      points: solved?.points ?? 0,
      // Unsolved contributes the full round, so failing to answer never ranks above
      // answering slowly.
      elapsedMs: solved?.clientElapsedMs ?? ROUND_DURATION_MS,
    };
  });
}

/**
 * Applies the round's damage and moves into the standings beat.
 *
 * The daily has no opponent and therefore no damage — it simply advances.
 */
async function applyRoundDamage(ctx: MutationCtx, match: Doc<"matches">): Promise<void> {
  const scores = await roundScores(ctx, match);
  const guesses = await ctx.db
    .query("guesses")
    .withIndex("by_match_round", (q) =>
      q.eq("matchId", match._id).eq("roundIndex", match.currentRound),
    )
    .collect();

  const results = match.playerIds.map((userId) => {
    const solved = guesses.find((guess) => guess.userId === userId && guess.correct);
    return {
      userId,
      points: solved?.points ?? 0,
      elapsedMs: solved?.clientElapsedMs,
      solved: solved !== undefined,
    };
  });

  // The daily is solo: there is nobody to lose health to.
  const resolution =
    match.mode === "daily"
      ? { outcome: "song" as const, winnerId: undefined, damage: [], timeGapMs: undefined }
      : match.mode === "room"
        ? roomDamage(scores, match.currentRound)
        : duelDamage(scores, match.currentRound);

  const applied: { userId: Id<"users">; damage: number; hpAfter: number }[] = [];

  for (const entry of resolution.damage) {
    const userId = toPlayerId(match, entry.userId);
    if (!userId) continue;

    const player = await ctx.db
      .query("matchPlayers")
      .withIndex("by_match_user", (q) => q.eq("matchId", match._id).eq("userId", userId))
      .unique();
    if (!player) continue;

    // Eliminated players keep guessing for placing, but take no further damage.
    const alreadyOut = player.eliminatedAtRound !== undefined && player.eliminatedAtRound !== null;
    const hpBefore = player.hp ?? 0;
    const hpAfter = alreadyOut ? hpBefore : Math.max(0, hpBefore - entry.damage);

    await ctx.db.patch(player._id, {
      hp: hpAfter,
      lowestHp: Math.min(player.lowestHp ?? hpBefore, hpAfter),
      ...(hpAfter === 0 && !alreadyOut ? { eliminatedAtRound: match.currentRound } : {}),
    });

    applied.push({ userId, damage: alreadyOut ? 0 : entry.damage, hpAfter });
  }

  const logEntry = {
    roundIndex: match.currentRound,
    trackId: match.trackIds[match.currentRound],
    outcome: resolution.outcome,
    winnerId: toPlayerId(match, resolution.winnerId),
    timeGapMs: resolution.timeGapMs,
    multiplier: damageMultiplier(match.currentRound),
    damage: applied,
    results,
  };

  const roundLog = [...(match.roundLog ?? []), logEntry];

  /**
   * The daily has no standings beat.
   *
   * Standings exists to drain health bars and name a round winner, and a solo run has
   * neither — it rendered "THE SONG WINS · neither of you got it" at a player with no
   * opponent. Log the round and go straight on to the next one.
   */
  if (match.mode === "daily") {
    await ctx.db.patch(match._id, { roundLog });
    const refreshed = await ctx.db.get(match._id);
    if (refreshed) await continueOrFinish(ctx, refreshed);
    return;
  }

  await enterPhase(ctx, match._id, "standings", { roundLog });
}

/** Decides after the standings beat whether the match continues, and to which phase. */
async function continueOrFinish(ctx: MutationCtx, match: Doc<"matches">): Promise<void> {
  const roundsPlayed = match.currentRound + 1;

  if (match.mode === "daily") {
    if (roundsPlayed >= match.trackIds.length) {
      await finishMatch(ctx, match, undefined);
      return;
    }
    await startCountdown(ctx, match._id, roundsPlayed);
    return;
  }

  const players = await ctx.db
    .query("matchPlayers")
    .withIndex("by_match", (q) => q.eq("matchId", match._id))
    .collect();

  const states: DuelPlayerState[] = players.map((player) => ({
    userId: String(player.userId),
    hp: player.hp ?? 0,
    totalPoints: player.totalPoints,
    eliminatedAtRound: player.eliminatedAtRound ?? null,
  }));

  const status =
    match.mode === "room"
      ? resolveRoom(states, roundsPlayed)
      : resolveDuel(states, roundsPlayed);

  if (status.kind === "complete") {
    await finishMatch(ctx, match, toPlayerId(match, status.winnerId));
    return;
  }

  // Ran out of catalogue before anyone died — settle rather than stall.
  if (roundsPlayed >= match.trackIds.length) {
    const ranked = [...states].sort((a, b) => b.hp - a.hp || b.totalPoints - a.totalPoints);
    const decisive = ranked[1] === undefined || ranked[0].hp !== ranked[1].hp;
    await finishMatch(ctx, match, decisive ? toPlayerId(match, ranked[0].userId) : undefined);
    return;
  }

  if (status.kind === "sudden-death") {
    await startCountdown(ctx, match._id, roundsPlayed);
    await ctx.db.patch(match._id, { suddenDeath: true });
    return;
  }

  // A longer momentum beat every few rounds, which also announces the multiplier
  // stepping up.
  if (isMilestoneRound(match.currentRound, MILESTONE_EVERY_ROUNDS)) {
    await enterPhase(ctx, match._id, "milestone", { currentRound: roundsPlayed });
    return;
  }

  await startCountdown(ctx, match._id, roundsPlayed);
}

/**
 * Ends a match. Rating, XP and badges are applied by `progression.finalizeMatch`,
 * scheduled rather than inlined so the phase machine stays independent of the
 * progression rules.
 */
export async function finishMatch(
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
 * Ends the guessing phase early once every player has either solved or passed.
 *
 * The scheduled 30s transition still fires later and is harmlessly ignored, because
 * `advance` checks the phase it expects to be leaving.
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

  const players = await ctx.db
    .query("matchPlayers")
    .withIndex("by_match", (q) => q.eq("matchId", match._id))
    .collect();

  const everyoneDone = players.every(
    (player) =>
      solvers.has(String(player.userId)) || player.passedRound === match.currentRound,
  );

  if (!everyoneDone) return;

  await enterPhase(ctx, match._id, "reveal");
}

/**
 * Client-callable nudge for a match whose scheduled transition never landed.
 *
 * Only acts once the deadline has genuinely passed, so it cannot be used to rush an
 * opponent.
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
      expectedRound: match.currentRound,
    });
    return { nudged: true as const };
  },
});
