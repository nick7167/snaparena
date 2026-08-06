import { test, expect } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, assertOnboarded, hideDevOverlay } from "./helpers";

/**
 * Photograph every route, signed in, at both form factors.
 *
 * The assertions here are deliberately thin — no error boundary, no console errors —
 * because the deliverable is the images. This is the part that catches what assertions
 * never do: text overflowing its container, a truncated handle, a meter that renders as
 * nothing, two panels that disagree about their spacing.
 */

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/daily", name: "daily" },
  { path: "/ranked", name: "ranked" },
  { path: "/practice", name: "practice" },
  { path: "/leaderboard", name: "leaderboard" },
  { path: "/rooms", name: "rooms" },
  { path: "/settings", name: "settings" },
];

/**
 * Three form factors, and the middle one is the reason this list grew.
 *
 * The shell has exactly one breakpoint — `lg`, 1024px — so everything from 768 to 1023
 * renders the phone layout: a bottom tab bar and a 672px column adrift on a wide screen.
 * Nothing had ever been photographed in that band, so nobody had seen it. 834x1112 is
 * iPad portrait, the common case and the widest point where the phone layout still applies.
 */
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

/**
 * A real, well-used account to photograph the profile page against.
 *
 * The test account has almost no history, so its profile renders mostly empty states —
 * which is worth seeing, but is not what the page looks like in use. Overridable so this
 * does not hard-depend on one person's handle existing forever.
 */
const OTHER_HANDLE = process.env.E2E_REPORTABLE_HANDLE ?? "thenerd";

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`${route.name} renders`, async ({ page }) => {
        test.setTimeout(45_000);

        const errors: string[] = [];
        page.on("console", (message) => {
          if (message.type() !== "error") return;
          const text = message.text();
          // Clerk shouts about development keys on every page load, by design.
          if (text.includes("development keys")) return;
          // Third-party artwork occasionally 404s from the iTunes CDN; that is a data
          // problem in the catalogue, not a rendering fault in the page.
          if (/Failed to load resource/.test(text)) return;
          errors.push(text);
        });

        await page.goto(route.path);
        await hideDevOverlay(page);
        await assertOnboarded(page);

        // Wait for the shell to resolve rather than screenshotting a skeleton.
        await expect(
          page.getByRole("button", { name: "Account menu" }).first(),
        ).toBeVisible({ timeout: 30_000 });

        /**
         * A crashed page must not pass as a pretty screenshot.
         *
         * Checked by content, not by `nextjs-portal`: that element hosts Next's dev
         * tools and is present on every page in development, so its existence says
         * nothing about whether anything went wrong.
         */
        const body = await page.locator("body").innerText();
        for (const crash of [
          "Unhandled Runtime Error",
          "Application error",
          "This page could not be found",
        ]) {
          expect(body, `${route.path} rendered an error page`).not.toContain(crash);
        }
        // A route that renders nothing is a failure the screenshot would flatter.
        expect(body.trim().length, `${route.path} rendered almost no content`).toBeGreaterThan(50);

        await page.screenshot({
          path: path.join(SCREENSHOTS, `sweep-${viewport.name}-${route.name}.png`),
          fullPage: true,
        });

        expect(errors, `console errors on ${route.path}`).toEqual([]);
      });
    }

    test("profile renders", async ({ page }) => {
      test.setTimeout(45_000);
      await page.goto("/");
      await hideDevOverlay(page);

      // Reached the way a player reaches it, which also proves the menu link works.
      await page.locator("aside, header").getByRole("button", { name: "Account menu" }).first().click();
      await page.getByRole("menuitem", { name: "Profile" }).click();
      await expect(page).toHaveURL(/\/u\/[a-z0-9_]+$/);

      await hideDevOverlay(page);
      await page.screenshot({
        path: path.join(SCREENSHOTS, `sweep-${viewport.name}-profile.png`),
        fullPage: true,
      });
    });

    /**
     * The match record, reached by clicking a result rather than by a fabricated URL.
     *
     * `/m/[matchId]` cannot be added to ROUTES because it needs a real id, and the ids
     * belong to whatever this account has actually played. Navigating from the profile
     * gets a genuine one and proves the recent-matches rows link somewhere at the same
     * time. Skips rather than fails on a fresh account with no history — an empty match
     * list is a legitimate state, not a broken page.
     */
    test("match record renders", async ({ page }) => {
      test.setTimeout(45_000);
      await page.goto("/");
      await hideDevOverlay(page);

      await page.locator("aside, header").getByRole("button", { name: "Account menu" }).first().click();
      await page.getByRole("menuitem", { name: "Profile" }).click();
      await expect(page).toHaveURL(/\/u\/[a-z0-9_]+$/);

      const firstMatch = page.locator('a[href^="/m/"]').first();
      if ((await firstMatch.count()) === 0) {
        test.skip(true, "this account has no finished matches yet");
      }

      await firstMatch.click();
      await expect(page).toHaveURL(/\/m\//);
      await hideDevOverlay(page);
      await page.screenshot({
        path: path.join(SCREENSHOTS, `sweep-${viewport.name}-match-record.png`),
        fullPage: true,
      });
    });

    /**
     * A real player's profile, viewed by someone else.
     *
     * Distinct from the `profile renders` test above, which reaches the *viewer's own*
     * profile through the account menu. That version never shows the report controls, the
     * "you" chip is present instead of absent, and a well-used account has history and
     * badges that a test account does not. This is the page as it is actually seen.
     */
    test("another player's profile renders", async ({ page }) => {
      test.setTimeout(45_000);
      await page.goto(`/u/${OTHER_HANDLE}`);
      await hideDevOverlay(page);
      await assertOnboarded(page);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS, `sweep-${viewport.name}-profile-other.png`),
        fullPage: true,
      });
    });

    /**
     * The operator screen.
     *
     * Reachable in a production build for the first time — it used to `notFound()` outside
     * development, so no screenshot of it has ever existed. The test account is not an
     * admin, so what this photographs is the REFUSAL, which is the state almost everyone
     * who ever reaches this URL will see. That is the one worth reviewing.
     */
    test("admin refuses a non-admin", async ({ page }) => {
      test.setTimeout(45_000);
      await page.goto("/admin");
      await hideDevOverlay(page);
      await assertOnboarded(page);

      await expect(page.getByText("Not your screen")).toBeVisible({ timeout: 30_000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS, `sweep-${viewport.name}-admin-denied.png`),
        fullPage: true,
      });
    });

    /**
     * The 404, which is the one screen in the product a player can reach by typo.
     *
     * Deliberately outside the ROUTES loop: that loop asserts "This page could not be
     * found" never appears, which is exactly what this route is supposed to render.
     */
    test("not-found renders", async ({ page }) => {
      await page.goto("/no-such-page-here");
      await hideDevOverlay(page);
      await page.screenshot({
        path: path.join(SCREENSHOTS, `sweep-${viewport.name}-not-found.png`),
        fullPage: true,
      });
    });
  });
}
