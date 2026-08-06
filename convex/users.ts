import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { publicAvatarUrl } from "./avatar";
import {
  STARTING_ELO,
  PLACEMENT_MATCHES,
  RANK_TIERS,
  HANDLE_MAX_LENGTH,
  BIO_MAX_LENGTH,
} from "../src/engine/config";
import { computeStreak, dayKey } from "../src/engine/streak";
import { levelForXp } from "../src/engine/xp";
// DEV ONLY — delete with convex/devbots.ts. Call sites: `leaderboard` and `tierCounts`.
import { devRankBotsEnabled } from "../src/engine/dev-rank-bots";
import {
  POSITION_CEILING,
  POSITION_EXACT_TO,
  boundIn,
  entryIndexOf,
  globalPosition,
  ladderField,
  ladderQuery,
  onBoardDoc,
  positionIn,
} from "./ladder";
import { resolveConfig } from "./config";

// Re-exported so `matches.ts` and friends keep importing it from here.
export { globalPosition };

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
      .slice(0, HANDLE_MAX_LENGTH) || "player";

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
const HANDLE_PATTERN = /^[a-z0-9_]{3,12}$/;

/**
 * Avatar upload limits.
 *
 * The client re-encodes to a 256px square before uploading, so anything arriving near this
 * ceiling did not come from our own form. The cap exists for that case: the upload URL is
 * reachable directly, which makes the client's own limit a convenience rather than a
 * control.
 */
const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_CONTENT_TYPES = ["image/webp", "image/jpeg", "image/png"];

/** Avatar colours are written as `color:#rrggbb` — the only string `updateProfile` takes. */
const AVATAR_COLOUR_PATTERN = /^color:#[0-9a-fA-F]{6}$/;

/**
 * The avatar as everyone else should see it.
 *
 * A reported picture falls back to the initial-on-colour rather than vanishing — the
 * player keeps an avatar, they just lose the image. Every public reader goes through this
 * so a hidden picture cannot survive on one surface after being pulled from another; the
 * bio has exactly this problem shape and solves it the same way.
 *
 * `users.me` deliberately does NOT use it. That query only ever returns the caller's own
 * row, and hiding someone's picture from themselves would leave them unable to tell why
 * it looks wrong to everyone else or to go and change it.
 */
export { publicAvatarUrl };

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
      throw new Error(
        `Username must be 3-${HANDLE_MAX_LENGTH} characters: letters, numbers, underscore`,
      );
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

    // Same rule as `updateProfile`: a colour swatch, or nothing. An uploaded picture
    // arrives through `setAvatarImage`, and keeping the one Clerk supplied means simply
    // not sending this field.
    if (args.avatarUrl !== undefined && !AVATAR_COLOUR_PATTERN.test(args.avatarUrl)) {
      throw new Error("Unsupported avatar");
    }

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

    /**
     * Every field is INDEPENDENTLY optional, and that is a correctness requirement rather
     * than a convenience.
     *
     * This used to compute `(args.bio ?? "").trim()` unconditionally and patch the result,
     * so a call that set only `preferredCategoryIds` resolved bio to `""` and then to
     * `undefined` — which in a Convex patch removes the field. Updating your favourite
     * genres silently deleted your tagline.
     *
     * Nothing hit it while the only caller sent all three fields at once, but Settings now
     * has separate sections that each save one thing, which is exactly the shape that
     * would have triggered it. Guarded the same way `avatarUrl` below already was.
     */
    const bio =
      args.bio === undefined ? undefined : args.bio.trim().slice(0, BIO_MAX_LENGTH);
    if (bio && containsBlockedTerm(bio)) throw new Error("That bio isn't allowed");

    /**
     * Only a colour swatch may be set through here.
     *
     * This argument used to accept any string and store it verbatim — which meant a
     * crafted call could point a player's avatar at any third-party URL, and that URL
     * would then be fetched by every browser rendering the ladder. Uploads have their own
     * mutation; keeping the picture Clerk supplied at sign-up needs no write at all,
     * because `ensureUser` already put it there.
     */
    if (args.avatarUrl !== undefined && !AVATAR_COLOUR_PATTERN.test(args.avatarUrl)) {
      throw new Error("Unsupported avatar");
    }

    // Choosing a colour clears any uploaded file, so storage does not keep a picture the
    // player has visibly replaced.
    if (args.avatarUrl !== undefined && user.avatarStorageId) {
      await ctx.storage.delete(user.avatarStorageId);
    }

    await ctx.db.patch(user._id, {
      // Spread rather than assigned, so an absent argument leaves the stored value alone.
      // An empty string IS a deliberate clear — that is how a player removes their bio.
      ...(bio === undefined ? {} : { bio: bio || undefined }),
      avatarUrl: args.avatarUrl ?? user.avatarUrl,
      ...(args.avatarUrl !== undefined
        ? { avatarStorageId: undefined, avatarHidden: undefined }
        : {}),
      preferredCategoryIds: args.preferredCategoryIds ?? user.preferredCategoryIds,
    });
  },
});

