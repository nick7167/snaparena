import { t } from "spacetimedb/server";
import { ScheduleAt } from "spacetimedb";
import { spacetimedb, user } from "./schema";
import type { ReducerCtx, ViewCtx } from "./ctx";
import { armGuestCleanup } from "./guests";
import { armLadderRebuild } from "./ladder";
import {
  AVATAR_COLOUR_PATTERN,
  AVATAR_MAX_BYTES,
  HANDLE_PATTERN,
  containsBlockedTerm,
  microsFrom,
  reject,
} from "./lib";
import {
  BIO_MAX_LENGTH,
  HANDLE_MAX_LENGTH,
  PLACEMENT_MATCHES,
  RECONNECT_GRACE_MS,
  STARTING_ELO,
} from "../../src/engine/config";

/**
 * Identity, accounts and profiles.
 *
 * The shape of authorization changed here more than anywhere else in the port,
 * and in one direction: a Convex function received a request and asked "who is
 * this?", whereas a reducer is handed `ctx.sender` and cannot be told otherwise.
 * There is no longer any way for a caller to name a user, which is why the guest
 * bearer-token machinery in the old `guestByToken` is gone entirely — it existed
 * because Convex auth required a JWT and anonymous play had to present *something*.
 * SpacetimeDB issues anonymous identities, so a guest is now simply a caller whose
 * account happens to be flagged.
 */

// ---------------------------------------------------------------------------
// Resolving the caller
// ---------------------------------------------------------------------------

/** The caller's player row, or null when they have never created one. */
export function senderUser(ctx: ReducerCtx | ViewCtx) {
  const account = ctx.db.account.identity.find(ctx.sender);
  if (!account) return null;
  return ctx.db.user.id.find(account.userId) ?? null;
}

/** The same, but refuses rather than returning null. */
export function requireSenderUser(ctx: ReducerCtx) {
  const found = senderUser(ctx);
  if (!found) reject("Not signed in");
  return found;
}

/**
 * The caller's player row, refusing guests.
 *
 * This is the single choke point that keeps guests confined to the daily. The
 * Convex version achieved the same thing with `dailyOnly()`, which discarded a
 * guest token on any non-daily call — a subtractive rule that had to be applied at
 * every entry point. Stating it positively means ranked, practice and rooms are
 * sign-in-only because they call this, rather than because five separate places
 * remembered to strip something.
 */
export function requireFullAccount(ctx: ReducerCtx) {
  const found = requireSenderUser(ctx);
  if (found.isGuest) reject("Sign in to play this mode");
  return found;
}

/** Admin check, for the operator console and the developer tools. */
export function requireAdmin(ctx: ReducerCtx) {
  const found = requireSenderUser(ctx);
  if (found.role !== "admin") reject("Admin only");
  return found;
}

/** True when the caller published this database. Replaces ADMIN_IMPORT_SECRET. */
export function isModuleOwner(ctx: ReducerCtx): boolean {
  return ctx.db.module_owner.identity.find(ctx.sender) !== null;
}

/** Refuses anyone who is not the publisher. Used by the import and seed scripts. */
export function requireModuleOwner(ctx: ReducerCtx) {
  if (!isModuleOwner(ctx)) reject("Module owner only");
}

