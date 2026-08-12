/**
 * The module owner's token, and one authenticated read.
 *
 * Split out of `./stdb.ts` because that module imports the generated client bindings at
 * its top level, which is a great deal to drag in for something that only needs to read
 * a string out of a config file — the e2e helpers want the token without the WebSocket
 * client attached.
 *
 * Token resolution, in order:
 *   1. SPACETIMEDB_TOKEN, for CI and anywhere without a CLI config.
 *   2. `spacetimedb_token` from the CLI's own config, so `spacetime login` is the only
 *      setup step a developer needs.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function cliToken(): string | undefined {
  const configPath =
    process.env.SPACETIME_CONFIG ??
    path.join(homedir(), ".config", "spacetime", "cli.toml");

  try {
    const toml = readFileSync(configPath, "utf8");
    // Deliberately a regex rather than a TOML parser: this is one flat key at the top of
    // a file the CLI owns, and a dependency to read it would be the largest thing in
    // these scripts.
    const match = toml.match(/^\s*spacetimedb_token\s*=\s*"([^"]+)"/m);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function ownerToken(): string {
  const token = process.env.SPACETIMEDB_TOKEN ?? cliToken();
  if (!token) {
    throw new Error(
      "No SpacetimeDB token. Run `spacetime login`, or set SPACETIMEDB_TOKEN.",
    );
  }
  return token;
}

/**
 * Runs one SQL statement as the module owner and returns its rows.
 *
 * THE AUTHENTICATION IS THE POINT, and it is what separates this from `src/app/sql.ts`.
 * That one is unauthenticated on purpose and can therefore only ever read public tables,
 * which is what makes it safe to call during a page render. This carries the owner's
 * token, so it can read `track` and `daily_challenge` — the answer key — which is
 * exactly why it lives in a script rather than anywhere the app can reach.
 *
 * Rows come back as ARRAYS, not objects: the endpoint answers with a `schema` naming the
 * columns and a `rows` array of positional values. The caller is handed both.
 */
export async function ownerSql(
  sql: string,
): Promise<{ columns: string[]; rows: unknown[][] }> {
  const uri = process.env.NEXT_PUBLIC_SPACETIMEDB_URI ?? "https://maincloud.spacetimedb.com";
  const database = process.env.NEXT_PUBLIC_SPACETIMEDB_DB;
  if (!database) throw new Error("NEXT_PUBLIC_SPACETIMEDB_DB is not set");

  const response = await fetch(`${uri}/v1/database/${database}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      Authorization: `Bearer ${ownerToken()}`,
    },
    body: sql,
  });

  if (!response.ok) {
    throw new Error(`SQL read failed: ${response.status} ${await response.text()}`);
  }

  const results = (await response.json()) as {
    schema?: { elements?: { name?: { some?: string } }[] };
    rows?: unknown[][];
  }[];

  const first = results?.[0];

  return {
    columns: (first?.schema?.elements ?? []).map((element) => element.name?.some ?? ""),
    rows: first?.rows ?? [],
  };
}
