import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * The engine suite is pure functions and runs fastest on plain node.
     *
     * Convex function tests need `edge-runtime` instead, but they opt in per file with a
     * `@vitest-environment edge-runtime` docblock rather than switching the default —
     * flipping it globally would move ~345 engine cases onto a slower VM for no reason.
     */
    environment: "node",
    include: ["src/**/*.test.ts", "convex/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
