/**
 * Daily streak — consecutive days on which you played anything at all.
 *
 * Pure, and deliberately separate from the query that feeds it. The walk has three rules
 * that are each individually easy to get subtly wrong and collectively impossible to
 * debug through a database: today not being played is not yet a miss, one missed day is
 * absorbed, and a second ends the run. Keeping it here means all three are covered by
 * `streak.test.ts` rather than by playing the game on consecutive days.
 *
 * "Anything at all" includes practice against a bot. That is a product decision, not an
 * oversight: the streak is a habit counter, and a habit that only counts rated play
 * punishes the evening where someone only had ten minutes.
 */

/** Days in the row: one calendar week, Monday through Sunday. */
export const STREAK_WINDOW_DAYS = 7;

export interface StreakDay {
  /** UTC date key, `YYYY-MM-DD`. */
  date: string;
  played: boolean;
  /** Absorbed by the one free miss. Rendered as a marked gap, not as a break. */
  forgiven: boolean;
  /** Today. Still open, so an unplayed today is not a miss. */
  today: boolean;
  /** Later this week. Not a miss — it has not happened yet. */
  future: boolean;
}

export interface Streak {
  /** Days played in the current run, counting today only if today has been played. */
  current: number;
  /**
   * The caller's scan ran out before the run did, so `current` is a floor.
   *
   * Deliberately not the same thing as "the streak is long": a player who plays five
   * matches a day burns a row budget five times faster than one who plays once, so this
   * is about how much history was read, not about how good the streak is.
   */
  approximate: boolean;
  playedToday: boolean;
  /** The day the free miss covered, if it has been spent inside the current run. */
  forgivenDate: string | null;
  /** Oldest first, ending on today. Length STREAK_WINDOW_DAYS. */
  days: StreakDay[];
}

/** The UTC date key for a timestamp. Matches `todayKey` in convex/daily.ts exactly. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The key for `n` days before `key`. Pure string→string, no local timezone anywhere. */
export function shiftDay(key: string, days: number): string {
  return dayKey(Date.parse(`${key}T00:00:00.000Z`) + days * 86_400_000);
}

/**
 * Walks backwards from today over the set of days the player was active.
 *
 * `activeDays` is a set of UTC date keys — the caller builds it from whatever rows it has,
 * which is what keeps this testable without a database.
 *
 * `exhausted` says the caller's scan hit its ceiling, which only affects `longest`:
 * `current` is measured from today backwards and stops at the first real gap, so it is
 * never truncated unless the streak is longer than the entire scan window.
 */
export function computeStreak(
  activeDays: ReadonlySet<string>,
  nowMs: number,
  exhausted = false,
): Streak {
  const today = dayKey(nowMs);
  const playedToday = activeDays.has(today);

  let current = 0;
  let forgivenDate: string | null = null;

  /**
   * A gap we have stepped over but not yet paid for.
   *
   * The free miss is only spent on a gap the run actually BRIDGES. Committing it the
   * moment a gap is seen spends it on the day the run ends — every streak would report a
   * forgiven day sitting just past its own beginning, and the row would draw a marked gap
   * on a day that was simply before the player started.
   */
  let pendingGap: string | null = null;

  for (let offset = 0; ; offset--) {
    const date = shiftDay(today, offset);

    if (activeDays.has(date)) {
      // A played day on the far side of the gap is what turns it into forgiveness.
      if (pendingGap !== null) {
        forgivenDate = pendingGap;
        pendingGap = null;
      }
      current++;
      continue;
    }

    // Today is not over. An unplayed today leaves the streak standing at yesterday's
    // count rather than spending the free miss on a day that can still be saved.
    if (date === today) continue;

    // One gap may be held open at a time, and only if none has been paid for yet.
    if (forgivenDate === null && pendingGap === null) {
      pendingGap = date;
      continue;
    }

    break;
  }

  return {
    current,
    approximate: exhausted,
    playedToday,
    forgivenDate,
    days: windowFor(today, activeDays, forgivenDate),
  };
}

/**
 * The Monday of the week containing `key`, in UTC.
 *
 * `getUTCDay` counts from Sunday; `(day + 6) % 7` re-bases it so Monday is 0 and Sunday
 * is 6, which is the week the row is drawn as.
 */
export function weekStart(key: string): string {
  const day = new Date(`${key}T00:00:00.000Z`).getUTCDay();
  return shiftDay(key, -((day + 6) % 7));
}

/**
 * This week, Monday through Sunday.
 *
 * A fixed calendar week rather than the last seven days. A rolling window ending on today
 * puts a different weekday under each column every day — the letters rotate, and a row
 * that reads M T W T F S S on Sunday reads T W T F S S M on Monday. Nobody can find
 * "yesterday" in that. Pinning it to the week means each column is always the same day,
 * and the days still to come render as empty rather than as failures.
 */
function windowFor(
  today: string,
  activeDays: ReadonlySet<string>,
  forgivenDate: string | null,
): StreakDay[] {
  const monday = weekStart(today);
  const days: StreakDay[] = [];

  for (let offset = 0; offset < STREAK_WINDOW_DAYS; offset++) {
    const date = shiftDay(monday, offset);
    days.push({
      date,
      played: activeDays.has(date),
      forgiven: date === forgivenDate,
      today: date === today,
      // ISO date keys sort chronologically as strings, so this needs no parsing.
      future: date > today,
    });
  }

  return days;
}
