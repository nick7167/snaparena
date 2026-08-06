import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./roles";
import {
  mergeConfig,
  type ConfigOverrides,
  type ResolvedConfig,
} from "../src/engine/config-merge";
import { defaultFor, validateOverrides } from "../src/engine/config-registry";

/**
 * Reading and writing the live game configuration.
 *
 * `src/engine/config.ts` remains the shipped baseline. Everything here deals only in
 * DIFFERENCES from it, which is why an empty database runs the game exactly as the code
 * does and why nothing needs migrating when a constant is added.
 *
 * The read path has one rule that matters more than any other: a match resolves its config
 * ONCE, from the version it was created under, and reads that until it ends. Saving new
 * values cannot change scoring, HP or damage underneath two players halfway through a
 * round. See `matches.configVersionId`.
 */

/** The settings singleton, or null before anything has ever been saved. */
export async function getSettings(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"settings"> | null> {
  // One row by construction, so `first()` is the whole table read and is bounded.
  return await ctx.db.query("settings").first();
}

/** Stored pairs to the flat map `mergeConfig` wants. */
function toOverrides(version: Doc<"configVersions"> | null): ConfigOverrides {
  const overrides: ConfigOverrides = {};
  for (const entry of version?.values ?? []) overrides[entry.key] = entry.value;
  return overrides;
}

/**
 * Resolves the config a caller should use.
 *
 * Pass a match's `configVersionId` to get the rules that match is being played under; pass
 * nothing to get what is current. A missing or deleted version resolves to the shipped
 * defaults rather than throwing — this runs on the round path, and a config lookup must
 * never be the thing that takes a live match down.
 */
export async function resolveConfig(
  ctx: QueryCtx | MutationCtx,
  versionId?: Id<"configVersions"> | null,
): Promise<ResolvedConfig> {
  if (versionId) {
    return mergeConfig(toOverrides(await ctx.db.get(versionId)));
  }

  const settings = await getSettings(ctx);
  if (!settings?.currentVersionId) return mergeConfig();

  return mergeConfig(toOverrides(await ctx.db.get(settings.currentVersionId)));
}

/**
 * Whether the operator surfaces exist on this deployment at all.
 *
 * The rank-bot roster, the instant-win bar and the developer tools drawer all hang off
 * this. It replaces the `DEV_RANK_BOTS` environment variable, which could only be changed
 * from a terminal because a Convex function cannot write its own environment.
 *
 * DEFAULTS TO FALSE, including on a deployment that still has the old variable set. There
 * is deliberately no fallback to it: two sources of truth for a switch that decides
 * whether players can hand themselves a rated win is worse than one that has to be turned
 * on explicitly after the migration.
 *
 * This is a deployment-wide switch, not a permission. Who may USE these surfaces is still
 * the admin role — see `requireAdmin` in roles.ts, which every one of them also checks.
 */
export async function devFeaturesEnabled(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return (await getSettings(ctx))?.devFeaturesEnabled ?? false;
}

/** Turns the operator surfaces on or off for the whole deployment. */
export const setDevFeatures = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const settings = await getSettings(ctx);
    if (settings) {
      await ctx.db.patch(settings._id, {
        devFeaturesEnabled: args.enabled,
        updatedAt: Date.now(),
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("settings", {
        devFeaturesEnabled: args.enabled,
        updatedAt: Date.now(),
        updatedBy: admin._id,
      });
    }

    return { enabled: args.enabled };
  },
});

/** The version new matches should be stamped with. Null means "stock". */
export async function currentVersionId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"configVersions"> | undefined> {
  const settings = await getSettings(ctx);
  return settings?.currentVersionId;
}

/**
 * The live config, for the client.
 *
 * Public and unauthenticated: these are tuning values that already ship inside the client
 * bundle, and the sign-in screen needs them as much as a match does.
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    return {
      config: await resolveConfig(ctx),
      versionId: settings?.currentVersionId ?? null,
      devFeaturesEnabled: settings?.devFeaturesEnabled ?? false,
    };
  },
});

/**
 * The overrides currently in force, as stored.
 *
 * Separate from `current` because the console needs to know which values are OVERRIDDEN
 * rather than merely what they resolve to — a field showing 500 should look different when
 * 500 is the shipped default and when someone typed it.
 */
