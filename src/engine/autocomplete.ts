/**
 * Local song-title search for the guess box.
 *
 * This exists because autocomplete used to cost a server round-trip per keystroke, and a
 * player typing at speed outruns it — the list closed on every character and never opened.
 * The catalogue is small enough to hold in memory, so matching happens in-process and a
 * suggestion lands in the same frame as the keystroke.
 *
 * Everything here is a pure function over a prebuilt index. The budget is one animation
 * frame (16ms) for the whole render, and a linear pass over ~2k titles costs well under a
 * millisecond, so there is no trie and no n-gram map — they would not buy time that is
 * being spent, and neither structure handles the substring and fuzzy tiers anyway.
 */

import { foldForSearch, normalizeTitle } from "./normalize";
import { AUTOCOMPLETE_MIN_CHARS } from "./config";

/**
 * A catalogue prepared for searching.
 *
 * The two key arrays are computed once at build time rather than per keystroke: folding
 * 2k titles costs a few milliseconds, which is affordable once and is the entire frame
 * budget if repeated on every character.
 *
 * Entries are parallel arrays rather than an array of objects because the hot loop reads
 * one field at a time, and because `titles` can be handed straight to the UI.
 */
export interface TitleIndex {
  /** Display strings, in descending catalogue popularity. */
  readonly titles: readonly string[];
  /** `foldForSearch(title)` — article kept. */
  readonly folded: readonly string[];
  /** `folded` with a leading "the " removed, so "bones" finds "The Bones". */
  readonly bare: readonly string[];
}

const EMPTY_INDEX: TitleIndex = { titles: [], folded: [], bare: [] };

/** Default number of suggestions. More than this cannot be read in the time available. */
const DEFAULT_LIMIT = 6;

/** Scores are packed into one integer so the top-K insert compares a single number. */
const TIER_WEIGHT = 1_000_000;
const LENGTH_WEIGHT = 4_000;
/** Beyond this, longer titles stop being meaningfully worse and the term would swamp the tier. */
const LENGTH_CAP = 120;

/** Below this length a fuzzy match is more likely to mislead than to help. */
const FUZZY_MIN_QUERY = 5;

export function buildTitleIndex(titles: readonly string[]): TitleIndex {
  if (titles.length === 0) return EMPTY_INDEX;

  const folded: string[] = new Array(titles.length);
  const bare: string[] = new Array(titles.length);

  for (let i = 0; i < titles.length; i++) {
    const fold = foldForSearch(titles[i]);
    folded[i] = fold;
    // A slice, not a second normalization pass — this is the one place the article-stripped
    // key is needed and re-folding every title to get it would double the build cost.
    bare[i] = fold.startsWith("the ") ? fold.slice(4) : fold;
  }

  return { titles, folded, bare };
}

/**
 * The best `limit` titles for what the player has typed so far.
 *
 * Returns `[]` rather than everything for a query too short to be useful, and `[]` rather
 * than a guess for a query that matches nothing. In a timing race a wrong-but-plausible
 * suggestion is worse than an empty list, because the player reads it and acts on it.
 */
export function searchTitles(
  index: TitleIndex,
  raw: string,
  limit: number = DEFAULT_LIMIT,
): string[] {
  if (limit <= 0 || index.titles.length === 0) return [];
  if (raw.trim().length < AUTOCOMPLETE_MIN_CHARS) return [];

  // Fold the QUERY the same way as the titles, but never strip its article. Stripping it
  // from both sides is the bug this replaced: "the so" became "so", which then matched
  // "Sola" and "Sorry" ahead of anything actually beginning with "The So…".
  const query = foldForSearch(raw);
  if (query.length === 0) return [];

  const found = rank(index, query, limit);
  if (found.length > 0) return found;

  // Only now, having shown the player nothing, is a typo worth guessing at. This pass is
  // the expensive one and it runs exclusively on keystrokes that would otherwise be blank.
  if (query.length < FUZZY_MIN_QUERY) return [];
  return rankFuzzy(index, query, limit);
}

/**
 * Exact-matching pass, ranked by how much of the title the player has committed to.
 *
 * Tiers, best first:
 *   4  the title starts with the query               "the s"  -> The Sentinel
 *   3  the title minus its article starts with it    "bone"   -> The Bones
 *   2  a word inside the title starts with it        "the s"  -> All The Stars
 *   1  the query appears anywhere in the title
 */
