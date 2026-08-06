import { test, expect } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, hideDevOverlay } from "./helpers";

/**
 * Photograph every route as a signed-out visitor, at all three form factors.
 *
 * The signed-in sweep cannot cover this. Six of these routes render a completely
 * different page without a session — five of them are separate hand-written pitches for
 * making an account, and until now no two of them had ever been looked at side by side.
 * They disagree: four different button labels across five surfaces, three of which read
 * "Sign in…" while opening the sign-up form.
 *
 * Deliberately no `storageState`, which is what the `guest` project in playwright.config
 * provides. A fresh context is a fresh player.
 */

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/daily", name: "daily" },
  { path: "/ranked", name: "ranked" },
  { path: "/practice", name: "practice" },
  { path: "/leaderboard", name: "leaderboard" },
  { path: "/rooms", name: "rooms" },
  { path: "/settings", name: "settings" },
  { path: "/sign-in", name: "sign-in" },
  { path: "/sign-up", name: "sign-up" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`guest ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`${route.name} renders signed out`, async ({ page }) => {
        test.setTimeout(45_000);

        await page.goto(route.path);
        await hideDevOverlay(page);

        /**
         * Wait for Clerk, not for a timer.
         *
         * `auth-gate.tsx` renders null until Clerk resolves, so a screenshot taken too
         * early catches a page with its entire signed-out branch missing — which looks
         * like a layout bug rather than a race. The sign-in control is the first thing
         * that branch produces, so its presence is the honest readiness signal.
         *
         * The two auth routes are the exception: they ARE the sign-in surface and carry
         * no shell control, so they wait on their own heading instead.
         */
        if (route.path.startsWith("/sign-")) {
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
            timeout: 30_000,
          });
        } else {
          await expect(
            page.getByRole("button", { name: /sign in|sign up|create an account/i }).first(),
          ).toBeVisible({ timeout: 30_000 });
        }

        const body = await page.locator("body").innerText();
        for (const crash of ["Unhandled Runtime Error", "Application error"]) {
          expect(body, `${route.path} rendered an error page`).not.toContain(crash);
        }
        expect(
          body.trim().length,
          `${route.path} rendered almost no content`,
        ).toBeGreaterThan(50);

        await page.screenshot({
          path: path.join(SCREENSHOTS, `guest-${viewport.name}-${route.name}.png`),
          fullPage: true,
        });
      });
    }
  });
}
