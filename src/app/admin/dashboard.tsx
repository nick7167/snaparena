"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DAILY_SONGS, MAX_DUEL_ROUNDS } from "@/engine/config";
import { Card, Chip, Meter, SectionLabel, Skeleton } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";

/** Below this a tier repeats tracks inside a single match. Mirrors tracks.stats. */
const THIN_TIER_FLOOR = 50;

export function AdminDashboard() {
  const stats = useQuery(api.tracks.stats, {});
  const categories = useQuery(api.tracks.categories, {});

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-1 font-extrabold">Catalogue</h1>
        <p className="text-body text-muted">
          Dev only. Ranked draws {MAX_DUEL_ROUNDS} tracks per match, the daily draws{" "}
          {DAILY_SONGS}.
        </p>
      </header>

      {stats === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Figure label="Total tracks" value={stats.total} />
            <Figure label="Playable" value={stats.playable} />
            <Figure label="Categories" value={categories?.length ?? 0} />
          </section>

          {/* The number that decides whether ranked works at all. */}
          <Readiness playable={stats.playable} thinTiers={stats.thinTiers} />

          <section className="flex flex-col gap-3">
            <SectionLabel>Playable by difficulty</SectionLabel>
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((tier) => {
                const count = stats.byDifficulty[tier] ?? 0;
                const thin = stats.thinTiers.includes(tier);
                return (
                  <div key={tier} className="flex flex-col gap-1.5">
                    <div className="text-body-sm flex items-baseline justify-between gap-3">
                      <span className="text-paper font-medium">
                        Tier {tier}
                        {thin && (
                          <Chip tone="signal" size="sm" className="ml-2">
                            thin
                          </Chip>
                        )}
                      </span>
                      <span className="font-display text-secondary font-bold tabular-nums">
                        {count}
                      </span>
                    </div>
                    <Meter
                      value={count}
                      max={Math.max(THIN_TIER_FLOOR, ...Object.values(stats.byDifficulty))}
                      height="sm"
                      tone={thin ? "signal" : "paper"}
                      label={`Difficulty tier ${tier}: ${count} playable tracks`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-body-sm text-muted">
              A tier under {THIN_TIER_FLOOR} tracks will repeat songs within a match.
            </p>
          </section>

          {categories && categories.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionLabel>Categories</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Chip key={category._id}>{category.name}</Chip>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * States plainly whether each mode can actually run, rather than leaving you to compare
 * a track count against a constant in your head.
 */
function Readiness({ playable, thinTiers }: { playable: number; thinTiers: number[] }) {
  const modes = [
    { name: "Daily challenge", needs: DAILY_SONGS },
    { name: "Ranked / practice duel", needs: MAX_DUEL_ROUNDS },
  ];

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Readiness</SectionLabel>
      <div className="flex flex-col gap-2">
        {modes.map((mode) => {
          const ok = playable >= mode.needs;
          return (
            <Card
              key={mode.name}
              className="text-body flex items-center justify-between gap-3 p-4"
            >
              <span className="flex items-center gap-2">
                <span className={ok ? "text-paper" : "text-signal-text"}>
                  <Glyph name={ok ? "win" : "loss"} filled />
                </span>
                {mode.name}
              </span>
              <span className="text-body-sm text-muted tabular-nums">
                needs {mode.needs} · have {playable}
              </span>
            </Card>
          );
        })}

        {thinTiers.length > 0 && (
          <Card className="border-signal flex flex-col gap-1 p-4">
            <p className="text-body text-signal-text font-semibold">
              {thinTiers.length} thin tier{thinTiers.length === 1 ? "" : "s"}:{" "}
              {thinTiers.join(", ")}
            </p>
            <p className="text-body-sm text-muted">
              Run <code className="text-secondary">npm run ingest</code> and{" "}
              <code className="text-secondary">npm run import-tracks</code> to widen the
              catalogue.
            </p>
          </Card>
        )}
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-label text-muted font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span className="font-display text-display-2 font-extrabold tabular-nums">
        {value}
      </span>
    </Card>
  );
}
