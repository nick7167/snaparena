"use client";

import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useMemo, useState } from "react";
import { reducers } from "@/module_bindings";
import { useStoredOverrides } from "../db";
import { useConfig } from "../config";
import { Button } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";
import { Card, Chip, SectionLabel, Skeleton } from "@/ui/Surface";
import type { ResolvedConfig } from "@/engine/config-merge";
import {
  CONFIG_ENTRIES,
  DOMAIN_LABELS,
  STRUCTURED_ENTRIES,
  defaultFor,
  readValue,
  validateOverride,
  type ConfigDomain,
  type ConfigEntry,
} from "@/engine/config-registry";

/**
 * The tuning console.
 *
 * RENDERS ITSELF FROM THE REGISTRY rather than from hand-written forms. Every value in
 * `src/engine/config.ts` has an entry in `config-registry.ts` declaring its label, bounds,
 * risk and whether it may be edited, and this walks that list. Adding a constant to the
 * game therefore means adding a registry row, not writing UI — and, just as importantly,
 * a value nobody has described cannot silently appear here as an unlabelled number.
 *
 * The same registry backs `config.save` on the server, so the bounds enforced as you type
 * are the bounds enforced on write. This form is a convenience; it is not the guard.
 */
export function ConfigEditor() {
  const live = useConfig();
  const stored = useStoredOverrides();
  const save = useStdbReducer(reducers.saveConfig);

  /**
   * Only what has been typed, keyed by config key.
   *
   * Held as strings rather than numbers so a half-typed "-" or "1." is a state the field
   * can actually be in. Parsing happens at the edge, in `problemWith`.
   */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const config: ResolvedConfig = live;
  const overriddenKeys = useMemo(
    () => new Set<string>(Object.keys(stored ?? {})),
    [stored],
  );

  if (stored === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  /** What the field should show: what was typed, else what is live. */
  function shown(entry: ConfigEntry): string {
    if (draft[entry.key] !== undefined) return draft[entry.key];
    const value = readValue(config!, entry.key);
    return value === null || value === undefined ? "" : String(value);
  }

  /** The parsed value, or undefined when the text is not a number at all. */
  function parsed(entry: ConfigEntry): number | null | undefined {
    const text = shown(entry).trim();
    if (text === "") return entry.nullable ? null : undefined;
    const value = Number(text);
    return Number.isNaN(value) ? undefined : value;
  }

  function problemWith(entry: ConfigEntry): string | null {
    if (draft[entry.key] === undefined) return null;
    const value = parsed(entry);
    if (value === undefined) return `"${entry.label}" must be a number`;
    return validateOverride(entry.key, value);
  }

  const editable = CONFIG_ENTRIES.filter((entry) => entry.editable);
  const touched = editable.filter((entry) => draft[entry.key] !== undefined);
  const problems = touched.map(problemWith).filter((problem) => problem !== null);

  /** Changed relative to what is currently live — the set the save button acts on. */
  const changed = touched.filter((entry) => {
    const value = parsed(entry);
    return value !== undefined && value !== readValue(config, entry.key);
  });

  const risky = changed.filter((entry) => entry.risk === "high");
  const dirty = changed.length > 0;

  /**
   * Builds the whole override set, not just what changed.
   *
   * `config.save` replaces rather than merges, so anything omitted returns to its shipped
   * default. Sending only the edits would silently reset every other override.
   */
  function buildValues() {
    const values: { key: string; value: number | null }[] = [];
    for (const entry of editable) {
      const value = draft[entry.key] !== undefined ? parsed(entry) : readValue(config!, entry.key);
      if (value === undefined) continue;
      if (value === defaultFor(entry.key)) continue;
      values.push({ key: entry.key, value });
    }
    return values;
  }

  async function commit() {
    if (busy || problems.length > 0) return;
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      /**
       * `null` means "clear this override" in the editor and `undefined` means it on
       * the wire — the column is an option, and an option has no null. Converted here
       * rather than in `buildValues`, which the diff also reads.
       */
      await save({
        values: buildValues().map((entry) => ({
          key: entry.key,
          value: entry.value ?? undefined,
        })),
      });
      setDraft({});
      setConfirming(false);
      setSaved(true);
    } catch (caught) {
      // Convex prefixes thrown messages with its own bracketed context; the part after it
      // is the sentence written for this screen. Same trim as roles.tsx.
      const message = caught instanceof Error ? caught.message : "That did not save";
      setError(message.replace(/^\[.*?\]\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  const domains = [...new Set(CONFIG_ENTRIES.map((entry) => entry.domain))];

  return (
    <section className="flex flex-col gap-8">
      {domains.map((domain) => (
        <DomainSection
          key={domain}
          domain={domain}
          config={config}
          shown={shown}
          problemWith={problemWith}
          overridden={overriddenKeys}
          onChange={(key, text) => {
            setDraft((current) => ({ ...current, [key]: text }));
            setSaved(false);
            setConfirming(false);
          }}
          onReset={(key) => {
            const fallback = defaultFor(key);
            setDraft((current) => ({
              ...current,
              [key]: fallback === null || fallback === undefined ? "" : String(fallback),
            }));
            setSaved(false);
            setConfirming(false);
          }}
        />
      ))}

      {/*
        Sits at the bottom of the flow rather than floating. The page is read top to bottom
        while tuning several values at once, and a bar pinned over the viewport would cover
        the fields on the short screens this is most likely to be used on.
      */}
      <Card className="flex flex-col gap-3 p-5">
        {problems.length > 0 && (
          <ul className="flex flex-col gap-1">
            {problems.map((problem) => (
              <li key={problem} className="text-body-sm text-signal-text">
                {problem}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="text-body-sm text-signal-text" role="alert">
            {error}
          </p>
        )}

        {/*
          High-risk fields do not save on a single press. Everything here is revertible, but
          "revertible" is not the same as "harmless" — a mistyped round length is live for
          however long it takes somebody to notice.
        */}
        {confirming ? (
          <div className="flex flex-col gap-3">
            <p className="text-body text-paper">
              {risky.length === 1
                ? `${risky[0].label} affects how the game plays for everyone. Save it?`
                : `${risky.length} high-impact values affect how the game plays for everyone. Save them?`}
            </p>
            <ul className="flex flex-col gap-1">
              {risky.map((entry) => (
                <li key={entry.key} className="text-body-sm text-muted">
                  <span className="text-paper font-semibold">{entry.label}</span>{" "}
                  {String(readValue(config, entry.key))} → {shown(entry)}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void commit()} loading={busy}>
                Yes, save
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => (risky.length > 0 ? setConfirming(true) : void commit())}
              loading={busy}
              disabled={!dirty || problems.length > 0}
            >
              {changed.length === 0
                ? "Save"
                : `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`}
            </Button>
            {dirty && (
              <Button variant="secondary" onClick={() => setDraft({})} disabled={busy}>
                Discard
              </Button>
            )}
            {saved && (
              <span className="text-body-sm text-muted" role="status">
                Saved. Matches already in progress keep the rules they started with.
              </span>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}

function DomainSection({
  domain,
  config,
  shown,
  problemWith,
  overridden,
  onChange,
  onReset,
}: {
  domain: ConfigDomain;
  config: ResolvedConfig;
  shown: (entry: ConfigEntry) => string;
  problemWith: (entry: ConfigEntry) => string | null;
  overridden: Set<string>;
  onChange: (key: string, text: string) => void;
  onReset: (key: string) => void;
}) {
  const entries = CONFIG_ENTRIES.filter((entry) => entry.domain === domain);
  const structured = STRUCTURED_ENTRIES.filter((entry) => entry.domain === domain);

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{DOMAIN_LABELS[domain]}</SectionLabel>

      <Card className="flex flex-col gap-5 p-5">
        {entries.map((entry) =>
          entry.editable ? (
            <EditableRow
              key={entry.key}
              entry={entry}
              value={shown(entry)}
              problem={problemWith(entry)}
              overridden={overridden.has(entry.key)}
              onChange={(text) => onChange(entry.key, text)}
              onReset={() => onReset(entry.key)}
            />
          ) : (
            <LockedRow key={entry.key} entry={entry} config={config} />
          ),
        )}

        {structured.map((entry) => (
          <div key={entry.key} className="flex flex-col gap-1.5">
            <span className="text-label text-secondary font-semibold tracking-label uppercase">
              {entry.label}
            </span>
            <pre className="bg-ink-600 text-body-sm text-secondary overflow-x-auto rounded-xs p-3">
              {JSON.stringify(config[entry.key], null, 2)}
            </pre>
            <p className="text-body-sm text-muted">{entry.help}</p>
            <p className="text-body-sm text-muted italic">{entry.lockedReason}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

function EditableRow({
  entry,
  value,
  problem,
  overridden,
  onChange,
  onReset,
}: {
  entry: ConfigEntry;
  value: string;
  problem: string | null;
  overridden: boolean;
  onChange: (text: string) => void;
  onReset: () => void;
}) {
  const fallback = defaultFor(entry.key);
  const isDefault = value === String(fallback);

  return (
    <Field
      label={entry.label}
      htmlFor={`config-${entry.key}`}
      error={problem}
      help={`${entry.help} ${entry.type === "ms" ? "In milliseconds. " : ""}Between ${entry.min} and ${entry.max}. Ships as ${fallback}.`}
    >
      <div className="flex items-center gap-2">
        <Input
          id={`config-${entry.key}`}
          value={value}
          invalid={problem !== null}
          inputMode={entry.type === "float" ? "decimal" : "numeric"}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
        {/* Only offered when it would do something — a reset on a default value is noise. */}
        {!isDefault && (
          <Button variant="secondary" size="sm" onClick={onReset}>
            Reset
          </Button>
        )}
        {overridden && (
          <Chip size="sm" tone="signal">
            edited
          </Chip>
        )}
        {entry.risk === "high" && <Chip size="sm">high impact</Chip>}
      </div>
    </Field>
  );
}

/**
 * A value that exists but cannot be changed here.
 *
 * Shown rather than hidden, with the reason attached. A console that silently omits the
 * things it will not let you touch teaches you nothing about why.
 */
function LockedRow({ entry, config }: { entry: ConfigEntry; config: ResolvedConfig }) {
  const value = readValue(config, entry.key);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-label text-muted font-semibold tracking-label uppercase">
          {entry.label}
        </span>
        <span className="font-display text-secondary font-bold tabular-nums">
          {value === null ? "not set" : value}
        </span>
      </div>
      <p className="text-body-sm text-muted">{entry.help}</p>
      <p className="text-body-sm text-muted italic">{entry.lockedReason}</p>
    </div>
  );
}
