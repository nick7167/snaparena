import { ScheduleAt, type Timestamp } from "spacetimedb";
import { t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { ReducerCtx } from "./ctx";
import { microsFrom, timestampFrom, toMs } from "./lib";
import { resolveConfig } from "./config";
import { difficultyTierForElo, pickTracksForMatch } from "./catalogue";
import { MAX_DUEL_ROUNDS, STARTING_ELO, type MatchPhase } from "../../src/engine/config";
import type { ResolvedConfig } from "../../src/engine/config-merge";
import {
  damageMultiplier,
  duelDamage,
  isMilestoneRound,
  resolveDuel,
  resolveRoom,
  roomDamage,
  type DuelPlayerState,
  type RoundScore,
} from "../../src/engine/duel";

/**
 * Server-driven phase machine.
 *
 * Both players must see identical beats — a reveal that lands a second apart ruins
 * the head-to-head moment — so the SERVER owns the clock. Each phase schedules its
 * own successor, which means no client polling and no drift between opponents.
 *
 * Every transition is guarded on the state it expects to be leaving. A scheduled
 * job that fires late, or twice, against a match that has already moved on is a
 * no-op rather than a skipped round. That discipline is carried over verbatim from
 * the Convex original, and it is the reason nothing here needs to cancel a timer:
 * stale ones land harmlessly.
 *
 * WHAT IS NEW HERE is `round_reveal`. Convex could withhold the current track
 * because `matches.state` chose what to return; a subscription cannot. So this
 * module writes what a player is allowed to know, when they are allowed to know it:
 * the clip's URL when the round is dispatched, and the song's identity only once
 * guessing has closed. See `openRound` and `revealRound`.
 */

const WATCHDOG_SLACK_MS = 1_000;

function durationFor(phase: MatchPhase, config: ResolvedConfig): number | null {
  const durations = config.PHASE_DURATIONS_MS;
  return phase in durations ? durations[phase as keyof typeof durations] : null;
}

type MatchRow = NonNullable<ReturnType<ReducerCtx["db"]["match"]["id"]["find"]>>;

// ---------------------------------------------------------------------------
// The reveal boundary
// ---------------------------------------------------------------------------

/**
 * Publishes the audio for a round, and nothing else.
 *
 * This is the anti-cheat boundary in one function. The client needs the clip in
 * order to buffer and play it, and needs nothing else in order to guess — so the
 * row created here carries `previewUrl` and leaves every identifying field unset.
 * The track's title, artist and artwork are not written until `revealRound`.
 *
 * Idempotent: re-entering a phase for the same round updates the existing row
 * rather than adding a second one, so a rescued transition cannot duplicate a
 * round's audio.
 */
function openRound(ctx: ReducerCtx, match: MatchRow, roundIndex: number): void {
  const setlist = ctx.db.match_track.by_match_round.filter([match.id, roundIndex]);
  const entry = [...setlist][0];
  if (!entry) return;

  const track = ctx.db.track.id.find(entry.trackId);
  if (!track) return;

  const existing = [...ctx.db.round_reveal.by_match_round.filter([match.id, roundIndex])][0];
  if (existing) {
    ctx.db.round_reveal.id.update({ ...existing, previewUrl: track.previewUrl });
    return;
  }

  ctx.db.round_reveal.insert({
    id: 0n,
    matchId: match.id,
    roundIndex,
    previewUrl: track.previewUrl,
    title: undefined,
    artist: undefined,
    artworkUrl: undefined,
    categoryName: undefined,
    revealedAt: undefined,
  });
}

/**
 * Fills in what the song actually was. Called when guessing closes, never before.
 *
 * Everything the UI shows at the reveal beat becomes readable in one row update, so
 * both clients learn it in the same transaction and cannot disagree about when the
 * answer appeared.
 */
function revealRound(ctx: ReducerCtx, match: MatchRow, roundIndex: number): void {
  const entry = [...ctx.db.match_track.by_match_round.filter([match.id, roundIndex])][0];
  if (!entry) return;

  const track = ctx.db.track.id.find(entry.trackId);
  if (!track) return;

  const row = [...ctx.db.round_reveal.by_match_round.filter([match.id, roundIndex])][0];
  if (!row) return;

  const firstCategory = track.categoryIds[0];
  const category = firstCategory === undefined ? null : ctx.db.category.id.find(firstCategory);

  ctx.db.round_reveal.id.update({
    ...row,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artworkUrl,
    categoryName: category?.name,
    revealedAt: ctx.timestamp,
  });
}

/** The track a round is being played on. Reducers only — never leaves the module. */
export function trackForRound(
  ctx: ReducerCtx,
  matchId: bigint,
  roundIndex: number,
): bigint | undefined {
  return [...ctx.db.match_track.by_match_round.filter([matchId, roundIndex])][0]?.trackId;
}

// ---------------------------------------------------------------------------
// Entering phases
// ---------------------------------------------------------------------------

/**
 * Moves a match into a phase and schedules the follow-up transition.
 *
 * `match_end` and `veto` are terminal here: the former ends the match, the latter
 * waits on player input rather than on a timer.
 *
 * The config is read from the MATCH, not from what is current. Every timer in a duel
 * is scheduled here, so resolving the live config would let a save between two rounds
 * change how long the next one lasts while the clients are already counting down
 * against the old figure.
 */
export function enterPhase(
  ctx: ReducerCtx,
  matchId: bigint,
  phase: MatchPhase,
  patch: Partial<MatchRow> = {},
): void {
  const existing = ctx.db.match.id.find(matchId);
  if (!existing) return;

  const config = resolveConfig(ctx, existing.configVersionId);
  const duration = durationFor(phase, config);

  const updated = {
    ...existing,
    ...patch,
    phase,
    phaseEndsAt: duration === null ? undefined : timestampFrom(ctx.timestamp, duration),
    ...(phase === "guessing" ? { roundStartedAt: ctx.timestamp } : {}),
  } as MatchRow;

  ctx.db.match.id.update(updated);

  // Bots plan their whole round the moment guessing opens and take their draft
  // turns the moment the draft opens. This is the only place those phases are ever
  // entered, so scheduling here cannot be missed.
  if (phase === "veto" || phase === "guessing" || phase === "vs_reveal") {
    scheduleBotWork(ctx, updated, phase, config);
  }

  if (duration === null) return;

  // Bound the timer to the round we just committed, so it cannot fire against a
  // later round that happens to share this phase name. Solving early jumps to the
  // reveal while the old guessing timer stays armed; without the round in the
  // guard it would land on the NEXT round's guessing phase and kill it mid-song.
  ctx.db.phase_advance_schedule.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.time(microsFrom(ctx.timestamp, duration)),
    matchId,
    expectedPhase: phase,
    expectedRound: updated.currentRound,
  });
}

