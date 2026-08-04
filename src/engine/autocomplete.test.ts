import { describe, expect, it } from "vitest";
import { buildTitleIndex, isSearchableTerm, searchTitles } from "./autocomplete";

/**
 * Ordered by popularity, as `tracks.titleIndex` returns it — several cases below depend on
 * that ordering being the tie-break, so the sequence here is not arbitrary.
 */
const TITLES = [
  "Blinding Lights",
  "Shape of You",
  "The Sound of Silence",
  "Sound & Vision",
  "Sicko Mode",
  "Sorry",
  "Sola",
  "Bones",
  "The Bones",
  "Don't Start Now",
  "Espresso",
  "Flowers",
  "Cruel Summer",
  "In da Club",
  "All The Stars",
  "The Sentinel",
  "Rosalía",
  "Somebody That I Used to Know",
  "Sonne",
  "Thunder",
];

const index = buildTitleIndex(TITLES);

describe("searchTitles", () => {
  /**
   * The regression this module exists for.
   *
   * Autocomplete used to normalize the query with `normalizeTitle`, which strips a leading
   * article — so "The S" became "s" and matched every title beginning with S, ranking the
   * one the player was obviously typing no higher than the rest.
   */
  it("ranks the title the player is actually typing first for 'The S'", () => {
    const results = searchTitles(index, "The S");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toBe("The Sentinel");
    expect(results).toContain("The Sound of Silence");
  });

  it("does not treat a typed article as though it were absent", () => {
    // "the so" must not become "so" and drag in unrelated S-titles.
    const results = searchTitles(index, "the so");
    expect(results).toContain("The Sound of Silence");
    expect(results).not.toContain("Sola");
    expect(results).not.toContain("Sorry");
    expect(results).not.toContain("Sonne");
  });

  it("finds a title through its article when the player omits it", () => {
    // The reverse direction: the article is stripped from the TITLE, never the query.
    expect(searchTitles(index, "bones")).toContain("The Bones");
  });

  it("prefers a whole-title prefix over a word-boundary prefix", () => {
    const results = searchTitles(index, "the s");
    expect(results.indexOf("The Sentinel")).toBeLessThan(results.indexOf("All The Stars"));
  });

  it("prefers a word-boundary prefix over a mid-word substring", () => {
    const results = searchTitles(index, "son", 20);
    // "Sonne" starts with it; "Somebody…" does not contain it at all; "The Sound of
    // Silence" has no "son" — so this pins the boundary rule against "Blinding Lights"
    // style mid-word noise by asserting the starts-with case leads.
    expect(results[0]).toBe("Sonne");
  });

  it("prefers shorter titles within the same tier", () => {
    const results = searchTitles(index, "bone");
    expect(results.indexOf("Bones")).toBeLessThan(results.indexOf("The Bones"));
  });

  it("matches through diacritics", () => {
    expect(searchTitles(index, "rosalia")).toContain("Rosalía");
  });

  it("matches an ampersand spelled out", () => {
    expect(searchTitles(index, "sound and")).toContain("Sound & Vision");
  });

  it("matches through an apostrophe the player omitted", () => {
    expect(searchTitles(index, "dont start")).toContain("Don't Start Now");
  });

  it("finds a mid-title word", () => {
    expect(searchTitles(index, "da club")).toContain("In da Club");
  });

  it("respects the limit", () => {
    expect(searchTitles(index, "s", 3).length).toBeLessThanOrEqual(3);
    expect(searchTitles(index, "so", 2).length).toBeLessThanOrEqual(2);
  });

  it("only ever returns titles from the index", () => {
    for (const result of searchTitles(index, "so", 20)) {
      expect(TITLES).toContain(result);
    }
  });

  describe("typo tolerance", () => {
    it("recovers from a dropped letter", () => {
      expect(searchTitles(index, "espreso")).toContain("Espresso");
    });

    it("recovers from a missing vowel", () => {
      expect(searchTitles(index, "flowrs")).toContain("Flowers");
    });

    it("recovers from a typo in a longer title", () => {
      expect(searchTitles(index, "cruel sumer")).toContain("Cruel Summer");
    });

    /**
     * The one that matters most.
     *
     * A fuzzy pass that is too generous is worse than none: in a timing race the player
     * reads whatever is on screen and acts on it, so a plausible wrong suggestion costs
     * them the round. An earlier banded implementation returned "The Door" for "the so".
     */
    it("returns nothing rather than guessing at gibberish", () => {
      expect(searchTitles(index, "xqzzz")).toEqual([]);
      expect(searchTitles(index, "zzzzzzzz")).toEqual([]);
      expect(searchTitles(index, "qqqqqqqqqqqq")).toEqual([]);
    });

    it("does not fuzzy-match a query too short to be distinctive", () => {
      // Four characters is inside edit distance 1 of far too much to be safe.
      expect(searchTitles(index, "xqzz")).toEqual([]);
    });

    it("does not fire when the exact pass already found something", () => {
      // "sound" matches exactly, so nothing distant should be dragged in alongside it.
      const results = searchTitles(index, "sound", 20);
      expect(results).toContain("The Sound of Silence");
      expect(results).toContain("Sound & Vision");
      expect(results).not.toContain("Sonne");
    });
  });

  describe("degenerate input", () => {
    it("returns nothing below the minimum length", () => {
      expect(searchTitles(index, "")).toEqual([]);
      expect(searchTitles(index, "a")).toEqual([]);
      expect(searchTitles(index, " ")).toEqual([]);
    });

    it("returns nothing for a query that folds away entirely", () => {
      expect(searchTitles(index, "!!")).toEqual([]);
      expect(searchTitles(index, "??!")).toEqual([]);
    });

    it("survives an empty index", () => {
      expect(searchTitles(buildTitleIndex([]), "anything")).toEqual([]);
    });

    it("survives a non-positive limit", () => {
      expect(searchTitles(index, "sound", 0)).toEqual([]);
    });
  });
});

describe("buildTitleIndex", () => {
  it("keeps the display titles untouched", () => {
    expect(buildTitleIndex(TITLES).titles).toEqual(TITLES);
  });

  it("produces one search key per title", () => {
    const built = buildTitleIndex(TITLES);
    expect(built.folded).toHaveLength(TITLES.length);
    expect(built.bare).toHaveLength(TITLES.length);
  });

  it("keeps the article in the folded key and drops it from the bare key", () => {
    const built = buildTitleIndex(["The Bones", "Bones"]);
    expect(built.folded[0]).toBe("the bones");
    expect(built.bare[0]).toBe("bones");
    // A title with no article has identical keys, which is how the ranker tells them apart.
    expect(built.folded[1]).toBe(built.bare[1]);
  });
});

describe("isSearchableTerm", () => {
  it("accepts a term the server can act on", () => {
    expect(isSearchableTerm("bo")).toBe(true);
    // Two raw characters is the gate, even though this normalizes to one.
    expect(isSearchableTerm("The S")).toBe(true);
  });

  it("rejects terms that would waste a round-trip", () => {
    expect(isSearchableTerm("")).toBe(false);
    expect(isSearchableTerm("a")).toBe(false);
    expect(isSearchableTerm("!!")).toBe(false);
  });
});
