import { t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { AnonymousViewCtx, ReducerCtx, ViewCtx } from "./ctx";
import { reject } from "./lib";
import { requireAdmin, requireOwnerOrAdmin, senderUser } from "./users";
import { mergeConfig, type ConfigOverrides, type ResolvedConfig } from "../../src/engine/config-merge";
import { validateOverrides } from "../../src/engine/config-registry";

/**
 * Live tuning values.
 *
 * `src/engine/config.ts` stays the shipped baseline and `config_version` rows carry
 * ONLY the differences from it. That is what lets a constant added to the code
 * later resolve correctly for a version row written before it existed — the row
 * simply does not mention it — and it is why an empty deployment runs exactly what
 * the code says, with "reset" being a new empty row rather than a special case.
 *
 * Append-only. A revert writes a NEW row holding the old values rather than
 * mutating or deleting one, because finished matches point at these by id: editing
 * a version in place would retroactively change the rules a match was played under.
 */

/** The settings singleton, or null before anything has been saved. */
export function getSettings(ctx: ReducerCtx | ViewCtx | AnonymousViewCtx) {
  return [...ctx.db.settings.iter()][0] ?? null;
}

/** Turns a stored version row into the overrides shape the engine merges. */
function overridesFrom(values: readonly { key: string; value: number | undefined }[]): ConfigOverrides {
  const out: ConfigOverrides = {};
  for (const entry of values) {
    out[entry.key] = entry.value === undefined ? null : entry.value;
  }
  return out;
}

/**
 * The rules a match is played under.
 *
 * Callers pass the match's OWN `configVersionId`, not the current one. That is the
 * whole point: saving a new config mid-duel must not move the score curve, the HP
 * or the damage ramp underneath two players who are halfway through a round. An
 * absent id means the shipped defaults, which is also what a match created before
 * any config existed resolves to.
 */
export function resolveConfig(
  ctx: ReducerCtx | ViewCtx | AnonymousViewCtx,
  versionId: bigint | undefined,
): ResolvedConfig {
  if (versionId === undefined) return mergeConfig(null);

  const version = ctx.db.config_version.id.find(versionId);
  if (!version) return mergeConfig(null);

  return mergeConfig(overridesFrom(version.values));
}

/** The version new matches are stamped with. */
export function currentVersionId(ctx: ReducerCtx): bigint | undefined {
  return getSettings(ctx)?.currentVersionId ?? undefined;
}

/** Whether the developer tools and rank bots are switched on for this database. */
export function devFeaturesEnabled(ctx: ReducerCtx | ViewCtx | AnonymousViewCtx): boolean {
  return getSettings(ctx)?.devFeaturesEnabled ?? false;
}

/** Creates the settings row on first write. */
function ensureSettings(ctx: ReducerCtx) {
  const existing = getSettings(ctx);
  if (existing) return existing;

  return ctx.db.settings.insert({
    id: 0n,
    currentVersionId: undefined,
    devFeaturesEnabled: false,
    updatedAt: ctx.timestamp,
    updatedBy: undefined,
  });
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

const OverrideInput = t.object("OverrideInput", {
  key: t.string(),
  value: t.option(t.f64()),
});

/**
 * Saves a new config version. Admin only.
 *
 * Validates against the registry server-side rather than trusting the console, and
 * drops entries that equal the shipped default so a version row records real
 * differences only.
 */
export const saveConfig = spacetimedb.reducer(
  { values: t.array(OverrideInput), note: t.option(t.string()) },
  (ctx, { values, note }) => {
    const admin = requireAdmin(ctx);

    const proposed: ConfigOverrides = {};
    for (const entry of values) {
      proposed[entry.key] = entry.value === undefined ? null : entry.value;
    }

    const problems = validateOverrides(proposed);
    if (problems.length > 0) reject(problems[0]);

    const kept = values.filter((entry) => !matchesDefault(entry.key, entry.value));

    const version = ctx.db.config_version.insert({
      id: 0n,
      values: kept,
      createdAt: ctx.timestamp,
      createdBy: admin.id,
      note,
    });

    const settings = ensureSettings(ctx);
    ctx.db.settings.id.update({
      ...settings,
      currentVersionId: version.id,
      updatedAt: ctx.timestamp,
      updatedBy: admin.id,
    });
  },
);

/** True when an override is the shipped value, and therefore not worth storing. */
function matchesDefault(key: string, value: number | undefined): boolean {
  const baseline = mergeConfig(null) as unknown as Record<string, unknown>;
  const path = key.split(".");

  let cursor: unknown = baseline;
  for (const step of path) {
    if (typeof cursor !== "object" || cursor === null) return false;
    cursor = (cursor as Record<string, unknown>)[step];
  }

  if (value === undefined) return cursor === null;
  return cursor === value;
}

/**
 * Reverts to an earlier version by writing a NEW row holding its values.
 *
 * Never repoints at the old row: matches reference versions by id, so reusing one
 * would make a finished match claim to have been played under rules that were
 * chosen after it ended.
 */
export const revertConfig = spacetimedb.reducer(
  { versionId: t.u64() },
  (ctx, { versionId }) => {
    const admin = requireAdmin(ctx);

    const target = ctx.db.config_version.id.find(versionId);
    if (!target) reject("No such config version");

    const version = ctx.db.config_version.insert({
      id: 0n,
      values: target.values,
      createdAt: ctx.timestamp,
      createdBy: admin.id,
      note: `Reverted to version ${versionId}`,
    });

    const settings = ensureSettings(ctx);
    ctx.db.settings.id.update({
      ...settings,
      currentVersionId: version.id,
      updatedAt: ctx.timestamp,
      updatedBy: admin.id,
    });
  },
);

/** Back to the shipped defaults, as a new empty version. */
export const resetConfig = spacetimedb.reducer((ctx) => {
  const admin = requireAdmin(ctx);

  const version = ctx.db.config_version.insert({
    id: 0n,
    values: [],
    createdAt: ctx.timestamp,
    createdBy: admin.id,
    note: "Reset to shipped defaults",
  });

  const settings = ensureSettings(ctx);
  ctx.db.settings.id.update({
    ...settings,
    currentVersionId: version.id,
    updatedAt: ctx.timestamp,
    updatedBy: admin.id,
  });
});

/**
 * Deployment-wide developer-features toggle. Admin only.
 *
 * Lives in the database rather than the environment because an operator has to be
 * able to flip it from /admin and a module cannot write its own environment — the
 * same reason the Convex version moved it off DEV_RANK_BOTS.
 */
export const setDevFeatures = spacetimedb.reducer(
  { enabled: t.bool() },
  (ctx, { enabled }) => {
    requireOwnerOrAdmin(ctx);
    const settings = ensureSettings(ctx);

    ctx.db.settings.id.update({
      ...settings,
      devFeaturesEnabled: enabled,
      updatedAt: ctx.timestamp,
      updatedBy: senderUser(ctx)?.id,
    });
  },
);

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

/**
 * `settings` and `config_version` are both public tables, so the client subscribes
 * to them directly and runs `mergeConfig` itself — the same pure function the module
 * uses, from the same file.
 *
 * That is a genuine simplification over `config.current`, which shaped and returned
 * a whole resolved config on every call. Here the client holds the baseline in its
 * own bundle already, and only the differences travel.
 */
export const currentConfigVersion = spacetimedb.anonymousView(
  { name: "current_config_version", public: true },
  t.option(t.row("ConfigPointer", {
    versionId: t.option(t.u64()),
    devFeaturesEnabled: t.bool(),
  })),
  (ctx) => {
    const settings = getSettings(ctx);
    if (!settings) return { versionId: undefined, devFeaturesEnabled: false };
    return {
      versionId: settings.currentVersionId,
      devFeaturesEnabled: settings.devFeaturesEnabled,
    };
  },
);
