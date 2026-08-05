import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { SCREENSHOTS, assertOnboarded, hideDevOverlay } from "./helpers";

/**
 * The leaderboard, profiles, and the rank emblem that appears on both.
 *
 * This file exists because of three reported defects, and each has a test named after
 * what actually went wrong rather than after the component:
 *
 *   1. The leaderboard and the sidebar showed a CSS chamfer plate while the profile
 *      showed the generated artwork. `RankEmblem` only rendered the artwork at lg/xl and
 *      fell back to the plate below that — so the two places a rank is seen most often
 *      showed a different object than the place it is seen most carefully.
 *
 *   2. Every profile read "#1 global". `playerCard` kept its own copy of the board's
 *      exclusion rules and they had drifted: it excluded bots from the count of players
 *      above you while the leaderboard included the sixteen seeded rank bots, so every
 *      bot counted zero above it and every bot profile claimed the top of the ladder.
 *
 *   3. The #3 row's profile read "#5 global". The fix for (2) unified the population
 *      rule the two shared as an index filter, but the board also hid the twelve
 *      practice bots with a second filter in JS that the count never got, so it counted
 *      players the board never listed. The count now walks the same index the board
 *      lists and stops at the player's slot, which also settles ties the same way.
 *
 * Runs signed in, because the pinned "your standing" row needs a session.
 */

const DESKTOP = { width: 1280, height: 900 };

/**
 * Emblem artwork. Small sizes come from /ranks/sm/, trophy sizes from /ranks/.
 *
 * `main` and `:visible` are both load-bearing, and each fixes a different way the app
 * shell leaked into these locators. The shell carries an emblem of its own — the account
 * row renders the signed-in player's rank at `sm` — and it renders that row twice: once
 * in the sidebar, and once in the mobile top bar, which lives INSIDE main and is merely
 * hidden by CSS at desktop width.
 *
 * Neither showed up while the test account was still in placements, because a placing
 * account draws the CSS plate rather than an `<img>`. The moment it finished its
 * placements both appeared: `emblems().first()` resolved to the hidden mobile mark, and
 * the leaderboard's width sweep picked up a `boundingBox()` of null. Both tests are about
 * the emblem a player can actually see on the board and on a profile, so scope to that.
 */
const emblems = (page: Page) => page.locator('main img[src^="/ranks/"]:visible');
const smallEmblems = (page: Page) => page.locator('main img[src^="/ranks/sm/"]:visible');

test.use({ viewport: DESKTOP });

// Walking several profiles in one test means several full page loads against the dev
// deployment; the default 120s is generous but the per-test budget should be explicit.
test.beforeEach(() => {
  test.setTimeout(60_000);
});

test.describe("leaderboard", () => {
  test("every row wears the real emblem artwork", async ({ page }) => {
    await page.goto("/leaderboard");
    await assertOnboarded(page);
    await hideDevOverlay(page);

    const rows = page.locator("ol > li");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });

    const count = await rows.count();
    expect(count, "no ladder to inspect — seed the dev rank bots").toBeGreaterThan(0);

    // Artwork, not the CSS plate. At least one per row — the pinned "your standing"
    // card carries one too, and it is a sibling of the list rather than a row in it.
    expect(await smallEmblems(page).count()).toBeGreaterThanOrEqual(count);

    // And it has to have actually loaded — a broken src still matches the locator, and
    // a 404 here is exactly what a missing `npm run emblem-small` produces.
    const broken = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img[src^="/ranks/"]')).filter(
        (img) => !(img as HTMLImageElement).naturalWidth,
      ).length,
    );
    expect(broken, "an emblem image failed to load").toBe(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS, "ladder-leaderboard.png"),
      fullPage: true,
    });
  });

  test("keeps handles aligned regardless of rank", async ({ page }) => {
    /**
     * The reason small emblems are sized on a fixed box instead of on the plate.
     *
     * Emblem widths run from 480 to 896 at a constant plate width, so plate-normalised
     * sizing — which is correct at trophy size, where a Legend SHOULD outgrow a Bronze —
     * would make every row a different width and shove the handles around.
     */
    await page.goto("/leaderboard");
    /**
     * Scoped to rows, not to the whole board.
     *
     * The ladder is banded by rank tier now, and each band header carries its tier's mark
     * at `md` — which is drawn from the same /ranks/sm/ asset set as the rows but at 40px
     * rather than 28px. That is deliberate: a band header is not a row and has no handle
     * to align with. Measuring both together compared a heading against a row and failed
     * on a difference that is the design.
     */
    const marks = page.locator('main ol > li img[src^="/ranks/sm/"]:visible');
    await expect(marks.first()).toBeVisible({ timeout: 30_000 });

    const widths = new Set<number>();
    const total = Math.min(await marks.count(), 12);
    for (let index = 0; index < total; index++) {
      const box = (await marks.nth(index).boundingBox())!;
      widths.add(Math.round(box.width));
    }

    expect(
      [...widths],
      "emblem widths differ between rows, so the handles cannot be aligned",
    ).toHaveLength(1);
  });

  test("answers 'where am I?' even from outside the board", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.locator("ol > li").first()).toBeVisible({ timeout: 30_000 });

    const standing = page.getByText("Your standing");
    // Only rendered when you are not already visible in the list above — the same row
    // must never appear twice.
    if (!(await standing.isVisible().catch(() => false))) test.skip();

    const body = await page.locator("body").innerText();
    // The old copy stated where the player was NOT. Either an exact position, a bucket,
    // or an honest "not placed yet" is acceptable; "Outside the top N" is not.
    expect(body).not.toContain("Outside the top");
    expect(body).toMatch(/#[\d,]+|[\d,]+\+|Not placed yet/);
  });
});

