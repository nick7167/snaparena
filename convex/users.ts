import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { STARTING_ELO, PLACEMENT_MATCHES, RANK_TIERS } from "../src/engine/config";
// DEV ONLY — delete with convex/devbots.ts. Call sites: `leaderboard` and `tierCounts`.
import { devRankBotsEnabled, isDevRankBotPersona } from "../src/engine/dev-rank-bots";

/** Resolves the signed-in Clerk identity to a user row, or null when signed out. */
export async function currentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Same as currentUser, but throws — use inside mutations that require a session. */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Not signed in");
  return user;
}

/** `clerkId` prefix that marks a row as a guest rather than a Clerk identity. */
export const GUEST_CLERK_PREFIX = "guest:";

/** Guest tokens are client-generated UUIDs. Anything else is rejected outright. */
const GUEST_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidGuestToken(token: string): boolean {
  return GUEST_TOKEN_PATTERN.test(token);
}

/**
 * Resolves a guest row from a client-held bearer token.
 *
 * DELIBERATE DEVIATION from the project Convex guidelines, which say never to accept
 * a user identifier as an argument for authorization. The rule exists to stop a caller
 * naming someone else's account and acting as them, and three things close that hole
 * here:
 *
 *  1. It can ONLY ever return a row with `isGuest === true`. A token can never resolve
 *     to a Clerk-backed account, so there is no privilege to escalate into.
 *  2. A guest holds nothing worth stealing — no rating, no XP, no badges, no ladder
 *     position, and no access to ranked, practice or rooms.
 *  3. The token is a 122-bit random UUID, not a guessable identifier.
 *
 * It is accepted because there is no alternative: Clerk has no anonymous session and
 * Convex auth requires a JWT, so anonymous play means the client presents something.
 * The something is scoped to one throwaway identity that can only play the daily.
 */
export async function guestByToken(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"users"> | null> {
  if (!isValidGuestToken(token)) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", `${GUEST_CLERK_PREFIX}${token}`))
    .unique();

  // The load-bearing assertion. Without it this function would be an
  // impersonation primitive.
  if (!user?.isGuest) return null;
  return user;
}

/**
 * The user a request is acting as: the Clerk identity when signed in, otherwise the
 * guest row for the supplied token.
 *
 * A signed-in session always wins, so passing a stale token after signing in cannot
 * downgrade the caller. With no token this is exactly `currentUser` — every existing
 * signed-in code path behaves identically.
 */
export async function actingUser(
  ctx: QueryCtx | MutationCtx,
  guestToken?: string,
): Promise<Doc<"users"> | null> {
  const user = await currentUser(ctx);
  if (user) return user;
  if (!guestToken) return null;
  return await guestByToken(ctx, guestToken);
}

export const me = query({
  args: {},
  handler: async (ctx) => currentUser(ctx),
});

/**
 * Creates the user row on first sign-in, or returns the existing one.
 *
 * Convex has no unique constraints, so the clerkId check and the insert must both
 * happen inside this single transaction — that is what makes it safe against two
 * concurrent first-load requests creating duplicate rows.
 */
export const ensureUser = mutation({
  args: { displayName: v.string(), avatarUrl: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      handle: await allocateHandle(ctx, args.displayName),
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      elo: STARTING_ELO,
      gamesPlayed: 0,
      placementsRemaining: PLACEMENT_MATCHES,
      createdAt: Date.now(),
    });
  },
});

/** Derives a free handle from a display name, suffixing digits on collision. */
async function allocateHandle(ctx: MutationCtx, displayName: string): Promise<string> {
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 16) || "player";

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const taken = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", candidate))
      .unique();
    if (!taken) return candidate;
  }

  return `${base}${Date.now().toString(36)}`;
}

/**
 * Handle rules, shared by the live availability check and the write path so the
 * two can never disagree.
 */
const HANDLE_PATTERN = /^[a-z0-9_]{3,16}$/;

/** Bio cap. Short enough to read on a VS card, short enough to moderate cheaply. */
const BIO_MAX_LENGTH = 80;

/**
 * Obvious-slur blocklist.
 *
 * Deliberately small and boring: this is a speed bump proportionate to the current
 * scale, not a content-moderation system. The report action is what actually handles
 * anything this misses.
 */
const BLOCKED_TERMS = [
  "nigger", "nigga", "faggot", "fag", "retard", "tranny", "kike", "spic", "chink",
  "rape", "nazi", "hitler", "kys",
];

function containsBlockedTerm(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z]/g, "");
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}

