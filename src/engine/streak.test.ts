import { describe, expect, it } from "vitest";
import {
  STREAK_WINDOW_DAYS,
  computeStreak,
  dayKey,
  shiftDay,
  weekStart,
} from "./streak";

/** Fixed noon UTC so nothing here can drift with the clock the suite runs at. */
const NOW = Date.parse("2026-08-03T12:00:00.000Z");
const TODAY = "2026-08-03";

/** Days ago → date key, so the tests read the way the walk does. */
const ago = (days: number) => shiftDay(TODAY, -days);
const played = (...daysAgo: number[]) => new Set(daysAgo.map(ago));

describe("dayKey / shiftDay", () => {
  it("keys on UTC, not local time", () => {
    // 23:30 on the 3rd in UTC+2 is still the 3rd in UTC. A local-time implementation
    // would report the 4th and hand out a free day.
    expect(dayKey(Date.parse("2026-08-03T23:30:00.000Z"))).toBe("2026-08-03");
    expect(dayKey(Date.parse("2026-08-04T00:00:00.000Z"))).toBe("2026-08-04");
  });

  it("crosses month and year boundaries", () => {
    expect(shiftDay("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("crosses a leap day", () => {
    expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("computeStreak", () => {
  it("is zero for a player who has never played", () => {
    const streak = computeStreak(new Set(), NOW);
    expect(streak.current).toBe(0);
    expect(streak.playedToday).toBe(false);
    // Nothing to forgive on an account with no history.
    expect(streak.forgivenDate).toBeNull();
  });

  it("does not spend the free miss on the day the run began", () => {
    // The gap before a run is where the run STARTS, not a day it survived. Marking it
    // forgiven would draw a bridged gap on every streak the moment it existed.
    const streak = computeStreak(played(0, 1, 2), NOW);
    expect(streak.current).toBe(3);
    expect(streak.forgivenDate).toBeNull();
    expect(streak.days.some((day) => day.forgiven)).toBe(false);
  });

  it("counts today when today has been played", () => {
    const streak = computeStreak(played(0, 1, 2), NOW);
    expect(streak.current).toBe(3);
    expect(streak.playedToday).toBe(true);
    expect(streak.forgivenDate).toBeNull();
  });

  it("does not break when today is still unplayed", () => {
    // The day is not over. This is the rule that stops the dashboard telling someone
    // their streak is dead every morning until they play.
    const streak = computeStreak(played(1, 2, 3), NOW);
    expect(streak.current).toBe(3);
    expect(streak.playedToday).toBe(false);
    expect(streak.forgivenDate).toBeNull();
  });

  it("absorbs one missed day and marks it", () => {
    const streak = computeStreak(played(0, 1, 3, 4), NOW);
    expect(streak.current).toBe(4);
    expect(streak.forgivenDate).toBe(ago(2));
  });

  it("ends the run on a second missed day", () => {
    // Played today and yesterday, then two clear days. The run stops at the pair — and
    // the free miss is reported unspent, because nothing was bridged: the older block is
    // a separate run, not part of this one.
    const streak = computeStreak(played(0, 1, 4, 5, 6), NOW);
    expect(streak.current).toBe(2);
    expect(streak.forgivenDate).toBeNull();
  });

  it("spends the free miss on yesterday when today is also unplayed", () => {
    const streak = computeStreak(played(2, 3), NOW);
    expect(streak.current).toBe(2);
    expect(streak.forgivenDate).toBe(ago(1));
    // One more empty day and it is over.
    expect(computeStreak(played(3, 4), NOW).current).toBe(0);
  });

  it("refills the free miss once the run has reset", () => {
    // Two clear days behind today ends the old run entirely.
    const before = computeStreak(played(3, 4, 5), NOW);
    expect(before.current).toBe(0);

    // Playing today rejoins it across a single gap: five played days, one bridged.
    const after = computeStreak(played(0, 2, 3, 4, 5), NOW);
    expect(after.current).toBe(5);
    expect(after.forgivenDate).toBe(ago(1));
  });

  it("counts played days, not the span the run covers", () => {
    // A forgiven day holds the run together without being credited as a day played —
    // the same rule Duolingo's freeze follows.
    const streak = computeStreak(played(0, 2), NOW);
    expect(streak.current).toBe(2);
    expect(streak.forgivenDate).toBe(ago(1));
  });

  it("survives a gap that spans a month boundary", () => {
    const now = Date.parse("2026-08-01T09:00:00.000Z");
    // Played 1 Aug and 30 Jul; 31 Jul missed and forgiven.
    const streak = computeStreak(new Set(["2026-08-01", "2026-07-30"]), now);
    expect(streak.current).toBe(2);
    expect(streak.forgivenDate).toBe("2026-07-31");
  });

  it("ignores runs that ended before the current one", () => {
    // A five-day run last week is history; only the run touching today counts.
    const streak = computeStreak(played(0, 1, 5, 6, 7, 8, 9), NOW);
    expect(streak.current).toBe(2);
  });

  it("marks the scan as approximate only when the caller says so", () => {
    expect(computeStreak(played(0), NOW).approximate).toBe(false);
    expect(computeStreak(played(0), NOW, true).approximate).toBe(true);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week containing the date", () => {
    // 2026-08-03 is a Monday, so it is its own week start.
    expect(weekStart("2026-08-03")).toBe("2026-08-03");
    expect(weekStart("2026-08-06")).toBe("2026-08-03"); // Thursday
    // Sunday belongs to the week that STARTED on the Monday before it, not the one after.
    expect(weekStart("2026-08-09")).toBe("2026-08-03");
    expect(weekStart("2026-08-10")).toBe("2026-08-10"); // the next Monday
  });

  it("reaches back across a month boundary", () => {
    // Wednesday 2026-09-02 belongs to the week beginning Monday 2026-08-31.
    expect(weekStart("2026-09-02")).toBe("2026-08-31");
  });
});

describe("the week row", () => {
  it("always runs Monday to Sunday, whatever day it is", () => {
    // The bug this replaced: a rolling window ending on today put a different weekday
    // under each column every day, so the letters rotated and "yesterday" moved.
    for (let offset = 0; offset < 7; offset++) {
      const now = Date.parse(`2026-08-0${3 + offset}T12:00:00.000Z`);
      const { days } = computeStreak(new Set(), now);

      expect(days).toHaveLength(STREAK_WINDOW_DAYS);
      expect(days[0].date).toBe("2026-08-03"); // Monday
      expect(days[6].date).toBe("2026-08-09"); // Sunday
      expect(new Date(`${days[0].date}T00:00:00.000Z`).getUTCDay()).toBe(1);
      expect(new Date(`${days[6].date}T00:00:00.000Z`).getUTCDay()).toBe(0);
    }
  });

  it("marks exactly one day as today", () => {
    const { days } = computeStreak(played(0), NOW);
    expect(days.filter((day) => day.today)).toHaveLength(1);
    expect(days.find((day) => day.today)?.date).toBe(TODAY);
  });

  it("flags played, forgiven and missed distinctly", () => {
    // Today is Monday, so reach back into last week for a run with a gap in it.
    const now = Date.parse("2026-08-07T12:00:00.000Z"); // Friday
    const { days } = computeStreak(
      new Set(["2026-08-07", "2026-08-06", "2026-08-04", "2026-08-03"]),
      now,
    );
    const byDate = Object.fromEntries(days.map((day) => [day.date, day]));

    expect(byDate["2026-08-07"]).toMatchObject({ played: true, forgiven: false });
    expect(byDate["2026-08-05"]).toMatchObject({ played: false, forgiven: true });
    expect(byDate["2026-08-03"]).toMatchObject({ played: true, forgiven: false });
  });

  it("marks the rest of the week as future, not as missed", () => {
    const now = Date.parse("2026-08-05T12:00:00.000Z"); // Wednesday
    const { days } = computeStreak(new Set(["2026-08-05"]), now);
    const byDate = Object.fromEntries(days.map((day) => [day.date, day]));

    // Monday and Tuesday genuinely went unplayed.
    expect(byDate["2026-08-03"].future).toBe(false);
    expect(byDate["2026-08-04"].future).toBe(false);
    // Today is not "future" — it is open.
    expect(byDate["2026-08-05"].future).toBe(false);
    // Thursday onward have not happened.
    expect(byDate["2026-08-06"].future).toBe(true);
    expect(byDate["2026-08-09"].future).toBe(true);
  });

  it("does not draw a forgiven day that falls outside this week", () => {
    // Monday, with the run reaching back through a gap in the previous week.
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    const { days, forgivenDate } = computeStreak(
      new Set(["2026-08-03", "2026-08-01"]),
      now,
    );
    expect(forgivenDate).toBe("2026-08-02"); // Sunday, last week
    expect(days.some((day) => day.forgiven)).toBe(false);
  });
});
