"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REVEAL_BEATS, ROUND_DURATION_MS } from "@/engine/config";
import { revealStageAt } from "@/engine/scoring";
import { createAnalyser, type Analyser } from "@/audio/visualizer";
import { track } from "@/analytics";

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

/**
 * `playing` means the scored round is running and the reveal-beat loop owns the element.
 * `freeplay` means the round is decided for this player and they are listening to the clip
 * end to end — audible, but with the score clock stopped and no beat loop. The two are kept
 * distinct so nothing can mistake "there is sound" for "the round is still scoring".
 */
export type RoundPhase = "idle" | "loading" | "ready" | "playing" | "freeplay" | "ended";

/** How long to wait for a clip before declaring it unplayable. */
const LOAD_TIMEOUT_MS = 8_000;

export interface UseRoundAudioResult {
  phase: RoundPhase;
  /** True once the clip is buffered — the barrier the round start waits on. */
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
  /** Re-plays the currently unlocked snippet from 0:00 without touching the clock. */
  replay: () => void;
  /**
   * Plays the whole clip, once the round is decided for this player.
   *
   * Unlike `replay`, this is not bounded by the current reveal beat and cannot be re-cut by
   * the beat loop. Like `replay`, it does not touch the score clock.
   */
  playFull: () => void;
  /**
   * Re-attempts a clip that errored, without restarting the round clock.
   *
   * Must be called from a user gesture — that is what clears a `playback-blocked`, and
   * there is no other way to clear one.
   */
  retry: () => void;
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
  const analyserRef = useRef<Analyser | null>(null);