function rank(index: TitleIndex, query: string, limit: number): string[] {
  const { folded, bare } = index;
  const top = new TopK(limit);

  for (let i = 0; i < folded.length; i++) {
    const fold = folded[i];

    let tier = 0;
    if (fold.startsWith(query)) {
      tier = 4;
    } else if (bare[i] !== fold && bare[i].startsWith(query)) {
      tier = 3;
    } else {
      const at = fold.indexOf(query);
      if (at === 0) tier = 4;
      else if (at > 0) tier = fold.charCodeAt(at - 1) === 32 ? 2 : 1;
    }

    if (tier === 0) continue;

    // Shorter titles first within a tier — a query is a bigger share of them, so they are
    // the likelier intent. `i` breaks remaining ties by catalogue popularity.
    top.offer(
      tier * TIER_WEIGHT - Math.min(fold.length, LENGTH_CAP) * LENGTH_WEIGHT - i,
      i,
    );
  }

  return top.take(index);
}

/**
 * Typo-tolerant pass over the head of each title.
 *
 * Compares against `folded[i].slice(0, query.length + budget)` rather than the whole title,
 * because the player is typing a prefix — measuring against the full title would score
 * every long title as maximally distant regardless of how well its opening matched.
 *
 * Plain Levenshtein, deliberately. It does not handle transpositions, so "bilnding lihgts"
 * finds nothing here — that is fine, the server's own fuzzy matcher still accepts the guess
 * when it is submitted. A cleverer distance that matched more also matched wrongly.
 */
function rankFuzzy(index: TitleIndex, query: string, limit: number): string[] {
  const budget = query.length <= 8 ? 1 : 2;
  const head = query.length + budget;
  const top = new TopK(limit);

  for (let i = 0; i < index.folded.length; i++) {
    const candidate = index.folded[i];
    // A title far shorter than the query cannot be within budget of it.
    if (candidate.length + budget < query.length) continue;

    const distance = boundedDistance(query, candidate.slice(0, head), budget);
    if (distance > budget) continue;

    // Closer first; then the same length and popularity ordering as the exact pass.
    top.offer(
      (budget - distance + 1) * TIER_WEIGHT -
        Math.min(candidate.length, LENGTH_CAP) * LENGTH_WEIGHT -
        i,
      i,
    );
  }

  return top.take(index);
}

/**
 * Levenshtein distance, abandoned as soon as it exceeds `budget`.
 *
 * Returns `budget + 1` for anything further away, which is all the caller needs to know.
 * The early exit is what keeps the fuzzy pass affordable: most titles fail within the
 * first row or two.
 */
function boundedDistance(a: string, b: string, budget: number): number {
  if (Math.abs(a.length - b.length) > budget) return budget + 1;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowMin = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }

    // Every remaining path runs through this row, so it can only get worse from here.
    if (rowMin > budget) return budget + 1;

    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length];
}

/**
 * Fixed-size max-heap-by-insertion.
 *
 * Collecting every match and sorting afterwards allocates an array the size of the
 * catalogue on keystrokes with broad matches ("a", "the"), which is the one thing in this
 * file that showed up in a profile. Keeping only the best `limit` is bounded work.
 */
class TopK {
  private readonly scores: number[];
  private readonly items: number[];
  private size = 0;

  constructor(private readonly limit: number) {
    this.scores = new Array<number>(limit);
    this.items = new Array<number>(limit);
  }

  offer(score: number, item: number): void {
    if (this.size === this.limit && score <= this.scores[this.size - 1]) return;

    let at = this.size < this.limit ? this.size++ : this.limit - 1;
    while (at > 0 && this.scores[at - 1] < score) {
      this.scores[at] = this.scores[at - 1];
      this.items[at] = this.items[at - 1];
      at--;
    }
    this.scores[at] = score;
    this.items[at] = item;
  }

  take(index: TitleIndex): string[] {
    const out: string[] = new Array(this.size);
    for (let i = 0; i < this.size; i++) out[i] = index.titles[this.items[i]];
    return out;
  }
}

/**
 * Whether a term is worth asking the server about.
 *
 * Used only on the fallback path, before the local index has loaded. Mirrors the gate in
 * `convex/tracks.ts` so the client does not spend a round-trip on a query the server will
 * refuse — a term of pure punctuation normalizes to nothing and can never match.
 */
export function isSearchableTerm(raw: string): boolean {
  return raw.trim().length >= AUTOCOMPLETE_MIN_CHARS && normalizeTitle(raw).length > 0;
}
