import type { Transition } from "motion/react";

/**
 * The motion vocabulary.
 *
 * The build had grown six different spring configurations chosen ad hoc — 220/18,
 * 240/16, 260/24, 260/26, 300/14, 320/20 — which is why the animation read as busy
 * rather than intentional. These four are the whole language.
 *
 * `settle` deliberately keeps the exact values `Stage` already used, so phase
 * transitions are unchanged.
 */

/** Arrivals that should feel struck: countdown digits, tier chips, the rank emblem. */
export const snap: Transition = { type: "spring", stiffness: 320, damping: 20 };

/** Stage enter/exit. Unchanged from the previous build. */
export const settle: Transition = { type: "spring", stiffness: 260, damping: 26 };

/** Anything that empties: HP, XP, meters. Slow out, so the loss is legible. */
export const drain: Transition = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };

/** Short and sharp: waveform unlock steps, press feedback, chips appearing. */
export const ignite: Transition = { duration: 0.18, ease: [0.2, 0, 0, 1] };

/**
 * Reduced-motion helper.
 *
 * Returns `false` for `initial` — which motion/react reads as "start at the animate
 * state" — so a component mounts already in position rather than animating into it.
 */
export function enter<T extends object>(reduced: boolean, from: T): T | false {
  return reduced ? false : from;
}
