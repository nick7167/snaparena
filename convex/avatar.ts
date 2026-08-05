import type { Doc } from "./_generated/dataModel";

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
 *
 * Lives in its own module because both `users.ts` and `ladder.ts` need it and `ladder.ts`
 * has to stay a leaf — `users.ts` imports the ladder helpers, so the ladder cannot import
 * back. Re-exported from `users.ts` so existing callers are unaffected.
 */
export function publicAvatarUrl(user: Doc<"users">): string | undefined {
  return user.avatarHidden ? undefined : user.avatarUrl;
}