/**
 * Arms the bot side of a phase, and the draft's watchdog.
 *
 * The watchdog is armed for EVERY draft, bot or not, because the draft has no
 * `phaseEndsAt` and therefore no generic timer. Without it the exits were entirely
 * in the hands of two clients: two humans who both closed their tab mid-draft hung
 * the match permanently, and because a draft runs under `status: "veto"` the
 * forfeit sweep would not touch it either — both players were routed back into the
 * dead match on every reload, forever.
 */
function scheduleBotWork(
  ctx: ReducerCtx,
  match: MatchRow,
  phase: MatchPhase,
  config: ResolvedConfig,
): void {
  const hasBot = match.playerIds.some((id) => ctx.db.user.id.find(id)?.isBot === true);

  if (phase === "veto") {
    if (hasBot) queueBotAction(ctx, match.id, 0n, "draft_turn", 0, match.banTurn, 0);
    ctx.db.draft_watchdog_schedule.insert({
      scheduled_id: 0n,
      scheduled_at: ScheduleAt.time(
        microsFrom(ctx.timestamp, config.VETO_PHASE_MS + WATCHDOG_SLACK_MS),
      ),
      matchId: match.id,
    });
    return;
  }

  if (!hasBot) return;

  if (phase === "guessing") {
    for (const id of match.playerIds) {
      if (ctx.db.user.id.find(id)?.isBot) {
        queueBotAction(ctx, match.id, id, "plan_round", match.currentRound, 0, 0);
      }
    }
    return;
  }

  // A bot cannot press Ready, and `markVsReady` only runs the "is everyone in"
  // check when a human calls it — so a bot-vs-bot duel, which the dev rank bots
  // make possible, would stall for the full reveal with nobody watching.
  queueBotAction(ctx, match.id, 0n, "skip_vs", 0, 0, 0);
}

