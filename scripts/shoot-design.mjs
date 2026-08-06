/**
 * Photograph /design, which the e2e suite structurally cannot reach.
 *
 * The suite runs against a production build and `design/page.tsx` calls `notFound()` in
 * production — deliberately, so the gallery never ships. That makes a dev server the only
 * way to see it, and a dev server cannot live inside the Playwright run: its webServer
 * teardown SIGTERMs the whole process group. So this owns the server itself.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "@playwright/test";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(process.cwd(), "e2e", "screenshots");

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  stdio: "ignore",
  detached: false,
});

async function waitForServer(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/design`, { signal: AbortSignal.timeout(4_000) });
      if (response.ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return false;
}

let failed = false;
try {
  if (!(await waitForServer())) throw new Error("dev server never answered on /design");

  const browser = await chromium.launch();
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    await page.goto(`${BASE}/design`, { waitUntil: "networkidle", timeout: 120_000 });
    // Next's dev indicator is fixed furniture and never ships; same rule as the suite.
    await page.addStyleTag({
      content: `nextjs-portal, [data-nextjs-dev-tools-button], [data-nextjs-toast] {
                  display: none !important; }`,
    });
    await page.screenshot({
      path: path.join(OUT, `design-gallery-${viewport.name}.png`),
      fullPage: true,
    });
    console.log(`captured design-gallery-${viewport.name}.png`);
    await page.close();
  }
  await browser.close();
} catch (error) {
  failed = true;
  console.error("design capture failed:", error.message);
} finally {
  server.kill("SIGTERM");
}

process.exit(failed ? 1 : 0);
