"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "../../convex/_generated/api";
import { Glyph } from "@/ui/Glyph";
import { snap } from "@/ui/motion";
import { STEP } from "./welcome/steps";
import {
  DEV_TOOLS,
  getDevToolsServerSnapshot,
  getDevToolsSnapshot,
  resetDevTools,
  setDevTool,
  subscribeDevTools,
} from "@/ui/dev-tools";

/**
 * The developer tools drawer.
 *
 * TWO GATES, and both have to be open for anything here to exist. `devbots.enabled` is the
 * deployment's master switch, so with developer features off this component
 * returns null before rendering a single pixel — there is no way for a player to reach it,
 * and no toggle in localStorage can change that. The per-tool switches below are the second
 * gate, and they are local to one browser.
 *
 * That split is what makes this safe on a project running ONE shared Convex deployment for
 * both development and production: turning a tool on here cannot affect anybody else,
 * because the state never leaves the browser.
 *
 * Bottom-RIGHT on purpose, having previously been bottom-left. The account menu owns the
 * bottom of the sidebar on desktop and the "Me" tab owns the bottom-left on a phone, so
 * this sat on top of both — and at the 64px sidebar rail it covered the account menu
 * outright, making it unclickable. A dev control that covers the thing you are testing is
 * worse than no dev control. Nothing claims the bottom-right at any width.
 */