/**
 * Step one of an upload: a one-time URL the browser can POST the file to.
 *
 * Signed in only. The URL itself carries no size or type restriction — that is enforced
 * in `setAvatarImage`, once the file exists and its real metadata can be read.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Step two: adopt an uploaded file as this player's avatar.
 *
 * Validation happens here rather than in the browser because the upload URL is reachable
 * without going through our form — the client's own resize and type check make the common
 * path cheap, and this is what actually holds.
 *
 * The URL is resolved once and stored. Convex serving URLs stay valid until the file is
 * deleted, so there is nothing to refresh, and every reader — the ladder, the VS screen,
 * every profile — keeps reading a plain string with no storage lookup of its own.
 */
export const setAvatarImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const file = await ctx.db.system.get("_storage", args.storageId);
    if (!file) throw new Error("That upload could not be found");

    const rejected =
      file.size > AVATAR_MAX_BYTES ||
      !file.contentType ||
      !AVATAR_CONTENT_TYPES.includes(file.contentType);

    if (rejected) {
      // Drop it rather than leaving a rejected file sitting in storage unreferenced.
      await ctx.storage.delete(args.storageId);
      throw new Error("That image is too large or not a supported format");
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("That upload could not be read");

    // Delete what this replaces. Done after the new file is known good, so a failed
    // upload never costs the player the picture they already had.
    if (user.avatarStorageId) {
      await ctx.storage.delete(user.avatarStorageId);
    }

    await ctx.db.patch(user._id, {
      avatarUrl: url,
      avatarStorageId: args.storageId,
      // A fresh picture starts unhidden; the reports that hid the last one were about a
      // different image.
      avatarHidden: undefined,
    });

    return { url };
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

/**
 * Reports a player's bio or avatar.
 *
 * `kind` is counted separately, so three people objecting to a tagline do not also take
 * down a picture that nobody complained about. Rows written before avatars existed have no
 * `kind` at all and read as the bio reports they were.
 */
export const reportProfile = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
    kind: v.union(v.literal("bio"), v.literal("avatar")),
  },
  handler: async (ctx, args) => {
    const reporter = await requireUser(ctx);
    if (reporter._id === args.userId) throw new Error("You cannot report yourself");

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("No such player");

    const isHidden = () =>
      args.kind === "bio" ? target.bioHidden === true : target.avatarHidden === true;

    const all = await ctx.db
      .query("reports")
      .withIndex("by_reported", (q) => q.eq("reportedUserId", args.userId))
      .collect();

    // An absent `kind` is a bio report — every row predating avatars is one.
    const existing = all.filter((report) => (report.kind ?? "bio") === args.kind);

    // One report per person per target per kind. Without this, a single reporter could
    // reach any threshold alone just by pressing the button repeatedly.
    const alreadyReported = existing.some(
      (report) => report.reporterUserId === reporter._id,
    );

    if (alreadyReported) {
      return { reported: true as const, duplicate: true as const, hidden: isHidden() };
    }

    await ctx.db.insert("reports", {
      reportedUserId: args.userId,
      reporterUserId: reporter._id,
      kind: args.kind,
      reason: args.reason.slice(0, 200),
      createdAt: Date.now(),
    });

    const distinctReporters = new Set([
      ...existing.map((report) => String(report.reporterUserId)),
      String(reporter._id),
    ]).size;

    const hidden = distinctReporters >= REPORTS_TO_HIDE_BIO;
    if (hidden && !isHidden()) {
      await ctx.db.patch(
        args.userId,
        args.kind === "bio" ? { bioHidden: true } : { avatarHidden: true },
      );
    }

    return { reported: true as const, duplicate: false as const, hidden };
  },
});

