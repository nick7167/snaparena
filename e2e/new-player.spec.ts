import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  SCREENSHOTS,
  deleteClerkUser,
  ensureClerkUser,
  guessLikeAHuman,
  hideDevOverlay,
  loadDailyAnswers,
  purgeConvexUser,
  signInAs,
} from "./helpers";

/**
 * What a genuinely new player sees, on a genuinely new account.
 *
 * Needs a throwaway identity rather than the shared one, because both things it covers
 * can only ever happen once per account: onboarding is shown until `onboardedAt` is set,
 * and the daily allows one run per player per day. Run against the persistent user this
 * would pass once and then fail for the rest of the day.
 *
 * The account is deleted afterwards so a development instance does not accumulate one
 * user per test run.
 */

// No inherited session — this spec signs in as its own account.
test.use({ storageState: { cookies: [], origins: [] } });

const email = `snap-e2e-new-${Date.now()}+clerk_test@example.com`;
let userId: string | undefined;
/** Set once onboarding names the account, so teardown knows what to purge. */
let handle: string | undefined;

test.afterAll(async () => {
  // Both halves. Deleting the Clerk user alone leaves the Convex row and its daily run
  // behind, and the daily board has no placement filter to hide it.
  if (userId) await deleteClerkUser(userId);
  if (handle) await purgeConvexUser(handle);
});

test("a new account is onboarded, then plays its first daily", async ({ page }) => {
  // Onboarding plus five songs of server-driven pacing. The suite-wide 120s is sized
  // for a daily run alone; this spec does one on top of an account setup.
  /**
   * The longest budget in the suite, and it needs to be.
   *
   * This spec creates an account, onboards it, and plays five songs of server-paced
   * gameplay end to end. Alone that lands around 90s; sharing a Convex dev deployment with
   * the rest of a full run, it has been seen at three minutes. 240s was enough for the
   * former and not the latter, so the whole spec failed on a stopwatch rather than on
   * anything about the app.
   */
  test.setTimeout(420_000);

  userId = await ensureClerkUser(email);
  await signInAs(page, email);

  await page.goto("/");
  await hideDevOverlay(page);

  // ------------------------------------------------------------- onboarding
  const dialog = page.getByRole("dialog", { name: "Pick your username" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });

  // The username is the whole point of the gate — it is what appears on every board,
  // and onboarding says so.
  await expect(dialog.getByText(/how you.ll appear on leaderboards/i)).toBeVisible();

  // Must start with `e2e` — the purge mutation refuses any handle outside that prefix.
  handle = `e2e${Date.now().toString().slice(-8)}`;
  await dialog.getByLabel("Username").fill(handle);

  // Optional flourishes, filled to prove they are reachable and do not block.
  await dialog.getByRole("button", { name: /Avatar colour/ }).first().click();
  await dialog.getByLabel("Tagline").fill("Here for the country deep cuts");

  await page.screenshot({ path: path.join(SCREENSHOTS, "new-01-onboarding.png") });

  const start = dialog.getByRole("button", { name: "Start playing" });
  // Availability is checked live; wait for that round trip rather than clicking a
  // disabled control.
  await expect(start).toBeEnabled({ timeout: 20_000 });
  await start.click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  /**
   * The chosen handle is now the identity everywhere.
   *
   * On the dashboard that means the player banner, which carries the handle beside the
   * rank it belongs to. This used to assert a "Welcome back, @handle" heading; the
   * greeting was folded into the banner when the dashboard was rebuilt, so the heading is
   * the rank now — "Unranked" for an account this new — and the handle sits under it.
   * Scoped to `main` because the sidebar's account menu also shows it, and that is
   * asserted separately on the next line.
   */
  await expect(page.getByRole("heading", { name: "Unranked" })).toBeVisible();
  await expect(page.locator("main")).toContainText(`@${handle}`);
  await expect(
    page.locator("aside").getByRole("button", { name: "Account menu" }),
  ).toContainText(`@${handle}`);

  // A brand-new account is level 1 with an empty bar — the state the old sidebar hid
  // entirely until placements were done.
  await expect(page.locator("aside").getByText("LVL 1")).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS, "new-02-first-sidebar.png") });

  // ------------------------------------------------------- first daily, signed in
  const answers = await loadDailyAnswers();

  await page.goto("/daily");
  await hideDevOverlay(page);
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.getByText("Song 1 of 5").first()).toBeVisible({ timeout: 30_000 });

  for (let song = 1; song <= 5; song++) {
    await expect(page.getByText(`Song ${song} of 5`).first()).toBeVisible({
      timeout: 60_000,
    });

    const answer = answers?.titles[song - 1];
    if (answer) await guessLikeAHuman(page, answer);

    // Solving ends a solo round immediately — `endGuessingEarly` fires once every
    // player is done, and there is only one.
    const scored = await page
      .getByText(`${song}/5 named`)
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (scored) continue;

    /**
     * Otherwise give up on it — but only if the round is still open.
     *
     * A hard `expect(pass).toBeEnabled()` assumes the round is still in its guessing
     * phase. It need not be: a rejected guess, or simply a slow step, can leave the
     * 30s clock to expire on its own, and then the control being waited for does not
     * exist and the whole spec burns its budget on a control it will never see. The
     * loop's next header wait handles that case correctly.
     */
    const pass = page.getByRole("button", { name: /I don.t know this one/ });
    if (await pass.isVisible().catch(() => false)) await pass.click();
  }

  // ------------------------------------------------------------- the result
  await expect(page.getByText(/Rank \d+ of \d+ today/)).toBeVisible({ timeout: 90_000 });
  await hideDevOverlay(page);

  /**
   * The signed-in variant, which is the whole reason this spec plays the daily rather
   * than leaving it to the guest run: a signed-in player gets the XP line and does NOT
   * get the "you're not on the board yet" conversion block.
   */
  await expect(page.getByText(/You.re not on the board yet/)).toHaveCount(0);
  /**
   * Eventually consistent by design, so this gets a real budget rather than a default.
   *
   * `daily.myRun` reads the awarded figure back off `matchPlayers.xpEarned`, which
   * `progression.finalizeMatch` writes from a scheduled function — see the note on
   * `xpEarnedForRun`. `complete` and `finalizeMatch` race, and the results screen
   * deliberately renders "no line yet" rather than a wrong zero in the gap. Under load
   * that gap has been longer than 30s, which failed here as a missing element and looked
   * like the XP line had been dropped from the screen.
   */
  await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible({ timeout: 90_000 });

  await page.screenshot({
    path: path.join(SCREENSHOTS, "new-03-daily-result-signed-in.png"),
    fullPage: true,
  });

  // XP from the run must reach the sidebar — the progression loop closing is the thing
  // the level system exists to do.
  await page.goto("/");
  await hideDevOverlay(page);
  await expect(page.locator("aside").getByText(/^LVL \d+$/)).toBeVisible();
  await expect(
    page.locator("aside").getByRole("progressbar", { name: /Level \d+: [1-9]\d* of \d+ XP/ }),
  ).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: path.join(SCREENSHOTS, "new-04-sidebar-after-xp.png") });
});
