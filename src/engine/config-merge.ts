/**
 * Turns stored overrides into a complete config object.
 *
 * THE RULE THIS FILE ENFORCES: `config.ts` is the shipped baseline and the database only
 * ever holds *differences* from it. Nothing stores a full config. That is what makes an
 * empty settings table run the game exactly as the code does, makes "reset to default"
 * a deletion rather than a copy, and means adding a constant to `config.ts` needs no
 * migration — rows written before it existed simply do not mention it.
 *
 * Pure, and deliberately free of any Convex import: the engine's unit tests call this, and
 * so does every server handler. One resolution path, exercised by both.
 */

import {
  AUTOCOMPLETE_MIN_CHARS,
  AVATAR_COLOURS,
  BIO_MAX_LENGTH,
  CLIENT_CLOCK_TOLERANCE_MS,
  DAILY_SONGS,
  DAMAGE_RAMP_EVERY,
  DAMAGE_RAMP_STEP,
  DUEL_STARTING_HP,
  ELO_FLOOR,
  ESTABLISHED_AFTER_GAMES,
  FUZZY_EXACT_MAX_LEN,
  FUZZY_LENGTH_DIVISOR,
  HANDLE_MAX_LENGTH,
  K_CATEGORY,
  K_EARLY,
  K_ESTABLISHED,
  K_PLACEMENT,
  MAX_DUEL_ROUNDS,
  MAX_GUESSES_PER_ROUND,
  MAX_POINTS,
  MILESTONE_EVERY_ROUNDS,
  MIN_GUESS_LENGTH,
  MIN_HUMAN_REACTION_MS,
  NOTABLE_RANK_CUTOFF,
  PHASE_DURATIONS_MS,
  PLACEMENT_MATCHES,
  PRACTICE_XP_MULTIPLIER,
  RANK_TIERS,
  READY_TIMEOUT_MS,
  RECONNECT_GRACE_MS,
  REVEAL_BEATS,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
  ROOM_STARTING_HP,
  ROUND_DURATION_MS,
  SCORE_TIERS,
  SONG_WINS_DAMAGE,
  STARTING_ELO,
  SURRENDER_FROM_ROUND,
  TIE_DAMAGE_CAP,
  TIE_DAMAGE_PER_SECOND,
  TITLE_INDEX_MAX,
  TUTORIAL_ASSIST_MS,
  TUTORIAL_ITUNES_TRACK_ID,
  TUTORIAL_RIVAL_GAP_MS,
  TUTORIAL_RIVAL_MAX_MS,
  TUTORIAL_RIVAL_MIN_MS,
  VETO_BANS_PER_PLAYER,
  VETO_PHASE_MS,
  VETO_POOL_SIZE,
  VS_READY_COUNTDOWN_MS,
  WRONG_GUESS_LOCKOUT_MS,
  XP_AWARDS,
  XP_BASE,
  XP_CURVE_EXPONENT,
  type RankTier,
  type RevealBeat,
  type ScoreTier,
} from "./config";

/**
 * Everything a resolved config carries.
 *
 * Mirrors `config.ts` one-for-one on purpose — a reader comparing the two should not have
 * to work out what was renamed. The structured members (`SCORE_TIERS`, `REVEAL_BEATS`,
 * `RANK_TIERS`, `AVATAR_COLOURS`) are included so consumers read ONE object rather than
 * half a config and half a module import, even though v1 does not let them be overridden.
 */
export interface ResolvedConfig {
  // --- round and scoring ---------------------------------------------------
  ROUND_DURATION_MS: number;
  MAX_POINTS: number;
  SCORE_TIERS: readonly ScoreTier[];
  REVEAL_BEATS: readonly RevealBeat[];

  // --- duel ----------------------------------------------------------------
  DUEL_STARTING_HP: number;
  ROOM_STARTING_HP: number;
  DAMAGE_RAMP_EVERY: number;
  DAMAGE_RAMP_STEP: number;
  TIE_DAMAGE_PER_SECOND: number;
  TIE_DAMAGE_CAP: number;
  SONG_WINS_DAMAGE: number;
  MAX_DUEL_ROUNDS: number;
  SURRENDER_FROM_ROUND: number;
  MILESTONE_EVERY_ROUNDS: number;
  READY_TIMEOUT_MS: number;
  DAILY_SONGS: number;
  PHASE_DURATIONS_MS: PhaseDurations;
  VS_READY_COUNTDOWN_MS: number;

