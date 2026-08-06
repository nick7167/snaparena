/**
 * DEV ONLY — sixteen bot accounts, one parked in each rank.
 *
 * Ranked cannot be tested alone. The queue is empty, so `tryMatchmake` never pairs,
 * and the only opponent on offer is a `mode: "practice"` bot that deliberately cannot
 * move rating — which is exactly the thing that needs testing. These sixteen sit in the
 * ranked queue as ordinary opponents, so placements, Elo movement, promotions and the
 * populated leaderboard can all be exercised for real before launch.
 *
 * DELETE BEFORE PUBLISHING. See `convex/devbots.ts` for the purge that removes the
 * accounts and every match they appear in, and the removal checklist alongside it.
 *
 * Deliberately NOT added to `BOT_PERSONAS` in ./bots: `pickPracticePersona` and
 * `bots.seed` both iterate that array, so appending here would quietly re-cast the
 * practice roster and seed thirty-two bots from `npm run seed-bots`. Only `personaById`
 * reaches into this list, because `bots.playRound` and `bots.placeBotBan` bail out on an
 * unresolvable persona — without that one fallback these bots would join a match and
 * then never guess or ban.
 */

import type { BotPersona } from "./bots";

/**
 * Marks a persona as belonging to this dev roster.
 *
 * The leaderboard and the purge both key off this prefix, so the twelve shipping
 * practice personas stay hidden and stay un-deleted.
 */
export const DEV_RANK_BOT_PREFIX = "rank_";

/**
 * THE SWITCH MOVED. It is now `settings.devFeaturesEnabled` in the database, read through
 * `devFeaturesEnabled(ctx)` in `convex/config.ts`.
 *
 * It used to be the `DEV_RANK_BOTS` deployment variable, which could only be changed with
 * `npx convex env set` from a terminal. A Convex function cannot write its own
 * environment, so an operator toggle in the admin console was impossible while it lived
 * there — and on this project's single shared deployment, setting it for local
 * development set it for the live site at the same moment.
 *
 * Nothing reads the environment variable any more. It can be removed from the deployment
 * at leisure; leaving it set does nothing.
 */

/**
 * One persona per rank, anchored mid-band.
 *
 * Mid-band rather than on the boundary because these ratings drift: every ranked
 * result moves a bot the same way it moves a player. An anchor sitting on a division
 * floor would change rank after a single loss, and the whole point of the roster is
 * that the leaderboard shows sixteen distinct ranks. Bronze divisions span 300 Elo and
 * the middle tiers only ~67, so the headroom is uneven — `dev-rank-bots.test.ts` pins
 * every anchor to its intended rank so a change to RANK_TIERS cannot silently break it.
 *
 * Category strengths are mixed rather than uniform so the ban draft has something to
 * chew on and the roster does not read as sixteen copies at different speeds.
 */
