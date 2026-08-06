"use client";

import { useQuery } from "convex/react";
import { createContext, useContext, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_CONFIG, type ResolvedConfig } from "@/engine/config-merge";

/**
 * The live game configuration, for the client.
 *
 * WHAT THIS IS NOT: authority. The server scores every guess, resolves every round and
 * awards every point through the config the MATCH was created under — see
 * `convex/config.ts`. Everything here is presentation: how long a bar animates, which
 * tier label to draw, what level a total of XP corresponds to. That distinction is what
 * makes the fallback below safe.
 */
const ConfigContext = createContext<ResolvedConfig | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  /**
   * One subscription for the whole app.
   *
   * Convex only pushes when the value actually changes, so this re-renders the tree on a
   * genuine config save and at no other time — which is the entire reason it is a context
   * rather than a `useQuery` in each of the screens that needs it.
   */
  const live = useQuery(api.config.current, {});
  const value = (live?.config as ResolvedConfig | undefined) ?? null;

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/**
 * The current config, with the shipped defaults standing in until the query lands.
 *
 * FALLING BACK RATHER THAN BLOCKING is a deliberate call. The alternative is holding the
 * first paint of a game people arrived to play behind a network round-trip, to protect
 * values that are cosmetic on this side of the wire. In the worst case a level number is
 * briefly computed from the shipped curve instead of an edited one, and then corrects
 * itself when the subscription resolves.
 *
 * Anything where being briefly wrong would actually matter belongs on the server.
 */
export function useConfig(): ResolvedConfig {
  return useContext(ConfigContext) ?? DEFAULT_CONFIG;
}

/** True once the real config has arrived. For surfaces that would rather show nothing. */
export function useConfigLoaded(): boolean {
  return useContext(ConfigContext) !== null;
}