/** Owner or admin — the gate the operator console and the seed reducers share. */
export function requireOwnerOrAdmin(ctx: ReducerCtx) {
  if (isModuleOwner(ctx)) return;
  requireAdmin(ctx);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Captures the publisher's identity.
 *
 * `ctx.sender` is the module owner here and nowhere else, so this is the only
 * chance to record it. It is what the import scripts authenticate against, and it
 * is how the first admin is bootstrapped — the Convex equivalent was a shared
 * secret in the deployment environment plus `roles:grantBySecret`.
 */
export const init = spacetimedb.init((ctx) => {
  if (ctx.db.module_owner.count() === 0n) {
    ctx.db.module_owner.insert({
      identity: ctx.sender,
      capturedAt: ctx.timestamp,
    });
  }

  // Recurring work has to be armed from somewhere, and `init` is the only hook
  // that runs without a caller. The Convex equivalent was `crons.ts`, which the
  // platform read declaratively; here an interval is a row, and a row needs
  // someone to insert it. Each arming function is idempotent, because `init` runs
  // again on every `publish -c`.
  armGuestCleanup(ctx);
  armLadderRebuild(ctx);
});

/**
 * Records the connection. Deliberately does NOT gate on the token's issuer.
 *
 * The first version of this checked the issuer here, mirroring where
 * `convex/auth.config.ts` sat, and it was wrong in a way that only showed up
 * against a running server: SpacetimeDB mints its OWN token for every identity it
 * issues, so an anonymous guest arrives carrying a JWT from the database itself
 * rather than no JWT at all. Refusing unknown issuers at connect therefore locked
 * out guests, the CLI, and — since the check ran before any owner test — the
 * publisher, leaving no way to register the first issuer.
 *
 * The check belongs where an identity becomes a PLAYER ACCOUNT, which is
 * `ensureUser`, not where it opens a socket. Connecting is not a privilege: an
 * anonymous caller can subscribe to public tables, which is exactly what a
 * signed-out visitor reading the landing page needs to do. Everything beyond that
 * is gated by `requireSenderUser` and `requireFullAccount`.
 */
export const onConnect = spacetimedb.clientConnected((ctx) => {
  if (ctx.connectionId) {
    ctx.db.connection.insert({
      connectionId: ctx.connectionId,
      identity: ctx.sender,
      connectedAt: ctx.timestamp,
    });
  }
});

/**
 * Drops the connection row, and arms a forfeit sweep if this was the player's last.
 *
 * REPLACES THE FIVE-SECOND HEARTBEAT. Convex could not observe a socket closing, so
 * liveness had to be inferred from a client writing a timestamp on a timer — which
 * that schema recorded as the single largest line in its budget. Here the event is
 * delivered, so an abandoned duel is detected exactly once, at the moment it is
 * abandoned, and costs nothing while everyone is present.
 *
 * The sweep is armed rather than run immediately: a refresh, a tunnel change or a
 * backgrounded tab all close the socket, and a player who reconnects within the
 * grace window has not forfeited anything. `sweepForfeits` re-checks presence when
 * it fires.
 */
export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  if (ctx.connectionId) {
    ctx.db.connection.connectionId.delete(ctx.connectionId);
  }

  const stillHere = [...ctx.db.connection.identity.filter(ctx.sender)];
  if (stillHere.length > 0) return;

  const player = senderUser(ctx);
  if (!player) return;

  armForfeitSweepFor(ctx, player.id);
});

/**
 * Arms a forfeit check for every live ranked match this player is in.
 *
 * Defined here rather than in the ranked module because `onDisconnect` is the only
 * caller and the import would otherwise run the wrong way round. The ranked module
 * owns what a sweep actually does.
 */
function armForfeitSweepFor(ctx: ReducerCtx, userId: bigint): void {
  for (const row of ctx.db.match_player.userId.filter(userId)) {
    const m = ctx.db.match.id.find(row.matchId);
    if (!m) continue;
    if (m.mode !== "ranked") continue;
    if (m.status !== "active" && m.status !== "veto") continue;

    ctx.db.forfeit_sweep_schedule.insert({
      scheduled_id: 0n,
      scheduled_at: forfeitGraceAt(ctx),
      matchId: m.id,
    });
  }
}

/**
 * How long a player may be gone before the sweep looks at them.
 *
 * Matches the Convex forfeit grace period, which was measured from a heartbeat
 * that had stopped arriving rather than from a disconnection. Measuring from the
 * disconnection itself is strictly more accurate — the old clock could not start
 * until a heartbeat was already overdue.
 */
