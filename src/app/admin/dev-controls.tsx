"use client";

import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useState } from "react";
import { reducers } from "@/module_bindings";
import { useDevFeatures } from "../config";
import { Button } from "@/ui/Button";
import { Card, Chip, SectionLabel, Skeleton } from "@/ui/Surface";

/**
 * DEV ONLY — delete this file with `spacetimedb/src/devbots.ts`.
 *
 * Kept as its own section, visually separated, because it has a different lifespan to the
 * rest of this screen: the config editor is permanent operator tooling, and everything
 * here comes out at launch along with the sixteen rank bots. See the removal checklist at
 * the bottom of `spacetimedb/src/devbots.ts`.
 *
 * THE SWITCH THIS OWNS used to be the `DEV_RANK_BOTS` deployment variable, changeable only
 * with `npx convex env set` from a terminal — a Convex function cannot write its own
 * environment. It is a database row now, which is the only reason this toggle can exist.
 */
export function DevControls() {
  const devFeaturesEnabled = useDevFeatures();
  const setDevFeatures = useStdbReducer(reducers.setDevFeatures);
  /**
   * TWO ROSTERS, and this screen only ever meant one of them.
   *
   * Both buttons pointed at `seedBots` — the twelve PRACTICE personas — while the copy
   * beside them talked about ranked drift and one bot per rank. That was a stand-in while
   * the dev-bot module was unported, and it was the wrong stand-in: re-seeding the
   * practice roster cannot re-anchor a rank bot, so "Reset ratings" quietly did nothing
   * to the thing it named. `seedDevRankBots` is the sixteen.
   */
  const seed = useStdbReducer(reducers.seedDevRankBots);

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
                  // A reducer returns nothing, so the "12 created, 4 updated" count is
                  // gone. The leaderboard is the better confirmation anyway: sixteen bots
                  // with placements at zero appear on it within one ladder rebuild.
                  await seed();
                  return `Roster seeded. They join the queue within fifteen seconds.`;
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
                  // Re-seeding IS the reset: seedDevRankBots refreshes every existing row
                  // from its persona, and patches the bot's queue entry too — that row
                  // carries its own rating snapshot, and a stale one would keep matching
                  // the bot at a rating it no longer holds. One reducer rather than two
                  // that could disagree.
                  await seed();
                  return `Bots back on their anchor ratings.`;
                })
              }
            >
              Reset ratings
            </Button>
          </div>
          {/*
            Purge is deliberately absent. It deletes sixteen accounts and every match they
            appear in, and optionally scrubs a named account back to a fresh signup — a
            destructive operation that wants the terminal's deliberateness rather than a
            button sitting next to two safe ones. One transaction now rather than the
            Convex version's re-run-until-done, but that changes nothing about the risk.
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
