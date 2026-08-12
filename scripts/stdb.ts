/**
 * Connects a terminal script to the SpacetimeDB module as the module owner.
 *
 * The Convex versions of these scripts authenticated with ADMIN_IMPORT_SECRET, a
 * password shared between `.env.local` and the deployment. There is no secret any
 * more: the module captured the publisher's identity in `module_owner` during
 * `init`, and `requireModuleOwner` checks `ctx.sender` against it. So a script only
 * has to connect AS that identity, and the `spacetime` CLI already holds a token
 * for it. See `./stdb-token.ts` for how that token is resolved.
 */
import { DbConnection } from "../src/module_bindings/index.ts";
// Lives in its own module so a caller that only wants the token — the e2e helpers — does
// not import the generated client bindings to get it.
import { ownerToken } from "./stdb-token.ts";

export { ownerToken };

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
