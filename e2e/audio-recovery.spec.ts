import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  SCREENSHOTS,
  assertOnboarded,
  enableResolveBar,
  guessLikeAHuman,
} from "./helpers";

/**
 * The round has to survive its audio being blocked.
 *
 * This pins the bug two players hit in a real ranked match: on mobile the automatic
 * `play()` is rejected by the autoplay policy, the "Allow sound" card appears, and
 * pressing it did nothing that could start playback — the retry guarded its replay on a
 * clock that only playback itself could have started. The error card then vanished when
 * `canplay` fired, leaving a live guess field above a countdown frozen at 30.0 and every
 * submission refused by the server's timing check. There was no way out but a reload.
 *
 * Driven against PRACTICE, deliberately:
 *  - not the daily, which allows one run per identity per day. Spending it here would
 *    strand `new-player.spec.ts` and produce the failure that looks like a regression and
 *    is not.
 *  - not ranked, where the dev bot roster is a finite seeded pool that
 *    `dev-rank-bots.spec.ts` already draws from; a third consumer makes both flaky.
 * Practice is unlimited, unrated, and runs the identical RoundRunner → useRoundAudio →
 * useRoundLifecycle path, so it is the right instrument for a client-side audio bug.
 *
 * One test rather than two, and one match rather than two. The recovery and the ordinary
 * path are both asserted here because the second round of the same match IS the ordinary
 * path — only the first `play()` is blocked — and because ending a practice match early
 * is not reliably possible (see `endPracticeMatch`).
 */

/**
 * Rejects the first `count` `play()` calls on the page, exactly as a mobile autoplay
 * policy does, then behaves normally.
 *
 * Injected rather than configured through Chromium flags: the project sets
 * `--autoplay-policy=no-user-gesture-required` globally (without it no round is playable
 * at all), and overriding that per-test would need a whole separate project. Patching the
 * prototype reproduces the real failure — a rejected promise with `NotAllowedError` —
 * rather than an approximation of it, and does so deterministically.
 *
 * Counted across the whole page, NOT per element, so exactly one round is affected and
 * every round after it is a genuine happy path.
 */
async function blockAutoplay(page: Page, count: number): Promise<void> {
  await page.addInitScript((remaining: number) => {
    const original = HTMLMediaElement.prototype.play;
    let used = 0;

    HTMLMediaElement.prototype.play = function patched(this: HTMLMediaElement) {
      if (used < remaining) {
        used += 1;
        return Promise.reject(
          new DOMException("play() failed because the user didn't interact", "NotAllowedError"),
        );
      }
      return original.call(this);
    };
  }, count);
}

