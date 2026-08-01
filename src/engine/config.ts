/**
 * Central tuning constants for the game engine.
 *
 * Everything here is expected to be re-tuned against real play data after launch.
 * Keep values here rather than inline so balance changes are a one-file diff.
 */

/** Total length of a round, in milliseconds. Also the denominator of the score curve. */
export const ROUND_DURATION_MS = 30_000;

/** Points for the fastest tier. Also the denominator for share-card percentages. */
export const MAX_POINTS = 100;

/**
 * Score tiers. A guess scores by *which clip the player had heard*, so the tier is
 * itself the brag — "I got it on the 1-second clip". Exact milliseconds are kept as
 * an invisible tiebreak rather than as the score.
 *
 * Tier index lines up 1:1 with REVEAL_BEATS, so `revealStageAt()` resolves both.
 *
 * The steep drop is deliberate: identifying a track with an external app costs ~8s,
 * which lands in QUICK. At 55/100 that is a worse deal than the old continuous curve
 * gave (64/100). A gentler spread such as 100/70/40/20 would make cheating *better*
 * value, not worse.
 */
export const SCORE_TIERS: readonly ScoreTier[] = [
  { id: "snap", label: "SNAP", points: 100 },
  { id: "quick", label: "QUICK", points: 55 },
  { id: "solid", label: "SOLID", points: 25 },
  { id: "late", label: "LATE", points: 10 },
] as const;

export interface ScoreTier {
  readonly id: "snap" | "quick" | "solid" | "late";
  readonly label: string;
  readonly points: number;
}

export type ScoreTierId = ScoreTier["id"];

/** Songs in one set. */
export const SONGS_PER_SET = 3;

/** Sets a ranked player must win to take the match. */
export const SETS_TO_WIN = 2;

/** Hard ceiling on sets, so a 1-1 match resolves in the third rather than running on. */
export const MAX_SETS = 3;

/** Rooms always play the full three sets — see resolveRoomMatch() for why. */
export const ROOM_SETS = 3;

/** The daily challenge stays a flat solo run; sets need an opponent to mean anything. */
export const DAILY_SONGS = 5;

/**
 * Round-clock offsets at which the clip replays from 0:00 with more of the song
 * revealed. Each beat also opens a scoring tier — index i here maps to SCORE_TIERS[i].
 */
export const REVEAL_BEATS: readonly RevealBeat[] = [
  { atRoundMs: 0, playToMs: 1_000 },
  { atRoundMs: 7_000, playToMs: 3_000 },
  { atRoundMs: 15_000, playToMs: 10_000 },
  { atRoundMs: 23_000, playToMs: 30_000 },
] as const;

/**
 * Server-driven phase durations. Both players must see identical beats, so the server
 * owns this clock and schedules transitions; clients only render what phase they are in.
 */
export const PHASE_DURATIONS_MS = {
  vs_reveal: 5_000,
  countdown: 3_000,
  guessing: ROUND_DURATION_MS,
  reveal: 6_000,
  standings: 4_000,
  set_break: 6_000,
} as const;

export type MatchPhase = keyof typeof PHASE_DURATIONS_MS | "veto" | "match_end";

export interface RevealBeat {
  /** Milliseconds into the round when this reveal fires. */
  readonly atRoundMs: number;
  /** Milliseconds of the song audible from 0:00 once it fires. */
  readonly playToMs: number;
}

/** Input lockout applied after a wrong guess. No score penalty — this only stops spam. */
export const WRONG_GUESS_LOCKOUT_MS = 5_000;

/**
 * Floor for an accepted reaction time. Recognising a song and submitting it faster
 * than this is not humanly possible, so anything below is treated as a spoofed clock.
 */
export const MIN_HUMAN_REACTION_MS = 350;

/**
 * How far a client's self-reported elapsed time may exceed the server's own observed
 * window before we reject it. Covers network latency and scheduling jitter.
 */
export const CLIENT_CLOCK_TOLERANCE_MS = 750;

/** Max guesses a single player may submit in one round, independent of lockout. */
export const MAX_GUESSES_PER_ROUND = 12;

// ---------------------------------------------------------------------------
// Answer matching
// ---------------------------------------------------------------------------

/**
 * Edit-distance budget scales with title length: floor(len / FUZZY_LENGTH_DIVISOR).
 * Lowering the divisor is more forgiving of typos but raises false-accept risk
 * between similarly-named songs.
 */
