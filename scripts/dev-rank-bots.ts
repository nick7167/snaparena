/**
 * DEV ONLY — manages the sixteen rank bots. DELETE BEFORE PUBLISHING.
 *
 * These are not the practice bots in `scripts/seed-bots.ts`. They sit in the ranked
 * queue and play real rated matches so placements, Elo and the leaderboard can be
 * tested by one person. See `spacetimedb/src/devbots.ts`.
 *
 *   npm run dev-bots seed              create the roster, or put it back on its anchors
 *   npm run dev-bots purge             delete the roster and every match it appears in
 *   npm run dev-bots purge <handle>    …and scrub that account back to a fresh signup
 *
 * `seed` and `reset` are the same command, because "reset" means "make the row match the
 * persona again" and that is exactly what seeding does. `reset` is accepted as an alias
 * so the muscle memory from the Convex version still works.
 *
 * NO SECRET ANY MORE. The Convex version authenticated with ADMIN_IMPORT_SECRET, a
 * password shared between `.env.local` and the deployment. The module captured the
 * publisher's identity during `init` and checks `ctx.sender` against it, so this only
 * has to connect AS that identity — which `spacetime login` already arranges. See
 * `scripts/stdb.ts`.
 *
 * DEVELOPER FEATURES MUST BE ON for `seed`, and the module says so if they are not.
 * Sixteen bot accounts appearing on a live deployment is precisely what that switch
 * guards, and it is a database row now rather than a deployment variable — flip it in
 * /admin. `purge` is deliberately NOT gated on it: cleaning up has to work after you
 * have already turned the switch off.
 */

import { withConnection } from "./stdb.ts";

// A module rather than a global script, so `main` does not collide with the same name
// in a sibling script that tsc compiles into the same scope.
export {};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  npm run dev-bots seed              create or re-anchor the sixteen rank bots",
      "  npm run dev-bots purge [handle]    delete them, their matches, and optionally",
      "                                     reset that account to a fresh signup",
    ].join("\n"),
  );
  process.exit(1);
}

async function main() {
  const [command, handle] = process.argv.slice(2);

  if (command !== "seed" && command !== "reset" && command !== "purge") usage();

  await withConnection(async (conn) => {
    if (command === "purge") {
      /**
       * The handle is passed as "" rather than omitted, because a reducer argument is
       * not optional — `t.string()` is a string, and the module reads empty as "skip".
       */
      await conn.reducers.purgeDevRankBots({ resetHandle: handle ?? "" });

      console.log("Rank bots, their matches and their queue rows are gone.");
      if (handle) console.log(`@${handle} is back to a fresh signup.`);

      /**
       * The refill is disarmed by the purge itself, so nothing puts them back. Turning
       * developer features off in /admin is still worth doing — it is what closes the
       * instant-resolve bar and takes bots off the ladder.
       */
      console.log("Turn developer features off in /admin when you are done with them.");
      return;
    }

    await conn.reducers.seedDevRankBots({});

    /**
     * No counts to report. A reducer returns nothing, so "12 created, 4 updated" is not
     * available — and the ladder is the better confirmation anyway: these bots carry no
     * placements, so they appear on the leaderboard within one rebuild.
     */
    console.log("Sixteen rank bots seeded from their personas in src/engine/dev-rank-bots.ts");
    console.log("They join the ranked queue within fifteen seconds.");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
