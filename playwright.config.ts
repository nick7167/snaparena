import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

/**
 * Browser-level verification.
 *
 * This exists because a whole UI overhaul once shipped with "I could not verify this" in
 * the completion report — unit tests, typecheck and lint all passed and nobody had looked
 * at the screen. The value here is screenshots and a handful of high-value assertions,
 * NOT exhaustive coverage: a brittle end-to-end suite is worse than none.
 */

dotenv.config({ path: ".env.local", quiet: true });

// @clerk/testing looks for CLERK_PUBLISHABLE_KEY; this project stores it under the
// Next-prefixed name, which is the one the browser needs. Bridge rather than duplicate,
// so there is still exactly one place the key is written down.
process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const BASE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",

  /**
   * Serial, one worker.
   *
   * Not a performance compromise — a correctness one. The daily challenge allows one run
   * per identity per day, so two workers sharing the signed-in storage state would race
   * for the same single run and one of them would lose. The box also has ~2.7GB of RAM
   * free, which is one Chromium's worth.
   */
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  // A real daily run is five songs of server-driven pacing — countdown, guessing, reveal
  // — which lands around 60-90s of genuine wall clock. This is not slack for slow
  // assertions; it is the length of the thing being tested.
  timeout: 120_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        /**
         * Without this the game is untestable.
         *
         * Headless Chromium blocks autoplay, `audio.play()` rejects, and
         * useRoundAudio sets `playback-blocked` — so every guessing screen renders
         * "Your browser blocked audio playback" instead of the waveform, and no round
         * can ever be played.
         */
        "--autoplay-policy=no-user-gesture-required",
        // Audible output from a headless browser on a dev box helps nobody.
        "--mute-audio",
      ],
    },
  },

  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      // Everything that needs an account. Reuses the signed-in state captured by setup
      // rather than signing in per spec.
      name: "authed",
      // DEV ONLY — drop `dev-rank-bots` from this list with convex/devbots.ts.
      testMatch: /(shell|new-player|sweep|dev-rank-bots)\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.clerk/user.json",
      },
    },
    {
      /**
       * Signed out, deliberately no storageState.
       *
       * The daily is the one mode playable without an account, and guest identity is a
       * localStorage token — so a fresh context is a fresh player. That makes this the
       * only spec that can drive a complete daily run on every single execution.
       */
      name: "guest",
      testMatch: /guest-daily\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * Only Next needs starting.
   *
   * Convex functions are already deployed and the browser talks to the dev deployment
   * over its own WebSocket; `convex dev` is a code-push watcher, and nothing here changes
   * backend code. Starting it would just add a process that races on stdin.
   */
  webServer: {
    command: "npm run dev:next",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