/** Live availability check for the onboarding form. */
export const isHandleAvailable = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const handle = args.handle.toLowerCase().trim();

    if (!HANDLE_PATTERN.test(handle)) {
      return { available: false as const, reason: "invalid" as const };
    }
    if (containsBlockedTerm(handle)) {
      return { available: false as const, reason: "blocked" as const };
    }

    const taken = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();

    const me = await currentUser(ctx);
    if (taken && taken._id !== me?._id) {
      return { available: false as const, reason: "taken" as const };
    }

    return { available: true as const };
  },
});

/**
 * Completes first-run onboarding.
 *
 * Only the username is required — avatar, bio and genres are editable later, so
 * nobody is blocked from playing by a form. Setting `onboardedAt` is what dismisses
 * the modal.
 */
export const completeOnboarding = mutation({
  args: {
    handle: v.string(),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    preferredCategoryIds: v.optional(v.array(v.id("categories"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const handle = args.handle.toLowerCase().trim();

    if (!HANDLE_PATTERN.test(handle)) {
      throw new Error("Username must be 3-16 characters: letters, numbers, underscore");
    }
    if (containsBlockedTerm(handle)) throw new Error("That username isn't allowed");

    // Uniqueness is enforced here, inside the transaction — Convex has no unique
    // constraints, so checking outside would race.
    const taken = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (taken && taken._id !== user._id) throw new Error("That username is taken");

    const bio = (args.bio ?? "").trim().slice(0, BIO_MAX_LENGTH);
    if (bio && containsBlockedTerm(bio)) throw new Error("That bio isn't allowed");

    await ctx.db.patch(user._id, {
      handle,
      bio: bio || undefined,
      avatarUrl: args.avatarUrl ?? user.avatarUrl,
      preferredCategoryIds: args.preferredCategoryIds,
      onboardedAt: Date.now(),
    });

    return { handle };
  },
});

/** Profile edits after onboarding. Same validation, different entry point. */
export const updateProfile = mutation({
  args: {
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    preferredCategoryIds: v.optional(v.array(v.id("categories"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const bio = (args.bio ?? "").trim().slice(0, BIO_MAX_LENGTH);
    if (bio && containsBlockedTerm(bio)) throw new Error("That bio isn't allowed");

    await ctx.db.patch(user._id, {
      bio: bio || undefined,
      avatarUrl: args.avatarUrl ?? user.avatarUrl,
      preferredCategoryIds: args.preferredCategoryIds ?? user.preferredCategoryIds,
    });
  },
});

/** Reports a bio. Hides it immediately pending review — err toward the reader. */
/**
 * Distinct reporters required before a bio is auto-hidden.
 *
 * Hiding on a single report — which is what this did — let any one player silence any
 * other instantly and repeatedly, and directly contradicted the `reports` table's own
 * comment ("for manual review. No automated takedown."). A threshold is still only a
 * stopgap; the real answer is a review queue over the rows this writes.
 */
export const REPORTS_TO_HIDE_BIO = 3;

export const reportBio = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const reporter = await requireUser(ctx);
    if (reporter._id === args.userId) throw new Error("You cannot report yourself");

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("No such player");

    const existing = await ctx.db
      .query("reports")
      .withIndex("by_reported", (q) => q.eq("reportedUserId", args.userId))
      .collect();

    // One report per person per target. Without this, a single reporter could reach any
    // threshold alone just by pressing the button repeatedly.
    const alreadyReported = existing.some(
      (report) => report.reporterUserId === reporter._id,
    );

    if (alreadyReported) {
      return {
        reported: true as const,
        duplicate: true as const,
        hidden: target.bioHidden === true,
      };
    }

    await ctx.db.insert("reports", {
      reportedUserId: args.userId,
      reporterUserId: reporter._id,
      reason: args.reason.slice(0, 200),
      createdAt: Date.now(),
    });

    const distinctReporters = new Set([
      ...existing.map((report) => String(report.reporterUserId)),
      String(reporter._id),
    ]).size;

    const hidden = distinctReporters >= REPORTS_TO_HIDE_BIO;
    if (hidden && target.bioHidden !== true) {
      await ctx.db.patch(args.userId, { bioHidden: true });
    }

    return { reported: true as const, duplicate: false as const, hidden };
  },
});

export const setHandle = mutation({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const handle = args.handle.toLowerCase().trim();

    if (!/^[a-z0-9_]{3,16}$/.test(handle)) {
      throw new Error("Handle must be 3-16 characters: letters, numbers, underscore");
    }

    // Onboarding blocks these via isHandleAvailable; renaming afterwards did not, which
    // made the blocklist bypassable by anyone willing to sign up and immediately rename.
    if (containsBlockedTerm(handle)) {
      throw new Error("That username isn't allowed");
    }

    const taken = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();

    if (taken && taken._id !== user._id) throw new Error("That handle is taken");

    await ctx.db.patch(user._id, { handle });
  },
});

/**
 * Who counts as being on the ladder — the half of the rule an index filter can express.
 *
 * Shared by `leaderboard` and by `globalPosition` below. These two used to carry their
 * own copies of the rule and they disagreed: the position count excluded bots
 * unconditionally while the board included the sixteen dev rank bots, so every bot
 * counted zero players above it and every bot profile read "#1 global". A rank and the
 * list it refers to have to be measured against the same set of people.
 *
 * This is only half the rule. `onBoardDoc` is the other half and both are required —
 * see the note there.
 *
 * `q` is deliberately untyped — Convex's filter builder is structurally identical across
 * the two call sites but not nameable from here.
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
function onBoardDoc(user: Doc<"users">, showRankBots: boolean): boolean {
  return !user.isBot || (showRankBots && isDevRankBotPersona(user.botPersonaId));
}

/**
 * How far down the ladder we are willing to count before giving an approximate answer.
 *
 * Positions past this are reported as a bucket, so the read stays bounded no matter how
 * large the population gets. See `formatGlobalRank` for the display side.
 */
const POSITION_CEILING = 5_000;

/** Exact positions up to here; beyond it the number is rounded down to a bucket. */
const POSITION_EXACT_TO = 500;

/**
 * A player's position on the global ladder.
 *
 * Walks the ladder in the same order `leaderboard` lists it and stops at the player's
 * own slot, so the number IS their row index rather than a second opinion about it.
 * This used to count everyone with a strictly greater Elo instead, which disagreed with
 * the board twice over: it saw a different population (see `onBoardDoc`), and counting
 * `elo >` gives every tied player the same number while the board numbers them 1, 2, 3
 * by list position. Deriving the position from the same walk makes both impossible.
 *
 * `approximate` means the caller should render a bucket ("1,500+") rather than the exact
 * figure — either because the position is past POSITION_EXACT_TO, or because it hit the
 * ceiling and the true number is unknown.
 */
export async function globalPosition(
  ctx: QueryCtx,
  user: Doc<"users">,
): Promise<{ position: number | null; approximate: boolean }> {
  if (user.placementsRemaining > 0) return { position: null, approximate: false };

  const showRankBots = devRankBotsEnabled();
  let ahead = 0;

  // Reads no more than the old count did: the range starts at the player's own Elo, so
  // someone near the top stops after a handful of documents.
  for await (const other of ctx.db
    .query("users")
    .withIndex("by_elo", (q) => q.gte("elo", user.elo))
    .order("desc")
    .filter((q) => onBoard(q, showRankBots))) {
    // Convex appends `_creationTime` to every index, so `by_elo` descending is a total
    // order and ties come back newest first. Once an entry sorts at or past the
    // player's own slot, everything left is below them. Compared by slot rather than by
    // `_id` so a player the filter excludes still terminates here instead of walking to
    // the ceiling.
    if (other.elo === user.elo && other._creationTime <= user._creationTime) break;
    if (!onBoardDoc(other, showRankBots)) continue;
    if (++ahead > POSITION_CEILING) break;
  }

  return {
    position: ahead + 1,
    approximate: ahead >= POSITION_EXACT_TO,
  };
}

/** Global Elo ladder. Players still in placements are excluded — they have no rank yet. */
export const leaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);

    // DEV ONLY — delete with convex/devbots.ts. The sixteen rank bots exist to make this
    // board show every rank at once; the twelve shipping practice bots stay hidden either
    // way, which is why the relaxed path still filters on the persona prefix below.
    const showRankBots = devRankBotsEnabled();

    const ranked = await ctx.db
      .query("users")
      .withIndex("by_elo")
      .order("desc")
      .filter((q) => onBoard(q, showRankBots))
      // Over-read only on the dev path, since the prefix filter below cannot be
      // expressed in the index scan and would otherwise cut the page short.
      .take(showRankBots ? limit * 2 : limit);

    // Applied unconditionally, and via the same helper `globalPosition` uses. It is a
    // no-op off the dev path — `onBoard` has already dropped every bot — and keeping it
    // unconditional means there is no branch in which one reader filters and the other
    // does not.
    const visible = ranked
      .filter((user) => onBoardDoc(user, showRankBots))
      .slice(0, limit);

    return visible.map((user, index) => ({
      rank: index + 1,
      userId: user._id,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      elo: user.elo,
      gamesPlayed: user.gamesPlayed,
    }));
  },
});

