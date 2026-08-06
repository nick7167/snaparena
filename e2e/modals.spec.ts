import { test, expect } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, assertOnboarded, hideDevOverlay } from "./helpers";

/**
 * Photograph the overlays.
 *
 * The design gallery at /design renders every primitive in every state, but it has no
 * entry for a single dialog, menu or popover — so the overlays are the one part of the
 * UI that had never been reviewable anywhere. That matters more than usual here because
 * they are not one component: `ui/Dialog` has exactly two call sites, and everything
 * else on this list is hand-rolled with its own dismissal and focus behaviour.
 *
 * Nothing here creates a match, plays a round, or submits anything. The report dialog is
 * opened and cancelled deliberately — a real submission would file a moderation report
 * against a real row in the shared deployment.
 */

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

/**
 * A profile the report controls will actually render on.
 *
 * They are hidden for bots, and the ladder is otherwise entirely synthetic — so this has
 * to name a human account. Overridable so the spec does not hard-depend on one person's
 * handle existing forever.
 */
const REPORTABLE_HANDLE = process.env.E2E_REPORTABLE_HANDLE ?? "thenerd";

for (const viewport of VIEWPORTS) {
  test.describe(`modals ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("account menu", async ({ page }) => {
      test.setTimeout(45_000);
      await page.goto("/");
      await hideDevOverlay(page);
      await assertOnboarded(page);

      const trigger = page
        .locator("aside, header")
        .getByRole("button", { name: "Account menu" })
        .first();
      await expect(trigger).toBeVisible({ timeout: 30_000 });
      await trigger.click();

      await expect(page.getByRole("menuitem", { name: "Profile" })).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOTS, `modal-${viewport.name}-account-menu.png`),
      });
    });

    /**
     * Clerk's own account modal — the one surface in the product that does not use this
     * design system, dropped into the middle of it by a menu item three rows above
     * "Sign out". Worth a picture precisely because nothing in this repo controls how it
     * looks: there is no `appearance` prop, no `baseTheme`, and no Clerk CSS variables
     * anywhere in the codebase.
     */
    test("clerk manage account", async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto("/");
      await hideDevOverlay(page);
      await assertOnboarded(page);

      const trigger = page
        .locator("aside, header")
        .getByRole("button", { name: "Account menu" })
        .first();
      await expect(trigger).toBeVisible({ timeout: 30_000 });
      await trigger.click();

      const manage = page.getByRole("menuitem", { name: "Manage account" });
      if ((await manage.count()) === 0) {
        test.skip(true, "no Manage account item in this build");
      }
      await manage.click();

      // Clerk mounts its modal into its own portal; wait for content, not for a timer.
      await expect(page.locator(".cl-modalContent, .cl-userProfile-root").first()).toBeVisible({
        timeout: 30_000,
      });
      await page.screenshot({
        path: path.join(SCREENSHOTS, `modal-${viewport.name}-clerk-account.png`),
      });
    });

    /**
     * The report control, opened and cancelled — never submitted.
     *
     * It needs a human subject: the controls are suppressed for bots, and every account
     * on this ladder is synthetic except one, so walking the leaderboard and taking the
     * first profile found only bots and skipped. `REPORTABLE_HANDLE` names the real
     * account instead.
     *
     * The submission is deliberately never made. `Send report` files a real moderation
     * report against a real person, and enough of them set `bioHidden` — which the owner
     * then cannot clear, because nothing in the UI lets you edit a hidden bio. Opening
     * and cancelling photographs the surface without touching the row.
     */
    test("report dialog", async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto(`/u/${REPORTABLE_HANDLE}`);
      await hideDevOverlay(page);
      await assertOnboarded(page);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

      /**
       * Waited for, not counted.
       *
       * The report row is gated on `me` — a live Convex query — so a bare `count()` races
       * it and returns 0 while the query is still in flight. That is exactly what made
       * this skip on one viewport and pass on two others against the same profile, which
       * reads convincingly like a mobile-only bug and is not one: the row carries no
       * responsive classes at all.
       */
      const open = page.getByRole("button", { name: /Report this (bio|picture)/ }).first();
      const reportable = await open
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (!reportable) {
        test.skip(true, `@${REPORTABLE_HANDLE} has no bio or picture to report`);
      }
      await open.click();

      await expect(page.getByRole("button", { name: "Send report" })).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOTS, `modal-${viewport.name}-report.png`),
        fullPage: true,
      });

      // Back to the collapsed state. Nothing is submitted, here or anywhere in this file.
      await page.getByRole("button", { name: "Cancel" }).click();
    });
  });
}

/**
 * The raised gold PLAY control opens a menu rather than navigating.
 *
 * It belongs to the tab bar, so it exists only below `md` — the tablet band now gets the
 * sidebar rail and its own play button instead. Filtered on the same 768px boundary the
 * shell uses, so this list cannot drift away from the layout it is photographing.
 */
for (const viewport of VIEWPORTS.filter((v) => v.width < 768)) {
  test.describe(`play menu ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("mobile play menu", async ({ page }) => {
      test.setTimeout(45_000);
      await page.goto("/");
      await hideDevOverlay(page);
      await assertOnboarded(page);

      const play = page.getByRole("button", { name: /^Play$/ }).first();
      await expect(play).toBeVisible({ timeout: 30_000 });
      await play.click();

      await expect(page.getByRole("menu", { name: /playing/i })).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOTS, `modal-${viewport.name}-play-menu.png`),
      });
    });
  });
}