test.describe("profile", () => {
  test("shows the trophy-sized emblem", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.locator("ol > li").first()).toBeVisible({ timeout: 30_000 });
    await page.locator("ol > li").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/u\/[a-z0-9_]+$/);

    const mark = emblems(page).first();
    await expect(mark).toBeVisible();

    // lg is 56px on the plate, so the rendered image is comfortably larger than the
    // 28px small variant — this is the size that is allowed to grow with rank.
    const box = (await mark.boundingBox())!;
    expect(box.width).toBeGreaterThan(40);

    await hideDevOverlay(page);
    await page.screenshot({
      path: path.join(SCREENSHOTS, "ladder-profile.png"),
      fullPage: true,
    });
  });

  test("does not tell everybody they are number one", async ({ page }) => {
    /**
     * The regression, stated as the symptom.
     *
     * Walks the top of the ladder and collects each profile's global-rank chip. Exactly
     * one player can be #1; if several profiles claim it, the position is being measured
     * against a different population than the board lists.
     */
    await page.goto("/leaderboard");
    const rows = page.locator("ol > li");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });

    const handles: string[] = [];
    const total = Math.min(await rows.count(), 5);
    for (let index = 0; index < total; index++) {
      const href = await rows.nth(index).getByRole("link").first().getAttribute("href");
      if (href) handles.push(href);
    }
    expect(handles.length, "not enough players to compare").toBeGreaterThan(1);

    const claims: string[] = [];
    for (const href of handles) {
      await page.goto(href);
      claims.push(await readGlobalRank(page));
    }

    const firsts = claims.filter((claim) => /^#1\b/.test(claim));
    expect(
      firsts.length,
      `${firsts.length} of ${claims.length} profiles claim #1 global: ${claims.join(", ")}`,
    ).toBeLessThanOrEqual(1);

    // And the positions have to actually differ — all reading "#7" would be the same
    // bug wearing a different number.
    expect(new Set(claims).size, `every profile reported the same position: ${claims[0]}`)
      .toBeGreaterThan(1);
  });

  test("orders positions the same way the board does", async ({ page }) => {
    // The board and the profile now share one population filter. If they drift again,
    // the player ranked above another on the list will claim a worse position on their
    // own profile.
    await page.goto("/leaderboard");
    const rows = page.locator("ol > li");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    if ((await rows.count()) < 2) test.skip();

    const hrefs: string[] = [];
    for (let index = 0; index < 2; index++) {
      hrefs.push(
        (await rows.nth(index).getByRole("link").first().getAttribute("href"))!,
      );
    }

    const positions: number[] = [];
    for (const href of hrefs) {
      await page.goto(href);
      const match = /#([\d,]+)/.exec(await readGlobalRank(page));
      // Both of the top two are past the exact-count threshold, so there is no ordering
      // to compare. Not a failure — just nothing for this test to say.
      if (!match) test.skip();
      positions.push(Number(match![1].replace(/,/g, "")));
    }

    expect(
      positions[0],
      `the player listed first claims #${positions[0]} while the second claims #${positions[1]}`,
    ).toBeLessThan(positions[1]);
  });

  test("a row's number and that player's profile are the same number", async ({ page }) => {
    /**
     * The reported defect, stated as the symptom: the #3 row's profile read "#5 global".
     *
     * The two tests above assert ordering, and ordering held right through this bug —
     * the positions came back 1, 3, 5, which is monotonic and has exactly one #1, so
     * both passed. The property that actually broke is identity. A row's number and that
     * player's own profile have to be the same number, not merely sorted the same way,
     * and only asserting equality catches a count that is measured against a population
     * the board does not list.
     */
    await page.goto("/leaderboard");
    const rows = page.locator("ol > li");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });

    // The rank is the row's first span; the link carries the handle. The rating is
    // captured too — see the comparison below.
    const listed: { href: string; rank: number; elo: number | null }[] = [];
    const total = Math.min(await rows.count(), 8);
    for (let index = 0; index < total; index++) {
      const row = rows.nth(index);
      const href = await row.getByRole("link").first().getAttribute("href");
      const rank = Number((await row.locator("span").first().innerText()).trim());
      const elo = readRating(await row.innerText());
      if (href && Number.isInteger(rank)) listed.push({ href, rank, elo });
    }
    expect(listed.length, "not enough players to compare").toBeGreaterThan(1);

    const disagreed: string[] = [];
    let compared = 0;

    for (const { href, rank, elo } of listed) {
      await page.goto(href);
      const match = /^#([\d,]+)/.exec(await readGlobalRank(page));
      // Past the exact-count threshold the chip is a bucket ("1,500+") by design, so
      // there is no number to compare. Unreachable from the top of the board, but this
      // runs against seeded data and should not fail on a thin one.
      if (!match) continue;

      /**
       * Only compare players who have not moved since the board was built.
       *
       * The board renders the ladder snapshot's rating; the profile renders the live one.
       * A player whose rating changed in the last few minutes is legitimately in a
       * different place on each — that is the design, not a defect, and asserting through
       * it would make this race the rebuild cron. When the two ratings agree the player
       * demonstrably has not moved, so the positions MUST be equal.
       *
       * The original defect involved no rating drift at all — the count was measured
       * against a population the board did not list — so it is still caught here.
       */
      const profileElo = readRating(await page.locator("main").innerText());
      if (elo === null || profileElo === null || elo !== profileElo) continue;

      compared++;
      const claimed = Number(match[1].replace(/,/g, ""));
      if (claimed !== rank) disagreed.push(`${href}: row #${rank}, profile #${claimed}`);
    }

    expect(compared, "no unmoved player to compare — is the board empty?").toBeGreaterThan(0);
    expect(disagreed, "the board and the profile disagree").toEqual([]);
  });
});

