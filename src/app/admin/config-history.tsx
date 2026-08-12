"use client";

import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useState } from "react";
import { reducers } from "@/module_bindings";
import { useConfigHistory } from "../db";
import { Button } from "@/ui/Button";
import { Card, Chip, SectionLabel, Skeleton } from "@/ui/Surface";
import { timeAgo } from "@/ui/relative-time";
import { useNow } from "@/game/usePrefersReducedMotion";
import { defaultFor, entryFor } from "@/engine/config-registry";

type StoredValue = { key: string; value: number | null };

/**
 * Every saved config, newest first, with a diff and a way back.
 *
 * The history is append-only and reverting writes a NEW version rather than repointing at
 * an old one. That is not bookkeeping fussiness: matches store the version id they were
 * created under, so editing or re-using an old row would retroactively change the rules a
 * finished match was played by.
 */
export function ConfigHistory() {
  const versions = useConfigHistory(25);
  const revert = useStdbReducer(reducers.revertConfig);
  const resetAll = useStdbReducer(reducers.resetConfig);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One clock for the whole list, ticking a minute at a time. A fresh `Date.now()` per row
  // would let two entries saved in the same second disagree about how long ago they were.
  const now = useNow(60_000);

  async function run(id: string, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await action();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "That did not work";
      setError(message.replace(/^\[.*?\]\s*/, ""));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>History</SectionLabel>

      {error && (
        <p className="text-body-sm text-signal-text" role="alert">
          {error}
        </p>
      )}

      {versions === undefined ? (
        <Skeleton className="h-40 w-full" />
      ) : versions.length === 0 ? (
        <Card className="p-5">
          <p className="text-body text-muted">
            Nothing saved yet — the game is running on the values in the code.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {versions.map((version, index) => (
            <li key={version.versionId}>
              <Card className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-body text-paper font-semibold">
                    {timeAgo(version.createdAtMs, now)}
                    {version.author && (
                      <span className="text-muted font-normal"> by @{version.author}</span>
                    )}
                  </span>
                  {version.isCurrent && <Chip size="sm">live</Chip>}
                </div>

                {version.note && <p className="text-body-sm text-muted">{version.note}</p>}

                {/* Against the version BELOW it in the list, which is the one it replaced. */}
                <Diff from={versions[index + 1]?.values ?? []} to={version.values} />

                {!version.isCurrent && (
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy === String(version.versionId)}
                      onClick={() =>
                        void run(String(version.versionId), () =>
                          revert({ versionId: version.versionId }),
                        )
                      }
                    >
                      Restore these values
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="flex flex-col gap-3 p-5">
        <p className="text-body-sm text-muted">
          Puts every value back to what the code ships, as a new entry in the history.
          Nothing is deleted, and matches in progress keep the rules they started with.
        </p>
        <div>
          <Button
            variant="secondary"
            loading={busy === "reset"}
            onClick={() => void run("reset", () => resetAll())}
          >
            Reset everything to defaults
          </Button>
        </div>
      </Card>
    </section>
  );
}

/**
 * What changed between two stored override sets.
 *
 * Both sides hold only differences from the code, so a key present in `from` and absent
 * from `to` means "went back to its default" rather than "deleted" — which is why the
 * shipped value is named rather than shown as a blank.
 */
function Diff({ from, to }: { from: StoredValue[]; to: StoredValue[] }) {
  const before = new Map(from.map((entry) => [entry.key, entry.value]));
  const after = new Map(to.map((entry) => [entry.key, entry.value]));
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();

  const rows = keys
    .filter((key) => before.get(key) !== after.get(key))
    .map((key) => ({
      key,
      label: entryFor(key)?.label ?? key,
      from: before.has(key) ? before.get(key) : defaultFor(key),
      to: after.has(key) ? after.get(key) : defaultFor(key),
      backToDefault: !after.has(key),
    }));

  if (rows.length === 0) {
    return <p className="text-body-sm text-muted italic">No values changed.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.key} className="text-body-sm text-muted">
          <span className="text-paper font-semibold">{row.label}</span>{" "}
          <span className="tabular-nums">{String(row.from)}</span> →{" "}
          <span className="text-secondary tabular-nums">{String(row.to)}</span>
          {row.backToDefault && <span className="italic"> (back to the shipped value)</span>}
        </li>
      ))}
    </ul>
  );
}
