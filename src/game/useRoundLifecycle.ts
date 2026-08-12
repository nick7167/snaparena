"use client";

import { useEffect, useRef } from "react";
import { useReducer as useStdbReducer } from "spacetimedb/react";
import { reducers } from "@/module_bindings";
import type { useRoundAudio } from "./useRoundAudio";
import { useOnForeground } from "./usePageLifecycle";

/**
 * The client half of the round protocol, shared by the duel and the daily.
 *
 * Extracted when the daily got its own runner. All four of these are easy to get
 * subtly wrong and none of them are visible when they break — a missed `reportReady`
 * stalls the match until the ready timeout, a missed prefetch truncates the clip, a
 * missed nudge hangs a match whose scheduled transition never landed. Two copies would
 * have drifted, and the drift would have shown up as "the daily sometimes cuts off".
 *
 * Deliberately owns no rendering and no game state. It reports, it plays, it buffers,
 * it nudges — the server still decides every transition.
 */
export function useRoundLifecycle({
  matchId,
  currentRound,
  phaseEndsAt,
  isGuessing,
  nextAudioUrl,
  audio,
  onRoundStart,
}: {
  matchId: bigint;
  currentRound: number | undefined;
  phaseEndsAt: number | null | undefined;
  isGuessing: boolean;
  /** The following round's clip, buffered during the between-round beats. */
  nextAudioUrl: string | null;
  audio: ReturnType<typeof useRoundAudio>;
  onRoundStart?: () => void;
}): void {
  const reportReady = useStdbReducer(reducers.reportReady);
  const nudge = useStdbReducer(reducers.nudge);

  const startedRoundRef = useRef<string | null>(null);
  const reportedRoundRef = useRef<string | null>(null);

  const { ready: audioReady, started: audioStarted, start: startAudio, stop: stopAudio } = audio;

  // Held in a ref so a caller passing an inline arrow does not re-arm the effect on
  // every render and restart the clip mid-round.
  const onRoundStartRef = useRef(onRoundStart);
  useEffect(() => {
    onRoundStartRef.current = onRoundStart;
  });

  /**
   * Tell the server this client is buffered. The guessing clock does not start until
   * every player has reported, which is what stops a slow connection producing a song
   * that cuts off mid-play.
   */
  useEffect(() => {
    if (currentRound === undefined || !audioReady) return;
    const key = `${matchId}:${currentRound}`;
    if (reportedRoundRef.current === key) return;

    reportedRoundRef.current = key;
    void reportReady({ matchId, roundIndex: currentRound });
  }, [audioReady, currentRound, matchId, reportReady]);

  /**
   * Starts the round's audio once the server has opened the round and the clip is buffered.
   *
   * The guard exists to stop a RUNNING round being restarted — which would reset its
   * clock — and not to make a single failed attempt terminal. It used to do both, because
   * it was set before the attempt and never cleared: one blocked `play()` and the round
   * could never start again, so the clock sat at a frozen 30.0 with the guess field live
   * and every submission rejected by the timing check. Re-entry stays open for exactly as
   * long as playback has never actually begun.
   */
  useEffect(() => {
    if (!isGuessing || !audioReady) return;
    const key = `${matchId}:${currentRound}`;
    const isNewRound = startedRoundRef.current !== key;
    if (!isNewRound && audioStarted) return;

    startedRoundRef.current = key;
    // Only on a genuinely new round. This clears the feedback line, and re-firing it on a
    // recovery would wipe the message explaining why the last guess was refused.
    if (isNewRound) onRoundStartRef.current?.();
    void startAudio();
  }, [isGuessing, audioReady, audioStarted, startAudio, matchId, currentRound]);

  useEffect(() => {
    if (!isGuessing) stopAudio();
  }, [isGuessing, stopAudio]);

  /**
   * Buffers the next clip ahead of time.
   *
   * The bytes land in the HTTP cache, so when the real audio element requests the same
   * URL a moment later it is already there. Without this the client only learns the URL
   * when the 3s countdown starts, which is rarely enough time for ~1MB.
   */
  useEffect(() => {
    if (!nextAudioUrl) return;
    const element = new Audio();
    element.preload = "auto";
    element.crossOrigin = "anonymous";
    element.src = nextAudioUrl;
    element.load();
    return () => {
      element.src = "";
    };
  }, [nextAudioUrl]);

  // Recovery only: acts once a server deadline has genuinely passed.
  useEffect(() => {
    if (!phaseEndsAt) return;
    const id = setInterval(() => {
      if (Date.now() > phaseEndsAt + 1_500) void nudge({ matchId });
    }, 2_000);
    return () => clearInterval(id);
  }, [phaseEndsAt, nudge, matchId]);

  /**
   * The same recovery, without waiting for the next tick of an interval that was frozen.
   *
   * A hidden tab stops timers entirely, so a player coming back to an overdue phase would
   * otherwise sit through up to another two seconds of a match that has already stalled —
   * on top of however long they were away. Guarded identically to the interval, so this
   * still cannot be used to hurry an opponent along.
   */
  useOnForeground(() => {
    if (!phaseEndsAt) return;
    if (Date.now() > phaseEndsAt + 1_500) void nudge({ matchId });
  });
}

/** Shared rejection copy, so the duel and the daily explain a refusal identically. */
export function rejectionMessage(reason: string): string {
  switch (reason) {
    case "locked-out":
      return "Too fast — wait for the lockout";
    case "already-solved":
      return "You already got this one";
    case "too-many-attempts":
      return "No attempts left this round";
    case "not-guessing-phase":
      return "The round has closed";
    case "below-human-floor":
    case "exceeds-server-window":
    case "not-monotonic":
      return "Rejected by the timing check";
    case "stale-round":
      return "The round moved on";
    // Distinct from "stale-round": the round did not move on, it ran out while nobody was
    // here to close it. Says so plainly rather than implying the guess was mistimed.
    case "round-expired":
      return "This round ran out while you were away";
    default:
      return "Guess rejected";
  }
}