/**
 * The global-rank chip's text, once the profile has actually loaded.
 *
 * The chip is fed by `matches.card`, a Convex query — so a bare `isVisible()` immediately
 * after `goto` is answered before the round trip returns and reports "no chip" on every
 * profile in the app. Waiting for the identity card first is what makes the read
 * meaningful; the explicit `expect` on the chip then gets its own retry budget.
 */
async function readGlobalRank(page: Page): Promise<string> {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  const chip = page.getByText(/\bglobal$/).first();
  await expect(chip).toBeVisible({ timeout: 30_000 });
  return (await chip.innerText()).trim();
}

test.describe("emblem assets", () => {
  /** Every rank RankEmblem can be asked to draw. Legend has one division; the rest have
   *  three, ascending. */
  const RANKS = ["bronze", "silver", "gold", "platinum", "diamond"]
    .flatMap((tier) => [1, 2, 3].map((division) => `${tier}-${division}`))
    .concat("legend-1");

  test("both sets exist for all sixteen ranks", async ({ request }) => {
    /**
     * Asserted against the URLs rather than through /design, which is `notFound()` in
     * production and therefore unreachable in this suite.
     *
     * The failure this catches is a slice run that wrote the trophy artwork but not the
     * small variants — the app then renders broken images on the leaderboard and the
     * sidebar while the profile looks perfect, which is a hard thing to notice and
     * exactly the shape of the original defect.
     */
    expect(RANKS).toHaveLength(16);

    const missing: string[] = [];
    for (const rank of RANKS) {
      for (const url of [`/ranks/${rank}.png`, `/ranks/sm/${rank}.png`]) {
        const response = await request.get(url);
        if (!response.ok()) missing.push(`${url} (${response.status()})`);
      }
    }

    expect(missing, "run `npm run emblem-slice`").toEqual([]);
  });

  test("the small variants are actually smaller", async ({ request }) => {
    // The whole point of the second set. If they ever come out the same size, the
    // leaderboard is quietly downloading megabytes of trophy art again.
    for (const rank of ["bronze-1", "legend-1"]) {
      const full = await request.get(`/ranks/${rank}.png`);
      const small = await request.get(`/ranks/sm/${rank}.png`);
      const fullBytes = (await full.body()).length;
      const smallBytes = (await small.body()).length;

      expect(smallBytes, `${rank} small variant is not smaller`).toBeLessThan(fullBytes / 4);
    }
  });
});

/**
 * The four-figure rating out of a block of text.
 *
 * Both the board row and the profile render it as a bare number, and every other number
 * on those surfaces — rank, level, games, percentage — sits outside the Elo range, so a
 * bounded match is enough and does not need a test id on either surface.
 *
 * Returns null when nothing plausible is found, which the caller treats as "cannot
 * compare" rather than as a failure.
 */
function readRating(text: string): number | null {
  for (const raw of text.match(/\b\d{3,4}\b/g) ?? []) {
    const value = Number(raw);
    if (value >= 100 && value <= 3000) return value;
  }
  return null;
}
