"use client";

import { getAudioContext, resumeAudioContext } from "./context";

/**
 * Makes the shared AudioContext actually usable on mobile.
 *
 * Browsers start an AudioContext suspended and only allow it to resume from inside a user
 * gesture. Nothing in this app was ever doing that: every `play()` call site sits in an
 * effect or an async continuation, so the context was constructed suspended by whichever
 * one fired first and then had no gesture-carrying call stack to wake it up. The result
 * was silence — not just for the UI sounds, but for the songs too, because the round audio
 * is routed through the same context for the visualiser.
 *
 * Rather than making every button remember to do this, one capture-phase listener on the
 * document turns EVERY tap in the app into an unlock opportunity. No component has to know
 * it exists, and no new step appears in the match flow.
 */

let installed = false;

/**
 * Some iOS versions do not consider `resume()` alone sufficient — the context reports
 * "running" but stays silent until a buffer has actually been pushed through it. A single
 * silent frame is inaudible, costs nothing, and is the long-standing way to settle it.
 */
function primeWithSilentBuffer(ctx: AudioContext): void {
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Nothing here is worth failing a tap over.
  }
}

function handleGesture(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // One property read on the overwhelming majority of taps. Cheap enough that leaving the
  // listeners installed forever costs nothing measurable.
  if (ctx.state === "running") return;

  /**
   * Started before anything is awaited. User activation is consumed by the first `await`
   * in a call stack, so resuming has to be the first thing that happens or the gesture is
   * spent before it reaches the API that needed it.
   */
  void resumeAudioContext().then((running) => {
    if (running) primeWithSilentBuffer(ctx);
  });

  primeWithSilentBuffer(ctx);
}

/**
 * Installs the unlock listeners. Idempotent; returns a teardown.
 *
 * The listeners are deliberately NOT removed after the first success. iOS drops the
 * context into "interrupted" after a phone call, an alarm, Siri, or a Bluetooth route
 * change, and a one-shot unlock would leave the app permanently silent from the first
 * interruption onward — which is a worse bug than the one being fixed, because it looks
 * like the audio simply stopped working. The `running` early-return above is what makes
 * staying installed free.
 */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  if (installed) return () => {};
  installed = true;

  /**
   * Capture phase, so a `stopPropagation()` anywhere in the tree cannot starve this, and
   * passive, because it never calls `preventDefault` and must never delay a tap.
   */
  const options: AddEventListenerOptions = { capture: true, passive: true };
  const events = ["pointerdown", "touchend", "keydown", "click"] as const;

  for (const name of events) {
    document.addEventListener(name, handleGesture, options);
  }

  /**
   * Returning to the tab sometimes counts as activation on iOS, and when it does not this
   * costs one failed promise. Either way the next real tap still catches it.
   */
  const onVisible = () => {
    if (document.visibilityState === "visible") void resumeAudioContext();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    for (const name of events) {
      document.removeEventListener(name, handleGesture, options);
    }
    document.removeEventListener("visibilitychange", onVisible);
    installed = false;
  };
}

/**
 * Awaited unlock, for callers that already hold a real user gesture.
 *
 * Use this from click handlers where the next step depends on sound working. The
 * automatic path must NOT use it: `start()` is driven by server state rather than a tap,
 * and awaiting a resume that will never settle there turns a recoverable missing
 * visualiser into no playback at all.
 */
export async function ensureAudioRunning(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === "running") return true;

  const running = await resumeAudioContext();
  if (running) primeWithSilentBuffer(ctx);
  return running;
}
