/**
 * Bot careers.
 *
 * A bot seeded with `0W · 0L`, Level 1 and no badges is visibly a prop, which makes it
 * useless for judging what the leaderboard, the VS screen or a profile look like against
 * a real population. This module gives every persona a past.
 *
 * Nothing here invents a number. The career is played out by the same functions a live
 * match runs on — `planBotRound` for what a persona does in a round, `scoreForGuess` for
 * the points, `duelDamage` and `resolveDuel` for the health duel, `applyMatchResult` for
 * the rating, `awardMatchXp` for the XP, `evaluateBadges` for the badges. The totals are
 * a *consequence* of play rather than an assertion about it, so they cannot disagree with
 * the systems that read them: a bot's level always matches its XP, its record always
 * matches its rating movement, and its strongest categories are genuinely the ones it
 * scored in.
 *
 * Simulating a full career is pure arithmetic and costs milliseconds, so the whole thing
 * runs in memory and only the last few matches are persisted. See `convex/botprofiles.ts`
 * for the write side.
 *
 * Everything is a pure function of a persona plus a seeded RNG, matching the convention
 * in ./bots — re-seeding a deployment produces byte-identical careers, so the numbers on
 * a profile never churn and the tests can pin them.
 */

import { evaluateBadges } from "./badges";
import { chooseBotBan, planBotRound, type BotPersona, type Rng } from "./bots";
import {
  DUEL_STARTING_HP,
  ELO_FLOOR,
  MAX_DUEL_ROUNDS,
  ROUND_DURATION_MS,
  STARTING_ELO,
  VETO_BANS_PER_PLAYER,
  VETO_POOL_SIZE,
} from "./config";
import {
  damageMultiplier,
  duelDamage,
  resolveDuel,
  wonRound,
  type DuelPlayerState,
  type RoundOutcome,
  type RoundScore,
} from "./duel";
import {
  applyCategoryResults,
  applyMatchResult,
  DRAW,
  LOSS,
  outcomeFromScores,
  WIN,
  type CategoryRoundResult,
  type Outcome,
} from "./elo";
import { scoreForGuess, tierForElapsed } from "./scoring";
import { awardMatchXp, levelForXp, type XpBreakdownEntry } from "./xp";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * A track the simulation is allowed to draw on.
 *
 * Supplied by the caller rather than invented here so the rounds are played against the
 * real catalogue: `index` points back into the caller's own list, which is what lets the
 * writer put a genuine `Id<"tracks">` on every entry of the persisted round log. A
 * fabricated track id would render a blank round on the results screen.
 */
