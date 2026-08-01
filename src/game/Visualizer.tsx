"use client";

import { useEffect, useRef } from "react";
import type { Analyser } from "@/audio/visualizer";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Frequency bars driven by the actual track.
 *
 * Rendered to a canvas rather than as DOM nodes: 48 elements animating every frame
 * would thrash layout, while a canvas stays one composited surface.
 *
 * Degrades in two ways, both deliberate:
 *  - no analyser (Web Audio unavailable or CORS-tainted) → a calm idle pulse
 *  - reduced motion → a static bar, no animation loop at all
 */
export function Visualizer({
  analyser,
  active,
  accent = "#22d3ee",
  className = "",
}: {
  analyser: Analyser | null;
  active: boolean;
  accent?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Reduced motion doubles as the low-power path: draw one static frame and
    // never start an animation loop.
    if (reducedMotion) {
      drawStatic(context, canvas, accent);
      return;
    }

    const bands = new Float32Array(48);
    const smoothed = new Float32Array(48);
    let phase = 0;

    const render = () => {
      const { width, height } = resize(canvas);

      if (analyser && active) {
        analyser.sample(bands);
      } else {
        // Idle: a slow breathing wave so the panel never looks broken.
        phase += 0.02;
        for (let i = 0; i < bands.length; i++) {
          bands[i] = 0.12 + 0.08 * Math.sin(phase + i * 0.35);
        }
      }

      context.clearRect(0, 0, width, height);

      const barWidth = width / bands.length;
      for (let i = 0; i < bands.length; i++) {
        // Extra smoothing on top of the analyser's own: raw bins jitter enough to
        // read as noise rather than as the music.
        smoothed[i] += (bands[i] - smoothed[i]) * 0.35;

        const barHeight = Math.max(2, smoothed[i] * height);
        const x = i * barWidth;
        const y = height - barHeight;

        const gradient = context.createLinearGradient(0, y, 0, height);
        gradient.addColorStop(0, accent);
        gradient.addColorStop(1, "rgba(217, 70, 239, 0.35)");

        context.fillStyle = gradient;
        context.fillRect(x + barWidth * 0.15, y, barWidth * 0.7, barHeight);
      }

      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [analyser, active, accent, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`h-24 w-full ${className}`}
    />
  );
}

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

function drawStatic(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  accent: string,
): void {
  const { width, height } = resize(canvas);
  context.clearRect(0, 0, width, height);
  context.fillStyle = accent;
  context.globalAlpha = 0.4;
  context.fillRect(0, height - 4, width, 4);
  context.globalAlpha = 1;
}