function forfeitGraceAt(ctx: ReducerCtx): ScheduleAt {
  return ScheduleAt.time(microsFrom(ctx.timestamp, RECONNECT_GRACE_MS));
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * Creates the player row on first sign-in, or does nothing if it exists.
 *
 * The Convex version had to do the "does this clerkId exist" check and the insert
 * inside one transaction, because Convex had no unique constraints and two
 * concurrent first loads would otherwise both insert. A reducer is a transaction
 * too, so that property is unchanged — but `account.identity` is now a real primary
 * key and `user.handle` a real unique constraint, so a race loses on the constraint
 * rather than on the check.
 */
export const ensureUser = spacetimedb.reducer(
  { displayName: t.string(), avatarUrl: t.option(t.string()) },
  (ctx, { displayName, avatarUrl }) => {
    const jwt = requireTrustedIssuer(ctx);

    if (ctx.db.account.identity.find(ctx.sender)) return;

    const created = ctx.db.user.insert({
      id: 0n,
      handle: allocateHandle(ctx, displayName),
      displayName,
      avatarUrl,
      avatarHidden: false,
      elo: STARTING_ELO,
      gamesPlayed: 0,
      placementsRemaining: PLACEMENT_MATCHES,
      createdAt: ctx.timestamp,
      role: undefined,
      xp: 0,
      level: 1,
      rankedWins: 0,
      snapGuesses: 0,
      onboardedAt: undefined,
      welcomeStep: undefined,
      tutorialCompletedAt: undefined,
      bio: undefined,
      bioHidden: false,
      isBot: false,
      botPersonaId: undefined,
      lastPracticePersonaId: undefined,
      isGuest: false,
      guestClaimedAt: undefined,
      guestClaimToken: undefined,
    });

    ctx.db.account.insert({
      identity: ctx.sender,
      userId: created.id,
      issuer: jwt.issuer,
      createdAt: ctx.timestamp,
    });
  },
);

/**
 * Derives a free handle from a display name, suffixing digits on collision.
 *
 * Unchanged in behaviour from the Convex original, including the 50-attempt cap and
 * the timestamp fallback beyond it.
 */
function allocateHandle(ctx: ReducerCtx, displayName: string): string {
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, HANDLE_MAX_LENGTH) || "player";

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    if (!ctx.db.user.handle.find(candidate)) return candidate;
  }

  return `${base}${ctx.timestamp.microsSinceUnixEpoch.toString(36)}`.slice(0, HANDLE_MAX_LENGTH);
}

/**
 * Creates the guest player row for an anonymous caller.
 *
 * A guest is simply a caller with no JWT, which is why this is a separate reducer
 * rather than a branch inside `ensureUser`: that one demands a trusted issuer, and
 * demanding one here would defeat the point. Anonymous identities are minted by
 * SpacetimeDB itself, so there is no client-supplied bearer token to validate — which
 * is the whole of what the Convex `guestByToken` machinery existed to do.
 *
 * Called on demand by the daily, never on page load, so a visitor who never plays
 * leaves nothing behind.
 *
 * The handle uses a random suffix rather than `allocateHandle`, which derives from a
 * display name and walks `guest2 … guest50` on collision; with every guest sharing one
 * base name that would degrade immediately.
 */
export function ensureGuestUser(ctx: ReducerCtx) {
  const existing = senderUser(ctx);
  if (existing) return existing;

  // A signed-in caller must never land here — they have an issuer and belong in
  // `ensureUser`, which gives them a real account rather than a disposable one.
  if (ctx.senderAuth.jwt != null) reject("Signed-in callers use ensureUser");

  /**
   * The token that lets a later sign-in claim these runs.
   *
   * Stored on the row rather than supplied by the client, and readable only through
   * the `me` view — so it is a capability the guest already holds, not a name anyone
   * can guess. This replaces the Convex token, which arrived from the browser and
   * therefore had to be treated as an assertion about who you were.
   */
  const token = `${ctx.timestamp.microsSinceUnixEpoch.toString(36)}${ctx.random
    .integerInRange(0, 0x7fffffff)
    .toString(36)}`;

  const created = ctx.db.user.insert({
    id: 0n,
    handle: guestHandle(ctx, token),
    displayName: "Guest",
    avatarUrl: undefined,
    avatarHidden: false,
    elo: STARTING_ELO,
    gamesPlayed: 0,
    // Never reaches 0, which is what keeps guests off the global ladder.
    placementsRemaining: PLACEMENT_MATCHES,
    createdAt: ctx.timestamp,
    role: undefined,
    xp: 0,
    level: 1,
    rankedWins: 0,
    snapGuesses: 0,
    onboardedAt: undefined,
    welcomeStep: undefined,
    tutorialCompletedAt: undefined,
    bio: undefined,
    bioHidden: false,
    isBot: false,
    botPersonaId: undefined,
    lastPracticePersonaId: undefined,
    isGuest: true,
    guestClaimedAt: undefined,
    guestClaimToken: token,
  });

  ctx.db.account.insert({
    identity: ctx.sender,
    userId: created.id,
    // No issuer: this identity was minted by the database, not by an OIDC provider.
    issuer: "",
    createdAt: ctx.timestamp,
  });

  return created;
}

