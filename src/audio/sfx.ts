"use client";

import { getAudioContext } from "./context";

/**
 * UI sound, synthesised at runtime.
 *
 * No asset files, no licensing, nothing to download — every sound here is built
 * from oscillators and gain envelopes. The whole surface is a single `play(name)`
 * call, so swapping in real samples later means reimplementing one function rather
 * than touching every call site.
 */

export type SfxName =
  | "tick"
  | "go"
  | "snap"
  | "correct"
  | "wrong"
  | "whoosh"
  | "reveal"
  | "podium"
  | "promote"
  | "match_found"
  | "ready";

const MUTE_KEY = "songrace:muted";

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // Private-mode storage failures must not break audio.
    return false;
  }
}

// Read once at module load. Guarded because Next.js also renders client components
// on the server, where localStorage does not exist.
let muted = typeof window !== "undefined" ? readStoredMute() : false;

/**
 * Exposed as an external store so React can subscribe with `useSyncExternalStore`
 * instead of copying the value into component state inside an effect.
 */
const listeners = new Set<() => void>();

export function subscribeMute(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getMuteSnapshot(): boolean {
  return muted;
}

/** The server cannot read localStorage; assume unmuted and correct on hydration. */
export function getMuteServerSnapshot(): boolean {
  return false;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // Ignore: the in-memory value still applies for this session.
  }
  for (const listener of listeners) listener();
}

/**
 * A single enveloped oscillator voice.
 *
 * The envelope matters more than the waveform: an abrupt gain change produces an
 * audible click, so every voice ramps in and decays exponentially.
 */
function voice(
  ctx: AudioContext,
  options: {
    type: OscillatorType;
    from: number;
    to?: number;
    startAt?: number;
    duration: number;
    gain: number;
  },
): void {
  const start = ctx.currentTime + (options.startAt ?? 0);
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = options.type;
  osc.frequency.setValueAtTime(options.from, start);
  if (options.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.to),
      start + options.duration,
    );
  }

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(options.gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + options.duration + 0.02);
}

/** Filtered white noise, for whooshes and impacts. */
function noise(
  ctx: AudioContext,
  options: { duration: number; gain: number; from: number; to: number; startAt?: number },
): void {
  const start = ctx.currentTime + (options.startAt ?? 0);
  const frames = Math.floor(ctx.sampleRate * options.duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(options.from, start);
  filter.frequency.exponentialRampToValueAtTime(options.to, start + options.duration);
  filter.Q.value = 0.8;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(options.gain, start + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

  source.connect(filter).connect(amp).connect(ctx.destination);
  source.start(start);
  source.stop(start + options.duration + 0.02);
}

/** Plays a named sound. Silent (and free) when muted or unsupported. */
export function play(name: SfxName): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  switch (name) {
    case "tick":
      voice(ctx, { type: "square", from: 880, duration: 0.06, gain: 0.05 });
      break;

    case "go":
      // Rising fifth: reads as "start" rather than as another countdown beat.
      voice(ctx, { type: "square", from: 660, to: 1320, duration: 0.22, gain: 0.09 });
      break;

    case "snap":
      // The top tier deserves the biggest sound in the game: a bright major triad.
      voice(ctx, { type: "triangle", from: 784, duration: 0.5, gain: 0.12 });
      voice(ctx, { type: "triangle", from: 988, duration: 0.5, gain: 0.1, startAt: 0.05 });
      voice(ctx, { type: "triangle", from: 1319, duration: 0.55, gain: 0.09, startAt: 0.1 });
      noise(ctx, { duration: 0.3, gain: 0.05, from: 2000, to: 7000 });
      break;

    case "correct":
      voice(ctx, { type: "triangle", from: 660, duration: 0.22, gain: 0.1 });
      voice(ctx, { type: "triangle", from: 880, duration: 0.28, gain: 0.08, startAt: 0.07 });
      break;

    case "wrong":
      voice(ctx, { type: "sawtooth", from: 180, to: 90, duration: 0.28, gain: 0.07 });
      break;

    case "whoosh":
      noise(ctx, { duration: 0.35, gain: 0.06, from: 300, to: 4000 });
      break;

    case "reveal":
      noise(ctx, { duration: 0.5, gain: 0.07, from: 4000, to: 400 });
      voice(ctx, { type: "sine", from: 220, to: 440, duration: 0.5, gain: 0.09 });
      break;

    case "podium":
      [523, 659, 784, 1047].forEach((freq, index) => {
        voice(ctx, {
          type: "triangle",
          from: freq,
          duration: 0.4,
          gain: 0.1,
          startAt: index * 0.09,
        });
      });
      break;

    case "promote":
      [523, 659, 784, 1047, 1319].forEach((freq, index) => {
        voice(ctx, {
          type: "triangle",
          from: freq,
          duration: 0.75,
          gain: 0.11,
          startAt: index * 0.11,
        });
      });
      noise(ctx, { duration: 0.9, gain: 0.05, from: 1000, to: 8000, startAt: 0.2 });
      break;

    /**
     * An opponent has been found.
     *
     * Its own cue rather than the `whoosh` this used to share with every stage change,
     * because the search now survives navigating away — this is the one sound in the app
     * that has to carry meaning from a tab nobody is looking at. Two rising notes over the
     * whoosh: the movement says "something arrived", the whoosh keeps it in the same
     * family as the transition it accompanies.
     */
    case "match_found":
      noise(ctx, { duration: 0.4, gain: 0.06, from: 300, to: 4000 });
      voice(ctx, { type: "triangle", from: 587, duration: 0.3, gain: 0.1 });
      voice(ctx, { type: "triangle", from: 880, duration: 0.38, gain: 0.09, startAt: 0.1 });
      break;

    /** The opponent pressed Ready. Small and dry — an acknowledgement, not an event. */
    case "ready":
      voice(ctx, { type: "sine", from: 988, duration: 0.12, gain: 0.06 });
      break;
  }
}
