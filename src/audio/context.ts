"use client";

/**
 * One shared AudioContext for the whole app.
 *
 * Both the SFX engine and the visualiser need a context, and browsers cap how many
 * a page may create — so they share this one. It is created lazily because an
 * AudioContext constructed before a user gesture starts in a suspended state.
 */

let context: AudioContext | null = null;

/**
 * Observers of the context's state, so React can subscribe with `useSyncExternalStore`
 * rather than polling. Same idiom as the mute store in sfx.ts.
 */
const stateListeners = new Set<() => void>();

/** Not just "suspended": iOS parks a context in "interrupted", and closed cannot resume. */
function isResumable(ctx: AudioContext): boolean {
  return ctx.state !== "running" && ctx.state !== "closed";
}

/**
 * Best-effort resume. Never throws and never rejects.
 *
 * Outside a user gesture this is expected to fail, and that is fine — the unlock
 * listeners in unlock.ts will catch the next real tap. What is NOT fine is an uncaught
 * rejection, which is what the old fire-and-forget `void context.resume()` produced on
 * Safari every time the autoplay policy said no.
 */
export function resumeAudioContext(): Promise<boolean> {
  const ctx = context;
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === "running") return Promise.resolve(true);
  if (!isResumable(ctx)) return Promise.resolve(false);

  return ctx
    .resume()
    .then(() => ctx.state === "running")
    .catch(() => false);
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();

    /**
     * The state moves without us asking. iOS parks the context in "interrupted" after a
     * phone call, Siri, or an audio-route change, and nothing here would ever notice —
     * the old code only ever tested for "suspended" on the way past, so an interrupted
     * context stayed dead for the rest of the session and every sound after it was
     * silent with no error anywhere.
     */
    context.addEventListener("statechange", () => {
      for (const listener of stateListeners) listener();
    });
  }

  /**
   * Autoplay policy suspends the context until a gesture; every entry point calls through
   * here, so attempting a resume in one place covers them all. It only succeeds when the
   * current call stack carries a user activation — see unlock.ts, which is what makes
   * that reliably true rather than accidental.
   */
  if (isResumable(context)) void resumeAudioContext();

  return context;
}

/** Current state, or "none" before anything has constructed the context. */
export function getAudioState(): AudioContextState | "none" {
  return context?.state ?? "none";
}

/** Server render has no AudioContext and must not claim one. */
export function getAudioServerState(): AudioContextState | "none" {
  return "none";
}

export function subscribeAudioState(onChange: () => void): () => void {
  stateListeners.add(onChange);
  return () => stateListeners.delete(onChange);
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
