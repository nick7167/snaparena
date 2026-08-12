/**
 * DEV ONLY — manages the sixteen rank bots. DELETE BEFORE PUBLISHING.
 *
 * These are not the practice bots in `scripts/seed-bots.ts`. They sit in the ranked
 * queue and play real rated matches so placements, Elo and the leaderboard can be
 * tested.
 *
 * NOT YET PORTED. The Convex module behind this — `convex/devbots.ts` — had its own
 * seed, reset and purge mutations, and none of them exist in the SpacetimeDB module: it
 * is the last piece of the port still outstanding, along with `refill_dev_bot_queue`,
 * the interval that keeps the queue stocked.
 *
 * What DOES work today, and covers most of what this was used for:
 *
 *   npm run seed-bots      creates the practice roster (`seed_bots`), which is also
 *                          what "reset" meant — re-seeding refreshes every existing row
 *                          from its persona, putting each bot back on its anchor rating
 *   /admin → dev controls  the same two actions, behind the role gate
 *
 * What is missing is the RANKED half: bots sitting in the queue so a lone developer can
 * match, and the purge that removes them and their matches afterwards. Practice matches
 * against the same personas work now and exercise the same duel, draft and progression
 * paths — everything except matchmaking itself.
 *
 * This script stays rather than being deleted so the gap is visible from the place
 * somebody would go looking for it.
 */

// A module rather than a global script, so `main` does not collide with the same name
// in a sibling script that tsc compiles into the same scope.
export {};

function main() {
  console.error(
    [
      "dev-rank-bots is not available yet.",
      "",
      "The dev-bot module has not been ported to SpacetimeDB. Use:",
      "  npm run seed-bots     create or re-anchor the practice roster",
      "  /admin → dev controls the same, behind the role gate",
      "",
      "Practice matches exercise the duel, draft and progression paths;",
      "only ranked-queue bots and the purge are missing.",
    ].join("\n"),
  );
  process.exit(1);
}

main();
