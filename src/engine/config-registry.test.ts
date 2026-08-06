import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config-merge";
import {
  CONFIG_ENTRIES,
  STRUCTURED_ENTRIES,
  defaultFor,
  entryFor,
  validateOverride,
  validateOverrides,
} from "./config-registry";

/**
 * The registry is a hand-written description of another file, so the thing that will
 * actually go wrong is drift: a constant renamed in `config.ts`, or a new one added and
 * never declared here. These tests are the mechanism that catches that at `npm test`
 * rather than as a blank field in the console.
 */
describe("registry integrity", () => {
  it("every entry resolves to a real default", () => {
    for (const entry of CONFIG_ENTRIES) {
      expect(defaultFor(entry.key), `${entry.key} has no default`).not.toBeUndefined();
    }
  });

  it("every structured entry names a real member", () => {
    for (const entry of STRUCTURED_ENTRIES) {
      expect(DEFAULT_CONFIG[entry.key], `${entry.key} is missing`).toBeDefined();
    }
  });

  it("declares every value in the config", () => {
    const declared = new Set<string>();
    for (const entry of CONFIG_ENTRIES) declared.add(entry.key.split(".")[0]);
    for (const entry of STRUCTURED_ENTRIES) declared.add(entry.key);

    const undeclared = Object.keys(DEFAULT_CONFIG).filter((key) => !declared.has(key));
    expect(undeclared, "add these to CONFIG_ENTRIES or STRUCTURED_ENTRIES").toEqual([]);
  });

  it("has no duplicate keys", () => {
    const keys = CONFIG_ENTRIES.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ships every default inside its own declared bounds", () => {
    for (const entry of CONFIG_ENTRIES) {
      const value = defaultFor(entry.key);
      if (value === null) continue;
      expect(value, `${entry.key} default is out of bounds`).toBeGreaterThanOrEqual(
        entry.min,
      );
      expect(value, `${entry.key} default is out of bounds`).toBeLessThanOrEqual(entry.max);
    }
  });

  it("explains every locked field", () => {
    for (const entry of CONFIG_ENTRIES) {
      if (entry.editable) continue;
      expect(entry.lockedReason, `${entry.key} is locked with no reason`).toBeTruthy();
    }
  });

  it("keeps min below max", () => {
    for (const entry of CONFIG_ENTRIES) {
      expect(entry.min, entry.key).toBeLessThan(entry.max);
    }
  });
});

describe("validateOverride", () => {
  it("accepts a value inside bounds", () => {
    expect(validateOverride("DUEL_STARTING_HP", 500)).toBeNull();
  });

  it("rejects an unknown key", () => {
    expect(validateOverride("NOT_A_SETTING", 1)).toMatch(/unknown/i);
  });

  /**
   * The check that matters most: a mutation is reachable without ever loading the page,
   * so the server must refuse a locked field even though the form never renders one.
   */
  it("rejects a locked field", () => {
    const locked = CONFIG_ENTRIES.find((entry) => !entry.editable);
    expect(locked).toBeDefined();
    expect(validateOverride(locked!.key, locked!.min)).toMatch(/not editable/i);
  });

  it("rejects values outside bounds in both directions", () => {
    expect(validateOverride("DUEL_STARTING_HP", 0)).toMatch(/between/);
    expect(validateOverride("DUEL_STARTING_HP", 1_000_000)).toMatch(/between/);
  });

  it("accepts the exact boundaries", () => {
    const entry = entryFor("DUEL_STARTING_HP")!;
    expect(validateOverride(entry.key, entry.min)).toBeNull();
    expect(validateOverride(entry.key, entry.max)).toBeNull();
  });

  it("rejects a fraction where a whole number is required", () => {
    expect(validateOverride("MAX_DUEL_ROUNDS", 12.5)).toMatch(/whole number/);
  });

  it("allows a fraction on a float field", () => {
    expect(validateOverride("PRACTICE_XP_MULTIPLIER", 0.75)).toBeNull();
  });

  it("rejects NaN and Infinity", () => {
    expect(validateOverride("DUEL_STARTING_HP", Number.NaN)).toMatch(/must be a number/);
    expect(validateOverride("DUEL_STARTING_HP", Number.POSITIVE_INFINITY)).toMatch(
      /must be a number/,
    );
  });

  it("rejects null on a field that is not nullable", () => {
    expect(validateOverride("DUEL_STARTING_HP", null)).toMatch(/cannot be empty/);
  });

  it("reports every problem in a set, not just the first", () => {
    const problems = validateOverrides({
      DUEL_STARTING_HP: 0,
      MAX_DUEL_ROUNDS: 12.5,
      NOT_A_SETTING: 1,
    });
    expect(problems).toHaveLength(3);
  });

  it("passes a clean set", () => {
    expect(validateOverrides({ DUEL_STARTING_HP: 400, "XP_AWARDS.rankedWin": 100 })).toEqual(
      [],
    );
  });
});
