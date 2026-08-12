import { schema, table, t } from "spacetimedb/server";

/**
 * SNAP ARENA's schema, ported from the Convex original.
 *
 * Three rules govern everything below, and they are what makes this a port
 * rather than a transcription:
 *
 * 1. PRIVATE BY DEFAULT, AND PRIVATE MEANS PRIVATE. A Convex query could read a
 *    document and return part of it. A SpacetimeDB subscription hands the client
 *    the whole row. So anything a player must not see — the songs in play, the
 *    aliases that match them, the text of an opponent's guess — lives in a
 *    private table, and what the player MAY see is materialised into a separate
 *    public table by the reducer that changes it. See `round_reveal`.
 *
 * 2. ORGANISE BY UPDATE FREQUENCY. A row is the unit of replication: touching one
 *    field re-sends the row to every subscriber. Fields written per-guess are
 *    kept apart from fields written once per match.
 *
 * 3. REAL CONSTRAINTS. The Convex schema carried seven fields commented "UNIQUE"
 *    and enforced by hand inside mutations, because Convex has no unique
 *    constraints. SpacetimeDB does, so those comments become `.unique()` and the
 *    hand-rolled checks go away.
 *
 * Naming: table `name` and the `schema({...})` key are both snake_case and must
 * match — the key is the `ctx.db` accessor verbatim.
 */

// ---------------------------------------------------------------------------
// Shared column shapes
// ---------------------------------------------------------------------------

/**
 * `mode`, `status` and `phase` stay STRINGS rather than becoming `t.enum` sum
 * types, which is the one place this port knowingly declines the more idiomatic
 * option.
 *
 * Two reasons. Subscriptions filter on them (`match.where(r => r.status.eq(...))`)
 * and the query builder's comparison operators are defined over scalars, not over
 * tagged unions. And the client compares them as strings in ~40 places
 * (`phase === "guessing"`); a sum type would turn every one of those into
 * `phase.tag === "guessing"` for no behavioural gain.
 *
 * Convex stored these as `v.union` of string literals, which is also a string on
 * the wire, so this is not a change in representation — only in what the type
 * system checks. The engine's own `MatchPhase` union in src/engine/config.ts
 * remains the source of truth and still type-checks every write.
 */

/** Damage dealt to one player by one round. */
const RoundDamage = t.object("RoundDamage", {
  userId: t.u64(),
  damage: t.f64(),
  hpAfter: t.f64(),
});

/** One player's outcome in one round. */
const RoundPlayerResult = t.object("RoundPlayerResult", {
  userId: t.u64(),
  points: t.f64(),
  /** Absent when the player did not solve. */
  elapsedMs: t.option(t.f64()),
  solved: t.bool(),
});

/**
 * One closed round.
 *
 * Stored rather than recomputed from guesses, for the reason the Convex schema
 * gave: the multiplier, the tie rules and the score curve are all expected to be
 * retuned, and a recomputed history would silently rewrite finished matches.
 */
const RoundLogEntry = t.object("RoundLogEntry", {
  roundIndex: t.i32(),
  /** "tier" | "time" | "song" — why the round went the way it did. */
  outcome: t.string(),
  winnerId: t.option(t.u64()),
  /** Present only when the round was settled on reaction time. */
  timeGapMs: t.option(t.f64()),
  multiplier: t.f64(),
  damage: t.array(RoundDamage),
  results: t.array(RoundPlayerResult),
});

/** One line of the post-match XP breakdown ("Rounds won x3"). */
const XpAward = t.object("XpAward", {
  reason: t.string(),
  amount: t.f64(),
});

/** One stored config override: a dotted path into ResolvedConfig, and its value. */
const ConfigOverride = t.object("ConfigOverride", {
  /** e.g. "DUEL_STARTING_HP" or "XP_AWARDS.rankedWin". */
  key: t.string(),
  /** Null only where the registry marks the entry nullable. */
  value: t.option(t.f64()),
});

// ---------------------------------------------------------------------------
// Identity and players
// ---------------------------------------------------------------------------

/**
 * The identity → player mapping. This is the old `by_clerk_id` index.
 *
 * Kept as its own table rather than an `identity` column on `user` for one
 * reason: BOTS ARE ORDINARY USER ROWS (the invariant the Convex schema leaned on
 * so every join and match flow works unchanged), and a bot has no connection and
 * therefore no Identity. A separate table lets the mapping be total and unique on
 * the rows that have one, instead of nullable-unique on the rows that do not.
 *
 * Private: a client learns its own userId through the `me` view. Publishing the
 * whole identity↔player mapping would let anyone enumerate the player base.
 */
const account = table(
  { name: "account" },
  {
    identity: t.identity().primaryKey(),
    userId: t.u64().unique(),
    /** Which OIDC issuer minted this identity, for the audit trail. */
    issuer: t.string(),
    createdAt: t.timestamp(),
  },
);