/** A handle nobody else holds, without walking a shared base name. */
function guestHandle(ctx: ReducerCtx, token: string): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = attempt === 0 ? token.slice(0, 6) : `${token.slice(0, 4)}${attempt}`;
    const candidate = `guest_${suffix}`.slice(0, HANDLE_MAX_LENGTH);
    if (!ctx.db.user.handle.find(candidate)) return candidate;
  }
  return `guest_${ctx.timestamp.microsSinceUnixEpoch.toString(36)}`.slice(
    0,
    HANDLE_MAX_LENGTH,
  );
}

/**
 * Sets the player's uploaded picture.
 *
 * STORED IN `avatarUrl` AS A DATA URL, not as bytes in a table, and the reason is
 * replication rather than convenience. `user_avatar` holds raw bytes and is PRIVATE — it
 * has to be, or every client would replicate every player's image — which means nobody
 * but the owner could ever read it, and an avatar only exists to be seen by other people.
 * Making it public would push every stored image to every subscriber of `user`.
 *
 * `avatarUrl` is a public string that already travels with the row the avatar belongs to,
 * already renders on every surface, and already carries the `color:#rrggbb` form. A 256px
 * webp lands around 10-20KB, so the picture replicates exactly where the name does and
 * nowhere else.
 *
 * The client re-encodes to a 256px square webp before calling, so anything arriving near
 * the cap did not come from our own form. The cap exists for that case: a reducer is
 * callable directly, which makes the client's own limit a convenience rather than a
 * control.
 */
export const setAvatarImage = spacetimedb.reducer(
  { dataUrl: t.string() },
  (ctx, { dataUrl }) => {
    const player = requireFullAccount(ctx);

    const match = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) reject("That is not an image we can store");

    // Base64 carries four characters per three bytes, so this is the decoded size
    // without decoding it.
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > AVATAR_MAX_BYTES) reject("That picture is too large");

    ctx.db.user.id.update({
      ...player,
      avatarUrl: dataUrl,
      // A fresh picture starts unhidden; the reports that hid the last one were about a
      // different image.
      avatarHidden: false,
    });
  },
);

/**
 * Distinct reporters required before a profile field is auto-hidden.
 *
 * Hiding on a single report let any one player silence any other instantly and
 * repeatedly, and contradicted the `report` table's own purpose — manual review, not
 * automated takedown. A threshold is still only a stopgap; the real answer is a review
 * queue over the rows this writes.
 */
export const REPORTS_TO_HIDE = 3;

/** How much of a reason is kept. Enough to triage, not enough to be an essay. */
const REASON_MAX_LENGTH = 200;

/**
 * Reports a player's bio or avatar.
 *
 * `kind` is counted separately, so three people objecting to a tagline do not also take
 * down a picture nobody complained about.
 */
export const reportProfile = spacetimedb.reducer(
  { userId: t.u64(), reason: t.string(), kind: t.string() },
  (ctx, { userId, reason, kind }) => {
    const reporter = requireFullAccount(ctx);
    if (reporter.id === userId) reject("You cannot report yourself");
    if (kind !== "bio" && kind !== "avatar") reject("Unknown report kind");

    const target = ctx.db.user.id.find(userId);
    if (!target) reject("No such player");

    const sameKind = [...ctx.db.report.reportedUserId.filter(userId)].filter(
      (row) => row.kind === kind,
    );

    // One report per person per target per kind. Without this a single reporter could
    // reach any threshold alone, just by pressing the button repeatedly.
    if (sameKind.some((row) => row.reporterUserId === reporter.id)) return;

    ctx.db.report.insert({
      id: 0n,
      reportedUserId: userId,
      reporterUserId: reporter.id,
      kind,
      reason: reason.slice(0, REASON_MAX_LENGTH),
      createdAt: ctx.timestamp,
      resolvedAt: undefined,
    });

    const distinctReporters = new Set([
      ...sameKind.map((row) => row.reporterUserId),
      reporter.id,
    ]).size;

    if (distinctReporters < REPORTS_TO_HIDE) return;

    const current = ctx.db.user.id.find(userId);
    if (!current) return;

    ctx.db.user.id.update(
      kind === "bio"
        ? { ...current, bioHidden: true }
        : { ...current, avatarHidden: true },
    );
  },
);