  /**
   * Buffering state is tracked SEPARATELY from the playback phase.
   *
   * These used to be one value, and it caused total silence: the round now opens
   * with a countdown phase during which the UI called stop(), which set the phase
   * to "ended" — and the `canplaythrough` handler then refused to promote it to
   * "ready" because it only advanced from "loading". `ready` stayed false forever.
   * Keeping them independent means a lifecycle call can never clobber load state.
   */
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<RoundPhase>("idle");
  const [displayMs, setDisplayMs] = useState(0);
  const [revealStage, setRevealStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState(previewUrl);
  const [analyser, setAnalyser] = useState<Analyser | null>(null);

  // Reset for a new track during render rather than inside an effect. Calling
  // setState synchronously in an effect cascades an extra render; adjusting state
  // during render is React's sanctioned pattern for reacting to a changed prop.
  if (previewUrl !== loadedUrl) {
    setLoadedUrl(previewUrl);
    setLoaded(false);
    setPhase("idle");
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
    // Apple's preview CDN sends permissive CORS headers, which is what makes the
    // Web Audio visualiser possible.
    audio.crossOrigin = "anonymous";
    audio.src = previewUrl;
    audioRef.current = audio;

    const markLoaded = () => setLoaded(true);
    const onError = () => {
      // A dead preview URL must void the round rather than penalise the player.
      setError("audio-unavailable");
    };

    audio.addEventListener("canplaythrough", markLoaded);
    audio.addEventListener("canplay", markLoaded);
    audio.addEventListener("error", onError);
    audio.load();

    // A clip already in the browser cache may settle before the listeners above are
    // useful, so check readyState directly too. HAVE_FUTURE_DATA (3) is enough to
    // begin playback. Deferred to a microtask so this is not a synchronous setState
    // inside an effect body, and guarded so it cannot fire after teardown.
    queueMicrotask(() => {
      if (audioRef.current === audio && audio.readyState >= 3) setLoaded(true);
    });

    // Never hang on "Buffering…" indefinitely — surface a real error instead.
    const timeout = setTimeout(() => {
      setLoaded((current) => {
        if (!current) setError("audio-timeout");
        return current;
      });
    }, LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      audio.removeEventListener("canplaythrough", markLoaded);
      audio.removeEventListener("canplay", markLoaded);
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

  /**
   * Reports a failed clip, once per failure.
   *
   * Here rather than at the two call sites because this hook is the single point every
   * audio failure passes through, so neither runner can forget to report and the two
   * cannot drift.
   *
   * This event decides a real open question. The audit found that a failed load costs the
   * player the round, and the fix shipped for it is UI-only — Retry and Skip — on the
   * assumption that genuine failures are rare enough to live with. Nothing measured that
   * assumption. If this fires often, the honest server-side fix (voiding the round) is
   * worth the abuse surface it carries; if it barely fires, it is not.
   */
  useEffect(() => {
    if (error === null) return;
    track("audio_error", { reason: error });
  }, [error]);

  const elapsedMs = useCallback(() => {
    if (startedAtRef.current === null) return 0;
    return performance.now() - startedAtRef.current;
  }, []);

  /**
   * Stops playback and freezes the clock.
   *
   * Deliberately a no-op unless the clip is actually playing: callers stop on every
   * non-guessing phase, and a clip that has not started yet must keep its load state.
   */
  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioRef.current?.pause();
    // `freeplay` has to end here too. Pausing the element while leaving the phase claiming
    // it has signal would leave the visualiser animating against silence.
    setPhase((current) =>
      current === "playing" || current === "freeplay" ? "ended" : current,
    );
  }, []);

  /**
   * Re-plays the unlocked snippet on demand.
   *
   * The clip goes silent between reveal beats, which reads as a fault rather than a
   * design. Letting players re-hear what they have makes the silence a choice.
   * Deliberately does not touch the score clock — replaying is free, waiting is not.
   */
  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || startedAtRef.current === null) return;
    audio.currentTime = 0;
    void audio.play().catch(() => setError("playback-blocked"));
  }, []);

  /**
   * Plays the clip end to end for a player whose round is already decided.
   *
   * Solving or passing used to cut the audio dead and leave the player watching a silent
   * screen until the round closed — the reward for naming the song was to stop hearing it.
   * This makes the wait optional listening instead.
   *
   * The score clock is deliberately untouched: `startedAtRef` is never reassigned, so
   * nothing reported to the server changes. Guarded on the round having actually begun, so
   * there is no path to hearing the clip before the clock starts.
   */
  const playFull = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || startedAtRef.current === null) return;

    /**
     * Cancelled here rather than relying on the caller having stopped first.
     *
     * The normal path already stopped the audio, but a reload mid-round after solving
     * restores `solved` from the server AND restarts the beat loop (see useRoundLifecycle),
     * so without this the playback would be chopped at the current beat's boundary.
     */
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    // Without this the control would sit on "Playing…" forever once the clip runs out, and
    // the visualiser would keep animating against a finished element.
    const onEnded = () => setPhase("ended");
    audio.addEventListener("ended", onEnded, { once: true });

    audio.currentTime = 0;
    setPhase("freeplay");
    void audio.play().catch(() => {
      audio.removeEventListener("ended", onEnded);
      setPhase("ended");
      setError("playback-blocked");
    });
  }, []);

  const start = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Guard against a double start — the round would otherwise restart its clock.
    if (startedAtRef.current !== null) return;

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

  /**
   * Re-attempt a clip that failed.
   *
   * `startedAtRef` is deliberately left alone, and that is the whole safety property here.
   * The round clock has been running since the server dispatched the round; resetting it
   * would hand a fresh thirty seconds to anyone who could make a load fail on purpose,
   * which is a scoring exploit rather than a courtesy. A genuine failure costs the time it
   * cost — this only buys back the ability to play at all.
   *
   * Covers both shapes of failure. A blocked playback needs nothing but another `play()`,
   * and because this runs inside the retry button's click handler it carries the user
   * gesture the autoplay policy is asking for — which is the one thing the automatic path
   * could never provide. A failed load needs the element re-fetched; the `canplay`
   * listeners from the load effect are still attached, so a successful reload resolves
   * through them as normal.
   */
  const retry = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setError(null);
    setLoaded(false);
    audio.load();

    if (startedAtRef.current !== null) {
      void audio.play().catch(() => setError("playback-blocked"));
    }

    /**
     * The load effect's timeout has already fired and will not re-arm, so without this a
     * second failure would sit on "Buffering audio…" forever rather than returning to an
     * error the player can act on.
     *
     * Reads `readyState` rather than tracking state, so there is nothing to keep in sync
     * and nothing to clean up if the round moves on underneath it.
     */
    setTimeout(() => {
      if (audioRef.current === audio && audio.readyState < 3) setError("audio-timeout");
    }, LOAD_TIMEOUT_MS);
  }, []);

  return {
    phase,
    ready: loaded && error === null,
    elapsedMs,
    revealStage,
    displayMs,
    error,
    start,
    stop,
    replay,
    playFull,
    retry,
    analyser,
  };
}
