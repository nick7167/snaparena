import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { STARTING_ELO, PLACEMENT_MATCHES } from "../src/engine/config";

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

export const setHandle = mutation({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const handle = args.handle.toLowerCase().trim();

    if (!/^[a-z0-9_]{3,16}$/.test(handle)) {
      throw new Error("Handle must be 3-16 characters: letters, numbers, underscore");
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
    const limit = Math.min(args.limit ?? 50, 200);

    const ranked = await ctx.db
      .query("users")
      .withIndex("by_elo")
      .order("desc")
      .filter((q) => q.eq(q.field("placementsRemaining"), 0))
      .take(limit);

    return ranked.map((user, index) => ({
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
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      elo: user.elo,
      gamesPlayed: user.gamesPlayed,
      placementsRemaining: user.placementsRemaining,
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
