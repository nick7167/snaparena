/**
 * Seeds the practice bot roster into the SpacetimeDB module.
 *
 * Idempotent — re-run after editing personas in `src/engine/bots.ts` and existing bot
 * accounts are refreshed in place rather than duplicated.
 *
 * NO SECRET ANY MORE. The Convex version authenticated with ADMIN_IMPORT_SECRET, a
 * password shared between `.env.local` and the deployment. The module captured the
 * publisher's identity during `init` and checks `ctx.sender` against it, so this only
 * has to connect AS that identity — which `spacetime login` already arranges. See
 * `scripts/stdb.ts`.
 *
 * Usage: npm run seed-bots
 */

import { withConnection } from "./stdb.ts";

async function main() {
  await withConnection(async (conn) => {
    await conn.reducers.seedBots({});

    /**
     * No counts to report. A reducer returns nothing, so "12 created, 4 updated" is not
     * available — and the roster itself is the better confirmation anyway: it shows up
     * in the practice list, and `spacetime sql "SELECT handle FROM user WHERE is_bot"`
     * answers the same question against what was actually written.
     */
    console.log("Bot roster seeded from the personas in src/engine/bots.ts");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
