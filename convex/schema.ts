import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex has no unique constraints. Fields marked UNIQUE below are enforced in
 * the mutations that write them, always via the paired by_* index.
 */

export const matchMode = v.union(
  v.literal("ranked"),
  v.literal("room"),
  v.literal("daily"),
  /** Same format as ranked, against a bot. Awards XP and badges but never rating. */
  v.literal("practice"),
);

export const matchStatus = v.union(
  v.literal("veto"),
  v.literal("active"),
  v.literal("complete"),
  v.literal("abandoned"),
);

/**
 * Fine-grained flow state within a match. `status` stays the coarse lifecycle
 * (used by indexes and matchmaking); `phase` is what the client renders and what
 * the scheduler advances.
 */
export const matchPhase = v.union(
  v.literal("vs_reveal"),
  v.literal("veto"),
  /** The draft's result: which four categories survived the bans. */
  v.literal("veto_reveal"),
  v.literal("countdown"),
  v.literal("guessing"),
  v.literal("reveal"),
  v.literal("standings"),
  v.literal("milestone"),
  v.literal("match_end"),
);

/** Damage dealt to one player by a round. */
const roundDamageEntry = v.object({
  userId: v.id("users"),
  damage: v.number(),
  hpAfter: v.number(),
});

/**
 * One closed round.
 *
 * Stored rather than recomputed from guesses so the results timeline can never
 * disagree with the health that was actually applied — the multiplier, the tie
 * rules and the score curve could all be retuned later, and a recomputed history
 * would silently rewrite past matches.
 */
const roundLogEntry = v.object({
  roundIndex: v.number(),
  trackId: v.id("tracks"),
  /** "tier" | "time" | "song" — why the round went the way it did. */
  outcome: v.string(),
  winnerId: v.optional(v.id("users")),
  /** Present only when the round was settled on reaction time. */
  timeGapMs: v.optional(v.number()),
  multiplier: v.number(),
  damage: v.array(roundDamageEntry),
  results: v.array(
    v.object({
      userId: v.id("users"),
      points: v.number(),
      elapsedMs: v.optional(v.number()),
      solved: v.boolean(),
    }),
  ),
});

