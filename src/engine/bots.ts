/**
 * Bot opponents.
 *
 * A bot's skill *is its reaction time* — the established lever for simulating human
 * ability in game AI. Everything here is a pure function of a persona plus a random
 * source, so bot behaviour can be tested deterministically by passing a seeded RNG.
 *
 * Bots submit guesses through the same mutation humans do, so their timings must
 * stay above MIN_HUMAN_REACTION_MS or the anti-cheat clock validator will reject
 * them and they will silently fail to score.
 */

import { MIN_HUMAN_REACTION_MS, ROUND_DURATION_MS } from "./config";
// DEV ONLY — see `personaById` below for why this import exists, and delete both together.
import { DEV_RANK_BOT_PERSONAS } from "./dev-rank-bots";

export interface BotPersona {
  /** Stable key; also the seed for the generated avatar. */
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly elo: number;
  /** Category slugs this bot is unusually good at. */
  readonly strongCategories: readonly string[];
  /** Category slugs it is unusually poor at. */
  readonly weakCategories: readonly string[];
  readonly bio: string;
}

/**
 * Twelve fixed personas spread across the rating range.
 *
 * Fixed rather than generated per match so they become recognisable regulars —
 * a ladder of disposable one-off opponents feels synthetic in a way a small cast
 * of repeat rivals does not.
 */
export const BOT_PERSONAS: readonly BotPersona[] = [
  {
    id: "bot_needle",
    handle: "needledrop",
    displayName: "Needledrop",
    elo: 720,
    strongCategories: ["nineties"],
    weakCategories: ["k-pop", "latin"],
    bio: "Still buying CDs. Ask me about 1996.",
  },
  {
    id: "bot_chorus",
    handle: "chorus_kid",
    displayName: "Chorus Kid",
    elo: 810,
    strongCategories: ["pop-2010s"],
    weakCategories: ["metal"],
    bio: "I only know the chorus. It is usually enough.",
  },
  {
    id: "bot_garage",
    handle: "garageband",
    displayName: "Garageband",
    elo: 900,
    strongCategories: ["rock"],
    weakCategories: ["country"],
    bio: "Three chords and the truth.",
  },
  {
    id: "bot_trap",
    handle: "trapdoor",
    displayName: "Trapdoor",
    elo: 980,
    strongCategories: ["hip-hop"],
    weakCategories: ["rock", "metal"],
    bio: "808s over everything.",
  },
  {
    id: "bot_seoul",
    handle: "seoulsearch",
    displayName: "Seoul Search",
    elo: 1060,
    strongCategories: ["k-pop"],
    weakCategories: ["country", "nineties"],
    bio: "Fourth generation or nothing.",
  },
  {
    id: "bot_ranchera",
    handle: "ranchera",
    displayName: "Ranchera",
    elo: 1140,
    strongCategories: ["latin"],
    weakCategories: ["metal"],
    bio: "Reggaetón, salsa, and everything between.",
  },
  {
    id: "bot_dustbowl",
    handle: "dustbowl",
    displayName: "Dust Bowl",
    elo: 1220,
    strongCategories: ["country"],
    weakCategories: ["k-pop", "hip-hop"],
    bio: "Every song is about a truck. That is a compliment.",
  },
  {
    id: "bot_bpm",
    handle: "bpm180",
    displayName: "BPM180",
    elo: 1300,
    strongCategories: ["pop-2020s", "pop-2010s"],
    weakCategories: ["nineties"],
    bio: "Charts only. No apologies.",
  },
  {
    id: "bot_riff",
    handle: "riffraff",
    displayName: "Riff Raff",
    elo: 1400,
    strongCategories: ["metal", "rock"],
    weakCategories: ["pop-2020s"],
    bio: "If it does not have a riff, it is a podcast.",
  },
  {
    id: "bot_crate",
    handle: "cratedigger",
    displayName: "Crate Digger",
    elo: 1520,
    strongCategories: ["nineties", "hip-hop"],
    weakCategories: [],
    bio: "I have heard the sample you are about to name.",
  },
  {
    id: "bot_encyclo",
    handle: "encyclopop",
    displayName: "Encyclopop",
    elo: 1650,
    strongCategories: ["pop-2010s", "pop-2020s", "k-pop"],
    weakCategories: ["metal"],
    bio: "Ask me anything after 2005.",
  },
  {
    id: "bot_oracle",
    handle: "the_oracle",
    displayName: "The Oracle",
    elo: 1800,
    strongCategories: [],
    weakCategories: [],
    bio: "One second is generous.",
  },
] as const;

