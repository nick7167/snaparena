import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, hideDevOverlay } from "./helpers";

/**
 * The signed-out landing page.
 *
 * Runs without a session, which is the whole point — this is the only screen in the app
 * whose audience has never seen it before.
 *
 * What it replaced: five stacked sections (hero, CTA, how a round runs, a tier table and
 * the duel) which put the thing a stranger came to do one full screen above the thing
 * that would make them do it. The requirement now is literal — everything that matters
 * fits one viewport, and the page is about today's challenge and signing up.
 *
 * Selector note: the app writes apostrophes as `&rsquo;` (’), not ASCII `'`. Names here
 * use `.` in that position — an exact string silently never matches.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

/**
 * How much vertical overflow counts as "you have to scroll".
 *
 * Not zero. Sub-pixel layout rounding and the scrollbar gutter routinely produce a few
 * pixels of slack that no human would ever perceive as a scrollable page, and asserting
 * an exact fit makes this test fail on rendering noise rather than on regressions.
 */
const SCROLL_TOLERANCE = 24;

async function verticalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );
}

test.describe("desktop", () => {
  test.use({ viewport: DESKTOP });

  test("fits one screen", async ({ page }) => {
    await page.goto("/");
    await hideDevOverlay(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(
      await verticalOverflow(page),
      "the signed-out landing page should not scroll",
    ).toBeLessThanOrEqual(SCROLL_TOLERANCE);

    await page.screenshot({ path: path.join(SCREENSHOTS, "landing-desktop.png") });
  });

  test("is about today's challenge and signing up", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /One second of a song/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Today.s challenge/ })).toBeVisible();

    // The guest gate: both paths offered at the front door, so the choice is made once.
    const guest = page.getByRole("link", { name: /Play as guest/ });
    await expect(guest).toBeVisible();
    await expect(guest).toHaveAttribute("href", "/daily");
    await expect(
      page.getByRole("button", { name: /Sign up and save your score/ }),
    ).toBeVisible();

    // The honest bit, which is also the argument for signing up.
    await expect(page.getByText(/guest score lives in this browser only/i)).toBeVisible();
  });

  test("no longer carries the three explainer sections", async ({ page }) => {
    await page.goto("/");
    const body = await page.locator("body").innerText();

    // Their content survives, compressed into one row — these were the standalone
    // sections that made the page scroll.
    for (const heading of ["How a round runs", "Score by tier", "The duel"]) {
      expect(body, `"${heading}" should have been folded into the hero`).not.toContain(heading);
    }

    // But the game still has to be explained, or the page is a poster.
    await expect(page.getByText(/Duels end at zero/)).toBeVisible();
    await expect(page.getByText(/points for a SNAP/)).toBeVisible();
  });

  test("renders its pitch without JavaScript", async ({ browser }) => {
    /**
     * The reason the pitch sits OUTSIDE the auth gate.
     *
     * `SignedIn`/`SignedOut` resolve on the client and return null until Clerk loads, so
     * anything inside them is absent from the server-rendered HTML. With the whole
     * landing page in there, crawlers and link previews saw an empty document — on the
     * one page whose entire job is reaching people who have never been here.
     */
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /One second of a song/ })).toBeVisible();
    await expect(page.getByText(/Duels end at zero/)).toBeVisible();

    await context.close();
  });

  test("Play as guest goes straight into the daily", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Play as guest/ }).click();
    await expect(page).toHaveURL(/\/daily$/);
    await expect(page.getByRole("heading", { name: /Today.s challenge/ })).toBeVisible();
  });

  test("offers Play in the sidebar, pointed at the daily", async ({ page }) => {
    // Signed out, the only mode a guest can actually play is the daily. Sending them at
    // ranked would be a wall wearing the costume of a game.
    await page.goto("/");
    const play = page.locator("aside").getByRole("link", { name: /PLAY/ });
    await expect(play).toBeVisible();
    await expect(play).toHaveAttribute("href", "/daily");
  });
});

test.describe("mobile", () => {
  test.use({ viewport: MOBILE });

  test("fits one screen", async ({ page }) => {
    await page.goto("/");
    await hideDevOverlay(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(
      await verticalOverflow(page),
      "the signed-out landing page should not scroll on a phone",
    ).toBeLessThanOrEqual(SCROLL_TOLERANCE);

    await page.screenshot({ path: path.join(SCREENSHOTS, "landing-mobile.png") });
  });

  test("keeps both calls to action above the tab bar", async ({ page }) => {
    await page.goto("/");

    const guest = page.getByRole("link", { name: /Play as guest/ });
    const signUp = page.getByRole("button", { name: /Sign up and save your score/ });
    const bar = page.getByRole("navigation", { name: "Main" });

    const barBox = (await bar.boundingBox())!;
    for (const control of [guest, signUp]) {
      const box = (await control.boundingBox())!;
      expect(
        box.y + box.height,
        "a call to action is hidden behind the tab bar",
      ).toBeLessThanOrEqual(barBox.y + 1);
    }
  });
});
