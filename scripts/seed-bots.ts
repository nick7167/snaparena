/**
 * Seeds the bot roster into Convex.
 *
 * Idempotent — re-run after editing personas in `src/engine/bots.ts` and existing
 * bot accounts are updated in place rather than duplicated.
 *
 * Usage: npm run seed-bots
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.ADMIN_IMPORT_SECRET;

  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set — run `npx convex dev`");
  if (!secret) throw new Error("ADMIN_IMPORT_SECRET is not set locally");

  const client = new ConvexHttpClient(convexUrl);
  const result = await client.mutation(api.bots.seed, { secret });

  console.log(
    `Bots: ${result.created} created, ${result.updated} updated (${result.total} personas)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
