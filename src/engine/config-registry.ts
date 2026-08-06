/**
 * What each config value IS — the metadata the console renders from and the server
 * validates against.
 *
 * ONE DECLARATION, TWO CONSUMERS. The admin page builds its form from this list, and
 * `convex/config.ts` checks every incoming write against the same entries. That is the
 * point: a form that validates in the browser and a mutation that trusts it is not a
 * guard, it is a suggestion. Both read these bounds, so tightening a range here tightens
 * it in the only place that matters as well.
 *
 * Adding a constant to `config.ts` means adding a row here. Nothing renders a value it
 * has no entry for, which is deliberate — an unlabelled number in an operator console is
 * worse than an absent one.
 */

import { DEFAULT_CONFIG, type ConfigOverrides, type ResolvedConfig } from "./config-merge";

/** Sections of the console, in the order they are drawn. */
export type ConfigDomain =
  | "match"
  | "scoring"
  | "guessing"
  | "rating"
  | "xp"
  | "profile"
  | "tutorial"
  | "veto"
  | "rooms";

export const DOMAIN_LABELS: Record<ConfigDomain, string> = {
  match: "Match pacing",
  scoring: "Scoring",
  guessing: "Guessing & anti-cheat",
  rating: "Rating & ranks",
  xp: "XP & levels",
  profile: "Profiles",
  tutorial: "Tutorial",
  veto: "Ban draft",
  rooms: "Rooms",
};

export interface ConfigEntry {
  /** Dotted path into `ResolvedConfig`. The stable id: never renamed casually. */
  key: string;
  label: string;
  /** Why this value exists, in one sentence. Shown under the field. */
  help: string;
  domain: ConfigDomain;
  /** `int` rejects fractions; `float` allows them. `ms` is an int rendered as seconds. */
  type: "int" | "float" | "ms";
  min: number;
  max: number;
  /**
   * High-risk fields require an explicit confirmation naming what they affect, rather
   * than saving like the rest. Reserved for values that can corrupt play or rating if
   * mistyped — not merely for values that matter.
   */
  risk: "low" | "high";
  editable: boolean;
  /** Required whenever `editable` is false: the console shows it instead of a field. */
  lockedReason?: string;
  /** Only the tutorial track id, where null genuinely means "choose at random". */
  nullable?: boolean;
}

/** Values that are not single numbers. Read-only in v1; shown so nothing is hidden. */
export interface StructuredEntry {
  key: keyof ResolvedConfig;
  label: string;
  help: string;
  domain: ConfigDomain;
  lockedReason: string;
}

const NOT_IN_V1 =
  "Editable in a later pass. The mechanism supports it; the field is locked until the domain has been through a tuning review.";

const RATING_LOCKED =
  "Locked while the ladder is young. Rating already awarded cannot be recomputed, so a mistyped K-factor is not revertible the way a pacing value is.";