export interface TrackSample {
  readonly index: number;
  readonly difficulty: number;
  readonly categorySlugs: readonly string[];
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** One player's line in a round, in the same shape the persisted round log stores. */
export interface SimulatedRoundResult {
  /** 0 is the bot whose career produced this match; 1 is its opponent. */
  readonly slot: 0 | 1;
  readonly points: number;
  /** Null when the bot never answered — the log stores that as an absent field. */
  readonly elapsedMs: number | null;
  readonly solved: boolean;
}

export interface SimulatedRoundDamage {
  readonly slot: 0 | 1;
  readonly damage: number;
  readonly hpAfter: number;
}

export interface SimulatedRound {
  readonly roundIndex: number;
  readonly trackIndex: number;
  readonly outcome: RoundOutcome;
  /** Undefined when the song beat both of them. */
  readonly winnerSlot: 0 | 1 | undefined;
  readonly timeGapMs: number | undefined;
  readonly multiplier: number;
  readonly damage: readonly SimulatedRoundDamage[];
  readonly results: readonly SimulatedRoundResult[];
}

/** One player's final standing in a simulated match — a `matchPlayers` row in waiting. */
export interface SimulatedPlayer {
  readonly personaId: string;
  readonly totalPoints: number;
  readonly hp: number;
  readonly lowestHp: number;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly ratingDelta: number;
  readonly xpEarned: number;
  readonly xpBreakdown: readonly XpBreakdownEntry[];
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly xpAfter: number;
  readonly badgesEarned: readonly string[];
}

export interface SimulatedMatch {
  /** Slot 0 is always the bot whose career produced this match. */
  readonly players: readonly [SimulatedPlayer, SimulatedPlayer];
  readonly winnerSlot: 0 | 1 | undefined;
  readonly rounds: readonly SimulatedRound[];
  /** Every track the match drew, including any never reached. Becomes `matches.trackIds`. */
  readonly trackIndices: readonly number[];
  readonly bannedCategorySlugs: readonly string[];
  readonly suddenDeath: boolean;
  readonly startedAt: number;
  readonly completedAt: number;
}

export interface BotCareer {
  readonly personaId: string;
  /** Always exactly `persona.elo` — see `settleOnAnchor` for why that is not free. */
  readonly elo: number;
  readonly gamesPlayed: number;
  readonly rankedWins: number;
  readonly xp: number;
  readonly level: number;
  readonly snapGuesses: number;
  readonly createdAt: number;
  readonly categoryRatings: readonly { slug: string; rating: number; games: number }[];
  readonly badgeIds: readonly string[];
  /** The most recent matches, oldest first. The only part that gets persisted. */
  readonly tail: readonly SimulatedMatch[];
}

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

/**
 * Career length across the rating range. A Bronze account is new; a Legend is not.
 *
 * The floor is kept comfortably above `CAREER_TAIL_LENGTH` so that the persisted matches
 * are always a tail rather than most of the career — see `pickOpponent` for why the last
 * few games are played under different matchmaking from the rest.
 */
const MIN_CAREER_GAMES = 24;
const MAX_CAREER_GAMES = 420;

/**
 * Bends the volume curve so the middle of the ladder is not simply the midpoint.
 * Most accounts at 1200 have played far closer to 100 games than to 200.
 */
const CAREER_GAMES_CURVE = 1.3;

/**
 * How far from its own rating a bot is matched, at the two ends of the ladder.
 *
 * This is the whole winrate mechanism, and it is a real property of ladders rather than a
 * thumb on the scale: the population thins at both ends, so a Legend mostly draws
 * opponents rated below it and a Bronze mostly draws opponents rated above. A 45-point
 * gap is worth ~5.5 points of expected score, which lands the roster at roughly 44% at the
 * bottom and 58% at the top — exactly the spread the ladder should show, arrived at by
 * matchmaking rather than by forcing results.
 */
const OPPONENT_SKEW_ELO = 45;

/** How many of the nearest-rated personas an opponent is drawn from. */
const OPPONENT_POOL_SIZE = 4;

/**
 * Corrective bias applied once a bot has enough games for its record to mean anything.
 *
 * The duel engine's implied win probability is not the Elo formula's — it comes out of
 * reaction-time distributions and category knowledge — so the skew above gets close but
 * does not land exactly. Feeding the running error back into opponent selection closes
 * the gap without ever touching a result. Bounded so a bot never ends up matched against
 * the opposite end of the ladder.
 */
const WINRATE_CORRECTION_GAIN = 600;
const WINRATE_CORRECTION_LIMIT = 150;
const WINRATE_CORRECTION_FROM_GAME = 5;

/** Matches persisted per bot. Every one is written in full, so this is the write cost. */
export const CAREER_TAIL_LENGTH = 8;

/** The window the persisted tail is spread across. */
const TAIL_WINDOW_DAYS = 21;

/** Rough pace of play, used only to date the account. */
const DAYS_PER_GAME = 1.2;
const MIN_ACCOUNT_AGE_DAYS = 20;
const MAX_ACCOUNT_AGE_DAYS = 400;

const MS_PER_DAY = 86_400_000;

/**
 * Category rating a persona's declared strengths and weaknesses stand in at.
 *
 * Used only as the *opponent's* baseline when the focal bot's own per-category ratings
 * drift, so that beating a k-pop specialist at k-pop is worth more than beating them at
 * country. Without it every category would drift against the same flat number and the
 * "Strongest categories" panel would read as noise.
 */
const CATEGORY_STRENGTH_BONUS = 120;
const CATEGORY_WEAKNESS_PENALTY = 140;

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

/**
 * A deterministic RNG keyed on a string.
 *
 * FNV-1a to mix the seed, then mulberry32 to generate. Careers have to be reproducible:
 * re-running a seed must not churn every number on every profile, and the tests have to
 * be able to pin a specific persona's record.
 */
export function seededRng(seed: string): Rng {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return () => {
    hash = (hash + 0x6d2b79f5) >>> 0;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The roster entry point
// ---------------------------------------------------------------------------

/**
 * Simulates a career for every persona on the roster.
 *
 * Two passes, because a match has two sides. The first plays out each bot's own career;
 * the second fills in the opponent's XP and level on every persisted match, which is only
 * knowable once that opponent's own career has been simulated. Doing it in one pass would
 * either recurse forever or leave half of every results screen blank.
 */
export function simulateRoster(params: {
  personas: readonly BotPersona[];
  tracks: readonly TrackSample[];
  now: number;
  tailLength?: number;
}): Map<string, BotCareer> {
  const careers = new Map<string, BotCareer>();

  for (const persona of params.personas) {
    careers.set(
      persona.id,
      simulateCareer({
        persona,
        roster: params.personas,
        tracks: params.tracks,
        now: params.now,
        tailLength: params.tailLength,
      }),
    );
  }

  return backfillOpponentProgression(careers);
}

/**
 * Gives the opponent slot of every persisted match a real level and XP total.
 *
 * The opponent's XP *for that match* was already computed from its own play; what was
 * missing is the career total it sat on top of, which is what the results screen animates
 * the level bar from. Approximated as their end-of-career XP less what this match paid —
 * off by however much they earned afterwards, and invisible anywhere.
 */
function backfillOpponentProgression(
  careers: Map<string, BotCareer>,
): Map<string, BotCareer> {
  const filled = new Map<string, BotCareer>();

  for (const [personaId, career] of careers) {
    filled.set(personaId, {
      ...career,
      tail: career.tail.map((match) => {
        const opponent = careers.get(match.players[1].personaId);
        if (!opponent) return match;

        const xpAfter = opponent.xp;
        const xpBefore = Math.max(0, xpAfter - match.players[1].xpEarned);

        return {
          ...match,
          players: [
            match.players[0],
            {
              ...match.players[1],
              levelBefore: levelForXp(xpBefore).level,
              levelAfter: levelForXp(xpAfter).level,
              xpAfter,
            },
          ] as const,
        };
      }),
    });
  }

  return filled;
}

// ---------------------------------------------------------------------------
// One career
// ---------------------------------------------------------------------------

/**
 * Plays out one persona's whole career and reports what it left behind.
 *
 * The rating starts at the persona's declared Elo rather than at STARTING_ELO. These
 * accounts are calibrated by definition — the anchor *is* the bot's true strength, and it
 * is also the parameter driving its reaction times, so climbing to it from 1000 would mean
 * simulating a player who was worse than itself for a hundred games. What the career
 * produces is a walk *around* that anchor, which is what a settled rating actually looks
 * like.
 */
export function simulateCareer(params: {
  persona: BotPersona;
  roster: readonly BotPersona[];
  tracks: readonly TrackSample[];
  now: number;
  tailLength?: number;
  rng?: Rng;
}): BotCareer {
  const { persona, roster, tracks, now } = params;
  const tailLength = params.tailLength ?? CAREER_TAIL_LENGTH;

  if (tracks.length === 0) {
    throw new Error("simulateCareer needs at least one track to play a round with");
  }

  const rng = params.rng ?? seededRng(`career:${persona.id}`);

  const t = clamp((persona.elo - 150) / (1850 - 150), 0, 1);
  const targetGames = Math.max(
    1,
    Math.round(
      lerp(MIN_CAREER_GAMES, MAX_CAREER_GAMES, Math.pow(t, CAREER_GAMES_CURVE)) *
        (0.85 + rng() * 0.3),
    ),
  );
  const opponentSkew = lerp(OPPONENT_SKEW_ELO, -OPPONENT_SKEW_ELO, t);
  const targetWinRate = lerp(0.44, 0.58, t);

  const state: CareerState = {
    rating: persona.elo,
    gamesPlayed: 0,
    rankedWins: 0,
    xp: 0,
    snapGuesses: 0,
    categoryRatings: new Map(),
    badges: new Set<string>(),
  };

  const played: SimulatedMatch[] = [];

  for (let game = 0; game < targetGames; game++) {
    const opponent = pickOpponent({
      persona,
      roster,
      targetElo: persona.elo + opponentSkew + winrateCorrection(state, targetWinRate),
      // Only the last few matches are kept, and those are the ones that need a named
      // opponent with a profile to link to.
      named: game >= targetGames - tailLength,
      rng,
    });

    played.push(playCareerMatch({ persona, opponent, tracks, state, rng }));
  }

  const settled = settleOnAnchor(played, persona.elo);
  const tail = settled.slice(Math.max(0, settled.length - tailLength));

  return {
    personaId: persona.id,
    elo: persona.elo,
    gamesPlayed: state.gamesPlayed,
    rankedWins: state.rankedWins,
    xp: state.xp,
    level: levelForXp(state.xp).level,
    snapGuesses: state.snapGuesses,
    createdAt: accountCreatedAt(now, state.gamesPlayed),
    categoryRatings: [...state.categoryRatings.entries()]
      .map(([slug, entry]) => ({ slug, rating: Math.round(entry.rating), games: entry.games }))
      .sort((a, b) => b.rating - a.rating),
    badgeIds: [...state.badges],
    tail: dateTail(tail, now),
  };
}

interface CareerState {
  rating: number;
  gamesPlayed: number;
  rankedWins: number;
  xp: number;
  snapGuesses: number;
  categoryRatings: Map<string, { rating: number; games: number }>;
  badges: Set<string>;
}

/**
 * How far to bias the next opponent, from how the record is tracking.
 *
 * Positive means "face someone stronger" — which is what a bot winning above its target
 * needs. Held at zero over the opening games, where a running winrate is one or two
 * results and reacting to it would just add noise.
 */
function winrateCorrection(state: CareerState, targetWinRate: number): number {
  if (state.gamesPlayed < WINRATE_CORRECTION_FROM_GAME) return 0;

  const running = state.rankedWins / state.gamesPlayed;
  return clamp(
    (running - targetWinRate) * WINRATE_CORRECTION_GAIN,
    -WINRATE_CORRECTION_LIMIT,
    WINRATE_CORRECTION_LIMIT,
  );
}

/**
 * Draws an opponent at a target rating.
 *
 * The roster is not the population, and treating it as one is what broke the first version
 * of this. Sixteen bots spread over 1700 Elo average 113 points apart, and at the two ends
 * there is nobody further out to face — so the bot anchored at 150 could only ever be
 * matched *upward* and posted 2W-12L, while the one at 1800 could only be matched downward
 * and posted 88%. Neither is a matchmaking outcome; both are an artefact of the roster
 * being a sample of a ladder rather than the ladder itself.
 *
 * So the bulk of a career is played against a `peer`: a player at exactly the matched
 * rating, wearing the character of the nearest real persona. That is what ranked
 * matchmaking actually hands you, and it is what lets the winrate correction reach.
 *
 * The persisted tail is different. Those matches appear on a profile with a clickable
 * opponent, so they have to name someone real — `named` switches to drawing from the
 * roster itself, nearest first.
 */
function pickOpponent(params: {
  persona: BotPersona;
  roster: readonly BotPersona[];
  targetElo: number;
  named: boolean;
  rng: Rng;
}): BotPersona {
  const candidates = params.roster.filter((entry) => entry.id !== params.persona.id);
  const pool = (candidates.length > 0 ? candidates : params.roster)
    .slice()
    .sort((a, b) => Math.abs(a.elo - params.targetElo) - Math.abs(b.elo - params.targetElo))
    .slice(0, OPPONENT_POOL_SIZE);

  const nearest = pool[Math.min(pool.length - 1, Math.floor(params.rng() * pool.length))];
  if (params.named) return nearest;

  // A peer at the matched rating. Rating is the only thing the duel engine reads as
  // skill, so overriding it *is* fielding a different player; the strengths and
  // weaknesses come along so the category ratings still develop a shape.
  const rating = Math.max(ELO_FLOOR, Math.round(params.targetElo));
  return { ...nearest, id: `peer:${rating}`, handle: `peer_${rating}`, elo: rating };
}

/** Plays one match and folds everything it produced back into the career. */
function playCareerMatch(params: {
  persona: BotPersona;
  opponent: BotPersona;
  tracks: readonly TrackSample[];
  state: CareerState;
  rng: Rng;
}): SimulatedMatch {
  const { persona, opponent, tracks, state, rng } = params;

  const bannedCategorySlugs = draftBans(persona, opponent, tracks, rng);
  const trackIndices = pickMatchTracks(tracks, bannedCategorySlugs, rng);
  const duel = simulateDuel({ persona, opponent, tracks, trackIndices, rng });

  // Mirrors `applyRanked`: the winner recorded on the match decides the outcome, and only
  // a match with no winner falls back to comparing points.
  const outcome: Outcome =
    duel.winnerSlot === undefined
      ? outcomeFromScores(duel.sides[0].totalPoints, duel.sides[1].totalPoints)
      : duel.winnerSlot === 0
        ? WIN
        : LOSS;

  const ratingBefore = state.rating;
  const update = applyMatchResult({
    rating: ratingBefore,
    opponentRating: opponent.elo,
    outcome,
    gamesPlayed: state.gamesPlayed,
  });

  const won = outcome === WIN;

  state.rating = update.rating;
  state.gamesPlayed = update.gamesPlayed;
  if (won) state.rankedWins += 1;

  const xp = awardMatchXp({
    mode: "ranked",
    won,
    roundsWon: duel.sides[0].roundsWon,
    correctGuesses: duel.sides[0].correctGuesses,
    snapGuesses: duel.sides[0].snapGuesses,
  });

  const xpBefore = state.xp;
  state.xp += xp.total;
  state.snapGuesses += duel.sides[0].snapGuesses;

  applyCareerCategoryRatings({ state, opponent, tracks, duel });

  const badgesEarned = awardCareerBadges({ state, opponent, duel, won, ratingBefore });

  // The opponent's own line. Its rating moves against ours from its anchor, which is where
  // a settled bot sits; its level and XP total are filled in later by the roster pass.
  const opponentXp = awardMatchXp({
    mode: "ranked",
    won: outcome === LOSS,
    roundsWon: duel.sides[1].roundsWon,
    correctGuesses: duel.sides[1].correctGuesses,
    snapGuesses: duel.sides[1].snapGuesses,
  });
  const opponentUpdate = applyMatchResult({
    rating: opponent.elo,
    opponentRating: ratingBefore,
    outcome: outcome === WIN ? LOSS : outcome === LOSS ? WIN : DRAW,
    // Established: these are settled accounts, so the opponent moves at the low K rather
    // than the placement K a zero here would imply.
    gamesPlayed: Number.MAX_SAFE_INTEGER,
  });

  return {
    players: [
      {
        personaId: persona.id,
        totalPoints: duel.sides[0].totalPoints,
        hp: duel.sides[0].hp,
        lowestHp: duel.sides[0].lowestHp,
        ratingBefore,
        ratingAfter: update.rating,
        ratingDelta: update.delta,
        xpEarned: xp.total,
        xpBreakdown: xp.breakdown.map((entry) => ({ ...entry })),
        levelBefore: levelForXp(xpBefore).level,
        levelAfter: levelForXp(state.xp).level,
        xpAfter: state.xp,
        badgesEarned,
      },
      {
        personaId: opponent.id,
        totalPoints: duel.sides[1].totalPoints,
        hp: duel.sides[1].hp,
        lowestHp: duel.sides[1].lowestHp,
        ratingBefore: opponent.elo,
        ratingAfter: opponentUpdate.rating,
        ratingDelta: opponentUpdate.delta,
        xpEarned: opponentXp.total,
        xpBreakdown: opponentXp.breakdown.map((entry) => ({ ...entry })),
        // Replaced by `backfillOpponentProgression` once every career is known.
        levelBefore: 1,
        levelAfter: 1,
        xpAfter: opponentXp.total,
        badgesEarned: [],
      },
    ],
    winnerSlot: duel.winnerSlot,
    rounds: duel.rounds,
    trackIndices,
    bannedCategorySlugs,
    suddenDeath: duel.suddenDeath,
    startedAt: 0,
    completedAt: 0,
  };
}

// ---------------------------------------------------------------------------
// The duel
// ---------------------------------------------------------------------------

interface DuelSide {
  persona: BotPersona;
  hp: number;
  lowestHp: number;
  totalPoints: number;
  eliminatedAtRound: number | null;
  correctGuesses: number;
  snapGuesses: number;
  roundsWon: number;
}

interface DuelResult {
  readonly sides: readonly [DuelSide, DuelSide];
  readonly rounds: readonly SimulatedRound[];
  readonly winnerSlot: 0 | 1 | undefined;
  readonly suddenDeath: boolean;
}

/**
 * Plays a health duel between two personas.
 *
 * A deliberate re-tracing of the live flow in convex/phases.ts: guesses are planned with
 * `planBotRound`, unanswered rounds count as the full round clock when damage is measured,
 * eliminated players stop taking damage, and the duel terminates through `resolveDuel`
 * with the same "ran out of catalogue" settle. Anything simpler would produce a health
 * timeline that a player could tell apart from a real one.
 */
function simulateDuel(params: {
  persona: BotPersona;
  opponent: BotPersona;
  tracks: readonly TrackSample[];
  trackIndices: readonly number[];
  rng: Rng;
}): DuelResult {
  const sides: [DuelSide, DuelSide] = [
    freshSide(params.persona),
    freshSide(params.opponent),
  ];

  const rounds: SimulatedRound[] = [];
  let winnerSlot: 0 | 1 | undefined;
  let suddenDeath = false;
  let decided = false;

  for (let roundIndex = 0; roundIndex < params.trackIndices.length; roundIndex++) {
    const track = params.tracks[params.trackIndices[roundIndex]];

    const results = sides.map((side, slot): SimulatedRoundResult => {
      const plan = planBotRound({
        persona: side.persona,
        difficulty: track.difficulty,
        categorySlugs: track.categorySlugs,
        rng: params.rng,
      });

      if (plan.correctAtMs === null) {
        return { slot: slot as 0 | 1, points: 0, elapsedMs: null, solved: false };
      }

      return {
        slot: slot as 0 | 1,
        points: scoreForGuess(plan.correctAtMs).points,
        elapsedMs: plan.correctAtMs,
        solved: true,
      };
    });

    // An unanswered round contributes the full clock, exactly as `roundScores` does —
    // otherwise two players who both failed would tie at 0ms and the round would be
    // settled on a time neither of them posted.
    const scores: RoundScore[] = results.map((result) => ({
      userId: String(result.slot),
      points: result.points,
      elapsedMs: result.elapsedMs ?? ROUND_DURATION_MS,
    }));

    const resolution = duelDamage(scores, roundIndex);
    const damage: SimulatedRoundDamage[] = [];

    for (const entry of resolution.damage) {
      const slot = Number(entry.userId) as 0 | 1;
      const side = sides[slot];
      const alreadyOut = side.eliminatedAtRound !== null;
      const hpBefore = side.hp;
      const hpAfter = alreadyOut ? hpBefore : Math.max(0, hpBefore - entry.damage);

      side.hp = hpAfter;
      side.lowestHp = Math.min(side.lowestHp, hpAfter);
      if (hpAfter === 0 && !alreadyOut) side.eliminatedAtRound = roundIndex;

      damage.push({ slot, damage: alreadyOut ? 0 : entry.damage, hpAfter });
    }

    for (const result of results) {
      const side = sides[result.slot];
      side.totalPoints += result.points;
      if (result.solved && result.elapsedMs !== null) {
        side.correctGuesses += 1;
        if (tierForElapsed(result.elapsedMs).id === "snap") side.snapGuesses += 1;
      }
      const others = results.filter((other) => other.slot !== result.slot).map((o) => o.points);
      if (wonRound(result.points, others)) side.roundsWon += 1;
    }

    rounds.push({
      roundIndex,
      trackIndex: params.trackIndices[roundIndex],
      outcome: resolution.outcome,
      winnerSlot:
        resolution.winnerId === undefined ? undefined : (Number(resolution.winnerId) as 0 | 1),
      timeGapMs: resolution.timeGapMs,
      multiplier: damageMultiplier(roundIndex),
      damage,
      results,
    });

    const status = resolveDuel(duelStates(sides), roundIndex + 1);

    if (status.kind === "complete") {
      winnerSlot = status.winnerId === undefined ? undefined : (Number(status.winnerId) as 0 | 1);
      decided = true;
      break;
    }

    if (status.kind === "sudden-death") suddenDeath = true;
  }

  // Ran the catalogue out with both still standing: settle on health, then points, and
  // record a draw if neither separates them.
  if (!decided) {
    const ranked = duelStates(sides)
      .slice()
      .sort((a, b) => b.hp - a.hp || b.totalPoints - a.totalPoints);
    const decisive = ranked[1] === undefined || ranked[0].hp !== ranked[1].hp;
    winnerSlot = decisive ? (Number(ranked[0].userId) as 0 | 1) : undefined;
  }

  return { sides, rounds, winnerSlot, suddenDeath };
}

function freshSide(persona: BotPersona): DuelSide {
  return {
    persona,
    hp: DUEL_STARTING_HP,
    lowestHp: DUEL_STARTING_HP,
    totalPoints: 0,
    eliminatedAtRound: null,
    correctGuesses: 0,
    snapGuesses: 0,
    roundsWon: 0,
  };
}

function duelStates(sides: readonly DuelSide[]): DuelPlayerState[] {
  return sides.map((side, slot) => ({
    userId: String(slot),
    hp: side.hp,
    totalPoints: side.totalPoints,
    eliminatedAtRound: side.eliminatedAtRound,
  }));
}

// ---------------------------------------------------------------------------
// Draft and track selection
// ---------------------------------------------------------------------------

/**
 * Runs the ban draft with the real `chooseBotBan`.
 *
 * Worth doing properly rather than picking at random: a persona bans what it is weak at,
 * so the categories missing from a bot's history are legible evidence of who it is — the
 * same read its bio gives.
 */
function draftBans(
  persona: BotPersona,
  opponent: BotPersona,
  tracks: readonly TrackSample[],
  rng: Rng,
): string[] {
  const all = allCategorySlugs(tracks);
  if (all.length === 0) return [];

  const pool = shuffle(all, rng).slice(0, Math.min(VETO_POOL_SIZE, all.length));
  const banned: string[] = [];
  // Lower rating opens the draft, as it does in ranked.
  const order = persona.elo <= opponent.elo ? [persona, opponent] : [opponent, persona];

  for (let turn = 0; turn < VETO_BANS_PER_PLAYER * 2; turn++) {
    const available = pool.filter((slug) => !banned.includes(slug));
    if (available.length === 0) break;
    const slug = chooseBotBan(order[turn % 2], available, rng);
    if (slug) banned.push(slug);
  }

  return banned;
}

/**
 * Draws the match's tracks, skipping anything in a banned category.
 *
 * Falls back to the unfiltered catalogue when the bans leave too little, which is the same
 * decision `pickTracksForMatch` makes — a thin catalogue should shorten a match, not fail
 * to start one.
 */
function pickMatchTracks(
  tracks: readonly TrackSample[],
  bannedCategorySlugs: readonly string[],
  rng: Rng,
): number[] {
  const allowed = tracks.filter(
    (track) => !track.categorySlugs.some((slug) => bannedCategorySlugs.includes(slug)),
  );
  const pool = allowed.length >= MIN_MATCH_TRACKS ? allowed : tracks;

  return shuffle(pool, rng)
    .slice(0, Math.min(MAX_DUEL_ROUNDS, pool.length))
    .map((track) => track.index);
}

/** Below this the bans are ignored rather than starving the match. */
const MIN_MATCH_TRACKS = 6;

function allCategorySlugs(tracks: readonly TrackSample[]): string[] {
  const slugs = new Set<string>();
  for (const track of tracks) for (const slug of track.categorySlugs) slugs.add(slug);
  return [...slugs].sort();
}

// ---------------------------------------------------------------------------
// Per-category ratings and badges
// ---------------------------------------------------------------------------

/**
 * Folds a match's per-track head-to-heads into the running category ratings.
 *
 * Keyed on the category *slug* rather than an id, because this module never sees the
 * database. `applyCategoryResults` treats the key as opaque, so the writer only has to map
 * slugs back to ids on the way out.
 */
function applyCareerCategoryRatings(params: {
  state: CareerState;
  opponent: BotPersona;
  tracks: readonly TrackSample[];
  duel: DuelResult;
}): void {
  const { state, opponent, tracks, duel } = params;

  const results: CategoryRoundResult[] = [];

  for (const round of duel.rounds) {
    const mine = round.results.find((entry) => entry.slot === 0);
    const theirs = round.results.find((entry) => entry.slot === 1);
    if (!mine || !theirs) continue;
    // A round neither of them reached carries no signal, exactly as in production.
    if (mine.points === 0 && theirs.points === 0) continue;

    for (const slug of tracks[round.trackIndex].categorySlugs) {
      results.push({
        categoryId: slug,
        playerPoints: mine.points,
        opponentPoints: theirs.points,
      });
    }
  }

  if (results.length === 0) return;

  const updates = applyCategoryResults({
    results,
    currentRatings: Object.fromEntries(state.categoryRatings),
    opponentRatings: opponentCategoryRatings(opponent, results),
    defaultRating: STARTING_ELO,
  });

  for (const update of updates) {
    state.categoryRatings.set(update.categoryId, {
      rating: update.rating,
      games: update.games,
    });
  }
}

/** The opponent's standing in each category, from what its persona declares. */
function opponentCategoryRatings(
  opponent: BotPersona,
  results: readonly CategoryRoundResult[],
): Record<string, { rating: number; games: number }> {
  const ratings: Record<string, { rating: number; games: number }> = {};

  for (const result of results) {
    if (ratings[result.categoryId]) continue;
    const strong = opponent.strongCategories.includes(result.categoryId);
    const weak = opponent.weakCategories.includes(result.categoryId);
    ratings[result.categoryId] = {
      rating:
        opponent.elo +
        (strong ? CATEGORY_STRENGTH_BONUS : 0) -
        (weak ? CATEGORY_WEAKNESS_PENALTY : 0),
      games: 0,
    };
  }

  return ratings;
}

/**
 * Evaluates badges for the match and keeps the ones not already held.
 *
 * Same predicate and same dedupe as `awardBadges` in convex/progression.ts, against career
 * totals that *include* this match — which is what `evaluateBadges` documents it wants.
 */
function awardCareerBadges(params: {
  state: CareerState;
  opponent: BotPersona;
  duel: DuelResult;
  won: boolean;
  /** The rating held going in, matching how production measures the upset. */
  ratingBefore: number;
}): string[] {
  const { state, opponent, duel, won, ratingBefore } = params;
  const side = duel.sides[0];

  const candidates = evaluateBadges({
    mode: "ranked",
    won,
    totalRankedWins: state.rankedWins,
    totalRankedMatches: state.gamesPlayed,
    totalSnapGuesses: state.snapGuesses,
    tookNoDamage: side.hp >= DUEL_STARTING_HP,
    wonFromCritical: side.lowestHp < DUEL_STARTING_HP * 0.25,
    wonSuddenDeath: won && duel.suddenDeath,
    opponentEloAdvantage: Math.max(0, opponent.elo - ratingBefore),
  });

  const earned: string[] = [];
  for (const badgeId of candidates) {
    if (state.badges.has(badgeId)) continue;
    state.badges.add(badgeId);
    earned.push(badgeId);
  }

  return earned;
}

// ---------------------------------------------------------------------------
// Landing on the anchor
// ---------------------------------------------------------------------------

/**
 * Shifts the rating path so the career ends on exactly the persona's declared Elo.
 *
 * This matters more than it looks. `dev-rank-bots.test.ts` pins every rank anchor to the
 * rank it is supposed to occupy, and the whole point of that roster is a leaderboard
 * showing sixteen distinct ranks — a bot that drifted forty points off its anchor could
 * land in the wrong division. Meanwhile the stored Elo has to equal the `ratingAfter` of
 * the bot's own most recent match, or its profile contradicts its history.
 *
 * The walk is translated wholesale rather than having its last delta stretched, so every
 * individual delta stays exactly what `applyMatchResult` produced and no single match
 * shows a rating swing the K-factor could not have paid.
 *
 * The translation can push an early match under the rating floor — a Bronze bot anchored
 * at 150 has very little room beneath it. Those are clamped and the delta recomputed from
 * the clamped pair, which is the same thing `applyMatchResult` does for a floored loss:
 * report the drop actually taken rather than the one the formula asked for.
 */
function settleOnAnchor(matches: SimulatedMatch[], anchorElo: number): SimulatedMatch[] {
  if (matches.length === 0) return matches;

  const drift = matches[matches.length - 1].players[0].ratingAfter - anchorElo;
  if (drift === 0) return matches;

  return matches.map((match) => {
    const ratingBefore = Math.max(ELO_FLOOR, match.players[0].ratingBefore - drift);
    const ratingAfter = Math.max(ELO_FLOOR, match.players[0].ratingAfter - drift);

    return {
      ...match,
      players: [
        {
          ...match.players[0],
          ratingBefore,
          ratingAfter,
          ratingDelta: ratingAfter - ratingBefore,
        },
        match.players[1],
      ] as const,
    };
  });
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Spreads the persisted tail across a recent window, oldest first. */
function dateTail(tail: SimulatedMatch[], now: number): SimulatedMatch[] {
  const window = TAIL_WINDOW_DAYS * MS_PER_DAY;
  const step = tail.length > 0 ? window / tail.length : window;

  return tail.map((match, index) => {
    const completedAt = Math.round(now - window + step * (index + 0.5));
    // A duel is roughly ten minutes of play; the results screen never shows this, but a
    // match that completed before it started is the kind of thing that surfaces later.
    return { ...match, startedAt: completedAt - 10 * 60_000, completedAt };
  });
}

/** When the account was made, from how much it has played. */
function accountCreatedAt(now: number, gamesPlayed: number): number {
  const days = clamp(gamesPlayed * DAYS_PER_GAME, MIN_ACCOUNT_AGE_DAYS, MAX_ACCOUNT_AGE_DAYS);
  return Math.round(now - days * MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
