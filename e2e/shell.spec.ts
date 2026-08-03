import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, assertOnboarded, hideDevOverlay } from "./helpers";

/**
 * The application shell: sidebar on desktop, tab bar on mobile.
 *
 * The shape being verified is a deliberate one. Play is the primary action and it sits at
 * the BOTTOM of the sidebar — above the level meter, above the account menu — rather than
 * at the top under the wordmark. The nav is a list of places; Play is the thing you came
 * to do, and it lives in the corner the hand already rests in.
 *
 * Order assertions are done with bounding boxes rather than DOM position, because the DOM
 * order and the visual order are allowed to differ and it is the visual one that is the
 * design decision.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

const sidebarMenu = (page: Page) =>
  page.locator("aside").getByRole("button", { name: "Account menu" });
const mobileMenu = (page: Page) =>
  page.locator("header").getByRole("button", { name: "Account menu" });

/** The sidebar's primary action. Matched by its caption so it cannot collide with the
 *  mobile tab bar's Play control, which carries an aria-label instead. */
const sidebarPlay = (page: Page) =>
  page.locator("aside").getByRole("link", { name: /PLAY/ });

test.beforeEach(async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account menu" }).first()).toBeVisible();
  await assertOnboarded(page);
});

test.describe("sidebar", () => {
  test.use({ viewport: DESKTOP });

  test("leads with Play, above the level bar and the account menu", async ({ page }) => {
    await page.goto("/");
    await hideDevOverlay(page);

    const aside = page.locator("aside");
    const play = sidebarPlay(page);
    const trigger = sidebarMenu(page);

    await expect(play).toBeVisible();
    // Signed in, Play means ranked. Signed out it means the daily — covered in
    // landing.spec.ts, which is the only project that runs without a session.
    await expect(play).toHaveAttribute("href", "/ranked");

    // Level is XP and is shown during placements too — the old block hid it entirely
    // until a player had placed, which is exactly when it is most motivating.
    await expect(aside.getByText(/^LVL \d+$/)).toBeVisible();
    await expect(aside.getByText(/\d+ XP to Level \d+/)).toBeVisible();
    await expect(
      aside.getByRole("progressbar", { name: /Level \d+: \d+ of \d+ XP/ }),
    ).toBeVisible();

    // Identity is the chosen handle, not the Google display name.
    await expect(trigger).toContainText(/^@[a-z0-9_]+/);

    // The whole layout decision, in three numbers: Play over level over account.
    const playBox = (await play.boundingBox())!;
    const levelBox = (await aside.getByText(/^LVL \d+$/).boundingBox())!;
    const menuBox = (await trigger.boundingBox())!;
    expect(playBox.y).toBeLessThan(levelBox.y);
    expect(levelBox.y).toBeLessThan(menuBox.y);

    /**
     * Bounded on both sides, so it can neither drift back into a slab nor collapse below
     * the 44px touch target. The upper bound moved from 60 to 96 when the control gained
     * a labelled rank, rating and last-match row — three rows of named information do not
     * fit in one, and the point of the change was that no number goes unexplained.
     */
    expect(playBox.height).toBeGreaterThanOrEqual(44);
    expect(playBox.height).toBeLessThanOrEqual(96);

    /**
     * Every figure on the control is labelled — that is the whole reason it grew. A bare
     * "941" told you nothing about what 941 was.
     *
     * No word boundaries: the label and the value are separate spans, so the text content
     * runs together as "PLAY941RATING" and `\b` never matches between "Y" and "9".
     */
    await expect(play).toContainText(/\d{3,4}|to place/);
    await expect(play).toContainText(/RATING|to place/i);

    await page.screenshot({ path: path.join(SCREENSHOTS, "shell-sidebar.png") });
  });

  test("carries every mode, including practice", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("aside").getByRole("navigation", { name: "Main" });

    for (const [label, href] of [
      ["Daily", "/daily"],
      ["Ranked", "/ranked"],
      ["Practice", "/practice"],
      ["Rooms", "/rooms"],
      ["Board", "/leaderboard"],
    ] as const) {
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  test("marks the current route", async ({ page }) => {
    await page.goto("/practice");
    const link = page.locator("aside").getByRole("link", { name: "Practice" });
    await expect(link).toHaveAttribute("aria-current", "page");
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

    await hideDevOverlay(page);
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

  test("hands the whole screen to a live match", async ({ page }) => {
    // Immersive mode: a navigation bar within thumb reach of the guess field is a way to
    // lose a round by accident, so the chrome unmounts for the duration.
    await page.goto("/daily");
    const start = page.getByRole("button", { name: "Start" });
    if (!(await start.isVisible().catch(() => false))) test.skip();

    await start.click();
    // `.first()`: the run header and the countdown both say "Song 1 of 5".
    await expect(page.getByText("Song 1 of 5").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("aside")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: MOBILE });

  test("raises Play out of the tab bar", async ({ page }) => {
    await page.goto("/");
    await hideDevOverlay(page);

    // The sidebar is gone at this width; the tab bar carries navigation instead.
    await expect(page.locator("aside")).toBeHidden();

    const bar = page.getByRole("navigation", { name: "Main" });
    const play = bar.getByRole("link", { name: "Play" });
    await expect(play).toBeVisible();
    await expect(play).toHaveAttribute("href", "/ranked");

    // Two tabs either side, and Ranked is deliberately absent — Play IS ranked, and
    // listing it twice would make the gold button look like a shortcut to something
    // ordinary.
    for (const label of ["Daily", "Board", "Rooms", "Practice"]) {
      await expect(bar.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(bar.getByRole("link", { name: "Ranked", exact: true })).toHaveCount(0);

    // Raised, not merely coloured: its top edge sits above the bar's.
    const playBox = (await play.boundingBox())!;
    const barBox = (await bar.boundingBox())!;
    expect(playBox.y).toBeLessThan(barBox.y);

    // Still a legal touch target after all that.
    expect(playBox.height).toBeGreaterThanOrEqual(44);
    expect(playBox.width).toBeGreaterThanOrEqual(44);

    // And it must not have pushed itself off the top of its own bar into the content.
    const tab = (await bar.getByRole("link", { name: "Daily" }).boundingBox())!;
    expect(tab.height).toBeGreaterThanOrEqual(44);

    await page.screenshot({ path: path.join(SCREENSHOTS, "shell-mobile-tabbar.png") });
  });

  test("moves the account menu into the top bar", async ({ page }) => {
    await page.goto("/");

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
    const triggerBox = (await trigger.boundingBox())!;
    const menuBox = (await menu.boundingBox())!;
    expect(menuBox.y).toBeGreaterThan(triggerBox.y);
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(MOBILE.width + 1);

    await hideDevOverlay(page);
    await page.screenshot({ path: path.join(SCREENSHOTS, "shell-mobile-menu.png") });
  });

  test("reserves room for the tab bar", async ({ page }) => {
    /**
     * `pb-20` on <main> is what stops the last control on a long page sitting under the
     * fixed bar. Asserted as padding rather than by comparing the two boxes: on a short
     * page the content never reaches the bar at all, so a geometric comparison passes for
     * the wrong reason and fails on exactly the pages where it matters least.
     */
    await page.goto("/settings");
    const bar = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
    const padding = await page
      .locator("main")
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));

    expect(padding, "content can scroll under the tab bar").toBeGreaterThanOrEqual(
      bar.height,
    );
  });
});