export const CONFIG_ENTRIES: ConfigEntry[] = [
  // --- match pacing --------------------------------------------------------
  {
    key: "DUEL_STARTING_HP",
    label: "Duel starting HP",
    help: "The single lever on match length. 500 lands a typical duel at 9–12 songs.",
    domain: "match",
    type: "int",
    min: 50,
    max: 5_000,
    risk: "high",
    editable: true,
  },
  {
    key: "ROOM_STARTING_HP",
    label: "Room starting HP",
    help: "Same pool as a duel; in a room the median rule is what paces eliminations.",
    domain: "match",
    type: "int",
    min: 50,
    max: 5_000,
    risk: "low",
    editable: true,
  },
  {
    key: "DAMAGE_RAMP_EVERY",
    label: "Damage ramp interval",
    help: "Rounds between each step up in the damage multiplier. This is what guarantees a duel terminates.",
    domain: "match",
    type: "int",
    min: 1,
    max: 10,
    risk: "high",
    editable: true,
  },
  {
    key: "DAMAGE_RAMP_STEP",
    label: "Damage ramp step",
    help: "How much the multiplier gains at each interval, applied equally to both players.",
    domain: "match",
    type: "float",
    min: 0,
    max: 3,
    risk: "high",
    editable: true,
  },
  {
    key: "TIE_DAMAGE_PER_SECOND",
    label: "Tie damage per second",
    help: "When both players land the same tier, the slower one takes this much per second of gap.",
    domain: "match",
    type: "int",
    min: 0,
    max: 100,
    risk: "low",
    editable: true,
  },
  {
    key: "TIE_DAMAGE_CAP",
    label: "Tie damage cap",
    help: "Ceiling on tie damage. Keep it just above the smallest genuine tier win so tiers stay the dominant signal.",
    domain: "match",
    type: "int",
    min: 0,
    max: 200,
    risk: "low",
    editable: true,
  },
  {
    key: "SONG_WINS_DAMAGE",
    label: "Unanswered round damage",
    help: "Dealt to both players when nobody answers. Scaled by the round ramp like any other damage.",
    domain: "match",
    type: "int",
    min: 0,
    max: 200,
    risk: "low",
    editable: true,
  },
  {
    key: "MAX_DUEL_ROUNDS",
    label: "Round cap",
    help: "Hard ceiling on duel length. At the cap the higher HP wins, then total points, then sudden death.",
    domain: "match",
    type: "int",
    min: 3,
    max: 40,
    risk: "high",
    editable: true,
  },
  {
    key: "SURRENDER_FROM_ROUND",
    label: "Surrender unlocks at round",
    help: "Rounds that must be played before the surrender control appears.",
    domain: "match",
    type: "int",
    min: 0,
    max: 20,
    risk: "low",
    editable: true,
  },
  {
    key: "MILESTONE_EVERY_ROUNDS",
    label: "Milestone interval",
    help: "How often the longer momentum beat fires, which also announces the multiplier stepping up.",
    domain: "match",
    type: "int",
    min: 1,
    max: 10,
    risk: "low",
    editable: true,
  },
  {
    key: "READY_TIMEOUT_MS",
    label: "Buffer wait",
    help: "How long the server waits for every client to buffer its clip before starting anyway.",
    domain: "match",
    type: "ms",
    min: 1_000,
    max: 60_000,
    risk: "low",
    editable: true,
  },
  {
    key: "DAILY_SONGS",
    label: "Daily challenge songs",
    help: "Length of a daily run. Changing this only affects challenges generated from now on.",
    domain: "match",
    type: "int",
    min: 1,
    max: 20,
    risk: "high",
    editable: true,
  },
  {
    key: "VS_READY_COUNTDOWN_MS",
    label: "Ready countdown",
    help: "What is left on the clock once both players press Ready. Not zero — the second player needs to see the screen resolve.",
    domain: "match",
    type: "ms",
    min: 0,
    max: 15_000,
    risk: "low",
    editable: true,
  },
  {
    key: "PHASE_DURATIONS_MS.vs_reveal",
    label: "VS reveal",
    help: "A ceiling, not a wait — both players pressing Ready collapses it. Protects against someone who walked away.",
    domain: "match",
    type: "ms",
    min: 3_000,
    max: 120_000,
    risk: "low",
    editable: true,
  },
  {
    key: "PHASE_DURATIONS_MS.veto_reveal",
    label: "Ban reveal",
    help: "Long enough to read which four categories survived the draft.",
    domain: "match",
    type: "ms",
    min: 500,
    max: 30_000,
    risk: "low",
    editable: true,
  },
  {
    key: "PHASE_DURATIONS_MS.countdown",
    label: "Round countdown",
    help: "The beat before a song starts.",
    domain: "match",
    type: "ms",
    min: 500,
    max: 15_000,
    risk: "low",
    editable: true,
  },
  {
    key: "PHASE_DURATIONS_MS.reveal",
    label: "Answer reveal",
    help: "How long the answer stays up after a round closes.",
    domain: "match",
    type: "ms",
    min: 1_000,
    max: 30_000,
    risk: "low",
    editable: true,
  },
  {
    key: "PHASE_DURATIONS_MS.standings",
    label: "Standings",
    help: "HP bars drain and the damage number flies off.",
    domain: "match",
    type: "ms",
    min: 1_000,
    max: 30_000,
    risk: "low",
    editable: true,
  },
  {
    key: "PHASE_DURATIONS_MS.milestone",
    label: "Milestone beat",
    help: "The longer beat every few rounds; also announces the multiplier stepping up.",
    domain: "match",
    type: "ms",
    min: 1_000,
    max: 30_000,
    risk: "low",
    editable: true,
  },

  // --- scoring -------------------------------------------------------------
  {
    key: "ROUND_DURATION_MS",
    label: "Round length",
    help: "Total length of a round AND the denominator of the score curve. The guessing phase is derived from this, never set separately.",
    domain: "scoring",
    type: "ms",
    min: 5_000,
    max: 120_000,
    risk: "high",
    editable: true,
  },
  {
    key: "MAX_POINTS",
    label: "Maximum points",
    help: "Points for the fastest tier, and the denominator for share-card percentages.",
    domain: "scoring",
    type: "int",
    min: 1,
    max: 1_000,
    risk: "high",
    editable: false,
    lockedReason:
      "Coupled to the top score tier's own points value. Editing one without the other would make share cards report percentages above 100.",
  },
  {
    key: "WRONG_GUESS_LOCKOUT_MS",
    label: "Wrong guess lockout",
    help: "Input lockout after a wrong guess. No score penalty — this only stops spam.",
    domain: "guessing",
    type: "ms",
    min: 0,
    max: 30_000,
    risk: "low",
    editable: true,
  },
  {
    key: "MAX_GUESSES_PER_ROUND",
    label: "Guesses per round",
    help: "Cap on submissions from one player in a round, independent of the lockout.",
    domain: "guessing",
    type: "int",
    min: 1,
    max: 100,
    risk: "low",
    editable: true,
  },

  // --- guessing: anti-cheat, locked ---------------------------------------
  {
    key: "MIN_HUMAN_REACTION_MS",
    label: "Minimum human reaction",
    help: "Anything faster than this is treated as a spoofed clock.",
    domain: "guessing",
    type: "ms",
    min: 0,
    max: 5_000,
    risk: "high",
    editable: false,
    lockedReason:
      "Anti-cheat floor. A box that widens this is a cheat switch, so it stays in code where changing it needs a deploy and a review.",
  },
  {
    key: "CLIENT_CLOCK_TOLERANCE_MS",
    label: "Client clock tolerance",
    help: "How far a client's self-reported time may exceed the server's observed window.",
    domain: "guessing",
    type: "ms",
    min: 0,
    max: 10_000,
    risk: "high",
    editable: false,
    lockedReason:
      "Anti-cheat tolerance, for the same reason as the reaction floor above. Widening it from a browser would let a doctored client claim any time it liked.",
  },
  {
    key: "FUZZY_LENGTH_DIVISOR",
    label: "Fuzzy budget divisor",
    help: "Edit-distance budget is floor(title length / this). Lower is more forgiving of typos and more prone to false accepts.",
    domain: "guessing",
    type: "int",
    min: 1,
    max: 40,
    risk: "high",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "FUZZY_EXACT_MAX_LEN",
    label: "Exact-match length",
    help: "Titles at or below this length require an exact match.",
    domain: "guessing",
    type: "int",
    min: 0,
    max: 20,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "MIN_GUESS_LENGTH",
    label: "Minimum guess length",
    help: "Guesses shorter than this are ignored rather than fuzzy-matched.",
    domain: "guessing",
    type: "int",
    min: 1,
    max: 20,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "AUTOCOMPLETE_MIN_CHARS",
    label: "Autocomplete minimum",
    help: "Characters typed before suggestions appear. A usefulness floor, not an anti-cheat one.",
    domain: "guessing",
    type: "int",
    min: 1,
    max: 10,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "TITLE_INDEX_MAX",
    label: "Title index ceiling",
    help: "Rows the client-side title index will read. Headroom against Convex's 16,384-document read limit.",
    domain: "guessing",
    type: "int",
    min: 100,
    max: 16_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },

  // --- xp ------------------------------------------------------------------
  {
    key: "XP_AWARDS.matchComplete",
    label: "Match completed",
    help: "Simply finishing, in any mode.",
    domain: "xp",
    type: "int",
    min: 0,
    max: 1_000,
    risk: "low",
    editable: true,
  },
  {
    key: "XP_AWARDS.rankedWin",
    label: "Ranked win",
    help: "On top of the completion award.",
    domain: "xp",
    type: "int",
    min: 0,
    max: 1_000,
    risk: "low",
    editable: true,
  },
  {
    key: "XP_AWARDS.rankedLoss",
    label: "Ranked loss",
    help: "Losing still pays, so queueing is never a waste of an evening.",
    domain: "xp",
    type: "int",
    min: 0,
    max: 1_000,
    risk: "low",
    editable: true,
  },
  {
    key: "XP_AWARDS.roundWon",
    label: "Round won",
    help: "A round in which you out-scored every opponent.",
    domain: "xp",
    type: "int",
    min: 0,
    max: 1_000,
    risk: "low",
    editable: true,
  },
  {
    key: "XP_AWARDS.perCorrectGuess",
    label: "Correct guess",
    help: "Paid per correct answer, in every mode.",
    domain: "xp",
    type: "int",
    min: 0,
    max: 1_000,
    risk: "low",
    editable: true,
  },
  {
    key: "XP_AWARDS.snapBonus",
    label: "SNAP bonus",
    help: "On top of the correct-guess award when it lands in the top tier.",
    domain: "xp",
    type: "int",
    min: 0,
    max: 1_000,
    risk: "low",
    editable: true,
  },
  {
    key: "XP_AWARDS.dailyComplete",
    label: "Daily completed",
    help: "For finishing a daily run.",
    domain: "xp",
    type: "int",
    min: 0,
    max: 1_000,
    risk: "low",
    editable: true,
  },
  {
    key: "PRACTICE_XP_MULTIPLIER",
    label: "Practice multiplier",
    help: "Fraction of the normal award a practice match pays. The single lever that stops farming bots being the fastest way to level.",
    domain: "xp",
    type: "float",
    min: 0,
    max: 2,
    risk: "low",
    editable: true,
  },
  {
    key: "XP_BASE",
    label: "Level curve base",
    help: "Level N requires base × N^exponent total XP.",
    domain: "xp",
    type: "int",
    min: 10,
    max: 10_000,
    risk: "high",
    editable: true,
  },
  {
    key: "XP_CURVE_EXPONENT",
    label: "Level curve exponent",
    help: "Superlinear so early levels arrive fast and later ones stay meaningful. Below 1 makes the curve flatten instead.",
    domain: "xp",
    type: "float",
    min: 1,
    max: 3,
    risk: "high",
    editable: true,
  },

  // --- rating: locked ------------------------------------------------------
  {
    key: "STARTING_ELO",
    label: "Starting rating",
    help: "Where a new account enters the ladder.",
    domain: "rating",
    type: "int",
    min: 100,
    max: 3_000,
    risk: "high",
    editable: false,
    lockedReason: RATING_LOCKED,
  },
  {
    key: "ELO_FLOOR",
    label: "Rating floor",
    help: "Ratings never fall below this. There is deliberately no inactivity decay.",
    domain: "rating",
    type: "int",
    min: 0,
    max: 2_000,
    risk: "high",
    editable: false,
    lockedReason: RATING_LOCKED,
  },
  {
    key: "PLACEMENT_MATCHES",
    label: "Placement matches",
    help: "Matches played at high K before a rank badge is shown.",
    domain: "rating",
    type: "int",
    min: 0,
    max: 50,
    risk: "high",
    editable: false,
    lockedReason: RATING_LOCKED,
  },
  {
    key: "K_PLACEMENT",
    label: "K — placements",
    help: "Rating movement during placement matches.",
    domain: "rating",
    type: "int",
    min: 1,
    max: 200,
    risk: "high",
    editable: false,
    lockedReason: RATING_LOCKED,
  },
  {
    key: "K_EARLY",
    label: "K — early",
    help: "Rating movement after placements, before the account is established.",
    domain: "rating",
    type: "int",
    min: 1,
    max: 200,
    risk: "high",
    editable: false,
    lockedReason: RATING_LOCKED,
  },
  {
    key: "K_ESTABLISHED",
    label: "K — established",
    help: "Rating movement once an account has played enough games.",
    domain: "rating",
    type: "int",
    min: 1,
    max: 200,
    risk: "high",
    editable: false,
    lockedReason: RATING_LOCKED,
  },
  {
    key: "ESTABLISHED_AFTER_GAMES",
    label: "Established after",
    help: "Games played before K drops from early to established.",
    domain: "rating",
    type: "int",
    min: 1,
    max: 500,
    risk: "high",
    editable: false,
    lockedReason: RATING_LOCKED,
  },
  {
    key: "K_CATEGORY",
    label: "K — per category",
    help: "Per-category ratings move slowly; one track is a very small sample.",
    domain: "rating",
    type: "int",
    min: 1,
    max: 100,
    risk: "high",
    editable: false,
    lockedReason: RATING_LOCKED,
  },
  {
    key: "NOTABLE_RANK_CUTOFF",
    label: "Notable cutoff",
    help: "Leaderboard position at or under which a player is flagged as notable on the VS screen.",
    domain: "rating",
    type: "int",
    min: 1,
    max: 10_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },

  // --- profile, tutorial, veto, rooms: locked ------------------------------
  {
    key: "HANDLE_MAX_LENGTH",
    label: "Handle length",
    help: "Longest username a player may choose. Existing longer handles keep working.",
    domain: "profile",
    type: "int",
    min: 3,
    max: 32,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "BIO_MAX_LENGTH",
    label: "Tagline length",
    help: "Enforced by the form as you type and by the mutation on write.",
    domain: "profile",
    type: "int",
    min: 0,
    max: 300,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "TUTORIAL_ITUNES_TRACK_ID",
    label: "Tutorial track",
    help: "iTunes id of the song the welcome flow teaches on. Null picks a random easy track.",
    domain: "tutorial",
    type: "int",
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
    nullable: true,
  },
  {
    key: "TUTORIAL_RIVAL_GAP_MS",
    label: "Rival gap",
    help: "The scripted rival solves at the player's own time plus this. Negative makes the tutorial honest about losing.",
    domain: "tutorial",
    type: "ms",
    min: -30_000,
    max: 30_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "TUTORIAL_RIVAL_MIN_MS",
    label: "Rival floor",
    help: "Fastest the scripted rival may ever answer.",
    domain: "tutorial",
    type: "ms",
    min: 0,
    max: 60_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "TUTORIAL_RIVAL_MAX_MS",
    label: "Rival ceiling",
    help: "Slowest the scripted rival may ever answer.",
    domain: "tutorial",
    type: "ms",
    min: 0,
    max: 60_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "TUTORIAL_ASSIST_MS.suggest",
    label: "Assist — pin suggestion",
    help: "When the correct track is pinned to the top of the suggestion list.",
    domain: "tutorial",
    type: "ms",
    min: 0,
    max: 60_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "TUTORIAL_ASSIST_MS.highlight",
    label: "Assist — highlight",
    help: "When that row is drawn attention to.",
    domain: "tutorial",
    type: "ms",
    min: 0,
    max: 60_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "TUTORIAL_ASSIST_MS.reveal",
    label: "Assist — reveal",
    help: "When the song is named outright.",
    domain: "tutorial",
    type: "ms",
    min: 0,
    max: 60_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "VETO_POOL_SIZE",
    label: "Veto pool size",
    help: "Categories offered in the ranked ban phase.",
    domain: "veto",
    type: "int",
    min: 2,
    max: 20,
    risk: "high",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "VETO_BANS_PER_PLAYER",
    label: "Bans per player",
    help: "Symmetric, so ranked stays fair.",
    domain: "veto",
    type: "int",
    min: 0,
    max: 8,
    risk: "high",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "VETO_PHASE_MS",
    label: "Ban phase length",
    help: "How long the draft runs before it auto-closes with whatever was banned.",
    domain: "veto",
    type: "ms",
    min: 3_000,
    max: 120_000,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "ROOM_MIN_PLAYERS",
    label: "Room minimum",
    help: "Players needed before a room can start.",
    domain: "rooms",
    type: "int",
    min: 2,
    max: 8,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "ROOM_MAX_PLAYERS",
    label: "Room maximum",
    help: "Ceiling on room size.",
    domain: "rooms",
    type: "int",
    min: 2,
    max: 32,
    risk: "low",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
  {
    key: "RECONNECT_GRACE_MS",
    label: "Reconnect grace",
    help: "How long a disconnected ranked player has to return before forfeiting.",
    domain: "rooms",
    type: "ms",
    min: 5_000,
    max: 300_000,
    risk: "high",
    editable: false,
    lockedReason: NOT_IN_V1,
  },
];

/**
 * The non-scalar values.
 *
 * Shown in the console as formatted read-only blocks so "see everything" is literally
 * true. They are not overridable in v1 because each is a coupled structure rather than a
 * number — the reasons are per-entry below.
 */
export const STRUCTURED_ENTRIES: StructuredEntry[] = [
  {
    key: "SCORE_TIERS",
    label: "Score tiers",
    help: "A guess scores by which clip the player had heard, so the tier is itself the brag.",
    domain: "scoring",
    lockedReason:
      "Index-coupled to the reveal beats and to the maximum points. The steep drop is also what makes identifying a track with an external app a worse deal than guessing, so a gentler spread would make cheating better value, not worse.",
  },
  {
    key: "REVEAL_BEATS",
    label: "Reveal beats",
    help: "Round-clock offsets at which the clip replays with more of the song revealed.",
    domain: "scoring",
    lockedReason:
      "Each beat opens the score tier at the same index, so the two lists must be edited together or scoring silently detaches from what the player heard.",
  },
  {
    key: "RANK_TIERS",
    label: "Rank tiers",
    help: "Named ranks layered over Elo. Presentation only — no rating maths reads these.",
    domain: "rating",
    lockedReason:
      "Safe to retune in the sense that it cannot corrupt a rating, but it instantly re-badges every player on the ladder, which reads as a bug to them. Wants its own deliberate pass.",
  },
  {
    key: "AVATAR_COLOURS",
    label: "Avatar palette",
    help: "Stored as color:<hex> on the user row; the bot seeder draws from the same list.",
    domain: "profile",
    lockedReason:
      "A palette, not a setting. Changing it here would leave existing accounts on colours no longer in the list.",
  },
];

const BY_KEY = new Map(CONFIG_ENTRIES.map((entry) => [entry.key, entry]));

export function entryFor(key: string): ConfigEntry | undefined {
  return BY_KEY.get(key);
}

/** The default value for one entry, read through the same dotted path the console uses. */
export function defaultFor(key: string): number | null | undefined {
  const [head, leaf] = key.split(".");
  const top = (DEFAULT_CONFIG as unknown as Record<string, unknown>)[head];
  if (leaf === undefined) {
    return typeof top === "number" || top === null ? top : undefined;
  }
  if (top === null || typeof top !== "object") return undefined;
  const value = (top as Record<string, unknown>)[leaf];
  return typeof value === "number" ? value : undefined;
}

/**
 * Validates one override. Returns null when it is acceptable, else the reason.
 *
 * Called by the form as you type AND by the mutation before it writes. The mutation does
 * not trust the form's answer — a mutation is reachable without ever loading the page.
 */
export function validateOverride(key: string, value: number | null): string | null {
  const entry = entryFor(key);
  if (!entry) return `Unknown setting "${key}"`;
  if (!entry.editable) return `"${entry.label}" is not editable`;

  if (value === null) {
    return entry.nullable ? null : `"${entry.label}" cannot be empty`;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `"${entry.label}" must be a number`;
  }
  if ((entry.type === "int" || entry.type === "ms") && !Number.isInteger(value)) {
    return `"${entry.label}" must be a whole number`;
  }
  if (value < entry.min || value > entry.max) {
    return `"${entry.label}" must be between ${entry.min} and ${entry.max}`;
  }
  return null;
}

/** Validates a whole override set. Returns every problem, not just the first. */
export function validateOverrides(overrides: ConfigOverrides): string[] {
  return Object.entries(overrides)
    .map(([key, value]) => validateOverride(key, value))
    .filter((problem): problem is string => problem !== null);
}