export const FUZZY_LENGTH_DIVISOR = 8;

/**
 * Titles at or below this length require an exact match. Without this, "Yes"
 * would accept "Yep" and short titles would collide constantly.
 */
export const FUZZY_EXACT_MAX_LEN = 4;

/** Guesses shorter than this are ignored outright rather than fuzzy-matched. */
export const MIN_GUESS_LENGTH = 2;

/**
 * Autocomplete stays hidden until the player has typed this many characters, and
 * is suppressed entirely during the first reveal beat. Suggestions are the largest
 * remaining cheat surface, so they are deliberately slow to appear.
 */
export const AUTOCOMPLETE_MIN_CHARS = 2;

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

export const STARTING_ELO = 1000;

/** Ratings never fall below this. There is deliberately no inactivity decay. */
export const ELO_FLOOR = 100;

/** Matches played at high K before a rank badge is shown. */
export const PLACEMENT_MATCHES = 5;

export const K_PLACEMENT = 40;
export const K_EARLY = 24;
export const K_ESTABLISHED = 16;

/** Games played before K drops from K_EARLY to K_ESTABLISHED. */
export const ESTABLISHED_AFTER_GAMES = 30;

/** Per-category ratings move slowly — one track is a very small sample. */
export const K_CATEGORY = 8;

// ---------------------------------------------------------------------------
// Veto phase
// ---------------------------------------------------------------------------

/** Categories offered in the ranked ban phase. */
export const VETO_POOL_SIZE = 8;

/** Categories each player bans. Symmetric, so ranked stays fair. */
export const VETO_BANS_PER_PLAYER = 2;

export const VETO_PHASE_MS = 15_000;

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const ROOM_MIN_PLAYERS = 2;
export const ROOM_MAX_PLAYERS = 8;

/** Seconds a disconnected ranked player has to return before forfeiting. */
export const RECONNECT_GRACE_MS = 20_000;

// ---------------------------------------------------------------------------
// Rank tiers
// ---------------------------------------------------------------------------

/**
 * Named ranks layered over Elo. This is presentation only — no rating maths reads
 * these bands, so retuning them cannot corrupt anyone's actual rating.
 *
 * `minElo` is inclusive; the list must stay sorted ascending. Every tier except the
 * top has three divisions (III → II → I as you climb), because a visible sub-step
 * gives players progress to feel between full promotions.
 */
export const RANK_TIERS: readonly RankTier[] = [
  { id: "bronze", name: "Bronze", minElo: 0, divisions: 3, accent: "#c07a45" },
  { id: "silver", name: "Silver", minElo: 900, divisions: 3, accent: "#b6c2cf" },
  { id: "gold", name: "Gold", minElo: 1100, divisions: 3, accent: "#f2c14e" },
  { id: "platinum", name: "Platinum", minElo: 1300, divisions: 3, accent: "#4fd1c5" },
  { id: "diamond", name: "Diamond", minElo: 1500, divisions: 3, accent: "#7aa2ff" },
  { id: "legend", name: "Legend", minElo: 1750, divisions: 1, accent: "#ff5cf0" },
] as const;

export interface RankTier {
  readonly id: string;
  readonly name: string;
  readonly minElo: number;
  readonly divisions: number;
  readonly accent: string;
}

/** Leaderboard position at or under which a player is flagged as notable on the VS screen. */
export const NOTABLE_RANK_CUTOFF = 100;

// ---------------------------------------------------------------------------
// XP and levels
// ---------------------------------------------------------------------------

/**
 * XP is deliberately available from every mode, so casual play always advances
 * something even when no rating is at stake. XP never decreases.
 */
export const XP_AWARDS = {
  /** Simply finishing, in any mode. */
  matchComplete: 50,
  rankedWin: 120,
  rankedLoss: 40,
  setWon: 30,
  perCorrectGuess: 10,
  /** Bonus on top of perCorrectGuess when the guess lands in the top tier. */
  snapBonus: 15,
  dailyComplete: 80,
} as const;

/**
 * Level curve: level N requires XP_BASE * N^XP_CURVE_EXPONENT total XP.
 * Superlinear so early levels arrive fast and later ones stay meaningful.
 */
export const XP_BASE = 300;
export const XP_CURVE_EXPONENT = 1.5;