/**
 * Where the signed-in player stands, for the leaderboard's pinned row.
 *
 * Separate from `me` on purpose. The sidebar subscribes to `me` on every page, and
 * `globalPosition` can read up to 5,000 rows — that cost belongs on the one screen that
 * asks the question, not on every screen in the app.
 */
export const myStanding = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    const { position, approximate } = await globalPosition(ctx, user);
    return {
      elo: user.elo,
      gamesPlayed: user.gamesPlayed,
      placementsRemaining: user.placementsRemaining,
      position,
      approximate,
    };
  },
});

/**
 * The rating swing from the player's most recent ranked match.
 *
 * Feeds the sidebar Play button, which now reads "1204 / ▲+18" — the control you press to
 * move the number also tells you which way it last moved.
 *
 * Its own query rather than a field on `me`, for the same reason `myStanding` is separate:
 * the sidebar subscribes to `me` on every page in the app, and widening that payload makes
 * every screen pay for something only one control reads.
 *
 * No match lookups. `ratingDelta` is written in exactly one place — `applyRanked` in
 * progression.ts, which only runs for `mode === "ranked"` at completion — so its presence
 * on a row already means "a ranked match that finished". Fetching each match to re-confirm
 * that would triple the read for no new information.
 */
const RATING_CHANGE_SCAN = 20;

