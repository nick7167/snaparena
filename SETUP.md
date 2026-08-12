# Setup

```bash
cp .env.local.example .env.local
```

`.env.local.example` documents every variable. Note that some values do NOT live in
that file: the module has no environment to read, so a few things are stored in the
database itself and set once with a CLI call.

---

## 1. The SpacetimeDB CLI

```bash
curl -sSf https://install.spacetimedb.com | sh
spacetime --version    # must match the `spacetimedb` npm package major.minor
```

Version skew between the CLI and the `spacetimedb` package is a documented source
of confusing build errors, so keep them in step.

## 2. A database

### Locally

```bash
spacetime start                       # in its own terminal
npm run dev                           # publishes the module and starts Next.js
```

`spacetime start` listens on `127.0.0.1:3000`, which is what
`NEXT_PUBLIC_SPACETIMEDB_URI` defaults to.

### On Maincloud

```bash
spacetime login
spacetime publish snaparena-740t8 --server maincloud
```

This project's database is **`snaparena-740t8`** (identity
`c2008240fdcacf07b61461af986544193d77657844148219b4485d0cf077278b`). It is already
wired into `NEXT_PUBLIC_SPACETIMEDB_DB` and the `stdb:*` scripts.

**`--server maincloud` is not optional on any of these.** `spacetime.json` used to
pin a server name and no longer does — the name it carried was one developer's local
instance, so `publish` was unrunnable anywhere else, and no single pinned value can
serve both `spacetime dev` (which wants a local instance) and `spacetime publish`
(which wants this one). The `stdb:*` scripts pass it for you; a bare `spacetime`
command typed by hand goes to whatever your CLI's default server is, which is very
probably localhost.

Database names are global on Maincloud, which is why this one carries a suffix — a
name someone else holds fails with a 401 or 403 that reads like an auth problem but
is not.

Publishing captures the publisher's identity in the `module_owner` table. That
identity is what the import and seed scripts authenticate as, and it is who grants
the first admin — so publish as the account you intend to operate the game from.

**The capture only happens on a FIRST publish.** `init` — the reducer that writes
`module_owner` — runs once when a database is created, and again only when its data
is cleared. Publishing over a database that already exists is an *update*: the
migration creates the tables, `init` does not run, and `module_owner` stays empty.
Every owner-gated call then fails with `Module owner only`, including the
`set_auth_issuer` call in the next section, and there is no way to grant yourself
past it — the empty table refuses everyone.

If you hit that, republish with the data cleared so `init` runs:

```bash
spacetime publish snaparena-740t8 --server maincloud -c --yes
spacetime sql snaparena-740t8 "SELECT * FROM module_owner" --server maincloud
```

The `sql` call should print the same identity `spacetime login` reported. `-c`
DESTROYS all data in the database, so it is free before the first import and
expensive afterwards — check `module_owner` right after publishing, while clearing
still costs nothing.

## 3. Clerk

The app already uses Clerk for Google and Discord one-click sign-in; that part is
unchanged. What changed is the bridge to the backend.

1. **Create a JWT template.** Clerk dashboard → **Configure** → **JWT Templates** →
   **New template** → **Blank**.
   - Name it exactly **`spacetimedb`**. `src/app/providers.tsx` asks for it by name.
   - Leave the signing algorithm on Clerk's default (RS256). SpacetimeDB fetches the
     public keys from the issuer's OIDC discovery document, so a custom signing key
     would have to be published somewhere it can reach.
   - The default token lifetime (60s) is fine. The client refreshes on a timer, and
     the token is only checked when a socket opens — see the long note in
     `src/app/providers.tsx`.
   - **Leave the claims empty.** There is no audience field in the UI; `aud` would
     have to be added by hand to the claims JSON, and it is not worth it here. See
     below.

2. **Copy the Issuer URL.** For this project it is
   `https://trusting-ewe-58.clerk.accounts.dev`.

