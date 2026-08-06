"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { REVEAL_BEATS, ROUND_DURATION_MS } from "@/engine/config";
import { revealStageAt } from "@/engine/scoring";
import { createAnalyser, type Analyser } from "@/audio/visualizer";
import {
  getAudioContext,
  getAudioServerState,
  getAudioState,
  resumeAudioContext,
  subscribeAudioState,
} from "@/audio/context";
import { ensureAudioRunning } from "@/audio/unlock";
import { useDocumentVisible } from "./usePageLifecycle";
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

/**
 * How much of the gap between attempting playback and hearing it is forgiven.
 *
 * This is the anti-cheat floor on the score clock, and it closes a hole that the old
 * broken `retry()` was only accidentally covering. `validateClientClock` bounds a
 * reported time from ABOVE against a server window that only grows, and from below only
 * by an absolute 350ms floor — so a player who stalls playback to t=20s and then guesses
 * at t=21s reports 1000ms and scores a snap on a song they have been hearing for a while.
 *
 * Anchoring no later than the first attempt plus this grace makes a stall cost what it
 * actually cost. Generous enough that honest decode and buffer latency is still excluded
 * rather than charged to the player: on the normal path `playing` fires tens of
 * milliseconds after the attempt and the `min` below picks the real timestamp, leaving
 * the fast path byte-identical to what it always was.
 */
const STARTUP_GRACE_MS = 1_500;

export interface UseRoundAudioResult {
  phase: RoundPhase;
  /** True once the clip is buffered — the barrier the round start waits on. */
  ready: boolean;
  /**
   * True once playback has genuinely begun for this round.
   *
   * Distinct from `ready`, which only means the bytes arrived. A round can be `ready` and
   * never have started — that is exactly the state a blocked `play()` leaves behind — and
   * anything that depends on the score clock running has to test THIS rather than `ready`.
   */
  started: boolean;
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
   * When playback was FIRST attempted this round, as opposed to when it began.
   *
   * Kept apart from `startedAtRef` because the two answer different questions and
   * collapsing them is what made the score clock forgeable. `startedAtRef` is the anchor
   * the player is scored against and must reflect real playback onset; this one is the
   * ceiling on how late that anchor is allowed to be. Written once per round, on the
   * first `start()`, and never moved by a retry — a second attempt does not buy back the
   * time the first one cost.
   */
  const attemptedAtRef = useRef<number | null>(null);

  /** Mirrors `onPlaying` so the beat loop can be rebound without re-stacking listeners. */
  const onPlayingRef = useRef<(() => void) | null>(null);

  /**
   * The track `attemptedAtRef` currently belongs to.
   *
   * The attempt anchor has to survive `previewUrl` going transiently null, which it does
   * whenever the match subscription blips — a reconnect, or a backend deploy. Tying the
   * reset to "a genuinely different track arrived" rather than to the load effect running
   * keeps a blip from clearing the anchor and quietly refunding a stall the player already
   * spent, which is the exact thing STARTUP_GRACE_MS exists to charge for.
   */
  const anchoredUrlRef = useRef<string | null>(null);

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

