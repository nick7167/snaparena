import { t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { ReducerCtx, ViewCtx } from "./ctx";
import { timestampFrom, toMs } from "./lib";
import type { Timestamp } from "spacetimedb";
import { resolveConfig } from "./config";
import { endGuessingEarly, readyUpVsReveal, trackForRound } from "./phases";
import { requireSenderUser } from "./users";
import { checkGuess } from "../../src/engine/match";
import { normalizeTitle } from "../../src/engine/normalize";
import {
  roundHasExpired,
  scoreForGuess,
  validateClientClock,
} from "../../src/engine/scoring";

/**
 * The guess pipeline. The most contended path in the game, and the one where the
 * anti-cheat rules live.
 *
 * Reducers are serializable transactions, so two players submitting in the same
 * instant are ordered by the database rather than racing — the second transaction
 * observes the first one's write. That is what makes "first correct guess wins"
 * correct with no explicit locking, and it is the property the Convex backend was
 * chosen for in the first place. It survived the move unchanged, which is why none
 * of the logic below needed rethinking.
 *
 * Scoring uses the CLIENT's measured elapsed time rather than arrival order, so a
 * high-latency player is not structurally disadvantaged. That number is untrusted,
 * and `validateClientClock` bounds it from both directions before it can score.
 *
 * WHAT DID CHANGE is how the answer gets back. A Convex mutation returned
 * correct/wrong/rejected to its caller; a reducer returns nothing. So the verdict
 * travels as a row in the `guess_feedback` EVENT table — broadcast on commit,
 * never stored, and filtered to the player who made the guess. Meanwhile the
 * durable record splits in two: `guess` stays private because `rawText` is the
 * answer the moment anyone is right, and `round_result` carries the points and
 * reaction time both players are allowed to see.
 */

type MatchRow = NonNullable<ReturnType<ReducerCtx["db"]["match"]["id"]["find"]>>;

/** Publishes a one-shot verdict to the player who guessed, and nobody else. */
function emitFeedback(
  ctx: ReducerCtx,
  matchId: bigint,
  roundIndex: number,
  userId: bigint,
  outcome: string,
  points: number,
  rejectionReason?: string,
): void {
  ctx.db.guess_feedback.insert({
    matchId,
    roundIndex,
    userId,
    outcome,
    points,
    rejectionReason,
  });
}

/** The player's live scoring row for a round, created on first contact. */
function roundResultFor(ctx: ReducerCtx, matchId: bigint, roundIndex: number, userId: bigint) {
  const existing = [
    ...ctx.db.round_result.by_match_round_user.filter([matchId, roundIndex, userId]),
  ][0];
  if (existing) return existing;

  return ctx.db.round_result.insert({
    id: 0n,
    matchId,
    roundIndex,
    userId,
    points: 0,
    elapsedMs: undefined,
    solved: false,
    attempts: 0,
    lockedUntil: undefined,
    passed: false,
  });
}

/**
 * The authoritative guess pipeline, shared by humans and bots.
 *
 * Bots get no privileged write path: `runBotAction` routes through here exactly as
 * `submitGuess` does, so a bot is bound by the same attempt cap, the same lockout
 * and the same clock validation as a player. That was true in the Convex version
 * and is worth keeping true — a bot that could bypass the rules would make the
 * rules untestable.
 */
export function applyGuess(
  ctx: ReducerCtx,
  params: {
    matchId: bigint;
    roundIndex: number;
    userId: bigint;
    text: string;
    clientElapsedMs: number;
  },
): void {
  const { matchId, roundIndex, userId, text, clientElapsedMs } = params;
  const nowMs = toMs(ctx.timestamp);

  const match = ctx.db.match.id.find(matchId);
  if (!match) return;

  // Scored under the config the match STARTED with, so the curve cannot move mid-duel.
  const config = resolveConfig(ctx, match.configVersionId);

  const refuse = (reason: string) => {
    emitFeedback(ctx, matchId, roundIndex, userId, "rejected", 0, reason);
  };

  if (match.status !== "active") return refuse("match-not-active");
  // Guessing is only open during its own phase — a guess landing during the reveal
  // or the countdown must not score.
  if (match.phase !== "guessing") return refuse("not-guessing-phase");
  if (roundIndex !== match.currentRound) return refuse("stale-round");
  if (!match.playerIds.some((id) => id === userId)) return refuse("not-a-player");
  if (!match.roundStartedAt) return refuse("round-not-started");

  /**
   * The round is objectively over, whatever the client's clock says.
   *
   * `validateClientClock` cannot catch this on its own. It bounds a claim against
   * `now - roundStartedAt`, which only ever GROWS, so it rejects claiming to be
   * faster than the server's window and happily accepts a fresh clock reading 2s
   * against a window an hour wide. Hear a song, close the tab, come back later,
   * score a SNAP on a track you now know.
   *
   * Measured from the server's own clock, so leaving by any means is covered — the
   * exit button, the back button, a force quit, a dead battery.
   */
  if (roundHasExpired(nowMs - toMs(match.roundStartedAt), config)) {
    return refuse("round-expired");
  }

  const prior = [
    ...ctx.db.guess.by_match_round_user.filter([matchId, roundIndex, userId]),
  ];

  if (prior.some((g) => g.correct)) return refuse("already-solved");
  if (prior.length >= config.MAX_GUESSES_PER_ROUND) return refuse("too-many-attempts");

  const last = prior[prior.length - 1];
  if (last && nowMs < toMs(last.serverReceivedAt) + config.WRONG_GUESS_LOCKOUT_MS) {
    return refuse("locked-out");
  }

  const clock = validateClientClock(
    {
      clientElapsedMs,
      serverObservedElapsedMs: nowMs - toMs(match.roundStartedAt),
      previousClientElapsedMs: last?.clientElapsedMs,
    },
    config,
  );

  if (!clock.valid) {
    // Recorded even though it scored nothing: a rejected clock is the signal an
    // anti-cheat review would want, and dropping it would erase the evidence.
    ctx.db.guess.insert({
      id: 0n,
      matchId,
      roundIndex,
      userId,
      rawText: text,
      normalizedText: normalizeTitle(text),
      correct: false,
      clientElapsedMs,
      serverReceivedAt: ctx.timestamp,
      accepted: false,
      rejectionReason: clock.rejection,
      points: 0,
    });
    return refuse(clock.rejection ?? "invalid-clock");
  }

  const trackId = trackForRound(ctx, matchId, roundIndex);
  if (trackId === undefined) return refuse("no-such-track");

  const track = ctx.db.track.id.find(trackId);
  if (!track) return refuse("no-such-track");

  const aliases = [...ctx.db.track_alias.trackId.filter(trackId)].map(
    (alias) => alias.aliasNormalized,
  );

  const verdict = checkGuess(
    text,
    { titleNormalized: track.titleNormalized, aliasesNormalized: aliases },
    config,
  );

  const score = scoreForGuess(clock.elapsedMs, config);
  const points = verdict.correct ? score.points : 0;

  ctx.db.guess.insert({
    id: 0n,
    matchId,
    roundIndex,
    userId,
    rawText: text,
    normalizedText: verdict.normalizedGuess,
    correct: verdict.correct,
    clientElapsedMs: clock.elapsedMs,
    serverReceivedAt: ctx.timestamp,
    accepted: true,
    rejectionReason: undefined,
    points,
  });

  const result = roundResultFor(ctx, matchId, roundIndex, userId);

  if (!verdict.correct) {
    ctx.db.round_result.id.update({
      ...result,
      attempts: result.attempts + 1,
      lockedUntil: timestampFrom(ctx.timestamp, config.WRONG_GUESS_LOCKOUT_MS),
    });
    emitFeedback(ctx, matchId, roundIndex, userId, "wrong", 0);
    return;
  }

  ctx.db.round_result.id.update({
    ...result,
    points,
    elapsedMs: clock.elapsedMs,
    solved: true,
    attempts: result.attempts + 1,
    lockedUntil: undefined,
  });

  const player = [...ctx.db.match_player.by_match_user.filter([matchId, userId])][0];
  if (player) {
    ctx.db.match_player.id.update({
      ...player,
      totalPoints: player.totalPoints + points,
    });
  }

  emitFeedback(ctx, matchId, roundIndex, userId, "correct", points);

  // Everyone solved? Cut the round short rather than making them watch the clock.
  const refreshed = ctx.db.match.id.find(matchId);
  if (refreshed) endGuessingEarly(ctx, refreshed);
}

/**
 * Submits a guess.
 *
 * Takes no user id: `ctx.sender` is the caller and cannot be spoofed, which removes
 * the whole class of "guess as somebody else" that a client-supplied id invites.
 * The Convex version passed a guest token here for the daily; guests have real
 * identities now, so there is nothing to pass.
 */
export const submitGuess = spacetimedb.reducer(
  { matchId: t.u64(), roundIndex: t.i32(), text: t.string(), clientElapsedMs: t.f64() },
  (ctx, { matchId, roundIndex, text, clientElapsedMs }) => {
    const player = requireSenderUser(ctx);
    applyGuess(ctx, { matchId, roundIndex, userId: player.id, text, clientElapsedMs });
  },
);

/** Locks in zero for the round. May end guessing early if everyone is now done. */
export const passRound = spacetimedb.reducer(
  { matchId: t.u64(), roundIndex: t.i32() },
  (ctx, { matchId, roundIndex }) => {
    const player = requireSenderUser(ctx);

    const match = ctx.db.match.id.find(matchId);
    if (!match) return;
    if (match.phase !== "guessing") return;
    if (match.currentRound !== roundIndex) return;
    if (!match.playerIds.some((id) => id === player.id)) return;

    const result = roundResultFor(ctx, matchId, roundIndex, player.id);
    if (result.solved) return;

    ctx.db.round_result.id.update({ ...result, passed: true });
    endGuessingEarly(ctx, match);
  },
);

/**
 * Reports that this client has buffered the round's clip.
 *
 * Monotonic: the barrier waits for the highest round each client has reported, so a
 * late report for an earlier round cannot pull it backwards.
 */
export const reportReady = spacetimedb.reducer(
  { matchId: t.u64(), roundIndex: t.i32() },
  (ctx, { matchId, roundIndex }) => {
    const player = requireSenderUser(ctx);

    const row = [...ctx.db.match_player.by_match_user.filter([matchId, player.id])][0];
    if (!row) return;

    const match = ctx.db.match.id.find(matchId);

    /**
     * TWO SIGNALS FROM ONE PRESS, because the client sends one.
     *
     * `readyForRound` is the audio-buffer barrier: has this browser buffered the
     * clip. `vsReadyAt` is a statement of intent: I have read this screen and I want
     * to start. They are deliberately separate fields — see the schema — and the
     * opponent reveal is the moment both are true at once, since the client reports
     * readiness for round 0 by pressing the same button.
     *
     * Writing only the first is what made Ready appear dead: the reducer succeeded,
     * the field changed, and nothing in the reveal read it.
     */
    const inReveal = match?.phase === "vs_reveal";

    if (roundIndex <= row.readyForRound && !(inReveal && row.vsReadyAt === undefined)) {
      return;
    }

    ctx.db.match_player.id.update({
      ...row,
      readyForRound: Math.max(row.readyForRound, roundIndex),
      vsReadyAt: inReveal ? ctx.timestamp : row.vsReadyAt,
    });

    // Re-read: the update above is what may have completed the set.
    if (inReveal && match) {
      const refreshed = ctx.db.match.id.find(matchId);
      if (refreshed) readyUpVsReveal(ctx, refreshed);
    }
  },
);

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const RoundStatus = t.row("RoundStatus", {
  matchId: t.u64(),
  roundIndex: t.i32(),
  solved: t.bool(),
  attempts: t.i32(),
  attemptsRemaining: t.i32(),
  /**
   * When the wrong-guess lockout lifts, as an absolute time. None when not locked.
   *
   * Absolute rather than a remaining duration, because a VIEW HAS NO CLOCK: it is
   * recomputed when its read set changes, not on a timer, so a countdown computed
   * here would freeze at whatever it read on the last write. The client ticks it
   * down — the same split the Convex version used, which returned timestamps and
   * never durations for exactly this reason.
   */
  lockedUntil: t.option(t.timestamp()),
  pointsThisRound: t.f64(),
  passed: t.bool(),
});

/**
 * What the caller may do right now, for the round they are in.
 *
 * `matches.myRoundStatus` in the Convex backend. Per-caller by necessity: it is
 * derived from that player's own attempts, and showing one player another's
 * remaining tries would leak how close they are to answering.
 *
 * Reads `round_result` rather than the private `guess` table, so the view's read
 * set stays on rows the player already sees.
 */
export const myRoundStatus = spacetimedb.view(
  { name: "my_round_status", public: true },
  t.array(RoundStatus),
  (ctx: ViewCtx) => {
    const account = ctx.db.account.identity.find(ctx.sender);
    if (!account) return [];

    const out: {
      matchId: bigint;
      roundIndex: number;
      solved: boolean;
      attempts: number;
      attemptsRemaining: number;
      lockedUntil: Timestamp | undefined;
      pointsThisRound: number;
      passed: boolean;
    }[] = [];

    for (const player of ctx.db.match_player.userId.filter(account.userId)) {
      const match = ctx.db.match.id.find(player.matchId);
      if (!match) continue;
      if (match.status !== "active" && match.status !== "veto") continue;

      const config = resolveConfig(ctx, match.configVersionId);
      const result = [
        ...ctx.db.round_result.by_match_round_user.filter([
          match.id,
          match.currentRound,
          account.userId,
        ]),
      ][0];

      out.push({
        matchId: match.id,
        roundIndex: match.currentRound,
        solved: result?.solved ?? false,
        attempts: result?.attempts ?? 0,
        attemptsRemaining: Math.max(
          0,
          config.MAX_GUESSES_PER_ROUND - (result?.attempts ?? 0),
        ),
        lockedUntil: result?.lockedUntil,
        pointsThisRound: result?.points ?? 0,
        passed: result?.passed ?? false,
      });
    }

    return out;
  },
);
