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
   * Wait for the Convex row before deciding anything about onboarding.
   *
   * Order is load-bearing and got this wrong once. `UserProvisioner` creates the user
   * document client-side after sign-in, and BOTH the sidebar and `OnboardingGate` render
   * off the same `users.me` query — so until it resolves, neither exists. Checking for
   * the modal first found nothing, skipped onboarding, and saved a storage state whose
   * account was still un-onboarded. Every later spec then timed out clicking a sidebar
   * that renders perfectly happily *behind* the modal's full-screen overlay.
   */
  await expect(
    page.getByRole("button", { name: "Account menu" }).first(),
  ).toBeVisible({ timeout: 30_000 });

  await completeOnboardingIfShown(page);

  /**
   * Prove it before saving.
   *
   * The failure this prevents is silent: a storage state is just a cookie jar, so it
   * cannot record "and onboarding is done". If the modal is still up, every spec that
   * inherits this state is broken, and the cause is nowhere near the symptom.
   */
  await expect(page.getByRole("dialog", { name: "Pick your username" })).toHaveCount(0);

  await page.context().storageState({ path: AUTH_FILE });
});

/**
 * Clears the onboarding gate if this is the account's first run.
 *
 * Idempotent: `OnboardingGate` renders nothing once `onboardedAt` is set, so on every
 * subsequent run this is a no-op. Dedicated onboarding coverage lives in
 * new-player.spec.ts against a throwaway account — this exists only so the persistent
 * user gets past it once.
 */
async function completeOnboardingIfShown(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog", { name: "Pick your username" });

  // A short wait, not `isVisible()` — that is an immediate check and returns false
  // during the frame between `users.me` resolving and the gate committing.
  const shown = await dialog
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (!shown) return;

  const start = dialog.getByRole("button", { name: "Start playing" });
  // The handle is pre-filled and checked for availability live; wait for that round
  // trip rather than clicking a disabled control.
  await expect(start).toBeEnabled({ timeout: 20_000 });
  await start.click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}
