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

/**
 * The modes a match can run in.
 *
 * `practice` uses the ranked format against a bot: it awards XP and badges but
 * never rating, so the ladder stays a measure of play against humans.
 */
export type GameMode = "ranked" | "room" | "daily" | "practice";

// ---------------------------------------------------------------------------
// Health duel
// ---------------------------------------------------------------------------

/**
 * Starting health for a ranked or practice duel.
 *
 * Sized against an average round gap of ~45 points: 500 HP lands a typical duel at
 * 9-12 songs, roughly 8-11 minutes. Raise for longer duels, lower for shorter — it
 * is the single lever on match length.
 */
export const DUEL_STARTING_HP = 500;

/** Health in a room. Same pool; the median rule is what paces eliminations. */
export const ROOM_STARTING_HP = 500;

/**
 * Damage escalation. Every `DAMAGE_RAMP_EVERY` rounds the multiplier gains
 * `DAMAGE_RAMP_STEP`, applied equally to both players.
 *
 * This is what guarantees a duel terminates: two evenly-matched players trade small
 * gaps early, but by round 7 the same gap does 2.5x the damage.
 */
export const DAMAGE_RAMP_EVERY = 2;
export const DAMAGE_RAMP_STEP = 0.5;

/**
 * Damage when both players land the same tier.
 *
 * Tier scoring only has four buckets, so two players hitting the same one is the
 * common case rather than the exception. Treating that as a draw dealt no damage and
 * let duels run the full round cap without anyone being knocked out. The faster
 * player now wins, and the slower takes damage proportional to how much slower.
 */
export const TIE_DAMAGE_PER_SECOND = 10;

/**
 * Ceiling on tie damage.
 *
 * Sits just above the smallest genuine tier win (SOLID→LATE = 15), so winning on
 * time never hurts more than winning on tier. Tiers stay the dominant signal;
 * time is the decider, not the driver.
 */
export const TIE_DAMAGE_CAP = 30;

/**
 * Base damage to BOTH players when nobody answers.
 *
 * Scaled by the round ramp like every other kind of damage. Holding it flat was tried
 * first and played badly: late in a duel every real round hits for 2-5x while a dead
 * round barely moved the bars, so stalling on hard tracks stopped the duel making
 * progress. A round nobody could get should still cost what the round is worth.
 */
export const SONG_WINS_DAMAGE = 15;

/**
 * Hard ceiling on duel length.
 *
 * Tier scoring produces frequent exact ties, and a tied round deals zero damage —
 * so without a cap two closely-matched players could duel indefinitely. At the cap
 * the higher HP wins, then total points, then sudden death.
 */
export const MAX_DUEL_ROUNDS = 18;

/** Rounds that must be played before surrender unlocks. */
export const SURRENDER_FROM_ROUND = 2;

/** A longer momentum beat fires every this many rounds. */
export const MILESTONE_EVERY_ROUNDS = 3;

/**
 * How long the server will wait for every client to buffer its clip before starting
 * the round anyway. Without a cap, one broken client could stall a match forever.
 */
export const READY_TIMEOUT_MS = 10_000;

/** The daily challenge stays a flat solo run; HP needs an opponent to mean anything. */
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
  /** HP bars drain and the damage number flies off. */
  standings: 4_000,
  /** Longer momentum beat every few rounds; also announces the multiplier stepping up. */
  milestone: 6_000,
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
/**
 * Accents are presentation values, but they are read server-side: convex/matches.ts
 * resolves a rating through rankForElo and ships `rank.tier.accent` on the scoreboard.
 * Only the hex strings changed in the overhaul — the shape, the thresholds and the wire
 * format are untouched.
 *
 * Legend is paper-white on purpose. The top of every ladder in this app is the absence
 * of hue: the top score tier is white too, and nothing else may be.
 */
export const RANK_TIERS: readonly RankTier[] = [
  { id: "bronze", name: "Bronze", minElo: 0, divisions: 3, accent: "#a9663c" },
  { id: "silver", name: "Silver", minElo: 900, divisions: 3, accent: "#9fb0c4" },
  { id: "gold", name: "Gold", minElo: 1100, divisions: 3, accent: "#f0b429" },
  { id: "platinum", name: "Platinum", minElo: 1300, divisions: 3, accent: "#5fc4b8" },
  { id: "diamond", name: "Diamond", minElo: 1500, divisions: 3, accent: "#8aacf5" },
  { id: "legend", name: "Legend", minElo: 1750, divisions: 1, accent: "#f4f1ea" },
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
  /** A round in which you out-scored every opponent. */
  roundWon: 18,
  perCorrectGuess: 10,
  /** Bonus on top of perCorrectGuess when the guess lands in the top tier. */
  snapBonus: 15,
  dailyComplete: 80,
} as const;

/**
 * Fraction of the normal award a practice match pays.
 *
 * Practice used to pay ~296 XP against a ranked loss's 275, while being instant,
 * unlimited, zero-risk and against software — which made farming bots strictly the
 * fastest way to level and gave nobody a reason to queue for a human. Halving it keeps
 * practice worth playing without making it the optimal grind.
 *
 * A single lever on purpose: retune this rather than the individual awards, so the
 * shape of the breakdown stays the same across modes.
 */
export const PRACTICE_XP_MULTIPLIER = 0.5;

/**
 * Level curve: level N requires XP_BASE * N^XP_CURVE_EXPONENT total XP.
 * Superlinear so early levels arrive fast and later ones stay meaningful.
 */
export const XP_BASE = 300;
export const XP_CURVE_EXPONENT = 1.5;
