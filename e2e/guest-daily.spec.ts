import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, guessLikeAHuman, loadDailyAnswers } from "./helpers";

/**
 * A complete daily run, signed out.
 *
 * This is the flow that was reported broken, and it is regression-tested here rather
 * than anywhere else for a practical reason: the daily allows one run per identity per
 * day, and guest identity is a token in localStorage — so a fresh browser context is a
 * fresh player. That makes this the only daily coverage that can run twice in the same
 * day, which is exactly what a test suite does.
 *
 * What it guards: the daily used to render the duel's components, so a solo player got a
 * health bar, "THE SONG WINS — neither of you got it" after every missed round, a DRAW
 * verdict at 0 HP against nobody, and then no way out, because the arena hides the app
 * navigation and nothing gave it back.
 *
 * Note on selectors: the app writes apostrophes as `&rsquo;` (’), not ASCII `'`. Every
 * name here is a regex with `.` in that position — an exact string silently never
 * matches, which cost a cycle to discover.
 */

/** Copy that belongs to the two-player duel and must never appear in a solo run. */
const DUEL_COPY = [
  "Neither of you",
  "THE SONG WINS",
  "ROUND WON",
  "ROUND LOST",
  "DEAD HEAT",
  "VICTORY",
  "DEFEAT",
  "DRAW",
  "Round timeline",
  "Costliest round",
  "Fastest call",
  "Surrender",
];

async function expectNoDuelCopy(page: Page, where: string) {
  const body = await page.locator("body").innerText();
  for (const phrase of DUEL_COPY) {
    expect(body, `"${phrase}" leaked into the solo daily on ${where}`).not.toContain(phrase);
  }
  expect(body, `an HP readout leaked into the solo daily on ${where}`).not.toMatch(/\bHP\b/);
}

/** The run header. Says "Song N of 5" — as does the countdown, hence `.first()`. */
const songHeader = (page: Page, n: number) => page.getByText(`Song ${n} of 5`).first();

/** Only the reveal stage renders the track title as a level-2 heading. */
const revealTitle = (page: Page) => page.getByRole("heading", { level: 2 });

const passButton = (page: Page) =>
  page.getByRole("button", { name: /I don.t know this one/ });

async function passRound(page: Page) {
  const pass = passButton(page);
  await expect(pass).toBeEnabled({ timeout: 45_000 });
  await pass.click();
}