export function personaById(id: string): BotPersona | undefined {
  return (
    BOT_PERSONAS.find((persona) => persona.id === id) ??
    // DEV ONLY — delete this fallback with the roster. It is the single point at which
    // the dev rank bots reach the behaviour engine: `bots.playRound` and
    // `bots.placeBotBan` both return early on an unresolvable persona, so without it a
    // dev bot would join a match and then never guess or ban. Kept out of BOT_PERSONAS
    // itself so `pickPracticePersona` and `bots.seed` never see them.
    DEV_RANK_BOT_PERSONAS.find((persona) => persona.id === id)
  );
}

/**
 * Picks the persona closest to a target rating.
 *
 * Practice matches should still feel like a fair contest, so the bot nearest the
 * player's own rating is the right opponent.
 */
export function personaNearestElo(elo: number, exclude: readonly string[] = []): BotPersona {
  const candidates = BOT_PERSONAS.filter((persona) => !exclude.includes(persona.id));
  const pool = candidates.length > 0 ? candidates : BOT_PERSONAS;

  return pool.reduce((best, persona) =>
    Math.abs(persona.elo - elo) < Math.abs(best.elo - elo) ? persona : best,
  );
}

/** How many of the nearest-rated personas a practice match draws from. */
export const PRACTICE_POOL_SIZE = 3;

/**
 * Picks a practice opponent.
 *
 * `personaNearestElo` on its own is deterministic, and practice deliberately never
 * moves your rating — so "the persona nearest your Elo" never changed and every
 * practice match was against the same bot forever. Drawing from the three nearest,
 * minus whoever you just played, keeps the contest fair while making the roster read
 * as a cast of regulars rather than a single opponent.
 *
 * Falls back to the full nearest set when excluding the last opponent would leave
 * nothing — which is what happens if the roster ever shrinks below the pool size.
 */
export function pickPracticePersona(
  elo: number,
  lastPersonaId?: string,
  rng: Rng = Math.random,
): BotPersona {
  return pick(practiceCandidates(elo, lastPersonaId), rng);
}

/**
 * The exact set `pickPracticePersona` will draw from.
 *
 * Split out so the practice page can SHOW the shortlist — "you'll face one of these" — from
 * the same function the server picks with. Re-deriving "the three nearest minus the last
 * one" in the UI would work today and be wrong the first time this rule changes, and the
 * screen would go on confidently naming opponents that could not turn up.
 *
 * Sorted nearest-first, so a caller can render them in the order they are being considered.
 */
export function practiceCandidates(elo: number, lastPersonaId?: string): BotPersona[] {
  const nearest = [...BOT_PERSONAS]
    .sort((a, b) => Math.abs(a.elo - elo) - Math.abs(b.elo - elo))
    .slice(0, PRACTICE_POOL_SIZE);

  const candidates = nearest.filter((persona) => persona.id !== lastPersonaId);
  return candidates.length > 0 ? candidates : nearest;
}

/** Uniform random source. Injectable so tests are deterministic. */
export type Rng = () => number;

