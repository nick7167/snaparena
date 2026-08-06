"use client";

import { getAudioContext, getMediaSource } from "./context";

/**
 * Frequency analysis of the track currently playing.
 *
 * This is the payoff from Apple's preview CDN sending permissive CORS headers:
 * the bars react to the *actual song*, which is the single strongest visual signal
 * that this is a music game and not a quiz with audio bolted on.
 */

export interface Analyser {
  /** Fills `target` with normalised 0..1 band energies. */
  sample(target: Float32Array): void;
  readonly bandCount: number;
  disconnect(): void;
}

/**
 * Small FFT on purpose. 64 bins is plenty for a bar visualiser and keeps the
 * per-frame cost low enough for mid-range phones — the same reason the render loop
 * is capped rather than run flat out.
 */
const FFT_SIZE = 128;

/**
 * Wires an audio element into an analyser.
 *
 * Returns null when Web Audio is unavailable or the element is CORS-tainted; callers
 * must fall back to a non-reactive visual rather than failing the round.
 */
export function createAnalyser(element: HTMLMediaElement): Analyser | null {
  const ctx = getAudioContext();
  if (!ctx) return null;

  /**
   * Refuse to route the element through a context that is not running, because routing
   * it is IRREVERSIBLE.
   *
   * `getMediaSource` caches one source node per element and a second
   * `createMediaElementSource` on the same element throws, so there is no undo — and once
   * an element's output has been replaced by a graph connection, its audibility depends
   * entirely on that graph being live. A suspended or interrupted context therefore turns
   * a perfectly good clip completely silent while `play()` resolves, the `playing` event
   * fires and the score clock runs: thirty seconds of confident-looking UI with no sound
   * and no error of any kind. That was the "one player can't hear it" bug.
   *
   * Callers already have to handle a null analyser (see the docblock above), and a
   * non-reactive waveform is a far smaller loss than an inaudible round.
   */
  if (ctx.state !== "running") return null;

  const source = getMediaSource(element);
  if (!source) return null;

  const node = ctx.createAnalyser();
  node.fftSize = FFT_SIZE;
  node.smoothingTimeConstant = 0.75;

  // Clear the source's existing routing before re-wiring. The source is cached per
  // element, so without this a remount would leave it connected BOTH directly to
  // the destination and through the analyser — the track plays twice, at double
  // volume, slightly out of phase.
  source.disconnect();

  // The analyser MUST then be connected through to the destination. Routing an
  // element into the graph replaces its direct output, so leaving the chain
  // dangling here silences the song entirely — the classic Web Audio trap.
  source.connect(node);
  node.connect(ctx.destination);

  const bytes = new Uint8Array(node.frequencyBinCount);

  return {
    bandCount: node.frequencyBinCount,

    sample(target: Float32Array) {
      node.getByteFrequencyData(bytes);
      const count = Math.min(target.length, bytes.length);
      for (let i = 0; i < count; i++) target[i] = bytes[i] / 255;
    },

    disconnect() {
      try {
        node.disconnect();
        // Restore a direct path so audio keeps playing without the analyser. The
        // source node itself is never destroyed — it is cached per element and
        // cannot be recreated.
        source.disconnect();
        source.connect(ctx.destination);
      } catch {
        // Already torn down.
      }
    },
  };
}
