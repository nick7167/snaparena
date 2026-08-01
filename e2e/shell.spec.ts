import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, assertOnboarded } from "./helpers";

/**
 * The sidebar footer: level bar over the account menu.
 *
 * This is the exact surface that shipped unverified. It replaced four separate controls
 * — a rank link, Clerk's `<UserButton>`, a settings gear and a mute toggle — with one
 * menu, and none of it had ever been rendered in a browser.
 *
 * Scoped by landmark rather than by role alone: the same menu exists twice in the DOM,
 * once in the desktop sidebar and once in the mobile header, with CSS deciding which is
 * on screen. An unscoped `getByRole` would be ambiguous at every viewport.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

const sidebarMenu = (page: Page) =>
  page.locator("aside").getByRole("button", { name: "Account menu" });
const mobileMenu = (page: Page) =>
  page.locator("header").getByRole("button", { name: "Account menu" });

/**
 * These are cheap assertions against a loaded page — none of them should take anywhere
 * near the suite-wide 120s, which exists for real daily runs. A short timeout turns a
 * blocked click into a fast, legible failure instead of a two-minute stall.
 */
test.beforeEach(async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account menu" }).first()).toBeVisible();
  await assertOnboarded(page);
});

test.describe("sidebar", () => {
  test.use({ viewport: DESKTOP });

  test("shows the level bar above the account menu", async ({ page }) => {
    await page.goto("/");

    const aside = page.locator("aside");
    const trigger = sidebarMenu(page);
    await expect(trigger).toBeVisible();

    // Level is XP and is shown during placements too — the old block hid it entirely
    // until a player had placed, which is exactly when it is most motivating.
    await expect(aside.getByText(/^LVL \d+$/)).toBeVisible();
    await expect(aside.getByText(/\d+ XP to Level \d+/)).toBeVisible();
    await expect(
      aside.getByRole("progressbar", { name: /Level \d+: \d+ of \d+ XP/ }),
    ).toBeVisible();

    // Identity is the chosen handle, not the Google display name.
    await expect(trigger).toContainText(/^@[a-z0-9_]+/);

    // The level bar must sit ABOVE the trigger, which is the whole layout decision.
    const bar = await aside.getByText(/^LVL \d+$/).boundingBox();
    const box = await trigger.boundingBox();
    expect(bar!.y).toBeLessThan(box!.y);

    await page.screenshot({ path: path.join(SCREENSHOTS, "shell-sidebar.png") });
  });

  test("opens a menu with every account action", async ({ page }) => {
    await page.goto("/");
    await sidebarMenu(page).click();

    const menu = page.getByRole("menu", { name: "Account menu" });
    await expect(menu).toBeVisible();

    for (const label of ["Profile", "Settings", "Manage account", "Sign out"]) {
      await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
    }
    // Label reflects current state rather than the action, so it reads as a status.
    await expect(menu.getByRole("menuitem", { name: /^Sound (on|off)$/ })).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOTS, "shell-menu-open.png") });
  });

  test("is fully keyboard operable and returns focus on Escape", async ({ page }) => {
    await page.goto("/");
    const trigger = sidebarMenu(page);

    // ArrowDown opens straight onto the first item, so a keyboard user never has to
    // open and then hunt for the list.
    await trigger.focus();
    await page.keyboard.press("ArrowDown");

    const menu = page.getByRole("menu", { name: "Account menu" });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Settings" })).toBeFocused();

    // Wraps to the last item rather than dead-ending.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeFocused();

    // The part hand-rolled menus always miss: focus has to come back, or a keyboard
    // user is dumped at the top of the document every time they dismiss.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("closes on an outside click", async ({ page }) => {
    await page.goto("/");
    await sidebarMenu(page).click();
    const menu = page.getByRole("menu", { name: "Account menu" });
    await expect(menu).toBeVisible();

    await page.locator("main, body").first().click({ position: { x: 600, y: 300 } });
    await expect(menu).toBeHidden();
  });

  test("navigates to the profile", async ({ page }) => {
    await page.goto("/");
    await sidebarMenu(page).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await expect(page).toHaveURL(/\/u\/[a-z0-9_]+$/);
  });

  test("has no leftover UserButton or settings gear", async ({ page }) => {
    await page.goto("/");
    await expect(sidebarMenu(page)).toBeVisible();

    // Clerk's own control renders under `cl-userButton*` class names. Its absence is
    // the assertion — the menu is meant to have replaced it entirely.
    await expect(page.locator('[class*="cl-userButton"]')).toHaveCount(0);

    // With the menu closed there should be no standalone route into settings; it is a
    // menu item now.
    await expect(
      page.locator("aside").getByRole("link", { name: "Settings" }),
    ).toHaveCount(0);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: MOBILE });

  test("moves the same menu into the top bar", async ({ page }) => {
    await page.goto("/");

    // The sidebar is gone at this width; the header carries identity instead.
    await expect(page.locator("aside")).toBeHidden();

    const trigger = mobileMenu(page);
    await expect(trigger).toBeVisible();
    await trigger.click();

    const menu = page.getByRole("menu", { name: "Account menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible();

    // No sidebar here, so the level bar rides inside the menu.
    await expect(menu.getByText(/^LVL \d+$/)).toBeVisible();

    // It must open downward and stay on screen — a menu anchored to a top bar that
    // opens upward is off the viewport entirely.
    const triggerBox = await trigger.boundingBox();
    const menuBox = await menu.boundingBox();
    expect(menuBox!.y).toBeGreaterThan(triggerBox!.y);
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(MOBILE.width + 1);

    await page.screenshot({ path: path.join(SCREENSHOTS, "shell-mobile-menu.png") });
  });
});