export const overrides = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await getSettings(ctx);
    const version = settings?.currentVersionId
      ? await ctx.db.get(settings.currentVersionId)
      : null;
    return { values: version?.values ?? [], versionId: version?._id ?? null };
  },
});

const overrideEntry = v.object({
  key: v.string(),
  value: v.union(v.number(), v.null()),
});

/**
 * Writes a new config version and makes it current.
 *
 * VALIDATES SERVER-SIDE, against the same registry the form uses. Not belt and braces: a
 * mutation is reachable from a console without the page ever being loaded, so a form that
 * checks bounds and a mutation that trusts it is a suggestion rather than a guard.
 *
 * The whole override set is replaced rather than merged, so removing a key from `values`
 * is how a field returns to its shipped default.
 */
export const save = mutation({
  args: {
    values: v.array(overrideEntry),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const overrides: ConfigOverrides = {};
    for (const entry of args.values) overrides[entry.key] = entry.value;

    const problems = validateOverrides(overrides);
    if (problems.length > 0) throw new Error(problems.join("; "));

    /**
     * Drop anything that merely restates the default.
     *
     * Keeps the stored set to genuine differences, which is what makes the history legible
     * — a version row should say what somebody changed, not repeat the config back. It is
     * also what makes "reset this field" a deletion rather than a write of the old number.
     */
    const meaningful = args.values.filter((entry) => entry.value !== defaultFor(entry.key));

    const versionId = await ctx.db.insert("configVersions", {
      values: meaningful,
      createdAt: Date.now(),
      createdBy: admin._id,
      note: args.note,
    });

    await pointAt(ctx, versionId, admin._id);
    return { versionId, applied: meaningful.length };
  },
});

/** Creates the settings row on first use, then repoints it. */
async function pointAt(
  ctx: MutationCtx,
  versionId: Id<"configVersions"> | undefined,
  adminId: Id<"users">,
): Promise<void> {
  const settings = await getSettings(ctx);
  if (settings) {
    await ctx.db.patch(settings._id, {
      currentVersionId: versionId,
      updatedAt: Date.now(),
      updatedBy: adminId,
    });
    return;
  }

  await ctx.db.insert("settings", {
    currentVersionId: versionId,
    devFeaturesEnabled: false,
    updatedAt: Date.now(),
    updatedBy: adminId,
  });
}

/** Every saved version, newest first. Admins only — this is operator history. */
export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const settings = await getSettings(ctx);
    const versions = await ctx.db
      .query("configVersions")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(args.limit ?? 25, 100));

    const authors = new Map<string, string>();
    for (const version of versions) {
      if (!version.createdBy || authors.has(version.createdBy)) continue;
      const user = await ctx.db.get(version.createdBy);
      authors.set(version.createdBy, user?.handle ?? "unknown");
    }

    return versions.map((version) => ({
      versionId: version._id,
      createdAt: version.createdAt,
      note: version.note ?? null,
      author: version.createdBy ? (authors.get(version.createdBy) ?? null) : null,
      values: version.values,
      isCurrent: settings?.currentVersionId === version._id,
    }));
  },
});

/**
 * Goes back to an earlier version's values.
 *
 * Writes a NEW row holding those values rather than repointing at the old one. History
 * stays append-only and, more importantly, matches that reference the old version keep
 * meaning what they meant — a revert is a new decision, not a rewriting of the past.
 */
export const revert = mutation({
  args: { versionId: v.id("configVersions") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const target = await ctx.db.get(args.versionId);
    if (!target) throw new Error("No such config version");

    const versionId = await ctx.db.insert("configVersions", {
      values: target.values,
      createdAt: Date.now(),
      createdBy: admin._id,
      note: `Reverted to the version from ${new Date(target.createdAt).toISOString()}`,
    });

    await pointAt(ctx, versionId, admin._id);
    return { versionId };
  },
});

/** Puts every value back to what the code ships. */
export const resetAll = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);

    const versionId = await ctx.db.insert("configVersions", {
      values: [],
      createdAt: Date.now(),
      createdBy: admin._id,
      note: "Reset every value to the shipped default",
    });

    await pointAt(ctx, versionId, admin._id);
    return { versionId };
  },
});
