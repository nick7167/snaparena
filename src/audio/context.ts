"use client";

/**
 * One shared AudioContext for the whole app.
 *
 * Both the SFX engine and the visualiser need a context, and browsers cap how many
 * a page may create — so they share this one. It is created lazily because an
 * AudioContext constructed before a user gesture starts in a suspended state.
 */

let context: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }

  // Autoplay policy suspends the context until a gesture; every entry point calls
  // through here, so resuming in one place covers them all.
  if (context.state === "suspended") void context.resume();

  return context;
}

/**
 * Media element sources may only be created **once per element** — a second call
 * throws InvalidStateError and kills playback. Cached here so the visualiser can
 * be mounted, unmounted and remounted against the same element safely.
 */
const sourceCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export function getMediaSource(
  element: HTMLMediaElement,
): MediaElementAudioSourceNode | null {
  const ctx = getAudioContext();
  if (!ctx) return null;

  const cached = sourceCache.get(element);
  if (cached) return cached;

  try {
    const source = ctx.createMediaElementSource(element);
    // Routing an element into the graph replaces its direct output, so connect
    // straight through immediately. Without this the track is silent for as long
    // as nothing else has wired the source up.
    source.connect(ctx.destination);
    sourceCache.set(element, source);
    return source;
  } catch {
    // Thrown when the element is CORS-tainted. Apple's preview CDN sends
    // `access-control-allow-origin: *` so this should not fire, but a single bad
    // track must degrade the visuals rather than break the round.
    return null;
  }
}