/**
 * Completes first-run onboarding.
 *
 * Only the username is required — avatar, bio and genres are all editable later,
 * so nobody is blocked from playing by a form. Setting `onboardedAt` dismisses the
 * gate.
 */
export const completeOnboarding = spacetimedb.reducer(
  {
    handle: t.string(),
    bio: t.option(t.string()),
    avatarUrl: t.option(t.string()),
    preferredCategoryIds: t.array(t.u64()),
  },
  (ctx, { handle, bio, avatarUrl, preferredCategoryIds }) => {
    const player = requireSenderUser(ctx);
    const wanted = normaliseHandle(ctx, handle, player.id);

    const cleanBio = (bio ?? "").trim().slice(0, BIO_MAX_LENGTH);
    if (cleanBio && containsBlockedTerm(cleanBio)) reject("That bio isn't allowed");

    // A colour swatch, or nothing. An uploaded picture arrives through
    // `uploadAvatar`, and keeping the one Clerk supplied means not sending this.
    if (avatarUrl !== undefined && !AVATAR_COLOUR_PATTERN.test(avatarUrl)) {
      reject("Unsupported avatar");
    }

    ctx.db.user.id.update({
      ...player,
      handle: wanted,
      bio: cleanBio || undefined,
      avatarUrl: avatarUrl ?? player.avatarUrl,
      onboardedAt: ctx.timestamp,
    });

    writePreferences(ctx, player.id, preferredCategoryIds);
  },
);

/**
 * Profile edits after onboarding.
 *
 * Every field is INDEPENDENTLY optional, and that is a correctness requirement
 * rather than a convenience. The Convex version once computed `(bio ?? "").trim()`
 * unconditionally, so saving only your favourite genres resolved bio to `""` and
 * then to `undefined`, which in a patch removed the field — updating your genres
 * silently deleted your tagline. Settings still has separate sections that each
 * save one thing, so the guard is kept.
 */
export const updateProfile = spacetimedb.reducer(
  {
    bio: t.option(t.string()),
    avatarUrl: t.option(t.string()),
    preferredCategoryIds: t.option(t.array(t.u64())),
  },
  (ctx, { bio, avatarUrl, preferredCategoryIds }) => {
    const player = requireSenderUser(ctx);

    const cleanBio = bio === undefined ? undefined : bio.trim().slice(0, BIO_MAX_LENGTH);
    if (cleanBio && containsBlockedTerm(cleanBio)) reject("That bio isn't allowed");

    if (avatarUrl !== undefined && !AVATAR_COLOUR_PATTERN.test(avatarUrl)) {
      reject("Unsupported avatar");
    }

    // Switching to a colour swatch drops any uploaded image, so a replaced file
    // does not sit in the database forever. The Convex version did the same with
    // ctx.storage.delete.
    if (avatarUrl !== undefined) {
      ctx.db.user_avatar.userId.delete(player.id);
    }

    ctx.db.user.id.update({
      ...player,
      bio: cleanBio === undefined ? player.bio : cleanBio || undefined,
      avatarUrl: avatarUrl ?? player.avatarUrl,
    });

    if (preferredCategoryIds !== undefined) {
      writePreferences(ctx, player.id, preferredCategoryIds);
    }
  },
);

/** Rename, with the same pattern, blocklist and uniqueness rules as onboarding. */
export const setHandle = spacetimedb.reducer(
  { handle: t.string() },
  (ctx, { handle }) => {
    const player = requireSenderUser(ctx);
    const wanted = normaliseHandle(ctx, handle, player.id);
    ctx.db.user.id.update({ ...player, handle: wanted });
  },
);

