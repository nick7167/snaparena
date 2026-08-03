/**
 * Matchmaking rules shared by the server that applies them and the UI that draws them.
 *
 * `eloBandFor` lived inside convex/ranked.ts, where the search panel could not reach it —
 * so the queue screen showed a sweeping bar that meant nothing while the one honest,
 * already-computed figure about the search went unshown. Reimplementing it on the client
 * would have been worse: two copies of a rule drift, and the moment they do the screen is
 * lying about what the server is actually looking for.
 */

/**
 * How far either side of your rating the search is currently reaching.
 *
 * Starts tight so early matches are fair, then loosens rather than leaving a player
 * queueing forever — which matters a great deal at launch, when the pool is small enough
 * that a strict band would never match anyone.
 */
export function eloBandFor(waitMs: number): number {
  const seconds = waitMs / 1_000;
  return Math.min(100 + seconds * 20, 1_000);
}

/**
 * How long a player waits alone before ranked offers them a bot automatically.
 *
 * Long enough that a real opponent had a genuine chance to arrive; short enough that
 * walking away from an empty queue is not the outcome. The manual button is available
 * from the first second regardless — this is the safety net, not the front door.
 */
export const BOT_FALLBACK_MS = 90_000;

/**
 * How long the fallback is announced before it fires.
 *
 * Being dropped into a match against software without warning is precisely what the
 * human-only rule existed to prevent, and this notice is what replaces that rule.
 */
export const BOT_FALLBACK_NOTICE_MS = 3_000;
