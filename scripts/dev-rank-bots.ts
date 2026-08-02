/**
 * DEV ONLY — manages the sixteen rank bots. DELETE BEFORE PUBLISHING.
 *
 * These are not the practice bots in `scripts/seed-bots.ts`. They sit in the ranked
 * queue and play real rated matches so placements, Elo and the leaderboard can be
 * tested. See `convex/devbots.ts` for the whole surface and the removal checklist.
 *
 * Usage:
 *   npm run dev-bots seed              create or re-anchor the roster
 *   npm run dev-bots reset             put every bot back on its anchor rating
 *   npm run dev-bots purge [handle]    remove the roster, their matches, and (with a
 *                                      handle) reset that account to a fresh signup
 *
 * `seed` also needs the flag set on the deployment before anything uses them:
 *   npx convex env set DEV_RANK_BOTS 1
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

type Command = "seed" | "reset" | "purge";

function parseCommand(value: string | undefined): Command {
  if (value === "seed" || value === "reset" || value === "purge") return value;
  throw new Error(`Usage: npm run dev-bots <seed|reset|purge> [handle]  (got: ${value ?? "nothing"})`);
}

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.ADMIN_IMPORT_SECRET;

  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set — run `npx convex dev`");
  if (!secret) throw new Error("ADMIN_IMPORT_SECRET is not set locally");

  const command = parseCommand(process.argv[2]);
  const resetHandle = process.argv[3];
  const client = new ConvexHttpClient(convexUrl);

  if (command === "seed") {
    const result = await client.mutation(api.devbots.seed, { secret });
    console.log(
      `Rank bots: ${result.created} created, ${result.updated} updated (${result.total} ranks)`,
    );
    console.log("Set the flag if you have not already: npx convex env set DEV_RANK_BOTS 1");
    return;
  }

  if (command === "reset") {
    const result = await client.mutation(api.devbots.resetRoster, { secret });
    console.log(`Rank bots: ${result.reset} returned to their anchor ratings`);
    return;
  }

  // Batched server-side to stay inside a Convex transaction, so loop until it is done.
  let matchesRemoved = 0;
  let passes = 0;

  for (;;) {
    const result = await client.mutation(api.devbots.purge, { secret, resetHandle });
    matchesRemoved += result.matchesRemoved;
    passes++;

    if (result.done) {
      console.log(
        `Purged ${result.botsRemoved} bots, ${matchesRemoved} matches, ` +
          `${result.queueRemoved} queue entries in ${passes} pass(es)`,
      );
      if (resetHandle) {
        console.log(
          result.accountReset
            ? `Reset @${resetHandle} to a fresh account`
            : `Did NOT reset @${resetHandle} — no such account, or it is a bot or guest`,
        );
      } else {
        console.log("No handle given, so no account was reset.");
      }
      console.log("Now: npx convex env remove DEV_RANK_BOTS");
      return;
    }

    if (result.matchesRemoved === 0) {
      throw new Error("Purge stopped making progress — inspect convex/devbots.ts:purge");
    }

    console.log(`  …${matchesRemoved} matches removed, continuing`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
