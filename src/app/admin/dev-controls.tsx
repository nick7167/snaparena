"use client";

import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useState } from "react";
import { reducers } from "@/module_bindings";
import { useDevFeatures } from "../config";
import { Button } from "@/ui/Button";
import { Card, Chip, SectionLabel, Skeleton } from "@/ui/Surface";

/**
 * DEV ONLY — delete this file with `convex/devbots.ts`.
 *
 * Kept as its own section, visually separated, because it has a different lifespan to the
 * rest of this screen: the config editor is permanent operator tooling, and everything
 * here comes out at launch along with the sixteen rank bots. See the removal checklist at
 * the bottom of `convex/devbots.ts`.
 *
 * THE SWITCH THIS OWNS used to be the `DEV_RANK_BOTS` deployment variable, changeable only
 * with `npx convex env set` from a terminal — a Convex function cannot write its own
 * environment. It is a database row now, which is the only reason this toggle can exist.
 */
export function DevControls() {
  const devFeaturesEnabled = useDevFeatures();
  const setDevFeatures = useStdbReducer(reducers.setDevFeatures);
  const seed = useStdbReducer(reducers.seedBots);
  const resetRoster = useStdbReducer(reducers.seedBots);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const enabled = devFeaturesEnabled;

  async function run(id: string, action: () => Promise<string>) {
    if (busy) return;
    setBusy(id);
    setError(null);
    setDone(null);
    try {
      setDone(await action());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "That did not work";
      setError(message.replace(/^\[.*?\]\s*/, ""));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Developer features</SectionLabel>

      <Card className="border-dashed flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-body text-paper font-semibold">
            Currently {enabled ? "on" : "off"}
          </span>
          {enabled && <Chip size="sm" tone="signal">live for everyone</Chip>}
        </div>

        <p className="text-body-sm text-muted">
          Switches on the sixteen rank bots in the ranked queue, the instant-win bar over a
          duel, and the developer tools drawer. This is one shared deployment, so it applies
          to the live site as well as your machine — but every one of those surfaces also
          requires the admin role, so a player cannot reach them either way.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={enabled ? "secondary" : "primary"}
            loading={busy === "toggle"}
            onClick={() =>
              void run("toggle", async () => {
                await setDevFeatures({ enabled: !enabled });
                return enabled ? "Developer features are off." : "Developer features are on.";
              })
            }
          >
            {enabled ? "Turn off" : "Turn on"}
          </Button>
        </div>

        <div className="border-line flex flex-col gap-3 border-t pt-4">
          <span className="text-label text-muted font-semibold tracking-label uppercase">
            Rank bot roster
          </span>
          <p className="text-body-sm text-muted">
            Seeding is idempotent and doubles as a rating reset. These bots drift, because a
            ranked result moves them exactly as it moves a player — reset when the ladder
            stops showing one bot per rank.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={!enabled}
              loading={busy === "seed"}
              onClick={() =>
                void run("seed", async () => {
                  // A reducer returns nothing, so the count is gone. The roster itself
                  // is the confirmation — it appears in the practice list either way.
                  await seed();
                  return `Roster seeded from the personas.`;
                })
              }
            >
              Seed roster
            </Button>
            <Button
              variant="secondary"
              disabled={!enabled}
              loading={busy === "reset"}
              onClick={() =>
                void run("reset", async () => {
                  // Re-seeding IS the reset: seedBots refreshes every existing row from
                  // its persona, which is what putting a bot back on its anchor rating
                  // means. One reducer rather than two that could disagree.
                  await resetRoster();
                  return `Bots back on their anchor ratings.`;
                })
              }
            >
              Reset ratings
            </Button>
          </div>
          {/*
            Purge is deliberately absent. It deletes accounts and every match they appear
            in, needs repeated calls until it reports done, and takes a handle to scrub back
            to a fresh signup — a destructive, multi-step operation that wants the terminal's
            deliberateness rather than a button next to two safe ones.
          */}
          <p className="text-body-sm text-muted">
            Removing the roster is <code className="text-secondary">npm run dev-bots purge</code>
            {" "}from a terminal — it deletes accounts and matches, so it is not a button.
          </p>
        </div>

        {error && (
          <p className="text-body-sm text-signal-text" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="text-body-sm text-muted" role="status">
            {done}
          </p>
        )}
      </Card>
    </section>
  );
}
