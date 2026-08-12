"use client";

import { useTable } from "spacetimedb/react";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { tables } from "@/module_bindings";
import {
  DEFAULT_CONFIG,
  mergeConfig,
  type ConfigOverrides,
  type ResolvedConfig,
} from "@/engine/config-merge";

/**
 * The live game configuration, for the client.
 *
 * WHAT THIS IS NOT: authority. The server scores every guess, resolves every round and
 * awards every point through the config the MATCH was created under — see
 * `spacetimedb/src/config.ts`. Everything here is presentation: how long a bar animates,
 * which tier label to draw, what level a total of XP corresponds to. That distinction is
 * what makes the fallback below safe.
 *
 * PORTED FROM A QUERY TO A SUBSCRIPTION. Convex resolved `config.current` server-side and
 * pushed the merged object. There is no equivalent here — a view could merge, but it
 * would have to re-run per viewer for a value that is identical for everyone. Instead the
 * client subscribes to the pointer and the one version it names, and merges locally
 * through the same `mergeConfig` the server uses. Same function, same defaults, so the
 * two cannot disagree about what an override means.
 */
const ConfigContext = createContext<ResolvedConfig | null>(null);

/** The developer-features switch, which travels with the pointer rather than the values. */
const DevFeaturesContext = createContext<boolean>(false);

export function ConfigProvider({ children }: { children: ReactNode }) {
  /**
   * One subscription for the whole app.
   *
   * SpacetimeDB only sends a row when it actually changes, so this re-renders the tree on
   * a genuine config save and at no other time — which is the entire reason it is a
   * context rather than a hook in each of the screens that needs it.
   */
  const [pointers] = useTable(tables.currentConfigVersion);
  const pointer = pointers[0];
  const versionId = pointer?.versionId;

  /**
   * The named version ONLY, not the history.
   *
   * `config_version` accumulates a row per save and the admin console shows all of them,
   * but every player would otherwise replicate that entire history to render a progress
   * bar. Filtering server-side keeps this at one row no matter how often the config is
   * edited. The subscription stays off until the pointer arrives, rather than briefly
   * matching id 0 — which no row has, but asking for it is still a round trip.
   */
  const [versions] = useTable(
    tables.configVersion.where((row) => row.id.eq(versionId ?? 0n)),
    { enabled: versionId !== undefined },
  );

  const value = useMemo(() => {
    if (versionId === undefined) return null;

    const version = versions.find((row) => row.id === versionId);
    if (!version) return null;

    const overrides: ConfigOverrides = {};
    for (const override of version.values) {
      overrides[override.key] = override.value ?? null;
    }

    return mergeConfig(overrides);
  }, [versionId, versions]);

  return (
    <ConfigContext.Provider value={value}>
      <DevFeaturesContext.Provider value={pointer?.devFeaturesEnabled ?? false}>
        {children}
      </DevFeaturesContext.Provider>
    </ConfigContext.Provider>
  );
}

/**
 * The current config, with the shipped defaults standing in until the subscription lands.
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

/**
 * Whether developer-only surfaces should be drawn.
 *
 * Defaults to `false` while the pointer is in flight, so a reload never flashes the dev
 * panel at a player. The switch is only a hint to the client either way — the reducers
 * behind those surfaces check the stored setting themselves.
 */
export function useDevFeatures(): boolean {
  return useContext(DevFeaturesContext);
}
