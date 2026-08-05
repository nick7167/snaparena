import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./users";
import { TUTORIAL_ITUNES_TRACK_ID } from "../src/engine/config";

/**
 * The welcome tutorial's server surface, which is deliberately tiny.
 *
 * The coached rounds are a CLIENT-SIDE SANDBOX — no match row, no `matchMode` variant, no
 * server phase machine, no rating or XP at stake. That is a design decision rather than a
 * shortcut: the tutorial needs a rival with deterministic timing and coaching beats it can
 * pause on, and the real phase machine is driven by a scheduler precisely so that two
 * players cannot disagree about when a round ends. Borrowing it here would mean fighting
 * it. See `src/game/TutorialRunner.tsx`.
 *
 * So all the server does is hand over one track and remember how far the player got.
 */

/**
 * The track to teach on.
 *
 * Pinned by `itunesTrackId` rather than by document id, because `scripts/ingest.ts`
 * re-creates rows and a document id would stop resolving after a re-ingest — silently, and
 * forever. The iTunes id is external and already indexed.
 *
 * Falls back to a random difficulty-1 track, which is the easiest and most popular tier.
 * That fallback is not an error path so much as the sane default: it means the tutorial
 * works on a fresh deployment where nobody has chosen a song yet.
 */
export const track = query({
  args: {},
  handler: async (ctx) => {
    // Captured into a local because narrowing a module-level constant does not survive
    // into the index callback below.
    const pinnedId = TUTORIAL_ITUNES_TRACK_ID;

    if (pinnedId !== null) {
      const pinned = await ctx.db
        .query("tracks")
        .withIndex("by_itunes_id", (q) => q.eq("itunesTrackId", pinnedId))
        .unique();

      // `playable` is checked as well as existence: a track held out of the pool is held
      // out of the tutorial too, or the first song a new player hears is one the game has
      // decided is not fit to serve.
      if (pinned && pinned.playable) return shape(pinned);
    }

    /**
     * Bounded read. `take(50)` rather than `collect()` because difficulty 1 is the largest
     * tier in a healthy catalogue, and this query runs on every welcome flow — reading the
     * whole tier to pick one row would be the most expensive query in the app for no gain.
     */
    const easiest = await ctx.db
      .query("tracks")
      .withIndex("by_playable_difficulty", (q) =>
        q.eq("playable", true).eq("difficulty", 1),
      )
      .take(50);

    if (easiest.length === 0) return null;
    return shape(easiest[Math.floor(Math.random() * easiest.length)]);
  },
});

/** Only what the runner renders. The full row carries scoring data it has no use for. */
function shape(row: {
  title: string;
  artist: string;
  artworkUrl: string;
  previewUrl: string;
}) {
  return {
    title: row.title,
    artist: row.artist,
    artworkUrl: row.artworkUrl,
    previewUrl: row.previewUrl,
  };
}

/**
 * Records how far through the welcome flow the player has reached.
 *
 * Written on every step transition so a refresh, a closed tab or a dropped connection
 * resumes rather than restarting — losing someone's place in a tutorial is a good way to
 * ensure they never finish it.
 *
 * Deliberately does NOT touch `onboardedAt`: that is written by `completeOnboarding` at
 * the username step, because a handle can only be held by being written. See the schema.
 */
export const setWelcomeStep = mutation({
  args: {
    step: v.number(),
    /** Set when the coached rounds were played rather than skipped past. */
    tutorialCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    await ctx.db.patch(user._id, {
      // Monotonic: a player who navigates backwards to re-read a step should not lose the
      // progress they already made, or a stray back-press would re-run the whole flow.
      welcomeStep: Math.max(args.step, user.welcomeStep ?? 0),
      ...(args.tutorialCompleted ? { tutorialCompletedAt: Date.now() } : {}),
    });
  },
});