test("a guest can play the daily start to finish and leave", async ({ page }) => {
  const answers = await loadDailyAnswers();

  await page.goto("/daily");
  await expect(page.getByRole("heading", { name: /Today.s challenge/ })).toBeVisible();
  await expect(page.getByText(/No account needed/i)).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS, "daily-01-start.png") });

  await page.getByRole("button", { name: "Start" }).click();

  // ---------------------------------------------------------------- song 1
  await expect(songHeader(page, 1)).toBeVisible({ timeout: 30_000 });
  await expectNoDuelCopy(page, "the first song");

  const guess = page.getByRole("combobox", { name: "Your guess" });
  await expect(guess).toBeEnabled({ timeout: 45_000 });
  await page.screenshot({ path: path.join(SCREENSHOTS, "daily-02-guessing.png") });

  // A deliberate miss first: the wrong-guess path has its own feedback and a lockout,
  // and passing exercises neither.
  await guessLikeAHuman(page, "definitely not the song");
  await expect(page.getByText("Not it")).toBeVisible({ timeout: 15_000 });

  // Then the real answer, when the fixture could be captured — the only way to see the
  // solved rendering at all: the tier chip, the points, the solved reveal.
  let solved = false;
  if (answers?.titles[0]) {
    // The wrong guess costs a lockout, exactly as it would for a player.
    await guessLikeAHuman(page, answers.titles[0]);

    /**
     * The solved signal is the header's counter, not the "Waiting for the round to
     * end…" text the duel shows.
     *
     * In a solo run there is nobody left to wait for: `applyGuess` calls
     * `endGuessingEarly`, every player has solved, and the round closes on the spot.
     * That copy is therefore unreachable here — watching for it timed out and made a
     * correct 100-point SNAP look like a miss.
     */
    solved = await page
      .getByText("1/5 named")
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
  }

  if (!solved) await passRound(page);

  // ------------------------------------------------------------- the reveal
  // The daily's own beat. Asserted on the track title, because the run header still
  // says "Song 1 of 5" here — waiting on that would pass without a reveal existing.
  await expect(revealTitle(page)).toBeVisible({ timeout: 60_000 });
  await page.screenshot({
    path: path.join(SCREENSHOTS, solved ? "daily-03-reveal-solved.png" : "daily-04-reveal-missed.png"),
  });
  await expectNoDuelCopy(page, "the reveal");

  /**
   * Branch on what the reveal actually says, read in one pass.
   *
   * The reveal is a ~6s window, so a second `expect` with its own timeout would spend
   * that budget after the stage had already moved on and report a failure about the
   * wrong screen entirely.
   */
  const revealText = await page.locator("body").innerText();
  if (solved) {
    // Stated as an achievement: tier, time, points.
    expect(revealText).not.toMatch(/You didn.t get this one/);
    expect(revealText).toMatch(/\d+\.\d{2}s/);
  } else {
    // Stated in the second person — there is nobody else in the run.
    expect(revealText).toMatch(/You didn.t get this one/);
  }

  // -------------------------------------------------------- songs 2 through 5
  for (const song of [2, 3, 4, 5]) {
    await expect(songHeader(page, song)).toBeVisible({ timeout: 60_000 });
    await passRound(page);
  }

  // ------------------------------------------------------------ the result
  await expect(page.getByText(/Rank \d+ of \d+ today/)).toBeVisible({ timeout: 90_000 });
  await expectNoDuelCopy(page, "the result screen");

  for (const song of [1, 2, 3, 4, 5]) {
    await expect(page.getByText(`Song ${song}`, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Copy result" })).toBeVisible();

  // The signed-out conversion moment — a guest keeps the score by signing in.
  await expect(page.getByText(/You.re not on the board yet/)).toBeVisible();

  await page.screenshot({
    path: path.join(SCREENSHOTS, "daily-05-result.png"),
    fullPage: true,
  });

  /**
   * The dead end, specifically.
   *
   * The run hides the app chrome and previously nothing gave it back — the daily ended
   * on a screen with no navigation at all.
   */
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Play ranked/ })).toBeVisible();

  await page.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/localhost:3000\/$/);

  // The navigation is genuinely restored, not merely routed away from.
  await expect(page.locator("aside").getByRole("link", { name: "Daily" })).toBeVisible();
});

test("reloading mid-run resumes the same run rather than restarting it", async ({ page }) => {
  // One run per day is what makes the score comparable, so a reload must never hand out
  // a fresh attempt at songs already heard.
  await page.goto("/daily");
  await page.getByRole("button", { name: "Start" }).click();

  await expect(songHeader(page, 1)).toBeVisible({ timeout: 30_000 });
  await passRound(page);
  await expect(songHeader(page, 2)).toBeVisible({ timeout: 60_000 });

  await page.reload();

  /**
   * Straight back into the run, with nothing to click.
   *
   * `daily.start` had always resumed rather than restarted, but the client held its
   * match id in component state — so a refresh dropped the player onto the landing
   * screen looking at a "Start" button while their run sat live on the server.
   * `daily.activeRun` is what asks for the resume that already existed.
   */
  await expect(songHeader(page, 2)).toBeVisible({ timeout: 30_000 });

  // Song 2, not song 1: the same run continued, not a second attempt at songs already
  // heard — which is what makes the one-run-per-day score comparable at all.
  await expect(songHeader(page, 1)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
});