export function DevPanel() {
  const dev = useQuery(api.devbots.enabled, {});
  /**
   * The per-user half of the gate.
   *
   * `devbots.enabled` answers "does this DEPLOYMENT have dev features", which on this
   * project is one deployment shared by local development and the live site — so on its
   * own it showed this panel to every signed-in player the moment the variable went on.
   * The role answers "is this PERSON an operator", which is the question that was
   * actually being asked. Both must hold.
   */
  const me = useQuery(api.roles.amIAdmin, {});
  const setWelcomeStep = useMutation(api.tutorial.setWelcomeStep);
  const router = useRouter();
  const tools = useSyncExternalStore(
    subscribeDevTools,
    getDevToolsSnapshot,
    getDevToolsServerSnapshot,
  );
  const [open, setOpen] = useState(false);

  /**
   * `Ctrl/Cmd + .` toggles the drawer.
   *
   * Because the point of this panel is that flipping a tool is cheap. Deliberately not a
   * bare key — the app is played by typing song titles into a field under a clock, and a
   * single-key shortcut would fire mid-guess.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * Layout outlines are applied here rather than by each consumer, because the whole point
   * is to see every box at once. Toggling a class on `<html>` reaches the entire tree
   * including anything rendered in a portal.
   */
  useEffect(() => {
    document.documentElement.classList.toggle("dev-outlines", tools.layoutOutlines);
  }, [tools.layoutOutlines]);

  // The master switch. Nothing below exists unless the deployment allows dev features AND
  // the signed-in player holds the admin role. `undefined` is "still asking" for both,
  // which correctly renders nothing rather than flashing the panel and taking it away.
  if (!dev?.enabled || !me?.admin) return null;

  const activeCount = DEV_TOOLS.filter((tool) => tools[tool.key]).length;

  return (
    /**
     * Bottom RIGHT, not bottom left.
     *
     * The bottom-left corner belongs to the shell: the sidebar's account menu on desktop
     * and the "Me" tab on a phone both live there. At `z-60` this pill sat on top of both
     * — it covered the account row in every screenshot ever taken of the dashboard, and in
     * the 64px rail it covered the account menu button outright, so the control could not
     * be clicked at all. That surfaced as a Playwright timeout whose log said the dev
     * panel "intercepts pointer events", which is exactly what was happening to anyone
     * running a dev build on a tablet.
     *
     * Nothing occupies the bottom-right at any width.
     */
    <div
      // Stable hook so screenshot runs can take the whole affordance out in one rule,
      // rather than guessing at class names that change.
      data-dev-panel=""
      className="fixed right-3 bottom-3 z-[60] flex flex-col items-end gap-2 print:hidden"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.1 } }}
            transition={snap}
            style={{ originY: 1, originX: 1 }}
            role="dialog"
            aria-label="Developer tools"
            className="border-line-strong bg-ink-800 flex w-[min(20rem,calc(100vw-1.5rem))]
                       flex-col gap-1 rounded-lg border p-2
                       shadow-[0_4px_0_0_var(--color-ink-900)]"
          >
            <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
              <span className="text-label text-muted font-mono tracking-label uppercase">
                Dev tools
              </span>
              <button
                onClick={resetDevTools}
                className="text-label text-muted hover:text-paper rounded-xs px-1 uppercase transition-colors"
              >
                All off
              </button>
            </div>

            {DEV_TOOLS.map((tool) => (
              <button
                key={tool.key}
                type="button"
                role="switch"
                aria-checked={tools[tool.key]}
                onClick={() => setDevTool(tool.key, !tools[tool.key])}
                className="hover:bg-ink-700 flex items-start gap-3 rounded-sm px-2 py-2 text-left transition-colors"
              >
                {/* A real switch shape rather than a checkbox: this is a thing being turned
                    on, not a form being filled in. */}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    tools[tool.key] ? "bg-gold" : "bg-ink-500"
                  }`}
                >
                  <span
                    className={`bg-paper size-4 rounded-full transition-transform ${
                      tools[tool.key] ? "translate-x-4" : ""
                    }`}
                  />
                </span>

                <span className="flex min-w-0 flex-col">
                  <span className="text-body-sm text-paper font-medium">{tool.label}</span>
                  <span className="text-label text-muted">{tool.help}</span>
                </span>
              </button>
            ))}

            {/*
             * Actions, not toggles. Kept visually separate because they DO something once
             * rather than changing what is rendered — mixing the two in one list is how
             * you end up pressing a button expecting a switch.
             */}
            <div className="border-line mt-1 flex flex-col gap-1 border-t pt-2">
              <button
                type="button"
                onClick={() => {
                  // Back to the explainer rather than the username step: the handle is
                  // already committed and `completeOnboarding` would only re-validate it.
                  void setWelcomeStep({ step: STEP.EXPLAIN });
                  setOpen(false);
                  router.push("/welcome");
                }}
                className="hover:bg-ink-700 flex items-center gap-2 rounded-sm px-2 py-2 text-left transition-colors"
              >
                <span className="text-muted text-base leading-none">
                  <Glyph name="tier" />
                </span>
                <span className="flex flex-col">
                  <span className="text-body-sm text-paper font-medium">
                    Replay welcome flow
                  </span>
                  <span className="text-label text-muted">
                    Jumps back to the explainer and the coached rounds.
                  </span>
                </span>
              </button>
            </div>

            {/*
             * Reported rather than offered.
             *
             * Rank bots on the ladder are decided by `devFeaturesEnabled(ctx)` on the server,
             * and `users.leaderboard` makes no per-viewer call so it stays one shared cache
             * entry. A switch here could not change it without forking that cache per
             * identity — so this states the fact instead of pretending to control it.
             */}
            <p className="text-label text-muted border-line mt-1 border-t px-2 pt-2">
              Rank bots are on the ladder for everyone while developer features are on —
              that one is a deployment setting, not a browser one. Change it in{" "}
              <span className="font-mono">/admin</span>.
            </p>

            <p className="text-label text-muted px-2">
              Everything above is stored in this browser only. Players never see this panel:
              it needs developer features on for the deployment AND the admin role on your
              account.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Developer tools"
        title="Developer tools (Ctrl+.)"
        className={`flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1.5
                    font-mono text-xs backdrop-blur transition-colors ${
                      activeCount > 0
                        ? "border-gold/60 bg-gold/15 text-gold"
                        : "border-white/25 bg-black/70 text-muted hover:text-paper"
                    }`}
      >
        <Glyph name="settings" />
        dev
        {/* The count is the important part: it is how you notice you left something on. */}
        {activeCount > 0 && <span className="font-bold">{activeCount}</span>}
      </button>
    </div>
  );
}
