import { SenderError } from "spacetimedb/server";
import { Timestamp } from "spacetimedb";
import type { GameMode } from "../../src/engine/config";

/**
 * Shared helpers. Nothing here defines a reducer, a view or a table, so this
 * module is safe for anything to import.
 *
 * The main job is the millisecond boundary. SpacetimeDB deals in `Timestamp`
 * (microseconds since the epoch, as a bigint); the game engine in `../src/engine/`
 * deals in plain millisecond numbers, and it is shared verbatim with the browser.
 * Rather than change the engine — which would mean touching every one of its 374
 * tests to prove nothing moved — the boundary is converted here, in one place.
 */

/** Microseconds per millisecond. */
const MICROS_PER_MS = 1_000n;

/** A `Timestamp` as the millisecond number the engine expects. */
export function toMs(at: Timestamp): number {
  return Number(at.microsSinceUnixEpoch / MICROS_PER_MS);
}

/** The same, for a value that may be absent. */
export function toMsOrNull(at: Timestamp | undefined): number | null {
  return at === undefined ? null : toMs(at);
}

/**
 * Microseconds since the epoch for a millisecond number, for `ScheduleAt.time`.
 *
 * Takes a bigint rather than constructing a `Timestamp` because that is what the
 * scheduling API wants, and going through a `Timestamp` only to unwrap it again
 * is a round trip with nothing in the middle.
 */
export function msToMicros(ms: number): bigint {
  return BigInt(Math.round(ms)) * MICROS_PER_MS;
}

/** A point `deltaMs` in the future, in the microseconds `ScheduleAt.time` takes. */
export function microsFrom(now: Timestamp, deltaMs: number): bigint {
  return now.microsSinceUnixEpoch + BigInt(Math.max(0, Math.round(deltaMs))) * MICROS_PER_MS;
}

/**
 * The same point as a `Timestamp`, for writing into a column.
 *
 * `ScheduleAt.time` wants raw microseconds while a timestamp column wants the
 * class, so both shapes are needed and building the object literal by hand does
 * not typecheck — `Timestamp` carries methods, not just the field.
 */
export function timestampFrom(now: Timestamp, deltaMs: number): Timestamp {
  return new Timestamp(microsFrom(now, deltaMs));
}

const GAME_MODES: readonly GameMode[] = ["ranked", "room", "daily", "practice"];

/**
 * Narrows the stored mode to the engine's union.
 *
 * `match.mode` is a plain string column — SpacetimeDB columns have no enum — while
 * every engine function that branches on mode takes `GameMode`. All four writers of
 * that column use one of these values, so this is a boundary assertion rather than a
 * branch anyone should reach.
 *
 * An unrecognised mode falls back to `"ranked"` rather than throwing. This is called
 * from `finalizeMatch`, which runs on a schedule with no caller to report an error to:
 * throwing would abort the transaction and the match would never pay out at all, which
 * is a worse failure than paying out under the wrong mode's rules.
 */
export function gameModeOf(mode: string): GameMode {
  return GAME_MODES.includes(mode as GameMode) ? (mode as GameMode) : "ranked";
}

/**
 * The avatar as everyone else should see it.
 *
 * A reported picture falls back to the initial-on-colour rather than vanishing — the
 * player keeps an avatar, they just lose the image. Every public reader goes through
 * this, so a hidden picture cannot survive on one surface after being pulled from
 * another. The ladder is the surface that makes this necessary: it denormalises the
 * avatar into its own rows, so reading `avatarUrl` straight from the user would leave a
 * hidden picture on the leaderboard until that player's rank happened to move.
 *
 * The `me` view deliberately does NOT use it. That only ever returns the caller's own
 * row, and hiding someone's picture from themselves would leave them unable to tell why
 * it looks wrong to everyone else, or to go and change it.
 */
export function publicAvatarUrl(user: {
  avatarHidden: boolean;
  avatarUrl: string | undefined;
}): string | undefined {
  return user.avatarHidden ? undefined : user.avatarUrl;
}

/**
 * Throws a `SenderError`, which is what surfaces to the caller as a reducer error.
 *
 * A plain `Error` is reported as an internal module fault instead, so the
 * distinction matters: "that username is taken" is the player's problem and should
 * reach them, while a genuine bug should not be dressed up as one.
 */
export function reject(message: string): never {
  throw new SenderError(message);
}

/**
 * Obvious-slur blocklist, carried over unchanged from the Convex backend.
 *
 * Deliberately small and boring: a speed bump proportionate to the current scale,
 * not a content-moderation system. The report flow is what handles anything this
 * misses.
 */
const BLOCKED_TERMS = [
  "nigger", "nigga", "faggot", "fag", "retard", "tranny", "kike", "spic", "chink",
  "rape", "nazi", "hitler", "kys",
];

export function containsBlockedTerm(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z]/g, "");
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

/** Handle rules, shared by the availability view and every write path. */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,12}$/;

/** Avatar colours are written as `color:#rrggbb`. */
export const AVATAR_COLOUR_PATTERN = /^color:#[0-9a-fA-F]{6}$/;

/**
 * Upload ceiling.
 *
 * The client re-encodes to a 256px square webp before uploading, so anything
 * arriving near this did not come from our own form. The cap exists for that case:
 * the reducer is callable directly, which makes the client's own limit a
 * convenience rather than a control.
 */
export const AVATAR_MAX_BYTES = 512 * 1024;

export const AVATAR_CONTENT_TYPES = ["image/webp", "image/jpeg", "image/png"];