  // --- guessing ------------------------------------------------------------
  WRONG_GUESS_LOCKOUT_MS: number;
  MIN_HUMAN_REACTION_MS: number;
  CLIENT_CLOCK_TOLERANCE_MS: number;
  MAX_GUESSES_PER_ROUND: number;
  FUZZY_LENGTH_DIVISOR: number;
  FUZZY_EXACT_MAX_LEN: number;
  MIN_GUESS_LENGTH: number;
  AUTOCOMPLETE_MIN_CHARS: number;
  TITLE_INDEX_MAX: number;

  // --- rating --------------------------------------------------------------
  STARTING_ELO: number;
  ELO_FLOOR: number;
  PLACEMENT_MATCHES: number;
  K_PLACEMENT: number;
  K_EARLY: number;
  K_ESTABLISHED: number;
  ESTABLISHED_AFTER_GAMES: number;
  K_CATEGORY: number;
  RANK_TIERS: readonly RankTier[];
  NOTABLE_RANK_CUTOFF: number;

  // --- profile -------------------------------------------------------------
  HANDLE_MAX_LENGTH: number;
  BIO_MAX_LENGTH: number;
  AVATAR_COLOURS: readonly string[];

  // --- tutorial ------------------------------------------------------------
  TUTORIAL_ITUNES_TRACK_ID: number | null;
  TUTORIAL_RIVAL_GAP_MS: number;
  TUTORIAL_RIVAL_MIN_MS: number;
  TUTORIAL_RIVAL_MAX_MS: number;
  TUTORIAL_ASSIST_MS: TutorialAssist;

  // --- veto and rooms ------------------------------------------------------
  VETO_POOL_SIZE: number;
  VETO_BANS_PER_PLAYER: number;
  VETO_PHASE_MS: number;
  ROOM_MIN_PLAYERS: number;
  ROOM_MAX_PLAYERS: number;
  RECONNECT_GRACE_MS: number;

  // --- xp ------------------------------------------------------------------
  XP_AWARDS: XpAwards;
  PRACTICE_XP_MULTIPLIER: number;
  XP_BASE: number;
  XP_CURVE_EXPONENT: number;
}

export interface PhaseDurations {
  vs_reveal: number;
  veto_reveal: number;
  countdown: number;
  /** Always equal to ROUND_DURATION_MS. See `mergeConfig` — this one is derived. */
  guessing: number;
  reveal: number;
  standings: number;
  milestone: number;
}

export interface XpAwards {
  matchComplete: number;
  rankedWin: number;
  rankedLoss: number;
  roundWon: number;
  perCorrectGuess: number;
  snapBonus: number;
  dailyComplete: number;
}

export interface TutorialAssist {
  suggest: number;
  highlight: number;
  reveal: number;
}

/**
 * The shipped baseline, assembled from `config.ts`.
 *
 * Built here rather than exported from `config.ts` so that file stays a flat list of
 * constants that reads like documentation. This is the machine-shaped view of the same
 * values, and the two cannot drift because this one is built from those imports.
 */
export const DEFAULT_CONFIG: ResolvedConfig = {
  ROUND_DURATION_MS,
  MAX_POINTS,
  SCORE_TIERS,
  REVEAL_BEATS,

  DUEL_STARTING_HP,
  ROOM_STARTING_HP,
  DAMAGE_RAMP_EVERY,
  DAMAGE_RAMP_STEP,
  TIE_DAMAGE_PER_SECOND,
  TIE_DAMAGE_CAP,
  SONG_WINS_DAMAGE,
  MAX_DUEL_ROUNDS,
  SURRENDER_FROM_ROUND,
  MILESTONE_EVERY_ROUNDS,
  READY_TIMEOUT_MS,
  DAILY_SONGS,
  PHASE_DURATIONS_MS: { ...PHASE_DURATIONS_MS },
  VS_READY_COUNTDOWN_MS,

  WRONG_GUESS_LOCKOUT_MS,
  MIN_HUMAN_REACTION_MS,
  CLIENT_CLOCK_TOLERANCE_MS,
  MAX_GUESSES_PER_ROUND,
  FUZZY_LENGTH_DIVISOR,
  FUZZY_EXACT_MAX_LEN,
  MIN_GUESS_LENGTH,
  AUTOCOMPLETE_MIN_CHARS,
  TITLE_INDEX_MAX,

  STARTING_ELO,
  ELO_FLOOR,
  PLACEMENT_MATCHES,
  K_PLACEMENT,
  K_EARLY,
  K_ESTABLISHED,
  ESTABLISHED_AFTER_GAMES,
  K_CATEGORY,
  RANK_TIERS,
  NOTABLE_RANK_CUTOFF,

  HANDLE_MAX_LENGTH,
  BIO_MAX_LENGTH,
  AVATAR_COLOURS,

  TUTORIAL_ITUNES_TRACK_ID,
  TUTORIAL_RIVAL_GAP_MS,
  TUTORIAL_RIVAL_MIN_MS,
  TUTORIAL_RIVAL_MAX_MS,
  TUTORIAL_ASSIST_MS: { ...TUTORIAL_ASSIST_MS },

  VETO_POOL_SIZE,
  VETO_BANS_PER_PLAYER,
  VETO_PHASE_MS,
  ROOM_MIN_PLAYERS,
  ROOM_MAX_PLAYERS,
  RECONNECT_GRACE_MS,

  XP_AWARDS: { ...XP_AWARDS },
  PRACTICE_XP_MULTIPLIER,
  XP_BASE,
  XP_CURVE_EXPONENT,
};

