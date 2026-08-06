import { describe, expect, it } from "vitest";
import {
  checkGuess as checkGuessWith,
  damerauLevenshtein,
  distanceThresholdFor as distanceThresholdForWith,
} from "./match";
import { mergeConfig } from "./config-merge";
import { normalizeTitle } from "./normalize";

/**
 * These tests exercise the SHIPPED defaults.
 *
 * Each engine function now takes its config as a parameter, so rather than threading it
 * through every call the module-level bindings below curry it in once. The tests then read
 * as tests of behaviour rather than of plumbing, and a test that wants different values
 * can still call the underlying function directly with its own config.
 */
const config = mergeConfig();

const distanceThresholdFor = (length: number) => distanceThresholdForWith(length, config);
const checkGuess = (
  rawGuess: string,
  target: Parameters<typeof checkGuessWith>[1],
) => checkGuessWith(rawGuess, target, config);


const target = (title: string, ...aliases: string[]) => ({
  titleNormalized: normalizeTitle(title),
  aliasesNormalized: aliases.map(normalizeTitle),
});

describe("damerauLevenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(damerauLevenshtein("levitating", "levitating")).toBe(0);
  });

  it("counts single-character edits", () => {
    expect(damerauLevenshtein("cat", "cot")).toBe(1); // substitution
    expect(damerauLevenshtein("cat", "cats")).toBe(1); // insertion
    expect(damerauLevenshtein("cats", "cat")).toBe(1); // deletion
  });

  it("treats an adjacent transposition as a single edit", () => {
    // The whole point of Damerau over plain Levenshtein: fast typists swap letters.
    expect(damerauLevenshtein("blidning", "blinding")).toBe(1);
    expect(damerauLevenshtein("teh", "the")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(damerauLevenshtein("", "abc")).toBe(3);
    expect(damerauLevenshtein("abc", "")).toBe(3);
    expect(damerauLevenshtein("", "")).toBe(0);
  });

  it("bails out early once the budget is blown", () => {
    const result = damerauLevenshtein("completely different", "nothing alike", 2);
    expect(result).toBeGreaterThan(2);
  });

  it("still returns exact distances within the budget", () => {
    expect(damerauLevenshtein("levitating", "levitatng", 3)).toBe(1);
  });
});

describe("distanceThresholdFor", () => {
  it("demands an exact match for very short titles", () => {
    // Otherwise "Yes" would accept "Yep".
    expect(distanceThresholdFor(3)).toBe(0);
    expect(distanceThresholdFor(4)).toBe(0);
  });

  it("scales the budget with title length", () => {
    expect(distanceThresholdFor(5)).toBe(1);
    expect(distanceThresholdFor(15)).toBe(1);
    expect(distanceThresholdFor(16)).toBe(2);
    expect(distanceThresholdFor(32)).toBe(4);
  });
});

describe("checkGuess", () => {
  it("accepts an exact title", () => {
    const result = checkGuess("Blinding Lights", target("Blinding Lights"));
    expect(result.correct).toBe(true);
    expect(result.reason).toBe("exact");
  });

  it("accepts regardless of case, spacing and punctuation", () => {
    expect(checkGuess("  blinding   LIGHTS ", target("Blinding Lights")).correct).toBe(true);
    expect(checkGuess("dont start now", target("Don't Start Now")).correct).toBe(true);
  });

  it("accepts the base title when the track is a remix", () => {
    expect(checkGuess("Blinding Lights", target("Blinding Lights (Remix)")).correct).toBe(true);
  });

  it("accepts a typo within budget", () => {
    const result = checkGuess("blidning lights", target("Blinding Lights"));
    expect(result.correct).toBe(true);
    expect(result.reason).toBe("fuzzy");
    expect(result.distance).toBe(1);
  });

  it("accepts via an alias", () => {
    const result = checkGuess("bohemian", target("Bohemian Rhapsody", "Bohemian"));
    expect(result.correct).toBe(true);
    expect(result.reason).toBe("alias");
  });

  it("rejects a different song", () => {
    const result = checkGuess("Levitating", target("Blinding Lights"));
    expect(result.correct).toBe(false);
    expect(result.reason).toBe("no-match");
  });

  it("rejects guesses that are too short to be meaningful", () => {
    const result = checkGuess("a", target("Blinding Lights"));
    expect(result.correct).toBe(false);
    expect(result.reason).toBe("too-short");
  });

  it("rejects an empty or whitespace-only guess", () => {
    expect(checkGuess("", target("Blinding Lights")).correct).toBe(false);
    expect(checkGuess("   ", target("Blinding Lights")).correct).toBe(false);
  });

  it("does not accept a near-miss between two genuinely different short songs", () => {
    // "Hey" vs "Hey!" normalize identically, but "Yes" must not match "Yet".
    expect(checkGuess("Yet", target("Yes")).correct).toBe(false);
  });

  it("does not let a one-word guess satisfy a long title", () => {
    expect(checkGuess("lights", target("Blinding Lights")).correct).toBe(false);
  });
});
