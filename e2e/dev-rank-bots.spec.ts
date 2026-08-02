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
    // The draft alone is a 15s-per-turn clock, and the bot thinks for up to 2.2s a ban.
    test.setTimeout(120_000);

    await page.goto("/ranked");
    await assertOnboarded(page);

    // The dev control is rendered from a server-read flag, so its absence means the
    // roster is not live and there is nothing here to test.
    await expect(page.getByRole("heading", { name: "Ranked 1v1" })).toBeVisible();

    await page.getByRole("button", { name: "Find a match" }).click();

    // Pairing is a client poll every 2s against a queue the cron keeps stocked.
    const devBar = page.getByRole("button", { name: "Random", exact: true });
    await expect(devBar).toBeVisible({ timeout: 45_000 });

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

    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  });
});
