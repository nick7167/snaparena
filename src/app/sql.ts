/**
 * One read of a public table, from the server, over HTTP.
 *
 * SERVER-SIDE ONLY, and deliberately tiny. The app talks to SpacetimeDB over a WebSocket
 * subscription everywhere else; that is the right tool for a screen that stays open and
 * the wrong one for a single read during a render, which is all `generateMetadata` needs.
 * SpacetimeDB exposes the same SQL its CLI uses over HTTP, so this is that, with no client
 * and no connection to tear down.
 *
 * ONLY PUBLIC TABLES. The request carries no credentials, so the database will not serve a
 * private table through it — which is what makes an unauthenticated read safe rather than
 * a hole. Callers must not reach for `guess`, `track` or anything else marked private:
 * they would get an error, not data, and the attempt would mean the caller had
 * misunderstood the boundary.
 *
 * INTERPOLATION IS THE CALLER'S PROBLEM. There is no parameter binding here, so every
 * caller sanitises its own values into a shape that cannot carry syntax. See
 * `escapeHandle` in the profile layout for the pattern.
 */

const URI = process.env.NEXT_PUBLIC_SPACETIMEDB_URI;
const DB = process.env.NEXT_PUBLIC_SPACETIMEDB_DB;

/** How long a metadata read may take before the page renders without it. */
const TIMEOUT_MS = 2_000;

/**
 * Runs one statement and returns the first row, or `null` when nothing matched.
 *
 * Throws on a transport or query failure rather than returning null, so a caller can tell
 * "no such player" from "the database did not answer" — the profile layout treats them
 * the same, but it says so explicitly rather than by accident.
 */
export async function publicRow<Row>(sql: string): Promise<Row | null> {
  if (!URI || !DB) throw new Error("SpacetimeDB URI or database name is not configured");

  const response = await fetch(`${URI}/v1/database/${DB}/sql`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: sql,
    /**
     * Bounded, because this runs inside a render. A slow database must not hold a page
     * open — the caller's catch degrades to a plain title, which is the right trade for
     * something decorative.
     */
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Metadata is regenerated per request; caching here would pin a rank to whatever it
    // was the first time somebody shared the link.
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`SQL read failed: ${response.status}`);

  /**
   * The endpoint answers with one result per statement, each carrying its own rows. One
   * statement in, so the first result is the only one, and its first row is the answer.
   */
  const results = (await response.json()) as { rows?: unknown[] }[];
  const rows = results?.[0]?.rows;

  return (rows?.[0] as Row) ?? null;
}
