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
  /**
   * A ceiling, not a wait.
   *
   * The reveal is where you size up an opponent — rank, rating, record, what they are good
   * at — and five seconds was not enough to read any of it, so this is the one phase that
   * ends on player input rather than on its clock. Both players pressing Ready collapses it
   * to VS_READY_COUNTDOWN_MS (see `ranked.markVsReady`); this timer only protects against
   * someone who walked away from the keyboard.
   */
  vs_reveal: 30_000,
  /**
   * The draft's payoff: the bans fall away and the surviving categories land as a set.
   *
   * Four of the eight are banned and nothing used to show you which four survived — the
   * draft simply cut to a countdown, so the one decision both players made together had
   * no visible result. Long enough to read four names and register them as the shape of
   * the match; short enough that nobody waiting to play resents it.
   */
  veto_reveal: 3_500,
  countdown: 3_000,
  guessing: ROUND_DURATION_MS,
  reveal: 6_000,
  /** HP bars drain and the damage number flies off. */
  standings: 4_000,
  /** Longer momentum beat every few rounds; also announces the multiplier stepping up. */
  milestone: 6_000,
} as const;

/**
 * What is left on the clock once both players have pressed Ready.
 *
 * Not zero. Pressing Ready used to cut straight to the draft, which meant the second
 * player to press never saw the screen resolve — the opponent they had spent twenty
 * seconds reading vanished the instant they confirmed they had read them. Three seconds
 * is long enough to register "they're ready too, here we go" and short enough that nobody
 * feels made to wait. The same beat the round countdown uses.
 */
export const VS_READY_COUNTDOWN_MS = 3_000;

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
 * Autocomplete stays hidden until the player has typed this many characters.
 *
 * This is a usefulness floor, not an anti-cheat one. Suggestions search the ENTIRE
 * catalogue rather than the tracks in play (see `convex/tracks.ts`), so they cannot
 * narrow the answer no matter how early they appear — a single character just matches
 * a thousand titles and shows you nothing worth reading.
 *
 * Counted on the RAW trimmed string on both sides. Counting normalized characters on
 * the server was a real bug: `normalizeTitle` strips a leading "the ", so typing "The S"
 * measured as one character and silently returned nothing.
 */
export const AUTOCOMPLETE_MIN_CHARS = 2;

/**
 * Ceiling on the rows `tracks.titleIndex` will read to build the client-side index.
 *
 * The catalogue is ~2.2k tracks against Convex's 16,384-document read limit, so this is
 * headroom rather than a real constraint — but the query reports when it hits the cap so
 * the client can keep the server-side search armed instead of silently losing the tail of
 * the catalogue.
 */
export const TITLE_INDEX_MAX = 6_000;

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

export const STARTING_ELO = 1000;

/** Ratings never fall below this. There is deliberately no inactivity decay. */
export const ELO_FLOOR = 100;

/** Matches played at high K before a rank badge is shown. */
export const PLACEMENT_MATCHES = 5;

/**
 * Longest username a player may now choose. Down from 16.
 *
 * Every surface truncates rather than overflows, so 16 never broke a layout — but a
 * 16-character name at display size in a VS panel on a 390px screen was being cut off
 * often enough that players were seeing each other's names clipped. Twelve fits.
 *
 * Lives here rather than beside the validator so the two forms that enforce it as you
 * type and the server that enforces it on write all read one number. Existing longer
 * handles keep working — nothing re-validates a name that is not being changed.
 */
export const HANDLE_MAX_LENGTH = 12;

/**
 * Longest tagline, for the same reason as the handle above: one number, read by the form
 * that enforces it as you type and by the mutation that enforces it on write.
 *
 * Moved here from `convex/users.ts`, where it was a private constant — so the onboarding
 * form hardcoded `80` in two places and had no way to know if the server ever disagreed.
 */
export const BIO_MAX_LENGTH = 80;

/**
 * The song the welcome tutorial teaches on, identified by its iTunes id.
 *
 * PINNED BY `itunesTrackId`, NOT BY A CONVEX DOCUMENT ID, and the distinction is the whole
 * reason this is a number rather than an `Id<"tracks">`. `scripts/ingest.ts` re-creates
 * track rows, so a document id would silently stop resolving after any re-ingest and the
 * tutorial would fall back forever without anyone noticing. The iTunes id is external,
 * stable, and already indexed as `by_itunes_id`.
 *
 * Set this to a song that is unambiguous and very widely known — the tutorial's whole job
 * is a recognition moment, and it cannot happen with a track the player has to be told.
 * `tutorial.track` falls back to a random difficulty-1 track when this is null or missing
 * from the catalogue, so the flow is never broken by an unset or retired value.
 *
 * To find an id: search the iTunes API for the track and read `trackId` from the result.
 */
export const TUTORIAL_ITUNES_TRACK_ID: number | null = null;

/**
 * How the scripted rival performs in the coached duel.
 *
 * It solves at the player's own time plus this gap, floored and capped, so the player
 * always wins the tutorial duel by a visible margin — the HP bar has to move for "the gap
 * is the damage" to be a thing you watch rather than a thing you are told.
 *
 * That is a deliberate lie, and a small one: a first duel that is lost teaches the same
 * mechanic while making the game feel like something you are bad at. Set RIVAL_GAP_MS to a
 * negative number if you would rather the tutorial be honest about losing.
 */
export const TUTORIAL_RIVAL_GAP_MS = 1_800;
export const TUTORIAL_RIVAL_MIN_MS = 3_000;
export const TUTORIAL_RIVAL_MAX_MS = 12_000;

/**
 * When each rung of the coaching assist appears, in ms from the start of the round.
 *
 * The ladder exists so that a player who knows the song gets the recognition moment the
 * whole product sells, and a player who does not still cannot fail. Most never see past
 * the first rung.
 *
 * These are a first guess and should be tuned against real sessions — `welcome_step`
 * events will show what fraction of players reach each one.
 */
export const TUTORIAL_ASSIST_MS = {
  /** Pin the correct track to the top of the suggestion list. */
  suggest: 3_000,
  /** Draw attention to that row. */
  highlight: 6_000,
  /** Name the song outright. */
  reveal: 9_000,
} as const;

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
 * top has three divisions (I → II → III as you climb), because a visible sub-step
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
 *
 * That rule governs this accent — the rank label, borders and the small emblem mark are
 * all paper. It deliberately does NOT govern the generated Legend emblem art in
 * public/ranks/, which is allowed colour so it can out-rank Diamond at 112px. Restraint
 * reads as restraint in type and UI chrome; at trophy size it read as an anticlimax.
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

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

/**
 * The avatar palette.
 *
 * Printed-ink colours: fully opaque, confidently saturated, and all legible against a
 * dark initial. No neons — those belong to the palette this design replaced.
 *
 * Stored as `color:<hex>` in `users.avatarUrl` and resolved by `Avatar` in src/game/ui.tsx.
 * Lives here rather than beside the onboarding picker because the bot seeder draws from
 * the same list: a bot's avatar has to be the *same artefact* a real account gets, or the
 * one thing every bot profile has in common is the thing that gives it away.
 */
export const AVATAR_COLOURS = [
  "#F0B429",
  "#1F9E8C",
  "#E03A2F",
  "#8AACF5",
  "#A9663C",
  "#F4F1EA",
] as const;