3. **Register it on the database.** This replaces
   `npx convex env set CLERK_JWT_ISSUER_DOMAIN`:

   ```bash
   spacetime login
   npm run stdb:auth -- '"https://trusting-ewe-58.clerk.accounts.dev"' '""'
   ```

   **Until you do this, every sign-in fails with "Unauthorized issuer".** That is the
   intended failure mode, and the same call the Convex setup made: an empty
   allow-list deliberately does not mean "accept anything", because that would
   accept a token minted by any OIDC provider on the internet.

   ### Why the audience is empty

   `""` means "accept any `aud` from this issuer", and for this app that is the right
   setting rather than a shortcut.

   An audience check answers one question: was this token minted for *me*, or for
   some other application that happens to share my issuer? That matters on a shared
   issuer — `accounts.google.com` mints tokens for everybody. It does not matter
   here, because `trusting-ewe-58.clerk.accounts.dev` is this project's own Clerk
   instance and issues tokens for nothing else. Pinning the issuer already answers
   the question the audience would.

   Setting one anyway would mean hand-editing `aud` into the template's claims JSON,
   and Clerk has a known failure where a custom `aud` on a session token breaks its
   own `getAuth()`. That is a real cost against no real gain.

   If a second application is ever added to this Clerk instance, set an audience
   then and re-run the command with it — the module already checks it when non-empty.

4. **Grant yourself admin**, as the identity that published the database:

   ```bash
   spacetime call snaparena-740t8 --server maincloud set_role '"your-handle"' 'true'
   ```

## 4. Environment variables

For Vercel, or `.env.local` locally:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SPACETIMEDB_URI` | `https://maincloud.spacetimedb.com`, or your own host |
| `NEXT_PUBLIC_SPACETIMEDB_DB` | the database name you published |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | unchanged |
| `CLERK_SECRET_KEY` | unchanged |
| `NEXT_PUBLIC_POSTHOG_KEY` | unchanged, and still optional |

**Delete these** — nothing reads them any more: `CONVEX_DEPLOYMENT`,
`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `ADMIN_IMPORT_SECRET`, and
`CLERK_JWT_ISSUER_DOMAIN` (the issuer lives in the database now, not the
environment).

### PostHog (product analytics)

The code is already complete — `src/analytics/` plus 18 call sites. The only thing
that switches it on is one variable, and it belongs in the **hosting environment**,
not in `.env.local`:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...        # Project settings -> Project token
```

Project: **SNAP ARENA**, id `241582`, **EU Cloud** — which is why
`NEXT_PUBLIC_POSTHOG_HOST` stays unset. `src/analytics/index.ts` already defaults to
`https://eu.i.posthog.com`, and pointing it at the US region would return HTTP 200 on
every event and record none of them.

Two things that make this look broken when it isn't:

- **`NEXT_PUBLIC_*` is inlined at build time.** Adding the variable in Vercel does
  nothing to the deployment already running; it needs a rebuild before a single event
  is sent.
- **Everywhere else is silent on purpose.** Without the key `track()` is a no-op and
  no request leaves the browser, so local dev, CI and the e2e suite never write into
  the production project. That is the intended state for this repo, not a missing step.

The saved funnels are defined in code, not clicked together:

```bash
POSTHOG_PERSONAL_API_KEY=phx_... npm run posthog-insights
```

Idempotent, matched by name. That needs a **personal** API key with `insight:write`
and `dashboard:write` — the `phc_` project token is write-only and can only send
events.

---

## 5. Content pipeline

```bash
npm run ingest:smoke   # ~30s, 8 API calls, sanity check
npm run ingest         # full run: ~120 calls, ~7 min at the rate limit
```

Writes `data/tracks.json`. Verified against the live iTunes API — a smoke run
returned 148 tracks across all 8 categories with **zero** missing preview URLs.

Then, once the module is published:

```bash
npm run import-tracks
```

The two stages are deliberately separate so the slow, rate-limited network work is
reproducible and reviewable before anything touches the database.

---

## 6. Run it

```bash
npm run dev
```

One command, one terminal. `dev` runs `spacetime dev` and the Next.js frontend together via `concurrently`,
prefixed and colour-coded. `spacetime dev` watches the module, republishes on
change, and regenerates the client bindings in `src/module_bindings/`:

```
[stdb] Build finished successfully.
[next] ▲ Next.js 16.2.12  -  Local: http://localhost:3000
```

`-k` links their lifetimes, so Ctrl+C stops both and a crash in either takes the other
down rather than leaving you with a half-running stack that looks fine.

**Commit the bindings after a schema change.** `src/module_bindings/` is tracked
rather than ignored, because the app imports it and the deployment has no
`spacetime` CLI to generate it — an ignored copy means `next build` cannot resolve
`@/module_bindings` off a clean clone, and the Vercel deploy fails. The tradeoff is
that a stale copy is now possible, so treat it as part of the change:

```bash
npm run stdb:generate
git add src/module_bindings && git commit
```

To run just one side:

```bash
npm run dev:stdb
npm run dev:next
```

---

## 7. The admin console

`/admin`, reachable from the account menu once your account holds the admin role.
Nothing else links to it.