/**
 * A stored override set: dotted leaf path to value.
 *
 * Flat rather than a nested partial, because every guard in the system — bounds, risk,
 * editability, the diff between two versions — is per-leaf. `"XP_AWARDS.rankedWin"` is
 * one thing that can be validated, reverted and shown in a diff; a nested partial would
 * make each of those a tree walk.
 *
 * `null` is only ever valid for a key the registry marks nullable (today: the tutorial
 * track id, where null genuinely means "pick one at random").
 */
export type ConfigOverrides = Record<string, number | null>;

/** The subset of `ResolvedConfig` whose leaves can be addressed by a dotted path. */
const NESTED_GROUPS = ["PHASE_DURATIONS_MS", "XP_AWARDS", "TUTORIAL_ASSIST_MS"] as const;

type NestedGroup = (typeof NESTED_GROUPS)[number];

function isNestedGroup(key: string): key is NestedGroup {
  return (NESTED_GROUPS as readonly string[]).includes(key);
}

/**
 * Resolves overrides against the shipped defaults.
 *
 * UNKNOWN KEYS ARE IGNORED RATHER THAN REJECTED, and that asymmetry is deliberate: writes
 * are validated hard (see `convex/config.ts`), but a READ must never fail. A stored
 * override naming a constant that has since been renamed or deleted would otherwise take
 * down every match that resolved through it — a config row outliving a refactor is a
 * certainty, and it must degrade to "that value is back to its default".
 *
 * Structured members are shared, not cloned: nothing overrides them in v1, and copying
 * four frozen arrays on every resolve would be a per-round cost for no benefit.
 */
export function mergeConfig(overrides?: ConfigOverrides | null): ResolvedConfig {
  const resolved: ResolvedConfig = {
    ...DEFAULT_CONFIG,
    PHASE_DURATIONS_MS: { ...DEFAULT_CONFIG.PHASE_DURATIONS_MS },
    XP_AWARDS: { ...DEFAULT_CONFIG.XP_AWARDS },
    TUTORIAL_ASSIST_MS: { ...DEFAULT_CONFIG.TUTORIAL_ASSIST_MS },
  };

  // One `unknown` hop, once, rather than a cast per assignment: the dotted paths are
  // strings by construction, so this is the one place the type system cannot follow.
  const writable = resolved as unknown as Record<string, unknown>;

  for (const [path, value] of Object.entries(overrides ?? {})) {
    if (value === undefined) continue;

    const [head, leaf] = path.split(".");

    if (leaf === undefined) {
      if (!(head in resolved)) continue;
      const current = writable[head];
      // `null` is only meaningful where the default is itself nullable; anywhere else it
      // would replace a number with null and crash a consumer downstream.
      if (typeof current === "number") {
        if (typeof value === "number") writable[head] = value;
      } else if (current === null) {
        writable[head] = value;
      }
      continue;
    }

    if (!isNestedGroup(head)) continue;
    const group = writable[head] as Record<string, number>;
    if (!(leaf in group) || typeof value !== "number") continue;
    group[leaf] = value;
  }

  /**
   * `guessing` is not a setting, it is the round clock viewed from the phase machine.
   *
   * In `config.ts` it reads `guessing: ROUND_DURATION_MS`, so the two were guaranteed
   * equal by construction. Once both became overridable that guarantee disappears, and
   * the failure it allows is nasty and quiet: the server would end the guessing phase at
   * one time while the score curve divided by another, so the last seconds of every round
   * would score against a clock that had already stopped. Re-derived here, after
   * overrides, so it cannot be set independently by any means.
   */
  resolved.PHASE_DURATIONS_MS.guessing = resolved.ROUND_DURATION_MS;

  return resolved;
}