/**
 * A player. Public — handles, ratings and levels are shown all over the app.
 *
 * `avatarUrl` keeps its exact three-form contract from the Convex schema:
 *
 *   `color:#rrggbb`   a swatch chosen during onboarding, rendered as an initial
 *   an https URL      Clerk's picture at sign-up, or this module's own
 *                     /route/avatar/:userId for an upload
 *   absent            falls back to the initial on ink
 *
 * The uploaded bytes live in `user_avatar`, not here, so the leaderboard can read
 * 500 of these rows without pulling 500 images down the socket.
 */
const user = table(
  { name: "user", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    /** UNIQUE. Lowercased; the display form is `displayName`. */
    handle: t.string().unique(),
    displayName: t.string(),
    avatarUrl: t.option(t.string()),
    /** Hidden pending review after reports. Mirrors `bioHidden`. */
    avatarHidden: t.bool(),

    elo: t.i32().index("btree"),
    gamesPlayed: t.i32(),
    placementsRemaining: t.i32(),
    /**
     * Explicit, because SpacetimeDB has no `_creationTime`. The ladder's
     * tie-break is (elo desc, createdAt desc) and it is load-bearing: Elo is an
     * integer over a narrow range with a large cohort parked at STARTING_ELO, so
     * ties are the common case rather than the tail.
     */
    createdAt: t.timestamp(),

    /** "admin", or absent for the overwhelming majority. */
    role: t.option(t.string()),

    /** Lifetime XP. Never decreases, so a lost match still advances the bar. */
    xp: t.f64(),
    /** Denormalised from xp so boards and VS cards skip recomputing the curve. */
    level: t.i32(),
    rankedWins: t.i32(),
    snapGuesses: t.i32(),

    // --- profile ----------------------------------------------------------
    /**
     * Set the moment a username is committed, which is the FIRST step of the
     * welcome flow rather than the last.
     *
     * Convex needed that ordering because it had no unique constraints, so the
     * only way to hold a name was to write it. SpacetimeDB does have them, so a
     * late commit would now be safe — but the ordering is kept, because the
     * behaviour players see (your name is yours from the first screen) is part of
     * what must not change.
     */
    onboardedAt: t.option(t.timestamp()),
    /** How far through the welcome flow this player got, so a refresh resumes. */
    welcomeStep: t.option(t.i32()),
    /** Set when the coached rounds were played through rather than skipped. */
    tutorialCompletedAt: t.option(t.timestamp()),
    bio: t.option(t.string()),
    /** Hidden pending review after a report. */
    bioHidden: t.bool(),

    // --- bots -------------------------------------------------------------
    isBot: t.bool().index("btree"),
    botPersonaId: t.option(t.string()),
    /** Whoever this player faced in their last practice match, so the "random" pick rotates. */
    lastPracticePersonaId: t.option(t.string()),

    // --- guests -----------------------------------------------------------
    /**
     * Anonymous daily players.
     *
     * The Convex version minted `clerkId: "guest:<uuid>"` from a token the client
     * kept in localStorage. SpacetimeDB gives every anonymous connection a real
     * Identity plus a token the SDK persists, so a guest is now just an `account`
     * row whose player is flagged here. src/app/guest.ts is deleted.
     */
    isGuest: t.bool().index("btree"),
    /** Set once a guest's run has been claimed by a real account. */
    guestClaimedAt: t.option(t.timestamp()),
    /**
     * Proof-of-ownership for the claim at sign-in.
     *
     * Signing in produces a DIFFERENT Identity (Clerk's, not the anonymous one),
     * so the claim cannot be authorised by `ctx.sender` alone. The guest client is
     * the only party ever told this value, and it is cleared on claim.
     */
    guestClaimToken: t.option(t.string()),
  },
);

/**
 * Player preferences that are read on their own screens and written rarely.
 *
 * Split out of `user` because `user` is the single most-subscribed table in the
 * app — the shell, the queue driver, every VS card and the leaderboard all hold
 * rows from it — and a player reordering their favourite genres has no business
 * re-sending their row to everyone watching the ladder.
 */
const user_preference = table(
  { name: "user_preference", public: true },
  {
    userId: t.u64().primaryKey(),
    preferredCategoryIds: t.array(t.u64()),
  },
);

/**
 * Uploaded avatar bytes. PRIVATE, and served over HTTP instead.
 *
 * Convex stored a resolved storage URL on the user row so the ladder could render
 * 500 avatars without 500 storage lookups. The same pressure applies here for a
 * different reason: these rows are ~30KB of webp each, and a public table would
 * push all of them over the WebSocket to anyone subscribed. The module's own
 * /route/avatar/:userId handler serves them, so the browser caches them like any
 * other image and `user.avatarUrl` keeps pointing at a plain URL.
 */
const user_avatar = table(
  { name: "user_avatar" },
  {
    userId: t.u64().primaryKey(),
    mimeType: t.string(),
    data: t.array(t.u8()),
    /** Bumped on every replacement so the URL busts the browser cache. */
    version: t.i32(),
    uploadedAt: t.timestamp(),
  },
);