The first admin is granted by whoever published the database — the identity captured
in `module_owner`. There is no shared secret any more:

```bash
spacetime call snaparena-740t8 set_role '"your-handle"' 'true'
```

After that, `/admin` grants the role to anyone else.

### Tuning values

Every constant in `src/engine/config.ts` appears on that page. Match pacing, scoring
timings and XP are editable; Elo, rank thresholds, the score tiers and the anti-cheat
floors are shown read-only with the reason attached.

Two things worth knowing before you change anything:

- **`config.ts` stays the baseline.** The database holds only differences from it, so an
  empty deployment runs exactly what the code says and "reset" is a deletion rather than a
  write. Adding a constant needs no migration.
- **A match keeps the config it started with.** Saving mid-duel cannot move the score
  curve or the damage ramp underneath two players who are halfway through a round. New
  matches pick up the change; running ones do not.

Every save is a version, with a diff and a one-click restore. Restoring writes a new
version rather than reusing the old row, because finished matches point at those rows.

### Developer features

The rank bots, the instant-win bar and the developer tools drawer are switched on from
that page — **not** by `DEV_RANK_BOTS` any more. A module cannot write its own
environment, which is why the flag lives in the `settings` table; the old variable is
read by nothing.

> Deploying this leaves developer features **off**, even where the old variable is still
> set. There is deliberately no fallback to it — turn them on in `/admin`.

Turning the switch on does not by itself put anybody in the queue. Seed the roster
afterwards, either from `/admin` → **Seed roster** or from a terminal:

```bash
npm run dev-bots seed              # create the sixteen, or put them back on their anchors
npm run dev-bots purge <handle>    # delete them, their matches, and reset that account
```

The sixteen join the ranked queue within fifteen seconds and stay there — a bot's queue
row is consumed when it is matched, so an interval tops it back up. Expect about twenty
seconds of searching before one answers; that floor is deliberate, so a permanently
stocked queue still reads as a search rather than teleporting you into a duel.

They arrive with no career: `0W · 0L`, Level 1, no badges. That half of the Convex
backend is not ported — see "What is not here yet" in `spacetimedb/README.md`.

`e2e/dev-rank-bots.spec.ts` needs the switch on and the roster seeded, and the e2e suite
runs against the deployed backend, so both have to be true there rather than locally.

---

## What runs right now, without any credentials

```bash
npm test            # 378 tests, all passing
npm run ingest:smoke
```

The engine — normalization, fuzzy matching, the scoring curve, Elo, and the
client-clock validator — is pure functions with no infrastructure dependency, and
is fully tested today. That was deliberate: those are the parts that must be
correct in isolation, and they're the hardest to debug through a UI.

---

## Verified findings worth knowing

Checked against the live API on 2026-08-01, because the original Spotify plan was
built on two assumptions that turned out to be false.

| Claim | Status |
|---|---|
| Spotify bans music-quiz apps | **True** — their compliance page names "a 'name that tune' quiz" as prohibited |
| Spotify `preview_url` works for new apps | **False** — deprecated 2024-11-27, returns `null` |
| Apple's preview CDN blocks CORS | **False** — sends `access-control-allow-origin: *` and `access-control-allow-headers: range` |
| Apple preview URLs expire | **Mostly false** — no signature or query params, `max-age` ~144 days, stable `etag` |
| iTunes results often lack previews | **False** — 0 of 396 results in the smoke run were missing one |

The CORS finding matters: the Web Audio API is available to us without a proxy, so
sample-accurate playback and waveform visuals stay on the table. v1 still uses a
plain `<audio>` element for simplicity — that's now a choice, not a constraint.

---

## Architecture notes that aren't obvious from the code

**The score clock never touches the network.** `src/game/useRoundAudio.ts` anchors
`performance.now()` to the audio element's first `playing` event. Not to a server
signal (that would make latency decide who wins) and not to `audio.currentTime`
(which resets to zero at every reveal beat, so it doesn't track round time). The
server bounds the reported value from both directions in `validateClientClock`.

**Autocomplete searches the whole catalogue on purpose.** The suggestion list in
`track_index` is deliberately not filtered to the tracks in play. Scoping it to the
match would let a player type two characters and read the answer off the dropdown.
It also carries titles only — never artist or artwork — so a suggestion cannot
confirm a guess before it is submitted.

**"First correct guess wins" needs no locking.** Reducers are serializable
transactions, so the second submitter's transaction observes the first one's write.
This was the main reason the original plan chose Convex over Neon, and it is the
property SpacetimeDB preserved — it is why the guess pipeline needed no redesign.
