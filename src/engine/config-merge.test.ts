import { describe, expect, it } from "vitest";
import { DAILY_SONGS, DUEL_STARTING_HP, ROUND_DURATION_MS, XP_AWARDS } from "./config";
import { DEFAULT_CONFIG, mergeConfig } from "./config-merge";

describe("mergeConfig", () => {
  it("returns the shipped defaults when there is nothing stored", () => {
    for (const overrides of [undefined, null, {}]) {
      const config = mergeConfig(overrides);
      expect(config.DUEL_STARTING_HP).toBe(DUEL_STARTING_HP);
      expect(config.DAILY_SONGS).toBe(DAILY_SONGS);
      expect(config.XP_AWARDS.rankedWin).toBe(XP_AWARDS.rankedWin);
    }
  });

  it("applies a top-level override and leaves everything else alone", () => {
    const config = mergeConfig({ DUEL_STARTING_HP: 250 });
    expect(config.DUEL_STARTING_HP).toBe(250);
    expect(config.ROOM_STARTING_HP).toBe(DEFAULT_CONFIG.ROOM_STARTING_HP);
  });

  it("applies a nested override by dotted path", () => {
    const config = mergeConfig({ "XP_AWARDS.rankedWin": 999 });
    expect(config.XP_AWARDS.rankedWin).toBe(999);
    expect(config.XP_AWARDS.rankedLoss).toBe(XP_AWARDS.rankedLoss);
  });

  /**
   * The reason this file exists at all. A stored override naming a constant that has
   * since been renamed must degrade to "that value is back to its default" rather than
   * throw — a config row outliving a refactor is a certainty, and the read path runs
   * inside live matches.
   */
  it("ignores unknown keys instead of throwing", () => {
    expect(() =>
      mergeConfig({ NOT_A_SETTING: 1, "XP_AWARDS.gone": 2, "NOPE.nested": 3 }),
    ).not.toThrow();
    expect(mergeConfig({ NOT_A_SETTING: 1 })).toEqual(mergeConfig({}));
  });

  it("ignores a null written over a value that cannot be null", () => {
    const config = mergeConfig({ DUEL_STARTING_HP: null });
    expect(config.DUEL_STARTING_HP).toBe(DUEL_STARTING_HP);
  });

  it("accepts null for the one nullable setting", () => {
    expect(mergeConfig({ TUTORIAL_ITUNES_TRACK_ID: 12345 }).TUTORIAL_ITUNES_TRACK_ID).toBe(
      12345,
    );
    expect(mergeConfig({ TUTORIAL_ITUNES_TRACK_ID: null }).TUTORIAL_ITUNES_TRACK_ID).toBe(
      null,
    );
  });

  it("never mutates the defaults", () => {
    mergeConfig({ DUEL_STARTING_HP: 1, "XP_AWARDS.rankedWin": 1 });
    expect(DEFAULT_CONFIG.DUEL_STARTING_HP).toBe(DUEL_STARTING_HP);
    expect(DEFAULT_CONFIG.XP_AWARDS.rankedWin).toBe(XP_AWARDS.rankedWin);
  });

  it("does not leak state between calls", () => {
    const first = mergeConfig({ "XP_AWARDS.rankedWin": 5 });
    const second = mergeConfig({});
    expect(first.XP_AWARDS.rankedWin).toBe(5);
    expect(second.XP_AWARDS.rankedWin).toBe(XP_AWARDS.rankedWin);
  });

  /**
   * `guessing` is the round clock seen from the phase machine, not a setting. If the two
   * could drift, the server would end the guessing phase at one time while the score
   * curve divided by another.
   */
  describe("the derived guessing phase", () => {
    it("tracks the round duration by default", () => {
      expect(mergeConfig({}).PHASE_DURATIONS_MS.guessing).toBe(ROUND_DURATION_MS);
    });

    it("follows an overridden round duration", () => {
      expect(mergeConfig({ ROUND_DURATION_MS: 45_000 }).PHASE_DURATIONS_MS.guessing).toBe(
        45_000,
      );
    });

    it("cannot be set independently", () => {
      const config = mergeConfig({
        ROUND_DURATION_MS: 20_000,
        "PHASE_DURATIONS_MS.guessing": 90_000,
      });
      expect(config.PHASE_DURATIONS_MS.guessing).toBe(20_000);
    });
  });
});