/**
 * The username a player is currently typing into the onboarding form. PRIVATE.
 *
 * A VIEW CANNOT TAKE ARGUMENTS. That is the sharpest difference between views and
 * Convex queries, and `isHandleAvailable({ handle })` is where it bites: the form
 * needs a live yes/no for a string the client chooses.
 *
 * The alternatives are worse. Replicating every handle to every client is both
 * large and a user-enumeration hole. Answering through a reducer is impossible,
 * because reducers return nothing. So the candidate is written here and the verdict
 * is read back from `my_handle_probe` — one row per player, overwritten as they
 * type, never read by anyone else.
 *
 * The rule itself lives in `normaliseHandle`, which decides both the answer shown
 * in the form and the answer enforced on save, so the two can never disagree.
 */
const handle_probe = table(
  { name: "handle_probe" },
  {
    userId: t.u64().primaryKey(),
    candidate: t.string(),
    probedAt: t.timestamp(),
  },
);

/** Bio and avatar reports, for manual review. No automated takedown. */
const report = table(
  { name: "report" },
  {
    id: t.u64().primaryKey().autoInc(),
    reportedUserId: t.u64().index("btree"),
    reporterUserId: t.u64(),
    /** "bio" | "avatar" — separate thresholds, so a bad tagline cannot pull a picture. */
    kind: t.string(),
    reason: t.string(),
    createdAt: t.timestamp(),
    resolvedAt: t.option(t.timestamp()),
  },
);