/** Box–Muller transform: a standard normal sample from two uniforms. */
function standardNormal(rng: Rng): number {
  // Guard against log(0), which would produce Infinity.
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Median reaction time for a rating, in milliseconds. */
function medianReactionMs(elo: number): number {
  // 700 Elo → ~14s (barely gets there); 1800 Elo → ~2.5s (near-instant recognition).
  const t = clamp((elo - 700) / (1800 - 700), 0, 1);
  return 14_000 + t * (2_500 - 14_000);
}

/**
 * Lowest time a bot may ever post.
 *
 * Well above the anti-cheat floor: a bot answering in 400ms would be technically
 * accepted but obviously synthetic, which defeats the point of a believable ladder.
 */
export const BOT_MIN_REACTION_MS = Math.max(MIN_HUMAN_REACTION_MS, 900);

/** Spread of the log-normal. Real human reaction data is right-skewed like this. */
const REACTION_SIGMA = 0.42;

/**
 * Samples a reaction time for a bot that knows the track.
 *
 * Log-normal rather than uniform or gaussian because real reaction times have a
 * hard floor and a long right tail — occasionally a player takes ages, but nobody
 * ever answers in negative time.
 */
export function sampleReactionMs(elo: number, rng: Rng = Math.random): number {
  const median = medianReactionMs(elo);
  const sampled = median * Math.exp(REACTION_SIGMA * standardNormal(rng));
  return clamp(Math.round(sampled), BOT_MIN_REACTION_MS, ROUND_DURATION_MS * 2);
}

/**
 * Probability that a bot recognises a track at all.
 *
 * Strong and weak categories are what give personas their character — the K-Pop
 * specialist genuinely should not know a country deep cut.
 */
export function knowsTrackProbability(params: {
  elo: number;
  difficulty: number;
  categorySlugs: readonly string[];
  persona: BotPersona;
}): number {
  const { elo, difficulty, categorySlugs, persona } = params;

  const base = 0.5 + (elo - 1000) / 1600;
  const difficultyPenalty = (clamp(difficulty, 1, 5) - 1) * 0.12;

  const strong = categorySlugs.some((slug) => persona.strongCategories.includes(slug));
  const weak = categorySlugs.some((slug) => persona.weakCategories.includes(slug));
  const categoryAdjustment = (strong ? 0.22 : 0) - (weak ? 0.18 : 0);

  return clamp(base - difficultyPenalty + categoryAdjustment, 0.05, 0.95);
}

export interface BotRoundPlan {
  /** True if the bot will answer at all this round. */
  readonly willAnswer: boolean;
  /** When the correct guess lands, in ms from round start. Null if it never answers. */
  readonly correctAtMs: number | null;
  /**
   * When a deliberate wrong guess lands, if any. Bots that never guess wrong feel
   * inhuman, and a wrong guess costs them the same lockout it costs a player.
   */
  readonly wrongAtMs: number | null;
  /**
   * When a bot that cannot answer gives up.
   *
   * Without this a stumped bot sat silent for the full round, forcing the human to
   * wait out a clock nobody was still racing.
   */
  readonly giveUpAtMs: number;
}

/** Chance a bot fumbles one guess before getting it right. */
const WRONG_GUESS_CHANCE = 0.25;

/**
 * Decides everything a bot will do in one round, up front.
 *
 * Planned in advance rather than reactively so the whole round can be scheduled in
 * a single mutation, matching how the phase machine already works.
 */
export function planBotRound(params: {
  persona: BotPersona;
  difficulty: number;
  categorySlugs: readonly string[];
  rng?: Rng;
}): BotRoundPlan {
  const rng = params.rng ?? Math.random;

  const knows = rng() < knowsTrackProbability({
    elo: params.persona.elo,
    difficulty: params.difficulty,
    categorySlugs: params.categorySlugs,
    persona: params.persona,
  });

  if (!knows) {
    // It does not know the song, but it may still take a stab at it.
    const guesses = rng() < 0.4;
    const sampled = guesses ? sampleReactionMs(params.persona.elo, rng) : null;
    // A stab that lands after the bot would already have conceded is no stab at all:
    // it would fire into a round that has moved on, and it breaks the ordering below.
    const wrongAtMs = sampled !== null && sampled < LATEST_GIVE_UP_MS ? sampled : null;
    return {
      willAnswer: false,
      correctAtMs: null,
      wrongAtMs,
      // Think about it a while before conceding, and never before any wrong guess.
      giveUpAtMs: giveUpTime(wrongAtMs, rng),
    };
  }

  const correctAtMs = sampleReactionMs(params.persona.elo, rng);

  // Past the round clock means it worked it out too late to matter.
  if (correctAtMs >= ROUND_DURATION_MS) {
    return {
      willAnswer: false,
      correctAtMs: null,
      wrongAtMs: null,
      giveUpAtMs: giveUpTime(null, rng),
    };
  }

  const fumbles = rng() < WRONG_GUESS_CHANCE;
  // The wrong guess must land far enough ahead of the right one to clear the
  // 5s lockout, otherwise the correct guess would be rejected.
  const wrongAtMs = fumbles && correctAtMs > 6_000 ? Math.round(correctAtMs - 5_500) : null;

  return { willAnswer: true, correctAtMs, wrongAtMs, giveUpAtMs: ROUND_DURATION_MS };
}

/**
 * The category a bot bans from the pool it is offered.
 *
 * Bots draft to protect themselves: a persona's declared weakness is exactly the
 * thing it wants gone, and its strengths are the last thing it would remove. That
 * makes a bot's bans a legible read on who it is — Seoul Search taking away country
 * says the same thing to the player that its bio does.
 *
 * Returns a slug from `available`, or null if there is nothing left to ban.
 */
export function chooseBotBan(
  persona: BotPersona,
  available: readonly string[],
  rng: Rng = Math.random,
): string | null {
  if (available.length === 0) return null;

  const weak = available.filter((slug) => persona.weakCategories.includes(slug));
  if (weak.length > 0) return pick(weak, rng);

  // Nothing it is actively bad at — then at least never ban away its own advantage.
  const neutral = available.filter((slug) => !persona.strongCategories.includes(slug));
  if (neutral.length > 0) return pick(neutral, rng);

  // A persona strong at everything on offer (The Oracle has no listed weakness at
  // all): any ban is as good as another.
  return pick(available, rng);
}

/** Shortest and longest a bot deliberates over a ban. */
export const BOT_BAN_MIN_MS = 900;
export const BOT_BAN_MAX_MS = 2_200;

/**
 * How long a bot "thinks" before placing a ban.
 *
 * Instant bans read as a script running, not an opponent drafting. A beat of delay is
 * the whole reason the ban phase feels like a read on the other player.
 */
export function botBanDelayMs(rng: Rng = Math.random): number {
  return Math.round(BOT_BAN_MIN_MS + rng() * (BOT_BAN_MAX_MS - BOT_BAN_MIN_MS));
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/**
 * Last moment a bot will concede. Anything later is indistinguishable from letting
 * the clock run out, which is the behaviour conceding exists to avoid.
 */
const LATEST_GIVE_UP_MS = ROUND_DURATION_MS - 2_000;

/**
 * When a stumped bot concedes: somewhere in the back half of the round, so it looks
 * like genuine deliberation rather than an instant forfeit.
 *
 * Callers must not pass a `wrongAtMs` at or beyond `LATEST_GIVE_UP_MS` — the clamp
 * below would then return a concession that lands *before* the bot's own wrong guess.
 */
function giveUpTime(wrongAtMs: number | null, rng: Rng): number {
  const earliest = Math.max(12_000, (wrongAtMs ?? 0) + 6_000);
  if (earliest >= LATEST_GIVE_UP_MS) return LATEST_GIVE_UP_MS;
  return Math.round(earliest + rng() * (LATEST_GIVE_UP_MS - earliest));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
