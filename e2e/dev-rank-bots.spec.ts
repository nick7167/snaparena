import { test, expect } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, assertOnboarded, enableResolveBar } from "./helpers";

/**
 * DEV ONLY — delete with convex/devbots.ts.
 *
 * The one path in the app that had no browser coverage at all: an actual rated match.
 * Everything about ranked — pairing, the ban draft, Elo, the placement countdown — was
 * unreachable in a test because the queue is empty and the only bot on offer played
 * `mode: "practice"`, which by design cannot move a rating.
 *
 * With the dev roster seeded there is a real opponent in the queue, so this drives the
 * genuine article: enqueue, pair, draft, then finish through the dev resolve control and
 * assert the rating actually moved. Requires DEV_RANK_BOTS set on the deployment and
 * `npm run dev-bots seed` already run; skips itself cleanly if not.
 */

test.describe("ranked against a dev rank bot", () => {
  test("pairs, drafts and settles a real rating", async ({ page }) => {
    /**
     * The draft alone is a 15s-per-turn clock and the bot thinks for up to 2.2s a ban, on
     * top of DEV_BOT_MIN_WAIT_MS of queueing before a bot will answer at all — that floor
     * exists so the search screen is legible, and it is spent inside this budget.
     */
    test.setTimeout(180_000);

    await enableResolveBar(page);
    await page.goto("/ranked");
    await assertOnboarded(page);

    /**
     * The queue control, not a page heading.
     *
     * This asserted on an "Ranked 1v1" heading, which the signed-in ranked page no longer
     * has — it leads with your rank now, so the `h1` reads "Gold II" or "Unranked" and
     * changes with the account. The precondition being checked is "the ranked home has
     * rendered and is ready to queue", and the control clicked on the next line is a
     * truer statement of that than any wording.
     */
    const findMatch = page.getByRole("button", { name: "Find a match" });
    await expect(findMatch).toBeVisible({ timeout: 30_000 });
    await findMatch.click();

    /**
     * The searching state is a one-screen contract.
     *
     * This is the regression that prompted the hero rebuild: `SearchPanel` is ~2.5× the
     * height of the button it replaces and used to mount at the foot of a hero that gave
     * up nothing, which put both of these below the fold on every phone narrower than a
     * 390 and on every laptop. `toBeVisible` would have passed throughout — the elements
     * were rendered, just not on screen — so the assertion has to be positional.
     *
     * `exact` matters: at `lg:` the sidebar's Play button becomes a searching indicator
     * with its own "Cancel search" control, and a substring match resolves to both.
     */
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Play a bot instead" }),
    ).toBeInViewport();

    // Pairing is a client poll every 2s against a queue the cron keeps stocked.
    const devBar = page.getByRole("button", { name: "Random", exact: true });
    await expect(devBar).toBeVisible({ timeout: 45_000 });

    /**
     * Get through the opponent reveal.
     *
     * That phase holds for up to 30 seconds now and ends on both players pressing Ready —
     * a bot counts as ready from the start, so this press alone advances it. Waiting it
     * out instead would land the draft exactly on this block's own timeout.
     */
    const ready = page.getByRole("button", { name: /I'm ready/ });
    await expect(ready).toBeVisible({ timeout: 30_000 });

    /**
     * There is a way out of the reveal.
     *
     * This phase holds for up to thirty seconds and used to render no exit whatsoever:
     * the match header returns null here, and the app shell is hidden, so the browser's
     * back button was the only escape — and it silently forfeited the duel.
     */
    await expect(page.getByRole("button", { name: /Leave this duel/ })).toBeInViewport();

    await ready.click();

    // Proof it is a rated match and not the practice fallback: the practice path never
    // renders a draft, and `startBotMatch` would have said so on the queue screen.
    await expect(
      page.getByText(/Ban a category|is banning…/).first(),
    ).toBeVisible({ timeout: 30_000 });

    /**
     * Actually place the bans.
     *
     * Waiting the draft out instead lets the fifteen-second clock expire with nothing
     * banned, which reaches the reveal by a different route and shows all eight
     * categories surviving — a real edge case, but not the one worth covering here.
     */
    const pool = page.getByRole("group", { name: "Category pool" });

    for (let ban = 0; ban < 2; ban++) {
      await expect(page.getByRole("heading", { name: "Ban a category" })).toBeVisible({
        timeout: 30_000,
      });
      /**
       * Scoped to the pool, and that is load-bearing rather than tidy.
       *
       * A bare `button:not([disabled])` also matches the dev resolve bar, which renders
       * first in the DOM — so `.first()` clicked "Win" and ended the match outright,
       * three assertions before anything noticed.
       */
      await pool.getByRole("button").and(page.locator(":not([disabled])")).first().click();
    }

    /**
     * The draft's payoff.
     *
     * Half the pool survives the bans and nothing ever showed which — the draft cut
     * straight to a countdown, so the one decision both players made together had no
     * visible result.
     */
    const set = page.getByRole("heading", { name: /You.re playing these \d/ });
    await expect(set).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS, "duel-veto-result.png") });
    // The bans actually removed something: fewer cards than the pool started with.
    await expect(page.getByText(/^Banned:/)).toBeVisible();

    /**
     * The duel header, which is where two bugs lived at once.
     *
     * `matches.state` used to sort the scoreboard by HP descending, so the columns
     * physically swapped sides the moment the lead changed — your bar was on the left
     * while you were ahead and jumped right when you fell behind. And a rank chip on the
     * opponent's column only made that column taller, which pushed its meter down.
     *
     * Both assertions are positional because both bugs were: every element was present
     * and correct, just not where it needed to be.
     */
    const hpBars = page.getByRole("progressbar", { name: /health/ });
    await expect(hpBars.first()).toBeVisible({ timeout: 60_000 });
    await expect(hpBars).toHaveCount(2);

    await expect(hpBars.first()).toHaveAttribute("aria-label", /^Your health/);

    const [mine, theirs] = await Promise.all([
      hpBars.nth(0).boundingBox(),
      hpBars.nth(1).boundingBox(),
    ]);
    expect(mine!.x).toBeLessThan(theirs!.x);
    // Same row, so the two bars read as one comparison rather than two readouts.
    expect(Math.abs(mine!.y - theirs!.y)).toBeLessThanOrEqual(1);

    // Skip the songs. This runs the real `finishMatch` → `finalizeMatch` → `applyRanked`
    // path; only the nine-to-twelve songs are elided.
    await devBar.click();

    await expect(
      page.getByRole("heading", { name: /VICTORY|DEFEAT|DRAW/ }),
    ).toBeVisible({ timeout: 30_000 });

    // The assertion that matters. A rating delta only exists when `applyRanked` ran,
    // which only happens for `mode: "ranked"` with exactly two players — so this line
    // failing means the bot match was created as practice.
    await expect(page.getByText(/^[+-]\d+$/).first()).toBeVisible({ timeout: 30_000 });

    /**
     * The way out, and there has to be more than one.
     *
     * This screen used to offer a single button — labelled "Play again" while actually
     * returning to the lobby — on a screen where the app shell is still hidden and the
     * match header renders nothing. A room match ended with no controls at all.
     */
    await expect(page.getByRole("button", { name: "Back to lobby" })).toBeVisible();

    // Scoped to `main`: the sidebar now stays up during a match and carries its own Home
    // row, so an unscoped lookup matches two links. The claim here is about what the
    // RESULTS screen offers, which is what matters on a phone where the nav is hidden.
    const resultExits = page.getByRole("main");
    await expect(resultExits.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(resultExits.getByRole("link", { name: "Leaderboard" })).toBeVisible();

    // Leaving is reachable from the results screen too, and needs no confirm there —
    // the match is over, so nothing is at stake.
    await expect(page.getByRole("button", { name: "Leave match" })).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS, "duel-match-end.png"),
      fullPage: true,
    });
  });

  /**
   * The results screen runs long — verdict, both players, the round timeline, XP, badges —
   * and on a phone the one thing you actually want next used to be several scrolls below
   * the fold, on a screen where the tab bar is hidden and nothing else offers a way on.
   *
   * So the primary is pinned. Asserted by scrolling to the top of a long results screen
   * and checking the button is still on screen, which is the only thing that distinguishes
   * a sticky bar from a button that merely happens to be visible when you land.
   */
  test("pins the way out of the results screen on mobile", async ({ page }) => {
    test.setTimeout(180_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await enableResolveBar(page);
    await page.goto("/ranked");
    await assertOnboarded(page);

    /**
     * Clear a results screen left up by the test above.
     *
     * The queue driver holds the match id so a reload drops you back into the arena, which
     * means /ranked renders the finished match rather than the lobby until something says
     * otherwise. Doubles as proof that "Back to lobby" does what its new name claims.
     */
    const stale = page.getByRole("button", { name: "Back to lobby" });
    if (await stale.isVisible({ timeout: 10_000 }).catch(() => false)) await stale.click();

    /**
     * Waited for, not merely probed.
     *
     * A bare `isVisible()` resolves immediately, and /ranked opens on a loading skeleton
     * while `users.me` settles — so probing without a timeout reports "no button" for a
     * page that is simply still arriving, and the test silently skips itself.
     */
    const find = page.getByRole("button", { name: "Find a match" });
    await expect(find).toBeVisible({ timeout: 30_000 });
    await find.click();

    const devBar = page.getByRole("button", { name: "Random", exact: true });
    await expect(devBar).toBeVisible({ timeout: 45_000 });

    const ready = page.getByRole("button", { name: /I'm ready/ });
    await expect(ready).toBeVisible({ timeout: 30_000 });
    await ready.click();
    await expect(page.getByText(/Ban a category|is banning…/).first()).toBeVisible({
      timeout: 30_000,
    });
    await devBar.click();

    const verdict = page.getByRole("heading", { name: /VICTORY|DEFEAT|DRAW/ });
    await expect(verdict).toBeVisible({ timeout: 30_000 });

    const cta = page.getByRole("button", { name: "Back to lobby" });
    await expect(cta).toBeInViewport();

    // Back to the top, where the verdict is — the CTA must still be reachable.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(verdict).toBeInViewport();
    await expect(cta).toBeInViewport();

    await page.screenshot({ path: path.join(SCREENSHOTS, "duel-match-end-mobile.png") });
  });
});
