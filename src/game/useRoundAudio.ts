"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REVEAL_BEATS, ROUND_DURATION_MS } from "@/engine/config";
import { revealStageAt } from "@/engine/scoring";
import { createAnalyser, type Analyser } from "@/audio/visualizer";

/**
 * Drives one round's audio and owns the authoritative-for-the-client score clock.
 *
 * The score clock is `performance.now()` anchored to the audio element's FIRST
 * `playing` event — not to a server signal, and not to `audio.currentTime`.
 *
 *  - Anchoring to a server signal would make network latency decide who wins.
 *  - `audio.currentTime` cannot be used because the clip replays from 0:00 at every
 *    reveal beat, so it resets several times per round and does not track round time.
 *
 * The value produced here is sent to the server, which bounds it from both sides
 * before allowing it to score (see validateClientClock).
 */

export type RoundPhase = "idle" | "loading" | "ready" | "playing" | "ended";

export interface UseRoundAudioResult {
  phase: RoundPhase;
  /** True once the clip is fully buffered — the barrier the round start waits on. */
  ready: boolean;
  /** Milliseconds since playback actually began. Feed this to the server. */
  elapsedMs: () => number;
  /** Index into REVEAL_BEATS, for UI. */
  revealStage: number;
  /** Live elapsed time for rendering. Updates each animation frame. */
  displayMs: number;
  error: string | null;
  /** Begins playback. Call only once both the local clip and the server are ready. */
  start: () => Promise<void>;
  /** Stops audio and freezes the clock. */
  stop: () => void;
  /**
   * Frequency analyser for the visualiser, or null when Web Audio is unavailable
   * or the track is CORS-tainted. Callers must degrade rather than fail.
   */
  analyser: Analyser | null;
}

export function useRoundAudio(previewUrl: string | null): UseRoundAudioResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const stageRef = useRef(0);

  const [phase, setPhase] = useState<RoundPhase>(previewUrl ? "loading" : "idle");
  const [displayMs, setDisplayMs] = useState(0);
  const [revealStage, setRevealStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState(previewUrl);
  const analyserRef = useRef<Analyser | null>(null);
  const [analyser, setAnalyser] = useState<Analyser | null>(null);

  // Reset for a new track during render rather than inside an effect. Calling
  // setState synchronously in an effect cascades an extra render; adjusting state
  // during render is React's sanctioned pattern for reacting to a changed prop.
  if (previewUrl !== loadedUrl) {
    setLoadedUrl(previewUrl);
    setPhase(previewUrl ? "loading" : "idle");
    setDisplayMs(0);
    setRevealStage(0);
    setError(null);
  }

  // --- load / preload -------------------------------------------------------
  useEffect(() => {
    startedAtRef.current = null;
    stageRef.current = 0;

    if (!previewUrl) return;

    const audio = new Audio();
    audio.preload = "auto";
    // Apple's preview CDN sends permissive CORS headers, so this is safe and
    // keeps the door open for Web Audio analysis later.
    audio.crossOrigin = "anonymous";
    audio.src = previewUrl;
    audioRef.current = audio;

    const onReady = () => setPhase((current) => (current === "loading" ? "ready" : current));
    const onError = () => {
      // A dead preview URL must void the round rather than penalise the player.
      setError("audio-unavailable");
      setPhase("ended");
    };

    audio.addEventListener("canplaythrough", onReady);
    audio.addEventListener("error", onError);
    audio.load();

    return () => {
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      analyserRef.current?.disconnect();
      analyserRef.current = null;
      setAnalyser(null);
    };
  }, [previewUrl]);

  // Cancel any in-flight frame when the hook unmounts.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const elapsedMs = useCallback(() => {
    if (startedAtRef.current === null) return 0;
    return performance.now() - startedAtRef.current;
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioRef.current?.pause();
    setPhase("ended");
  }, []);

  const start = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Attach the analyser on first play, not at load: an AudioContext created
    // before a user gesture starts suspended, and by here a gesture has happened.
    if (!analyserRef.current) {
      analyserRef.current = createAnalyser(audio);
      setAnalyser(analyserRef.current);
    }

    // Declared as a hoisted function so the animation loop can schedule itself
    // without the callback having to close over its own binding.
    function loop() {
      const element = audioRef.current;
      if (!element || startedAtRef.current === null) return;

      const elapsed = performance.now() - startedAtRef.current;
      setDisplayMs(elapsed);

      if (elapsed >= ROUND_DURATION_MS) {
        element.pause();
        setPhase("ended");
        rafRef.current = null;
        return;
      }

      const stage = revealStageAt(elapsed);
      const beat = REVEAL_BEATS[stage];

      if (stage !== stageRef.current) {
        // A new beat: replay from the top with more of the song unlocked.
        stageRef.current = stage;
        setRevealStage(stage);
        element.currentTime = 0;
        void element.play().catch(() => setError("playback-blocked"));
      } else if (!element.paused && element.currentTime * 1000 >= beat.playToMs) {
        // Reached the end of what this beat is allowed to reveal.
        element.pause();
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    // Anchor the clock to real playback onset, so decode and buffer latency are
    // excluded rather than charged to the player.
    const onPlaying = () => {
      if (startedAtRef.current === null) {
        startedAtRef.current = performance.now();
        setPhase("playing");
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    audio.addEventListener("playing", onPlaying, { once: true });

    try {
      audio.currentTime = 0;
      await audio.play();
    } catch {
      audio.removeEventListener("playing", onPlaying);
      setError("playback-blocked");
    }
  }, []);

  return {
    phase,
    ready: phase === "ready" || phase === "playing",
    elapsedMs,
    revealStage,
    displayMs,
    error,
    start,
    stop,
    analyser,
  };
}
