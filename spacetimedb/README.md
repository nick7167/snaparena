# The SNAP ARENA module

The whole backend, as one TypeScript SpacetimeDB module. This file records the
decisions the port from Convex made, and why — the ones that are not obvious from
reading the code, and the ones that are easy to undo by accident.

## Layout

```
src/schema.ts     every table, and the schema() call that binds them
src/schedules.ts  the ten scheduled reducers
src/index.ts      module entry: re-exports everything SpacetimeDB must discover
src/devbots.ts    DEV ONLY, deleted before launch — see the checklist at its foot
```

`index.ts` imports `./schedules` **before** `./schema`, deliberately. The two form
a cycle — the schema names the scheduled reducers in its `scheduled: (): any => …`
thunks, and the reducers need the schema to exist. The thunks defer, which makes
the cycle legal, but only if the reducer module finishes evaluating first. The
bundler prints a circular-dependency warning for this; it is expected.

## What is public and what is not

A subscription replicates whole rows. There is no query in between deciding what
to return, so **visibility is a property of the schema, not of a code path.**

Private, because each of these is or implies an answer:

| Table | Why |
|---|---|
| `track` | the catalogue *is* the answer key |
| `track_alias` | accepted spellings of the answer |
| `match_track` | the setlist for a match in progress |
| `daily_challenge` | the same, for the daily |
| `guess` | `rawText` is the answer the moment anyone is right |
| `queue_entry` | needless broadcast of every waiting player's rating |
| `account` | the identity ↔ player map; would let anyone enumerate the player base |
| `user_avatar` | ~30KB of image bytes per row; served over HTTP instead |
| `connection`, `module_owner`, `report` | operational, never client-facing |

The player-facing surface is materialised instead:

- **`round_reveal`** — created when a round is dispatched carrying `previewUrl`
  and nothing else, then updated with title, artist, artwork and category at the
  reveal beat. This is the table that replaces `matches.state`'s careful omission
  of the current track, and it is the single most important row in the schema to
  get wrong.
- **`round_result`** — points, reaction time and solved-ness per player per
  round. Deliberately not the guess text.
- **`track_index`** — the autocomplete title list, whole-catalogue and titles
  only, so a suggestion can never confirm a guess or narrow the round in play.

## Things that changed shape, and why

**`presence` is gone.** Convex had no way to observe a socket closing, so liveness
was a client writing a timestamp every five seconds — which its own schema called
the single largest line in the budget. `clientConnected` / `clientDisconnected`
make liveness an observed fact, and the `connection` table records it.

**`ladderSnapshot` became `ladder_entry` rows.** The Convex version held the whole
ordering in one ~415KB document, which was right when the cost was in *reading* it
and wrong here, where the cost is in *replicating* it — one rank change would have
re-sent 5,000 entries to every subscriber. As rows, a rebuild that moves three
people sends three rows. Freshness is preserved where it matters: the five-minute
rebuild refreshes everyone, and `finalizeMatch` rewrites the finishing players'
own rows immediately, so your own number still moves the instant your match ends.

**`match.trackIds` and `match.roundLog` were split out** into `match_track`
(private) and `round_log` (one row per round). The first for secrecy, the second
because the log was 71% of a 3.3KB row that would otherwise be rewritten and
re-sent on every round.

**Seven hand-enforced UNIQUEs became real constraints.** The Convex schema carried
fields commented `// UNIQUE` and checked inside mutations, because Convex has no
unique constraints. SpacetimeDB does.

**`ADMIN_IMPORT_SECRET` is gone.** `init` captures the publisher's identity in
`module_owner`; the import and seed scripts authenticate as the module owner
rather than sharing a password with the deployment.

## What is not here yet

**Bot careers.** `convex/botprofiles.ts` played out a simulated past for every
persona — record, level, badges, category strengths, a handful of persisted recent
matches — so a bot read as an account rather than a placeholder. It has no
equivalent here yet, so every seeded bot shows `0W · 0L`, Level 1 and no badges.

This is cosmetic and contained: the pure half is `../src/engine/bot-career.ts`,
which is untouched, still tested, and still produces byte-identical careers from a
persona plus a seeded RNG. What is missing is only the writer over `user`,
`user_badge`, `category_rating`, `match` and `match_player`. Nothing about how
ranked *behaves* depends on it — the practice roster plays, the rank bots play, and
the rating maths is the same either way.

## Rules for changing this module

1. Adding a column to a public table? Ask whether it names a song that has not
   been revealed yet.
2. Reducers return nothing. Use a view, a subscription, or an event table.
3. No `Date.now()`, no `Math.random()` — `ctx.timestamp` and `ctx.random`. The
   engine in `../src/engine/` already takes its RNG as a parameter for exactly
   this reason.
4. Never reimplement gameplay maths here. Import it from `../src/engine/`, which
   the browser also imports, so the two can never disagree.
5. Regenerate `../src/module_bindings/` after any schema change.
