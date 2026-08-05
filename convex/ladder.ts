import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { publicAvatarUrl } from "./avatar";
import { RANK_TIERS } from "../src/engine/config";
import { rankForElo } from "../src/engine/ranks";
import { levelForXp } from "../src/engine/xp";
// DEV ONLY — delete with convex/devbots.ts.
import { devRankBotsEnabled, isDevRankBotPersona } from "../src/engine/dev-rank-bots";

/**
 * The ladder: who is on it, where they stand, and the periodic snapshot of the field.
 *
 * A leaf module by construction — it imports nothing from `users.ts`, because `users.ts`
 * imports from here. Everything the eligibility rule needs lives in this file so there is
 * exactly one definition of "on the board" for every reader and for the snapshot builder.
 */

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * Who counts as being on the ladder — the half of the rule an index filter can express.
 *
 * These two used to carry their own copies of the rule and they disagreed: the position
 * count excluded bots unconditionally while the board included the sixteen dev rank bots,
 * so every bot counted zero players above it and every bot profile read "#1 global". A
 * rank and the list it refers to have to be measured against the same set of people.
 *
 * This is only half the rule. `onBoardDoc` is the other half and both are required —
 * see the note there.
 *
 * `q` is deliberately untyped — Convex's filter builder is structurally identical across
 * the call sites but not nameable from here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onBoard(q: any, showRankBots: boolean) {
  const clauses = [
    q.eq(q.field("placementsRemaining"), 0),
    // Guests keep their full placement count so the clause above already excludes them.
    // Stated explicitly so the exclusion is a decision rather than a side effect of how
    // placements happen to work.
    q.neq(q.field("isGuest"), true),
  ];
  // Bots are opponents, never ladder entries. Listing them would make the leaderboard
  // partly a ranking of software.
  if (!showRankBots) clauses.push(q.neq(q.field("isBot"), true));
  return q.and(...clauses);
}

/**
 * The half of the ladder rule that the index filter cannot express.
 *
 * `onBoard` drops its `isBot` clause in dev mode so the sixteen rank bots can be listed;
 * this is what keeps the twelve shipping practice bots out, and it has to run in JS
 * because the check is a persona-id prefix. Every ladder read applies BOTH halves — a
 * reader that applies only `onBoard` measures against a population the board does not
 * show, which is exactly how the board and the profile drifted apart the second time:
 * the practice bots sit at 720-1800 Elo with zero placements, so they were counted as
 * being above a player without ever appearing on the list, and the #3 row's profile
 * read "#5 global".
 */
export function onBoardDoc(user: Doc<"users">, showRankBots: boolean): boolean {
  return !user.isBot || (showRankBots && isDevRankBotPersona(user.botPersonaId));
}

/**
 * The ladder as a query that reads only rows which are on it.
 *
 * `onBoard` states the same rule as a `.filter()`, and a filter does not reduce documents
 * READ — it discards them after the fact. The `by_elo` range spans every guest (all parked
 * at STARTING_ELO), every bot and every unplaced account, so a bounded `.take()` over it
 * can scan several times its own limit and was one dense guest cohort away from the 16,384
 * document read ceiling.
 *
 * `by_ladder_elo` puts the rule in the index range instead, so the scan sees ladder entries
 * and nothing else. See the index comment in schema.ts for why the tie order is identical.
 *
 * Dev mode keeps the old path: `showRankBots` means "bot or not-bot", which an equality
 * prefix cannot express — and a deployment with that flag on has a handful of rows anyway.
 *
 * `bound` narrows on Elo inside whichever index is chosen, so callers read the same either
 * way. Untyped for the same reason `onBoard` is.
 */
export function ladderQuery(
  ctx: QueryCtx,
  showRankBots: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bound?: (q: any) => any,
) {
  if (showRankBots) {
    const scan = bound
      ? ctx.db.query("users").withIndex("by_elo", (q) => bound(q))
      : ctx.db.query("users").withIndex("by_elo");
    return scan.filter((q) => onBoard(q, true));
  }

  return ctx.db.query("users").withIndex("by_ladder_elo", (q) => {
    const ladder = q
      .eq("placementsRemaining", 0)
      .eq("isGuest", undefined)
      .eq("isBot", undefined);
    return bound ? bound(ladder) : ladder;
  });
}