/** Inserts one planned bot action. The bot module owns what each kind does. */
export function queueBotAction(
  ctx: ReducerCtx,
  matchId: bigint,
  userId: bigint,
  kind: string,
  roundIndex: number,
  expectedTurn: number,
  delayMs: number,
  text = "",
  clientElapsedMs = 0,
): void {
  ctx.db.bot_action_schedule.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.time(microsFrom(ctx.timestamp, delayMs)),
    matchId,
    userId,
    kind,
    roundIndex,
    expectedTurn,
    text,
    clientElapsedMs,
  });
}

/**
 * Enters the countdown and arms the audio barrier.
 *
 * `openRound` runs here rather than at `guessing`, so the clip is fetchable while
 * the countdown is on screen — that head start is exactly what the barrier below
 * then waits on.
 */
export function startCountdown(ctx: ReducerCtx, matchId: bigint, roundIndex: number): void {
  const match = ctx.db.match.id.find(matchId);
  if (!match) return;

  const withRound = { ...match, currentRound: roundIndex } as MatchRow;
  openRound(ctx, withRound, roundIndex);

  enterPhase(ctx, matchId, "countdown", { currentRound: roundIndex });

  ctx.db.ready_wait_schedule.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.time(microsFrom(ctx.timestamp, 0)),
    matchId,
    roundIndex,
    startedWaitingAt: ctx.timestamp,
  });
}

// ---------------------------------------------------------------------------
// Scheduled transitions
// ---------------------------------------------------------------------------

/**
 * The audio-buffer barrier.
 *
 * The guessing clock does not start until every human has reported the round
 * buffered, which is what stops a slow connection producing a truncated song. Polls
 * itself rather than waiting on a signal, because the thing it waits for is a
 * client write that may never arrive.
 */
export function runWaitForReady(
  ctx: ReducerCtx,
  row: { matchId: bigint; roundIndex: number; startedWaitingAt: Timestamp },
): void {
  const match = ctx.db.match.id.find(row.matchId);
  if (!match) return;
  if (match.phase !== "countdown") return;
  if (match.currentRound !== row.roundIndex) return;

  const config = resolveConfig(ctx, match.configVersionId);
  const waited = toMs(ctx.timestamp) - toMs(row.startedWaitingAt);

  const humans = [...ctx.db.match_player.matchId.filter(match.id)].filter(
    (p) => ctx.db.user.id.find(p.userId)?.isBot !== true,
  );
  const everyoneBuffered = humans.every((p) => p.readyForRound >= row.roundIndex);

  if (everyoneBuffered || waited >= config.READY_TIMEOUT_MS) {
    enterPhase(ctx, match.id, "guessing");
    return;
  }

  ctx.db.ready_wait_schedule.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.time(microsFrom(ctx.timestamp, 300)),
    matchId: row.matchId,
    roundIndex: row.roundIndex,
    startedWaitingAt: row.startedWaitingAt,
  });
}

/**
 * The generic timed transition.
 *
 * Guarded on the phase AND the round. Guarding on the phase name alone was a real
 * bug: solving a round early jumps straight to the reveal, but that round's guessing
 * timer stays armed and later fires against the next round — which is also called
 * "guessing" — killing it mid-song. Round 1 always looked fine because it is the
 * first round to leave a stale timer behind.
 */
