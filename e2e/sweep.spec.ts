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
  { path: "/leaderboard", name: "leaderboard" },
  { path: "/rooms", name: "rooms" },
  { path: "/settings", name: "settings" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

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
  });
}