export const lastRatingChange = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    // Bounded: a player whose last 20 matches were all practice or rooms simply gets no
    // delta, which renders as the rating alone. That is the correct answer, not a reason
    // to walk the whole history.
    const rows = await ctx.db
      .query("matchPlayers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(RATING_CHANGE_SCAN);

    const rated = rows.find((row) => row.ratingDelta !== undefined);
    return rated?.ratingDelta ?? null;
  },
});

/**
 * How many placed players sit in each rank tier.
 *
 * The ladder is grouped into tier bands now, and a band header that cannot say how many
 * people are in it is just a coloured rule. Counts are what make the ladder read as a
 * population you are climbing through rather than a list that happens to be sorted.
 *
 * Deliberately bounded and honest rather than exact. Convex has no count operator, and the
 * guidelines are explicit that counting rows by reading them does not scale — so each tier
 * reads at most `TIER_COUNT_CAP + 1` documents through the `by_elo` range and reports
 * `approximate` when it hits the cap, which the client renders as "50+". Six tiers puts the
 * worst case at ~306 documents, and Bronze being "50+" rather than 4,812 costs the reader
 * nothing.
 *
 * The alternative — @convex-dev/aggregate — is the right answer if these ever need to be
 * exact, but it is a component plus a backfill, and no header on this page needs a precise
 * number.
 */
const TIER_COUNT_CAP = 50;

export const tierCounts = query({
  args: {},
  handler: async (ctx) => {
    const showRankBots = devRankBotsEnabled();

    return await Promise.all(
      RANK_TIERS.map(async (tier, index) => {
        const next = RANK_TIERS[index + 1];

        // The range is the tier's own Elo band: at or above its floor, below the next
        // tier's. The top tier has no ceiling, so its range is open-ended.
        const rows = await ctx.db
          .query("users")
          .withIndex("by_elo", (q) =>
            next
              ? q.gte("elo", tier.minElo).lt("elo", next.minElo)
              : q.gte("elo", tier.minElo),
          )
          .filter((q) => onBoard(q, showRankBots))
          .take(TIER_COUNT_CAP + 1);

        // Applied after the index scan for the same reason `leaderboard` does it: the
        // dev-bot persona check cannot be expressed as an index filter, and both readers
        // have to agree about who is on the board.
        const visible = rows.filter((user) => onBoardDoc(user, showRankBots));

        return {
          tierId: tier.id,
          count: Math.min(visible.length, TIER_COUNT_CAP),
          approximate: visible.length > TIER_COUNT_CAP,
        };
      }),
    );
  },
});

/** Public profile: overall rating plus the per-category breakdown. */
export const profile = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle.toLowerCase()))
      .unique();

    if (!user) return null;

    const categoryRatings = await ctx.db
      .query("categoryRatings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const categories = await Promise.all(
      categoryRatings.map(async (rating) => ({
        ...rating,
        category: await ctx.db.get(rating.categoryId),
      })),
    );

    return {
      // Lets the profile page chain into matches.card, which holds the badges, bio and
      // level this query does not. The two are complementary rather than redundant:
      // only this one has the per-category breakdown.
      userId: user._id,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      elo: user.elo,
      gamesPlayed: user.gamesPlayed,
      placementsRemaining: user.placementsRemaining,
      isBot: user.isBot === true,
      categories: categories
        .filter((entry) => entry.category !== null)
        .map((entry) => ({
          slug: entry.category!.slug,
          name: entry.category!.name,
          rating: entry.rating,
          games: entry.games,
        }))
        .sort((a, b) => b.rating - a.rating),
    };
  },
});
