/**
 * Captures the screens that only exist inside a live match.
 *
 * The sweep spec photographs every route, but a duel is state inside /ranked rather than
 * a route of its own — so the ban draft and the VS reveal are unreachable by navigation.
 * This drives a real bot match far enough to photograph both, then the guessing screen.
 *
 * Temporary: delete after use.
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";

const OUT = path.join(process.cwd(), "e2e", "screenshots");
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  await page.addStyleTag({
    content: `nextjs-portal, [data-nextjs-dev-tools-button], [data-nextjs-toast] { display: none !important; }`,
  }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("captured", name);
};

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const context = await browser.newContext({
  storageState: "playwright/.clerk/user.json",
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();

// ---------------------------------------------------------------- back nav
await page.goto("http://localhost:3000/leaderboard");
await page.waitForSelector("ol > li", { timeout: 30_000 });
await shot(page, "new-leaderboard-tier-ladder");

await page.locator("ol > li").first().getByRole("link").first().click();
await page.waitForURL(/\/u\//, { timeout: 20_000 });
await page.waitForTimeout(1500);
await shot(page, "new-profile-trophy-hero");

// The back control should name where we actually came from, not a fixed parent.
const backLabel = await page
  .locator("header a")
  .first()
  .innerText()
  .catch(() => "(none)");
console.log("back control reads:", JSON.stringify(backLabel.trim()));

// ---------------------------------------------------------------- the duel
await page.goto("http://localhost:3000/ranked");
await page.waitForTimeout(1500);

const findMatch = page.getByRole("button", { name: "Find a match" });
if (await findMatch.isVisible().catch(() => false)) await findMatch.click();

const playBot = page.getByRole("button", { name: /Play a bot instead/ });
await playBot.waitFor({ timeout: 30_000 });
await playBot.click();

// The ban draft comes first. Ban until it is someone else's problem.
const draftHeading = page.getByRole("heading", { name: /Ban a category|is banning/ });
await draftHeading.waitFor({ timeout: 30_000 });
await page.waitForTimeout(800);
await shot(page, "new-duel-ban-draft");

for (let i = 0; i < 12; i++) {
  if (!(await draftHeading.isVisible().catch(() => false))) break;
  const choice = page.locator("button:not([disabled])").filter({ hasNotText: /dev|Win|Lose|Random/ });
  const count = await choice.count();
  let clicked = false;
  for (let c = 0; c < count; c++) {
    const b = choice.nth(c);
    const box = await b.boundingBox().catch(() => null);
    // The category tiles are the tall ones; skip the small dev-bar controls.
    if (box && box.height >= 56) {
      await b.click().catch(() => {});
      clicked = true;
      break;
    }
  }
  if (!clicked) await page.waitForTimeout(1200);
  await page.waitForTimeout(900);
}

// VS reveal is a 5s phase — catch it the moment it lands.
const vs = page.getByText("VS", { exact: true });
await vs.waitFor({ timeout: 60_000 });
await page.waitForTimeout(1400); // let the sequenced beats resolve
await shot(page, "new-vs-reveal-chamfer-split");

// Then the round itself.
await page
  .getByRole("combobox", { name: "Your guess" })
  .waitFor({ timeout: 60_000 })
  .catch(() => {});
await page.waitForTimeout(600);
await shot(page, "new-duel-guessing");

await browser.close();
console.log("done");
