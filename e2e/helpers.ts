import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClerkClient } from "@clerk/backend";
import { clerk } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";
// Authenticated, so it can read the answer key. `track` and `daily_challenge` are private
// tables — the app's own `src/app/sql.ts` deliberately cannot see them.
import { ownerSql } from "../scripts/stdb-token.ts";

const run = promisify(execFile);

export const ANSWERS_PATH = path.join(__dirname, ".answers.json");
export const SCREENSHOTS = path.join(__dirname, "screenshots");

/**
 * The persistent signed-in identity.
 *
 * `+clerk_test` is Clerk's own convention for test addresses on a development instance:
 * no mail is ever delivered, and the account is recognisable as synthetic in the
 * dashboard rather than looking like a real signup.
 */
export const PERSISTENT_EMAIL =
  process.env.E2E_CLERK_USER_EMAIL ?? "snap-e2e+clerk_test@example.com";

function clerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY missing — is .env.local loaded?");
  return createClerkClient({ secretKey });
}

/**
 * Finds or creates a Clerk user, and returns its id.
 *
 * Idempotent on purpose: the suite has to survive being run twice in a row, and a setup
 * that creates a duplicate on the second run would fail on the unique-email constraint.
 */
export async function ensureClerkUser(emailAddress: string): Promise<string> {
  const client = clerkClient();

  const existing = await client.users.getUserList({ emailAddress: [emailAddress] });
  if (existing.data.length > 0) return existing.data[0].id;

  const created = await client.users.createUser({
    emailAddress: [emailAddress],
    // Long and random: this password is never typed, because sign-in goes through
    // Clerk's testing token rather than the form. It exists only because the instance
    // may require one.
    password: `E2e!${Math.random().toString(36).slice(2)}${Date.now()}`,
    skipPasswordChecks: true,
  });

  return created.id;
}

export async function deleteClerkUser(userId: string): Promise<void> {
  try {
    await clerkClient().users.deleteUser(userId);
  } catch {
    // A failed cleanup must never fail the run it is cleaning up after. Worst case a
    // throwaway account is left in a development instance.
  }
}

/**
 * Removes the database side of a throwaway account.
 *
 * Deleting the Clerk user is not enough. The player row survives it, and with it the
 * account's daily run — which, unlike the global leaderboard, the daily board does not
 * filter. Without this, every run of this suite parks another synthetic top score on the
 * board a real player sees.
 *
 * NO SECRET ANY MORE. This shelled out to `npx convex run admin:purgeTestUser` with
 * ADMIN_IMPORT_SECRET, a password shared between `.env.local` and the deployment. The
 * module checks `ctx.sender` against `module_owner` instead, so the CLI's own login is
 * the credential and `spacetime call` is the whole thing. The reducer refuses any handle
 * outside the `e2e` prefix, which is the property that makes an account-deleting call
 * safe to have at all.
 */
export async function purgeTestUser(handle: string): Promise<void> {
  const database = process.env.NEXT_PUBLIC_SPACETIMEDB_DB;
  if (!database) {
    console.warn("NEXT_PUBLIC_SPACETIMEDB_DB not set — leaving the test row behind");
    return;
  }

  try {
    await run(
      "spacetime",
      [
        "call",
        database,
        "--server",
        process.env.SPACETIMEDB_SERVER ?? "maincloud",
        "purge_test_user",
        JSON.stringify(handle),
      ],
      { cwd: path.join(__dirname, "..") },
    );
  } catch (error) {
    // A failed cleanup must never fail the run it is cleaning up after.
    console.warn(`could not purge ${handle}:`, error);
  }
}

/**
 * Signs in without touching the UI.
 *
 * There IS a real `/sign-in` route now, and auth.spec.ts drives it — but not to
 * completion. Signing in through the form on every spec would mean either storing a real
 * password in the repo or completing an emailed code, and it would mint accounts against
 * a live Clerk instance on every run. `clerk.signIn` with an email address mints a
 * server-side token instead, which per Clerk's documentation "bypasses all verification
 * steps".
 *
 * The division of labour: this gets a session, auth.spec.ts proves the form is ours and
 * behaves.
 */