// ---------------------------------------------------------------------------
// The snapshot
// ---------------------------------------------------------------------------

/**
 * How many players the stored field holds.
 *
 * The binding limit is not bytes — a Convex ARRAY caps at 8,192 elements, so this must
 * stay well under that. At 5,000 the field document is roughly 415KB against a 1MB limit.
 */
export const SNAPSHOT_MAX_ENTRIES = 5_000;

/**
 * How far down the field carries display fields.
 *
 * `leaderboard` caps at 500 and the page asks for exactly that, so entries past here only
 * ever need counting, never rendering. Carrying handle/avatar for all 5,000 would push the
 * document past the 1MB limit.
 */
export const ROW_DEPTH = 500;

/** How often the cron rebuilds. Shown to players on the board, so it lives here. */
export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

export type FieldDoc = Doc<"ladderSnapshot"> & { kind: "field" };

/**
 * The stored field, or null when it should not be used.
 *
 * Null in exactly two cases:
 *
 *   1. `DEV_RANK_BOTS` is set. The snapshot always stores the real ladder, so a dev
 *      deployment showing the rank bots has to fall back to the live walk. That costs
 *      nothing there — one human and sixteen bots.
 *   2. No field document exists yet, i.e. the cron has never run.
 *
 * Deliberately NOT age-based. A query cannot read the wall clock reactively, so a
 * "stale after N minutes" guard would not fire when it mattered; and if the cron ever
 * died, it would drop every subscriber onto the 5,000-row walk simultaneously — the exact
 * read amplification this exists to remove, arriving all at once. A frozen board that
 * says "updated 3 hours ago" is the honest failure, and the freshness line is the monitor.
 *
 * Every reader branches on this ONCE, at the top. A query that counts against the field
 * and lists from the live walk is the drift bug all over again.
 */
export async function ladderField(ctx: QueryCtx): Promise<FieldDoc | null> {
  if (devRankBotsEnabled()) return null;

  const doc = await ctx.db
    .query("ladderSnapshot")
    .withIndex("by_kind", (q) => q.eq("kind", "field"))
    .unique();

  return doc && doc.kind === "field" ? doc : null;
}

type Entry = { u: Id<"users">; e: number; t: number };

/**
 * Does `entry` rank strictly above a player sitting at (`elo`, `createdAt`)?
 *
 * This is the live walk's terminator inverted. Compare `globalPosition` below: the walk
 * stops at the first row that does NOT rank strictly above, which is the same index a
 * lower-bound search returns. Ties break newest-first because Convex appends
 * `_creationTime` to every index.
 */
function ranksAbove(entry: Entry, elo: number, createdAt: number): boolean {
  return entry.e > elo || (entry.e === elo && entry.t > createdAt);
}