export function runAdvancePhase(
  ctx: ReducerCtx,
  row: { matchId: bigint; expectedPhase: string; expectedRound: number },
): void {
  const match = ctx.db.match.id.find(row.matchId);
  if (!match) return;
  if (match.phase !== row.expectedPhase) return;
  if (match.currentRound !== row.expectedRound) return;
  if (match.status === "complete" || match.status === "abandoned") return;

  switch (match.phase) {
    case "vs_reveal":
      leaveVsReveal(ctx, match);
      return;

    case "veto_reveal":
      startCountdown(ctx, match.id, match.currentRound);
      return;

    case "countdown": {
      /**
       * Normally `waitForReady` owns this transition; this is the backstop for that
       * chain having died.
       *
       * The gate is what makes it safe. The barrier polls every 300ms and gives up
       * at READY_TIMEOUT_MS measured from the countdown's start, so for that whole
       * window a healthy chain is still working and acting here would race it —
       * starting the round before a slow client has buffered, which truncates the
       * song and is the exact bug the barrier exists to prevent. Past the window a
       * healthy chain would provably have taken its own timeout branch, so still
       * being in `countdown` is proof it is dead.
       */
      const config = resolveConfig(ctx, match.configVersionId);
      const endsAt = match.phaseEndsAt ? toMs(match.phaseEndsAt) : 0;
      if (toMs(ctx.timestamp) < endsAt + config.READY_TIMEOUT_MS) return;
      enterPhase(ctx, match.id, "guessing");
      return;
    }

    case "guessing":
      closeGuessing(ctx, match);
      return;

    case "reveal":
      applyRoundDamage(ctx, match);
      return;

    case "standings":
      continueOrFinish(ctx, match);
      return;

    case "milestone":
      startCountdown(ctx, match.id, match.currentRound);
      return;

    default:
      return;
  }
}

/** Closes guessing and publishes the answer, in one transaction. */
function closeGuessing(ctx: ReducerCtx, match: MatchRow): void {
  revealRound(ctx, match, match.currentRound);
  enterPhase(ctx, match.id, "reveal");
}

/**
 * Ends guessing early once every player has solved or passed.
 *
 * The scheduled transition still fires later and is harmlessly ignored, because
 * `runAdvancePhase` checks the phase it expects to be leaving.
 */
export function endGuessingEarly(ctx: ReducerCtx, match: MatchRow): void {
  if (match.phase !== "guessing") return;

  const players = [...ctx.db.match_player.matchId.filter(match.id)];
  const everyoneDone = players.every((player) => {
    const result = [
      ...ctx.db.round_result.by_match_round_user.filter([
        match.id,
        match.currentRound,
        player.userId,
      ]),
    ][0];
    return result !== undefined && (result.solved || result.passed);
  });

  if (!everyoneDone) return;
  closeGuessing(ctx, match);
}

/** Into the draft if a veto pool exists, else straight to the countdown. */
export function leaveVsReveal(ctx: ReducerCtx, match: MatchRow): void {
  if (match.vetoPoolIds.length > 0) {
    enterPhase(ctx, match.id, "veto");
    return;
  }
  startCountdown(ctx, match.id, match.currentRound);
}

// ---------------------------------------------------------------------------
// Round resolution
// ---------------------------------------------------------------------------

/** Per-player scores for the round, in the shape the duel engine consumes. */
function roundScores(ctx: ReducerCtx, match: MatchRow, config: ResolvedConfig): RoundScore[] {
  return match.playerIds.map((userId) => {
    const result = [
      ...ctx.db.round_result.by_match_round_user.filter([match.id, match.currentRound, userId]),
    ][0];

    return {
      userId: String(userId),
      points: result?.points ?? 0,
      // Unsolved contributes the full round, so failing to answer never ranks
      // above answering slowly.
      elapsedMs: result?.solved ? (result.elapsedMs ?? config.ROUND_DURATION_MS) : config.ROUND_DURATION_MS,
    };
  });
}

/** Maps an engine-side stringified id back onto a player in this match. */
function toPlayerId(match: MatchRow, raw: string | undefined): bigint | undefined {
  if (raw === undefined) return undefined;
  return match.playerIds.find((id) => String(id) === raw);
}

/**
 * Applies the round's damage and moves into the standings beat.
 *
 * The daily has no opponent and therefore no damage — it logs the round and goes
 * straight on. Standings exists to drain health bars and name a round winner, and a
 * solo run has neither; rendering it there once produced "THE SONG WINS · neither of
 * you got it" at a player with no opponent.
 */
