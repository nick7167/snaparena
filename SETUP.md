# Setup

```bash
cp .env.local.example .env.local
```

`.env.local.example` documents every variable, which ones Convex writes for you, and
which ones live on the Convex deployment rather than in the file.

---

## 1. Credentials

### Convex — done

`npx convex dev` has been run: `convex/_generated/` exists and `.env.local` holds
`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`.

With codegen in place the whole project typechecks: **`npm run typecheck` reports 0
errors** and `npm run lint` is clean.

### Clerk

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) with
   **Google** and **Discord** enabled as the only providers (one-click OAuth was a
   deliberate product decision — no passwords, no email verification).
2. Create a **JWT template** named `convex` (Clerk provides this template preset).
3. Copy the Issuer URL from that template.

Add to `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

`convex/auth.config.ts` already exists and reads the issuer from the **deployment**
environment, so you must set it there — putting it only in `.env.local` will not work,
because JWT verification happens inside Convex, not in Next.js:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
```

> Heads up: `npx convex dev` will report `auth.config.ts` as invalid until that
> variable is set on the deployment. That's the intended failure mode — auth silently
> not working would be worse than a loud error.

### Admin import secret

Used by the content importer, which runs from a terminal and has no Clerk session:

```bash
export ADMIN_IMPORT_SECRET="$(openssl rand -hex 24)"
npx convex env set ADMIN_IMPORT_SECRET "$ADMIN_IMPORT_SECRET"
```

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

## 2. Content pipeline (works today, no credentials needed for stage 1)

```bash
npm run ingest:smoke   # ~30s, 8 API calls, sanity check
npm run ingest         # full run: ~120 calls, ~7 min at the rate limit
```

Writes `data/tracks.json`. Verified against the live iTunes API — a smoke run
returned 148 tracks across all 8 categories with **zero** missing preview URLs.

Then, once Convex is configured:

```bash
npm run import-tracks
```

The two stages are deliberately separate so the slow, rate-limited network work is
reproducible and reviewable before anything touches the database.

---

## 3. Run it

```bash
npm run dev
```

One command, one terminal. `dev` runs the Convex backend and the Next.js frontend
together via `concurrently`, prefixed and colour-coded:

```
[convex] ✔ Convex functions ready! (9.26s)
[next]   ▲ Next.js 16.2.12  -  Local: http://localhost:3000
```

`-k` links their lifetimes, so Ctrl+C stops both and a crash in either takes the other
down rather than leaving you with a half-running stack that looks fine.

To run just one side:

```bash
npm run dev:convex
npm run dev:next
```

---

## 4. The admin console

`/admin`, reachable from the account menu once your account holds the admin role.
Nothing else links to it.

The first admin cannot be granted by an admin, so it is bootstrapped from a terminal
with the deployment secret:

```bash
npx convex run roles:grantBySecret '{"secret":"…","handle":"your-handle"}'
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
that page — **not** by `DEV_RANK_BOTS` any more. A Convex function cannot write its own
environment, which is why the flag moved into the database; the old variable is read by
nothing and can be removed from the deployment.

> Deploying this leaves developer features **off**, even where the old variable is still
> set. There is deliberately no fallback to it — turn them on in `/admin`.

`e2e/dev-rank-bots.spec.ts` needs them on, and the e2e suite runs against the deployed
backend, so that switch has to be on there rather than locally.

---

## What runs right now, without any credentials

```bash
npm test            # 76 tests, all passing
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

**Autocomplete searches the whole catalogue on purpose.** `convex/tracks.ts`
deliberately does not filter to the tracks in play. Scoping it to the match would
let a player type two characters and read the answer off the dropdown.

**"First correct guess wins" needs no locking.** Convex mutations are serializable
transactions, so the second submitter's transaction observes the first one's write.
This is the main reason the plan chose Convex over Neon.
