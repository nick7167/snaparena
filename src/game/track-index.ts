"use client";

/**
 * Fetches the catalogue's titles once per session so the guess box can search locally.
 *
 * A module-level singleton rather than a provider, and the reasons are worth keeping:
 *
 *  - A context in `AppShell` would be simpler, but `AppShell` wraps the landing page, so
 *    every anonymous visitor would pay for an index they never reach. Triggering the fetch
 *    from the runners keeps the cost on players who are about to type.
 *  - `useQuery` would hold a live subscription retaining the whole payload for the session,
 *    to watch a table nothing mutates at runtime. One shot over the already-open socket
 *    costs the same request and none of the retention.
 *  - `localStorage` would save roughly one round-trip in exchange for a synchronous read on
 *    a hot path and a staleness problem, since the catalogue can be re-imported without a
 *    client rebuild.
 *
 * A singleton also survives client-side navigation, which a route-scoped provider would not.
 */

import { useConvex } from "convex/react";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "../../convex/_generated/api";
import { buildTitleIndex, type TitleIndex } from "@/engine/autocomplete";

type Client = ReturnType<typeof useConvex>;

let index: TitleIndex | null = null;
/**
 * Set when the catalogue outgrew the query's read ceiling, or when the fetch failed.
 * Either way the local index is incomplete, so callers must keep the server search armed.
 */
let partial = false;
let inFlight: Promise<void> | null = null;

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
 * Starts the fetch if it has not started already. Safe to call from anywhere, any number
 * of times — every call after the first joins the in-flight request or no-ops.
 */
export function ensureTrackIndex(client: Client): void {
  if (index !== null || inFlight !== null) return;

  inFlight = client
    .query(api.tracks.titleIndex, {})
    .then((result) => {
      index = buildTitleIndex(result.titles);
      partial = result.truncated;
      notify();
    })
    .catch(() => {
      // Leave the index null so every caller falls back to the server for the rest of the
      // session. A failed prefetch must degrade to slower suggestions, never to none.
      partial = true;
      notify();
    })
    .finally(() => {
      inFlight = null;
    });
}

/**
 * Warms the index without subscribing to it.
 *
 * Deliberately returns nothing: the runners that call this re-render on every animation
 * frame, and handing them a value they do not use would be one more thing to invalidate.
 */
export function usePrefetchTrackIndex(): void {
  const client = useConvex();
  useEffect(() => {
    ensureTrackIndex(client);
  }, [client]);
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
