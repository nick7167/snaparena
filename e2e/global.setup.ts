import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  PERSISTENT_EMAIL,
  SCREENSHOTS,
  captureDailyAnswers,
  ensureClerkUser,
  signInAs,
} from "./helpers";

/**
 * One-time setup: a testing token, a signed-in storage state, and today's answers.
 *
 * Serial because the steps genuinely depend on each other — the token has to exist
 * before anything can sign in, and the account has to exist before its state can be
 * saved.
 */
setup.describe.configure({ mode: "serial" });

const AUTH_FILE = path.join(__dirname, "../playwright/.clerk/user.json");

setup("clerk testing token", async () => {
  // Fetches a Testing Token, which is what lets automated sign-ins through Clerk's bot
  // detection. Without it a dev instance will start challenging these requests.
  await clerkSetup();
  mkdirSync(SCREENSHOTS, { recursive: true });
});

setup("today's daily answers", async () => {
  // Best-effort. A run that cannot learn the answers falls back to passing every round,
  // which still exercises the whole mode — so this must never fail the suite.
  const answers = await captureDailyAnswers();
  console.log(
    answers
      ? `daily answers captured for ${answers.date}: ${answers.titles.length} tracks`
      : "daily answers unavailable — specs will pass every round instead",
  );
});

setup("sign in and save state", async ({ page }) => {
  await ensureClerkUser(PERSISTENT_EMAIL);
  await signInAs(page, PERSISTENT_EMAIL);

  await page.goto("/");

  /**
   * Clear the welcome flow if this is the account's first run.
   *
   * `WelcomeGate` REDIRECTS to /welcome rather than opening a modal over the app, which is
   * what this used to have to deal with. That makes the check simpler and far more robust:
   * the URL is the state, so there is no race between `users.me` resolving and an overlay
   * committing, and no way to mistake "not shown yet" for "not needed".
   */
  await completeWelcomeIfShown(page);

  /**
   * Wait for the Convex row before saving.
   *
   * `UserProvisioner` creates the user document client-side after sign-in, and the sidebar
   * renders off the same `users.me` query — so until it resolves there is nothing to
   * assert against, and a storage state saved early belongs to an account that is not
   * fully set up.
   */
  await expect(
    page.getByRole("button", { name: "Account menu" }).first(),
  ).toBeVisible({ timeout: 30_000 });

  /**
   * Prove it before saving.
   *
   * The failure this prevents is silent: a storage state is just a cookie jar, so it
   * cannot record "and setup is done". If the gate still fires, every spec that inherits
   * this state is broken, and the cause is nowhere near the symptom.
   */
  await expect(page).not.toHaveURL(/\/welcome/);

  await page.context().storageState({ path: AUTH_FILE });
});

/**
 * Gets the persistent account through the welcome flow, once.
 *
 * Idempotent: `WelcomeGate` stops redirecting the moment `onboardedAt` is set, so on every
 * subsequent run this returns immediately. Dedicated coverage of the flow itself lives in
 * new-player.spec.ts against a throwaway account — this exists only so the shared user gets
 * past it.
 *
 * Only the username step is completed. Everything after it is skippable by design, and the
 * setup project has no business spending two minutes of a coached tutorial to produce a
 * cookie jar.
 */
async function completeWelcomeIfShown(page: import("@playwright/test").Page) {
  // The gate redirects, so the URL is the signal. A short wait rather than an immediate
  // check: the redirect happens in an effect after `users.me` resolves.
  const redirected = await page
    .waitForURL(/\/welcome/, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (!redirected) return;

  // Step 0 is the intro; step 1 is the username.
  await page.getByRole("button", { name: "Get started" }).click();

  const submit = page.getByRole("button", { name: "Continue" });
  // The handle is pre-filled and its availability is checked live; wait for that round
  // trip rather than clicking a disabled control.
  await expect(submit).toBeEnabled({ timeout: 20_000 });
  await submit.click();

  // Past the required step. Leaving is allowed from here — the gate will not fire again.
  await page.goto("/");
}