export default defineSchema({
  users: defineTable({
    clerkId: v.string(), // UNIQUE
    handle: v.string(), // UNIQUE, lowercased for the index
    displayName: v.string(),
    /**
     * What to draw for this player, in one of three forms:
     *
     *   `color:#rrggbb`   a swatch chosen during onboarding, rendered as an initial
     *   an https URL       either the picture Clerk had at sign-up, or an upload
     *   absent             falls back to the initial on ink
     *
     * For an upload this holds the RESOLVED storage URL rather than an id. Convex serving
     * URLs are permanent — they stay valid until the file is deleted — so resolving once
     * at upload time keeps every reader free. The ladder reads this for up to 500 rows;
     * calling `storage.getUrl` per row would put 500 storage lookups on one page view.
     */
    avatarUrl: v.optional(v.string()),
    /**
     * The uploaded file behind `avatarUrl`, when there is one.
     *
     * Kept so a replacement can delete what it replaces — without it, every new upload
     * would orphan the previous file in storage forever.
     */
    avatarStorageId: v.optional(v.id("_storage")),
    /** Hidden pending review after reports. Mirrors `bioHidden`. */
    avatarHidden: v.optional(v.boolean()),
    elo: v.number(),
    gamesPlayed: v.number(),
    placementsRemaining: v.number(),
    createdAt: v.number(),

    /** Lifetime XP. Never decreases, so a lost match still advances the level bar. */
    xp: v.optional(v.number()),
    /** Denormalised from xp so leaderboards and VS cards avoid recomputing the curve. */
    level: v.optional(v.number()),
    /** Career counters, kept here so badge evaluation is a single read. */
    rankedWins: v.optional(v.number()),
    snapGuesses: v.optional(v.number()),

    // --- profile ------------------------------------------------------------
    /** Set once onboarding completes; its absence is what triggers the modal. */
    onboardedAt: v.optional(v.number()),
    bio: v.optional(v.string()),
    /** Hidden pending review after a report. */
    bioHidden: v.optional(v.boolean()),
    preferredCategoryIds: v.optional(v.array(v.id("categories"))),

    // --- bots ---------------------------------------------------------------
    /**
     * Bots are ordinary user rows so every existing query, join and match flow
     * works unchanged — there is no parallel identity system. They are excluded
     * from the global leaderboard and badged everywhere they appear.
     */
    isBot: v.optional(v.boolean()),
    botPersonaId: v.optional(v.string()),
    /**
     * Whoever this player faced in their last practice match.
     *
     * Practice picks from the personas nearest the player's rating, and that set never
     * changes on its own because practice never moves rating — so without remembering
     * the last opponent the "random" pick would keep landing on the same bot.
     */
    lastPracticePersonaId: v.optional(v.string()),

    // --- guests -------------------------------------------------------------
    /**
     * Anonymous daily players. Same reasoning as bots: an ordinary user row means
     * every existing match, guess and score path works unchanged rather than needing
     * a parallel identity system.
     *
     * A guest is created by `daily.start` from a client-held token, holds
     * `clerkId: "guest:<token>"`, and may only ever play the daily. They are excluded
     * from both leaderboards, never enter matchmaking, and earn no rating, XP or
     * badges. Signing in migrates their run and retires the row.
     */
    isGuest: v.optional(v.boolean()),
    /** Set once a guest's run has been claimed by a real account. */
    guestClaimedAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_handle", ["handle"])
    .index("by_elo", ["elo"])
    /**
     * The ladder, as an index range rather than a filter — fields are
     * `placementsRemaining, isGuest, isBot, elo`.
     *
     * `onBoard` in users.ts expresses the same rule as a `.filter()`, and a filter does
     * not reduce documents READ: the `by_elo` range spans every guest (all parked at
     * STARTING_ELO), every bot and every unplaced account, so a `.take(5001)` over it can
     * scan far more than 5,001 rows and is one dense guest cohort away from the 16,384
     * read ceiling.
     *
     * Queried as `eq(placementsRemaining, 0).eq(isGuest, undefined).eq(isBot, undefined)`.
     * Nothing anywhere writes `isBot: false` or `isGuest: false` — only `true` is ever
     * set — so `undefined` selects exactly what `neq(..., true)` did.
     *
     * Convex appends `_creationTime` to every index, so within that equality prefix the
     * order is exactly (elo desc, _creationTime desc) under `.order("desc")` — the same
     * newest-first tie-break the live walk terminates on. That equivalence is what lets a
     * stored snapshot reproduce positions bit-for-bit.
     *
     * Not usable in dev mode: `showRankBots` needs "bot or not-bot", which an equality
     * prefix cannot express. Those reads keep `by_elo`.
     */
    .index("by_ladder_elo", ["placementsRemaining", "isGuest", "isBot", "elo"]),

  /** Bio reports, for manual review. No automated takedown. */
  reports: defineTable({
    reportedUserId: v.id("users"),
    reporterUserId: v.id("users"),
    /**
     * What was reported — "bio" or "avatar".
     *
     * Optional because every row written before avatars existed is a bio report, and an
     * absent value reads as exactly that. Without this the two share one threshold, and
     * three people objecting to someone's tagline would also take down their picture.
     */
    kind: v.optional(v.string()),
    reason: v.string(),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_reported", ["reportedUserId"]),

  /** Awarded badges. One row per player per badge; `by_user_badge` enforces uniqueness. */
  userBadges: defineTable({
    userId: v.id("users"),
    badgeId: v.string(),
    earnedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_badge", ["userId", "badgeId"]),

  categories: defineTable({
    slug: v.string(), // UNIQUE
    name: v.string(),
    sortOrder: v.number(),
  }).index("by_slug", ["slug"]),

  categoryRatings: defineTable({
    userId: v.id("users"),
    categoryId: v.id("categories"),
    rating: v.number(),
    games: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "categoryId"]),

  tracks: defineTable({
    itunesTrackId: v.number(), // UNIQUE
    title: v.string(),
    titleNormalized: v.string(),
    artist: v.string(),
    artistNormalized: v.string(),
    artworkUrl: v.string(),
    previewUrl: v.string(),
    previewCheckedAt: v.number(),
    categoryIds: v.array(v.id("categories")),
    /** 1 (easiest) .. 5 (hardest). Seeded from popularity, corrected from play data. */
    difficulty: v.number(),
    popularity: v.number(),
    releaseYear: v.number(),
    /** False for alternate cuts and anything held out of the playable pool. */
    playable: v.boolean(),
    /** Rolling median solve time, used to re-tier difficulty. Null until enough data. */
    medianSolveMs: v.optional(v.number()),
    solveSampleCount: v.number(),
  })
    .index("by_itunes_id", ["itunesTrackId"])
    .index("by_playable_difficulty", ["playable", "difficulty"])
    // Autocomplete searches the FULL catalog, never just the tracks in play —
    // scoping it to the match would hand players the answer in two keystrokes.
    .searchIndex("search_title", {
      searchField: "titleNormalized",
      filterFields: ["playable"],
    }),

  trackAliases: defineTable({
    trackId: v.id("tracks"),
    aliasNormalized: v.string(),
  })
    .index("by_track", ["trackId"])
    .index("by_alias", ["aliasNormalized"]),

  matches: defineTable({
    mode: matchMode,
    status: matchStatus,
    playerIds: v.array(v.id("users")),
    trackIds: v.array(v.id("tracks")),
    /** Union of both players' bans, populated when the veto phase closes. */
    bannedCategoryIds: v.array(v.id("categories")),
    /** Categories offered during the ban phase. Ranked matches only. */
    vetoPoolIds: v.optional(v.array(v.id("categories"))),
    /** Wall-clock after which the veto phase auto-closes with whatever was banned. */
    vetoDeadline: v.optional(v.number()),
    /**
     * Ban order for the turn-based draft, lower-rated player first. Bans alternate
     * through this list, so index N is whose turn it is.
     */
    banOrder: v.optional(v.array(v.id("users"))),
    /** How many bans have been placed; indexes into banOrder. */
    banTurn: v.optional(v.number()),
    currentRound: v.number(),
    /** Server wall-clock at which the current round was dispatched. */
    roundStartedAt: v.optional(v.number()),

    // --- phase machine ------------------------------------------------------
    /** What the client renders right now. Advanced by the scheduler, not the client. */
    phase: v.optional(matchPhase),
    /** Wall-clock the current phase ends at; drives every countdown ring in the UI. */
    phaseEndsAt: v.optional(v.number()),
    /**
     * Every closed round, in order. The standings beat reads the last entry, the
     * results timeline reads them all — one source of truth rather than a separate
     * "last round" field that could drift.
     */
    roundLog: v.optional(v.array(roundLogEntry)),
    /**
     * DEPRECATED: superseded by roundLog. Kept on the validator only so matches
     * created before the change still load; removed once they age out.
     */
    lastRoundDamage: v.optional(v.array(roundDamageEntry)),
    /** True once the match has fallen through to a single sudden-death song. */
    suddenDeath: v.optional(v.boolean()),
    roomId: v.optional(v.id("rooms")),
    winnerId: v.optional(v.id("users")),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_room", ["roomId"]),

  /** One row per player per match; keeps match documents small and write contention low. */
  matchPlayers: defineTable({
    matchId: v.id("matches"),
    userId: v.id("users"),
    totalPoints: v.number(),
    /** Rating snapshot taken at match start, so results are reproducible. */
    ratingBefore: v.number(),
    /**
     * Ladder position at match start, frozen for the same reason `ratingBefore` is.
     *
     * `matches.state` is a live subscription that re-executes on every guess and phase
     * change, and it renders the "#N GLOBAL" badge on the VS screen. Computing that
     * position live meant reading the ladder on every one of those re-executions — which
     * is what made invalidations grow with the square of concurrent players. Reading the
     * stored field instead would be no better there: it is a ~400KB document.
     *
     * So the rule is that no high-frequency subscribed query touches the ladder at all,
     * and this is how `matches.state` opts out. Nobody expects an opponent's rank to move
     * mid-duel; the VS screen shows it once, before round one.
     *
     * Optional, so historical rows need no backfill — an absent value renders as no badge,
     * exactly as a player in placements already does.
     */
    globalRankAtStart: v.optional(v.number()),
    ratingAfter: v.optional(v.number()),
    ratingDelta: v.optional(v.number()),
    /** This player's veto bans. Undefined means they have not banned yet. */
    bannedCategoryIds: v.optional(v.array(v.id("categories"))),

    // --- health duel --------------------------------------------------------
    /** Remaining health. Reaching zero eliminates the player. */
    hp: v.optional(v.number()),
    /** Low-water mark across the match, for the comeback badge. */
    lowestHp: v.optional(v.number()),
    /** Round at which HP hit zero; still null while alive. */
    eliminatedAtRound: v.optional(v.number()),
    /**
     * Highest round index this client has fully buffered.
     *
     * The guessing clock does not start until every player has reported the current
     * round, which is what stops a slow connection producing a truncated song.
     */
    readyForRound: v.optional(v.number()),
    /**
     * When this player pressed Ready on the opponent reveal.
     *
     * Separate from `readyForRound`, which answers a different question — that one is
     * "has your browser buffered the clip", a per-round technical barrier. This is a
     * deliberate human "I have read this and I want to start", asked once per match.
     * Overloading one field with both would tie the audio barrier to a button press.
     */
    vsReadyAt: v.optional(v.number()),
    /** Set when the player passes; the round can end once everyone is done. */
    passedRound: v.optional(v.number()),
    /** XP earned from this match, kept for the results screen breakdown. */
    xpEarned: v.optional(v.number()),
    /**
     * Itemised reasons the XP was awarded ("Rounds won x3"), straight from
     * `awardMatchXp`. Persisted rather than recomputed because the awards are expected
     * to be retuned — a recomputed breakdown would silently rewrite what past matches
     * paid, the same reasoning `roundLog` is stored under.
     */
    xpBreakdown: v.optional(
      v.array(v.object({ reason: v.string(), amount: v.number() })),
    ),
    /**
     * Level either side of this match, so the results screen can animate real progress
     * and detect a level-up.
     *
     * Stored rather than derived: `users.xp` has already moved on by the time anyone
     * reads this, so the level the player was BEFORE the match is unrecoverable from
     * the user row alone.
     */
    levelBefore: v.optional(v.number()),
    levelAfter: v.optional(v.number()),
    /** Lifetime XP after this match, the denominator for the results progress bar. */
    xpAfter: v.optional(v.number()),
    /** Badge ids newly unlocked by this match, for the post-match celebration. */
    badgesEarned: v.optional(v.array(v.string())),
    forfeited: v.boolean(),
    /**
     * DEPRECATED — presence lives in the `presence` table now. Read through
     * `ranked.lastSeenFor`, which still falls back to this for matches that predate the
     * move.
     *
     * Optional rather than deleted: Convex validates stored documents against the schema
     * on push, so removing it would mean rewriting every historical row, and every batch
     * of that would invalidate `matches.history`, `activeMatch` and `lastRatingChange`
     * for the players involved. An unread optional field costs nothing.
     */
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_match", ["matchId"])
    .index("by_match_user", ["matchId", "userId"])
    .index("by_user", ["userId"]),

  /**
   * Liveness, one row per player per ranked match.
   *
   * Split out of `matchPlayers` because it is written every five seconds per player and
   * that document is read by half the app: `matches.state` for both players, plus
   * `ranked.activeMatch` and `users.lastRatingChange`, which the shell subscribes to on
   * every route. A heartbeat therefore re-executed four subscribed queries, and reactive
   * re-executions bill as function calls — it was the single largest line in the budget.
   *
   * Nothing subscribes to this table, so writing it is free.
   *
   * Ranked only. `claimForfeit` returns early for every other mode, so a room, practice
   * or daily match has no reader and gets no row.
   */
  presence: defineTable({
    matchId: v.id("matches"),
    userId: v.id("users"),
    lastSeenAt: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_match_user", ["matchId", "userId"]),

  guesses: defineTable({
    matchId: v.id("matches"),
    roundIndex: v.number(),
    userId: v.id("users"),
    rawText: v.string(),
    normalizedText: v.string(),
    correct: v.boolean(),
    /** Client-measured reaction time, already validated when `accepted` is true. */
    clientElapsedMs: v.number(),
    serverReceivedAt: v.number(),
    accepted: v.boolean(),
    rejectionReason: v.optional(v.string()),
    points: v.number(),
  })
    .index("by_match_round", ["matchId", "roundIndex"])
    .index("by_match_round_user", ["matchId", "roundIndex", "userId"]),

  rooms: defineTable({
    code: v.string(), // UNIQUE
    hostId: v.id("users"),
    memberIds: v.array(v.id("users")),
    status: v.union(
      v.literal("lobby"),
      v.literal("in_match"),
      v.literal("closed"),
    ),
    activeMatchId: v.optional(v.id("matches")),
    /**
     * Members who have marked themselves ready for the next start.
     *
     * Advisory, not a gate — the host can always start anyway, because a hard gate hands
     * one player who wandered off a veto over seven others and there is no kick. It exists
     * so the host can see whether anyone is still reading.
     *
     * Optional because every room that existed before this field has none, and belongs to
     * ONE lobby round: cleared on join, leave, start and returnToLobby. A ready that
     * survives its round would open the next lobby with everyone already ready.
     */
    readyIds: v.optional(v.array(v.id("users"))),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  dailyChallenges: defineTable({
    /** ISO date, UTC. UNIQUE. */
    date: v.string(),
    trackIds: v.array(v.id("tracks")),
  }).index("by_date", ["date"]),

  dailyRuns: defineTable({
    userId: v.id("users"),
    date: v.string(),
    totalPoints: v.number(),
    perRoundMs: v.array(v.number()),
    perRoundPoints: v.array(v.number()),
    completedAt: v.number(),
    /**
     * Denormalised from the user row so the board can exclude guests without a
     * lookup per run. Cleared when a real account claims the run.
     */
    isGuest: v.optional(v.boolean()),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_date_points", ["date", "totalPoints"]),

  /**
   * How many runs each day has, as a running total.
   *
   * Exists purely so the landing page does not have to count by reading. `todayStats` is
   * subscribed by every visitor including signed-out ones, and counting meant a `.take`
   * of up to a thousand `dailyRuns` — so every completed run anywhere re-executed a
   * thousand-document read for every visitor with the page open.
   *
   * Maintained by `daily.recordRun`, which seeds the row from the rows already present
   * the first time it writes for a date; nothing needed backfilling. Deleting old guest
   * runs can leave the count high for dates past the retention window, which is
   * harmless — only today's row is ever read.
   */
  dailyCounts: defineTable({
    date: v.string(), // UNIQUE
    players: v.number(),
  }).index("by_date", ["date"]),

  /**
   * The ladder, snapshotted, so reading a position stops walking the whole board.
   *
   * `globalPosition` used to walk an open-ended `by_elo` range from a player's own rating
   * upward, and it is called from `playerCard` inside `matches.state` — a live
   * subscription. So ANY rating change anywhere re-executed the heaviest query in the game
   * for both players in every live duel: invalidations grew with the SQUARE of concurrent
   * players.
   *
   * Two documents, deliberately:
   *
   *   - `field` holds the ordering and is rewritten ONLY when the ladder actually changed.
   *     Every subscribed reader re-executes when it is written, so an unconditional
   *     five-minute write would cost each active user hundreds of calls a day on a board
   *     where nothing moved.
   *   - `summary` holds the timestamps, which change every run by definition. Keeping them
   *     out of `field` is what makes the write-if-changed guard possible at all.
   *
   * A player's position is computed from their LIVE rating against this stored field, so
   * only the field is ever old — never the player. See `positionIn` in ladder.ts.
   */
  ladderSnapshot: defineTable(
    v.union(
      v.object({
        kind: v.literal("summary"),
        generation: v.number(),
        /** When the field last CHANGED — what "updated 2m ago" means. */
        builtAt: v.number(),
        /** When the cron last ran, changed or not. */
        checkedAt: v.number(),
      }),
      v.object({
        kind: v.literal("field"),
        generation: v.number(),
        playerCount: v.number(),
        /** The ladder outgrew SNAPSHOT_MAX_ENTRIES; positions past it are floors. */
        truncated: v.boolean(),
        tierCounts: v.array(v.object({ tierId: v.string(), count: v.number() })),
        /**
         * The ordering, as (elo desc, _creationTime desc).
         *
         * `t` is the user's `_creationTime` and is not optional: Convex appends it to
         * every index, so descending Elo breaks ties newest-first, and Elo is an integer
         * over a narrow range with a large cohort parked at STARTING_ELO — ties are the
         * common case, not the tail. Without it the stored order cannot reproduce the
         * live walk's.
         */
        entries: v.array(
          v.object({ u: v.id("users"), e: v.number(), t: v.number() }),
        ),
        /**
         * Display fields for the top ROW_DEPTH, INDEX-ALIGNED with `entries`.
         *
         * `rows[i]` describes `entries[i]`. Aligning them rather than repeating the id
         * makes it structurally impossible for the list and the ordering to disagree —
         * the same class of bug as the "#3 row reads #5" regression, prevented by
         * construction rather than by care.
         */
        rows: v.array(
          v.object({
            handle: v.string(),
            displayName: v.string(),
            avatarUrl: v.optional(v.string()),
            gamesPlayed: v.number(),
            level: v.number(),
          }),
        ),
      }),
    ),
  ).index("by_kind", ["kind"]),

  /** Ranked matchmaking pool. Indexed by elo so we can widen the band over time. */
  queue: defineTable({
    userId: v.id("users"),
    elo: v.number(),
    enqueuedAt: v.number(),
    /**
     * Denormalised from the user row so the "players in queue" readout can exclude bots
     * without a lookup per entry.
     *
     * That readout counted every row, and the dev rank-bot cron keeps sixteen of them
     * stocked — so it displayed a frozen "17 players" to everyone, forever. Optional
     * because rows written before this existed are humans by default, and the bot roster
     * is re-queued every minute, so the count corrects itself without a migration.
     */
    isBot: v.optional(v.boolean()),
  })
    .index("by_elo", ["elo"])
    .index("by_user", ["userId"])
    /**
     * Humans only, for the "players waiting" readout.
     *
     * Counting them used to be an unindexed `.take(100)` over the whole table, which put
     * every queue row in the read set — so a single enqueue re-ran that query for every
     * signed-in user in the app, on every route. Selecting on `isBot` narrows the read
     * set to human rows, and the dev bot cron's per-minute writes stop invalidating it
     * at all. Nothing ever writes `isBot: false` — `enqueue` writes `true` or
     * `undefined` — so `eq("isBot", undefined)` is exactly the old filter.
     */
    .index("by_isBot", ["isBot"]),
});