/**
 * Monotonic welcome-flow progress.
 *
 * Never touches `onboardedAt`: having a username and having seen the flow are
 * different claims, and conflating them is what made a refresh mid-flow either
 * restart it or skip it depending on which field you read.
 */
export const setWelcomeStep = spacetimedb.reducer(
  { step: t.i32(), tutorialCompleted: t.bool() },
  (ctx, { step, tutorialCompleted }) => {
    const player = requireSenderUser(ctx);
    const next = Math.max(step, player.welcomeStep ?? 0);

    ctx.db.user.id.update({
      ...player,
      welcomeStep: next,
      tutorialCompletedAt: tutorialCompleted
        ? (player.tutorialCompletedAt ?? ctx.timestamp)
        : player.tutorialCompletedAt,
    });
  },
);

/**
 * Refuses a caller whose token did not come from an issuer this database trusts.
 *
 * THIS is `convex/auth.config.ts`. Convex named an issuer in a config file and the
 * platform verified the signature before any function ran. Here the host still
 * verifies the signature, but deciding which issuers count is the module's job,
 * and this is the point where it matters: an identity that passes here gets a
 * player account, a rating and a place on the ladder.
 *
 * Checking the audience is not optional. Without it, a token another application
 * legitimately issued to this same user could be replayed here — the signature
 * would verify and the issuer would match, and only `aud` says who the token was
 * minted for.
 *
 * An empty `auth_issuer` table refuses everyone, which is the intended failure
 * mode and the same call the Convex setup made: auth silently not working is worse
 * than a loud refusal, and defaulting to "accept anything" would accept a token
 * from any OIDC provider on the internet.
 */
function requireTrustedIssuer(ctx: ReducerCtx) {
  const jwt = ctx.senderAuth.jwt;
  if (jwt == null) reject("Not signed in");

  const allowed = ctx.db.auth_issuer.issuer.find(jwt.issuer);
  if (!allowed) {
    reject(`Unauthorized issuer ${jwt.issuer}. Register it with \`npm run stdb:auth\`.`);
  }
  if (allowed.audience !== "" && !jwt.audience.includes(allowed.audience)) {
    reject(`Unauthorized audience for ${jwt.issuer}`);
  }

  return jwt;
}

/** Validation shared by every path that writes a handle, so they cannot disagree. */
function normaliseHandle(ctx: ReducerCtx, raw: string, selfId: bigint): string {
  const handle = raw.toLowerCase().trim();

  if (!HANDLE_PATTERN.test(handle)) {
    reject(
      `Username must be 3-${HANDLE_MAX_LENGTH} characters: letters, numbers, underscore`,
    );
  }
  if (containsBlockedTerm(handle)) reject("That username isn't allowed");

  const taken = ctx.db.user.handle.find(handle);
  if (taken && taken.id !== selfId) reject("That username is taken");

  return handle;
}

/** Preferences live in their own table so editing them does not re-send the user row. */
function writePreferences(ctx: ReducerCtx, userId: bigint, categoryIds: bigint[]): void {
  const existing = ctx.db.user_preference.userId.find(userId);
  if (existing) {
    ctx.db.user_preference.userId.update({ ...existing, preferredCategoryIds: categoryIds });
  } else {
    ctx.db.user_preference.insert({ userId, preferredCategoryIds: categoryIds });
  }
}

// ---------------------------------------------------------------------------
// Operator setup
// ---------------------------------------------------------------------------

/**
 * Registers an OIDC issuer. Owner only.
 *
 * Replaces `npx convex env set CLERK_JWT_ISSUER_DOMAIN …`. Run through
 * `npm run stdb:auth` after publishing, or no signed-in player can connect.
 */
export const setAuthIssuer = spacetimedb.reducer(
  { issuer: t.string(), audience: t.string() },
  (ctx, { issuer, audience }) => {
    requireModuleOwner(ctx);

    const existing = ctx.db.auth_issuer.issuer.find(issuer);
    if (existing) {
      ctx.db.auth_issuer.issuer.update({ ...existing, audience });
      return;
    }
    ctx.db.auth_issuer.insert({ issuer, audience, addedAt: ctx.timestamp });
  },
);

