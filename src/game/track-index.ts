"use client";

/**
 * Fetches the catalogue's titles once per session so the guess box can search locally.
 *
 * A module-level singleton rather than a provider, and the reasons are worth keeping:
 *
 *  - A context in `AppShell` would be simpler, but `AppShell` wraps the landing page, so
 *    every anonymous visitor would pay for an index they never reach. Triggering the fetch
 *    from the runners keeps the cost on players who are about to type.
 *  - The index is built ONCE from the row and kept as a prepared structure. The
 *    subscription that delivers it is narrow — `track_index` is a single row — and the
 *    catalogue does not change at runtime, so it is a one-time cost either way. What the
 *    singleton buys is that `buildTitleIndex` runs once per session rather than once per
 *    component that wants to search.
 *  - `localStorage` would save roughly one round-trip in exchange for a synchronous read on
 *    a hot path and a staleness problem, since the catalogue can be re-imported without a
 *    client rebuild.
 *
 * A singleton also survives client-side navigation, which a route-scoped provider would not.
 */

import { useTable } from "spacetimedb/react";
import { useEffect, useSyncExternalStore } from "react";
import { tables } from "@/module_bindings";
import { buildTitleIndex, type TitleIndex } from "@/engine/autocomplete";

let index: TitleIndex | null = null;
/**
 * Set when the catalogue outgrew the index's ceiling. The local index is then incomplete,
 * so callers must keep the server-side match armed to cover the tail.
 */
let partial = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot(): TitleIndex | null {
  return index;
}

/** Nothing is prefetched during SSR; the client corrects this on hydration. */
function getServerSnapshot(): TitleIndex | null {
  return null;
}

/**
 * Builds the index from the delivered row, once.
 *
 * Idempotent on the row's build time: a re-import republishes the row with a new
 * `builtAt`, and that is the only thing that should cost a rebuild.
 */
let builtFrom: bigint | null = null;

export function ensureTrackIndex(row: {
  titles: string[];
  truncated: boolean;
  builtAt: { microsSinceUnixEpoch: bigint };
}): void {
  if (builtFrom === row.builtAt.microsSinceUnixEpoch) return;

  builtFrom = row.builtAt.microsSinceUnixEpoch;
  index = buildTitleIndex(row.titles);
  partial = row.truncated;
  notify();
}

/**
 * Warms the index without handing it back.
 *
 * Deliberately returns nothing: the runners that call this re-render on every animation
 * frame, and handing them a value they do not use would be one more thing to invalidate.
 * They read it through `useTrackIndex`, which is an external store and therefore does not
 * re-render them when the row arrives — only when the index they actually read changes.
 */
export function usePrefetchTrackIndex(): void {
  const [rows] = useTable(tables.trackIndex);
  const row = rows[0];

  useEffect(() => {
    if (row) ensureTrackIndex(row);
  }, [row]);
}

/** The loaded index, or null while it is still in flight or if it failed. */
export function useTrackIndex(): TitleIndex | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Whether the local index can be trusted as the complete catalogue.
 *
 * False if the read hit its ceiling, in which case the tail of the catalogue is missing
 * locally and the server search has to stay available to cover it.
 */
export function isTrackIndexComplete(): boolean {
  return index !== null && !partial;
}
