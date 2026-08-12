# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# The backend is SpacetimeDB, not Convex

The whole backend is a single TypeScript SpacetimeDB module under `spacetimedb/`.
There is no `convex/` directory any more and no server framework in front of the
database — clients open a WebSocket to the module, subscribe to tables, and call
reducers.

**Read `spacetimedb/README.md` first.** It records the decisions this port made and
the three that are load-bearing:

- **Private by default, and private means private.** A subscription hands the
  client the whole row, so anything a player must not see — the songs in play,
  the aliases that match them, the text of a guess — lives in a private table.
  What the player *may* see is materialised into a public table by the reducer
  that changes it. Never add a field to a public table without asking whether it
  names a song that has not been revealed yet.
- **Reducers return nothing.** A Convex mutation could answer its caller. A
  reducer commits and the client learns the outcome from a subscription, a view,
  or an event table. `guess_feedback` is the event table that carries a guess
  verdict back to the one player who made it.
- **Reducers must be deterministic.** No `Date.now()`, no `Math.random()`. Use
  `ctx.timestamp` and `ctx.random`. The game engine in `src/engine/` already takes
  its RNG as a parameter, which is why it can be shared verbatim between the
  module and the browser.

`src/engine/` is imported by both the module and the client and is the single
source of truth for every gameplay number. It is pure, it has no external
imports, and its vitest suite is the regression net for the whole port — if you
change scoring, Elo, XP, badges or ranks, those tests are what must stay green.

## Working on the module

```bash
npm run dev            # spacetime dev + next dev, together
npm run stdb:build     # typecheck and bundle the module
npm run stdb:generate  # regenerate ./src/module_bindings after a schema change
npm run stdb:logs      # follow module logs
npm run stdb:sql "SELECT * FROM user"
```

Client bindings in `src/module_bindings/` are generated and gitignored. Never edit
them; regenerate instead.