function applyRoundDamage(ctx: ReducerCtx, match: MatchRow): void {
  const config = resolveConfig(ctx, match.configVersionId);
  const scores = roundScores(ctx, match, config);

  const results = match.playerIds.map((userId) => {
    const row = [
      ...ctx.db.round_result.by_match_round_user.filter([match.id, match.currentRound, userId]),
    ][0];
    return {
      userId,
      points: row?.points ?? 0,
      elapsedMs: row?.solved ? row.elapsedMs : undefined,
      solved: row?.solved ?? false,
    };
  });

  const resolution =
    match.mode === "daily"
      ? { outcome: "song" as const, winnerId: undefined, damage: [], timeGapMs: undefined }
      : match.mode === "room"
        ? roomDamage(scores, match.currentRound, config)
        : duelDamage(scores, match.currentRound, config);

  const applied: { userId: bigint; damage: number; hpAfter: number }[] = [];

  for (const entry of resolution.damage) {
    const userId = toPlayerId(match, entry.userId);
    if (userId === undefined) continue;

    const player = [...ctx.db.match_player.by_match_user.filter([match.id, userId])][0];
    if (!player) continue;

    // Eliminated players keep guessing for placing, but take no further damage.
    const alreadyOut = player.eliminatedAtRound !== undefined;
    const hpBefore = player.hp;
    const hpAfter = alreadyOut ? hpBefore : Math.max(0, hpBefore - entry.damage);

    ctx.db.match_player.id.update({
      ...player,
      hp: hpAfter,
      lowestHp: Math.min(player.lowestHp, hpAfter),
      eliminatedAtRound:
        hpAfter === 0 && !alreadyOut ? match.currentRound : player.eliminatedAtRound,
    });

    applied.push({ userId, damage: alreadyOut ? 0 : entry.damage, hpAfter });
  }

  ctx.db.round_log.insert({
    id: 0n,
    matchId: match.id,
    roundIndex: match.currentRound,
    entry: {
      roundIndex: match.currentRound,
      outcome: resolution.outcome,
      winnerId: toPlayerId(match, resolution.winnerId),
      timeGapMs: resolution.timeGapMs,
      multiplier: damageMultiplier(match.currentRound, config),
      damage: applied,
      results,
    },
  });

  if (match.mode === "daily") {
    const refreshed = ctx.db.match.id.find(match.id);
    if (refreshed) continueOrFinish(ctx, refreshed);
    return;
  }

  enterPhase(ctx, match.id, "standings");
}

/** Decides after the standings beat whether the match continues, and to which phase. */
function continueOrFinish(ctx: ReducerCtx, match: MatchRow): void {
  const config = resolveConfig(ctx, match.configVersionId);
  const roundsPlayed = match.currentRound + 1;

  if (match.mode === "daily") {
    if (roundsPlayed >= match.totalRounds) {
      finishMatch(ctx, match, undefined);
      return;
    }
    startCountdown(ctx, match.id, roundsPlayed);
    return;
  }

  const players = [...ctx.db.match_player.matchId.filter(match.id)];
  const states: DuelPlayerState[] = players.map((player) => ({
    userId: String(player.userId),
    hp: player.hp,
    totalPoints: player.totalPoints,
    eliminatedAtRound: player.eliminatedAtRound ?? null,
  }));

  const status =
    match.mode === "room"
      ? resolveRoom(states, roundsPlayed, config)
      : resolveDuel(states, roundsPlayed, config);

  if (status.kind === "complete") {
    finishMatch(ctx, match, toPlayerId(match, status.winnerId));
    return;
  }

  // Ran out of catalogue before anyone died — settle rather than stall.
  if (roundsPlayed >= match.totalRounds) {
    const ranked = [...states].sort((a, b) => b.hp - a.hp || b.totalPoints - a.totalPoints);
    const decisive = ranked[1] === undefined || ranked[0].hp !== ranked[1].hp;
    finishMatch(ctx, match, decisive ? toPlayerId(match, ranked[0].userId) : undefined);
    return;
  }

  if (status.kind === "sudden-death") {
    ctx.db.match.id.update({ ...match, suddenDeath: true });
    startCountdown(ctx, match.id, roundsPlayed);
    return;
  }

  // A longer momentum beat every few rounds, which also announces the multiplier
  // stepping up.
  if (isMilestoneRound(match.currentRound, config.MILESTONE_EVERY_ROUNDS)) {
    enterPhase(ctx, match.id, "milestone", { currentRound: roundsPlayed });
    return;
  }

  startCountdown(ctx, match.id, roundsPlayed);
}