/** First index in `entries` that does not rank above the probe. */
function lowerBound(entries: readonly Entry[], elo: number, createdAt: number): number {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (ranksAbove(entries[mid], elo, createdAt)) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Where a player stands, from their LIVE rating against the stored field.
 *
 * This is the whole point of the snapshot: the field is up to five minutes old, but the
 * rating measured against it is current, so a player's own number moves the instant they
 * win or lose. Nothing about them is ever stale.
 *
 * `selfHigh` is the case that is easy to miss and impossible to spot afterwards. If a
 * player's rating DROPPED since the build, their own stored entry still sits above their
 * live Elo, and without this they would count themselves as being ahead of themselves.
 *
 * A player absent from the field — placed since the last build — is ranked against it
 * anyway. Finishing placements should pay out immediately, not five minutes later, and
 * being measured against a field that is missing whoever else placed in the same window
 * is an error of about one place.
 */
export function positionIn(
  field: FieldDoc,
  user: Pick<Doc<"users">, "_id" | "elo" | "_creationTime">,
): { position: number; approximate: boolean } {
  const bound = lowerBound(field.entries, user.elo, user._creationTime);
  const idx = field.entries.findIndex((entry) => entry.u === user._id);
  const selfHigh = idx >= 0 && idx < bound;

  const position = bound + 1 - (selfHigh ? 1 : 0);

  return {
    position,
    // Only ever true once the field is truncated AND the player is past its end, where
    // the true figure genuinely is unknown. Below the cap every rank is exact.
    approximate: field.truncated && position > field.entries.length,
  };
}

/** Index of a player's own entry, or -1. Exposed so neighbour walks can skip themselves. */
export function entryIndexOf(field: FieldDoc, userId: Id<"users">): number {
  return field.entries.findIndex((entry) => entry.u === userId);
}

export function boundIn(
  field: FieldDoc,
  user: Pick<Doc<"users">, "elo" | "_creationTime">,
): number {
  return lowerBound(field.entries, user.elo, user._creationTime);
}

// ---------------------------------------------------------------------------
// Position, live
// ---------------------------------------------------------------------------

/**
 * How far down the ladder we are willing to count before giving an approximate answer.
 *
 * Positions past this are reported as a bucket, so the read stays bounded no matter how
 * large the population gets. See `formatGlobalRank` for the display side.
 */
export const POSITION_CEILING = 5_000;

/** Exact positions up to here on the live path; beyond it the number is a bucket. */
export const POSITION_EXACT_TO = 500;

/**
 * A player's position on the global ladder.
 *
 * Reads the stored field when there is one; otherwise walks the ladder in the same order
 * `leaderboard` lists it and stops at the player's own slot, so the number IS their row
 * index rather than a second opinion about it. This used to count everyone with a strictly
 * greater Elo instead, which disagreed with the board twice over: it saw a different
 * population (see `onBoardDoc`), and counting `elo >` gives every tied player the same
 * number while the board numbers them 1, 2, 3 by list position.
 *
 * `approximate` means the caller should render a bucket ("1,500+") rather than the exact
 * figure.
 */
export async function globalPosition(
  ctx: QueryCtx,
  user: Doc<"users">,
): Promise<{ position: number | null; approximate: boolean }> {
  if (user.placementsRemaining > 0) return { position: null, approximate: false };

  const field = await ladderField(ctx);
  if (field) return positionIn(field, user);

  const showRankBots = devRankBotsEnabled();
  let ahead = 0;

  // Reads no more than the old count did: the range starts at the player's own Elo, so
  // someone near the top stops after a handful of documents.
  for await (const other of ladderQuery(ctx, showRankBots, (q) =>
    q.gte("elo", user.elo),
  ).order("desc")) {
    if (other.elo === user.elo && other._creationTime <= user._creationTime) break;
    if (!onBoardDoc(other, showRankBots)) continue;
    if (++ahead > POSITION_CEILING) break;
  }

  return {
    position: ahead + 1,
    approximate: ahead >= POSITION_EXACT_TO,
  };
}

// ---------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------

type Row = {
  handle: string;
  displayName: string;
  avatarUrl?: string;
  gamesPlayed: number;
  level: number;
};

/**
 * True when two fields describe the same ladder, so the write can be skipped.
 *
 * Field by field rather than a serialised comparison: `JSON.stringify` is sensitive to key
 * order, and a document read back from Convex does not promise the order it was written
 * in — which reports every rebuild as a change and quietly defeats the whole guard.
 */
function sameField(stored: FieldDoc, entries: Entry[], rows: Row[]): boolean {
  if (stored.entries.length !== entries.length) return false;
  if (stored.rows.length !== rows.length) return false;

  for (let i = 0; i < entries.length; i++) {
    const a = stored.entries[i];
    const b = entries[i];
    if (a.u !== b.u || a.e !== b.e || a.t !== b.t) return false;
  }

  // Display fields can move without the ordering moving — a rename, or a game played that
  // bumps `gamesPlayed`. Cheaper to compare than to explain a board that never updates.
  for (let i = 0; i < rows.length; i++) {
    const a = stored.rows[i];
    const b = rows[i];
    if (
      a.handle !== b.handle ||
      a.displayName !== b.displayName ||
      a.avatarUrl !== b.avatarUrl ||
      a.gamesPlayed !== b.gamesPlayed ||
      a.level !== b.level
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Rebuilds the stored field.
 *
 * ALWAYS builds the real ladder, whatever `DEV_RANK_BOTS` says — a snapshot that
 * sometimes includes bots would be a second ladder to keep straight, and dev reads fall
 * back to the live walk instead (see `ladderField`).
 *
 * Writes the field only when it actually changed. That guard is not an optimisation: every
 * subscribed reader re-executes when this document is written, so an unconditional
 * five-minute write would cost every active user roughly 860 calls a day on a ladder where
 * nothing moved. The summary document carries the timestamps precisely so they cannot
 * dirty the payload.
 */
export const rebuild = internalMutation({
  args: {},
  handler: async (ctx: MutationCtx): Promise<{ entries: number; changed: boolean }> => {
    const scanned = await ladderQuery(ctx, false)
      .order("desc")
      .take(SNAPSHOT_MAX_ENTRIES + 1);

    /**
     * Applied even though the index already dropped every bot on this path.
     *
     * It is a provable no-op here, and that is the point: an unconditional second half
     * means there is no branch in which the builder filters differently from a reader.
     */
    const ladder = scanned.filter((user) => onBoardDoc(user, false));

    const truncated = ladder.length > SNAPSHOT_MAX_ENTRIES;
    const kept = truncated ? ladder.slice(0, SNAPSHOT_MAX_ENTRIES) : ladder;

    // No JS sort. The index already returns (elo desc, _creationTime desc); re-sorting
    // here is where a subtly different comparator would creep in and reopen the drift bug.
    const entries: Entry[] = kept.map((user) => ({
      u: user._id,
      e: user.elo,
      t: user._creationTime,
    }));

    const rows = kept.slice(0, ROW_DEPTH).map((user) => ({
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: publicAvatarUrl(user),
      gamesPlayed: user.gamesPlayed,
      level: levelForXp(user.xp ?? 0).level,
    }));

    const byTier = new Map<string, number>(RANK_TIERS.map((tier) => [tier.id, 0]));
    for (const user of kept) {
      const tierId = rankForElo(user.elo).tier.id;
      byTier.set(tierId, (byTier.get(tierId) ?? 0) + 1);
    }
    const tierCounts = RANK_TIERS.map((tier) => ({
      tierId: tier.id,
      count: byTier.get(tier.id) ?? 0,
    }));

    const existing = await ctx.db
      .query("ladderSnapshot")
      .withIndex("by_kind", (q) => q.eq("kind", "field"))
      .unique();

    const stored = existing && existing.kind === "field" ? existing : null;
    const changed = !stored || !sameField(stored, entries, rows);

    const now = Date.now();
    const generation = (stored?.generation ?? 0) + (changed ? 1 : 0);

    if (changed) {
      const field = {
        kind: "field" as const,
        generation,
        playerCount: kept.length,
        truncated,
        tierCounts,
        entries,
        rows,
      };
      if (stored) await ctx.db.replace(stored._id, field);
      else await ctx.db.insert("ladderSnapshot", field);
    }

    const summaryDoc = await ctx.db
      .query("ladderSnapshot")
      .withIndex("by_kind", (q) => q.eq("kind", "summary"))
      .unique();
    const summary = summaryDoc && summaryDoc.kind === "summary" ? summaryDoc : null;

    const summaryFields = {
      kind: "summary" as const,
      generation,
      // Only advances on a real change, so "updated 2m ago" means the board moved 2m ago
      // rather than "we looked 2m ago".
      builtAt: changed ? now : (summary?.builtAt ?? now),
      checkedAt: now,
    };

    if (summary) await ctx.db.replace(summary._id, summaryFields);
    else await ctx.db.insert("ladderSnapshot", summaryFields);

    return { entries: entries.length, changed };
  },
});

/**
 * When the board last moved, for the line under the leaderboard heading.
 *
 * Reads the SUMMARY document only — a couple of hundred bytes, no arguments and no auth,
 * so it is one cache entry shared by everybody. Pointing it at the field would drag a
 * ~400KB payload onto a page that only wants a timestamp.
 *
 * `builtAt` advances only when the ladder actually changed, so "updated 2m ago" means the
 * board moved two minutes ago rather than "we last looked two minutes ago". Returns null
 * where the board is live and there is nothing to disclose — before the first build, and
 * in dev where the rank bots bypass the snapshot entirely.
 *
 * No clock is read here. The client has `builtAt` and the interval and computes both
 * halves of the line itself, which is also the only way the countdown can actually tick.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    if (devRankBotsEnabled()) return null;

    const doc = await ctx.db
      .query("ladderSnapshot")
      .withIndex("by_kind", (q) => q.eq("kind", "summary"))
      .unique();

    if (!doc || doc.kind !== "summary") return null;

    return { builtAt: doc.builtAt, intervalMs: SNAPSHOT_INTERVAL_MS };
  },
});
