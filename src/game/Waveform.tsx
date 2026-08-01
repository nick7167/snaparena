"use client";

import { useEffect, useRef } from "react";
import type { Analyser } from "@/audio/visualizer";
import type { RevealBeat } from "@/engine/config";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * The waveform spine — the signature element.
 *
 * The guessing screen previously showed time four separate ways: a frequency
 * visualiser, a hairline phase timer, "1.0s of the song unlocked", and a countdown in
 * seconds. Four representations, none of them primary, and the most important screen in
 * the product read as a form.
 *
 * This is one object that answers all three questions at once:
 *
 *   how much song do I have    → the solid region, up to the unlock boundary
 *   how much time is left      → the round clock draining left to right beneath it
 *   what will the next beat cost me → the ghost region ahead of the boundary
 *
 * At each reveal beat the boundary steps forward and the newly-unlocked bars ignite, so
 * the unlock is something you see rather than something you read.
 *
 * Canvas rather than DOM: 64 bars animating every frame as elements would thrash
 * layout, while a canvas stays a single composited surface.
 *
 * Degrades exactly as the component it replaces did:
 *   - no analyser (Web Audio unavailable or CORS-tainted) → a calm idle pulse
 *   - reduced motion → a static frame, no animation loop at all
 */

const BAR_COUNT = 64;

export function Waveform({
  analyser,
  active,
  /** Elapsed round time, already smoothed by useRoundAudio. */
  displayMs,
  /** Index into `beats` — how many reveal beats have fired. */
  revealStage,
  beats,
  roundDurationMs,
  className = "",
}: {
  analyser: Analyser | null;
  active: boolean;
  displayMs: number;
  revealStage: number;
  beats: readonly RevealBeat[];
  roundDurationMs: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Read inside the animation loop without restarting it — the loop must not tear down
  // and rebuild on every timer tick or the smoothing state resets 10 times a second.
  //
  // Written in an effect rather than during render: a ref mutation during render is not
  // safe under concurrent rendering, where a render can be discarded before it commits.
  const live = useRef({ displayMs, revealStage, roundDurationMs, beats, active, analyser });
  useEffect(() => {
    live.current = { displayMs, revealStage, roundDurationMs, beats, active, analyser };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const bands = new Float32Array(BAR_COUNT);
    const smoothed = new Float32Array(BAR_COUNT);
    let phase = 0;

    const draw = () => {
      const { width, height } = resize(canvas);
      const state = live.current;

      // Fraction of the bar field that is unlocked audio. The boundary is where the
      // solid region ends and the ghost begins.
      const beat = state.beats[state.revealStage];
      const unlockedMs = beat ? beat.playToMs : 0;
      const fullMs = state.beats[state.beats.length - 1]?.playToMs || unlockedMs || 1;
      const unlockedFraction = Math.max(0, Math.min(1, unlockedMs / fullMs));

      // The round clock, draining left to right underneath everything.
      const elapsed = Math.max(
        0,
        Math.min(1, state.roundDurationMs > 0 ? state.displayMs / state.roundDurationMs : 0),
      );

      if (state.analyser && state.active) {
        state.analyser.sample(bands);
      } else {
        // Idle: a slow breathing wave so the panel never looks broken.
        phase += 0.02;
        for (let i = 0; i < bands.length; i++) {
          bands[i] = 0.1 + 0.06 * Math.sin(phase + i * 0.3);
        }
      }

      context.clearRect(0, 0, width, height);

      const barWidth = width / BAR_COUNT;
      const boundary = unlockedFraction * BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Extra smoothing on top of the analyser's own: raw bins jitter enough to read
        // as noise rather than as the music.
        smoothed[i] += (bands[i] - smoothed[i]) * 0.35;

        const unlocked = i < boundary;
        // Locked bars hold a low flat silhouette — present, but clearly not yours yet.
        const magnitude = unlocked ? smoothed[i] : 0.06;
        const barHeight = Math.max(2, magnitude * height * 0.92);

        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        context.fillStyle = unlocked ? PAPER : GHOST;
        context.fillRect(x + barWidth * 0.2, y, Math.max(1, barWidth * 0.6), barHeight);
      }

      // The unlock boundary: a hard rule where the song currently stops.
      if (boundary > 0 && boundary < BAR_COUNT) {
        context.fillStyle = GOLD;
        context.fillRect(boundary * barWidth - 1, 0, 2, height);
      }

      // Round clock. Sits along the bottom edge as part of the same object rather than
      // as a separate bar somewhere else on the page.
      context.fillStyle = INSET;
      context.fillRect(0, height - 3, width, 3);
      context.fillStyle = elapsed > 0.8 ? SIGNAL : GOLD;
      context.fillRect(0, height - 3, width * (1 - elapsed), 3);

      frameRef.current = requestAnimationFrame(draw);
    };

    // Reduced motion doubles as the low-power path: draw one frame and never start a
    // loop. Still correct, because the frame reflects current unlock and clock state.
    if (reducedMotion) {
      draw();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      return;
    }

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [reducedMotion]);

  // Under reduced motion there is no loop, so a state change has to force a repaint.
  useEffect(() => {
    if (!reducedMotion) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const { width, height } = resize(canvas);
    const beat = beats[revealStage];
    const fullMs = beats[beats.length - 1]?.playToMs || 1;
    const unlockedFraction = Math.max(0, Math.min(1, (beat?.playToMs ?? 0) / fullMs));

    context.clearRect(0, 0, width, height);
    const barWidth = width / BAR_COUNT;
    for (let i = 0; i < BAR_COUNT; i++) {
      const unlocked = i < unlockedFraction * BAR_COUNT;
      const barHeight = unlocked ? height * 0.5 : height * 0.08;
      context.fillStyle = unlocked ? PAPER : GHOST;
      context.fillRect(
        i * barWidth + barWidth * 0.2,
        (height - barHeight) / 2,
        Math.max(1, barWidth * 0.6),
        barHeight,
      );
    }
  }, [reducedMotion, revealStage, beats, displayMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`h-28 w-full sm:h-36 ${className}`}
    />
  );
}

// Read once rather than per frame: getComputedStyle in a render loop is a layout read
// 60 times a second.
const PAPER = "#F4F1EA";
const GHOST = "#333C4F";
const GOLD = "#F0B429";
const SIGNAL = "#E03A2F";
const INSET = "#0A0C12";

/** Keeps the backing store in step with CSS size and device pixel ratio. */
function resize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth * ratio;
  const height = canvas.clientHeight * ratio;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}