export async function signInAs(page: Page, emailAddress: string): Promise<void> {
  // Clerk must be loaded on the page before the helper can drive it.
  await page.goto("/");
  await clerk.loaded({ page });
  // The `emailAddress` overload is the ticket strategy: it looks the user up, mints a
  // sign-in token through the backend API and redeems it. No password, no emailed code,
  // and `setupClerkTestingToken` is applied internally so bot detection is bypassed too.
  await clerk.signIn({ page, emailAddress });
}

/**
 * Hides Next's dev-mode indicator, and this app's own dev pill.
 *
 * Both are fixed badges that never ship, so removing them from screenshots is showing the
 * truth rather than hiding a defect.
 *
 * The app's own pill was added here after it turned out to be doing more than sitting in
 * a screenshot: at `z-60` in the bottom-left it covered the sidebar's account menu, and in
 * the 64px tablet rail it swallowed the button entirely — Playwright reported it as
 * "intercepts pointer events" rather than as anything to do with the dev panel. The pill
 * has since moved to the bottom right, so this is belt and braces: a dev affordance must
 * never be able to decide whether a test passes.
 */
export async function hideDevOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `nextjs-portal, [data-nextjs-dev-tools-button], #__next-build-watcher,
              [data-nextjs-toast], [data-dev-panel] { display: none !important; }`,
  });
}

/**
 * Turns on the win / lose / random bar over a live duel.
 *
 * The bar is gated three times: developer features on the deployment license it to exist,
 * the admin role decides who may use it, and a
 * per-browser toggle decides whether it renders. Only the first is set up for this suite —
 * the second lives in localStorage and is off by default, deliberately, so a dev tool
 * cannot wander into a screenshot. Nothing was switching it on, which is why any spec
 * reaching for "Random" waited out its timeout against a bar that was never going to
 * appear.
 *
 * Must be called BEFORE the first navigation: `addInitScript` applies to subsequent loads,
 * and the toggle is read once when the component mounts.
 */
export async function enableResolveBar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "songrace:dev-tools",
        JSON.stringify({ resolveBar: true, layoutOutlines: false }),
      );
    } catch {
      // A browser without storage just does without the fast path.
    }
  });
}

/**
 * Fails fast if the account was never taken through the welcome flow.
 *
 * `WelcomeGate` redirects to /welcome rather than rendering an overlay, which makes this a
 * far better check than it used to be: a spec on the wrong URL fails immediately and says
 * why, instead of spending its whole timeout retrying clicks against a page that is no
 * longer the one it thinks it is.
 *
 * Call it at the top of any spec that assumes a set-up account.
 */
export async function assertOnboarded(page: Page): Promise<void> {
  if (new URL(page.url()).pathname.startsWith("/welcome")) {
    throw new Error(
      "Redirected to the welcome flow: the persistent test account has no username. " +
        "Delete playwright/.clerk/user.json and re-run the setup project.",
    );
  }
}

/**
 * Submits a guess no faster than a person could produce one.
 *
 * `validateClientClock` rejects anything under `MIN_HUMAN_REACTION_MS` (350ms) as
 * physically impossible — correctly, it is the anti-cheat floor. Playwright fills a
 * field and presses Enter in a fraction of that, so a *correct* answer submitted the
 * instant the input enables is discarded by the server and the round silently scores
 * zero. That is what produced a "0/5 named, 0 pts" run against a fixture whose answers
 * were all right, and it failed intermittently because it was a race with the clock.
 *
 * The wait is therefore load-bearing, not a papered-over race: the test has to act like
 * a player for the server to treat it as one. 1.2s still lands inside the SNAP tier.
 */
export async function guessLikeAHuman(page: Page, text: string): Promise<void> {
  const field = page.getByRole("combobox", { name: "Your guess" });
  await expect(field).toBeEnabled({ timeout: 45_000 });
  await page.waitForTimeout(1_200);
  await field.fill(text);
  await field.press("Enter");
}

