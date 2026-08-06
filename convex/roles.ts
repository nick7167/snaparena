import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { currentUser, requireUser } from "./users";

/**
 * Who is allowed to see the operator surfaces.
 *
 * The developer tools and /admin used to be gated on `DEV_RANK_BOTS`, a deployment
 * variable. That is not a per-user check, and it is a particularly bad fit here: this
 * project points local development and the live Vercel site at ONE Convex deployment, so
 * setting the variable to get dev tools on a laptop also handed them to every signed-in
 * player on the live site. Nobody would have noticed from the code — the gate reads like
 * an environment check, and in a normal two-deployment setup it would be one.
 *
 * Roles live on the user row instead, so the answer travels with the identity rather than
 * with the deployment.
 *
 * Bootstrapping is the awkward part of any role system: the first admin cannot be granted
 * by an admin. `grantBySecret` solves it with the shared secret `admin.ts` already uses
 * for the content importer — it runs from a terminal, not from a session. After the first
 * grant, `setRole` is the ordinary path and requires a caller who is already an admin.
 */

/** True when the signed-in user holds the admin role. Safe to call when signed out. */
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const user = await currentUser(ctx);
  return user?.role === "admin";
}

/** Throws unless the caller is an admin. Use in anything that grants or reveals. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw new Error("Not an admin");
  return user;
}

function assertSecret(secret: string): void {
  const expected = process.env.ADMIN_IMPORT_SECRET;
  if (!expected) throw new Error("ADMIN_IMPORT_SECRET is not configured on the deployment");
  if (secret !== expected) throw new Error("Bad admin secret");
}

/**
 * Whether the CURRENT user is an admin.
 *
 * Deliberately returns a bare boolean rather than the role string: every caller is a
 * render gate, and a boolean cannot be accidentally displayed. Returns false rather than
 * throwing when signed out, because it is read on every page by the shell — a query that
 * throws takes the render down with it.
 */
export const amIAdmin = query({
  args: {},
  handler: async (ctx) => ({ admin: await isAdmin(ctx) }),
});

/** Every admin, for the management screen. Admins only — this is a list of who to target. */
export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Small by construction: an admin list that needs pagination is a different problem.
    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .take(100);

    return admins.map((user) => ({
      userId: user._id,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    }));
  },
});

/**
 * Grants or revokes the admin role by handle.
 *
 * Handle rather than id because the caller is a person typing into a box, and the handle
 * is the only identifier they can see. Lowercased to match the index.
 *
 * An admin may not revoke themselves. Not paternalism — it is the only rule that stops
 * the last admin from locking everyone out of a screen that can only be reopened with a
 * deployment secret and a terminal.
 */
export const setRole = mutation({
  args: { handle: v.string(), admin: v.boolean() },
  handler: async (ctx, args) => {
    const caller = await requireAdmin(ctx);

    const handle = args.handle.trim().toLowerCase().replace(/^@/, "");
    const target = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();

    if (!target) throw new Error(`No player called @${handle}`);
    if (target._id === caller._id && !args.admin) {
      throw new Error("You cannot remove your own admin role");
    }

    await ctx.db.patch(target._id, { role: args.admin ? "admin" : undefined });
    return { handle: target.handle, admin: args.admin };
  },
});

/**
 * Bootstrap. Grants admin from a terminal, using the deployment secret.
 *
 * The only way to create the first admin, and deliberately not reachable from the app:
 * there is no session involved, so no amount of clicking in a browser can call it
 * usefully. Run it as:
 *
 *   npx convex run roles:grantBySecret '{"secret":"…","handle":"…"}'
 */
export const grantBySecret = mutation({
  args: { secret: v.string(), handle: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const handle = args.handle.trim().toLowerCase().replace(/^@/, "");
    const target = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();

    if (!target) throw new Error(`No player called @${handle}`);

    await ctx.db.patch(target._id, { role: "admin" });
    return { handle: target.handle, admin: true };
  },
});
