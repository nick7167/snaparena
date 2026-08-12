/**
 * Connects a terminal script to the SpacetimeDB module as the module owner.
 *
 * The Convex versions of these scripts authenticated with ADMIN_IMPORT_SECRET, a
 * password shared between `.env.local` and the deployment. There is no secret any
 * more: the module captured the publisher's identity in `module_owner` during
 * `init`, and `requireModuleOwner` checks `ctx.sender` against it. So a script only
 * has to connect AS that identity, and the `spacetime` CLI already holds a token
 * for it.
 *
 * Token resolution, in order:
 *   1. SPACETIMEDB_TOKEN, for CI and anywhere without a CLI config.
 *   2. `spacetimedb_token` from the CLI's own config, so `spacetime login` is the
 *      only setup step a developer needs.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { DbConnection } from "../src/module_bindings/index.ts";

function cliToken(): string | undefined {
  const configPath =
    process.env.SPACETIME_CONFIG ??
    path.join(homedir(), ".config", "spacetime", "cli.toml");

  try {
    const toml = readFileSync(configPath, "utf8");
    // Deliberately a regex rather than a TOML parser: this is one flat key at the
    // top of a file the CLI owns, and a dependency to read it would be the largest
    // thing in these scripts.
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

export type Connected = {
  conn: DbConnection;
  close: () => void;
};

/**
 * Opens a connection and resolves once it is live.
 *
 * Rejects rather than hanging when the module refuses the token, because the most
 * likely cause — connecting as somebody who is not the publisher — otherwise looks
 * like a network problem.
 */
export function connect(): Promise<Connected> {
  const uri = process.env.NEXT_PUBLIC_SPACETIMEDB_URI ?? "http://127.0.0.1:3000";
  const db = process.env.NEXT_PUBLIC_SPACETIMEDB_DB ?? "snaparena";

  return new Promise((resolve, reject) => {
    const conn = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(db)
      .withToken(ownerToken())
      .onConnect(() => resolve({ conn, close: () => conn.disconnect() }))
      .onConnectError((_ctx, error) => reject(error))
      .build();
  });
}

/**
 * Runs `work` against a live connection and always closes it.
 *
 * Scripts that forget to disconnect leave the process hanging on an open socket,
 * which in a Makefile or CI reads as a hung build rather than a finished one.
 */
export async function withConnection<T>(
  work: (conn: DbConnection) => Promise<T>,
): Promise<T> {
  const { conn, close } = await connect();
  try {
    return await work(conn);
  } finally {
    close();
  }
}