export const setHandle = mutation({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const handle = args.handle.toLowerCase().trim();

    // The shared constant, not a second copy of the pattern. This path had its own
    // inline regex, which is how the two rules drift: the cap changed in one place and
    // this one would have gone on accepting sixteen characters.
    if (!HANDLE_PATTERN.test(handle)) {
      throw new Error(
        `Handle must be 3-${HANDLE_MAX_LENGTH} characters: letters, numbers, underscore`,
      );
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

/** Global Elo ladder. Players still in placements are excluded — they have no rank yet. */
export const leaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    /**
     * Still impersonal, so the shared cache entry does not fork.
     *
     * This reads the settings row and the current version row — both global documents, the
     * same for every viewer — rather than anything about the caller. A config save does
     * now invalidate the board, which is correct: the levels it renders would be stale
     * otherwise.
     */
    const config = await resolveConfig(ctx);

    /**
     * 500, raised from 200.
     *
     * The board is banded by rank tier and each band pages independently, so the ceiling
     * is no longer "how many rows fit on screen" but "how deep can a band be expanded".
     * At 200 the lower tiers — which is most of the population — could not be opened at
     * all. Bounded rather than unbounded: the page reads a fixed slice of the ladder, and
     * a band that runs past it still reports its true size from `tierCounts`.
     */
    const limit = Math.min(args.limit ?? 50, 500);

    /**
     * From the stored field when there is one — and then this reads NO user documents at
     * all, which matters because it is the heaviest read in the app and every viewer holds
     * it open for the whole session.
     *
     * Deliberately impersonal: no `currentUser` call, so it stays one cache entry shared
     * by everybody. The viewer's own row is spliced in on the client, where it costs
     * nothing, rather than forking this cache per identity.
     */
    const field = await ladderField(ctx);
    if (field) {
      const depth = Math.min(limit, field.rows.length);
      return field.rows.slice(0, depth).map((row, index) => ({
        rank: index + 1,
        userId: field.entries[index].u,
        handle: row.handle,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        // The field's Elo, not a fresh read: the row number and the rating it is derived
        // from have to come from the same instant or the board contradicts itself.
        elo: field.entries[index].e,
        gamesPlayed: row.gamesPlayed,
        level: row.level,
      }));
    }

    // DEV ONLY — delete with convex/devbots.ts. The sixteen rank bots exist to make this
    // board show every rank at once; the twelve shipping practice bots stay hidden either
    // way, which is why the relaxed path still filters on the persona prefix below.
    const showRankBots = devRankBotsEnabled();

    const ranked = await ladderQuery(ctx, showRankBots)
      .order("desc")
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
      avatarUrl: publicAvatarUrl(user),
      elo: user.elo,
      gamesPlayed: user.gamesPlayed,
      // Free — the row is already loaded, and a ladder showing only rating says
      // nothing about how much of the game someone has actually played.
      level: levelForXp(user.xp ?? 0, config).level,
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
    /**
     * Exact, once there is a stored field — the builder walks the whole ladder anyway, so
     * bucketing it costs nothing and the cap stops applying. A band header reads "4,812"
     * instead of "50+", which the existing markup already handles.
     */
    const field = await ladderField(ctx);
    if (field) {
      return RANK_TIERS.map((tier) => ({
        tierId: tier.id,
        count: field.tierCounts.find((stored) => stored.tierId === tier.id)?.count ?? 0,
        approximate: false,
      }));
    }

    const showRankBots = devRankBotsEnabled();

    return await Promise.all(
      RANK_TIERS.map(async (tier, index) => {
        const next = RANK_TIERS[index + 1];

        // The range is the tier's own Elo band: at or above its floor, below the next
        // tier's. The top tier has no ceiling, so its range is open-ended.
        const rows = await ladderQuery(ctx, showRankBots, (q) =>
          next
            ? q.gte("elo", tier.minElo).lt("elo", next.minElo)
            : q.gte("elo", tier.minElo),
        ).take(TIER_COUNT_CAP + 1);

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

/**
 * How many players are on the ladder at all.
 *
 * Exists so a position can become a proportion. "#142" is a fact with no scale attached;
 * "#142 · top 12%" is the same fact and an answer. Three surfaces want it — the dashboard
 * banner, the ranked hero and the leaderboard's own standing — so it is one query rather
 * than three counts that would drift.
 *
 * Bounded and honest, the same way `tierCounts` and `daily.todayStats` are: Convex has no
 * count operator and the guidelines are explicit that counting rows by reading them does
 * not scale, so this reads at most `LADDER_COUNT_CAP + 1` documents and says when it hit
 * the ceiling. A caller that gets `approximate` should render a floor ("top 20% of 5,000+")
 * rather than a percentage it cannot support.
 *
 * Measured against the SAME population the board shows — `onBoard` plus `onBoardDoc`, both
 * halves — because a percentile computed over a different set than the position it divides
 * is a wrong number that looks right.
 */
const LADDER_COUNT_CAP = 5_000;

export const rankedPlayerCount = query({
  args: {},
  handler: async (ctx) => {
    const showRankBots = devRankBotsEnabled();

    // The builder already counted, exactly, over the same population the board lists.
    const field = await ladderField(ctx);
    if (field) {
      return {
        count: Math.min(field.playerCount, LADDER_COUNT_CAP),
        approximate: field.truncated,
      };
    }

    const rows = await ladderQuery(ctx, showRankBots).take(LADDER_COUNT_CAP + 1);

    const visible = rows.filter((user) => onBoardDoc(user, showRankBots));

    return {
      count: Math.min(visible.length, LADDER_COUNT_CAP),
      approximate: visible.length > LADDER_COUNT_CAP,
    };
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

    /**
     * The genres this player said they liked, resolved to names.
     *
     * `preferredCategoryIds` was written by onboarding from the day it existed and read by
     * nothing — no query, no matchmaking path, no screen. Asking a new player to declare
     * their taste and then discarding the answer is a question that should not have been
     * asked; this is the cheaper of the two ways to make it honest.
     *
     * Deliberately DISTINCT from `categories` below, which is measured performance from
     * `categoryRatings`. One is what they say they like, the other is what they are
     * actually good at, and conflating them would be a lie in both directions.
     *
     * Bounded by the number of categories in the app, so the fan-out is small and fixed.
     */
    const preferred = (
      await Promise.all((user.preferredCategoryIds ?? []).map((id) => ctx.db.get(id)))
    )
      .filter((category) => category !== null)
      .map((category) => ({ slug: category.slug, name: category.name }));

    return {
      // Lets the profile page chain into matches.card, which holds the badges, bio and
      // level this query does not. The two are complementary rather than redundant:
      // only this one has the per-category breakdown.
      userId: user._id,
      preferred,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: publicAvatarUrl(user),
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

/**
 * How many `matchPlayers` rows the streak walk reads.
 *
 * A budget in ROWS, not days, and the two come apart fast: someone playing one match a
 * day gets over a year of history out of this, someone playing eight gets seven weeks.
 * That is the honest trade for a single indexed read with no joins, and `approximate`
 * tells the caller when the ceiling was the thing that stopped the walk rather than a
 * genuine gap.
 */
const STREAK_SCAN = 400;

/**
 * Consecutive days the player has played anything at all.
 *
 * Cheap because of an accident of the schema worth stating: a daily run creates a
 * `matchPlayers` row exactly as a duel does — that is how `xpEarnedForRun` finds one —
 * so ONE scan of `by_user` covers ranked, practice, rooms and the daily together. No
 * `matches` lookups, no second index, and `_creationTime` is the day it was played.
 *
 * Computed on read rather than denormalised onto `users`: there is nothing to backfill,
 * no write path to add to `finalizeMatch`, and a derived number cannot drift out of sync
 * with the matches it claims to describe. The walk itself lives in `src/engine/streak.ts`
 * so its three awkward rules — today is not yet a miss, one gap is absorbed, a second
 * ends the run — are covered by unit tests instead of by playing on consecutive days.
 */
export const dailyStreak = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;

    const rows = await ctx.db
      .query("matchPlayers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(STREAK_SCAN);

    const activeDays = new Set(rows.map((row) => dayKey(row._creationTime)));

    return computeStreak(activeDays, Date.now(), rows.length >= STREAK_SCAN);
  },
});

/** Players shown either side of you. Five rows total fits the panel without scrolling. */
const NEIGHBOUR_REACH = 2;

/**
 * The players immediately above and below you on the ladder.
 *
 * Turns an abstract "#142" into a target: the gap to the player ahead is a number you can
 * close in one match. Walks `by_elo` exactly as `globalPosition` does — same order, same
 * `onBoard`/`onBoardDoc` pair, same ceiling — and keeps a rolling window instead of only
 * a counter. Reusing that rule rather than restating it is deliberate: the board and the
 * position count have already drifted apart twice, both times because a second reader
 * measured against a population the board did not show.
 */
export const ladderNeighbours = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    // No rank yet means no neighbours — the panel hides rather than inventing a slot.
    if (!user || user.placementsRemaining > 0) return null;

    const field = await ladderField(ctx);
    if (field) {
      const bound = boundIn(field, user);
      const mine = entryIndexOf(field, user._id);
      const { position, approximate } = positionIn(field, user);

      /**
       * Both walks skip the player's own stored entry, and that skip is what makes the
       * relative positions come out right in all three cases — rating unchanged, risen or
       * fallen. Worth spelling out for the risen case: the entry now sitting at `bound`
       * has `bound` entries above it in the field PLUS the player, so its true position is
       * `bound + 2`, which is exactly `position + 1`.
       *
       * The old two-walk version needed an explicit "skip anyone tied but ranked above"
       * guard so nobody appeared on both sides. That disappears here: a tie ranked above
       * sits at an index below `bound` by definition of the comparator, so it can only
       * ever land in `above`. The binary search IS the tie rule.
       */
      const aboveEntries = [];
      for (let i = bound - 1; i >= 0 && aboveEntries.length < NEIGHBOUR_REACH; i--) {
        if (i === mine) continue;
        aboveEntries.push(field.entries[i]);
      }
      aboveEntries.reverse();

      const belowEntries = [];
      for (
        let i = bound;
        i < field.entries.length && belowEntries.length < NEIGHBOUR_REACH;
        i++
      ) {
        if (i === mine) continue;
        belowEntries.push(field.entries[i]);
      }

      /**
       * Identity comes from the document, rating comes from the field.
       *
       * Reading the neighbour's live Elo here would let the panel show "@kilo 1480" sitting
       * above "you 1500", because the ordering it was placed in came from the snapshot.
       * Four document reads, down from thousands.
       */
      const hydrate = async (entry: { u: Id<"users">; e: number }, offset: number) => {
        const doc = await ctx.db.get(entry.u);
        return {
          userId: entry.u,
          handle: doc?.handle ?? "",
          displayName: doc?.displayName ?? "",
          avatarUrl: doc ? publicAvatarUrl(doc) : undefined,
          elo: entry.e,
          position: position + offset,
          /** Signed, from the player's point of view: positive means they are ahead of you. */
          gap: entry.e - user.elo,
        };
      };

      return {
        position,
        approximate,
        elo: user.elo,
        above: await Promise.all(
          aboveEntries.map((entry, index) => hydrate(entry, index - aboveEntries.length)),
        ),
        below: await Promise.all(
          belowEntries.map((entry, index) => hydrate(entry, index + 1)),
        ),
      };
    }

    const showRankBots = devRankBotsEnabled();

    /** The last NEIGHBOUR_REACH players ahead, oldest-first once the walk stops. */
    const above: Doc<"users">[] = [];
    let ahead = 0;
    let truncated = false;

    for await (const other of ladderQuery(ctx, showRankBots, (q) =>
      q.gte("elo", user.elo),
    ).order("desc")) {
      // Same terminator as globalPosition: ties come back newest first, so this is the
      // player's own slot in the total order.
      if (other.elo === user.elo && other._creationTime <= user._creationTime) break;
      if (!onBoardDoc(other, showRankBots)) continue;

      above.push(other);
      if (above.length > NEIGHBOUR_REACH) above.shift();
      if (++ahead > POSITION_CEILING) {
        truncated = true;
        break;
      }
    }

    // Everything at or below the player's Elo, skipping the player's own row.
    const below: Doc<"users">[] = [];
    for await (const other of ladderQuery(ctx, showRankBots, (q) =>
      q.lte("elo", user.elo),
    ).order("desc")) {
      if (other._id === user._id) continue;
      // Skip anyone tied but ranked ABOVE the player, or they would appear on both sides.
      if (other.elo === user.elo && other._creationTime > user._creationTime) continue;
      if (!onBoardDoc(other, showRankBots)) continue;

      below.push(other);
      if (below.length >= NEIGHBOUR_REACH) break;
    }

    const position = ahead + 1;
    const row = (other: Doc<"users">, offset: number) => ({
      userId: other._id,
      handle: other.handle,
      displayName: other.displayName,
      avatarUrl: publicAvatarUrl(other),
      elo: other.elo,
      position: position + offset,
      /** Signed, from the player's point of view: positive means they are ahead of you. */
      gap: other.elo - user.elo,
    });

    return {
      position,
      approximate: truncated || ahead >= POSITION_EXACT_TO,
      elo: user.elo,
      above: above.map((other, index) => row(other, index - above.length)),
      below: below.map((other, index) => row(other, index + 1)),
    };
  },
});
