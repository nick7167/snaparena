import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, hideDevOverlay } from "./helpers";

/**
 * The custom sign-in and sign-up surfaces.
 *
 * Clerk still owns identity — these forms drive Clerk's v7 custom-flow API. What changed
 * is that they are OUR chrome: the app used to open Clerk's hosted modal from six
 * different call sites, which could never match the design system and dropped a player
 * out of whatever they were doing.
 *
 * These tests assert the form exists, is ours, and behaves. They deliberately stop short
 * of completing a real sign-up: that would mint accounts in a live Clerk instance on
 * every run, and the credential path is Clerk's code, not ours. The signed-in specs get
 * their session through `clerk.signIn` for the same reason.
 *
 * Runs signed out.
 */

const DESKTOP = { width: 1280, height: 900 };

/** Clerk's hosted components render under `cl-` prefixed class names. Their absence is
 *  the assertion — this is the thing the custom form replaced. */
async function expectNotClerkHostedUi(page: Page) {
  await expect(page.locator('[class*="cl-rootBox"]')).toHaveCount(0);
  await expect(page.locator('[class*="cl-signIn-root"]')).toHaveCount(0);
  await expect(page.locator("iframe[src*='clerk']")).toHaveCount(0);
}

test.use({ viewport: DESKTOP });

test.describe("routes", () => {
  test("/sign-in renders our own form", async ({ page }) => {
    await page.goto("/sign-in");
    await hideDevOverlay(page);

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    // Both social providers, from the instance's enabled strategies.
    await expect(page.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Discord/ })).toBeVisible();

    // And the credential path, wired to our Field/Input primitives.
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    // Scoped to `main`: the sidebar carries a "Sign in" button of its own on every
    // signed-out page, so an unscoped locator is ambiguous here by construction.
    await expect(
      page.locator("main").getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();

    await expectNotClerkHostedUi(page);
    await page.screenshot({ path: path.join(SCREENSHOTS, "auth-sign-in-route.png") });
  });

  test("/sign-up renders our own form", async ({ page }) => {
    await page.goto("/sign-up");
    await hideDevOverlay(page);

    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

    // Clerk mounts its bot check into this element. Without it, sign-up fails with a
    // captcha error nobody can act on.
    await expect(page.locator("#clerk-captcha")).toHaveCount(1);

    await expectNotClerkHostedUi(page);
    await page.screenshot({ path: path.join(SCREENSHOTS, "auth-sign-up-route.png") });
  });

  test("the two routes link to each other", async ({ page }) => {
    // Real links on these routes, not the in-place mode switch the dialog uses — there
    // is no parent holding the mode when the form IS the page.
    await page.goto("/sign-in");
    await page.locator("main").getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/sign-up/);

    await page.locator("main").getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("surfaces a bad credential as a field error rather than a crash", async ({ page }) => {
    /**
     * The v7 API returns errors as values — `signIn.password()` resolves with `{ error }`
     * and populates `errors.fields`, it does not throw. This test is what proves the form
     * reads them rather than swallowing them, which is the single easiest thing to get
     * wrong when porting from the old throwing API.
     */
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("definitely-not-a-user@example.com");
    await page.getByLabel("Password").fill("wrong-password-here");
    await page.locator("main").getByRole("button", { name: "Sign in", exact: true }).click();

    // Something has to be said, in our own markup, and the page must survive it.
    await expect(page.locator("p.text-signal-text").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    await hideDevOverlay(page);
    await page.screenshot({ path: path.join(SCREENSHOTS, "auth-sign-in-error.png") });
  });
});

test.describe("dialog", () => {
  test("opens in place from the sidebar", async ({ page }) => {
    await page.goto("/");
    await hideDevOverlay(page);

    await page.locator("aside").getByRole("button", { name: "Sign in" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    // The point of the dialog: the page underneath is still there.
    await expect(page).toHaveURL(/localhost:3000\/$/);

    await page.screenshot({ path: path.join(SCREENSHOTS, "auth-dialog.png") });
  });

  test("switches between sign in and sign up without navigating", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Sign up and save your score/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Create your account" })).toBeVisible();

    await dialog.getByRole("button", { name: "Sign in" }).click();
    await expect(dialog.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });

  test("closes on Escape and returns focus to whatever opened it", async ({ page }) => {
    // The part hand-rolled dialogs always miss. Without it a keyboard user is dumped at
    // the top of the document every time they dismiss.
    await page.goto("/");
    const trigger = page.locator("aside").getByRole("button", { name: "Sign in" });
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("closes on a backdrop click", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: "Sign in" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Top-left corner of the overlay, comfortably outside the panel.
    await page.mouse.click(10, 10);
    await expect(dialog).toBeHidden();
  });

  test("locks the page behind it", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe("hidden");
  });
});

test.describe("gated modes", () => {
  test("ranked, practice and rooms all offer the same account CTA", async ({ page }) => {
    for (const route of ["/ranked", "/practice", "/rooms"]) {
      await page.goto(route);
      const cta = page
        .locator("main")
        .getByRole("button", { name: /Create an account|Sign in to play/ });
      await expect(cta, `${route} has no way to sign up`).toBeVisible();

      await cta.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });

  test("the daily stays open to everyone", async ({ page }) => {
    // The one mode a stranger can use. If this ever gates, the landing page's primary
    // call to action leads to a wall.
    await page.goto("/daily");
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  });
});