/**
 * Types a title one character at a time, asserting the suggestion list never blanks.
 *
 * Deliberately separate from `guessLikeAHuman`, which uses `fill()` and therefore fires a
 * single change event. That is why the bug this guards was invisible to the suite for so
 * long: the list opened once and the race that closed it never ran.
 *
 * The real failure was that every keystroke restarted a server query, and the loading state
 * emptied the list — so anyone typing faster than their round-trip saw nothing at all, and
 * had to delete and retype slowly to get a suggestion.
 *
 * Does not press Enter: a partial title submits as a wrong guess and costs the caller a
 * five-second input lockout.
 */
export async function typeAndKeepSuggestionsOpen(page: Page, text: string): Promise<void> {
  const field = page.getByRole("combobox", { name: "Your guess" });
  const list = page.getByRole("listbox", { name: "Track suggestions" });

  await expect(field).toBeEnabled({ timeout: 45_000 });
  await field.click();

  for (const character of text) {
    await field.pressSequentially(character, { delay: 30 });
  }

  /**
   * Zero timeout, and that is the entire point of this assertion.
   *
   * At the default 15s expect timeout this test passes against the BROKEN code, because a
   * Convex round-trip resolves long inside it. The claim being made is that the suggestion
   * is already on screen — not that it arrives eventually.
   */
  await expect(list).toBeVisible({ timeout: 0 });
}

export interface DailyAnswers {
  date: string;
  titles: string[];
}

/**
 * Today's answers, read from the dev deployment through the Convex CLI.
 *
 * Deliberately NOT a query. Nothing in the app exposes the current daily's track titles,
 * and that is correct — a client that can read them can cheat. The CLI reads the database
 * directly with the developer's own credentials, so the test can know the answers without
 * a single line being added to the app to let it.
 *
 * Returns null rather than throwing: a run that cannot learn the answers should fall back
 * to passing every round, not fail.
 */
export async function loadDailyAnswers(): Promise<DailyAnswers | null> {
  if (!existsSync(ANSWERS_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(ANSWERS_PATH, "utf8")) as DailyAnswers;
    const today = new Date().toISOString().slice(0, 10);
    // Yesterday's answers are worse than none — they would send confident wrong guesses.
    return parsed.date === today && parsed.titles.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Writes the fixture. Called once from global setup. */
export async function captureDailyAnswers(): Promise<DailyAnswers | null> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    /**
     * A JOIN rather than two reads and a lookup table.
     *
     * The Convex version could not do this — `convex data` dumps one table at a time —
     * so it pulled the whole catalogue and matched in memory, and truncated at `--limit`
     * while doing it. Any daily track past the cut resolved to `""`, and an empty answer
     * is falsy, so the specs quietly PASSED that round instead of solving it: a run that
     * should have scored five scored two, and it looked like broken guess submission
     * rather than a short read. Asking the database for the five rows that matter cannot
     * have that failure.
     *
     * The setlist is not ordered by the join, so the ids are re-sorted below into the
     * order the challenge stores them — which is the order the rounds are played in.
     */
    const setlist = await ownerSql(
      `SELECT trackIds FROM daily_challenge WHERE date = '${today.replace(/'/g, "")}'`,
    );
    const trackIds = setlist.rows[0]?.[0] as (string | number | bigint)[] | undefined;
    if (!trackIds || trackIds.length === 0) return null;

    const idList = trackIds.map((id) => String(id));
    const titleRows = await ownerSql(
      `SELECT id, title FROM track WHERE id IN (${idList.join(", ")})`,
    );

    const byId = new Map<string, string>();
    for (const row of titleRows.rows) byId.set(String(row[0]), String(row[1]));

    const titles = idList.map((id) => byId.get(id) ?? "");
    const missing = titles.filter((title) => title === "").length;
    if (missing > 0) {
      console.warn(
        `${missing} of ${titles.length} daily answers could not be resolved — ` +
          `those rounds will be passed rather than solved.`,
      );
    }

    const answers = { date: today, titles };
    writeFileSync(ANSWERS_PATH, JSON.stringify(answers, null, 2));
    return answers;
  } catch {
    return null;
  }
}

