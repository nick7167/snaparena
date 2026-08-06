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
// Cyclic with draft.ts, which imports `enterPhase` from here. Safe and already the shape
// this module has with bots.ts: every use is inside a handler, never at module scope.
import { startDuelIfDraftDone } from "./draft";

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

/**
 * Padding on every watchdog re-arm.
 *
 * Must be greater than zero: a deadline landing exactly on `now` would otherwise schedule
 * the next check for zero milliseconds' time, and the chain would spin.
 */
const WATCHDOG_SLACK_MS = 1_000;

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
    const hasBot = match ? await matchHasBot(ctx, match) : false;

    if (phase === "veto") {
      if (hasBot) {
        await ctx.scheduler.runAfter(0, internal.bots.draftTurn, { matchId });
      }
      /**
       * Armed for EVERY draft, bot or not — this is the phase's only server-side clock.
       *
       * The draft has no `phaseEndsAt` (see `durationFor`), so the generic `advance` timer
       * below is never scheduled for it, and `nudge` refuses to act on a phase with no
       * deadline. That left the exits entirely in the hands of the two clients: a ban, or
       * the `expireVeto` poll running in an open browser tab. Two humans who both closed
       * or backgrounded their tab mid-draft hung the match permanently — and because the
       * draft runs under `status: "veto"`, the forfeit sweep would not touch it either,
       * so neither player could even leave. Both were routed straight back into the dead
       * match on every reload, forever.
       *
       * Not gated on the absence of a bot, deliberately. `bots.draftTurn` is itself a
       * self-scheduling chain, and a broken chain is exactly what a watchdog is for.
       * Both paths converge on the same idempotent `startDuelIfDraftDone`, so the overlap
       * costs a handful of no-op calls and buys independence.
       */
      await ctx.scheduler.runAfter(
        VETO_PHASE_MS + WATCHDOG_SLACK_MS,
        internal.phases.draftWatchdog,
        { matchId },
      );
    } else if (match && hasBot) {
      if (phase === "guessing") {
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

/**
 * Closes a draft that nobody is driving.
 *
 * The draft is the one phase with no `phaseEndsAt`, because it waits on player input rather
 * than a clock — which meant it had no server-side timer at all, and every way out of it
 * ran through a live client. That is fine until both clients go away, at which point the
 * match is stuck in `phase: "veto"` with no timer to move it, no `nudge` that will touch it
 * (it bails on a missing deadline) and no forfeit sweep that applies (that requires
 * `status: "active"`, and the draft is `"veto"`). Permanently. `ranked.activeMatch` then
 * routes both players back into the corpse on every reload.
 *
 * Re-arms to the CURRENT deadline rather than polling, because `placeBan` pushes
 * `vetoDeadline` out on every ban — so a single timer armed at phase entry would fire
 * mid-draft, find the deadline moved, and leave nothing scheduled at all. Tracking the
 * field instead costs about five scheduled calls for a whole draft rather than one every
 * 600ms, and is automatically right whenever a ban moves it.
 *
 * Deliberately does NOT decide anything itself: expiry semantics — an idle player forfeits
 * their remaining bans and the duel starts with what was placed — already live in
 * `startDuelIfDraftDone`, which is also what the bot path and the client poll call. One
 * decision, one place.
 */
export const draftWatchdog = internalMutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return;
    // The draft is over, by any route. Nothing to watch, so the chain ends here.
    if (match.phase !== "veto") return;
    if (match.status === "complete" || match.status === "abandoned") return;

    /**
     * `leaveVsReveal` is the only way into this phase and always stamps a deadline, so
     * this should be unreachable. Handled anyway: a draft with no deadline can never
     * expire, and a watchdog that gives up on the one state it exists for is not a
     * watchdog.
     */
    if (match.vetoDeadline === undefined) {
      await ctx.db.patch(args.matchId, { vetoDeadline: Date.now() + VETO_PHASE_MS });
      await ctx.scheduler.runAfter(
        VETO_PHASE_MS + WATCHDOG_SLACK_MS,
        internal.phases.draftWatchdog,
        args,
      );
      return;
    }

    if (Date.now() >= match.vetoDeadline) {
      await startDuelIfDraftDone(ctx, args.matchId);
      return;
    }

    await ctx.scheduler.runAfter(
      match.vetoDeadline - Date.now() + WATCHDOG_SLACK_MS,
      internal.phases.draftWatchdog,
      args,
    );
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

      case "veto_reveal":
        await startCountdown(ctx, match._id, match.currentRound);
        return;

      case "countdown": {
        /**
         * Normally handled by `waitForReady`, which owns the transition into guessing.
         * This is the backstop for that chain having died.
         *
         * The gate is what makes it safe. `waitForReady` polls itself every 300ms and
         * gives up at READY_TIMEOUT_MS measured from the countdown's start, so for that
         * whole window a healthy chain is still working and acting here would race it —
         * starting the round before a slow client has buffered, which truncates the song
         * and is the exact bug that barrier exists to prevent. Past the window, a healthy
         * chain would provably have taken its own timeout branch and moved on, so still
         * being in `countdown` is proof it is dead. Entering guessing is then precisely
         * what that branch would have done.
         *
         * Cannot double-fire: the first rescue moves the phase, and every later call
         * bails on the `match.phase !== args.expectedPhase` guard above.
         */
        if (Date.now() < (match.phaseEndsAt ?? 0) + READY_TIMEOUT_MS) return;
        await enterPhase(ctx, match._id, "guessing");
        return;
      }

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

  /**
   * An independent backstop for the readiness chain armed above.
   *
   * That chain is a single self-rescheduling thread, and until now it was the only thing
   * that could ever leave the countdown — `advance` treated the phase as a no-op, so if
   * the chain died the match froze on "GO" forever while both clients nudged a mutation
   * that did nothing. `enterPhase` does schedule an `advance` at the countdown's own three
   * seconds, but that one lands far too early to act (see the guard in `advance`).
   *
   * This lands after the readiness barrier's hard stop, so it only ever fires against a
   * countdown that is genuinely stuck — and unlike a client nudge it does not need anyone
   * to still be watching. On the healthy path it finds the match already in `guessing` and
   * no-ops at the phase guard.
   */
  await ctx.scheduler.runAfter(
    PHASE_DURATIONS_MS.countdown + READY_TIMEOUT_MS + WATCHDOG_SLACK_MS,
    internal.phases.advance,
    { matchId, expectedPhase: "countdown", expectedRound: roundIndex },
  );
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
