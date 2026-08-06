import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClerkClient } from "@clerk/backend";
import { clerk } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";

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
 * Removes the Convex side of a throwaway account.
 *
 * Deleting the Clerk user is not enough. The Convex row survives it, and with it the
 * account's `dailyRuns` entry — which, unlike the global leaderboard, the daily board
 * does not filter. Without this, every run of this suite parks another synthetic top
 * score on the board a real player sees.
 */
export async function purgeConvexUser(handle: string): Promise<void> {
  const secret = process.env.ADMIN_IMPORT_SECRET;
  if (!secret) {
    console.warn("ADMIN_IMPORT_SECRET not set locally — leaving the test row behind");
    return;
  }

  try {
    await run("npx", [
      "convex", "run", "admin:purgeTestUser",
      JSON.stringify({ secret, handle }),
    ], { cwd: path.join(__dirname, "..") });
  } catch (error) {
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
 * Hides Next's dev-mode indicator.
 *
 * It is a fixed badge in the bottom-left corner — exactly where the sidebar's account
 * menu lives — so it sits on top of the one control this suite exists to photograph. It
 * is dev-server furniture and never ships, so removing it from screenshots is showing
 * the truth rather than hiding a defect.
 */
export async function hideDevOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `nextjs-portal, [data-nextjs-dev-tools-button], #__next-build-watcher,
              [data-nextjs-toast] { display: none !important; }`,
  });
}

/**
 * Turns on the win / lose / random bar over a live duel.
 *
 * The bar is gated twice: `DEV_RANK_BOTS` on the deployment licenses it to exist, and a
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
    const challenges = await convexData<{ date: string; trackIds: string[] }>(
      "dailyChallenges",
    );
    const todays = challenges.find((row) => row.date === today);
    if (!todays) return null;

    /**
     * The limit has to clear the whole catalogue, and it silently did not.
     *
     * `convex data` truncates at `--limit`, so any daily track sitting past the cut
     * resolved to `""` — and an empty answer is falsy, so the specs quietly passed that
     * round instead of solving it. A run that should have scored five ended up scoring
     * two, which looked like broken guess submission rather than a short read. It was
     * 2000 against a catalogue of 2244.
     *
     * Kept well ahead of the catalogue rather than exact, and the shortfall is now
     * reported instead of being absorbed into a blank string.
     */
    const tracks = await convexData<{ _id: string; title: string }>("tracks", 20_000);
    const byId = new Map(tracks.map((track) => [track._id, track.title]));

    const titles = todays.trackIds.map((id) => byId.get(id) ?? "");
    const missing = titles.filter((title) => title === "").length;
    if (missing > 0) {
      console.warn(
        `${missing} of ${titles.length} daily answers could not be resolved from ` +
          `${tracks.length} tracks — those rounds will be passed rather than solved.`,
      );
    }

    const answers = { date: today, titles };
    writeFileSync(ANSWERS_PATH, JSON.stringify(answers, null, 2));
    return answers;
  } catch {
    return null;
  }
}

/**
 * `npx convex data <table> --format jsonLines`, parsed.
 *
 * `jsonLines` rather than the default `pretty`: the human format is a padded column
 * table whose cells would have to be split on `|`, and a track title containing that
 * character would silently corrupt the row.
 */
async function convexData<T>(table: string, limit = 100): Promise<T[]> {
  const { stdout } = await run(
    "npx",
    ["convex", "data", table, "--limit", String(limit), "--format", "jsonLines"],
    { cwd: path.join(__dirname, ".."), maxBuffer: 64 * 1024 * 1024 },
  );

  const rows: T[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      rows.push(JSON.parse(trimmed) as T);
    } catch {
      // Not a document line.
    }
  }
  return rows;
}