/** Awarded badges. One row per player per badge. */
const user_badge = table(
  {
    name: "user_badge",
    public: true,
    indexes: [
      { accessor: "by_user_badge", algorithm: "btree", columns: ["userId", "badgeId"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    userId: t.u64().index("btree"),
    badgeId: t.string(),
    earnedAt: t.timestamp(),
  },
);

/** Per-genre skill, shown on the profile and used to pick a "best category". */
const category_rating = table(
  {
    name: "category_rating",
    public: true,
    indexes: [
      { accessor: "by_user_category", algorithm: "btree", columns: ["userId", "categoryId"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    userId: t.u64().index("btree"),
    categoryId: t.u64(),
    rating: t.f64(),
    games: t.i32(),
  },
);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

const category = table(
  { name: "category", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    slug: t.string().unique(),
    name: t.string(),
    sortOrder: t.i32(),
  },
);

/**
 * The song catalogue. PRIVATE — this table IS the answer key.
 *
 * In the Convex version `matches.state` was careful to omit the current round's
 * track until the reveal beat, but the catalogue itself was readable by any
 * signed-in caller, because reading it required calling a query that chose what
 * to return. Here there is no such choke point: a public table is simply
 * downloadable. So nothing outside the module ever sees a row of this.
 *
 * What players are allowed to hear and then see is copied into `round_reveal` by
 * the phase reducers, and the autocomplete list is copied into `track_index`.
 */
const track = table(
  {
    name: "track",
    indexes: [
      {
        accessor: "by_playable_difficulty",
        algorithm: "btree",
        columns: ["playable", "difficulty"],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    itunesTrackId: t.i64().unique(),
    title: t.string(),
    titleNormalized: t.string().index("btree"),
    artist: t.string(),
    artistNormalized: t.string(),
    artworkUrl: t.string(),
    previewUrl: t.string(),
    previewCheckedAt: t.timestamp(),
    categoryIds: t.array(t.u64()),
    /** 1 (easiest) .. 5 (hardest). Seeded from popularity, corrected from play data. */
    difficulty: t.i32(),
    popularity: t.i32(),
    releaseYear: t.i32(),
    /** False for alternate cuts and anything held out of the playable pool. */
    playable: t.bool(),
    /** Rolling median solve time, used to re-tier difficulty. None until enough data. */
    medianSolveMs: t.option(t.f64()),
    solveSampleCount: t.i32(),
  },
);

/** Accepted alternate spellings. PRIVATE for the same reason as `track`. */
const track_alias = table(
  { name: "track_alias" },
  {
    id: t.u64().primaryKey().autoInc(),
    trackId: t.u64().index("btree"),
    aliasNormalized: t.string().index("btree"),
  },
);

/**
 * The autocomplete title list, precomputed. Exactly one row.
 *
 * This is now the ONLY autocomplete path. Convex had a full-text search index on
 * `tracks` behind a `tracks.autocomplete` query; SpacetimeDB has no full-text
 * search and, more to the point, `track` is private now. The client already
 * downloaded this list once per session and matched against it locally
 * (src/game/track-index.ts + src/engine/autocomplete.ts), so deleting the search
 * path costs nothing.
 *
 * Titles only. The anti-cheat rule the Convex version wrote down still holds: the
 * suggestion set is the WHOLE catalogue and carries nothing but the title, so a
 * suggestion can never confirm a guess or narrow the round in play.
 */
const track_index = table(
  { name: "track_index", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    /** Deduplicated by normalized title, most popular first. */
    titles: t.array(t.string()),
    /** True when the build hit its ceiling and the tail is missing. */
    truncated: t.bool(),
    /** Rows scanned to build this, for the staleness readout in /admin. */
    trackCount: t.i32(),
    builtAt: t.timestamp(),
  },
);

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

/**
 * A match. Public — but note what is NOT here.
 *
 * The Convex row carried `trackIds: Id<"tracks">[]`, the whole setlist. That is
 * the single most dangerous field in the schema to replicate, so the setlist
 * lives in the private `match_track` table and the client learns each song only
 * through `round_reveal`, one round at a time.
 */
const match = table(
  {
    name: "match",
    public: true,
    indexes: [{ accessor: "by_status", algorithm: "btree", columns: ["status"] }],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    /** "ranked" | "room" | "daily" | "practice". */
    mode: t.string(),
    /** "veto" | "active" | "complete" | "abandoned". Coarse lifecycle. */
    status: t.string(),
    playerIds: t.array(t.u64()),
    /** How many songs this match has. The songs themselves are in `match_track`. */
    totalRounds: t.i32(),
    /** Union of both players' bans, populated when the veto phase closes. */
    bannedCategoryIds: t.array(t.u64()),
    /** Categories offered during the ban phase. Ranked only. */
    vetoPoolIds: t.array(t.u64()),
    /** Wall-clock after which the veto phase auto-closes with whatever was banned. */
    vetoDeadline: t.option(t.timestamp()),
    /** Ban order, lower-rated player first; index N is whose turn it is. */
    banOrder: t.array(t.u64()),
    /** How many bans have been placed; indexes into banOrder. */
    banTurn: t.i32(),

    currentRound: t.i32(),
    /** Server wall-clock at which the current round was dispatched. */
    roundStartedAt: t.option(t.timestamp()),

    // --- phase machine ----------------------------------------------------
    /** What the client renders right now. Advanced by scheduled reducers, never by a client. */
    phase: t.string(),
    /** Wall-clock the current phase ends at; drives every countdown ring in the UI. */
    phaseEndsAt: t.option(t.timestamp()),
    /** True once the match has fallen through to a single sudden-death song. */
    suddenDeath: t.bool(),

    roomId: t.option(t.u64()),
    winnerId: t.option(t.u64()),
    createdAt: t.timestamp(),
    completedAt: t.option(t.timestamp()),
    /**
     * The config this match is played under, frozen at creation, so saving a new
     * config mid-duel cannot move the score curve under two players who are
     * halfway through a round. None means "the shipped defaults".
     */
    configVersionId: t.option(t.u64()),
  },
);

/**
 * The setlist. PRIVATE — this is the answer key for a match in progress.
 *
 * Split out of `match.trackIds` so that subscribing to a match cannot reveal what
 * is coming. The reducers read it; clients never do.
 */
const match_track = table(
  {
    name: "match_track",
    indexes: [
      { accessor: "by_match_round", algorithm: "btree", columns: ["matchId", "roundIndex"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    matchId: t.u64().index("btree"),
    roundIndex: t.i32(),
    trackId: t.u64(),
  },
);

/**
 * What the client is allowed to know about a round, and no more. PUBLIC.
 *
 * This is the load-bearing table of the whole port. The phase reducers write it:
 *
 *   entering countdown/guessing → previewUrl only. Enough to buffer and play the
 *                                 clip, nothing that names it.
 *   entering reveal             → title, artist, artwork and category are filled
 *                                 in, which is the moment the UI shows them.
 *
 * A round's row is created when the round is dispatched and updated once when it
 * closes, so a client that subscribes mid-match sees revealed rounds in full and
 * the round in progress as audio alone.
 *
 * Convex achieved this by having ONE query remember to omit a field. This achieves
 * it by never putting the field in a replicated row until it is public knowledge,
 * which is a property of the schema rather than of a code path.
 */
const round_reveal = table(
  {
    name: "round_reveal",
    public: true,
    indexes: [
      { accessor: "by_match_round", algorithm: "btree", columns: ["matchId", "roundIndex"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    matchId: t.u64().index("btree"),
    roundIndex: t.i32(),
    /** Always present — the clip has to be fetchable before anyone can guess it. */
    previewUrl: t.string(),
    /** All None until the round closes. */
    title: t.option(t.string()),
    artist: t.option(t.string()),
    artworkUrl: t.option(t.string()),
    categoryName: t.option(t.string()),
    revealedAt: t.option(t.timestamp()),
  },
);

/**
 * One row per player per match. Public.
 *
 * Everything here is either written once (the rating and rank snapshots, the
 * post-match XP) or a few times per match (hp, readiness). The per-guess churn
 * lives in `round_result` instead, so a guess does not re-send a row carrying an
 * XP breakdown to everyone watching.
 */
const match_player = table(
  {
    name: "match_player",
    public: true,
    indexes: [
      { accessor: "by_match_user", algorithm: "btree", columns: ["matchId", "userId"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    matchId: t.u64().index("btree"),
    userId: t.u64().index("btree"),
    totalPoints: t.f64(),

    /** Rating snapshot taken at match start, so results are reproducible. */
    ratingBefore: t.i32(),
    /**
     * Ladder position at match start, frozen.
     *
     * The Convex reason was read cost: resolving it live inside a subscribed query
     * made invalidations grow with the square of concurrent players. That specific
     * pressure is gone, but the field stays, because the behaviour it produces is
     * the one players expect — the VS screen shows a rank once, before round one,
     * and nobody expects their opponent's rank to move mid-duel.
     */
    globalRankAtStart: t.option(t.i32()),
    ratingAfter: t.option(t.i32()),
    ratingDelta: t.option(t.i32()),
    /** This player's veto bans. Empty means they have not banned yet. */
    bannedCategoryIds: t.array(t.u64()),
    hasBanned: t.bool(),

    // --- health duel ------------------------------------------------------
    hp: t.f64(),
    /** Low-water mark across the match, for the comeback badge. */
    lowestHp: t.f64(),
    /** Round at which HP hit zero; None while alive. */
    eliminatedAtRound: t.option(t.i32()),
    /**
     * Highest round index this client has fully buffered. The guessing clock does
     * not start until every player has reported the current round, which is what
     * stops a slow connection producing a truncated song.
     */
    readyForRound: t.i32(),
    /**
     * When this player pressed Ready on the opponent reveal. Deliberately separate
     * from `readyForRound`: that one is "has your browser buffered the clip", this
     * one is "I have read this and I want to start".
     */
    vsReadyAt: t.option(t.timestamp()),
    /** Set when the player passes; the round can end once everyone is done. */
    passedRound: t.option(t.i32()),

    // --- results ----------------------------------------------------------
    xpEarned: t.f64(),
    /** Itemised, and persisted rather than recomputed, because awards get retuned. */
    xpBreakdown: t.array(XpAward),
    /** Level either side, so the results screen can animate real progress. */
    levelBefore: t.option(t.i32()),
    levelAfter: t.option(t.i32()),
    xpAfter: t.option(t.f64()),
    badgesEarned: t.array(t.string()),
    forfeited: t.bool(),

    /**
     * Mode and result, copied on when the match is finalised so a history row can
     * be rendered without opening the match. Written once, by finalizeMatch.
     */
    mode: t.option(t.string()),
    completedAt: t.option(t.timestamp()),
    /** "win" | "loss" | "draw" from THIS row's point of view. */
    outcome: t.option(t.string()),
    /** The other player. None in a room (more than one) and in the daily (none). */
    opponentId: t.option(t.u64()),
  },
);

/**
 * Every closed round of a match, one row per round. Public.
 *
 * The Convex version kept this as a `roundLog` array on the match document, which
 * was 71% of a 3.3KB row. As an array it would be rewritten — and re-sent to both
 * players — on every round; as rows, closing round 4 sends round 4.
 */
const round_log = table(
  {
    name: "round_log",
    public: true,
    indexes: [
      { accessor: "by_match_round", algorithm: "btree", columns: ["matchId", "roundIndex"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    matchId: t.u64().index("btree"),
    /**
     * Lifted out of `entry` so it can be indexed and ordered on. The copy inside
     * `entry` is kept because that object is what the engine's duel code already
     * consumes, and keeping its shape means no adapter at the call site.
     */
    roundIndex: t.i32(),
    entry: RoundLogEntry,
  },
);

/**
 * Per-player, per-round scoring state. Public.
 *
 * This is the high-frequency table: it is written on every accepted guess and
 * every pass. It carries points, reaction time and solved-ness — the numbers the
 * between-round beats show — and deliberately NOT the guess text, which would
 * hand the opponent the answer the instant either player got it right.
 */
const round_result = table(
  {
    name: "round_result",
    public: true,
    indexes: [
      {
        accessor: "by_match_round_user",
        algorithm: "btree",
        columns: ["matchId", "roundIndex", "userId"],
      },
      { accessor: "by_match_round", algorithm: "btree", columns: ["matchId", "roundIndex"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    matchId: t.u64().index("btree"),
    roundIndex: t.i32(),
    userId: t.u64(),
    points: t.f64(),
    elapsedMs: t.option(t.f64()),
    solved: t.bool(),
    /** Wrong guesses so far this round, for the attempt cap and the lockout. */
    attempts: t.i32(),
    /** Wall-clock until which this player is locked out after a wrong guess. */
    lockedUntil: t.option(t.timestamp()),
    passed: t.bool(),
  },
);

/**
 * The raw guess log. PRIVATE.
 *
 * `rawText` is exactly the answer once somebody is right, so this can never be a
 * public table. It is kept for the same reasons Convex kept it — anti-cheat
 * forensics and the rejection audit trail — and read only by reducers and by the
 * caller's own `my_round_status` view.
 */
const guess = table(
  {
    name: "guess",
    indexes: [
      {
        accessor: "by_match_round_user",
        algorithm: "btree",
        columns: ["matchId", "roundIndex", "userId"],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    matchId: t.u64().index("btree"),
    roundIndex: t.i32(),
    userId: t.u64(),
    rawText: t.string(),
    normalizedText: t.string(),
    correct: t.bool(),
    /** Client-measured reaction time, already validated when `accepted` is true. */
    clientElapsedMs: t.f64(),
    serverReceivedAt: t.timestamp(),
    accepted: t.bool(),
    rejectionReason: t.option(t.string()),
    points: t.f64(),
  },
);

/**
 * The verdict on a single guess, delivered to the player who made it. EVENT TABLE.
 *
 * Convex mutations returned a value, so `submitGuess` could answer
 * "correct/wrong/rejected, and why" in its own return. Reducers return nothing,
 * and the durable tables above deliberately do not carry the answer — so the
 * one-shot verdict travels as an event: broadcast on commit, never stored.
 *
 * Row-level filtering by `userId` is what keeps a wrong guess from telling the
 * opponent anything.
 */
const guess_feedback = table(
  { name: "guess_feedback", public: true, event: true },
  {
    matchId: t.u64(),
    roundIndex: t.i32(),
    userId: t.u64().index("btree"),
    /** "correct" | "wrong" | "rejected". */
    outcome: t.string(),
    points: t.f64(),
    rejectionReason: t.option(t.string()),
  },
);

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

const room = table(
  { name: "room", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    /** 5 chars, alphabet excludes O/0/I/1/L. */
    code: t.string().unique(),
    hostId: t.u64(),
    memberIds: t.array(t.u64()),
    /** "lobby" | "in_match" | "closed". */
    status: t.string(),
    activeMatchId: t.option(t.u64()),
    /**
     * Members ready for the next start. Advisory, never a gate — a hard gate hands
     * one player who wandered off a veto over seven others, and there is no kick.
     * Cleared on join, leave, start and returnToLobby.
     */
    readyIds: t.array(t.u64()),
    createdAt: t.timestamp(),
  },
);

// ---------------------------------------------------------------------------
// Daily challenge
// ---------------------------------------------------------------------------

/** The day's setlist. PRIVATE — same answer-key reasoning as `match_track`. */
const daily_challenge = table(
  { name: "daily_challenge" },
  {
    id: t.u64().primaryKey().autoInc(),
    /** ISO date, UTC. */
    date: t.string().unique(),
    trackIds: t.array(t.u64()),
  },
);

const daily_run = table(
  {
    name: "daily_run",
    public: true,
    indexes: [
      { accessor: "by_user_date", algorithm: "btree", columns: ["userId", "date"] },
      { accessor: "by_date_points", algorithm: "btree", columns: ["date", "totalPoints"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    userId: t.u64().index("btree"),
    date: t.string().index("btree"),
    totalPoints: t.f64(),
    perRoundMs: t.array(t.f64()),
    perRoundPoints: t.array(t.f64()),
    completedAt: t.timestamp(),
    /** Denormalised so the board can exclude guests without a lookup per run. */
    isGuest: t.bool(),
  },
);

/**
 * How many runs each day has, as a running total.
 *
 * Kept from the Convex schema. The reason there was read cost — counting meant a
 * `.take` of up to a thousand rows for every visitor with the landing page open.
 * The reason here is bandwidth: the landing page is subscribed by signed-out
 * visitors too, and one counter row is a great deal less traffic than the day's
 * runs.
 */
const daily_count = table(
  { name: "daily_count", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    date: t.string().unique(),
    players: t.i32(),
  },
);

// ---------------------------------------------------------------------------
// Ladder and matchmaking
// ---------------------------------------------------------------------------

/**
 * The global ladder, one row per ranked player.
 *
 * REPLACES the Convex `ladderSnapshot`, which held the entire ordering as a single
 * ~415KB document. That shape was right for Convex, where the cost was in reading;
 * it is wrong here, where the cost is in replicating — a single rank change would
 * have re-sent all 5,000 entries to every subscriber.
 *
 * As rows: the board subscribes to `rank <= ROW_DEPTH`, a player's own position is
 * one lookup by `userId`, and a rebuild that moves three people sends three rows.
 *
 * Freshness is preserved in the way that matters. A five-minute rebuild refreshes
 * everyone, but `finalizeMatch` rewrites the finishing players' OWN rows
 * immediately — so your number still moves the instant your match ends, which is
 * what `positionIn` bought by measuring a live rating against a stale field.
 */
const ladder_entry = table(
  { name: "ladder_entry", public: true },
  {
    userId: t.u64().primaryKey(),
    rank: t.i32().index("btree"),
    elo: t.i32(),
    /** Denormalised for the board, so rendering 500 rows needs no join. */
    handle: t.string(),
    displayName: t.string(),
    avatarUrl: t.option(t.string()),
    gamesPlayed: t.i32(),
    level: t.i32(),
    tierId: t.string().index("btree"),
    /** True when this row is a floor rather than an exact position. */
    approximate: t.bool(),
  },
);

/** Board-wide totals, so the leaderboard's header needs no counting. Exactly one row. */
const ladder_status = table(
  { name: "ladder_status", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    playerCount: t.i32(),
    truncated: t.bool(),
    /** When the ordering last CHANGED — what "updated 2m ago" means. */
    builtAt: t.timestamp(),
    /** When the rebuild last ran, changed or not. */
    checkedAt: t.timestamp(),
  },
);

/** Per-tier populations for the leaderboard's band headers. */
const ladder_tier_count = table(
  { name: "ladder_tier_count", public: true },
  {
    tierId: t.string().primaryKey(),
    count: t.i32(),
  },
);

/**
 * The ranked matchmaking pool. PRIVATE.
 *
 * Convex published this because a query could count it without returning it. Here
 * a public table means every client holds every waiting player's rating, which is
 * both a needless broadcast and a small information leak. The two things clients
 * actually need — "am I queued" and "how many humans are waiting" — are the
 * `my_queue_entry` and `queue_size` views.
 */
const queue_entry = table(
  { name: "queue_entry" },
  {
    userId: t.u64().primaryKey(),
    elo: t.i32().index("btree"),
    enqueuedAt: t.timestamp(),
    /** Denormalised so the waiting count can exclude bots without a lookup per row. */
    isBot: t.bool().index("btree"),
  },
);

/**
 * Live connections. PRIVATE.
 *
 * REPLACES the `presence` table and the 5-second `heartbeat` mutation entirely.
 * Convex had no way to observe a socket closing, so liveness had to be inferred
 * from a client writing a timestamp on a timer — which the schema notes was "the
 * single largest line in the budget". SpacetimeDB calls `clientConnected` and
 * `clientDisconnected`, so liveness is now an observed fact rather than a poll.
 *
 * One Identity can hold several connections (two tabs), so this is keyed by
 * connection and a player is present while any row survives.
 *
 * Keyed on `identity` rather than a userId because a connection exists before a
 * player does: the very first thing a new sign-in does is connect, and a guest may
 * connect and never create a user row at all. The userId is resolved through
 * `account` when it is actually needed, which keeps this table free of a
 * denormalised field that could fall out of step.
 */
const connection = table(
  { name: "connection" },
  {
    connectionId: t.connectionId().primaryKey(),
    identity: t.identity().index("btree"),
    connectedAt: t.timestamp(),
  },
);

// ---------------------------------------------------------------------------
// Operator state
// ---------------------------------------------------------------------------

/**
 * One saved config, immutable once written. OVERRIDES ONLY, never a whole config.
 *
 * src/engine/config.ts stays the shipped baseline and these rows carry only the
 * differences, which is what lets a constant added to the code later resolve
 * correctly for a version row written before it existed. Append-only: a revert
 * writes a NEW row holding the old values, because finished matches point at these
 * by id and editing one in place would retroactively change the rules they were
 * played under.
 */
const config_version = table(
  { name: "config_version", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    values: t.array(ConfigOverride),
    createdAt: t.timestamp().index("btree"),
    /** None for the seeded baseline, whose author is "the code". */
    createdBy: t.option(t.u64()),
    note: t.option(t.string()),
  },
);

/**
 * Deployment-wide operator state. Exactly one row.
 *
 * `devFeaturesEnabled` lives here rather than in the environment for the reason
 * the Convex version moved it: an operator has to be able to flip it from /admin,
 * and a module cannot write its own environment.
 *
 * `ownerIdentity` is captured in `init`, where `ctx.sender` is the publisher. It
 * replaces ADMIN_IMPORT_SECRET: the import and seed scripts now authenticate as
 * the module owner instead of sharing a password with the deployment.
 */
const settings = table(
  { name: "settings", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    /** None until the first save; resolves to the code defaults. */
    currentVersionId: t.option(t.u64()),
    devFeaturesEnabled: t.bool(),
    updatedAt: t.timestamp(),
    updatedBy: t.option(t.u64()),
  },
);

/**
 * Which OIDC issuers this database will accept a token from. PRIVATE.
 *
 * This is `convex/auth.config.ts`, which read CLERK_JWT_ISSUER_DOMAIN from the
 * deployment environment. A module has no environment to read, so the allow-list
 * lives in a table and the owner writes it with `setAuthIssuer`.
 *
 * Empty means no signed-in player can connect, and that is the intended failure
 * mode rather than an oversight — the same call the Convex setup made. Auth
 * silently not working is far worse than a loud refusal, and an empty allow-list
 * that defaulted to "accept anything" would accept a token minted by any OIDC
 * provider on the internet for any application.
 *
 * `audience` is checked too. Without it, a token some other application legitimately
 * issued for itself could be replayed here.
 */
const auth_issuer = table(
  { name: "auth_issuer" },
  {
    issuer: t.string().primaryKey(),
    /** Expected `aud` claim. Empty string accepts any audience from this issuer. */
    audience: t.string(),
    addedAt: t.timestamp(),
  },
);

/** Owner identity, captured at publish time. PRIVATE — it is an authorisation key. */
const module_owner = table(
  { name: "module_owner" },
  {
    identity: t.identity().primaryKey(),
    capturedAt: t.timestamp(),
  },
);

// ---------------------------------------------------------------------------
// Schedules
//
// Every `ctx.scheduler.runAfter(ms, fn, args)` in the Convex backend becomes a row
// in one of these. The guard-on-expectation discipline is carried over verbatim:
// each row records the state it expects to act on, and a reducer that fires late,
// twice, or against a match that has moved on is a no-op rather than a skipped
// round. One-shot rows are deleted by SpacetimeDB after the reducer returns.
// ---------------------------------------------------------------------------

/** Drives every timed phase transition. The spine of the match clock. */
const phase_advance_schedule = table(
  { name: "phase_advance_schedule", scheduled: (): any => advancePhase },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
    matchId: t.u64(),
    expectedPhase: t.string(),
    expectedRound: t.i32(),
  },
);

/** The audio-buffer barrier: polls until every human has reported the round. */
const ready_wait_schedule = table(
  { name: "ready_wait_schedule", scheduled: (): any => waitForReady },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
    matchId: t.u64(),
    roundIndex: t.i32(),
    startedWaitingAt: t.timestamp(),
  },
);

/** Closes a ban draft that nobody is driving. */
const draft_watchdog_schedule = table(
  { name: "draft_watchdog_schedule", scheduled: (): any => draftWatchdog },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
    matchId: t.u64(),
  },
);

/** One planned bot action: a ban, a guess, or a pass. */
const bot_action_schedule = table(
  { name: "bot_action_schedule", scheduled: (): any => runBotAction },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
    matchId: t.u64(),
    userId: t.u64(),
    /** "ban" | "guess" | "pass" | "draft_turn". */
    kind: t.string(),
    roundIndex: t.i32(),
    expectedTurn: t.i32(),
    /** The guess text for a "guess" action. */
    text: t.string(),
    clientElapsedMs: t.f64(),
  },
);

/** Pairs everyone pairable, then re-arms itself while the pool is still matchable. */
const matchmaking_sweep_schedule = table(
  { name: "matchmaking_sweep_schedule", scheduled: (): any => sweepMatchmaking },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  },
);

/** Armed when a player's last connection drops mid-ranked-match. */
const forfeit_sweep_schedule = table(
  { name: "forfeit_sweep_schedule", scheduled: (): any => sweepForfeits },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
    matchId: t.u64(),
  },
);

/** Interval. Expires anonymous guest identities past the retention window. */
const guest_cleanup_schedule = table(
  { name: "guest_cleanup_schedule", scheduled: (): any => cleanupGuests },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  },
);

/** Interval. Rebuilds `ladder_entry`, writing only the rows that actually moved. */
const ladder_rebuild_schedule = table(
  { name: "ladder_rebuild_schedule", scheduled: (): any => rebuildLadder },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  },
);

/** Interval, DEV ONLY. Keeps the rank bots stocked in the queue. */
const devbot_refill_schedule = table(
  { name: "devbot_refill_schedule", scheduled: (): any => refillDevBotQueue },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  },
);

// ---------------------------------------------------------------------------

export const spacetimedb = schema({
  account,
  user,
  user_preference,
  user_avatar,
  handle_probe,
  report,
  user_badge,
  category_rating,

  category,
  track,
  track_alias,
  track_index,

  match,
  match_track,
  round_reveal,
  match_player,
  round_log,
  round_result,
  guess,
  guess_feedback,

  room,

  daily_challenge,
  daily_run,
  daily_count,

  ladder_entry,
  ladder_status,
  ladder_tier_count,
  queue_entry,
  connection,

  config_version,
  settings,
  auth_issuer,
  module_owner,

  phase_advance_schedule,
  ready_wait_schedule,
  draft_watchdog_schedule,
  bot_action_schedule,
  matchmaking_sweep_schedule,
  forfeit_sweep_schedule,
  guest_cleanup_schedule,
  ladder_rebuild_schedule,
  devbot_refill_schedule,
});

export default spacetimedb;

export {
  RoundDamage,
  RoundPlayerResult,
  RoundLogEntry,
  XpAward,
  ConfigOverride,
  match,
  match_player,
  round_log,
  round_result,
  round_reveal,
  user,
  ladder_entry,
  config_version,
  phase_advance_schedule,
  ready_wait_schedule,
  draft_watchdog_schedule,
  bot_action_schedule,
  matchmaking_sweep_schedule,
  forfeit_sweep_schedule,
  guest_cleanup_schedule,
  ladder_rebuild_schedule,
  devbot_refill_schedule,
};

// Forward declarations resolved at runtime by the `(): any =>` thunks above.
// Defined in the reducer modules; imported here only to close the cycle.
import {
  advancePhase,
  waitForReady,
  draftWatchdog,
  runBotAction,
  sweepMatchmaking,
  sweepForfeits,
  cleanupGuests,
  rebuildLadder,
  refillDevBotQueue,
} from "./schedules";
