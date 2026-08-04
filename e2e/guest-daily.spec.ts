import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  SCREENSHOTS,
  guessLikeAHuman,
  loadDailyAnswers,
  typeAndKeepSuggestionsOpen,
} from "./helpers";

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
  "ROUND DRAWN",
  "Level on",
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

  /**
   * Autocomplete has to keep up with someone typing at speed.
   *
   * Uses a real title so the assertion is about the timing rather than about whether
   * anything matches. Cleared afterwards so the deliberate miss below is unaffected.
   */
  if (answers?.titles[0]) {
    await typeAndKeepSuggestionsOpen(page, answers.titles[0].slice(0, 6));
    await page.screenshot({ path: path.join(SCREENSHOTS, "daily-02b-suggestions.png") });
    await guess.clear();
  }

  // The way out. The run hides the app navigation, so this control is the only exit —
  // it used to not exist at all, and the browser's back button was the whole escape plan.
  const leave = page.getByRole("button", { name: /Leave today.s run/ });
  await expect(leave).toBeVisible();

  /**
   * And it must not sit on top of the header it stands beside.
   *
   * It used to. The control positioned itself `fixed top-3 left-3`, which looked correct
   * on desktop only because the content column is centred there and left an empty gutter
   * beneath it. At phone width the column reaches the screen edge and the control landed
   * squarely on "Song 1 of 5".
   *
   * Geometry rather than a screenshot, because this is precisely the bug a visual check
   * waves through — the pixels look busy but plausible and nothing fails.
   */
  const runHeader = songHeader(page, 1);
  const leaveBox = (await leave.boundingBox())!;
  const headerBox = (await runHeader.boundingBox())!;

  const overlaps =
    leaveBox.x < headerBox.x + headerBox.width &&
    headerBox.x < leaveBox.x + leaveBox.width &&
    leaveBox.y < headerBox.y + headerBox.height &&
    headerBox.y < leaveBox.y + leaveBox.height;

  expect(overlaps, "the leave control is sitting on top of the run header").toBe(false);
  // A real touch target, not a sliver squeezed by the row it now shares.
  expect(leaveBox.height).toBeGreaterThanOrEqual(24);

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

  /**
   * The conversion moment.
   *
   * This used to be four quiet lines at the foot of the score card, below the share
   * button, where it read as a footnote on a screen that had already ended. It is its own
   * panel now — the most valuable thing on this screen is a stranger who just had a good
   * time and has something to lose.
   */
  await expect(page.getByText(/You.re not on the board yet/)).toBeVisible();

  // The score is restated rather than referred to: "this score" is abstract, "284
  // points, 12th today" is the thing they are about to throw away.
  await expect(page.getByText(/\d+ points.*\d+(st|nd|rd|th) of \d+ today/)).toBeVisible();
  await expect(page.getByText(/disappears when you clear this browser/)).toBeVisible();

  const save = page.getByRole("button", { name: "Save my score" });
  await expect(save).toBeVisible();
  await expect(
    page.getByRole("button", { name: /I already have an account/ }),
  ).toBeVisible();

  await page.screenshot({
    path: path.join(SCREENSHOTS, "daily-05-result.png"),
    fullPage: true,
  });

  // It has to actually open the account form, in place, without losing the score behind
  // a page transition — which is the entire reason this is a dialog and not a link.
  await save.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.screenshot({
    path: path.join(SCREENSHOTS, "daily-06-save-score.png"),
    fullPage: true,
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // The score survived the detour.
  await expect(page.getByText(/Rank \d+ of \d+ today/)).toBeVisible();

  /**
   * The dead end, specifically.
   *
   * The run hides the app chrome and previously nothing gave it back — the daily ended
   * on a screen with no navigation at all.
   *
   * Scoped to `main`: the sidebar now carries its own Home row, so an unscoped lookup
   * matches two links and cannot tell "the result screen offers a way out" from "the
   * shell came back". This assertion is about the former.
   */
  const resultExits = page.getByRole("main");
  await expect(resultExits.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(resultExits.getByRole("link", { name: /Play ranked/ })).toBeVisible();

  await resultExits.getByRole("link", { name: "Home" }).click();
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
