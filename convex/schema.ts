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
  v.literal("countdown"),
  v.literal("guessing"),
  v.literal("reveal"),
  v.literal("standings"),
  v.literal("set_break"),
  v.literal("match_end"),
);

/** One player's line in a completed set. */
const setStanding = v.object({
  userId: v.id("users"),
  points: v.number(),
  totalElapsedMs: v.number(),
});

export default defineSchema({
  users: defineTable({
    clerkId: v.string(), // UNIQUE
    handle: v.string(), // UNIQUE, lowercased for the index
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
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
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_handle", ["handle"])
    .index("by_elo", ["elo"]),

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
    currentRound: v.number(),
    /** Server wall-clock at which the current round was dispatched. */
    roundStartedAt: v.optional(v.number()),

    // --- phase machine ------------------------------------------------------
    /** What the client renders right now. Advanced by the scheduler, not the client. */
    phase: v.optional(matchPhase),
    /** Wall-clock the current phase ends at; drives every countdown ring in the UI. */
    phaseEndsAt: v.optional(v.number()),
    /** Zero-based set index. Daily runs stay on set 0 throughout. */
    currentSet: v.optional(v.number()),
    /** Closed sets, in order. Drives the set-break podium and match resolution. */
    setResults: v.optional(
      v.array(
        v.object({
          setIndex: v.number(),
          winnerId: v.optional(v.id("users")),
          decidedOnTime: v.boolean(),
          standings: v.array(setStanding),
        }),
      ),
    ),
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
    ratingAfter: v.optional(v.number()),
    ratingDelta: v.optional(v.number()),
    /** This player's veto bans. Undefined means they have not banned yet. */
    bannedCategoryIds: v.optional(v.array(v.id("categories"))),
    /** Sets taken. Ranked ends when this reaches SETS_TO_WIN. */
    setsWon: v.optional(v.number()),
    /** XP earned from this match, kept for the results screen breakdown. */
    xpEarned: v.optional(v.number()),
    /** Badge ids newly unlocked by this match, for the post-match celebration. */
    badgesEarned: v.optional(v.array(v.string())),
    forfeited: v.boolean(),
    /** Heartbeat timestamp; drives disconnect-forfeit detection. */
    lastSeenAt: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_match_user", ["matchId", "userId"])
    .index("by_user", ["userId"]),

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
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_date_points", ["date", "totalPoints"]),

  /** Ranked matchmaking pool. Indexed by elo so we can widen the band over time. */
  queue: defineTable({
    userId: v.id("users"),
    elo: v.number(),
    enqueuedAt: v.number(),
  })
    .index("by_elo", ["elo"])
    .index("by_user", ["userId"]),
});
