"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { useRoundAudio } from "./useRoundAudio";

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
  guestToken,
  onRoundStart,
}: {
  matchId: Id<"matches">;
  currentRound: number | undefined;
  phaseEndsAt: number | null | undefined;
  isGuessing: boolean;
  /** The following round's clip, buffered during the between-round beats. */
  nextAudioUrl: string | null;
  audio: ReturnType<typeof useRoundAudio>;
  guestToken: string | undefined;
  onRoundStart?: () => void;
}): void {
  const reportReady = useMutation(api.matches.reportReady);
  const nudge = useMutation(api.phases.nudge);

  const startedRoundRef = useRef<string | null>(null);
  const reportedRoundRef = useRef<string | null>(null);

  const { ready: audioReady, start: startAudio, stop: stopAudio } = audio;

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
    void reportReady({ matchId, roundIndex: currentRound, guestToken });
  }, [audioReady, currentRound, matchId, reportReady, guestToken]);

  useEffect(() => {
    if (!isGuessing || !audioReady) return;
    const key = `${matchId}:${currentRound}`;
    if (startedRoundRef.current === key) return;

    startedRoundRef.current = key;
    onRoundStartRef.current?.();
    void startAudio();
  }, [isGuessing, audioReady, startAudio, matchId, currentRound]);

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
    default:
      return "Guess rejected";
  }
}