/**
 * Ends a match.
 *
 * Rating, XP and badges are applied by the progression module, scheduled rather than
 * inlined so the phase machine stays independent of the progression rules.
 */
export function finishMatch(
  ctx: ReducerCtx,
  match: MatchRow,
  winnerId: bigint | undefined,
): void {
  ctx.db.match.id.update({
    ...match,
    status: "complete",
    phase: "match_end",
    phaseEndsAt: undefined,
    winnerId,
    completedAt: ctx.timestamp,
  });

  ctx.db.finalize_schedule.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.time(microsFrom(ctx.timestamp, 0)),
    matchId: match.id,
  });
}

/**
 * Closes a draft nobody is driving.
 *
 * Re-arms to the CURRENT deadline rather than polling: a ban pushes the deadline
 * out, and re-arming to wherever it now sits costs one row instead of a tick.
 */
export function runDraftWatchdog(ctx: ReducerCtx, row: { matchId: bigint }): void {
  const match = ctx.db.match.id.find(row.matchId);
  if (!match) return;
  if (match.phase !== "veto") return;

  const deadline = match.vetoDeadline ? toMs(match.vetoDeadline) : 0;
  if (toMs(ctx.timestamp) < deadline) {
    ctx.db.draft_watchdog_schedule.insert({
      scheduled_id: 0n,
      scheduled_at: ScheduleAt.time(
        microsFrom(ctx.timestamp, deadline - toMs(ctx.timestamp) + WATCHDOG_SLACK_MS),
      ),
      matchId: row.matchId,
    });
    return;
  }

  closeDraft(ctx, match);
}

/**
 * Ends the draft and starts the duel. Idempotent — both the watchdog and the last
 * ban converge here, and the overlap costs a handful of no-op calls in exchange for
 * the two paths being independent.
 */
export function closeDraft(ctx: ReducerCtx, match: MatchRow): void {
  if (match.phase !== "veto") return;

  /**
   * Tracks are chosen HERE, not at match creation, and that is what makes the bans
   * mean anything: a banned category is banned because it never reaches this call.
   *
   * The previous version of this function moved straight to `veto_reveal` without
   * choosing any, so `match_track` was never written and `trackForRound` returned
   * undefined for every round of every match.
   */
  const ratings = match.playerIds.map(
    (id) => ctx.db.user.id.find(id)?.elo ?? STARTING_ELO,
  );
  const averageElo =
    ratings.reduce((sum, value) => sum + value, 0) / (ratings.length || 1);

  const trackIds = pickTracksForMatch(ctx, {
    targetTier: difficultyTierForElo(averageElo),
    bannedCategoryIds: match.bannedCategoryIds,
    count: MAX_DUEL_ROUNDS,
  });

  if (trackIds.length < MAX_DUEL_ROUNDS) {
    // Not enough catalogue to run the full distance — abandon rather than repeat
    // songs, which would let a player who already heard one score for free.
    ctx.db.match.id.update({
      ...match,
      status: "abandoned",
      phase: "match_end",
      phaseEndsAt: undefined,
    });
    return;
  }

  trackIds.forEach((trackId, roundIndex) => {
    ctx.db.match_track.insert({
      id: 0n,
      matchId: match.id,
      roundIndex,
      trackId,
    });
  });

  ctx.db.match.id.update({ ...match, status: "active", currentRound: 0 });

  /**
   * A beat to show what the draft produced, before the countdown takes over. The
   * tracks are already picked by the time we get here, so the reveal is showing a
   * settled fact rather than holding anything up.
   */
  enterPhase(ctx, match.id, "veto_reveal");
}

/**
 * Client-callable recovery for a transition that never landed.
 *
 * Only acts once `phaseEndsAt` has genuinely passed, so a client cannot use it to
 * skip a beat it is bored of.
 */
export const nudge = spacetimedb.reducer({ matchId: t.u64() }, (ctx, { matchId }) => {
  const match = ctx.db.match.id.find(matchId);
  if (!match) return;
  if (!match.phaseEndsAt) return;
  if (toMs(ctx.timestamp) < toMs(match.phaseEndsAt)) return;

  runAdvancePhase(ctx, {
    matchId,
    expectedPhase: match.phase,
    expectedRound: match.currentRound,
  });
});