export const removeAuthIssuer = spacetimedb.reducer(
  { issuer: t.string() },
  (ctx, { issuer }) => {
    requireModuleOwner(ctx);
    ctx.db.auth_issuer.issuer.delete(issuer);
  },
);

/**
 * Grants or revokes admin by handle.
 *
 * The first admin is granted by the module owner, which is the publisher — the
 * Convex equivalent needed `roles:grantBySecret` and a shared secret because a
 * deployment had no notion of who owned it. An admin may not revoke themselves,
 * so the console cannot be locked out from inside it.
 */
export const setRole = spacetimedb.reducer(
  { handle: t.string(), admin: t.bool() },
  (ctx, { handle, admin }) => {
    requireOwnerOrAdmin(ctx);

    const target = ctx.db.user.handle.find(handle.toLowerCase().trim());
    if (!target) reject("No such player");

    if (!admin) {
      const self = senderUser(ctx);
      if (self && self.id === target.id) reject("You cannot revoke your own admin");
    }

    ctx.db.user.id.update({ ...target, role: admin ? "admin" : undefined });
  },
);

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

/**
 * The caller's own player row.
 *
 * `users.me` in the Convex backend, and the same deliberate exception: it does NOT
 * apply the reported-avatar fallback, because hiding someone's picture from
 * themselves would leave them unable to tell why it looks wrong to everyone else,
 * or to go and change it.
 *
 * Also the client's only source of its own userId, which every other subscription
 * filters on.
 */
export const me = spacetimedb.view(
  { name: "me", public: true },
  t.option(user.rowType),
  (ctx) => {
    const account = ctx.db.account.identity.find(ctx.sender);
    if (!account) return undefined;
    return ctx.db.user.id.find(account.userId) ?? undefined;
  },
);

const HandleAvailability = t.row("HandleAvailability", {
  handle: t.string(),
  available: t.bool(),
  /** "invalid" | "blocked" | "taken", or empty when available. */
  reason: t.string(),
});

/**
 * Live handle availability for the onboarding form.
 *
 * A VIEW CANNOT TAKE ARGUMENTS, which is the sharpest difference between these and
 * Convex queries — `isHandleAvailable({ handle })` has no direct equivalent. Rather
 * than push the whole handle list to the client (which is both large and a
 * user-enumeration hole), the client writes its candidate to `handle_probe` and
 * reads the verdict back here.
 *
 * That sounds roundabout for a form field, but it is the same number of round trips
 * a Convex query took, and it keeps the rule in one place: `normaliseHandle` decides
 * both the answer shown here and the answer enforced on save, so the form can never
 * promise a name the write path then refuses.
 */
export const myHandleProbe = spacetimedb.view(
  { name: "my_handle_probe", public: true },
  t.option(HandleAvailability),
  (ctx) => {
    const account = ctx.db.account.identity.find(ctx.sender);
    if (!account) return undefined;

    const probe = ctx.db.handle_probe.userId.find(account.userId);
    if (!probe) return undefined;

    const handle = probe.candidate.toLowerCase().trim();

    if (!HANDLE_PATTERN.test(handle)) {
      return { handle, available: false, reason: "invalid" };
    }
    if (containsBlockedTerm(handle)) {
      return { handle, available: false, reason: "blocked" };
    }

    const taken = ctx.db.user.handle.find(handle);
    if (taken && taken.id !== account.userId) {
      return { handle, available: false, reason: "taken" };
    }

    return { handle, available: true, reason: "" };
  },
);

/** Writes the candidate the availability view reads back. */
export const probeHandle = spacetimedb.reducer(
  { candidate: t.string() },
  (ctx, { candidate }) => {
    const player = requireSenderUser(ctx);
    const existing = ctx.db.handle_probe.userId.find(player.id);

    if (existing) {
      ctx.db.handle_probe.userId.update({ ...existing, candidate, probedAt: ctx.timestamp });
      return;
    }
    ctx.db.handle_probe.insert({ userId: player.id, candidate, probedAt: ctx.timestamp });
  },
);