export const DEV_RANK_BOT_PERSONAS: readonly BotPersona[] = [
  {
    id: "rank_bronze_1",
    handle: "rank_bronze_1",
    displayName: "Static Radio",
    elo: 150,
    strongCategories: [],
    weakCategories: ["k-pop", "metal", "latin"],
    bio: "I know that one. The one that goes like that.",
  },
  {
    id: "rank_bronze_2",
    handle: "rank_bronze_2",
    displayName: "Hold Music",
    elo: 450,
    strongCategories: ["pop-2010s"],
    weakCategories: ["metal", "nineties"],
    bio: "Everything sounds vaguely familiar and none of it has a name.",
  },
  {
    id: "rank_bronze_3",
    handle: "rank_bronze_3",
    displayName: "Car Radio",
    elo: 750,
    strongCategories: ["pop-2020s"],
    weakCategories: ["country", "metal"],
    bio: "Whatever was on the drive to work.",
  },
  {
    id: "rank_silver_1",
    handle: "rank_silver_1",
    displayName: "Playlist Guy",
    elo: 930,
    strongCategories: ["pop-2010s"],
    weakCategories: ["latin", "k-pop"],
    bio: "Discover Weekly and nothing else.",
  },
  {
    id: "rank_silver_2",
    handle: "rank_silver_2",
    displayName: "Second Chorus",
    elo: 1000,
    strongCategories: ["rock"],
    weakCategories: ["k-pop"],
    bio: "Give me eight seconds and I am fine.",
  },
  {
    id: "rank_silver_3",
    handle: "rank_silver_3",
    displayName: "Shuffle Mode",
    elo: 1065,
    strongCategories: ["hip-hop"],
    weakCategories: ["country"],
    bio: "No taste, wide net.",
  },
  {
    id: "rank_gold_1",
    handle: "rank_gold_1",
    displayName: "Aux Holder",
    elo: 1130,
    strongCategories: ["pop-2020s", "hip-hop"],
    weakCategories: ["nineties"],
    bio: "Nobody has taken the cable off me yet.",
  },
  {
    id: "rank_gold_2",
    handle: "rank_gold_2",
    displayName: "Track Eleven",
    elo: 1200,
    strongCategories: ["rock", "nineties"],
    weakCategories: ["latin"],
    bio: "The deep cut is the whole point.",
  },
  {
    id: "rank_gold_3",
    handle: "rank_gold_3",
    displayName: "Bandcamp",
    elo: 1265,
    strongCategories: ["metal", "rock"],
    weakCategories: ["pop-2020s"],
    bio: "You have not heard of them and that is fine.",
  },
  {
    id: "rank_plat_1",
    handle: "rank_plat_1",
    displayName: "Setlist",
    elo: 1330,
    strongCategories: ["latin", "pop-2010s"],
    weakCategories: ["metal"],
    bio: "Forty shows a year. It adds up.",
  },
  {
    id: "rank_plat_2",
    handle: "rank_plat_2",
    displayName: "Liner Notes",
    elo: 1400,
    strongCategories: ["nineties", "country"],
    weakCategories: ["k-pop"],
    bio: "I read the credits before I heard the record.",
  },
  {
    id: "rank_plat_3",
    handle: "rank_plat_3",
    displayName: "Night Shift",
    elo: 1465,
    strongCategories: ["k-pop", "pop-2020s"],
    weakCategories: ["country"],
    bio: "Comeback season never ends.",
  },
  {
    id: "rank_diamond_1",
    handle: "rank_diamond_1",
    displayName: "Perfect Pitch",
    elo: 1540,
    strongCategories: ["hip-hop", "pop-2010s"],
    weakCategories: ["metal"],
    bio: "Two bars is plenty. One is usually plenty.",
  },
  {
    id: "rank_diamond_2",
    handle: "rank_diamond_2",
    displayName: "The Archivist",
    elo: 1625,
    strongCategories: ["nineties", "rock", "metal"],
    weakCategories: [],
    bio: "Catalogued, cross-referenced, filed.",
  },
  {
    id: "rank_diamond_3",
    handle: "rank_diamond_3",
    displayName: "Absolute Ear",
    elo: 1710,
    strongCategories: ["pop-2010s", "pop-2020s", "latin"],
    weakCategories: ["country"],
    bio: "I named it before the drums came in.",
  },
  {
    id: "rank_legend",
    handle: "rank_legend",
    displayName: "The Standard",
    elo: 1850,
    strongCategories: [],
    weakCategories: [],
    bio: "One second is one second too many.",
  },
] as const;

/**
 * How long a player searches before a dev bot is allowed to answer.
 *
 * Without it these bots are indistinguishable from a rigged demo: they sit in the queue
 * permanently, so the very first `tryMatchmake` poll pairs and the search screen is gone
 * about two seconds after it appears — long enough to see that something happened, not
 * long enough to read a word of it. Every state that only exists while searching (the
 * widening rating band, the queue count, the Play button reporting from another route)
 * was unreachable in practice.
 *
 * A queued human still matches on the first poll: this holds back the BOTS only, which is
 * also the honest ordering — a real opponent should always win over a synthetic one.
 */
export const DEV_BOT_MIN_WAIT_MS = 20_000;

/** True if a persona id belongs to this roster rather than the shipping practice cast. */
export function isDevRankBotPersona(personaId: string | undefined): boolean {
  return personaId !== undefined && personaId.startsWith(DEV_RANK_BOT_PREFIX);
}