/** The big round clock, as a number. Null while it is not on screen. */
async function secondsLeft(page: Page): Promise<number | null> {
  const clock = page.getByTestId("round-seconds");
  if ((await clock.count()) === 0) return null;
  const text = await clock.innerText();
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Asserts the clock is actually advancing, and returns where it started. */
async function expectClockRunning(page: Page): Promise<number> {
  const first = await secondsLeft(page);
  expect(first).not.toBeNull();

  await page.waitForTimeout(1_500);
  const second = await secondsLeft(page);
  expect(second).not.toBeNull();
  expect(second!).toBeLessThan(first!);

  return first!;
}

/**
 * Ends whatever is on the practice route, so the next spec starts from the lobby.
 *
 * Longer than it looks like it should be, and the reason is a real gap rather than test
 * awkwardness: `LeaveMatch` only resigns from `SURRENDER_FROM_ROUND` onward, and
 * `sweepForfeits` ignores anything that is not `mode: "ranked"` — so a practice match left
 * before round three stays `active` indefinitely. `ranked.activeMatch` counts practice, so
 * that corpse re-routes /ranked into itself and would break `dev-rank-bots.spec.ts`.
 *
 * Tries the cheapest exit first and degrades: resolve bar, then resignation, then giving
 * up rounds until the resignation is accepted.
 */
/** Guards the one-shot dialog capture in `endPracticeMatch`. */
let leaveDialogCaptured = false;

async function endPracticeMatch(page: Page): Promise<void> {
  const lobby = page.getByRole("button", { name: "Play a bot" });
  const backToLobby = page.getByRole("button", { name: "Back to lobby" });
  const exit = page.getByRole("button", { name: "Leave this match?" });
  const pass = page.getByRole("button", { name: "I don't know this one" });
  const resolve = page.getByRole("button", { name: "Random", exact: true });

  for (let attempt = 0; attempt < 8; attempt++) {
    /**
     * Re-anchored every pass rather than assuming where the last action left us. Ending a
     * match navigates onward — "Back to lobby" goes to the ranked home — and from there
     * none of the locators below exist, so a loop that stayed put would spin out its
     * budget on a match that is already finished.
     */
    await page.goto("/practice");
    await expect(lobby.or(exit).or(backToLobby).first()).toBeVisible({ timeout: 45_000 });

    if (await lobby.isVisible().catch(() => false)) return;

    if (await backToLobby.isVisible().catch(() => false)) {
      await backToLobby.click();
      continue;
    }

    // Ends the match through the real finish path, so nothing is left half-settled.
    if (await resolve.isVisible().catch(() => false)) {
      await resolve.click();
      await page.waitForTimeout(2_000);
      continue;
    }

    if (await exit.isVisible().catch(() => false)) {
      await exit.click();

      /**
       * Photograph the confirm on the way past, once.
       *
       * `LeaveMatch` writes different consequence copy per mode and is the only dialog in
       * the app that also intercepts the browser Back button, but it is unreachable from
       * /design and appears in no other screenshot. Teardown already has it open, so this
       * costs nothing — no extra match, no extra round. Best-effort by design: a failed
       * screenshot must never break the cleanup it is riding along with.
       */
      if (!leaveDialogCaptured) {
        leaveDialogCaptured = true;
        await page
          .screenshot({ path: path.join(SCREENSHOTS, "modal-leave-match-practice.png") })
          .catch(() => {});
      }

      const confirm = page.getByRole("button", { name: "Leave match", exact: true });
      await expect(confirm).toBeEnabled({ timeout: 15_000 });
      await confirm.click();

      // Accepted resignations end the match; refused ones leave us exactly where we were.
      const settled = await lobby
        .or(backToLobby)
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (settled) continue;

      await page.getByRole("button", { name: "Keep playing" }).click().catch(() => {});
    }

    // Not far enough in to resign. Give up the round to get there faster.
    if (await pass.isEnabled().catch(() => false)) await pass.click();
    // Long enough for the reveal and standings beats to carry us into the next round.
    await page.waitForTimeout(4_000);
  }
}

/** Practice lobby → live round. */
async function startPracticeRound(page: Page): Promise<void> {
  await page.goto("/practice");
  await assertOnboarded(page);

  const lobby = page.getByRole("button", { name: "Play a bot" });
  const exit = page.getByRole("button", { name: "Leave this match?" });

  /**
   * The route renders either the lobby or a match already in progress, and decides which
   * only after its first data round trip — so both are waited for together rather than
   * probing for one and finding neither.
   */
  await expect(lobby.or(exit).first()).toBeVisible({ timeout: 60_000 });
  if (!(await lobby.isVisible().catch(() => false))) await endPracticeMatch(page);

  await expect(lobby).toBeVisible({ timeout: 30_000 });
  await lobby.click();

  // The VS reveal. A bot counts as ready on its own, so one press opens the draft.
  const ready = page.getByRole("button", { name: /I'm ready/ });
  await expect(ready).toBeVisible({ timeout: 30_000 });
  await ready.click();

  /**
   * The ban draft. Two bans each, alternating with the bot.
   *
   * The buttons are named by category, so they are reached through the labelled group
   * rather than by name. Every button is disabled while the bot is thinking, so "an
   * enabled one exists" is exactly the signal that the turn has come round.
   */
  const pool = page.getByRole("group", { name: "Category pool" });
  for (let placed = 0; placed < 2; placed++) {
    const available = pool.locator("button:not([disabled])").first();
    await expect(available).toBeVisible({ timeout: 30_000 });
    await available.click();
    // Let the click commit before looking for the next turn, or the same still-enabled
    // button is found again and the second ban lands against a stale pool.
    await page.waitForTimeout(1_000);
  }

  /**
   * Wait for the round to open before returning.
   *
   * The bot's last ban, the veto reveal and the countdown all sit between the final click
   * above and any round UI, so reading the clock straight after the draft reads nothing.
   * Either outcome counts as open: a running clock, or the blocked-audio card.
   */
  await expect(
    page
      .getByTestId("round-seconds")
      .or(page.getByText("Your browser blocked audio playback"))
      .first(),
  ).toBeVisible({ timeout: 90_000 });
}

test.describe("blocked audio", () => {
  /**
   * Runs however the test finished, and swallows its own failures.
   *
   * A practice match left open re-routes /ranked into it, so this is what stops one
   * failure here cascading into unrelated specs.
   */
  test.afterEach(async ({ page }) => {
    // Its own budget. A hook shares the test's timeout by default, so a teardown that has
    // to play rounds out would be reported as the test failing after it had already passed.
    test.setTimeout(180_000);
    await endPracticeMatch(page).catch(() => {});
  });

  test("recovers through Allow sound, and the round after it is normal", async ({ page }) => {
    // The draft alone is a 15s-per-turn clock, and this deliberately spends ~6s of a round
    // proving the anchor floor holds, then waits out a full round to check the next one.
    test.setTimeout(240_000);

    /**
     * Exactly one rejection, which is the real policy's shape: the automatic, non-gesture
     * `play()` is refused and the gesture-carried retry is allowed. Blocking more would
     * refuse the retry too and test something that cannot happen.
     */
    await enableResolveBar(page);
    await blockAutoplay(page, 1);
    await startPracticeRound(page);

    // 1. The failure surfaces rather than hiding.
    const blocked = page.getByText("Your browser blocked audio playback");
    await expect(blocked).toBeVisible({ timeout: 60_000 });
    await page.screenshot({
      path: path.join(SCREENSHOTS, "duel-audio-blocked.png"),
      fullPage: true,
    });

    /**
     * 2. Sit in the failure before recovering.
     *
     * This is what tests the anti-cheat floor. The score clock is anchored to real
     * playback onset, so without a ceiling on how late that anchor may be, recovering
     * after a long stall would hand back a full fresh thirty seconds — and anyone able to
     * make `play()` fail on demand could hear the song first, then start scoring.
     */
    await page.waitForTimeout(6_000);

    const allow = page.getByRole("button", { name: "Allow sound" });
    await expect(allow).toBeVisible();
    await allow.click();

    // 3. The error clears and the round is genuinely playing.
    await expect(blocked).toBeHidden({ timeout: 30_000 });

    /**
     * Wait for playback to have actually begun before reading the clock.
     *
     * `retry()` clears the error synchronously, so the card unmounts a beat BEFORE the
     * element's `playing` event fires and anchors the clock. Sampling in that gap reads a
     * `displayMs` of zero — a clock showing 30.0 that is about to jump — which looks
     * exactly like the frozen-clock bug and made this test flake against working code.
     *
     * "Replay 1s" is the honest signal: it renders only while `audio.phase === "playing"`,
     * which is set in the same handler that anchors the clock.
     */
    await expect(page.getByRole("button", { name: /^Replay/ })).toBeVisible({
      timeout: 30_000,
    });

    // 4. The clock is MOVING. The direct regression test: in the bug it sat at 30.0 forever.
    const recovered = await expectClockRunning(page);

    // 5. The stall was charged, not refunded. A retry that reset the anchor would read
    //    ~30 here rather than the several seconds shorter clock a real failure costs.
    expect(recovered).toBeLessThan(27);

    /**
     * 6. The guess path is alive end to end, without the test needing to know any title.
     *
     * `validateClientClock` runs before the answer is even compared, so with a broken
     * clock even a deliberately wrong guess comes back as a timing rejection. "Not it" is
     * therefore proof that a real elapsed time reached the server.
     */
    await guessLikeAHuman(page, "definitely not the right song title");
    await expect(page.getByText("Not it")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Rejected by the timing check")).toBeHidden();

    await page.screenshot({
      path: path.join(SCREENSHOTS, "duel-audio-recovered.png"),
      fullPage: true,
    });

    /**
     * 7. The next round starts on its own, with no tap and no error.
     *
     * Only the first `play()` was blocked, so this is the ordinary path — and it is worth
     * asserting in the same match, because a recovery that quietly left the round-start
     * guard stuck would show up here as a second frozen clock.
     */
    await expect(page.getByTestId("round-seconds")).toBeVisible({ timeout: 120_000 });
    await expect(blocked).toBeHidden();
    expect(await expectClockRunning(page)).toBeGreaterThan(20);
  });
});
