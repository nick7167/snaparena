import { test, expect } from "@playwright/test";
import { assertOnboarded } from "./helpers";

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
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leaderboard" })).toBeVisible();

    // Leaving is reachable from the results screen too, and needs no confirm there —
    // the match is over, so nothing is at stake.
    await expect(page.getByRole("button", { name: "Leave match" })).toBeVisible();
  });
});
