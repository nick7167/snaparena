import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * The engine suite is pure functions and runs fastest on plain node.
     *
     * It is also the regression net for the SpacetimeDB port: the module imports
     * `src/engine/` rather than reimplementing any of it, so these 378 cases are
     * what prove the scoring curve, Elo, XP, badges and rank thresholds did not
     * move when the backend changed underneath them.
     *
     * Backend tests used to live in `convex/` and run under `edge-runtime`. They
     * are being replaced by integration tests that drive a local `spacetime
     * start` instance, which need neither a special environment nor a mock.
     */
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