  /**
   * Render-visible mirror of `startedAtRef !== null`.
   *
   * A ref cannot be a dependency, and the round-start effect in useRoundLifecycle has to
   * be able to tell "this round is already running" from "this round was attempted and
   * failed". Reading a ref there would leave it re-running against a stale value.
   */
  const [started, setStarted] = useState(false);

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
    setStarted(false);
  }

  // --- load / preload -------------------------------------------------------
  useEffect(() => {
    startedAtRef.current = null;
    onPlayingRef.current = null;
    stageRef.current = 0;

    // Only a genuinely different track clears the attempt anchor — see anchoredUrlRef.
    if (previewUrl !== null && previewUrl !== anchoredUrlRef.current) {
      attemptedAtRef.current = null;
      anchoredUrlRef.current = previewUrl;
    }

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

  const audioState = useSyncExternalStore(
    subscribeAudioState,
    getAudioState,
    getAudioServerState,
  );

  const visible = useDocumentVisible();

  /**
   * Attaches the visualiser late, if the shared context only wakes up mid-round.
   *
   * `start()` refuses to route the element through a context that is not running, because
   * doing so is irreversible and silent (see createAnalyser). That is the right call, but
   * it means a player whose first qualifying tap lands after the round opened would keep a
   * dead waveform for the rest of the match. Watching the context state gives it back the
   * moment the context is actually usable, without ever risking the audio itself.
   */
  useEffect(() => {
    if (audioState !== "running") return;
    if (analyserRef.current) return;
    const element = audioRef.current;
    if (!element) return;

    const next = createAnalyser(element);
    if (!next) return;
    analyserRef.current = next;
    setAnalyser(next);
  }, [audioState]);

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

  /**
   * The reveal-beat loop, which also drives the on-screen clock.
   *
   * Hoisted out of `start()` and given a stable identity so the retry path and the
   * page-lifecycle handler can re-arm it. As a closure built inside `start()` it was
   * reachable from nowhere else, which is part of why a round that failed to begin could
   * never be recovered without a reload.
   */
  const loop = useCallback(function loop() {
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
  }, []);

  /**
   * Attempts playback. Idempotent, and safe to call again after a failure.
   *
   * Split out of `start()` because recovering a blocked round needs exactly this and
   * nothing else — no reload, no clock reset, no lifecycle round trip. `audio.play()` is
   * reached synchronously so that a caller inside a click handler still carries the user
   * activation the autoplay policy is asking for; anything awaited first would spend it.
   */
  const beginPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // A previous attempt may have left its listener attached. Two live listeners arm the
    // beat loop twice, and the clock then runs at double speed.
    if (onPlayingRef.current) {
      audio.removeEventListener("playing", onPlayingRef.current);
    }

    const onPlaying = () => {
      if (startedAtRef.current !== null) return;
      /**
       * Anchored to real playback onset, but never later than the first attempt plus the
       * startup grace. Honest decode and buffer latency is still excluded rather than
       * charged to the player — on the normal path `playing` lands within a few frames
       * and the `min` picks the real timestamp. A long stall is not excluded, which is
       * what stops a delayed anchor from buying a fresh scoring window.
       */
      const ceiling = (attemptedAtRef.current ?? performance.now()) + STARTUP_GRACE_MS;
      startedAtRef.current = Math.min(performance.now(), ceiling);
      onPlayingRef.current = null;
      setStarted(true);
      setPhase("playing");
      rafRef.current = requestAnimationFrame(loop);
    };

    onPlayingRef.current = onPlaying;
    audio.addEventListener("playing", onPlaying, { once: true });

    try {
      audio.currentTime = 0;
      await audio.play();
    } catch {
      audio.removeEventListener("playing", onPlaying);
      onPlayingRef.current = null;
      setError("playback-blocked");
    }
  }, [loop]);

  /**
   * Keeps a backgrounded tab from leaking the whole song, and puts the round back
   * together on return.
   *
   * The reveal beats are enforced from inside the animation loop — it is the loop that
   * calls `pause()` once the clip reaches the end of what the current beat has unlocked.
   * `requestAnimationFrame` does not run in a hidden tab, so that pause never happened: a
   * player who switched apps mid-round heard all thirty seconds of the track while their
   * opponent heard one. Backgrounding was, accidentally, the strongest move in the game.
   *
   * The clock is deliberately left alone. The player was away and the time is spent —
   * the same UI-only posture the rest of this hook takes. Voiding it here would make
   * hiding the tab worth something again.
   */
  useEffect(() => {
    if (phase !== "playing") return;
    const element = audioRef.current;
    if (!element) return;

    if (!visible) {
      element.pause();
      return;
    }

    // iOS parks the context on the way out; ask for it back before anything plays.
    void resumeAudioContext();

    /**
     * Forces the next tick to treat the current beat as new, so it replays from 0:00 with
     * exactly the right amount unlocked. Reuses the loop's own beat-change branch rather
     * than repeating the playback rules here, so the two cannot drift.
     */
    stageRef.current = -1;

    // A pending frame can be dropped rather than merely deferred across a bfcache
    // restore, so the loop may need re-arming rather than simply resuming.
    if (rafRef.current === null && startedAtRef.current !== null) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [visible, phase, loop]);

  const start = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Guard against a double start — the round would otherwise restart its clock. Note
    // this tests the CLOCK, not whether an attempt has been made: a round that was
    // attempted and blocked has to stay startable, or the failure is terminal.
    if (startedAtRef.current !== null) return;

    // Stamped once per round. A retry deliberately does not move it, so the time a
    // failure cost stays spent — see STARTUP_GRACE_MS.
    if (attemptedAtRef.current === null) attemptedAtRef.current = performance.now();

    // Attach the analyser on first play, not at load: an AudioContext created before a
    // user gesture starts suspended. Guarded on the context actually running, because
    // routing the element through a suspended graph is silent with no error anywhere.
    if (!analyserRef.current) {
      const ctx = getAudioContext();
      if (ctx?.state === "running") {
        analyserRef.current = createAnalyser(audio);
        setAnalyser(analyserRef.current);
      } else {
        /**
         * The round plays on without a visualiser, which is the correct trade — but this
         * is worth counting. It means the unlock in unlock.ts did not land before the
         * round opened, and if it fires often the gesture coverage needs widening rather
         * than the degradation being accepted.
         */
        track("audio_context_suspended", { state: ctx?.state ?? "none" });
      }
    }

    await beginPlayback();
  }, [beginPlayback]);

  /**
   * Re-attempt a clip that failed.
   *
   * `startedAtRef` is deliberately left alone, and that is the whole safety property here.
   * The round clock has been running since the server dispatched the round; resetting it
   * would hand a fresh thirty seconds to anyone who could make a load fail on purpose,
   * which is a scoring exploit rather than a courtesy. A genuine failure costs the time it
   * cost — this only buys back the ability to play at all.
   *
   * Covers both shapes of failure, and they need opposite treatment — which is the bug
   * this used to have. The old version guarded the replay on `startedAtRef !== null`, a
   * condition a blocked playback can never satisfy, because that ref is only written once
   * playback has actually begun. So the one failure the button existed for was the one it
   * silently did nothing about: it reloaded the clip, `canplay` cleared the error, the
   * error card unmounted, and the round sat at a frozen 30.0 with no way back.
   *
   * A blocked playback needs nothing but another `play()`, called synchronously here so it
   * carries the click's user activation — the one thing the automatic path could never
   * provide. Reloading it would be actively harmful: the buffer is already good, and
   * re-fetching spends round seconds solving a problem the player does not have.
   *
   * A failed load does need the element re-fetched. The `canplay` listeners from the load
   * effect are still attached, so a successful reload resolves through them as normal and
   * the round-start effect picks it up from there.
   */
  const retry = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const wasBlocked = error === "playback-blocked";
    setError(null);

    if (wasBlocked) {
      /**
       * Fired first and deliberately not awaited. This is a real click, so it is the best
       * chance the app gets to wake a suspended context — but playback must not wait on
       * it, because the element does not need the context unless it has been routed
       * through one, and awaiting here would spend the activation `play()` needs.
       */
      void ensureAudioRunning();
      void beginPlayback();
      return;
    }

    setLoaded(false);
    audio.load();

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
  }, [error, beginPlayback]);

  return {
    phase,
    ready: loaded && error === null,
    started,
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
